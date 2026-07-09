# GOAL_PROGRESS.md

## ACTIVE GOAL OVERRIDE - 2026-07-09

**Current active goal:** Ordinary Mentium lesson mode production readiness.

**User instruction:** After live Kids retest looped, user said to stop focusing
on Kids mode and focus on the ordinary mode because it is much more important.

**Kids evidence from the latest live retest:**
- Browser console on production showed the deployed bundle `index-DARbdknK.js`,
  successful auth, production WebSocket connection after one transient 1006,
  `lesson_ready`, `ai_text`, `audio_chunk`, `teacher_turn_end`, repeated
  `mic_start`, outgoing `audio_chunk`, incoming `transcript`,
  `student_message`, and subsequent teacher turns. This proves the mic,
  WebSocket, STT, Kids Brain turn handling, and TTS were active.
- Production logs for session `55c599ad-6539-4b19-a344-5293c1b9652d` showed
  first two turns with audio but no transcript (`finalChars=0`,
  `source=none`, classified `silence_long`), then repeated raw transcript
  `Blue.` normalized as `blue.`.
- The Kids classifier marked `Blue.` as `correct_hesitant`, confidence `0.8`,
  deterministic source, `eligibleForMasteryUpdate=true`, and
  `eligibleForProgression=true`.
- Despite correct classification, Kids logs kept `exerciseCorrectCount=0` and
  the target remained `blue`. Therefore the current Kids symptom is no longer
  dead mic or the earlier `Say again. Blue.` correction failure; it is an
  unresolved Kids progression loop after correct classification. This is
  recorded as a paused risk.

**Ordinary mode intake and baseline evidence:**
- No product-code edits were made for ordinary mode.
- Local C: drive had no free space, so npm commands were run with
  `npm_config_cache=D:\codex-npm-cache`, `TEMP=D:\codex-temp`, and
  `TMP=D:\codex-temp`.
- `cd backend; npx tsc --noEmit` -> exit 0.
- `cd backend; npx vitest run src/demo src/exercises/runtime-qa --reporter=dot --silent`
  -> exit 0; 4 files passed; 298 tests passed.
- `cd backend; npm test -- --reporter=dot --silent`
  -> exit 0; 64 files passed; 2127 tests passed.
- `cd frontend; npm run build` -> exit 0; production build passed with the
  existing Vite chunk-size warning only.
- Production `GET https://aiteacher-production-cae8.up.railway.app/health`
  -> HTTP 200, `status=ok`, postgres ok, redis ok.
- Production `GET https://aware-alignment-production.up.railway.app/demo/setup`
  -> HTTP 200.
- Production `GET https://aiteacher-production-cae8.up.railway.app/lesson/sections/status`
  -> HTTP 200 and returned ready ordinary sections. GOLD ready candidates:
  `1.1`, `1.2`, `1.4`, `2.1`, `2.3`, `3.1`, `4.1`, `4.3`, `5.1`, `5.3`,
  `6.1`, `6.3`, `7.1`, `7.3`, `8.1`, `8.3`.

**Review gate for intake/baseline:**
- backend reviewer: NOT APPLICABLE - no backend product code changed.
- frontend reviewer: NOT APPLICABLE - no frontend product code changed.
- curriculum reviewer: NOT APPLICABLE - no curriculum, scoring, progression,
  or prompt behavior changed.
- kids safety monitor: NOT APPLICABLE - active goal explicitly excludes Kids
  product changes; latest Kids defect is recorded only as a paused risk.
- QA tester: RUN -> PASS for local ordinary baseline and production reachability.
- acceptance auditor: NOT APPLICABLE - goal is not complete; production demo
  and paid ordinary smoke remain.

**Commit/deploy state:**
- Product code: no ordinary-mode product change.
- Deployment: no new deploy needed for this intake because no product code
  changed and production endpoints are already reachable.
- Commit: no product commit created for ordinary mode. Workflow checkpoint
  pending local commit only.

**Next action:** Production smoke ordinary Mentium flow: demo classroom first,
then paid classroom if legitimate auth/subscription is available.

## CURRENT PHASE
Phase: **Ordinary mode Phase 1 - Demo production smoke**
Started: 2026-07-09
Last updated: 2026-07-09

> State reconstruction 2026-06-13: previous run completed Phase 8 implementation
> (integration test file + W-024/W-026 engine tests + W-025 doc amend) AND ran
> the 5-reviewer gate, but the session died on an API 401 before the Phase 8
> verdicts were persisted to REVIEW_REPORT.md or the tracking files advanced.
> This run reconciled: re-ran the review gate (all 5 PASS), recorded verdicts,
> marked Phase 8 COMPLETE, committed, advanced to Phase 9. Code was source of
> truth: tsc 0; engine+integration 284/284; full suite 2060/63 pre-existing.

> State reconstruction 2026-06-12: previous run hit the session limit mid
> Phase 6 (after implementation + tests were written; the engine test run
> was interrupted). Code verified as source of truth: Phase 6 functions and
> 19 tests present; tsc exit 0; engine 186/186; full suite 2014/63. Review
> gate then run (5 reviewers) → 1 safety FAIL ($-injection in
> substituteChildName) → fixed + 2 regression tests → re-review PASS.

> State reconstruction 2026-06-10: Phase 4 implementation was found COMPLETE
> in the working tree (engine + turn-processor injection + 18 tests) while
> tracking files were stale (this file showed Phase 4 unchecked; NEXT_ACTION
> showed Phase 1 review; REVIEW_REPORT showed Phase 1). Evidence re-verified
> fresh: tsc exit 0, engine 133/133, full suite 1961/63 pre-existing.
> Phase 4 review gate then run → PASS. Tracking resynchronized.

---

## ACTIVE GOAL SUMMARY
Kids Personalization V2 — Make Kids lessons feel personally tailored to each child
while keeping Kid's Box curriculum fully authoritative.

