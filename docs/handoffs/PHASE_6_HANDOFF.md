# PHASE 6 COMPLETE

## 1. Summary

Phase 6 implemented **Resume, Continuation & Reflection** — making paid lessons persistent across sessions, giving the AI real lesson performance data for reflection, and preventing abrupt timeout cutoffs.

Before Phase 6: resume worked but had a critical bug that made the AI always think a full 50 minutes remained after reconnect; lesson state was lost after 4 hours (Redis TTL); the lesson_end summary showed zeroes for exercise and vocabulary counts; WRAP_UP AI context was generic (no actual lesson data); there was no warning before the 50-minute hard cutoff; and no backend API for the frontend to determine continuation status.

After Phase 6: the resume bug is fixed so the AI correctly tracks remaining time on reconnect; lesson state is now double-persisted (Redis + PostgreSQL snapshots) and survives beyond 4 hours; the lesson_end summary shows real exercise and vocabulary counts; the WRAP_UP AI prompt includes actual errors, completed exercises, and vocabulary from the session; a 5-minute pre-timeout warning event is sent to the frontend; and a new REST endpoint allows the frontend to determine whether the student can continue an active lesson or must start a new one.

## 2. Goals Completed

Completed:
- Fixed critical `meta.lessonStartedAt` resume bug — AI time-awareness now correct after reconnect
- `lesson_snapshots` PostgreSQL table (migration 012) — state survives beyond 4-hour Redis TTL
- `saveLessonSnapshot()` called on every WS disconnect — automatic persistence
- `restoreSnapshotToRedis()` called in `resumeLesson()` on Redis miss — seamless restore within 24h
- 5-minute pre-timeout warning (`lesson_time_warning` WS event + frontend banner)
- Fixed `lesson_end` summary — real `exerciseScore` and `vocabularyCount` from LessonState
- WRAP_UP reflection context — real errors, completed exercises, vocabulary injected into AI prompt
- `GET /api/lesson/continuation-status` REST endpoint — canContinue/canStartNew/remainingMinutes
- Frontend `lesson_time_warning` handler — amber banner with remaining minutes
- Improved `PaidLessonCompleteModal` — shows real duration, correct answers, vocabulary stats

NOT completed (moved to Phase 7 or future):
- Learning page "Continue" / "Start New" buttons — API is ready, frontend UI not wired (Phase 7)
- Paragraph completion flow (PARAGRAPH_COMPLETE FSM state) — requires Phase 2 state machine work
- Pronunciation tip triggers — noted in Phase 5 as future work

## 3. Changed Files

Backend:
- `backend/src/lesson/types.ts` — added `exerciseScore` and `vocabularyCount` to `OrchestratorResult`
- `backend/src/lesson/orchestrator.ts` — returns real `exerciseScore` and `vocabularyCount` when `ended=true`
- `backend/src/ws/message-types.ts` — added `OutboundLessonTimeWarning`; added to `OutboundMessage` union
- `backend/src/ws/lesson-ws.ts` — added `warningRef` to `ClientMeta`; added `saveLessonSnapshot()` and `restoreSnapshotToRedis()` helpers; fixed `meta.lessonStartedAt` bug in `resumeLesson()`; added 5-min warning timer in `resumeLesson()`, `handleFocusLessonStart()`, `handleLessonStart()`; updated `lesson_end` summary to use real stats; snapshot saved on WS close
- `backend/src/api/lesson-routes.ts` — added `GET /lesson/continuation-status` endpoint

Backend AI:
- `backend/src/ai/prompt-builder.ts` — added WRAP_UP reflection data block to `buildTeacherAgendaContext()`

Database:
- `backend/migrations/012_lesson_snapshots.sql` — new `lesson_snapshots` table with two indexes

Frontend:
- `frontend/src/features/classroom/services/classroomSocket.ts` — added `lesson_time_warning` to `BackendMessage` union
- `frontend/src/features/classroom/components/ClassroomLayout.tsx` — added `lessonTimeWarning` state; handler for `lesson_time_warning`; updated `lesson_end` handler to pass real stats; amber warning banner; improved `PaidLessonCompleteModal` with real stats

## 4. Backend Changes

