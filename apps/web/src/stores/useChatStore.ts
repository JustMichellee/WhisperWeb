import { create } from 'zustand';
import type {
  ConversationDto,
  DecryptedMessagePayload,
  MessageDto,
  ServerWsEnvelope,
  UserPublicDto,
} from '@chat/shared';
import { apiClient } from '../services/api';
import { wsManager } from '../services/ws';
import { decryptMessagePayload, encryptBinaryFile, encryptMessagePayload } from '../crypto/cipher';
import { deriveConversationKey } from '../crypto/keys';
import {
  createAndWrapNewGroupKey,
  unwrapMyGroupKey,
  wrapGroupKeyForMembers,
} from '../crypto/group';
import {
  loadCachedConversations,
  loadCachedMessages,
  saveCachedConversations,
  saveCachedMessages,
} from '../db/localVault';

export interface UiMessage extends MessageDto {
  decrypted: DecryptedMessagePayload | null;
  decryptError?: boolean;
  localStatus?: 'pending' | 'sent';
  tempId?: string;
}

export interface UiConversation extends ConversationDto {
  lastDecryptedText: string | null;
}

interface ChatState {
  conversations: UiConversation[];
  conversationsLoading: boolean;
  conversationsError: string | null;
  activeConversationId: string | null;
  messagesByConv: Record<string, UiMessage[]>;
  messagesLoading: Record<string, boolean>;
  messagesError: Record<string, string | null>;
  typingByConv: Record<string, string[]>;
  blockedUserIds: string[];
  wsConnected: boolean;
  replyTarget: UiMessage | null;

  keyCache: Map<string, { key: CryptoKey; rawBase64?: string; keyVersion: number }>;

  initializeSession: (token: string, user: UserPublicDto, privateKey: CryptoKey) => Promise<void>;
  resetSession: () => void;
  refreshConversations: (token: string, user: UserPublicDto, privateKey: CryptoKey) => Promise<void>;
  selectConversation: (
    conversationId: string | null,
    token: string,
    user: UserPublicDto,
    privateKey: CryptoKey
  ) => Promise<void>;
  startDirectChat: (
    targetUserId: string,
    token: string,
    user: UserPublicDto,
    privateKey: CryptoKey
  ) => Promise<string>;
  createGroup: (
    name: string,
    description: string,
    members: UserPublicDto[],
    token: string,
    user: UserPublicDto,
    privateKey: CryptoKey,
    avatarUrl?: string | null
  ) => Promise<string>;
  updateGroupInfo: (
    conversationId: string,
    patch: { name?: string; description?: string; avatarUrl?: string | null },
    token: string,
    user: UserPublicDto,
    privateKey: CryptoKey
  ) => Promise<void>;
  addGroupMembers: (
    conversationId: string,
    newMembers: UserPublicDto[],
    token: string,
    user: UserPublicDto,
    privateKey: CryptoKey
  ) => Promise<void>;
  removeGroupMemberAndRotate: (
    conversationId: string,
    removeUserId: string,
    token: string,
    user: UserPublicDto,
    privateKey: CryptoKey
  ) => Promise<void>;
  toggleBlockUser: (targetUserId: string, blocked: boolean, token: string) => Promise<void>;
  sendTextMessage: (
    conversationId: string,
    text: string,
    token: string,
    user: UserPublicDto,
    privateKey: CryptoKey
  ) => Promise<void>;
  sendFileMessage: (
    conversationId: string,
    file: File,
    caption: string,
    token: string,
    user: UserPublicDto,
    privateKey: CryptoKey
  ) => Promise<void>;
  sendTyping: (conversationId: string, isTyping: boolean) => void;
  toggleReaction: (conversationId: string, messageId: string, emoji: string | null) => void;
  deleteMessage: (conversationId: string, messageId: string, mode: 'everyone' | 'me') => void;
  setReplyTarget: (msg: UiMessage | null) => void;
  markConversationRead: (conversationId: string, myUserId: string) => void;
}

const typingTimeouts = new Map<string, number>();

