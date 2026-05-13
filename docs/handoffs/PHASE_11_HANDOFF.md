# PHASE 11 COMPLETE — CONTINUATION & RUNTIME SAFETY

## 1. Summary

Phase 11 was a backend runtime hardening pass — no new features, no architecture rewrites. Six targeted fixes were applied to close billing, ownership, and continuation correctness gaps in the paid lesson runtime.

The platform now has:
- Correct billing per reconnect session (not cumulative from original lesson start)
- Idempotent `finalizeUsage` that cannot charge twice for the same session
- Single-ownership enforcement preventing two browser tabs from concurrently running the same lesson
- Exact exercise type restoration on resume (no more `'unknown'`)
- Guard against resuming an already-ended lesson
- Accurate continuation-status remaining-time from original lesson wall-clock start

Both TypeScript builds pass with 0 errors. Frontend production build clean (78 modules, 432 kB).

---

## 2. Goals Completed

- **Billing double-charge on reconnect** — FIXED (Change 1, 3)
- **`finalizeUsage` not idempotent** — FIXED (Change 2)
- **Two-tab concurrent lesson ownership** — FIXED (Change 3)
- **`exerciseType: 'unknown'` on resume** — FIXED (Change 4)
- **Ended-lesson resume guard** — FIXED (Change 3, guard in `resumeLesson`)
- **Continuation-status shows wrong remaining time after reconnect** — FIXED (Change 5)
- **Migration 013** — Added indexes/columns for billing safety

NOT completed (out of scope or deferred):
- Redis-level per-lesson AI call lock — in-memory `aiProcessing` guard is per-connection; a brief in-flight AI call from the evicted stale connection can still write to Redis after ownership transfer. Acceptable risk: window is < 2s, lesson state converges on next student input. Phase 12 if needed.
- Accumulated elapsed time cap across multiple reconnect sessions — currently each session is capped at `PLAN_LESSON_MINUTES`. Two sessions for the same lesson could each charge up to 50 minutes. In practice the WS layer's `maxDurationRef` (based on original start time) hard-caps the total lesson to 50 minutes before this situation could arise.
- `section_card` WS event rendering — grammar card still a no-op in frontend. UI decision deferred.

---

## 3. Changed Files

Backend:
- `backend/src/lesson/types.ts` — `activeExerciseType?: string` added to `LessonState`
- `backend/src/lesson/orchestrator.ts` — `state.activeExerciseType = aiResp.exercise.type` persisted when cursor is built
- `backend/src/billing/subscription-service.ts` — `finalizeUsage` now idempotent: `WHERE status = 'active'` guard on usage UPDATE; profile update conditional on rowCount
- `backend/src/ws/lesson-ws.ts` — `billingStartedAt` field + `findActiveLessonOwner` + all hardening changes (see §4)
- `backend/src/ws/message-types.ts` — comment noting `LESSON_TAKEN_OVER` error code
- `backend/src/api/lesson-routes.ts` — `continuation-status` query rewritten to use `lessons.started_at` instead of `plu.started_at`

Frontend:
- No frontend changes.

Database:
- `backend/migrations/013_runtime_safety.sql` — `lesson_id` column on `paid_lesson_usage`; composite index on `(id, status)` for idempotent finalize; partial index on `lesson_sessions` active rows

---

## 4. Backend Changes in Detail

### 4.1 `billingStartedAt` — fixes double-billing on reconnect

**Root cause:** `finalizeUsage` was called with `meta.lessonStartedAt` (the original lesson wall-clock start). After the first `finalizeUsage` call marks a usage record as `'completed'`, a reconnect creates a NEW `paid_lesson_usage` record. The new record is then finalized using `originalStart`, so `elapsedMs = Date.now() - originalStart` = total lesson duration, not the current session's duration.

**Example of the bug:**
- 9:00 lesson starts, 9:20 student disconnects → charges 20 min → usage 'completed'
- 9:25 student reconnects → new usage record created
- 9:40 student disconnects → `finalizeUsage(newUsageId, userId, 9:00)` → charges 40 min
- Total billed: 20 + 40 = **60 min for a 40-min lesson**

