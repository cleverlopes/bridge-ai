# bridge-ai — Roadmap

**Version:** 1.0.0-alpha
**Created:** 2026-03-31
**Status:** In Progress (implementation exists; gaps tracked below)

---

## Project Goal

Build bridge-ai as an **intelligence factory**: a platform that transforms natural language intent into organized, structured knowledge in an Obsidian vault and PostgreSQL, while autonomously executing work through isolated Docker containers and a GSD-inspired structured lifecycle engine.

The intelligence is the product. Code is a side effect.

---

## Implementation Reality Check (as of 2026-03-31)

This roadmap started as “Planning”, but the repository already contains substantial implementation. The items below track the highest-impact gaps to align the roadmap with reality.

**Implemented (high confidence):**
- Nx monorepo + `apps/api` thin bootstrap + `packages/*`
- `packages/gsd-sdk` port with `ProviderAdapter` adaptation + transports
- `packages/nest-core` modules for KSM, Plan state machine, Pipeline wiring, Telegram adapter (basic), Obsidian sync scaffolding, Docker runner scaffolding

**Critical gaps (must-fix to satisfy success criteria):**
- **Events “processed”**: events are persisted as `pending`, but a queue consumer that marks them `processed` is missing.
- **HumanGate pause/resume**: `HumanGateBridge` exists, but there is no wired path from Telegram user replies to `resolveGate()`.
- **Health contract**: `/health` does not currently check Redis and does not return the fixed JSON shape described below.
- **Docker hardening / egress**: container execution exists, but promised hardening flags + egress controls are not implemented.
- **Obsidian execution logs**: current transport writes a daily log under `bridge-ai-logs/`, not `phases/<N>/EXECUTION-LOG.md`.

---

## Milestone 1 — MVP: Intelligence Core (Telegram → Pipeline → Obsidian)

**Goal:** A user describes a project via Telegram. bridge-ai runs the full lifecycle (discuss → plan → execute → verify) inside a Docker container, stores all state in PostgreSQL, syncs all intelligence artifacts to the Obsidian vault, and responds to the user with structured progress updates. All AI calls go through the AI-agnostic `BrainModule`. All secrets are managed via KSM.

**Success:** End-to-end flow works for at least one real project without manual intervention. The Obsidian vault contains a complete, navigable record of everything the system produced.

**Phases:** 1 through 6

---

## Milestone 2 — Production Hardening + SDK Release

**Goal:** ≥80% test coverage, production security hardening, Discord as a second channel, Obsidian REST API bidirectional sync, and `@bridge-ai/sdk` published as an npm package.

**Phases:** 7 through 10

---

## Phases

---

### Phase 1 — Foundation: Monorepo + PostgreSQL + KSM + GSD SDK Port

**Objective:** Bootstrap the entire monorepo structure from scratch. Port the GSD SDK into `packages/gsd-sdk` with the critical AI-agnostic adaptation. Establish the PostgreSQL schema with TypeORM. Implement KSM. Wire BullMQ. This phase produces the structural foundation and the adapted pipeline engine — no channels, no AI calls, no UI yet.

**Complexity:** L

**Dependencies:** None

**Requirements:** FR-02 (SDK), FR-05 (PostgreSQL), FR-13 (KSM), FR-14 (SDK packages), ADR-01 through ADR-04, ADR-07, ADR-08

**Deliverables:**

**Monorepo scaffold:**
- Nx workspace: `nx.json`, root `package.json`, `apps/` and `packages/`
- Bun engine: `bun.lockb`, root scripts use `bunx nx ...`
- `apps/api/` — NestJS 10 bootstrap: `AppModule`, `ConfigModule`, `HealthModule`
- `packages/gsd-sdk/` — GSD SDK ported from `gsd-brain/sdk/`
- `packages/bridge-sdk/` — SDK skeleton (`Pipeline` stub, provider stubs, `ObsidianClient` stub)
- `docker-compose.yml` — PostgreSQL 16, Redis 7, app

