// Manual Jest mock for @bridge-ai/bridge-sdk

// This file is used in test contexts, but is included in the library TS build.
// Declare `jest` to keep the build type-safe without requiring Jest globals.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const jest: { fn: (...args: unknown[]) => any };

export interface ProviderConfig {
  type: 'openrouter' | 'gemini' | 'openai' | 'claude-cli' | 'gemini-cli' | 'custom-cli';
  apiKey?: string;
  baseUrl?: string;
  command?: string;
  args?: string[];
}

let failNextGenerations = 0;

/** Test helper: next N calls to any mocked provider `generate` return failure. */
export function __bridgeSdk_setFailNextGenerations(n: number): void {
  failNextGenerations = n;
}

export function __bridgeSdk_resetGenerateState(): void {
  failNextGenerations = 0;
}

const failResult = {
  success: false,
  sessionId: '',
  totalCostUsd: 0,
  durationMs: 0,
  usage: { inputTokens: 0, outputTokens: 0, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 },
  numTurns: 0,
  error: { subtype: 'mock_fail', messages: ['mock failure'] },
};

const okResult = {
  success: true,
  sessionId: 'mock-session',
  totalCostUsd: 0.001,
  durationMs: 100,
  usage: { inputTokens: 10, outputTokens: 5, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 },
  numTurns: 1,
};

const sharedGenerate = jest.fn().mockImplementation(async () => {
  if (failNextGenerations > 0) {
    failNextGenerations--;
    return { ...failResult };
  }
  return { ...okResult };
});

export class OpenRouterProvider {
  readonly providerName = 'openrouter';
  generate = sharedGenerate;
  constructor(public apiKey: string) {}
}

export class GeminiProvider {
  readonly providerName = 'gemini';
  generate = sharedGenerate;
  constructor(public apiKey: string) {}
}

export class OpenAIProvider {
  readonly providerName = 'openai';
  generate = sharedGenerate;
  constructor(public apiKey?: string, public baseUrl?: string) {}
}

export class ClaudeCliProvider {
  readonly providerName = 'claude-cli';
  generate = sharedGenerate;
  constructor(public apiKey?: string) {}
}

export class GeminiCliProvider {
  readonly providerName = 'gemini-cli';
  generate = sharedGenerate;
  constructor(public apiKey?: string) {}
}

export class CustomCliProvider {
  readonly providerName = 'custom-cli';
  generate = sharedGenerate;
  constructor(public opts: { command: string; args?: string[] }) {}
}
