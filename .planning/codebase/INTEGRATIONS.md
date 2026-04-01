# External Integrations

**Analysis Date:** 2026-04-01

## APIs & External Services

**AI Provider APIs:**
- OpenRouter - Multi-model routing (SDK: `@bridge-ai/bridge-sdk` OpenRouterProvider)
  - Auth: `OPENROUTER_API_KEY` environment variable
  - Used by: `packages/nest-core/src/module/brain/brain.service.ts`
- Google Gemini - Text generation
  - Auth: `GEMINI_API_KEY` environment variable
  - Used by: GeminiProvider in bridge-sdk
- OpenAI API - GPT models
  - Auth: `OPENAI_API_KEY` environment variable
  - Base URL override supported via config
- Anthropic Claude - CLI-based provider
  - Auth: `ANTHROPIC_API_KEY` environment variable
  - Used by: ClaudeCliProvider (fallback chain)

**Messaging & Notifications:**
- Telegram Bot API - User command interface and notifications
  - SDK: `telegraf` 4.16.3
  - Auth: Token stored in KSM (Key Secrets Manager) under `telegram-bot-token` key
  - Implementation: `packages/nest-core/src/module/telegram/telegram-bot.service.ts`
  - Commands: `/new`, `/done`, `/approve`, `/rewrite`, `/stop`, `/retry`, `/config`, `/status`, `/health`, `/project`, `/help`
  - Allowed chat IDs: `TELEGRAM_ALLOWED_CHAT_IDS` (comma-separated, required)
  - Features: Throttling (10 requests/60s per chat), conversation state tracking

**Custom Integrations:**
- Obsidian Vault - Knowledge base and documentation
  - Implementation: `packages/nest-core/src/module/obsidian/obsidian-sync.service.ts`
  - Functionality: Project synchronization, MOC generation, metrics dashboard
  - File paths: `volumes/obsidian` (vault root), `volumes/workspaces` (project workspaces)
  - Triggers: Phase completion, plan completion, milestone events
- GSD SDK (Get Stuff Done) - Custom pipeline engine
  - Implementation: `@bridge-ai/gsd-sdk` package
  - Transports: CLI, WebSocket, PostgreSQL event callbacks, Obsidian
  - Used by: Phase execution, plan orchestration, provider abstraction

## Data Storage

**Databases:**
- PostgreSQL 18 (primary)
  - Connection: `DATABASE_URL` environment variable
  - Default dev: `postgresql://bridge:bridge@localhost:5432/bridge`
  - ORM: TypeORM 0.3.20
  - Client: `pg` 8.11.5
  - Data source config: `packages/nest-core/src/persistence/data-source.ts`
  - Entities:
    - `Project` - Project metadata (name, slug, stack, settings)
    - `Plan` - Execution plans with status and timeline
    - `Phase` - Plan phases with execution details
    - `ExecutionMetric` - Performance and cost metrics
    - `AppEvent` - Event audit log
    - `Secret` - Encrypted secret storage
    - `SecretAudit` - Secret access audit trail
  - Migrations: Located in `packages/nest-core/src/persistence/migrations/`
  - Migration management: CLI commands via `package.json` scripts (`migration:generate`, `migration:run`, `migration:revert`)

**File Storage:**
- Local filesystem (primary)
  - Project workspaces: `volumes/workspaces/<projectId>/`
  - Obsidian vault: `volumes/obsidian/`
  - Used by: Obsidian sync, project workspace management
  - Mounted in Docker: Read-write bind mounts

**Caching:**
- Redis 7 (via BullMQ)
  - Connection: `REDIS_URL` environment variable
  - Default dev: `redis://localhost:6379`
  - Message broker: BullMQ 5.4.2 (job queue)
  - Queues:
    - `project.events` - Project lifecycle events
    - `execution.jobs` - Phase execution jobs
    - `workflow.events` - Workflow state events
  - Processed by: EventsModule workers (project-events.worker.ts, workflow-events.worker.ts)

## Authentication & Identity

**Auth Provider:**
- Custom (none)
  - Implementation: Telegram chat ID whitelisting (allowlist in env var)
  - Secret storage: KSM (Key Secrets Manager)
  - Telegram bot token retrieval: KSM lookup under `telegram-bot-token`

**Secrets Management:**
- KSM (Key Secrets Manager) - Custom encryption service
  - Implementation: `packages/nest-core/src/module/ksm/ksm.service.ts`
  - Master key: `BRIDGE_MASTER_KEY` (base64-encoded 32-byte key)
  - Encryption: AES-256-GCM with random IV (12 bytes) and auth tag (16 bytes)
  - Storage: PostgreSQL `Secret` and `SecretAudit` tables
  - Scopes:
    - `global` - System-wide secrets (Telegram token, etc.)
    - `project` - Project-specific secrets and provider configs
  - Audit: All access logged to `SecretAudit` table

