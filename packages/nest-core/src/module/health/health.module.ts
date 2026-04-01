import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BrainModule } from '../brain/brain.module';
import { HealthController } from './health.controller';

@Module({
  imports: [TerminusModule, TypeOrmModule, BrainModule],
  controllers: [HealthController],
})
export class HealthModule {}
