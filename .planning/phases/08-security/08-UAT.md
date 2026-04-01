---
status: testing
phase: 08-security
source: [ROADMAP.md]
started: 2026-04-01T00:00:00Z
updated: 2026-04-01T00:00:00Z
---

## Current Test

number: 1
name: Telegram Throttling
expected: |
  Sending 11+ commands from the same Telegram chat within 60 seconds results in the 11th being rate-limited. TelegramThrottlerGuard enforces 10 req/60s per chat.
awaiting: user response

## Tests

### 1. Telegram Throttling
expected: 11th message within 60s from same chat is rejected by TelegramThrottlerGuard (10 req/60s limit); earlier messages pass through normally
result: [pending]

### 2. SecretAudit Logging
expected: Every KSM secret access creates a SecretAudit row in the DB with caller name and timestamp
result: [pending]

### 3. KSM Secret Rotation
expected: KsmService.rotateSecret() re-encrypts a secret atomically; the old ciphertext is replaced; retrieving the secret after rotation returns the new value
result: [pending]

### 4. Docker Hardening
expected: Container starts with ReadonlyRootfs=true, CapDrop=ALL, no-new-privileges, uid 1000 — verify via `docker inspect <container>`
result: [pending]

### 5. SECURITY.md (known gap)
expected: docs/SECURITY.md exists with deployment checklist, master key rotation runbook, and KSM architecture overview — currently this file is MISSING. Confirm: does docs/SECURITY.md exist?
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0

## Gaps

[none yet]
