# Codebase Concerns

**Analysis Date:** 2026-04-01

## Tech Debt

### CLI Providers Return Zero Cost/Token Tracking

**Issue:** CLI provider implementations (ClaudeCliProvider, GeminiCliProvider, CustomCliProvider) hardcode `totalCostUsd=0`, `inputTokens=0`, `outputTokens=0` in all responses — no actual cost or token tracking.

**Files:**
- `packages/bridge-sdk/src/providers/claude-cli.provider.ts` (lines 54, 72)
- `packages/bridge-sdk/src/providers/custom-cli.provider.ts` (lines 55, 72)
- `packages/bridge-sdk/src/providers/gemini-cli.provider.ts` (lines 59, 76)

**Impact:**
- Metrics dashboards and cost reports for CLI-based projects show $0 total cost
- `execution_metrics` table records zero cost for all CLI-driven phases
- Makes ROI and cost analysis meaningless for CLI provider usage
- Violates implicit contract: "BrainService.generate() returns costUsd, tokensIn, tokensOut for all providers"

**Fix Approach:**
This is an **acceptable design constraint** (CLI tools have no way to return metadata) but must be **documented**. Add inline comments to all CLI provider classes explaining: "CLI tools cannot return cost/token metadata. This provider always returns zero. Use OpenRouter, Gemini, or OpenAI providers for cost tracking."

**Priority:** Low (design constraint, not a bug)

---

### Health Endpoint Response Shape Diverges from Spec Contract

**Issue:** `GET /health` returns fragile accessor to BullMQ internals instead of documented contract shape.

**Files:**
- `packages/nest-core/src/module/health/health.controller.ts` (lines 38-40)

**Current Implementation:**
```typescript
const client = (this.projectEventsQueue as unknown as { client?: { ping: () => Promise<string> } }).client;
if (client?.ping) {
  await client.ping();
  redisStatus = 'connected';
}
```

**Impact:**
- Uses private BullMQ client accessor that may change in future versions
- Relies on type assertion to access internal property
- If BullMQ refactors internals, health check silently fails (client?.ping check prevents throwing, falls back to 'error')
- Contract specifies `{"status":"ok","db":"connected","redis":"connected"}` but returns Terminus format with nested objects

**Fix Approach:**
Inject Redis client directly into HealthController instead of accessing through BullMQ queue. Create a dedicated Redis health indicator rather than relying on BullMQ internals.

**Priority:** High (fragile dependency on private API)

---

## Known Bugs

### EXECUTION-LOG.md Path Fallback Before Phase Starts

**Issue:** Before first `PhaseStart` event fires, `ObsidianTransport` writes to legacy fallback path `bridge-ai-logs/phases/setup/EXECUTION-LOG.md`. Phase initialization events (SessionInit, CostUpdate, tool calls) go to wrong location.

**Files:**
- `packages/gsd-sdk/src/obsidian-transport.ts` (lines 71-84)

**Code:**
```typescript
private resolveLogFilePath(): string {
  // Preferred contract: projects/<slug>/phases/<phase>/EXECUTION-LOG.md
  if (this.projectSlug && this.currentPhaseSlug) {
    return join(this.vaultPath, 'projects', this.projectSlug, 'phases', this.currentPhaseSlug, 'EXECUTION-LOG.md');
  }
  // Pre-phase fallback: projectSlug known but PhaseStart not yet received
  if (this.projectSlug) {
    return join(this.vaultPath, 'projects', this.projectSlug, 'phases', 'setup', 'EXECUTION-LOG.md');
  }
  // Unknown project: write to a named setup stub rather than an opaque date-based path
  return join(this.vaultPath, this.logFolder, 'phases', 'setup', 'EXECUTION-LOG.md');
}
```

**Symptoms:**
- Setup/initialization events written before `PhaseStart` appear in `projects/<slug>/phases/setup/EXECUTION-LOG.md`
- Once `PhaseStart` fires, events move to `projects/<slug>/phases/<NN-name>/EXECUTION-LOG.md`
- Creates two log files per phase with fragmented event history

