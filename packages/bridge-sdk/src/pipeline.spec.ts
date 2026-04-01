import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted to define variables used inside vi.mock factory
const { mockGSDInstances, mockRun, mockAddTransport } = vi.hoisted(() => {
  const mockRun = vi.fn().mockResolvedValue({
    success: true,
    totalCostUsd: 0.01,
    durationMs: 5000,
    phasesCompleted: 2,
  });
  const mockAddTransport = vi.fn();
  const mockGSDInstances: Array<{ opts: Record<string, unknown>; addTransport: typeof mockAddTransport; run: typeof mockRun }> = [];
  return { mockGSDInstances, mockRun, mockAddTransport };
});

vi.mock('@bridge-ai/gsd-sdk', () => {
  class GSD {
    run = mockRun;
    onEvent = vi.fn();
    addTransport = mockAddTransport;
    constructor(public readonly opts: Record<string, unknown>) {
      mockGSDInstances.push(this as GSD);
    }
  }

  class ObsidianTransport {
    onEvent = vi.fn();
    close = vi.fn();
    constructor(public readonly opts: Record<string, unknown>) {}
  }

  return { GSD, ObsidianTransport };
});

import { Pipeline } from './pipeline.js';
import type { ProviderAdapter, ProviderOptions, GenerationResult } from '@bridge-ai/gsd-sdk';

const makeProvider = (): ProviderAdapter => ({
  providerName: 'test-provider',
  generate: vi
    .fn<(prompt: string, options: ProviderOptions) => Promise<GenerationResult>>()
    .mockResolvedValue({
    success: true,
    sessionId: 'session-1',
    totalCostUsd: 0,
    durationMs: 100,
    usage: { inputTokens: 10, outputTokens: 5, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 },
    numTurns: 1,
  }),
});

describe('Pipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGSDInstances.length = 0;
  });

  it('Pipeline constructor accepts provider, obsidianVaultPath, workspacePath', () => {
    expect(() => {
      new Pipeline({
        provider: makeProvider(),
        obsidianVaultPath: '/vault',
        workspacePath: '/workspace',
      });
    }).not.toThrow();
  });

  it('execute() calls gsd.run() with the provided prompt', async () => {
    const pipeline = new Pipeline({
      provider: makeProvider(),
      obsidianVaultPath: '/vault',
      workspacePath: '/workspace',
    });

    await pipeline.execute('run phase 1');

    expect(mockRun).toHaveBeenCalledWith('run phase 1');
  });

  it('execute() returns MilestoneRunnerResult shape', async () => {
    mockRun.mockResolvedValueOnce({
      success: true,
      totalCostUsd: 0.02,
      durationMs: 10000,
      phasesCompleted: 3,
    });

    const pipeline = new Pipeline({
      provider: makeProvider(),
      obsidianVaultPath: '/vault',
      workspacePath: '/workspace',
    });

    const result = await pipeline.execute('prompt');

    expect(result).toMatchObject({
      success: expect.any(Boolean) as boolean,
      totalCostUsd: expect.any(Number) as number,
      durationMs: expect.any(Number) as number,
    });
  });

  it('instance getter returns the underlying GSD instance', () => {
    const pipeline = new Pipeline({
      provider: makeProvider(),
      obsidianVaultPath: '/vault',
      workspacePath: '/workspace',
    });

    expect(pipeline.instance).toBeDefined();
  });

  it('constructor passes model and maxBudgetUsd to GSD', () => {
    new Pipeline({
      provider: makeProvider(),
      obsidianVaultPath: '/vault',
      workspacePath: '/workspace',
      model: 'custom-model',
      maxBudgetUsd: 2.5,
      maxTurns: 30,
    });

    const instance = mockGSDInstances[mockGSDInstances.length - 1]!;
    expect(instance.opts).toMatchObject({
      model: 'custom-model',
      maxBudgetUsd: 2.5,
      maxTurns: 30,
    });
  });

  it('ObsidianTransport is registered on the GSD instance', () => {
    new Pipeline({
      provider: makeProvider(),
      obsidianVaultPath: '/my-vault',
      workspacePath: '/workspace',
    });

    expect(mockAddTransport).toHaveBeenCalledTimes(1);
  });

  it('autoMode defaults to false', () => {
    new Pipeline({
      provider: makeProvider(),
      obsidianVaultPath: '/vault',
      workspacePath: '/workspace',
    });

    const instance = mockGSDInstances[mockGSDInstances.length - 1]!;
    expect(instance.opts['autoMode']).toBe(false);
  });

  it('autoMode can be set to true', () => {
    new Pipeline({
      provider: makeProvider(),
      obsidianVaultPath: '/vault',
      workspacePath: '/workspace',
      autoMode: true,
    });

    const instance = mockGSDInstances[mockGSDInstances.length - 1]!;
    expect(instance.opts['autoMode']).toBe(true);
  });

  it('workspacePath is passed as projectDir to GSD', () => {
    new Pipeline({
      provider: makeProvider(),
      obsidianVaultPath: '/vault',
      workspacePath: '/my/workspace',
    });

    const instance = mockGSDInstances[mockGSDInstances.length - 1]!;
    expect(instance.opts['projectDir']).toBe('/my/workspace');
  });
});
