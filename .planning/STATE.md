# Project State: bridge-ai

**Last updated:** 2026-04-01

---

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-04-01)

**Core value:** The Obsidian vault is the product — every execution produces organized, navigable, human-editable intelligence that compounds across projects.
**Current focus:** Milestone 2 — Four-Plane Foundation (Phase 8.5 next: Workspace Onboarding + Repo Indexing)

---

## Current Position

**Milestone:** 2 — Four-Plane Foundation
**Phase:** 8.5 (in progress — Workspace Onboarding + Repo Indexing)
**Current Plan:** 06 of 06 (Phase 8.5)
**Plans:** Plans 00-06 defined; plan 06 complete (CLI + WorkspaceController)

**Milestone 1 (MVP):** ✅ Complete — Phases 1–6 all committed
**Milestone 2 progress:** 2 of 7 phases mostly done, 5 not started

---

## Phase Status

| Phase | Name | Status | Notes |
|-------|------|--------|-------|
| 1 | Foundation | ✅ Complete | |
| 2 | Brain Module | ✅ Complete | |
| 3 | Telegram + Plan Lifecycle | ✅ Complete | |
| 4 | Pipeline Module | ✅ Complete | |
| 5 | Docker Sandbox | ✅ Complete | |
| 6 | Obsidian Vault Sync | ✅ Complete | |
| 7 | Test Coverage + CI | ✅ Mostly done | Gap: CI doesn't enforce coverage threshold as failing gate |
| 8 | Security Hardening | ✅ Mostly done | Gap: docs/SECURITY.md not written. Throttling IS implemented. |
| 8.5 | Workspace Onboarding + Repo Indexing | 🔄 In Progress | Plan 06 complete: CLI package + WorkspaceController stub; plans 00-04 pending |
| 8.6 | Telegram Refactor (Deterministic Protocol) | 🔲 Not started | Commands + context-bound natural language; Telegram never chooses target |
| 9 | Policy Engine + Execution Profiles | 🔲 Not started | Read-only / Guided / Autonomous; allowlists; deny-by-default posture |
| 10 | Loop Engine / Ralph | 🔲 Not started | plan → execute → validate → repair → repeat with hard iteration limits |
| 11 | Vault Mind (90-AI/ operational memory) | 🔲 Not started | Structured specs/decisions/runbooks written proactively |
| 12 | Discord Adapter | 🔲 Not started | Milestone 3 — depends on Policy Engine |
| 13 | Obsidian REST + SDK | 🔲 Not started | Milestone 3 — depends on Vault Mind |

---

## Key Decisions

| Decision | Rationale | Date |
|----------|-----------|------|
| ThrottlerGuard implemented as in-memory sliding window | No Redis dependency for MVP throttling; custom guard vs @nestjs/throttler decorator | 2026-03-31 |
| bridge-sdk has main/exports entries | Package is publishable; just needs npm publish workflow | 2026-03-31 |
| Health endpoint uses custom shape (not Terminus) | Fixed JSON `{status, db, redis}` as documented in Phase 1 spec | 2026-03-31 |
| Reprioritize Milestone 2 to four-plane foundation | Onboarding + deterministic channels + policy + loop + vault memory are pre-reqs for safe autonomy | 2026-04-01 |
| Workspace isolation per run (ephemeral clones) | Prevent agent from touching host repo directly; enable rollback and explicit promotion | 2026-04-01 |
| Telegram deterministic protocol | Chat carries intent; daemon resolves context; commands for risky actions | 2026-04-01 |
| WorkspaceController is a stub in plan 06 | REST surface established before service layer; plans 01-04 wire WorkspaceOnboardingService | 2026-04-01 |
| CLI lazy daemon with Node built-in fetch | No external HTTP dep; Node 18+ fetch + AbortSignal.timeout() sufficient for CLI use case | 2026-04-01 |

---

## Open Items

### Gaps (minor — not blockers)

- **Phase 7**: CI coverage enforcement — `bun run test --coverage` runs but doesn't fail pipeline on threshold miss
- **Phase 8**: `docs/SECURITY.md` — deployment checklist and master key rotation runbook not written
 - **Phase 8.5**: Workspace onboarding + repo indexing — not implemented yet (foundation for brownfield MVP)
 - **Phase 8.6**: Telegram refactor — not implemented yet (deterministic protocol)

### Concerns (from codebase map)

- Health endpoint Redis ping uses private BullMQ accessor (fragile on BullMQ upgrades)
- CLI providers return zero cost/tokens — by design but undocumented
- KSM master key has passphrase fallback in dev (security concern for production deployments)
- Container image hardcoded as `bridge-ai-runner:latest` (no version pinning)

---

## Session Continuity

**GSD planning initialized:** 2026-04-01
**Last session:** 2026-04-01 — Executed plan 8.5-06 (CLI + WorkspaceController)
**Stopped at:** Completed 8.5-06-PLAN.md (checkpoint: human-verify)
**Next action:** Verify checkpoint, then execute plans 8.5-00 through 8.5-04 for workspace services

---

## Todos

0 pending todos

---

## Debug Sessions

0 active debug sessions
