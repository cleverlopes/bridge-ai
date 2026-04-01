# Roadmap: bridge-ai

**Version:** 1.0.0-alpha → 1.0.0
**Created:** 2026-04-01
**Status:** In Progress — Milestone 2 active (Four-Plane Foundation)

---

## Project Goal

Build bridge-ai as an **AI Gateway for Controlled Engineering**: a self-hosted framework that bridges developers and AI models, onboarding existing repositories, organizing durable knowledge (vault), controlling execution (policy + sandbox + profiles), and recording a complete audit trail (PostgreSQL) while running a structured lifecycle (GSD) and an iterative execution loop.

---

## Milestone 1 — MVP: Intelligence Core ✅ COMPLETE

**Goal:** End-to-end flow works for at least one real project without manual intervention. The Obsidian vault contains a complete, navigable record of everything the system produced.

**Status:** All 6 phases complete. Committed: `b39e387`, `4496a93`, `2531ab0`, `f0e37da`, `8870803`, `08a9269`

---

## Milestone 2 — Four-Plane Foundation (Onboarding, Deterministic Channels, Control, Loop, Memory)

**Goal:** Make the system safe and deterministic for brownfield engineering: mandatory repository onboarding + indexing, deterministic Telegram protocol, execution profiles + policy engine, iterative loop engine, and vault-as-memory structure. Close remaining CI/security doc gaps as XS tasks.

**Status:** Phases 7–8 mostly complete; Phases 8.5–11 pending.

---

## Milestone 3 — Channel Expansion + Obsidian REST + SDK Release

**Goal:** Add Discord as a second channel, implement Obsidian REST bidirectional sync + SDK release, and ship the remaining docs/workflows required for external adoption.

**Status:** Not started (depends on Milestone 2 foundation).

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

### Phase 8.5 — Workspace Onboarding + Repo Indexing

**Status:** Planning complete

**Objective:** Mandatory onboarding for existing repositories. Register a project from an existing Git repo (workspace path or repo URL), detect remote and base branch, generate initial docs and vault structure, and establish the safe execution model: **host repo is the source of truth; each run uses an ephemeral workspace clone; promotion is explicit**.

**Complexity:** M | **Dependencies:** Phase 1 (DB/KSM), Phase 6 (vault write) | **Milestone:** Four-Plane Foundation

**Deliverables:**
- `gateway init` onboarding command (CLI and via Telegram command wrapper)
  - Accepts either `--workspace <path>` (already cloned) or `--repo <url> --workspace <path>` (provision from scratch)
- Repo discovery
  - Validate Git repo
  - Detect remote(s), main remote, base branch, current branch, dirty state
- Auth contract (documented + validated)
  - Support SSH/HTTPS
  - Validate read/write access before registering project
  - Store secrets only via KSM with explicit contract
- Indexing contract
  - **Full bootstrap** on first onboarding
  - **Incremental sync** on relevant changes (branch/commit/structure)
  - MVP extraction: tree, manifests/config, entrypoints, tests, docs, remote + branch info
  - Persist snapshot to PostgreSQL (`workspace_snapshots` planned) and mirror to vault
- Safe workspace model
  - Per-run ephemeral workspace (clone/copy model)
  - Container mounts only the ephemeral workspace, never the host repo with write access
  - Promotion options: `git apply`, `git cherry-pick`, or `git push` from workspace

**Plans:** 6 plans

Plans:
- [ ] 8.5-01-PLAN.md — Foundation: entity, migration, module scaffold, types, simple-git
- [ ] 8.5-02-PLAN.md — CLI package: @bridge-ai/cli with bridge binary and lazy daemon
- [ ] 8.5-03-PLAN.md — Onboarding service + repo indexer implementation with tests
- [ ] 8.5-04-PLAN.md — GSD InitRunner brownfield adaptation
- [ ] 8.5-05-PLAN.md — Ephemeral workspace, promotion, incremental sync, pipeline integration
- [ ] 8.5-06-PLAN.md — CLI-to-daemon wiring and end-to-end verification

**Success Criteria:**
- [ ] Project can be registered from `workspace_path` on a VPS
- [ ] Project can be provisioned from `repo_url` into a specified workspace path
- [ ] Remote + base branch are detected and stored
- [ ] Initial vault docs are generated (project/architecture/stack/decisions/runbook)
- [ ] Each run uses an isolated workspace clone; container never writes to host repo directly

---

### Phase 8.6 — Telegram Refactor (Deterministic Command Protocol)

**Status:** Not started

**Objective:** Refactor Telegram into a deterministic protocol: small command set + natural language only inside resolved contexts. Telegram never chooses targets; it carries intent to the daemon. Introduce active context per chat and a layered intent parser.

**Complexity:** M | **Dependencies:** Phase 8.5 (onboarding provides workspace/project resolution) | **Milestone:** Four-Plane Foundation

**Deliverables:**
- Layered channel architecture: Router → ContextResolver → PolicyEngine → ActionDispatcher → EventEmitter
- Active context per chat: `chat_id → active_workspace → active_project → active_run`
- Three-layer parser: intent classification → context resolution → normalization to CanonicalPayload
- Minimal command protocol (replace current large surface):
  - Context: `/projects`, `/project select`, `/project create`, `/project info`
  - Workflow: `/feature`, `/bug`, `/task`, `/status`, `/pause`, `/resume`, `/stop`
  - Run control: `/run list`, `/run current`, `/run logs`, `/approve`, `/reject`, `/commit`
  - Security: `/safe`, `/autonomy on|off`, `/lock`, `/unlock`
  - Ops: `/help`, `/config`, `/health`