**Trigger:**
- Any GSD session where `PhaseStart` event is not the first event emitted
- Real-world: Cost updates, tool calls, or status updates during session initialization fire before `PhaseStart`

**Workaround:**
None. Logs are split across files.

**Fix Approach:**
Pass `phaseSlug` to `ObsidianTransport` constructor during `PipelineService.executeProject()` instead of deriving it from `PhaseStart` event. Requires pre-computing phase naming before GSD starts.

**Priority:** Medium (affects log organization, not execution)

---

### Workflow Events Never Marked Processed

**Issue:** GSD and workflow events published to `workflow.events` queue are only partially processed. Only `telegram.gate_response` and `plan.recovered` events call `markProcessed()`. All GSD events (`gsd.SessionInit`, `gsd.PhaseStart`, etc.) remain `status: 'pending'` indefinitely.

**Files:**
- `packages/nest-core/src/module/pipeline/workflow-events.worker.ts` (lines 29-56)
- `packages/nest-core/src/module/pipeline/pipeline.service.ts` (lines 68-79)

**Code Paths:**
```typescript
// WorkflowEventsWorker.handle()
if (type === 'telegram.gate_response') {
  this.handleGateResponse(job);
} else if (type === 'plan.recovered') {
  await this.handlePlanRecovered(job);
}
// If neither condition matches: job is marked processed at line 42
// But GSD events (gsd.*, gsd.SessionInit, etc.) don't match any condition
// So they're skipped and marked processed only by the catch-all at line 42
```

**Impact:**
- `events` table accumulates `status: 'pending'` records for all GSD events
- No audit trail of when GSD events were consumed
- Events queue grows indefinitely without proper cleanup
- Breaks event lifecycle tracking

**Expected Behavior:**
All events should eventually reach `status: 'processed'` or `status: 'failed'`.

**Fix Approach:**
Add a catch-all handler in `WorkflowEventsWorker` that logs and marks processed for unhandled event types:
```typescript
// After specific handlers, add:
this.logger.debug(`Unhandled workflow event type: ${type}`);
// markProcessed already called at line 42, so this is OK
```
OR create a separate `GsdEventsWorker` processor for `gsd.*` events if they need specific handling.

**Priority:** Low (acceptable if events are treated as audit log, not processing queue)

---

## Security Considerations

### Telegram Throttling — Implemented (In-Memory, Not Redis-Backed)

**Status:** ✅ Implemented — Phase 8 requirement is met.

**Files:**
- `packages/nest-core/src/module/telegram/telegram-throttler.guard.ts`
- `packages/nest-core/src/module/telegram/telegram-bot.service.ts` (line 73)

**Implementation:** `TelegramThrottlerGuard.check()` uses an in-memory `Map<chatId, ThrottleEntry>` with 60s sliding window, 10 requests max per chat. Applied to all commands via `bot.use()` middleware.

**Minor concern:** In-memory state is lost on process restart (window resets). For multi-instance deployments, use Redis-backed throttling instead of Map. For single-instance MVP, this is acceptable.

**Priority:** Low (works correctly for MVP; Redis-backed throttling is a future hardening item)

---

### Hardcoded Container Image Without Version Pinning

**Issue:** Docker container image specified as `bridge-ai-runner:latest` with no version pinning or image digest verification.

**Files:**
- `packages/nest-core/src/module/docker/docker.service.ts` (line 7)

**Code:**
```typescript
const CONTAINER_IMAGE = 'bridge-ai-runner:latest';
```

**Risk:**
- Unpinned `latest` tag means each container creation pulls the newest image
- If image is compromised or contains vulnerabilities, all new containers are affected immediately
- No ability to roll back to known-good image version
- Violates container security best practice: always pin images by digest