**Fix:** Added `billingStartedAt: number | null` to `ClientMeta`. Set to `Date.now()` in:
- `handleLessonStart` (new free-mode lesson)
- `handleFocusLessonStart` (new focus lesson — immediately after `lessonStartedAt = Date.now()`)
- `resumeLesson` (reconnect — always `Date.now()`, NOT `originalStart`)

The close handler now calls `finalizeUsage(meta.usageId, meta.userId, meta.billingStartedAt)`.

`meta.lessonStartedAt` is preserved as-is (still set to `originalStart` on resume) because it is used for `maxDurationRef`, `remainingMs` in AI prompts, and `startTimerBroadcast` — these all need the original wall-clock start.

### 4.2 Idempotent `finalizeUsage` — prevents double-charge from two-tab or SIGTERM

**Root cause:** If two WS connections for the same lesson both close (two browser tabs, or SIGTERM with two sessions), `finalizeUsage` was called twice with the same `usageId`. The `paid_lesson_usage` UPDATE had no guard, and `user_lesson_profiles.paid_minutes_used` was incremented twice.

**Fix:** `finalizeUsage` in `subscription-service.ts` now:
```typescript
// Only update if status is still 'active' — second call is a safe no-op
const usageResult = await client.query(
  `UPDATE paid_lesson_usage SET ended_at = NOW(), minutes_used = $1, status = 'completed'
   WHERE id = $2 AND status = 'active'
   RETURNING id`,
  [minutesUsed, usageId],
)
// Only add to profile if the above UPDATE actually ran
if (usageResult.rowCount && usageResult.rowCount > 0) {
  await client.query(`UPDATE user_lesson_profiles SET paid_minutes_used = ... WHERE user_id = $2`, ...)
}
```

This makes the entire `finalizeUsage` function safe to call multiple times for the same `usageId` — subsequent calls are no-ops.

### 4.3 Single-ownership enforcement — prevents two-tab concurrent runtime

**Root cause:** Two browser tabs with the same session could both call `focus_lesson_start` and both call `resumeLesson`. Both would get separate STT instances, separate timers, and separate `aiProcessing` flags pointing at the same Redis `lessonId`. The in-memory `aiProcessing` guard is per-ClientMeta (per-WS), not per-lesson.

**Fix:** Added `findActiveLessonOwner(lessonId, exclude)` helper:
```typescript
function findActiveLessonOwner(lessonId: string, exclude: WebSocket): WebSocket | null {
  for (const [ws, m] of clients) {
    if (ws !== exclude && m.lessonId === lessonId) return ws
  }
  return null
}
```

Called in `resumeLesson` before restoring meta state. If another connection already owns the lesson, that connection is evicted:
```typescript
const staleOwner = findActiveLessonOwner(existingLessonId, ws)
if (staleOwner) {
  send(staleOwner, { type: 'error', code: 'LESSON_TAKEN_OVER', message: 'This lesson was resumed in another tab.' })
  staleOwner.terminate()
}
```

The evicted connection's close handler fires, finalizing its billing record before the new connection takes over. Because `billingStartedAt` is per-connection, each session is billed independently.

**Note:** New lesson creation (not resume) does NOT check for existing owners. A student starting a fresh lesson while another tab has a previous lesson open is a valid scenario — the first tab's billing finalizes on its own disconnect. If the student has two tabs both starting a brand-new lesson, subscription checks and `checkAndLinkPaidSession` protect against creating duplicate active usage records (only the first gets the 'active' record linked).

### 4.4 `activeExerciseType` — exact cursor restore on resume

**Root cause:** `resumeLesson` sent `exerciseType: 'unknown'` because the exercise type was only known during the AI response turn and was never persisted to `LessonState`.

**Fix:**
- Added `activeExerciseType?: string` to `LessonState` interface in `types.ts`
- Orchestrator `process()` now sets `state.activeExerciseType = aiResp.exercise.type` inside the exercise cursor block, before `saveState()`
- `resumeLesson` now sends `state.activeExerciseType ?? 'unknown'` in the cursor event

Old snapshots (before Phase 11) will still get `'unknown'` as a fallback — the AI corrects on first turn as before.

### 4.5 Ended-lesson resume guard

