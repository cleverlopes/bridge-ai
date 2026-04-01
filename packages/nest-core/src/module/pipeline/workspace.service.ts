import { Injectable, Logger } from '@nestjs/common';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const VOLUMES_BASE = resolve(process.cwd(), 'volumes');

@Injectable()
export class WorkspaceService {
  private readonly logger = new Logger(WorkspaceService.name);

  provisionWorkspace(projectId: string, planId: string): string {
    const workspacePath = this.getWorkspacePath(projectId);
    const planningDir = join(workspacePath, '.planning');

    mkdirSync(planningDir, { recursive: true });

    const roadmapPath = join(planningDir, 'ROADMAP.md');
    if (!existsSync(roadmapPath)) {
      writeFileSync(roadmapPath, '# Project Roadmap\n\nStatus: pending\n', 'utf-8');
    }

    const statePath = join(planningDir, 'STATE.md');
    if (!existsSync(statePath)) {
      writeFileSync(statePath, '# State\n\nphase: init\n', 'utf-8');
    }

    const projectMdPath = join(workspacePath, 'PROJECT.md');
    if (!existsSync(projectMdPath)) {
      writeFileSync(
        projectMdPath,
        `# Project\n\nprojectId: ${projectId}\nplanId: ${planId}\ncreatedAt: ${new Date().toISOString()}\n`,
        'utf-8',
      );
    }

    this.logger.log(`Provisioned workspace for project ${projectId} at ${workspacePath}`);
    return workspacePath;
  }

  getWorkspacePath(projectId: string): string {
    return join(VOLUMES_BASE, 'workspaces', projectId);
  }
}
