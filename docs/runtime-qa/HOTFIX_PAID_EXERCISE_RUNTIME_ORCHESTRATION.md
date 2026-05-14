# Hotfix: Paid Lesson Exercise Runtime & Orchestration
> Date: 2026-05-14 | Status: SHIPPED — 0 TS errors, Vite build clean

## Problem Groups Fixed

### Group A — Mic / Transcript / Send Runtime

**Bug A1: Transcript carryover (ghost transcript repopulates answer field)**
- Root cause: After mic_stop + setAnswer(''), Deepgram stays alive and late UtteranceEnd events fired with the same text, re-populating the input via the `transcript` WS event.
- Fix (backend): `meta.stt?.clearBuffer()` added in all 3 STT creation blocks (`resumeLesson`, `handleLessonStart`, `handleFocusLessonStart`) inside the `pendingMicStop` path, and in the `mic_stop` flush path. Clears the Deepgram buffer immediately after turn finalization so late events carry no content.
- Fix (frontend): `awaitingStudentMessageRef = useRef(false)` guard added to `ClassroomLayout`. Set `true` when `mic_stop` is sent. Reset `false` on `student_message` echo. The `transcript` case handler skips `setAnswer` when `awaitingStudentMessage` is true.

**Bug A2: exercise_answer double-fire**
- Root cause: After mic_stop, the answer field briefly still held the transcript. If user clicked the submit arrow in that window, `handleCheck` fired `exercise_answer` before `student_message` arrived and cleared the field.
- Fix: `handleCheck` returns early if `awaitingStudentMessageRef.current` is true.

### Group B — Exercise Display / Rendering

**Bug B1: Matching exercise showed only "2. funny" — no options, no columns**
- Root cause: `parseExercise()` in `openai-handler.ts` only extracted 5 fields (`type`, `question`, `correct_answer`, `hint`, `difficulty`). It silently dropped `exerciseNumber`, `instruction`, `skillFocus`, `items`, and `options`. The AI returned complete data; the parser discarded it.
- Fix: `parseExercise()` now extracts all 9 fields with proper type guards.

**Bug B2: `options` field didn't exist end-to-end**
- Added `options?: string[]` to:
  - `backend/src/lesson/types.ts` — `ExerciseData` and `ExerciseCursor`
  - `backend/src/ws/message-types.ts` — `OutboundExercise.exercise`
  - `backend/src/lesson/orchestrator.ts` — `exerciseCursor` builder
  - `frontend/src/features/classroom/services/classroomSocket.ts` — `ExerciseCursor` and `BackendExercise`
  - `frontend/src/features/classroom/components/PaidExerciseCard.tsx` — rendered as matching columns or word bank

**Bug B3: PaidExerciseCard had no matching exercise layout**
- Fix: For `vocabulary_matching` type, renders a two-column layout (questions left, options right). For all other types with options, renders a word bank of chips.

### Group C — Exercise Orchestration / AI Brain

**Bug C1: AI said "What's next?" — catastrophic tutor failure**
- Fix in `prompt-builder.ts`: Added explicit prohibition to FORBIDDEN SPOKEN PHRASES:
  `"What's next?" / "What do you want to do next?" / "What would you like to work on?"` with explanation that Alex always knows what comes next.
- Added rule #11 to ANTI_CHAOS_PROTOCOL: "ALEX ALWAYS LEADS — never say 'What's next?' or any variant. Alex knows the next step and announces it immediately."

**Bug C2: AI looped on correction without advancing after TURN D**
- Fix in `prompt-builder.ts`: CORRECTION LADDER TURN D now explicitly says: "Once the student repeats correctly → confirm and advance to the NEXT item immediately. Do NOT linger."

**Bug C3: Matching exercise — AI confused answers across items**
- Fix in `prompt-builder.ts`: Added MATCHING EXERCISES — SPECIAL RULES section to EXERCISES phase instruction. Defines `items` = left column, `options` = right column. One left-column item per turn. Explicit warning: "Do NOT confuse answers across items."

**Bug C4: AI populated options but parser dropped them**
- Fix: Added `options` field to EXERCISE LEARNING CARD JSON format in prompt-builder EXERCISES section with rules: REQUIRED for matching, REQUIRED for textbook word banks, null for open-ended exercises.

**Bug C5: Digital-first rule not enforced**
- Fix: Added to FORBIDDEN SPOKEN PHRASES: `"Open your book" / "Look at page X" / "Turn to page" / "Open your textbook" — this is a digital lesson.`

## Files Changed

| File | Change |
|------|--------|
| `backend/src/lesson/types.ts` | `options?: string[]` on `ExerciseData` + `ExerciseCursor` |
| `backend/src/ws/message-types.ts` | `options?: string[]` on `OutboundExercise.exercise` |
| `backend/src/lesson/orchestrator.ts` | Pass `options` through cursor builder |
| `backend/src/ai/openai-handler.ts` | `parseExercise()` now extracts all 9 fields |
| `backend/src/ws/lesson-ws.ts` | `clearBuffer()` in all 3 STT blocks + mic_stop flush; `options` in exercise send |
| `backend/src/ai/prompt-builder.ts` | "What's next?" ban; TURN D advance rule; MATCHING EXERCISES rules; `options` in card JSON; digital-first rule |
| `frontend/src/features/classroom/services/classroomSocket.ts` | `options` on `ExerciseCursor` + `BackendExercise` |
| `frontend/src/features/classroom/components/PaidExerciseCard.tsx` | Matching two-column layout + word bank rendering |
| `frontend/src/features/classroom/components/ClassroomLayout.tsx` | `awaitingStudentMessageRef` guard on transcript + handleCheck |

## Verification

```
backend  tsc --noEmit  → 0 errors
frontend tsc --noEmit  → 0 errors
frontend vite build    → ✓ built in 3.00s
```

## What Was NOT Changed
- Billing / auth / subscriptions — untouched
- WebSocket architecture — untouched
- Free lesson flow — untouched
- Demo lesson flow — untouched
- Redis / PostgreSQL logic — untouched
- Voice system (STT/TTS) — only added `clearBuffer()` calls, no structural changes
