// Manual Jest mock for @bridge-ai/gsd-sdk
// Used by nest-core tests to avoid ESM-only imports (import.meta.url)

export interface ProviderOptions {
  model?: string;
  maxTurns?: number;
  maxBudgetUsd?: number;
  cwd?: string;
  allowedTools?: string[];
  systemPromptAppend?: string;
  bypassPermissions?: boolean;
}

export interface GenerationUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
}

export interface GenerationResult {
  success: boolean;
  sessionId: string;
  totalCostUsd: number;
  durationMs: number;
  usage: GenerationUsage;
  numTurns: number;
  error?: { subtype: string; messages: string[] };
}

export interface ProviderAdapter {
  generate(prompt: string, options: ProviderOptions): Promise<GenerationResult>;
  readonly providerName: string;
}

export interface GSDPhaseCompleteEvent {
  type: string;
  timestamp: string;
  sessionId: string;
  phaseNumber: string;
  phaseName: string;
  totalCostUsd: number;
  totalDurationMs: number;
  stepsCompleted: number;
  success: boolean;
  phase?: string;
  planName?: string;
}

export const GSDEventType = {
  SessionInit: 'session_init',
  SessionComplete: 'session_complete',
  SessionError: 'session_error',
  AssistantText: 'assistant_text',
  ToolCall: 'tool_call',
  ToolProgress: 'tool_progress',
  ToolUseSummary: 'tool_use_summary',
  TaskStarted: 'task_started',
  TaskProgress: 'task_progress',
  TaskNotification: 'task_notification',
  CostUpdate: 'cost_update',
  APIRetry: 'api_retry',
  RateLimit: 'rate_limit',
  StatusChange: 'status_change',
  CompactBoundary: 'compact_boundary',
  StreamEvent: 'stream_event',
  PhaseStart: 'phase_start',
  PhaseComplete: 'phase_complete',
};

export class GSD {
  constructor(public readonly opts: Record<string, unknown>) {}
  run = jest.fn().mockResolvedValue({ success: true, totalCostUsd: 0, durationMs: 0, phasesCompleted: 0 });
  onEvent = jest.fn();
  addTransport = jest.fn();
}

export class ObsidianTransport {
  constructor(public readonly opts: Record<string, unknown>) {}
  onEvent = jest.fn();
  close = jest.fn();
}

export class GSDEventStream {
  emitEvent = jest.fn();
  addTransport = jest.fn();
  removeTransport = jest.fn();
  closeAll = jest.fn();
  getCost = jest.fn().mockReturnValue({ session: 0, cumulative: 0 });
  on = jest.fn();
  emit = jest.fn();
}
