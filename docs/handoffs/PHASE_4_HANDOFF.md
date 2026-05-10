# PHASE 4 COMPLETE

## 1. Summary

Phase 4 implements Teacher Intelligence, Interruption Recovery & Guided Pedagogy.

Before this phase, the AI teacher had no mechanism to return to the exact lesson position after a side
question (translation, pronunciation help, off-topic grammar). It also had no awareness of remaining
lesson time, no per-turn persona enforcement, and no structured micro-tip guidance. The teacher
responded identically regardless of time pressure or recent student errors.

After this phase, every AI turn receives a structured LESSON CONTEXT block showing current exercise
position, a mandatory RETURN ANCHOR the AI must use after any side question, remaining lesson time with
adaptive warnings at ≤8 min and ≤3 min, and a 2-item recent-error summary. The SIDE_QUESTION_RECOVERY
protocol enforces a strict 1-turn-only answer format with mandatory return. MICRO_TIP_GUIDANCE enables
natural 1-sentence teaching moments. READING_ASSISTANCE_PROTOCOL governs teacher listening behaviour
during reading exercises. Per-teacher turn-style hints enforce Alex's directness vs Emma's warmth on
every turn. The speech output format now explicitly states MAX 3 sentences.

Both backend and frontend pass `tsc --noEmit` with zero errors. No new WS events, no DB migrations,
no frontend changes.

## 2. Goals Completed

Completed:
- `OrchestratorCallContext` interface added — `remainingMs` forwarded from WS layer through orchestrator to AI handler
- `buildTeacherAgendaContext()` — per-turn block: exercise position, return anchor, time warnings, recent errors
- `SIDE_QUESTION_RECOVERY_PROTOCOL` — enforces 1-turn side-question limit + mandatory return anchor
- `MICRO_TIP_GUIDANCE` — governs optional 1-sentence tips: when, how, forbidden patterns
- `READING_ASSISTANCE_PROTOCOL` — reading-section listening rules injected into EXERCISES phase when sectionType=Reading
- `buildPersonaStyleHint()` — per-teacher per-turn style enforcement line (Alex: direct/Socratic, Emma: warm/precise)
- `remainingSeconds` added to `PromptContext` interface
- `lesson-ws.ts` computes remaining time and passes to `orchestrator.process()`
- Speech output format updated: "MAX 3 sentences" stated in JSON format comment
- `grammarMastery` suppressed with `void` (unused field, kept for future phases)
- Both `claude-handler.ts` and `openai-handler.ts` updated to match new `AIHandlerFn` signature

NOT completed (Phase 5+):
- Persistent tips across lessons (Phase 5)
- Reflection engine (Phase 6)
- Per-session tip storage in PostgreSQL (Phase 5)
- Cross-lesson error pattern persistence beyond `student_profiles.error_patterns` (Phase 5)

## 3. Changed Files

Backend:
- `backend/src/lesson/orchestrator.ts` — added `OrchestratorCallContext` interface; extended `AIHandlerFn` to accept optional `ctx`; extended `process()` to accept `callCtx?: OrchestratorCallContext` and forward to `aiHandler`
- `backend/src/ai/prompt-builder.ts` — added `remainingSeconds?` to `PromptContext`; added `buildTeacherAgendaContext()`, `buildPersonaStyleHint()`, `SIDE_QUESTION_RECOVERY_PROTOCOL`, `MICRO_TIP_GUIDANCE`, `READING_ASSISTANCE_PROTOCOL`; updated `buildSystemPrompt()` to inject all new blocks; added `readingNote` to EXERCISES case; updated JSON output format comment
- `backend/src/ai/claude-handler.ts` — imports `OrchestratorCallContext`; handler signature updated to `(state, inputText, callCtx?)`; passes `remainingSeconds` to `PromptContext`
- `backend/src/ai/openai-handler.ts` — imports `OrchestratorCallContext`; handler signature updated to `(state, inputText, _ctx?)` for type compatibility
- `backend/src/ws/lesson-ws.ts` — `processInput()` now computes `elapsedMs` / `remainingMs` from `meta.lessonStartedAt` and passes `{ remainingMs }` to `orchestrator.process()`

Frontend:
- No frontend changes.

Database:
- No database changes.

Docs:
- `docs/handoffs/PHASE_4_HANDOFF.md` — this file

## 4. Backend Changes