**`packages/gsd-sdk` adaptation:**
- Copy all source files from `gsd-brain/sdk/src/` as-is
- **`provider-adapter.ts`** — NEW: `ProviderAdapter` interface: `generate(prompt: string, options: ProviderOptions): Promise<GenerationResult>`
- **`session-runner.ts`** — ADAPTED: replace `import { query } from '@anthropic-ai/claude-agent-sdk'` with `ProviderAdapter` injection; the `query()` call becomes `adapter.generate()`; all other logic preserved
- **`types.ts`** — extended with bridge-ai provider types (non-breaking additions)
- **`obsidian-transport.ts`** — NEW: `TransportHandler` implementation that writes pipeline events to vault files
- **`postgres-transport.ts`** — NEW: `TransportHandler` that emits events to a callback (NestJS `EventsModule` will subscribe)
- Remove `@anthropic-ai/claude-agent-sdk` from dependencies; mark as optional peer dep for backward compat

**PostgreSQL schema (TypeORM entities in `packages/nest-core/src/persistence/entity/`):**
- `Project` — id, slug, name, description, stack, status, settings (JSONB), createdAt, updatedAt
- `Plan` — id, projectId, status, roadmapPath, workspacePath, providerId, createdAt, updatedAt
- `Phase` — id, planId, phaseNumber, phaseName, status, startedAt, completedAt
- `ExecutionMetric` — id, phaseId, projectId, durationMs, costUsd, tokensIn, tokensOut, modelUsed, iterationCount, success
- `Event` — id, type, channel, correlationId, conversationId, payload (JSONB), status, processedAt
- `Secret` — id, name, scope (global/project), scopeId, encryptedValue, algorithm, keyVersion, createdAt
- `SecretAudit` — id, secretId, action, callerModule, callerProjectId, accessedAt

**`KsmModule`:**
- `createSecret(name, value, scope, scopeId?)` — encrypts with AES-256-GCM, stores in `secrets` table
- `getSecret(name, scope, scopeId?)` — decrypts and returns; writes to `secret_audit`
- `rotateSecret(name, newValue, scope, scopeId?)` — atomic re-encryption, zero-downtime
- Master key: single env var `BRIDGE_MASTER_KEY` (32 bytes, base64)

**`EventsModule`:**
- Canonical event type registry
- BullMQ queue definitions: `project.events`, `execution.jobs`, `workflow.events`
- PostgreSQL audit log writer (persists every consumed event)

**`ProjectModule`:**
- Project CRUD with TypeORM repository
- `project_settings`: provider preference, model, auto-approve flag

**Initial migration (Nx target):** `bunx nx run api:typeorm:migration:generate --name InitialSchema`

**.env.example:** should include only truly-required variables (currently includes Telegram allowlist too; align either the file or this requirement)

**Success Criteria:**
- [ ] `GET /health` checks DB + Redis (and optionally provider) and returns a stable, documented contract (either the fixed JSON below or Terminus shape; must match implementation)
- [ ] If using the fixed JSON contract: `{"status":"ok","db":"connected","redis":"connected"}`
- [ ] `bunx nx run api:typeorm:migration:run` completes on a fresh PostgreSQL instance
- [ ] `KsmModule.createSecret` stores encrypted value; `getSecret` decrypts correctly; value never appears in logs
- [ ] `packages/gsd-sdk` compiles with zero TypeScript errors after adaptation
- [ ] `session-runner.ts` no longer imports `@anthropic-ai/claude-agent-sdk`; accepts `ProviderAdapter` constructor injection
- [ ] `git grep -rn "sk-\|AIza\|Bearer" -- "*.env*"` returns only `.env.example` with placeholder values
- [ ] All TypeORM entities have corresponding columns in the database

**Milestone:** MVP (unblocks all subsequent phases)

---

### Phase 2 — Brain Module: AI-Agnostic Provider Layer

