# PAID RUNTIME TEACHERBOOK ALIGNMENT
> Generated: 2026-05-14

## Audit Summary

Full audit of PAID LESSON runtime vs. FREE LESSON (demo) runtime. Six root-cause bugs
identified and fixed. Both TypeScript builds and Vite production build pass at zero errors.

---

## 1. Current Free Runtime Flow

Demo mode (ClassroomLayout, mode='demo'):
- Uses Web Speech API (SpeechRecognition, browser-native)
- `rec.onresult` streams interim transcript directly into `answer` state
- `rec.onend` fires automatically → auto-submits final text after 250ms
- No Deepgram, no WebSocket audio streaming

Paid mode (ClassroomLayout, mode='paid'):
- Uses Deepgram Nova-2 via persistent WebSocket
- Backend accumulates is_final segments in `DeepgramSTT.transcriptBuffer`
- UtteranceEnd fires after 1500ms silence → `onTranscript()` called
- Frontend sends `audio_chunk` events; mic on/off via `mic_stop`/`mic_start`

## 2. Current Paid Runtime Flow (before fixes)

```
student clicks mic (start)
  → frontend: toggle() → starts PCM capture, streams audio_chunk to backend
  → backend: DeepgramSTT receives chunks, accumulates transcriptBuffer
  → backend: sends transcript events (interim + final) to frontend
  → frontend: onTranscript() → setAnswer(text)

student clicks mic (stop)
  → frontend: toggle() → stops PCM capture, setIsListening(false)
  → frontend: sends mic_stop
  → backend: if pendingTranscript has content → send student_message + processInput
  → backend: if pendingTranscript empty → pendingMicStop=true, waits for UtteranceEnd
```

## 3. Divergence Points Identified

| Issue | Location | Severity |
|-------|----------|----------|
| `parseExercise` drops `items` and `options` | `claude-handler.ts` | CRITICAL |
| No `mic_start` lifecycle — backend state not reset between recordings | `lesson-ws.ts` | CRITICAL |
| `pendingMicStop` has no timeout — turn silently lost if UtteranceEnd never fires | `lesson-ws.ts` | CRITICAL |
| Validator calls GPT-4o for structured exercises — accepts wrong answers | `validator.ts` | CRITICAL |
| GPT-4o fallback (no API key) returns `correct: true` for everything | `validator.ts` | HIGH |
| `awaitingStudentMessageRef` gets stuck — transcripts blocked forever | `ClassroomLayout.tsx` | HIGH |
| Matching two-column layout only for `vocabulary_matching`, not `matching` | `PaidExerciseCard.tsx` | MODERATE |
| WRAP_UP stub says "open your textbook" | `orchestrator.ts` | LOW |
| Fallback AI response says "I'm thinking..." (forbidden phrase) | `claude-handler.ts` | LOW |

## 4. Teacherbook Answer Availability

The teacherbook answer keys exist in `backend/src/lesson/focus-teachers-book.ts`.
Each `TeachersBookSection` has `answerKeys: AnswerKey[]` with `answers: string[]`
and optional `alternativeAnswers?: string[]`.

These keys ARE included in the AI system prompt context (via `buildTeachersBookContext`).
The AI reads them and includes the correct answer in `exercise.correct_answer`.

**Current limitation**: no direct lookup at validation time. The AI-provided `correct_answer`
is used as-is. If the AI hallucinates the answer, validation fails.

**Fix applied**: Removed AI (GPT-4o) evaluation for all structured exercise types.
The `correct_answer` from the teacherbook (via AI context) is now the sole authority.
GPT-4o evaluation is kept only for `free_production` (open-ended, many valid answers).

## 5. Validation Architecture (after fixes)

```
handleExerciseAnswer()
  → loadExercise(exerciseId)  ← loads from Redis (includes AI-generated correct_answer)
  → validateAnswer(exercise, studentAnswer)
      → normalise(studentAnswer) === normalise(exercise.correct_answer)?
          YES → correct: true
          NO  → exercise.type === 'free_production'?
                  YES → aiEvaluate() via GPT-4o
                  NO  → correct: false (no AI guessing for structured exercises)
```

