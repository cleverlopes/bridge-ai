import { Test, TestingModule } from '@nestjs/testing';
import { Dirent } from 'node:fs';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { RepoIndexerService } from '../repo-indexer.service';
import type { RepoInfo, IndexPayload } from '../types';
import { WorkspaceSnapshot } from '../../../persistence/entity/workspace-snapshot.entity';

// Mock node:fs/promises at module level
jest.mock('node:fs/promises', () => ({
  readdir: jest.fn(),
  readFile: jest.fn(),
  access: jest.fn(),
  stat: jest.fn(),
}));

// Mock simple-git for sync() tests
jest.mock('simple-git');
import { mockGit } from '../../../__mocks__/simple-git';

import * as fsPromises from 'node:fs/promises';

const mockedReaddir = fsPromises.readdir as jest.Mock;
const mockedReadFile = fsPromises.readFile as jest.Mock;

// Helper to create a mock Dirent
function makeDirent(name: string, isDir: boolean): Dirent {
  return {
    name,
    isDirectory: () => isDir,
    isFile: () => !isDir,
    isBlockDevice: () => false,
    isCharacterDevice: () => false,
    isFIFO: () => false,
    isSocket: () => false,
    isSymbolicLink: () => false,
    parentPath: '',
    path: '',
  } as unknown as Dirent;
}

const BASE_REPO_INFO: RepoInfo = {
  remoteUrl: 'https://github.com/org/repo.git',
  remoteName: 'origin',
  baseBranch: 'main',
  currentBranch: 'main',
  isDirty: false,
  headSha: 'abc1234567890abcdef1234567890abcdef12345',
};

const mockSnapshotRepo = {
  findOne: jest.fn(),
  save: jest.fn(),
};

