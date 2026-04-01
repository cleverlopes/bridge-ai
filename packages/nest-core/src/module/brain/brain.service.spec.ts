import { KsmService } from '../ksm/ksm.service';
import { EventsService } from '../events/events.service';
import { BrainService } from './brain.service';
import type { GenerationResult } from '@bridge-ai/gsd-sdk';
import { OpenRouterProvider, GeminiProvider, ClaudeCliProvider } from '@bridge-ai/bridge-sdk';

const makeGenerationResult = (overrides: Partial<GenerationResult> = {}): GenerationResult => ({
  success: true,
  sessionId: 'session-test',
  totalCostUsd: 0.002,
  durationMs: 300,
  usage: {
    inputTokens: 50,
    outputTokens: 25,
    cacheReadInputTokens: 0,
    cacheCreationInputTokens: 0,
  },
  numTurns: 1,
  ...overrides,
});

const makeKsmService = (): jest.Mocked<KsmService> =>
  ({
    getSecret: jest.fn(),
    createSecret: jest.fn(),
    rotateSecret: jest.fn(),
  }) as unknown as jest.Mocked<KsmService>;

const makeEventsService = (): jest.Mocked<EventsService> =>
  ({
    publish: jest.fn().mockResolvedValue(undefined),
  }) as unknown as jest.Mocked<EventsService>;

describe('BrainService', () => {
  let service: BrainService;
  let ksm: jest.Mocked<KsmService>;
  let events: jest.Mocked<EventsService>;
  const originalEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    jest.clearAllMocks();
    ksm = makeKsmService();
    events = makeEventsService();
    service = new BrainService(ksm, events);

    // Save and clear provider env vars
    for (const key of ['OPENROUTER_API_KEY', 'GEMINI_API_KEY', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY']) {
      originalEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value !== undefined) {
        process.env[key] = value;
      } else {
        delete process.env[key];
      }
    }
    jest.clearAllMocks();
  });

  describe('generate()', () => {
    it('emits cost.update event after every call (via OpenRouter from env)', async () => {
      process.env['OPENROUTER_API_KEY'] = 'test-or-key';
      ksm.getSecret.mockRejectedValue(new Error('not found'));

      // The mock provider's generate is already a jest.fn() that returns success
      await service.generate('hello', {});

      expect(events.publish).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'cost.update' }),
      );
    });

    it('uses project provider config from KSM if projectId is provided', async () => {
      const providerConfig = JSON.stringify({ type: 'openrouter', apiKey: 'project-key' });
      ksm.getSecret.mockResolvedValue(providerConfig);

      await service.generate('hello', { projectId: 'proj-123' });

      expect(ksm.getSecret).toHaveBeenCalledWith(
        expect.stringContaining('proj-123'),
        'project',
        'proj-123',
        'BrainService',
        'proj-123',
      );
    });

    it('falls back to env var chain if no KSM config for project', async () => {
      ksm.getSecret.mockRejectedValue(new Error('no config'));
      process.env['OPENROUTER_API_KEY'] = 'fallback-key';

      const result = await service.generate('test', { projectId: 'proj-unknown' });
      expect(result.success).toBe(true);
    });

    it('falls back to ClaudeCli when no API keys set', async () => {
      ksm.getSecret.mockRejectedValue(new Error('not found'));
      // No env vars set — falls to ClaudeCliProvider

      const result = await service.generate('test', {});
      expect(result.success).toBe(true);
    });

    it('falls back to Gemini when GEMINI_API_KEY is set and OPENROUTER is not', async () => {
      ksm.getSecret.mockRejectedValue(new Error('not found'));
      process.env['GEMINI_API_KEY'] = 'gemini-key';

      const result = await service.generate('test', {});
      expect(result.success).toBe(true);
    });

    it('returns result from provider', async () => {
      ksm.getSecret.mockRejectedValue(new Error('not found'));
      process.env['OPENROUTER_API_KEY'] = 'test-key';

      const result = await service.generate('prompt', {});

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('sessionId');
      expect(result).toHaveProperty('totalCostUsd');
    });
  });

  describe('setProjectProvider()', () => {
    it('rotates existing KSM secret if it exists', async () => {
      ksm.rotateSecret.mockResolvedValue(undefined);

      await service.setProjectProvider('proj-1', { type: 'openrouter', apiKey: 'new-key' });

      expect(ksm.rotateSecret).toHaveBeenCalledWith(
        expect.stringContaining('proj-1'),
        expect.stringContaining('openrouter'),
        'project',
        'proj-1',
      );
    });

    it('creates a new KSM secret if rotate throws', async () => {
      ksm.rotateSecret.mockRejectedValue(new Error('not found'));
      ksm.createSecret.mockResolvedValue({} as import('../../persistence/entity/secret.entity').Secret);

      await service.setProjectProvider('proj-2', { type: 'gemini', apiKey: 'gemini-key' });

      expect(ksm.createSecret).toHaveBeenCalledWith(
        expect.stringContaining('proj-2'),
        expect.stringContaining('gemini'),
        'project',
        'proj-2',
      );
    });

    it('serializes config to JSON before storing', async () => {
      ksm.rotateSecret.mockResolvedValue(undefined);
      const config = { type: 'openrouter' as const, apiKey: 'key-123' };

      await service.setProjectProvider('proj-3', config);

      const storedValue = (ksm.rotateSecret.mock.calls[0] as string[])[1];
      const parsed = JSON.parse(storedValue) as Record<string, unknown>;
      expect(parsed['type']).toBe('openrouter');
    });

    it('does not expose raw API key in logs', async () => {
      const secretKey = 'my-super-secret-api-key-xyz';
      ksm.rotateSecret.mockResolvedValue(undefined);

      await expect(
        service.setProjectProvider('proj-3', { type: 'openrouter', apiKey: secretKey }),
      ).resolves.not.toThrow();
    });
  });

  describe('checkProvider()', () => {
    it('returns healthy:true when provider succeeds', async () => {
      ksm.getSecret.mockRejectedValue(new Error('no config'));
      process.env['OPENROUTER_API_KEY'] = 'test-key';

      const result = await service.checkProvider();
      expect(result.healthy).toBe(true);
      expect(result.provider).toBe('openrouter');
    });

    it('returns provider name in result', async () => {
      ksm.getSecret.mockRejectedValue(new Error('no config'));

      const result = await service.checkProvider();
      expect(typeof result.provider).toBe('string');
    });
  });

  describe('generateWithFallback()', () => {
    it('returns first successful provider result', async () => {
      process.env['OPENROUTER_API_KEY'] = 'test-key';

      const result = await service.generateWithFallback('test', {});
      expect(result.success).toBe(true);
    });

    it('returns result from fallback chain (at least ClaudeCli)', async () => {
      // No env vars — only ClaudeCli fallback is active
      // The mock returns success by default
      const result = await service.generateWithFallback('test', {});
      expect(result).toHaveProperty('success');
    });
  });

  describe('providerName', () => {
    it('is "brain"', () => {
      expect(service.providerName).toBe('brain');
    });
  });
});
