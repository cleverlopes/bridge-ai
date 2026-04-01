import type {
  ProviderAdapter,
  ProviderOptions,
  GenerationResult,
} from '@bridge-ai/gsd-sdk';
import { randomUUID } from 'crypto';

const DEFAULT_MODEL = 'anthropic/claude-sonnet-4-6';
const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

interface OpenRouterChoice {
  message: { content: string };
  finish_reason: string;
}

interface OpenRouterUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

interface OpenRouterResponse {
  id: string;
  choices: OpenRouterChoice[];
  usage?: OpenRouterUsage;
}

export class OpenRouterProvider implements ProviderAdapter {
  readonly providerName = 'openrouter';

  constructor(private readonly apiKey: string) {}

  async generate(prompt: string, options: ProviderOptions): Promise<GenerationResult> {
    const start = Date.now();
    const model = options.model ?? DEFAULT_MODEL;

    let response: Response;
    try {
      response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://bridge-ai.dev',
          'X-Title': 'bridge-ai',
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          stream: false,
        }),
      });
    } catch (err) {
      return this.errorResult(Date.now() - start, 'network_error', [
        err instanceof Error ? err.message : 'Network error',
      ]);
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      return this.errorResult(Date.now() - start, 'provider_error', [
        `HTTP ${response.status}: ${text.slice(0, 200)}`,
      ]);
    }

    let body: OpenRouterResponse;
    try {
      body = (await response.json()) as OpenRouterResponse;
    } catch {
      return this.errorResult(Date.now() - start, 'parse_error', ['Failed to parse response JSON']);
    }

    const generationCostHeader = response.headers.get('x-openrouter-generation-cost');
    const totalCostUsd = generationCostHeader ? parseFloat(generationCostHeader) : 0;

    return {
      success: true,
      sessionId: body.id ?? randomUUID(),
      totalCostUsd: isNaN(totalCostUsd) ? 0 : totalCostUsd,
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
