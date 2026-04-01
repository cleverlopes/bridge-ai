export interface RepoInfo {
  remoteUrl: string | null;
  remoteName: string | null;
  baseBranch: string;
  currentBranch: string;
  isDirty: boolean;
  headSha: string;
}

export interface ManifestEntry {
  path: string;
  type: string;
  content: Record<string, unknown>;
}

export interface IndexPayload {
  tree: string[];
  manifests: ManifestEntry[];
  entrypoints: string[];
  testPaths: string[];
  docPaths: string[];
  remoteUrl: string | null;
  remoteName: string | null;
  baseBranch: string;
  currentBranch: string;
  headSha: string;
  indexedAt: string;
  truncated?: boolean;
}

export interface InitWorkspaceDto {
  workspacePath: string;
  repoUrl?: string;
  projectName: string;
  slug: string;
}