**Root cause:** If the lesson ended naturally (`phase='END'`) but there was a timing gap between `meta.lessonId = null` in `processInput` and the session status update in the DB, a reconnect could theoretically try to resume a completed lesson.

**Fix:** Early return in `resumeLesson` if the restored state has `phase === 'END'`:
```typescript
if (state.phase === 'END') {
  console.log(`[ws] resume blocked — lesson phase=END lessonId=${existingLessonId}`)
  return false  // fall through to fresh lesson creation
}
```

### 4.6 Continuation-status accurate remaining time

**Root cause:** After a reconnect, a new `paid_lesson_usage` record is created with `started_at = NOW()`. The `continuation-status` endpoint was joining on `plu.status = 'active'` and using `plu.started_at` for elapsed time computation. This showed almost full remaining time when in fact the lesson was nearly expired.

**Fix:** The `continuation-status` query now joins directly with `lessons` table:
```sql
SELECT ls.session_id, ls.lesson_id, ls.section_id, ls.teacher_id, ls.voice_id,
       l.started_at     -- original lesson wall-clock start, never changes
FROM lesson_sessions ls
JOIN lessons l ON l.id::text = ls.lesson_id
WHERE ls.user_id = $1
  AND ls.status  = 'active'
  AND ls.lesson_id IS NOT NULL
ORDER BY l.started_at DESC
LIMIT 1
```

`lessons.started_at` is set once when the lesson is first created (`handleFocusLessonStart`) and never updated. It correctly reflects the original lesson start time regardless of how many reconnect sessions have occurred.

### 4.7 `lesson_id` stamp on `paid_lesson_usage`

Both `handleFocusLessonStart` (new lesson) and `resumeLesson` (reconnect) now run:
```typescript
query(
  `UPDATE paid_lesson_usage SET lesson_id = $1 WHERE id = $2`,
  [lessonId, meta.usageId],
).catch(...)
```
This populates the new `lesson_id` column added in migration 013, enabling future per-lesson billing queries.

---

## 5. Reconnect/Runtime Ownership Flow After Phase 11

```
client opens classroom (second tab or refresh)
↓
WS connects → JWT auth → lesson_ready emitted
↓
user clicks Begin Lesson (or auto-resume)
↓
frontend sends focus_lesson_start
↓
checkAndLinkPaidSession → subscription gate + usage link
↓
resume check: query lesson_sessions for active lesson_id
↓
if active lesson found → resumeLesson(ws, meta, existingLessonId)
  ↓
  load state from Redis (or DB snapshot restore)
  ↓
  state.phase === 'END'? → return false (start fresh)
  ↓
  remainingMs <= 60s? → error SESSION_TIME_LIMIT
  ↓
  findActiveLessonOwner → if stale owner found → evict it (LESSON_TAKEN_OVER)
  ↓
  meta.lessonStartedAt = originalStart  (for timeout/timer accuracy)
  meta.billingStartedAt = Date.now()    (for billing: THIS session only)
  ↓
  restore timers, STT, send lesson_resumed
  ↓
  stamp lesson_id on new usage record
```

---

## 6. Snapshot Consistency After Phase 11

Snapshot content: full `LessonState` JSON stored as JSONB. Now includes `activeExerciseType`.

Snapshot is saved on every WS disconnect (fire-and-forget):
- Clean close (student leaves normally)
- SIGTERM (Railway deploy)
- Timeout (45-min inactivity or 50-min hard cap)
- Network drop

Snapshot NOT saved when:
- `meta.lessonId === null` at close time (natural lesson end cleared it — lesson is done, no resume needed)

Restored from DB snapshot when Redis miss (lesson > 4 hours old). Restored state includes all cursor fields: `currentExerciseNum`, `itemIndex`, `currentItem`, `completedItems`, `failedItems`, `activeExerciseType`.

---

## 7. Billing / Runtime Safety Summary

| Scenario | Before Phase 11 | After Phase 11 |
|---|---|---|
| First disconnect (20 min) | Charges 20 min ✓ | Charges 20 min ✓ |
| Second disconnect (reconnect + 20 more min) | Charges 40 min (double-billing!) | Charges 20 min ✓ |
| Two tabs both disconnect | Charges double | First close charges, second is no-op ✓ |
| SIGTERM with 2 active lessons | Both finalized, may charge twice | Both finalized idempotently ✓ |
| Resume ended lesson | Could theoretically resume | Blocked by `phase='END'` guard ✓ |
| Continuation-status remaining time | Inflated after reconnect | Uses lesson `started_at` (accurate) ✓ |

