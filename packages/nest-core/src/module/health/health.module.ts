import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { TerminusModule } from '@nestjs/terminus';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthController } from './health.controller';
import { QUEUE_PROJECT_EVENTS } from '../events/events.service';

@Module({
  imports: [TerminusModule, TypeOrmModule, BullModule.registerQueue({ name: QUEUE_PROJECT_EVENTS })],
  controllers: [HealthController],
})
export class HealthModule {}
