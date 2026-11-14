import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createNodeWebSocket } from '@hono/node-ws';
import type { ServerConfig } from './config.js';
import { createDatabase } from './db/index.js';
import { LocalDiskStorageProvider } from './services/storage.js';
import { verifyAccessToken } from './services/auth.js';
import { WebSocketHub } from './ws/hub.js';
import { createAuthRoutes } from './routes/auth.js';
import { createUserRoutes } from './routes/users.js';
import { createConversationRoutes } from './routes/conversations.js';
import { createMediaRoutes } from './routes/media.js';

export function createApp(config: ServerConfig) {
  const app = new Hono();
  const { db, sqlite } = createDatabase(config.dbPath);
  const storage = new LocalDiskStorageProvider(config.uploadsDir);
  const hub = new WebSocketHub(db);
  const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

  app.use(
    '/api/*',
    cors({
      origin: (origin) => (config.origins.includes(origin) ? origin : config.origins[0] ?? 'http://localhost:5173'),
      allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization'],
      credentials: true,
    })
  );

  app.get('/api/health', (c) => c.json({ ok: true, service: 'whisperweb-server' }));

  app.route('/api/auth', createAuthRoutes(db, config, hub));
  app.route('/api/users', createUserRoutes(db, config, hub));
  app.route('/api/conversations', createConversationRoutes(db, config, hub));
  app.route('/api/media', createMediaRoutes(db, config, storage));

  app.get(
    '/ws',
    upgradeWebSocket(async (c) => {
      const token = c.req.query('token') ?? '';
      const verified = await verifyAccessToken(token, config.jwtSecret);
      const userId = verified?.userId ?? null;

      return {
        onOpen(_event, ws) {
          if (!userId) {
            ws.close(4001, 'Unauthorized');
            return;
          }
          void hub.handleOpen(userId, ws);
        },
        onMessage(event, ws) {
          if (!userId) return;
          const raw = typeof event.data === 'string' ? event.data : String(event.data);
          void hub.handleMessage(userId, ws, raw);
        },
        onClose(_event, ws) {
          if (!userId) return;
          void hub.handleClose(userId, ws);
        },
      };
    })
  );

  return { app, db, sqlite, hub, injectWebSocket };
}

