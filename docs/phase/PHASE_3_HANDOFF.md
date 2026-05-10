# PHASE 3 COMPLETE

## 1. Summary

Phase 3 implements the Textbook Engine & Exercise Renderer. Before this phase, the paid lesson had no
concept of which item within a textbook exercise the student was on — the AI could re-ask completed
items, the frontend could not render exercise progress, and a reconnect would lose all in-exercise state.

After this phase, every AI turn that touches an exercise produces an authoritative `ExerciseCursor`
persisted in Redis. The cursor (unit, section, exerciseNumber, exerciseType, instruction, currentItem,
itemIndex, itemTotal, completedItems, failedItems, wordBoxState) is broadcast to the frontend as
`exercise_cursor_updated` after every teacher turn. The paid classroom renders a dedicated
`PaidExerciseCard` driven entirely by this backend cursor — no local inference on the frontend.
Reconnect/refresh restores the cursor from Redis and re-broadcasts it immediately.

The AI prompt now includes an ITEM CURSOR block in the EXERCISES phase so the teacher never
re-presents completed items and never skips ahead past the current one.

## 2. Goals Completed

Completed:
- Backend: `ExerciseCursor` and `WordBoxState` types defined in `lesson/types.ts`
- Backend: `LessonState` extended with item-level cursor fields (itemIndex, currentItem, completedItems, failedItems, wordBoxState)
- Backend: `OrchestratorResult` extended with `exerciseCursor` field
- Backend: `orchestrator.ts` tracks item advancement, builds and persists cursor on every turn
- Backend: backward-compatible normalization (`??=`) in `loadState()` for old Redis blobs
- Backend: `lesson-ws.ts` initialises cursor fields in both free and focus `initialState` objects
- Backend: `lesson-ws.ts` sends `exercise_cursor_updated` after every `processInput()` call
- Backend: `lesson-ws.ts` re-broadcasts cursor on reconnect/resume from Redis
- Backend: `message-types.ts` adds `OutboundExerciseCursorUpdated` WS type and re-exports `ExerciseCursor`
- Backend: `prompt-builder.ts` injects ITEM CURSOR block into EXERCISES phase system prompt
- Frontend: `classroomSocket.ts` adds `ExerciseCursor` interface and `exercise_cursor_updated` to `BackendMessage`
- Frontend: `useLessonSession.ts` adds `exerciseCursor` state and `onCursorUpdated` callback
- Frontend: `PaidExerciseCard.tsx` created — paid-mode exercise renderer driven by backend cursor
- Frontend: `ClassroomLayout.tsx` wired to handle `exercise_cursor_updated`, render `PaidExerciseCard` in paid mode
- TypeScript: both backend and frontend pass `tsc --noEmit` with zero errors

NOT completed (future phases):
- Structured per-exercise textbook data (exercises are still extracted by AI from OCR text; Phase 5 or 6 adds structured Exercise DB)
- WordBoxState write-back from frontend (word clicks are not yet sent to backend; the AI sets wordBoxState in the cursor)
- Persistent cursor in PostgreSQL (currently Redis only — Phase 6 adds DB column for cross-session resume after TTL expiry)
- Unit 2–8 OCR ingestion (only Unit 1 sections 1.1–1.4 are in focus_lessons.json)

## 3. Changed Files

Backend:
- `backend/src/lesson/types.ts` — added WordBoxState, ExerciseCursor interfaces; extended LessonState with 5 cursor fields; extended OrchestratorResult with exerciseCursor
- `backend/src/lesson/orchestrator.ts` — item-level cursor tracking in process(); failedItems tracking in recordExerciseResult(); ??= normalization in loadState()
- `backend/src/ws/lesson-ws.ts` — cursor fields in initialState; exercise_cursor_updated send after processInput; cursor restore on resume
- `backend/src/ws/message-types.ts` — OutboundExerciseCursorUpdated interface; ExerciseCursor re-export; added to OutboundMessage union
- `backend/src/ai/prompt-builder.ts` — ITEM CURSOR block in EXERCISES case; fixed missing closing `}` brace in case block

