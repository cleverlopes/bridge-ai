import { Injectable, Logger } from '@nestjs/common';
import type { ProviderAdapter, ProviderOptions, GenerationResult } from '@bridge-ai/gsd-sdk';
import {
  OpenRouterProvider,
  GeminiProvider,
  OpenAIProvider,
  ClaudeCliProvider,
  GeminiCliProvider,
  CustomCliProvider,
  type ProviderConfig,
} from '@bridge-ai/bridge-sdk';
import { KsmService } from '../ksm/ksm.service';
import { EventsService, QUEUE_WORKFLOW_EVENTS } from '../events/events.service';

const PROVIDER_CONFIG_KEY_PREFIX = 'provider:config:';

export interface BrainGenerateOptions extends ProviderOptions {
  projectId?: string;
}

@Injectable()
export class BrainService implements ProviderAdapter {
  readonly providerName = 'brain';
  private readonly logger = new Logger(BrainService.name);

  constructor(
    private readonly ksm: KsmService,
    private readonly events: EventsService,
  ) {}

  async generate(
    prompt: string,
    options: BrainGenerateOptions,
  ): Promise<GenerationResult> {
    const projectId = options.projectId;
    const start = Date.now();

    const provider = await this.resolveProvider(projectId);
    const result = await provider.generate(prompt, options);

    await this.emitCostUpdate(result, provider.providerName, projectId);

    this.logger.debug(
      `generate() via ${provider.providerName} | ` +
        `cost=$${result.totalCostUsd.toFixed(6)} | ` +
        `tokens=${result.usage.inputTokens}in/${result.usage.outputTokens}out | ` +
        `duration=${Date.now() - start}ms`,
    );

    return result;
  }

  async setProjectProvider(projectId: string, config: ProviderConfig): Promise<void> {
    const key = `${PROVIDER_CONFIG_KEY_PREFIX}${projectId}`;
    const serialized = JSON.stringify(config);

    try {
      await this.ksm.rotateSecret(key, serialized, 'project', projectId);
    } catch {
      await this.ksm.createSecret(key, serialized, 'project', projectId);
    }
    this.logger.log(`Provider config saved for project ${projectId}: type=${config.type}`);
  }

  async checkProvider(projectId?: string): Promise<{ healthy: boolean; provider: string; error?: string }> {
    const provider = await this.resolveProvider(projectId);
    const result = await provider.generate('Reply with exactly: ok', { maxTurns: 1 });
    return {
      healthy: result.success,
      provider: provider.providerName,
      error: result.error?.messages.join('; '),
    };
  }

  private async resolveProvider(projectId?: string): Promise<ProviderAdapter> {
    if (projectId) {
      try {
        const key = `${PROVIDER_CONFIG_KEY_PREFIX}${projectId}`;
        const raw = await this.ksm.getSecret(key, 'project', projectId, 'BrainService', projectId);
        const config = JSON.parse(raw) as ProviderConfig;
        return this.buildProvider(config);
      } catch {
        this.logger.debug(`No project provider config for ${projectId}, using fallback chain`);
      }
    }

    return this.buildFallbackProvider();
  }

  private buildProvider(config: ProviderConfig): ProviderAdapter {
    switch (config.type) {
      case 'openrouter':
        if (!config.apiKey) throw new Error('OpenRouter provider requires apiKey');
        return new OpenRouterProvider(config.apiKey);
      case 'gemini':
        if (!config.apiKey) throw new Error('Gemini provider requires apiKey');
        return new GeminiProvider(config.apiKey);
      case 'openai':
        if (!config.apiKey) throw new Error('OpenAI provider requires apiKey');
        return new OpenAIProvider(config.apiKey, config.baseUrl);
      case 'claude-cli':
        return new ClaudeCliProvider(config.apiKey);
      case 'gemini-cli':
        return new GeminiCliProvider(config.apiKey);
      case 'custom-cli':
        if (!config.command) throw new Error('custom-cli provider requires command');
        return new CustomCliProvider({ command: config.command, args: config.args });
    }
  }

  private buildFallbackProvider(): ProviderAdapter {
    const openrouterKey = process.env['OPENROUTER_API_KEY'];
    if (openrouterKey) return new OpenRouterProvider(openrouterKey);

    const geminiKey = process.env['GEMINI_API_KEY'];
    if (geminiKey) return new GeminiProvider(geminiKey);

    const openaiKey = process.env['OPENAI_API_KEY'];
    if (openaiKey) return new OpenAIProvider(openaiKey);

    return new ClaudeCliProvider(process.env['ANTHROPIC_API_KEY']);
  }

  async generateWithFallback(prompt: string, options: ProviderOptions): Promise<GenerationResult> {
    const chain: ProviderAdapter[] = [
      ...(process.env['OPENROUTER_API_KEY']
        ? [new OpenRouterProvider(process.env['OPENROUTER_API_KEY'])]
        : []),
      ...(process.env['GEMINI_API_KEY']
        ? [new GeminiProvider(process.env['GEMINI_API_KEY'])]
        : []),
      ...(process.env['OPENAI_API_KEY']
        ? [new OpenAIProvider(process.env['OPENAI_API_KEY'])]
        : []),
      new ClaudeCliProvider(process.env['ANTHROPIC_API_KEY']),
    ];

    for (const provider of chain) {
      const result = await provider.generate(prompt, options);
      if (result.success) {
        await this.emitCostUpdate(result, provider.providerName, undefined);
        return result;
      }
      this.logger.warn(`Provider ${provider.providerName} failed, trying next in chain`);
    }

    return {
      success: false,
      sessionId: '',
      totalCostUsd: 0,
      durationMs: 0,
      usage: { inputTokens: 0, outputTokens: 0, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 },
      numTurns: 0,
      error: { subtype: 'all_providers_failed', messages: ['All providers in fallback chain failed'] },
    };
  }

  private async emitCostUpdate(
    result: GenerationResult,
    providerName: string,
    projectId?: string,
  ): Promise<void> {
    try {
      await this.events.publish({
        type: 'cost.update',
        channel: QUEUE_WORKFLOW_EVENTS,
        payload: {
          provider: providerName,
          projectId: projectId ?? null,
          totalCostUsd: result.totalCostUsd,
          inputTokens: result.usage.inputTokens,
          outputTokens: result.usage.outputTokens,
          sessionId: result.sessionId,
          durationMs: result.durationMs,
        },
      });
    } catch (err) {
      this.logger.warn(`Failed to emit cost.update event: ${err instanceof Error ? err.message : err}`);
    }
  }
}
