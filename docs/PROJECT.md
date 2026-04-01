# bridge-ai — Project Definition

**Version:** 1.0.0-alpha
**Created:** 2026-03-31
**Status:** Active Development

---

## Vision

bridge-ai is an **intelligence factory**: it transforms natural language intent into organized, structured, queryable knowledge — persisted in an Obsidian vault and PostgreSQL — while autonomously executing the work through isolated Docker containers.

The intelligence is the product. The code is a side effect.

Users describe what they want to build through external channels (Telegram for MVP; Discord in v2). The platform generates a structured roadmap, plans and executes phases inside Docker sandboxes, and produces a living knowledge base in Obsidian that grows smarter with every completed project.

> **Repository context:** The `gsd-brain/` and `ai-jail/` directories are reference material only. They served as the design input for bridge-ai. They are not runtime dependencies and will be removed once bridge-ai's own implementation is complete.

---

## Core Business Domains

bridge-ai has three inseparable core domains. These are not infrastructure details — they are the product:

### 1. The Intelligence Vault (Obsidian)
The Obsidian vault is the canonical output of every execution. Every piece of knowledge the system produces — roadmaps, phase plans, decisions, verification reports, retrospectives, metrics dashboards — lives in the vault. The vault is organized, linked, searchable, and human-editable. It grows richer with every project. This is what users come for.

### 2. The Execution Pipeline
The pipeline is the structured lifecycle engine: `discuss → research → plan → execute → verify`. It is not a raw loop or a one-shot prompt. Every step produces a durable artifact. The pipeline knows how to pause for human decisions, resume after approval, recover from crashes, and retry failed steps. It is built on top of the GSD SDK (adapted and internalized as `packages/gsd-sdk`).

### 3. The Intelligence Brain (AI-agnostic LLM Layer)
The brain is how the pipeline consults AI. It is fully provider-agnostic: OpenRouter, Gemini, OpenAI, Claude CLI, Gemini CLI, or any custom CLI. The brain manages model selection, API key resolution (via KSM), token tracking, cost attribution, and the fallback chain. Switching providers does not change how the pipeline works.

---

## Core Principles

1. **Intelligence first** — the primary output is organized knowledge in Obsidian and PostgreSQL. Code is a side effect.
2. **Pipeline as the backbone** — the discuss→research→plan→execute→verify lifecycle is non-negotiable. No shortcuts, no raw loops.
3. **AI-agnostic** — the platform has no mandatory AI provider. Users choose and configure their own. The pipeline works identically regardless of which LLM is behind it.
4. **Obsidian as the knowledge interface** — not just a sync target. The vault is the product UI. All intelligence flows through it.
5. **Secrets never in plaintext** — all secrets managed via KSM (encrypted PostgreSQL store). No `.env` files with credentials. No secrets in git.
6. **SDK-first** — the core pipeline and brain are encapsulated in `packages/gsd-sdk` and `packages/bridge-sdk`. The NestJS app is a consumer, not the container of business logic.
7. **Container-enforced isolation** — execution happens inside Docker sandboxes. Security is structural.
8. **Channel-agnostic** — Telegram is the first channel. The core pipeline knows nothing about it.

---

## Functional Requirements

### FR-01 — Channel Intake
The platform MUST accept project creation and management commands from external messaging channels. Telegram is mandatory for MVP. Discord is v2.

### FR-02 — Structured Lifecycle Execution
When a user approves a project, the platform MUST run a full structured lifecycle: `new-project → roadmap → phases (discuss → plan → execute → verify)` using the internalized GSD pipeline engine (`packages/gsd-sdk`).

### FR-03 — Docker Sandbox
Each project MUST execute inside an isolated Docker container with access only to its workspace directory. The AI CLI (Claude Code, Gemini CLI, or custom) runs inside this container.

### FR-04 — Obsidian Intelligence Vault
All structured artifacts (ROADMAP.md, STATE.md, PLAN files, CONTEXT.md, VERIFICATION.md, SUMMARY.md) and all derived intelligence (metrics dashboards, project index, cost reports, retrospectives) MUST be written to the Obsidian vault. The vault is organized, consistent, and kept in sync after every phase completion.

