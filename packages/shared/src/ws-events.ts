import { z } from 'zod';
import { MessageDto, MessageTypeSchema } from './schemas/chat.js';

export const WsSendMessageSchema = z.object({
  tempId: z.string().min(1),
  conversationId: z.string().min(1),
  ciphertext: z.string().min(1).max(65_536),
  iv: z.string().min(12).max(256),
  messageType: MessageTypeSchema,
  replyToId: z.string().nullable().optional(),
  attachmentId: z.string().nullable().optional(),
  keyVersion: z.number().int().positive().default(1),
});

export const WsReceiptBatchSchema = z.object({
  conversationId: z.string().min(1),
  messageIds: z.array(z.string().min(1)).min(1).max(200),
});

export const WsTypingSchema = z.object({
  conversationId: z.string().min(1),
  isTyping: z.boolean(),
});

export const WsReactionSchema = z.object({
  conversationId: z.string().min(1),
  messageId: z.string().min(1),
  emoji: z.string().min(1).max(16).nullable(),
});

export const WsDeleteMessageSchema = z.object({
  conversationId: z.string().min(1),
  messageId: z.string().min(1),
  mode: z.enum(['everyone', 'me']),
});

export type WsSendMessageInput = z.infer<typeof WsSendMessageSchema>;
export type WsReceiptBatchInput = z.infer<typeof WsReceiptBatchSchema>;
export type WsTypingInput = z.infer<typeof WsTypingSchema>;
export type WsReactionInput = z.infer<typeof WsReactionSchema>;
export type WsDeleteMessageInput = z.infer<typeof WsDeleteMessageSchema>;

export type ClientWsEnvelope =
  | { event: 'chat:send'; data: WsSendMessageInput; timestamp: number }
  | { event: 'chat:delivered'; data: WsReceiptBatchInput; timestamp: number }
  | { event: 'chat:read'; data: WsReceiptBatchInput; timestamp: number }
  | { event: 'chat:typing'; data: WsTypingInput; timestamp: number }
  | { event: 'chat:reaction'; data: WsReactionInput; timestamp: number }
  | { event: 'chat:delete'; data: WsDeleteMessageInput; timestamp: number };

export type ServerWsEnvelope =
  | {
      event: 'chat:ack';
      data: { tempId: string; messageId: string; conversationId: string; createdAt: number };
      timestamp: number;
    }
  | {
      event: 'chat:message';
      data: { message: MessageDto };
      timestamp: number;
    }
  | {
      event: 'chat:receipt_update';
      data: {
        conversationId: string;
        messageIds: string[];
        userId: string;
        type: 'delivered' | 'read';
        at: number;
      };
      timestamp: number;
    }
  | {
      event: 'chat:typing_update';
      data: { conversationId: string; userId: string; isTyping: boolean };
      timestamp: number;
    }
  | {
      event: 'chat:reaction_update';
      data: { conversationId: string; messageId: string; userId: string; emoji: string | null };
      timestamp: number;
    }
  | {
      event: 'chat:deleted';
      data: { conversationId: string; messageId: string; mode: 'everyone' | 'me'; deletedBy: string };
      timestamp: number;
    }
  | {
      event: 'conversation:updated';
      data: { conversationId: string };
      timestamp: number;
    }
  | {
      event: 'presence:update';
      data: { userId: string; isOnline: boolean; lastSeenAt: number };
      timestamp: number;
    }
  | {
      event: 'error';
      data: { message: string };
      timestamp: number;
    };

