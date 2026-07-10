# Live QA Gate

## Purpose

Local tests are not enough for user-facing product goals. Live QA proves the
running product behavior through browser/API/WS/log evidence and adversarial
interaction.

## Automation First

Use automation before asking the user for manual verification:

- Playwright browser scenarios.
- API and WebSocket scripts.
- Browser console/page-error collection.
- Screenshots, video, and trace files.
- Backend/Railway logs correlated by session id.
- Runtime trace logs when safe and budgeted.
- Fake microphone/audio fixtures where possible.
- TTS decode/duration checks where voice output matters.

Manual verification is allowed only when a required physical or account-secret
step cannot be automated safely.

## Blocking Conditions

Any applicable item below blocks phase completion:

- no live/browser run after deploy;
- missing auth/test token required for the live scenario;
- no evidence for an affected mic/STT/TTS/browser/backend/prompt/curriculum
  surface;
- `voice_turn_empty`, `voice_unavailable`, lost turn, duplicate submit, stale
  transcript, cursor drift, wrong item, unhandled browser error, or text-only
  teacher turn when voice is required;
- critic cannot reproduce the claimed success path;
- production logs cannot be correlated to the tested session;
- deploy health passes but product behavior remains unverified.

## Evidence Record

Record:

```text
Live QA target:
Commit/deployment:
Scenario ids:
Browser evidence:
API/WS evidence:
Voice evidence:
Log correlation:
Adversarial critic result:
Failures:
Verdict: PASS | FAIL
```