### FR-05 — PostgreSQL as Source of Truth
All machine-readable state (projects, plans, phases, executions, metrics, events, secrets) MUST be stored in PostgreSQL via TypeORM. PostgreSQL is the authoritative operational store.

### FR-06 — Multi-Project Support
The platform MUST support multiple simultaneous projects from multiple users/conversations, with full isolation of state, execution, and vault artifacts.

### FR-07 — Execution Observability
The platform MUST record per-phase metrics: start time, end time, cost (USD), tokens consumed, model used, iteration count, success/failure. Metrics are stored in PostgreSQL and published to the Obsidian vault as a dashboard.

### FR-08 — Crash Recovery
On restart, the platform MUST recover any `executing` phases, re-queue them, and notify the user via their channel.

### FR-09 — Plan Approval Flow
Users MUST be able to review and approve (or reject/modify) a generated ROADMAP before execution begins. Auto-approve is configurable per project.

### FR-10 — Stop / Retry
Users MUST be able to stop a running execution and retry from the last checkpoint.

### FR-11 — AI Provider Agnosticism
The platform MUST support pluggable AI providers per project. Supported providers for MVP:
- **OpenRouter** (default) — any model via unified API
- **Google Gemini** — via REST API
- **OpenAI / compatible** — via REST API (compatible with any OpenAI-spec endpoint)
- **Claude CLI** — subprocess (`claude -p`) — for Docker container execution
- **Gemini CLI** — subprocess (`gemini`) — alternative CLI
- **Custom CLI** — any tool accepting prompt via stdin or flag; fully user-configurable

Provider selection, model choice, and API keys are stored per-project in KSM — not in a global `.env`.

### FR-12 — Provider Fallback Chain
When no project provider is configured, LLM calls MUST cascade: OpenRouter → Gemini → OpenAI → Claude CLI, with transparent status notifications.

### FR-13 — KSM: Secrets Management
All secrets (API keys, tokens, database password) MUST be managed via the `KsmModule` — an envelope-encrypted store backed by PostgreSQL. The only external secret is `BRIDGE_MASTER_KEY`. No credentials in `.env`, no credentials in git.

### FR-14 — SDK Distribution
The pipeline engine and brain layer MUST be published as installable packages (`packages/gsd-sdk`, `packages/bridge-sdk`) that third-party projects can consume independently of the NestJS app.

---

## Non-Functional Requirements

### NFR-01 — Reliability
Plan state survives worker restarts (PostgreSQL transactions + BullMQ job persistence).

### NFR-02 — Scalability
All shared state uses PostgreSQL row-level locking. Multiple worker instances are safe to run concurrently.

### NFR-03 — Testability
Core business logic (pipeline, brain, KSM, Obsidian sync) has ≥80% test coverage. NestJS modules use constructor injection for easy mocking.

### NFR-04 — Modularity
Channel adapters are decoupled from the pipeline via canonical events. Adding a channel requires only a new NestJS module.

### NFR-05 — Auditability
Every event is persisted to PostgreSQL with full payload and processing status.

### NFR-06 — Maintainability
No source file exceeds 300 lines. Each NestJS module has a single responsibility.

### NFR-07 — Container Security
Docker containers run as non-root. No host filesystem access outside the mounted workspace. Permission escalation to `allow: ["*"]` is prohibited.

### NFR-08 — Zero-Secret Deployment
The Docker image contains no embedded credentials. All secrets are injected at runtime via KSM.

---

## Technology Stack

### Application Layer (NestJS)
| Layer | Technology | Notes |
|-------|-----------|-------|
| Framework | NestJS 10+ | DI, modules, guards, interceptors |
| Runtime | Bun (primary) + Node.js 22 (compat) | Bun runs dev/test/build; Node.js kept for compatibility where required |
| Language | TypeScript 5+ | Strict mode; no `any` outside generated types |
| ORM | TypeORM | Decorator entities, repository pattern, `@nestjs/typeorm` |
| Migrations | TypeORM CLI | `migration:generate`, `migration:run`, `migration:revert` |
| Job queues | BullMQ + `@nestjs/bull` | Phase execution jobs, crash recovery |
| Monorepo tool | Nx | `nx` targets, generators, task caching, project graph |
| Package manager | Bun | `bun install`, `bun run` (root scripts), workspace dependencies |
| Build/Dev | Nx + Bun | `bunx nx serve api`, `bunx nx test`, `bunx nx build` |

