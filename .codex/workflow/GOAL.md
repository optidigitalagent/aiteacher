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
- [x] Deterministic teacher text can acknowledge self-correction/repetition
  without changing curriculum answers, scoring, or progression.
- [x] Teacher Brain speaking/warmup rules allow bounded topic-aware personal
  questions but do not open deterministic gap-fill free chat or replace grading.
- [x] Focused backend tests, TypeScript, and full backend suite pass.
- [ ] Running-product adult paid lesson smoke verifies real microphone RU, UA,
  and EN turns with the configured STT provider.
- [ ] Production deployment and post-deploy health/log checks are completed
  only after deploy approval.

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

Follow-up implementation is locally verified. Goal is not complete because the
new RU/UA selector/mixed-answer repair still needs commit, deployment,
post-deploy checks, and live adult paid microphone smoke.
