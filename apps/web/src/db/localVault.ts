import { del, get, set } from 'idb-keyval';
import {
  fromBase64,
  randomBytes,
  toArrayBuffer,
  toBase64,
  utf8Decode,
  utf8Encode,
} from '../crypto/encoding';

export interface StoredLocalSession {
  token: string;
  userId: string;
  username: string;
  privateKeyJwk: JsonWebKey;
}

interface EncryptedCacheEnvelope {
  iv: string;
  ciphertext: string;
}

const SESSION_KEY = 'whisperweb:session:v1';
const DEVICE_KEY_PREFIX = 'whisperweb:device-key:';
const CACHE_KEY_PREFIX = 'whisperweb:cache-aes:';
const CACHE_CONVS_PREFIX = 'whisperweb:cache-convs:';
const CACHE_MSGS_PREFIX = 'whisperweb:cache-msgs:';
const CACHE_INDEX_PREFIX = 'whisperweb:cache-index:';
const MAX_CACHED_MESSAGES_PER_CONV = 100;

export async function saveLocalSession(session: StoredLocalSession): Promise<void> {
  await set(SESSION_KEY, session);
  // Keep an isolated copy of the private key per userId for Passkey quick unlock on this browser
  await set(`${DEVICE_KEY_PREFIX}${session.userId}`, session.privateKeyJwk);
}

export async function loadLocalSession(): Promise<StoredLocalSession | null> {
  const session = await get<StoredLocalSession>(SESSION_KEY);
  return session ?? null;
}

export async function clearLocalSession(): Promise<void> {
  const existing = await loadLocalSession().catch(() => null);
  await del(SESSION_KEY);
  if (existing?.userId) {
    await clearChatCache(existing.userId).catch(() => {});
  }
}

export async function loadDevicePrivateKeyJwk(userId: string): Promise<JsonWebKey | null> {
  const jwk = await get<JsonWebKey>(`${DEVICE_KEY_PREFIX}${userId}`);
  return jwk ?? null;
}

export async function saveDevicePrivateKeyJwk(userId: string, privateKeyJwk: JsonWebKey): Promise<void> {
  await set(`${DEVICE_KEY_PREFIX}${userId}`, privateKeyJwk);
}

async function getOrCreateCacheKey(userId: string): Promise<CryptoKey | null> {
  if (typeof crypto === 'undefined' || !crypto.subtle) return null;
  const storageKey = `${CACHE_KEY_PREFIX}${userId}`;
  const existing = await get<CryptoKey>(storageKey);
  if (existing) return existing;

  const generated = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
  await set(storageKey, generated);
  return generated;
}

async function writeEncryptedCache<T>(userId: string, key: string, value: T): Promise<void> {
  try {
    const aesKey = await getOrCreateCacheKey(userId);
    if (!aesKey) return;
    const iv = randomBytes(12);
    const plaintext = utf8Encode(JSON.stringify(value));
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: toArrayBuffer(iv) },
      aesKey,
      toArrayBuffer(plaintext)
    );
    const envelope: EncryptedCacheEnvelope = {
      iv: toBase64(iv),
      ciphertext: toBase64(encrypted),
    };
    await set(key, envelope);
  } catch {
    // Local cache failures should never break live network state
  }
}

async function readEncryptedCache<T>(userId: string, key: string): Promise<T | null> {
  try {
    const aesKey = await get<CryptoKey>(`${CACHE_KEY_PREFIX}${userId}`);
    if (!aesKey) return null;
    const envelope = await get<EncryptedCacheEnvelope>(key);
    if (!envelope) return null;

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: toArrayBuffer(fromBase64(envelope.iv)) },
      aesKey,
      toArrayBuffer(fromBase64(envelope.ciphertext))
    );
    return JSON.parse(utf8Decode(decrypted)) as T;
  } catch {
    return null;
  }
}

export async function saveCachedConversations<T>(userId: string, conversations: T[]): Promise<void> {
  await writeEncryptedCache(userId, `${CACHE_CONVS_PREFIX}${userId}`, conversations);
}

export async function loadCachedConversations<T>(userId: string): Promise<T[] | null> {
  return readEncryptedCache<T[]>(userId, `${CACHE_CONVS_PREFIX}${userId}`);
}

export async function saveCachedMessages<T>(
  userId: string,
  conversationId: string,
  messages: T[]
): Promise<void> {
  const sliced = messages.slice(-MAX_CACHED_MESSAGES_PER_CONV);
  await writeEncryptedCache(userId, `${CACHE_MSGS_PREFIX}${userId}:${conversationId}`, sliced);

  try {
    const indexKey = `${CACHE_INDEX_PREFIX}${userId}`;
    const existing = (await get<string[]>(indexKey)) ?? [];
    if (!existing.includes(conversationId)) {
      await set(indexKey, [...existing, conversationId]);
    }
  } catch {
    // Ignore cache index tracking failure
  }
}

export async function loadCachedMessages<T>(
  userId: string,
  conversationId: string
): Promise<T[] | null> {
  return readEncryptedCache<T[]>(userId, `${CACHE_MSGS_PREFIX}${userId}:${conversationId}`);
}

export async function clearChatCache(userId: string): Promise<void> {
  const indexKey = `${CACHE_INDEX_PREFIX}${userId}`;
  const convIds = (await get<string[]>(indexKey).catch(() => null)) ?? [];
  await Promise.all([
    del(`${CACHE_KEY_PREFIX}${userId}`),
    del(`${CACHE_CONVS_PREFIX}${userId}`),
    del(indexKey),
    ...convIds.map((convId) => del(`${CACHE_MSGS_PREFIX}${userId}:${convId}`)),
  ]);
}
