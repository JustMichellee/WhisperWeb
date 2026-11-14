import { describe, expect, it } from 'vitest';
import {
  computeSafetyNumber,
  deriveConversationKey,
  generateIdentityKeyPair,
} from './keys';
import {
  decryptBinaryFile,
  decryptMessagePayload,
  encryptBinaryFile,
  encryptMessagePayload,
} from './cipher';
import {
  generateRecoveryKeyCode,
  unwrapPrivateKeyWithPassword,
  unwrapPrivateKeyWithRecoveryCode,
  wrapPrivateKeyVault,
} from './vault';
import { createAndWrapNewGroupKey, unwrapMyGroupKey } from './group';

describe('WhisperWeb Web Crypto E2EE Engine', () => {
  it('derives identical conversation keys via ECDH and encrypts/decrypts JSON payloads', async () => {
    const alice = await generateIdentityKeyPair();
    const bob = await generateIdentityKeyPair();

    const keyAlice = await deriveConversationKey(alice.privateKey, bob.publicKeyBase64, 'conv_1');
    const keyBob = await deriveConversationKey(bob.privateKey, alice.publicKeyBase64, 'conv_1');

    const payload = {
      text: 'Halo Bob, pesan ini terenkripsi end-to-end!',
      replyToPreview: { id: 'msg_0', senderName: 'Bob', snippet: 'Tes' },
    };

    const encrypted = await encryptMessagePayload(keyAlice, payload);
    expect(encrypted.ciphertext).not.toContain('Halo Bob');

    const decrypted = await decryptMessagePayload(keyBob, encrypted.ciphertext, encrypted.iv);
    expect(decrypted).toEqual(payload);
  });

  it('wraps private key in Zero-Knowledge vault and restores via password or recovery code', async () => {
    const identity = await generateIdentityKeyPair();
    const recoveryCode = generateRecoveryKeyCode();
    const vault = await wrapPrivateKeyVault(identity.privateKeyJwk, 'PasswordRahasia123', recoveryCode);

    const restoredByPw = await unwrapPrivateKeyWithPassword(
      vault.encryptedPrivateKey,
      vault.keyIv,
      vault.keySalt,
      'PasswordRahasia123'
    );
    expect(restoredByPw.privateKeyJwk).toEqual(identity.privateKeyJwk);
    expect(restoredByPw.authKey).toBe(vault.authKey);

    await expect(
      unwrapPrivateKeyWithPassword(vault.encryptedPrivateKey, vault.keyIv, vault.keySalt, 'SalahPass')
    ).rejects.toThrow();

    const restoredByRecovery = await unwrapPrivateKeyWithRecoveryCode(
      vault.recoveryEncryptedPrivateKey,
      vault.recoveryIv,
      recoveryCode
    );
    expect(restoredByRecovery.privateKeyJwk).toEqual(identity.privateKeyJwk);
  });

  it('encrypts and decrypts binary media files cleanly', async () => {
    const rawText = 'Binary-PDF-Mock-Content-2026';
    const inputBuffer = new TextEncoder().encode(rawText).buffer;

    const encrypted = await encryptBinaryFile(inputBuffer);
    const decryptedBuffer = await decryptBinaryFile(
      encrypted.encryptedBytes.buffer as ArrayBuffer,
      encrypted.fileKeyBase64,
      encrypted.fileIvBase64
    );

    const decoded = new TextDecoder().decode(decryptedBuffer);
    expect(decoded).toBe(rawText);
  });

  it('wraps and unwraps GroupKey for multiple members and computes symmetric Safety Numbers', async () => {
    const admin = await generateIdentityKeyPair();
    const member = await generateIdentityKeyPair();

    const safetyAB = await computeSafetyNumber(admin.publicKeyBase64, member.publicKeyBase64);
    const safetyBA = await computeSafetyNumber(member.publicKeyBase64, admin.publicKeyBase64);
    expect(safetyAB).toHaveLength(12);
    expect(safetyAB).toEqual(safetyBA);

    const { groupKey, wrappedMembers } = await createAndWrapNewGroupKey(
      admin.privateKey,
      admin.publicKeyBase64,
      [
        { userId: 'u_admin', publicKey: admin.publicKeyBase64 },
        { userId: 'u_member', publicKey: member.publicKeyBase64 },
      ]
    );

    const memberWrap = wrappedMembers.find((m) => m.userId === 'u_member')!;
    const unwrapped = await unwrapMyGroupKey(member.privateKey, {
      userId: 'u_member',
      username: 'member',
      displayName: 'Member',
      aboutBio: '',
      avatarUrl: null,
      publicKey: member.publicKeyBase64,
      role: 'member',
      encryptedGroupKey: memberWrap.encryptedGroupKey,
      groupKeyIv: memberWrap.groupKeyIv,
      keySenderPublicKey: memberWrap.keySenderPublicKey,
      lastReadMessageId: null,
      isOnline: true,
      lastSeenAt: null,
    });

    expect(unwrapped).not.toBeNull();
    const encrypted = await encryptMessagePayload(groupKey, { text: 'Pesan Grup Rahasia' });
    const decrypted = await decryptMessagePayload(unwrapped!.key, encrypted.ciphertext, encrypted.iv);
    expect(decrypted.text).toBe('Pesan Grup Rahasia');
  });
});

