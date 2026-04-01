# Security Hardening: bridge-ai

**Version:** 1.0  
**Last Updated:** 2026-04-01  
**Status:** Production

---

## Overview

bridge-ai implements defense-in-depth security across three layers:

1. **Key Storage & Encryption (KSM)** — AES-256-GCM encryption with audit trail
2. **Container Isolation & Hardening** — Docker security profiles with capability dropping
3. **Rate Limiting & Throttling** — Per-channel request bounds to prevent abuse
4. **Audit Trail** — Complete SecretAudit log for compliance and forensics

This document describes deployment checklist, operational procedures, and architecture for each layer.

---

## 1. Key Secret Management (KSM)

### Architecture

bridge-ai uses **AES-256-GCM encryption** for all persistent secrets (provider API keys, SSH credentials, database tokens). The Key Secret Manager (KSM) is implemented in `packages/nest-core/src/module/ksm/`.

```
┌─────────────────────────────────────────────────────────┐
│ Secret Request (e.g., "OpenRouter API key")             │
└──────────────────┬──────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────┐
│ KsmService.getSecret()                                  │
│  • Lookup Secret entity in PostgreSQL                   │
│  • Decrypt using BRIDGE_MASTER_KEY                      │
│  • Log access to SecretAudit table                       │
└──────────────────┬──────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────┐
│ Return plaintext value to caller                        │
│ (Module + ProjectId recorded in audit)                  │
└─────────────────────────────────────────────────────────┘
```

### Master Key (`BRIDGE_MASTER_KEY`)

The master key is a **32-byte secret** that decrypts all stored secrets.

**Deployment Requirements:**

```bash
# Generate a production master key (base64-encoded 32 bytes)
openssl rand -base64 32
# Example output: dGVzdC1rZXktdGhpcy1pcy0zMi1ieXRlcy1sb25nCg==

# Set in deployment:
export BRIDGE_MASTER_KEY="dGVzdC1rZXktdGhpcy1pcy0zMi1ieXRlcy1sb25nCg=="
```

**Constraints:**
- Must be a **base64-encoded 32-byte value** for production
- Length validation: `Buffer.from(key, 'base64').length === 32`
- Dev mode fallback: If not base64-encoded, KSM derives key from SHA256(passphrase) and logs a warning
- Never commit to version control; store in:
  - HashiCorp Vault (recommended)
  - AWS Secrets Manager
  - Docker Swarm Secrets
  - Kubernetes Secrets (with encryption at rest enabled)

### Secret Scopes

Secrets are organized by scope (GLOBAL or PROJECT):

```typescript
enum SecretScope {
  GLOBAL = 'GLOBAL',       // System-wide (provider API keys)
  PROJECT = 'PROJECT',     // Project-specific (repo SSH keys)
}
```

**Example:**
- `GLOBAL/openrouter-api-key` — Provider API key, shared across all projects
- `PROJECT/github-deploy-key#project-id` — SSH key for a specific project's repo

### Encryption Algorithm

```
Algorithm:   AES-256-GCM (Galois/Counter Mode)
Key Size:    256 bits (32 bytes)
IV Size:     96 bits (12 bytes) — random per encryption
Auth Tag:    128 bits (16 bytes) — cryptographic integrity
Format:      JSON blob stored as encrypted_value in Secret entity
```

**Encrypted Blob Structure:**

```json
{
  "version": 1,
  "iv": "<base64-encoded random IV>",
  "tag": "<base64-encoded auth tag>",
  "ciphertext": "<base64-encoded ciphertext>",
  "algorithm": "aes-256-gcm"
}
```

### Secret Rotation

Rotate secrets atomically via `KsmService.rotateSecret()`:

```bash
# CLI command (to be added in Phase 8.6)
gateway secret rotate --name openrouter-api-key --scope GLOBAL --new-value <new-key>
```

**Operation:**
1. Decrypt old value using current master key
2. Encrypt new value with fresh random IV
3. Update Secret entity in transaction
4. Log rotation to SecretAudit with `action: 'rotate'`
5. Increment `keyVersion` for audit trail

### SecretAudit Table

Every secret access is logged with:

