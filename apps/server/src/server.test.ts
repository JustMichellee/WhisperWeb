import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createConfig } from './config.js';
import { createApp } from './app.js';

describe('WhisperWeb Server API & Zero-Knowledge Persistence', () => {
  let tempDir: string;
  let app: ReturnType<typeof createApp>['app'];
  let sqlite: ReturnType<typeof createApp>['sqlite'];

  beforeAll(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'whisperweb-test-'));
    const config = createConfig({ dataDir: tempDir, port: 0 });
    const instance = createApp(config);
    app = instance.app;
    sqlite = instance.sqlite;
  });

  afterAll(() => {
    sqlite.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('registers users, handles login challenge/login, creates direct chat, and uploads encrypted media', async () => {
    const regAlice = await app.request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'alice_test',
        displayName: 'Alice',
        authKey: 'alice-derived-auth-key-0123456789abcdef',
        publicKey: 'alice-public-key-spki-0123456789abcdef0123456789',
        encryptedPrivateKey: 'enc-priv-alice-0123456789',
        keySalt: 'salt-alice-0123456789',
        keyIv: 'iv-alice-012345',
        recoveryEncryptedPrivateKey: 'rec-priv-alice-0123456789',
        recoveryIv: 'rec-iv-alice-012345',
        recoveryProof: 'rec-proof-alice-0123456789',
      }),
    });
    expect(regAlice.status).toBe(201);
    const aliceData = (await regAlice.json()) as { token: string; user: { id: string } };

    const regBob = await app.request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'bob_test',
        displayName: 'Bob',
        authKey: 'bob-derived-auth-key-0123456789abcdef',
        publicKey: 'bob-public-key-spki-0123456789abcdef0123456789',
        encryptedPrivateKey: 'enc-priv-bob-0123456789',
        keySalt: 'salt-bob-0123456789',
        keyIv: 'iv-bob-012345',
        recoveryEncryptedPrivateKey: 'rec-priv-bob-0123456789',
        recoveryIv: 'rec-iv-bob-012345',
        recoveryProof: 'rec-proof-bob-0123456789',
      }),
    });
    expect(regBob.status).toBe(201);
    const bobData = (await regBob.json()) as { token: string; user: { id: string } };

    // Login challenge & verify
    const challengeRes = await app.request('/api/auth/login/challenge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'alice_test' }),
    });
    expect(challengeRes.status).toBe(200);
    const challengeJson = (await challengeRes.json()) as { keySalt: string };
    expect(challengeJson.keySalt).toBe('salt-alice-0123456789');

    const loginRes = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'alice_test',
        authKey: 'alice-derived-auth-key-0123456789abcdef',
      }),
    });
    expect(loginRes.status).toBe(200);

    // Search Bob by username
    const searchRes = await app.request('/api/users/search?q=bob', {
      headers: { Authorization: `Bearer ${aliceData.token}` },
    });
    expect(searchRes.status).toBe(200);
    const searchJson = (await searchRes.json()) as { users: Array<{ username: string }> };
    expect(searchJson.users.some((u) => u.username === 'bob_test')).toBe(true);

    // Create direct conversation
    const convRes = await app.request('/api/conversations/direct', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${aliceData.token}`,
      },
      body: JSON.stringify({ targetUserId: bobData.user.id }),
    });
    expect(convRes.status).toBe(201);

    // Upload encrypted binary blob and download it back
    const cipherBytes = new Uint8Array([9, 8, 7, 6, 5, 4, 3, 2, 1]);
    const uploadRes = await app.request('/api/media/upload', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${aliceData.token}`,
        'Content-Type': 'application/octet-stream',
      },
      body: cipherBytes,
    });
    expect(uploadRes.status).toBe(201);
    const uploadJson = (await uploadRes.json()) as { attachmentId: string; sizeBytes: number };
    expect(uploadJson.sizeBytes).toBe(cipherBytes.byteLength);

    const downloadRes = await app.request(`/api/media/${uploadJson.attachmentId}`, {
      headers: { Authorization: `Bearer ${aliceData.token}` },
    });
    expect(downloadRes.status).toBe(200);
    const downloaded = new Uint8Array(await downloadRes.arrayBuffer());
    expect(Array.from(downloaded)).toEqual(Array.from(cipherBytes));

    // Unauthorized user cannot download Alice's encrypted attachment
    const unauthDownload = await app.request(`/api/media/${uploadJson.attachmentId}`, {
      headers: { Authorization: `Bearer ${bobData.token}` },
    });
    expect(unauthDownload.status).toBe(403);
  });
});

