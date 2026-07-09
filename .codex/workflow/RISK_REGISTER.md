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

### RISK-025 - Paid lesson follow-up repair needs production deploy and smoke

**Status:** MITIGATED
**Severity:** P1
**Area:** backend / voice / paid lesson runtime
**Description:** Post-deploy owner smoke still found text-only teacher turns
and stale exercise memory after item/exercise transitions.
**Trigger:** OpenAI TTS cooldown with `TTS_PROVIDER=openai`, queued student
input during a still-sending teacher turn, and soft-speaking `lesson_complete`
falling back to Teacher Brain while Redis lesson state still re-anchored to
Exercise 1.
**Mitigation:** Local repair allows provider fallback to ElevenLabs, treats
provider timeouts as failures, keeps `aiProcessing` locked through TTS,
discards queued input after lesson end, short-circuits soft-speaking
`lesson_complete`, and sends deterministic wrong-turn hints for engine-owned
fill-gap items. Evidence: `npx tsc --noEmit` -> exit 0 and
`npm test -- --reporter=dot --silent` -> exit 0; 66 files passed; 2134 tests
passed.
**Resolution:** Deploy after explicit approval and repeat authenticated owner
paid lesson smoke for voiced turns, stable item progression, and no stale
Exercise 1 Number 5 after lesson completion.
**Opened:** 2026-07-09
**Updated:** 2026-07-09

---

### RISK-024 - Paid lesson TTS and teacher wording need production retest

**Status:** MITIGATED
**Severity:** P1
**Area:** backend / voice / paid lesson runtime
**Description:** Manual owner paid-lesson smoke found two ordinary paid lesson
runtime defects: opening greeting audio did not include the final readiness
sentence, and the teacher wording contradicted the backend cursor after the
student answered `keen on`.
**Trigger:** Paid lesson section `1.1` uses ElevenLabs TTS and deterministic
vocabulary item progression after repeated wrong attempts.
**Mitigation:** Repair buffers ElevenLabs network chunks into one decodable
MP3 `audio_chunk`, and sends backend-authored deterministic teacher text for
engine correct/reveal turns instead of allowing LLM wording to contradict the
cursor. Evidence: `npx tsc --noEmit` -> exit 0 and
`npm test -- --reporter=dot --silent` -> exit 0; 66 files passed; 2133 tests
passed. Commit `a2c70bf1fe1e933762dd2ee38d9d4afd2db13635` deployed to Railway
production; backend deployment `2cfe99c8-2ef2-4c8c-9dc3-4f439d41d576` and
frontend deployment `3af88065-c052-4577-831d-717841a9b69c` are `SUCCESS`.
Automated health/log checks passed.
**Resolution:** Repeat the authenticated owner paid lesson smoke for full
greeting TTS and Exercise 1 item progression.
**Opened:** 2026-07-09
**Updated:** 2026-07-09

---

### RISK-023 - Owner billing exception must remain narrowly scoped

**Status:** MITIGATED
**Severity:** P2
**Area:** billing
**Description:** A backend paid-access exception could accidentally weaken the
ordinary paid lesson gate if it matched too broadly or trusted client state.
**Trigger:** Future edits to `getSubscription`, owner email matching, or lesson
start/payment guard logic.
**Mitigation:** The current implementation checks only the server-side
`users.email` row against exact `artenon92@gmail.com` after trim/lowercase.
Tests cover owner matching, non-owner no-profile blocking, and normal
subscription preservation. Auth remains required before callers reach the gate.
**Resolution:** Remove the exception when real LiqPay keys/subscription flow are
ready, or replace it with an explicit admin/owner entitlement managed in the DB.
**Opened:** 2026-07-09
**Updated:** 2026-07-09

### RISK-021 - Kids correct classification does not advance exercise in production

**Status:** OPEN
**Severity:** P1
**Area:** Kids backend / progression
**Description:** Live production Kids retest after the teacher-echo correction
  showed STT and classification working for `Blue.`: logs recorded
  `correct_hesitant`, confidence 0.8, deterministic source, and
  `eligibleForProgression=true`. However the same session kept
  `exerciseCorrectCount=0` and the target remained `blue`, causing the user to
  experience a loop.
**Trigger:** Kids production lesson receives a correct target transcript but
  the runtime/progression layer does not increment or advance.