**`orchestrator.ts`:**
Added `OrchestratorCallContext { remainingMs?: number }` interface (exported). `AIHandlerFn` type now
accepts an optional third parameter of this type. `LessonOrchestrator.process()` signature extended with
`callCtx?: OrchestratorCallContext`; the context is forwarded directly to `aiHandler(state, inputText, callCtx)`.
No other orchestration logic was changed.

**`prompt-builder.ts`:**
Six additions:

1. `PromptContext.remainingSeconds?: number` — carries remaining lesson seconds from WS into prompt builder.

2. `buildTeacherAgendaContext(state, remainingSeconds?)` — generates a compact `=== LESSON CONTEXT — THIS TURN ===`
block. Content: current exercise position + item text + mandatory return anchor (EXERCISES phase only);
time warning with adaptive severity (>8 min: neutral, ≤8 min: yellow ⚠, ≤3 min: critical ⚠ CRITICAL);
last 2 errors from `state.errorsThisLesson`. Returns empty string if no content (non-EXERCISES phases
without error history don't pollute the prompt).

3. `buildPersonaStyleHint(teacherName)` — 1-line per-teacher style reminder injected right after the
lesson header. Alex: "Direct and Socratic. Push student to think before hinting." Emma: "Warm and precise.
Acknowledge the attempt before correcting."

4. `SIDE_QUESTION_RECOVERY_PROTOCOL` — defines what a side question is, mandates 1-turn-only response,
requires the AI to end with the RETURN ANCHOR from the LESSON CONTEXT block, forbids setting
`exercise: null` for side questions (preserves exercise card). Injected between `DONT_UNDERSTAND_PROTOCOL`
and `TRANSLATE_PROTOCOL`.

5. `MICRO_TIP_GUIDANCE` — defines 4 tip types (pronunciation, grammar pattern, memory aid, common mistake),
limits to 1 tip per exercise delivered after confirming a correct answer, forbids tip-before-attempt and
tip-as-lecture. Injected between `TRANSLATE_PROTOCOL` and `ANTI_CHAOS_PROTOCOL`.

6. `READING_ASSISTANCE_PROTOCOL` — defines listening-first behaviour during reading: interrupt only for
stuck/incomprehensible/repeated errors, model with "Say: [word]", post-paragraph observation + comprehension
check. Injected into `buildFocusPhaseInstruction()` EXERCISES case when `sectionType === 'Reading'`.

**`buildSystemPrompt()` prompt structure (new order):**
```
${persona}
You NEVER say: ...
Student: ...
${lessonHeader}
${personaStyleHint}        ← NEW (per-teacher, every turn)
[agendaContext]            ← NEW (position + anchor + time + errors)
${focusSection || ragContext}
${topicLock}
${ALEX_TEACHING_PROTOCOL}
${DONT_UNDERSTAND_PROTOCOL}
${SIDE_QUESTION_RECOVERY_PROTOCOL}   ← NEW
${TRANSLATE_PROTOCOL}
${MICRO_TIP_GUIDANCE}               ← NEW
${ANTI_CHAOS_PROTOCOL}
${OPEN_TASK_GUIDANCE}
=== CURRENT INSTRUCTION ===
${phaseInstruction}   [readingNote added for Reading sections ← NEW]
OUTPUT JSON ONLY (speech: MAX 3 sentences ← explicit constraint)
```

**`lesson-ws.ts`:**
`processInput()` now computes:
```typescript
const elapsedMs   = meta.lessonStartedAt ? Date.now() - meta.lessonStartedAt : 0
const remainingMs = Math.max(0, MAX_LESSON_MS - elapsedMs)
```
and passes `{ remainingMs }` as the third argument to `orchestrator.process()`. The log line also now
emits `remaining_min` for observability. No other WS logic changed.

## 5. Frontend Changes

No frontend changes. Phase 4 is entirely backend/prompt improvements. The existing `ai_text`, `exercise`,
and `exercise_cursor_updated` events carry the improved responses without format change.

## 6. Database Changes

No database changes. No new migrations. Redis state shape unchanged.

## 7. Runtime Behavior Changes

Before:
- Teacher answered side questions (vocabulary, translation, pronunciation) but often forgot to return to
  the exercise — student was left in limbo.
- Teacher had no awareness of remaining lesson time — could start a new 10-item exercise with 2 minutes
  left.
- Emma and Alex sounded different only in their first greeting; after that, both followed the same
  per-turn style.
- No structured micro-tip injection — tips happened randomly or not at all.
- Reading exercises had no listening-first protocol — teacher treated them like grammar exercises.
- Recent session errors were not visible to the AI per turn — only the student profile's historical
  `error_patterns` (cross-session) were injected.

After:
- After any side question, teacher ends with the exact return anchor: "Now — Exercise N, number M: [text]."
  Student never wonders "where were we?" again.
- Teacher adjusts pacing to remaining time. At ≤8 min: explicit shorter-response nudge. At ≤3 min:
  forced wrap-up mode — no new exercises.
- Per-teacher style line injected every turn: Alex pushes thinking before hints; Emma acknowledges the
  attempt first. Both follow the same teaching protocol but the emotional register is consistent.
- Micro-tips appear naturally after correct answers, once per exercise, without derailing the lesson flow.
- Reading sections now explicitly tell the teacher to listen and interrupt only when necessary, with a
  precise post-paragraph structure.
- Last 2 session errors visible every turn in the agenda block — teacher can proactively address recurring
  mistakes.

## 8. WebSocket/Event Changes

No websocket event changes. No new events. No payload changes.

## 9. AI/Prompt Changes

The system prompt grows by approximately 350–430 tokens when all Phase 4 blocks are active (EXERCISES
phase with exercise > 0, remaining time set, errors present). Other phases grow by 200–300 tokens
(no agenda block, but side-question recovery, micro-tip guidance, and persona hint are always present).

Key behavioral changes injected into the prompt:
- `buildTeacherAgendaContext()` tells AI exactly where it is and where to return after side questions.
- `SIDE_QUESTION_RECOVERY_PROTOCOL` mandates 1-turn limit + return anchor for all off-topic student input.
- `MICRO_TIP_GUIDANCE` enables deliberate 1-sentence tips without the risk of them becoming mini-lectures.
- `READING_ASSISTANCE_PROTOCOL` changes teacher mode from "evaluate everything" to "listen first" for reading.
- `buildPersonaStyleHint()` reinforces personality contract on every turn.
- Output format comment: `"speech": "... — MAX 3 sentences"` reduces the chance of rambling responses.

## 10. Cost Impact

Cost impact:
- System prompt is ~350–430 tokens larger per turn in EXERCISES phase. At Claude's current pricing this
  adds approximately $0.0001–0.0002 per AI call (input tokens).
- `remainingMs` computation is a local Date.now() call — no API calls.
- No new AI calls, no additional TTS/STT usage, no new Redis keys.
- Net cost impact: negligible (< $0.001 per lesson extra).

## 11. Tests Performed

Tested:
- `backend: tsc --noEmit` — zero errors after all changes
- `frontend: tsc --noEmit` — zero errors (no frontend changes; verified no regression)
- Code inspection: `buildTeacherAgendaContext()` returns empty string in non-EXERCISES phases → no prompt pollution
- Code inspection: `readingNote` only appended when `sectionType === 'Reading'` → no impact on grammar sections
- Code inspection: `OrchestratorCallContext` is optional in both `AIHandlerFn` and `process()` → backward compatible; stub handler still works

Not tested (no live backend in this session — manual testing deferred as per project workflow):
- Live interruption scenario: student asks translation mid-exercise, teacher returns to anchor
- Live time-awareness: near-end prompt warnings appear in teacher speech
- Live reading exercise: teacher listening-first behavior
- Live micro-tip delivery after correct answer
- Live Emma vs Alex persona difference per turn

## 12. Known Remaining Issues

Remaining issues:
- **Return anchor only available in EXERCISES phase** (low): If student interrupts during DIAGNOSTIC or
  CONTEXT_INPUT, the agenda block is empty and there's no explicit return target. These phases are short
  and have simpler structure — this is acceptable for Phase 4. Phase 5/6 may add agenda for all phases.
- **Session errors (`errorsThisLesson`) only include submitted exercise answers** (low): Voice-transcript
  errors detected conversationally are not added to `errorsThisLesson`. The field is populated by
  `recordExerciseResult()` only. Phase 5 can extend error tracking.
- **`itemTotal = 0` issue from Phase 3 persists** (low): When AI omits `items[]`, itemTotal is 0 and
  the agenda block shows "Item 1 | currentItem" correctly but no total. Not introduced by Phase 4.
- **`grammarMastery` field unused** (cosmetic): Suppressed with `void` to satisfy strict mode.
  Phase 5 can use it for cross-session adaptation.

## 13. What Was Intentionally NOT Changed

Intentionally NOT changed:
- **Demo lesson runtime** (`useDemoSession`, `lesson-engine.ts`, `demo-routes.ts`) — untouched
- **Billing system** (`liqpay.ts`, `billing-routes.ts`, `subscription-service.ts`) — untouched
- **Auth system** (`auth/`, `AuthContext.tsx`) — untouched
- **WebSocket event contract** — no new events, no payload changes
- **Lesson FSM transitions** (`transitions.ts`) — untouched; forward-only phase model preserved
- **Exercise cursor tracking** (`orchestrator.ts` item advancement logic) — Phase 3 logic intact
- **`PaidExerciseCard.tsx`** — Phase 3 exercise card component untouched
- **Redis state shape / LessonState interface** — no new fields added to LessonState
- **Database migrations** — no migrations needed or added
- **Claude model ID** (`claude-sonnet-4-6`) — unchanged
- **Max tokens (400)** — unchanged (response length controlled via prompt instruction, not token limit)

## 14. Risks Introduced

New risks:
- **Prompt size growth**: ~430 tokens added to EXERCISES phase prompts. Total estimated prompt: ~2900–3400
  tokens (with OCR context). Still within 4000-token target. Monitor if more context blocks are added
  in Phase 5 — may require trimming older protocol blocks.
- **Return anchor format dependency**: `buildTeacherAgendaContext()` uses `state.currentItem` which is set
  by the Phase 3 cursor tracking in `orchestrator.ts`. If AI advances the item without updating the cursor
  (possible if `exercise.question` differs unexpectedly), the anchor will show the old item text. This is
  the same risk identified in Phase 3 Section 14 — not worsened.
- **`void grammarMastery`**: The field is now explicitly marked unused. If a future phase uses it, the
  `void` line must be removed. Low risk — it's in `buildSystemPrompt()` and obvious.

## 15. Deployment Notes

No new environment variables. No database migrations. No service restarts required beyond standard
Railway deploy.

Backend and frontend both pass `tsc --noEmit`. Standard Railway deploy (push to main) is sufficient.

## 16. Recommended Next Phase

Recommended next phase:
Phase 5 — Persistent Tips & Learning Memory

Phase 5 should add:
- `student_tips` PostgreSQL table (word, phrase, error type, lesson ref, timestamp)
- Tip creation from `state.errorsThisLesson` at lesson end
- Tip surfacing in future lesson prompts (inject last 5 tips into agenda block)
- Lesson memory snapshots (completed exercises, vocabulary taught, error summary) saved to DB at lesson end

Phase 4 has established the structural foundation: the agenda block already has an `errorsThisLesson`
injection point. Phase 5 should extend it with cross-session tips from the database.

## 17. Next Claude Session Instructions

Next Claude session should:
- Read `docs/PAID_LESSON_RUNTIME_ROADMAP.md` first (especially Phase 5 scope)
- Read `docs/handoffs/PHASE_4_HANDOFF.md` (this document) for context
- Read `docs/RUNTIME_GUARDRAILS.md` — next migration must be 011_*.sql
- Read `backend/src/ai/prompt-builder.ts` — understand the Phase 4 agenda block before adding Phase 5 tip injection
- Read `backend/src/lesson/types.ts` — understand current LessonState before adding new fields
- Read `backend/src/lesson/orchestrator.ts` — understand `errorsThisLesson` population before extending it

Continue from Phase 5 ONLY.

DO NOT:
- Remove or restructure the `SIDE_QUESTION_RECOVERY_PROTOCOL` block
- Remove `buildTeacherAgendaContext()` — it's the central Phase 4 contribution
- Remove the `READING_ASSISTANCE_PROTOCOL` from EXERCISES case
- Change `OrchestratorCallContext` without updating both `claude-handler.ts` and `openai-handler.ts`
- Add new WS events without updating `docs/WEBSOCKET_EVENT_CONTRACT.md` and the frontend union type
- Modify the demo lesson, billing, auth, or FSM transitions
- Change `max_tokens` (currently 400) — response length is controlled via prompt instructions
- Change the Claude model ID from `claude-sonnet-4-6`
