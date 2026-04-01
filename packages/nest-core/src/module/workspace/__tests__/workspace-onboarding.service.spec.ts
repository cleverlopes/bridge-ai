import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { WorkspaceOnboardingService } from '../workspace-onboarding.service';
import { WorkspaceSnapshot } from '../../../persistence/entity/workspace-snapshot.entity';
import { Project } from '../../../persistence/entity/project.entity';
import { KsmService } from '../../ksm/ksm.service';
import { RepoIndexerService } from '../repo-indexer.service';
import { IndexPayload, RepoInfo } from '../types';

// Mock simple-git
jest.mock('simple-git');
import simpleGit from 'simple-git';
import { mockGit } from '../../../__mocks__/simple-git';

// Mock node:fs/promises
jest.mock('node:fs/promises', () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
  access: jest.fn().mockRejectedValue({ code: 'ENOENT' }),
}));

import * as fsPromises from 'node:fs/promises';

const makeSnapshotRepo = (): jest.Mocked<Repository<WorkspaceSnapshot>> =>
  ({
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
  }) as unknown as jest.Mocked<Repository<WorkspaceSnapshot>>;

const makeProjectRepo = (): jest.Mocked<Repository<Project>> =>
  ({
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
  }) as unknown as jest.Mocked<Repository<Project>>;

const makeKsmService = (): jest.Mocked<KsmService> =>
  ({
    createSecret: jest.fn(),
    getSecret: jest.fn(),
  }) as unknown as jest.Mocked<KsmService>;

const makeRepoIndexerService = (): jest.Mocked<RepoIndexerService> =>
  ({
    bootstrap: jest.fn().mockResolvedValue({}),
    sync: jest.fn().mockResolvedValue(null),
  }) as unknown as jest.Mocked<RepoIndexerService>;

const mockRepoInfo: RepoInfo = {
  remoteUrl: 'https://github.com/test/repo.git',
  remoteName: 'origin',
  baseBranch: 'main',
  currentBranch: 'main',
  isDirty: false,
  headSha: 'abc1234def5678901234567890123456789012',
};

const mockIndexPayload: IndexPayload = {
  tree: ['src/', 'package.json'],
  manifests: [{ path: 'package.json', type: 'package.json', content: '{"name":"test"}' }],
  entrypoints: ['src/main.ts'],
  testPaths: ['src/__tests__/'],
  docPaths: ['README.md'],
  remoteUrl: 'https://github.com/test/repo.git',
  remoteName: 'origin',
  baseBranch: 'main',
  currentBranch: 'main',
  headSha: 'abc1234def5678901234567890123456789012',
  truncated: false,
  indexedAt: '2026-04-01T00:00:00.000Z',
};

