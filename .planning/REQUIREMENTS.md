# Requirements: bridge-ai

**Defined:** 2026-04-01
**Core Value:** The Obsidian vault is the product — every execution produces organized, navigable, human-editable intelligence that compounds across projects.

---

## Milestone 1 — MVP Requirements (Phases 1–6)

All MVP requirements are complete.

### Foundation

- [x] **FOUND-01**: Nx monorepo with `apps/api` (NestJS), `packages/gsd-sdk`, `packages/bridge-sdk`, `packages/nest-core` ✓ Phase 1
- [x] **FOUND-02**: PostgreSQL schema via TypeORM: Project, Plan, Phase, ExecutionMetric, AppEvent, Secret, SecretAudit ✓ Phase 1
- [x] **FOUND-03**: KSM — AES-256-GCM envelope encryption, `BRIDGE_MASTER_KEY` only external secret, `SecretAudit` trail ✓ Phase 1
- [x] **FOUND-04**: `packages/gsd-sdk` ProviderAdapter adaptation — `session-runner.ts` decoupled from Anthropic SDK ✓ Phase 1
- [x] **FOUND-05**: BullMQ queues: `project.events`, `execution.jobs`, `workflow.events` ✓ Phase 1
- [x] **FOUND-06**: `GET /health` returns `{status, db, redis}` contract ✓ Phase 1

### AI Provider Layer

- [x] **BRAIN-01**: `BrainService.generate(prompt, projectId)` routes to project's configured provider ✓ Phase 2
- [x] **BRAIN-02**: All 6 provider types implemented: OpenRouter, Gemini, OpenAI, Claude CLI, Gemini CLI, Custom CLI ✓ Phase 2
- [x] **BRAIN-03**: Fallback chain: OpenRouter → Gemini → OpenAI → Claude CLI when no project provider ✓ Phase 2
- [x] **BRAIN-04**: `BrainService` implements `ProviderAdapter` from `packages/gsd-sdk` ✓ Phase 2

### Channel + Plan Lifecycle

- [x] **CHAN-01**: Telegram bot with command set: /new /done /approve /rewrite /stop /retry /config /status /health /help /project ✓ Phase 3
- [x] **CHAN-02**: Bot throttling: 10 commands/60s per chat via `TelegramThrottlerGuard` ✓ Phase 3
- [x] **CHAN-03**: Plan state machine: draft → awaiting_approval → approved_queued → executing → completed/failed/stopped → archived ✓ Phase 3
- [x] **CHAN-04**: `FOR UPDATE SKIP LOCKED` for concurrent plan claims ✓ Phase 3
- [x] **CHAN-05**: Crash recovery — `executing` plans re-queued on startup, user notified ✓ Phase 3
- [x] **CHAN-06**: All Telegram events persisted to PostgreSQL `events` table and marked `processed` ✓ Phase 3

### Pipeline Lifecycle

- [x] **PIPE-01**: `PipelineService.executeProject()` wires BullMQ → GSD `PhaseRunner` → `ObsidianTransport` + `PostgresTransport` ✓ Phase 4
- [x] **PIPE-02**: Pipeline events forwarded to Telegram: PhaseStart, PhaseComplete, PlanStart, CostUpdate, HumanGate ✓ Phase 4
- [x] **PIPE-03**: `HumanGateBridge` pauses execution, sends approve/reject to Telegram, resumes on user reply ✓ Phase 4
- [x] **PIPE-04**: `WorkspaceService` provisions `volumes/workspaces/<projectId>/.planning/` before execution ✓ Phase 4

### Docker Sandbox

- [x] **DOCK-01**: Each project executes in its own Docker container (`bridge-ai-<projectId>`) ✓ Phase 5
- [x] **DOCK-02**: Container runs as uid 1000 (non-root) ✓ Phase 5
- [x] **DOCK-03**: Container uses read-only rootfs, `cap-drop=ALL`, `no-new-privileges` ✓ Phase 5
- [x] **DOCK-04**: Isolated bridge network `bridge-ai-projects` ✓ Phase 5
- [x] **DOCK-05**: Container stopped/removed on plan terminal state (completed/failed/stopped) ✓ Phase 5