**Mitigation:** Kids work is paused by explicit user priority change; do not
  enable more Kids V2 tier flags until this is understood. Existing full
  backend suite remains green, so this appears to require production/session
  reproduction rather than a broad local test failure.
**Resolution:** Re-prioritize Kids, reproduce with the logged session pattern,
  trace `eligibleForProgression` through Kids runtime state update, add a
  regression test, deploy, and verify live progression.
**Opened:** 2026-07-09
**Updated:** 2026-07-09

---

### RISK-022 - Local C drive full blocks npm unless temp/cache are redirected

**Status:** OPEN
**Severity:** P2
**Area:** tooling
**Description:** Local C: drive reported 0 free bytes. npm/npx commands can
  fail with `ENOSPC` unless cache and temp directories are redirected.
**Trigger:** Running npm, npx, Vite, or Vitest with default cache/temp paths.
**Mitigation:** Use `npm_config_cache=D:\codex-npm-cache`,
  `TEMP=D:\codex-temp`, and `TMP=D:\codex-temp` for local validation.
**Resolution:** Free disk space on C: or permanently configure npm/temp paths
  to a drive with sufficient space.
**Opened:** 2026-07-09
**Updated:** 2026-07-09

---

### RISK-001 — Kids Brain: No production voice test coverage

**Status:** OPEN
**Severity:** P1
**Area:** voice
**Description:** Unit tests mock Deepgram and ElevenLabs. Real voice flow
  (microphone → STT → AI → TTS → speaker) is only verified manually in production.
  A regression in pre-warm, buffering, or UtteranceEnd could go undetected.
**Trigger:** Any change to stt.ts, lesson-ws.ts mic_start/audio_chunk handlers
**Mitigation:** 1828 unit tests cover most code paths. Railway logs contain
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
  All other 1828 tests pass.
**Resolution:** Fix fsm.test.ts to not call process.exit in test mode,
  or mock process.exit in the test environment.
**Opened:** 2026-06-07
**Updated:** 2026-06-10

---

### RISK-006 — No child profile → Kids session blocked (feature flag)

**Status:** MITIGATED
**Severity:** P1
**Area:** backend
**Description:** Kids sessions require a child profile. Users without profiles
  cannot start lessons. Feature flag KIDS_REQUIRE_PROFILE=true enforces this.
**Trigger:** Deploy before all users have profiles.
**Mitigation:** KIDS_REQUIRE_PROFILE=true in production (set). Feature works.
**Resolution:** After 1 week stable, remove flag (permanent enforcement).
**Opened:** 2026-06-10
**Updated:** 2026-06-10

---

### RISK-020 — Kids `/kids` page crashes when profile API returns 404

**Status:** RESOLVED
**Severity:** P1
**Area:** frontend
**Description:** An authenticated user without a `kids_brain_child_profiles`
  row receives `GET /api/kids/child-profile -> 404`. The frontend represented
  that valid state as `profile=null`, but `/kids` rendered once before its
  redirect effect and read `profile.teacherId`, causing a blank screen.
**Trigger:** Opening `/kids` before creating a child profile.
**Mitigation:** `KidsPrototypePage` now treats `profile === null` as a
  non-rendering redirect state, so the existing `/kids/onboarding` redirect can
  complete without reading profile fields.
**Evidence:** `cd frontend; npm run build` -> exit 0. Local production-build
  Playwright reproduction with mocked authenticated `/api/me` and mocked
  `/api/kids/child-profile -> 404` -> final URL `/kids/onboarding`,
  `pageErrors: []`, exit 0.
**Opened:** 2026-07-09
**Resolved:** 2026-07-09

---

### RISK-007 — Interest personalization curriculum integrity

**Status:** MITIGATED
**Severity:** P1
**Area:** curriculum
**Description:** Interest personalization text injected into teacher turns could,
  if implemented incorrectly, change exercise correctness evaluation or escalation.
**Trigger:** buildPersonalizedContext() called with incorrect arguments or
  return value used in wrong place.
**Mitigation:** Design specifies buildPersonalizedContext() is a pure function.
  Returns optional string only. Never passed to classification/escalation.
  V2 extends this with PersonalizationEngine pure module pattern.
**Resolution:** Unit tests C1–C6 confirm no state mutation across all V2 tiers.
**Opened:** 2026-06-10
**Updated:** 2026-06-10

---

### RISK-009 — Pre-existing test failures in phases 17B / 18 / 23 (STT timing)

