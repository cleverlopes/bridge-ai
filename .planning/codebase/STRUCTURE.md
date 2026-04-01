# Codebase Structure

**Analysis Date:** 2026-04-01

## Directory Layout

```
/workspace/
├── packages/                              # Nx monorepo packages
│   ├── nest-core/                         # Main NestJS backend application
│   │   ├── src/
│   │   │   ├── app.module.ts              # Root NestJS module, wires all features
│   │   │   ├── module/                    # Feature modules (one per directory)
│   │   │   │   ├── brain/                 # AI provider adapter & generation
│   │   │   │   ├── pipeline/              # Plan execution orchestration
│   │   │   │   ├── plan/                  # Plan state management
│   │   │   │   ├── project/               # Project CRUD
│   │   │   │   ├── events/                # Event bus & queue management
│   │   │   │   ├── telegram/              # Telegram bot integration
│   │   │   │   ├── docker/                # Container sandbox management
│   │   │   │   ├── obsidian/              # Obsidian vault sync
│   │   │   │   ├── metrics/               # Execution metrics tracking
│   │   │   │   ├── ksm/                   # Key/secret management (encryption)
│   │   │   │   └── health/                # Liveness/readiness checks
│   │   │   └── persistence/               # Data access layer
│   │   │       ├── entity/                # TypeORM entities
│   │   │       └── migrations/            # Database migrations
│   │   ├── jest.config.js                 # Jest test configuration
│   │   └── tsconfig.lib.json              # TypeScript config for lib
│   ├── gsd-sdk/                           # AI-agnostic execution engine
│   │   └── src/                           # TypeScript sources
│   │       ├── gsd.ts                     # Main GSD class
│   │       ├── index.ts                   # Public exports
│   │       └── ...                        # Event types, adapters, transports
│   └── bridge-sdk/                        # Provider stubs & utilities
│       └── src/                           # TypeScript sources
│           ├── providers/                 # AI provider implementations
│           └── ...                        # Obsidian client, utilities
├── volumes/                               # Runtime data (git-ignored)
│   ├── workspaces/                        # Project execution workspaces
│   └── obsidian/                          # Obsidian vault directory
├── .planning/                             # GSD planning artifacts
│   └── codebase/                          # Codebase documentation (this file)
├── docker-compose.yml                     # PostgreSQL, Redis, app services
├── tsconfig.base.json                     # Root TypeScript config
├── package.json                           # Dependencies, scripts
├── nx.json                                # Nx configuration
└── bun.lock                               # Package lock file
```

## Directory Purposes

**packages/nest-core/:**
- Purpose: Main backend application, all business logic and API
- Contains: NestJS modules, TypeORM entities, BullMQ workers, database migrations
- Key files: `src/app.module.ts` (root), `src/module/*/[service|controller|worker].ts`

**packages/nest-core/src/module/:**
- Purpose: Feature modules following NestJS conventions
- Contains: Service, Controller, Module, Worker per feature area
- Pattern: Each subdirectory is a feature module (brain, pipeline, plan, events, etc.)

**packages/nest-core/src/module/pipeline/:**
- Purpose: Plan execution orchestration and workspace provisioning
- Key files:
  - `pipeline.service.ts`: Main orchestrator, GSD setup and run
  - `pipeline.module.ts`: Wires Brain, Plan, Events, Telegram, Docker, Obsidian
  - `execution.worker.ts`: BullMQ worker for QUEUE_EXECUTION_JOBS
  - `workspace.service.ts`: Workspace directory provisioning
  - `human-gate.bridge.ts`: Telegram approval callbacks

**packages/nest-core/src/module/brain/:**
- Purpose: AI provider adapter, model resolution, cost tracking
- Key files:
  - `brain.service.ts`: Implements ProviderAdapter, routes to bridged providers
  - `brain.module.ts`: Imports KsmService for secret storage

**packages/nest-core/src/module/events/:**
- Purpose: Event bus, BullMQ queue management, event persistence
- Key files:
  - `events.service.ts`: Publish events to queues and database
  - `events.module.ts`: Registers all three queues (EXECUTION_JOBS, WORKFLOW_EVENTS, PROJECT_EVENTS)
  - `project-events.worker.ts`: Worker for PROJECT_EVENTS queue

