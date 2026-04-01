import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Repository, DataSource } from 'typeorm';
import { PlanService } from './plan.service';
import { Plan } from '../../persistence/entity/plan.entity';
import { EventsService } from '../events/events.service';

const makePlanRepo = (): jest.Mocked<Repository<Plan>> =>
  ({
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    update: jest.fn(),
  }) as unknown as jest.Mocked<Repository<Plan>>;

const makeEventsService = (): jest.Mocked<EventsService> =>
  ({
    publish: jest.fn().mockResolvedValue(undefined),
  }) as unknown as jest.Mocked<EventsService>;

const makeDataSource = (queryResult: Plan[] = []): jest.Mocked<DataSource> => {
  const mockManager = {
    query: jest.fn().mockResolvedValue(queryResult),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
  };
  return {
    transaction: jest.fn().mockImplementation(async (cb: (mgr: typeof mockManager) => Promise<Plan | null>) => {
      return cb(mockManager);
    }),
  } as unknown as jest.Mocked<DataSource>;
};

const makePlan = (overrides: Partial<Plan> = {}): Plan =>
  ({
    id: 'plan-123',
    projectId: 'proj-456',
    prompt: 'Build something',
    conversationId: 'conv-789',
    status: 'draft',
    failReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as Plan;

describe('PlanService', () => {
  let service: PlanService;
  let planRepo: jest.Mocked<Repository<Plan>>;
  let events: jest.Mocked<EventsService>;
  let dataSource: jest.Mocked<DataSource>;

  beforeEach(() => {
    planRepo = makePlanRepo();
    events = makeEventsService();
    dataSource = makeDataSource();
    service = new PlanService(planRepo, events, dataSource);

    // Suppress recovery on init
    planRepo.find.mockResolvedValue([]);
  });

  describe('onModuleInit()', () => {
    it('recovers interrupted plans on startup', async () => {
      const executingPlan = makePlan({ status: 'executing' });
      planRepo.find.mockResolvedValueOnce([executingPlan]);
      planRepo.update.mockResolvedValue({ affected: 1, raw: [], generatedMaps: [] });

      await service.onModuleInit();

      expect(planRepo.update).toHaveBeenCalledWith(executingPlan.id, { status: 'approved_queued' });
    });
  });

  describe('createPlan()', () => {
    it('creates a plan with status "draft" and publishes plan.created event', async () => {
      const plan = makePlan({ status: 'draft' });
      planRepo.create.mockReturnValue(plan);
      planRepo.save.mockResolvedValue(plan);

      const result = await service.createPlan('proj-1', 'Build something', 'conv-1');

      expect(planRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'draft' }),
      );
      expect(planRepo.save).toHaveBeenCalled();
      expect(events.publish).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'plan.created' }),
      );
      expect(result.status).toBe('draft');
    });
  });

  describe('submitForApproval()', () => {
    it('transitions draft → awaiting_approval', async () => {
      const plan = makePlan({ status: 'draft' });
      planRepo.findOne.mockResolvedValue(plan);
      planRepo.update.mockResolvedValue({ affected: 1, raw: [], generatedMaps: [] });

      const result = await service.submitForApproval(plan.id);

      expect(planRepo.update).toHaveBeenCalledWith(plan.id, { status: 'awaiting_approval' });
      expect(result.status).toBe('awaiting_approval');
    });

    it('throws BadRequestException if plan is not in draft status', async () => {
      const plan = makePlan({ status: 'approved_queued' });
      planRepo.findOne.mockResolvedValue(plan);

      await expect(service.submitForApproval(plan.id)).rejects.toThrow(BadRequestException);
    });
  });

  describe('approvePlan()', () => {
    it('transitions awaiting_approval → approved_queued and queues execution job', async () => {
      const plan = makePlan({ status: 'awaiting_approval' });
      planRepo.findOne.mockResolvedValue(plan);
      planRepo.update.mockResolvedValue({ affected: 1, raw: [], generatedMaps: [] });

      const result = await service.approvePlan(plan.id);

      expect(planRepo.update).toHaveBeenCalledWith(plan.id, { status: 'approved_queued' });
      expect(events.publish).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'plan.execution_queued' }),
      );
      expect(result.status).toBe('approved_queued');
    });

    it('throws BadRequestException for non-awaiting_approval plan', async () => {
      const plan = makePlan({ status: 'draft' });
      planRepo.findOne.mockResolvedValue(plan);

      await expect(service.approvePlan(plan.id)).rejects.toThrow(BadRequestException);
    });
  });

  describe('startExecution()', () => {
    it('transitions approved_queued → executing via FOR UPDATE SKIP LOCKED', async () => {
      const plan = makePlan({ status: 'approved_queued' });

      const mockManager = {
        query: jest.fn().mockResolvedValue([plan]),
        update: jest.fn().mockResolvedValue({ affected: 1 }),
      };
      dataSource.transaction = jest.fn().mockImplementation(
        async (cb: (m: typeof mockManager) => Promise<Plan | null>) => cb(mockManager),
      );

      const result = await service.startExecution(plan.id);

      expect(mockManager.query).toHaveBeenCalledWith(
        expect.stringContaining('FOR UPDATE SKIP LOCKED'),
        [plan.id],
      );
      expect(result?.status).toBe('executing');
    });

    it('throws BadRequestException if plan cannot be claimed', async () => {
      dataSource.transaction = jest.fn().mockResolvedValue(null);

      await expect(service.startExecution('plan-not-claimable')).rejects.toThrow(BadRequestException);
    });
  });

  describe('completePlan()', () => {
    it('transitions executing → completed', async () => {
      const plan = makePlan({ status: 'executing' });
      planRepo.findOne.mockResolvedValue(plan);
      planRepo.update.mockResolvedValue({ affected: 1, raw: [], generatedMaps: [] });

      const result = await service.completePlan(plan.id);

      expect(planRepo.update).toHaveBeenCalledWith(plan.id, { status: 'completed' });
      expect(result.status).toBe('completed');
    });
  });

  describe('failPlan()', () => {
    it('transitions executing → failed with failReason set', async () => {
      const plan = makePlan({ status: 'executing' });
      planRepo.findOne.mockResolvedValue(plan);
      planRepo.update.mockResolvedValue({ affected: 1, raw: [], generatedMaps: [] });

      const result = await service.failPlan(plan.id, 'Out of tokens');

      expect(planRepo.update).toHaveBeenCalledWith(plan.id, {
        status: 'failed',
        failReason: 'Out of tokens',
      });
      expect(result.status).toBe('failed');
      expect(result.failReason).toBe('Out of tokens');
    });
  });

  describe('stopPlan()', () => {
    it('transitions executing → stopped', async () => {
      const plan = makePlan({ status: 'executing' });
      planRepo.findOne.mockResolvedValue(plan);
      planRepo.update.mockResolvedValue({ affected: 1, raw: [], generatedMaps: [] });

      const result = await service.stopPlan(plan.id);

      expect(planRepo.update).toHaveBeenCalledWith(plan.id, { status: 'stopped' });
      expect(result.status).toBe('stopped');
    });

    it('transitions approved_queued → stopped', async () => {
      const plan = makePlan({ status: 'approved_queued' });
      planRepo.findOne.mockResolvedValue(plan);
      planRepo.update.mockResolvedValue({ affected: 1, raw: [], generatedMaps: [] });

      const result = await service.stopPlan(plan.id);
      expect(result.status).toBe('stopped');
    });

    it('throws BadRequestException if plan is in draft status', async () => {
      const plan = makePlan({ status: 'draft' });
      planRepo.findOne.mockResolvedValue(plan);

      await expect(service.stopPlan(plan.id)).rejects.toThrow(BadRequestException);
    });
  });

  describe('retryPlan()', () => {
    it('transitions stopped → approved_queued', async () => {
      const plan = makePlan({ status: 'stopped' });
      planRepo.findOne.mockResolvedValue(plan);
      planRepo.update.mockResolvedValue({ affected: 1, raw: [], generatedMaps: [] });

      const result = await service.retryPlan(plan.id);

      expect(planRepo.update).toHaveBeenCalledWith(plan.id, {
        status: 'approved_queued',
        failReason: null,
      });
      expect(result.status).toBe('approved_queued');
    });

    it('transitions failed → approved_queued', async () => {
      const plan = makePlan({ status: 'failed', failReason: 'Previous error' });
      planRepo.findOne.mockResolvedValue(plan);
      planRepo.update.mockResolvedValue({ affected: 1, raw: [], generatedMaps: [] });

      const result = await service.retryPlan(plan.id);
      expect(result.status).toBe('approved_queued');
    });

    it('throws BadRequestException if plan is not stopped/failed', async () => {
      const plan = makePlan({ status: 'draft' });
      planRepo.findOne.mockResolvedValue(plan);

      await expect(service.retryPlan(plan.id)).rejects.toThrow(BadRequestException);
    });
  });

  describe('getPlan()', () => {
    it('throws NotFoundException when plan is not found', async () => {
      planRepo.findOne.mockResolvedValue(null);
      await expect(service.getPlan('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });
});
