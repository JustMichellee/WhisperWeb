import { Hono } from 'hono';
import { and, eq, like, ne } from 'drizzle-orm';
import { BlockUserSchema, UpdateProfileSchema } from '@chat/shared';
import type { ServerConfig } from '../config.js';
import type { AppDatabase } from '../db/index.js';
import { blockedUsers, passkeyCredentials, users } from '../db/schema.js';
import { createAuthMiddleware, type AuthVariables } from '../middleware/authMiddleware.js';
import { toUserPublicDto } from '../services/auth.js';
import type { WebSocketHub } from '../ws/hub.js';

export function createUserRoutes(db: AppDatabase, config: ServerConfig, hub: WebSocketHub) {
  const router = new Hono<{ Variables: AuthVariables }>();
  router.use('*', createAuthMiddleware(config));

  router.get('/me', async (c) => {
    const userId = c.get('userId');
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) return c.json({ error: 'Pengguna tidak ditemukan.' }, 404);

    const passkeys = await db
      .select({ id: passkeyCredentials.id, createdAt: passkeyCredentials.createdAt })
      .from(passkeyCredentials)
      .where(eq(passkeyCredentials.userId, userId));

    return c.json({
      user: toUserPublicDto(user, hub.isOnline(user.id)),
      passkeyCount: passkeys.length,
    });
  });

  router.patch('/me', async (c) => {
    const userId = c.get('userId');
    const body = await c.req.json().catch(() => null);
    const parsed = UpdateProfileSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: parsed.error.issues[0]?.message ?? 'Profil tidak valid.' }, 400);
    }

    const updates: Partial<typeof users.$inferInsert> = {};
    if (parsed.data.displayName !== undefined) updates.displayName = parsed.data.displayName;
    if (parsed.data.aboutBio !== undefined) updates.aboutBio = parsed.data.aboutBio;
    if (parsed.data.avatarUrl !== undefined) updates.avatarUrl = parsed.data.avatarUrl;
    if (parsed.data.hideOnlineStatus !== undefined) updates.hideOnlineStatus = parsed.data.hideOnlineStatus;

    if (Object.keys(updates).length === 0) {
      return c.json({ error: 'Tidak ada perubahan yang dikirim.' }, 400);
    }

    const [updated] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, userId))
      .returning();

    if (!updated) return c.json({ error: 'Pengguna tidak ditemukan.' }, 404);
    return c.json({ user: toUserPublicDto(updated, hub.isOnline(updated.id)) });
  });

  router.get('/search', async (c) => {
    const userId = c.get('userId');
    const rawQuery = (c.req.query('q') ?? '').trim().toLowerCase().replace(/^@/, '');
    if (rawQuery.length < 2) {
      return c.json({ users: [] });
    }

    const rows = await db
      .select()
      .from(users)
      .where(and(ne(users.id, userId), like(users.username, `${rawQuery}%`)))
      .limit(20);

    return c.json({
      users: rows.map((u) => toUserPublicDto(u, hub.isOnline(u.id))),
    });
  });

  router.get('/blocked', async (c) => {
    const userId = c.get('userId');
    const rows = await db
      .select({ blockedId: blockedUsers.blockedId })
      .from(blockedUsers)
      .where(eq(blockedUsers.blockerId, userId));

    return c.json({ blockedUserIds: rows.map((r) => r.blockedId) });
  });

  router.post('/block', async (c) => {
    const userId = c.get('userId');
    const body = await c.req.json().catch(() => null);
    const parsed = BlockUserSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Permintaan blokir tidak valid.' }, 400);
    }

    const { targetUserId, blocked } = parsed.data;
    if (targetUserId === userId) {
      return c.json({ error: 'Tidak dapat memblokir diri sendiri.' }, 400);
    }

    if (blocked) {
      await db
        .insert(blockedUsers)
        .values({ blockerId: userId, blockedId: targetUserId, createdAt: Date.now() })
        .onConflictDoNothing();
    } else {
      await db
        .delete(blockedUsers)
        .where(and(eq(blockedUsers.blockerId, userId), eq(blockedUsers.blockedId, targetUserId)));
    }

    return c.json({ targetUserId, blocked });
  });

  return router;
}

