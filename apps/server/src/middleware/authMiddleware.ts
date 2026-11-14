import { createMiddleware } from 'hono/factory';
import type { ServerConfig } from '../config.js';
import { verifyAccessToken } from '../services/auth.js';

export interface AuthVariables {
  userId: string;
  username: string;
}

export function createAuthMiddleware(config: ServerConfig) {
  return createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
    const header = c.req.header('Authorization');
    const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : null;
    if (!token) {
      return c.json({ error: 'Autentikasi diperlukan.' }, 401);
    }

    const verified = await verifyAccessToken(token, config.jwtSecret);
    if (!verified) {
      return c.json({ error: 'Sesi tidak valid atau kedaluwarsa.' }, 401);
    }

    c.set('userId', verified.userId);
    c.set('username', verified.username);
    await next();
  });
}