### Infrastructure
| Service | Technology | Purpose |
|---------|-----------|---------|
| Database | PostgreSQL 16 | Operational source of truth |
| Queue backend | Redis 7 (Alpine) | BullMQ backing store |
| Container runtime | Docker + Docker Compose | Project execution isolation |
| Intelligence vault | Obsidian | Human-readable knowledge interface |
| KSM store | PostgreSQL + AES-256-GCM | Encrypted secrets; upgradeable to Vault/SSM |

### AI Provider Support
| Provider | Integration | Notes |
|----------|------------|-------|
| OpenRouter | REST API | Any model (Claude, GPT-4, Llama, Mistral, etc.) |
| Google Gemini | REST API | `gemini-2.0-flash` default; configurable |
| OpenAI | REST API | GPT-4o, o1; any OpenAI-spec endpoint |
| Claude CLI | subprocess | `claude -p <prompt>` — runs inside Docker containers |
| Gemini CLI | subprocess | `gemini` — alternative container CLI |
| Custom CLI | subprocess | User-defined command + args template |

### Packages (Internal SDK)
| Package | Description |
|---------|-------------|
| `packages/gsd-sdk` | Internalized and adapted GSD SDK. Core pipeline engine: `PhaseRunner`, `GSD`, `ContextEngine`, `EventStream`, `PromptFactory`, `GSDTools`, plan parsing. Modified to be AI-agnostic (provider-injectable). |
| `packages/bridge-sdk` | bridge-ai's public SDK. `Pipeline` class composing gsd-sdk + bridge-specific providers, Obsidian client, and artifact writer. Framework-agnostic. |

### NestJS Modules (`apps/api/src/modules/`)
| Module | Responsibility |
|--------|---------------|
| `TelegramModule` | Bot, command routing, canonical payload builder, notifier |
| `PipelineModule` | Lifecycle orchestration — wraps `packages/gsd-sdk` `PhaseRunner`; translates `GSDEvent` stream to channel notifications; implements `HumanGateCallbacks` |
| `BrainModule` | AI-agnostic provider abstraction: `generate(prompt, projectId)`, provider routing, fallback chain, cost tracking |
| `DockerModule` | Per-project container lifecycle: create, exec, stop, remove |
| `ObsidianModule` | Vault sync: artifact mirroring, dashboard generation, index maintenance |
| `MetricsModule` | Per-phase metrics recording and aggregation |
| `KsmModule` | Envelope-encrypted secrets store: create, read, rotate, audit |
| `ProjectModule` | Project CRUD, settings, provider config |
| `PlanModule` | Plan lifecycle state machine (draft→executing→completed) with PG locking |
| `EventsModule` | Canonical event bus, BullMQ dispatch, PostgreSQL audit log |
| `HealthModule` | Provider health checks, system status |

---

## `packages/gsd-sdk` — Adaptation Strategy

The GSD SDK (`gsd-brain/sdk/`) is the most valuable piece of the reference implementation. It contains a production-grade pipeline engine. Rather than reimplementing it, bridge-ai copies it into `packages/gsd-sdk` and makes targeted adaptations:

### What is copied as-is
- `PhaseRunner` — full lifecycle state machine (discuss→research→plan→execute→verify)
- `GSD` class — top-level orchestrator (executePlan, runPhase, run)
- `ContextEngine` — phase-specific context file resolution
- `GSDEventStream` + all event types — typed event system
- `PromptFactory` — phase prompt construction
- `GSDTools` — state management CLI wrapper
- `plan-parser` — PLAN.md frontmatter + task body parsing
- All TypeScript types and interfaces

### What is adapted
- **`session-runner.ts`** — currently hardcoded to `@anthropic-ai/claude-agent-sdk`. Adapted to accept a `ProviderAdapter` interface injected at construction time. The `query()` call becomes `provider.generate(prompt, options)`.
- **`config.ts`** — `model_profile` expanded to include bridge-ai provider configs (OpenRouter model, Gemini model, etc.)
- **`GSDOptions`** — extended with `provider?: ProviderAdapter` to allow injection.

### What bridge-ai adds
- `ProviderAdapter` interface — the abstraction that `BrainModule` implements and injects into the SDK
- `ObsidianTransport` — a `TransportHandler` implementation that writes events to the vault in real-time
- `PostgresTransport` — a `TransportHandler` that persists events to the `events` audit table

