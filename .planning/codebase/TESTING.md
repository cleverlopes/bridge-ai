# Testing Patterns

**Analysis Date:** 2026-04-01

## Test Framework

**Runner:**
- **Jest** (v30.3.0) for `packages/nest-core` - NestJS testing standard
  - Config: `packages/nest-core/jest.config.js`
  - Preset: `ts-jest`
  - Environment: `node`
  - Test file pattern: `**/*.spec.ts`
  - Transform: TypeScript via `ts-jest` with `tsconfig.spec.json`

- **Vitest** (v4.1.2) for `packages/gsd-sdk` and `packages/bridge-sdk` - lightweight alternative for SDK packages
  - Config: `packages/gsd-sdk/vitest.config.ts` and `packages/bridge-sdk/vitest.config.ts`
  - Environment: `node`
  - Test file pattern: `src/**/*.spec.ts`
  - Global test functions enabled

**Assertion Library:**
- Jest: Built-in `expect()` API
- Vitest: Built-in `expect()` API (compatible with Jest)

**Run Commands:**
```bash
# All tests
bun run test:all

# Specific packages
bun run test:gsd-sdk     # gsd-sdk with coverage
bun run test:bridge-sdk  # bridge-sdk with coverage
bun run test:nest-core   # nest-core with coverage (test:cov)

# Watch mode (per-package)
cd packages/nest-core && bun test --watch

# Coverage
cd packages/gsd-sdk && bun run test --coverage
```

## Test File Organization

**Location:**
- Co-located with source files in same directory
- Pattern: `[name].spec.ts` next to `[name].ts` or `[name].service.ts`

**Examples:**
- `packages/nest-core/src/module/ksm/ksm.service.spec.ts` next to `ksm.service.ts`
- `packages/nest-core/src/module/health/health.controller.spec.ts` next to `health.controller.ts`
- `packages/gsd-sdk/src/event-stream.spec.ts` next to `event-stream.ts`
- `packages/bridge-sdk/src/pipeline.spec.ts` next to `pipeline.ts`

**Naming:**
- Service tests: `[service-name].service.spec.ts`
- Controller tests: `[controller-name].controller.spec.ts`
- Class tests: `[class-name].spec.ts`

**Structure:**
```
packages/nest-core/src/
├── module/
│   ├── health/
│   │   ├── health.controller.ts
│   │   └── health.controller.spec.ts
│   ├── ksm/
│   │   ├── ksm.service.ts
│   │   └── ksm.service.spec.ts
│   └── ...
└── __mocks__/
    ├── gsd-sdk.ts
    └── bridge-sdk.ts
```

## Test Structure

**Suite Organization (Jest/NestJS pattern):**
```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { HealthCheckService, TypeOrmHealthIndicator } from '@nestjs/terminus';
import type { HealthIndicatorResult } from '@nestjs/terminus';
import { getQueueToken } from '@nestjs/bull';
import { QUEUE_PROJECT_EVENTS } from '../events/events.service';

const makeHealthCheckService = () => ({
  check: jest.fn(),
});

const makeTypeOrmHealthIndicator = () => ({
  pingCheck: jest.fn<Promise<HealthIndicatorResult>, [string]>(),
});

describe('HealthController', () => {
  let controller: HealthController;
  let healthCheckService: ReturnType<typeof makeHealthCheckService>;
  let typeOrmIndicator: ReturnType<typeof makeTypeOrmHealthIndicator>;

  beforeEach(async () => {
    healthCheckService = makeHealthCheckService();
    typeOrmIndicator = makeTypeOrmHealthIndicator();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: HealthCheckService, useValue: healthCheckService },
        { provide: TypeOrmHealthIndicator, useValue: typeOrmIndicator },
        { provide: getQueueToken(QUEUE_PROJECT_EVENTS), useValue: makeQueue() },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  describe('check()', () => {
    it('returns {status:ok,db:connected,redis:connected} when all checks pass', async () => {
      healthCheckService.check.mockResolvedValue({ status: 'ok', info: {}, error: {}, details: {} });
      const result = await controller.check();
      expect(result).toEqual({ status: 'ok', db: 'connected', redis: 'connected' });
    });
  });
});
```

**Suite Organization (Vitest pattern):**
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const makeEvent = (overrides: Partial<GSDEvent> = {}): GSDEvent =>
  ({
    type: GSDEventType.SessionComplete,
    timestamp: new Date().toISOString(),
    sessionId: 'test-session',
    success: true,
    ...overrides,
  }) as GSDEvent;

