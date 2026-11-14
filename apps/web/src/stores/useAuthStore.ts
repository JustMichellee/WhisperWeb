import { create } from 'zustand';
import type { KeyVaultDto, UserPublicDto } from '@chat/shared';
import { startAuthentication, startRegistration } from '@simplewebauthn/browser';
import { apiClient } from '../services/api';
import {
  derivePasswordKeys,
  generateIdentityKeyPair,
  importPrivateKeyFromJwk,
} from '../crypto/keys';
import {
  generateRecoveryKeyCode,
  rewrapPrivateKeyWithNewPassword,
  unwrapPrivateKeyWithPassword,
  unwrapPrivateKeyWithRecoveryCode,
  wrapPrivateKeyVault,
} from '../crypto/vault';
import {
  clearLocalSession,
  loadDevicePrivateKeyJwk,
  loadLocalSession,
  saveDevicePrivateKeyJwk,
  saveLocalSession,
} from '../db/localVault';

interface AuthState {
  isHydrating: boolean;
  token: string | null;
  user: UserPublicDto | null;
  privateKey: CryptoKey | null;
  privateKeyJwk: JsonWebKey | null;
  passkeyCount: number;
  pendingRecoveryCode: string | null;
  pendingVaultUnlock: {
    token: string;
    user: UserPublicDto;
    vault: KeyVaultDto;
  } | null;

  hydrate: () => Promise<void>;
  register: (input: { username: string; displayName: string; password: string }) => Promise<void>;
  loginWithPassword: (input: { username: string; password: string }) => Promise<void>;
  loginWithPasskey: (username?: string) => Promise<void>;
  unlockPendingVaultWithPassword: (password: string) => Promise<void>;
  unlockPendingVaultWithRecovery: (recoveryCode: string) => Promise<void>;
  recoverAccount: (input: { username: string; recoveryCode: string; newPassword: string }) => Promise<void>;
  registerPasskey: () => Promise<void>;
  updateProfile: (patch: {
    displayName?: string;
    aboutBio?: string;
    avatarUrl?: string | null;
    hideOnlineStatus?: boolean;
  }) => Promise<void>;
  clearPendingRecoveryCode: () => void;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  isHydrating: true,
  token: null,
  user: null,
  privateKey: null,
  privateKeyJwk: null,
  passkeyCount: 0,
  pendingRecoveryCode: null,
  pendingVaultUnlock: null,

  hydrate: async () => {
    set({ isHydrating: true });
    try {
      const stored = await loadLocalSession();
      if (!stored) {
        set({ isHydrating: false });
        return;
      }
      const [{ user, passkeyCount }, privateKey] = await Promise.all([
        apiClient.getMe(stored.token),
        importPrivateKeyFromJwk(stored.privateKeyJwk),
      ]);
      set({
        token: stored.token,
        user,
        privateKey,
        privateKeyJwk: stored.privateKeyJwk,
        passkeyCount,
        isHydrating: false,
      });
    } catch {
      await clearLocalSession();
      set({
        token: null,
        user: null,
        privateKey: null,
        privateKeyJwk: null,
        isHydrating: false,
      });
    }
  },

  register: async ({ username, displayName, password }) => {
    const cleanUsername = username.trim().toLowerCase();
    const keyPair = await generateIdentityKeyPair();
    const recoveryCode = generateRecoveryKeyCode();
    const vault = await wrapPrivateKeyVault(keyPair.privateKeyJwk, password, recoveryCode);

    const res = await apiClient.register({
      username: cleanUsername,
      displayName: displayName.trim(),
      authKey: vault.authKey,
      publicKey: keyPair.publicKeyBase64,
      encryptedPrivateKey: vault.encryptedPrivateKey,
      keySalt: vault.keySalt,
      keyIv: vault.keyIv,
      recoveryEncryptedPrivateKey: vault.recoveryEncryptedPrivateKey,
      recoveryIv: vault.recoveryIv,
      recoveryProof: vault.recoveryProof,
    });

    await saveLocalSession({
      token: res.token,
      userId: res.user.id,
      username: res.user.username,
      privateKeyJwk: keyPair.privateKeyJwk,
    });

    set({
      token: res.token,
      user: res.user,
      privateKey: keyPair.privateKey,
      privateKeyJwk: keyPair.privateKeyJwk,
      passkeyCount: 0,
      pendingRecoveryCode: recoveryCode,
      pendingVaultUnlock: null,
    });
  },

  loginWithPassword: async ({ username, password }) => {
    const cleanUsername = username.trim().toLowerCase();
    const { keySalt } = await apiClient.loginChallenge(cleanUsername);

    // Derive authKey using the account salt first, then unwrap encrypted private key after server verifies
    const { keys } = await derivePasswordKeys(password, keySalt);
    const res = await apiClient.login(cleanUsername, keys.authKeyBase64);

    const unwrapped = await unwrapPrivateKeyWithPassword(
      res.vault.encryptedPrivateKey,
      res.vault.keyIv,
      res.vault.keySalt,
      password
    );

    await saveLocalSession({
      token: res.token,
      userId: res.user.id,
      username: res.user.username,
      privateKeyJwk: unwrapped.privateKeyJwk,
    });

    const me = await apiClient.getMe(res.token).catch(() => ({ passkeyCount: 0 }));

    set({
      token: res.token,
      user: res.user,
      privateKey: unwrapped.privateKey,
      privateKeyJwk: unwrapped.privateKeyJwk,
      passkeyCount: me.passkeyCount,
      pendingVaultUnlock: null,
    });
  },

