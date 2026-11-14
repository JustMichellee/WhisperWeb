import { and, desc, eq, inArray, isNull, lt, ne, or } from 'drizzle-orm';
import type {
  ConversationDto,
  ConversationMemberDto,
  MessageDto,
  MessageReactionDto,
  MessageReceiptDto,
} from '@chat/shared';
import type { AppDatabase } from '../db/index.js';
import {
  blockedUsers,
  conversationMembers,
  conversations,
  hiddenMessages,
  messageReactions,
  messageReceipts,
  messages,
  users,
} from '../db/schema.js';

export type OnlineChecker = (userId: string) => boolean;

export async function isBlockedBetween(db: AppDatabase, userA: string, userB: string): Promise<boolean> {
  const rows = await db
    .select({ blockerId: blockedUsers.blockerId })
    .from(blockedUsers)
    .where(
      or(
        and(eq(blockedUsers.blockerId, userA), eq(blockedUsers.blockedId, userB)),
        and(eq(blockedUsers.blockerId, userB), eq(blockedUsers.blockedId, userA))
      )
    )
    .limit(1);
  return rows.length > 0;
}

export async function getConversationMemberIds(db: AppDatabase, conversationId: string): Promise<string[]> {
  const rows = await db
    .select({ userId: conversationMembers.userId })
    .from(conversationMembers)
    .where(eq(conversationMembers.conversationId, conversationId));
  return rows.map((r) => r.userId);
}

export async function buildMessageDtos(
  db: AppDatabase,
  messageRows: (typeof messages.$inferSelect)[]
): Promise<MessageDto[]> {
  if (messageRows.length === 0) return [];
  const msgIds = messageRows.map((m) => m.id);

  const [receiptRows, reactionRows] = await Promise.all([
    db.select().from(messageReceipts).where(inArray(messageReceipts.messageId, msgIds)),
    db.select().from(messageReactions).where(inArray(messageReactions.messageId, msgIds)),
  ]);

  const receiptMap = new Map<string, MessageReceiptDto[]>();
  for (const r of receiptRows) {
    const list = receiptMap.get(r.messageId) ?? [];
    list.push({ userId: r.userId, deliveredAt: r.deliveredAt, readAt: r.readAt });
    receiptMap.set(r.messageId, list);
  }

  const reactionMap = new Map<string, MessageReactionDto[]>();
  for (const r of reactionRows) {
    const list = reactionMap.get(r.messageId) ?? [];
    list.push({ userId: r.userId, emoji: r.emoji });
    reactionMap.set(r.messageId, list);
  }

  return messageRows.map((m) => ({
    id: m.id,
    conversationId: m.conversationId,
    senderId: m.senderId,
    replyToId: m.replyToId,
    ciphertext: m.isDeleted ? '' : m.ciphertext,
    iv: m.isDeleted ? '' : m.iv,
    messageType: m.messageType,
    attachmentId: m.isDeleted ? null : m.attachmentId,
    keyVersion: m.keyVersion,
    isDeleted: m.isDeleted,
    createdAt: m.createdAt,
    receipts: receiptMap.get(m.id) ?? [],
    reactions: reactionMap.get(m.id) ?? [],
  }));
}

