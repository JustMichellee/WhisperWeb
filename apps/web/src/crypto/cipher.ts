import type { DecryptedMessagePayload } from '@chat/shared';
import { fromBase64, randomBytes, toArrayBuffer, toBase64, utf8Decode, utf8Encode } from './encoding';
import { generateRandomAesKey, importAesKeyFromBase64 } from './keys';

export interface EncryptedTextResult {
  ciphertext: string;
  iv: string;
}

export async function encryptMessagePayload(
  key: CryptoKey,
  payload: DecryptedMessagePayload
): Promise<EncryptedTextResult> {
  const iv = randomBytes(12);
  const plaintext = utf8Encode(JSON.stringify(payload));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(iv) },
    key,
    toArrayBuffer(plaintext)
  );

  return {
    ciphertext: toBase64(encrypted),
    iv: toBase64(iv),
  };
}

export async function decryptMessagePayload(
  key: CryptoKey,
  ciphertext: string,
  ivBase64: string
): Promise<DecryptedMessagePayload> {
  const iv = fromBase64(ivBase64);
  const data = fromBase64(ciphertext);
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(iv) },
    key,
    toArrayBuffer(data)
  );

  return JSON.parse(utf8Decode(decrypted)) as DecryptedMessagePayload;
}

export async function encryptString(key: CryptoKey, text: string): Promise<EncryptedTextResult> {
  const iv = randomBytes(12);
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(iv) },
    key,
    toArrayBuffer(utf8Encode(text))
  );
  return { ciphertext: toBase64(encrypted), iv: toBase64(iv) };
}

export async function decryptString(
  key: CryptoKey,
  ciphertext: string,
  ivBase64: string
): Promise<string> {
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(fromBase64(ivBase64)) },
    key,
    toArrayBuffer(fromBase64(ciphertext))
  );
  return utf8Decode(decrypted);
}

export async function encryptBinaryFile(buffer: ArrayBuffer): Promise<{
  encryptedBytes: Uint8Array;
  fileKeyBase64: string;
  fileIvBase64: string;
}> {
  const { key, rawBase64 } = await generateRandomAesKey();
  const iv = randomBytes(12);
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(iv) },
    key,
    buffer
  );

  return {
    encryptedBytes: new Uint8Array(encrypted),
    fileKeyBase64: rawBase64,
    fileIvBase64: toBase64(iv),
  };
}

export async function decryptBinaryFile(
  encryptedBuffer: ArrayBuffer,
  fileKeyBase64: string,
  fileIvBase64: string
): Promise<ArrayBuffer> {
  const key = await importAesKeyFromBase64(fileKeyBase64);
  const iv = fromBase64(fileIvBase64);
  return crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(iv) },
    key,
    encryptedBuffer
  );
}

