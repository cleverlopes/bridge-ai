import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExecutionMetric } from '../../persistence/entity/execution-metric.entity';
import { Phase } from '../../persistence/entity/phase.entity';
import { Plan } from '../../persistence/entity/plan.entity';
import { Project } from '../../persistence/entity/project.entity';
import { ExecutionMetricsService } from './metrics.service';

@Module({
  imports: [TypeOrmModule.forFeature([ExecutionMetric, Phase, Plan, Project])],
  providers: [ExecutionMetricsService],
  exports: [ExecutionMetricsService],
})
export class MetricsModule {}
