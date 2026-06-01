# Phase 14B — Analytics Persistence Report

**Date:** 2026-06-01  
**Implementer:** Claude Sonnet 4.6  
**Scope:** Kids Brain v1 session summary + mastery record persistence to Postgres

---

## Validation Results

```
TypeScript (node_modules/.bin/tsc --noEmit):  0 errors
Tests (vitest run src/kids-brain):           724 / 724 passed  (26 test files)
  ├── Phase 14B new tests:  38 / 38
  └── Prior regression:   686 / 686  (all previous tests still pass)
```

---

## Files Modified

### New files

| File | Purpose |
|---|---|
| `backend/src/kids-brain/analytics/session-analytics.ts` | Core analytics module: `buildSessionSummary`, `buildMasteryRecordsFromSession`, `persistKidsBrainAnalytics` |
| `backend/src/kids-brain/analytics/__tests__/session-analytics.test.ts` | 38 tests covering all spec requirements |

### Modified files

| File | Change |
|---|---|
| `backend/src/ws/lesson-ws.ts` | Import `PostgresProfileStoreImpl` + `persistKidsBrainAnalytics`; add `kidsAnalyticsFinalized` to `ClientMeta`; add `getKidsProfileStore()`; wire persistence at 3 lifecycle hooks |

---

## Persistence Functions Found / Created

### Found (already existed, not called)

| Function | Location | Status |
|---|---|---|
| `saveSessionSummary(summary)` | `PostgresProfileStoreImpl` | EXISTS — now called via `persistKidsBrainAnalytics` |
| `saveMasteryRecord(record)` | `PostgresProfileStoreImpl` | EXISTS — now called via `persistKidsBrainAnalytics` |
| `endKidsBrainSession(sessionMemory)` | `kids-brain-orchestrator.ts` | EXISTS but not wired (produces closing packets only — no persistence inside it; analytics handled separately) |

### Created

| Function | Location | Purpose |
|---|---|---|
| `buildSessionSummary(mem, stopReason, endedAt)` | `analytics/session-analytics.ts` | Maps `SessionMemory` → `SessionSummary`; pure, no side-effects |
| `buildMasteryRecordsFromSession(mem)` | `analytics/session-analytics.ts` | Maps `SessionMemory.itemState` → `MasteryRecord[]` for all attempted items |
| `persistKidsBrainAnalytics(mem, stopReason, store)` | `analytics/session-analytics.ts` | Calls both save functions; non-fatal (all errors caught + logged) |
| `getKidsProfileStore()` | `lesson-ws.ts` | Lazy singleton `PostgresProfileStoreImpl` wrapping the existing `query` function |

---

## Lifecycle Hooks Used

| Hook | Stop Reason | Where in Code |
|---|---|---|
| Safety close (`!result.safeToContinue`) | `'safety'` | `processKidsBrainV1Turn` — before Redis delete, before `ws.close(4400)` |
| Natural close (`result.shouldCloseSession || shouldClose`) | `'completed'` | `processKidsBrainV1Turn` — before Redis delete, before `ws.close(1000)` |
| Max duration timeout (15 min cap) | `'timeout'` | `handleKidsBrainV1LessonStart` setTimeout callback — loads session from Redis, fires async |
| WS close handler (`ws.on('close')`) | — | **NOT called here** — prevents premature finalization on reconnect |

The `ws.on('close')` handler was intentionally NOT wired because:
1. Abnormal disconnects (code 1006) may resume — writing 'abandoned' would prevent 'completed' from being written later
2. Normal closes (code 1000) are already handled inside `processKidsBrainV1Turn` before `ws.close()` is called
3. `ON CONFLICT (session_id) DO NOTHING` means the first write wins — an incorrect first write is permanent

---

## Data Persisted

### Session Summary (`kids_brain_session_summaries`)

| Field | Source |
|---|---|
| `session_id` | `sessionMemory.sessionId` |
| `child_id` | `sessionMemory.childId` |
| `started_at` | `sessionMemory.startedAt` |
| `ended_at` | `new Date().toISOString()` at finalization time |
| `duration_seconds` | computed from `startedAt` / `endedAt` |
| `stop_reason` | `'completed'` / `'safety'` / `'timeout'` |
| `lesson_id` | `sessionMemory.lessonId` |
| `lesson_phase_reached` | `sessionMemory.lessonPhase` |
| `items_attempted_count` | `sessionMemory.itemsAttempted.length` |
| `items_mastered_ids` | `sessionMemory.itemsMastered` (server-side only) |
| `recovery_event_count` | computed from `itemState` (silence > 1 OR wrong attempts > 2) |
| `l1_rescue_used` | `sessionMemory.l1AnchorUsedItems.length > 0` |
| `speaking_turns_count` | `sessionMemory.costCounters.turnCount` |
| `completion_rate` | `mastered / attempted` (null if 0 items) |
| `final_emotional_safety` | `sessionMemory.childState.emotionalSafety` |
| `parent_review_flagged` | `emotionalSafety < 0.3` |

### Mastery Records (`kids_brain_mastery_records`)

