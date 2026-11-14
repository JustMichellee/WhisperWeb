import crypto from 'node:crypto';
import { Hono } from 'hono';
import { and, eq } from 'drizzle-orm';
import { MAX_ATTACHMENT_BYTES } from '@chat/shared';
import type { ServerConfig } from '../config.js';
import type { AppDatabase } from '../db/index.js';
import { attachments, conversationMembers, messages } from '../db/schema.js';
import { createAuthMiddleware, type AuthVariables } from '../middleware/authMiddleware.js';
import type { IStorageProvider } from '../services/storage.js';

export function createMediaRoutes(db: AppDatabase, config: ServerConfig, storage: IStorageProvider) {
  const router = new Hono<{ Variables: AuthVariables }>();
  router.use('*', createAuthMiddleware(config));

  router.post('/upload', async (c) => {
    const userId = c.get('userId');
    const contentLengthHeader = c.req.header('content-length');
    if (contentLengthHeader && Number(contentLengthHeader) > MAX_ATTACHMENT_BYTES + 1024) {
      return c.json({ error: 'Ukuran file melebihi batas maksimum 25 MB.' }, 413);
    }

    const arrayBuffer = await c.req.arrayBuffer();
    if (arrayBuffer.byteLength === 0) {
      return c.json({ error: 'File terenkripsi kosong.' }, 400);
    }
    if (arrayBuffer.byteLength > MAX_ATTACHMENT_BYTES) {
      return c.json({ error: 'Ukuran file melebihi batas maksimum 25 MB.' }, 413);
    }

    const attachmentId = `att_${crypto.randomUUID()}`;
    const stored = await storage.saveBlob(attachmentId, new Uint8Array(arrayBuffer));

    await db.insert(attachments).values({
      id: attachmentId,
      uploaderId: userId,
      storagePath: stored.relativePath,
      sizeBytes: stored.sizeBytes,
      sha256Checksum: stored.sha256Checksum,
      createdAt: Date.now(),
    });

    return c.json(
      {
        attachmentId,
        sizeBytes: stored.sizeBytes,
        sha256Checksum: stored.sha256Checksum,
      },
      201
    );
  });

  router.get('/:attachmentId', async (c) => {
    const userId = c.get('userId');
    const attachmentId = c.req.param('attachmentId');

    const [att] = await db.select().from(attachments).where(eq(attachments.id, attachmentId)).limit(1);
    if (!att) {
      return c.json({ error: 'Lampiran tidak ditemukan.' }, 404);
    }

    if (att.uploaderId !== userId) {
      const authorized = await db
        .select({ conversationId: messages.conversationId })
        .from(messages)
        .innerJoin(
          conversationMembers,
          and(
            eq(conversationMembers.conversationId, messages.conversationId),
            eq(conversationMembers.userId, userId)
          )
        )
        .where(eq(messages.attachmentId, attachmentId))
        .limit(1);

      if (authorized.length === 0) {
        return c.json({ error: 'Anda tidak memiliki akses ke lampiran ini.' }, 403);
      }
    }

    try {
      const bytes = await storage.readBlob(att.storagePath);
      return new Response(bytes, {
        status: 200,
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Length': String(bytes.byteLength),
          'Cache-Control': 'private, max-age=86400',
        },
      });
    } catch {
      return c.json({ error: 'Berkas terenkripsi tidak ditemukan di penyimpanan.' }, 404);
    }
  });

  return router;
}

