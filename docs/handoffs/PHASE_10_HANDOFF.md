# PHASE 10 COMPLETE — EXERCISE RENDERER RECOVERY

## 1. Summary

Phase 10 was an exercise renderer recovery pass. The frontend exercise rendering layer was significantly behind the backend orchestration layer — exercise type, skill focus, and full item lists were discarded at the mapping boundary; the exercise anchor disappeared entirely during explanation cards; the lesson had no phase-aware rendering for the reading/review stage; and the progress panel was unaware of which exercise was active.

After Phase 10:
- Exercise type label and skill focus subtitle visible in ExercisePanel
- Full items list rendered as context (all items numbered, current item highlighted)
- Exercise anchor persists below TeachingOverlay during side questions — student never loses orientation
- Reading context banner shown during CONTEXT_INPUT phase before exercises begin
- Phase restored on lesson resume (lesson_resumed now calls setPhase)
- Exercise N indicator in SectionProgressPanel sidebar
- PaidExerciseCard now shows Exercise N in header alongside type label
- Both TypeScript builds: 0 errors. Production build clean (78 modules, 432 kB).

## 2. Goals Completed

Completed:
- `Exercise` type extended with `exerciseType`, `skillFocus`, `items` fields
- `mapExercise()` now preserves all three fields instead of discarding them
- `useLessonSession` added `currentPhase` state, `setPhase()` callback, updated `onPhaseChange` to track phase
- `ExercisePanel.tsx` — type badge added, skillFocus subtitle added, full items reference list with current-item highlight
- `PaidExerciseCard.tsx` — Exercise N shown in header row next to type label
- NEW `ExerciseAnchorBanner.tsx` — compact persistent strip: Exercise N · type · instruction — shown below TeachingOverlay when exercise is active
- `ClassroomLayout.tsx` — anchor logic wired; reading context card during CONTEXT_INPUT; `currentPhase` destructured; `lesson_resumed` handler restores phase via `setPhase(msg.phase)`; `currentExerciseNum` passed to SectionProgressPanel
- `SectionProgressPanel.tsx` — `currentExerciseNum` prop added, active exercise badge rendered

NOT completed (deferred to Phase 11 or later):
- `section_card` WS event rendering — grammar overview card still a no-op; requires UI design decision
- Paragraph-level reading renderer — reading still rendered via chat; requires backend reading_chunk event (planned for Phase 3+ but not yet emitted)
- Reconnect cursor restoration in renderer — cursor is restored by backend but `currentPhase` starts at DIAGNOSTIC on fresh mount even after resume (partially fixed: `setPhase(msg.phase)` on lesson_resumed, but no cursor snapshot restore event)
- Translation UX improvements — Phase 10 scope is renderer, not translation flow

## 3. Changed Files

Frontend:
- `frontend/src/features/classroom/types.ts` — Exercise interface gains `exerciseType?`, `skillFocus?`, `items?`
- `frontend/src/features/classroom/hooks/useLessonSession.ts` — `mapExercise` preserves fields; `currentPhase` + `setPhase` added; `onPhaseChange` updates `currentPhase`; `ExerciseCursor` re-exported
- `frontend/src/features/classroom/components/ExercisePanel.tsx` — rewritten with type badge, skillFocus subtitle, items list with highlight
- `frontend/src/features/classroom/components/PaidExerciseCard.tsx` — Exercise N added to header
- `frontend/src/features/classroom/components/SectionProgressPanel.tsx` — `currentExerciseNum` prop + active exercise badge
- `frontend/src/features/classroom/components/ClassroomLayout.tsx` — anchor wiring, reading context, phase restore on resume, ExerciseAnchorBanner import, currentExerciseNum passthrough
- NEW: `frontend/src/features/classroom/components/ExerciseAnchorBanner.tsx` — compact exercise anchor strip

Backend:
- No backend changes.

Database:
- No database changes. Next migration remains 013.

## 4. Renderer Architecture Changes

### Before Phase 10

Center panel priority (exclusive):
```
teachingCard → TeachingOverlay (exercise disappears)
exerciseCursor → PaidExerciseCard
question → ExercisePanel
wsConnectError → error
!lessonStarted → begin/connect
null
```

`mapExercise()` signature (lossy):
```typescript
{ id, index, total, prompt, hint, sentence, answer }
// exerciseType, skillFocus, items silently discarded
```

### After Phase 10

Center panel priority:
```
teachingCard → TeachingOverlay + ExerciseAnchorBanner (exercise context preserved)
exerciseCursor → PaidExerciseCard (enhanced: Exercise N in header)
question → ExercisePanel (enhanced: type, skillFocus, items list)
wsConnectError → error
!lessonStarted → begin/connect
currentPhase === 'CONTEXT_INPUT' → ReadingContextBanner
null
```

`mapExercise()` signature (complete):
```typescript
{ id, index, total, prompt, hint, sentence, answer, exerciseType, skillFocus, items }
```

## 5. Progression Rendering Changes

### ExercisePanel Badge (before)
```
Exercise 2 of 8
```

### ExercisePanel Badge (after)
```
Exercise 2 · Item 1 of 5     [FILL IN]
```
(Item N of M derived from items array match; falls back to "of 8" if no items)

### PaidExerciseCard Header (before)
```
[FILL IN]                    Item 2 of 5
```

### PaidExerciseCard Header (after)
```
[FILL IN]  Exercise 3        Item 2 of 5
```

### SectionProgressPanel (before)
```
Section 1.2
Grammar Discovery
5 / 8 exercises
[timeline steps...]
```

### SectionProgressPanel (after)
```
Section 1.2
Grammar Discovery
5 / 8 exercises
[Exercise 3] active
[timeline steps...]
```

## 6. Exercise Anchor Fix

