import { Injectable, Logger } from '@nestjs/common';
import { resolve, join } from 'node:path';
import { mkdir, rm } from 'node:fs/promises';
import simpleGit from 'simple-git';

const RUNS_BASE = resolve(process.cwd(), 'volumes', 'runs');

@Injectable()
export class EphemeralWorkspaceService {
  private readonly logger = new Logger(EphemeralWorkspaceService.name);

  async cloneForRun(hostWorkspacePath: string, runId: string): Promise<string> {
    const runPath = this.getRunPath(runId);
    await mkdir(RUNS_BASE, { recursive: true });

    const git = simpleGit();
    await git.clone(hostWorkspacePath, runPath, ['--local', '--no-hardlinks']);

    this.logger.log(`Ephemeral workspace cloned for run ${runId} at ${runPath}`);
    return runPath;
  }

  async cleanupRun(runId: string): Promise<void> {
    const runPath = this.getRunPath(runId);
    await rm(runPath, { recursive: true, force: true });
    this.logger.log(`Ephemeral workspace cleaned for run ${runId}`);
  }

  getRunPath(runId: string): string {
    return join(RUNS_BASE, runId);
  }
}
