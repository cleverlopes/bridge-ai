import { Repository } from 'typeorm';
import { ExecutionMetricsService } from '../metrics/metrics.service';
import { ObsidianSyncService } from './obsidian-sync.service';
import { Project } from '../../persistence/entity/project.entity';
import { Plan } from '../../persistence/entity/plan.entity';
import { Phase } from '../../persistence/entity/phase.entity';
import { ExecutionMetric } from '../../persistence/entity/execution-metric.entity';
import type { GSDPhaseCompleteEvent } from '@bridge-ai/gsd-sdk';

// Mock node:fs/promises at module level
jest.mock('node:fs/promises', () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
  readFile: jest.fn().mockResolvedValue(''),
  copyFile: jest.fn().mockResolvedValue(undefined),
  rename: jest.fn().mockResolvedValue(undefined),
  access: jest.fn().mockRejectedValue({ code: 'ENOENT' }),
}));

import * as fsPromises from 'node:fs/promises';

const makeProjectRepo = (): jest.Mocked<Repository<Project>> =>
  ({
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  }) as unknown as jest.Mocked<Repository<Project>>;

const makePlanRepo = (): jest.Mocked<Repository<Plan>> =>
  ({
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  }) as unknown as jest.Mocked<Repository<Plan>>;

const makePhaseRepo = (): jest.Mocked<Repository<Phase>> =>
  ({
    findOne: jest.fn(),
    find: jest.fn(),
  }) as unknown as jest.Mocked<Repository<Phase>>;

const makeMetricRepo = (): jest.Mocked<Repository<ExecutionMetric>> =>
  ({
    findOne: jest.fn(),
    find: jest.fn(),
  }) as unknown as jest.Mocked<Repository<ExecutionMetric>>;

const makeMetricsService = (): jest.Mocked<ExecutionMetricsService> =>
  ({
    recordPhaseFromGsdEvent: jest.fn().mockResolvedValue(undefined),
    recordPhaseMetrics: jest.fn(),
    getAggregatedMetrics: jest.fn().mockResolvedValue({
      totalCostUsd: 0.5,
      totalDurationMs: 100000,
      totalPhases: 3,
      successRate: 100,
      byProject: [{ projectId: 'p1', slug: 'proj', totalCostUsd: 0.5, avgDurationMs: 33333, phases: 3 }],
      byModel: [{ model: 'claude-3', totalCostUsd: 0.5, uses: 3 }],
    }),
  }) as unknown as jest.Mocked<ExecutionMetricsService>;

const makeProject = (): Project =>
  ({
    id: 'proj-1',
    slug: 'test-project',
    name: 'Test Project',
    description: 'A test project',
    stack: 'TypeScript',
    status: 'active',
    settings: {},
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date(),
  }) as Project;

