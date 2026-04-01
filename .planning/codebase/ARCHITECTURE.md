# Architecture

**Analysis Date:** 2026-04-01

## Pattern Overview

**Overall:** NestJS-based modular microservice with event-driven async processing, using a distributed multi-module architecture with service composition and adapter pattern for AI provider integration.

**Key Characteristics:**
- Module-per-feature design with explicit exports and dependency injection
- Event-sourced execution via BullMQ queues (Redis-backed)
- Provider adapter pattern for pluggable AI models (OpenAI, Gemini, OpenRouter, Claude, custom CLI)
- TypeORM entities with PostgreSQL persistence
- Layered architecture: HTTP controllers → services → persistence
- Async job workers for long-running operations
- Optional Docker sandboxing for plan execution

## Layers

**HTTP/API Layer:**
- Purpose: Handle incoming HTTP requests and serve health/project endpoints
- Location: `packages/nest-core/src/module/health/health.controller.ts`, `packages/nest-core/src/module/project/project.controller.ts`
- Contains: NestJS controllers with route handlers
- Depends on: Service layer (ProjectService, HealthCheckService)
- Used by: External API clients, monitoring systems

**Service Layer (Business Logic):**
- Purpose: Core business logic, state management, orchestration
- Location: `packages/nest-core/src/module/*/[service-name].service.ts`
- Contains: Injectable services for each module (Brain, Plan, Pipeline, Telegram, etc.)
- Depends on: Persistence layer, external SDKs, event bus
- Used by: Controllers, workers, other services

**Event/Queue Layer:**
- Purpose: Async job queueing and event publishing with persistence
- Location: `packages/nest-core/src/module/events/events.service.ts`
- Contains: BullMQ queue management, AppEvent entity persistence
- Depends on: Redis, PostgreSQL, TypeORM
- Used by: All services needing async execution

**Worker/Consumer Layer:**
- Purpose: Process queued jobs asynchronously
- Location: `packages/nest-core/src/module/*/[name].worker.ts`
- Contains: BullMQ `@Processor` decorated classes listening to specific queues
- Depends on: Service layer, event marking
- Used by: BullMQ runtime, triggered by queue events

**Persistence Layer (Data Access):**
- Purpose: Database operations and entity management
- Location: `packages/nest-core/src/persistence/`
- Contains: TypeORM entities, migrations, DataSource configuration
- Depends on: PostgreSQL, TypeORM decorators
- Used by: All services via repository injection

**SDK/Integration Layer:**
- Purpose: External service communication and GSD pipeline orchestration
- Location: `packages/gsd-sdk/`, `packages/bridge-sdk/`
- Contains: GSD pipeline engine, provider adapters, Obsidian/Postgres transports
- Depends on: External APIs (OpenAI, Gemini, Anthropic), WebSockets
- Used by: PipelineService for plan execution

**Infrastructure Layer:**
- Purpose: System-level services and resource management
- Location: `packages/nest-core/src/module/docker/docker.service.ts`, `packages/nest-core/src/module/ksm/ksm.service.ts`
- Contains: Docker container management, encryption/decryption, workspace provisioning
- Depends on: Dockerode, Node crypto, file system
- Used by: Pipeline service for sandbox execution

## Data Flow

**Plan Execution Flow:**

1. User submits prompt via Telegram → **TelegramBotService** → creates Plan with status 'draft'
2. User approves plan → **PlanService.approvePlan()** transitions to 'approved_queued', publishes `plan.execution_queued` event
3. Event published to **QUEUE_EXECUTION_JOBS** (BullMQ)
4. **ExecutionWorker** claims job, calls **PipelineService.executeProject(planId)**
5. **PipelineService**:
   - Provisions workspace via **WorkspaceService**
   - Optionally creates Docker container via **DockerService**
   - Creates GSD instance with **BrainService** as provider adapter
   - Registers transports: **ObsidianTransport**, **PostgresTransport**
   - Runs GSD.run(prompt) which iteratively calls **BrainService.generate()**
   - **BrainService** resolves configured provider and routes to **BridgeSDK** providers
   - Emits GSD events to **ObsidianSyncService**, **TelegramNotifierService**
   - Marks plan completed/failed based on result
6. **ObsidianSyncService** syncs phase data to Obsidian vault
7. **MetricsService** records execution metrics
8. **PostgresTransport** persists GSD events to **AppEvent** table

