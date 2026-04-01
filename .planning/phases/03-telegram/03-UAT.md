---
status: testing
phase: 03-telegram
source: [ROADMAP.md]
started: 2026-04-01T00:00:00Z
updated: 2026-04-01T00:00:00Z
---

## Current Test

number: 1
name: Telegram Bot Commands
expected: |
  Sending /start or /help to the bot returns a response. The bot is online and responding to the full command set.
awaiting: user response

## Tests

### 1. Telegram Bot Commands
expected: Sending /start or /help to the bot returns a response; bot is online and responds to the command set
result: [pending]

### 2. Throttling (10 req/60s)
expected: Sending more than 10 commands within 60 seconds from the same chat results in a rate-limit response; the 11th message is rejected
result: [pending]

### 3. Plan State Machine
expected: Creating a plan via Telegram moves it through pending → queued → executing states; the state transitions are visible in the DB (plans table)
result: [pending]

### 4. Crash Recovery
expected: If the app restarts while a plan is in "executing" state, PlanService.onModuleInit() re-queues it automatically on startup
result: [pending]

### 5. ProjectEvents Worker
expected: Project events are processed by the worker and marked processed or failed in the DB; failed events do not crash the worker
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0

## Gaps

[none yet]