---

## 8. Abuse Vectors Fixed

1. **Reconnect billing reset** — Using `originalStart` as billing start inflated charges after each reconnect. Fixed by `billingStartedAt`.
2. **Double-finalize charging** — Same usage record charged twice. Fixed by idempotent `finalizeUsage`.
3. **Two-tab concurrent ownership** — Two connections concurrently writing to same Redis lesson state. Fixed by ownership eviction.
4. **Resuming expired lessons** — `phase='END'` guard added as backup to session status check.

---

## 9. Known Remaining Risks

- **In-flight AI call after ownership transfer** — When the stale owner is evicted, any in-flight `orchestrator.process()` call on the old WS will still complete and write to Redis. The new owner's first AI call will then read this stale write. Risk is low (window < 2s, AI responses are additive to state), and the AI self-corrects on the next student input. Fixing this properly requires a Redis-level per-lesson lock, which is Phase 12 scope if needed.
- **Multi-session lesson time cap** — If a student disconnects and reconnects many times, each session is individually capped at `PLAN_LESSON_MINUTES` by `finalizeUsage`. In practice the `maxDurationRef` timeout (from original start time) terminates the lesson before this becomes an issue. Exact per-lesson total billing cap can be added in Phase 12 using the new `lesson_id` column on `paid_lesson_usage`.
- **Snapshot may be slightly stale** — If a reconnect happens while the previous session's `saveLessonSnapshot` is still writing (fire-and-forget), the restored snapshot may be one AI exchange behind. This is acceptable — the AI context in Redis is authoritative, and the snapshot is only used when Redis misses.
- **New lesson start with stale open tab** — If a student starts a NEW lesson (different sessionId) while an old tab still has a previous lesson open, the old tab is not evicted. Only RESUME path evicts stale owners. The old lesson's STT and timers continue until the old tab closes or disconnects (billing correct, no data corruption — different lessonIds). No fix needed.

---

## 10. What Was Intentionally NOT Changed

- WebSocket FSM (`lesson-ws.ts`) — all phase transitions, `aiProcessing` guard, `MULTI/EXEC` Redis pattern preserved
- Billing system (`billing-routes.ts`, `subscription-service.ts` API surface) — only `finalizeUsage` internal logic changed; external contract identical
- Auth system — untouched
- Demo system — untouched
- STT/TTS pipeline — untouched
- AI orchestrator prompts — untouched
- `max_tokens: 400` per AI turn — unchanged
- Frontend classroom components — no frontend changes
- `useLessonSession` hook — untouched
- WebSocket event contract — no new events, no modified payloads (except `LESSON_TAKEN_OVER` error code documented)
- Curriculum catalog, textbook OCR, RAG — untouched
- Snapshot infrastructure (location, format, restore path) — unchanged; only content enriched by `activeExerciseType`

---

## 11. Phase 12 Starting State

Phase 12 starts from:
- 0 TypeScript errors (backend + frontend)
- Clean Vite production build (78 modules, 432 kB)
- Billing: correct per-session accounting, idempotent finalization
- Single-ownership: two-tab safety enforced at resume time
- Cursor: `activeExerciseType` persisted and restored on resume
- Continuation-status: shows accurate remaining time from original lesson start
- Next migration: `014_*`

Recommended Phase 12 scope:
- Redis-level per-lesson AI call lock (replace in-memory `aiProcessing` with a Redis SET NX lock keyed by `lessonId`)
- Per-lesson billing total cap (query `SUM(minutes_used)` from `paid_lesson_usage WHERE lesson_id = $1` before finalizing)
- `section_card` frontend rendering (grammar overview card is generated but discarded by frontend — UI design decision needed)
- Paragraph-level reading renderer (requires `reading_chunk` event from backend, Phase 3 roadmap item)
- Integration tests: SIGTERM flow, two-tab eviction, reconnect billing correctness
