---
status: investigating
trigger: "bun run api:serve fails because bun is not installed in this environment"
created: 2026-04-01T00:00:00Z
updated: 2026-04-01T00:00:00Z
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: bun is not installed; need to either install bun or find a bun-free way to run the NestJS API
test: investigate apps/api project.json and nest-core entry point to understand what nx:serve does
expecting: either install bun via npm/curl or run the app directly with ts-node/node
next_action: read apps/api project.json and find the entry point

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: Running `bun run api:serve` (or `npx nx run api:serve`) starts the NestJS API server
actual: Command fails with "bun: command not found" / "Cannot determine the version of bun"
errors: |
  /bin/sh: 1: bun: not found
  Error: Cannot determine the version of bun.
      at getPackageManagerVersion (/workspace/node_modules/nx/src/utils/package-manager.js:246:15)
reproduction: Run `npx nx run api:serve` in /workspace
started: Environment does not have bun installed; project uses bun as package manager

## Eliminated
<!-- APPEND only - prevents re-investigating -->

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-04-01T00:00:00Z
  checked: package.json scripts
  found: All scripts use `bunx nx` or `bun run`; no npm/npx fallback
  implication: Every script entry point requires bun

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause:
fix:
verification:
files_changed: []
