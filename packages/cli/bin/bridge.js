#!/usr/bin/env node
// Bridge AI CLI entry point
// This file is the executable entry; it imports the compiled dist or tsx-run src.
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// In production (after build): import from dist
// In dev: run via tsx
const distPath = join(__dirname, '..', 'dist', 'index.js');

import(distPath).then(m => {
  if (m.main) m.main(process.argv.slice(2));
}).catch(async () => {
  // Fallback: check if tsx is available for dev mode
  const { execFileSync } = await import('child_process');
  const srcPath = join(__dirname, '..', 'src', 'index.ts');
  try {
    execFileSync('tsx', [srcPath, ...process.argv.slice(2)], { stdio: 'inherit' });
  } catch {
    console.error('bridge: dist/index.js not found. Run `bun run build` in packages/cli/ first.');
    process.exit(1);
  }
});