describe('ObsidianSyncService', () => {
  let service: ObsidianSyncService;
  let projectRepo: jest.Mocked<Repository<Project>>;
  let planRepo: jest.Mocked<Repository<Plan>>;
  let phaseRepo: jest.Mocked<Repository<Phase>>;
  let metricRepo: jest.Mocked<Repository<ExecutionMetric>>;
  let metricsService: jest.Mocked<ExecutionMetricsService>;
  let mkdir: jest.MockedFunction<typeof fsPromises.mkdir>;
  let writeFile: jest.MockedFunction<typeof fsPromises.writeFile>;
  let access: jest.MockedFunction<typeof fsPromises.access>;

  beforeEach(() => {
    jest.resetAllMocks();
    mkdir = jest.mocked(fsPromises.mkdir);
    writeFile = jest.mocked(fsPromises.writeFile);
    access = jest.mocked(fsPromises.access);
    // Restore default resolved behavior after reset
    mkdir.mockResolvedValue(undefined);
    writeFile.mockResolvedValue(undefined);
    access.mockRejectedValue({ code: 'ENOENT' });
    jest.mocked(fsPromises.copyFile).mockResolvedValue(undefined);
    jest.mocked(fsPromises.readFile).mockResolvedValue('');
    jest.mocked(fsPromises.rename).mockResolvedValue(undefined);
    projectRepo = makeProjectRepo();
    planRepo = makePlanRepo();
    phaseRepo = makePhaseRepo();
    metricRepo = makeMetricRepo();
    metricsService = makeMetricsService();
    service = new ObsidianSyncService(projectRepo, planRepo, phaseRepo, metricRepo, metricsService);

    // Default: files don't exist (access rejects)
    access.mockRejectedValue({ code: 'ENOENT' });
  });

  describe('ensureVaultStructure()', () => {
    it('creates expected directories', async () => {
      await service.ensureVaultStructure();

      expect(mkdir).toHaveBeenCalledWith(expect.stringContaining('projects'), expect.objectContaining({ recursive: true }));
      expect(mkdir).toHaveBeenCalledWith(expect.stringContaining('archive'), expect.objectContaining({ recursive: true }));
    });

    it('writes RULES-AND-CONVENTIONS.md when it does not exist', async () => {
      access.mockRejectedValue({ code: 'ENOENT' });

      await service.ensureVaultStructure();

      expect(writeFile).toHaveBeenCalledWith(
        expect.stringContaining('RULES-AND-CONVENTIONS.md'),
        expect.any(String),
        'utf8',
      );
    });

    it('does not throw if filesystem calls fail', async () => {
      mkdir.mockRejectedValue(new Error('permission denied'));
      await expect(service.ensureVaultStructure()).resolves.not.toThrow();
    });
  });

  describe('generateIndex()', () => {
    it('writes index.md with Dataview content', async () => {
      await service.generateIndex();

      expect(writeFile).toHaveBeenCalledWith(
        expect.stringContaining('index.md'),
        expect.stringContaining('dataview'),
        'utf8',
      );
    });
  });

  describe('generateMetricsDashboard()', () => {
    it('writes metrics.md', async () => {
      await service.generateMetricsDashboard();

      expect(writeFile).toHaveBeenCalledWith(
        expect.stringContaining('metrics.md'),
        expect.any(String),
        'utf8',
      );
    });

    it('includes summary data from metricsService', async () => {
      await service.generateMetricsDashboard();

      const writeCall = writeFile.mock.calls.find(c =>
        (c[0] as string).includes('metrics.md'),
      );
      expect(writeCall).toBeDefined();
      const content = writeCall![1] as string;
      expect(content).toContain('Total Phases');
    });
  });

  describe('syncProject()', () => {
    it('logs warning and returns if project not found', async () => {
      projectRepo.findOne.mockResolvedValue(null);

      await expect(service.syncProject('nonexistent')).resolves.not.toThrow();
      expect(writeFile).not.toHaveBeenCalled();
    });

    it('creates project vault directory and writes MOC.md', async () => {
      const project = makeProject();
      projectRepo.findOne.mockResolvedValue(project);
      planRepo.findOne.mockResolvedValue(null);
      phaseRepo.find.mockResolvedValue([]);
      metricRepo.find.mockResolvedValue([]);

      await service.syncProject('proj-1');

      expect(mkdir).toHaveBeenCalledWith(
        expect.stringContaining('test-project'),
        expect.objectContaining({ recursive: true }),
      );
      expect(writeFile).toHaveBeenCalledWith(
        expect.stringContaining('MOC.md'),
        expect.any(String),
        'utf8',
      );
    });

    it('copies ROADMAP.md and STATE.md if they exist', async () => {
      const project = makeProject();
      projectRepo.findOne.mockResolvedValue(project);
      planRepo.findOne.mockResolvedValue(null);
      phaseRepo.find.mockResolvedValue([]);
      metricRepo.find.mockResolvedValue([]);

      // Make access succeed for those files
      const copyFile = jest.mocked(fsPromises.copyFile);
      access.mockResolvedValue(undefined);

      await service.syncProject('proj-1');

      expect(copyFile).toHaveBeenCalledWith(
        expect.stringContaining('ROADMAP.md'),
        expect.stringContaining('ROADMAP.md'),
      );
    });

    it('does not throw if copy fails', async () => {
      const project = makeProject();
      projectRepo.findOne.mockResolvedValue(project);
      planRepo.findOne.mockResolvedValue(null);
      phaseRepo.find.mockResolvedValue([]);
      metricRepo.find.mockResolvedValue([]);

      writeFile.mockRejectedValue(new Error('write error'));

      await expect(service.syncProject('proj-1')).resolves.not.toThrow();
    });
  });

  describe('onPhaseComplete()', () => {
    it('calls metricsService.recordPhaseFromGsdEvent', async () => {
      const project = makeProject();
      projectRepo.findOne.mockResolvedValue(project);
      planRepo.findOne.mockResolvedValue(null);
      phaseRepo.find.mockResolvedValue([]);
      metricRepo.find.mockResolvedValue([]);

      const event: GSDPhaseCompleteEvent = {
        type: 'phase_complete' as GSDPhaseCompleteEvent['type'],
        timestamp: new Date().toISOString(),
        sessionId: 'session-1',
        phaseNumber: '3',
        phaseName: 'Test Coverage',
        totalCostUsd: 0.1,
        totalDurationMs: 300000,
        stepsCompleted: 4,
        success: true,
      };

      await service.onPhaseComplete(event, 'plan-1', 'proj-1');

      expect(metricsService.recordPhaseFromGsdEvent).toHaveBeenCalledWith(event, 'plan-1', 'proj-1');
    });

    it('still calls syncProject even if recordPhaseFromGsdEvent throws', async () => {
      metricsService.recordPhaseFromGsdEvent.mockRejectedValue(new Error('metrics error'));
      const project = makeProject();
      projectRepo.findOne.mockResolvedValue(project);
      planRepo.findOne.mockResolvedValue(null);
      phaseRepo.find.mockResolvedValue([]);
      metricRepo.find.mockResolvedValue([]);

      const event: GSDPhaseCompleteEvent = {
        type: 'phase_complete' as GSDPhaseCompleteEvent['type'],
        timestamp: new Date().toISOString(),
        sessionId: 's1',
        phaseNumber: '1',
        phaseName: 'Phase 1',
        totalCostUsd: 0,
        totalDurationMs: 0,
        stepsCompleted: 0,
        success: false,
      };

      await expect(service.onPhaseComplete(event, 'plan-1', 'proj-1')).resolves.not.toThrow();
      expect(projectRepo.findOne).toHaveBeenCalled();
    });
  });
});