## Monitoring & Observability

**Error Tracking:**
- None detected - Errors logged via NestJS Logger

**Logs:**
- NestJS Logger (default)
  - Log levels: debug, log, warn, error
  - Database logging: Enabled in development, disabled in production (controlled by `NODE_ENV`)
  - Per-module loggers: Each service instantiates `Logger` with service name
  - Structured logging: Via @nestjs/common Logger methods

**Health Checks:**
- Health module: `packages/nest-core/src/module/health/health.module.ts`
- Endpoint: GET `/api/health` (via @nestjs/terminus)
- Brain health check: AI provider availability test (generate "ok" prompt)

## CI/CD & Deployment

**Hosting:**
- Docker Compose (local development)
  - Services: postgres, redis, api
  - Network: bridge network (internal)
  - Volumes: postgres_data, redis_data, workspaces, obsidian
- Docker containers (production-ready)
  - API image: Built from `apps/api/Dockerfile`
  - Runner image: `bridge-ai-runner:latest` (custom, pulled/built separately)
  - Network: `bridge-ai-projects` (isolated, internal)

**CI Pipeline:**
- GitHub Actions (configured)
  - Config: `.github/workflows/ci.yml`
  - Triggers: Push, pull requests
  - Jobs: Build, test, lint (via Nx commands)

**Build Commands:**
```bash
npm/bun run build:all          # Build all packages (Nx)
npm/bun run test:all           # Test all packages
npm/bun run test:gsd-sdk       # SDK tests with coverage
npm/bun run test:bridge-sdk    # Bridge SDK tests
npm/bun run test:nest-core     # NestJS core tests with coverage
npm/bun run lint:all           # Lint all packages
npm/bun run api:serve          # Run API in dev mode
npm/bun run api:build          # Build API
npm/bun run migration:generate # Generate migrations from entities
npm/bun run migration:run      # Apply pending migrations
npm/bun run migration:revert   # Revert last migration
```

## Environment Configuration

**Required env vars:**
- `BRIDGE_MASTER_KEY` - Master encryption key (base64-encoded 32 bytes)
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `TELEGRAM_ALLOWED_CHAT_IDS` - Comma-separated chat IDs for bot access
- `OPENROUTER_API_KEY` - For OpenRouter AI provider (fallback chain)
- `GEMINI_API_KEY` - For Google Gemini provider (fallback chain)
- `OPENAI_API_KEY` - For OpenAI provider (fallback chain)
- `ANTHROPIC_API_KEY` - For Claude CLI provider (fallback chain)

**Optional env vars:**
- `NODE_ENV` - Environment (development/production, default: development)
- `PORT` - API port (default: 3000)

**Secrets location:**
- `.env` file (local development)
- Environment variables injected at container runtime (production)
- Secret contents NOT committed to git (`.env` in `.gitignore`)

## Webhooks & Callbacks

**Incoming:**
- Telegram webhooks via Telegraf SDK - Bot long polling
  - Endpoint: Not exposed as HTTP (uses Telegraf polling)
  - Commands: `/new`, `/done`, `/approve`, etc.
  - Command handler: `packages/nest-core/src/module/telegram/telegram-bot.service.ts`

**Outgoing:**
- Telegram notifications via `TelegramNotifierService`
  - Implementation: `packages/nest-core/src/module/telegram/telegram-notifier.service.ts`
  - Triggers: Plan status changes, phase completions, errors
  - Destination: Original chat/user that initiated the operation

**Internal Event Channels:**
- `project.events` queue - Project lifecycle
- `execution.jobs` queue - Phase execution
- `workflow.events` queue - Workflow state (cost updates, gate responses)
- Workers: `project-events.worker.ts`, `workflow-events.worker.ts`

## Docker Integration

**Docker API Client:**
- SDK: `dockerode` 4.0.10
- Implementation: `packages/nest-core/src/module/docker/docker.service.ts`
- Functionality:
  - Container lifecycle: create, start, exec, stop, remove
  - Network management: create isolated bridge network `bridge-ai-projects`
  - Image: `bridge-ai-runner:latest` (custom sandbox runtime)
  - Execution: Isolated, read-only filesystem with tmpfs (256MB)
  - Security: CapDrop ALL, no-new-privileges, user 1000 (UID isolation)

## Provider Configuration

**Project-specific provider override:**
- Storage: KSM under key `provider:config:{projectId}`
- Value: JSON-serialized ProviderConfig
- Scopes: `project` scope with projectId
- Implementation: `packages/nest-core/src/module/brain/brain.service.ts`
- Supported types: openrouter, gemini, openai, claude-cli, gemini-cli, custom-cli

---

*Integration audit: 2026-04-01*
