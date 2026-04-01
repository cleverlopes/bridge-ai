import type {
  ProviderAdapter,
  ProviderOptions,
  GenerationResult,
} from '@bridge-ai/gsd-sdk';
import { spawn } from 'child_process';
import { randomUUID } from 'crypto';

export class ClaudeCliProvider implements ProviderAdapter {
  readonly providerName = 'claude-cli';

  constructor(private readonly apiKey?: string) {}

  async generate(prompt: string, _options: ProviderOptions): Promise<GenerationResult> {
    const start = Date.now();

    const env: NodeJS.ProcessEnv = { ...process.env };
    if (this.apiKey) {
      env['ANTHROPIC_API_KEY'] = this.apiKey;
    }

    return new Promise<GenerationResult>((resolve) => {
      const chunks: Buffer[] = [];
      const errChunks: Buffer[] = [];

      const child = spawn('claude', ['-p', prompt], {
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      child.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
      child.stderr.on('data', (chunk: Buffer) => errChunks.push(chunk));

      child.on('error', (err) => {
        resolve(this.errorResult(Date.now() - start, 'spawn_error', [err.message]));
      });

      child.on('close', (code) => {
        if (code !== 0) {
          const stderr = Buffer.concat(errChunks).toString('utf8');
          resolve(
            this.errorResult(Date.now() - start, 'exit_error', [
              `claude exited with code ${code}`,
              stderr.slice(0, 500),
            ]),
          );
          return;
        }

        const output = Buffer.concat(chunks).toString('utf8');
        resolve({
          success: true,
          sessionId: randomUUID(),
          totalCostUsd: 0,
          durationMs: Date.now() - start,
          usage: { inputTokens: 0, outputTokens: 0, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 },
          numTurns: 1,
          ...(output.trim() ? {} : {}),
        });
      });
    });
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
