import { Injectable, Logger } from '@nestjs/common';
import { Telegraf } from 'telegraf';

@Injectable()
export class TelegramNotifierService {
  private readonly logger = new Logger(TelegramNotifierService.name);
  private bot: Telegraf | null = null;

  setBot(bot: Telegraf): void {
    this.bot = bot;
  }

  async send(conversationId: string, text: string): Promise<void> {
    if (!this.bot) {
      this.logger.warn(`Cannot send to ${conversationId}: bot not initialized`);
      return;
    }
    try {
      await this.bot.telegram.sendMessage(conversationId, text, { parse_mode: 'Markdown' });
    } catch (err) {
      this.logger.error(`Failed to send message to ${conversationId}: ${err instanceof Error ? err.message : err}`);
    }
  }
}
