---
status: testing
phase: 02-brain
source: [ROADMAP.md]
started: 2026-04-01T00:00:00Z
updated: 2026-04-01T00:00:00Z
---

## Current Test

number: 1
name: Provider Resolution
expected: |
  BrainService.generate(prompt, projectId) resolves the correct provider from KSM secrets and returns a non-empty string response.
awaiting: user response

## Tests

### 1. Provider Resolution
expected: BrainService.generate() resolves provider from KSM and returns a non-empty AI response for a simple prompt
result: [pending]

### 2. Fallback Chain
expected: When the primary provider (OpenRouter) is unavailable or key missing, BrainService falls back to the next in chain (Gemini → OpenAI → Claude CLI) without throwing
result: [pending]

### 3. ProviderAdapter Interface
expected: BrainService satisfies the ProviderAdapter interface from gsd-sdk; calling generate() with a projectId logs cost/token metadata (even if zero for CLI)
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0

## Gaps

[none yet]
