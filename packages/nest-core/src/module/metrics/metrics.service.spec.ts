import { Repository } from 'typeorm';
import { ExecutionMetricsService, PhaseMetricsInput } from './metrics.service';
import { ExecutionMetric } from '../../persistence/entity/execution-metric.entity';
import { Phase } from '../../persistence/entity/phase.entity';
import { Plan } from '../../persistence/entity/plan.entity';
import { Project } from '../../persistence/entity/project.entity';
import type { GSDPhaseCompleteEvent } from '@bridge-ai/gsd-sdk';

const makeMetricRepo = (): jest.Mocked<Repository<ExecutionMetric>> =>
  ({
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    update: jest.fn(),
  }) as unknown as jest.Mocked<Repository<ExecutionMetric>>;

const makePhaseRepo = (): jest.Mocked<Repository<Phase>> =>
  ({
    findOne: jest.fn(),
  }) as unknown as jest.Mocked<Repository<Phase>>;

const makePlanRepo = (): jest.Mocked<Repository<Plan>> =>
  ({
    findOne: jest.fn(),
  }) as unknown as jest.Mocked<Repository<Plan>>;

const makeProjectRepo = (): jest.Mocked<Repository<Project>> =>
  ({
    findOne: jest.fn(),
  }) as unknown as jest.Mocked<Repository<Project>>;

const makeInput = (overrides: Partial<PhaseMetricsInput> = {}): PhaseMetricsInput => ({
  projectId: 'proj-1',
  phaseId: 'phase-1',
  phaseNumber: 3,
  phaseName: 'Test Coverage',
  planId: 'plan-1',
  startedAt: new Date('2026-03-31T09:00:00Z'),
  completedAt: new Date('2026-03-31T09:30:00Z'),
  durationMs: 1800000,
  costUsd: 0.25,
  tokensIn: 5000,
  tokensOut: 2000,
  modelUsed: 'claude-3',
  iterationCount: 2,
  success: true,
  ...overrides,
});

