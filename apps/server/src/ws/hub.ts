import crypto from 'node:crypto';
import type { WSContext } from 'hono/ws';
import { and, eq, inArray, ne } from 'drizzle-orm';
import {
  WsDeleteMessageSchema,
  WsReactionSchema,
  WsReceiptBatchSchema,
  WsSendMessageSchema,
  WsTypingSchema,
  type ServerWsEnvelope,
} from '@chat/shared';
import type { AppDatabase } from '../db/index.js';
import {
  conversationMembers,
  conversations,
  hiddenMessages,
  messageReactions,
  messageReceipts,
  messages,
  users,
} from '../db/schema.js';
import { buildMessageDtos, getConversationMemberIds, isBlockedBetween } from '../services/conversation.js';

export class WebSocketHub {
  private readonly connections = new Map<string, Set<WSContext>>();

  constructor(private readonly db: AppDatabase) {}

  isOnline = (userId: string): boolean => {
    const sockets = this.connections.get(userId);
    return sockets !== undefined && sockets.size > 0;
  };

  async handleOpen(userId: string, ws: WSContext): Promise<void> {
    let set = this.connections.get(userId);
    const wasOffline = !set || set.size === 0;
    if (!set) {
      set = new Set();
      this.connections.set(userId, set);
    }
    set.add(ws);

    if (wasOffline) {
      const now = Date.now();
      await this.db.update(users).set({ lastSeenAt: now }).where(eq(users.id, userId));
      await this.broadcastPresence(userId, true, now);
    }
  }

  async handleClose(userId: string, ws: WSContext): Promise<void> {
    const set = this.connections.get(userId);
    if (!set) return;
    set.delete(ws);
    if (set.size === 0) {
      this.connections.delete(userId);
      const now = Date.now();
      await this.db.update(users).set({ lastSeenAt: now }).where(eq(users.id, userId));
      await this.broadcastPresence(userId, false, now);
    }
  }

  async handleMessage(userId: string, ws: WSContext, rawData: string): Promise<void> {
    let parsed: { event?: unknown; data?: unknown };
    try {
      parsed = JSON.parse(rawData) as { event?: unknown; data?: unknown };
    } catch {
      this.sendToSocket(ws, { event: 'error', data: { message: 'Format JSON tidak valid.' }, timestamp: Date.now() });
      return;
    }

    switch (parsed.event) {
      case 'chat:send':
        await this.onChatSend(userId, ws, parsed.data);
        break;
      case 'chat:delivered':
        await this.onReceiptBatch(userId, parsed.data, 'delivered');
        break;
      case 'chat:read':
        await this.onReceiptBatch(userId, parsed.data, 'read');
        break;
      case 'chat:typing':
        await this.onTyping(userId, parsed.data);
        break;
      case 'chat:reaction':
        await this.onReaction(userId, parsed.data);
        break;
      case 'chat:delete':
        await this.onDelete(userId, ws, parsed.data);
        break;
      default:
        this.sendToSocket(ws, { event: 'error', data: { message: 'Event WebSocket tidak dikenal.' }, timestamp: Date.now() });
    }
  }

  notifyUsers(userIds: string[], envelope: ServerWsEnvelope): void {
    const payload = JSON.stringify(envelope);
    for (const uid of userIds) {
      const sockets = this.connections.get(uid);
      if (!sockets) continue;
      for (const sock of sockets) {
        try {
          sock.send(payload);
        } catch {
          // Ignore closed socket; onClose cleans up membership
        }
      }
    }
  }

  private sendToSocket(ws: WSContext, envelope: ServerWsEnvelope): void {
    try {
      ws.send(JSON.stringify(envelope));
    } catch {
      // Socket already closed
    }
  }

  private async broadcastPresence(userId: string, isOnline: boolean, lastSeenAt: number): Promise<void> {
    const [userRow] = await this.db
      .select({ hideOnlineStatus: users.hideOnlineStatus })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!userRow || userRow.hideOnlineStatus) return;

