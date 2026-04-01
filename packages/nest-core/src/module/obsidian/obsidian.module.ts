import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExecutionMetric } from '../../persistence/entity/execution-metric.entity';
import { Phase } from '../../persistence/entity/phase.entity';
import { Plan } from '../../persistence/entity/plan.entity';
import { Project } from '../../persistence/entity/project.entity';
import { MetricsModule } from '../metrics/metrics.module';
import { ObsidianSyncService } from './obsidian-sync.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Project, Plan, Phase, ExecutionMetric]),
    MetricsModule,
  ],
  providers: [ObsidianSyncService],
  exports: [ObsidianSyncService],
})
export class ObsidianModule {}
