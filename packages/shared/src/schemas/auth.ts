import { z } from 'zod';

export const UsernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'Username minimal 3 karakter')
  .max(24, 'Username maksimal 24 karakter')
  .regex(/^[a-z0-9_]+$/, 'Username hanya boleh huruf kecil, angka, dan garis bawah (_)');

export const DisplayNameSchema = z
  .string()
  .trim()
  .min(1, 'Nama tampilan wajib diisi')
  .max(48, 'Nama tampilan maksimal 48 karakter');

export const RegisterSchema = z.object({
  username: UsernameSchema,
  displayName: DisplayNameSchema,
  authKey: z.string().min(32).max(512),
  publicKey: z.string().min(32).max(2048),
  encryptedPrivateKey: z.string().min(16).max(4096),
  keySalt: z.string().min(16).max(256),
  keyIv: z.string().min(12).max(256),
  recoveryEncryptedPrivateKey: z.string().min(16).max(4096),
  recoveryIv: z.string().min(12).max(256),
  recoveryProof: z.string().min(16).max(512),
});

export const LoginChallengeSchema = z.object({
  username: UsernameSchema,
});

export const LoginSchema = z.object({
  username: UsernameSchema,
  authKey: z.string().min(32).max(512),
});

export const RecoverAccountSchema = z.object({
  username: UsernameSchema,
  newAuthKey: z.string().min(32).max(512),
  newEncryptedPrivateKey: z.string().min(16).max(4096),
  newKeySalt: z.string().min(16).max(256),
  newKeyIv: z.string().min(12).max(256),
  recoveryProof: z.string().min(16).max(2048),
});

export const UpdateProfileSchema = z.object({
  displayName: DisplayNameSchema.optional(),
  aboutBio: z.string().trim().max(140, 'Bio maksimal 140 karakter').optional(),
  avatarUrl: z.string().max(350_000).nullable().optional(),
  hideOnlineStatus: z.boolean().optional(),
});

export const BlockUserSchema = z.object({
  targetUserId: z.string().min(1),
  blocked: z.boolean(),
});

export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type RecoverAccountInput = z.infer<typeof RecoverAccountSchema>;
export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;

export interface UserPublicDto {
  id: string;
  username: string;
  displayName: string;
  aboutBio: string;
  avatarUrl: string | null;
  publicKey: string;
  lastSeenAt: number | null;
  isOnline: boolean;
  hideOnlineStatus: boolean;
}

export interface KeyVaultDto {
  publicKey: string;
  encryptedPrivateKey: string;
  keySalt: string;
  keyIv: string;
  recoveryEncryptedPrivateKey: string;
  recoveryIv: string;
}

export interface AuthSessionResponse {
  token: string;
  user: UserPublicDto;
  vault: KeyVaultDto;
}
