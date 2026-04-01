import type {
  ProviderAdapter,
  ProviderOptions,
  GenerationResult,
} from '@bridge-ai/gsd-sdk';
import { spawn } from 'child_process';
import { randomUUID } from 'crypto';

export interface CustomCliConfig {
  command: string;
  args?: string[];
  promptFlag?: string;
}

export class CustomCliProvider implements ProviderAdapter {
  readonly providerName = 'custom-cli';

  constructor(private readonly config: CustomCliConfig) {}

  async generate(prompt: string, _options: ProviderOptions): Promise<GenerationResult> {
    const start = Date.now();
    const { command, args = [], promptFlag = '-p' } = this.config;

    return new Promise<GenerationResult>((resolve) => {
      const chunks: Buffer[] = [];
      const errChunks: Buffer[] = [];

      const child = spawn(command, [...args, promptFlag, prompt], {
        env: process.env,
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
              `${command} exited with code ${code}`,
              stderr.slice(0, 500),
            ]),
          );
          return;
        }

        resolve({
          success: true,
          sessionId: randomUUID(),
          totalCostUsd: 0,
          durationMs: Date.now() - start,
          usage: { inputTokens: 0, outputTokens: 0, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 },
          numTurns: 1,
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
