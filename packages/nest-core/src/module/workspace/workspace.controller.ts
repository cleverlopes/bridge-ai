import { Body, Controller, Post, Logger, HttpCode } from '@nestjs/common';
import { WorkspaceOnboardingService } from './workspace-onboarding.service';
import { BrainService } from '../brain/brain.service';
import { InitRunner } from '@bridge-ai/gsd-sdk';
import type { BrownfieldContext, InitWorkspaceDto } from './types';

interface InitResponseBody {
  success: boolean;
  projectId?: string;
  slug: string;
  snapshotId?: string;
  vaultDocs?: string[];
  error?: string;
}

@Controller('internal/workspaces')
export class WorkspaceController {
  private readonly logger = new Logger(WorkspaceController.name);

  constructor(
    private readonly onboardingService: WorkspaceOnboardingService,
    private readonly brainService: BrainService,
  ) {}

  @Post('init')
  @HttpCode(200)
  async init(@Body() body: InitWorkspaceDto): Promise<InitResponseBody> {
    this.logger.log(`Onboarding workspace: ${body.workspacePath} (slug: ${body.slug})`);

    try {
      // Stage 1: Extraction (offline, no AI) — per D-08
      const { project, snapshot } = await this.onboardingService.initWorkspace(body);
      this.logger.log(`Extraction complete for ${body.slug}, starting AI doc generation`);

      // Stage 2: AI doc generation via InitRunner brownfield — per D-08, D-11, D-12
      // Build BrownfieldContext from the extracted snapshot's flat entity fields
      const brownfield: BrownfieldContext = {
        repoInfo: {
          remoteUrl: snapshot.remoteUrl,
          remoteName: snapshot.remoteName,
          baseBranch: snapshot.baseBranch,
          currentBranch: snapshot.currentBranch,
          isDirty: snapshot.isDirty,
          headSha: snapshot.headSha,
        },
        indexPayload: snapshot.indexPayload,
        workspacePath: snapshot.workspacePath,
        projectSlug: body.slug,
      };

      const vaultDocsDir = `projects/${body.slug}`;
      const initRunner = new InitRunner({
        projectDir: body.workspacePath,
        tools: null as any,      // no GSDTools in daemon context — InitRunner is best-effort
        eventStream: null as any, // no event stream in daemon context
        adapter: this.brainService,
      });

      try {
        const _runResult = await initRunner.run(
          `Brownfield onboarding for project "${body.projectName ?? body.slug}" at ${body.workspacePath}. ` +
          `BrownfieldContext: ${JSON.stringify(brownfield).slice(0, 500)}`,
        );
        this.logger.log(`InitRunner complete for ${body.slug}`);
      } catch (initRunnerErr) {
        // InitRunner failure is non-fatal: extraction succeeded, AI docs are best-effort.
        // The extraction-based snapshot from initWorkspace() is already persisted.
        this.logger.warn(
          `InitRunner brownfield failed (non-fatal): ${
            initRunnerErr instanceof Error ? initRunnerErr.message : initRunnerErr
          }. Extraction-based snapshot is still available.`,
        );
      }

      this.logger.log(`Onboarding complete for ${body.slug}`);

      return {
        success: true,
        projectId: project.id,
        slug: body.slug,
        snapshotId: snapshot.id,
        vaultDocs: [
          `${vaultDocsDir}/project.md`,
          `${vaultDocsDir}/architecture.md`,
          `${vaultDocsDir}/stack.md`,
          `${vaultDocsDir}/decisions.md`,
          `${vaultDocsDir}/runbook.md`,
        ],
      };
    } catch (err) {
      this.logger.error(`Onboarding failed: ${err instanceof Error ? err.message : err}`);
      return {
        success: false,
        slug: body.slug,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