This eliminates the "boring accepted instead of serious" class of bugs.

## 6. Orchestration Weaknesses (remaining)

- Item continuity is enforced via the AI prompt (`ANTI_CHAOS_PROTOCOL`, `ITEM CURSOR`
  in system prompt) but not structurally prevented in the orchestrator.
- If the AI ignores the `EXERCISE CONTINUITY` rule and advances to the next item
  during a correction ladder, the orchestrator will follow the AI's signal.
- Mitigation: the prompt is comprehensive and the correction ladder context injected
  by `handleExerciseAnswer` explicitly instructs `exercise: null` during correction turns.
- This is a prompt-compliance issue, not a structural bug. No code change applied.

## 7. Exact Fixes Applied

### A. `backend/src/ai/claude-handler.ts`

**Fix 1: parseExercise now extracts `items` and `options`**

The AI sends full exercise data including `items` (all exercise items for the card display)
and `options` (word bank / right-column choices). These were silently dropped. Fixed by
adding extraction of both arrays with type-safe filtering.

**Fix 2: fallback response no longer says "I'm thinking..."**

The forbidden phrase is replaced with a neutral prompt that doesn't violate teaching protocol.

### B. `backend/src/ws/message-types.ts`

**Fix 3: Added `mic_start` inbound message type**

New Zod schema entry for `{ type: 'mic_start' }`. This is the signal from the frontend
that a new recording session has begun.

### C. `backend/src/ws/lesson-ws.ts`

**Fix 4: `pendingMicStopTimeoutRef` added to ClientMeta**

New field tracks the timeout handle set when `pendingMicStop=true`. Cleared in:
- `mic_start` handler
- `mic_stop` handler (when pendingTranscript has content)
- STT `onTranscript` callback (when pendingMicStop is handled via UtteranceEnd)
- `ws.on('close')` handler

**Fix 5: `mic_start` handler resets backend transcript state**

On receipt of `mic_start`:
- Clears any pending `pendingMicStopTimeoutRef`
- Resets `pendingMicStop = false`
- Resets `pendingTranscript = ''`
- Calls `stt.clearBuffer()` to flush Deepgram's internal buffer

This guarantees clean state at the start of every recording session.

**Fix 6: 2.5s timeout fallback for `pendingMicStop`**