**Objective:** Build `BrainModule` — the AI provider abstraction that implements `ProviderAdapter` from `packages/gsd-sdk`. All LLM calls in bridge-ai go through `BrainModule.generate()`. Provider selection and API keys are per-project, resolved from KSM at runtime.

**Complexity:** M

**Dependencies:** Phase 1 (KSM, `ProviderAdapter` interface)

**Requirements:** FR-11 (AI agnosticism), FR-12 (fallback chain), ADR-05

**Deliverables:**

**`BrainModule`** with `BrainService`:
- `generate(prompt, projectId, options?)` — resolves provider for project from KSM, calls provider, returns `GenerationResult`
- `setProjectProvider(projectId, config: ProviderConfig)` — stores provider + model + API key in KSM
- `checkProvider(projectId?)` — health check for configured provider(s)

**Provider implementations** (in `packages/bridge-sdk/src/providers/`):
- `OpenRouterProvider` — REST, configurable model, API key from KSM
- `GeminiProvider` — REST, `gemini-2.0-flash` default, API key from KSM
- `OpenAIProvider` — REST, OpenAI-spec compatible (any endpoint URL), API key from KSM
- `ClaudeCliProvider` — subprocess `claude -p <prompt>`; auth from KSM-stored `~/.claude.json` path or `ANTHROPIC_API_KEY`
- `GeminiCliProvider` — subprocess `gemini`; configurable flags
- `CustomCliProvider` — user-defined command, args template, prompt flag; fully configurable per project

**Fallback chain** (default when no project provider set): OpenRouter → Gemini → OpenAI → Claude CLI

**Cost tracking:**
- Every `generate()` call returns `{ text, tokensIn, tokensOut, costUsd, model, provider }`
- `BrainService` emits `GSDEventType.CostUpdate` to the project's `GSDEventStream`

**`HealthModule` updated:** `checkAllProviders(projectId)` tests all configured providers in parallel

**Success Criteria:**
- [ ] `BrainService.generate(prompt, projectId)` calls OpenRouter if project has OpenRouter key; falls back to Gemini if not
- [ ] Configuring a project with `custom-cli` using `ollama run llama3` returns a text response
- [ ] API keys never appear in logs, responses, or PostgreSQL in plaintext
- [ ] Every `generate()` call returns accurate `costUsd` and `tokensIn`/`tokensOut`
- [ ] `BrainService` implements `ProviderAdapter` from `packages/gsd-sdk` — can be injected directly into `PhaseRunner`

**Milestone:** MVP (required for all AI-driven phases)

---

### Phase 3 — Telegram Channel Adapter + Plan Lifecycle

**Objective:** Implement the Telegram channel adapter and the `PlanModule` state machine. This delivers the first complete user interaction loop: user sends a command → canonical event published → BullMQ job → plan state tracked in PostgreSQL → user notified.

**Complexity:** L

**Dependencies:** Phase 1 (events, DB), Phase 2 (BrainModule for any AI calls)

**Requirements:** FR-01 (Telegram), FR-08 (crash recovery), FR-09 (approval flow), FR-10 (stop/retry), NFR-04 (adapter pattern)

**Deliverables:**

**`TelegramModule`:**
- Telegraf bot with startup validation: refuses to start if `telegram-bot-token` not present in KSM
- `TELEGRAM_ALLOWED_CHAT_IDS` validated at startup (not per-message)
- Commands: `/new`, `/project`, `/done`, `/approve`, `/rewrite`, `/stop`, `/retry`, `/config`, `/status`, `/health`, `/help`
- `TelegramNotifier` — implements notifier port: `send(conversationId, text)`
- `CanonicalPayloadBuilder` — Telegraf `ctx` → `{ type, channel, correlationId, conversationId, actor, createdAt, ...data }`

**`PlanModule`** — plan lifecycle state machine:
- States: `draft → awaiting_approval → approved_queued → executing → completed | failed | stopped`
- PostgreSQL `SELECT ... FOR UPDATE SKIP LOCKED` for plan claims (safe concurrent workers)
- `PlanService.recoverInterruptedPlans()` — on startup, re-queues `executing` plans and notifies users
- Archive cron: hourly, marks stale plans (>7 days in terminal state) as `archived`
- `/stop` → `stopped`; `/retry` → re-queues to `approved_queued`