describe('GSDEventStream', () => {
  let stream: GSDEventStream;

  beforeEach(() => {
    stream = new GSDEventStream();
  });

  describe('emitEvent()', () => {
    it('emits "event" on the EventEmitter', () => {
      const listener = vi.fn();
      stream.on('event', listener);

      const event = makeEvent();
      stream.emitEvent(event);

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(event);
    });
  });
});
```

**Patterns:**
- `beforeEach()` to reset mocks and set up test context before each test
- `afterEach()` to clean up environment variables and restore original state (see: `ksm.service.spec.ts`)
- Nested `describe()` blocks to group related tests by method/feature
- Factory functions (`make*`) to create mock objects consistently

## Mocking

**Framework:**
- Jest: `jest.fn()`, `jest.mock()`, `jest.Mocked<T>`
- Vitest: `vi.fn()`, `vi.mock()`, `vi.hoisted()`

**Manual Jest Mocks (nest-core):**
- Located in `__mocks__` directory at package root
- `packages/nest-core/src/__mocks__/gsd-sdk.ts` - Mocks `@bridge-ai/gsd-sdk` with Jest functions
- `packages/nest-core/src/__mocks__/bridge-sdk.ts` - Mocks `@bridge-ai/bridge-sdk` providers
- Configured in `jest.config.js` under `moduleNameMapper`:
  ```javascript
  moduleNameMapper: {
    '^@bridge-ai/gsd-sdk$': '<rootDir>/__mocks__/gsd-sdk.ts',
    '^@bridge-ai/bridge-sdk$': '<rootDir>/__mocks__/bridge-sdk.ts',
  }
  ```

**Vitest Mocks (gsd-sdk, bridge-sdk):**
- Use `vi.mock()` at test file top level
- Use `vi.hoisted()` to define variables for mock factories
- Example from `pipeline.spec.ts`:
  ```typescript
  const { mockGSDInstances, mockRun, mockAddTransport } = vi.hoisted(() => {
    const mockRun = vi.fn().mockResolvedValue({
      success: true,
      totalCostUsd: 0.01,
      durationMs: 5000,
      phasesCompleted: 2,
    });
    const mockAddTransport = vi.fn();
    const mockGSDInstances: Array<{ opts: Record<string, unknown> }> = [];
    return { mockGSDInstances, mockRun, mockAddTransport };
  });

  vi.mock('@bridge-ai/gsd-sdk', () => {
    class GSD {
      run = mockRun;
      addTransport = mockAddTransport;
      constructor(public readonly opts: Record<string, unknown>) {
        mockGSDInstances.push(this as GSD);
      }
    }
    return { GSD, ObsidianTransport };
  });
  ```

**Factory Functions Pattern:**
- All test mocks created via `make[ObjectName]()` factories
- Returns typed mock with all necessary methods
- Allows controlled overrides per test

**Example from `health.controller.spec.ts`:**
```typescript
const makeHealthCheckService = () => ({
  check: jest.fn(),
});

const makeTypeOrmHealthIndicator = () => ({
  pingCheck: jest.fn<Promise<HealthIndicatorResult>, [string]>(),
});

const makeQueue = (hasPing = true) => ({
  client: hasPing
    ? { ping: jest.fn<Promise<string>, []>().mockResolvedValue('PONG') }
    : undefined,
});
```

**What to Mock:**
- External dependencies (database repositories, services, HTTP clients)
- Environment variables (set/delete in beforeEach, restore in afterEach)
- Third-party library implementations (providers, transports)
- Event emitters and callbacks

**What NOT to Mock:**
- Internal domain logic classes (instantiate real instances)
- Encryption/decryption functions (test real behavior)
- Type definitions and interfaces
- Test fixture/factory functions

## Fixtures and Factories

**Test Data:**
```typescript
// From event-stream.spec.ts
const makeEvent = (overrides: Partial<GSDEvent> = {}): GSDEvent =>
  ({
    type: GSDEventType.SessionComplete,
    timestamp: new Date().toISOString(),
    sessionId: 'test-session',
    success: true,
    totalCostUsd: 0.001,
    durationMs: 1000,
    numTurns: 2,
    result: 'done',
    ...overrides,
  }) as GSDEvent;

// From ksm.service.spec.ts
const TEST_MASTER_KEY = 'dGVzdC1rZXktdGhpcy1pcy0zMi1ieXRlcy1sb25n';
```

**Location:**
- Inline in spec files at top level
- Named with `make[ObjectName]` pattern
- Placed before test suites (before `describe()` block)

**Environment Setup Pattern (from `ksm.service.spec.ts`):**
```typescript
beforeEach(() => {
  process.env['BRIDGE_MASTER_KEY'] = TEST_MASTER_KEY;
  secretRepo = makeSecretRepo();
  auditRepo = makeAuditRepo();
  service = new KsmService(secretRepo, auditRepo);
  service.onModuleInit();
});

