# Coding Conventions

**Analysis Date:** 2026-04-01

## Naming Patterns

**Files:**
- Service files: `[name].service.ts` (e.g., `ksm.service.ts`, `plan.service.ts`, `brain.service.ts`)
- Controller files: `[name].controller.ts` (e.g., `health.controller.ts`)
- Module files: `[name].module.ts` (e.g., `pipeline.module.ts`, `events.module.ts`)
- Entity files: `[name].entity.ts` (e.g., `secret.entity.ts`, `plan.entity.ts`)
- Mock files: Placed in `__mocks__/` directory (e.g., `__mocks__/gsd-sdk.ts`)
- Test files: `[name].spec.ts` (e.g., `ksm.service.spec.ts`, `health.controller.spec.ts`)

**Functions:**
- camelCase for all function names
- Service methods use descriptive verb-noun pattern (e.g., `createSecret`, `getSecret`, `rotateSecret`, `submitForApproval`, `approvePlan`)
- Private helper methods prefixed with underscore convention (not used in this codebase, but camelCase throughout)
- Constructor and lifecycle methods use NestJS conventions (`constructor`, `onModuleInit`)

**Variables:**
- camelCase for all local variables and parameters
- Const declarations for constants (e.g., `ALGORITHM`, `IV_BYTES`, `TERMINAL_STATES`, `ARCHIVE_AFTER_DAYS`)
- Constants in UPPER_SNAKE_CASE when they are module-level (e.g., `QUEUE_PROJECT_EVENTS`, `QUEUE_EXECUTION_JOBS`)
- Type/interface variables use PascalCase (e.g., `HealthResponse`, `EncryptedBlob`)
- Mock factory functions use `make[ObjectName]` pattern (e.g., `makeSecretRepo()`, `makeHealthCheckService()`, `makeEvent()`, `makeProvider()`)

**Types:**
- Interface names: PascalCase, prefixed with context (e.g., `HealthResponse`, `EncryptedBlob`, `SDKMessageBase`)
- Entity type names: PascalCase (e.g., `Secret`, `Plan`, `Project`)
- Type unions for status fields: lowercase (e.g., `'ok' | 'error'`, `'connected' | 'error'`, `PhaseStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped'`)
- Enum-like constant objects with PascalCase keys (e.g., `GSDEventType = { SessionComplete: 'session_complete', ... }`)

## Code Style

**Formatting:**
- TypeScript strict mode enabled in `tsconfig.base.json`
- Module resolution: `bundler`
- Target: ES2022
- Module output: ESNext
- Source maps enabled
- No explicit formatter config found (relies on IDE/editor defaults)

**Linting:**
- ESLint configuration present in node_modules, CI runs linting via `bunx nx run-many --target=lint --all`
- No project-level `.eslintrc` found in workspace root
- Strict TypeScript checking enforced: `strict: true`, `noImplicitAny: true`, `strictNullChecks: true`, `noImplicitReturns: true`, `noFallthroughCasesInSwitch: true`

## Import Organization

**Order:**
1. External dependencies from node (e.g., `import { EventEmitter } from 'node:events'`)
2. NestJS framework imports (e.g., `import { Injectable, Logger } from '@nestjs/common'`)
3. NestJS decorators and specialized imports (e.g., `import { InjectRepository } from '@nestjs/typeorm'`)
4. Third-party libraries (e.g., `import { DataSource, Repository } from 'typeorm'`)
5. Native crypto/utilities (e.g., `import { createCipheriv } from 'crypto'`)
6. Relative imports from entities/services (e.g., `import { Secret } from '../../persistence/entity/secret.entity'`)

**Path Aliases:**
- `@bridge-ai/nest-core` maps to `packages/nest-core/src/index.ts`
- No other aliases defined beyond this main entry point

**Example from `ksm.service.ts`:**
```typescript
import {
  Injectable,
  OnModuleInit,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';
import { Secret, SecretScope } from '../../persistence/entity/secret.entity';
import { SecretAudit } from '../../persistence/entity/secret-audit.entity';
```

