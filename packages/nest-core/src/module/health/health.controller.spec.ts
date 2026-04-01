import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { HealthCheckService, TypeOrmHealthIndicator } from '@nestjs/terminus';
import { BrainService } from '../brain/brain.service';
import type { HealthCheckResult, HealthIndicatorResult } from '@nestjs/terminus';

const makeHealthCheckService = () => ({
  check: jest.fn(),
});

const makeTypeOrmHealthIndicator = () => ({
  pingCheck: jest.fn<Promise<HealthIndicatorResult>, [string]>(),
});

const makeBrainService = () => ({
  checkProvider: jest.fn<Promise<{ healthy: boolean; provider: string; error?: string }>, []>(),
  generate: jest.fn(),
  setProjectProvider: jest.fn(),
});

describe('HealthController', () => {
  let controller: HealthController;
  let healthCheckService: ReturnType<typeof makeHealthCheckService>;
  let typeOrmIndicator: ReturnType<typeof makeTypeOrmHealthIndicator>;
  let brainService: ReturnType<typeof makeBrainService>;

  beforeEach(async () => {
    healthCheckService = makeHealthCheckService();
    typeOrmIndicator = makeTypeOrmHealthIndicator();
    brainService = makeBrainService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: HealthCheckService, useValue: healthCheckService },
        { provide: TypeOrmHealthIndicator, useValue: typeOrmIndicator },
        { provide: BrainService, useValue: brainService },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  describe('check()', () => {
    it('calls health.check() with db ping and provider check', async () => {
      const mockResult: HealthCheckResult = {
        status: 'ok',
        info: { db: { status: 'up' } },
        error: {},
        details: { db: { status: 'up' } },
      };
      healthCheckService.check.mockResolvedValue(mockResult);
      typeOrmIndicator.pingCheck.mockResolvedValue({ db: { status: 'up' } });
      brainService.checkProvider.mockResolvedValue({ healthy: true, provider: 'claude-cli' });

      const result = await controller.check();

      expect(healthCheckService.check).toHaveBeenCalledTimes(1);
      expect(result).toBe(mockResult);
    });

    it('passes db pingCheck as one of the check functions', async () => {
      let capturedChecks: Array<() => unknown> = [];
      healthCheckService.check.mockImplementation(async (checks: Array<() => unknown>) => {
        capturedChecks = checks;
        return { status: 'ok', info: {}, error: {}, details: {} } as HealthCheckResult;
      });
      typeOrmIndicator.pingCheck.mockResolvedValue({ db: { status: 'up' } });
      brainService.checkProvider.mockResolvedValue({ healthy: true, provider: 'mock' });

      await controller.check();

      expect(capturedChecks).toHaveLength(2);

      // Execute the first check (db ping)
      await capturedChecks[0]!();
      expect(typeOrmIndicator.pingCheck).toHaveBeenCalledWith('db');
    });

    it('provider check returns healthy status when brain is up', async () => {
      let capturedChecks: Array<() => unknown> = [];
      healthCheckService.check.mockImplementation(async (checks: Array<() => unknown>) => {
        capturedChecks = checks;
        return { status: 'ok', info: {}, error: {}, details: {} } as HealthCheckResult;
      });
      brainService.checkProvider.mockResolvedValue({ healthy: true, provider: 'openrouter' });

      await controller.check();

      const providerResult = await capturedChecks[1]!() as Record<string, unknown>;
      expect((providerResult['providers'] as Record<string, unknown>)['status']).toBe('up');
    });

    it('provider check returns down status when brain is unhealthy', async () => {
      let capturedChecks: Array<() => unknown> = [];
      healthCheckService.check.mockImplementation(async (checks: Array<() => unknown>) => {
        capturedChecks = checks;
        return { status: 'ok', info: {}, error: {}, details: {} } as HealthCheckResult;
      });
      brainService.checkProvider.mockResolvedValue({
        healthy: false,
        provider: 'claude-cli',
        error: 'CLI not available',
      });

      await controller.check();

      const providerResult = await capturedChecks[1]!() as Record<string, unknown>;
      expect((providerResult['providers'] as Record<string, unknown>)['status']).toBe('down');
    });
  });
});
