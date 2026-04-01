import { Test, TestingModule } from '@nestjs/testing';
import { resolve, join } from 'node:path';
import { EphemeralWorkspaceService } from '../ephemeral-workspace.service';

// Mock simple-git
jest.mock('simple-git');
import simpleGit from 'simple-git';
import { mockGit } from '../../../__mocks__/simple-git';

// Mock node:fs/promises
jest.mock('node:fs/promises', () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  rm: jest.fn().mockResolvedValue(undefined),
}));

import { mkdir, rm } from 'node:fs/promises';

const RUNS_BASE = resolve(process.cwd(), 'volumes', 'runs');

describe('EphemeralWorkspaceService', () => {
  let service: EphemeralWorkspaceService;

  beforeEach(async () => {
    jest.clearAllMocks();
    (simpleGit as jest.Mock).mockReturnValue(mockGit);

    const module: TestingModule = await Test.createTestingModule({
      providers: [EphemeralWorkspaceService],
    }).compile();

    service = module.get<EphemeralWorkspaceService>(EphemeralWorkspaceService);
  });

  describe('cloneForRun', () => {
    it('calls mkdir with { recursive: true } for the runs base directory', async () => {
      const hostPath = '/host/repo';
      const runId = 'run-abc123';

      await service.cloneForRun(hostPath, runId);

      expect(mkdir).toHaveBeenCalledWith(RUNS_BASE, { recursive: true });
    });

    it('calls simpleGit().clone with --local and --no-hardlinks flags', async () => {
      const hostPath = '/host/repo';
      const runId = 'run-abc123';
      const expectedRunPath = join(RUNS_BASE, runId);

      await service.cloneForRun(hostPath, runId);

      expect(mockGit.clone).toHaveBeenCalledWith(hostPath, expectedRunPath, ['--local', '--no-hardlinks']);
    });

    it('returns the run path matching volumes/runs/<runId>', async () => {
      const hostPath = '/host/repo';
      const runId = 'run-xyz789';
      const expectedRunPath = join(RUNS_BASE, runId);

      const result = await service.cloneForRun(hostPath, runId);

      expect(result).toBe(expectedRunPath);
    });
  });

  describe('cleanupRun', () => {
    it('calls rm with { recursive: true, force: true }', async () => {
      const runId = 'run-cleanup-test';
      const expectedRunPath = join(RUNS_BASE, runId);

      await service.cleanupRun(runId);

      expect(rm).toHaveBeenCalledWith(expectedRunPath, { recursive: true, force: true });
    });

    it('does not throw when rm succeeds', async () => {
      const runId = 'run-no-throw';
      await expect(service.cleanupRun(runId)).resolves.toBeUndefined();
    });
  });

  describe('getRunPath', () => {
    it('returns the correct path for a runId', () => {
      const runId = 'my-run-id';
      const expected = join(RUNS_BASE, runId);
      expect(service.getRunPath(runId)).toBe(expected);
    });
  });
});
