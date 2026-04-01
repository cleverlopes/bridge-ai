import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { resolve } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import simpleGit, { CheckRepoActions } from 'simple-git';
import { WorkspaceSnapshot } from '../../persistence/entity/workspace-snapshot.entity';
import { Project } from '../../persistence/entity/project.entity';
import { KsmService } from '../ksm/ksm.service';
import { SecretScope } from '../../persistence/entity/secret.entity';
import { RepoInfo, IndexPayload, InitWorkspaceDto } from './types';
import { RepoIndexerService } from './repo-indexer.service';

@Injectable()
export class WorkspaceOnboardingService {
  private readonly logger = new Logger(WorkspaceOnboardingService.name);

  constructor(
    @InjectRepository(WorkspaceSnapshot)
    private readonly snapshotRepo: Repository<WorkspaceSnapshot>,
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    private readonly ksm: KsmService,
    private readonly repoIndexer: RepoIndexerService,
  ) {}

  async initWorkspace(dto: InitWorkspaceDto): Promise<{ project: Project; snapshot: WorkspaceSnapshot }> {
    // If repoUrl provided, clone it first
    if (dto.repoUrl) {
      this.logger.log(`Cloning ${dto.repoUrl} to ${dto.workspacePath}`);
      const git = simpleGit();
      await git.clone(dto.repoUrl, dto.workspacePath);
    }

    // Validate the repo
    const repoInfo = await this.validateRepo(dto.workspacePath);
    this.logger.log(`Validated repo at ${dto.workspacePath}: branch=${repoInfo.currentBranch}, sha=${repoInfo.headSha}`);

    // Find or create the Project
    let project = await this.projectRepo.findOne({ where: { slug: dto.slug } });
    if (!project) {
      project = this.projectRepo.create({
        slug: dto.slug,
        name: dto.projectName,
        status: 'active',
        settings: {},
      });
      project = await this.projectRepo.save(project);
      this.logger.log(`Created project ${project.id} (${project.slug})`);
    }

    // Bootstrap-index the repo using RepoIndexerService
    const indexPayload = await this.repoIndexer.bootstrap(dto.workspacePath, repoInfo);

    // Persist the snapshot
    const snapshot = await this.persistSnapshot(project.id, dto.workspacePath, repoInfo, indexPayload);

    return { project, snapshot };
  }

  async validateRepo(workspacePath: string): Promise<RepoInfo> {
    const git = simpleGit(workspacePath);

    const isRepo = await git.checkIsRepo(CheckRepoActions.IS_REPO_ROOT);
    if (!isRepo) {
      throw new BadRequestException(`${workspacePath} is not a git repository root`);
    }

    const remotes = await git.getRemotes(true);
    const mainRemote = remotes.find((r) => r.name === 'origin') ?? remotes[0] ?? null;

    const status = await git.status();
    const headSha = await git.revparse(['HEAD']);

    // Detect base branch: try symbolic-ref then fallback to 'main'
    let baseBranch = 'main';
    try {
      const ref = await git.raw(['symbolic-ref', '--short', 'refs/remotes/origin/HEAD']);
      baseBranch = ref.trim().replace('origin/', '');
    } catch {
      // not fatal — use 'main' as default
    }

    return {
      remoteUrl: mainRemote?.refs?.fetch ?? null,
      remoteName: mainRemote?.name ?? null,
      baseBranch,
      currentBranch: status.current ?? 'HEAD',
      isDirty: status.files.length > 0,
      headSha: headSha.trim(),
    };
  }

  async validateCredentials(
    projectId: string,
    workspacePath: string,
    repoInfo: RepoInfo,
    credential?: { type: 'ssh'; key: string } | { type: 'https'; pat: string },
  ): Promise<void> {
    if (credential) {
      if (credential.type === 'ssh') {
        await this.ksm.createSecret(
          `workspace-ssh-key-${projectId}`,
          credential.key,
          'project' as SecretScope,
          projectId,
        );
        this.logger.log(`Stored SSH credential for project ${projectId}`);
      } else if (credential.type === 'https') {
        await this.ksm.createSecret(
          `workspace-https-pat-${projectId}`,
          credential.pat,
          'project' as SecretScope,
          projectId,
        );
        this.logger.log(`Stored HTTPS PAT for project ${projectId}`);
      }
    }

    // Test read access if remote URL is available
    if (repoInfo.remoteUrl) {
      const testGit = simpleGit(workspacePath);
      await testGit.listRemote(['--heads', repoInfo.remoteUrl]);
      this.logger.log(`Verified read access to ${repoInfo.remoteUrl}`);
    }
  }

