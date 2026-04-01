import type { Context } from 'telegraf';
import { randomUUID } from 'crypto';

export interface CanonicalPayload {
  type: string;
  channel: 'telegram';
  correlationId: string;
  conversationId: string;
  actor: string;
  createdAt: string;
  chatId: number;
  text?: string;
  data?: Record<string, unknown>;
}

export class CanonicalPayloadBuilder {
  static fromContext(ctx: Context, type: string, data?: Record<string, unknown>): CanonicalPayload {
    const chatId = ctx.chat?.id;
    if (chatId === undefined) {
      throw new Error('Cannot build payload: no chat in context');
    }

    const from = ctx.from;
    const actor = from
      ? [from.username, from.first_name, String(from.id)].filter(Boolean).join('/')
      : 'unknown';

    const text = 'text' in ctx.message! ? ctx.message.text : undefined;

    return {
      type,
      channel: 'telegram',
      correlationId: randomUUID(),
      conversationId: String(chatId),
      actor,
      createdAt: new Date().toISOString(),
      chatId,
      text,
      data,
    };
  }
}