---

## Obsidian Vault Architecture

The vault is not just a sync target — it is the **core product interface** (“the brain”). It is organized by **access frequency** using PARA (**projects / areas / resources / archive**) plus an **inbox** for unclassified intake.

The structure is optimized for:
- **LLM navigation** (Dataview + consistent frontmatter + deliberate wikilinks)
- **Obsidian graph quality** (stable note IDs, strong cross-links, predictable tags)
- **Efficiency** (templates avoid boilerplate; dashboards provide fast retrieval)

### Vault Root (PARA)

```
volumes/obsidian/
├── index.md                        # Master navigation (Dataview-powered)
├── RULES-AND-CONVENTIONS.md        # Vault-wide rules (LLM-first)
├── inbox/                          # Unclassified intake
├── projects/                       # Project-scoped execution intelligence
├── areas/                          # Project-agnostic knowledge domains (LLM decides)
├── resources/                      # Frequently referenced materials
├── archive/                        # Deprecated/completed items
├── Assets/                         # Obsidian auxiliary: images/media
├── Attachments/                    # Obsidian auxiliary: PDFs/exports
└── Templates/                      # Obsidian auxiliary: note templates
```

### `projects/` — project-specific knowledge

```
projects/<project-slug>/
├── MOC.md                          # Map of Content (entry point)
├── README.md
├── ROADMAP.md
├── STATE.md
├── REQUIREMENTS.md
├── CONFIG.md                       # Human-readable config (no secrets)
├── phases/
│   └── 01-phase-name/
│       ├── CONTEXT.md
│       ├── RESEARCH.md
│       ├── EXECUTION-LOG.md
│       ├── VERIFICATION.md
│       └── plans/
│           ├── 01-01-plan-name-PLAN.md
│           └── 01-01-plan-name-SUMMARY.md
└── retrospective.md                # Extraction of reusable knowledge → areas/
```

### `areas/` — knowledge domains (project-agnostic)

Areas are long-lived knowledge domains such as cybersecurity, databases, infrastructure, AI engineering. The LLM can create new areas when needed.

```
areas/
├── MOC.md
└── <area-slug>/
    ├── MOC.md
    ├── patterns.md                 # Reusable patterns
    ├── pitfalls.md                 # Known failure modes
    └── <topic-note>.md
```

### `resources/` — periodically accessed references

```
resources/
├── MOC.md
├── provider-catalog.md
├── dataview-queries.md
└── glossary.md
```

### `archive/` — deprecated or inactive

```
archive/
├── projects/
├── areas/
└── resources/
```

### `inbox/` — intake / unclassified

```
inbox/
└── YYYY-MM-DD-<slug>.md
```

## Frontmatter Standard (LLM-first)

Every note MUST have YAML frontmatter. This is the primary indexing mechanism for the LLM and for Dataview.

**Universal fields (every note):**

```yaml
---
type: project | area | resource | archive | inbox | index | template
title: "Human-readable title"
created: 2026-03-31
updated: 2026-03-31
tags:
  - status/active          # status/active, status/completed, status/archived, status/draft, status/failed
aliases: []
links: []                  # explicit wikilinks (optional but recommended)
---
```

**Project notes (in `projects/<project>/`):**

```yaml
---
type: project
scope: project
project: my-api
status: executing           # draft, awaiting_approval, executing, completed, failed, stopped
provider: openrouter
model: claude-sonnet-4-6
phase: "01"
phase_name: "Foundation Setup"
plan: "01-01"
cost_usd: 0.42
duration_ms: 128000
tokens_in: 15200
tokens_out: 4800
---
```

**Area notes (in `areas/<area>/`):**

```yaml
---
type: area
scope: global
domain: infrastructure
confidence: high            # high, medium, low
last_validated: 2026-03-31
source_projects:
  - "[[projects/my-api/MOC]]"
---
```

**Resource notes (in `resources/`):**

```yaml
---
type: resource
scope: global
domain: ai-engineering
access: periodic            # periodic, occasional, rare
---
```

## Linking & Tag Conventions (Graph-first)