Previous goals complete:
- Kids Brain V1: 28/28 criteria verified (2026-06-09)
- Kids Onboarding V1: 23/23 ACs verified, deployed to Railway (2026-06-10)

---

## COMPLETED TASKS

| # | Task | Agent | Evidence | Timestamp |
|---|------|-------|----------|-----------|
| 1 | Phase 0 design document | goal-executor (planner role) | docs/kids-personalization-v2.md created; covers all 10 required sections | 2026-06-10 |
| 2 | Phase 0 multi-reviewer sign-off | all reviewers | REVIEW_REPORT.md — all 6 agents PASS | 2026-06-10 |
| 3 | Phase 1 implementation (warmups) | goal-executor (implementer role) | 4 files changed + 62 tests; tsc exit 0 | 2026-06-10 |
| 4 | Phase 1 review gate | backend-reviewer + curriculum-reviewer + qa-tester | REVIEW_REPORT.md PASS; tsc exit 0; 62/62 new tests; full suite 1890 pass / 63 pre-existing (= baseline); resume path verified to preserve warmup state | 2026-06-10 |
| 5 | Phase 2 implementation (examples) | goal-executor (implementer role) | EXAMPLE tier in personalization-engine.ts + lesson-ws.ts injection at exercise advance + 24 new tests | 2026-06-10 |
| 6 | Phase 2 review gate | backend-reviewer + curriculum-reviewer + qa-tester | E1–E5 verified; tsc exit 0; 86/86 engine tests; full suite 1914 pass / 63 pre-existing (= baseline + 24) | 2026-06-10 |
| 7 | Phase 3 implementation (praise) | goal-executor (implementer role) | PRAISE tier (2 persona variants × 12 interests) + lesson-ws lead-in helper + 29 new tests; fixed wiring-test regression by extracting buildKidsPersonalizationLeadIn | 2026-06-10 |
| 8 | Phase 3 review gate | backend-reviewer + curriculum-reviewer + qa-tester | P1–P5 verified incl. Lucy≠Tom string diff; readiness-turn praise suppression; tsc exit 0; 115/115 engine tests; full suite 1943 pass / 63 pre-existing (= baseline + 29) | 2026-06-10 |
| 9 | State reconstruction | goal-executor | Phase 4 impl found complete but untracked; NEXT_ACTION/REVIEW_REPORT stale; evidence re-verified fresh (tsc 0, 133/133 engine, 1961/63 suite); tracking resynced | 2026-06-10 |
| 10 | Phase 4 implementation (recovery) | goal-executor (implementer role) | RECOVERY tier in personalization-engine.ts (12 templates, buildInterestRecovery, KIDS_INTEREST_RECOVERY_V2 flag) + turn-processor.ts ENCOURAGEMENT-rung injection + 18 new tests | 2026-06-10 |
| 11 | Phase 4 review gate | backend-reviewer + curriculum-reviewer + qa-tester | R1–R4 verified (tier gate in turn-processor:610; "Say [word]!" suffix ×12; C1/C4 intact); tsc exit 0; 133/133 engine tests; full suite 1961 pass / 63 pre-existing (= baseline + 18); W-019 logged | 2026-06-10 |
| 12 | Phase 5 implementation (micro-dialogues) | goal-executor (implementer role) | MICRO_DIALOGUE tier (12 templates, buildMicroDialogueTurn, return phrase, in-progress detection) + microDialogueInProgress field + lesson-ws interception/fire helpers + 34 new tests; cooldown decision in DECISIONS.md; 2 wiring tests fixed by helper extraction | 2026-06-10 |
| 13 | Phase 5 review gate | backend-reviewer + curriculum-reviewer + qa-tester | M1–M5 verified (reply intercepted before Kids Brain — never scored; 1 interest sentence/turn; example suppressed on dialogue turn); tsc exit 0; 167/167 engine tests; full suite 1995 pass / 63 pre-existing (= baseline + 34); RISK-013 → MITIGATED; W-020/W-021 logged | 2026-06-10 |
| 14 | Phase 6 implementation (teacher personas) | goal-executor (implementer role) | isTeacherPersonaEnabled/substituteChildName/buildPersonaGreeting/buildPersonaClosing in engine + lesson-ws greeting packet override + maybeSpeakKidsPersonaClosing on natural close + 19 tests T1–T6; interrupted by session limit, reconstructed 2026-06-12 from code | 2026-06-10/12 |
| 15 | Phase 6 review gate | backend-reviewer + curriculum-reviewer + kids-safety-monitor + qa-tester + acceptance-auditor | T1/T2/T5 + C1/C3/C4/C5 verified; safety FAIL on $-sequence interpretation in substituteChildName → fixed with function replacer + 2 regression tests → safety re-review PASS by execution; tsc exit 0; 188/188 engine tests; full suite 2016 pass / 63 pre-existing (= baseline + 21); W-022/023/024/025 logged | 2026-06-12 |
| 16 | Per-phase commit baseline | goal-executor | Phases 1–6 committed as 659d95a (acceptance-auditor recommendation: per-phase commits enable precise scope audits) | 2026-06-12 |
| 17 | Phase 7 implementation (safety) | goal-executor (implementer role) | substituteChildName hardening (trim → collapse \s+ → slice(0,100), MAX_CHILD_NAME_CHARS=100) + 12 safety tests: S1 determinism (90 texts), S3/S4 template sweeps, Section 4.3 truncation via public API, name cap/collapse, S5 fallback chain | 2026-06-12 |
| 18 | Phase 7 review gate | backend-reviewer + curriculum-reviewer + kids-safety-monitor + qa-tester + acceptance-auditor | S1–S5 verified by code audit + executed adversarial name attacks (500-char, $-sequences, [childName], BOM/whitespace); all 4.2 budgets enforced + pinned; diff scope exactly 2 files; tsc exit 0; 200/200 engine tests; full suite 2028 pass / 63 pre-existing (= baseline + 12); W-026/W-027 logged | 2026-06-12 |
| 19 | Phase 8 implementation (testing) | goal-executor (implementer role) | NEW phase-8-personalization-integration.test.ts (25 tests): W-019 runtime recovery injection + C1–C6 flags-on-vs-off curriculum equivalence (full fingerprint, multi-turn) + W-020 micro-dialogue chain + W-022/023 persona wiring + W-027 single-sentence (static); engine test +58 (W-024 multi-placeholder ×5, W-026 S3/S4 sweep ×2); substituteChildName exported (1-line, test-enablement); docs W-025 amend | 2026-06-12 |
| 20 | Phase 8 review gate | backend-reviewer + curriculum-reviewer + kids-safety-monitor + qa-tester + acceptance-auditor | ALL 5 PASS. W-019 + C1–C6 proven at TRUE RUNTIME (processKidsBrainTurn, identical curriculum fingerprint flags-on/off); W-020/022/023/027 static wiring; W-024/026 pinned; W-025 doc amended; scope = exactly 1 production line (export); tsc exit 0; teacher-response 284/284; full suite 2060 pass / 63 pre-existing (= baseline + 32, 0 new); W-028/029 (RISK-019) logged. Gate re-run + recorded this session after prior session's API-401 loss | 2026-06-13 |

