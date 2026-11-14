import { serve } from '@hono/node-server';
import { createConfig } from './config.js';
import { createApp } from './app.js';

const config = createConfig();
const { app, injectWebSocket, sqlite } = createApp(config);

const server = serve(
  {
    fetch: app.fetch,
    port: config.port,
  },
  (info) => {
    console.log(`WhisperWeb server running at http://localhost:${info.port}`);
    console.log(`SQLite database: ${config.dbPath}`);
    console.log(`Encrypted media dir: ${config.uploadsDir}`);
  }
);

injectWebSocket(server);

const shutdown = () => {
  server.close();
  sqlite.close();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