describe('RepoIndexerService', () => {
  let service: RepoIndexerService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RepoIndexerService,
        {
          provide: getRepositoryToken(WorkspaceSnapshot),
          useValue: mockSnapshotRepo,
        },
      ],
    }).compile();

    service = module.get<RepoIndexerService>(RepoIndexerService);
  });

  describe('bootstrap()', () => {
    it('should return an IndexPayload with all required fields', async () => {
      // Setup a simple file tree
      mockedReaddir.mockImplementation(async (dirPath: string) => {
        if (dirPath === '/repo') {
          return [
            makeDirent('package.json', false),
            makeDirent('README.md', false),
            makeDirent('src', true),
          ];
        }
        if (dirPath === '/repo/src') {
          return [
            makeDirent('main.ts', false),
            makeDirent('index.ts', false),
            makeDirent('app.spec.ts', false),
          ];
        }
        return [];
      });

      mockedReadFile.mockResolvedValue(
        JSON.stringify({ name: 'test-project', version: '1.0.0' }),
      );

      const result = await service.bootstrap('/repo', BASE_REPO_INFO);

      expect(result).toBeDefined();
      expect(result.tree).toBeInstanceOf(Array);
      expect(result.manifests).toBeInstanceOf(Array);
      expect(result.entrypoints).toBeInstanceOf(Array);
      expect(result.testPaths).toBeInstanceOf(Array);
      expect(result.docPaths).toBeInstanceOf(Array);
      expect(result.remoteUrl).toBe(BASE_REPO_INFO.remoteUrl);
      expect(result.remoteName).toBe(BASE_REPO_INFO.remoteName);
      expect(result.baseBranch).toBe(BASE_REPO_INFO.baseBranch);
      expect(result.currentBranch).toBe(BASE_REPO_INFO.currentBranch);
      expect(result.headSha).toBe(BASE_REPO_INFO.headSha);
      expect(typeof result.indexedAt).toBe('string');
      expect(new Date(result.indexedAt).getTime()).not.toBeNaN();
    });

    it('should detect package.json as npm manifest', async () => {
      mockedReaddir.mockResolvedValue([makeDirent('package.json', false)]);

      mockedReadFile.mockResolvedValue(
        JSON.stringify({ name: 'my-package', version: '2.0.0', dependencies: {} }),
      );

      const result = await service.bootstrap('/repo', BASE_REPO_INFO);

      expect(result.manifests).toHaveLength(1);
      expect(result.manifests[0]).toMatchObject({
        path: 'package.json',
        type: 'npm',
        content: { name: 'my-package', version: '2.0.0' },
      });
    });

    it('should detect pyproject.toml as python manifest and Cargo.toml as rust manifest', async () => {
      mockedReaddir.mockResolvedValue([
        makeDirent('pyproject.toml', false),
        makeDirent('Cargo.toml', false),
      ]);

      mockedReadFile.mockResolvedValue('[tool.poetry]\nname = "test"');

      const result = await service.bootstrap('/repo', BASE_REPO_INFO);

      const types = result.manifests.map((m) => m.type);
      expect(types).toContain('python');
      expect(types).toContain('rust');
    });

    it('should detect go.mod as go manifest', async () => {
      mockedReaddir.mockResolvedValue([makeDirent('go.mod', false)]);

      mockedReadFile.mockResolvedValue('module github.com/org/repo\n\ngo 1.21');

      const result = await service.bootstrap('/repo', BASE_REPO_INFO);

      expect(result.manifests.some((m) => m.type === 'go')).toBe(true);
    });

    it('should detect entrypoints (src/main.ts, src/index.ts)', async () => {
      mockedReaddir.mockImplementation(async (dirPath: string) => {
        if (dirPath === '/repo') {
          return [makeDirent('src', true)];
        }
        if (dirPath === '/repo/src') {
          return [
            makeDirent('main.ts', false),
            makeDirent('index.ts', false),
            makeDirent('helper.ts', false),
          ];
        }
        return [];
      });

      const result = await service.bootstrap('/repo', BASE_REPO_INFO);

      expect(result.entrypoints).toContain('src/main.ts');
      expect(result.entrypoints).toContain('src/index.ts');
      expect(result.entrypoints).not.toContain('src/helper.ts');
    });

    it('should detect test paths (*.spec.ts, *.test.ts, test/ dir, __tests__/ dir)', async () => {
      mockedReaddir.mockImplementation(async (dirPath: string) => {
        if (dirPath === '/repo') {
          return [
            makeDirent('src', true),
            makeDirent('test', true),
            makeDirent('__tests__', true),
          ];
        }
        if (dirPath === '/repo/src') {
          return [makeDirent('app.spec.ts', false), makeDirent('app.test.ts', false)];
        }
        if (dirPath === '/repo/test') {
          return [makeDirent('helper.ts', false)];
        }
        if (dirPath === '/repo/__tests__') {
          return [makeDirent('utils.ts', false)];
        }
        return [];
      });

      const result = await service.bootstrap('/repo', BASE_REPO_INFO);

      expect(result.testPaths.some((p) => p.includes('.spec.ts'))).toBe(true);
      expect(result.testPaths.some((p) => p.includes('.test.ts'))).toBe(true);
      expect(result.testPaths.some((p) => p.startsWith('test/'))).toBe(true);
      expect(result.testPaths.some((p) => p.startsWith('__tests__/'))).toBe(true);
    });

    it('should detect doc paths (README.md, CHANGELOG.md, CONTRIBUTING.md, docs/ dir)', async () => {
      mockedReaddir.mockImplementation(async (dirPath: string) => {
        if (dirPath === '/repo') {
          return [
            makeDirent('README.md', false),
            makeDirent('CHANGELOG.md', false),
            makeDirent('CONTRIBUTING.md', false),
            makeDirent('docs', true),
          ];
        }
        if (dirPath === '/repo/docs') {
          return [makeDirent('API.md', false)];
        }
        return [];
      });

      const result = await service.bootstrap('/repo', BASE_REPO_INFO);

      expect(result.docPaths).toContain('README.md');
      expect(result.docPaths).toContain('CHANGELOG.md');
      expect(result.docPaths).toContain('CONTRIBUTING.md');
      expect(result.docPaths.some((p) => p.startsWith('docs/'))).toBe(true);
    });

    it('should cap tree at 2000 entries and set truncated=true', async () => {
      // Generate more than 2000 files
      const manyFiles = Array.from({ length: 2100 }, (_, i) =>
        makeDirent(`file${i}.ts`, false),
      );

      mockedReaddir.mockResolvedValue(manyFiles);

      const result = await service.bootstrap('/repo', BASE_REPO_INFO);

      expect(result.tree.length).toBeLessThanOrEqual(2000);
      expect(result.truncated).toBe(true);
    });

    it('should not set truncated when tree has fewer than 2000 entries', async () => {
      mockedReaddir.mockImplementation(async (dirPath: string) => {
        if (dirPath === '/repo') {
          return [
            makeDirent('README.md', false),
            makeDirent('package.json', false),
            makeDirent('src', true),
          ];
        }
        return [];
      });

      mockedReadFile.mockResolvedValue(JSON.stringify({ name: 'test' }));

      const result = await service.bootstrap('/repo', BASE_REPO_INFO);

      expect(result.truncated).toBeFalsy();
    });

    it('should include repoInfo fields in the returned IndexPayload', async () => {
      mockedReaddir.mockResolvedValue([]);

      const customRepoInfo: RepoInfo = {
        remoteUrl: 'git@github.com:org/private.git',
        remoteName: 'upstream',
        baseBranch: 'develop',
        currentBranch: 'feature/xyz',
        isDirty: true,
        headSha: 'deadbeefdeadbeefdeadbeef1234567890abcdef',
      };

      const result: IndexPayload = await service.bootstrap('/repo', customRepoInfo);

      expect(result.remoteUrl).toBe('git@github.com:org/private.git');
      expect(result.remoteName).toBe('upstream');
      expect(result.baseBranch).toBe('develop');
      expect(result.currentBranch).toBe('feature/xyz');
      expect(result.headSha).toBe('deadbeefdeadbeefdeadbeef1234567890abcdef');
    });
  });

  describe('sync()', () => {
    const storedSha = 'abc1234def5678901234567890123456789012';
    const newSha = 'def5678abc1234901234567890123456789099';

    const baseSnapshot = {
      id: 'snap-uuid-1',
      projectId: 'project-uuid-1',
      workspacePath: '/workspace/my-repo',
      headSha: storedSha,
      remoteUrl: 'https://github.com/org/repo.git',
      remoteName: 'origin',
      baseBranch: 'main',
      currentBranch: 'main',
      isDirty: false,
      indexPayload: {} as IndexPayload,
      indexedAt: new Date(),
    } as WorkspaceSnapshot;

    it('sync returns null when headSha matches stored snapshot', async () => {
      mockSnapshotRepo.findOne.mockResolvedValue({ ...baseSnapshot });
      mockGit.revparse.mockResolvedValue(storedSha + '\n');

      const result = await service.sync('project-uuid-1');

      expect(result).toBeNull();
      expect(mockSnapshotRepo.save).not.toHaveBeenCalled();
    });

    it('sync calls bootstrap and updates snapshot when headSha differs', async () => {
      const snapshot = { ...baseSnapshot };
      mockSnapshotRepo.findOne.mockResolvedValue(snapshot);
      mockGit.revparse.mockResolvedValue(newSha + '\n');
      mockSnapshotRepo.save.mockResolvedValue({ ...snapshot, headSha: newSha });

      // Bootstrap needs readdir to not fail
      mockedReaddir.mockResolvedValue([]);

      const result = await service.sync('project-uuid-1');

      expect(result).not.toBeNull();
      expect(result).toMatchObject({
        headSha: newSha,
      });
      expect(mockSnapshotRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ headSha: newSha }),
      );
    });

    it('sync throws NotFoundException when no snapshot found', async () => {
      mockSnapshotRepo.findOne.mockResolvedValue(null);

      await expect(service.sync('non-existent-project')).rejects.toThrow(NotFoundException);
    });
  });
});