**`EventsModule` wired:**
- Telegram events → `project.events` BullMQ queue
- All consumed events → PostgreSQL `events` audit table

**Success Criteria:**
- [ ] `/new my-api|Node|REST API|no` via Telegram creates a `draft` plan in PostgreSQL
- [ ] Bot refuses to start without `telegram-bot-token` in KSM
- [ ] Two workers simultaneously cannot double-claim the same plan (`FOR UPDATE SKIP LOCKED` test)
- [ ] Killing the worker mid-execution and restarting recovers the plan and notifies the user
- [ ] `/stop` transitions plan to `stopped`; `/retry` re-queues and notifies
- [ ] All Telegram events appear in PostgreSQL `events` table and are transitioned to `status: processed` by an events consumer (not just inserted as `pending`)

**Milestone:** MVP

---

### Phase 4 — Pipeline Module: Full GSD Lifecycle Execution

**Objective:** Wire `PipelineModule` — the lifecycle orchestration layer that connects BullMQ approved jobs to `packages/gsd-sdk`'s `PhaseRunner`. When a plan is approved, the pipeline runs the full discuss → research → plan → execute → verify lifecycle. `HumanGateCallbacks` pause execution and await Telegram responses. All pipeline events flow through `GSDEventStream` to both the Telegram notifier and `ObsidianTransport`.

**Complexity:** L

**Dependencies:** Phase 2 (`BrainModule` as `ProviderAdapter`), Phase 3 (`PlanModule`, `TelegramModule`)

**Requirements:** FR-02 (structured lifecycle), ADR-04 (gsd-sdk), ADR-05 (brain), ADR-08

**Deliverables:**

**`PipelineModule`** with `PipelineService`:
- `executeProject(planId)` — provisions workspace, instantiates `GSD` from `packages/gsd-sdk` with `BrainService` as `ProviderAdapter`, registers `ObsidianTransport` and `PostgresTransport`, calls `gsd.run(prompt, options)`
- `WorkspaceService` — provisions `volumes/workspaces/<projectId>/` with `.planning/` structure and initial `PROJECT.md` stub
- `HumanGateBridge` — implements `HumanGateCallbacks` from `packages/gsd-sdk`; pauses `PhaseRunner`, sends Telegram message, registers one-time BullMQ job for user response, resumes runner on response

**Pipeline → Telegram event forwarding:**
- `GSDEventType.PhaseStart` → "▶ Starting Phase {N}: {name}..."
- `GSDEventType.PhaseComplete` → "✓ Phase {N} complete — {duration}, ${cost} ({model})"
- `GSDEventType.PlanStart` → "⚙ Executing: {plan name}"
- `GSDEventType.CostUpdate` → "💰 Cost so far: ${cumulative}"
- `GSDEventType.HumanGate` → presents approve/rewrite buttons

**BullMQ consumer:**
- `ExecutionWorker` processes `approved_queued` jobs → calls `PipelineService.executeProject(planId)`

**`packages/bridge-sdk` wired:**
- `Pipeline` class: `new Pipeline({ provider, obsidianVaultPath, workspacePath })` → `pipeline.execute(prompt)`

**Success Criteria:**
- [ ] `/new` + `/done` + `/approve` sequence in Telegram initiates `PhaseRunner.run()` (visible in structured logs)
- [ ] `volumes/workspaces/<projectId>/.planning/ROADMAP.md` and `STATE.md` exist after `/done`
- [ ] Phase start/end Telegram messages include timing and cost
- [ ] `HumanGateCallbacks.onDiscussApproval` sends Telegram message and pauses; a user reply (`/approve` or equivalent) is wired to `resolveGate()` and resumes execution
- [ ] Execution uses the project's configured AI provider, not a hardcoded one
- [ ] `Pipeline.execute({ projectDescription, provider, model, apiKey })` works from `packages/bridge-sdk` without NestJS