**Impact:**
- Supply chain attack vector if image registry is compromised
- Unpredictable behavior if image is rebuilt with breaking changes
- No audit trail of which image version a plan executed under

**Fix Approach:**
1. Pin image to specific version: `bridge-ai-runner:1.2.3`
2. Better: Use image digest: `bridge-ai-runner@sha256:abc123...`
3. Add environment variable to allow override: `CONTAINER_IMAGE` env var with default to digest-pinned version
4. Document image build process and versioning strategy

**Priority:** Medium (operational risk, not an immediate exploit)

---

### Master Key Fallback to Passphrase Derivation in Production

**Issue:** KsmService falls back to deriving encryption key from plaintext passphrase if `BRIDGE_MASTER_KEY` is not base64-encoded.

**Files:**
- `packages/nest-core/src/module/ksm/ksm.service.ts` (lines 40-58)

**Code:**
```typescript
const keyRaw = process.env['BRIDGE_MASTER_KEY'];
if (!keyRaw) {
  throw new Error('BRIDGE_MASTER_KEY environment variable is required');
}

const decoded = Buffer.from(keyRaw, 'base64');
if (decoded.length === 32) {
  this.masterKey = decoded;
  this.logger.log('KSM initialized (base64 key)');
  return;
}

// Dev-friendly fallback: accept any passphrase and derive a 32-byte key.
this.masterKey = createHash('sha256').update(keyRaw, 'utf8').digest();
this.logger.warn('KSM initialized with derived key...');
```

**Risk:**
- If `BRIDGE_MASTER_KEY` is set to a short passphrase (e.g., "password123"), encryption uses SHA256(passphrase) as key
- SHA256 is fast and brute-forceable
- Operator may accidentally leave weak passphrase in production thinking it's a placeholder
- Warning log is easy to overlook in production startup

**Impact:**
- Encrypted secrets (API keys, bot tokens) vulnerable to offline dictionary attack
- All existing secrets encrypted with passphrase-derived key become compromised if key is guessed
- Private data (KSM audit trail) is readable without key

**Fix Approach:**
1. Remove fallback logic entirely — require base64-encoded 32-byte key
2. If fallback is needed for development, add explicit environment variable flag: `KSM_ALLOW_PASSPHRASE_FALLBACK=true` (disabled by default in production)
3. Add startup validation: throw if key length is <32 bytes
4. Update documentation with key generation script

**Priority:** High (security risk, encryption weakness)

---

## Performance Bottlenecks

### Large Monolithic Service Files

**Issue:** Several service files exceed 400 lines with multiple concerns in single class.

**Files with Code Smell:**
- `packages/nest-core/src/module/obsidian/obsidian-sync.service.ts` (476 lines) — handles vault structure, project sync, metrics, phase context, index generation
- `packages/nest-core/src/module/telegram/telegram-bot.service.ts` (443 lines) — handles all command handlers, conversation state, notifications, Telegram API
- `packages/gsd-sdk/src/phase-runner.ts` (1125 lines) — phase execution, tool calling, validation, error recovery

**Impact:**
- High cyclomatic complexity makes testing difficult
- Changes to one concern (e.g., vault sync) risk breaking another (e.g., metrics)
- Difficult to understand control flow across so many responsibilities
- Test coverage becomes brittle with shared state

**Example Fragility:** `ObsidianSyncService` handles both real-time sync (onPhaseComplete) and background vault generation (generateIndex) with shared file paths and state.

**Fix Approach:**
Refactor into smaller, focused classes:
- Extract vault structure management into `VaultStructureService`
- Extract metrics generation into standalone class (already partially done with `ExecutionMetricsService`)
- Extract index generation into `ObsidianIndexService`

**Priority:** Medium (affects maintainability, not correctness)

---

## Fragile Areas

### BullMQ Internal Client Accessor for Redis Health Check

**Issue:** `HealthController` reaches into BullMQ queue object to access Redis client, relying on type assertion to private property.

