import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import simpleGit from 'simple-git';
import type { IndexPayload, ManifestEntry, RepoInfo } from './types';
import { WorkspaceSnapshot } from '../../persistence/entity/workspace-snapshot.entity';

@Injectable()
export class RepoIndexerService {
  private readonly logger = new Logger(RepoIndexerService.name);

  constructor(
    @InjectRepository(WorkspaceSnapshot)
    private readonly snapshotRepo: Repository<WorkspaceSnapshot>,
  ) {}

  static readonly MAX_TREE_ENTRIES = 2000;
  static readonly MAX_DEPTH = 3;

  private static readonly MANIFEST_PATTERNS: Record<string, ManifestEntry['type']> = {
    'package.json': 'package.json',
    'pyproject.toml': 'pyproject.toml',
    'Cargo.toml': 'Cargo.toml',
    'go.mod': 'go.mod',
    'pom.xml': 'pom.xml',
    'build.gradle': 'build.gradle',
    'build.gradle.kts': 'build.gradle',
  };

  private static readonly ENTRYPOINT_PATTERNS = new Set([
    'main.ts',
    'index.ts',
    'app.ts',
    'main.js',
    'index.js',
    'app.js',
    'main.py',
    '__main__.py',
    'app.py',
    'main.go',
    'cmd/main.go',
    'src/main.ts',
    'src/index.ts',
    'src/app.ts',
    'src/main.rs',
    'src/lib.rs',
  ]);

  private static readonly TEST_PATTERNS =
    /\.(spec|test)\.(ts|js|tsx|jsx)$|^test\/|^tests\/|^__tests__\//;

  private static readonly DOC_FILES = new Set([
    'README.md',
    'CHANGELOG.md',
    'CONTRIBUTING.md',
    'LICENSE',
    'LICENSE.md',
  ]);

  private static readonly DOC_DIRS = ['docs', '.planning'];

  async bootstrap(workspacePath: string, repoInfo: RepoInfo): Promise<IndexPayload> {
    this.logger.debug(`Indexing repository at: ${workspacePath}`);

    const tree: string[] = [];
    const truncated = await this.walkTree(workspacePath, '', 0, tree);

    const [manifests, entrypoints, testPaths, docPaths] = await Promise.all([
      this.detectManifests(workspacePath, tree),
      Promise.resolve(this.detectEntrypoints(tree)),
      Promise.resolve(this.detectTestPaths(tree)),
      Promise.resolve(this.detectDocPaths(tree)),
    ]);

    return {
      tree,
      manifests,
      entrypoints,
      testPaths,
      docPaths,
      remoteUrl: repoInfo.remoteUrl,
      remoteName: repoInfo.remoteName,
      baseBranch: repoInfo.baseBranch,
      currentBranch: repoInfo.currentBranch,
      headSha: repoInfo.headSha,
      truncated,
      indexedAt: new Date().toISOString(),
    };
  }

  /**
   * Incremental sync: compares stored headSha with live git HEAD.
   * Returns null if HEAD is unchanged, re-indexes and returns new IndexPayload if changed.
   * Throws NotFoundException if no snapshot exists for the project.
   */
  async sync(projectId: string): Promise<IndexPayload | null> {
    const snapshot = await this.snapshotRepo.findOne({ where: { projectId } });
    if (!snapshot) {
      throw new NotFoundException(`No workspace snapshot for project ${projectId}`);
    }

    const git = simpleGit(snapshot.workspacePath);
    const currentHeadSha = (await git.revparse(['HEAD'])).trim();

    if (currentHeadSha === snapshot.headSha) {
      this.logger.log(
        `Snapshot for project ${projectId} is up to date (HEAD=${currentHeadSha.slice(0, 8)})`,
      );
      return null;
    }

    this.logger.log(
      `HEAD changed for project ${projectId}: ${snapshot.headSha.slice(0, 8)} -> ${currentHeadSha.slice(0, 8)}, re-indexing`,
    );

    const repoInfo: RepoInfo = {
      remoteUrl: snapshot.remoteUrl,
      remoteName: snapshot.remoteName,
      baseBranch: snapshot.baseBranch,
      currentBranch: snapshot.currentBranch,
      isDirty: snapshot.isDirty,
      headSha: currentHeadSha,
    };

    const newPayload = await this.bootstrap(snapshot.workspacePath, repoInfo);
    snapshot.headSha = currentHeadSha;
    snapshot.indexPayload = newPayload;
    snapshot.indexedAt = new Date();
    await this.snapshotRepo.save(snapshot);

    return newPayload;
  }

