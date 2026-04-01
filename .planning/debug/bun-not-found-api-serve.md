---
status: awaiting_human_verify
trigger: "bun run api:serve fails because bun is not installed in this environment"
created: 2026-04-01T00:00:00Z
updated: 2026-04-01T04:40:00Z
---

## Current Focus

hypothesis: All root causes confirmed and fixed
test: Ran `npx nx run api:serve` end-to-end — NX reports "Successfully ran target serve for project api"; NestJS boots all modules; only stops due to missing PostgreSQL at localhost:5432 (expected infra dependency)
expecting: Human confirms the fix
next_action: Awaiting human verification

## Symptoms

expected: Running `bun run api:serve` (or `npx nx run api:serve`) starts the NestJS API server
actual: Command fails with "bun: command not found" / "Cannot determine the version of bun"
errors: |
  /bin/sh: 1: bun: not found
  Error: Cannot determine the version of bun.
      at getPackageManagerVersion (/workspace/node_modules/nx/src/utils/package-manager.js:246:15)
reproduction: Run `npx nx run api:serve` in /workspace
started: Environment does not have bun installed; project uses bun as package manager

## Eliminated

- hypothesis: bun binary could be installed via curl
  evidence: curl install script requires `unzip` which is not available in container
  timestamp: 2026-04-01T03:30:00Z

- hypothesis: npm install -g bun would work
  evidence: /usr/local/lib/node_modules is not writable for current user
  timestamp: 2026-04-01T03:31:00Z

## Evidence

- timestamp: 2026-04-01T03:28:00Z
  checked: package.json scripts
  found: All scripts use `bunx nx` or `bun run`; no npm/npx fallback
  implication: Every script entry point requires bun

- timestamp: 2026-04-01T03:30:00Z
  checked: npm install --prefix=$HOME/.local bun
  found: Installs bun@1.3.11 to $HOME/.local/node_modules/.bin/bun successfully
  implication: bun can be installed locally via npm into user home

- timestamp: 2026-04-01T03:31:00Z
  checked: NX bun detection code (package-manager.js:229-248)
  found: NX first checks package.json "packageManager" field, then falls back to execSync("bun --version")
  implication: Adding "packageManager": "bun@1.3.11" to package.json prevents the execSync fallback

- timestamp: 2026-04-01T03:32:00Z
  checked: node_modules/.bin symlinks
  found: node_modules/.bin/bun -> $HOME/.local/node_modules/.bin/bun (writable, npx adds .bin to PATH)
  implication: bun is now on PATH when running via npx

- timestamp: 2026-04-01T03:40:00Z
  checked: npx nx run api:serve after bun symlink + packageManager field
  found: Bun error gone; webpack builds successfully; NEW errors: gsd-sdk type mismatch in metrics.service.ts
  implication: Three TS2339 errors: tokensIn/tokensOut/modelUsed missing from GSDPhaseCompleteEvent in dist

- timestamp: 2026-04-01T03:42:00Z
  checked: packages/gsd-sdk/dist/types.d.ts vs packages/gsd-sdk/src/types.ts
  found: Source has tokensIn/tokensOut/modelUsed fields; dist/types.d.ts is STALE (missing these fields)
  implication: gsd-sdk dist was built from older version of types.ts; needs rebuild

- timestamp: 2026-04-01T03:44:00Z
  checked: dist/packages/nest-core/package.json
  found: "main": "src/index.ts" and "types": "src/index.ts" — pointing to TypeScript source files, not compiled JS
  implication: NX node executor maps @bridge-ai/nest-core to /workspace/dist/packages/nest-core, Node reads package.json and can't find .ts files at runtime

- timestamp: 2026-04-01T03:50:00Z
  checked: apps/api/main.ts NestFactory.create() call
  found: No platform adapter passed; NestJS defaults to express but only @nestjs/platform-fastify is installed
  implication: NestJS fails with "No driver (HTTP) has been selected"

- timestamp: 2026-04-01T03:55:00Z
  checked: packages/nest-core/src/__mocks__/bridge-sdk.ts and gsd-sdk.ts
  found: jest type declared as "{ fn: (...args) => unknown }" — unknown return type prevents .mockResolvedValue()/.mockReturnValue() calls
  implication: TypeScript TS2571 errors on lines 17/30/43/56/69/82 of bridge-sdk.ts and 77/93 of gsd-sdk.ts

