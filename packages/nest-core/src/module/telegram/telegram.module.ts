import { Module } from '@nestjs/common';
import { KsmModule } from '../ksm/ksm.module';
import { EventsModule } from '../events/events.module';
import { ProjectModule } from '../project/project.module';
import { PlanModule } from '../plan/plan.module';
import { BrainModule } from '../brain/brain.module';
import { ConversationStateService } from './conversation-state.service';
import { TelegramNotifierService } from './telegram-notifier.service';
import { TelegramBotService } from './telegram-bot.service';

@Module({
  imports: [KsmModule, EventsModule, ProjectModule, PlanModule, BrainModule],
  providers: [ConversationStateService, TelegramNotifierService, TelegramBotService],
  exports: [TelegramNotifierService, ConversationStateService],
})
export class TelegramModule {}