describe('WorkspaceOnboardingService', () => {
  let service: WorkspaceOnboardingService;
  let snapshotRepo: jest.Mocked<Repository<WorkspaceSnapshot>>;
  let projectRepo: jest.Mocked<Repository<Project>>;
  let ksmService: jest.Mocked<KsmService>;
  let repoIndexer: jest.Mocked<RepoIndexerService>;

  beforeEach(async () => {
    snapshotRepo = makeSnapshotRepo();
    projectRepo = makeProjectRepo();
    ksmService = makeKsmService();
    repoIndexer = makeRepoIndexerService();

    // Reset mockGit before each test
    jest.clearAllMocks();
    (simpleGit as jest.Mock).mockReturnValue(mockGit);
    mockGit.checkIsRepo.mockResolvedValue(true);
    mockGit.getRemotes.mockResolvedValue([
      { name: 'origin', refs: { fetch: 'https://github.com/test/repo.git', push: 'https://github.com/test/repo.git' } },
    ]);
    mockGit.status.mockResolvedValue({ current: 'main', files: [] });
    mockGit.revparse.mockResolvedValue('abc1234def5678901234567890123456789012');
    mockGit.raw.mockResolvedValue('origin/main\n');
    mockGit.clone.mockResolvedValue(undefined);
    mockGit.listRemote.mockResolvedValue('refs/heads/main\n');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkspaceOnboardingService,
        { provide: getRepositoryToken(WorkspaceSnapshot), useValue: snapshotRepo },
        { provide: getRepositoryToken(Project), useValue: projectRepo },
        { provide: KsmService, useValue: ksmService },
        { provide: RepoIndexerService, useValue: repoIndexer },
      ],
    }).compile();

    service = module.get<WorkspaceOnboardingService>(WorkspaceOnboardingService);
  });

  describe('validateRepo', () => {
    it('throws BadRequestException when path is not a git repo', async () => {
      mockGit.checkIsRepo.mockResolvedValue(false);

      await expect(service.validateRepo('/not/a/repo')).rejects.toThrow(BadRequestException);
    });

    it('returns RepoInfo with metadata from valid git repo', async () => {
      const result = await service.validateRepo('/valid/repo');

      expect(result).toMatchObject({
        remoteUrl: 'https://github.com/test/repo.git',
        remoteName: 'origin',
        baseBranch: 'main',
        currentBranch: 'main',
        isDirty: false,
        headSha: 'abc1234def5678901234567890123456789012',
      });
      expect(mockGit.checkIsRepo).toHaveBeenCalledWith('root');
      expect(mockGit.getRemotes).toHaveBeenCalledWith(true);
      expect(mockGit.status).toHaveBeenCalled();
      expect(mockGit.revparse).toHaveBeenCalledWith(['HEAD']);
    });

    it('falls back to "main" when symbolic-ref fails', async () => {
      mockGit.raw.mockRejectedValue(new Error('no symbolic-ref'));

      const result = await service.validateRepo('/valid/repo');

      expect(result.baseBranch).toBe('main');
    });
  });

  describe('validateCredentials', () => {
    it('stores SSH key via KsmService with correct name and scope', async () => {
      const projectId = 'test-project-id';
      ksmService.createSecret.mockResolvedValue({} as any);

      await service.validateCredentials(projectId, '/workspace', mockRepoInfo, {
        type: 'ssh',
        key: 'ssh-private-key-pem',
      });

      expect(ksmService.createSecret).toHaveBeenCalledWith(
        `workspace-ssh-key-${projectId}`,
        'ssh-private-key-pem',
        'project',
        projectId,
      );
    });

    it('stores HTTPS PAT via KsmService with correct name and scope', async () => {
      const projectId = 'test-project-id';
      ksmService.createSecret.mockResolvedValue({} as any);

      await service.validateCredentials(projectId, '/workspace', mockRepoInfo, {
        type: 'https',
        pat: 'ghp_token123',
      });

      expect(ksmService.createSecret).toHaveBeenCalledWith(
        `workspace-https-pat-${projectId}`,
        'ghp_token123',
        'project',
        projectId,
      );
    });

    it('runs git.listRemote to verify read access', async () => {
      ksmService.createSecret.mockResolvedValue({} as any);

      await service.validateCredentials('proj-id', '/workspace', mockRepoInfo, {
        type: 'https',
        pat: 'token',
      });

      expect(mockGit.listRemote).toHaveBeenCalledWith(
        ['--heads', mockRepoInfo.remoteUrl],
      );
    });
  });

  describe('persistSnapshot', () => {
    it('creates new snapshot when none exists for projectId', async () => {
      snapshotRepo.findOne.mockResolvedValue(null);
      const savedSnapshot = { id: 'snap-1', projectId: 'proj-1' } as WorkspaceSnapshot;
      snapshotRepo.create.mockReturnValue(savedSnapshot);
      snapshotRepo.save.mockResolvedValue(savedSnapshot);

      const result = await service.persistSnapshot('proj-1', '/workspace/path', mockRepoInfo, mockIndexPayload);

      expect(snapshotRepo.findOne).toHaveBeenCalledWith({ where: { projectId: 'proj-1' } });
      expect(snapshotRepo.save).toHaveBeenCalled();
      expect(result).toBe(savedSnapshot);
    });

    it('updates existing snapshot when one exists for projectId', async () => {
      const existingSnapshot = { id: 'snap-1', projectId: 'proj-1', headSha: 'old' } as WorkspaceSnapshot;
      snapshotRepo.findOne.mockResolvedValue(existingSnapshot);
      snapshotRepo.save.mockResolvedValue({ ...existingSnapshot, headSha: mockRepoInfo.headSha } as WorkspaceSnapshot);

      const result = await service.persistSnapshot('proj-1', '/workspace/path', mockRepoInfo, mockIndexPayload);

      expect(snapshotRepo.save).toHaveBeenCalled();
      expect(result.headSha).toBe(mockRepoInfo.headSha);
    });
  });

  describe('generateVaultDocs', () => {
    it('writes 5 vault doc files to the project obsidian directory', async () => {
      await service.generateVaultDocs('my-project', mockIndexPayload);

      const mockWriteFile = fsPromises.writeFile as jest.Mock;
      // Should write exactly 5 files
      expect(mockWriteFile).toHaveBeenCalledTimes(5);

      // Verify file names include all 5 required docs
      const writtenPaths: string[] = mockWriteFile.mock.calls.map((call: [string, ...unknown[]]) => call[0]);
      expect(writtenPaths.some((p: string) => p.endsWith('project.md'))).toBe(true);
      expect(writtenPaths.some((p: string) => p.endsWith('architecture.md'))).toBe(true);
      expect(writtenPaths.some((p: string) => p.endsWith('stack.md'))).toBe(true);
      expect(writtenPaths.some((p: string) => p.endsWith('decisions.md'))).toBe(true);
      expect(writtenPaths.some((p: string) => p.endsWith('runbook.md'))).toBe(true);
    });
  });

  describe('initWorkspace', () => {
    it('calls validateRepo and persistSnapshot for valid workspace path', async () => {
      const mockProject = { id: 'proj-1', slug: 'test-proj', name: 'Test Project' } as Project;
      const mockSnapshot = { id: 'snap-1', projectId: 'proj-1' } as WorkspaceSnapshot;

      projectRepo.findOne.mockResolvedValue(null);
      projectRepo.create.mockReturnValue(mockProject);
      projectRepo.save.mockResolvedValue(mockProject);
      snapshotRepo.findOne.mockResolvedValue(null);
      snapshotRepo.create.mockReturnValue(mockSnapshot);
      snapshotRepo.save.mockResolvedValue(mockSnapshot);

      const result = await service.initWorkspace({
        workspacePath: '/valid/repo',
        projectName: 'Test Project',
        slug: 'test-proj',
      });

      expect(result).toHaveProperty('project');
      expect(result).toHaveProperty('snapshot');
      expect(mockGit.checkIsRepo).toHaveBeenCalled();
    });

    it('clones repo when repoUrl is provided', async () => {
      const mockProject = { id: 'proj-1', slug: 'test-proj', name: 'Test Project' } as Project;
      const mockSnapshot = { id: 'snap-1', projectId: 'proj-1' } as WorkspaceSnapshot;

      projectRepo.findOne.mockResolvedValue(null);
      projectRepo.create.mockReturnValue(mockProject);
      projectRepo.save.mockResolvedValue(mockProject);
      snapshotRepo.findOne.mockResolvedValue(null);
      snapshotRepo.create.mockReturnValue(mockSnapshot);
      snapshotRepo.save.mockResolvedValue(mockSnapshot);

      await service.initWorkspace({
        workspacePath: '/cloned/repo',
        repoUrl: 'https://github.com/test/repo.git',
        projectName: 'Test Project',
        slug: 'test-proj',
      });

      expect(mockGit.clone).toHaveBeenCalledWith(
        'https://github.com/test/repo.git',
        '/cloned/repo',
      );
    });
  });
});
