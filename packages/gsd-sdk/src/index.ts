/**
 * @bridge-ai/gsd-sdk — AI-agnostic pipeline engine.
 *
 * Adapted from gsd-brain/sdk. Key difference: all session runners accept a
 * ProviderAdapter injection instead of importing @anthropic-ai/claude-agent-sdk
 * directly, enabling use with any LLM provider.
 */

import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';

import type {
  GSDOptions,
  PlanResult,
  SessionOptions,
  GSDEvent,
  TransportHandler,
  PhaseRunnerOptions,
  PhaseRunnerResult,
  MilestoneRunnerOptions,
  MilestoneRunnerResult,
  RoadmapPhaseInfo,
} from './types.js';
import { GSDEventType } from './types.js';
import { parsePlanFile } from './plan-parser.js';
import { loadConfig } from './config.js';
import { GSDTools, resolveGsdToolsPath } from './gsd-tools.js';
import { runPlanSession } from './session-runner.js';
import { GSDEventStream } from './event-stream.js';
import { PhaseRunner } from './phase-runner.js';
import { ContextEngine } from './context-engine.js';
import { PromptFactory } from './phase-prompt.js';
import type { ProviderAdapter } from './provider-adapter.js';

// ─── GSD class ───────────────────────────────────────────────────────────────

export class GSD {
  private readonly projectDir: string;
  private readonly gsdToolsPath: string;
  private readonly defaultModel?: string;
  private readonly defaultMaxBudgetUsd: number;
  private readonly defaultMaxTurns: number;
  private readonly autoMode: boolean;
  private readonly adapter: ProviderAdapter;
  readonly eventStream: GSDEventStream;

  constructor(options: GSDOptions & { adapter: ProviderAdapter }) {
    this.projectDir = resolve(options.projectDir);
    this.gsdToolsPath = options.gsdToolsPath ?? resolveGsdToolsPath(this.projectDir);
    this.defaultModel = options.model;
    this.defaultMaxBudgetUsd = options.maxBudgetUsd ?? 5.0;
    this.defaultMaxTurns = options.maxTurns ?? 50;
    this.autoMode = options.autoMode ?? false;
    this.adapter = options.adapter;
    this.eventStream = new GSDEventStream();
  }

  async executePlan(planPath: string, options?: SessionOptions): Promise<PlanResult> {
    const absolutePlanPath = resolve(this.projectDir, planPath);
    const plan = await parsePlanFile(absolutePlanPath);
    const config = await loadConfig(this.projectDir);
    const agentDef = await this.loadAgentDefinition();

    const sessionOptions: SessionOptions = {
      maxTurns: options?.maxTurns ?? this.defaultMaxTurns,
      maxBudgetUsd: options?.maxBudgetUsd ?? this.defaultMaxBudgetUsd,
      model: options?.model ?? this.defaultModel,
      cwd: options?.cwd ?? this.projectDir,
      allowedTools: options?.allowedTools,
    };

    return runPlanSession(plan, config, this.adapter, sessionOptions, agentDef, this.eventStream, {
      phase: undefined,
      planName: plan.frontmatter.plan,
    });
  }

  onEvent(handler: (event: GSDEvent) => void): void {
    this.eventStream.on('event', handler);
  }

  addTransport(handler: TransportHandler): void {
    this.eventStream.addTransport(handler);
  }

  createTools(): GSDTools {
    return new GSDTools({
      projectDir: this.projectDir,
      gsdToolsPath: this.gsdToolsPath,
    });
  }

  async runPhase(phaseNumber: string, options?: PhaseRunnerOptions): Promise<PhaseRunnerResult> {
    const tools = this.createTools();
    const promptFactory = new PromptFactory();
    const contextEngine = new ContextEngine(this.projectDir);
    const config = await loadConfig(this.projectDir);

    if (this.autoMode) {
      config.workflow.auto_advance = true;
      config.workflow.skip_discuss = false;
    }

    const runner = new PhaseRunner({
      projectDir: this.projectDir,
      tools,
      promptFactory,
      contextEngine,
      eventStream: this.eventStream,
      config,
      adapter: this.adapter,
    });

    return runner.run(phaseNumber, options);
  }

