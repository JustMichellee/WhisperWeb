import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, '../../..');

export interface ServerConfig {
  port: number;
  dataDir: string;
  dbPath: string;
  uploadsDir: string;
  jwtSecret: Uint8Array;
  rpId: string;
  rpName: string;
  origins: string[];
}

function loadOrCreateSecret(dataDir: string): Uint8Array {
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32) {
    return new TextEncoder().encode(process.env.JWT_SECRET);
  }
  const secretPath = path.join(dataDir, '.jwt-secret');
  if (fs.existsSync(secretPath)) {
    return new TextEncoder().encode(fs.readFileSync(secretPath, 'utf8').trim());
  }
  const generated = crypto.randomBytes(48).toString('hex');
  fs.writeFileSync(secretPath, generated, { mode: 0o600 });
  return new TextEncoder().encode(generated);
}

export function createConfig(overrides?: Partial<Pick<ServerConfig, 'dataDir' | 'port' | 'dbPath' | 'uploadsDir'>>): ServerConfig {
  const dataDir = overrides?.dataDir ?? process.env.DATA_DIR ?? path.join(repoRoot, 'data');
  const uploadsDir = overrides?.uploadsDir ?? path.join(dataDir, 'uploads');
  const dbPath = overrides?.dbPath ?? path.join(dataDir, 'chat.db');

  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(uploadsDir, { recursive: true });

  const origins = (process.env.CORS_ORIGINS ?? 'http://localhost:5173,http://127.0.0.1:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  return {
    port: overrides?.port ?? Number(process.env.PORT ?? 3001),
    dataDir,
    dbPath,
    uploadsDir,
    jwtSecret: loadOrCreateSecret(dataDir),
    rpId: process.env.WEBAUTHN_RP_ID ?? 'localhost',
    rpName: 'WhisperWeb',
    origins,
  };
}

