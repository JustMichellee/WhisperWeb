import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { SignJWT, jwtVerify } from 'jose';
import type { KeyVaultDto, UserPublicDto } from '@chat/shared';
import type { users } from '../db/schema.js';

const scryptAsync = promisify(crypto.scrypt);

export type UserRow = typeof users.$inferSelect;

export async function hashSecret(secret: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = (await scryptAsync(secret, salt, 64)) as Buffer;
  return `${salt}:${derived.toString('hex')}`;
}

export async function verifySecret(secret: string, storedHash: string): Promise<boolean> {
  const [salt, expectedHex] = storedHash.split(':');
  if (!salt || !expectedHex) return false;
  const derived = (await scryptAsync(secret, salt, 64)) as Buffer;
  const expected = Buffer.from(expectedHex, 'hex');
  if (derived.length !== expected.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}

export async function signAccessToken(userId: string, username: string, secret: Uint8Array): Promise<string> {
  return new SignJWT({ sub: userId, username })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('14d')
    .sign(secret);
}

export async function verifyAccessToken(
  token: string,
  secret: Uint8Array
): Promise<{ userId: string; username: string } | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    if (typeof payload.sub !== 'string' || typeof payload.username !== 'string') {
      return null;
    }
    return { userId: payload.sub, username: payload.username };
  } catch {
    return null;
  }
}

export function toUserPublicDto(row: UserRow, isOnline: boolean): UserPublicDto {
  const visibleOnline = row.hideOnlineStatus ? false : isOnline;
  return {
    id: row.id,
    username: row.username,
    displayName: row.displayName,
    aboutBio: row.aboutBio,
    avatarUrl: row.avatarUrl,
    publicKey: row.publicKey,
    lastSeenAt: row.hideOnlineStatus ? null : row.lastSeenAt,
    isOnline: visibleOnline,
    hideOnlineStatus: row.hideOnlineStatus,
  };
}

export function toKeyVaultDto(row: UserRow): KeyVaultDto {
  return {
    publicKey: row.publicKey,
    encryptedPrivateKey: row.encryptedPrivateKey,
    keySalt: row.keySalt,
    keyIv: row.keyIv,
    recoveryEncryptedPrivateKey: row.recoveryEncryptedPrivateKey,
    recoveryIv: row.recoveryIv,
  };
}

interface ChallengeEntry {
  challenge: string;
  userId?: string;
  expiresAt: number;
}

export class WebAuthnChallengeStore {
  private readonly store = new Map<string, ChallengeEntry>();

  create(key: string, challenge: string, userId?: string): void {
    this.pruneExpired();
    this.store.set(key, {
      challenge,
      userId,
      expiresAt: Date.now() + 5 * 60 * 1000,
    });
  }

  consume(key: string): ChallengeEntry | null {
    const entry = this.store.get(key);
    this.store.delete(key);
    if (!entry || entry.expiresAt < Date.now()) {
      return null;
    }
    return entry;
  }

  private pruneExpired(): void {
    const now = Date.now();
    for (const [k, v] of this.store.entries()) {
      if (v.expiresAt < now) {
        this.store.delete(k);
      }
    }
  }
}

