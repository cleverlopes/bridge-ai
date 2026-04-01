// Manual mock for simple-git
// Usage: import { mockGit } from '../__mocks__/simple-git'; (from test files)
// Jest will automatically use this mock when jest.mock('simple-git') is called

export const mockGit = {
  checkIsRepo: jest.fn().mockResolvedValue(true),
  getRemotes: jest.fn().mockResolvedValue([
    { name: 'origin', refs: { fetch: 'https://github.com/test/repo.git', push: 'https://github.com/test/repo.git' } },
  ]),
  status: jest.fn().mockResolvedValue({ current: 'main', files: [] }),
  revparse: jest.fn().mockResolvedValue('abc1234def5678901234567890123456789012'),
  raw: jest.fn().mockResolvedValue('origin/main\n'),
  clone: jest.fn().mockResolvedValue(undefined),
  listRemote: jest.fn().mockResolvedValue('refs/heads/main\n'),
  diff: jest.fn().mockResolvedValue(''),
  push: jest.fn().mockResolvedValue(undefined),
  addRemote: jest.fn().mockResolvedValue(undefined),
  removeRemote: jest.fn().mockResolvedValue(undefined),
  fetch: jest.fn().mockResolvedValue(undefined),
};

const simpleGit = jest.fn().mockReturnValue(mockGit);
// Also expose as default export
(simpleGit as any).default = simpleGit;
(simpleGit as any).CheckRepoActions = {
  IS_REPO_ROOT: 'root',
  BARE: 'bare',
  IS_REPO_SUBDIR: 'subdir',
};

export { simpleGit };
export default simpleGit;

export const CheckRepoActions = {
  IS_REPO_ROOT: 'root',
  BARE: 'bare',
  IS_REPO_SUBDIR: 'subdir',
};
