# GOAL: Paid Teacher Multilingual Voice and Conversational Tutor Behavior

## Goal

Make the ordinary paid teacher handle Russian, Ukrainian, and English turns
reliably while sounding more like a live tutor: multilingual clarification
must not be graded as an English answer, English answers must not be forced
through the wrong language recognizer, one-turn self-correction/repetition must
be accepted when the final form is correct, and conversational follow-ups must
stay bounded and curriculum-safe.

## Implementation Context

- Adult paid STT used `DEEPGRAM_LIVE_OPTIONS` with default `language=en`,
  which can force Russian/Ukrainian speech through an English recognizer.
- Kids STT shares the same base options but must remain protected; it now
  explicitly overrides back to `nova-2` / `en`.
- Deterministic expected-answer cleanup already accepted repeated exact
  expected phrases and punctuation-separated self-correction, but not
  unpunctuated "wrong then correct" tails such as `Like keen on`.
- Teacher deterministic text could accept the normalized answer but could not
  mention that the student corrected themselves.
- Prompt rules already support bounded speaking/warmup follow-ups; the rule now
  explicitly allows tiny topic-tied personal questions only when they cannot
  replace grading or progression.

## Acceptance Criteria

- [x] Adult paid STT defaults are multilingual for RU/UA/EN voice turns without
  using Live-API-invalid `detect_language`.
- [x] Kids STT config remains explicitly `nova-2` / `en` with the existing
  Kids timing options.
- [x] Deterministic current expected answers accept unpunctuated one-turn
  self-correction when the final tail exactly matches the backend expected
  answer.
- [x] Negated phrases such as `not keen on` and possessive phrases such as
  `my hobby` are not falsely normalized to the expected answer.
- [x] Repeated expected answers such as `keen on keen on` remain accepted and
  acknowledged naturally.
- [x] Paid classroom has a minimal RU/UA selector for adult voice turns.
- [x] `mic_start.language` is validated server-side and adult Deepgram live
  options can be rebuilt with `ru`, `uk`, or default `multi` per turn.
- [x] Short mixed answer lists containing the current expected answer are
  accepted, while `not keen on`, `not keen on like`, `my hobby`, and
  `my hobby spare time` remain rejected.
- [x] RU/UA clarification questions during deterministic paid gap-fill items
  are answered as clarification and return to the current item without grading
  the native-language question as an English answer.
- [x] English task-help/confusion during deterministic paid gap-fill items is
  answered as help and returns to the current item without feedback, cursor
  movement, or attempt-count changes.
- [x] Direct word-help requests and ASR variants such as `which world is it`
  and `help me with this worms` are answered as current-item help without
  feedback, cursor movement, teacher-brain input, or attempt-count changes.
- [x] Paid WebSocket voice routing sends current-answer help requests such as
  `Which world is it? Which world is it? I don't know.` to deterministic
  current-item help before the off-topic guard can answer about `worlds`.
- [x] Unknown RU/UA word-help fallback during deterministic gap-fill gives the
  current expected answer instead of a dead-end `I'm not sure` response.
- [x] Paid classroom sends `mic_start` before PCM capture can emit the first
  `audio_chunk`, preventing first-word audio from being ignored as stale.
- [x] Paid classroom clears the input/transcript preview at mic-turn start and
  guards briefly against late previous-turn transcript events repopulating it.
- [x] Adult paid voice finalization submits/logs the captured turn id rather
  than a mutable current turn id.
- [x] Deterministic teacher text can acknowledge self-correction/repetition
  without changing curriculum answers, scoring, or progression.
- [x] Teacher Brain speaking/warmup rules allow bounded topic-aware personal
  questions but do not open deterministic gap-fill free chat or replace grading.
- [x] Focused backend tests, TypeScript, frontend production build, and full
  backend suite pass.
- [ ] Running-product adult paid lesson smoke verifies real microphone RU, UA,
  and EN turns with the configured STT provider, including no lost first words,
  no split half-turns, no stale transcript carryover, and no missing
  `student_message`.
- [x] Production deployment and post-deploy health/log checks are completed for
  the latest mic/help repair.
- [ ] Final acceptance still requires authenticated live microphone smoke.

## Scope Boundaries

In scope:
- Adult paid lesson STT option defaults.
- Adult paid voice transcript normalization.
- Adult paid deterministic teacher wording for normalized self-correction.
- Teacher Brain prompt/rule text under `backend/src/ai/**`.
- Backend tests for the above.

Protected:
- Billing, payment, auth, LiqPay, and subscription logic.
- Kids Brain runtime behavior and curriculum logic, except explicit test-pinned
  proof that Kids STT config remains unchanged.
- `docs/master-prompt.md`.
- Curriculum accepted answers, scoring, exercise order, and progression.
- Secret or environment files.

## Current State

The previous "brain-side ready" claim is stale. A user-provided live transcript
showed that the paid teacher still mishandled direct word-help / ASR-confused
requests (`worms`, `world`, `which word is it`) and RU/UA unknown word-help by
giving generic non-helpful responses. The same report described mic turn
splitting, missing sends, and stale transcript carryover. Local repair now:

- answers direct current-word help without grading or changing cursor/attempts;
- uses the current expected answer when RU/UA word-help fallback would otherwise
  say `I'm not sure`;
- sends `mic_start` before frontend PCM capture can emit `audio_chunk`;
- submits adult paid voice turns with the captured turn id.

Local targeted tests, backend TypeScript, frontend build, focused regression,
and the full backend suite pass. Commit `703da40` is pushed and deployed to
Railway production; post-deploy health/log checks passed. Authenticated paid
microphone smoke remains pending.