---

## ACTIVE TASK

**Task:** Phase 9 — Deployment
**Status:** CODE DEPLOYED + VERIFIED (flags OFF). Flag-enablement + production
  behavioral verification PENDING USER GO-AHEAD (manual prod verification +
  prod env mutation — outside autonomous boundary).

**Deploy evidence (2026-06-13):**
- Pre-deploy gates: tsc --noEmit → exit 0; npm test → 2060 pass / 63 pre-existing
  STT failures (0 new); git tree clean, HEAD = origin/main = a637c55, 0 ahead.
- Railway (auto-deploy on push, GitHub-linked, project thriving-balance/production):
  - service `aiteacher` (Node backend): commit a637c55, status SUCCESS, 2026-06-13T16:14:06Z
  - service `aware-alignment` (Caddy frontend): commit a637c55, status SUCCESS, 2026-06-13T16:14:06Z
- Backend startup logs (commit a637c55): `[server] listening on 0.0.0.0:8080`;
  `[postgres] connected` → tables ready (23 migrations incl. kids 019-023);
  `[redis] connected`; `[tts:provider_check]`; `[ws] LessonWS attached`; Langfuse active.
  No HTTP 400 / no unhandled rejection / no ECONNREFUSED / no missing-module.
  (One benign `[server] Redis startup error ... already connecting` race — self-heals;
   redis confirmed connected.)
- Smoke checks: GET /health → HTTP 200 {postgres:ok, redis:ok} uptime 94s;
  frontend GET / → HTTP 200.
- Feature flags: `railway variables` → NONE of the 7 KIDS_* V2 flags set = ALL DEFAULT OFF.
  Engine confirms each builder gates on master AND per-tier flag (engine.ts 259-614),
  so flags-OFF = zero behavior change vs pre-V2.

**Blocked next steps (need user go-ahead):**
  Enable 7 flags one phase at a time in prod env (master KIDS_PERSONALIZATION_V2 first),
  verify logs between each, run a live Kids voice session per tier to satisfy
  "All feature flags tested in production", then acceptance-auditor FINAL verdict.

**Demo readiness QA checkpoint (2026-07-09):**
- User requested current project stage and presentation readiness for ordinary
  Mentium textbook mode and Mentium Kids textbook mode.
- No product-code edits were made. Worktree clean before and after.
- Backend TypeScript: `cd backend && npx tsc --noEmit` -> exit 0.
- Targeted adult/runtime + Kids routing/STT config suite:
  `npx vitest run src/lesson src/exercises src/behavior-runtime src/runtime src/ws/__tests__/phase-16j2-kids-start-billing-guard-fix.test.ts src/ws/__tests__/phase-21-kids-stt-target-word-correction.test.ts src/voice/__tests__/kids-stt-config-parity.test.ts src/voice/__tests__/stt-deepgram-options.test.ts`
  -> 5 files, 204 tests passed, exit 0.
- Kids Brain suite: `npx vitest run src/kids-brain` -> 42 files,
  1486 tests passed, exit 0.
- API/auth targeted suite:
  `npx vitest run src/api/__tests__/kids-child-profile-api.test.ts src/auth/__tests__/require-auth-guard.test.ts`
  -> 2 files, 23 tests passed, exit 0.
- Frontend build: `cd frontend && npm run build` -> exit 0; Vite chunk-size
  warning only.
- Full backend suite: `cd backend && npm test -- --reporter=default` -> exit 1;
  586 suites total, 553 passed, 33 failed; 2123 tests total, 2060 passed,
  63 failed. All current failing files are Kids WS/STT real-smoke paths:
  `kids-brain-v1-real-ws-smoke`, `phase-16g-kids-stt-integration`,
  `phase-16k-kids-stt-turn-finalization`, `phase-18-kids-stt-late-transcript`,
  `phase-23-kids-stt-wait-ready-buffer`, `stt-reconnect-dead-connection`.
  Current failure symptom includes Kids sessions closing with `NO_CHILD_PROFILE`
  before voice/STT assertions complete.
- Adult Focus matrix: 25 Focus 2 sections, 16 GOLD, 7 SILVER, 2 BLOCKED.
  GOLD recommended presentation sections: 1.1, 1.2, 1.4, 2.1, 2.3, 3.1,
  4.1, 4.3, 5.1, 5.3, 6.1, 6.3, 7.1, 7.3, 8.1, 8.3.
- Kids textbook curriculum loaded: `kb1-u01-l02` "Colours" with 7 target words
  and 14 exercises; exercise types review/listen_and_repeat/listen_and_choose/
  chant; no visual UI dependency.
- Presentation recommendation from this checkpoint: ordinary Mentium textbook
  mode is the strongest demo candidate. Kids textbook engine is strong at
  engine/unit level, but live presentation requires a prepared authenticated
  child profile, `USE_KIDS_BRAIN_V1=true`, and a live voice smoke in the target
  environment before showing it to a client.