  /**
   * Walks the directory tree from basePath, adding relative paths to results.
   * Stops when MAX_TREE_ENTRIES is reached.
   * @returns true if the tree was truncated (exceeded MAX_TREE_ENTRIES)
   */
  private async walkTree(
    basePath: string,
    relativePath: string,
    depth: number,
    results: string[],
  ): Promise<boolean> {
    if (results.length >= RepoIndexerService.MAX_TREE_ENTRIES) {
      return true;
    }

    const currentDir = relativePath ? join(basePath, relativePath) : basePath;

    let entries: import('node:fs').Dirent[];
    try {
      entries = await readdir(currentDir, { withFileTypes: true });
    } catch (err) {
      this.logger.warn(`Failed to read directory ${currentDir}: ${String(err)}`);
      return false;
    }

    for (const entry of entries) {
      if (results.length >= RepoIndexerService.MAX_TREE_ENTRIES) {
        return true;
      }

      const entryRelPath = relativePath ? join(relativePath, entry.name) : entry.name;

      if (entry.isFile()) {
        results.push(entryRelPath);
      } else if (entry.isDirectory() && depth < RepoIndexerService.MAX_DEPTH) {
        // Skip hidden directories except .planning
        if (entry.name.startsWith('.') && entry.name !== '.planning') {
          continue;
        }
        const wasTruncated = await this.walkTree(basePath, entryRelPath, depth + 1, results);
        if (wasTruncated) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Detects manifest files from the tree. For package.json, parses JSON content.
   * For other manifest types, stores raw content as { raw: string }.
   */
  private async detectManifests(
    workspacePath: string,
    tree: string[],
  ): Promise<ManifestEntry[]> {
    const manifests: ManifestEntry[] = [];

    for (const [filename, type] of Object.entries(RepoIndexerService.MANIFEST_PATTERNS)) {
      // Check if manifest is in tree (at any level — not just root)
      const matches = tree.filter((p) => {
        const parts = p.split('/');
        return parts[parts.length - 1] === filename;
      });

      for (const matchPath of matches) {
        try {
          const fullPath = join(workspacePath, matchPath);
          const content = await readFile(fullPath, 'utf-8');

          manifests.push({ path: matchPath, type, content });
        } catch (err) {
          this.logger.warn(`Failed to read manifest ${matchPath}: ${String(err)}`);
        }
      }
    }

    return manifests;
  }

  /**
   * Detects entrypoints by matching tree entries against known entrypoint patterns.
   */
  private detectEntrypoints(tree: string[]): string[] {
    return tree.filter((entryPath) => {
      // Normalize path separators for matching
      const normalized = entryPath.replace(/\\/g, '/');
      // Check full path match against entrypoint patterns
      if (RepoIndexerService.ENTRYPOINT_PATTERNS.has(normalized)) {
        return true;
      }
      // Also check basename match for root-level entrypoints
      const parts = normalized.split('/');
      const basename = parts[parts.length - 1] ?? '';
      return (
        parts.length === 1 &&
        RepoIndexerService.ENTRYPOINT_PATTERNS.has(basename)
      );
    });
  }

  /**
   * Detects test paths matching spec/test file patterns or test directory prefixes.
   */
  private detectTestPaths(tree: string[]): string[] {
    return tree.filter((entryPath) => {
      const normalized = entryPath.replace(/\\/g, '/');
      return RepoIndexerService.TEST_PATTERNS.test(normalized);
    });
  }

  /**
   * Detects documentation paths: known doc files and paths inside doc directories.
   */
  private detectDocPaths(tree: string[]): string[] {
    return tree.filter((entryPath) => {
      const normalized = entryPath.replace(/\\/g, '/');
      const parts = normalized.split('/');
      const basename = parts[parts.length - 1] ?? '';

      // Check for known doc files at any level
      if (RepoIndexerService.DOC_FILES.has(basename)) {
        return true;
      }

      // Check if path starts with a doc directory
      const topDir = parts[0] ?? '';
      return RepoIndexerService.DOC_DIRS.includes(topDir);
    });
  }
}
