import { fromBase64, randomBytes, toArrayBuffer, toBase64, utf8Encode } from './encoding';

const PBKDF2_ITERATIONS = 600_000;

export interface DerivedPasswordKeys {
  authKeyBase64: string;
  vaultWrappingKey: CryptoKey;
}

export interface GeneratedIdentityKeyPair {
  publicKeyBase64: string;
  privateKeyJwk: JsonWebKey;
  privateKey: CryptoKey;
}

export async function derivePasswordKeys(password: string, saltBase64?: string): Promise<{
  saltBase64: string;
  keys: DerivedPasswordKeys;
}> {
  const salt = saltBase64 ? fromBase64(saltBase64) : randomBytes(16);
  const resolvedSaltBase64 = saltBase64 ?? toBase64(salt);

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    toArrayBuffer(utf8Encode(password)),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  // Derive 512 bits: first 256 bits authenticate to server, second 256 bits stay local to wrap private key
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: toArrayBuffer(salt),
      iterations: PBKDF2_ITERATIONS,
    },
    keyMaterial,
    512
  );

  const full = new Uint8Array(bits);
  const authBytes = full.slice(0, 32);
  const wrapBytes = full.slice(32, 64);

  const vaultWrappingKey = await crypto.subtle.importKey(
    'raw',
    toArrayBuffer(wrapBytes),
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  return {
    saltBase64: resolvedSaltBase64,
    keys: {
      authKeyBase64: toBase64(authBytes),
      vaultWrappingKey,
    },
  };
}

export async function generateIdentityKeyPair(): Promise<GeneratedIdentityKeyPair> {
  const pair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey', 'deriveBits']
  );

  const spki = await crypto.subtle.exportKey('spki', pair.publicKey);
  const privateKeyJwk = await crypto.subtle.exportKey('jwk', pair.privateKey);

  return {
    publicKeyBase64: toBase64(spki),
    privateKeyJwk,
    privateKey: pair.privateKey,
  };
}

export async function importPublicKey(publicKeyBase64: string): Promise<CryptoKey> {
  const spki = fromBase64(publicKeyBase64);
  return crypto.subtle.importKey(
    'spki',
    toArrayBuffer(spki),
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    []
  );
}

export async function importPrivateKeyFromJwk(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey', 'deriveBits']
  );
}

export async function deriveConversationKey(
  myPrivateKey: CryptoKey,
  peerPublicKeyBase64: string,
  contextId: string
): Promise<CryptoKey> {
  const peerPublicKey = await importPublicKey(peerPublicKeyBase64);
  const sharedBits = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: peerPublicKey },
    myPrivateKey,
    256
  );

  const hkdfKey = await crypto.subtle.importKey('raw', sharedBits, 'HKDF', false, ['deriveKey']);

  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: toArrayBuffer(utf8Encode('whisperweb-e2ee-v1')),
      info: toArrayBuffer(utf8Encode(contextId)),
    },
    hkdfKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function generateRandomAesKey(): Promise<{ key: CryptoKey; rawBase64: string }> {
  const raw = randomBytes(32);
  const key = await crypto.subtle.importKey(
    'raw',
    toArrayBuffer(raw),
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
  return { key, rawBase64: toBase64(raw) };
}

export async function importAesKeyFromBase64(rawBase64: string): Promise<CryptoKey> {
  const raw = fromBase64(rawBase64);
  return crypto.subtle.importKey(
    'raw',
    toArrayBuffer(raw),
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

export async function computeSafetyNumber(publicKeyA: string, publicKeyB: string): Promise<string[]> {
  const ordered = [publicKeyA, publicKeyB].sort().join('|');
  const digest = await crypto.subtle.digest('SHA-256', toArrayBuffer(utf8Encode(ordered)));
  const bytes = new Uint8Array(digest);
  const blocks: string[] = [];

  for (let i = 0; i < 12; i++) {
    const a = bytes[(i * 2) % bytes.length] ?? 0;
    const b = bytes[(i * 2 + 1) % bytes.length] ?? 0;
    const c = bytes[(i * 2 + 2) % bytes.length] ?? 0;
    const num = ((a << 16) | (b << 8) | c) % 100_000;
    blocks.push(String(num).padStart(5, '0'));
  }

  return blocks;
}

