---
status: testing
phase: 01-foundation
source: [ROADMAP.md]
started: 2026-04-01T00:00:00Z
updated: 2026-04-01T00:00:00Z
---

## Current Test

number: 1
name: Health Endpoint
expected: |
  GET /health returns JSON: {"status": "ok"|"error", "db": "connected"|"error", "redis": "connected"|"error"}
  With the app running and PostgreSQL + Redis up, status should be "ok" with both db and redis "connected".
awaiting: user response

## Tests

### 1. Health Endpoint
expected: GET /health returns JSON with status "ok", db "connected", redis "connected" when services are up
result: [pending]

### 2. PostgreSQL Migration
expected: Running migrations produces the InitialSchema table structure in the database without errors
result: [pending]

### 3. KSM Encryption
expected: Storing a secret via KsmService encrypts it with AES-256-GCM; retrieving it returns the original plaintext; a SecretAudit row is created recording the access
result: [pending]

### 4. BullMQ Queue Definitions
expected: The three queues (project.events, execution.jobs, workflow.events) are visible in Redis (via redis-cli or Bull Board) after app start
result: [pending]

### 5. Docker Compose Cold Start
expected: `docker compose up` starts PostgreSQL 18, Redis 7, and the app container without errors; health endpoint returns ok within 30 seconds
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0

## Gaps

[none yet]