### Obsidian Vault

- [x] **OBS-01**: `ObsidianSyncService.syncProject()` mirrors artifacts to `projects/<slug>/` (ROADMAP, STATE, PLANs, VERIFICATIONs, SUMMARYs) ✓ Phase 6
- [x] **OBS-02**: PARA vault structure created: `projects/`, `areas/`, `resources/`, `archive/`, `inbox/`, `Templates/`, `Assets/`, `Attachments/` ✓ Phase 6
- [x] **OBS-03**: `index.md` with Dataview navigation; `metrics.md` dashboard auto-generated ✓ Phase 6
- [x] **OBS-04**: `ObsidianTransport` writes `EXECUTION-LOG.md` under `projects/<slug>/phases/<N>/` in real-time ✓ Phase 6
- [x] **OBS-05**: `execution_metrics` table records per-phase timing, cost, tokens, model ✓ Phase 6
- [x] **OBS-06**: Vault root contains `RULES-AND-CONVENTIONS.md` and populated `Templates/` ✓ Phase 6

---

## Milestone 2 — Four-Plane Foundation Requirements (Phases 7–11)

This milestone establishes the foundation for controlled, brownfield-first engineering:
- Mandatory workspace onboarding + repository indexing
- Deterministic Telegram protocol (commands + context-bound natural language)
- Control plane policy engine with execution profiles
- Execution plane loop engine (iterate → validate → repair) inside the jail
- Knowledge plane vault mind (`90-AI/`) as operational memory
- Audit plane expansions for traceability (tool calls, sandbox runs, artifacts, approvals)

### Test Coverage + CI

