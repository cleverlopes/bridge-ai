/**
 * @bridge-ai/cli — Bridge AI CLI entry point.
 *
 * Usage:
 *   bridge init --workspace <path> [--repo <url>] [--port <port>]
 *   bridge --help
 *   bridge --version
 */

import { runInit } from './commands/init.js';

const VERSION = '0.1.0';

function printHelp(): void {
  console.log(
    `
bridge — Bridge AI CLI

Usage:
  bridge init --workspace <path> [options]
  bridge --help
  bridge --version

Commands:
  init        Initialize and onboard a workspace

Options for init:
  --workspace <path>   Path to the local git repository (required)
  --repo <url>         Remote repo URL to clone (optional)
  --credential-type    'ssh' or 'https' (optional)
  --port <port>        Daemon port (default: 3000)
  --daemon-bin <bin>   Daemon executable name (default: bridge-daemon)
`.trim(),
  );
}

function parseArgs(argv: string[]): { command?: string; flags: Record<string, string | boolean> } {
  const flags: Record<string, string | boolean> = {};
  let command: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else if (!command) {
      command = arg;
    }
  }

  return { command, flags };
}

export async function main(argv: string[]): Promise<void> {
  const { command, flags } = parseArgs(argv);

  if (flags['help'] || flags['h'] || !command) {
    printHelp();
    return;
  }

  if (flags['version'] || flags['v']) {
    console.log(`bridge v${VERSION}`);
    return;
  }

  if (command === 'init') {
    const workspace = flags['workspace'];
    if (!workspace || typeof workspace !== 'string') {
      console.error('bridge init: --workspace <path> is required');
      process.exit(1);
    }

    await runInit({
      workspace,
      repo: typeof flags['repo'] === 'string' ? flags['repo'] : undefined,
      credentialType:
        flags['credential-type'] === 'ssh'
          ? 'ssh'
          : flags['credential-type'] === 'https'
            ? 'https'
            : undefined,
      port: typeof flags['port'] === 'string' ? parseInt(flags['port'], 10) : undefined,
      daemonBin:
        typeof flags['daemon-bin'] === 'string' ? flags['daemon-bin'] : undefined,
    });
    return;
  }

  console.error(`bridge: unknown command '${command}'. Run 'bridge --help'.`);
  process.exit(1);
}

// Allow running directly via tsx or after build
main(process.argv.slice(2)).catch(err => {
  console.error(`bridge: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