**Kids WS/STT repair checkpoint (2026-07-09):**
- User requested: "исправь то что сейчас сломанно" after the demo readiness
  checkpoint showed full backend suite red with 63 Kids WS/STT failures.
- Root cause verified by reproduction: `kids-brain-v1-real-ws-smoke.test.ts`
  closed with `NO_CHILD_PROFILE` because the real WS test DB mocks returned a
  Kids session but no row for the now-required `kids_brain_child_profiles`
  lookup. The remaining STT failures were cascade failures after the WS session
  closed before voice assertions could run.
- Product code was not changed. Test fixtures were updated to include minimal
  child profile rows for the affected real WS Kids STT suites, preserving the
  production `KIDS_REQUIRE_PROFILE` guard. Stale test-only
  `DEEPGRAM_KIDS_LIVE_OPTIONS.utterance_end_ms: 700` mocks were aligned to the
  current valid 1000ms value.
- Files changed:
  `backend/src/ws/__tests__/kids-brain-v1-real-ws-smoke.test.ts`,
  `backend/src/ws/__tests__/phase-16g-kids-stt-integration.test.ts`,
  `backend/src/ws/__tests__/phase-16j2-kids-start-billing-guard-fix.test.ts`,
  `backend/src/ws/__tests__/phase-16k-kids-stt-turn-finalization.test.ts`,
  `backend/src/ws/__tests__/phase-18-kids-stt-late-transcript.test.ts`,
  `backend/src/ws/__tests__/phase-23-kids-stt-wait-ready-buffer.test.ts`,
  `backend/src/ws/__tests__/stt-reconnect-dead-connection.test.ts`.
- Validation evidence:
  - `cd backend; npx vitest run src/ws/__tests__/kids-brain-v1-real-ws-smoke.test.ts src/ws/__tests__/phase-16g-kids-stt-integration.test.ts src/ws/__tests__/phase-16k-kids-stt-turn-finalization.test.ts src/ws/__tests__/phase-18-kids-stt-late-transcript.test.ts src/ws/__tests__/phase-23-kids-stt-wait-ready-buffer.test.ts src/ws/__tests__/stt-reconnect-dead-connection.test.ts --reporter=dot --silent`
    -> exit 0; 6 files passed; 71 tests passed.
  - `cd backend; npx vitest run src/ws/__tests__/phase-16j2-kids-start-billing-guard-fix.test.ts --reporter=dot --silent`
    -> exit 0; 1 file passed; 8 tests passed.
  - `rg "utterance_end_ms:\s*700" backend/src -n` -> exit 1; no stale 700ms
    mocks remain.
  - `cd backend; npx tsc --noEmit` -> exit 0.
  - `cd backend; npm test -- --reporter=dot --silent` -> exit 0; 64 files
    passed; 2123 tests passed.
- Review gate:
  - backend reviewer: RUN -> PASS; test-only fixture repair, no auth/billing
    weakening, no product WS behavior changed.
  - frontend reviewer: NOT APPLICABLE -> no frontend/UI/client contract files changed.
  - curriculum reviewer: NOT APPLICABLE -> no curriculum, scoring, progression,
    accepted answer, or prompt behavior changed.
  - kids safety monitor: NOT APPLICABLE -> no child-facing production behavior
    or content changed; child names are test-only fixtures.
  - QA tester: RUN -> PASS; targeted and full backend suite green.
  - acceptance auditor: NOT APPLICABLE -> not a final goal-completion claim.
- RISK-009 resolved: full backend suite no longer has the 63 Kids WS/STT
  failures.
- Commit: no commit created.
- Production state: not deployed or production-verified in this repair; no
  production mutation performed.

---

**Phase 9 master-flag production checkpoint (2026-07-09):**
- User said "продолжай" after the Phase 9 next action explicitly identified
  production Railway env mutation and live verification as requiring go-ahead.
- Production mutation performed:
  `railway variable set --service aiteacher KIDS_PERSONALIZATION_V2=true`
  -> exit 0. Verification:
  `railway variables --service aiteacher | Select-String -Pattern 'KIDS_PERSONALIZATION|USE_KIDS_BRAIN_V1'`
  showed `KIDS_PERSONALIZATION_V2 true` and `USE_KIDS_BRAIN_V1 true`.
- Railway backend deployment from the env change:
  service `aiteacher`, deployment `44050bfb-babc-434b-9405-352b120c91e0`,
  commit `0b82f7d1c3fccf0fdaca47f898d8636cecbc4661`, created
  `2026-07-09T07:08:55.724Z`, status `SUCCESS`.
- Health evidence after deploy:
  `curl.exe -sS -i https://aiteacher-production-cae8.up.railway.app/health`
  at `2026-07-09T07:20:31Z` -> HTTP 200; JSON status `ok`;
  `checks.postgres=ok`; `checks.redis=ok`; uptime `638`.
- Production Kids API/WS smoke evidence (sanitized; token not recorded):
  temporary harness used Railway `JWT_SECRET` to mint a one-use JWT for a
  synthetic UUID user, POSTed `/api/kids/child-profile`, POSTed
  `/lesson/kids/start`, opened `wss://.../lesson`, waited for `lesson_ready`,
  sent `focus_lesson_start`, and observed `ai_text`.
  Result -> exit 0; `profileStatus: 201`; `startStatus: 200`;
  `messageTypes: ["lesson_ready","lesson_ready","ai_text"]`; `errorCodes: []`;
  close `1000 smoke complete`.