async function resolveConversationKey(
  conv: ConversationDto,
  myUserId: string,
  privateKey: CryptoKey,
  keyCache: Map<string, { key: CryptoKey; rawBase64?: string; keyVersion: number }>
): Promise<{ key: CryptoKey; rawBase64?: string } | null> {
  const cached = keyCache.get(conv.id);
  if (cached && cached.keyVersion === conv.keyVersion) {
    return cached;
  }

  if (conv.type === 'direct') {
    const peer = conv.members.find((m) => m.userId !== myUserId);
    if (!peer) return null;
    const key = await deriveConversationKey(privateKey, peer.publicKey, conv.id);
    const entry = { key, keyVersion: conv.keyVersion };
    keyCache.set(conv.id, entry);
    return entry;
  }

  const myMembership = conv.members.find((m) => m.userId === myUserId);
  if (!myMembership) return null;
  const unwrapped = await unwrapMyGroupKey(privateKey, myMembership);
  if (!unwrapped) return null;

  const entry = { key: unwrapped.key, rawBase64: unwrapped.rawBase64, keyVersion: conv.keyVersion };
  keyCache.set(conv.id, entry);
  return entry;
}

async function decryptSingleMessage(
  msg: MessageDto,
  conv: ConversationDto,
  myUserId: string,
  privateKey: CryptoKey,
  keyCache: Map<string, { key: CryptoKey; rawBase64?: string; keyVersion: number }>
): Promise<UiMessage> {
  if (msg.isDeleted) {
    return { ...msg, decrypted: null, localStatus: 'sent' };
  }
  try {
    const keyEntry = await resolveConversationKey(conv, myUserId, privateKey, keyCache);
    if (!keyEntry) {
      return { ...msg, decrypted: null, decryptError: true, localStatus: 'sent' };
    }
    const decrypted = await decryptMessagePayload(keyEntry.key, msg.ciphertext, msg.iv);
    return { ...msg, decrypted, localStatus: 'sent' };
  } catch {
    return { ...msg, decrypted: null, decryptError: true, localStatus: 'sent' };
  }
}

function summarizeLastMessage(msg: UiMessage | null): string | null {
  if (!msg) return null;
  if (msg.isDeleted) return 'Pesan ini telah dihapus';
  if (msg.decryptError || !msg.decrypted) return 'Pesan terenkripsi (kunci versi lama)';
  if (msg.decrypted.media) {
    const label = msg.messageType === 'image' ? 'Foto' : msg.decrypted.media.fileName;
    return msg.decrypted.text ? `${label}: ${msg.decrypted.text}` : label;
  }
  return msg.decrypted.text;
}