    const myConvs = await this.db
      .select({ conversationId: conversationMembers.conversationId })
      .from(conversationMembers)
      .where(eq(conversationMembers.userId, userId));

    if (myConvs.length === 0) return;

    const peerRows = await this.db
      .select({ userId: conversationMembers.userId })
      .from(conversationMembers)
      .where(
        and(
          inArray(
            conversationMembers.conversationId,
            myConvs.map((c) => c.conversationId)
          ),
          ne(conversationMembers.userId, userId)
        )
      );

    const peerIds = [...new Set(peerRows.map((p) => p.userId))];
    this.notifyUsers(peerIds, {
      event: 'presence:update',
      data: { userId, isOnline, lastSeenAt },
      timestamp: Date.now(),
    });
  }

  private async onChatSend(userId: string, ws: WSContext, data: unknown): Promise<void> {
    const validated = WsSendMessageSchema.safeParse(data);
    if (!validated.success) {
      this.sendToSocket(ws, { event: 'error', data: { message: 'Payload pesan tidak valid.' }, timestamp: Date.now() });
      return;
    }

    const input = validated.data;
    const memberIds = await getConversationMemberIds(this.db, input.conversationId);
    if (!memberIds.includes(userId)) {
      this.sendToSocket(ws, { event: 'error', data: { message: 'Akses ke percakapan ditolak.' }, timestamp: Date.now() });
      return;
    }

    const [conv] = await this.db
      .select({ type: conversations.type })
      .from(conversations)
      .where(eq(conversations.id, input.conversationId))
      .limit(1);

    if (!conv) return;

    if (conv.type === 'direct') {
      const peerId = memberIds.find((id) => id !== userId);
      if (peerId && (await isBlockedBetween(this.db, userId, peerId))) {
        this.sendToSocket(ws, {
          event: 'error',
          data: { message: 'Tidak dapat mengirim pesan karena kontak diblokir.' },
          timestamp: Date.now(),
        });
        return;
      }
    }

    const now = Date.now();
    const messageId = `msg_${crypto.randomUUID()}`;

    const [inserted] = await this.db
      .insert(messages)
      .values({
        id: messageId,
        conversationId: input.conversationId,
        senderId: userId,
        replyToId: input.replyToId ?? null,
        ciphertext: input.ciphertext,
        iv: input.iv,
        messageType: input.messageType,
        attachmentId: input.attachmentId ?? null,
        keyVersion: input.keyVersion,
        isDeleted: false,
        createdAt: now,
      })
      .returning();

    await this.db
      .update(conversations)
      .set({ lastMessageAt: now })
      .where(eq(conversations.id, input.conversationId));

    const [messageDto] = await buildMessageDtos(this.db, [inserted!]);
    if (!messageDto) return;

    this.sendToSocket(ws, {
      event: 'chat:ack',
      data: {
        tempId: input.tempId,
        messageId,
        conversationId: input.conversationId,
        createdAt: now,
      },
      timestamp: now,
    });

    this.notifyUsers(memberIds, {
      event: 'chat:message',
      data: { message: messageDto },
      timestamp: now,
    });
  }

  private async onReceiptBatch(userId: string, data: unknown, type: 'delivered' | 'read'): Promise<void> {
    const validated = WsReceiptBatchSchema.safeParse(data);
    if (!validated.success) return;

    const { conversationId, messageIds } = validated.data;
    const memberIds = await getConversationMemberIds(this.db, conversationId);
    if (!memberIds.includes(userId)) return;

    const now = Date.now();
    const targetMsgs = await this.db
      .select({ id: messages.id, senderId: messages.senderId })
      .from(messages)
      .where(and(eq(messages.conversationId, conversationId), inArray(messages.id, messageIds)));

    const validIds = targetMsgs.filter((m) => m.senderId !== userId).map((m) => m.id);
    if (validIds.length === 0) return;

    for (const msgId of validIds) {
      if (type === 'delivered') {
        await this.db
          .insert(messageReceipts)
          .values({ messageId: msgId, userId, deliveredAt: now, readAt: null })
          .onConflictDoUpdate({
            target: [messageReceipts.messageId, messageReceipts.userId],
            set: { deliveredAt: now },
          });
      } else {
        await this.db
          .insert(messageReceipts)
          .values({ messageId: msgId, userId, deliveredAt: now, readAt: now })
          .onConflictDoUpdate({
            target: [messageReceipts.messageId, messageReceipts.userId],
            set: { deliveredAt: now, readAt: now },
          });
      }
    }

    if (type === 'read' && validIds.length > 0) {
      await this.db
        .update(conversationMembers)
        .set({ lastReadMessageId: validIds[validIds.length - 1] })
        .where(and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.userId, userId)));
    }

    this.notifyUsers(memberIds, {
      event: 'chat:receipt_update',
      data: {
        conversationId,
        messageIds: validIds,
        userId,
        type,
        at: now,
      },
      timestamp: now,
    });
  }

  private async onTyping(userId: string, data: unknown): Promise<void> {
    const validated = WsTypingSchema.safeParse(data);
    if (!validated.success) return;

    const memberIds = await getConversationMemberIds(this.db, validated.data.conversationId);
    if (!memberIds.includes(userId)) return;

    const others = memberIds.filter((id) => id !== userId);
    this.notifyUsers(others, {
      event: 'chat:typing_update',
      data: {
        conversationId: validated.data.conversationId,
        userId,
        isTyping: validated.data.isTyping,
      },
      timestamp: Date.now(),
    });
  }

  private async onReaction(userId: string, data: unknown): Promise<void> {
    const validated = WsReactionSchema.safeParse(data);
    if (!validated.success) return;

    const { conversationId, messageId, emoji } = validated.data;
    const memberIds = await getConversationMemberIds(this.db, conversationId);
    if (!memberIds.includes(userId)) return;

    if (emoji === null) {
      await this.db
        .delete(messageReactions)
        .where(and(eq(messageReactions.messageId, messageId), eq(messageReactions.userId, userId)));
    } else {
      await this.db
        .insert(messageReactions)
        .values({ messageId, userId, emoji, createdAt: Date.now() })
        .onConflictDoUpdate({
          target: [messageReactions.messageId, messageReactions.userId],
          set: { emoji, createdAt: Date.now() },
        });
    }

    this.notifyUsers(memberIds, {
      event: 'chat:reaction_update',
      data: { conversationId, messageId, userId, emoji },
      timestamp: Date.now(),
    });
  }

  private async onDelete(userId: string, ws: WSContext, data: unknown): Promise<void> {
    const validated = WsDeleteMessageSchema.safeParse(data);
    if (!validated.success) return;

    const { conversationId, messageId, mode } = validated.data;
    const memberIds = await getConversationMemberIds(this.db, conversationId);
    if (!memberIds.includes(userId)) return;

    if (mode === 'everyone') {
      const [msg] = await this.db
        .select({ senderId: messages.senderId })
        .from(messages)
        .where(and(eq(messages.id, messageId), eq(messages.conversationId, conversationId)))
        .limit(1);

      if (!msg || msg.senderId !== userId) {
        this.sendToSocket(ws, {
          event: 'error',
          data: { message: 'Hanya pengirim yang dapat menghapus pesan untuk semua orang.' },
          timestamp: Date.now(),
        });
        return;
      }

      await this.db
        .update(messages)
        .set({ isDeleted: true, ciphertext: '', iv: '', attachmentId: null })
        .where(eq(messages.id, messageId));

      this.notifyUsers(memberIds, {
        event: 'chat:deleted',
        data: { conversationId, messageId, mode: 'everyone', deletedBy: userId },
        timestamp: Date.now(),
      });
    } else {
      await this.db
        .insert(hiddenMessages)
        .values({ messageId, userId })
        .onConflictDoNothing();

      this.notifyUsers([userId], {
        event: 'chat:deleted',
        data: { conversationId, messageId, mode: 'me', deletedBy: userId },
        timestamp: Date.now(),
      });
    }
  }
}