  async run(prompt: string, options?: MilestoneRunnerOptions): Promise<MilestoneRunnerResult> {
    const tools = this.createTools();
    const startTime = Date.now();
    const phaseResults: PhaseRunnerResult[] = [];
    let success = true;

    const initialAnalysis = await tools.roadmapAnalyze();
    const incompletePhases = this.filterAndSortPhases(initialAnalysis.phases);

    this.eventStream.emitEvent({
      type: GSDEventType.MilestoneStart,
      timestamp: new Date().toISOString(),
      sessionId: `milestone-${Date.now()}`,
      phaseCount: incompletePhases.length,
      prompt,
    });

    let currentPhases = incompletePhases;

    while (currentPhases.length > 0) {
      const phase = currentPhases[0];

      try {
        const result = await this.runPhase(phase.number, options);
        phaseResults.push(result);

        if (!result.success) {
          success = false;
          break;
        }

        if (options?.onPhaseComplete) {
          const verdict = await options.onPhaseComplete(result, phase);
          if (verdict === 'stop') break;
        }

        const updatedAnalysis = await tools.roadmapAnalyze();
        currentPhases = this.filterAndSortPhases(updatedAnalysis.phases);
      } catch (_err) {
        phaseResults.push({
          phaseNumber: phase.number,
          phaseName: phase.phase_name,
          steps: [],
          success: false,
          totalCostUsd: 0,
          totalDurationMs: 0,
        });
        success = false;
        break;
      }
    }

    const totalCostUsd = phaseResults.reduce((sum, r) => sum + r.totalCostUsd, 0);
    const totalDurationMs = Date.now() - startTime;

    this.eventStream.emitEvent({
      type: GSDEventType.MilestoneComplete,
      timestamp: new Date().toISOString(),
      sessionId: `milestone-${Date.now()}`,
      success,
      totalCostUsd,
      totalDurationMs,
      phasesCompleted: phaseResults.filter(r => r.success).length,
    });

    return { success, phases: phaseResults, totalCostUsd, totalDurationMs };
  }

  private filterAndSortPhases(phases: RoadmapPhaseInfo[]): RoadmapPhaseInfo[] {
    return phases
      .filter(p => !p.roadmap_complete)
      .sort((a, b) => parseFloat(a.number) - parseFloat(b.number));
  }

  private async loadAgentDefinition(): Promise<string | undefined> {
    const paths = [
      join(this.projectDir, '.claude', 'get-shit-done', 'agents', 'gsd-executor.md'),
      join(this.projectDir, '.claude', 'agents', 'gsd-executor.md'),
      join(homedir(), '.claude', 'agents', 'gsd-executor.md'),
      join(this.projectDir, 'agents', 'gsd-executor.md'),
    ];

    for (const p of paths) {
      try {
        return await readFile(p, 'utf-8');
      } catch {
        // Not found at this path
      }
    }
    return undefined;
  }
}

// ─── Re-exports ──────────────────────────────────────────────────────────────

export { parsePlan, parsePlanFile } from './plan-parser.js';
export { loadConfig } from './config.js';
export type { GSDConfig } from './config.js';
export { GSDTools, GSDToolsError, resolveGsdToolsPath } from './gsd-tools.js';
export { runPlanSession, runPhaseStepSession } from './session-runner.js';
export { buildExecutorPrompt, parseAgentTools } from './prompt-builder.js';
export * from './types.js';

export { GSDEventStream } from './event-stream.js';
export type { EventStreamContext } from './event-stream.js';
export { ContextEngine, PHASE_FILE_MANIFEST } from './context-engine.js';
export type { FileSpec } from './context-engine.js';
export { getToolsForPhase, PHASE_AGENT_MAP, PHASE_DEFAULT_TOOLS } from './tool-scoping.js';
export { PromptFactory, extractBlock, extractSteps, PHASE_WORKFLOW_MAP } from './phase-prompt.js';
export { GSDLogger } from './logger.js';
export type { LogLevel, LogEntry, GSDLoggerOptions } from './logger.js';

export { PhaseRunner, PhaseRunnerError } from './phase-runner.js';
export type { PhaseRunnerDeps, VerificationOutcome } from './phase-runner.js';

export { CLITransport } from './cli-transport.js';
export { WSTransport } from './ws-transport.js';
export type { WSTransportOptions } from './ws-transport.js';

export { InitRunner } from './init-runner.js';
export type { InitRunnerDeps } from './init-runner.js';
export type { InitConfig, InitResult, InitStepResult, InitStepName } from './types.js';

export type { ProviderAdapter, ProviderOptions, GenerationResult, GenerationUsage } from './provider-adapter.js';

export { ObsidianTransport } from './obsidian-transport.js';
export type { ObsidianTransportOptions } from './obsidian-transport.js';

export { PostgresTransport } from './postgres-transport.js';
export type { PostgresTransportOptions } from './postgres-transport.js';