### Problem (before)
When student clicked "I don't understand":
1. `teaching_card` WS event arrived
2. `teachingCard` state set
3. Center panel rendered: `teachingCard` branch — `TeachingOverlay` exclusively
4. Exercise panel gone — student lost: "what was I doing?"

### Fix (after)
```
teachingCard branch now renders:
  <div column gap=10>
    <TeachingOverlay ... />
    {exerciseCursor || questionForPanel} && (
      <ExerciseAnchorBanner
        exerciseNum={...}
        exerciseType={...}
        instruction={...}
      />
    )
  </div>
```

`ExerciseAnchorBanner` shows:
```
ACTIVE TASK  [Exercise 3]  · Fill in  Complete using the correct form  ↩ returning after answer
```

The anchor is non-interactive (display only). It is persistent throughout the teaching card lifetime.

## 7. Side-Question Recovery UX

The `ExerciseAnchorBanner` provides:
- Constant exercise reference during any teaching card display
- Exercise number visible
- Exercise type visible
- Current instruction visible (truncated with ellipsis)
- "↩ returning after answer" label confirms lesson will continue

When teaching card is dismissed (`onDismiss`), the anchor disappears and the full exercise panel returns as before.

## 8. Reading Rendering Changes

Phase CONTEXT_INPUT now has a dedicated visual state:

When `lessonStarted === true` AND `currentPhase === 'CONTEXT_INPUT'` AND no active exercise AND no error:
```
📖
READING
Review the material
Read through the content in the chat.
Your teacher will guide you through the key points before exercises begin.
```

This replaces the previous blank center panel during the reading/review phase.

Phase awareness is now tracked in `useLessonSession.currentPhase` — updated on every `phase_change` WS event and on lesson resume via `setPhase(msg.phase)`.

## 9. Curriculum Consistency Fixes

- Phase label "Reading" in CONTEXT_INPUT stage now has visual representation
- Exercise number shown consistently in both ExercisePanel and PaidExerciseCard
- SectionProgressPanel shows which exercise is currently active

What was NOT changed:
- Phase step labels (Warm up, Reading, Grammar Discovery, etc.) — existing labels kept
- Phase step count (7 steps) — unchanged
- Section numbering — unchanged

## 10. WebSocket / Runtime State Changes

No new websocket events. No backend changes.

New frontend behavior:
- `lesson_resumed` handler now calls `setPhase(msg.phase)` to restore phase tracking
- `currentPhase` is now tracked and exported from `useLessonSession`

The `setPhase` call on resume fixes the case where lesson resumes at e.g. EXERCISES phase but the frontend phase tracker was stuck at DIAGNOSTIC — previously the reading context banner would show even when irrelevant.

## 11. Known Remaining UX Issues

- **Items highlight matching is approximate** — `normalizeForMatch()` does a best-effort match of `question.sentence` against items by stripping number prefix. If the backend format differs, the highlight may not show (safe fallback: no highlight, all items still visible).
- **`section_card` still a no-op** — Grammar overview card arrives from backend but frontend does nothing with it. Could be rendered as a pinned reference card alongside the exercise.
- **Reading content in chat only** — CONTEXT_INPUT reading text is displayed via `ai_text` in chat. No dedicated reading card because backend doesn't emit `reading_chunk` events yet. The reading context banner is a placeholder — useful once reading_chunk is implemented.
- **Phase not restored on page refresh** — If student hard-refreshes, `currentPhase` resets to DIAGNOSTIC. On lesson_resumed, phase is restored. On full page reload (no resume), phase is rebuilt from `phase_change` events as lesson progresses.
- **Interrupt visual affordance** — Phase 9 noted this as remaining: mic button looks the same when teacher is speaking vs idle. Not addressed in Phase 10.

## 12. What Was Intentionally NOT Changed

- Lesson FSM (`lesson-ws.ts`, `orchestrator.ts`) — untouched
- WebSocket event contract — no new events, no modified payloads
- Billing system — untouched
- Auth system — untouched
- Demo system (`useDemoSession.ts`) — untouched
- STT/TTS pipeline — untouched
- Curriculum catalog and focus-student-book — untouched
- Lesson snapshots — untouched
- Tips infrastructure — untouched
- Chat panel rendering — untouched
- Bottom controls — untouched
- `max_tokens: 400` per AI turn — unchanged
- Database schema — no migrations; next migration is 013
- `PaidBeginPanel`, `PaidLessonCompleteModal`, `PaidLeaveModal` — untouched
- TeachingOverlay content and dismiss behavior — untouched

## 13. Phase 11 Starting State

Phase 11 starts from:
- 0 TypeScript errors (backend + frontend)
- Clean Vite production build (78 modules, 432 kB)
- Exercise anchor persisting through side questions
- Phase-aware rendering with reading context banner
- Exercise type, skill focus, and items visible
- Phase tracking restored on lesson resume

Recommended Phase 11 scope (from POST_PHASE_RUNTIME_RECOVERY.md):
- Continuation & Runtime Safety
  - Exact lesson resume (cursor + items state)
  - Runtime accounting correctness
  - Billing integrity hardening
  - Anti-abuse (prevent re-opening ended lessons)
  - Snapshot hardening
  - `section_card` rendering as pinned reference

Key files Phase 11 should read first:
- `docs/handoffs/PHASE_10_HANDOFF.md` (this document)
- `docs/RUNTIME_GUARDRAILS.md`
- `docs/WEBSOCKET_EVENT_CONTRACT.md`
- `backend/src/ws/lesson-ws.ts` — resume logic (lines ~180–220)
- `backend/src/lesson/lesson-snapshots.ts` — snapshot content
- `frontend/src/features/classroom/hooks/useLessonSession.ts` — current phase/cursor state