**Wikilink rules:**
- Every `projects/<project>/` note links to `[[projects/<project>/MOC]]`
- Every phase note links to its project MOC and adjacent phases (prev/next)
- Every plan `SUMMARY.md` links to its `VERIFICATION.md` and the key `areas/` notes it contributed to
- Every `areas/` note includes `source_projects` links back to projects

**Tag taxonomy:**
- `#status/*`: `active`, `executing`, `completed`, `failed`, `archived`, `draft`
- `#domain/*`: matches `areas/<area-slug>` (e.g. `#domain/cybersecurity`)
- `#phase/*`: `discuss`, `research`, `plan`, `execute`, `verify`
- `#provider/*`: `openrouter`, `gemini`, `openai`, `claude-cli`, `custom-cli`
- `#project/*`: `#project/<project-slug>` for cross-filtering

## `index.md` (LLM navigation)

`index.md` is the primary entrypoint for the LLM to query the brain.

```markdown
# Bridge-AI Brain

## Active Projects
```dataview
TABLE file.link AS "Project", status, phase, provider, cost_usd
FROM "projects"
WHERE contains(tags, "status/active")
SORT updated DESC
```

## Recent Area Knowledge
```dataview
TABLE file.link AS "Note", domain, confidence, source_projects
FROM "areas"
SORT updated DESC
LIMIT 15
```

## Inbox
```dataview
LIST
FROM "inbox"
SORT created DESC
```
```

## Templates (efficiency)

Templates exist to prevent LLM boilerplate and enforce consistent structure.

Minimum templates in `Templates/`:
- `project-moc.md`
- `phase-context.md`
- `phase-plan.md`
- `phase-summary.md`
- `phase-verification.md`
- `execution-log.md`
- `retrospective.md`
- `area-note.md`
- `resource-note.md`
- `inbox-note.md`

## Sync Options (only two)

Only two supported vault sync methods:
- **Obsidian Sync** (official)
- **Git sync** via the `obsidian-git` plugin + a remote repository

bridge-ai writes files to the local vault directory; syncing is handled by one of the two options above.

## `RULES-AND-CONVENTIONS.md`

This file defines the vault’s rules (naming, frontmatter fields, tags, linking rules, where content belongs in PARA, and how to archive). It is the authoritative guide for both user and LLM.

---

## Monorepo Structure

```
bridge-ai/
├── nx.json                          # Nx workspace configuration
├── package.json                     # Root scripts (bunx nx ...)
├── bun.lockb                        # Bun lockfile
├── apps/
│   └── api/                         # Nx app: NestJS runtime
│       ├── project.json             # Nx targets: serve/build/test/lint
│       ├── src/
│       │   ├── modules/
│       │   │   ├── telegram/
│       │   │   ├── pipeline/
│       │   │   ├── brain/
│       │   │   ├── docker/
│       │   │   ├── obsidian/
│       │   │   ├── metrics/
│       │   │   ├── ksm/
│       │   │   ├── project/
│       │   │   ├── plan/
│       │   │   ├── events/
│       │   │   └── health/
│       │   ├── entities/            # TypeORM entities
│       │   ├── migrations/          # TypeORM migration files
│       │   ├── common/
│       │   ├── config/
│       │   └── main.ts
│       ├── scripts/
│       │   ├── half-loop.sh
│       │   └── ai-cli-wrappers/
│       └── docker-compose.yml
├── packages/                        # Nx libs + SDKs
│   ├── gsd-sdk/                     # Adapted GSD SDK (internalized)
│   │   ├── src/
│   │   │   ├── phase-runner.ts      # Full lifecycle state machine (unchanged)
│   │   │   ├── context-engine.ts    # Phase context resolution (unchanged)
│   │   │   ├── event-stream.ts      # Typed event system (unchanged)
│   │   │   ├── prompt-factory.ts    # Phase prompts (unchanged)
│   │   │   ├── gsd-tools.ts         # State CLI wrapper (unchanged)
│   │   │   ├── plan-parser.ts       # PLAN.md parser (unchanged)
│   │   │   ├── session-runner.ts    # ADAPTED: provider-injectable (not Claude-only)
│   │   │   ├── provider-adapter.ts  # NEW: ProviderAdapter interface
│   │   │   ├── obsidian-transport.ts # NEW: TransportHandler → vault writes
│   │   │   ├── postgres-transport.ts # NEW: TransportHandler → PG audit log
│   │   │   ├── types.ts             # All types (unchanged + bridge extensions)
│   │   │   └── index.ts
│   │   └── package.json
│   └── bridge-sdk/                  # Public SDK (@bridge-ai/sdk)
│       ├── src/
│       │   ├── pipeline.ts          # Pipeline class: composes gsd-sdk + providers
│       │   ├── providers/           # REST + CLI provider implementations
│       │   ├── obsidian-client.ts   # Vault sync client
│       │   └── index.ts
│       └── package.json
├── volumes/                         # Docker-mounted data (gitignored)
│   ├── obsidian/                    # Obsidian vault
│   └── workspaces/                  # Project execution workspaces
├── PROJECT.md
└── ROADMAP.md
```

