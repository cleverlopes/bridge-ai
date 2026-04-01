export type ProviderType =
  | 'openrouter'
  | 'gemini'
  | 'openai'
  | 'claude-cli'
  | 'gemini-cli'
  | 'custom-cli';

export interface ProviderConfig {
  type: ProviderType;
  model?: string;
  /** Pre-resolved API key — never stored in config directly, passed at runtime from KSM */
  apiKey?: string;
  /** For openai-compatible endpoints */
  baseUrl?: string;
  /** For custom-cli provider */
  command?: string;
  /** For custom-cli provider */
  args?: string[];
}
