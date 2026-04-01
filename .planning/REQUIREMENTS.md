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

## Milestone 2 — Production Hardening Requirements (Phases 7–10)

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

### Discord Channel

- [ ] **DISC-01**: `DiscordModule` with bot, slash commands (/new, /done, /approve, /stop, /retry), `CanonicalPayloadBuilder`
- [ ] **DISC-02**: Discord bot token stored in KSM (`discord-bot-token`); never from env directly
- [ ] **DISC-03**: Zero changes to PipelineModule, PlanModule, DockerModule, ObsidianModule

### Obsidian REST + SDK Release

- [ ] **OAPI-01**: `ObsidianApiService` — client for Obsidian Local REST API plugin: read, write, search, list
- [ ] **OAPI-02**: Bidirectional sync: read back `CONTEXT.md` / `ROADMAP.md` vault edits before next lifecycle step
- [ ] **OAPI-03**: Graceful fallback to file-based sync when plugin unreachable; `GET /health` reports `obsidian: connected` or `obsidian: file-fallback`
- [ ] **SDK-01**: `@bridge-ai/bridge-sdk` publishable to npm with `npm publish` workflow
- [ ] **SDK-02**: SDK README with quick-start: `npm install @bridge-ai/bridge-sdk`
- [ ] **DOCS-01**: `docs/OBSIDIAN_SETUP.md` — plugin installation + API token setup

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
| DISC-01 through DISC-03 | Phase 9 | 🔲 Pending |
| OAPI-01 through OAPI-03, SDK-01, SDK-02, DOCS-01 | Phase 10 | 🔲 Pending |

**Coverage:**
- Milestone 1 requirements: 25 total — 25 complete ✅
- Milestone 2 requirements: 16 total — 10 complete, 6 pending
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-01*
*Last updated: 2026-04-01 after GSD planning initialization*