  async generateVaultDocs(projectSlug: string, indexPayload: IndexPayload): Promise<void> {
    const vaultDir = resolve(process.cwd(), 'volumes', 'obsidian', 'projects', projectSlug);
    await mkdir(vaultDir, { recursive: true });

    const remoteInfo = indexPayload.remoteUrl ? `Repository: ${indexPayload.remoteUrl}` : 'Local repository';
    const entrypointsSection = indexPayload.entrypoints.length > 0
      ? indexPayload.entrypoints.map((e) => `- ${e}`).join('\n')
      : '- (none detected)';
    const stackSection = indexPayload.manifests.length > 0
      ? indexPayload.manifests.map((m) => `- ${m.path} (${m.type})`).join('\n')
      : '- (no manifests found)';

    const files: Array<{ name: string; content: string }> = [
      {
        name: 'project.md',
        content: `---
title: ${projectSlug}
type: project
slug: ${projectSlug}
indexedAt: ${indexPayload.indexedAt}
---

# ${projectSlug}

${remoteInfo}

## Branches

- Base: \`${indexPayload.baseBranch}\`
- Current: \`${indexPayload.currentBranch}\`
- HEAD: \`${indexPayload.headSha}\`
`,
      },
      {
        name: 'architecture.md',
        content: `---
title: Architecture
type: architecture
project: ${projectSlug}
---

# Architecture

## Entrypoints

${entrypointsSection}

## File Tree (top-level)

${indexPayload.tree.slice(0, 20).map((p) => `- ${p}`).join('\n') || '- (not yet indexed)'}
`,
      },
      {
        name: 'stack.md',
        content: `---
title: Stack
type: stack
project: ${projectSlug}
---

# Stack

## Manifest Files

${stackSection}
`,
      },
      {
        name: 'decisions.md',
        content: `---
title: Decisions
type: decisions
project: ${projectSlug}
---

# Architecture Decision Records

<!-- ADR template:
## ADR-NNN: Title
**Status:** Proposed | Accepted | Deprecated
**Date:** YYYY-MM-DD
**Context:** ...
**Decision:** ...
**Consequences:** ...
-->
`,
      },
      {
        name: 'runbook.md',
        content: `---
title: Runbook
type: runbook
project: ${projectSlug}
---

# Runbook

${remoteInfo}

## Clone

\`\`\`bash
git clone ${indexPayload.remoteUrl ?? '<local-path>'} <destination>
\`\`\`

## Branches

- Base branch: \`${indexPayload.baseBranch}\`
- Current branch: \`${indexPayload.currentBranch}\`

## Last Indexed

${indexPayload.indexedAt}
`,
      },
    ];

    for (const file of files) {
      const filePath = resolve(vaultDir, file.name);
      await writeFile(filePath, file.content, 'utf8');
      this.logger.log(`Wrote vault doc: ${filePath}`);
    }
  }

  async persistSnapshot(
    projectId: string,
    workspacePath: string,
    repoInfo: RepoInfo,
    indexPayload: IndexPayload,
  ): Promise<WorkspaceSnapshot> {
    let snapshot = await this.snapshotRepo.findOne({ where: { projectId } });

    if (snapshot) {
      // Update existing
      snapshot.workspacePath = workspacePath;
      snapshot.remoteUrl = repoInfo.remoteUrl;
      snapshot.remoteName = repoInfo.remoteName;
      snapshot.baseBranch = repoInfo.baseBranch;
      snapshot.currentBranch = repoInfo.currentBranch;
      snapshot.headSha = repoInfo.headSha;
      snapshot.isDirty = repoInfo.isDirty;
      snapshot.indexPayload = indexPayload;
      snapshot.indexedAt = new Date();
    } else {
      // Create new
      snapshot = this.snapshotRepo.create({
        projectId,
        workspacePath,
        remoteUrl: repoInfo.remoteUrl,
        remoteName: repoInfo.remoteName,
        baseBranch: repoInfo.baseBranch,
        currentBranch: repoInfo.currentBranch,
        headSha: repoInfo.headSha,
        isDirty: repoInfo.isDirty,
        indexPayload,
        indexedAt: new Date(),
      });
    }

    return this.snapshotRepo.save(snapshot);
  }
}
