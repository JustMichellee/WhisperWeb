import { decryptString, encryptString } from './cipher';
import { fromBase64, randomBytes, toArrayBuffer, toBase64, utf8Encode } from './encoding';
import { derivePasswordKeys, importPrivateKeyFromJwk } from './keys';

const RECOVERY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateRecoveryKeyCode(): string {
  const bytes = randomBytes(24);
  const chars: string[] = [];
  for (let i = 0; i < 24; i++) {
    const idx = (bytes[i] ?? 0) % RECOVERY_ALPHABET.length;
    chars.push(RECOVERY_ALPHABET[idx]!);
  }
  return chars.join('').match(/.{1,4}/g)?.join('-') ?? chars.join('');
}

export function normalizeRecoveryKey(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export async function deriveRecoveryAesKey(recoveryCode: string): Promise<{
  wrappingKey: CryptoKey;
  recoveryProof: string;
}> {
  const normalized = normalizeRecoveryKey(recoveryCode);
  const encDigest = await crypto.subtle.digest(
    'SHA-256',
    toArrayBuffer(utf8Encode(`whisperweb-recovery-wrap:${normalized}`))
  );
  const proofDigest = await crypto.subtle.digest(
    'SHA-256',
    toArrayBuffer(utf8Encode(`whisperweb-recovery-proof:${normalized}`))
  );

  const wrappingKey = await crypto.subtle.importKey(
    'raw',
    encDigest,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  return {
    wrappingKey,
    recoveryProof: toBase64(proofDigest),
  };
}

export async function wrapPrivateKeyVault(
  privateKeyJwk: JsonWebKey,
  password: string,
  recoveryCode: string
): Promise<{
  authKey: string;
  keySalt: string;
  encryptedPrivateKey: string;
  keyIv: string;
  recoveryEncryptedPrivateKey: string;
  recoveryIv: string;
  recoveryProof: string;
}> {
  const jwkString = JSON.stringify(privateKeyJwk);
  const { saltBase64, keys } = await derivePasswordKeys(password);
  const passwordWrapped = await encryptString(keys.vaultWrappingKey, jwkString);

  const { wrappingKey, recoveryProof } = await deriveRecoveryAesKey(recoveryCode);
  const recoveryWrapped = await encryptString(wrappingKey, jwkString);

  return {
    authKey: keys.authKeyBase64,
    keySalt: saltBase64,
    encryptedPrivateKey: passwordWrapped.ciphertext,
    keyIv: passwordWrapped.iv,
    recoveryEncryptedPrivateKey: recoveryWrapped.ciphertext,
    recoveryIv: recoveryWrapped.iv,
    recoveryProof,
  };
}

export async function unwrapPrivateKeyWithPassword(
  encryptedPrivateKey: string,
  keyIv: string,
  keySalt: string,
  password: string
): Promise<{ authKey: string; privateKeyJwk: JsonWebKey; privateKey: CryptoKey }> {
  const { keys } = await derivePasswordKeys(password, keySalt);
  const jwkJson = await decryptString(keys.vaultWrappingKey, encryptedPrivateKey, keyIv);
  const privateKeyJwk = JSON.parse(jwkJson) as JsonWebKey;
  const privateKey = await importPrivateKeyFromJwk(privateKeyJwk);

  return {
    authKey: keys.authKeyBase64,
    privateKeyJwk,
    privateKey,
  };
}

export async function unwrapPrivateKeyWithRecoveryCode(
  recoveryEncryptedPrivateKey: string,
  recoveryIv: string,
  recoveryCode: string
): Promise<{ privateKeyJwk: JsonWebKey; privateKey: CryptoKey; recoveryProof: string }> {
  const { wrappingKey, recoveryProof } = await deriveRecoveryAesKey(recoveryCode);
  const jwkJson = await decryptString(wrappingKey, recoveryEncryptedPrivateKey, recoveryIv);
  const privateKeyJwk = JSON.parse(jwkJson) as JsonWebKey;
  const privateKey = await importPrivateKeyFromJwk(privateKeyJwk);

  return {
    privateKeyJwk,
    privateKey,
    recoveryProof,
  };
}

export async function rewrapPrivateKeyWithNewPassword(
  privateKeyJwk: JsonWebKey,
  newPassword: string
): Promise<{
  newAuthKey: string;
  newKeySalt: string;
  newEncryptedPrivateKey: string;
  newKeyIv: string;
}> {
  const { saltBase64, keys } = await derivePasswordKeys(newPassword);
  const wrapped = await encryptString(keys.vaultWrappingKey, JSON.stringify(privateKeyJwk));
  return {
    newAuthKey: keys.authKeyBase64,
    newKeySalt: saltBase64,
    newEncryptedPrivateKey: wrapped.ciphertext,
    newKeyIv: wrapped.iv,
  };
}

export function isValidBase64(str: string): boolean {
  try {
    return fromBase64(str).byteLength > 0;
  } catch {
    return false;
  }
}