**Status:** RESOLVED
**Severity:** P2
**Area:** backend / voice
**Description:** 63 tests failing in 3 STT timing test files (timeout-sensitive).
  These files were NOT touched by the Kids onboarding phases 1–5.
  All failures are `Test timed out in 5000ms`.
**Trigger:** npm test full suite (intermittent on CI-like environments)
**Mitigation:** 1828 other tests pass. Production voice flow working.
**Resolution:** Resolved 2026-07-09. Reproduction showed the current 63 failures
  were not timing failures: real WS Kids STT fixtures returned a Kids session
  but no required `kids_brain_child_profiles` row, so production code correctly
  closed with `NO_CHILD_PROFILE` before STT assertions. Test fixtures now return
  minimal child profile rows and stale test-only `utterance_end_ms: 700` mocks
  are aligned to 1000ms. Evidence:
  `cd backend; npm test -- --reporter=dot --silent` -> exit 0; 64 files passed;
  2123 tests passed.
**Opened:** 2026-06-10
**Updated:** 2026-07-09

---

### RISK-010 — V2: warmupStartTime Redis serialization

**Status:** RESOLVED
**Severity:** P2
**Area:** backend
**Description:** warmupStartTime is stored in Redis as part of KidsSessionMemory JSON.
  If serialized as a Date object instead of Unix ms number, Redis JSON round-trip
  may lose type information (Date → string → NaN on parse).
**Trigger:** Implementation stores new Date() instead of Date.now() in Redis
**Mitigation:** TypeScript type enforces number (warmupStartTime: number | null).
  Strict TypeScript mode prevents Date assignment to number field.
**Resolution:** Phase 1 implemented Date.now() (number) — TypeScript type is
  `number | null`. Serialization test in personalization-engine.test.ts verifies
  JSON round-trip preserves numeric timestamps. tsc --noEmit passes.
**Opened:** 2026-06-10
**Updated:** 2026-06-10

---

### RISK-011 — V2: personalizationState update atomicity

**Status:** MITIGATED
**Severity:** P2
**Area:** backend
**Description:** personalizationState is a nested sub-object in KidsSessionMemory.
  If existing MULTI/EXEC session save pattern does not handle nested JSON updates
  atomically, interestRotationIndex or microDialogueCooldown could be stale.
**Trigger:** Concurrent turn processing (extremely unlikely in single-child session)
**Mitigation:** Kids sessions are single-user; concurrent turns are architecturally
  impossible (WebSocket is serial). Phase 1 implementation saves entire sessionMemory
  (including nested personalization sub-object) as a single JSON blob — atomic.
**Resolution:** Verified in Phase 1 code review. Nested object saved as part of
  full KidsSessionMemory JSON blob in a single Redis SET call.
**Opened:** 2026-06-10
**Updated:** 2026-06-10

---

### RISK-012 — V2: warmup timeout enforced client vs server

**Status:** RESOLVED
**Severity:** P1
**Area:** backend
**Description:** warmupStartTime timeout (15s) must be enforced server-side.
  If enforcement is client-side only, a slow or malicious client could hold
  the teacher in warmup mode indefinitely, consuming lesson budget.
**Trigger:** Client delays sending warmup response beyond 15 seconds.
**Mitigation:** Design specifies server-side enforcement in lesson-ws.ts.
  Existing silence detection (SILENCE_LONG > 3s → escalation) already handles
  long silences — warmup timeout is an additional guard.
**Resolution:** Phase 1 isWarmupTimedOut() called in processKidsBrainV1Turn
  before any warmup return phrase is sent. Timeout path falls through to normal
  Kids Brain processing. W5 test with vi.useFakeTimers() verifies server-side
  enforcement. Evidence: 62/62 tests pass.
**Opened:** 2026-06-10
**Updated:** 2026-06-10

---

### RISK-013 — V2: micro-dialogue creates open chat mode

**Status:** MITIGATED (Phase 5 implemented 2026-06-10: reply intercepted in
  handleKidsMicroDialogueReply before Kids Brain — deterministic single-turn
  return to curriculum; silence also drains the dialogue; flag
  KIDS_MICRO_DIALOGUE_ENABLED allows instant disable. Full resolution after
  Phase 8 integration test W-020.)
**Severity:** P1
**Area:** curriculum / safety
**Description:** Micro-dialogue fires between exercises. If TEACHER_CONTROLLED
  completion does not advance reliably, teacher could stay in micro-dialogue
  loop, creating an uncontrolled chat mode outside curriculum.