One record per item in `sessionMemory.itemsAttempted`:

| Field | Source |
|---|---|
| `child_id` | `sessionMemory.childId` |
| `item_id` | e.g. `'blue'`, `'green'`, `'red'` |
| `mastery_level` | derived from `itemMastery` + `correctAttempts` |
| `production_confidence` | `itemMastery × 100` (0–100 engine scale) |
| `correct_production_count` | `state.correctAttempts` |
| `sessions_seen` | `1` (current session) |
| `prompted_correct_count` | `state.promptedCorrectAttempts` |
| `unprompted_correct_count` | `state.unpromptedCorrectAttempts` |
| `last_seen_at` | `state.lastSeenAt` |

### Mastery Level Derivation

| Condition | Level |
|---|---|
| `itemMastery >= 0.9 AND correctAttempts >= 5` | `AUTOMATIC` |
| `itemMastery >= 0.7 AND correctAttempts >= 3` | `SECURE` |
| `itemMastery >= 0.4 OR correctAttempts >= 1` | `DEVELOPING` |
| otherwise | `EMERGING` |

---

## Idempotency Strategy

| Layer | Mechanism |
|---|---|
| Application | `meta.kidsAnalyticsFinalized: boolean` flag on `ClientMeta` — prevents double-call from safety + natural close race |
| Database (session summary) | `ON CONFLICT (session_id) DO NOTHING` — second call is a DB no-op |
| Database (mastery records) | `ON CONFLICT (child_id, item_id) DO UPDATE SET ...` — upserts safely |
| WS close handler | Not called — avoids premature write on reconnect |

---

## Tests Added

**File:** `backend/src/kids-brain/analytics/__tests__/session-analytics.test.ts`  
**Count:** 38 tests across 8 describe blocks

| Block | Tests | What Is Verified |
|---|---|---|
| `buildSessionSummary` | 10 | Field mapping, duration, completionRate, l1RescueUsed, parentReviewFlagged |
| `buildMasteryRecordsFromSession` | 8 | Per-item records, childId propagation, mastery level derivation, skips missing items |
| `persistKidsBrainAnalytics — session summary` | 2 | `saveSessionSummary` called once; non-fatal on DB error |
| `persistKidsBrainAnalytics — mastery records` | 3 | `saveMasteryRecord` per item; continues on partial failure |
| `persistKidsBrainAnalytics — idempotency` | 2 | Second call is accepted at app layer; DB DO NOTHING handles final dedup |
| `abandoned / interrupted session` | 2 | `stopReason=interrupted`/`abandoned` persists correctly; partial session works |
| `backend-state authority` | 3 | All data sourced from `sessionMemory`, never from external parameters |
| `reconnect guard — source inspection` | 4 | `ws.on('close')` has no analytics call; `kidsAnalyticsFinalized` flag present; `processKidsBrainV1Turn` wires the call |

---

## Commands Run

```
node_modules/.bin/tsc --noEmit            → 0 errors
node_modules/.bin/vitest run src/kids-brain  → 724/724 passed
```

---

## Remaining Risks

| Risk | Severity | Notes |
|---|---|---|
| Truly abandoned sessions (1006 disconnect, no reconnect) are not persisted | Medium | Redis TTL (30 min) will evict the session silently. A background cleanup job could read TTL-expired sessions and write 'abandoned' summaries — out of scope for 14B |
| `mastery_records` uses `DO UPDATE` — repeated sessions upsert into single row | Low | Correct for now since `sessions_seen` is always 1; a future multi-session aggregation phase (14F) will sum across sessions |
| `childId = userId` — no separate child entity exists | Medium | Hardcoded in lesson-ws.ts:1217; Phase 14D will create real child profiles |
| `ON CONFLICT DO NOTHING` for session_summary means reconnect-then-complete writes nothing | Low | The initial 'completed' write happens from the turn processor before ws.close(1000), so the reconnect case only applies to 1006-abandoned sessions which are not written anyway |
| Max duration analytics fire async (void) — WS may close before Postgres ACK | Low | Postgres write is fast; race is unlikely. For safety, consider awaiting in a future stabilization phase |

---

## Next Recommended Phase

**Phase 14D — Child Profile Onboarding** (1–2 days)

**Why:** Analytics are now persisted, but `childId = userId` and `childFirstName = 'friend'`. These are placeholder values that make the data technically correct but not useful for a parent dashboard. Before building the parent report (14G), the child's real name and a proper `child_id` must exist.

**What 14D does:**
1. Pre-lesson setup form: collect child's first name and age
2. Store in `kids_brain_child_profiles` (schema exists, never populated)
3. Pass `childFirstName` into `KidsBrainSessionStartInput` (replaces `'friend'`)
4. Pass a real `childId` UUID (replaces `userId` placeholder)

**Alternatively:** Phase 14I (Raise Prototype Caps) is a 0.5-day fix that unblocks real lessons. `KIDS_MAX_LLM_CALLS=20` limits sessions to ~10 exchanges — a real child would hit this ceiling before seeing analytics. Raising the cap makes the newly wired analytics actually fire in full lessons.