- Risk actions require explicit confirmation: `/confirm <token>`
- Telemetry-style updates (short fixed messages) for VPS operation

**Success Criteria:**
- [ ] Without active project, NL messages do not execute; bot requests project selection
- [ ] With active project, `/feature <desc>` and NL feature requests produce canonical payloads deterministically
- [ ] Risk actions require explicit confirmation token
- [ ] Bot provides consistent operational event messages (run started, iteration N/M, tests failed, awaiting approval)

---

### Phase 9 — Policy Engine + Execution Profiles

**Status:** Not started

**Objective:** Introduce a policy engine as the Control Plane router: decide operation profile (Read-only/Guided/Autonomous), enforce allowlists for commands/paths/network, and deny-by-default for unsafe actions. Channels (Telegram/CLI/future Discord) never bypass policy.

**Complexity:** M | **Dependencies:** Phase 8.6 (deterministic payloads), Phase 5 (sandbox) | **Milestone:** Four-Plane Foundation

**Deliverables:**
- `ExecutionProfile`: READ_ONLY, GUIDED, AUTONOMOUS
- Command allowlist, path allowlist, network policy (deny-by-default)
- Policy enforcement intercept between channel and execution
- Audit: policy denies recorded as events

**Success Criteria:**
- [ ] READ_ONLY blocks all writes in execution workspace
- [ ] GUIDED pauses before risky operations / phase transitions
- [ ] AUTONOMOUS runs within policy limits only

---

### Phase 10 — Loop Engine / Ralph

**Status:** Not started

**Objective:** Implement iterative execution loop inside jail: plan → execute → validate → repair → repeat, with hard iteration limits and auditable output. Commits only on checkpoints that pass validators and policy.

**Complexity:** L | **Dependencies:** Phase 8.5 (workspace isolation), Phase 9 (policy) | **Milestone:** Four-Plane Foundation

**Deliverables:**
- Iteration tracking, hard limits, repair strategies
- Validator gates (tests/lint/build/security checks)
- Rollback strategy for repeated failure
- Audit tables: iterations, tool_calls, sandbox_runs (planned)
- Branch-per-run policy; checkpoint commits only when validator passes

**Success Criteria:**
- [ ] Loop converges or stops deterministically (limit reached / policy stop)
- [ ] Checkpoint commits created only after validation
- [ ] Full audit trail across iterations and tool calls

---

### Phase 11 — Vault Mind (90-AI/ + Proactive Knowledge)

**Status:** Not started

**Objective:** Turn the vault into the system’s operational memory: create `90-AI/` structure and write structured specs, decisions, runbooks, and evaluations proactively during onboarding and execution.

**Complexity:** M | **Dependencies:** Phase 8.5 (indexing artifacts), Phase 10 (iterations) | **Milestone:** Four-Plane Foundation

**Deliverables:**
- Vault structure: `90-AI/specs`, `plans`, `decisions`, `prompts`, `evaluations`, `runbooks`
- Write structured docs on onboarding and during loop execution
- Index knowledge nodes in DB (planned: `knowledge_nodes`)

**Success Criteria:**
- [ ] Onboarding creates a structured spec + architecture baseline in `90-AI/`
- [ ] Decisions are logged as ADR-like entries in `90-AI/decisions/`
- [ ] Runbooks are updated from execution events and failures

---

### Phase 12 — Discord Channel Adapter

**Status:** Not started

**Objective:** Add Discord as a second input channel. Core pipeline unchanged — new NestJS module only.

**Complexity:** M | **Dependencies:** Phase 9 (Policy Engine), Phase 3 (canonical patterns) | **Milestone:** Channel Expansion

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

### Phase 13 — Obsidian REST Sync + SDK Release

**Status:** Not started

**Objective:** Upgrade Obsidian sync to use the Local REST API plugin for true bidirectional sync. Publish `@bridge-ai/bridge-sdk` to npm.

**Complexity:** L | **Dependencies:** Phase 11 (vault mind structure), Phase 6 (file sync working), Phase 7 (test coverage) | **Milestone:** Channel Expansion

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
Phase 7 → (CI gate) → Milestone 2+
Phase 8 → (SECURITY.md) → Milestone 2+
Phase 8.5 (Onboarding) → Phase 8.6 (Telegram deterministic)
Phase 8.6 → Phase 9 (Policy)
Phase 8.5 → Phase 10 (Loop)
Phase 9 → Phase 10 (Loop)
Phase 8.5 → Phase 11 (Vault Mind)
Phase 10 → Phase 11 (Vault Mind)
Phase 9 → Phase 12 (Discord)
Phase 11 → Phase 13 (Obsidian REST + SDK)
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
| 8.5 | Workspace Onboarding + Repo Indexing | 🔲 Not started | Four-Plane Foundation |
| 8.6 | Telegram Refactor (Deterministic Protocol) | 🔲 Not started | Four-Plane Foundation |
| 9 | Policy Engine + Execution Profiles | 🔲 Not started | Four-Plane Foundation |
| 10 | Loop Engine / Ralph | 🔲 Not started | Four-Plane Foundation |
| 11 | Vault Mind (90-AI/ + Proactive Knowledge) | 🔲 Not started | Four-Plane Foundation |
| 12 | Discord Channel Adapter | 🔲 Not started | Channel Expansion |
| 13 | Obsidian REST Sync + SDK Release | 🔲 Not started | Channel Expansion |
