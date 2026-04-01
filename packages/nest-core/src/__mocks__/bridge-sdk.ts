// Manual Jest mock for @bridge-ai/bridge-sdk

// This file is used in test contexts, but is included in the library TS build.
// Declare `jest` to keep the build type-safe without requiring Jest globals.
declare const jest: { fn: (...args: unknown[]) => any };

export interface ProviderConfig {
  type: 'openrouter' | 'gemini' | 'openai' | 'claude-cli' | 'gemini-cli' | 'custom-cli';
  apiKey?: string;
  baseUrl?: string;
  command?: string;
  args?: string[];
}

const makeMockProvider = (name: string) => ({
  providerName: name,
  generate: jest.fn().mockResolvedValue({
    success: true,
    sessionId: `${name}-session`,
    totalCostUsd: 0.001,
    durationMs: 100,
    usage: { inputTokens: 10, outputTokens: 5, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 },
    numTurns: 1,
  }),
});

export class OpenRouterProvider {
  readonly providerName = 'openrouter';
  generate = jest.fn().mockResolvedValue({
    success: true,
    sessionId: 'openrouter-session',
    totalCostUsd: 0.001,
    durationMs: 100,
    usage: { inputTokens: 10, outputTokens: 5, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 },
    numTurns: 1,
  });
  constructor(public apiKey: string) {}
}

export class GeminiProvider {
  readonly providerName = 'gemini';
  generate = jest.fn().mockResolvedValue({
    success: true,
    sessionId: 'gemini-session',
    totalCostUsd: 0,
    durationMs: 100,
    usage: { inputTokens: 10, outputTokens: 5, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 },
    numTurns: 1,
  });
  constructor(public apiKey: string) {}
}

export class OpenAIProvider {
  readonly providerName = 'openai';
  generate = jest.fn().mockResolvedValue({
    success: true,
    sessionId: 'openai-session',
    totalCostUsd: 0.001,
    durationMs: 100,
    usage: { inputTokens: 10, outputTokens: 5, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 },
    numTurns: 1,
  });
  constructor(public apiKey?: string, public baseUrl?: string) {}
}

export class ClaudeCliProvider {
  readonly providerName = 'claude-cli';
  generate = jest.fn().mockResolvedValue({
    success: true,
    sessionId: 'claude-cli-session',
    totalCostUsd: 0,
    durationMs: 100,
    usage: { inputTokens: 10, outputTokens: 5, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 },
    numTurns: 1,
  });
  constructor(public apiKey?: string) {}
}

export class GeminiCliProvider {
  readonly providerName = 'gemini-cli';
  generate = jest.fn().mockResolvedValue({
    success: true,
    sessionId: 'gemini-cli-session',
    totalCostUsd: 0,
    durationMs: 100,
    usage: { inputTokens: 10, outputTokens: 5, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 },
    numTurns: 1,
  });
  constructor(public apiKey?: string) {}
}

export class CustomCliProvider {
  readonly providerName = 'custom-cli';
  generate = jest.fn().mockResolvedValue({
    success: true,
    sessionId: 'custom-cli-session',
    totalCostUsd: 0,
    durationMs: 100,
    usage: { inputTokens: 10, outputTokens: 5, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 },
    numTurns: 1,
  });
  constructor(public opts: { command: string; args?: string[] }) {}
}