  loginWithPasskey: async (username) => {
    const cleanUsername = username?.trim() ? username.trim().toLowerCase() : undefined;
    const { challengeToken, options } = await apiClient.passkeyLoginOptions(cleanUsername);
    const authResponse = await startAuthentication({ optionsJSON: options });
    const res = await apiClient.passkeyLoginVerify(challengeToken, authResponse);

    const localJwk = await loadDevicePrivateKeyJwk(res.user.id);
    if (localJwk) {
      const privateKey = await importPrivateKeyFromJwk(localJwk);
      await saveLocalSession({
        token: res.token,
        userId: res.user.id,
        username: res.user.username,
        privateKeyJwk: localJwk,
      });
      const me = await apiClient.getMe(res.token).catch(() => ({ passkeyCount: 1 }));
      set({
        token: res.token,
        user: res.user,
        privateKey,
        privateKeyJwk: localJwk,
        passkeyCount: me.passkeyCount,
        pendingVaultUnlock: null,
      });
      return;
    }

    // Passkey authenticated on a fresh browser without cached device private key; prompt to unlock vault
    set({
      pendingVaultUnlock: {
        token: res.token,
        user: res.user,
        vault: res.vault,
      },
    });
  },

  unlockPendingVaultWithPassword: async (password) => {
    const pending = get().pendingVaultUnlock;
    if (!pending) return;

    const unwrapped = await unwrapPrivateKeyWithPassword(
      pending.vault.encryptedPrivateKey,
      pending.vault.keyIv,
      pending.vault.keySalt,
      password
    );

    await saveLocalSession({
      token: pending.token,
      userId: pending.user.id,
      username: pending.user.username,
      privateKeyJwk: unwrapped.privateKeyJwk,
    });

    const me = await apiClient.getMe(pending.token).catch(() => ({ passkeyCount: 1 }));
    set({
      token: pending.token,
      user: pending.user,
      privateKey: unwrapped.privateKey,
      privateKeyJwk: unwrapped.privateKeyJwk,
      passkeyCount: me.passkeyCount,
      pendingVaultUnlock: null,
    });
  },

  unlockPendingVaultWithRecovery: async (recoveryCode) => {
    const pending = get().pendingVaultUnlock;
    if (!pending) return;

    const unwrapped = await unwrapPrivateKeyWithRecoveryCode(
      pending.vault.recoveryEncryptedPrivateKey,
      pending.vault.recoveryIv,
      recoveryCode
    );

    await saveLocalSession({
      token: pending.token,
      userId: pending.user.id,
      username: pending.user.username,
      privateKeyJwk: unwrapped.privateKeyJwk,
    });

    const me = await apiClient.getMe(pending.token).catch(() => ({ passkeyCount: 1 }));
    set({
      token: pending.token,
      user: pending.user,
      privateKey: unwrapped.privateKey,
      privateKeyJwk: unwrapped.privateKeyJwk,
      passkeyCount: me.passkeyCount,
      pendingVaultUnlock: null,
    });
  },

  recoverAccount: async ({ username, recoveryCode, newPassword }) => {
    const cleanUsername = username.trim().toLowerCase();
    const challenge = await apiClient.recoverChallenge(cleanUsername);
    const unwrapped = await unwrapPrivateKeyWithRecoveryCode(
      challenge.recoveryEncryptedPrivateKey,
      challenge.recoveryIv,
      recoveryCode
    );

    const rewrapped = await rewrapPrivateKeyWithNewPassword(unwrapped.privateKeyJwk, newPassword);
    const res = await apiClient.recoverAccount({
      username: cleanUsername,
      newAuthKey: rewrapped.newAuthKey,
      newEncryptedPrivateKey: rewrapped.newEncryptedPrivateKey,
      newKeySalt: rewrapped.newKeySalt,
      newKeyIv: rewrapped.newKeyIv,
      recoveryProof: unwrapped.recoveryProof,
    });

    await saveLocalSession({
      token: res.token,
      userId: res.user.id,
      username: res.user.username,
      privateKeyJwk: unwrapped.privateKeyJwk,
    });

    set({
      token: res.token,
      user: res.user,
      privateKey: unwrapped.privateKey,
      privateKeyJwk: unwrapped.privateKeyJwk,
      pendingVaultUnlock: null,
    });
  },

  registerPasskey: async () => {
    const { token, user, privateKeyJwk } = get();
    if (!token || !user) return;

    const options = await apiClient.passkeyRegisterOptions(token);
    const regResponse = await startRegistration({ optionsJSON: options });
    await apiClient.passkeyRegisterVerify(token, regResponse);

    if (privateKeyJwk) {
      await saveDevicePrivateKeyJwk(user.id, privateKeyJwk);
    }

    set((state) => ({ passkeyCount: state.passkeyCount + 1 }));
  },

  updateProfile: async (patch) => {
    const token = get().token;
    if (!token) return;
    const { user } = await apiClient.updateProfile(token, patch);
    set({ user });
  },

  clearPendingRecoveryCode: () => set({ pendingRecoveryCode: null }),

  logout: async () => {
    await clearLocalSession();
    set({
      token: null,
      user: null,
      privateKey: null,
      privateKeyJwk: null,
      passkeyCount: 0,
      pendingRecoveryCode: null,
      pendingVaultUnlock: null,
    });
  },
}));