**packages/nest-core/src/module/plan/:**
- Purpose: Plan lifecycle state machine
- Key files:
  - `plan.service.ts`: Status transitions, recovery, archival, event publishing

**packages/nest-core/src/module/project/:**
- Purpose: Project CRUD and HTTP endpoints
- Key files:
  - `project.service.ts`: Database access
  - `project.controller.ts`: HTTP routes

**packages/nest-core/src/module/telegram/:**
- Purpose: Telegram bot command handling
- Key files:
  - `telegram-bot.service.ts`: Bot initialization and message routing
  - `telegram-notifier.service.ts`: Outbound message delivery
  - `conversation-state.service.ts`: Multi-turn state tracking
  - `telegram.module.ts`: Imports Project, Plan, Brain, Events, Docker, KSM

**packages/nest-core/src/module/docker/:**
- Purpose: Docker container lifecycle management
- Key files:
  - `docker.service.ts`: Container creation, execution, cleanup with security config

**packages/nest-core/src/module/obsidian/:**
- Purpose: Obsidian vault synchronization
- Key files:
  - `obsidian-sync.service.ts`: Vault structure setup, phase completion sync
  - `obsidian.templates.ts`: Markdown template generation

**packages/nest-core/src/module/metrics/:**
- Purpose: Execution cost and performance metrics
- Key files:
  - `metrics.service.ts`: Record phase metrics, aggregate by project/model

**packages/nest-core/src/module/ksm/:**
- Purpose: Encryption/decryption service for secrets
- Key files:
  - `ksm.service.ts`: AES-256-GCM encryption, secret rotation, audit logging

**packages/nest-core/src/module/health/:**
- Purpose: Health check endpoints
- Key files:
  - `health.controller.ts`: GET /health with db/redis status

**packages/nest-core/src/persistence/entity/:**
- Purpose: Database schema definitions
- Key files:
  - `project.entity.ts`: Project with settings, status
  - `plan.entity.ts`: Plan state machine
  - `phase.entity.ts`: Phase of execution
  - `execution-metric.entity.ts`: Performance metrics
  - `event.entity.ts`: Workflow event log
  - `secret.entity.ts`: Encrypted secrets with scope
  - `secret-audit.entity.ts`: Secret mutation audit

**packages/nest-core/src/persistence/migrations/:**
- Purpose: TypeORM schema migrations
- Key files: Timestamped migration files applied on startup

**packages/gsd-sdk/:**
- Purpose: Core execution engine (plan → phases → steps → AI calls)
- Contains: GSD class, event types, transport adapters (Obsidian, Postgres)
- Exports: GSD, types, transports via index.ts

**packages/bridge-sdk/:**
- Purpose: Provider implementations and utilities
- Contains: OpenAI, Gemini, OpenRouter, Claude, CustomCLI providers; Obsidian client

**volumes/:**
- Purpose: Runtime data directories
- Contents:
  - `workspaces/{projectId}/`: Project workspace with .planning, code
  - `obsidian/`: Obsidian vault with project dashboards and phase docs

**.planning/codebase/:**
- Purpose: GSD codebase analysis documents
- Contents: ARCHITECTURE.md, STRUCTURE.md, CONVENTIONS.md, TESTING.md, CONCERNS.md, STACK.md, INTEGRATIONS.md

## Key File Locations

**Entry Points:**
- `packages/nest-core/src/app.module.ts`: Root module, imports all features
- `packages/nest-core/src/module/health/health.controller.ts`: HTTP /health endpoint
- `packages/nest-core/src/module/project/project.controller.ts`: HTTP /projects endpoint
- `packages/nest-core/src/module/telegram/telegram-bot.service.ts`: Telegram bot listener

**Configuration:**
- `.env`: Environment variables (DATABASE_URL, REDIS_URL, API keys)
- `tsconfig.base.json`: Root TypeScript config
- `docker-compose.yml`: Local dev database/redis setup
- `packages/nest-core/jest.config.js`: Test runner config

**Core Logic:**
- `packages/nest-core/src/module/pipeline/pipeline.service.ts`: Plan execution orchestration
- `packages/nest-core/src/module/brain/brain.service.ts`: Provider routing and cost tracking
- `packages/nest-core/src/module/plan/plan.service.ts`: Plan state transitions
- `packages/nest-core/src/module/events/events.service.ts`: Event publishing and queue management

