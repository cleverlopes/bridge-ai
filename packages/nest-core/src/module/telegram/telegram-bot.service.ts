import {
  Injectable,
  Logger,
  Optional,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { Telegraf, Context } from 'telegraf';
import { KsmService } from '../ksm/ksm.service';
import { EventsService, QUEUE_PROJECT_EVENTS, QUEUE_WORKFLOW_EVENTS } from '../events/events.service';
import { ProjectService } from '../project/project.service';
import { PlanService } from '../plan/plan.service';
import { BrainService } from '../brain/brain.service';
import { DockerService } from '../docker/docker.service';
import { ConversationStateService } from './conversation-state.service';
import { TelegramNotifierService } from './telegram-notifier.service';
import { CanonicalPayloadBuilder } from './canonical-payload.builder';
import { TelegramThrottlerGuard } from './telegram-throttler.guard';

const BOT_TOKEN_KEY = 'telegram-bot-token';

@Injectable()
export class TelegramBotService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramBotService.name);
  private bot!: Telegraf;
  private allowedChatIds: Set<string> = new Set();

  constructor(
    private readonly ksm: KsmService,
    private readonly events: EventsService,
    private readonly projectService: ProjectService,
    private readonly planService: PlanService,
    private readonly brain: BrainService,
    private readonly convState: ConversationStateService,
    private readonly notifier: TelegramNotifierService,
    private readonly throttler: TelegramThrottlerGuard,
    @Optional() private readonly docker?: DockerService,
  ) {}

  async onModuleInit(): Promise<void> {
    const token = await this.ksm.getSecret(BOT_TOKEN_KEY, 'global', undefined, 'TelegramBotService');
    this.bot = new Telegraf(token);
    this.notifier.setBot(this.bot);

    const allowedEnv = process.env['TELEGRAM_ALLOWED_CHAT_IDS'] ?? '';
    if (!allowedEnv.trim()) {
      throw new Error('TELEGRAM_ALLOWED_CHAT_IDS env var is required (comma-separated chat IDs)');
    }
    this.allowedChatIds = new Set(
      allowedEnv.split(',').map((id) => id.trim()).filter(Boolean),
    );
    this.logger.log(`Allowed chat IDs: ${[...this.allowedChatIds].join(', ')}`);

    this.registerMiddlewares();
    this.registerCommands();

    this.bot.launch().catch((err) => this.logger.error('Bot launch error', err));
    this.logger.log('Telegram bot started');
  }

  async onModuleDestroy(): Promise<void> {
    this.bot?.stop('SIGTERM');
  }

  private registerMiddlewares(): void {
    this.bot.use(async (ctx, next) => {
      const chatId = String(ctx.chat?.id ?? '');
      if (!this.allowedChatIds.has(chatId)) {
        this.logger.warn(`Rejected message from unauthorized chat ${chatId}`);
        return;
      }
      try {
        this.throttler.check(ctx);
      } catch {
        await ctx.reply('Too many requests. Please wait before sending another command.');
        return;
      }
      await next();
    });
  }

  private registerCommands(): void {
    this.bot.command('new', (ctx) => this.handleNew(ctx));
    this.bot.command('done', (ctx) => this.handleDone(ctx));
    this.bot.command('approve', (ctx) => this.handleApprove(ctx));
    this.bot.command('rewrite', (ctx) => this.handleRewrite(ctx));
    this.bot.command('stop', (ctx) => this.handleStop(ctx));
    this.bot.command('retry', (ctx) => this.handleRetry(ctx));
    this.bot.command('config', (ctx) => this.handleConfig(ctx));
    this.bot.command('status', (ctx) => this.handleStatus(ctx));
    this.bot.command('health', (ctx) => this.handleHealth(ctx));
    this.bot.command('help', (ctx) => this.handleHelp(ctx));
    this.bot.command('project', (ctx) => this.handleProject(ctx));

    // Minimal HumanGate wiring: allow plain-text "approve <key>" as well.
    this.bot.on('text', (ctx) => this.handleGateText(ctx));
  }

  private async handleNew(ctx: Context): Promise<void> {
    const conversationId = String(ctx.chat!.id);
    const text = this.getCommandArgs(ctx);

    if (!text) {
      await ctx.reply('Usage: /new <name>|<stack>|<description>|<auto-approve>');
      return;
    }

    const parts = text.split('|').map((p) => p.trim());
    const [name, stack, description, autoApproveStr] = parts;

    if (!name) {
      await ctx.reply('Project name is required. Usage: /new <name>|<stack>|<description>|<auto-approve>');
      return;
    }

    try {
      const payload = CanonicalPayloadBuilder.fromContext(ctx, 'telegram.new', { name, stack, description });
      await this.persistEvent(ctx, payload);

      const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
      const project = await this.projectService.create({
        name,
        slug,
        description: description ?? null,
        stack: stack ?? null,
        settings: { autoApprove: autoApproveStr === 'yes' || autoApproveStr === 'true' },
      });

      const plan = await this.planService.createPlan(project.id, description ?? name, conversationId);
      this.convState.setProjectAndPlan(conversationId, project.id, plan.id);

      await ctx.reply(
        `✅ *Project created*\n` +
          `Name: ${project.name}\n` +
          `ID: \`${project.id}\`\n` +
          `Plan ID: \`${plan.id}\`\n` +
          `Status: \`draft\`\n\n` +
          `Send /done to submit for approval.`,
      );
    } catch (err) {
      await ctx.reply(`❌ Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  private async handleDone(ctx: Context): Promise<void> {
    const conversationId = String(ctx.chat!.id);
    const { planId } = this.convState.getState(conversationId);

    if (!planId) {
      await ctx.reply('No active plan. Use /new to create one.');
      return;
    }

    try {
      await this.persistEvent(ctx, CanonicalPayloadBuilder.fromContext(ctx, 'telegram.done', { planId }));
      const plan = await this.planService.submitForApproval(planId);
      await ctx.reply(`📋 Plan \`${plan.id}\` submitted for approval.\n\nSend /approve to start execution.`);
    } catch (err) {
      await ctx.reply(`❌ Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  private async handleApprove(ctx: Context): Promise<void> {
    const conversationId = String(ctx.chat!.id);
    const { planId } = this.convState.getState(conversationId);
    const args = this.getCommandArgs(ctx);

    // If /approve is called with an explicit gate key, treat it as HumanGate resolution.
    if (args && this.looksLikeGateKey(args)) {
      await this.persistEvent(ctx, CanonicalPayloadBuilder.fromContext(ctx, 'telegram.gate_approve', { key: args }));
      await this.publishGateResponse(args, 'approve', conversationId);
      await ctx.reply(`✅ Gate approved for key: \`${args}\``);
      return;
    }

    if (!planId) {
      await ctx.reply('No active plan to approve.');
      return;
    }

    try {
      await this.persistEvent(ctx, CanonicalPayloadBuilder.fromContext(ctx, 'telegram.approve', { planId }));
      const plan = await this.planService.approvePlan(planId);
      await ctx.reply(`🚀 Plan \`${plan.id}\` approved and queued for execution.`);
    } catch (err) {
      await ctx.reply(`❌ Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  private async handleGateText(ctx: Context): Promise<void> {
    const messageText = 'text' in ctx.message! ? (ctx.message.text as string) : '';
    const trimmed = messageText.trim();
    if (!trimmed) return;

    // Accept either:
    // - "approve <gateKey>" (plain text)
    // - "<gateKey>" (plain text key only) => interpreted as approve
    const approvePrefix = /^approve\s+/i;
    const keyCandidate = approvePrefix.test(trimmed) ? trimmed.replace(approvePrefix, '').trim() : trimmed;
    if (!this.looksLikeGateKey(keyCandidate)) return;

    const conversationId = String(ctx.chat!.id);
    await this.publishGateResponse(keyCandidate, 'approve', conversationId);
    await ctx.reply(`✅ Gate approved for key: \`${keyCandidate}\``);
  }

  private looksLikeGateKey(text: string): boolean {
    // Gate keys are generated by HumanGateBridge (discuss/verify/blocker prefixes).
    return (
      text.startsWith('discuss:') ||
      text.startsWith('verify:') ||
      text.startsWith('blocker:')
    );
  }

  private async publishGateResponse(key: string, response: string, conversationId: string): Promise<void> {
    try {
      await this.events.publish({
        type: 'telegram.gate_response',
        channel: QUEUE_WORKFLOW_EVENTS,
        payload: {
          type: 'telegram.gate_response',
          key,
          response,
          conversationId,
        },
        correlationId: key,
        conversationId,
      });
    } catch (err) {
      this.logger.warn(`Failed to publish gate response for ${key}: ${err instanceof Error ? err.message : err}`);
    }
  }

  private async handleRewrite(ctx: Context): Promise<void> {
    const conversationId = String(ctx.chat!.id);
    const { planId, projectId } = this.convState.getState(conversationId);

    if (!planId || !projectId) {
      await ctx.reply('No active plan to rewrite.');
      return;
    }

    try {
      await this.persistEvent(ctx, CanonicalPayloadBuilder.fromContext(ctx, 'telegram.rewrite', { planId }));
      await this.planService.failPlan(planId, 'Rejected by user via /rewrite');
      this.convState.clearPlan(conversationId);
      await ctx.reply(`🔄 Plan rejected. Use /new to create a new plan.`);
    } catch (err) {
      await ctx.reply(`❌ Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  private async handleStop(ctx: Context): Promise<void> {
    const conversationId = String(ctx.chat!.id);
    const { planId } = this.convState.getState(conversationId);

    if (!planId) {
      await ctx.reply('No active plan to stop.');
      return;
    }

    try {
      await this.persistEvent(ctx, CanonicalPayloadBuilder.fromContext(ctx, 'telegram.stop', { planId }));
      const plan = await this.planService.stopPlan(planId);

      if (this.docker) {
        try {
          await this.docker.stopContainer(plan.projectId);
          await this.docker.removeContainer(plan.projectId);
        } catch (err) {
          this.logger.warn(`Failed to stop container for project ${plan.projectId}: ${err instanceof Error ? err.message : err}`);
        }
      }

      await ctx.reply(`⏹ Plan \`${plan.id}\` stopped.\n\nUse /retry to re-queue.`);
    } catch (err) {
      await ctx.reply(`❌ Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  private async handleRetry(ctx: Context): Promise<void> {
    const conversationId = String(ctx.chat!.id);
    const { planId } = this.convState.getState(conversationId);

    if (!planId) {
      await ctx.reply('No active plan to retry.');
      return;
    }

    try {
      await this.persistEvent(ctx, CanonicalPayloadBuilder.fromContext(ctx, 'telegram.retry', { planId }));
      const plan = await this.planService.retryPlan(planId);
      await ctx.reply(`🔁 Plan \`${plan.id}\` re-queued for execution.`);
    } catch (err) {
      await ctx.reply(`❌ Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  private async handleConfig(ctx: Context): Promise<void> {
    const conversationId = String(ctx.chat!.id);
    const { projectId } = this.convState.getState(conversationId);
    const args = this.getCommandArgs(ctx);

    if (!projectId) {
      await ctx.reply('No active project. Use /project <slug> or /new first.');
      return;
    }
    if (!args) {
      await ctx.reply('Usage: /config <key> <value>');
      return;
    }

    const spaceIdx = args.indexOf(' ');
    if (spaceIdx === -1) {
      await ctx.reply('Usage: /config <key> <value>');
      return;
    }
    const key = args.slice(0, spaceIdx).trim();
    const value = args.slice(spaceIdx + 1).trim();

    try {
      await this.persistEvent(ctx, CanonicalPayloadBuilder.fromContext(ctx, 'telegram.config', { key, projectId }));
      try {
        await this.ksm.rotateSecret(`config:${key}`, value, 'project', projectId);
      } catch {
        await this.ksm.createSecret(`config:${key}`, value, 'project', projectId);
      }
      await ctx.reply(`✅ Config key \`${key}\` stored for project.`);
    } catch (err) {
      await ctx.reply(`❌ Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  private async handleStatus(ctx: Context): Promise<void> {
    const conversationId = String(ctx.chat!.id);
    const { planId, projectId } = this.convState.getState(conversationId);
    await this.persistEvent(ctx, CanonicalPayloadBuilder.fromContext(ctx, 'telegram.status', {}));

    if (!planId) {
      await ctx.reply(`No active plan.\nProject: ${projectId ?? 'none'}`);
      return;
    }

    try {
      const plan = await this.planService.getPlan(planId);
      await ctx.reply(
        `📊 *Plan Status*\n` +
          `ID: \`${plan.id}\`\n` +
          `Status: \`${plan.status}\`\n` +
          `Created: ${plan.createdAt.toISOString()}`,
      );
    } catch (err) {
      await ctx.reply(`❌ Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  private async handleHealth(ctx: Context): Promise<void> {
    await this.persistEvent(ctx, CanonicalPayloadBuilder.fromContext(ctx, 'telegram.health', {}));
    try {
      const check = await this.brain.checkProvider();
      const statusIcon = check.healthy ? '✅' : '❌';
      await ctx.reply(
        `${statusIcon} *System Health*\n` +
          `Provider: ${check.provider}\n` +
          `Status: ${check.healthy ? 'healthy' : 'unhealthy'}\n` +
          (check.error ? `Error: ${check.error}` : ''),
      );
    } catch (err) {
      await ctx.reply(`❌ Health check failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  private async handleHelp(ctx: Context): Promise<void> {
    await ctx.reply(
      `*Bridge AI — Command Reference*\n\n` +
        `/new <name>|<stack>|<description>|<auto-approve> — Create project + draft plan\n` +
        `/done — Submit current draft plan for approval\n` +
        `/approve — Approve plan, trigger execution queue\n` +
        `/rewrite — Reject current plan, allow resubmission\n` +
        `/stop — Stop executing plan\n` +
        `/retry — Retry stopped/failed plan\n` +
        `/config <key> <value> — Store project config in KSM\n` +
        `/status — Current plan status\n` +
        `/health — System health check\n` +
        `/project <slug> — Switch active project\n` +
        `/help — This message`,
    );
  }

  private async handleProject(ctx: Context): Promise<void> {
    const conversationId = String(ctx.chat!.id);
    const slug = this.getCommandArgs(ctx);

    if (!slug) {
      await ctx.reply('Usage: /project <slug>');
      return;
    }

    try {
      let project;
      try {
        project = await this.projectService.findBySlug(slug);
      } catch {
        await ctx.reply(`❌ Project with slug \`${slug}\` not found.`);
        return;
      }

      this.convState.setProjectId(conversationId, project.id);
      const activePlan = await this.planService.getActivePlanForConversation(conversationId);
      if (activePlan) {
        this.convState.setPlanId(conversationId, activePlan.id);
      } else {
        this.convState.clearPlan(conversationId);
      }

      await this.persistEvent(ctx, CanonicalPayloadBuilder.fromContext(ctx, 'telegram.project_switch', { projectId: project.id, slug }));
      await ctx.reply(`✅ Switched to project \`${project.name}\` (ID: \`${project.id}\`)`);
    } catch (err) {
      await ctx.reply(`❌ Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  private async persistEvent(ctx: Context, payload: ReturnType<typeof CanonicalPayloadBuilder.fromContext>): Promise<void> {
    try {
      await this.events.publish({
        type: payload.type,
        channel: QUEUE_PROJECT_EVENTS,
        payload: payload as unknown as Record<string, unknown>,
        correlationId: payload.correlationId,
        conversationId: payload.conversationId,
      });
    } catch (err) {
      this.logger.warn(`Failed to persist event ${payload.type}: ${err instanceof Error ? err.message : err}`);
    }
  }

  private getCommandArgs(ctx: Context): string {
    const text = 'text' in ctx.message! ? (ctx.message.text as string) : '';
    const spaceIdx = text.indexOf(' ');
    return spaceIdx === -1 ? '' : text.slice(spaceIdx + 1).trim();
  }
}