- Production log analyzer evidence for the 10-minute master-flag window:
  startup clean (`[server] listening on 0.0.0.0:8080`, PostgreSQL ready,
  Redis ready). Kids smoke routed to Kids Brain V1 with matching session/user
  and did not emit `NO_CHILD_PROFILE` or `SESSION_VERIFICATION_FAILED`.
  The smoke closed after `ai_text` and before TTS completed, producing
  `[tts:provider_error] provider=openai reason=TTS_UNKNOWN_ERROR msg="Request was aborted."`
  and `[kids:voice_degraded] ... reason=TTS_UNKNOWN_ERROR`. Treat as a
  smoke-harness artifact and voice-verification gap, not evidence that the
  original `NO_CHILD_PROFILE` defect remains.
- Follow-up voice-safe smoke after the 15-minute TTS cooldown:
  temporary harness waited for `teacher_turn_end` or `voice_unavailable`
  instead of closing immediately after `ai_text`.
  Result -> exit 0; `profileStatus: 201`; `startStatus: 200`;
  `messageTypes: ["lesson_ready","lesson_ready","ai_text","audio_chunk","teacher_turn_end"]`;
  `audioChunks: 1`; `errorCodes: []`; `voiceUnavailable: []`;
  close `1000 voice smoke complete`.
- Follow-up logs after the voice-safe smoke:
  second synthetic Kids session routed to Kids Brain V1 with matching
  session/user, then closed normally with code 1000. No new
  `tts:provider_error`, `voice_degraded`, `NO_CHILD_PROFILE`, or
  `SESSION_VERIFICATION_FAILED` log entry appeared for the second smoke.
  Health at `2026-07-09T07:31:16Z` -> HTTP 200, status `ok`,
  `checks.postgres=ok`, `checks.redis=ok`, uptime `1284`.
- Review gate:
  - backend reviewer: NOT APPLICABLE -> no product backend code changed after
    the local test-fixture repair.
  - frontend reviewer: NOT APPLICABLE -> no frontend changed.
  - curriculum reviewer: NOT APPLICABLE -> master flag alone enabled; no
    tier flag behavior was production-verified or changed.
  - kids safety monitor: NOT APPLICABLE -> smoke used a synthetic profile and
    did not change child-facing behavior.
  - QA tester: RUN -> PASS for master-flag API/WS/TTS smoke; per-tier behavior
    remains unverified because tier flags are still off.
  - production-log-analyzer: RUN -> PASS WITH CAVEAT for master flag; no
    startup/DB/Redis/session critical errors and the voice-safe follow-up was
    clean. The first TTS abort is recorded as a smoke-harness artifact.
  - acceptance auditor: NOT APPLICABLE -> not a final goal-completion claim.
- Remaining Phase 9 state:
  `KIDS_PERSONALIZATION_V2=true` is live. Per-tier flags are still not enabled.
  D2 remains incomplete for tier flags; D3 is verified only for the master-flag
  deployment/smoke path; D4 remains incomplete. No commit created.

---

**Production Kids `/kids` no-profile crash repair checkpoint (2026-07-09):**
- User attempted the next manual warmup mic test at
  `https://aware-alignment-production.up.railway.app/kids` and observed a blank
  screen. Browser console evidence:
  `GET /api/kids/child-profile -> 404` followed by
  `TypeError: Cannot read properties of null (reading 'teacherId')` in the
  bundled Kids page component.
- Root cause verified in source: `frontend/src/pages/KidsPrototypePage.tsx`
  handled `404` as `profile=null` and scheduled a redirect to
  `/kids/onboarding` in an effect, but the same render still cast
  `profile as ChildProfile` and read `p.teacherId` before the redirect effect
  could run.
- Product fix: `KidsPrototypePage` now returns `null` while `profile === null`,
  allowing the existing redirect effect to navigate to `/kids/onboarding`
  without rendering profile fields.
- Files changed:
  - `frontend/src/pages/KidsPrototypePage.tsx` - null-profile render guard.
  - `.codex/workflow/GOAL_PROGRESS.md` - checkpoint.
  - `.codex/workflow/NEXT_ACTION.md` - next action updated to deploy/verify
    this production-blocking frontend fix before warmup enablement.
  - `.codex/workflow/REVIEW_REPORT.md` - review gate evidence.
  - `.codex/workflow/RISK_REGISTER.md` - resolved no-profile frontend crash risk.
- Validation evidence:
  - `cd frontend; npm run build` -> exit 0; TypeScript + Vite production build
    passed; Vite chunk-size warning only.
  - Local production-build browser reproduction:
    `npm run preview -- --host 127.0.0.1 --port 4173` + Playwright with
    mocked authenticated `/api/me` and mocked
    `/api/kids/child-profile -> 404` -> exit 0; final URL
    `http://127.0.0.1:4173/kids/onboarding`; `pageErrors: []`.
- Review gate:
  - backend reviewer: NOT APPLICABLE -> no backend code changed.
  - frontend reviewer: RUN -> PASS; null backend data no longer crashes the
    Kids page; existing redirect contract preserved.
  - curriculum reviewer: NOT APPLICABLE -> no curriculum, scoring, progression,
    accepted answer, or prompt behavior changed.
  - kids safety monitor: NOT APPLICABLE -> no child-facing content templates or
    safety behavior changed.
  - QA tester: RUN -> PASS; build and browser reproduction both green.
  - acceptance auditor: NOT APPLICABLE -> not a final goal-completion claim.
- Commit: `b0d56e95237051cef498835ec072ec02f9bd5294`
  (`fix(kids): handle missing child profile`).
