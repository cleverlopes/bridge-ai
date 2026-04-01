/**
 * bridge init — workspace onboarding command.
 *
 * Lazy daemon pattern:
 *   1. Check GET /health — if responding, use running daemon.
 *   2. If not responding, spawn daemon process in background.
 *   3. Poll GET /health until healthy (up to 15 seconds).
 *   4. Call POST /workspaces/init with the workspace path.
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { resolve } from 'node:path';
import { DaemonClient } from '../client.js';

export interface InitOptions {
  workspace: string;
  repo?: string;
  credentialType?: 'ssh' | 'https';
  port?: number;
  daemonBin?: string;
  name?: string;
  slug?: string;
}

const DEFAULT_PORT = 3000;
const DAEMON_STARTUP_TIMEOUT_MS = 15_000;
const HEALTH_POLL_INTERVAL_MS = 500;

/**
 * Spawn the bridge daemon process in the background.
 * Returns the child process (detached, stdio ignored for true background).
 * Throws a descriptive Error (instead of crashing with ENOENT) when the binary is not found.
 */
export function spawnDaemon(daemonBin: string, port: number): ChildProcess {
  const child = spawn(daemonBin, [], {
    env: { ...process.env, PORT: String(port) },
    stdio: 'ignore',
    detached: true,
  });
  child.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'ENOENT') {
      throw new Error(
        `bridgeai: cannot find daemon binary "${daemonBin}".\n` +
        `  Make sure the daemon is running, or pass --daemon-bin <path> to specify its location.\n` +
        `  To start the daemon manually: cd apps/api && bun run start:dev`,
      );
    }
    throw err;
  });
  child.unref();
  return child;
}

/**
 * Wait until the daemon is healthy or timeout elapses.
 */
async function waitForDaemon(client: DaemonClient, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await client.isHealthy()) return true;
    await new Promise(r => setTimeout(r, HEALTH_POLL_INTERVAL_MS));
  }
  return false;
}

/**
 * Run the bridge init command.
 */
export async function runInit(options: InitOptions): Promise<void> {
  const port = options.port ?? DEFAULT_PORT;
  const workspacePath = resolve(options.workspace);
  const projectName = options.name ?? workspacePath.split('/').pop() ?? 'unnamed';
  const projectSlug = options.slug ?? projectName.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '');
  const client = new DaemonClient(`http://localhost:${port}`);

  // Step 1: Check if daemon is already running
  const isRunning = await client.isHealthy();

  if (!isRunning) {
    // Step 2: Spawn daemon
    const daemonBin = options.daemonBin ?? 'bridge-daemon';
    console.log(`bridgeai: daemon not running on port ${port}, spawning ${daemonBin}...`);
    spawnDaemon(daemonBin, port);

    // Step 3: Wait for daemon to be healthy
    console.log(`bridgeai: waiting for daemon to start (up to ${DAEMON_STARTUP_TIMEOUT_MS / 1000}s)...`);
    const ready = await waitForDaemon(client, DAEMON_STARTUP_TIMEOUT_MS);
    if (!ready) {
      throw new Error(
        `bridge: daemon did not start within ${DAEMON_STARTUP_TIMEOUT_MS / 1000}s. ` +
          `Check that ${daemonBin} is in PATH and the port ${port} is available.`,
      );
    }
    console.log('bridgeai: daemon is ready.');
  }

  // Step 4: Call init endpoint
  console.log(`bridgeai: initializing workspace at ${workspacePath}...`);
  const result = await client.initWorkspace({
    workspacePath,
    repoUrl: options.repo,
    credentialType: options.credentialType,
    projectName,
    slug: projectSlug,
  });

  console.log('bridgeai: workspace initialized.');
  if (result.success) {
    console.log(`  projectId: ${result.projectId ?? '(pending)'}`);
    console.log(`  slug:      ${result.slug}`);
    if (result.vaultDocs?.length) {
      console.log(`  vaultDocs: ${result.vaultDocs.join(', ')}`);
    }
  } else {
    console.error(`bridgeai: onboarding failed: ${result.error ?? 'unknown error'}`);
    process.exit(1);
  }
}
