import type {
  ProviderAdapter,
  ProviderOptions,
  GenerationResult,
} from '@bridge-ai/gsd-sdk';
import { randomUUID } from 'crypto';

const DEFAULT_MODEL = 'gemini-2.0-flash';
const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

interface GeminiPart {
  text: string;
}

interface GeminiCandidate {
  content: { parts: GeminiPart[] };
  finishReason: string;
}

interface GeminiUsage {
  promptTokenCount: number;
  candidatesTokenCount: number;
  totalTokenCount: number;
}

interface GeminiResponse {
  candidates?: GeminiCandidate[];
  usageMetadata?: GeminiUsage;
  error?: { code: number; message: string };
}

export class GeminiProvider implements ProviderAdapter {
  readonly providerName = 'gemini';

  constructor(private readonly apiKey: string) {}

  async generate(prompt: string, options: ProviderOptions): Promise<GenerationResult> {
    const start = Date.now();
    const model = options.model ?? DEFAULT_MODEL;
    const url = `${BASE_URL}/${model}:generateContent?key=${this.apiKey}`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
        }),
      });
    } catch (err) {
      return this.errorResult(Date.now() - start, 'network_error', [
        err instanceof Error ? err.message : 'Network error',
      ]);
    }

    let body: GeminiResponse;
    try {
      body = (await response.json()) as GeminiResponse;
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
      sessionId: randomUUID(),
      totalCostUsd: 0,
      durationMs: Date.now() - start,
      usage: {
        inputTokens: body.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: body.usageMetadata?.candidatesTokenCount ?? 0,
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
