# bridge-ai

**bridge-ai** is an *intelligence factory*: a platform that turns natural-language intent into organized, structured knowledge (an Obsidian vault + PostgreSQL) while autonomously executing work through isolated Docker containers, powered by a GSD-inspired lifecycle (**discuss → plan → execute → verify**).

Users describe what they want to build via **Telegram** (Discord in v2). The platform generates a roadmap, executes phases inside Docker sandboxes using a pluggable AI provider (OpenRouter, Gemini, OpenAI, Claude CLI, etc.), and produces a living Obsidian knowledge base that compounds with every completed project.

## The product

The **Obsidian vault is the product**: every execution produces organized, navigable, human-editable artifacts — intelligence that compounds over time.

## Status (2026-04-01)

- **Milestone 1 (MVP, Phases 1–6)**: complete
- **Milestone 2**: phases 7–8 substantially done; active work on **Discord** + **Obsidian REST/bidirectional sync** + SDK packaging + security docs

For details, see `docs/ROADMAP.md` and `docs/VERIFICATION.md`.

## Stack and architecture

- **Monorepo Nx** + **TypeScript 5**
- **NestJS 10** (main app)
- **Bun** (package manager / runner)
- **PostgreSQL** + **TypeORM** (persistence + migrations)
- **Redis** + **BullMQ** (queueing, jobs, and audit trail)
- **Dockerode** (per-project sandbox)
- Internal packages:
  - `@bridge-ai/nest-core` — reusable NestJS modules
  - `@bridge-ai/gsd-sdk` — pipeline engine (no NestJS dependencies)
  - `@bridge-ai/bridge-sdk` — providers + Obsidian client/transport (no NestJS dependencies)

## Validated capabilities (high level)

- **KSM (secrets management)**: AES-256-GCM envelope encryption + audit trail; the **only allowed external secret** is `BRIDGE_MASTER_KEY`
- **AI-agnostic BrainModule**: provider routing with fallback; per-project provider via KSM
- **Telegram adapter**: Telegraf bot with `/new /done /approve /stop /retry /config /status /health /help /project` + throttling
- **Plan lifecycle state machine**: `draft → awaiting_approval → approved_queued → executing → completed/failed/stopped → archived`, with `FOR UPDATE SKIP LOCKED` and crash recovery
- **Pipeline orchestration**: BullMQ → GSD `PhaseRunner` → transports (Obsidian + Postgres) + Telegram notifications
- **HumanGate**: pause/resume execution with human approval via Telegram
- **Docker sandbox**: read-only rootfs, `cap-drop=ALL`, uid=1000, isolated network
- **Obsidian sync (file-based)**: mirrors artifacts and PARA structure into `projects/<slug>/`, generates `index.md` and metrics
- **Execution metrics**: per-phase timing/cost/token tracking

## Prerequisites

- **Bun** installed (`bun --version`)
- **Docker** available (for the sandbox)
- **PostgreSQL** (persistence / KSM / TypeORM entities)
- **Redis** (BullMQ backend)

## Setup

1. Install dependencies:

```bash
bun install
```

2. Configure environment variables.

This project follows a strict rule: **no credentials in `.env`**. The only secret that may exist in the environment is:

- **`BRIDGE_MASTER_KEY`**: KSM master key (used to decrypt per-project secrets)

You may still use a local `.env` for non-secret values and for pointing to your infra (DB/Redis), based on what already exists in your workspace.

3. Run migrations (TypeORM):

```bash
bun run migration:run
```

## Running

Start the API (NestJS):

```bash
bun run api:serve
```

Build:

```bash
bun run api:build
```

Tests and lint:

```bash
bun run api:test
bun run api:lint
```

Run everything (Nx multi-project):

```bash
bun run build:all
bun run test:all
bun run lint:all
```

## Migrations (TypeORM)

- **Generate**:

```bash
bun run migration:generate
```

- **Apply**:

```bash
bun run migration:run
```

- **Revert**:

```bash
bun run migration:revert
```

## Repository structure

- `apps/api` — NestJS API (pipeline, workers, channel adapters, etc.)
- `packages/gsd-sdk` — lifecycle/pipeline engine (NestJS-agnostic)
- `packages/bridge-sdk` — providers + Obsidian client/transports (NestJS-agnostic)
- `packages/nest-core` — shared NestJS modules
- `docs/` — roadmap, verification, project and other references
- `.planning/PROJECT.md` — living source of truth for “what this is” and current project state

## Constraints (project contracts)

- **Stack**: NestJS + Bun + TypeScript (no migration)
- **Channels**: new channels must be implemented as **NestJS modules**; pipeline/plan modules remain **channel-agnostic**
- **Secrets**: no credentials in git; secrets via KSM; only `BRIDGE_MASTER_KEY` may exist in env
- **SDK boundary**: `packages/gsd-sdk` and `packages/bridge-sdk` must not import NestJS
- **Container security**: no broad permissions; read-only rootfs; uid 1000

## Useful docs

- `docs/ROADMAP.md`
- `docs/VERIFICATION.md`
- `docs/PROJECT.md`
- `.planning/PROJECT.md`

