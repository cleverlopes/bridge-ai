/**
 * DaemonClient — thin HTTP client for the bridge daemon REST API.
 * Uses Node built-in fetch (Node 18+). No external HTTP library needed.
 */

export interface InitWorkspaceRequest {
  workspacePath: string;
  repoUrl?: string;
  projectName: string;
  slug: string;
  credentialType?: 'ssh' | 'https';
  credentialValue?: string;
}

export interface InitWorkspaceResponse {
  success: boolean;
  projectId?: string;
  slug: string;
  snapshotId?: string;
  vaultDocs?: string[];
  error?: string;
}

export class DaemonClient {
  private readonly baseUrl: string;

  constructor(baseUrl = 'http://localhost:3000') {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  async isHealthy(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/health`, {
        signal: AbortSignal.timeout(2000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async initWorkspace(req: InitWorkspaceRequest): Promise<InitWorkspaceResponse> {
    const res = await fetch(`${this.baseUrl}/internal/workspaces/init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`POST /internal/workspaces/init failed (${res.status}): ${body}`);
    }

    return res.json() as Promise<InitWorkspaceResponse>;
  }
}
