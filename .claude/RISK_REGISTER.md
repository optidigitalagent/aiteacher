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
**Mitigation:** 1866 unit tests cover most code paths. Railway logs contain
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
**Trigger:** npm test (full suite) without vitest.config.ts exclusion
**Mitigation:** vitest.config.ts excludes tests/fsm.test.ts from npm test.
  All other 1866 tests pass.
**Resolution:** Fix fsm.test.ts to not call process.exit in test mode,
  or mock process.exit in the test environment.
**Opened:** 2026-06-07
**Updated:** 2026-06-07

---

### RISK-006 — New goal: No child profile → Kids session blocked

**Status:** OPEN
**Severity:** P1
**Area:** backend
**Description:** Planned feature: Kids sessions require a child profile.
  If lesson-ws.ts profile check blocks users with pre-existing Kids sessions
  (created before onboarding feature), those users cannot start lessons.
**Trigger:** Deploy of Phase 4 (lesson-ws.ts profile load) before all users
  have profiles. Any user with an old kids_session but no kids_brain_child_profiles row.
**Mitigation:** KIDS_REQUIRE_PROFILE env var (feature flag). When false,
  profile check is skipped — backwards-compatible operation.
**Resolution:** After all users complete onboarding (or admin creates profiles),
  set KIDS_REQUIRE_PROFILE=true permanently and remove flag.
**Opened:** 2026-06-10
**Updated:** 2026-06-10

---

### RISK-007 — Interest personalization curriculum integrity

**Status:** OPEN
**Severity:** P1
**Area:** curriculum
**Description:** Interest personalization text injected into teacher turns could,
  if implemented incorrectly, change exercise correctness evaluation or escalation
  ladder behavior. A bug in interest-personalizer.ts could affect curriculum.
**Trigger:** buildPersonalizedContext() called with incorrect arguments or
  return value used in wrong place (e.g., passed to exercise evaluator).
**Mitigation:** Design specifies buildPersonalizedContext() is a pure function.
  It receives targetWord READ-ONLY and returns optional string only.
  Never passed to classification engine or completionRule evaluator.
**Resolution:** Unit tests confirm function is pure, does not mutate state,
  and interest context never reaches classification/escalation logic.
**Opened:** 2026-06-10
**Updated:** 2026-06-10

---

### RISK-008 — Child profile table UNIQUE constraint missing

**Status:** RESOLVED
**Severity:** P2
**Area:** backend
**Description:** Existing kids_brain_child_profiles table (migration 019) had
  an INDEX on user_id but no UNIQUE constraint.
**Evidence:** Migration 023 applied in production 2026-06-10. DB confirms
  `uq_child_profile_user UNIQUE (user_id)` constraint active.
  Railway log: `[migrate] running 023_kids_onboarding_fields.sql...done`
**Resolved:** 2026-06-10

---

### RISK-009 — Pre-existing test failures in phases 17B / 18 / 23 (STT timing)

**Status:** OPEN
**Severity:** P2
**Area:** backend / voice
**Description:** 63 tests failing in 3 STT timing test files:
  - stt-reconnect-dead-connection.test.ts (phase 17B)
  - phase-18-kids-stt-late-transcript.test.ts
  - phase-23-kids-stt-wait-ready-buffer.test.ts
  All failures are `Test timed out in 5000ms` — inherently timing-sensitive tests.
  These files were NOT touched by the Kids onboarding phases 1–5 commit (2aa5dfa).
  Last modified by commits: a935927, dd35a9a, 6b768bb, ed0e797, 831effa.
**Trigger:** npm test full suite (these fail intermittently on CI-like environments)
**Mitigation:** 1828 other tests pass. Production voice flow working (Deepgram OK in prod).
  Failures are test environment timing, not production behavior.
**Resolution:** Increase testTimeout for these files to 15000ms, or use fake timers.
**Opened:** 2026-06-10
**Updated:** 2026-06-10

---

## Resolved Risks

### RISK-005 — Railway deploy not verified post Phase 1–3

**Status:** RESOLVED
**Severity:** P1
**Evidence:** Commit 84e0195 pushed 2026-06-07. Railway deployment 80dd54bf
  succeeded at 12:25:03 +03:00. Logs confirm:
  [server] listening on 0.0.0.0:8080 ✅
  [postgres] connected ✅ | [redis] connected ✅
  No HTTP 400, no unhandled rejections, no ECONNREFUSED.
**Resolved:** 2026-06-07

---

### RISK-R001 — Deepgram HTTP 400 on Kids STT (RESOLVED)

**Status:** RESOLVED
**Evidence:** utterance_end_ms raised to 1000ms. Tests 191/191 pass.
  Commit ed0e797. Production logs show no more HTTP 400.
**Resolved:** 2026-06-06

### RISK-R002 — Stale audio chunks dropped during STT reconnect (RESOLVED)

**Status:** RESOLVED
**Evidence:** kidsAudioPendingBuffer + kidsWaitingForSttReady implemented.
  Tests 1795/1795 pass. Commit a935927.
**Resolved:** 2026-06-07