**Event Publishing Flow:**

1. Service calls **EventsService.publish(options)** with type, channel, payload
2. Event persisted to **AppEvent** table with status 'pending'
3. BullMQ queue.add() pushes to corresponding Redis queue
4. Worker decorator processes queue, calls handler
5. Handler marks event 'processed' or 'failed' after completion

**State Management:**

- Plan states: 'draft' → 'awaiting_approval' → 'approved_queued' → 'executing' → 'completed'|'failed'|'stopped' → 'archived'
- Project states: 'active', 'archived', 'paused'
- Phase states: 'pending', 'running', 'completed', 'failed', 'skipped'
- Event states: 'pending' → 'processed'|'failed'

## Key Abstractions

**ProviderAdapter (Interface):**
- Purpose: Pluggable AI provider abstraction
- Examples: `packages/bridge-sdk/src/providers/`, `packages/nest-core/src/module/brain/brain.service.ts`
- Pattern: Implement `ProviderAdapter` interface with `generate()` method; supports OpenAI, Gemini, OpenRouter, Claude CLI, custom CLI

**Module (NestJS Pattern):**
- Purpose: Cohesive feature grouping with dependency injection
- Examples: `BrainModule`, `PipelineModule`, `EventsModule`, `TelegramModule`, `DockerModule`
- Pattern: `@Module()` with imports, providers, controllers, exports; hierarchical composition

**Worker/Processor (BullMQ Pattern):**
- Purpose: Async job processing
- Examples: `ExecutionWorker`, `ProjectEventsWorker`, `WorkflowEventsWorker`
- Pattern: `@Processor(queueName)` class with `@Process()` decorated methods

**Entity (TypeORM Pattern):**
- Purpose: Database table/row mapping
- Examples: `Project`, `Plan`, `Phase`, `ExecutionMetric`, `AppEvent`, `Secret`
- Pattern: `@Entity()` decorated class with column/relation decorators

**Service (NestJS Injectable):**
- Purpose: Reusable business logic
- Examples: `PipelineService`, `PlanService`, `BrainService`, `KsmService`
- Pattern: `@Injectable()` class with dependencies injected via constructor

## Entry Points

**HTTP/REST:**
- Location: `packages/nest-core/src/module/health/health.controller.ts`, `packages/nest-core/src/module/project/project.controller.ts`
- Triggers: HTTP GET /health, POST /projects
- Responsibilities: Health check, project management endpoints

**Telegram Bot:**
- Location: `packages/nest-core/src/module/telegram/telegram-bot.service.ts`
- Triggers: Telegram messages to bot
- Responsibilities: Parse intent, manage conversation state, trigger plan workflows

**BullMQ Workers:**
- Location: `packages/nest-core/src/module/*/[name].worker.ts`
- Triggers: Messages in Redis queues
- Responsibilities: Consume and process async jobs (execution, events, project events)

**Bootstrap:**
- Location: `packages/nest-core/src/app.module.ts`
- Triggers: Application startup
- Responsibilities: Wire all modules, configure TypeORM, Redis, config

## Error Handling

**Strategy:** Try-catch with logging, service-level exception classes, event marking on failure

**Patterns:**
- TypeORM errors bubble up; services catch and log
- BullMQ workers catch errors, mark events 'failed', continue
- PipelineService catches execution errors, updates plan to 'failed', notifies Telegram
- KsmService and DockerService log warnings; failures don't crash app (optional Docker)
- Plan recovery on startup: `PlanService.onModuleInit()` resets interrupted 'executing' plans to 'approved_queued'

## Cross-Cutting Concerns

**Logging:** NestJS Logger injected in all services; configurable via NODE_ENV

**Validation:** Database constraints (UNIQUE, NOT NULL); service-level status assertions (PlanService.assertStatus)

**Authentication:** KsmService encrypts/decrypts secrets; ProjectProvider resolution via secret storage

**Auditing:** SecretAudit entity tracks secret mutations; AppEvent persists all workflow events with correlation IDs

**Resource Limits:** Workspace provisioning with directory isolation; Docker containers use read-only filesystem, resource caps, dropped capabilities

**Event Correlation:** correlationId (planId) and conversationId tracked through event flow for distributed tracing

---

*Architecture analysis: 2026-04-01*
