import type {
  AuthSessionResponse,
  ConversationDto,
  KeyVaultDto,
  MessageDto,
  RecoverAccountInput,
  RegisterInput,
  UpdateProfileInput,
  UserPublicDto,
} from '@chat/shared';
import type { PublicKeyCredentialCreationOptionsJSON, PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/browser';

const DEFAULT_API_BASE = (import.meta.env.VITE_API_URL ?? '').trim().replace(/\/+$/, '');

/**
 * Resolves a relative API path against an optional configured backend base URL.
 */
export function resolveApiUrl(path: string, apiBase = DEFAULT_API_BASE): string {
  const cleanBase = apiBase.trim().replace(/\/+$/, '');
  if (!cleanBase) return path;
  return path.startsWith('/') ? `${cleanBase}${path}` : `${cleanBase}/${path}`;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
  }
}

async function request<T>(path: string, options: RequestInit = {}, token?: string | null): Promise<T> {
  const headers = new Headers(options.headers);
  if (!(options.body instanceof Uint8Array) && !(options.body instanceof ArrayBuffer) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(resolveApiUrl(path), { ...options, headers });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new ApiError(data?.error ?? `Permintaan gagal (${res.status})`, res.status);
  }
  return (await res.json()) as T;
}

export const apiClient = {
  register: (payload: RegisterInput) =>
    request<AuthSessionResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  loginChallenge: (username: string) =>
    request<{ keySalt: string }>('/api/auth/login/challenge', {
      method: 'POST',
      body: JSON.stringify({ username }),
    }),

  login: (username: string, authKey: string) =>
    request<AuthSessionResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, authKey }),
    }),

  recoverChallenge: (username: string) =>
    request<{ publicKey: string; recoveryEncryptedPrivateKey: string; recoveryIv: string }>(
      '/api/auth/recover/challenge',
      {
        method: 'POST',
        body: JSON.stringify({ username }),
      }
    ),

  recoverAccount: (payload: RecoverAccountInput) =>
    request<AuthSessionResponse>('/api/auth/recover', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  passkeyRegisterOptions: (token: string) =>
    request<PublicKeyCredentialCreationOptionsJSON>(
      '/api/auth/passkey/register/options',
      { method: 'POST' },
      token
    ),

  passkeyRegisterVerify: (token: string, response: unknown) =>
    request<{ verified: boolean; credentialId: string }>(
      '/api/auth/passkey/register/verify',
      { method: 'POST', body: JSON.stringify(response) },
      token
    ),

  passkeyLoginOptions: (username?: string) =>
    request<{ challengeToken: string; options: PublicKeyCredentialRequestOptionsJSON }>(
      '/api/auth/passkey/login/options',
      { method: 'POST', body: JSON.stringify(username ? { username } : {}) }
    ),

  passkeyLoginVerify: (challengeToken: string, response: unknown) =>
    request<AuthSessionResponse & { vault: KeyVaultDto }>('/api/auth/passkey/login/verify', {
      method: 'POST',
      body: JSON.stringify({ challengeToken, response }),
    }),

  getMe: (token: string) =>
    request<{ user: UserPublicDto; passkeyCount: number }>('/api/users/me', {}, token),

  updateProfile: (token: string, payload: UpdateProfileInput) =>
    request<{ user: UserPublicDto }>(
      '/api/users/me',
      { method: 'PATCH', body: JSON.stringify(payload) },
      token
    ),

  searchUsers: (token: string, query: string) =>
    request<{ users: UserPublicDto[] }>(`/api/users/search?q=${encodeURIComponent(query)}`, {}, token),

  getBlockedUsers: (token: string) =>
    request<{ blockedUserIds: string[] }>('/api/users/blocked', {}, token),

  setBlockUser: (token: string, targetUserId: string, blocked: boolean) =>
    request<{ targetUserId: string; blocked: boolean }>(
      '/api/users/block',
      { method: 'POST', body: JSON.stringify({ targetUserId, blocked }) },
      token
    ),

  listConversations: (token: string) =>
    request<{ conversations: ConversationDto[] }>('/api/conversations', {}, token),

  createDirectConversation: (token: string, targetUserId: string) =>
    request<{ conversation: ConversationDto }>(
      '/api/conversations/direct',
      { method: 'POST', body: JSON.stringify({ targetUserId }) },
      token
    ),

  createGroupConversation: (
    token: string,
    payload: {
      name: string;
      description?: string;
      avatarUrl?: string | null;
      members: Array<{
        userId: string;
        encryptedGroupKey: string;
        groupKeyIv: string;
        keySenderPublicKey: string;
      }>;
    }
  ) =>
    request<{ conversation: ConversationDto }>(
      '/api/conversations/group',
      { method: 'POST', body: JSON.stringify(payload) },
      token
    ),

  updateGroupConversation: (
    token: string,
    conversationId: string,
    payload: Record<string, unknown>
  ) =>
    request<{ conversation: ConversationDto | null }>(
      `/api/conversations/${encodeURIComponent(conversationId)}/group`,
      { method: 'PATCH', body: JSON.stringify(payload) },
      token
    ),

  listMessages: (token: string, conversationId: string, before?: number) => {
    const query = before ? `?before=${before}&limit=50` : '?limit=50';
    return request<{ messages: MessageDto[] }>(
      `/api/conversations/${encodeURIComponent(conversationId)}/messages${query}`,
      {},
      token
    );
  },

  uploadEncryptedBlob: (token: string, encryptedBytes: Uint8Array) =>
    request<{ attachmentId: string; sizeBytes: number; sha256Checksum: string }>(
      '/api/media/upload',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: new Blob([encryptedBytes.buffer as ArrayBuffer]),
      },
      token
    ),

  downloadEncryptedBlob: async (token: string, attachmentId: string): Promise<ArrayBuffer> => {
    const res = await fetch(resolveApiUrl(`/api/media/${encodeURIComponent(attachmentId)}`), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      throw new ApiError('Gagal mengunduh berkas terenkripsi.', res.status);
    }
    return res.arrayBuffer();
  },
};