```sql
CREATE TABLE secret_audit (
  id UUID PRIMARY KEY,
  secret_id UUID NOT NULL REFERENCES secret(id),
  action VARCHAR(16) NOT NULL, -- 'create', 'read', 'rotate', 'delete'
  caller_module VARCHAR(255) NOT NULL,
  caller_project_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Querying access history:**

```sql
-- Find all reads of OpenRouter API key
SELECT * FROM secret_audit
WHERE secret_id = (SELECT id FROM secret WHERE name = 'openrouter-api-key')
  AND action = 'read'
ORDER BY created_at DESC LIMIT 100;

-- Detect anomalies (reads from unexpected modules)
SELECT caller_module, COUNT(*) as read_count
FROM secret_audit
WHERE created_at > NOW() - INTERVAL '1 hour'
  AND action = 'read'
GROUP BY caller_module
ORDER BY read_count DESC;
```

---

## 2. Container Isolation & Hardening

### Docker Security Profile

Every project execution runs in an isolated container with these hardening settings:

```typescript
const containerConfig = {
  Image: 'bridge-ai-runner:latest',
  User: '1000',  // Non-root UID
  HostConfig: {
    ReadonlyRootfs: true,           // Prevent rootkit installation
    CapDrop: ['ALL'],               // Drop all Linux capabilities
    SecurityOpt: ['no-new-privileges'], // Prevent privilege escalation
    Tmpfs: {
      '/tmp': 'rw,noexec,nosuid,size=256m' // Writable temp, no execution
    },
    NetworkMode: 'bridge-ai-projects',  // Isolated network
    Binds: [`${workspacePath}:/workspace:rw`]  // Ephemeral workspace only
  }
};
```

**Security Properties:**

| Setting | Purpose |
|---------|---------|
| `ReadonlyRootfs: true` | Filesystem is read-only except for explicitly mounted volumes |
| `CapDrop: ['ALL']` | Remove all Linux capabilities (CAP_SYS_ADMIN, CAP_SYS_PTRACE, etc.) |
| `no-new-privileges` | Disable suid/sgid execution, prevent privilege escalation |
| `/tmp` with `noexec` | Temporary storage exists but cannot execute binaries |
| Non-root UID 1000 | Runs as unprivileged user, not root |
| Isolated network | Container cannot reach host or other projects' containers by default |

### Ephemeral Workspace Model

**Design:** Each plan execution gets a **fresh workspace clone** that is deleted after execution completes.

```
┌─────────────────────────────────────────────────────────┐
│ Host Repository (source of truth)                       │
│ /data/repos/my-project/.git                             │
└─────────────────────────────────────────────────────────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
    ┌────▼────┐       ┌────▼────┐       ┌────▼────┐
    │ Run 1   │       │ Run 2   │       │ Run 3   │
    │Ephemeral│       │Ephemeral│       │Ephemeral│
    │Clone    │       │Clone    │       │Clone    │
    └────┬────┘       └────┬────┘       └────┬────┘
         │                 │                 │
    ┌────▼────────────┬────▼────────────┬────▼────────────┐
    │ Container 1     │ Container 2     │ Container 3     │
    │ UID 1000        │ UID 1000        │ UID 1000        │
    │ /workspace (ro) │ /workspace (rw) │ /workspace (rw) │
    └────────────────┬────────────────┬────────────────┘
                     │                 │
                 ┌───▼──────────────────▼───┐
                 │ Promotion (explicit)     │
                 │ git apply / cherry-pick  │
                 │ or git push to branch    │
                 └──────┬────────────────────┘
                        │
                   ┌────▼────────┐
                   │ Host Repo   │
                   │ Updated     │
                   └─────────────┘
```

**Safety Guarantees:**
- Host repo is never written to directly by containers
- Each run's changes are isolated and ephemeral
- Changes are promoted only when explicitly requested
- Rollback is automatic (delete ephemeral clone)
- Audit trail records all promotion requests

### Container Lifecycle

1. **Create**: `DockerService.createContainer(projectId, workspacePath)`
   - Provisions isolated container with hardening flags
   - Mounts ephemeral workspace clone
   - Container enters idle state (`tail -f /dev/null`)

2. **Execute**: `DockerService.execInContainer(projectId, command[], env)`
   - Runs command inside container
   - Captures stdout/stderr
   - Returns exit code

3. **Stop**: `DockerService.stopContainer(projectId)`
   - Stops container gracefully (SIGTERM)
   - Waits up to 10 seconds

4. **Remove**: `DockerService.removeContainer(projectId)`
   - Deletes container and all ephemeral data
   - Workspace clone is discarded

### Verification

Verify container security settings:

```bash
# After running a plan, inspect the container
docker inspect bridge-ai-project-abc123 | jq '.HostConfig | {
  ReadonlyRootfs,
  CapDrop,
  SecurityOpt,
  User,
  Tmpfs
}'

