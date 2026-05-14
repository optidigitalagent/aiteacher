# HOTFIX: Exercise Renderer & Mic Send
> Date: 2026-05-14 | Phase: Post-Phase-14 QA Hotfix

## Root Cause Analysis

### Bug 1 — Partial transcript on second mic click

**Where:** `backend/src/ws/lesson-ws.ts` — all three `DeepgramSTT` setup callbacks
(in `handleLessonStart`, `handleFocusLessonStart`, `resumeLesson`)

**What was wrong:**  
When `pendingMicStop=true` (mic_stop arrived before Deepgram's UtteranceEnd), the
STT final callback fired with only the **last** Deepgram segment. The callback
discarded `meta.pendingTranscript` (accumulated text from earlier segments) and
called `processInput` with only the tail fragment.

```
"She doesn't like" → accumulated in pendingTranscript
"cooking" → fires with pendingMicStop=true
→ pendingTranscript cleared, processInput("cooking") → 7 chars
```

This produced `student_turn_finalized chars=9` log lines and sent partial inputs
to the AI, causing incorrect feedback and garbled exercise progression.

**Fix:** When `pendingMicStop=true`, combine `pendingTranscript + ' ' + transcript`
before clearing. If the combined string is empty, skip processing silently.
The `shouldProcessTranscript` filter is now skipped for the mic_stop path — when
the student explicitly clicked stop-mic we trust they meant to submit, even if the
final Deepgram segment is short.

---

### Bug 2 — `exercise_answer` double-fire

**Where:** `frontend/src/features/classroom/components/ClassroomLayout.tsx`
— `paidToggle` callback

**What was wrong:**  
After `mic_stop` was sent, the `answer` state still held the STT transcript text.
If the student pressed the arrow button (or it was triggered by any means) before
`student_message` echoed back from the backend, `handleSubmit` → `handleCheck` →
`submitAnswer` detected `pendingId` was set and sent `exercise_answer` with the
transcript as the answer.

This created two parallel processing paths for the same voice input:
1. Backend's `mic_stop` handler → `processInput(transcript)` (correct path)
2. Frontend's `exercise_answer` → `handleExerciseAnswer` → `[EXERCISE RESULT]` (wrong path)

The `[EXERCISE RESULT]` payloads (~1121 chars) seen in Railway logs were from path 2.

**Fix:** In `paidToggle`, immediately after `send({ type: 'mic_stop' })`, call
`setAnswer('')` and reset `lastTranscriptRef`. The backend's `student_message`
echo will repopulate the chat panel; the input field doesn't need to hold the text.

---

### Bug 3 — Matching exercises show only one word

**Where:**
- `backend/src/lesson/types.ts` — `ExerciseCursor` interface
- `backend/src/lesson/orchestrator.ts` — cursor construction  
- `frontend/src/features/classroom/services/classroomSocket.ts` — `ExerciseCursor`
- `frontend/src/features/classroom/components/PaidExerciseCard.tsx` — renderer

**What was wrong:**  
`ExerciseCursor` had no `items` field. The orchestrator read `aiResp.exercise.items.length`
to compute `itemTotal` but discarded the actual item texts. `PaidExerciseCard` had
only `currentItem` (e.g., "clever") and showed nothing about the answer options or
the full matching list.

**Fix:**
1. Added `items?: string[]` to both backend and frontend `ExerciseCursor` types.
2. Orchestrator now passes `items: aiResp.exercise.items` into the cursor.
3. `PaidExerciseCard` renders:
   - Instruction box (prominent, readable — was tiny italic before)
   - "All items" list with current item highlighted, completed items shown with ✓/✗
   - Current item gets a separate highlighted card (blue tint)
   - Word box unchanged
   - Feedback banner at the bottom (outside scroll area)
   - Full card is scrollable (`maxHeight: 70vh, overflowY: auto`)

---

## Files Changed

| File | Change |
|------|--------|
| `backend/src/lesson/types.ts` | Add `items?: string[]` to `ExerciseCursor` |
| `backend/src/lesson/orchestrator.ts` | Pass `items` into cursor |
| `backend/src/ws/lesson-ws.ts` | Fix 3× STT `pendingMicStop` callback (handleLessonStart, handleFocusLessonStart, resumeLesson) |
| `frontend/src/features/classroom/services/classroomSocket.ts` | Add `items?: string[]` to `ExerciseCursor` |
| `frontend/src/features/classroom/components/ClassroomLayout.tsx` | Clear `answer` + `lastTranscriptRef` after `mic_stop` in `paidToggle` |
| `frontend/src/features/classroom/components/PaidExerciseCard.tsx` | Full renderer rewrite: items list, prominent instruction, scrollable |

---

## Mic Second-Click Behaviour After Fix

1. Student clicks mic once → PCM streams, live transcript appears in input.
2. Student clicks mic again (`paidToggle`):
   - `toggle()` stops PCM capture.
   - `send({ type: 'mic_stop' })` signals backend.
   - `setAnswer('')` clears the input field immediately — submit arrow is now disabled.
3. Backend receives `mic_stop`:
   - If `pendingTranscript` is non-empty → flush immediately → `student_message` + `processInput`.
   - If empty → set `pendingMicStop=true`, wait for next Deepgram UtteranceEnd.
4. Deepgram fires UtteranceEnd with final segment:
   - `fullText = pendingTranscript + ' ' + transcript` (full accumulated speech).
   - `student_message` sent with full text, `processInput` called once.
5. Frontend receives `student_message` → chat panel shows full student utterance.
6. `exercise_answer` is **never** sent via the voice path.

---

## Matching Exercise Rendering After Fix

- `cursor.items` = `["clever", "brave", "wise", "curious"]` (full left column)
- `cursor.instruction` = `"Match each word with its antonym: A) cowardly, B) foolish..."` — shown in a prominent box at the top of the card
- Current item (`"clever"`) shown in a blue-tinted "Current item" card
- All items listed below with state indicators:
  - Active item: blue left border + bold
  - Completed correctly: green left border + ✓
  - Failed: red left border + ✗
  - Upcoming: grey

---

## Duplicate `exercise_answer` Prevention

- Voice path (`mic_stop`) never calls `submitAnswer` — answer is cleared before any button can fire.
- `exercise_answer` is ONLY emitted when:
  - Student presses the arrow button (typed answer) while `question` is active.
  - Or `handleCheck` is called from the ExercisePanel "Check answer" button.

---

## TypeScript / Build Checks

```
backend tsc --noEmit   → 0 errors
frontend tsc --noEmit  → 0 errors
vite build             → ✓ built in 2.88s (439 kB JS / 38 kB CSS)
```

---

## Retest Checklist

- [ ] Click mic once → transcript appears live in input field
- [ ] Click mic second time → input clears, teacher responds with full transcript
- [ ] Backend log shows `student_turn_finalized chars=N` with realistic N (> 10)
- [ ] No `[Classroom OUT] exercise_answer` appears after mic_stop in F12
- [ ] Matching exercise card shows instruction + full items list + current item highlighted
- [ ] Completed items show ✓, failed items show ✗
- [ ] Long exercises (> 5 items) scroll without overflow
- [ ] Typed answer still submits via arrow button normally
- [ ] Resume mid-exercise restores cursor (items list empty on resume — known limitation)
- [ ] Demo lesson unaffected (uses separate mic path)
