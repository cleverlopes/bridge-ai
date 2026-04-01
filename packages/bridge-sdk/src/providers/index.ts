export type { ProviderAdapter } from '@bridge-ai/gsd-sdk';
export type { ProviderConfig, ProviderType } from './types';

export { OpenRouterProvider } from './openrouter.provider';
export { GeminiProvider } from './gemini.provider';
export { OpenAIProvider } from './openai.provider';
export { ClaudeCliProvider } from './claude-cli.provider';
export { GeminiCliProvider } from './gemini-cli.provider';
export { CustomCliProvider } from './custom-cli.provider';
export type { CustomCliConfig } from './custom-cli.provider';

// ─── Legacy stubs (kept for backwards compat) ────────────────────────────────

import type { ProviderOptions, GenerationResult } from '@bridge-ai/gsd-sdk';

abstract class BaseProviderStub {
  abstract readonly providerName: string;

  async generate(_prompt: string, _options: ProviderOptions): Promise<GenerationResult> {
    return {
      success: false,
      sessionId: '',
      totalCostUsd: 0,
      durationMs: 0,
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        cacheReadInputTokens: 0,
        cacheCreationInputTokens: 0,
      },
      numTurns: 0,
      error: {
        subtype: 'not_implemented',
        messages: [`${this.providerName} provider not yet implemented`],
      },
    };
  }
}

export class AnthropicProviderStub extends BaseProviderStub {
  readonly providerName = 'anthropic';
}

export class OpenAIProviderStub extends BaseProviderStub {
  readonly providerName = 'openai';
}

export class AzureOpenAIProviderStub extends BaseProviderStub {
  readonly providerName = 'azure-openai';
}