- Deployment evidence:
  - `git push origin main` -> success (`0b82f7d..b0d56e9 main -> main`).
  - Railway frontend service `aware-alignment`, deployment
    `4d0a2e07-305a-4c6d-9b5c-8a66be13fc73`, commit `b0d56e9`, created
    `2026-07-09T07:46:01.033Z`, status `SUCCESS`.
  - Railway backend service `aiteacher`, deployment
    `b8021d98-70a7-49cf-b9d5-653c715af410`, commit `b0d56e9`, created
    `2026-07-09T07:46:00.568Z`, status `SUCCESS` (auto-deployed on push; no
    backend product code changed in this repair).
  - Frontend HTTP: `curl https://aware-alignment-production.up.railway.app/`
    -> HTTP 200; `curl https://aware-alignment-production.up.railway.app/kids`
    -> HTTP 200; Caddy logs show handled `/` and `/kids` requests with status
    200 and no startup errors.
  - Backend health: `curl https://aiteacher-production-cae8.up.railway.app/health`
    -> HTTP 200; `status=ok`; `checks.postgres=ok`; `checks.redis=ok`;
    uptime `110`.
  - Backend logs after deploy: migrations applied, `[server] listening on
    0.0.0.0:8080`, PostgreSQL ready, Redis ready, WS attached, no startup crash.
  - Production frontend browser verification with deployed asset:
    Playwright opened real production `/kids`, mocked authenticated `/api/me`,
    mocked `/api/kids/child-profile -> 404`; final URL
    `https://aware-alignment-production.up.railway.app/kids/onboarding`;
    heading `"What's your child's name?"`; `pageErrors: []`. Console resource
    errors were only the expected mocked 404 child-profile responses.
- Production state: frontend no-profile crash fix deployed and verified.
  Resume `KIDS_WARMUP_ENABLED` live mic/STT verification next.

---

## BLOCKERS

None.

---

## PHASE COMPLETION STATUS

```
[x] Phase 0 — Design
  [x] docs/kids-personalization-v2.md created (10 sections)
  [x] 6/6 reviewer sign-offs: planner, backend-reviewer, frontend-reviewer,
       curriculum-reviewer, kids-safety-monitor, qa-tester — all PASS
  [x] GLOBAL_GOAL.md updated with new goal
  [x] GOAL_PROGRESS.md updated
  [x] NEXT_ACTION.md updated
  [x] REVIEW_REPORT.md updated
  [x] RISK_REGISTER.md updated

[x] Phase 1 — Interest-Aware Warmups — REVIEW PASS 2026-06-10
  [x] personalization-engine.ts (new) — warmup templates for 12 interests,
       selectInterest(), buildWarmupTurn(), buildWarmupReturnPhrase(),
       isWarmupInProgress(), isWarmupTimedOut(), createInitialPersonalizationState(),
       feature flags (KIDS_PERSONALIZATION_V2 + KIDS_WARMUP_ENABLED)
  [x] teacher-personas.ts (new) — LUCY_PERSONA, TOM_PERSONA, DEFAULT_PERSONA,
       getTeacherPersona(teacherId)
  [x] session-memory.ts (extend) — KidsSessionPersonalizationState interface added,
       personalization?: KidsSessionPersonalizationState field added to SessionMemory
  [x] lesson-ws.ts (extend) — createInitialPersonalizationState() on session start,
       buildWarmupTurn() fired after greeting, warmup interception in processKidsBrainV1Turn,
       timeout enforcement (isWarmupTimedOut), curriculum return phrase (buildWarmupReturnPhrase)
  [x] Unit tests: 62/62 passing — W1–W7, feature flags, selectInterest,
       session state init, serialization, curriculum integrity (C1,C5), S5, T1–T5 stubs

[x] Phase 2 — Interest-Aware Examples — REVIEW PASS 2026-06-10
  [x] personalization-engine.ts — EXAMPLE tier templates (12 interests),
       buildExampleContext(), isInterestExamplesEnabled() flag
  [x] lesson-ws.ts — EXAMPLE injection at exercise advance, before teacher
       model packets (E5); rotation state persisted in same Redis save
  [x] Unit tests: E1–E5 + flags + rotation + error handling (24 new, 86/86 total)

[x] Phase 3 — Interest-Aware Praise — REVIEW PASS 2026-06-10
  [x] personalization-engine.ts — PRAISE tier, 2 persona variants × 12 interests,
       buildInterestPraise(), PRAISE_ELIGIBLE_LABELS, isInterestPraiseEnabled()
  [x] lesson-ws.ts — buildKidsPersonalizationLeadIn() helper: praise after CORRECT_*
       on non-advance turns; example on advance turns (1 interest sentence/turn)
  [x] Unit tests: P1–P5 + flags + integrity (29 new, 115/115 total)

[x] Phase 4 — Interest-Aware Recovery — REVIEW PASS 2026-06-10
  [x] personalization-engine.ts — RECOVERY tier (12 templates, all end "Say [word]!"),
       buildInterestRecovery(), isInterestRecoveryEnabled() flag
  [x] turn-processor.ts — RECOVERY injection at ENCOURAGEMENT rung only (Step 6C);
       replaces mainText only; ladder/counters untouched (C4)
  [x] Unit tests: R1–R2 + flags + integrity/error (18 new, 133/133 total)

[x] Phase 5 — Micro-Dialogues — REVIEW PASS 2026-06-10
  [x] personalization-engine.ts — MICRO_DIALOGUE tier (12 templates,
       buildMicroDialogueTurn, buildMicroDialogueReturnPhrase,
       isMicroDialogueInProgress, KIDS_MICRO_DIALOGUE_ENABLED flag,
       cooldown count-up from 0, eligible at ≥3 — DECISIONS.md)
  [x] session-memory.ts — microDialogueInProgress?: boolean (optional, BC-safe)
  [x] lesson-ws.ts — handleKidsMicroDialogueReply (interception, unscored) +
       maybeFireKidsMicroDialogue (cooldown++/fire/reset) +
       buildKidsTurnPersonalization (1 interest sentence/turn budget)
  [x] Unit tests: M1–M5 + templates + flags + guards (34 new, 167/167 total)

[x] Phase 6 — Teacher Personas — REVIEW PASS 2026-06-12
  [x] teacher-personas.ts — full Lucy/Tom tables (openingPhrase, closingPhrase,
       praiseStyle) verified; energyLevel/warmupStyle/recoveryStyle declared
       but unconsumed (W-025, Phase 8 or doc amend)
  [x] personalization-engine.ts — isTeacherPersonaEnabled
       (KIDS_TEACHER_PERSONA_V2), substituteChildName (function replacer —
       $-sequences never interpreted, fixed at review), buildPersonaGreeting,
       buildPersonaClosing (both S5 pattern, null on flags off/error)
  [x] lesson-ws.ts — persona greeting replaces teacherText of the opening
       teacher_text packet (text-only); maybeSpeakKidsPersonaClosing speaks
       before lesson_end on natural close only
  [x] Unit tests: T1–T6 + fallback/budget/error + $-injection regression
       (21 new, 188/188 total)

[x] Phase 7 — Safety — REVIEW PASS 2026-06-12
  [x] All budget enforcement verified in tests (4.2: warmup 2-turn/15s/once,
       micro-dialogue cooldown 3, 15-word truncation pinned via public API)
  [x] Template safety review (S3 no-PII sweep + S4 no-roleplay sweep over
       all 90 speakable engine texts; safety monitor read all templates)
  [x] Error catch tests S1–S5 (S1 determinism; S5 master-off kills all 7
       builders, unknown interest → null ×5)
  [x] Hardening: substituteChildName name cap (100 chars) + whitespace
       collapse; adversarial attacks executed and verified

[x] Phase 8 — Testing — REVIEW PASS 2026-06-13
  [x] personalization-engine.test.ts (≥40 tests) — 207 engine + 25 integration = 232
  [x] Extend interest-personalizer.test.ts — V1 module untouched; W-024/W-026 added to engine suite
  [x] Integration tests for recovery (runtime) + micro-dialogue (chain + static wiring)
  [x] Curriculum integrity tests (C1–C6) — flags-on-vs-off identical fingerprint, runtime

[ ] Phase 9 — Deployment
  [ ] tsc --noEmit → exit 0
  [ ] npm test → no new failures
  [ ] Railway deploy
  [ ] Feature flag enablement (one phase at a time)
  [ ] Production verification
  [ ] Acceptance auditor final verdict
```

