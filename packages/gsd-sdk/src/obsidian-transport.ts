/**
 * Obsidian Transport — writes pipeline events to vault files.
 *
 * Implements TransportHandler to persist GSD events as markdown notes
 * in an Obsidian vault directory. Each session gets its own daily log file.
 */

import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { GSDEventType, type GSDEvent, type TransportHandler } from './types.js';

// ─── ObsidianTransport ───────────────────────────────────────────────────────

export interface ObsidianTransportOptions {
  /** Path to the Obsidian vault directory where logs will be written. */
  vaultPath: string;
  /** Subdirectory within the vault for pipeline logs. Default: 'bridge-ai-logs'. */
  logFolder?: string;
}

export class ObsidianTransport implements TransportHandler {
  private readonly vaultPath: string;
  private readonly logFolder: string;
  private readonly logFilePath: string;
  private initialized = false;

  constructor(options: ObsidianTransportOptions) {
    this.vaultPath = options.vaultPath;
    this.logFolder = options.logFolder ?? 'bridge-ai-logs';

    const dateStr = new Date().toISOString().slice(0, 10);
    this.logFilePath = join(this.vaultPath, this.logFolder, `${dateStr}-pipeline.md`);
  }

  onEvent(event: GSDEvent): void {
    try {
      this.ensureLogFile();
      const line = this.formatEvent(event);
      if (line) {
        appendFileSync(this.logFilePath, line + '\n');
      }
    } catch {
      // Must not throw per TransportHandler contract
    }
  }

  close(): void {
    // File handles are closed after each appendFileSync — nothing to clean up
  }

  private ensureLogFile(): void {
    if (this.initialized) return;
    const dir = join(this.vaultPath, this.logFolder);
    mkdirSync(dir, { recursive: true });
    if (!this.initialized) {
      appendFileSync(
        this.logFilePath,
        `# Bridge AI Pipeline Log — ${new Date().toISOString().slice(0, 10)}\n\n`,
      );
      this.initialized = true;
    }
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