export async function listUserConversations(
  db: AppDatabase,
  userId: string,
  isUserOnline: OnlineChecker
): Promise<ConversationDto[]> {
  const memberships = await db
    .select({ conversationId: conversationMembers.conversationId })
    .from(conversationMembers)
    .where(eq(conversationMembers.userId, userId));

  if (memberships.length === 0) return [];
  const convIds = memberships.map((m) => m.conversationId);

  const convRows = await db
    .select()
    .from(conversations)
    .where(inArray(conversations.id, convIds))
    .orderBy(desc(conversations.lastMessageAt), desc(conversations.createdAt));

  const memberRows = await db
    .select({
      conversationId: conversationMembers.conversationId,
      userId: conversationMembers.userId,
      role: conversationMembers.role,
      encryptedGroupKey: conversationMembers.encryptedGroupKey,
      groupKeyIv: conversationMembers.groupKeyIv,
      keySenderPublicKey: conversationMembers.keySenderPublicKey,
      lastReadMessageId: conversationMembers.lastReadMessageId,
      username: users.username,
      displayName: users.displayName,
      aboutBio: users.aboutBio,
      avatarUrl: users.avatarUrl,
      publicKey: users.publicKey,
      hideOnlineStatus: users.hideOnlineStatus,
      lastSeenAt: users.lastSeenAt,
    })
    .from(conversationMembers)
    .innerJoin(users, eq(conversationMembers.userId, users.id))
    .where(inArray(conversationMembers.conversationId, convIds));

  const membersByConv = new Map<string, ConversationMemberDto[]>();
  for (const row of memberRows) {
    const list = membersByConv.get(row.conversationId) ?? [];
    list.push({
      userId: row.userId,
      username: row.username,
      displayName: row.displayName,
      aboutBio: row.aboutBio,
      avatarUrl: row.avatarUrl,
      publicKey: row.publicKey,
      role: row.role,
      // Only expose the encrypted group key belonging to the requesting user
      encryptedGroupKey: row.userId === userId ? row.encryptedGroupKey : null,
      groupKeyIv: row.userId === userId ? row.groupKeyIv : null,
      keySenderPublicKey: row.userId === userId ? row.keySenderPublicKey : null,
      lastReadMessageId: row.lastReadMessageId,
      isOnline: row.hideOnlineStatus ? false : isUserOnline(row.userId),
      lastSeenAt: row.hideOnlineStatus ? null : row.lastSeenAt,
    });
    membersByConv.set(row.conversationId, list);
  }

  const results: ConversationDto[] = [];
  for (const conv of convRows) {
    const lastVisibleRows = await db
      .select({ msg: messages })
      .from(messages)
      .leftJoin(
        hiddenMessages,
        and(eq(hiddenMessages.messageId, messages.id), eq(hiddenMessages.userId, userId))
      )
      .where(and(eq(messages.conversationId, conv.id), isNull(hiddenMessages.messageId)))
      .orderBy(desc(messages.createdAt))
      .limit(1);

    const lastMsgDto =
      lastVisibleRows.length > 0 ? (await buildMessageDtos(db, [lastVisibleRows[0]!.msg]))[0] ?? null : null;

    const unreadRows = await db
      .select({ id: messages.id })
      .from(messages)
      .leftJoin(
        messageReceipts,
        and(eq(messageReceipts.messageId, messages.id), eq(messageReceipts.userId, userId))
      )
      .leftJoin(
        hiddenMessages,
        and(eq(hiddenMessages.messageId, messages.id), eq(hiddenMessages.userId, userId))
      )
      .where(
        and(
          eq(messages.conversationId, conv.id),
          ne(messages.senderId, userId),
          eq(messages.isDeleted, false),
          isNull(hiddenMessages.messageId),
          isNull(messageReceipts.readAt)
        )
      );

    results.push({
      id: conv.id,
      type: conv.type,
      name: conv.name,
      description: conv.description,
      avatarUrl: conv.avatarUrl,
      keyVersion: conv.keyVersion,
      createdBy: conv.createdBy,
      lastMessageAt: conv.lastMessageAt,
      createdAt: conv.createdAt,
      unreadCount: unreadRows.length,
      members: membersByConv.get(conv.id) ?? [],
      lastMessage: lastMsgDto,
    });
  }

  return results;
}

export async function listConversationMessages(
  db: AppDatabase,
  conversationId: string,
  userId: string,
  beforeTimestamp: number | null,
  limit: number
): Promise<MessageDto[]> {
  const conditions = [eq(messages.conversationId, conversationId), isNull(hiddenMessages.messageId)];
  if (beforeTimestamp !== null) {
    conditions.push(lt(messages.createdAt, beforeTimestamp));
  }

  const rows = await db
    .select({ msg: messages })
    .from(messages)
    .leftJoin(
      hiddenMessages,
      and(eq(hiddenMessages.messageId, messages.id), eq(hiddenMessages.userId, userId))
    )
    .where(and(...conditions))
    .orderBy(desc(messages.createdAt))
    .limit(limit);

  const ordered = rows.map((r) => r.msg).reverse();
  return buildMessageDtos(db, ordered);
}

