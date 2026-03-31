/**
 * Pipeline — stub for the bridge-ai execution pipeline.
 *
 * This stub defines the Pipeline interface that will be implemented
 * in Phase 2 when channels and AI calls are wired.
 */

export interface PipelineOptions {
  projectId: string;
  planId?: string;
  providerId?: string;
  model?: string;
  correlationId?: string;
}

export interface PipelineResult {
  success: boolean;
  projectId: string;
  correlationId?: string;
  durationMs: number;
  error?: string;
}

/**
 * Pipeline stub — Phase 2 will implement the full execution pipeline.
 * Currently serves as the interface contract for future implementation.
 */
export class Pipeline {
  private readonly options: PipelineOptions;

  constructor(options: PipelineOptions) {
    this.options = options;
  }

  get projectId(): string {
    return this.options.projectId;
  }

  get correlationId(): string | undefined {
    return this.options.correlationId;
  }

  /**
   * Execute the pipeline. Stub implementation — will be completed in Phase 2.
   */
  async execute(_input: Record<string, unknown>): Promise<PipelineResult> {
    return {
      success: false,
      projectId: this.options.projectId,
      correlationId: this.options.correlationId,
      durationMs: 0,
      error: 'Pipeline not yet implemented (Phase 2)',
    };
  }
}