let cleanupWsListeners: (() => void) | null = null;

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  conversationsLoading: false,
  conversationsError: null,
  activeConversationId: null,
  messagesByConv: {},
  messagesLoading: {},
  messagesError: {},
  typingByConv: {},
  blockedUserIds: [],
  wsConnected: false,
  replyTarget: null,
  keyCache: new Map(),

  initializeSession: async (token, user, privateKey) => {
    if (cleanupWsListeners) {
      cleanupWsListeners();
      cleanupWsListeners = null;
    }

    const unsubStatus = wsManager.onStatus((connected) => {
      set({ wsConnected: connected });
    });

    const unsubEvent = wsManager.onEvent((envelope: ServerWsEnvelope) => {
      void handleWsEvent(envelope, token, user, privateKey);
    });

    cleanupWsListeners = () => {
      unsubStatus();
      unsubEvent();
    };

    if (get().conversations.length === 0) {
      const cachedConvs = await loadCachedConversations<UiConversation>(user.id);
      if (cachedConvs && cachedConvs.length > 0 && get().conversations.length === 0) {
        set({ conversations: cachedConvs });
      }
    }

    wsManager.connect(token);
    await get().refreshConversations(token, user, privateKey);
  },

  resetSession: () => {
    if (cleanupWsListeners) {
      cleanupWsListeners();
      cleanupWsListeners = null;
    }
    wsManager.disconnect();
    get().keyCache.clear();
    set({
      conversations: [],
      conversationsLoading: false,
      conversationsError: null,
      activeConversationId: null,
      messagesByConv: {},
      messagesLoading: {},
      messagesError: {},
      typingByConv: {},
      blockedUserIds: [],
      wsConnected: false,
      replyTarget: null,
    });
  },

  refreshConversations: async (token, user, privateKey) => {
    set({ conversationsLoading: true, conversationsError: null });
    try {
      const [{ conversations }, { blockedUserIds }] = await Promise.all([
        apiClient.listConversations(token),
        apiClient.getBlockedUsers(token),
      ]);

      const uiConversations: UiConversation[] = await Promise.all(
        conversations.map(async (conv) => {
          const decryptedLast = conv.lastMessage
            ? await decryptSingleMessage(conv.lastMessage, conv, user.id, privateKey, get().keyCache)
            : null;
          return {
            ...conv,
            lastDecryptedText: summarizeLastMessage(decryptedLast),
          };
        })
      );

      set({
        conversations: uiConversations,
        blockedUserIds,
        conversationsLoading: false,
      });
      void saveCachedConversations(user.id, uiConversations);
    } catch (err) {
      set({
        conversationsLoading: false,
        conversationsError: err instanceof Error ? err.message : 'Gagal memuat percakapan.',
      });
    }
  },

  selectConversation: async (conversationId, token, user, privateKey) => {
    set({ activeConversationId: conversationId, replyTarget: null });
    if (!conversationId) return;

    const conv = get().conversations.find((c) => c.id === conversationId);
    if (!conv) return;

    const existingMsgs = get().messagesByConv[conversationId] ?? [];
    if (existingMsgs.length === 0) {
      const cachedMsgs = await loadCachedMessages<UiMessage>(user.id, conversationId);
      if (cachedMsgs && cachedMsgs.length > 0 && (get().messagesByConv[conversationId]?.length ?? 0) === 0) {
        set((state) => ({
          messagesByConv: { ...state.messagesByConv, [conversationId]: cachedMsgs },
        }));
      }
    }

    set((state) => ({
      messagesLoading: { ...state.messagesLoading, [conversationId]: true },
      messagesError: { ...state.messagesError, [conversationId]: null },
    }));

    try {
      const { messages } = await apiClient.listMessages(token, conversationId);
      const decryptedList = await Promise.all(
        messages.map((msg) => decryptSingleMessage(msg, conv, user.id, privateKey, get().keyCache))
      );

      set((state) => ({
        messagesByConv: { ...state.messagesByConv, [conversationId]: decryptedList },
        messagesLoading: { ...state.messagesLoading, [conversationId]: false },
      }));

      void saveCachedMessages(user.id, conversationId, decryptedList);
      get().markConversationRead(conversationId, user.id);
    } catch (err) {
      set((state) => ({
        messagesLoading: { ...state.messagesLoading, [conversationId]: false },
        messagesError: {
          ...state.messagesError,
          [conversationId]: err instanceof Error ? err.message : 'Gagal memuat riwayat pesan.',
        },
      }));
    }
  },

  startDirectChat: async (targetUserId, token, user, privateKey) => {
    const { conversation } = await apiClient.createDirectConversation(token, targetUserId);
    await get().refreshConversations(token, user, privateKey);
    await get().selectConversation(conversation.id, token, user, privateKey);
    return conversation.id;
  },

  createGroup: async (name, description, members, token, user, privateKey, avatarUrl) => {
    const allMembers = [user, ...members.filter((m) => m.id !== user.id)];
    const { wrappedMembers } = await createAndWrapNewGroupKey(
      privateKey,
      user.publicKey,
      allMembers.map((m) => ({ userId: m.id, publicKey: m.publicKey }))
    );

    const { conversation } = await apiClient.createGroupConversation(token, {
      name,
      description,
      avatarUrl,
      members: wrappedMembers,
    });

    await get().refreshConversations(token, user, privateKey);
    await get().selectConversation(conversation.id, token, user, privateKey);
    return conversation.id;
  },

  updateGroupInfo: async (conversationId, patch, token, user, privateKey) => {
    await apiClient.updateGroupConversation(token, conversationId, patch);
    await get().refreshConversations(token, user, privateKey);
  },

  addGroupMembers: async (conversationId, newMembers, token, user, privateKey) => {
    const conv = get().conversations.find((c) => c.id === conversationId);
    if (!conv) return;

    const keyEntry = await resolveConversationKey(conv, user.id, privateKey, get().keyCache);
    if (!keyEntry?.rawBase64) {
      throw new Error('Kunci grup tidak ditemukan di sesi ini.');
    }

    const wrappedNewMembers = await wrapGroupKeyForMembers(
      privateKey,
      user.publicKey,
      keyEntry.rawBase64,
      newMembers.map((m) => ({ userId: m.id, publicKey: m.publicKey }))
    );

    await apiClient.updateGroupConversation(token, conversationId, {
      addMembers: wrappedNewMembers,
    });
    await get().refreshConversations(token, user, privateKey);
  },

  removeGroupMemberAndRotate: async (conversationId, removeUserId, token, user, privateKey) => {
    const conv = get().conversations.find((c) => c.id === conversationId);
    if (!conv) return;

    const remaining = conv.members.filter((m) => m.userId !== removeUserId);
    const isSelfLeave = removeUserId === user.id;

    if (isSelfLeave) {
      await apiClient.updateGroupConversation(token, conversationId, { removeUserId });
      get().keyCache.delete(conversationId);
      set({ activeConversationId: null });
      await get().refreshConversations(token, user, privateKey);
      return;
    }

    const { wrappedMembers } = await createAndWrapNewGroupKey(
      privateKey,
      user.publicKey,
      remaining.map((m) => ({ userId: m.userId, publicKey: m.publicKey }))
    );

    await apiClient.updateGroupConversation(token, conversationId, {
      removeUserId,
      rotatedKeys: wrappedMembers,
      newKeyVersion: conv.keyVersion + 1,
    });

    get().keyCache.delete(conversationId);
    await get().refreshConversations(token, user, privateKey);
  },

  toggleBlockUser: async (targetUserId, blocked, token) => {
    await apiClient.setBlockUser(token, targetUserId, blocked);
    set((state) => ({
      blockedUserIds: blocked
        ? [...new Set([...state.blockedUserIds, targetUserId])]
        : state.blockedUserIds.filter((id) => id !== targetUserId),
    }));
  },

  sendTextMessage: async (conversationId, text, _token, user, privateKey) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const conv = get().conversations.find((c) => c.id === conversationId);
    if (!conv) return;

    const keyEntry = await resolveConversationKey(conv, user.id, privateKey, get().keyCache);
    if (!keyEntry) throw new Error('Kunci enkripsi percakapan tidak tersedia.');

    const replyTarget = get().replyTarget;
    const replySender = replyTarget
      ? conv.members.find((m) => m.userId === replyTarget.senderId)?.displayName ?? 'Pengguna'
      : undefined;

    const payload: DecryptedMessagePayload = {
      text: trimmed,
      replyToPreview: replyTarget
        ? {
            id: replyTarget.id,
            senderName: replySender ?? 'Pengguna',
            snippet:
              replyTarget.decrypted?.text?.slice(0, 80) ||
              replyTarget.decrypted?.media?.fileName ||
              'Pesan',
          }
        : undefined,
    };

    const { ciphertext, iv } = await encryptMessagePayload(keyEntry.key, payload);
    const tempId = `tmp_${crypto.randomUUID()}`;
    const now = Date.now();

    const optimistic: UiMessage = {
      id: tempId,
      tempId,
      conversationId,
      senderId: user.id,
      replyToId: replyTarget?.id ?? null,
      ciphertext,
      iv,
      messageType: 'text',
      attachmentId: null,
      keyVersion: conv.keyVersion,
      isDeleted: false,
      createdAt: now,
      receipts: [],
      reactions: [],
      decrypted: payload,
      localStatus: 'pending',
    };

    set((state) => ({
      replyTarget: null,
      messagesByConv: {
        ...state.messagesByConv,
        [conversationId]: [...(state.messagesByConv[conversationId] ?? []), optimistic],
      },
    }));

    const sent = wsManager.send({
      event: 'chat:send',
      data: {
        tempId,
        conversationId,
        ciphertext,
        iv,
        messageType: 'text',
        replyToId: replyTarget?.id ?? null,
        attachmentId: null,
        keyVersion: conv.keyVersion,
      },
      timestamp: now,
    });

    if (!sent) {
      throw new Error('Koneksi WebSocket terputus. Pesan gagal dikirim.');
    }
  },

  sendFileMessage: async (conversationId, file, caption, token, user, privateKey) => {
    const conv = get().conversations.find((c) => c.id === conversationId);
    if (!conv) return;

    const keyEntry = await resolveConversationKey(conv, user.id, privateKey, get().keyCache);
    if (!keyEntry) throw new Error('Kunci enkripsi percakapan tidak tersedia.');

    const buffer = await file.arrayBuffer();
    const encryptedFile = await encryptBinaryFile(buffer);
    const uploaded = await apiClient.uploadEncryptedBlob(token, encryptedFile.encryptedBytes);

    const isImage = file.type.startsWith('image/');
    const messageType = isImage ? 'image' : 'file';
    const replyTarget = get().replyTarget;
    const replySender = replyTarget
      ? conv.members.find((m) => m.userId === replyTarget.senderId)?.displayName ?? 'Pengguna'
      : undefined;

    const payload: DecryptedMessagePayload = {
      text: caption.trim(),
      replyToPreview: replyTarget
        ? {
            id: replyTarget.id,
            senderName: replySender ?? 'Pengguna',
            snippet: replyTarget.decrypted?.text?.slice(0, 80) || 'Lampiran',
          }
        : undefined,
      media: {
        attachmentId: uploaded.attachmentId,
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        sizeBytes: file.size,
        fileKeyBase64: encryptedFile.fileKeyBase64,
        fileIvBase64: encryptedFile.fileIvBase64,
      },
    };

    const { ciphertext, iv } = await encryptMessagePayload(keyEntry.key, payload);
    const tempId = `tmp_${crypto.randomUUID()}`;
    const now = Date.now();

    const optimistic: UiMessage = {
      id: tempId,
      tempId,
      conversationId,
      senderId: user.id,
      replyToId: replyTarget?.id ?? null,
      ciphertext,
      iv,
      messageType,
      attachmentId: uploaded.attachmentId,
      keyVersion: conv.keyVersion,
      isDeleted: false,
      createdAt: now,
      receipts: [],
      reactions: [],
      decrypted: payload,
      localStatus: 'pending',
    };

    set((state) => ({
      replyTarget: null,
      messagesByConv: {
        ...state.messagesByConv,
        [conversationId]: [...(state.messagesByConv[conversationId] ?? []), optimistic],
      },
    }));

    wsManager.send({
      event: 'chat:send',
      data: {
        tempId,
        conversationId,
        ciphertext,
        iv,
        messageType,
        replyToId: replyTarget?.id ?? null,
        attachmentId: uploaded.attachmentId,
        keyVersion: conv.keyVersion,
      },
      timestamp: now,
    });
  },

  sendTyping: (conversationId, isTyping) => {
    wsManager.send({
      event: 'chat:typing',
      data: { conversationId, isTyping },
      timestamp: Date.now(),
    });
  },

  toggleReaction: (conversationId, messageId, emoji) => {
    wsManager.send({
      event: 'chat:reaction',
      data: { conversationId, messageId, emoji },
      timestamp: Date.now(),
    });
  },

  deleteMessage: (conversationId, messageId, mode) => {
    wsManager.send({
      event: 'chat:delete',
      data: { conversationId, messageId, mode },
      timestamp: Date.now(),
    });
  },

  setReplyTarget: (msg) => set({ replyTarget: msg }),

  markConversationRead: (conversationId, myUserId) => {
    const msgs = get().messagesByConv[conversationId] ?? [];
    const unreadIds = msgs
      .filter(
        (m) =>
          m.senderId !== myUserId &&
          !m.isDeleted &&
          !m.receipts.some((r) => r.userId === myUserId && r.readAt !== null)
      )
      .map((m) => m.id);

    if (unreadIds.length > 0) {
      wsManager.send({
        event: 'chat:read',
        data: { conversationId, messageIds: unreadIds },
        timestamp: Date.now(),
      });
    }

    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === conversationId ? { ...c, unreadCount: 0 } : c
      ),
    }));
  },
}));