**Files:**
- `packages/nest-core/src/module/health/health.controller.ts` (lines 38-45)

**Why Fragile:**
- BullMQ `Queue` interface doesn't expose `client` property in public API
- Implementation detail; may change between versions
- Type assertion `as unknown as { client?: ... }` indicates incomplete contract
- If BullMQ removes or renames client, health check fails silently (catch block swallows error)

**Safe Modification:**
1. Do NOT access queue.client directly
2. Inject Redis client into HealthController constructor via NestJS provider
3. Ping Redis independently of BullMQ

**Test Coverage:**
Health check tests mock the Queue but don't verify Redis interaction.

**Priority:** High (fragile dependency on private API)

---

### Unused Parameters Indicate Incomplete Implementation

**Issue:** Several methods have unused parameters marked with `void` to suppress linter warnings.

**Files:**
- `packages/nest-core/src/module/pipeline/pipeline.service.ts` (line 193) — `forwardEventToTelegram` receives `planId` but doesn't use it
- `packages/nest-core/src/module/obsidian/obsidian-sync.service.ts` — `onPlanComplete` receives `planId` but doesn't use it

**Code:**
```typescript
private async forwardEventToTelegram(
  event: GSDEvent,
  conversationId: string,
  planId: string,
): Promise<void> {
  // ... event forwarding ...
  void planId; // Unused parameter
}
```

**Risk:**
- Indicates method signature is designed for future use but incomplete
- Calling code passes parameter that goes unused — confusing API contract
- If logic added later that uses `planId`, subtle bugs may appear

**Fix Approach:**
Remove unused parameters entirely, or add a TODO comment explaining why they're present.

**Priority:** Low (code smell, not a bug)

---

### Non-Atomic Secret Rotation

**Issue:** `KsmService.rotateSecret()` uses transaction wrapper but encryption happens outside transaction scope.

**Files:**
- `packages/nest-core/src/module/ksm/ksm.service.ts` (lines 92-114)

**Code:**
```typescript
async rotateSecret(
  name: string,
  newValue: string,
  scope: SecretScope,
  scopeId?: string,
): Promise<void> {
  const secret = await this.findSecret(name, scope, scopeId);
  const encryptedValue = this.encrypt(newValue); // <-- CPU-only, no DB I/O

  await this.dataSource.transaction(async (manager) => {
    await manager.update(Secret, secret.id, {
      encryptedValue,
      keyVersion: secret.keyVersion + 1,
    });
    // ... audit entry ...
  });
}
```

**Impact:**
- If process crashes between `this.encrypt()` (line 99) and transaction start (line 101), plaintext key stays in memory but DB doesn't update
- Race condition window is small but real
- No practical impact on production (process is unlikely to crash exactly between these lines) but violates atomicity principle

**Fix Approach:**
Move encryption into transaction scope:
```typescript
await this.dataSource.transaction(async (manager) => {
  const encryptedValue = this.encrypt(newValue); // Inside transaction
  await manager.update(Secret, ...);
  // ...
});
```
Encryption is CPU-only and won't block transaction.

**Priority:** Low (unlikely to manifest, atomicity violation in principle)

---

## Scaling Limits

### No Connection Pooling Configuration Visible

**Issue:** TypeORM DataSource in `data-source.ts` has no explicit connection pool configuration.

**Files:**
- `packages/nest-core/src/persistence/data-source.ts`

**Impact:**
- Default pool size may be too small for production under concurrent load
- Each plan execution creates multiple DB queries; concurrent plans may exhaust connections
- No visible monitoring or limits on active connections

**Fix Approach:**
Add explicit pool configuration to TypeORM DataSource:
```typescript
poolSize: 20,
maxConnectionPoolSize: 20,
minConnectionPoolSize: 5,
```
Tune based on production load testing.

**Priority:** Medium (affects production scalability)

---

## Dependencies at Risk

### TypeORM Version Lock (Potential Breaking Changes)

