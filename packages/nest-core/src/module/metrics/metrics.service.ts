import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { GSDPhaseCompleteEvent } from '@bridge-ai/gsd-sdk';
import { ExecutionMetric } from '../../persistence/entity/execution-metric.entity';
import { Phase } from '../../persistence/entity/phase.entity';
import { Plan } from '../../persistence/entity/plan.entity';
import { Project } from '../../persistence/entity/project.entity';

export interface PhaseMetricsInput {
  projectId: string;
  phaseId: string;
  phaseNumber: number;
  phaseName: string;
  planId: string;
  startedAt: Date;
  completedAt: Date;
  durationMs: number;
  costUsd: number;
  tokensIn: number;
  tokensOut: number;
  modelUsed: string;
  iterationCount: number;
  success: boolean;
  errorMessage?: string;
}

export interface AggregatedMetrics {
  totalCostUsd: number;
  totalDurationMs: number;
  totalPhases: number;
  successRate: number;
  byProject: Array<{
    projectId: string;
    slug: string;
    totalCostUsd: number;
    avgDurationMs: number;
    phases: number;
  }>;
  byModel: Array<{
    model: string;
    totalCostUsd: number;
    uses: number;
  }>;
}

@Injectable()
export class ExecutionMetricsService {
  constructor(
    @InjectRepository(ExecutionMetric)
    private readonly metricRepo: Repository<ExecutionMetric>,
    @InjectRepository(Phase)
    private readonly phaseRepo: Repository<Phase>,
    @InjectRepository(Plan)
    private readonly planRepo: Repository<Plan>,
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
  ) {}

  async recordPhaseMetrics(data: PhaseMetricsInput): Promise<ExecutionMetric> {
    const metric = this.metricRepo.create({
      projectId: data.projectId,
      phaseId: data.phaseId,
      durationMs: data.durationMs,
      costUsd: data.costUsd,
      tokensIn: data.tokensIn,
      tokensOut: data.tokensOut,
      modelUsed: data.modelUsed,
      iterationCount: data.iterationCount,
      success: data.success,
    });
    return this.metricRepo.save(metric);
  }

  async getProjectMetrics(projectId: string): Promise<ExecutionMetric[]> {
    return this.metricRepo.find({
      where: { projectId },
      order: { createdAt: 'ASC' },
    });
  }

  async getAggregatedMetrics(): Promise<AggregatedMetrics> {
    const metrics = await this.metricRepo.find({ relations: ['project'] });

    const totalCostUsd = metrics.reduce((sum, m) => sum + (m.costUsd ?? 0), 0);
    const totalDurationMs = metrics.reduce((sum, m) => sum + m.durationMs, 0);
    const totalPhases = metrics.length;
    const successCount = metrics.filter(m => m.success).length;
    const successRate = totalPhases > 0 ? (successCount / totalPhases) * 100 : 0;

    const projectMap = new Map<
      string,
      { projectId: string; slug: string; totalCostUsd: number; totalDurationMs: number; phases: number }
    >();

    for (const m of metrics) {
      const slug = m.project?.slug ?? m.projectId;
      const existing = projectMap.get(m.projectId);
      if (existing) {
        existing.totalCostUsd += m.costUsd ?? 0;
        existing.totalDurationMs += m.durationMs;
        existing.phases += 1;
      } else {
        projectMap.set(m.projectId, {
          projectId: m.projectId,
          slug,
          totalCostUsd: m.costUsd ?? 0,
          totalDurationMs: m.durationMs,
          phases: 1,
        });
      }
    }

    const byProject = Array.from(projectMap.values()).map(p => ({
      projectId: p.projectId,
      slug: p.slug,
      totalCostUsd: p.totalCostUsd,
      avgDurationMs: p.phases > 0 ? p.totalDurationMs / p.phases : 0,
      phases: p.phases,
    }));

    const modelMap = new Map<string, { totalCostUsd: number; uses: number }>();
    for (const m of metrics) {
      const model = m.modelUsed ?? 'unknown';
      const existing = modelMap.get(model);
      if (existing) {
        existing.totalCostUsd += m.costUsd ?? 0;
        existing.uses += 1;
      } else {
        modelMap.set(model, { totalCostUsd: m.costUsd ?? 0, uses: 1 });
      }
    }

    const byModel = Array.from(modelMap.entries()).map(([model, data]) => ({
      model,
      totalCostUsd: data.totalCostUsd,
      uses: data.uses,
    }));

    return { totalCostUsd, totalDurationMs, totalPhases, successRate, byProject, byModel };
  }

  async recordPhaseFromGsdEvent(
    event: GSDPhaseCompleteEvent,
    planId: string,
    projectId: string,
  ): Promise<void> {
    const phase = await this.phaseRepo.findOne({
      where: { planId, phaseNumber: parseInt(event.phaseNumber, 10) },
    });

    if (!phase) return;

    await this.recordPhaseMetrics({
      projectId,
      phaseId: phase.id,
      phaseNumber: parseInt(event.phaseNumber, 10),
      phaseName: event.phaseName,
      planId,
      startedAt: phase.startedAt ?? new Date(Date.now() - event.totalDurationMs),
      completedAt: new Date(),
      durationMs: event.totalDurationMs,
      costUsd: event.totalCostUsd,
      tokensIn: event.tokensIn ?? 0,
      tokensOut: event.tokensOut ?? 0,
      modelUsed: event.modelUsed ?? 'unknown',
      iterationCount: event.stepsCompleted,
      success: event.success,
    });
  }
}