**Milestone:** MVP

---

### Phase 5 — Docker Sandbox Integration

**Objective:** Wrap each project's execution inside an isolated Docker container per project. `DockerModule` manages container lifecycle. The `half-loop.sh` script and AI CLI tools run inside the container as a non-root user. No permission escalation.

**Complexity:** L

**Dependencies:** Phase 4 (pipeline must be running before isolation is layered in)

**Requirements:** FR-03 (Docker sandbox), NFR-07 (container security)

**Deliverables:**

**`DockerModule`** with `DockerService`:
- `createContainer(projectId)` — named container `bridge-ai-<projectId>`, workspace mounted at `/workspace`, runs as uid 1000 (`gsd` user)
- `execInContainer(projectId, command, env)` — streams stdout/stderr to `PipelineService` event handler
- `stopContainer(projectId)`, `removeContainer(projectId)`
- Container labels: `bridge-ai.project=<projectId>`, `bridge-ai.managed=true`

**Container image** (`apps/api/docker/runner/Dockerfile`):
- Base: `node:22-bookworm-slim`
- Installs: Claude Code CLI, Gemini CLI, `git`, `gh`, shell utilities
- Creates non-root user `gsd` (uid 1000)
- No embedded credentials; AI CLI auth mounted at runtime via KSM-resolved paths

**`apps/api/scripts/half-loop.sh`** (adapted from `ai-jail` reference):
- Static `.claude/settings.json` permissions — no `allow: ["*"]` escalation; exits with code 1 on permission error instead
- Reads completion sentinel `<promise>COMPLETE</promise>` from Claude output
- Compatible with Gemini CLI and custom CLI via wrapper scripts in `ai-cli-wrappers/`

**`PipelineService` updated:**
- `WorkspaceService.execPhase()` calls `DockerService.execInContainer()` for execution steps

**Container networking:**
- Isolated bridge network `bridge-ai-projects`; no egress except to AI provider APIs (configurable `ALLOWED_EGRESS_HOSTS`)

**Success Criteria:**
- [ ] Each project has its own container visible in `docker ps --filter "label=bridge-ai.managed=true"`
- [ ] `docker exec <container> id` shows uid 1000 (non-root)
- [ ] Workspace accessible at `/workspace` inside container
- [ ] `grep -r '"allow".*"\*"' volumes/workspaces/` returns no matches after execution
- [ ] `curl` to an arbitrary external host from inside the container is blocked
- [ ] Container stops on plan `completed`/`failed`/`stopped` transition

**Milestone:** MVP

---

### Phase 6 — Obsidian Intelligence Vault Sync

**Objective:** The Obsidian vault becomes the living intelligence product. All GSD artifacts are mirrored to the vault in a structured, navigable layout after every phase completion. Metrics dashboards and the project index are auto-generated. The `ObsidianTransport` (from `packages/gsd-sdk`) writes real-time event summaries during execution.

**Complexity:** M

**Dependencies:** Phase 4 (artifacts must exist), Phase 5 (metrics from real executions)

**Requirements:** FR-04 (Obsidian vault), FR-07 (observability), NFR-05 (auditability), ADR-06

**Deliverables:**

