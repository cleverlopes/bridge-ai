import { describe, it, expect, vi } from 'vitest';
import type { ProviderAdapter, ProviderOptions, GenerationResult, GenerationUsage } from './provider-adapter.js';

const makeUsage = (overrides: Partial<GenerationUsage> = {}): GenerationUsage => ({
  inputTokens: 100,
  outputTokens: 50,
  cacheReadInputTokens: 0,
  cacheCreationInputTokens: 0,
  ...overrides,
});

const makeResult = (overrides: Partial<GenerationResult> = {}): GenerationResult => ({
  success: true,
  sessionId: 'session-123',
  totalCostUsd: 0.001,
  durationMs: 500,
  usage: makeUsage(),
  numTurns: 1,
  ...overrides,
});

class MockProvider implements ProviderAdapter {
  readonly providerName = 'mock';
  generate = vi.fn(async (_prompt: string, _options: ProviderOptions): Promise<GenerationResult> => {
    return makeResult();
  });
}

describe('ProviderAdapter interface', () => {
  it('mock provider implements ProviderAdapter correctly', () => {
    const provider: ProviderAdapter = new MockProvider();
    expect(provider.providerName).toBe('mock');
    expect(typeof provider.generate).toBe('function');
  });

  it('generate() returns a GenerationResult with all required fields', async () => {
    const provider = new MockProvider();
    const result = await provider.generate('test prompt', {});

    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('sessionId');
    expect(result).toHaveProperty('totalCostUsd');
    expect(result).toHaveProperty('durationMs');
    expect(result).toHaveProperty('usage');
    expect(result).toHaveProperty('numTurns');
  });

  it('GenerationResult usage has all required token fields', async () => {
    const provider = new MockProvider();
    const result = await provider.generate('test prompt', {});

    expect(result.usage).toHaveProperty('inputTokens');
    expect(result.usage).toHaveProperty('outputTokens');
    expect(result.usage).toHaveProperty('cacheReadInputTokens');
    expect(result.usage).toHaveProperty('cacheCreationInputTokens');
  });

  it('generate() is called with prompt and options', async () => {
    const provider = new MockProvider();
    const options: ProviderOptions = { model: 'test-model', maxTurns: 5 };
    await provider.generate('hello', options);

    expect(provider.generate).toHaveBeenCalledWith('hello', options);
  });

  it('success:false result includes error field', async () => {
    const provider = new MockProvider();
    provider.generate.mockResolvedValueOnce(
      makeResult({ success: false, error: { subtype: 'api_error', messages: ['Rate limited'] } }),
    );

    const result = await provider.generate('fail', {});
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error?.subtype).toBe('api_error');
    expect(result.error?.messages).toContain('Rate limited');
  });

  it('providerName is a non-empty string', () => {
    const provider = new MockProvider();
    expect(typeof provider.providerName).toBe('string');
    expect(provider.providerName.length).toBeGreaterThan(0);
  });
});
