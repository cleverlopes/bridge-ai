import { Module } from '@nestjs/common';
import { KsmModule } from '../ksm/ksm.module';
import { EventsModule } from '../events/events.module';
import { BrainService } from './brain.service';

@Module({
  imports: [KsmModule, EventsModule],
  providers: [BrainService],
  exports: [BrainService],
})
export class BrainModule {}