Frontend:
- `frontend/src/features/classroom/services/classroomSocket.ts` — ExerciseCursor interface; exercise_cursor_updated in BackendMessage union
- `frontend/src/features/classroom/hooks/useLessonSession.ts` — exerciseCursor state; onCursorUpdated callback; both exposed from hook
- `frontend/src/features/classroom/components/PaidExerciseCard.tsx` — NEW FILE: paid exercise card component
- `frontend/src/features/classroom/components/ClassroomLayout.tsx` — imports PaidExerciseCard; handles exercise_cursor_updated; renders PaidExerciseCard in paid mode above ExercisePanel fallback

Database:
- No database changes. Cursor lives in the Redis LessonState JSON blob (same key, same 4h TTL).

## 4. Backend Changes

**Orchestrator (`orchestrator.ts`):**
The `process()` method now tracks the item-level cursor inside `LessonState` on every turn. When the AI
returns an exercise:
- If `exerciseNumber` differs from `state.currentExerciseNum` → new exercise: reset all cursor fields, mark previous exercise complete.
- If `exerciseNumber` is the same but `question` text differs from `state.currentItem` → same exercise, new item: mark current itemIndex as completed, advance itemIndex.
- If neither changed → same item (retry or correction turn): no advancement.

The cursor is built into an `ExerciseCursor` object and returned in `OrchestratorResult.exerciseCursor`.
`recordExerciseResult()` now also tracks `failedItems` (item indices where the student made errors).

**State normalization:** `loadState()` applies `??=` to all five Phase 3 fields so old Redis blobs
created before this phase never throw on missing fields.

**WebSocket handler (`lesson-ws.ts`):**
Both `initialState` objects (free lesson and focus lesson) now include the five cursor fields set to
zero/empty defaults. After every `processInput()`, if `result.exerciseCursor` is non-null the handler
sends `{ type: 'exercise_cursor_updated', cursor }` to the client. On resume from Redis, if the student
was mid-exercise (`state.currentExerciseNum > 0 && state.currentItem`), the handler immediately
broadcasts the restored cursor so the frontend panel appears without the student having to answer again.

**Prompt builder (`prompt-builder.ts`):**
The EXERCISES case now builds an `itemCursorNote` string (only when cursor has advanced past the start)
and prepends it to the EXERCISES phase instruction. The note tells the AI the current itemIndex,
currentItem text, completed indices, and failed indices, with hard rules: "DO NOT re-present completed
items. DO NOT advance past the current item until correct."

A syntax bug (missing closing `}` on the case block introduced when converting from `case 'EXERCISES': return` to `case 'EXERCISES': { const ...; return ... }`) was fixed.

## 5. Frontend Changes

**`classroomSocket.ts`:**
Added `ExerciseCursor` interface (mirrors backend type, no import overhead). Added `exercise_cursor_updated`
variant to the `BackendMessage` discriminated union so TypeScript enforces handling it.

**`useLessonSession.ts`:**
Added `exerciseCursor` state (`ExerciseCursor | null`) and `onCursorUpdated` callback. Both are returned
from the hook so `ClassroomLayout` can drive the exercise card purely from backend state.

**`PaidExerciseCard.tsx` (new):**
Renders the paid-mode exercise panel from an `ExerciseCursor`. Shows:
- Exercise type badge (e.g. "Transform", "Fill in", "Word Box")
- Instruction text from the cursor
- Item progress dots (one per item in the exercise; colour-coded: green=done, red=failed, purple=active, grey=upcoming)
- Current item text in a highlighted card
- Word box chips (available words visually distinguished from used words)
- Feedback banner (green/red) based on `FeedbackState`
- Border highlights green on correct, red on wrong
The component is stateless — all data comes from `cursor` and `feedback` props.

**`ClassroomLayout.tsx`:**
- Imports `PaidExerciseCard`
- Destructures `exerciseCursor` and `onCursorUpdated` from `useLessonSession`
- Handles `exercise_cursor_updated` in the WS switch (calls `onCursorUpdated(msg.cursor)`)
- In the center panel render tree: `exerciseCursor` is checked before `questionForPanel`. In paid mode
  (once the backend sends the first cursor), `PaidExerciseCard` renders instead of `ExercisePanel`.
  The `ExercisePanel` path remains as fallback for any edge cases (demo mode always uses `DemoStepCenter`).

