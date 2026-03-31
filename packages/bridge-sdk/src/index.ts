/**
 * @bridge-ai/bridge-sdk — Public API for bridge-ai integration.
 */

export { Pipeline } from './pipeline.js';
export type { PipelineOptions, PipelineResult } from './pipeline.js';

export {
  AnthropicProviderStub,
  OpenAIProviderStub,
  AzureOpenAIProviderStub,
} from './providers/index.js';
export type { ProviderAdapter } from './providers/index.js';

export { ObsidianClient } from './obsidian-client.js';
export type { ObsidianVaultConfig, VaultNote, VaultSearchResult } from './obsidian-client.js';
