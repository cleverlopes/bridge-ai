/**
 * Provider stubs — concrete ProviderAdapter implementations.
 *
 * Full implementations will be added in Phase 2. These stubs
 * satisfy the ProviderAdapter interface for DI configuration.
 */

import type { ProviderAdapter, ProviderOptions, GenerationResult } from '@bridge-ai/gsd-sdk';

// ─── Base stub ────────────────────────────────────────────────────────────────

abstract class BaseProviderStub implements ProviderAdapter {
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
        messages: [`${this.providerName} provider not yet implemented (Phase 2)`],
      },
    };
  }
}

// ─── Provider stubs ──────────────────────────────────────────────────────────

export class AnthropicProviderStub extends BaseProviderStub {
  readonly providerName = 'anthropic';
}

export class OpenAIProviderStub extends BaseProviderStub {
  readonly providerName = 'openai';
}

export class AzureOpenAIProviderStub extends BaseProviderStub {
  readonly providerName = 'azure-openai';
}

export { type ProviderAdapter } from '@bridge-ai/gsd-sdk';