**Critical resume bug fix:**
In `resumeLesson()`, `meta.lessonStartedAt` was previously set to `Date.now()`. This caused `processInput()` to calculate remaining time as `MAX_LESSON_MS - (Date.now() - Date.now()) = MAX_LESSON_MS` — always 50 minutes — on every reconnect, defeating Phase 4's time-aware AI prompting. Fixed to `meta.lessonStartedAt = new Date(state.startedAt).getTime()` — the original lesson start time stored in Redis/DB snapshot.

**Snapshot persistence (`lesson_snapshots`):**
`saveLessonSnapshot()` reads the current Redis LessonState and inserts it as JSONB into `lesson_snapshots`. Called fire-and-forget in the WS `close` handler before `finalizeUsage()`. This runs on every disconnect: graceful leave, tab close, 50-min timeout, network drop.

`restoreSnapshotToRedis()` queries the most recent snapshot within 24 hours for a given `lesson_id`. If found, writes it back to Redis with a fresh 4-hour TTL. Called in `resumeLesson()` when Redis returns null — enabling seamless resume even if 4+ hours have passed.

**5-minute warning:**
Added `warningRef: ReturnType<typeof setTimeout> | null` to `ClientMeta`. A `setTimeout` fires `remainingMs - 5*60_000` milliseconds after lesson start, emitting `{ type: 'lesson_time_warning', remainingMs: 300000 }`. The timer is set in all three lesson-start paths: `resumeLesson()`, `handleFocusLessonStart()`, `handleLessonStart()`. Cleared in the WS `close` handler.

**Fixed `lesson_end` summary:**
`OrchestratorResult` now includes `exerciseScore` and `vocabularyCount` populated from `state.exerciseCount` and `state.vocabularyTaught.length` when `ended=true`. Previously hardcoded to 0 in `processInput()`.

**Continuation-status endpoint:**
`GET /api/lesson/continuation-status` (auth required). Checks `lesson_sessions` for an `active` row joined with `paid_lesson_usage`. Calculates remaining milliseconds from `started_at`. Returns `{ canContinue, canStartNew, activeSessionId, activeSectionId, remainingMinutes, lastCompletedSection, subscriptionMinutesRemaining }`. Frontend uses this to determine what to show the student — backend independently validates on every WS connection.

**WRAP_UP reflection context:**
`buildTeacherAgendaContext()` now appends a `LESSON REFLECTION DATA` block when `state.phase === 'WRAP_UP'`. Contains: exercises completed count, specific error details (up to 3 most recent: student answer → correct answer + error type), vocabulary covered. Instructs the AI to reference actual results instead of generic praise, and keep the wrap-up under 60 seconds.

## 5. Frontend Changes

**`lesson_time_warning` handling:**
New `lessonTimeWarning: number | null` state. When the event arrives, it's set to `Math.floor(msg.remainingMs / 60_000)`. An amber banner renders fixed at top-center while the lesson is active and the lesson hasn't ended. Shows "X minutes remaining in this lesson."

**Improved `PaidLessonCompleteModal`:**
Now accepts `exerciseScore` and `vocabularyCount` props. Shows a three-stat row: duration in minutes, correct answers (if > 0), vocabulary items (if > 0). Each stat has a colored background card. Text changed to "Your progress has been saved. You can continue your course in the next lesson."

**`lesson_end` handler:**
Now passes real `msg.summary.exerciseScore` and `msg.summary.vocabularyCount` to `setPaidLessonSummary()`.

## 6. Database Changes

Migration `012_lesson_snapshots.sql`:
```sql
CREATE TABLE IF NOT EXISTS lesson_snapshots (
  id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id  VARCHAR(255) NOT NULL,
  session_id VARCHAR(255),
  student_id UUID         NOT NULL,
  snapshot   JSONB        NOT NULL,
  created_at TIMESTAMP    NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_snapshots_student ON lesson_snapshots(student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_snapshots_lesson  ON lesson_snapshots(lesson_id,  created_at DESC);
```

Note: Uses `VARCHAR(255)` for `lesson_id` to match the pattern in `lesson_sessions`. `student_id` is `UUID` matching the `students` table. No foreign keys — snapshots are append-only audit/recovery records, not transactional data.

## 7. Runtime Behavior Changes

**Before:**
- Reconnecting after 10 minutes: AI thinks 50 minutes remain (lessonStartedAt bug)
- Reconnecting after 4 hours: lesson state lost, forced to start fresh
- Lesson ends: summary shows "0 correct answers, 0 vocabulary" regardless of performance
- WRAP_UP AI says generic summary: "You did great today!"
- 50-minute timeout: abrupt error message, no warning
- No way for frontend to know if student can continue or must start new