- timestamp: 2026-04-01T04:10:00Z
  checked: spawn ps ENOENT error source
  found: node_modules/tree-kill/index.js (used by nx/src/tasks-runner/running-tasks/node-child-process.js) spawns 'ps' with no error handler on the ChildProcess — unhandled 'error' event crashes NX parent
  implication: Second kill-tree package (@nx/js's bundled one was already patched, but tree-kill is a separate npm package)

## Resolution

root_cause: |
  Five compounding issues prevented `npx nx run api:serve` from working:
  1. bun not installed: NX detects bun.lock and tries execSync('bun --version') which fails. Fix: symlink bun via `npm install --prefix=$HOME/.local bun` + `ln -sf $HOME/.local/node_modules/.bin/bun /workspace/node_modules/.bin/bun`; also add "packageManager": "bun@1.3.11" to package.json so NX reads the version from metadata instead of executing bun.
  2. Stale gsd-sdk dist: packages/gsd-sdk/dist/types.d.ts was missing tokensIn/tokensOut/modelUsed fields that the source types.ts added. Fix: rebuild gsd-sdk with `npx tsc --project tsconfig.json`.
  3. dist/packages/nest-core/package.json pointed to .ts source files: "main": "src/index.ts" instead of "src/index.js". NX's node executor maps @bridge-ai/nest-core to this dist directory; Node.js could not load the .ts file. Fix: edit dist/packages/nest-core/package.json to use "src/index.js".
  4. main.ts used NestFactory.create() without FastifyAdapter: Only @nestjs/platform-fastify is installed, but main.ts was calling NestFactory.create(AppModule) without specifying the Fastify adapter. Fix: add FastifyAdapter to NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter()).
  5. Mock type declaration used unknown return type: __mocks__/bridge-sdk.ts and __mocks__/gsd-sdk.ts declared jest.fn() as returning 'unknown', preventing chained .mockResolvedValue()/.mockReturnValue() calls. Fix: change to 'any'. Also two ps-based kill-tree packages needed patching for environments without ps: @nx/js's bundled kill-tree.js and the separate tree-kill npm package — both now use /proc filesystem on Linux.

fix: |
  1. npm install --prefix=$HOME/.local bun + symlinks in node_modules/.bin/
  2. Added "packageManager": "bun@1.3.11" to /workspace/package.json
  3. Rebuilt gsd-sdk: cd packages/gsd-sdk && npx tsc --project tsconfig.json
  4. Fixed /workspace/dist/packages/nest-core/package.json: main/types now point to .js/.d.ts
  5. Fixed /workspace/apps/api/main.ts to use FastifyAdapter
  6. Fixed /workspace/packages/nest-core/src/__mocks__/bridge-sdk.ts and gsd-sdk.ts: jest.fn() return type changed from unknown to any
  7. Patched /workspace/node_modules/@nx/js/src/executors/node/lib/kill-tree.js to use /proc on Linux
  8. Patched /workspace/node_modules/tree-kill/index.js to use /proc on Linux

verification: |
  - `npx nx run api:serve` reports "NX Successfully ran target serve for project api"
  - NestJS boots all modules: AppModule, TypeOrmModule, ConfigModule, BullModule, HealthModule, etc.
  - Only failure is DB connection (ECONNREFUSED 127.0.0.1:5432) — expected infra dependency
  - No "spawn ps ENOENT" crash
  - No "bun: not found" error
  - No TypeScript compilation errors

files_changed:
  - /workspace/package.json (added packageManager field)
  - /workspace/apps/api/main.ts (added FastifyAdapter)
  - /workspace/packages/nest-core/src/__mocks__/bridge-sdk.ts (jest fn type: unknown -> any)
  - /workspace/packages/nest-core/src/__mocks__/gsd-sdk.ts (jest fn type: unknown -> any)
  - /workspace/packages/gsd-sdk/dist/types.d.ts (rebuilt via tsc)
  - /workspace/dist/packages/nest-core/package.json (main/types fixed to .js/.d.ts)
  - /workspace/node_modules/@nx/js/src/executors/node/lib/kill-tree.js (patched: /proc-based kill)
  - /workspace/node_modules/tree-kill/index.js (patched: /proc-based kill)
  - /workspace/node_modules/.bin/bun (symlink added)
  - /workspace/node_modules/.bin/bunx (symlink added)
