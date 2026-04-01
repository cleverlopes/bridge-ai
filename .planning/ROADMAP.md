# Roadmap: bridge-ai

**Version:** 1.0.0-alpha → 1.0.0
**Created:** 2026-04-01
**Status:** In Progress — Milestone 2 active

---

## Project Goal

Build bridge-ai as an intelligence factory: a platform that transforms natural language intent into organized, structured knowledge in an Obsidian vault and PostgreSQL, while autonomously executing work through isolated Docker containers and a GSD-inspired structured lifecycle engine.

---

## Milestone 1 — MVP: Intelligence Core ✅ COMPLETE

**Goal:** End-to-end flow works for at least one real project without manual intervention. The Obsidian vault contains a complete, navigable record of everything the system produced.

**Status:** All 6 phases complete. Committed: `b39e387`, `4496a93`, `2531ab0`, `f0e37da`, `8870803`, `08a9269`

---

## Milestone 2 — Production Hardening + SDK Release

**Goal:** ≥80% test coverage enforced in CI, production security hardening documented, Discord as a second channel, Obsidian REST API bidirectional sync, and `@bridge-ai/bridge-sdk` published as an npm package.

**Status:** Phases 7–8 mostly complete; Phases 9–10 pending.

---

## Phases

---

### Phase 1 — Foundation: Monorepo + PostgreSQL + KSM + GSD SDK Port ✅

**Status:** Complete
**Commit:** `be584f0`, `3e89770`, `02a9f92`

**Completed deliverables:**
- Nx monorepo: `apps/api`, `packages/gsd-sdk`, `packages/bridge-sdk`, `packages/nest-core`
- TypeORM schema + migration (`1711843200000-InitialSchema.ts`)
- KSM: AES-256-GCM encryption, `SecretAudit`, `BRIDGE_MASTER_KEY`
- BullMQ queue definitions: `project.events`, `execution.jobs`, `workflow.events`
- `GET /health` returns `{status: "ok"|"error", db: "connected"|"error", redis: "connected"|"error"}`
- `packages/gsd-sdk` ProviderAdapter adaptation complete
- `docker-compose.yml`: PostgreSQL 18, Redis 7, app

---

### Phase 2 — Brain Module: AI-Agnostic Provider Layer ✅

**Status:** Complete
**Commit:** `8870803`

**Completed deliverables:**
- `BrainService.generate(prompt, projectId)` with provider resolution from KSM
- All 6 provider implementations in `packages/bridge-sdk/src/providers/`
- Fallback chain: OpenRouter → Gemini → OpenAI → Claude CLI
- `BrainService` implements `ProviderAdapter` interface from `packages/gsd-sdk`

---

### Phase 3 — Telegram Channel Adapter + Plan Lifecycle ✅

**Status:** Complete
**Commit:** `08a9269`

**Completed deliverables:**
- `TelegramBotService` with full command set, `TelegramThrottlerGuard` (10/60s per chat)
- Plan state machine with `FOR UPDATE SKIP LOCKED`
- Crash recovery: `PlanService.onModuleInit()` re-queues `executing` plans
- `ProjectEventsWorker` marks events processed/failed

---

### Phase 4 — Pipeline Module: Full GSD Lifecycle Execution ✅

**Status:** Complete
**Commit:** `2531ab0`, `f0e37da`

**Completed deliverables:**
- `PipelineService.executeProject()` — BullMQ → GSD `PhaseRunner` → transports
- `HumanGateBridge` + `WorkflowEventsWorker` — pause/resume wired through Telegram replies
- `WorkspaceService` provisions `.planning/` workspace before execution
- Pipeline events forwarded to Telegram (PhaseStart, PhaseComplete, CostUpdate, HumanGate)

---

### Phase 5 — Docker Sandbox Integration ✅

**Status:** Complete
**Commit:** `b39e387`

**Completed deliverables:**
- `DockerService`: `createContainer`, `execInContainer`, `stopContainer`, `removeContainer`
- Container hardening: read-only rootfs, `cap-drop=ALL`, uid 1000, isolated bridge network
- Container lifecycle tied to plan terminal states

---

### Phase 6 — Obsidian Intelligence Vault Sync ✅

**Status:** Complete
**Commit:** `4496a93`

**Completed deliverables:**
- `ObsidianSyncService.syncProject()` mirrors ROADMAP, STATE, PLANs, VERIFICATIONs, SUMMARYs to `projects/<slug>/`
- PARA vault structure, `index.md`, `metrics.md`, `RULES-AND-CONVENTIONS.md`, `Templates/`
- `ObsidianTransport` writes `EXECUTION-LOG.md` under `phases/<N>/` in real-time
- `MetricsService` records per-phase timing/cost/tokens to `execution_metrics`

---

### Phase 7 — Test Coverage and CI ✅ (with gap)

**Status:** Mostly complete — one gap remaining
**Commit:** `070c791`

**Completed:**
- Jest test suite for all `packages/nest-core` modules (80%+ threshold configured)
- Vitest test suite for `packages/gsd-sdk` and `packages/bridge-sdk`
- GitHub Actions CI (`.github/workflows/ci.yml`) runs tests on push

