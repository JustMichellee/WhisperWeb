import crypto from 'node:crypto';
import { Hono } from 'hono';
import { and, eq, inArray } from 'drizzle-orm';
import {
  CreateDirectConversationSchema,
  CreateGroupConversationSchema,
  UpdateGroupSchema,
} from '@chat/shared';
import type { ServerConfig } from '../config.js';
import type { AppDatabase } from '../db/index.js';
import { conversationMembers, conversations, users } from '../db/schema.js';
import { createAuthMiddleware, type AuthVariables } from '../middleware/authMiddleware.js';
import {
  getConversationMemberIds,
  isBlockedBetween,
  listConversationMessages,
  listUserConversations,
} from '../services/conversation.js';
import type { WebSocketHub } from '../ws/hub.js';

export function createConversationRoutes(db: AppDatabase, config: ServerConfig, hub: WebSocketHub) {
  const router = new Hono<{ Variables: AuthVariables }>();
  router.use('*', createAuthMiddleware(config));

  router.get('/', async (c) => {
    const userId = c.get('userId');
    const list = await listUserConversations(db, userId, hub.isOnline);
    return c.json({ conversations: list });
  });

  router.post('/direct', async (c) => {
    const userId = c.get('userId');
    const body = await c.req.json().catch(() => null);
    const parsed = CreateDirectConversationSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Target pengguna tidak valid.' }, 400);
    }

    const { targetUserId } = parsed.data;
    if (targetUserId === userId) {
      return c.json({ error: 'Tidak dapat membuat percakapan dengan diri sendiri.' }, 400);
    }

    const [targetUser] = await db.select({ id: users.id }).from(users).where(eq(users.id, targetUserId)).limit(1);
    if (!targetUser) {
      return c.json({ error: 'Pengguna tidak ditemukan.' }, 404);
    }

    if (await isBlockedBetween(db, userId, targetUserId)) {
      return c.json({ error: 'Tidak dapat memulai chat karena salah satu pihak memblokir.' }, 403);
    }

    // Check whether a direct conversation already exists between the two users
    const myMemberships = await db
      .select({ conversationId: conversationMembers.conversationId })
      .from(conversationMembers)
      .where(eq(conversationMembers.userId, userId));

    if (myMemberships.length > 0) {
      const candidateIds = myMemberships.map((m) => m.conversationId);
      const shared = await db
        .select({ conversationId: conversationMembers.conversationId })
        .from(conversationMembers)
        .innerJoin(conversations, eq(conversations.id, conversationMembers.conversationId))
        .where(
          and(
            inArray(conversationMembers.conversationId, candidateIds),
            eq(conversationMembers.userId, targetUserId),
            eq(conversations.type, 'direct')
          )
        )
        .limit(1);

      if (shared.length > 0) {
        const allConvs = await listUserConversations(db, userId, hub.isOnline);
        const existingConv = allConvs.find((conv) => conv.id === shared[0]!.conversationId);
        return c.json({ conversation: existingConv });
      }
    }

    const now = Date.now();
    const convId = `conv_${crypto.randomUUID()}`;

    await db.insert(conversations).values({
      id: convId,
      type: 'direct',
      name: null,
      description: '',
      avatarUrl: null,
      keyVersion: 1,
      createdBy: userId,
      lastMessageAt: now,
      createdAt: now,
    });

    await db.insert(conversationMembers).values([
      { conversationId: convId, userId, role: 'member', joinedAt: now },
      { conversationId: convId, userId: targetUserId, role: 'member', joinedAt: now },
    ]);

    hub.notifyUsers([userId, targetUserId], {
      event: 'conversation:updated',
      data: { conversationId: convId },
      timestamp: now,
    });

    const allConvs = await listUserConversations(db, userId, hub.isOnline);
    const createdConv = allConvs.find((conv) => conv.id === convId);
    return c.json({ conversation: createdConv }, 201);
  });

  router.post('/group', async (c) => {
    const userId = c.get('userId');
    const body = await c.req.json().catch(() => null);
    const parsed = CreateGroupConversationSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: parsed.error.issues[0]?.message ?? 'Data grup tidak valid.' }, 400);
    }

    const input = parsed.data;
    const hasCreator = input.members.some((m) => m.userId === userId);
    if (!hasCreator) {
      return c.json({ error: 'Pembuat grup wajib masuk dalam daftar anggota.' }, 400);
    }

    const now = Date.now();
    const convId = `grp_${crypto.randomUUID()}`;

    await db.insert(conversations).values({
      id: convId,
      type: 'group',
      name: input.name,
      description: input.description ?? '',
      avatarUrl: input.avatarUrl ?? null,
      keyVersion: 1,
      createdBy: userId,
      lastMessageAt: now,
      createdAt: now,
    });

    await db.insert(conversationMembers).values(
      input.members.map((m) => ({
        conversationId: convId,
        userId: m.userId,
        role: (m.userId === userId ? 'admin' : 'member') as 'admin' | 'member',
        encryptedGroupKey: m.encryptedGroupKey,
        groupKeyIv: m.groupKeyIv,
        keySenderPublicKey: m.keySenderPublicKey,
        joinedAt: now,
      }))
    );

    const memberIds = input.members.map((m) => m.userId);
    hub.notifyUsers(memberIds, {
      event: 'conversation:updated',
      data: { conversationId: convId },
      timestamp: now,
    });

    const allConvs = await listUserConversations(db, userId, hub.isOnline);
    const createdConv = allConvs.find((conv) => conv.id === convId);
    return c.json({ conversation: createdConv }, 201);
  });

  router.patch('/:id/group', async (c) => {
    const userId = c.get('userId');
    const convId = c.req.param('id');

    const [conv] = await db.select().from(conversations).where(eq(conversations.id, convId)).limit(1);
    if (!conv || conv.type !== 'group') {
      return c.json({ error: 'Grup tidak ditemukan.' }, 404);
    }

    const [membership] = await db
      .select()
      .from(conversationMembers)
      .where(and(eq(conversationMembers.conversationId, convId), eq(conversationMembers.userId, userId)))
      .limit(1);

    if (!membership) {
      return c.json({ error: 'Anda bukan anggota grup ini.' }, 403);
    }

    const body = await c.req.json().catch(() => null);
    const parsed = UpdateGroupSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Data pembaruan grup tidak valid.' }, 400);
    }

    const input = parsed.data;
    const isSelfLeave = input.removeUserId === userId;
    if (!isSelfLeave && membership.role !== 'admin') {
      return c.json({ error: 'Hanya admin grup yang dapat mengubah pengaturan grup.' }, 403);
    }

    const now = Date.now();
    const convUpdates: Partial<typeof conversations.$inferInsert> = {};
    if (input.name !== undefined) convUpdates.name = input.name;
    if (input.description !== undefined) convUpdates.description = input.description;
    if (input.avatarUrl !== undefined) convUpdates.avatarUrl = input.avatarUrl;
    if (input.newKeyVersion !== undefined) convUpdates.keyVersion = input.newKeyVersion;

    if (Object.keys(convUpdates).length > 0) {
      await db.update(conversations).set(convUpdates).where(eq(conversations.id, convId));
    }

    if (input.addMembers && input.addMembers.length > 0) {
      for (const m of input.addMembers) {
        await db
          .insert(conversationMembers)
          .values({
            conversationId: convId,
            userId: m.userId,
            role: 'member',
            encryptedGroupKey: m.encryptedGroupKey,
            groupKeyIv: m.groupKeyIv,
            keySenderPublicKey: m.keySenderPublicKey,
            joinedAt: now,
          })
          .onConflictDoNothing();
      }
    }

    const previousMembers = await getConversationMemberIds(db, convId);

    if (input.removeUserId) {
      await db
        .delete(conversationMembers)
        .where(and(eq(conversationMembers.conversationId, convId), eq(conversationMembers.userId, input.removeUserId)));
    }

    if (input.rotatedKeys && input.rotatedKeys.length > 0) {
      for (const rk of input.rotatedKeys) {
        await db
          .update(conversationMembers)
          .set({
            encryptedGroupKey: rk.encryptedGroupKey,
            groupKeyIv: rk.groupKeyIv,
            keySenderPublicKey: rk.keySenderPublicKey,
          })
          .where(and(eq(conversationMembers.conversationId, convId), eq(conversationMembers.userId, rk.userId)));
      }
    }

    const updatedMembers = await getConversationMemberIds(db, convId);
    const notifyTargets = [...new Set([...previousMembers, ...updatedMembers])];
    hub.notifyUsers(notifyTargets, {
      event: 'conversation:updated',
      data: { conversationId: convId },
      timestamp: now,
    });

    const allConvs = await listUserConversations(db, userId, hub.isOnline);
    const updatedConv = allConvs.find((item) => item.id === convId) ?? null;
    return c.json({ conversation: updatedConv });
  });

  router.get('/:id/messages', async (c) => {
    const userId = c.get('userId');
    const convId = c.req.param('id');

    const memberIds = await getConversationMemberIds(db, convId);
    if (!memberIds.includes(userId)) {
      return c.json({ error: 'Akses ke percakapan ditolak.' }, 403);
    }

    const beforeRaw = c.req.query('before');
    const before = beforeRaw ? Number(beforeRaw) : null;
    const limitRaw = Number(c.req.query('limit') ?? 50);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 50;

    const list = await listConversationMessages(
      db,
      convId,
      userId,
      before !== null && Number.isFinite(before) ? before : null,
      limit
    );

    return c.json({ messages: list });
  });

  return router;
}

