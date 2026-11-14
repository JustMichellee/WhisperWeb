import { z } from 'zod';

export const MessageTypeSchema = z.enum(['text', 'image', 'file', 'system']);
export type MessageType = z.infer<typeof MessageTypeSchema>;

export const ConversationTypeSchema = z.enum(['direct', 'group']);
export type ConversationType = z.infer<typeof ConversationTypeSchema>;

export const MemberRoleSchema = z.enum(['admin', 'member']);
export type MemberRole = z.infer<typeof MemberRoleSchema>;

export const CreateDirectConversationSchema = z.object({
  targetUserId: z.string().min(1),
});

export const GroupMemberKeySchema = z.object({
  userId: z.string().min(1),
  encryptedGroupKey: z.string().min(16).max(2048),
  groupKeyIv: z.string().min(12).max(256),
  keySenderPublicKey: z.string().min(32).max(2048),
});

export const CreateGroupConversationSchema = z.object({
  name: z.string().trim().min(1, 'Nama grup wajib diisi').max(64, 'Nama grup maksimal 64 karakter'),
  description: z.string().trim().max(200).optional().default(''),
  avatarUrl: z.string().max(350_000).nullable().optional(),
  members: z.array(GroupMemberKeySchema).min(2, 'Grup minimal terdiri dari 2 anggota').max(50, 'MVP grup maksimal 50 anggota'),
});

export const UpdateGroupSchema = z.object({
  name: z.string().trim().min(1).max(64).optional(),
  description: z.string().trim().max(200).optional(),
  avatarUrl: z.string().max(350_000).nullable().optional(),
  addMembers: z.array(GroupMemberKeySchema).optional(),
  removeUserId: z.string().min(1).optional(),
  rotatedKeys: z.array(GroupMemberKeySchema).optional(),
  newKeyVersion: z.number().int().positive().optional(),
});

// Payload JSON yang dienkripsi di browser dengan AES-256-GCM sebelum dikirim ke server
export const DecryptedMediaMetaSchema = z.object({
  attachmentId: z.string().min(1),
  fileName: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(128),
  sizeBytes: z.number().int().nonnegative(),
  fileKeyBase64: z.string().min(16),
  fileIvBase64: z.string().min(12),
});

export const DecryptedMessagePayloadSchema = z.object({
  text: z.string().max(10_000),
  replyToPreview: z
    .object({
      id: z.string(),
      senderName: z.string(),
      snippet: z.string(),
    })
    .optional(),
  media: DecryptedMediaMetaSchema.optional(),
  systemAction: z
    .object({
      kind: z.enum(['group_created', 'member_added', 'member_removed', 'group_renamed', 'key_rotated']),
      actorName: z.string(),
      targetName: z.string().optional(),
    })
    .optional(),
});

export type DecryptedMediaMeta = z.infer<typeof DecryptedMediaMetaSchema>;
export type DecryptedMessagePayload = z.infer<typeof DecryptedMessagePayloadSchema>;

export interface ConversationMemberDto {
  userId: string;
  username: string;
  displayName: string;
  aboutBio: string;
  avatarUrl: string | null;
  publicKey: string;
  role: MemberRole;
  encryptedGroupKey: string | null;
  groupKeyIv: string | null;
  keySenderPublicKey: string | null;
  lastReadMessageId: string | null;
  isOnline: boolean;
  lastSeenAt: number | null;
}

export interface MessageReceiptDto {
  userId: string;
  deliveredAt: number | null;
  readAt: number | null;
}

export interface MessageReactionDto {
  userId: string;
  emoji: string;
}

export interface MessageDto {
  id: string;
  conversationId: string;
  senderId: string;
  replyToId: string | null;
  ciphertext: string;
  iv: string;
  messageType: MessageType;
  attachmentId: string | null;
  keyVersion: number;
  isDeleted: boolean;
  createdAt: number;
  receipts: MessageReceiptDto[];
  reactions: MessageReactionDto[];
}

export interface ConversationDto {
  id: string;
  type: ConversationType;
  name: string | null;
  description: string;
  avatarUrl: string | null;
  keyVersion: number;
  createdBy: string;
  lastMessageAt: number | null;
  createdAt: number;
  unreadCount: number;
  members: ConversationMemberDto[];
  lastMessage: MessageDto | null;
}

export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

