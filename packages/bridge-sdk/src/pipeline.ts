/**
 * Pipeline — framework-agnostic entry point for bridge-sdk users.
 *
 * Wraps the GSD class from @bridge-ai/gsd-sdk with ObsidianTransport
 * pre-registered. Suitable for use outside NestJS (CLI, scripts, tests).
 */

import { GSD, ObsidianTransport } from '@bridge-ai/gsd-sdk';
import type { MilestoneRunnerResult, ProviderAdapter } from '@bridge-ai/gsd-sdk';

export interface PipelineConstructorOptions {
  /** Provider adapter implementing ProviderAdapter from @bridge-ai/gsd-sdk. */
  provider: ProviderAdapter;
  /** Absolute path to the Obsidian vault where logs will be written. */
  obsidianVaultPath: string;
  /** Absolute path to the workspace (project directory with .planning/). */
  workspacePath: string;
  /** Optional model override. */
  model?: string;
  /** Maximum budget in USD per execution. Default: 5.0. */
  maxBudgetUsd?: number;
  /** Maximum turns per plan session. Default: 50. */
  maxTurns?: number;
  /** Enable auto mode — skips human gates. Default: false. */
  autoMode?: boolean;
}

export class Pipeline {
  private readonly gsd: GSD;

  constructor(options: PipelineConstructorOptions) {
    this.gsd = new GSD({
      projectDir: options.workspacePath,
      adapter: options.provider,
      model: options.model,
      maxBudgetUsd: options.maxBudgetUsd,
      maxTurns: options.maxTurns,
      autoMode: options.autoMode ?? false,
    });

    this.gsd.addTransport(
      new ObsidianTransport({ vaultPath: options.obsidianVaultPath }),
    );
  }

  /**
   * Execute the full GSD lifecycle (discuss → research → plan → execute → verify)
   * for all incomplete phases in the workspace.
   */
  async execute(prompt: string): Promise<MilestoneRunnerResult> {
    return this.gsd.run(prompt);
  }

  /** Subscribe to raw GSD events (e.g. for progress logging). */
  onEvent(handler: Parameters<GSD['onEvent']>[0]): void {
    this.gsd.onEvent(handler);
  }

  /** Access the underlying GSD instance for advanced configuration. */
  get instance(): GSD {
    return this.gsd;
  }
}

// ─── Legacy compatibility exports ────────────────────────────────────────────

/** @deprecated Use PipelineConstructorOptions instead */
export interface PipelineOptions {
  projectId: string;
  planId?: string;
  providerId?: string;
  model?: string;
  correlationId?: string;
}

/** @deprecated Use MilestoneRunnerResult instead */
export interface PipelineResult {
  success: boolean;
  projectId: string;
  correlationId?: string;
  durationMs: number;
  error?: string;
}
