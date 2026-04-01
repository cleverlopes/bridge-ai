import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { PromotionService } from '../promotion.service';

// Mock simple-git
jest.mock('simple-git');
import { mockGit } from '../../../__mocks__/simple-git';

// Mock node:fs/promises for patch file operations
jest.mock('node:fs/promises', () => ({
  writeFile: jest.fn().mockResolvedValue(undefined),
  unlink: jest.fn().mockResolvedValue(undefined),
}));

// Mock node:os for tmpdir
jest.mock('node:os', () => ({
  tmpdir: jest.fn().mockReturnValue('/tmp'),
}));

describe('PromotionService', () => {
  let service: PromotionService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [PromotionService],
    }).compile();

    service = module.get<PromotionService>(PromotionService);
  });

  describe('promoteViaPatch()', () => {
    it('should generate diff and apply patch to host workspace', async () => {
      const nonEmptyDiff = 'diff --git a/src/file.ts b/src/file.ts\n+new line\n';
      mockGit.diff.mockResolvedValue(nonEmptyDiff);
      mockGit.raw.mockResolvedValue('');

      await service.promoteViaPatch('run-abc123', '/host/repo');

      // Should call diff to get changes
      expect(mockGit.diff).toHaveBeenCalled();
      // Should apply the patch on the host git instance
      expect(mockGit.raw).toHaveBeenCalledWith(
        expect.arrayContaining(['apply', '--3way']),
      );
    });

    it('should throw BadRequestException when diff is empty', async () => {
      mockGit.diff.mockResolvedValue('');

      await expect(service.promoteViaPatch('run-abc123', '/host/repo')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.promoteViaPatch('run-abc123', '/host/repo')).rejects.toThrow(
        'No changes to promote',
      );
    });
  });

  describe('promoteViaCherryPick()', () => {
    it('should add ephemeral as remote, fetch, and cherry-pick commits into host', async () => {
      mockGit.addRemote.mockResolvedValue(undefined);
      mockGit.fetch.mockResolvedValue(undefined);
      mockGit.raw.mockResolvedValue('');
      mockGit.removeRemote.mockResolvedValue(undefined);

      const commitShas = ['sha1111', 'sha2222'];
      await service.promoteViaCherryPick('run-abc123', '/host/repo', commitShas);

      expect(mockGit.addRemote).toHaveBeenCalled();
      expect(mockGit.fetch).toHaveBeenCalled();
      expect(mockGit.raw).toHaveBeenCalledWith(['cherry-pick', 'sha1111']);
      expect(mockGit.raw).toHaveBeenCalledWith(['cherry-pick', 'sha2222']);
    });

    it('should throw BadRequestException when no commit SHAs provided', async () => {
      await expect(
        service.promoteViaCherryPick('run-abc123', '/host/repo', []),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('promoteViaPush()', () => {
    it('should push the run branch to the remote from the ephemeral workspace', async () => {
      mockGit.push.mockResolvedValue(undefined);

      await service.promoteViaPush('run-abc123', 'origin', 'feature/my-branch');

      expect(mockGit.push).toHaveBeenCalledWith('origin', 'feature/my-branch');
    });
  });
});