**`ObsidianModule`** with `ObsidianSyncService`:
- **Vault structure (PARA + Inbox):** ensures the root folders exist: `projects/`, `areas/`, `resources/`, `archive/`, `inbox/`, plus Obsidian auxiliary folders `Assets/`, `Attachments/`, `Templates/`. Root files: `index.md`, `RULES-AND-CONVENTIONS.md`.
- `syncProject(projectId)` — mirrors project execution artifacts into `volumes/obsidian/projects/<project-slug>/` following the vault architecture defined in `PROJECT.md` (MOC, ROADMAP, STATE, REQUIREMENTS, CONFIG, phases/*).
- Sync triggers: `GSDEventType.PhaseComplete`, `GSDEventType.PlanComplete`, `GSDEventType.MilestoneComplete` from `EventsModule`
- Merge strategy: platform artifacts win on `plan_complete`; vault edits to `CONTEXT.md` read back before next `discuss` step
- `generateIndex()` — writes `volumes/obsidian/index.md`: Dataview-powered navigation for the LLM (active projects, recent area knowledge, inbox)
- `generateMetricsDashboard()` — writes `volumes/obsidian/metrics.md`: cost by project, avg duration, success rate, model breakdown
- `ensureTemplates()` — writes/updates the minimum template set into `volumes/obsidian/Templates/` (project MOC, phase notes, plan/summary/verification, execution-log, retrospective, area/resource/inbox notes)
- `areaExtractionOnRetrospective()` — on `project_complete` generates `projects/<slug>/retrospective.md` and updates/creates reusable knowledge notes under `areas/<area-slug>/` with backlinks (`source_projects`) to the project
- `inboxClassification()` — periodically (or on retrospective) classifies `inbox/` notes into `areas/`, `resources/`, or `archive/`
- `archiveMoves()` — moves completed projects to `archive/projects/<slug>/` when they are marked completed/archived

**`MetricsModule`** with `ExecutionMetricsService`:
- Records per-phase metrics to `execution_metrics` table on `GSDEventType.PhaseComplete`
- Schema: `{ projectId, projectSlug, phaseNumber, phaseName, planId, startedAt, completedAt, durationMs, costUsd, tokensIn, tokensOut, modelUsed, iterationCount, success, errorMessage }`
- Telegram summary after each phase: "✓ Phase {N} — {Xm Ys}, ${cost}, {model}"

**`ObsidianTransport`** (in `packages/gsd-sdk`, wired in `PipelineService`):
- Real-time execution log: writes `phases/<N>/EXECUTION-LOG.md` during execution with timestamped event summaries (current implementation writes a daily log under `bridge-ai-logs/`; align to this contract)
- Provides live progress visibility in Obsidian while execution is running

**Sync configuration (only two supported):**
- **Obsidian Sync** (official): bridge-ai writes locally; Obsidian handles sync
- **Git sync**: vault is a Git repo + Obsidian `obsidian-git` plugin auto-commit/pull/push to a remote

**Success Criteria:**
- [ ] After Phase 1 of a project completes, `volumes/obsidian/projects/<slug>/ROADMAP.md` exists with correct content
- [ ] `volumes/obsidian/index.md` lists the project with current phase and status
- [ ] `volumes/obsidian/metrics.md` shows cost and duration for completed phases
- [ ] Manually adding a note to `CONTEXT.md` in Obsidian is not overwritten on next sync (merge strategy)
- [ ] All artifact types (ROADMAP, STATE, PLAN, VERIFICATION, SUMMARY) appear in vault after full phase execution
- [ ] PostgreSQL `execution_metrics` has one row per completed phase with accurate timing and cost
- [ ] `EXECUTION-LOG.md` updates in real-time during active execution
- [ ] Vault root contains `RULES-AND-CONVENTIONS.md` and a populated `Templates/` folder

**Milestone:** MVP — **this phase completes the intelligence core**

---

### Phase 7 — Test Coverage and CI

**Objective:** Achieve ≥80% test coverage on all NestJS modules and SDK packages. Set up GitHub Actions CI.

**Complexity:** M

**Dependencies:** Phases 1–6

**Requirements:** NFR-03

**Deliverables:**
- Unit tests for all modules and SDK packages
- Integration tests: Telegram event → plan created → pipeline initiated → metrics recorded (in-memory PostgreSQL via `@databases/pg-test`)
- `.github/workflows/ci.yml` — `bunx nx test` on Node 22 (or Bun), PostgreSQL service container
- Coverage via `c8` with 80% minimum threshold enforced in CI
- E2E test: full Docker Compose stack; `/new` + `/approve` → vault artifacts created

**Success Criteria:**
- [ ] `bunx nx test` reports ≥80% on `apps/api/src/` and `packages/*/src/`
- [ ] GitHub Actions passes on fresh clone
- [ ] Unit tests mock all external services; no live API calls
- [ ] E2E suite runs in < 5 minutes

**Milestone:** Production Hardening

---

### Phase 8 — Security Hardening

**Objective:** Harden KSM (audit trail, rotation), container security, rate limiting, and produce a security runbook.

**Complexity:** S

**Dependencies:** Phase 1 (KSM), Phase 5 (Docker)

**Requirements:** FR-13, NFR-07, NFR-08

**Deliverables:**
- KSM audit log: every `getSecret` records `{secretName, scope, callerModule, timestamp}` in `secret_audit`
- `KsmModule.rotateSecret` — atomic re-encryption, zero downtime
- NestJS `ThrottlerGuard` on Telegram commands: max 10/minute per chatId
- Docker containers: `--read-only`, `--cap-drop=ALL`, `--security-opt=no-new-privileges`
- `docs/SECURITY.md` — deployment checklist, secrets rotation runbook, KSM architecture

**Success Criteria:**
- [ ] `SELECT * FROM secret_audit ORDER BY accessed_at DESC LIMIT 10` shows access history
- [ ] `KsmModule.rotateSecret` completes without failed decryptions during rotation
- [ ] 11+ Telegram commands/minute triggers 429 throttle response
- [ ] `docker inspect <container>` shows `ReadonlyRootfs: true`, empty `CapAdd`

**Milestone:** Production Hardening

---

### Phase 9 — Discord Channel Adapter

**Objective:** Add Discord as a second input channel. Core pipeline unchanged — new NestJS module only.

**Complexity:** M

**Dependencies:** Phase 3 (canonical event pattern established)

**Requirements:** FR-01 (Discord), NFR-04 (adapter-only)

**Deliverables:**
- `DiscordModule` — Discord.js bot, slash commands, canonical payload builder, `DiscordNotifier`
- Bot token stored in KSM (`discord-bot-token`)
- `docker-compose.yml` updated: `discord-bot` service
- `docs/CHANNELS.md` — setup guide for Telegram and Discord

**Success Criteria:**
- [ ] `/new project|Node|API|no` in Discord initiates a project
- [ ] Zero changes to `PipelineModule`, `PlanModule`, `DockerModule`, or `ObsidianModule`
- [ ] Discord token retrieved from KSM, never from env directly

**Milestone:** Production Hardening

---

### Phase 10 — Obsidian REST Sync + SDK Release

**Objective:** Upgrade Obsidian sync to use the Local REST API plugin for true bidirectional sync. Publish `@bridge-ai/sdk` to npm.

**Complexity:** L

**Dependencies:** Phase 6 (file sync working), Phase 7 (test coverage)

**Requirements:** FR-04 (bidirectional), FR-14 (SDK distribution)

**Deliverables:**
- `ObsidianApiService` — client for `obsidian-local-rest-api` plugin: read, write, search, list
- Bidirectional sync: platform → vault on `phase_complete`; vault edits to `CONTEXT.md`/`ROADMAP.md` → read back before next lifecycle step
- Graceful fallback to file-based sync when plugin is unreachable
- `docs/OBSIDIAN_SETUP.md` — plugin installation + API token setup
- `packages/bridge-sdk` published as `@bridge-ai/sdk` to npm (or GitHub Packages)
- SDK `README.md` with quick-start: `npm install @bridge-ai/sdk`

**Success Criteria:**
- [ ] Editing `CONTEXT.md` in Obsidian desktop causes next discuss step to use updated content
- [ ] Adding a note to `ROADMAP.md` in Obsidian is not overwritten on next sync
- [ ] `GET /health` reports `obsidian: connected` or `obsidian: file-fallback`
- [ ] `npm install @bridge-ai/sdk && node -e "const {Pipeline}=require('@bridge-ai/sdk');console.log(typeof Pipeline)"` prints `function`

**Milestone:** Production Hardening

---

## Dependency Graph

```
Phase 1 (Foundation: NestJS + PG + KSM + gsd-sdk port)
    │
    ├──► Phase 2 (Brain: AI-agnostic provider layer)
    │        │
    │        └──► Phase 4 (Pipeline: full GSD lifecycle)
    │                 │
    │                 ├──► Phase 5 (Docker sandbox)
    │                 │        │
    │                 │        └──► Phase 6 (Obsidian vault sync) ◄── Phase 4
    │                 │
    │                 └──► Phase 6 (Obsidian vault sync)
    │
    ├──► Phase 3 (Telegram + Plan lifecycle)
    │        │
    │        ├──► Phase 4 (Pipeline)
    │        │
    │        └──► Phase 9 (Discord adapter)  [parallel, post-Phase 3]
    │
    └──► Phase 8 (Security hardening)  [parallel, post-Phase 1+5]

Phase 7 (Tests + CI)  ──── depends on Phases 1–6
Phase 10 (Obsidian REST + SDK release) ──── depends on Phases 6, 7
```

---

## Phase Summary Table

| # | Name | Complexity | Wave | Depends On | Milestone |
|---|------|-----------|------|------------|-----------|
| 1 | Foundation: NestJS + PostgreSQL + KSM + GSD SDK Port | L | 1 | — | MVP |
| 2 | Brain: AI-Agnostic Provider Layer | M | 2 | 1 | MVP |
| 3 | Telegram Channel Adapter + Plan Lifecycle | L | 2 | 1, 2 | MVP |
| 4 | Pipeline Module: Full GSD Lifecycle | L | 3 | 2, 3 | MVP |
| 5 | Docker Sandbox Integration | L | 4 | 4 | MVP |
| 6 | Obsidian Intelligence Vault Sync | M | 4 | 4, 5 | MVP |
| 7 | Test Coverage and CI | M | 5 | 1–6 | Production |
| 8 | Security Hardening | S | 2 | 1, 5 | Production |
| 9 | Discord Channel Adapter | M | 3 | 3 | Production |
| 10 | Obsidian REST Sync + SDK Release | L | 6 | 6, 7 | Production |

---

## Requirements Matrix

| Requirement | Phase(s) | Description |
|------------|----------|-------------|
| FR-01 | 3, 9 | Channel intake: Telegram (MVP), Discord (v2) |
| FR-02 | 1, 4 | Structured lifecycle via gsd-sdk `PhaseRunner` |
| FR-03 | 5 | Docker sandbox per project |
| FR-04 | 6, 10 | Obsidian vault (file-based MVP; REST API v2) |
| FR-05 | 1 | PostgreSQL + TypeORM as source of truth |
| FR-06 | 6 | Execution metrics and observability |
| FR-07 | 3 | Crash recovery via BullMQ + PostgreSQL state |
| FR-08 | 3 | Plan approval flow |
| FR-09 | 3 | Stop / retry |
| FR-10 | 1 | Crash recovery on restart |
| FR-11 | 1, 2 | AI provider agnosticism + `ProviderAdapter` |
| FR-12 | 2 | Provider fallback chain |
| FR-13 | 1, 8 | KSM: encrypted secrets store |
| FR-14 | 1, 10 | SDK structure (MVP), published package (Production) |
| NFR-02 | 1 | PostgreSQL-backed distributed state |
| NFR-03 | 7 | Test coverage ≥80% |
| NFR-04 | 3, 9 | Channel-agnostic adapter pattern |
| NFR-07 | 5, 8 | Container security |
| NFR-08 | 1, 8 | Zero-secret deployment |

---

## Out of Scope (This Roadmap)

- WhatsApp adapter (Meta Business API approval required)
- Web dashboard / browser UI
- Multi-user auth / team accounts
- Paid API billing / usage limits
- Vault/AWS SSM for KSM (Milestone 3)
- Automatic PR merging after verification
- Self-hosted Obsidian sync server