When `mic_stop` arrives and `pendingTranscript` is empty (UtteranceEnd hasn't fired yet),
the old code set `pendingMicStop = true` and waited indefinitely. The new code also sets
a 2500ms timeout that processes whatever `pendingTranscript` has by then. This prevents
the student's turn from being silently lost when:
- Speech ends too cleanly for Deepgram to detect silence
- Student speaks very briefly and UtteranceEnd never fires within expected window

### D. `backend/src/exercises/validator.ts`

**Fix 7: No AI evaluation for structured exercises**

Changed: GPT-4o `aiEvaluate` was called for any non-exact match regardless of exercise type.
Now: Only `free_production` exercises use AI evaluation. All other types (form_transformation,
error_correction, reconstruction, fill_gap, vocabulary_matching, matching) require an exact
match after normalisation. Incorrect answers return `correct: false` immediately.

**Fix 8: Fixed "no OPENAI_API_KEY → correct: true" fallback**

Changed `{ correct: true, score: 0.5, feedback: 'Answer recorded.' }` to
`{ correct: false, score: 0.5, feedback: 'Answer received.' }`.

### E. `backend/src/lesson/orchestrator.ts`

**Fix 9: WRAP_UP stub no longer says "open your textbook"**

The stub (used when Claude is not configured) previously said "open your textbook, unit X,
exercises 3 and 4". This violates the digital-first rule. Replaced with a digital-first
homework instruction.

### F. `frontend/src/features/classroom/components/ClassroomLayout.tsx`

**Fix 10: `mic_start` sent to backend when recording starts**

In `paidToggle()`, when `!wasListening` (starting a new recording):
- `awaitingStudentMessageRef.current = false` — resets any stuck transcript guard
- `lastTranscriptRef.current = ''` — clears stale transcript comparison value
- `send({ type: 'mic_start' })` — signals backend to reset state

### G. `frontend/src/features/classroom/components/PaidExerciseCard.tsx`

**Fix 11: Two-column matching layout for all matching types**

Added `isMatchingExercise()` helper that returns `true` for both `vocabulary_matching`
and `matching` types. The two-column layout condition now uses this helper instead of
checking `exerciseType === 'vocabulary_matching'` directly.

The word bank display condition updated to `!isMatchingExercise(exerciseType)` to
ensure it never shows alongside the two-column layout.

Added `matching` to `TYPE_LABEL` map.

## 8. Remaining Limitations

1. **Teacherbook answer validation**: The `correct_answer` in exercises is still
   AI-generated (based on teacherbook context, but not fetched directly from
   `getTeachersBookSection().answerKeys` at validation time). If the AI hallucinates
   an incorrect `correct_answer`, a correct student answer would be marked wrong.
   Full fix requires: storing `sectionId + exerciseRef` with each exercise, then
   looking up `answerKeys` at validation time.

2. **Free production validation**: GPT-4o evaluation is retained for open-ended tasks.
   The evaluator CAN still accept wrong grammar, but this is acceptable for free production
   where many valid responses exist.

3. **Orchestrator item continuity**: No structural guard prevents the AI from advancing
   past the current item during a correction ladder. This relies on prompt compliance.

4. **Deepgram transcript bleed between rapid recordings**: If the student clicks
   mic OFF and immediately ON within ~300ms, Deepgram may not detect a silence gap
   and will treat both recordings as one utterance. The `mic_start` reset clears
   `transcriptBuffer`, but the ongoing Deepgram stream may still accumulate mixed audio.
   Full fix requires closing/reopening the Deepgram connection on each `mic_start`,
   at the cost of ~200-500ms reconnect latency per recording.

## 9. Regression Checklist

### Transcript / Mic
- [ ] Click mic to start → transcript appears and grows in input field
- [ ] Click mic to stop → input clears immediately, chat shows student message
- [ ] Second recording after stop → no stale transcript from previous turn
- [ ] Rapid stop + start (within 500ms) → new recording starts clean
- [ ] Mic stop when Deepgram hasn't fired UtteranceEnd → 2.5s timeout processes turn
- [ ] Backend error during processing → next recording not blocked (awaitingStudentMessage reset)

### Exercise Rendering
- [ ] Exercise card shows exercise number + instruction + current item + all items
- [ ] Matching exercise shows two columns (left + right) for `vocabulary_matching` type
- [ ] Matching exercise shows two columns for `matching` type
- [ ] Fill-gap with word bank shows flat word bank chips (not two columns)
- [ ] Word box exercise shows word box with strikethrough for used words

### Validation
- [ ] Correct exact answer → `correct: true`
- [ ] Wrong answer on form_transformation → `correct: false`, no AI call
- [ ] Wrong answer on free_production → AI evaluation
- [ ] System works when OPENAI_API_KEY is not set → no silent `correct: true`

### Orchestration
- [ ] AI correction ladder stays on same exercise item (exercise: null during correction)
- [ ] Exercise advances only after correct answer
- [ ] Clarification question does NOT reset the exercise
- [ ] Phase changes forward only (DIAGNOSTIC → CONTEXT_INPUT → ... → END)

### Paid-specific
- [ ] Lesson start flow: WS connect → lesson_ready → begin button → focus_lesson_start
- [ ] Resume: correct exercise cursor restored on reconnect
- [ ] Billing: only charges for current session, not full elapsed lesson time
- [ ] Disconnect banner shown when WS drops mid-lesson

### Free lesson (no regression)
- [ ] Demo lesson still works independently (Web Speech API path unchanged)
- [ ] Demo lesson transcript submits on onend
- [ ] Demo lesson AI responds correctly

### Digital-first
- [ ] AI never says "open your book" / "turn to page" / "look at textbook"
- [ ] Exercise instructions are shown on screen via display_text card
- [ ] All exercise content visible without physical book
