# PHASE 2 RECOVERY AUDIT — COMPLETE

## 1. Summary

Phase 2 (Lesson State Machine & Runtime Container) was never implemented as a formal phase.
Phases 3–6 were implemented directly on top of the Phase 1 foundation, delivering much of what
Phase 2 required in practice.

This recovery audit:
1. Inspected all Phase 2 requirements against the current codebase (Phases 3–6).
2. Determined which requirements are already satisfied by later phases.
3. Identified genuine gaps — both large architectural and small.
4. Patched the one safe, small gap: the `lesson_timer_update` periodic WS event.
5. Documented large architectural gaps as remaining issues for Phase 7+.

The classroom is NOT regressed. Phase 3–6 implementations are fully preserved.

## 2. Goals Completed

Completed:
- Full audit of all Phase 2 requirements against Phase 3–6 codebase
- `lesson_timer_update` WS event implemented (backend: 60s interval; frontend: header chip)
- Backend typecheck: `tsc --noEmit` — zero errors after patch
- Frontend typecheck: `tsc --noEmit` — zero errors after patch
- Full handoff document written

NOT completed (large architectural gaps — intentionally not implemented to avoid regressing Phase 3–6):
- New 11-state FSM (LESSON_READY, INTRO, TOPIC_INTERACTIVE, EXERCISE_INTRO, EXERCISE_ACTIVE,
  READING_ACTIVE, SIDE_QUESTION, REFLECTION, PARAGRAPH_COMPLETE, LESSON_COMPLETE, PAUSED)
- `lesson_state_changed` WS event (requires new FSM)
- `lesson_paused` WS event (requires new FSM)
- Current paragraph tracking (requires new FSM + new DB fields)

## 3. Changed Files

Backend:
- `backend/src/ws/message-types.ts` — added `OutboundLessonTimerUpdate` interface; added to `OutboundMessage` union
- `backend/src/ws/lesson-ws.ts` — added `timerUpdateRef` to `ClientMeta`; added `startTimerBroadcast()` helper; called in `handleLessonStart()`, `handleFocusLessonStart()`, `resumeLesson()`; cleared in WS close handler

Frontend:
- `frontend/src/features/classroom/services/classroomSocket.ts` — added `lesson_timer_update` to `BackendMessage` union
- `frontend/src/features/classroom/components/ClassroomLayout.tsx` — added `lessonRemainingMin` state; handles `lesson_timer_update`; passes `remainingMin` prop to `ClassroomHeader`
- `frontend/src/features/classroom/components/ClassroomHeader.tsx` — added `remainingMin?: number | null` prop; renders a small time chip in the header right section (purple when >5 min, amber when ≤5 min)

Database:
- No database changes.

Docs:
- `docs/handoffs/PHASE_2_RECOVERY_HANDOFF.md` — this file

## 4. Phase 2 Requirements — Full Audit Matrix

### SATISFIED BY LATER PHASES (do not re-implement)

| Requirement | Phase | Evidence |
|-------------|-------|----------|
| 50-minute hard limit | Phase 0 + Phase 6 | `maxDurationRef` → `SESSION_TIME_LIMIT` + WS 4408 close |
| Backend timer ownership | Phase 6 | `meta.lessonStartedAt = originalStart` (not Date.now()) in `resumeLesson()` |
| State persistence | Phase 6 | Redis (4h TTL) + PostgreSQL `lesson_snapshots` (24h window) |
| Reconnect-safe runtime | Phase 6 | `resumeLesson()` with `restoreSnapshotToRedis()` fallback |
| Teacher agenda awareness | Phase 4 | `buildTeacherAgendaContext()` — exercise position, return anchor, recent errors |
| Side-question return target | Phase 4 | `SIDE_QUESTION_RECOVERY_PROTOCOL` — 1-turn limit + mandatory return anchor |
| Time-aware teacher behavior | Phase 4 | ≤8 min / ≤3 min AI prompt warnings in `buildTeacherAgendaContext()` |
| Current exercise tracked | Phase 3 | Item-level cursor: `currentExerciseNum`, `itemIndex`, `currentItem`, `completedItems`, `failedItems` |
| Runtime state saved at timeout | Phase 6 | `saveLessonSnapshot()` called in WS close handler |
| Lesson finalizes cleanly at timeout | Phase 0 | `lesson_end` on AI end; hard cap → `SESSION_TIME_LIMIT` + 4408 |
| Frontend exercise rendering | Phase 3 | `PaidExerciseCard` driven by `exercise_cursor_updated` |
| Time warning at 5 min (frontend) | Phase 6 | `lesson_time_warning` → amber banner in `ClassroomLayout` |
| Lesson end summary (real stats) | Phase 6 | `lesson_end.summary.exerciseScore` + `vocabularyCount` from LessonState |
| No AI drifting between exercises | Phase 3 + 4 | Cursor enforcement + `SIDE_QUESTION_RECOVERY_PROTOCOL` |
| Lesson progression structured | Phase 3 + 4 | Cursor + agenda context = teacher always knows current position |