> `gsd-brain/` and `ai-jail/` directories in this repo are reference material. They will be removed once bridge-ai is complete.

---

## Key Architectural Decisions

### ADR-01: NestJS + TypeScript
**Decision:** Build bridge-ai from scratch in NestJS 10 with TypeScript.
**Rationale:** NestJS provides the DI container, testability, and ecosystem (`@nestjs/typeorm`, `@nestjs/bull`) needed for production reliability.

### ADR-02: PostgreSQL + TypeORM
**Decision:** PostgreSQL 18 with TypeORM as the sole operational data store.
**Rationale:** ACID transactions, row-level locking for plan claims, JSONB for flexible event payloads. TypeORM integrates natively with NestJS and provides a mature migration system.
**Consequences:** Entities in `apps/api/src/entities/`. Migrations via `bun run typeorm migration:run` (or `bunx typeorm ...` via Nx target). All repositories scoped by `projectId`.

### ADR-03: BullMQ over raw RabbitMQ
**Decision:** BullMQ (Redis-backed) for job queues.
**Rationale:** Native NestJS integration, job retries, delayed jobs, Bull Board UI — without manual AMQP exchange/binding/DLQ configuration.

### ADR-04: GSD SDK internalized as `packages/gsd-sdk`
**Decision:** Copy the GSD SDK from `gsd-brain/sdk/` into `packages/gsd-sdk` and adapt it rather than depending on the external repo.
**Rationale:** The GSD SDK is a production-grade pipeline engine. Reimplementing it is wasteful. Adapting it is the right approach. Internalization gives full control over evolution without external dependency management.
**Key adaptation:** `session-runner.ts` is decoupled from `@anthropic-ai/claude-agent-sdk` by introducing `ProviderAdapter` — an interface that `BrainModule` implements and injects, making the entire pipeline AI-agnostic.

### ADR-05: `BrainModule` as the AI abstraction layer
**Decision:** All LLM calls go through `BrainModule.generate(prompt, projectId, options)`. No direct provider calls in pipeline or business logic.
**Rationale:** Provider agnosticism is a core business requirement. The brain resolves the right provider from KSM per project, tracks cost, implements the fallback chain, and emits cost events to the event stream.

### ADR-06: Obsidian vault as first-class product output
**Decision:** The Obsidian vault is not a sync target — it is the knowledge product. Its directory structure, linking conventions, and dashboard generation are designed to be useful in Obsidian's graph view.
**Rationale:** Users want to see, navigate, and edit the intelligence produced. Obsidian is the best tool for this. The vault makes bridge-ai's output tangible and durable.

### ADR-07: KSM as first-class module
**Decision:** `KsmModule` with envelope encryption (PostgreSQL-backed, AES-256-GCM). Single `BRIDGE_MASTER_KEY` env var.
**Rationale:** Per-project API keys cannot live in a global `.env`. Envelope encryption allows all secrets to live in PostgreSQL, encrypted at rest, accessible only at runtime.

### ADR-08: SDK-first architecture
**Decision:** `packages/gsd-sdk` and `packages/bridge-sdk` contain zero NestJS imports. The NestJS app consumes them.
**Rationale:** Clean separation between framework and business logic. Enables third-party SDK usage. Enforces testability.

### ADR-09: Channel adapter pattern
**Decision:** Channel adapters (Telegram, Discord) publish canonical events. The pipeline and plan modules are channel-agnostic.
**Rationale:** The canonical event payload design decouples user interaction from execution. Adding Discord requires only a new NestJS module.