## 6. Database Changes

No database changes. The item-level cursor is stored as part of the existing `LessonState` JSON blob
in Redis (key: `lesson:{lessonId}`, TTL: 4 hours). No new PostgreSQL columns or migrations.

Phase 6 (Resume System) will add a `cursor_snapshot` column to the `lessons` table for cross-session
persistence (survives Redis TTL expiry).

## 7. Runtime Behavior Changes

Before:
- Paid lesson had no concept of "current item within exercise". The AI could re-ask completed items.
- Frontend center panel showed `ExercisePanel` (demo fill-gap renderer) or was blank.
- Reconnect/resume showed the resume greeting but left the exercise panel blank.
- `exercise_cursor_updated` event did not exist.

After:
- Every AI turn that produces/updates an exercise sends `exercise_cursor_updated` with the authoritative cursor.
- Frontend renders `PaidExerciseCard` with type badge, instruction, color-coded item progress dots, current item text, and word box if applicable.
- Border animates green/red on feedback.
- On reconnect, the cursor is immediately re-broadcast from Redis — exercise card appears without student needing to answer again.
- AI system prompt contains the ITEM CURSOR block so it never re-asks done items.

## 8. WebSocket/Event Changes

Added:
- `exercise_cursor_updated` — sent from backend to frontend after every AI turn that produces/updates an exercise.
  Payload: `{ type: 'exercise_cursor_updated', cursor: ExerciseCursor }`
  ExerciseCursor fields: `unit?`, `section?`, `exerciseNumber`, `exerciseType`, `instruction`, `currentItem`, `itemIndex`, `itemTotal`, `completedItems`, `failedItems`, `wordBoxState?`

Also sent:
- On reconnect/resume: if `state.currentExerciseNum > 0 && state.currentItem`, backend sends `exercise_cursor_updated` immediately before the resume greeting audio.

Modified:
- None.

Removed:
- None. `exercise` event still sent unchanged. `exercise_cursor_updated` is additive.

## 9. AI/Prompt Changes

`prompt-builder.ts` EXERCISES case now conditionally prepends an ITEM CURSOR block to the teacher
instruction. The block is only included when the cursor has advanced (itemIndex > 0 or currentItem set),
so it does not bloat the first turn of a new exercise.

Content of the ITEM CURSOR block:
```
━━━ ITEM CURSOR ━━━
Current item index: N (0-based)
Current item being asked: "exact item text"
Completed item indices in this exercise: [0, 1, ...]
Failed item indices (need extra care): [...]
DO NOT re-present completed items. DO NOT advance past the current item until correct.
```

This block is part of the EXERCISES phase instruction (token budget: counted within the 4000-token
system prompt limit). It does not appear in any other phase.

## 10. Cost Impact

No meaningful cost impact. The ITEM CURSOR block adds ~80–120 tokens to the EXERCISES phase system
prompt only. All other phases are unchanged. AI call frequency, STT/TTS usage are unchanged.

## 11. Tests Performed

Tested:
- `backend: tsc --noEmit` — zero errors after fixing missing `}` brace in prompt-builder.ts
- `frontend: tsc --noEmit` — zero errors after all frontend changes

Not tested (no live backend in this session):
- End-to-end cursor advance: answering item 1, receiving cursor with itemIndex=1
- Reconnect cursor restore: disconnect mid-exercise and reconnect
- Word box display: exercises with wordBoxState populated by AI
- Item progress dots rendering with real data
- PaidExerciseCard visual appearance in browser

## 12. Known Remaining Issues

Remaining issues:
- **No structured exercise data** (medium): Exercises come from AI extraction of OCR text. The AI
  sometimes misidentifies item boundaries. Phase 5 will add a structured exercise store.
- **itemTotal = 0 for single-item responses** (low): When the AI omits `items[]`, `itemTotal` is 0
  and item progress dots do not render. The cursor still shows currentItem correctly.
- **wordBoxState write-back missing** (low): The frontend does not send word-clicks to the backend.
  wordBoxState is set by the AI in the cursor; students see which words are "used" only when the AI
  updates the cursor on the next turn.
