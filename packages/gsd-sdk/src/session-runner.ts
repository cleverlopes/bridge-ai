/**
 * Session runner — orchestrates provider calls for plan execution.
 *
 * Adapted from gsd-brain/sdk/src/session-runner.ts.
 * Key change: replaces direct `@anthropic-ai/claude-agent-sdk` query() calls
 * with ProviderAdapter injection for AI-agnostic execution.
 *
 * All logic (prompt building, model resolution, result extraction, event
 * streaming, cost tracking) is preserved exactly as in the original.
 */

import type { ParsedPlan, PlanResult, SessionOptions, SessionUsage, GSDCostUpdateEvent, PhaseStepType } from './types.js';
import { GSDEventType, PhaseType } from './types.js';
import type { GSDConfig } from './config.js';
import { buildExecutorPrompt, parseAgentTools, DEFAULT_ALLOWED_TOOLS } from './prompt-builder.js';
import type { GSDEventStream, EventStreamContext } from './event-stream.js';
import { getToolsForPhase } from './tool-scoping.js';
import type { ProviderAdapter, GenerationResult } from './provider-adapter.js';

// ─── Model resolution ────────────────────────────────────────────────────────

/**
 * Resolve model identifier from options or config profile.
 * Priority: explicit model option > config model_profile > default.
 */
function resolveModel(options?: SessionOptions, config?: GSDConfig): string | undefined {
  if (options?.model) return options.model;

  if (config?.model_profile) {
    const profileMap: Record<string, string> = {
      balanced: 'claude-sonnet-4-6',
      quality: 'claude-opus-4-6',
      speed: 'claude-haiku-3-5',
    };
    return profileMap[config.model_profile] ?? config.model_profile;
  }

  return undefined;
}

// ─── Session runner ──────────────────────────────────────────────────────────

/**
 * Run a plan execution session via the injected ProviderAdapter.
 *
 * Builds the executor prompt, configures generation options, then
 * calls adapter.generate() and emits events from the result.
 *
 * @param plan - Parsed plan structure
 * @param config - GSD project configuration
 * @param adapter - AI provider adapter (injected — no direct SDK imports)
 * @param options - Session overrides
 * @param agentDef - Raw agent definition content (optional)
 * @param eventStream - Optional event stream for observability
 * @param streamContext - Optional context for event tagging
 */
export async function runPlanSession(
  plan: ParsedPlan,
  config: GSDConfig,
  adapter: ProviderAdapter,
  options?: SessionOptions,
  agentDef?: string,
  eventStream?: GSDEventStream,
  streamContext?: EventStreamContext,
): Promise<PlanResult> {
  const executorPrompt = buildExecutorPrompt(plan, agentDef);

  const allowedTools = options?.allowedTools ??
    (agentDef ? parseAgentTools(agentDef) : DEFAULT_ALLOWED_TOOLS);

  const model = resolveModel(options, config);
  const maxTurns = options?.maxTurns ?? 50;
  const maxBudgetUsd = options?.maxBudgetUsd ?? 5.0;
  const cwd = options?.cwd ?? process.cwd();

  const result = await adapter.generate(
    `Execute this plan:\n\n${plan.objective || 'Execute the plan tasks below.'}`,
    {
      systemPromptAppend: executorPrompt,
      allowedTools,
      bypassPermissions: true,
      maxTurns,
      maxBudgetUsd,
      cwd,
      ...(model ? { model } : {}),
    },
  );

  return processGenerationResult(result, eventStream, streamContext);
}

// ─── Result processing ───────────────────────────────────────────────────────

function emptyUsage(): SessionUsage {
  return {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadInputTokens: 0,
    cacheCreationInputTokens: 0,
  };
}

/**
 * Map a GenerationResult to PlanResult and emit events.
 */
function processGenerationResult(
  result: GenerationResult,
  eventStream?: GSDEventStream,
  streamContext?: EventStreamContext,
): PlanResult {
  const planResult: PlanResult = result.success
    ? {
        success: true,
        sessionId: result.sessionId,
        totalCostUsd: result.totalCostUsd,
        durationMs: result.durationMs,
        usage: result.usage,
        numTurns: result.numTurns,
      }
    : {
        success: false,
        sessionId: result.sessionId,
        totalCostUsd: result.totalCostUsd,
        durationMs: result.durationMs,
        usage: result.usage ?? emptyUsage(),
        numTurns: result.numTurns,
        error: result.error,
      };

  if (eventStream) {
    const cost = eventStream.getCost();
    eventStream.emitEvent({
      type: GSDEventType.CostUpdate,
      timestamp: new Date().toISOString(),
      sessionId: result.sessionId,
      phase: streamContext?.phase,
      planName: streamContext?.planName,
      sessionCostUsd: planResult.totalCostUsd,
      cumulativeCostUsd: cost.cumulative,
    } as GSDCostUpdateEvent);
  }

  return planResult;
}

// ─── Phase step session runner ───────────────────────────────────────────────

/**
 * Map PhaseStepType to PhaseType for tool scoping.
 */
function stepTypeToPhaseType(step: PhaseStepType): PhaseType {
  const mapping: Record<string, PhaseType> = {
    discuss: PhaseType.Discuss,
    research: PhaseType.Research,
    plan: PhaseType.Plan,
    plan_check: PhaseType.Verify,
    execute: PhaseType.Execute,
    verify: PhaseType.Verify,
  };
  return mapping[step] ?? PhaseType.Execute;
}

/**
 * Run a phase step session via the injected ProviderAdapter.
 *
 * Unlike runPlanSession which takes a ParsedPlan, this accepts a raw prompt
 * string and a phase step type. Tools are scoped by phase type.
 *
 * @param prompt - Raw prompt string
 * @param phaseStep - Phase step type (determines tool scoping)
 * @param config - GSD project configuration
 * @param adapter - AI provider adapter
 * @param options - Session overrides
 * @param eventStream - Optional event stream
 * @param streamContext - Optional event context
 */
export async function runPhaseStepSession(
  prompt: string,
  phaseStep: PhaseStepType,
  config: GSDConfig,
  adapter: ProviderAdapter,
  options?: SessionOptions,
  eventStream?: GSDEventStream,
  streamContext?: EventStreamContext,
): Promise<PlanResult> {
  const phaseType = stepTypeToPhaseType(phaseStep);
  const allowedTools = options?.allowedTools ?? getToolsForPhase(phaseType);
  const model = resolveModel(options, config);
  const maxTurns = options?.maxTurns ?? 50;
  const maxBudgetUsd = options?.maxBudgetUsd ?? 5.0;
  const cwd = options?.cwd ?? process.cwd();

  const result = await adapter.generate(prompt, {
    systemPromptAppend: prompt,
    allowedTools,
    bypassPermissions: true,
    maxTurns,
    maxBudgetUsd,
    cwd,
    ...(model ? { model } : {}),
  });

  return processGenerationResult(result, eventStream, streamContext);
}
