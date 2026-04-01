import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { resolve, join } from 'node:path';
import simpleGit from 'simple-git';

const RUNS_BASE = resolve(process.cwd(), 'volumes', 'runs');

export type PromotionStrategy = 'patch' | 'cherry-pick' | 'push';

@Injectable()
export class PromotionService {
  private readonly logger = new Logger(PromotionService.name);

  async promoteViaPatch(runId: string, hostPath: string): Promise<void> {
    const runPath = join(RUNS_BASE, runId);
    const runGit = simpleGit(runPath);
    const hostGit = simpleGit(hostPath);

    // Generate diff of all changes in ephemeral workspace vs its HEAD~1
    // (captures the work done during the run)
    const diff = await runGit.diff(['HEAD~1..HEAD']);
    if (!diff || diff.trim().length === 0) {
      throw new BadRequestException('No changes to promote — diff is empty');
    }

    // Write diff to temp file and apply to host
    const { writeFile, unlink } = await import('node:fs/promises');
    const { tmpdir } = await import('node:os');
    const patchPath = join(tmpdir(), `bridge-ai-promote-${runId}.patch`);
    try {
      await writeFile(patchPath, diff, 'utf-8');
      await hostGit.raw(['apply', '--3way', patchPath]);
      this.logger.log(`Promoted via patch from run ${runId} to ${hostPath}`);
    } finally {
      await unlink(patchPath).catch(() => {});
    }
  }

  async promoteViaCherryPick(runId: string, hostPath: string, commitShas: string[]): Promise<void> {
    if (commitShas.length === 0) {
      throw new BadRequestException('No commit SHAs provided for cherry-pick');
    }

    const runPath = join(RUNS_BASE, runId);
    const hostGit = simpleGit(hostPath);

    // Add the ephemeral workspace as a remote to the host repo temporarily
    const remoteName = `bridge-run-${runId.slice(0, 8)}`;
    try {
      await hostGit.addRemote(remoteName, runPath);
      await hostGit.fetch(remoteName);
      for (const sha of commitShas) {
        await hostGit.raw(['cherry-pick', sha]);
      }
      this.logger.log(
        `Promoted via cherry-pick (${commitShas.length} commits) from run ${runId} to ${hostPath}`,
      );
    } finally {
      await hostGit.removeRemote(remoteName).catch(() => {});
    }
  }

  async promoteViaPush(runId: string, remoteName: string, branchName: string): Promise<void> {
    const runPath = join(RUNS_BASE, runId);
    const runGit = simpleGit(runPath);
    await runGit.push(remoteName, branchName);
    this.logger.log(`Promoted via push from run ${runId}: ${remoteName}/${branchName}`);
  }
}
