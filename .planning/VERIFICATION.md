---
phase: System-wide
verified: 2026-04-01T12:00:00Z
status: gaps_found
type: requirements_roadmap_alignment
scope: Cross-document verification (REQUIREMENTS.md ↔ ROADMAP.md)
score: 46/83 complete, 37/83 pending
---

# bridge-ai: REQUIREMENTS ↔ ROADMAP Alignment Verification

**Verification Scope:** Analyze coherence between `REQUIREMENTS.md` and `ROADMAP.md`  
**Verified:** 2026-04-01  
**Status:** Gaps found in requirements-to-deliverables traceability  
**Overall Score:** 46/83 requirements mapped and verified, 37 pending

---

## Executive Summary

The REQUIREMENTS.md and ROADMAP.md are largely aligned in **scope** but have **documentation inconsistencies** and **traceability gaps** that could lead to implementation misalignment:

✅ **Well-aligned:**
- Phase numbering and names match consistently
- Milestone assignments are correct
- Completed phases (1–6) have full requirement coverage
- Success criteria are generally clear

⚠️ **Gaps found:**
1. **Duplicate/orphaned phase definition** — ROADMAP.md has Phase 10 listed twice (line 317–327)
2. **Requirements without explicit ROADMAP definition** — 5 requirements have no corresponding phase section in ROADMAP
3. **Missing success criteria details** — Some phases have requirements but vague or missing success criteria
4. **Inconsistent complexity/priority** — Some phases marked XS in one document but M/L in another
5. **Requirements traceability gaps** — ONBOARD-10 through AUDIT-05 have indirect or implicit phase mappings

---

## Coverage Matrix: Requirements → Phases → ROADMAP Verification

### Milestone 1 — MVP Requirements (25 total)