**Trigger:** Micro-dialogue completion logic has a bug (child response
  not triggering TEACHER_CONTROLLED advance).
**Mitigation:** Design specifies TEACHER_CONTROLLED (any response = advance).
  microDialogueCooldown resets to 0 immediately on fire.
  Feature flag KIDS_MICRO_DIALOGUE_ENABLED=false for instant disable.
**Resolution:** Phase 5 integration test M3–M4: verify micro-dialogue advance
  and curriculum return. Unit test M5: verify no scoring during micro-dialogue.
**Opened:** 2026-06-10
**Updated:** 2026-06-10

---

### RISK-014 — V2: teacher persona TTS voice same for all (Phase 6 limitation)

**Status:** OPEN
**Severity:** P3
**Area:** frontend / UX
**Description:** Phase 6 teacher persona differentiation affects text only.
  Lucy and Tom use the same ElevenLabs TTS voice. A child who chose Tom
  expecting a different voice will hear the same audio as Lucy.
  This reduces persona distinctiveness.
**Trigger:** Any user who chose Tom expecting a different voice
**Mitigation:** Design document (Section 3.5) explicitly documents this limitation.
  Text-level persona difference (calm vs enthusiastic) still provides value.
  Future phase can add per-persona voice IDs (KIDS_TEACHER_VOICE_MAP env var).
**Resolution:** Implement per-persona ElevenLabs voice IDs in a future phase.
**Opened:** 2026-06-10
**Updated:** 2026-06-10

---

### RISK-015 — V2: recovery injection lacks turn-processor integration test (W-019)

**Status:** OPEN
**Severity:** P3
**Area:** backend / curriculum
**Description:** Phase 4 ENCOURAGEMENT-rung recovery injection in
  turn-processor.ts is unit-tested at the engine level and code-reviewed,
  but no integration test drives a full turn through the escalation path
  with KIDS_INTEREST_RECOVERY_V2 enabled.
**Trigger:** Refactor of turn-processor Step 6 escalation block.
**Mitigation:** Flag default-off; existing escalation tests cover the
  standard path; engine eligibility fully unit-tested (133/133).
**Resolution:** Phase 8 adds integration test: ENCOURAGEMENT tier turn with
  flags on → mainText is the interest recovery line; ladder unchanged.
**Opened:** 2026-06-10
**Updated:** 2026-06-10

---

### RISK-016 — wiring tests cap processKidsBrainV1Turn at 12,000 chars

**Status:** OPEN
**Severity:** P3
**Area:** backend
**Description:** session-analytics.test.ts and phase-16b-runtime-safety.test.ts
  extract processKidsBrainV1Turn with regex window [\s\S]{1,12000}. The function
  is at 11,599 chars after Phase 6 (closing added as a single helper call) —
  ~400 chars of headroom. Any future inline addition will silently break both
  guard tests.
**Trigger:** Code added inside processKidsBrainV1Turn.
**Mitigation:** Phase 5/6 logic extracted to helpers (handleKidsMicroDialogueReply,
  maybeFireKidsMicroDialogue, buildKidsTurnPersonalization,
  maybeSpeakKidsPersonaClosing). Pattern documented in DECISIONS.md.
**Resolution:** Refactor processKidsBrainV1Turn into smaller functions, or
  switch the guard tests to AST-based extraction.
**Opened:** 2026-06-10
**Updated:** 2026-06-12 (Phase 6: 11,520 → 11,599)

---

### RISK-017 — V2: micro-dialogue lacks lesson-ws integration test (W-020)

**Status:** RESOLVED 2026-06-12 (Phase 8: phase-8-personalization-integration.test.ts
  — engine+caller-contract chain tests mirroring lesson-ws mutations exactly,
  plus static wiring asserts: interception before processKidsBrainTurn, reply
  unscored, cooldown reset after fire)
**Severity:** P3
**Area:** backend / curriculum
**Description:** The fire→reply→return flow (maybeFireKidsMicroDialogue →
  handleKidsMicroDialogueReply) is unit-tested at engine level and code-reviewed,
  but not driven end-to-end through processKidsBrainV1Turn.
**Trigger:** Refactor of lesson-ws personalization wiring.
**Mitigation:** Flag default-off; engine fully unit-tested (167/167).
**Resolution:** Phase 8 integration test: advance 3 exercises with flags on →
  dialogue fires; child reply → return phrase, exerciseCorrectCount unchanged.
