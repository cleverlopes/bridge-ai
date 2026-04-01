# bridge-ai

## What This Is

bridge-ai is an **intelligence factory** — a platform that transforms natural language intent into organized, structured knowledge in an Obsidian vault and PostgreSQL, while autonomously executing work through isolated Docker containers and a GSD-inspired structured lifecycle engine (discuss → plan → execute → verify).

Users describe what they want to build via Telegram (Discord in v2). The platform generates a roadmap, executes phases inside Docker sandboxes using a pluggable AI provider (OpenRouter, Gemini, OpenAI, Claude CLI, custom), and produces a living knowledge base in Obsidian that grows richer with every completed project.

## Core Value

The Obsidian vault is the product — every execution produces organized, navigable, human-editable intelligence that compounds across projects.

## Requirements

### Validated

- ✓ **Monorepo + GSD SDK port** — Nx workspace with `packages/gsd-sdk` (ProviderAdapter-adapted), `packages/bridge-sdk`, `packages/nest-core` — Phase 1
- ✓ **KSM secrets management** — AES-256-GCM envelope encryption, `SecretAudit` trail, `BRIDGE_MASTER_KEY` only external secret — Phase 1
- ✓ **PostgreSQL schema** — TypeORM entities: Project, Plan, Phase, ExecutionMetric, AppEvent, Secret, SecretAudit + migration — Phase 1
- ✓ **AI-agnostic BrainModule** — `BrainService.generate()` routes to OpenRouter / Gemini / OpenAI / Claude CLI / Gemini CLI / Custom CLI; fallback chain; per-project provider via KSM — Phase 2
- ✓ **Telegram channel adapter** — Telegraf bot, full command set (/new /done /approve /stop /retry /config /status /health /help /project), `CanonicalPayloadBuilder`, throttling (10 cmd/min via TelegramThrottlerGuard) — Phase 3
- ✓ **Plan lifecycle state machine** — draft → awaiting_approval → approved_queued → executing → completed/failed/stopped → archived; `FOR UPDATE SKIP LOCKED`; crash recovery on startup — Phase 3
- ✓ **Events consumer** — `ProjectEventsWorker` marks events processed/failed; full BullMQ audit trail — Phase 3
- ✓ **Pipeline lifecycle orchestration** — `PipelineService` wires BullMQ → GSD `PhaseRunner` → `ObsidianTransport` + `PostgresTransport`; phase start/end/cost forwarded to Telegram — Phase 4
- ✓ **HumanGate pause/resume** — `HumanGateBridge` pauses execution, sends Telegram approve/reject, `WorkflowEventsWorker` resolves gate on user reply — Phase 4
- ✓ **Docker sandbox** — `DockerService` with read-only rootfs, `cap-drop=ALL`, uid=1000, isolated bridge network; container per project — Phase 5
- ✓ **Obsidian vault sync** — `ObsidianSyncService` mirrors artifacts (ROADMAP, STATE, PLANs, VERIFICATIONs) to `projects/<slug>/`; generates index.md, metrics.md, Templates/; PARA structure — Phase 6
- ✓ **Execution metrics** — `MetricsService` records per-phase timing/cost/tokens to `execution_metrics`; Telegram summary per phase — Phase 6

### Active

- [ ] **CI-01**: CI pipeline enforces ≥80% coverage threshold as a failing gate (currently reports coverage but doesn't fail)
- [ ] **DISC-01**: Discord bot adapter accepts `/new`, `/done`, `/approve`, `/stop`, `/retry` — produces canonical events identical to Telegram; no changes to pipeline/plan modules
- [ ] **DISC-02**: Discord bot token stored in KSM (`discord-bot-token`); never from env directly
- [ ] **OBS-01**: Obsidian REST API client reads back `CONTEXT.md` / `ROADMAP.md` edits before next lifecycle step (bidirectional sync)
- [ ] **OBS-02**: Graceful fallback to file-based sync when Obsidian Local REST plugin is unreachable
- [ ] **SDK-01**: `@bridge-ai/bridge-sdk` publishable to npm — build workflow, `npm publish` script, SDK README quick-start
- [ ] **SEC-01**: `docs/SECURITY.md` — deployment checklist, master key rotation runbook, KSM architecture guide

### Out of Scope

- WhatsApp adapter — Meta Business API approval required; deferred indefinitely
- Web dashboard / browser UI — channel-agnostic CLI/bot interface is the MVP; web is v3+
- Multi-user auth / team accounts — single-operator model for v1
- Vault/AWS SSM for KSM — PostgreSQL-backed KSM sufficient; external vault is v3+
- Self-hosted Obsidian sync server — official Obsidian Sync + obsidian-git cover the use cases
- Automatic PR merging — execution produces artifacts; merging is a human decision

## Context

**Current state (2026-04-01):** Milestone 1 (MVP, Phases 1–6) is complete. Phases 7–8 of Milestone 2 are substantially done. The active work is Phases 9–10 (Discord + Obsidian REST/SDK) plus two minor gaps (CI enforcement, SECURITY.md docs).

**Codebase:** NestJS 10 + TypeScript 5 monorepo (Nx). Bun for package management. PostgreSQL 18 + TypeORM for persistence. Redis 7 + BullMQ for queuing. Dockerode for container management. Three internal packages: `@bridge-ai/nest-core` (NestJS modules), `@bridge-ai/gsd-sdk` (pipeline engine), `@bridge-ai/bridge-sdk` (providers + Obsidian client).

**Key divergence from old VERIFICATION.md:** Phase 8 throttling IS implemented (ThrottlerModule + TelegramThrottlerGuard in telegram.module.ts). Health endpoint now returns the correct `{status, db, redis}` contract. bridge-sdk has proper `main`/`exports` entries.

## Constraints

- **Tech stack**: NestJS + Bun + TypeScript — established across all packages; no migration
- **Channel pattern**: New channels must be NestJS modules only; pipeline/plan modules stay channel-agnostic (ADR-09)
- **Secrets**: No credentials in `.env` or git; all secrets via KSM; only `BRIDGE_MASTER_KEY` may be in env
- **SDK boundary**: `packages/gsd-sdk` and `packages/bridge-sdk` must have zero NestJS imports (ADR-08)
- **Container security**: No `allow: ["*"]` in Docker containers; read-only rootfs; uid 1000 (ADR per NFR-07)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| NestJS + TypeScript monorepo (Nx) | DI container, testability, `@nestjs/typeorm`, `@nestjs/bull` ecosystem | ✓ Good |
| GSD SDK internalized as `packages/gsd-sdk` | Production-grade pipeline engine; copy + adapt >> reimplement | ✓ Good |
| ProviderAdapter interface (AI-agnostic) | Core business requirement; no mandatory AI provider | ✓ Good |
| BullMQ over raw RabbitMQ | Native NestJS integration, job retries, Bull Board UI | ✓ Good |
| KSM with PostgreSQL-backed envelope encryption | Per-project API keys; no plaintext secrets in env or git | ✓ Good |
| Obsidian vault as first-class product output | Users want navigable, human-editable intelligence | ✓ Good |
| Telegram ThrottlerGuard via middleware (not per-handler @Throttle) | All commands protected at bot.use() level without per-handler decoration | — Pending eval |
| File-based Obsidian sync (v1) vs REST API (v2) | Phase 10 upgrades to bidirectional REST sync; Phase 6 delivers file-write | — Phase 10 pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition:**
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone:**
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-01 after GSD planning initialization (brownfield)*
