import { sqliteTable, text, integer, primaryKey, index } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(),
    username: text('username').notNull().unique(),
    displayName: text('display_name').notNull(),
    aboutBio: text('about_bio').notNull().default('Menggunakan WhisperWeb'),
    avatarUrl: text('avatar_url'),
    authHash: text('auth_hash').notNull(),
    publicKey: text('public_key').notNull(),
    encryptedPrivateKey: text('encrypted_private_key').notNull(),
    keySalt: text('key_salt').notNull(),
    keyIv: text('key_iv').notNull(),
    recoveryEncryptedPrivateKey: text('recovery_encrypted_private_key').notNull(),
    recoveryIv: text('recovery_iv').notNull(),
    recoveryProofHash: text('recovery_proof_hash').notNull(),
    hideOnlineStatus: integer('hide_online_status', { mode: 'boolean' }).notNull().default(false),
    lastSeenAt: integer('last_seen_at'),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [index('idx_users_username').on(table.username)]
);

export const passkeyCredentials = sqliteTable(
  'passkey_credentials',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    credentialId: text('credential_id').notNull().unique(),
    publicKey: text('public_key').notNull(),
    counter: integer('counter').notNull().default(0),
    transports: text('transports'),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [index('idx_passkey_user').on(table.userId)]
);

export const blockedUsers = sqliteTable(
  'blocked_users',
  {
    blockerId: text('blocker_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    blockedId: text('blocked_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [primaryKey({ columns: [table.blockerId, table.blockedId] })]
);

export const conversations = sqliteTable('conversations', {
  id: text('id').primaryKey(),
  type: text('type', { enum: ['direct', 'group'] }).notNull(),
  name: text('name'),
  description: text('description').notNull().default(''),
  avatarUrl: text('avatar_url'),
  keyVersion: integer('key_version').notNull().default(1),
  createdBy: text('created_by')
    .notNull()
    .references(() => users.id),
  lastMessageAt: integer('last_message_at'),
  createdAt: integer('created_at').notNull(),
});

export const conversationMembers = sqliteTable(
  'conversation_members',
  {
    conversationId: text('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role', { enum: ['admin', 'member'] }).notNull().default('member'),
    encryptedGroupKey: text('encrypted_group_key'),
    groupKeyIv: text('group_key_iv'),
    keySenderPublicKey: text('key_sender_public_key'),
    lastReadMessageId: text('last_read_message_id'),
    joinedAt: integer('joined_at').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.conversationId, table.userId] }),
    index('idx_conv_members_user').on(table.userId),
  ]
);

export const attachments = sqliteTable('attachments', {
  id: text('id').primaryKey(),
  uploaderId: text('uploader_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  storagePath: text('storage_path').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  sha256Checksum: text('sha256_checksum').notNull(),
  createdAt: integer('created_at').notNull(),
});

export const messages = sqliteTable(
  'messages',
  {
    id: text('id').primaryKey(),
    conversationId: text('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    senderId: text('sender_id')
      .notNull()
      .references(() => users.id),
    replyToId: text('reply_to_id'),
    ciphertext: text('ciphertext').notNull(),
    iv: text('iv').notNull(),
    messageType: text('message_type', { enum: ['text', 'image', 'file', 'system'] }).notNull(),
    attachmentId: text('attachment_id').references(() => attachments.id),
    keyVersion: integer('key_version').notNull().default(1),
    isDeleted: integer('is_deleted', { mode: 'boolean' }).notNull().default(false),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [index('idx_messages_conv_created').on(table.conversationId, table.createdAt)]
);

export const messageReceipts = sqliteTable(
  'message_receipts',
  {
    messageId: text('message_id')
      .notNull()
      .references(() => messages.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    deliveredAt: integer('delivered_at'),
    readAt: integer('read_at'),
  },
  (table) => [primaryKey({ columns: [table.messageId, table.userId] })]
);

export const messageReactions = sqliteTable(
  'message_reactions',
  {
    messageId: text('message_id')
      .notNull()
      .references(() => messages.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    emoji: text('emoji').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [primaryKey({ columns: [table.messageId, table.userId] })]
);

export const hiddenMessages = sqliteTable(
  'hidden_messages',
  {
    messageId: text('message_id')
      .notNull()
      .references(() => messages.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.messageId, table.userId] })]
);