---

## PRODUCTION DEFECT CHECKPOINT - 2026-07-09

**Trigger:** User completed Kids onboarding, started a live production lesson,
then reported that the microphone appeared to stop working while trying to say
the colour word `blue`.

**Production evidence inspected:**
- User browser console showed the new deployed bundle `index-DARbdknK.js`,
  successful auth, `lesson_ready`, `ai_text`, `audio_chunk`,
  `teacher_turn_end`, repeated `mic_start`, repeated outgoing `audio_chunk`,
  repeated incoming `transcript`, `student_message`, and further teacher turns.
  Therefore the mic pipeline, WebSocket, STT, Kids Brain turn handling, and TTS
  were active; the symptom was not a dead microphone.
- Railway variables on service `aiteacher` showed:
  `USE_KIDS_BRAIN_V1=true`, `KIDS_PERSONALIZATION_V2=true`,
  `KIDS_WARMUP_ENABLED=true`.
- Railway logs for session `0abe0557-75f0-4902-adac-eb3fc55313cf` showed:
  `[kids-v1] warmup_fired ... interest=roblox`; STT provider `deepgram`,
  model `nova-2`, `utterance_end_ms=1000`, `keyPresent=true`; no Deepgram
  HTTP 400, no `voice_unavailable`, no backend crash.
- Same session showed the actual failure mode:
  STT raw transcript `Say again. Blue. Blue.` (quality log) and Kids Brain
  perception raw transcript `Say again. Blue.` for target `blue`; classifier
  returned `social_speech` via `timeout_fallback`, action `warm_redirect`,
  no progression.

**Root cause from repository evidence:**
- `backend/src/ws/kids-stt-correction.ts` intentionally returned
  `multi_word` before target correction for any transcript containing spaces.
- `backend/src/kids-brain/classification/deterministic-classifier.ts` only
  uses contained-target partial matching for multi-word targets, not for a
  single target word embedded in a teacher retry echo.
- Result: the production transcript `Say again. Blue.` reached Kids Brain as
  multi-word social/off-task speech instead of the single target answer `blue`.

**Fix implemented:**
- `backend/src/ws/kids-stt-correction.ts` now recognizes only the confirmed
  teacher-echo suffix pattern `say again` + trailing target word(s), e.g.
  `Say again. Blue.` and `Say again. Blue. Blue.`, and converts it to the
  engine-authoritative target word before Kids Brain classification.
- Existing broad multi-word guard remains in place for arbitrary phrases:
  `I said blue`, `the blue`, `Yes. I like Roblox.`, and `Say again.` are not
  corrected.
- `backend/src/ws/__tests__/phase-21-kids-stt-target-word-correction.test.ts`
  adds 4 regression tests for the production case and guard cases.

**Validation:**
- `cd backend; npx vitest run src/ws/__tests__/phase-21-kids-stt-target-word-correction.test.ts --reporter=dot --silent`
  -> exit 0; 1 file passed; 34 tests passed.
- `cd backend; npx tsc --noEmit` -> exit 0.
- `cd backend; npx vitest run src/kids-brain src/ws/__tests__/phase-21-kids-stt-target-word-correction.test.ts src/voice/__tests__/kids-stt-config-parity.test.ts src/voice/__tests__/stt-deepgram-options.test.ts --reporter=dot --silent`
  -> exit 0; 45 files passed; 1544 tests passed.
- `cd backend; npm test -- --reporter=dot --silent`
  -> exit 0; 64 files passed; 2127 tests passed.
- `git diff --check` -> exit 0; CRLF warnings only.

**Review gate:**
- backend reviewer: PASS. Scope is one WS correction helper plus unit tests;
  no secrets, no auth/billing/payment change, no new endpoint, no new STT/TTS
  config, no new external calls, existing Kids Brain authority preserved.
- QA tester: PASS. Targeted, broader Kids/voice, TypeScript, and full backend
  suite all passed with the new 4 tests included.
- curriculum reviewer: PASS. Target word, accepted answers, exercise order,
  scoring rules, escalation ladder, and curriculum data are unchanged. The fix
  normalizes a transcript to the already-authoritative target word only for the
  confirmed teacher-echo retry pattern.
