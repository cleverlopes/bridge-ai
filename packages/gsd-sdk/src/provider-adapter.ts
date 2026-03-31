/**
 * Provider adapter interface — AI-agnostic abstraction over LLM providers.
 *
 * Implementations wrap specific providers (Anthropic, OpenAI, Azure, etc.)
 * and expose a uniform generate() API to the session runner.
 */

// ─── Options & results ───────────────────────────────────────────────────────

export interface ProviderOptions {
  /** Model identifier (provider-specific, e.g. 'claude-sonnet-4-6'). */
  model?: string;
  /** Maximum number of agentic turns before stopping. Default: 50. */
  maxTurns?: number;
  /** Maximum budget in USD. Default: 5.0. */
  maxBudgetUsd?: number;
  /** Working directory for tool execution. */
  cwd?: string;
  /** Allowed tool names. */
  allowedTools?: string[];
  /** System prompt to append. */
  systemPromptAppend?: string;
  /** Whether to bypass permission checks (for autonomous execution). */
  bypassPermissions?: boolean;
}

export interface GenerationUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
}

export interface GenerationResult {
  /** Whether the generation completed successfully. */
  success: boolean;
  /** Provider-specific session/run ID for audit trail. */
  sessionId: string;
  /** Total cost in USD (0 if provider doesn't track cost). */
  totalCostUsd: number;
  /** Wall-clock duration in milliseconds. */
  durationMs: number;
  /** Token usage breakdown. */
  usage: GenerationUsage;
  /** Number of agentic turns used. */
  numTurns: number;
  /** Error details when success is false. */
  error?: {
    subtype: string;
    messages: string[];
  };
}

// ─── Provider adapter interface ──────────────────────────────────────────────

/**
 * AI provider adapter.
 *
 * Implementations must be injected into SessionRunner. The adapter is
 * responsible for translating provider-specific responses back to
 * the canonical GenerationResult shape.
 */
export interface ProviderAdapter {
  /**
   * Execute a prompt using this provider.
   *
   * @param prompt - The user/executor prompt to run
   * @param options - Generation configuration
   * @returns Canonical GenerationResult
   */
  generate(prompt: string, options: ProviderOptions): Promise<GenerationResult>;

  /** Human-readable provider name (e.g. 'anthropic', 'openai'). */
  readonly providerName: string;
}