async function handleWsEvent(
  envelope: ServerWsEnvelope,
  token: string,
  user: UserPublicDto,
  privateKey: CryptoKey
): Promise<void> {
  const store = useChatStore.getState();

  switch (envelope.event) {
    case 'chat:ack': {
      const { tempId, messageId, conversationId, createdAt } = envelope.data;
      useChatStore.setState((state) => {
        const list = state.messagesByConv[conversationId] ?? [];
        const updated = list.map((m) =>
          m.tempId === tempId ? { ...m, id: messageId, createdAt, localStatus: 'sent' as const } : m
        );
        void saveCachedMessages(user.id, conversationId, updated);
        return { messagesByConv: { ...state.messagesByConv, [conversationId]: updated } };
      });
      break;
    }

    case 'chat:message': {
      const incoming = envelope.data.message;
      let conv = store.conversations.find((c) => c.id === incoming.conversationId);
      if (!conv) {
        await store.refreshConversations(token, user, privateKey);
        conv = useChatStore.getState().conversations.find((c) => c.id === incoming.conversationId);
      }
      if (!conv) return;

      const decryptedMsg = await decryptSingleMessage(
        incoming,
        conv,
        user.id,
        privateKey,
        store.keyCache
      );

      useChatStore.setState((state) => {
        const current = state.messagesByConv[incoming.conversationId] ?? [];
        const alreadyExists = current.some((m) => m.id === incoming.id);
        const nextMessages = alreadyExists
          ? current.map((m) => (m.id === incoming.id ? decryptedMsg : m))
          : [...current, decryptedMsg];

        const isActive = state.activeConversationId === incoming.conversationId;
        const nextConvs = state.conversations
          .map((c) =>
            c.id === incoming.conversationId
              ? {
                  ...c,
                  lastMessage: incoming,
                  lastMessageAt: incoming.createdAt,
                  lastDecryptedText: summarizeLastMessage(decryptedMsg),
                  unreadCount:
                    incoming.senderId !== user.id && !isActive ? c.unreadCount + 1 : isActive ? 0 : c.unreadCount,
                }
              : c
          )
          .sort((a, b) => (b.lastMessageAt ?? b.createdAt) - (a.lastMessageAt ?? a.createdAt));

        void saveCachedMessages(user.id, incoming.conversationId, nextMessages);
        void saveCachedConversations(user.id, nextConvs);

        return {
          messagesByConv: { ...state.messagesByConv, [incoming.conversationId]: nextMessages },
          conversations: nextConvs,
        };
      });

      if (incoming.senderId !== user.id) {
        wsManager.send({
          event: 'chat:delivered',
          data: { conversationId: incoming.conversationId, messageIds: [incoming.id] },
          timestamp: Date.now(),
        });

        if (useChatStore.getState().activeConversationId === incoming.conversationId && !document.hidden) {
          wsManager.send({
            event: 'chat:read',
            data: { conversationId: incoming.conversationId, messageIds: [incoming.id] },
            timestamp: Date.now(),
          });
        }
      }
      break;
    }

    case 'chat:receipt_update': {
      const { conversationId, messageIds, userId, type, at } = envelope.data;
      const idSet = new Set(messageIds);
      useChatStore.setState((state) => {
        const list = state.messagesByConv[conversationId] ?? [];
        const updated = list.map((msg) => {
          if (!idSet.has(msg.id)) return msg;
          const existing = msg.receipts.find((r) => r.userId === userId);
          const nextReceipts = existing
            ? msg.receipts.map((r) =>
                r.userId === userId
                  ? {
                      ...r,
                      deliveredAt: type === 'delivered' || type === 'read' ? r.deliveredAt ?? at : r.deliveredAt,
                      readAt: type === 'read' ? at : r.readAt,
                    }
                  : r
              )
            : [
                ...msg.receipts,
                {
                  userId,
                  deliveredAt: at,
                  readAt: type === 'read' ? at : null,
                },
              ];
          return { ...msg, receipts: nextReceipts };
        });

        const nextConvs = state.conversations.map((c) => {
          if (c.id !== conversationId || !c.lastMessage || !idSet.has(c.lastMessage.id)) return c;
          const updatedLast = updated.find((u) => u.id === c.lastMessage!.id);
          return updatedLast ? { ...c, lastMessage: updatedLast } : c;
        });

        return {
          messagesByConv: { ...state.messagesByConv, [conversationId]: updated },
          conversations: nextConvs,
        };
      });
      break;
    }

    case 'chat:typing_update': {
      const { conversationId, userId, isTyping } = envelope.data;
      const timerKey = `${conversationId}:${userId}`;
      const existingTimer = typingTimeouts.get(timerKey);
      if (existingTimer) window.clearTimeout(existingTimer);

      useChatStore.setState((state) => {
        const current = state.typingByConv[conversationId] ?? [];
        const next = isTyping
          ? [...new Set([...current, userId])]
          : current.filter((id) => id !== userId);
        return { typingByConv: { ...state.typingByConv, [conversationId]: next } };
      });

      if (isTyping) {
        const tid = window.setTimeout(() => {
          useChatStore.setState((state) => ({
            typingByConv: {
              ...state.typingByConv,
              [conversationId]: (state.typingByConv[conversationId] ?? []).filter((id) => id !== userId),
            },
          }));
        }, 4000);
        typingTimeouts.set(timerKey, tid);
      }
      break;
    }

    case 'chat:reaction_update': {
      const { conversationId, messageId, userId, emoji } = envelope.data;
      useChatStore.setState((state) => {
        const list = state.messagesByConv[conversationId] ?? [];
        const updated = list.map((m) => {
          if (m.id !== messageId) return m;
          const filtered = m.reactions.filter((r) => r.userId !== userId);
          return {
            ...m,
            reactions: emoji === null ? filtered : [...filtered, { userId, emoji }],
          };
        });
        void saveCachedMessages(user.id, conversationId, updated);
        return { messagesByConv: { ...state.messagesByConv, [conversationId]: updated } };
      });
      break;
    }

    case 'chat:deleted': {
      const { conversationId, messageId, mode } = envelope.data;
      useChatStore.setState((state) => {
        const list = state.messagesByConv[conversationId] ?? [];
        const updated =
          mode === 'me'
            ? list.filter((m) => m.id !== messageId)
            : list.map((m) =>
                m.id === messageId
                  ? { ...m, isDeleted: true, ciphertext: '', iv: '', attachmentId: null, decrypted: null }
                  : m
              );
        void saveCachedMessages(user.id, conversationId, updated);
        return { messagesByConv: { ...state.messagesByConv, [conversationId]: updated } };
      });
      break;
    }

    case 'conversation:updated': {
      store.keyCache.delete(envelope.data.conversationId);
      await store.refreshConversations(token, user, privateKey);
      break;
    }

    case 'presence:update': {
      const { userId, isOnline, lastSeenAt } = envelope.data;
      useChatStore.setState((state) => ({
        conversations: state.conversations.map((c) => ({
          ...c,
          members: c.members.map((m) =>
            m.userId === userId ? { ...m, isOnline, lastSeenAt } : m
          ),
        })),
      }));
      break;
    }
  }
}

