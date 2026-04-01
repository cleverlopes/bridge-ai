import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { KsmModule } from '../ksm/ksm.module';
import { EventsModule } from '../events/events.module';
import { ProjectModule } from '../project/project.module';
import { PlanModule } from '../plan/plan.module';
import { BrainModule } from '../brain/brain.module';
import { DockerModule } from '../docker/docker.module';
import { ConversationStateService } from './conversation-state.service';
import { TelegramNotifierService } from './telegram-notifier.service';
import { TelegramBotService } from './telegram-bot.service';
import { TelegramThrottlerGuard } from './telegram-throttler.guard';

@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 10 }]),
    KsmModule,
    EventsModule,
    ProjectModule,
    PlanModule,
    BrainModule,
    DockerModule,
  ],
  providers: [ConversationStateService, TelegramNotifierService, TelegramBotService, TelegramThrottlerGuard],
  exports: [TelegramNotifierService, ConversationStateService],
})
export class TelegramModule {}
