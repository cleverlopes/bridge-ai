# Codebase Concerns

> Technical debt, known issues, security gaps, fragile areas, and missing implementations.

---

## Critical Gaps (Must Fix for MVP Completion)

### 1. Health Endpoint Contract Mismatch
- **File:** `packages/nest-core/src/module/health/health.controller.ts`
- **Issue:** Returns Terminus `HealthCheckResult` shape, not the documented `{"status":"ok","db":"connected","redis":"connected"}` contract.
- **Risk:** API consumers expecting fixed JSON shape will break.
- **Fix:** Add a `/health/simple` endpoint or document that Terminus format is the accepted contract.

### 2. Redis Health Check — Fragile Accessor
- **File:** `packages/nest-core/src/module/health/health.controller.ts`
- **Issue:** Redis ping relies on internal BullMQ client accessor (`projectEventsQueue`). Private API — may break on BullMQ version upgrades.
- **Risk:** Silent health check failures after dependency updates.
- **Fix:** Use a dedicated Redis `ping()` via `ioredis` client directly.

### 3. CLI Providers Return Zero Cost/Tokens
- **Files:**
  - `packages/bridge-sdk/src/providers/claude-cli.provider.ts` (line 54-56)
  - `packages/bridge-sdk/src/providers/gemini-cli.provider.ts` (line 59-78)
  - `packages/bridge-sdk/src/providers/custom-cli.provider.ts`
- **Issue:** `totalCostUsd: 0`, `inputTokens: 0`, `outputTokens: 0` hardcoded. CLI subprocess providers cannot introspect token usage from stdout.
- **Risk:** Cost tracking and metrics dashboards are inaccurate for projects using CLI providers.
- **Fix:** Document limitation clearly in provider config. Add optional token estimation heuristic (chars/4).

### 4. ObsidianTransport Falls Back to Wrong Path
- **File:** `packages/gsd-sdk/src/obsidian-transport.ts`
- **Issue:** Before first `PhaseStart` event fires, logs fall back to `bridge-ai-logs/<date>-pipeline.md` instead of `phases/<N>/EXECUTION-LOG.md`.
- **Risk:** Early pipeline events (cost updates, tool calls) land in the wrong vault path.
- **Fix:** Require `projectSlug` + `phaseSlug` at construction, or buffer early events and flush to correct path on first `PhaseStart`.

---

## Missing Implementations (Phase 8-10 Backlog)

### 5. Telegram Throttling Not Implemented (Phase 8)
- **File:** `packages/nest-core/src/module/telegram/telegram-bot.service.ts`
- **Issue:** No `@nestjs/throttler`, `ThrottlerModule`, or `@Throttle()` decorators anywhere in the codebase.
- **Risk:** Telegram commands are unprotected against abuse. Bots can spam commands.
- **Fix:** Add `ThrottlerModule.forRoot({ ttl: 60, limit: 10 })` and `@Throttle()` to command handlers.

### 6. Discord Module Not Started (Phase 9)
- **Status:** Not started. No files in `packages/nest-core/src/module/discord/`.
- **Impact:** Second channel support is entirely absent.

### 7. Obsidian Bidirectional Sync Missing (Phase 10)
- **File:** `packages/nest-core/src/module/obsidian/obsidian-sync.service.ts`
- **Issue:** Sync is write-only (NestJS → vault). No REST API read-back for vault edits to `CONTEXT.md`/`ROADMAP.md`.
- **Risk:** User vault edits are ignored — no bidirectional intelligence loop.

### 8. `@bridge-ai/sdk` Not Publishable (Phase 10)
- **File:** `packages/bridge-sdk/package.json`
- **Issue:** Package has no `main`/`exports` field configured for npm publishing. No `npm publish` script.
- **Risk:** FR-14 (SDK distribution) is unmet.

---

## CI / Test Coverage Gaps

### 9. Coverage Not Enforced in CI
- **File:** `.github/workflows/ci.yml`
- **Issue:** CI runs coverage reports but does not fail the pipeline when thresholds are missed. Coverage configs exist (Jest `coverageThreshold`, Vitest `thresholds`) but only enforce locally.
- **Risk:** Coverage regressions can merge silently.
- **Fix:** Add `--coverage --coverageThreshold` to CI test commands or use a separate coverage gate step.

### 10. E2E Tests Not Implemented
- **Issue:** Phase 7 planned E2E tests (full Docker Compose + `/new` + `/approve` → vault artifacts). These don't exist.
- **Risk:** Integration between Telegram → Pipeline → Obsidian not verified end-to-end.

---

## Security Concerns

### 11. Docker Socket Mounted in Compose
- **File:** `docker-compose.yml` (apps/api)
- **Issue:** `- /var/run/docker.sock:/var/run/docker.sock` gives the API container full Docker daemon access.
- **Risk:** Container escape is trivial if the API is compromised. This is an architectural trade-off (needed for `DockerService`), but should be documented.
- **Fix:** Document as known risk. Consider Docker-in-Docker or socket proxy (`tecnativa/docker-socket-proxy`) for production.

### 12. BRIDGE_MASTER_KEY Has No Rotation Path
- **File:** `packages/nest-core/src/module/ksm/ksm.service.ts`
- **Issue:** `KsmModule.rotateSecret` exists for individual secrets, but there's no mechanism to rotate the master key itself (`BRIDGE_MASTER_KEY`) without re-encrypting all secrets.
- **Risk:** Master key compromise requires full re-encryption.
- **Fix:** Document master key rotation runbook in `SECURITY.md`.

---

## Performance / Reliability

### 13. No Retry Logic on BullMQ Job Failures
- **Issue:** BullMQ consumers don't appear to have explicit `attempts` + `backoff` configuration. Failed jobs may not retry.
- **Risk:** Transient failures (network, DB hiccup) cause permanent job loss.
- **Fix:** Add `{ attempts: 3, backoff: { type: 'exponential', delay: 2000 } }` to job options.

### 14. `STACK.md` Incomplete — Missing `packages/gsd-sdk` Dependencies
- **File:** `.planning/codebase/STACK.md`
- **Note:** Mapper agent produced a partial STACK.md. Review and supplement with gsd-sdk internal dependencies.

---

## Minor Issues

### 15. `docker-compose.yml` Uses PostgreSQL 18 in Comments, 16 in Image
- **Issue:** `PROJECT.md` references PostgreSQL 18; actual compose file uses `postgres:18-alpine` but internal comment says "PostgreSQL 16". Version consistency should be verified.

### 16. `gsd-brain/` and `ai-jail/` Reference Dirs Still Present
- **Status:** Present in repo as stated in `PROJECT.md`.
- **Note:** These are reference material only and should be removed once bridge-ai implementation is complete.

---

*Last updated: 2026-04-01 — generated by gsd-codebase-mapper (concerns focus)*