**Gap:**
- CI does not fail when coverage drops below 80% (reports only; no gate)

**Remaining work:**
- [ ] Add `--coverageThreshold` enforcement to CI test commands or separate coverage gate step

**Complexity:** XS | **Milestone:** Production Hardening

---

### Phase 8 — Security Hardening ✅ (with gap)

**Status:** Mostly complete — docs missing
**Implementation verified:** 2026-04-01

**Completed:**
- `ThrottlerModule` + `TelegramThrottlerGuard` — 10 req/60s per chat, applied via middleware to all commands ✅
- `SecretAudit` entity records every KSM access with caller + timestamp ✅
- `KsmService.rotateSecret()` atomic re-encryption ✅
- Docker: `ReadonlyRootfs`, `CapDrop=ALL`, `no-new-privileges`, uid 1000 ✅

**Gap:**
- `docs/SECURITY.md` not created (deployment checklist, master key rotation runbook, KSM architecture)

**Note:** Old `VERIFICATION.md` incorrectly reported throttling as missing. Verified: `TelegramThrottlerGuard` is fully implemented with in-memory sliding window.

**Remaining work:**
- [ ] Write `docs/SECURITY.md`

**Complexity:** XS | **Milestone:** Production Hardening

---

### Phase 9 — Discord Channel Adapter

**Status:** Not started

**Objective:** Add Discord as a second input channel. Core pipeline unchanged — new NestJS module only.

**Complexity:** M | **Dependencies:** Phase 3 (canonical event pattern established) | **Milestone:** Production Hardening

**Deliverables:**
- `packages/nest-core/src/module/discord/` — `DiscordModule`, `DiscordBotService`, slash commands (/new, /done, /approve, /stop, /retry), `CanonicalPayloadBuilder`, `DiscordNotifier`
- Discord bot token stored in KSM (`discord-bot-token`)
- `docker-compose.yml` updated with `discord-bot` service
- `docs/CHANNELS.md` — setup guide for Telegram and Discord

**Success Criteria:**
- [ ] `/new project|Node|API|no` in Discord initiates a project (plan created in PostgreSQL)
- [ ] Zero changes to PipelineModule, PlanModule, DockerModule, or ObsidianModule
- [ ] Discord token retrieved from KSM, never from env directly
- [ ] Discord bot starts without Discord token (graceful degradation)

---

### Phase 10 — Obsidian REST Sync + SDK Release

**Status:** Not started

**Objective:** Upgrade Obsidian sync to use the Local REST API plugin for true bidirectional sync. Publish `@bridge-ai/bridge-sdk` to npm.

**Complexity:** L | **Dependencies:** Phase 6 (file sync working), Phase 7 (test coverage) | **Milestone:** Production Hardening

**Deliverables:**
- `ObsidianApiService` — client for `obsidian-local-rest-api` plugin: read, write, search, list
- Bidirectional sync: platform → vault on `phase_complete`; vault edits to `CONTEXT.md`/`ROADMAP.md` → read back before next lifecycle step
- Graceful fallback to file-based sync when plugin unreachable
- `GET /health` reports `obsidian: connected` or `obsidian: file-fallback`
- `packages/bridge-sdk` publish workflow + `docs/OBSIDIAN_SETUP.md`
- SDK README with quick-start

**Success Criteria:**
- [ ] Editing `CONTEXT.md` in Obsidian desktop causes next discuss step to use updated content
- [ ] Adding a note to `ROADMAP.md` in Obsidian is not overwritten on next sync
- [ ] `GET /health` reports `obsidian: connected` or `obsidian: file-fallback`
- [ ] `npm install @bridge-ai/bridge-sdk && node -e "const {Pipeline}=require('@bridge-ai/bridge-sdk');console.log(typeof Pipeline)"` prints `function`

---

## Dependency Graph

```
Phase 1 → Phase 2 → Phase 4 → Phase 5 → Phase 6 ✅
Phase 1 → Phase 3 → Phase 4 ✅
Phase 3 → Phase 9 (Discord)
Phase 6 → Phase 10 (Obsidian REST)
Phase 7 → Phase 10 (coverage gate)
Phase 1–6 → Phase 7 (CI)
Phase 1 + Phase 5 → Phase 8 (security)
```

---

## Phase Summary Table

| # | Name | Status | Milestone |
|---|------|--------|-----------|
| 1 | Foundation: NestJS + PostgreSQL + KSM + GSD SDK Port | ✅ Complete | MVP |
| 2 | Brain: AI-Agnostic Provider Layer | ✅ Complete | MVP |
| 3 | Telegram Channel Adapter + Plan Lifecycle | ✅ Complete | MVP |
| 4 | Pipeline Module: Full GSD Lifecycle | ✅ Complete | MVP |
| 5 | Docker Sandbox Integration | ✅ Complete | MVP |
| 6 | Obsidian Intelligence Vault Sync | ✅ Complete | MVP |
| 7 | Test Coverage and CI | ✅ Mostly done (CI gate gap) | Production |
| 8 | Security Hardening | ✅ Mostly done (docs gap) | Production |
| 9 | Discord Channel Adapter | 🔲 Not started | Production |
| 10 | Obsidian REST Sync + SDK Release | 🔲 Not started | Production |