# Output should show:
# {
#   "ReadonlyRootfs": true,
#   "CapDrop": ["ALL"],
#   "SecurityOpt": ["no-new-privileges"],
#   "User": "1000",
#   "Tmpfs": { "/tmp": "rw,noexec,nosuid,size=256m" }
# }
```

---

## 3. Rate Limiting & Throttling

### Telegram Throttler

The Telegram bot enforces request rate limits to prevent abuse and DoS:

```typescript
@UseGuards(TelegramThrottlerGuard)
@Controller('telegram')
export class TelegramController {
  // Guards applied to all endpoints
}
```

**Configuration:**

```typescript
// From TelegramThrottlerGuard
const RATE_LIMIT = 10 / 60;  // 10 requests per 60 seconds
const PER_CHAT = true;        // Per chat, not global
```

**Behavior:**
- **Sliding Window:** Tracks last 60 seconds of requests per `chat_id`
- **Enforcement:** Rejects 11th request with `429 Too Many Requests`
- **Response:** Returns JSON with `retryAfter` header indicating when limit resets

**Example:**

```
Chat #123456 makes 10 requests in 30 seconds → OK
Chat #123456 makes 11th request at 35 seconds → REJECTED
Chat #123456 can retry after 60 - 35 = 25 seconds
```

### Audit of Rate Limit Events

Rate limit rejections are logged:

```typescript
// In TelegramThrottlerGuard
this.logger.warn(
  `Rate limit exceeded for chat ${chatId}`,
  { chatId, limitedUntil, requestCount }
);
```

Query rate limit violations:

```bash
# From logs (structured JSON)
grep "Rate limit exceeded" logs/*.json | jq '.chatId, .limitedUntil' | sort | uniq -c
```

---

## 4. Audit & Compliance

### Audit Tables

The platform maintains complete audit trails:

**secret_audit** — Secret access history

```sql
SELECT * FROM secret_audit
WHERE created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;
```

**execution_events** — All plan executions

```sql
SELECT plan_id, status, started_at, completed_at
FROM execution_events
WHERE created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;
```

**workflow_events** — Human approvals & rejections

```sql
SELECT * FROM workflow_events
WHERE action IN ('pause', 'resume', 'approve', 'reject')
  AND created_at > NOW() - INTERVAL '30 days'
ORDER BY created_at DESC;
```

### Compliance Queries

**Q: Which users accessed provider API keys in the last 7 days?**

```sql
SELECT DISTINCT caller_module, COUNT(*) as access_count
FROM secret_audit
WHERE action = 'read'
  AND secret_id IN (SELECT id FROM secret WHERE name LIKE '%api-key%')
  AND created_at > NOW() - INTERVAL '7 days'
GROUP BY caller_module
ORDER BY access_count DESC;
```

**Q: Did any secret get accessed outside business hours (UTC 00:00-08:00 or 18:00-24:00)?**

```sql
SELECT id, secret_id, action, caller_module, created_at
FROM secret_audit
WHERE EXTRACT(HOUR FROM created_at AT TIME ZONE 'UTC') NOT BETWEEN 8 AND 18
  AND created_at > NOW() - INTERVAL '30 days'
ORDER BY created_at DESC;
```

**Q: Which projects have the most Docker container executions?**

```sql
SELECT project_id, COUNT(*) as execution_count
FROM execution_events
WHERE action = 'container_exec'
  AND created_at > NOW() - INTERVAL '30 days'
GROUP BY project_id
ORDER BY execution_count DESC;
```

---

## 5. Deployment Checklist

### Pre-Deployment

- [ ] **Master Key Generated**: Run `openssl rand -base64 32` and store securely
- [ ] **Key Storage Location**: Confirm KSM location (Vault, AWS Secrets Manager, K8s Secrets)
- [ ] **Database Encryption at Rest**: Enable in PostgreSQL or use encrypted block storage
- [ ] **Network Policy**: Restrict ingress to Telegram bot IP ranges / authorized users only
- [ ] **Docker Daemon Security**: Enable `userns-remap` to map container UID 1000 to unprivileged host UID
- [ ] **Base Image Hardened**: Verify `bridge-ai-runner:latest` image:
  - No root-owned world-writable files
  - No known CVEs (run `trivy image bridge-ai-runner:latest`)
  - Minimal base image (alpine or distroless)

### At-Deployment

- [ ] **BRIDGE_MASTER_KEY Set**: Verify in environment (do not log)
- [ ] **Audit Logging Enabled**: Verify `/var/log/bridge-ai-audit.log` exists and is writable
- [ ] **Database Connected**: Run `GET /health` and confirm `db: connected`
- [ ] **Redis Connected**: Verify in health check response
- [ ] **Container Network Created**: `docker network ls | grep bridge-ai-projects`
- [ ] **Secret Creation Test**: Create a test secret via API and verify it's encrypted in DB

### Post-Deployment

- [ ] **Rate Limiting Verified**: Send 15 rapid Telegram requests, confirm 11+ rejected
- [ ] **Container Hardening Verified**: Spin up a test container and verify security flags:
  ```bash
  docker inspect <container> | jq '.HostConfig.ReadonlyRootfs'  # Should be true
  docker inspect <container> | jq '.HostConfig.CapDrop'         # Should be ["ALL"]
  ```
- [ ] **Audit Trail Working**: Query `SELECT COUNT(*) FROM secret_audit;` and confirm > 0
- [ ] **Backup Strategy Enabled**: Confirm daily encrypted backups of PostgreSQL

---

## 6. Operational Procedures

### Master Key Rotation (Emergency)

If the master key is compromised, execute a coordinated rotation:

1. **Stop all executions**
   ```bash
   curl -X POST http://localhost:3000/api/admin/drain
   ```

2. **Generate new master key**
   ```bash
   NEW_KEY=$(openssl rand -base64 32)
   echo "New master key: $NEW_KEY"
   ```

3. **Rotate secrets** (batch operation to be implemented in Phase 8.6)
   ```bash
   # For each secret in the database:
   # 1. Decrypt with old key
   # 2. Re-encrypt with new key
   # 3. Update Secret.encryptedValue
   # 4. Increment Secret.keyVersion
   ```

4. **Update BRIDGE_MASTER_KEY**
   ```bash
   export BRIDGE_MASTER_KEY=$NEW_KEY
   # Restart application
   systemctl restart bridge-ai
   ```

5. **Verify** — Query a secret to confirm decryption works

6. **Archive old key** — Store securely for forensics; revoke access

### Secret Audit Review

Run weekly audit reviews:

```sql
-- Weekly anomaly report
SELECT 
  DATE(created_at),
  caller_module,
  action,
  COUNT(*) as count
FROM secret_audit
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at), caller_module, action
ORDER BY created_at DESC, count DESC;
```

Alert on:
- Unexpected `caller_module` values (indicates unauthorized access)
- High read volume from non-pipeline modules
- Failed decryption attempts (would show in logs)

### Incident Response

**Suspected Secret Compromise:**

1. **Immediately revoke the secret**
   ```sql
   UPDATE secret SET revoked_at = NOW() WHERE id = '<secret_id>';
   ```

2. **Query who accessed it**
   ```sql
   SELECT * FROM secret_audit WHERE secret_id = '<secret_id>' ORDER BY created_at DESC;
   ```

3. **Rotate all dependent systems** (e.g., if API key was leaked, rotate at provider)

4. **Review plan executions since compromise**
   ```sql
   SELECT * FROM execution_events 
   WHERE created_at > '<compromise_time>' 
   ORDER BY created_at;
   ```

5. **Document incident** with timeline and remediation steps

---

## 7. References

- [NIST SP 800-175B](https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-175B.pdf) — AES-GCM encryption recommendations
- [Docker Security Best Practices](https://docs.docker.com/engine/security/)
- [CIS Benchmarks](https://www.cisecurity.org/cis-benchmarks/) — Container security assessment
- [OWASP Secret Management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)

---

## 8. Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-04-01 | Initial security documentation for Phase 8 |