- [x] **TEST-01**: Jest tests for all `packages/nest-core` modules ✓ Phase 7
- [x] **TEST-02**: Vitest tests for `packages/gsd-sdk` and `packages/bridge-sdk` ✓ Phase 7
- [x] **TEST-03**: GitHub Actions CI runs tests on Node 22 with PostgreSQL service container ✓ Phase 7
- [ ] **TEST-04**: CI pipeline fails when coverage drops below 80% threshold (currently reports but doesn't gate)

### Security

- [x] **SEC-01**: `SecretAudit` entity records every `getSecret()` call with caller and timestamp ✓ Phase 1/8
- [x] **SEC-02**: `KsmService.rotateSecret()` re-encrypts atomically ✓ Phase 8
- [x] **SEC-03**: `ThrottlerModule` + `TelegramThrottlerGuard` — 10 req/60s per chat, applied to all commands ✓ Phase 8
- [x] **SEC-04**: Docker hardening: `ReadonlyRootfs`, `CapDrop=ALL`, `no-new-privileges`, uid 1000 ✓ Phase 5/8
- [ ] **SEC-05**: `docs/SECURITY.md` — deployment checklist, master key rotation runbook, KSM architecture

### Workspace Onboarding + Repo Indexing

- [ ] **ONBOARD-01**: `gateway init` accepts `--workspace <path>` or `--repo <url>` + `--workspace <path>` ✓ Phase 8.5
- [ ] **ONBOARD-02**: Validate Git repo; detect main remote, base branch, current branch, dirty state ✓ Phase 8.5
- [ ] **ONBOARD-03**: Auth contract: SSH or HTTPS; validate read/write before registering the project ✓ Phase 8.5
- [ ] **ONBOARD-04**: Generate initial vault docs for an onboarded repo: `project.md`, `architecture.md`, `stack.md`, `decisions.md`, `runbook.md` ✓ Phase 8.5
- [ ] **ONBOARD-05**: Persist onboarding/index snapshot in PostgreSQL (`workspace_snapshots`) ✓ Phase 8.5
- [ ] **ONBOARD-06**: Full bootstrap indexing on first onboarding ✓ Phase 8.5
- [ ] **ONBOARD-07**: Incremental indexing/sync on branch/commit/structure changes ✓ Phase 8.5
- [x] **ONBOARD-08**: Safe workspace model: each run uses an isolated ephemeral workspace clone ✓ Phase 8.5
- [x] **ONBOARD-09**: Container never mounts host repo with write permissions; container only sees the ephemeral workspace ✓ Phase 8.5
- [ ] **ONBOARD-10**: Promotion is explicit (patch/cherry-pick/push); daemon never writes directly to host repo ✓ Phase 8.5

### Telegram Refactor (Deterministic Protocol)

- [ ] **CHAN-07**: Active context per chat: `chat_id → active_workspace → active_project → active_run` persisted ✓ Phase 8.6
- [ ] **CHAN-08**: 3-layer intent pipeline: intent classification → context resolution → normalization to canonical payload ✓ Phase 8.6
- [ ] **CHAN-09**: Natural language accepted only inside resolved safe contexts and allowed execution profile ✓ Phase 8.6
- [ ] **CHAN-10**: Minimal command protocol replaces free-form command surface (context/workflow/run-control/security/ops) ✓ Phase 8.6
- [ ] **CHAN-11**: Risk actions require explicit `/confirm <token>` ✓ Phase 8.6
- [ ] **CHAN-12**: Branch-per-run policy for execution (`run/<project_id>/<N>`) ✓ Phase 8.6
- [ ] **CHAN-13**: Fixed-format telemetry messages for critical events (run/iteration/validation/approval) ✓ Phase 8.6
- [ ] **CHAN-14**: Without active project, intent is recognized but no execution occurs; selection/create is requested ✓ Phase 8.6
- [ ] **CHAN-15**: All Telegram inputs normalize into a single canonical payload object before dispatch ✓ Phase 8.6

### Policy Engine + Execution Profiles

- [ ] **POLICY-01**: Execution profiles: READ_ONLY, GUIDED, AUTONOMOUS ✓ Phase 9
- [ ] **POLICY-02**: Command allowlist by profile; deny-by-default for unsafe commands ✓ Phase 9
- [ ] **POLICY-03**: Path allowlist by profile; enforce workspace boundaries ✓ Phase 9
- [ ] **POLICY-04**: Policy denials are recorded as auditable events (`policy.denied`) ✓ Phase 9

### Loop Engine / Ralph

- [ ] **LOOP-01**: Iterative loop: plan → execute → validate → repair → repeat ✓ Phase 10
- [ ] **LOOP-02**: Hard iteration limit per run, configurable; deterministic stop conditions ✓ Phase 10
- [ ] **LOOP-03**: Validators: tests/lint/build/security checks gate checkpoints ✓ Phase 10
- [ ] **LOOP-04**: Checkpoint commits only when validator passes and policy allows ✓ Phase 10
- [ ] **LOOP-05**: Rollback strategy after repeated failures; escalate to human gate ✓ Phase 10

### Vault Mind (90-AI/ operational memory)

- [ ] **VAULT-01**: Create `90-AI/` structure: specs/plans/decisions/prompts/evaluations/runbooks ✓ Phase 11
- [ ] **VAULT-02**: Onboarding writes baseline spec + architecture into `90-AI/` ✓ Phase 11
- [ ] **VAULT-03**: Decisions recorded as structured ADR-like entries under `90-AI/decisions/` ✓ Phase 11
- [ ] **VAULT-04**: Runbooks updated from execution failures and resolutions ✓ Phase 11

### Audit Plane Gaps

- [ ] **AUDIT-01**: `tool_calls` table: one row per tool invocation (args, result metadata, timing) ✓ Phase 10
- [ ] **AUDIT-02**: `sandbox_runs` table: one row per container/workspace execution ✓ Phase 10
- [ ] **AUDIT-03**: `artifacts` table: structured outputs (diffs, logs, reports) with provenance ✓ Phase 10/11
- [ ] **AUDIT-04**: `spec_versions` table: versioned specs linked to runs/iterations ✓ Phase 11
- [ ] **AUDIT-05**: `approvals` table: explicit approvals/denials (policy, human gate, commit/merge) ✓ Phase 9/10

---

## Milestone 3 — Channel Expansion + Obsidian REST + SDK Release (Phases 12–13)

### Discord Channel

- [ ] **DISC-01**: `DiscordModule` with bot, slash commands (/new, /done, /approve, /stop, /retry), `CanonicalPayloadBuilder` ✓ Phase 12
- [ ] **DISC-02**: Discord bot token stored in KSM (`discord-bot-token`); never from env directly ✓ Phase 12
- [ ] **DISC-03**: Zero changes to PipelineModule, PlanModule, DockerModule, ObsidianModule ✓ Phase 12

### Obsidian REST + SDK Release

- [ ] **OAPI-01**: `ObsidianApiService` — client for Obsidian Local REST API plugin: read, write, search, list ✓ Phase 13
- [ ] **OAPI-02**: Bidirectional sync: read back `CONTEXT.md` / `ROADMAP.md` vault edits before next lifecycle step ✓ Phase 13
- [ ] **OAPI-03**: Graceful fallback to file-based sync when plugin unreachable; `GET /health` reports `obsidian: connected` or `obsidian: file-fallback` ✓ Phase 13
- [ ] **SDK-01**: `@bridge-ai/bridge-sdk` publishable to npm with `npm publish` workflow ✓ Phase 13
- [ ] **SDK-02**: SDK README with quick-start: `npm install @bridge-ai/bridge-sdk` ✓ Phase 13
- [ ] **DOCS-01**: `docs/OBSIDIAN_SETUP.md` — plugin installation + API token setup ✓ Phase 13

---

## Out of Scope

| Feature | Reason |
|---------|--------|
| WhatsApp adapter | Meta Business API approval required; deferred indefinitely |
| Web dashboard / browser UI | Channel-agnostic bot is the MVP; web is v3+ |
| Multi-user auth / team accounts | Single-operator model for v1 |
| Vault/AWS SSM for KSM | PostgreSQL-backed KSM is sufficient; external vault is v3+ |
| Self-hosted Obsidian sync | Official Obsidian Sync + obsidian-git cover the use cases |
| Automatic PR merging after execution | Execution produces artifacts; merging is a human decision |

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUND-01 through FOUND-06 | Phase 1 | ✅ Complete |
| BRAIN-01 through BRAIN-04 | Phase 2 | ✅ Complete |
| CHAN-01 through CHAN-06 | Phase 3 | ✅ Complete |
| PIPE-01 through PIPE-04 | Phase 4 | ✅ Complete |
| DOCK-01 through DOCK-05 | Phase 5 | ✅ Complete |
| OBS-01 through OBS-06 | Phase 6 | ✅ Complete |
| TEST-01 through TEST-03 | Phase 7 | ✅ Complete |
| TEST-04 | Phase 7 (gap) | 🔲 Pending |
| SEC-01 through SEC-04 | Phase 1/8 | ✅ Complete |
| SEC-05 | Phase 8 (gap) | 🔲 Pending |
| ONBOARD-01 through ONBOARD-10 | Phase 8.5 | 🔲 Pending |
| CHAN-07 through CHAN-15 | Phase 8.6 | 🔲 Pending |
| POLICY-01 through POLICY-04 | Phase 9 | 🔲 Pending |
| LOOP-01 through LOOP-05 | Phase 10 | 🔲 Pending |
| VAULT-01 through VAULT-04 | Phase 11 | 🔲 Pending |
| AUDIT-01 through AUDIT-05 | Phase 9–11 | 🔲 Pending |
| DISC-01 through DISC-03 | Phase 12 | 🔲 Pending |
| OAPI-01 through OAPI-03, SDK-01, SDK-02, DOCS-01 | Phase 13 | 🔲 Pending |

**Coverage:**
- Milestone 1 requirements: 25 total — 25 complete ✅
- Milestone 2 requirements: 46 total — 7 complete, 39 pending
- Milestone 3 requirements: 12 total — 0 complete, 12 pending
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-01*
*Last updated: 2026-04-01 after GSD planning initialization*
