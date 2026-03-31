/**
 * ObsidianClient stub — interface for reading/writing Obsidian vault files.
 *
 * Full implementation in Phase 2 when vault integration is wired.
 */

export interface ObsidianVaultConfig {
  vaultPath: string;
  apiUrl?: string;
  apiKey?: string;
}

export interface VaultNote {
  path: string;
  content: string;
  frontmatter?: Record<string, unknown>;
  updatedAt?: Date;
}

export interface VaultSearchResult {
  path: string;
  score: number;
  excerpt: string;
}

/**
 * ObsidianClient stub — Phase 2 will implement local REST API + file system reads.
 */
export class ObsidianClient {
  private readonly config: ObsidianVaultConfig;

  constructor(config: ObsidianVaultConfig) {
    this.config = config;
  }

  get vaultPath(): string {
    return this.config.vaultPath;
  }

  /**
   * Read a note from the vault by path.
   */
  async readNote(_notePath: string): Promise<VaultNote> {
    throw new Error('ObsidianClient not yet implemented (Phase 2)');
  }

  /**
   * Write or update a note in the vault.
   */
  async writeNote(_notePath: string, _content: string): Promise<void> {
    throw new Error('ObsidianClient not yet implemented (Phase 2)');
  }

  /**
   * Search vault notes using semantic or full-text search.
   */
  async search(_query: string): Promise<VaultSearchResult[]> {
    throw new Error('ObsidianClient not yet implemented (Phase 2)');
  }
}
