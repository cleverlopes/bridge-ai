import { Injectable, Logger } from '@nestjs/common';
import type { HumanGateCallbacks, PhaseStepResult, PhaseStepType } from '@bridge-ai/gsd-sdk';
import { TelegramNotifierService } from '../telegram/telegram-notifier.service';

interface PendingGate {
  resolve: (value: 'approve' | 'reject' | 'modify' | 'accept' | 'retry' | 'skip' | 'stop') => void;
}

@Injectable()
export class HumanGateBridge {
  private readonly logger = new Logger(HumanGateBridge.name);
  private readonly pendingGates = new Map<string, PendingGate>();

  constructor(private readonly notifier: TelegramNotifierService) {}

  /**
   * Build HumanGateCallbacks scoped to a specific plan/conversation.
   * The callbacks pause execution via a Promise that resolves when the user responds.
   */
  buildCallbacks(conversationId: string, planId: string): HumanGateCallbacks {
    return {
      onDiscussApproval: async (ctx: { phaseNumber: string; phaseName: string }) => {
        const key = `discuss:${planId}:${ctx.phaseNumber}`;
        const text =
          `*Phase ${ctx.phaseNumber}: ${ctx.phaseName}*\n\n` +
          `The GSD discuss step is complete. How would you like to proceed?\n\n` +
          `Gate key: \`${key}\`\n\n` +
          `Reply with:\n• \`approve\` — accept and continue\n• \`reject\` — stop execution\n• \`modify\` — modify the plan` +
          `\n\nOr use: \`/approve ${key}\``;

        await this.notifier.send(conversationId, text);
        this.logger.log(`HumanGate discuss waiting for planId=${planId} phase=${ctx.phaseNumber}`);

        const response = await this.waitForResponse(key);
        return response as 'approve' | 'reject' | 'modify';
      },

      onVerificationReview: async (ctx: { phaseNumber: string; stepResult: PhaseStepResult }) => {
        const key = `verify:${planId}:${ctx.phaseNumber}`;
        const success = ctx.stepResult.success ? '✓' : '✗';
        const text =
          `*Phase ${ctx.phaseNumber} Verification ${success}*\n\n` +
          `Please review the verification result.\n\n` +
          `Gate key: \`${key}\`\n\n` +
          `Reply with:\n• \`accept\` — accept and continue\n• \`reject\` — reject the phase\n• \`retry\` — retry verification` +
          `\n\nOr use: \`/approve ${key}\``;

        await this.notifier.send(conversationId, text);
        this.logger.log(`HumanGate verify waiting for planId=${planId} phase=${ctx.phaseNumber}`);

        const response = await this.waitForResponse(key);
        return response as 'accept' | 'reject' | 'retry';
      },

      onBlockerDecision: async (blocker: { phaseNumber: string; step: PhaseStepType; error?: string }) => {
        const key = `blocker:${planId}:${blocker.phaseNumber}:${blocker.step}`;
        const errMsg = blocker.error ? `\n\n*Error:* ${blocker.error}` : '';
        const text =
          `*Blocker in Phase ${blocker.phaseNumber} — ${blocker.step}*${errMsg}\n\n` +
          `Gate key: \`${key}\`\n\n` +
          `Reply with:\n• \`retry\` — retry the step\n• \`skip\` — skip this step\n• \`stop\` — stop execution` +
          `\n\nOr use: \`/approve ${key}\``;

        await this.notifier.send(conversationId, text);
        this.logger.log(`HumanGate blocker waiting for planId=${planId} phase=${blocker.phaseNumber} step=${blocker.step}`);

        const response = await this.waitForResponse(key);
        return response as 'retry' | 'skip' | 'stop';
      },
    };
  }

  /**
   * Resolve a pending gate by key. Called when a workflow event arrives
   * with the user's response.
   */
  resolveGate(key: string, response: string): boolean {
    const gate = this.pendingGates.get(key);
    if (!gate) return false;

    this.pendingGates.delete(key);
    gate.resolve(response as 'approve' | 'reject' | 'modify' | 'accept' | 'retry' | 'skip' | 'stop');
    return true;
  }

  private waitForResponse(key: string): Promise<string> {
    return new Promise((resolve) => {
      this.pendingGates.set(key, { resolve });
    });
  }
}
