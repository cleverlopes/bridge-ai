import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { HealthCheckService, TypeOrmHealthIndicator } from '@nestjs/terminus';
import type { HealthIndicatorResult } from '@nestjs/terminus';
import { getQueueToken } from '@nestjs/bull';
import { QUEUE_PROJECT_EVENTS } from '../events/events.service';

const makeHealthCheckService = () => ({
  check: jest.fn(),
});

const makeTypeOrmHealthIndicator = () => ({
  pingCheck: jest.fn<Promise<HealthIndicatorResult>, [string]>(),
});

const makeQueue = (hasPing = true) => ({
  client: hasPing
    ? { ping: jest.fn<Promise<string>, []>().mockResolvedValue('PONG') }
    : undefined,
});

describe('HealthController', () => {
  let controller: HealthController;
  let healthCheckService: ReturnType<typeof makeHealthCheckService>;
  let typeOrmIndicator: ReturnType<typeof makeTypeOrmHealthIndicator>;
  let queue: ReturnType<typeof makeQueue>;

  beforeEach(async () => {
    healthCheckService = makeHealthCheckService();
    typeOrmIndicator = makeTypeOrmHealthIndicator();
    queue = makeQueue();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: HealthCheckService, useValue: healthCheckService },
        { provide: TypeOrmHealthIndicator, useValue: typeOrmIndicator },
        { provide: getQueueToken(QUEUE_PROJECT_EVENTS), useValue: queue },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  describe('check()', () => {
    it('returns {status:ok,db:connected,redis:connected} when all checks pass', async () => {
      healthCheckService.check.mockResolvedValue({ status: 'ok', info: {}, error: {}, details: {} });

      const result = await controller.check();

      expect(result).toEqual({ status: 'ok', db: 'connected', redis: 'connected' });
    });

    it('returns {status:error,db:error,...} when db check throws', async () => {
      healthCheckService.check.mockRejectedValue(new Error('DB down'));

      const result = await controller.check();

      expect(result.db).toBe('error');
      expect(result.status).toBe('error');
    });

    it('returns {status:error,...,redis:error} when redis ping throws', async () => {
      healthCheckService.check.mockResolvedValue({ status: 'ok', info: {}, error: {}, details: {} });
      (queue.client!.ping as jest.Mock).mockRejectedValue(new Error('Redis down'));

      const result = await controller.check();

      expect(result.redis).toBe('error');
      expect(result.status).toBe('error');
    });

    it('returns redis:error when BullMQ client has no ping', async () => {
      healthCheckService.check.mockResolvedValue({ status: 'ok', info: {}, error: {}, details: {} });

      const moduleNoPing: TestingModule = await Test.createTestingModule({
        controllers: [HealthController],
        providers: [
          { provide: HealthCheckService, useValue: healthCheckService },
          { provide: TypeOrmHealthIndicator, useValue: typeOrmIndicator },
          { provide: getQueueToken(QUEUE_PROJECT_EVENTS), useValue: makeQueue(false) },
        ],
      }).compile();

      const ctrl = moduleNoPing.get<HealthController>(HealthController);
      const result = await ctrl.check();

      expect(result.redis).toBe('error');
    });
  });
});