- **Redis-only cursor persistence** (medium): If Redis evicts the lesson (TTL expiry after 4h idle),
  the cursor is lost. Phase 6 will add PostgreSQL snapshot.
- **ExercisePanel still in render tree** (cosmetic): The fallback `ExercisePanel` path remains after
  `exerciseCursor` in ClassroomLayout. It triggers only if `exerciseCursor` is null but `questionForPanel`
  is set — effectively the old demo code path, kept for safety.

## 13. What Was Intentionally NOT Changed

Intentionally NOT changed:
- **Billing, LiqPay, subscriptions** — no modifications; minute accounting is independent of cursor tracking
- **Demo lesson system** (`useDemoSession`, `DemoStepCenter`) — Phase 3 is paid-only; demo uses its own flow
- **Auth system** (JWT, AuthContext) — untouched
- **Persistent tips / memory system** — untouched
- **Final reflection system** — untouched
- **`ExercisePanel` component** — kept intact as demo fallback; only bypassed for paid mode
- **`exercise` WS event** — still sent unchanged; `exercise_cursor_updated` is additive, not a replacement
- **Phase FSM transitions** — `shouldTransition` and `applyAISignal` in `transitions.ts` untouched
- **Redis TTL (4h)** — unchanged; Phase 6 adds DB snapshot for longer persistence

## 14. Risks Introduced

New risks:
- **Item advancement detection relies on question text equality**: if the AI rephrases the same item
  (e.g. corrects a typo), it will be treated as a new item and itemIndex will advance incorrectly.
  Mitigation: the AI is instructed to use exact textbook text; low probability in practice.
- **Backward-compat `??=` assumptions**: old Redis blobs created before Phase 3 will have null/0 defaults
  for cursor fields. If an old lesson is resumed at a non-zero exerciseCount, the cursor will start from
  zero — the student may see a blank item card until the next AI turn populates it. Acceptable for the
  transition period.
- **TypeScript `as BackendMessage` cast in classroomSocket.ts**: the WS frame is cast without schema
  validation. An unexpected frame shape won't throw but may produce silent no-ops. Existing behaviour,
  not introduced by Phase 3.

## 15. Deployment Notes

No new environment variables. No database migrations. No service restarts required beyond the normal
backend redeploy.

Backend and frontend both pass `tsc --noEmit`. Standard Railway deploy (push to main) is sufficient.

## 16. Recommended Next Phase

Recommended next phase:
Phase 4 — Structured Exercise Store

Build a `textbook_exercises` PostgreSQL table with per-exercise rows (unit, section, exerciseNumber,
type, instruction, items JSON array, answer_key JSON). Seed from Unit 1 OCR (manually or via AI
extraction script). The orchestrator will query the DB for exercise items instead of relying on AI
extraction from OCR. This eliminates item boundary errors and enables the AI to focus on teaching
rather than textbook parsing.

## 17. Next Claude Session Instructions

Next Claude session should:
- Read `docs/roadmap.md` first to confirm the active phase
- Read `docs/phase/PHASE_3_HANDOFF.md` (this document) for full context
- Read `backend/src/lesson/types.ts` — the source of truth for LessonState and ExerciseCursor shapes
- Read `backend/src/lesson/orchestrator.ts` — understand item advancement logic before touching it
- Read `backend/src/ws/lesson-ws.ts` — understand cursor broadcast and resume logic
- Read `frontend/src/features/classroom/components/PaidExerciseCard.tsx` — the new paid exercise card

Continue from Phase 4 ONLY.

DO NOT:
- Change the `exercise_cursor_updated` event shape or remove it — frontend and backend are coupled on this contract
- Remove the `??=` normalization lines in `orchestrator.ts:loadState()` — required until all Redis blobs are Phase 3
- Modify `ExercisePanel` — it is still used by the demo mode; only `PaidExerciseCard` was added
- Touch billing, LiqPay, subscriptions, auth, or demo session code
- Add DB migrations without reading `docs/student-model.md` first
- Change Claude model ID from `claude-sonnet-4-6` without team decision
