import crypto from 'node:crypto';
import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticatorTransportFuture,
} from '@simplewebauthn/server';
import {
  LoginChallengeSchema,
  LoginSchema,
  RecoverAccountSchema,
  RegisterSchema,
  UsernameSchema,
} from '@chat/shared';
import type { ServerConfig } from '../config.js';
import type { AppDatabase } from '../db/index.js';
import { passkeyCredentials, users } from '../db/schema.js';
import { createAuthMiddleware, type AuthVariables } from '../middleware/authMiddleware.js';
import {
  WebAuthnChallengeStore,
  hashSecret,
  signAccessToken,
  toKeyVaultDto,
  toUserPublicDto,
  verifySecret,
} from '../services/auth.js';
import type { WebSocketHub } from '../ws/hub.js';

export function createAuthRoutes(db: AppDatabase, config: ServerConfig, hub: WebSocketHub) {
  const router = new Hono<{ Variables: AuthVariables }>();
  const challenges = new WebAuthnChallengeStore();
  const requireAuth = createAuthMiddleware(config);

  router.post('/register', async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = RegisterSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: parsed.error.issues[0]?.message ?? 'Data registrasi tidak valid.' }, 400);
    }

    const input = parsed.data;
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, input.username))
      .limit(1);

    if (existing.length > 0) {
      return c.json({ error: 'Username sudah digunakan. Pilih username lain.' }, 409);
    }

    const now = Date.now();
    const userId = `usr_${crypto.randomUUID()}`;
    const [authHash, recoveryProofHash] = await Promise.all([
      hashSecret(input.authKey),
      hashSecret(input.recoveryProof),
    ]);

    const [created] = await db
      .insert(users)
      .values({
        id: userId,
        username: input.username,
        displayName: input.displayName,
        aboutBio: 'Menggunakan WhisperWeb',
        avatarUrl: null,
        authHash,
        publicKey: input.publicKey,
        encryptedPrivateKey: input.encryptedPrivateKey,
        keySalt: input.keySalt,
        keyIv: input.keyIv,
        recoveryEncryptedPrivateKey: input.recoveryEncryptedPrivateKey,
        recoveryIv: input.recoveryIv,
        recoveryProofHash,
        hideOnlineStatus: false,
        lastSeenAt: now,
        createdAt: now,
      })
      .returning();

    const token = await signAccessToken(created!.id, created!.username, config.jwtSecret);
    return c.json(
      {
        token,
        user: toUserPublicDto(created!, true),
        vault: toKeyVaultDto(created!),
      },
      201
    );
  });

  router.post('/login/challenge', async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = LoginChallengeSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Username tidak valid.' }, 400);
    }

    const [user] = await db
      .select({ keySalt: users.keySalt })
      .from(users)
      .where(eq(users.username, parsed.data.username))
      .limit(1);

    if (!user) {
      return c.json({ error: 'Username atau password salah.' }, 401);
    }

    return c.json({ keySalt: user.keySalt });
  });

  router.post('/login', async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = LoginSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Kredensial login tidak valid.' }, 400);
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.username, parsed.data.username))
      .limit(1);

    if (!user || !(await verifySecret(parsed.data.authKey, user.authHash))) {
      return c.json({ error: 'Username atau password salah.' }, 401);
    }

    const token = await signAccessToken(user.id, user.username, config.jwtSecret);
    return c.json({
      token,
      user: toUserPublicDto(user, hub.isOnline(user.id)),
      vault: toKeyVaultDto(user),
    });
  });

  router.post('/recover/challenge', async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = LoginChallengeSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Username tidak valid.' }, 400);
    }

    const [user] = await db
      .select({
        publicKey: users.publicKey,
        recoveryEncryptedPrivateKey: users.recoveryEncryptedPrivateKey,
        recoveryIv: users.recoveryIv,
      })
      .from(users)
      .where(eq(users.username, parsed.data.username))
      .limit(1);

    if (!user) {
      return c.json({ error: 'Akun tidak ditemukan.' }, 404);
    }

    return c.json(user);
  });

  router.post('/recover', async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = RecoverAccountSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Data pemulihan akun tidak valid.' }, 400);
    }

    const input = parsed.data;
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.username, input.username))
      .limit(1);

    if (!user || !(await verifySecret(input.recoveryProof, user.recoveryProofHash))) {
      return c.json({ error: 'Recovery Key tidak cocok.' }, 401);
    }

    const newAuthHash = await hashSecret(input.newAuthKey);
    const [updated] = await db
      .update(users)
      .set({
        authHash: newAuthHash,
        encryptedPrivateKey: input.newEncryptedPrivateKey,
        keySalt: input.newKeySalt,
        keyIv: input.newKeyIv,
      })
      .where(eq(users.id, user.id))
      .returning();

    const token = await signAccessToken(updated!.id, updated!.username, config.jwtSecret);
    return c.json({
      token,
      user: toUserPublicDto(updated!, hub.isOnline(updated!.id)),
      vault: toKeyVaultDto(updated!),
    });
  });

  router.post('/passkey/register/options', requireAuth, async (c) => {
    const userId = c.get('userId');
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) return c.json({ error: 'Pengguna tidak ditemukan.' }, 404);

    const existingCreds = await db
      .select()
      .from(passkeyCredentials)
      .where(eq(passkeyCredentials.userId, userId));

    const options = await generateRegistrationOptions({
      rpName: config.rpName,
      rpID: config.rpId,
      userName: user.username,
      userDisplayName: user.displayName,
      attestationType: 'none',
      excludeCredentials: existingCreds.map((cred) => ({
        id: cred.credentialId,
        transports: cred.transports ? (JSON.parse(cred.transports) as AuthenticatorTransportFuture[]) : undefined,
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
    });

    challenges.create(`reg:${userId}`, options.challenge, userId);
    return c.json(options);
  });

  router.post('/passkey/register/verify', requireAuth, async (c) => {
    const userId = c.get('userId');
    const entry = challenges.consume(`reg:${userId}`);
    if (!entry) {
      return c.json({ error: 'Tantangan Passkey kedaluwarsa. Coba lagi.' }, 400);
    }

    const body = await c.req.json().catch(() => null);
    if (!body) return c.json({ error: 'Payload Passkey kosong.' }, 400);

    try {
      const verification = await verifyRegistrationResponse({
        response: body,
        expectedChallenge: entry.challenge,
        expectedOrigin: config.origins,
        expectedRPID: config.rpId,
      });

      if (!verification.verified || !verification.registrationInfo) {
        return c.json({ error: 'Verifikasi Passkey gagal.' }, 400);
      }

      const { credential } = verification.registrationInfo;
      await db.insert(passkeyCredentials).values({
        id: `pk_${crypto.randomUUID()}`,
        userId,
        credentialId: credential.id,
        publicKey: Buffer.from(credential.publicKey).toString('base64url'),
        counter: credential.counter,
        transports: credential.transports ? JSON.stringify(credential.transports) : null,
        createdAt: Date.now(),
      });

      return c.json({ verified: true, credentialId: credential.id });
    } catch {
      return c.json({ error: 'Gagal memverifikasi Passkey perangkat.' }, 400);
    }
  });

  router.post('/passkey/login/options', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const usernameResult = UsernameSchema.safeParse((body as { username?: unknown })?.username);

    let allowCredentials: { id: string; transports?: AuthenticatorTransportFuture[] }[] = [];
    let targetUserId: string | undefined;

    if (usernameResult.success) {
      const [user] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.username, usernameResult.data))
        .limit(1);

      if (!user) {
        return c.json({ error: 'Pengguna tidak ditemukan.' }, 404);
      }
      targetUserId = user.id;
      const creds = await db
        .select()
        .from(passkeyCredentials)
        .where(eq(passkeyCredentials.userId, user.id));

      if (creds.length === 0) {
        return c.json({ error: 'Akun ini belum menautkan Passkey.' }, 400);
      }

      allowCredentials = creds.map((cred) => ({
        id: cred.credentialId,
        transports: cred.transports ? (JSON.parse(cred.transports) as AuthenticatorTransportFuture[]) : undefined,
      }));
    }

    const options = await generateAuthenticationOptions({
      rpID: config.rpId,
      allowCredentials,
      userVerification: 'preferred',
    });

    const challengeToken = crypto.randomUUID();
    challenges.create(`auth:${challengeToken}`, options.challenge, targetUserId);
    return c.json({ challengeToken, options });
  });

  router.post('/passkey/login/verify', async (c) => {
    const body = await c.req.json().catch(() => null);
    const challengeToken = typeof body?.challengeToken === 'string' ? body.challengeToken : '';
    const response = body?.response;

    const entry = challenges.consume(`auth:${challengeToken}`);
    if (!entry || !response?.id) {
      return c.json({ error: 'Tantangan Passkey kedaluwarsa atau tidak valid.' }, 400);
    }

    const [cred] = await db
      .select()
      .from(passkeyCredentials)
      .where(eq(passkeyCredentials.credentialId, String(response.id)))
      .limit(1);

    if (!cred) {
      return c.json({ error: 'Passkey tidak terdaftar.' }, 401);
    }

    try {
      const verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge: entry.challenge,
        expectedOrigin: config.origins,
        expectedRPID: config.rpId,
        credential: {
          id: cred.credentialId,
          publicKey: Buffer.from(cred.publicKey, 'base64url'),
          counter: cred.counter,
          transports: cred.transports ? (JSON.parse(cred.transports) as AuthenticatorTransportFuture[]) : undefined,
        },
      });

      if (!verification.verified) {
        return c.json({ error: 'Autentikasi Passkey ditolak.' }, 401);
      }

      await db
        .update(passkeyCredentials)
        .set({ counter: verification.authenticationInfo.newCounter })
        .where(eq(passkeyCredentials.id, cred.id));

      const [user] = await db.select().from(users).where(eq(users.id, cred.userId)).limit(1);
      if (!user) {
        return c.json({ error: 'Akun pengguna tidak ditemukan.' }, 404);
      }

      const token = await signAccessToken(user.id, user.username, config.jwtSecret);
      return c.json({
        token,
        user: toUserPublicDto(user, hub.isOnline(user.id)),
        vault: toKeyVaultDto(user),
      });
    } catch {
      return c.json({ error: 'Verifikasi Passkey gagal.' }, 401);
    }
  });

  return router;
}

