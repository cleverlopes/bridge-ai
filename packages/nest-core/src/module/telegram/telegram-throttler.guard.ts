import { Injectable, Logger } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import type { Context } from 'telegraf';

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 10;

interface ThrottleEntry {
  count: number;
  resetAt: number;
}

@Injectable()
export class TelegramThrottlerGuard {
  private readonly logger = new Logger(TelegramThrottlerGuard.name);
  private readonly store = new Map<string, ThrottleEntry>();

  check(ctx: Context): void {
    const chatId = String(ctx.chat?.id ?? 'unknown');
    const now = Date.now();

    const entry = this.store.get(chatId);
    if (!entry || now >= entry.resetAt) {
      this.store.set(chatId, { count: 1, resetAt: now + WINDOW_MS });
      return;
    }

    entry.count += 1;
    if (entry.count > MAX_REQUESTS) {
      this.logger.warn(`Throttle limit exceeded for chatId=${chatId} (${entry.count} requests in window)`);
      throw new ThrottlerException();
    }
  }
}