- frontend reviewer: NOT APPLICABLE. No frontend files changed.
- kids safety monitor: NOT APPLICABLE. No teacher text, child-facing copy,
  safety escalation, or prompt behavior changed; residual false-positive risk
  recorded below.
- acceptance auditor: NOT APPLICABLE. Goal is not complete; live production
  verification remains required after deploy.

**Residual risk:**
- If pure speaker echo without child speech produces exactly `Say again. Blue.`
  or `Say again. Blue. Blue.`, it could now be treated as `blue`. The allowlist
  is deliberately narrow and does not accept general "contains target" phrases.

**Commit/deploy status:**
- Commit `ed10f8664c1772377b5c8e0fcf8f074a90ab54d6`
  (`fix(kids): recognize retry echo target word`) created and pushed to
  `origin/main`.
- Railway backend `aiteacher` deployment
  `2e247e8d-508c-4f0e-a961-be16974a4e46` -> SUCCESS at commit `ed10f86`.
- Railway frontend `aware-alignment` deployment
  `81bebd19-c2aa-4d84-b7d8-b8a1e7075e62` -> SUCCESS at commit `ed10f86`
  (monorepo auto-deploy; no frontend product files changed in this fix).
- Post-deploy `/health` at 2026-07-09T08:15:01Z -> HTTP 200,
  `status=ok`, `checks.postgres=ok`, `checks.redis=ok`, uptime 620s.
- Backend startup logs after deploy show migrations applied, `[server]
  listening on 0.0.0.0:8080`, `[server] PostgreSQL ready`, `[redis] ping OK`,
  `[server] Redis ready`.
- 10-minute post-deploy log window checked with patterns:
  `HTTP 400`, `Unhandled`, `ECONNREFUSED`, `Cannot find`, `Error:`,
  `voice_unavailable`, `SESSION_VERIFICATION_FAILED`, `NO_CHILD_PROFILE`.
  No matching critical errors observed in the checked tail.
- Manual live mic/progression verification remains required: repeat the Kids
  lesson, trigger the retry prompt, say `blue`, and verify progression plus
  optional production log marker `method=teacher_echo_target_suffix`.

---

## TEST EVIDENCE

```
Baseline (Kids Onboarding V1):
  TypeScript build:  npx tsc --noEmit → exit 0   ✅
  Unit tests:        1828 pass / 63 pre-existing STT failures ✅
  Production deploy: Railway 22973e11/6efa0204 SUCCESS ✅

Phase 1 (Interest-Aware Warmups — 2026-06-10):
  TypeScript build:  npx tsc --noEmit → exit 0   ✅
  New tests:         62/62 pass (personalization-engine.test.ts)
  Full Kids Brain:   1316/1316 pass (41 test files, no regressions)
  Full suite:        1890 pass / 63 pre-existing STT failures (unchanged)

Phase 4 (Interest-Aware Recovery — 2026-06-10, verified fresh at reconstruction):
  TypeScript build:  npx tsc --noEmit → exit 0   ✅
  Engine tests:      133/133 pass (= 115 after Phase 3 + 18 recovery tests)
  Full suite:        1961 pass / 63 pre-existing STT failures (= 1943 + 18)

Phase 5 (Micro-Dialogues — 2026-06-10):
  TypeScript build:  npx tsc --noEmit → exit 0   ✅
  Engine tests:      167/167 pass (= 133 + 34 micro-dialogue tests)
  Full suite:        1995 pass / 63 pre-existing STT failures (= 1961 + 34)

Phase 6 (Teacher Personas — 2026-06-12):
  TypeScript build:  npx tsc --noEmit → exit 0   ✅
  Engine tests:      188/188 pass (= 167 + 19 persona + 2 injection-fix tests)
  Wiring guards:     64/64 pass (session-analytics + phase-16b-runtime-safety)
  Full suite:        2016 pass / 63 pre-existing STT failures (= 1995 + 21)

Phase 7 (Safety — 2026-06-12):
  TypeScript build:  npx tsc --noEmit → exit 0   ✅
  Engine tests:      200/200 pass (= 188 + 12 safety tests)
  Wiring guards:     64/64 pass
  Full suite:        2028 pass / 63 pre-existing STT failures (= 2016 + 12)

Phase 8 (Testing — 2026-06-13):
  TypeScript build:  npx tsc --noEmit → exit 0   ✅
  Engine tests:      207/207 pass (= 200 + 7: W-024 ×5, W-026 ×2)
  Integration tests: 25/25 pass (phase-8-personalization-integration.test.ts)
  teacher-response:  284/284 pass (4 files)
  Full suite:        2060 pass / 63 pre-existing STT failures (= 2028 + 32, 0 new)
```

---

## HISTORICAL LOG

### Kids Brain V1 — COMPLETE (2026-06-09)
- 28/28 criteria verified in Run 5 acceptance audit
- Tag: kids-brain-v1-complete

### Kids Onboarding V1 — COMPLETE (2026-06-10)
- 23/23 ACs verified, deployed to Railway
- Tag: kids-onboarding-v1-complete
- Commits: 2aa5dfa + fb26bb0 + ad49dbc + b2357eb

### Phase 1 — Interest-Aware Warmups (2026-06-10)
- personalization-engine.ts created (warmup templates × 12, budget enforcement, feature flags)
- teacher-personas.ts created (Lucy, Tom, default)
- session-memory.ts extended (KidsSessionPersonalizationState)
- lesson-ws.ts extended (warmup fire + interception + timeout + return phrase)
- 62 new tests, 0 regressions

### Phase 0 — Design Document (2026-06-10)
- docs/kids-personalization-v2.md created
- Covers: personalization architecture, interest taxonomy, teacher personas,
  safe rules, curriculum boundaries, data flow, storage model, session memory,
  acceptance criteria (40 ACs), rollback plan (7 feature flags)
- Status: APPROVED — all 6 reviewers PASS
