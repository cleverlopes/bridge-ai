# Technology Stack

**Analysis Date:** 2026-04-01

## Languages

**Primary:**
- TypeScript 5.4.5 - Core language across all packages and apps

**Secondary:**
- JavaScript (Node.js runtime)
- Bash (scripts and entrypoints)

## Runtime

**Environment:**
- Node.js (via Bun) - Specified in `bun.lock`
- Bun 1.x - Package manager and runtime (present: `bun.lock` in project root)

**Package Manager:**
- Bun - Primary package manager
- Workspaces: `apps/*` and `packages/*` (monorepo structure via `package.json`)
- Lockfile: `bun.lock` (present)

## Frameworks

**Core:**
- NestJS 10.3.0 - Main backend framework
  - `@nestjs/common` 10.3.0 - Common decorators and utilities
  - `@nestjs/core` 10.3.0 - Core NestJS functionality
  - `@nestjs/platform-fastify` 10.3.0 - Fastify adapter (HTTP server)
  - `@nestjs/config` 3.2.0 - Configuration management
  - `@nestjs/typeorm` 10.0.2 - Database ORM integration

**Job Queue:**
- Bull 5.4.2 - Job queue library
- `@nestjs/bull` 10.2.1 - NestJS Bull integration
- Redis transport via BullMQ

**Health & Monitoring:**
- `@nestjs/terminus` 10.2.3 - Health check endpoints
- `@nestjs/schedule` 6.1.1 - Scheduled tasks
- `@nestjs/throttler` 6.5.0 - Rate limiting

**Testing:**
- Jest 30.3.0 - Main test runner (nest-core)
  - `@jest/globals` 30.3.0 - Jest globals
  - `ts-jest` 29.4.6 - TypeScript support for Jest
- Vitest 4.1.2 - Alternative test runner (gsd-sdk, bridge-sdk)
  - `@vitest/coverage-v8` 4.1.2 - Coverage reporting

**Build/Dev:**
- Nx 22.3.2 - Monorepo orchestration
  - `@nx/js` 22.3.2 - JavaScript/TypeScript plugin
  - `@nx/node` 22.3.2 - Node.js plugin
  - `@nx/webpack` 22.6.3 - Webpack integration
- TypeScript 5.4.5 - Compilation and type checking
- Webpack 5.105.4 - Module bundling (via Nx)

## Key Dependencies

**Critical:**
- `pg` 8.11.5 - PostgreSQL client (peer dependency of nest-core)
- `typeorm` 0.3.20 - ORM for database abstraction (entities, migrations)
- `bullmq` 5.4.2 - Advanced job queue management (Redis-backed)
- `telegraf` 4.16.3 - Telegram bot API client (command interface)
- `dockerode` 4.0.10 - Docker API client (container management)
  - `@types/dockerode` 3.3.29 - Type definitions
- `reflect-metadata` 0.2.2 - Required by NestJS decorators
- `rxjs` 7.8.1 - Reactive programming library (NestJS foundation)
- `ws` 8.18.0 - WebSocket library (streaming support)

**Infrastructure:**
- `@bridge-ai/gsd-sdk` - Custom GSD (Get Stuff Done) pipeline engine
- `@bridge-ai/bridge-sdk` - Bridge AI provider adapters and utilities
- `@bridge-ai/nest-core` - Shared NestJS core module

## Configuration

**Environment:**
- Configuration via `ConfigModule.forRoot()` (NestJS)
- Environment file: `.env` (loaded automatically)
- Development defaults in `/workspace/.env.example`:
  - `BRIDGE_MASTER_KEY` - Base64-encoded 32-byte master key (required)
  - `DATABASE_URL` - PostgreSQL connection string (production)
  - `REDIS_URL` - Redis connection string (production)
  - `TELEGRAM_ALLOWED_CHAT_IDS` - Comma-separated Telegram chat IDs (required if using Telegram bot)

**Build:**
- `tsconfig.base.json` - Root TypeScript configuration
  - Target: ES2022
  - Module resolution: bundler
  - Strict mode enabled
  - Path aliases: `@bridge-ai/nest-core`
- `packages/nest-core/tsconfig.lib.json` - Library-specific TypeScript configuration
- Package-specific configs:
  - `packages/nest-core/jest.config.js` - Jest configuration
  - `packages/gsd-sdk/vitest.config.ts` - Vitest configuration
  - `packages/bridge-sdk/vitest.config.ts` - Vitest configuration

## Platform Requirements

**Development:**
- Node.js (via Bun) 1.x+
- Docker (for sandbox execution via Dockerode)
- PostgreSQL 18+ (local development: `postgres:18-alpine`)
- Redis 7+ (local development: `redis:7-alpine`)

**Production:**
- Node.js (via Bun) 1.x+
- Docker daemon (for container management)
- PostgreSQL 18+ (external service)
- Redis 7+ (external service)
- Docker image for runner: `bridge-ai-runner:latest` (custom, requires Dockerfile)

**Deployment Target:**
- Docker containers (primary)
- Environment: Docker Compose for local dev, Kubernetes or Docker host for production
- Entry point: `apps/api/main.ts` → NestFactory bootstrap → port 3000 (default)

---

*Stack analysis: 2026-04-01*