## Error Handling

**Patterns:**
- NestJS exceptions used (e.g., `NotFoundException`, `BadRequestException`, `UnauthorizedException`)
- Thrown errors include descriptive messages (e.g., `throw new Error('BRIDGE_MASTER_KEY environment variable is required')`)
- Environment validation happens in `onModuleInit()` lifecycle hooks
- Try-catch blocks wrap critical operations (e.g., health checks, database queries)
- Error states returned as object properties in simple cases (e.g., `{ status: 'ok' | 'error', db: 'connected' | 'error', redis: 'connected' | 'error' }`)
- Async operations handle rejections with `.mockRejectedValue()` in tests

**Example from `health.controller.ts`:**
```typescript
try {
  await this.health.check([() => this.db.pingCheck('db')]);
  dbStatus = 'connected';
} catch {
  dbStatus = 'error';
}
```

## Logging

**Framework:** Built-in NestJS Logger

**Patterns:**
- Logger instance created with service/class name: `private readonly logger = new Logger(ClassName.name)`
- Log levels used: `log()`, `warn()`, `error()` (typical NestJS usage)
- Messages include context (e.g., `'Plan ${saved.id} created (draft)'`, `'KSM initialized'`)
- Sensitive data never logged (e.g., API keys, master keys)
- Lifecycle events logged (e.g., on module initialization, plan creation, secret operations)

**Example from `plan.service.ts`:**
```typescript
private readonly logger = new Logger(PlanService.name);
this.logger.log(`Plan ${saved.id} created (draft)`);
this.logger.warn(`Recovered ${recovered.length} interrupted plan(s) on startup`);
```

## Comments

**When to Comment:**
- JSDoc comments for public APIs and complex methods
- Inline comments for non-obvious logic (e.g., cryptographic operations, fallback chains)
- Section dividers for major code blocks (e.g., `// ─── Frontmatter types ───────────────────`)
- Comments explaining "why" rather than "what" the code does

**JSDoc/TSDoc:**
- Used on public functions and types in SDK packages
- Includes parameter descriptions and return types
- Documents integration points and side effects

**Example from `pipeline.ts`:**
```typescript
/**
 * Execute the full GSD lifecycle (discuss → research → plan → execute → verify)
 * for all incomplete phases in the workspace.
 */
async execute(prompt: string): Promise<MilestoneRunnerResult> {
  return this.gsd.run(prompt);
}
```

## Function Design

**Size:** Functions generally 10-50 lines; longer methods decomposed with helper functions

**Parameters:**
- Single object parameters for complex option objects (e.g., `PipelineConstructorOptions`, `HealthCheckService`)
- Type annotations required in strict mode
- Optional parameters documented in JSDoc

**Return Values:**
- Async functions return Promises with typed results
- Simple success/error states returned as discriminated unions or objects with status properties
- Null returns used sparingly (more common to throw or return empty objects/arrays)

**Example from `plan.service.ts`:**
```typescript
async createPlan(projectId: string, prompt: string, conversationId: string): Promise<Plan> {
  const plan = this.planRepo.create({
    projectId,
    prompt,
    conversationId,
    status: 'draft',
  });
  const saved = await this.planRepo.save(plan);
  return saved;
}
```

## Module Design

**Exports:**
- NestJS services exported as `@Injectable()` decorated classes
- Domain classes (entities, types) exported as interfaces or classes
- Barrel files use index.ts for public API export (e.g., `packages/nest-core/src/index.ts`)
- Mock files export class definitions and factory functions

**Barrel Files:**
- `packages/nest-core/src/index.ts` exports the NestJS module
- `packages/gsd-sdk/src/index.ts` exports SDK classes and types
- No additional barrel files beyond entry points

**Example from `health.module.ts` imports:**
```typescript
import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import {
  HealthCheckService,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
```

---

*Convention analysis: 2026-04-01*