### PATCHED IN THIS SESSION

| Requirement | Gap Type | Patch Applied |
|-------------|----------|---------------|
| `lesson_timer_update` WS event | Small gap | Added 60-second broadcast; frontend shows remaining minutes in header |

### LARGE ARCHITECTURAL GAPS — NOT IMPLEMENTED (document only)

| Gap | Reason Not Implemented | Risk If Implemented |
|-----|----------------------|-------------------|
| New 11-state FSM | Would break Phase 3 cursor tracking, Phase 4 prompt builder, Phase 5 tips, Phase 6 snapshot/reflection. The old 7-phase FSM (DIAGNOSTIC→END) is deeply coupled to all later phases. | HIGH — regression risk across Phase 3–6 |
| `lesson_state_changed` WS event | Meaningless without the new FSM. The existing `phase_change` event covers old FSM transitions. | N/A — depends on new FSM |
| `lesson_paused` WS event | No explicit PAUSED state in FSM. Disconnect serves as the de-facto pause mechanism (snapshot preserves state). | N/A — depends on new FSM |
| Current paragraph tracking | Requires new `PARAGRAPH_COMPLETE` FSM state + new LessonState fields (`paragraphIndex`) + new DB column. Not implementable without FSM rewrite. | HIGH — requires FSM change |
| Explicit PAUSED LessonState value | `LessonPhase` type would need `'PAUSED'` added; all FSM logic would need PAUSED transitions. | HIGH — requires full FSM audit |

## 5. Backend Changes

**`message-types.ts`:**
Added `OutboundLessonTimerUpdate` interface:
```typescript
interface OutboundLessonTimerUpdate {
  type:        'lesson_timer_update'
  remainingMs: number
}
```
Added to `OutboundMessage` union. Type is `lesson_timer_update` (underscore, not hyphen, to distinguish from `lesson_time_warning`).

**`lesson-ws.ts`:**
- Added `timerUpdateRef: ReturnType<typeof setInterval> | null` to `ClientMeta` interface.
- Added `startTimerBroadcast(ws, meta)` function: sends `lesson_timer_update` immediately on call (with current remaining time), then every 60 seconds. Stops automatically when remaining ≤ 0. Uses `meta.lessonStartedAt` as the authoritative clock anchor — same as the `processInput()` remaining time calculation.
- Called `startTimerBroadcast(ws, meta)` in:
  - `handleLessonStart()` — after STT setup, before greeting TTS
  - `handleFocusLessonStart()` — after STT setup, before greeting TTS
  - `resumeLesson()` — after `meta.lessonStartedAt = originalStart`, before STT setup (so the initial broadcast uses the correct restored start time)
- Cleared `meta.timerUpdateRef` in the WS `close` handler alongside existing `warningRef` and `maxDurationRef`.

## 6. Frontend Changes

**`classroomSocket.ts`:**
Added `{ type: 'lesson_timer_update'; remainingMs: number }` to `BackendMessage` discriminated union.

**`ClassroomLayout.tsx`:**
- Added `lessonRemainingMin: number | null` state (initialized null).
- Added `lesson_timer_update` case in WS message handler: `setLessonRemainingMin(Math.ceil(msg.remainingMs / 60_000))`. Uses `Math.ceil` so "0.5 minutes" shows as "1 min" rather than "0 min".
- Passes `remainingMin={isDemoMode ? undefined : (lessonStarted ? lessonRemainingMin : undefined)}` to `ClassroomHeader`. Only shown after lesson has started (not during the "Begin Lesson" waiting state).

**`ClassroomHeader.tsx`:**
- Added `remainingMin?: number | null` prop.
- Renders a small time chip in the right section of the header (before the teacher chip) when:
  - `!isDemo` (paid mode only)
  - `remainingMin !== null && remainingMin !== undefined`
- Chip styling: purple (`#6E7CFB`) when > 5 minutes remaining; amber (`#d97706`) when ≤ 5 minutes (matches the existing `lesson_time_warning` amber banner color for visual consistency). Shows `⏱ X min`.

## 7. Runtime Behavior Changes

Before:
- Student had no visibility into remaining lesson time during the lesson.
- The only time signal was the one-shot amber banner at exactly 5 minutes remaining.
- Frontend had no running sense of how long the lesson had been going.