**Issue:** No explicit version pinning visible; package.json likely uses loose semver constraints.

**Files:**
- `package.json` (assumed — not reviewed due to format)

**Risk:**
- TypeORM 0.4.x → 0.5.x has breaking changes to migration APIs and query builders
- Future updates to `@nestjs/typeorm` may require TypeORM version bumps

**Priority:** Low (standard dependency management)

---

## Missing Critical Features

### No Discord Module (Phase 9)

**Issue:** Phase 9 (Discord bot) is entirely unimplemented.

**Missing:**
- `packages/nest-core/src/module/discord/` directory
- `DiscordModule` and `DiscordBotService`
- Command handlers for `/new` equivalent in Discord

**Impact:**
- Discord integration blocked
- Phase 9 cannot complete until this module exists

**Priority:** High (Phase blocker)

---

### No Obsidian REST Client (Phase 10)

**Issue:** Obsidian sync is write-only (NestJS → vault). No read-back capability for bidirectional sync.

**Files:**
- `packages/nest-core/src/module/obsidian/obsidian-sync.service.ts` — only writes files

**Missing:**
- Obsidian Local REST API client
- Read-back of vault notes to sync user edits back to PostgreSQL

**Impact:**
- Phase 10 (bidirectional sync) cannot start
- Obsidian vault is read-only from system perspective; user edits don't propagate back

**Priority:** High (Phase blocker)

---

### SDK Not Publishable (Phase 10)

**Issue:** `packages/bridge-sdk` exists but is not configured for external publishing as `@bridge-ai/sdk`.

**Missing:**
- Entry point configuration for external consumers
- Package.json export field or browser/types fields
- Documentation for SDK usage outside monorepo

**Impact:**
- External applications cannot import `@bridge-ai/sdk` from npm
- Phase 10 requires publishable SDK

**Priority:** High (Phase blocker)

---

## Test Coverage Gaps

### Health Controller Redis Ping Not Fully Tested

**Issue:** Health controller tests mock the queue but don't verify Redis ping behavior under failure.

**Files:**
- `packages/nest-core/src/module/health/health.controller.spec.ts`

**Untested Scenarios:**
- Redis client is null/undefined (guard `client?.ping` returns false, health status is 'error' — is this tested?)
- Redis ping throws error (catch block swallows error, status becomes 'error' — correct?)
- Concurrent health checks under load

**Priority:** Low (guard logic is defensive, failure modes degrade gracefully)

---

### Workflow Events Worker Incomplete Coverage

**Issue:** WorkflowEventsWorker only handles two event types explicitly (`telegram.gate_response`, `plan.recovered`). All other events (GSD events, etc.) are marked processed by default but not logged or tracked.

**Files:**
- `packages/nest-core/src/module/pipeline/workflow-events.worker.ts`

**Test Gap:**
- GSD events (gsd.SessionInit, gsd.PhaseStart) are handled but silently
- No verification that unhandled events are marked processed
- No visibility into which events are processed vs. ignored

**Priority:** Medium (affects observability)

---

## Summary

**Critical Issues (fix immediately):**
1. Telegram throttling missing — Phase 8 blocker, security risk
2. Health check uses private BullMQ API — fragile, may break
3. Master key fallback to passphrase — encryption weakness

**High Priority (fix before next release):**
4. Discord module not started — Phase 9 blocker
5. Obsidian REST client missing — Phase 10 blocker
6. SDK not publishable — Phase 10 blocker
7. EXECUTION-LOG.md path fallback — affects log organization

**Medium Priority (address in next sprint):**
8. CLI providers zero cost undocumented — impacts cost tracking transparency
9. Hardcoded container image without version pinning — supply chain risk
10. Monolithic service files — maintainability debt

**Low Priority (nice to have):**
11. Non-atomic secret rotation — atomicity violation in principle
12. Unused parameters — code smell
13. Workflow events audit trail incomplete — observability gap

---

*Concerns audit: 2026-04-01*