describe('ExecutionMetricsService', () => {
  let service: ExecutionMetricsService;
  let metricRepo: jest.Mocked<Repository<ExecutionMetric>>;
  let phaseRepo: jest.Mocked<Repository<Phase>>;
  let planRepo: jest.Mocked<Repository<Plan>>;
  let projectRepo: jest.Mocked<Repository<Project>>;

  beforeEach(() => {
    metricRepo = makeMetricRepo();
    phaseRepo = makePhaseRepo();
    planRepo = makePlanRepo();
    projectRepo = makeProjectRepo();
    service = new ExecutionMetricsService(metricRepo, phaseRepo, planRepo, projectRepo);
  });

  describe('recordPhaseMetrics()', () => {
    it('saves ExecutionMetric with correct fields', async () => {
      const input = makeInput();
      const metric = {
        projectId: input.projectId,
        phaseId: input.phaseId,
        durationMs: input.durationMs,
        costUsd: input.costUsd,
        tokensIn: input.tokensIn,
        tokensOut: input.tokensOut,
        modelUsed: input.modelUsed,
        iterationCount: input.iterationCount,
        success: input.success,
      } as ExecutionMetric;

      metricRepo.create.mockReturnValue(metric);
      metricRepo.save.mockResolvedValue(metric);

      const result = await service.recordPhaseMetrics(input);

      expect(metricRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: input.projectId,
          phaseId: input.phaseId,
          durationMs: input.durationMs,
          costUsd: input.costUsd,
          modelUsed: input.modelUsed,
          success: input.success,
        }),
      );
      expect(metricRepo.save).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });
  });

  describe('getAggregatedMetrics()', () => {
    it('returns correct totals, success rate, byProject, byModel', async () => {
      const metrics: ExecutionMetric[] = [
        {
          id: '1',
          projectId: 'proj-1',
          phaseId: 'p1',
          durationMs: 10000,
          costUsd: 0.1,
          tokensIn: 1000,
          tokensOut: 500,
          modelUsed: 'claude-3',
          iterationCount: 1,
          success: true,
          createdAt: new Date(),
          project: { id: 'proj-1', slug: 'my-project' } as Project,
        } as ExecutionMetric,
        {
          id: '2',
          projectId: 'proj-1',
          phaseId: 'p2',
          durationMs: 20000,
          costUsd: 0.2,
          tokensIn: 2000,
          tokensOut: 1000,
          modelUsed: 'claude-3',
          iterationCount: 3,
          success: false,
          createdAt: new Date(),
          project: { id: 'proj-1', slug: 'my-project' } as Project,
        } as ExecutionMetric,
        {
          id: '3',
          projectId: 'proj-2',
          phaseId: 'p3',
          durationMs: 5000,
          costUsd: 0.05,
          tokensIn: 500,
          tokensOut: 200,
          modelUsed: 'gemini-flash',
          iterationCount: 1,
          success: true,
          createdAt: new Date(),
          project: { id: 'proj-2', slug: 'other-project' } as Project,
        } as ExecutionMetric,
      ];

      metricRepo.find.mockResolvedValue(metrics);

      const result = await service.getAggregatedMetrics();

      expect(result.totalCostUsd).toBeCloseTo(0.35, 5);
      expect(result.totalDurationMs).toBe(35000);
      expect(result.totalPhases).toBe(3);
      expect(result.successRate).toBeCloseTo((2 / 3) * 100, 1);

      expect(result.byProject).toHaveLength(2);
      const proj1 = result.byProject.find(p => p.projectId === 'proj-1');
      expect(proj1?.slug).toBe('my-project');
      expect(proj1?.phases).toBe(2);
      expect(proj1?.totalCostUsd).toBeCloseTo(0.3, 5);

      expect(result.byModel).toHaveLength(2);
      const claude = result.byModel.find(m => m.model === 'claude-3');
      expect(claude?.uses).toBe(2);
    });

    it('returns zero totals when no metrics exist', async () => {
      metricRepo.find.mockResolvedValue([]);

      const result = await service.getAggregatedMetrics();

      expect(result.totalCostUsd).toBe(0);
      expect(result.totalPhases).toBe(0);
      expect(result.successRate).toBe(0);
      expect(result.byProject).toHaveLength(0);
      expect(result.byModel).toHaveLength(0);
    });
  });

  describe('recordPhaseFromGsdEvent()', () => {
    it('calls recordPhaseMetrics with correct data from GSDPhaseCompleteEvent', async () => {
      const phase: Phase = {
        id: 'phase-uuid',
        planId: 'plan-1',
        phaseNumber: 2,
        phaseName: 'API Layer',
        status: 'completed',
        startedAt: new Date('2026-03-31T08:00:00Z'),
      } as Phase;

      phaseRepo.findOne.mockResolvedValue(phase);
      const metric = { id: 'metric-1', success: true } as ExecutionMetric;
      metricRepo.create.mockReturnValue(metric);
      metricRepo.save.mockResolvedValue(metric);

      const event: GSDPhaseCompleteEvent = {
        type: 'phase_complete' as GSDPhaseCompleteEvent['type'],
        timestamp: new Date().toISOString(),
        sessionId: 'session-1',
        phaseNumber: '2',
        phaseName: 'API Layer',
        totalCostUsd: 0.15,
        totalDurationMs: 600000,
        stepsCompleted: 5,
        success: true,
      };

      await service.recordPhaseFromGsdEvent(event, 'plan-1', 'proj-1');

      expect(metricRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: 'proj-1',
          phaseId: 'phase-uuid',
          durationMs: 600000,
          costUsd: 0.15,
          success: true,
        }),
      );
    });

    it('does nothing if phase is not found in DB', async () => {
      phaseRepo.findOne.mockResolvedValue(null);

      const event: GSDPhaseCompleteEvent = {
        type: 'phase_complete' as GSDPhaseCompleteEvent['type'],
        timestamp: new Date().toISOString(),
        sessionId: 'session-1',
        phaseNumber: '99',
        phaseName: 'Missing Phase',
        totalCostUsd: 0,
        totalDurationMs: 0,
        stepsCompleted: 0,
        success: false,
      };

      await service.recordPhaseFromGsdEvent(event, 'plan-1', 'proj-1');

      expect(metricRepo.save).not.toHaveBeenCalled();
    });
  });
});