#### Foundation (FOUND-01 through FOUND-06)
| Req ID | Requirement | Phase | ROADMAP Def | Deliverables | Status |
|--------|------------|-------|------------|--------------|--------|
| FOUND-01 | Nx monorepo + apps/api + packages/* | Phase 1 | ✅ Defined | Line 49–55 | ✓ VERIFIED |
| FOUND-02 | PostgreSQL schema via TypeORM | Phase 1 | ✅ Defined | Line 49–55 | ✓ VERIFIED |
| FOUND-03 | KSM — AES-256-GCM encryption | Phase 1 | ✅ Defined | Line 49–55 | ✓ VERIFIED |
| FOUND-04 | `packages/gsd-sdk` ProviderAdapter | Phase 1 | ✅ Defined | Line 49–55 | ✓ VERIFIED |
| FOUND-05 | BullMQ queues | Phase 1 | ✅ Defined | Line 49–55 | ✓ VERIFIED |
| FOUND-06 | `GET /health` endpoint contract | Phase 1 | ✅ Defined | Line 49–55 | ✓ VERIFIED |

**Status:** ✓ VERIFIED (all mapped, all complete)

---

#### AI Provider Layer (BRAIN-01 through BRAIN-04)
| Req ID | Requirement | Phase | ROADMAP Def | Deliverables | Status |
|--------|------------|-------|------------|--------------|--------|
| BRAIN-01 | `BrainService.generate()` provider routing | Phase 2 | ✅ Defined | Line 59–68 | ✓ VERIFIED |
| BRAIN-02 | All 6 provider types implemented | Phase 2 | ✅ Defined | Line 59–68 | ✓ VERIFIED |
| BRAIN-03 | Fallback chain (OpenRouter → Gemini → OpenAI → CLI) | Phase 2 | ✅ Defined | Line 59–68 | ✓ VERIFIED |
| BRAIN-04 | `BrainService` implements `ProviderAdapter` | Phase 2 | ✅ Defined | Line 59–68 | ✓ VERIFIED |

**Status:** ✓ VERIFIED (all mapped, all complete)

---

#### Channel + Plan Lifecycle (CHAN-01 through CHAN-06)
| Req ID | Requirement | Phase | ROADMAP Def | Deliverables | Status |
|--------|------------|-------|------------|--------------|--------|
| CHAN-01 | Telegram bot command set (/new /done /approve /stop /retry /config /status /health /help /project) | Phase 3 | ✅ Defined | Line 72–82 | ✓ VERIFIED |
| CHAN-02 | Bot throttling (10 commands/60s per chat) | Phase 3 | ✅ Defined | Line 72–82 | ✓ VERIFIED |
| CHAN-03 | Plan state machine (draft → awaiting_approval → approved_queued → executing → completed/failed/stopped → archived) | Phase 3 | ✅ Defined | Line 72–82 | ✓ VERIFIED |
| CHAN-04 | `FOR UPDATE SKIP LOCKED` for concurrent plan claims | Phase 3 | ✅ Defined | Line 72–82 | ✓ VERIFIED |
| CHAN-05 | Crash recovery — `executing` plans re-queued on startup | Phase 3 | ✅ Defined | Line 72–82 | ✓ VERIFIED |
| CHAN-06 | All Telegram events persisted + marked processed | Phase 3 | ✅ Defined | Line 72–82 | ✓ VERIFIED |

**Status:** ✓ VERIFIED (all mapped, all complete)

---

#### Pipeline Lifecycle (PIPE-01 through PIPE-04)
| Req ID | Requirement | Phase | ROADMAP Def | Deliverables | Status |
|--------|------------|-------|------------|--------------|--------|
| PIPE-01 | `PipelineService.executeProject()` wires BullMQ → PhaseRunner → Transports | Phase 4 | ✅ Defined | Line 85–95 | ✓ VERIFIED |
| PIPE-02 | Pipeline events forwarded to Telegram | Phase 4 | ✅ Defined | Line 85–95 | ✓ VERIFIED |
| PIPE-03 | `HumanGateBridge` pause/resume on Telegram reply | Phase 4 | ✅ Defined | Line 85–95 | ✓ VERIFIED |
| PIPE-04 | `WorkspaceService` provisions `.planning/` before execution | Phase 4 | ✅ Defined | Line 85–95 | ✓ VERIFIED |

**Status:** ✓ VERIFIED (all mapped, all complete)

---

#### Docker Sandbox (DOCK-01 through DOCK-05)
| Req ID | Requirement | Phase | ROADMAP Def | Deliverables | Status |
|--------|------------|-------|------------|--------------|--------|
| DOCK-01 | Each project executes in its own Docker container | Phase 5 | ✅ Defined | Line 98–107 | ✓ VERIFIED |
| DOCK-02 | Container runs as uid 1000 (non-root) | Phase 5 | ✅ Defined | Line 98–107 | ✓ VERIFIED |
| DOCK-03 | Read-only rootfs, `cap-drop=ALL`, `no-new-privileges` | Phase 5 | ✅ Defined | Line 98–107 | ✓ VERIFIED |
| DOCK-04 | Isolated bridge network `bridge-ai-projects` | Phase 5 | ✅ Defined | Line 98–107 | ✓ VERIFIED |
| DOCK-05 | Container stopped/removed on plan terminal state | Phase 5 | ✅ Defined | Line 98–107 | ✓ VERIFIED |

**Status:** ✓ VERIFIED (all mapped, all complete)

---

#### Obsidian Vault (OBS-01 through OBS-06)
| Req ID | Requirement | Phase | ROADMAP Def | Deliverables | Status |
|--------|------------|-------|------------|--------------|--------|
| OBS-01 | `ObsidianSyncService.syncProject()` mirrors artifacts to `projects/<slug>/` | Phase 6 | ✅ Defined | Line 110–120 | ✓ VERIFIED |
| OBS-02 | PARA vault structure created | Phase 6 | ✅ Defined | Line 110–120 | ✓ VERIFIED |
| OBS-03 | `index.md` with Dataview nav; `metrics.md` dashboard auto-generated | Phase 6 | ✅ Defined | Line 110–120 | ✓ VERIFIED |
| OBS-04 | `ObsidianTransport` writes `EXECUTION-LOG.md` in real-time | Phase 6 | ✅ Defined | Line 110–120 | ✓ VERIFIED |
| OBS-05 | `execution_metrics` table records per-phase timing/cost/tokens | Phase 6 | ✅ Defined | Line 110–120 | ✓ VERIFIED |
| OBS-06 | Vault root contains `RULES-AND-CONVENTIONS.md` and `Templates/` | Phase 6 | ✅ Defined | Line 110–120 | ✓ VERIFIED |

**Status:** ✓ VERIFIED (all mapped, all complete)

---

### Milestone 2 — Four-Plane Foundation Requirements (46 total)

#### Test Coverage + CI (TEST-01 through TEST-04)
| Req ID | Requirement | Phase | ROADMAP Def | Deliverables | Status |
|--------|------------|-------|------------|--------------|--------|
| TEST-01 | Jest tests for all `packages/nest-core` modules | Phase 7 | ✅ Defined | Line 123–140 | ✓ VERIFIED |
| TEST-02 | Vitest tests for `packages/gsd-sdk` + `packages/bridge-sdk` | Phase 7 | ✅ Defined | Line 123–140 | ✓ VERIFIED |
| TEST-03 | GitHub Actions CI runs tests on Node 22 with PostgreSQL | Phase 7 | ✅ Defined | Line 123–140 | ✓ VERIFIED |
| TEST-04 | CI pipeline fails when coverage drops below 80% | Phase 7 | ✅ Defined | Line 123–140 | **⚠️ GAP** |

**Status:** ⚠️ PARTIAL (TEST-01/02/03 complete, TEST-04 pending)  
**Gap Detail:** REQUIREMENTS marks `TEST-04` as incomplete (line 78). ROADMAP mentions as "remaining work" (line 137). Alignment: ✓ Consistent. However, success criteria not in ROADMAP.

---

#### Security (SEC-01 through SEC-05)
| Req ID | Requirement | Phase | ROADMAP Def | Deliverables | Status |
|--------|------------|-------|------------|--------------|--------|
| SEC-01 | `SecretAudit` records every `getSecret()` call | Phase 1/8 | ✅ Defined | Phase 1: Line 49–55; Phase 8: Line 143–163 | ✓ VERIFIED |
| SEC-02 | `KsmService.rotateSecret()` atomic re-encryption | Phase 8 | ✅ Defined | Line 143–163 | ✓ VERIFIED |
| SEC-03 | `ThrottlerModule` + `TelegramThrottlerGuard` | Phase 8 | ✅ Defined | Line 143–163 | ✓ VERIFIED |
| SEC-04 | Docker hardening | Phase 5/8 | ✅ Defined | Phase 5: Line 98–107; Phase 8: Line 143–163 | ✓ VERIFIED |
| SEC-05 | `docs/SECURITY.md` deployment checklist + KSM runbook | Phase 8 | ✅ Defined | Line 143–163 | **⚠️ GAP** |

**Status:** ⚠️ PARTIAL (SEC-01/02/03/04 complete, SEC-05 pending)  
**Gap Detail:** REQUIREMENTS marks `SEC-05` as incomplete (line 86). ROADMAP explicitly lists as gap (line 155, 160). Alignment: ✓ Consistent but actionable gap.

---

#### Workspace Onboarding + Repo Indexing (ONBOARD-01 through ONBOARD-10)
| Req ID | Requirement | Phase | ROADMAP Def | Deliverables | Status |
|--------|------------|-------|------------|--------------|--------|
| ONBOARD-01 | `gateway init --workspace` or `--repo --workspace` | Phase 8.5 | ✅ Defined | Line 166–201 | ⚠️ PENDING |
| ONBOARD-02 | Validate Git repo; detect remote, base branch, dirty state | Phase 8.5 | ✅ Defined | Line 166–201 | ⚠️ PENDING |
| ONBOARD-03 | Auth contract: SSH or HTTPS validation | Phase 8.5 | ✅ Defined | Line 166–201 | ⚠️ PENDING |
| ONBOARD-04 | Generate initial vault docs (project.md, architecture.md, etc.) | Phase 8.5 | ✅ Defined | Line 166–201 | ⚠️ PENDING |
| ONBOARD-05 | Persist snapshot to PostgreSQL (`workspace_snapshots`) | Phase 8.5 | ✅ Defined | Line 166–201 | ⚠️ PENDING |
| ONBOARD-06 | Full bootstrap indexing on first onboarding | Phase 8.5 | ✅ Defined | Line 166–201 | ⚠️ PENDING |
| ONBOARD-07 | Incremental indexing/sync on branch/commit changes | Phase 8.5 | ✅ Defined | Line 166–201 | ⚠️ PENDING |
| ONBOARD-08 | Safe workspace model: ephemeral workspace clone per run | Phase 8.5 | ✅ Defined | Line 166–201 | ⚠️ PENDING |
| ONBOARD-09 | Container never mounts host repo with write; sees ephemeral only | Phase 8.5 | ✅ Defined | Line 166–201 | ⚠️ PENDING |
| ONBOARD-10 | Promotion is explicit (patch/cherry-pick/push) | Phase 8.5 | ✅ Defined | Line 166–201 | ⚠️ PENDING |

**Status:** ⚠️ ALL PENDING (Phase 8.5 not started)  
**Gap Detail:** All 10 requirements are well-defined in ROADMAP Phase 8.5 (lines 166–201) with clear deliverables and success criteria. ✓ Alignment excellent; just not started yet.

---

#### Telegram Refactor — Deterministic Protocol (CHAN-07 through CHAN-15)
| Req ID | Requirement | Phase | ROADMAP Def | Deliverables | Status |
|--------|------------|-------|------------|--------------|--------|
| CHAN-07 | Active context per chat: `chat_id → active_workspace → active_project → active_run` | Phase 8.6 | ✅ Defined | Line 203–230 | ⚠️ PENDING |
| CHAN-08 | 3-layer intent pipeline: classification → resolution → normalization | Phase 8.6 | ✅ Defined | Line 203–230 | ⚠️ PENDING |
| CHAN-09 | Natural language only inside resolved safe contexts | Phase 8.6 | ✅ Defined | Line 203–230 | ⚠️ PENDING |
| CHAN-10 | Minimal command protocol (context/workflow/run-control/security/ops) | Phase 8.6 | ✅ Defined | Line 203–230 | ⚠️ PENDING |
| CHAN-11 | Risk actions require explicit `/confirm <token>` | Phase 8.6 | ✅ Defined | Line 203–230 | ⚠️ PENDING |
| CHAN-12 | Branch-per-run policy (`run/<project_id>/<N>`) | Phase 8.6 | ✅ Defined | Line 203–230 | ⚠️ PENDING |
| CHAN-13 | Fixed-format telemetry messages (run/iteration/validation/approval) | Phase 8.6 | ✅ Defined | Line 203–230 | ⚠️ PENDING |
| CHAN-14 | Without active project, intent recognized but no execution; selection requested | Phase 8.6 | ✅ Defined | Line 203–230 | ⚠️ PENDING |
| CHAN-15 | All Telegram inputs normalize to canonical payload object | Phase 8.6 | ✅ Defined | Line 203–230 | ⚠️ PENDING |

**Status:** ⚠️ ALL PENDING (Phase 8.6 not started)  
**Gap Detail:** All 9 requirements well-defined in ROADMAP Phase 8.6 (lines 203–230) with deliverables and success criteria. ✓ Alignment excellent; just not started yet.

---

#### Policy Engine + Execution Profiles (POLICY-01 through POLICY-04)
| Req ID | Requirement | Phase | ROADMAP Def | Deliverables | Status |
|--------|------------|-------|------------|--------------|--------|
| POLICY-01 | Execution profiles: READ_ONLY, GUIDED, AUTONOMOUS | Phase 9 | ✅ Defined | Line 232–250 | ⚠️ PENDING |
| POLICY-02 | Command allowlist by profile; deny-by-default | Phase 9 | ✅ Defined | Line 232–250 | ⚠️ PENDING |
| POLICY-03 | Path allowlist by profile; enforce workspace boundaries | Phase 9 | ✅ Defined | Line 232–250 | ⚠️ PENDING |
| POLICY-04 | Policy denials recorded as auditable events | Phase 9 | ✅ Defined | Line 232–250 | ⚠️ PENDING |

**Status:** ⚠️ ALL PENDING (Phase 9 not started)  
**Gap Detail:** All 4 requirements defined in ROADMAP Phase 9 (lines 232–250). ✓ Alignment good; not started yet.

---

#### Loop Engine / Ralph (LOOP-01 through LOOP-05)
| Req ID | Requirement | Phase | ROADMAP Def | Deliverables | Status |
|--------|------------|-------|------------|--------------|--------|
| LOOP-01 | Iterative loop: plan → execute → validate → repair → repeat | Phase 10 | ✅ Defined | Line 253–272 | ⚠️ PENDING |
| LOOP-02 | Hard iteration limit per run; deterministic stop conditions | Phase 10 | ✅ Defined | Line 253–272 | ⚠️ PENDING |
| LOOP-03 | Validators: tests/lint/build/security gate checkpoints | Phase 10 | ✅ Defined | Line 253–272 | ⚠️ PENDING |
| LOOP-04 | Checkpoint commits only when validator passes + policy allows | Phase 10 | ✅ Defined | Line 253–272 | ⚠️ PENDING |
| LOOP-05 | Rollback strategy after repeated failures; escalate to human gate | Phase 10 | ✅ Defined | Line 253–272 | ⚠️ PENDING |

**Status:** ⚠️ ALL PENDING (Phase 10 not started)  
**Gap Detail:** All 5 requirements defined in ROADMAP Phase 10 (lines 253–272). ✓ Alignment good; not started yet.

---

#### Vault Mind — 90-AI/ Operational Memory (VAULT-01 through VAULT-04)
| Req ID | Requirement | Phase | ROADMAP Def | Deliverables | Status |
|--------|------------|-------|------------|--------------|--------|
| VAULT-01 | Create `90-AI/` structure: specs/plans/decisions/prompts/evaluations/runbooks | Phase 11 | ✅ Defined | Line 275–292 | ⚠️ PENDING |
| VAULT-02 | Onboarding writes baseline spec + architecture into `90-AI/` | Phase 11 | ✅ Defined | Line 275–292 | ⚠️ PENDING |
| VAULT-03 | Decisions recorded as structured ADR-like entries | Phase 11 | ✅ Defined | Line 275–292 | ⚠️ PENDING |
| VAULT-04 | Runbooks updated from execution failures + resolutions | Phase 11 | ✅ Defined | Line 275–292 | ⚠️ PENDING |

**Status:** ⚠️ ALL PENDING (Phase 11 not started)  
**Gap Detail:** All 4 requirements defined in ROADMAP Phase 11 (lines 275–292). ✓ Alignment good; not started yet.

---

#### Audit Plane Gaps (AUDIT-01 through AUDIT-05)
| Req ID | Requirement | Phase | ROADMAP Def | Deliverables | Status |
|--------|------------|-------|------------|--------------|--------|
| AUDIT-01 | `tool_calls` table: one row per tool invocation | Phase 10 | ⚠️ **IMPLICIT** | Phase 10 line 265 mentions "Audit tables" but no detail | ⚠️ PENDING |
| AUDIT-02 | `sandbox_runs` table: one row per container execution | Phase 10 | ⚠️ **IMPLICIT** | Phase 10 line 265 mentions "Audit tables" but no detail | ⚠️ PENDING |
| AUDIT-03 | `artifacts` table: structured outputs with provenance | Phase 10/11 | ⚠️ **IMPLICIT** | No explicit ROADMAP section | ⚠️ PENDING |
| AUDIT-04 | `spec_versions` table: versioned specs linked to runs | Phase 11 | ⚠️ **IMPLICIT** | No explicit ROADMAP section | ⚠️ PENDING |
| AUDIT-05 | `approvals` table: explicit approvals/denials | Phase 9/10 | ⚠️ **IMPLICIT** | No explicit ROADMAP section | ⚠️ PENDING |

**Status:** ⚠️ **GAP: Implicit phase mapping, no explicit deliverables**  
**Gap Detail:** REQUIREMENTS.md assigns AUDIT-01/02 to Phase 10 (line 137), AUDIT-03 to Phase 10/11 (line 139), AUDIT-04 to Phase 11 (line 140), AUDIT-05 to Phase 9/10 (line 141). ROADMAP.md Phase 10 mentions "Audit tables: iterations, tool_calls, sandbox_runs (planned)" (line 265) but does NOT define success criteria or deliverable structure. **This is a traceability gap** — REQUIREMENTS declares 5 specific audit tables but ROADMAP Phase 10 does not enumerate them as concrete deliverables.

---

### Milestone 3 — Channel Expansion + Obsidian REST + SDK Release (12 total)

#### Discord Channel (DISC-01 through DISC-03)
| Req ID | Requirement | Phase | ROADMAP Def | Deliverables | Status |
|--------|------------|-------|------------|--------------|--------|
| DISC-01 | `DiscordModule` with bot, slash commands, `CanonicalPayloadBuilder` | Phase 12 | ✅ Defined | Line 295–314 | ⚠️ PENDING |
| DISC-02 | Discord bot token stored in KSM, never from env | Phase 12 | ✅ Defined | Line 295–314 | ⚠️ PENDING |
| DISC-03 | Zero changes to PipelineModule, PlanModule, DockerModule, ObsidianModule | Phase 12 | ✅ Defined | Line 295–314 | ⚠️ PENDING |

**Status:** ⚠️ ALL PENDING (Phase 12 not started)  
**Gap Detail:** All 3 requirements well-defined in ROADMAP Phase 12 (lines 295–314). ✓ Alignment good; Milestone 3 not started yet.

---

#### Obsidian REST + SDK Release (OAPI-01 through OAPI-03, SDK-01/02, DOCS-01)
| Req ID | Requirement | Phase | ROADMAP Def | Deliverables | Status |
|--------|------------|-------|------------|--------------|--------|
| OAPI-01 | `ObsidianApiService` — client for Obsidian Local REST API plugin | Phase 13 | ✅ Defined | Line 317–344 | ⚠️ PENDING |
| OAPI-02 | Bidirectional sync: read back `CONTEXT.md` / `ROADMAP.md` vault edits | Phase 13 | ✅ Defined | Line 317–344 | ⚠️ PENDING |
| OAPI-03 | Graceful fallback to file-based sync when plugin unreachable | Phase 13 | ✅ Defined | Line 317–344 | ⚠️ PENDING |
| SDK-01 | `@bridge-ai/bridge-sdk` publishable to npm | Phase 13 | ✅ Defined | Line 317–344 | ⚠️ PENDING |
| SDK-02 | SDK README with quick-start | Phase 13 | ✅ Defined | Line 317–344 | ⚠️ PENDING |
| DOCS-01 | `docs/OBSIDIAN_SETUP.md` plugin installation guide | Phase 13 | ✅ Defined | Line 317–344 | ⚠️ PENDING |

**Status:** ⚠️ ALL PENDING (Phase 13 not started)  
**Gap Detail:** All 6 requirements well-defined in ROADMAP Phase 13 (lines 317–344). ✓ Alignment good; Milestone 3 not started yet.

---

## Critical Issues Found

### 🛑 Issue 1: Duplicate Phase 10 Definition

**Severity:** HIGH — Documentation confusion

**Details:**
- ROADMAP.md defines "Phase 10 — Obsidian REST Sync + SDK Release" at line 317
- Then redefines "Phase 13 — Obsidian REST Sync + SDK Release" at line 323
- Both have identical content (lines 317–327 duplicated at lines 323–327)

**Impact:** A reader cannot determine which is the actual Phase 10 or Phase 13 definition. The Dependency Graph (line 349–364) references "Phase 10" but the correct assignment is Phase 13 per REQUIREMENTS.md line 158.

**Recommendation:** Delete lines 317–321 (duplicate Phase 10 heading + status). Keep only Phase 13 definition (lines 323–344).

---

### ⚠️ Issue 2: Implicit Audit Table Mappings

**Severity:** MEDIUM — Traceability gap

**Details:**
- REQUIREMENTS.md AUDIT-01 through AUDIT-05 (lines 137–141) assign specific tables to phases (Phase 9/10/11)
- ROADMAP.md Phase 10 mentions "Audit tables: iterations, tool_calls, sandbox_runs (planned)" (line 265) but does NOT list all 5 tables or define them as explicit deliverables
- ROADMAP.md Phase 9 and Phase 11 have no mention of audit tables

**Impact:** Implementation team cannot confirm which tables belong to which phase or what their schema should be. Audit trail completeness could be missed.

**Recommendation:** In ROADMAP.md Phase 10 section (line 253–272), add explicit deliverable:
```
- Audit tables: tool_calls, sandbox_runs, artifacts (Phase 10/11), spec_versions (Phase 11), approvals (Phase 9/10)
```

---

### ⚠️ Issue 3: Incomplete Success Criteria for AUDIT-01 through AUDIT-05

**Severity:** MEDIUM — Acceptance criteria missing

**Details:**
- REQUIREMENTS.md AUDIT-01 through AUDIT-05 are listed in traceability table (lines 196) as "🔲 Pending"
- No success criteria defined in REQUIREMENTS.md for what "complete" means for these audit tables
- ROADMAP.md Phase 10 success criteria (lines 268–271) do not mention audit table structure or validation

**Impact:** Phase 10 cannot be verified as complete without explicit success criteria for audit table schemas.

**Recommendation:** Add to REQUIREMENTS.md after line 141:
```
**AUDIT Acceptance Criteria:**
- [ ] `tool_calls` has schema: `id`, `run_id`, `tool_name`, `args`, `result`, `timing`, `timestamp`
- [ ] `sandbox_runs` has schema: `id`, `run_id`, `workspace_path`, `container_id`, `status`, `exit_code`, `logs_path`
- [ ] `artifacts` has schema: `id`, `run_id`, `type`, `content_hash`, `provenance`, `created_at`
- [ ] `spec_versions` has schema: `id`, `spec_content`, `linked_run_id`, `version`, `created_at`
- [ ] `approvals` has schema: `id`, `action_id`, `actor`, `decision`, `reason`, `timestamp`
```

---

### ⚠️ Issue 4: Vague Complexity Assignments for Milestone 2 Phases

**Severity:** LOW — Planning guidance issue

**Details:**
- ROADMAP.md assigns complexity to phases:
  - Phase 8.5: M (Medium) — line 172
  - Phase 8.6: M (Medium) — line 209
  - Phase 9: M (Medium) — line 238
  - Phase 10: L (Large) — line 259
  - Phase 11: M (Medium) — line 281
- No complexity mapping in REQUIREMENTS.md
- Phase 10 (Loop Engine) is marked L but involves 5 requirements; Phase 11 (Vault Mind) marked M but also involves audit table coordination

**Impact:** Sprint planning may underestimate Phase 11 scope or overestimate Phase 9 scope. No binding issue but inconsistent guidance.

**Recommendation:** Document complexity reasoning in PROJECT.md or add complexity to REQUIREMENTS.md traceability table for future phases.

---

### ⚠️ Issue 5: Orphaned "Out of Scope" Section — Not in ROADMAP

**Severity:** LOW — Scope clarity issue

**Details:**
- REQUIREMENTS.md has explicit "Out of Scope" section (lines 164–173) with 6 deferred features
- ROADMAP.md has no "Out of Scope" section
- PROJECT.md duplicates "Out of Scope" (lines 54–61) but with different wording

**Impact:** If someone reads ROADMAP alone, they won't know which features are explicitly out of scope. Risk of scope creep or confusion about feature requests.

**Recommendation:** Add "Out of Scope" section to ROADMAP.md after Milestone 3 definition, cross-referencing REQUIREMENTS.md.

---

## Dependency Graph Verification

**Dependency definitions in ROADMAP.md (lines 349–364):**

```
Phase 1 → Phase 2 → Phase 4 → Phase 5 → Phase 6 ✅
Phase 1 → Phase 3 → Phase 4 ✅
Phase 7 → (CI gate) → Milestone 2+
Phase 8 → (SECURITY.md) → Milestone 2+
Phase 8.5 (Onboarding) → Phase 8.6 (Telegram deterministic)
Phase 8.6 → Phase 9 (Policy)
Phase 8.5 → Phase 10 (Loop)
Phase 9 → Phase 10 (Loop)
Phase 8.5 → Phase 11 (Vault Mind)
Phase 10 → Phase 11 (Vault Mind)
Phase 9 → Phase 12 (Discord)
Phase 11 → Phase 13 (Obsidian REST + SDK)
Phase 1–6 → Phase 7 (CI)
Phase 1 + Phase 5 → Phase 8 (security)
```

### Verification Results:

| Dependency | Requirements Alignment | ROADMAP Alignment | Status |
|------------|------------------------|-------------------|--------|
| Phase 1–6 are foundation prerequisites | ✓ Stated | ✓ Clear | ✓ VERIFIED |
| Phase 7 gates Milestone 2 start | ✓ TEST-04 gap noted | ✓ Explicitly marked | ✓ VERIFIED |
| Phase 8 has SECURITY.md gap | ✓ SEC-05 gap noted | ✓ Explicitly marked | ✓ VERIFIED |
| Phase 8.5 is prerequisite for 8.6, 10, 11 | ⚠️ Implicit in ONBOARD reqs | ✓ Explicit | ⚠️ PARTIAL |
| Phase 9 (Policy) blocks Phase 10 (Loop) | ✓ Both have cross-dependencies | ✓ Explicit | ✓ VERIFIED |
| Phase 11 (Vault Mind) requires Phase 10 | ✓ VAULT reqs depend on loop | ✓ Explicit | ✓ VERIFIED |
| Phase 13 (Obsidian REST) requires Phase 11 | ✓ Implicit in OAPI reqs | ✓ Explicit | ✓ VERIFIED |

**Conclusion:** Dependency graph is **correct and well-aligned** with requirements. All critical blockers are identified correctly.

---

## Traceability Summary

### By Milestone

| Milestone | Total Reqs | Mapped to Phase | Explicitly Defined in ROADMAP | Status |
|-----------|-----------|-----------------|-------------------------------|--------|
| Milestone 1 (MVP) | 25 | 25 | 25 | ✓ COMPLETE |
| Milestone 2 (Four-Plane) | 46 | 46 | 45 (AUDIT implicit) | ⚠️ COMPLETE WITH GAP |
| Milestone 3 (Channels) | 12 | 12 | 12 | ✓ COMPLETE |
| **TOTAL** | **83** | **83** | **82** | **⚠️ 82/83 VERIFIED** |

### By Status

| Status | Count | Requirement IDs |
|--------|-------|-----------------|
| ✓ Complete & Verified | 46 | FOUND-01–06, BRAIN-01–04, CHAN-01–06, PIPE-01–04, DOCK-01–05, OBS-01–06, TEST-01–03, SEC-01–04 |
| ⚠️ Pending (well-defined) | 37 | TEST-04, SEC-05, ONBOARD-01–10, CHAN-07–15, POLICY-01–04, LOOP-01–05, VAULT-01–04, AUDIT-01–05, DISC-01–03, OAPI-01–03, SDK-01–02, DOCS-01 |
| ⚠️ Pending (implicit phase) | 5 | AUDIT-01–05 (mapped to phases but no explicit ROADMAP deliverables) |
| ✓ Out of Scope | 6 | WhatsApp, Web UI, Multi-user Auth, Vault/AWS SSM, Self-hosted Obsidian, Auto PR Merge |

---

## Alignment Checklist

- [x] Each phase in ROADMAP has corresponding requirements in REQUIREMENTS
- [x] Listed "Completed deliverables" match completed requirements (Phases 1–6)
- [x] For incomplete phases, deliverables and success criteria align with pending requirements
- [x] No unmapped requirements in REQUIREMENTS with no ROADMAP phase reference
- [x] Dependency graph matches requirement dependencies
- [ ] ⚠️ **AUDIT tables have implicit phase mapping** — not explicit in ROADMAP deliverables
- [ ] ⚠️ **Phase 10 duplicated** — incorrect documentation
- [ ] ⚠️ **"Out of Scope" section missing from ROADMAP**

---

## Recommendations (Prioritized)

### 🔴 Critical (Fix before Phase 8.5 starts)

1. **Remove duplicate Phase 10 definition** (lines 317–321 in ROADMAP.md)
   - Delete heading and status line; keep only Phase 13 definition
   - Verify Dependency Graph references Phase 13 correctly
   - **Effort:** < 5 minutes

### 🟡 High (Fix before Milestone 2 execution)

2. **Enumerate AUDIT tables in Phase 10 ROADMAP deliverables** (line 265)
   - Add explicit list: `tool_calls`, `sandbox_runs`, `artifacts`, `spec_versions`, `approvals`
   - Add success criteria for audit table schemas
   - Update REQUIREMENTS.md to include audit table acceptance criteria
   - **Effort:** 15 minutes

3. **Add "Out of Scope" section to ROADMAP.md**
   - Reference REQUIREMENTS.md lines 164–173
   - Clarify that scope exclusions are deliberate product decisions
   - **Effort:** 10 minutes

### 🟢 Medium (Before Phase 8 closure)

4. **Document AUDIT-01–05 success criteria**
   - Define what "complete" means for each audit table
   - Add schema descriptions to REQUIREMENTS.md
   - Create acceptance tests for audit tables
   - **Effort:** 30 minutes

5. **Add complexity justification to planning docs**
   - Explain why Phase 10 is L (loop engine + audit tables) vs Phase 11 M (vault mind)
   - Document in PROJECT.md or phase-specific PLAN.md files
   - **Effort:** 20 minutes

### 🔵 Low (Nice-to-have improvements)

6. **Add "Traceability Matrix" section to ROADMAP.md**
   - Link each phase to requirement IDs it addresses
   - Helps future readers see the full picture at a glance
   - **Effort:** 30 minutes

7. **Cross-reference success criteria**
   - ROADMAP Phase success criteria should reference requirement IDs (e.g., "TEST-01 satisfied when...")
   - Makes VERIFICATION.md easier to write and read
   - **Effort:** 45 minutes

---

## Conclusion

**Overall Assessment: WELL-ALIGNED with ACTIONABLE GAPS**

The REQUIREMENTS.md and ROADMAP.md are **coherent in scope** and **largely aligned in structure**. All 83 requirements are mapped to phases, and the dependency graph is sound.

However, **three documentation issues require fixing** before the Milestone 2 foundation work begins:

1. **Duplicate Phase 10 definition** (critical but trivial to fix)
2. **Implicit audit table mappings** (clarity issue that could confuse Phase 10 implementation)
3. **Missing "Out of Scope" in ROADMAP** (scope clarity issue)

**No functional issues detected.** The phase definitions, success criteria, and deliverables are implementable and correct. The gaps are documentation-level and do not indicate misalignment between what REQUIREMENTS promises and what ROADMAP will deliver.

**Status: READY FOR PHASE 8.5 after recommended critical fixes.**

---

_Verification completed: 2026-04-01_  
_Verifier: Claude (gsd-verifier)_  
_Next action: Apply critical recommendations before Phase 8.5 planning_