**After:**
- Reconnecting after 10 minutes: AI correctly shows "~40 minutes remaining"
- Reconnecting after 4 hours (within 24h): lesson restored from DB snapshot, resumes normally
- Lesson ends: summary shows real counts (e.g., "18 correct answers, 5 vocabulary")
- WRAP_UP AI references specific mistakes: "You struggled with 'doesn't' vs 'don't' for he/she. Focus on that."
- 5 minutes before timeout: amber banner appears — student sees the warning, teacher AI gets context
- `/api/lesson/continuation-status` returns exact remaining minutes and section info

## 8. WebSocket/Event Changes

Added:
- `lesson_time_warning` — `{ type: 'lesson_time_warning', remainingMs: number }` — sent once, 5 minutes before the 50-minute hard cap. Frontend shows amber banner. No corresponding inbound event.

Modified: none.
Removed: none.

## 9. AI/Prompt Changes

**`buildTeacherAgendaContext()` — WRAP_UP extension:**
When `state.phase === 'WRAP_UP'`, a `LESSON REFLECTION DATA` block is appended containing:
- Total exercises completed this session
- Specific error records: student answer → correct answer + error type (last 3)
- Vocabulary items taught

Instruction to AI: "Reference the above actual results — not generic praise. Name 1-2 specific errors if any. Assign section workbook homework. Keep it under 60 seconds."

This makes the WRAP_UP teacher response grounded in real session data instead of AI-generated generic summaries.

Token budget: ~50–150 additional tokens in WRAP_UP phase only. No impact on other phases. Well within the 4000-token prompt cap.

## 10. Cost Impact

Cost impact:
- AI calls: no change — zero new AI calls added
- STT/TTS: no change
- DB: +1 INSERT per WS disconnect (snapshot save); +1 SELECT per resume attempt (snapshot check); +1 SELECT per `/continuation-status` call. All negligible.
- Prompt tokens: +50-150 tokens in WRAP_UP phase only (~1-2 AI turns at end of lesson)
- No meaningful cost increase

## 11. Tests Performed

Tested:
- `backend: tsc --noEmit` — passes clean (0 errors)
- `frontend: tsc --noEmit` — passes clean (0 errors)
- `backend: npm run build` — passes clean (0 errors)
- Code inspection: `meta.lessonStartedAt` fix verified in `resumeLesson()` — now uses `new Date(state.startedAt).getTime()`
- Code inspection: `lesson_end` summary now reads from `result.exerciseScore`/`result.vocabularyCount` (not hardcoded 0)
- Code inspection: snapshot helpers use JSONB parameter correctly (`$4::jsonb`)
- Code inspection: `warningRef` cleared in close handler alongside other timers

Not tested (requires running backend + DB):
- Actual snapshot save/restore round-trip with PostgreSQL JSONB
- `lesson_time_warning` delivery at 45-minute mark
- `/api/lesson/continuation-status` response with real data
- WRAP_UP AI response content with injected reflection data
- Real lesson resume after Redis TTL expiry

## 12. Known Remaining Issues

Remaining issues:
- **Learning page UI**: The `/api/lesson/continuation-status` endpoint is ready but the Learning page doesn't yet use it to show "Continue lesson" vs "Start new" buttons. This is Phase 7 scope.
- **Paragraph completion flow**: PARAGRAPH_COMPLETE state and next-paragraph continuation require the Phase 2 FSM refactor. Currently when exercises are done, the lesson goes to WRAP_UP → END. No mid-lesson paragraph transition exists.
- **Snapshot accumulation**: Snapshots are append-only. There is no cleanup job to delete old snapshots. After months of usage, the table will grow. A periodic DELETE WHERE created_at < NOW() - INTERVAL '7 days' job should be added in Phase 8.
- **24-hour snapshot window**: Snapshots older than 24 hours are ignored on restore. If a student returns after 25+ hours to continue an in-progress lesson, they must start fresh. This is an intentional conservative design decision.
- **Pronunciation tips**: Still no trigger for pronunciation errors (noted in Phase 5 handoff). No change in Phase 6.
- **Warning banner dismiss**: The `lessonTimeWarning` state is never cleared — the banner shows indefinitely once triggered. Acceptable for now; could auto-dismiss after 30s in a later phase.