**Persistence:**
- `packages/nest-core/src/persistence/data-source.ts`: TypeORM DataSource config
- `packages/nest-core/src/persistence/entity/`: All entity definitions
- `packages/nest-core/src/persistence/migrations/`: Database schema

## Naming Conventions

**Files:**
- `*.module.ts`: NestJS modules (e.g., `pipeline.module.ts`)
- `*.service.ts`: Injectable services with business logic (e.g., `plan.service.ts`)
- `*.controller.ts`: HTTP request handlers (e.g., `project.controller.ts`)
- `*.worker.ts`: BullMQ job processors (e.g., `execution.worker.ts`)
- `*.entity.ts`: TypeORM table definitions (e.g., `plan.entity.ts`)
- `*.spec.ts`: Unit/integration tests (e.g., `brain.service.spec.ts`)

**Directories:**
- Module names are singular, lowercase feature names (e.g., `brain`, `pipeline`, `telegram`, not `brains`)
- Entity directory under persistence: `persistence/entity/`
- Workers colocated in module directory, not in separate folder

**Exports:**
- Queue names: UPPERCASE_SNAKE_CASE (e.g., `QUEUE_EXECUTION_JOBS`)
- Constants: camelCase when local (e.g., `PROVIDER_CONFIG_KEY_PREFIX`)
- Entities: PascalCase (e.g., `Plan`, `Project`, `Phase`)
- Services/Interfaces: PascalCase (e.g., `PipelineService`, `ProviderAdapter`)

## Where to Add New Code

**New Feature Module:**
1. Create `packages/nest-core/src/module/{feature}/` directory
2. Create `{feature}.module.ts` with @Module() decorator
3. Create `{feature}.service.ts` for business logic
4. Create `{feature}.controller.ts` if HTTP endpoints needed (optional)
5. Export service from module
6. Import feature module in `packages/nest-core/src/app.module.ts`

**New Database Entity:**
1. Create file in `packages/nest-core/src/persistence/entity/{entity}.entity.ts`
2. Define @Entity() class with @Column/@Relation decorators
3. Add to TypeOrmModule.forRootAsync() entities array in `app.module.ts`
4. Create migration file in `packages/nest-core/src/persistence/migrations/`

**New API Endpoint:**
1. Create or update `.controller.ts` in relevant module
2. Add @Controller, @Get/@Post/@Put/@Delete decorated methods
3. Inject service from same module
4. Add route to controller in module imports

**New BullMQ Worker:**
1. Create `packages/nest-core/src/module/{feature}/{event}.worker.ts`
2. Decorate with @Processor(queueName)
3. Add @Process() decorated method with Job<T> parameter
4. Add to module providers and BullModule.registerQueue() imports
5. Register queue in EventsService if new queue type

**New Provider Implementation:**
1. Create provider class in `packages/bridge-sdk/src/providers/{provider}.ts`
2. Implement ProviderAdapter interface (generate method)
3. Export from `packages/bridge-sdk/src/index.ts`
4. Add to BrainService.buildProvider() switch statement

**Shared Utilities:**
- Location: `packages/nest-core/src/` root (create files as needed, avoid deep nesting)
- For SDK utilities: `packages/bridge-sdk/src/` or `packages/gsd-sdk/src/`
- Export from module barrel files (index.ts)

## Special Directories

**volumes/workspaces/:**
- Purpose: Project execution workspace directories
- Generated: Yes (created by WorkspaceService.provisionWorkspace)
- Committed: No (git-ignored, contains runtime state)
- Content: Project code, .planning dir, workspace metadata

**volumes/obsidian/:**
- Purpose: Obsidian vault for project dashboards
- Generated: Yes (created by ObsidianSyncService.ensureVaultStructure)
- Committed: No (git-ignored)
- Content: Markdown files for projects and phases

**packages/nest-core/src/__mocks__/:**
- Purpose: Mock implementations for testing
- Generated: No
- Committed: Yes (checked in)
- Content: Mock BrainService, GsdService, etc. for tests

**dist/:**
- Purpose: Compiled JavaScript output
- Generated: Yes (built from src/)
- Committed: No (git-ignored)
- Content: Compiled .js/.d.ts files

**.nx/cache/:**
- Purpose: Nx task runner cache
- Generated: Yes (by Nx)
- Committed: No (git-ignored)

---

*Structure analysis: 2026-04-01*
