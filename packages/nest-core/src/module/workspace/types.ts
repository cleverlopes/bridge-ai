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
  type: 'package.json' | 'pyproject.toml' | 'Cargo.toml' | 'go.mod' | 'pom.xml' | 'build.gradle' | 'other';
  content: string;
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
  truncated: boolean;
  indexedAt: string;
}

export interface InitWorkspaceDto {
  workspacePath: string;
  repoUrl?: string;
  projectName: string;
  slug: string;
  credentialType?: 'ssh' | 'https';
  credentialValue?: string;
}

export interface InitWorkspaceResult {
  projectId: string;
  workspacePath: string;
  repoInfo: RepoInfo;
  indexedAt: string;
}
