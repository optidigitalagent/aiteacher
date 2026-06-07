# RISK_REGISTER.md — Unresolved Risk Tracker

> Track every known risk that has NOT been fully mitigated.
> Update status when resolved. Never delete — mark RESOLVED with evidence.

---

## Template

```
### RISK-NNN — <short title>

**Status:** OPEN | MITIGATED | RESOLVED
**Severity:** P0 (critical) | P1 (high) | P2 (medium) | P3 (low)
**Area:** voice | curriculum | backend | frontend | deploy | billing
**Description:** <what could go wrong>
**Trigger:** <when this risk materializes>
**Mitigation:** <what reduces but does not eliminate the risk>
**Resolution:** <what would fully close this risk — and evidence when done>
**Opened:** <date>
**Updated:** <date>
```

---

## Open Risks

### RISK-001 — Kids Brain: No production voice test coverage

**Status:** OPEN
**Severity:** P1
**Area:** voice
**Description:** Unit tests mock Deepgram and ElevenLabs. Real voice flow
  (microphone → STT → AI → TTS → speaker) is only verified manually in production.
  A regression in pre-warm, buffering, or UtteranceEnd could go undetected.
**Trigger:** Any change to stt.ts, lesson-ws.ts mic_start/audio_chunk handlers
**Mitigation:** 1795 unit tests cover most code paths. Railway logs contain
  detailed diagnostics ([stt:config], [stt:lifecycle], [stt:audio]).
**Resolution:** Integration test that starts a real Deepgram connection
  (test API key) and verifies Open → audio → UtteranceEnd → transcript.
**Opened:** 2026-06-07
**Updated:** 2026-06-07

---

### RISK-002 — Kids Exercise: Visual assets not yet implemented

**Status:** OPEN
**Severity:** P2
**Area:** curriculum / frontend
**Description:** exerciseType and requiresVisualUI fields are sent in WS message.
  visualAssetUrl is null for all current exercises — no actual images loaded.
  Frontend shows placeholder. Students see blank image panel.
**Trigger:** Any exercise that sets requiresVisualUI: true
**Mitigation:** Frontend has graceful fallback (placeholder shown, no crash).
**Resolution:** Populate visualAssetUrl in kids-box-unit-01.ts with actual
  CDN URLs or Pinecone-backed image URLs. Verify in KidsClassroomPage.
**Opened:** 2026-06-07
**Updated:** 2026-06-07

---

### RISK-003 — Kids Brain: SONG and STORY exercise types not fully implemented

**Status:** OPEN
**Severity:** P2
**Area:** curriculum
**Description:** KidsTextbookActivityType includes SONG. KidsStoryPanel interface
  defined. But exercise-runner.ts has no SONG handler. turn-processor.ts has
  no story narration flow. Types added as schema foundations only (Phase 3).
**Trigger:** Curriculum reaches a SONG or STORY exercise
**Mitigation:** No SONG/STORY exercises in current Unit 1 chain.
**Resolution:** Implement SONG handler in exercise-runner.ts. Implement
  story narration loop in turn-processor.ts. Add tests.
**Opened:** 2026-06-07
**Updated:** 2026-06-07

---

### RISK-004 — Pre-existing fsm.test.ts failure

**Status:** OPEN
**Severity:** P3
**Area:** backend
**Description:** tests/fsm.test.ts fails on process.exit detection in test
  environment. This failure existed before Phase 1 and is unrelated to Kids.
**Trigger:** npm test (full suite)
**Mitigation:** Failure is isolated and pre-existing. All other 1857 tests pass.
**Resolution:** Fix fsm.test.ts to not call process.exit in test mode,
  or mock process.exit in the test environment.
**Opened:** 2026-06-07
**Updated:** 2026-06-07

---

### RISK-005 — Railway deploy not verified post Phase 1–3

**Status:** OPEN
**Severity:** P1
**Area:** deploy
**Description:** Phase 1–3 changes (exercise architecture) committed locally
  but Railway deploy not confirmed. Production may still run older code.
**Trigger:** Any production Kids session
**Mitigation:** git status shows commits ready to push.
**Resolution:** git push origin main → Railway deploy → verify
  [server] listening on port 4000 in Railway logs.
**Opened:** 2026-06-07
**Updated:** 2026-06-07

---

## Resolved Risks

### RISK-R001 — Deepgram HTTP 400 on Kids STT (RESOLVED)

**Status:** RESOLVED
**Evidence:** utterance_end_ms raised to 1000ms. Tests 191/191 pass.
  Commit ed0e797. Production logs should show no more HTTP 400.
**Resolved:** 2026-06-06

### RISK-R002 — Stale audio chunks dropped during STT reconnect (RESOLVED)

**Status:** RESOLVED
**Evidence:** kidsAudioPendingBuffer + kidsWaitingForSttReady implemented.
  Tests 1795/1795 pass. Commit a935927.
**Resolved:** 2026-06-07
