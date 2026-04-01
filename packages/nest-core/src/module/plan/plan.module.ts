import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { Plan } from '../../persistence/entity/plan.entity';
import { EventsModule } from '../events/events.module';
import { PlanService } from './plan.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Plan]),
    ScheduleModule.forRoot(),
    EventsModule,
  ],
  providers: [PlanService],
  exports: [PlanService],
})
export class PlanModule {}