## 13. What Was Intentionally NOT Changed

Intentionally NOT changed:
- Demo lesson runtime (`useDemoSession`, `DemoStepCenter`) — Phase 6 is paid-mode only
- Billing system (LiqPay, subscription gate) — GUARDRAIL 8
- Auth system — GUARDRAIL 9
- Redis TTL (4 hours) — snapshots extend persistence without changing Redis behavior
- Lesson FSM phases (DIAGNOSTIC → END) — Phase 2 refactor still pending
- `max_tokens: 400` per AI turn — per `ai-prompts.md` rules
- AI response JSON format (speech/display_text/next_action/exercise/internal_note)
- Voice system (STT/Deepgram, TTS/ElevenLabs)
- WebSocket lifecycle (no new inbound events)
- `student_tips` table schema (next migration would be 013)
- `lesson_sessions` table — continuation-status reads it, does not modify schema

## 14. Risks Introduced

New risks:
- **Snapshot save on crash**: If the Railway process receives SIGKILL, the WS `close` handler may not fire and `saveLessonSnapshot()` won't run. Same limitation as `finalizeUsage()` noted in Phase 0. The last Redis state is the ground truth; snapshot is a best-effort backup.
- **JSONB size**: LessonState is typically <2KB serialized. However if `errorsThisLesson` or `vocabularyTaught` grows very large (capped at 10 errors), snapshot size could reach 5-10KB per row. Negligible for PostgreSQL JSONB; acceptable.
- **`continuation-status` race**: If the student opens two browser tabs simultaneously, both could see `canContinue=true` and both send `focus_lesson_start`. The existing `meta.lessonId` guard in `handleFocusLessonStart()` prevents duplicate lesson creation for the same WS connection, but two separate WS connections could both attempt to resume the same lesson. This is a pre-existing gap — Phase 6 doesn't worsen it.

## 15. Deployment Notes

Before deploying Phase 6 to Railway:

1. **Run migration**: `psql $DATABASE_URL -f backend/migrations/012_lesson_snapshots.sql`
2. **Restart backend service** on Railway to pick up new compiled code
3. **No new environment variables** required
4. **No Redis key schema changes** — existing lesson states are compatible
5. The `lesson_sessions.section_id` column is used by the new continuation-status endpoint — it was inserted by the existing `/lesson/start` route; no schema change needed

## 16. Recommended Next Phase

Recommended next phase:
Phase 7 — Curriculum Completion & Focus 2 Scaling

Phase 6 establishes the persistence and reflection foundation. Phase 7 should:
1. Wire the Learning page to the `/api/lesson/continuation-status` endpoint — show "Continue" / "Start New" buttons
2. Expand Focus 2 section coverage (all units, all sections)
3. Validate all exercise type rendering
4. Add the PARAGRAPH_COMPLETE FSM state and next-paragraph continuation flow

## 17. Next Claude Session Instructions

Next Claude session should:
- Read `docs/PAID_LESSON_RUNTIME_ROADMAP.md` first
- Read `docs/handoffs/PHASE_6_HANDOFF.md` (this document)
- Read `docs/RUNTIME_GUARDRAILS.md`
- Read `docs/WEBSOCKET_EVENT_CONTRACT.md` — now includes `lesson_time_warning`
- Inspect `backend/src/ws/lesson-ws.ts` — understand `saveLessonSnapshot()` and `restoreSnapshotToRedis()` before touching resume logic
- Inspect `backend/src/api/lesson-routes.ts` — the `continuation-status` endpoint is the entry point for Learning page wiring
- Inspect `backend/migrations/012_lesson_snapshots.sql` before adding any new snapshot logic (next migration would be 013)

DO NOT:
- Change `meta.lessonStartedAt = new Date(state.startedAt).getTime()` in `resumeLesson()` — this is the Phase 6 bug fix; reverting it breaks time-awareness
- Delete or modify the `lesson_snapshots` table schema without writing migration 013
- Increase `max_tokens` above 400 per AI turn
- Add billing or LiqPay logic as part of Phase 7
- Rebuild the WebSocket runtime from scratch
- Touch the demo lesson flow

Continue from Phase 7 ONLY. Do not revisit Phase 6 unless a bug report requires it.