**Opened:** 2026-06-10
**Updated:** 2026-06-10

---

### RISK-018 — V2: persona greeting/closing lack lesson-ws integration tests (W-022/W-023)

**Status:** RESOLVED 2026-06-12 (Phase 8: static wiring asserts — greeting after
  startKidsBrainSession, assignment only to .teacherText, null-guarded; closing
  inside natural-close branch before persistKidsBrainAnalytics and lesson_end.
  W-024 multi-placeholder pinned directly via exported substituteChildName)
**Severity:** P3
**Area:** backend / curriculum
**Description:** The persona greeting packet override (lesson-ws.ts ~1408) and
  maybeSpeakKidsPersonaClosing ordering vs lesson_end (~1809) are engine-unit-
  tested and code-reviewed by 5 reviewers, but not driven through the WS layer.
  Also W-024: multi-placeholder [childName] substitution only indirectly pinned.
**Trigger:** Refactor of session-bootstrap packet order or the natural-close path.
**Mitigation:** Flags default-off; engine fully unit-tested (188/188 incl.
  $-injection regression tests); greeting override no-ops when no teacher_text
  packet found.
**Resolution:** Phase 8 integration tests: session start with flags on →
  first teacher_text packet carries persona openingPhrase; natural close →
  persona closing ai_text sent before lesson_end; flags off → byte-identical flow.
**Opened:** 2026-06-12
**Updated:** 2026-06-12

---

### RISK-019 — static wiring-guard robustness (W-028/W-029)

**Status:** OPEN
**Severity:** P3
**Area:** backend / testing
**Description:** Two soft anchors in the Phase 8 static guards:
  (a) W-028 — the "interception returns before scoring" assert uses
  toContain('return'), which any 'returnText' substring would also satisfy;
  (b) W-029 — extractFunctionBody lazy-matches to the first column-0 '}',
  so a future column-0 brace inside a guarded function (e.g. template
  literal) would silently truncate the analyzed body.
**Trigger:** Refactors of lesson-ws personalization wiring or guarded helpers.
**Mitigation:** Anchors currently match the real code exactly; guards fail
  loudly (in the safe direction) on most drift.
**Resolution:** Harden to bare-statement regex / brace-balanced extraction
  in a maintenance pass.
**Opened:** 2026-06-12
**Updated:** 2026-06-12

---

### RISK-020 - teacher retry echo can be mistaken for child target answer

**Status:** OPEN
**Severity:** P2
**Area:** backend / Kids voice / STT
**Description:** Live production evidence showed Deepgram can return a mixed
  transcript such as `Say again. Blue.` while the target is `blue`. Before the
  2026-07-09 fix this caused `social_speech` via `timeout_fallback` and no
  progression. After the fix, the exact allowlisted pattern `say again` plus
  trailing target word(s) is normalized to the target word. The remaining risk
  is a false positive if pure speaker echo with no child speech produces the
  same exact phrase.
**Trigger:** Teacher retry prompt audio leaks into the child's next mic turn or
  the child repeats the teacher prompt together with the target word.
**Mitigation:** Allowlist is intentionally narrow: only 3-4 word transcripts
  with prefix `say again` and one or more trailing copies of the current target
  are corrected. Arbitrary multi-word phrases remain blocked (`I said blue`,
  `the blue`, `Yes. I like Roblox.`, `Say again.`).
**Resolution:** Monitor production logs for `method=teacher_echo_target_suffix`
  during live retest; if false positives appear, move the fix to a richer
  echo-suppression signal using audio timing/TTS playback metadata instead of
  transcript shape alone.
**Opened:** 2026-07-09
**Updated:** 2026-07-09

---

## Resolved Risks

### RISK-005 — Railway deploy not verified post Phase 1–3

**Status:** RESOLVED
**Severity:** P1
**Evidence:** Commit 84e0195 pushed 2026-06-07. Railway deployment 80dd54bf
  succeeded at 12:25:03 +03:00. Logs confirm server listening on 0.0.0.0:8080.
**Resolved:** 2026-06-07

---

### RISK-008 — Child profile table UNIQUE constraint missing

**Status:** RESOLVED
**Severity:** P2
**Evidence:** Migration 023 applied in production 2026-06-10. DB confirms
  `uq_child_profile_user UNIQUE (user_id)` constraint active.
**Resolved:** 2026-06-10

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