afterEach(() => {
  if (originalKey !== undefined) {
    process.env['BRIDGE_MASTER_KEY'] = originalKey;
  } else {
    delete process.env['BRIDGE_MASTER_KEY'];
  }
});
```

## Coverage

**Requirements:**
- Global thresholds set to 80% for statements, branches, functions, and lines
- Enforced in both Jest and Vitest configs

**Jest Coverage Config (`jest.config.js`):**
```javascript
coverageThreshold: {
  global: {
    statements: 80,
    branches: 80,
    functions: 80,
    lines: 80,
  },
},
collectCoverageFrom: [
  'module/ksm/**/*.ts',
  'module/plan/**/*.ts',
  'module/brain/**/*.ts',
  'module/metrics/**/*.ts',
  'module/obsidian/**/*.ts',
  'module/health/**/*.ts',
  'module/project/project.service.ts',
  '!**/*.module.ts',
  '!**/index.ts',
  '!**/*.entity.ts',
],
```

**Vitest Coverage Config (gsd-sdk/vitest.config.ts):**
```typescript
coverage: {
  provider: 'v8',
  reporter: ['text', 'lcov'],
  thresholds: {
    statements: 80,
    branches: 80,
    functions: 80,
    lines: 80,
  },
},
```

**View Coverage:**
```bash
# Jest
cd packages/nest-core && bun test:cov

# Vitest
cd packages/gsd-sdk && bun run test --coverage
cd packages/bridge-sdk && bun run test --coverage
```

## Test Types

**Unit Tests:**
- Scope: Individual service methods, controller endpoints, utility functions
- Approach: Arrange-Act-Assert pattern with mocked dependencies
- Example: `ksm.service.spec.ts` tests encryption/decryption logic with mocked repositories
- Focus: Single method behavior, error cases, edge cases

**Integration Tests:**
- Scope: Service-to-service interaction, NestJS module composition
- Approach: Use `Test.createTestingModule()` to compose providers and inject real instances
- Example: `health.controller.spec.ts` tests controller with health check and queue dependencies
- Focus: Dependency injection, module initialization, event publishing

**E2E Tests:**
- Framework: Not currently used
- Status: No E2E test infrastructure detected in codebase
- Note: Testing philosophy focuses on unit + integration via mocked boundaries

## Common Patterns

**Async Testing:**
```typescript
// Jest/Vitest - using async/await
it('returns result after encrypt→decrypt cycle', async () => {
  const plaintext = 'my-api-key-12345';

  await service.createSecret('my-key', plaintext, 'global' as SecretScope);
  const result = await service.getSecret('my-key', 'global' as SecretScope);

  expect(result).toBe(plaintext);
});

// Jest/Vitest - returning Promise
it('throws NotFoundException when secret does not exist', async () => {
  secretRepo.findOne.mockResolvedValue(null);

  await expect(
    service.getSecret('nonexistent', 'global' as SecretScope),
  ).rejects.toThrow(NotFoundException);
});
```

**Error Testing:**
```typescript
// Test thrown exceptions
it('throws if BRIDGE_MASTER_KEY is not set', () => {
  delete process.env['BRIDGE_MASTER_KEY'];
  const svc = new KsmService(secretRepo, auditRepo);
  expect(() => svc.onModuleInit()).toThrow('BRIDGE_MASTER_KEY environment variable is required');
});

// Test graceful error handling (no throw)
it('errors in callback do not throw', () => {
  const onEvent = vi.fn(() => {
    throw new Error('callback error');
  });
  const transport = new PostgresTransport({ onEvent });

  expect(() => transport.onEvent(makeEvent())).not.toThrow();
});

// Test promise rejection handling
it('falls back when KSM config fails', async () => {
  ksm.getSecret.mockRejectedValue(new Error('no config'));
  process.env['OPENROUTER_API_KEY'] = 'fallback-key';

  const result = await service.generate('test', { projectId: 'proj-unknown' });
  expect(result.success).toBe(true);
});
```

**Mock Clearing Pattern:**
```typescript
// Clear mocks between tests
beforeEach(() => {
  jest.clearAllMocks();
  ksm = makeKsmService();
  events = makeEventsService();
});

// Vitest equivalent
beforeEach(() => {
  vi.clearAllMocks();
});

// Selective mock reset within test
it('writes audit record on successful read', async () => {
  // ... setup and call service ...

  auditRepo.save.mockClear();  // Reset call count for next assertion

  // ... more calls ...
  expect(auditRepo.save).toHaveBeenCalledTimes(1);
});
```

**Mock Implementation Pattern (capture arguments):**
```typescript
// Capture encrypted value for validation
let storedEncrypted = '';
secretRepo.create.mockImplementation((data) => {
  storedEncrypted = (data as Partial<Secret>).encryptedValue ?? '';
  return { ...data } as Secret;
});
secretRepo.save.mockImplementation(async (entity) => entity as Secret);

// Use captured value in next operation
secretRepo.findOne.mockResolvedValue({
  id: 'secret-1',
  encryptedValue: storedEncrypted,
} as Secret);

const result = await service.getSecret('my-key', 'global' as SecretScope);
expect(result).toBe(plaintext);  // Verify round-trip
```

---

*Testing analysis: 2026-04-01*
