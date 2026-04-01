/**
 * Obsidian Transport — writes pipeline events to vault files.
 *
 * Implements TransportHandler to persist GSD events as markdown notes
 * in an Obsidian vault directory. Each session gets its own daily log file.
 */

import { appendFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { GSDEventType, type GSDEvent, type TransportHandler } from './types.js';

// ─── ObsidianTransport ───────────────────────────────────────────────────────

export interface ObsidianTransportOptions {
  /** Path to the Obsidian vault directory where logs will be written. */
  vaultPath: string;
  /** Subdirectory within the vault for pipeline logs. Default: 'bridge-ai-logs'. */
  logFolder?: string;
  /**
   * Optional project slug. When provided, logs are written under:
   * `projects/<slug>/phases/<NN-...>/EXECUTION-LOG.md` (best-effort).
   */
  projectSlug?: string;
}

export class ObsidianTransport implements TransportHandler {
  private readonly vaultPath: string;
  private readonly logFolder: string;
  private readonly projectSlug?: string;
  private initializedFiles = new Set<string>();
  private currentPhaseSlug: string | null = null;

  constructor(options: ObsidianTransportOptions) {
    this.vaultPath = options.vaultPath;
    this.logFolder = options.logFolder ?? 'bridge-ai-logs';
    this.projectSlug = options.projectSlug;
  }

  onEvent(event: GSDEvent): void {
    try {
      // Update phase context when we see phase lifecycle events.
      if (event.type === GSDEventType.PhaseStart || event.type === GSDEventType.PhaseComplete) {
        const phaseNumber = (event as unknown as { phaseNumber?: string }).phaseNumber ?? '';
        const phaseName = (event as unknown as { phaseName?: string }).phaseName ?? '';
        if (phaseNumber) {
          const n = String(phaseNumber).padStart(2, '0');
          const nameSlug = String(phaseName || 'phase')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '');
          this.currentPhaseSlug = `${n}-${nameSlug || 'phase'}`;
        }
      }

      const logFilePath = this.resolveLogFilePath();
      this.ensureLogFile(logFilePath);

      const line = this.formatEvent(event);
      if (line) {
        appendFileSync(logFilePath, line + '\n');
      }
    } catch {
      // Must not throw per TransportHandler contract
    }
  }

  close(): void {
    // File handles are closed after each appendFileSync — nothing to clean up
  }

  private resolveLogFilePath(): string {
    // Preferred contract: projects/<slug>/phases/<phase>/EXECUTION-LOG.md
    if (this.projectSlug && this.currentPhaseSlug) {
      return join(this.vaultPath, 'projects', this.projectSlug, 'phases', this.currentPhaseSlug, 'EXECUTION-LOG.md');
    }

    // Pre-phase fallback: projectSlug known but PhaseStart not yet received — write to setup log
    if (this.projectSlug) {
      return join(this.vaultPath, 'projects', this.projectSlug, 'phases', 'setup', 'EXECUTION-LOG.md');
    }

    // Unknown project: write to a named setup stub rather than an opaque date-based path
    return join(this.vaultPath, this.logFolder, 'phases', 'setup', 'EXECUTION-LOG.md');
  }

  private ensureLogFile(logFilePath: string): void {
    if (this.initializedFiles.has(logFilePath)) return;
    const dir = dirname(logFilePath);
    mkdirSync(dir, { recursive: true });

    // Only write header if the file doesn't exist yet.
    if (!existsSync(logFilePath)) {
      appendFileSync(logFilePath, `# Bridge AI Execution Log\n\n`);
    }
    this.initializedFiles.add(logFilePath);
  }

  private formatEvent(event: GSDEvent): string | null {
    const ts = event.timestamp.slice(11, 19);

    switch (event.type) {
      case GSDEventType.SessionInit:
        return `## Session Started — ${ts}\n- **Model:** ${event.model}\n- **Tools:** ${event.tools.length}\n`;

      case GSDEventType.SessionComplete:
        return `## Session Complete — ${ts}\n- **Cost:** $${event.totalCostUsd.toFixed(4)}\n- **Turns:** ${event.numTurns}\n- **Duration:** ${(event.durationMs / 1000).toFixed(1)}s\n`;

      case GSDEventType.SessionError:
        return `## Session Error — ${ts}\n- **Subtype:** ${event.errorSubtype}\n- **Errors:** ${event.errors?.join(', ')}\n`;

      case GSDEventType.PhaseStart:
        return `\n---\n### Phase ${event.phaseNumber}: ${event.phaseName} — ${ts}\n`;

      case GSDEventType.PhaseComplete:
        return `### Phase ${event.phaseNumber} Complete — ${ts}\n- **Success:** ${event.success}\n- **Cost:** $${event.totalCostUsd.toFixed(4)}\n`;

      case GSDEventType.CostUpdate:
        return `- **Cost update:** session $${event.sessionCostUsd.toFixed(4)}, cumulative $${event.cumulativeCostUsd.toFixed(4)} — ${ts}`;

      case GSDEventType.ToolCall:
        return `- \`${ts}\` Tool: **${event.toolName}**`;

      default:
        return null;
    }
  }
}
