import type {
  ProviderAdapter,
  ProviderOptions,
  GenerationResult,
} from '@bridge-ai/gsd-sdk';
import { randomUUID } from 'crypto';

const DEFAULT_MODEL = 'gpt-4o';
const DEFAULT_BASE_URL = 'https://api.openai.com/v1';

interface OpenAIChoice {
  message: { role: string; content: string };
  finish_reason: string;
}

interface OpenAIUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

interface OpenAIResponse {
  id: string;
  choices: OpenAIChoice[];
  usage?: OpenAIUsage;
  error?: { message: string; type: string };
}

export class OpenAIProvider implements ProviderAdapter {
  readonly providerName = 'openai';

  constructor(
    private readonly apiKey: string,
    private readonly baseUrl: string = DEFAULT_BASE_URL,
  ) {}

  async generate(prompt: string, options: ProviderOptions): Promise<GenerationResult> {
    const start = Date.now();
    const model = options.model ?? DEFAULT_MODEL;
    const url = `${this.baseUrl.replace(/\/$/, '')}/chat/completions`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
    } catch (err) {
      return this.errorResult(Date.now() - start, 'network_error', [
        err instanceof Error ? err.message : 'Network error',
      ]);
    }

    let body: OpenAIResponse;
    try {
      body = (await response.json()) as OpenAIResponse;
    } catch {
      return this.errorResult(Date.now() - start, 'parse_error', ['Failed to parse response JSON']);
    }

    if (!response.ok || body.error) {
      return this.errorResult(Date.now() - start, 'provider_error', [
        body.error?.message ?? `HTTP ${response.status}`,
      ]);
    }

    return {
      success: true,
      sessionId: body.id ?? randomUUID(),
      totalCostUsd: 0,
      durationMs: Date.now() - start,
      usage: {
        inputTokens: body.usage?.prompt_tokens ?? 0,
        outputTokens: body.usage?.completion_tokens ?? 0,
        cacheReadInputTokens: 0,
        cacheCreationInputTokens: 0,
      },
      numTurns: 1,
    };
  }

  private errorResult(
    durationMs: number,
    subtype: string,
    messages: string[],
  ): GenerationResult {
    return {
      success: false,
      sessionId: randomUUID(),
      totalCostUsd: 0,
      durationMs,
      usage: { inputTokens: 0, outputTokens: 0, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 },
      numTurns: 0,
      error: { subtype, messages },
    };
  }
}