After:
- When lesson starts, backend immediately sends `lesson_timer_update` with full remaining time (e.g., "⏱ 50 min").
- Every 60 seconds, the remaining time updates in the header (e.g., "⏱ 37 min").
- At 5 minutes, the chip turns amber ("⏱ 5 min") — consistent with the 5-min warning banner.
- Student always knows how much time is left without a stressful full countdown.
- On reconnect, the timer restores correctly because it uses `meta.lessonStartedAt` (the Phase 6 bug-fixed original start time).

## 8. WebSocket/Event Changes

Added:
- `lesson_timer_update` — `{ type: 'lesson_timer_update', remainingMs: number }` — sent once immediately after lesson start, then every 60 seconds. `remainingMs` is computed as `MAX_LESSON_MS - (Date.now() - meta.lessonStartedAt)`. Stops when remaining ≤ 0.

Not modified: `lesson_time_warning` (one-shot at 5 min) is unchanged and still fires alongside.
Not removed: any existing events.

`docs/WEBSOCKET_EVENT_CONTRACT.md` now reflects this event as implemented (it was listed as "Planned for Phase 2").

## 9. AI/Prompt Changes

No AI/prompt changes. The `lesson_timer_update` event carries no information to the AI — remaining time is already injected into the AI system prompt via `buildTeacherAgendaContext()` (Phase 4).

## 10. Cost Impact

Cost impact:
- No new AI calls.
- No new STT/TTS usage.
- `lesson_timer_update` is a tiny JSON event (~40 bytes) sent every 60 seconds. At a 50-minute lesson, that's 50 events per lesson — negligible.
- No meaningful cost impact.

## 11. Tests Performed

Tested:
- `backend: tsc --noEmit` — zero errors after all changes
- `frontend: tsc --noEmit` — zero errors after all changes
- Code path inspection: `startTimerBroadcast()` correctly uses `meta.lessonStartedAt` (which is set before the function call in all 3 paths)
- Code path inspection: `timerUpdateRef` cleared in WS close handler — no interval leak
- Code path inspection: `Math.ceil(remainingMs / 60_000)` prevents showing "0 min" when < 1 min remains
- Code path inspection: timer chip only appears when `lessonStarted === true` — no display during "Begin Lesson" wait

Not tested (no live backend in this session):
- End-to-end: lesson start → `lesson_timer_update` arrives in frontend → header chip shows
- Reconnect scenario: timer resumes from correct remaining time after reconnect
- Visual appearance of the time chip in the browser

## 12. Known Remaining Issues

**Large architectural gaps (requires Phase 7+ planning):**

1. **New 11-state FSM not implemented** (HIGH severity): The Phase 2 roadmap required a completely new lesson state machine to replace the old 7-phase model. This was not implemented. The old FSM (DIAGNOSTIC → CONTEXT_INPUT → RULE_DISCOVERY → EXERCISES → VOCABULARY → DEEP_THINKING → WRAP_UP → END) is still the runtime model. The functional requirements of Phase 2 (exercise tracking, agenda awareness, time management, side-question recovery) are all met through Phase 3–6 additions ON TOP of the old FSM — but the FSM itself was not replaced.

2. **`PARAGRAPH_COMPLETE` state not implemented** (MEDIUM severity): The continuation flow (paragraph complete → offer next paragraph) was noted as remaining work in Phase 6 handoff. Requires the new FSM.

3. **`lesson_state_changed` WS event not implemented** (LOW severity): Meaningless without the new FSM. The `phase_change` event covers old FSM transitions adequately.

4. **`lesson_paused` WS event not implemented** (LOW severity): No explicit paused state in the FSM. Disconnect + snapshot is the effective pause mechanism.

5. **Current paragraph tracking not implemented** (MEDIUM severity): `focusLesson` (e.g., "1.2") tracks the section but not the paragraph index within that section. Required for `PARAGRAPH_COMPLETE` flow.

6. **Warning banner dismiss** (LOW severity, from Phase 6): The `lessonTimeWarning` amber banner never dismisses automatically. The new `lessonRemainingMin` chip in the header provides a less intrusive alternative — students can see remaining time at any time without a persistent banner.

## 13. What Was Intentionally NOT Changed

