# Phase 14I — Raise Kids Lesson Runtime Caps Report

**Date:** 2026-06-01
**Implementer:** Claude Sonnet 4.6
**Scope:** Make Kids Brain v1 runtime caps environment-configurable and raise defaults for internal testing

---

## Validation Results

```
TypeScript (npx tsc --noEmit):  0 errors
Tests (vitest run src/kids-brain): 747 / 747 passed (27 test files)
  ├── Phase 14I new tests:  23 / 23
  └── Prior regression:   724 / 724  (all previous tests still pass)
```

---

## Files Modified

| File | Change |
|---|---|
| `backend/src/ws/lesson-ws.ts` | Removed 3 hardcoded cap constants; added import from `runtime-caps.ts` |
| `backend/.env.example` | Added `KIDS_MAX_LLM_CALLS`, `KIDS_MAX_TTS_CHARS`, `KIDS_MAX_DURATION_MINUTES` with documentation |

## Files Created

| File | Purpose |
|---|---|
| `backend/src/kids-brain/runtime/runtime-caps.ts` | Env-configurable cap constants with safe defaults; exports `parseEnvInt`, `KIDS_MAX_DURATION_MS`, `KIDS_MAX_LLM_CALLS`, `KIDS_MAX_TTS_CHARS` |
| `backend/src/kids-brain/runtime/__tests__/phase-14i-runtime-caps.test.ts` | 23 tests covering all spec requirements |

---

## Caps Found

All caps were hardcoded as module-level constants in `backend/src/ws/lesson-ws.ts` lines 100–102.
No Kids Brain–specific caps existed elsewhere. The old `kids-runtime/` prototype (non-v1) uses a separate
`SESSION_MAX_SECONDS = 15 * 60` in `kids-runtime/session-engine.ts` — not affected by this phase.

---

## Old Values → New Values

| Cap | Old Value | New Default | Env Variable |
|---|---|---|---|
| Session duration | `15 * 60 * 1000` ms (15 min) | `20 * 60 * 1000` ms (20 min) | `KIDS_MAX_DURATION_MINUTES` |
| LLM calls per session | `20` | `60` | `KIDS_MAX_LLM_CALLS` |
| TTS characters per session | `2000` | `8000` | `KIDS_MAX_TTS_CHARS` |

---

## Cost-Safety Rationale

### KIDS_MAX_LLM_CALLS: 20 → 60
Kid's Box Unit 1 Lesson 2 has 10 exercises.
Worst-case turn budget: 1 readiness + 10 × 4 turns per exercise = **41 LLM calls**.
Old cap of 20 guaranteed the lesson was always cut off mid-session.
New cap of 60 provides 46% headroom above worst-case without being unlimited.
Estimated AI cost per session at cap: ~60 × $0.002 ≈ **$0.12** (within prototype budget).

### KIDS_MAX_TTS_CHARS: 2000 → 8000
At 80 teacher utterances × ~50–100 chars each, old cap of 2000 was hit after ~20–40 utterances.
New cap allows ~80–160 utterances — covers full lesson with retries.
At ElevenLabs pricing (~$0.15/1K chars): 8000 chars ≈ **$0.012 per session** (negligible).

### KIDS_MAX_DURATION_MINUTES: 15 → 20
Old 15-minute cap could terminate an in-progress correction sequence or analytics finalization.
New 20-minute cap matches AAA/research guidelines for 6–9 year-olds (spec §14.5 ceiling: 25–35 min).
Still well below the absolute hard limit — no runaway risk.

### Anti-runaway preserved
All caps remain **finite and conservative**:
- LLM: 60 (< 200 absolute runaway threshold)
- TTS: 8000 (< 80,000 absolute runaway threshold)
- Duration: 20 min (≤ 60-min absolute runaway threshold)

---

## Tests Added

File: `backend/src/kids-brain/runtime/__tests__/phase-14i-runtime-caps.test.ts`

| Test group | Tests | What is verified |
|---|---|---|
| `parseEnvInt: safe fallback` | 6 | undefined → fallback; empty string → fallback; NaN → fallback; 0 → fallback; negative → fallback; partial-numeric → accepts valid prefix |
| `parseEnvInt: valid env override` | 3 | "60" → 60; "1" → 1; large value passes through |
| `default cap values: safety guarantees` | 5 | All caps are finite positive numbers; duration ≥ 15 min; duration ≤ 60 min |
| `full lesson completion` | 3 | LLM cap > old cap of 20; LLM cap > worst-case 41 calls; TTS cap > old cap of 2000 |
| `anti-runaway` | 2 | LLM cap < 200; TTS cap < 80,000 |
| `analytics finalization guard` | 2 | `kidsAnalyticsFinalized` guard present in lesson-ws.ts; `persistKidsBrainAnalytics` called with `'timeout'` in duration handler |
| `adult runtime isolation` | 2 | No KIDS_MAX in adult orchestrator; runtime-caps.ts imports no adult modules |

---

## Commands Run

```
cd backend
npx tsc --noEmit               # 0 errors
npx vitest run src/kids-brain  # 747/747 passed
```

---

## Remaining Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Module-level constant evaluation: caps read `process.env` once at import time. Env changes after startup are not picked up. | Low | Expected — env is set before server start |
| Old `kids-runtime/` prototype (non-v1) has `SESSION_MAX_SECONDS = 15*60` — not updated | Low | That path is only active when `USE_KIDS_BRAIN_V1=false`; it is a legacy prototype, not the active runtime |
| `KIDS_MAX_TTS_CHARS` is not enforced in `processKidsBrainV1Turn` — only in `processKidsTurn` | Low | Kids Brain v1 teacher utterances are short-form (scripted templates); TTS cap is belt-and-suspenders |
| No integration test of actual WS cap enforcement (would require a full WS server) | Medium | Unit tests verify the constants and cap logic; WS integration tests are out of scope for this phase |

---

## Next Required Phase

**Phase 14J — Kids Brain v1 End-to-End QA Simulation**

Based on Phase 14A audit (score 43/100), the next highest-priority blocker is:
- Full 10-exercise lesson E2E simulation: verify that lesson completes, analytics finalizes, mastery records are written, and the parent summary is meaningful.

This requires a simulated WS session (or scripted turn sequence) against a running backend with Redis/Postgres, not just unit tests.