Intentionally NOT changed:
- **Old 7-phase FSM** (`types.ts` `LessonPhase` type, `transitions.ts`, `orchestrator.ts`) — the new 11-state machine was not implemented; risk of breaking Phase 3–6 is too high
- **Phase 3 exercise cursor architecture** — `ExerciseCursor`, `exercise_cursor_updated` event, `PaidExerciseCard` untouched
- **Phase 4 teacher agenda prompt layer** — `buildTeacherAgendaContext()`, `SIDE_QUESTION_RECOVERY_PROTOCOL`, `MICRO_TIP_GUIDANCE`, `READING_ASSISTANCE_PROTOCOL` untouched
- **Phase 5 tips/memory infrastructure** — `tips-service.ts`, `TipsDrawer`, `tip_list`, `tip_added` events untouched
- **Phase 6 snapshots/continuation/reflection systems** — `saveLessonSnapshot()`, `restoreSnapshotToRedis()`, `lesson_time_warning`, `continuation-status` endpoint, `lesson_snapshots` table untouched
- **Billing architecture** — LiqPay, subscriptions, `finalizeUsage()`, `paid_lesson_usage` table untouched
- **Auth system** — JWT, AuthContext untouched
- **Demo lesson runtime** — `useDemoSession`, `DemoStepCenter`, `demo-routes.ts` untouched
- **Redis TTL pattern** — all keys still use `LESSON_TTL` (4h)
- **Claude model ID** (`claude-sonnet-4-6`) — unchanged
- **Max tokens (400)** — unchanged per `ai-prompts.md` rules
- **`phase_change` WS event** — still covers old FSM transitions

## 14. Risks Introduced

New risks:
- **`timerUpdateRef` interval on crash**: If the Railway process receives SIGKILL mid-interval, the interval is not cleared. This is the same limitation as `finalizeUsage()` and `saveLessonSnapshot()` (all noted in Phase 0 and Phase 6 as acceptable). The interval lives only in-process memory — no resource leak beyond the process lifetime.
- **Timer accuracy**: The 60-second interval is a `setInterval`, which can drift slightly under heavy load. The chip shows `Math.ceil(remainingMs / 60_000)` which rounds up — students see a value ≥ actual remaining. Acceptable (conservative, not alarming).
- **Two time displays**: The header chip and the Phase 6 amber banner can co-exist when ≤5 min remain. The chip shows "⏱ 5 min" (amber) while the banner shows "5 minutes remaining in this lesson." Slightly redundant but not conflicting. Phase 7 could remove the banner if the chip is sufficient.

## 15. Deployment Notes

No new environment variables required.
No database migrations required.
No Redis key schema changes.

Requires Railway redeploy of:
- Backend (lesson-ws.ts, message-types.ts changed)
- Frontend (classroomSocket.ts, ClassroomLayout.tsx, ClassroomHeader.tsx changed)

Standard Railway deploy (push to main) is sufficient.

## 16. Recommended Next Phase

Recommended next phase:
Phase 7 — Curriculum Completion & Focus 2 Scaling

The Phase 7 roadmap task is:
1. Wire the Learning page to `/api/lesson/continuation-status` — show "Continue" / "Start New" buttons
2. Expand Focus 2 section coverage (all units, all sections)
3. Validate all exercise type rendering
4. Add the `PARAGRAPH_COMPLETE` flow (which also requires deciding what to do about the FSM)

**Regarding the FSM gap**: Phase 7 should decide whether to implement the new 11-state FSM or to formally accept the current 7-phase model as "good enough" for production. Given that Phases 3–6 deliver all the functional requirements of Phase 2 without the new FSM, the argument for a risky rewrite is weak. Phase 7 planning should explicitly make this decision.

## 17. Next Claude Session Instructions

Next Claude session should:
- Read `docs/PAID_LESSON_RUNTIME_ROADMAP.md` first
- Read `docs/handoffs/PHASE_2_RECOVERY_HANDOFF.md` (this document) for audit context
- Read `docs/handoffs/PHASE_6_HANDOFF.md` for the most recent implementation state
- Read `docs/RUNTIME_GUARDRAILS.md` — next migration must be 013_*.sql
- Inspect `backend/src/ws/lesson-ws.ts` before touching any lesson start paths (3 functions need to stay in sync: `handleLessonStart`, `handleFocusLessonStart`, `resumeLesson`)
- Inspect `backend/src/api/lesson-routes.ts` — the `continuation-status` endpoint is the Phase 7 entry point

Continue from Phase 7 ONLY.

DO NOT:
- Rewrite the old 7-phase FSM (`transitions.ts`) without a full Phase 7 plan — it would break Phase 3–6
- Add new `LessonPhase` enum values without auditing all code that switches on `state.phase`
- Remove the `timerUpdateRef` interval clearing from the WS close handler — interval leak
- Change `meta.lessonStartedAt = originalStart` in `resumeLesson()` — this is the Phase 6 bug fix
- Remove `buildTeacherAgendaContext()` — it's the Phase 4 agenda system
- Remove `SIDE_QUESTION_RECOVERY_PROTOCOL` — it's the Phase 4 return-to-lesson mechanism
- Touch billing, LiqPay, auth, or demo lesson systems
- Increase `max_tokens` above 400 per AI turn
- Change the Claude model ID from `claude-sonnet-4-6`
