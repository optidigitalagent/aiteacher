# DEPLOYMENT_CHECKLIST.md

## DEPLOYMENT RECORD - Paid teacher live smoke follow-up word-help routing + stale input guard - 2026-07-10

Authorization:
- User provided a failing authenticated paid lesson transcript after `703da40`
  and asked to analyze it against the target product behavior and remove the
  remaining bad communication/stale input behavior. Repository operating
  preferences authorize deploy when product changes are in scope and checks
  pass, subject to deployment gate stop rules.

Reviewed commit:
- Pending commit for follow-up repair.

Pre-deploy gates:
- `cd backend; npx vitest run src/lesson/__tests__/paid-vocab-flow.test.ts --reporter=dot --silent`
  with npm/temp redirected to `D:\` -> exit 0; 1 file passed; 12 tests passed.
- `cd backend; npx tsc --noEmit` with npm/temp redirected to `D:\` -> exit 0.
- `cd frontend; npm run build` with npm/temp redirected to `D:\` -> exit 0;
  Vite build succeeded with the pre-existing chunk-size warning.
- Focused regression:
  `cd backend; npx vitest run src/lesson/__tests__/paid-vocab-flow.test.ts src/voice/__tests__/voice-turn-stabilizer.test.ts src/voice/__tests__/stt-deepgram-options.test.ts src/voice/__tests__/kids-stt-config-parity.test.ts src/ws/__tests__/message-types.test.ts src/exercises/runtime-qa/pedagogical-behavior.qa.test.ts --reporter=dot --silent`
  with npm/temp redirected to `D:\` -> exit 0; 6 files passed; 211 tests passed.
- `cd backend; npm test -- --reporter=dot --silent` with npm/temp redirected
  to `D:\` -> exit 0; 68 files passed; 2178 tests passed.
- `git diff --check` -> exit 0; CRLF warnings only.
- Review gate -> PASS WITH PENDING DEPLOY AND LIVE SMOKE.
- Targeted staged scope: 5 product/test files plus workflow evidence; no auth,
  billing, payment, Kids Brain behavior, STT/TTS provider config, `.env`, or
  secret files staged.

Push:
- Pending.

Railway:
- Pending.

Post-deploy verification:
- Pending.

Pending:
- Controlled authenticated paid browser/microphone smoke remains required:
  exact `Which world... I don't know` word-help, EN/RU/UA turns, no lost first
  words, no split half-turns, no stale transcript carryover, no missing
  `student_message`, TTS audibility, and backend/WS log correlation.

## DEPLOYMENT RECORD - Paid teacher live transcript mic + word-help repair - 2026-07-10

Authorization:
- User provided a failing live paid lesson transcript and asked Codex to fix
  both the teacher behavior and microphone behavior, with autonomous testing
  and agents. Repository operating preferences authorize deploy when product
  changes are in scope and checks pass, subject to deployment gate stop rules.

Reviewed commit:
- `703da401b36420c28a877a369af214598841d086`
  (`fix(voice): order paid mic start before audio`)

Pre-deploy gates:
- `cd backend; npx vitest run src/lesson/__tests__/paid-vocab-flow.test.ts --reporter=dot --silent`
  with npm/temp redirected to `D:\` -> exit 0; 1 file passed; 10 tests passed.
- `cd backend; npx tsc --noEmit` with npm/temp redirected to `D:\` -> exit 0.
- `cd frontend; npm run build` with npm/temp redirected to `D:\` -> exit 0;
  Vite build succeeded with the pre-existing chunk-size warning.
- Focused regression:
  `cd backend; npx vitest run src/lesson/__tests__/paid-vocab-flow.test.ts src/voice/__tests__/voice-turn-stabilizer.test.ts src/voice/__tests__/stt-deepgram-options.test.ts src/voice/__tests__/kids-stt-config-parity.test.ts src/ws/__tests__/message-types.test.ts src/exercises/runtime-qa/pedagogical-behavior.qa.test.ts --reporter=dot --silent`
  with npm/temp redirected to `D:\` -> exit 0; 6 files passed; 209 tests passed.
- `cd backend; npm test -- --reporter=dot --silent` with npm/temp redirected
  to `D:\` -> exit 0; 68 files passed; 2176 tests passed.
- Static paid mic ordering check -> exit 0; `paid mic start ordering static
  check passed`.
- `git diff --check` -> exit 0; CRLF warnings only.
- `git diff --cached --check` before commit -> exit 0; CRLF warnings only.
- Review gate -> PASS WITH PENDING DEPLOY AND LIVE SMOKE.
- Targeted staged scope: 5 product/test files plus workflow evidence; no auth,
  billing, payment, Kids Brain behavior, STT/TTS provider config, `.env`, or
  secret files staged.

Push:
- `git push origin main` -> success (`1ee5613..703da40 main -> main`).

Railway:
- `aiteacher` backend deployment
  `60200335-15a1-4547-9e3e-811f82a37dc6` -> SUCCESS at commit `703da40`.
- `aware-alignment` frontend deployment
  `c24fd2e2-d2b7-40ea-bbfc-e597db71fe64` -> SUCCESS at commit `703da40`.

Post-deploy verification:
- Backend `/health` initial check -> HTTP 200; `status=ok`; postgres ok;
  redis ok; uptime 20s at `2026-07-10T14:36:46.043Z`.
- Frontend `/demo/setup` initial check -> HTTP 200; served SPA HTML.
- Backend startup logs -> migrations applied, `[server] listening on
  0.0.0.0:8080`, PostgreSQL ready, Redis connected, Redis ping OK, Redis ready,
  and WS endpoint attached.
- Frontend startup logs -> Caddy serving on `:8080`.
- Backend logs after deploy included an adult paid reconnect with
  `[stt:config] provider=deepgram model=nova-3 language=multi` and
  `[stt:lifecycle] status="open"`.
- Backend/frontend HTTP logs with status `400..599` over the checked
  15-minute window returned no entries.
- Backend/frontend critical error-pattern sweeps returned no findings.
- Stability recheck after ~3 minutes -> backend `/health` HTTP 200 with
  postgres/redis ok, uptime 228s at `2026-07-10T14:40:14.028Z`; frontend
  `/demo/setup` HTTP 200.
- Final backend/frontend HTTP logs with status `400..599` over the checked
  5-minute window returned no entries.
- Final backend critical sweep returned no matches for `Unhandled`,
  `ECONNREFUSED`, `Cannot find`, `Missing`, `voice_unavailable`,
  `STT_CONNECT_FAILED`, `HTTP 400`, `Error:`, `TypeError`, or
  `ReferenceError`.
- Final frontend critical sweep returned no matches for `error`, `panic`,
  `failed`, `cannot`, or `exception`.

Pending:
- Controlled authenticated paid browser/microphone smoke remains required:
  EN/RU/UA turns, no lost first words, no split half-turns, no stale transcript
  carryover, no missing `student_message`, TTS audibility, and backend/WS log
  correlation.

## DEPLOYMENT RECORD - Paid teacher English task-help deterministic gap-fill repair - 2026-07-10

Authorization:
- User asked Codex to decide whether the paid teacher intelligence/brain side
  is ready, to probe it with adversarial questions, fix failures, retest, and
  continue until the AI behavior is ready before moving to microphone testing.

Reviewed commit:
- `1ee5613aabd3f0881d31f94455055548c7b35758`
  (`fix(lesson): keep english task help out of grading`)

Pre-deploy gates:
- `cd backend; npx vitest run src/lesson/__tests__/paid-vocab-flow.test.ts --reporter=dot --silent`
  with npm/temp redirected to `D:\` -> exit 0; 1 file passed; 8 tests passed.
- `cd backend; npx vitest run src/lesson/__tests__/paid-vocab-flow.test.ts src/voice/__tests__/voice-turn-stabilizer.test.ts src/voice/stt-multilingual.test.ts src/exercises/runtime-qa/pedagogical-behavior.qa.test.ts --reporter=dot --silent`
  with npm/temp redirected to `D:\` -> exit 0; 4 files passed; 221 tests
  passed.
- `cd backend; npx tsc --noEmit` with npm/temp redirected to `D:\` -> exit 0.
- `cd backend; npm test -- --reporter=dot --silent` with npm/temp redirected
  to `D:\` -> exit 0; 68 files passed; 2174 tests passed.
- `git diff --check` -> exit 0; CRLF warnings only.
- `git diff --cached --check` before product commit -> exit 0; CRLF warnings
  only.
- Review gate -> PASS WITH PENDING DEPLOY AND LIVE SMOKE (backend,
  curriculum, kids safety, QA, adversarial critic, live QA, and acceptance
  auditor assessed; frontend not applicable).
- Targeted staged scope: 2 backend product/test files; no frontend UI,
  billing, auth, `.env`, workflow, Telegram tooling, STT/TTS config, or secret
  files staged.

Push:
- `git push origin main` -> success (`d3dcc2d..1ee5613 main -> main`).

Railway:
- `aiteacher` backend deployment
  `8b0cd48e-edd1-4199-9736-1bc3ac573895` -> SUCCESS at commit `1ee5613`.
- `aware-alignment` frontend deployment
  `e9e1d4b0-cb49-4a7b-8b1f-0bb769b8c889` -> SUCCESS at commit `1ee5613`
  (monorepo auto-deploy; no frontend product files changed).

Post-deploy verification:
- Backend `/health` initial check -> HTTP 200; `status=ok`; postgres ok;
  redis ok; uptime 29s at `2026-07-10T14:00:49.382Z`.
- Frontend `/demo/setup` initial check -> HTTP 200.
- Backend startup logs -> migrations applied, `[server] listening on
  0.0.0.0:8080`, PostgreSQL ready, Redis connected, Redis ping OK, Redis
  ready, and WS endpoint attached.
- Frontend startup logs -> Caddy serving on `:8080`.
- Backend/frontend HTTP logs with status `400..599` over the checked
  15-minute window returned no entries.
- Backend/frontend critical error-pattern sweeps returned no findings.
- Stability recheck -> backend `/health` HTTP 200 with postgres/redis ok,
  uptime 352s at `2026-07-10T14:06:12.695Z`; frontend `/demo/setup` HTTP 200.
- Final backend/frontend HTTP logs with status `400..599` over the checked
  10-minute window returned no entries.
- Final backend critical sweep returned no matches for `Unhandled`,
  `ECONNREFUSED`, `Cannot find`, `Missing`, `voice_unavailable`,
  `STT_CONNECT_FAILED`, `HTTP 400`, `Error:`, `TypeError`, or
  `ReferenceError`.
- Final frontend critical sweep returned no matches for `error`, `panic`,
  `failed`, `cannot`, or `exception`.

Pending:
- Controlled authenticated paid browser/WS text smoke remains unavailable in
  this Codex process due to missing subscribed JWT/auth state.
- Original manual authenticated paid lesson microphone smoke remains required:
  English answer, Russian clarification, Ukrainian clarification,
  self-correction/repetition, mixed answer cleanup, TTS/log correlation.

## DEPLOYMENT RECORD - Paid teacher multilingual clarification adversarial text repair - 2026-07-10

Authorization:
- User asked Codex to test paid teacher AI behavior in English, Russian, and
  Ukrainian, fix failures, and bring the paid teacher to the required behavior.

Reviewed commit:
- `d3dcc2d3ff530ab01777088d9cdaddacf3d1c0b9`
  (`fix(lesson): keep multilingual clarification out of grading`)

Pre-deploy gates:
- `cd backend; npx vitest run src/lesson/__tests__/paid-vocab-flow.test.ts src/exercises/runtime-qa/pedagogical-behavior.qa.test.ts --reporter=dot --silent`
  with npm/temp redirected to `D:\` -> exit 0; 2 files passed; 160 tests
  passed.
- `cd backend; npx vitest run src/lesson/__tests__/paid-vocab-flow.test.ts --reporter=dot --silent`
  with npm/temp redirected to `D:\` -> exit 0; 1 file passed; 7 tests passed.
- `cd backend; npx vitest run src/lesson/__tests__/paid-vocab-flow.test.ts src/voice/__tests__/voice-turn-stabilizer.test.ts src/exercises/runtime-qa/pedagogical-behavior.qa.test.ts --reporter=dot --silent`
  with npm/temp redirected to `D:\` -> exit 0; 3 files passed; 179 tests
  passed.
- `cd backend; npx tsc --noEmit` with npm/temp redirected to `D:\` -> exit 0.
- `cd backend; npm test -- --reporter=dot --silent` with npm/temp redirected
  to `D:\` -> exit 0; 68 files passed; 2173 tests passed.
- `git diff --check` -> exit 0; CRLF warnings only.
- `git diff --cached --check` before product commit -> exit 0; CRLF warnings
  only.
- Review gate -> PASS WITH PENDING LIVE SMOKE (backend, curriculum, kids
  safety, QA, live QA, and acceptance auditor assessed; frontend not
  applicable).
- Targeted staged scope: 2 backend product/test files; no frontend UI,
  billing, auth, `.env`, workflow, Telegram tooling, or secret files staged.

Push:
- `git push origin main` -> success (`8566e5a..d3dcc2d main -> main`).

Railway:
- `aiteacher` backend deployment
  `112554aa-2d1b-4131-bae2-8944e772cf46` -> SUCCESS at commit `d3dcc2d`.
- `aware-alignment` frontend deployment
  `3b78f115-b0b6-4e28-b18f-ffef0cb78a4c` -> SUCCESS at commit `d3dcc2d`
  (monorepo auto-deploy; no frontend product files changed).

Post-deploy verification:
- Backend `/health` -> HTTP 200; `status=ok`; postgres ok; redis ok; uptime
  24s at `2026-07-10T13:44:17.307Z`.
- Frontend `/demo/setup` -> HTTP 200.
- Backend startup logs -> migrations applied, `[server] listening on
  0.0.0.0:8080`, PostgreSQL ready, Redis connected, Redis ping OK, Redis
  ready, and WS endpoint attached.
- Frontend startup logs -> Caddy serving on `:8080`.
- Backend/frontend HTTP logs with status `400..599` over the checked
  15-minute window returned no entries.
- Backend recent critical sweep returned no matches for `Unhandled`,
  `ECONNREFUSED`, `Cannot find`, `Missing`, `voice_unavailable`,
  `STT_CONNECT_FAILED`, `HTTP 400`, or `Error:`.
- Frontend recent critical sweep returned no matches for `error`, `panic`,
  `failed`, `cannot`, or `exception`.

Pending:
- Controlled authenticated paid browser/WS text smoke remains unavailable in
  this Codex process due to missing subscribed JWT/auth state.
- Original manual authenticated paid lesson microphone smoke remains required:
  English answer, Russian clarification, Ukrainian clarification,
  self-correction/repetition, mixed answer cleanup, TTS/log correlation.

## DEPLOYMENT RECORD - Paid teacher multilingual voice and conversational tutor behavior - 2026-07-10

Authorization:
- User explicitly approved deploy for the paid production service so they can
  run a full live microphone test.

Reviewed commit:
- `34cfefeccc721662c549ac9776497a68bfd08a56`
  (`fix(voice): support multilingual paid teacher turns`)

Pre-deploy gates:
- `cd backend; npx tsc --noEmit` with npm/temp redirected to `D:\` -> exit 0.
- `cd backend; npx vitest run src/voice/__tests__/voice-turn-stabilizer.test.ts src/voice/__tests__/stt-deepgram-options.test.ts src/voice/__tests__/kids-stt-config-parity.test.ts src/lesson/__tests__/paid-vocab-flow.test.ts src/exercises/runtime-qa/pedagogical-behavior.qa.test.ts --reporter=dot --silent`
  with npm/temp redirected to `D:\` -> exit 0; 5 files passed; 200 tests passed.
- `cd backend; npm test -- --reporter=dot --silent` with npm/temp redirected
  to `D:\` -> exit 0; 67 files passed; 2167 tests passed.
- `git diff --check` -> exit 0; CRLF warnings only.
- `git diff --cached --check` -> exit 0; CRLF warnings only.
- Review gate -> PASS WITH PENDING LIVE SMOKE (backend, curriculum, kids
  safety, prompt tester, QA, adversarial critic ran; frontend not applicable;
  live QA and acceptance auditor still require real microphone evidence).
- Targeted staged scope: 10 backend product/test files; no frontend UI,
  billing, auth, `.env`, workflow, Telegram tooling, or secret files staged.

Push:
- `git push origin main` -> success (`594824f..34cfefe main -> main`).

Railway:
- `aiteacher` backend deployment
  `d0f8cc64-69d3-4f26-a378-245445990152` -> SUCCESS at commit `34cfefe`.
- `aware-alignment` frontend deployment
  `e887b721-d936-4cf6-aca5-486da11bd177` -> SUCCESS at commit `34cfefe`
  (monorepo auto-deploy; no frontend product files changed).

Post-deploy verification:
- Backend `/health` initial check -> HTTP 200; `status=ok`; postgres ok;
  redis ok; uptime 24s at `2026-07-10T12:10:51.613Z`.
- Backend startup logs -> migrations applied, `[server] listening on
  0.0.0.0:8080`, PostgreSQL ready, Redis connected, Redis ping OK, Redis
  ready, WS attached.
- Frontend `/demo/setup` initial and final checks -> HTTP 200.
- Initial backend/frontend critical error-pattern sweeps returned no entries.
- Initial backend/frontend HTTP 4xx/5xx log checks for last 10 minutes returned
  no entries.
- 10-minute stability recheck -> backend `/health` HTTP 200 with uptime 629s,
  postgres ok, redis ok at `2026-07-10T12:20:56.584Z`.
- Final backend/frontend critical error-pattern sweeps returned no entries.
- Final backend/frontend HTTP 4xx/5xx log checks for last 10 minutes returned
  no entries.

Pending:
- Manual authenticated adult paid lesson live microphone smoke remains
  required: English answer, Russian clarification, Ukrainian clarification,
  `Like keen on`, `keen on keen on`, transcript/TTS/log behavior.

## DEPLOYMENT RECORD - Paid lesson 1.1 live tutor intelligence repair - 2026-07-10

Authorization:
- User requested the paid Teacher Brain / Alex intelligence repair after a
  production paid lesson section `1.1` smoke and instructed to deploy if in
  scope after checks passed, subject to the repository deployment gate.

Reviewed commit:
- `594824f864c0b9b5c02e6734033c448d4216b242`
  (`fix(lesson): repair paid tutor intelligence`)

Pre-deploy gates:
- `cd backend; npx vitest run src/lesson/__tests__/paid-vocab-flow.test.ts src/voice/__tests__/voice-turn-stabilizer.test.ts src/exercises/runtime-qa/pedagogical-behavior.qa.test.ts --reporter=dot --silent`
  with npm/temp redirected to `D:\` -> exit 0; 3 files passed; 171 tests passed.
- `cd backend; npx tsc --noEmit` with npm/temp redirected to `D:\` -> exit 0.
- `cd backend; npx vitest run src/demo/communicative-success.test.ts --reporter=dot --silent`
  -> exit 0; 1 file passed; 35 tests passed.
- `cd backend; npm test -- --reporter=dot --silent` with npm/temp redirected
  to `D:\` -> exit 0; 67 files passed; 2162 tests passed.
- `git diff --check` -> exit 0; CRLF warnings only.
- `git diff --cached --check` -> exit 0.
- Review gate -> PASS (backend + curriculum + kids safety + prompt tester +
  QA ran; frontend not applicable; acceptance auditor not applicable until
  manual production smoke).
- Targeted staged scope: 17 backend/Teacher Brain product-doc/test files plus
  5 workflow evidence files; no frontend UI, billing, auth, STT/TTS config,
  mic config, `.env`, or `docs/master-prompt.md` files staged.

Push:
- `git push origin main` -> success (`ae5eb8b..594824f main -> main`).

Railway:
- `aiteacher` backend deployment
  `80d7c496-5582-4002-951e-1759c37464e2` -> SUCCESS at commit `594824f`.
- `aware-alignment` frontend deployment
  `dda6c780-89de-476d-a239-2ba6b9044117` -> SUCCESS at commit `594824f`
  (monorepo auto-deploy; no frontend product files changed in this repair).

Post-deploy verification:
- Backend `/health` initial check -> HTTP 200; `status=ok`; postgres ok;
  redis ok; uptime 17s at `2026-07-10T07:54:33.338Z`.
- Frontend `/demo/setup` initial check -> HTTP 200; served bundle
  `/assets/index-Cq-fCicY.js`.
- Backend logs -> migrations applied, `[server] listening on 0.0.0.0:8080`,
  PostgreSQL ready, Redis connected, Redis ping OK, Redis ready, WS attached.
- Frontend logs -> Caddy server running on `:8080`.
- Recent backend/frontend HTTP 4xx/5xx log checks returned no entries.
- Backend/frontend critical error-pattern sweeps returned no entries.
- Stability wait note: one PowerShell wait loop timed out because it treated
  Railway log UTC time as the local shell clock target; no deployment failure
  occurred. Final post-deploy checks were rerun immediately afterward.
- Final stability recheck at local `2026-07-10T11:10:13+03:00` -> backend
  `/health` HTTP 200 with uptime 957s and postgres/redis ok; frontend
  `/demo/setup` HTTP 200.
- Final backend/frontend HTTP 4xx/5xx log checks for the last 10 minutes
  returned no entries.
- Final backend/frontend critical error-pattern sweeps returned no entries.

Pending:
- Manual authenticated owner paid lesson section `1.1` smoke with real
  microphone remains required to verify readiness warm-up, Section 1.1
  item-answer sync, repeated `keen on` acceptance, targeted speaking
  scaffolding, and whether the intro TTS sentence symptom is still observable.

---

## DEPLOYMENT RECORD - Paid private tutor behavior repair - 2026-07-10

Authorization:
- User requested the paid Teacher Brain behavior repair after a live paid
  lesson smoke. Repository operating preferences say to deploy when in scope
  after checks pass, subject to deployment gate stop rules.

Reviewed commit:
- `ae5eb8b82d7eb538794ac961d11213ecf7a42b62`
  (`fix(lesson): make paid Alex feel like a tutor`)

Pre-deploy gates:
- `cd backend; npx vitest run src/lesson/__tests__/paid-vocab-flow.test.ts src/exercises/runtime-qa/pedagogical-behavior.qa.test.ts --reporter=dot --silent`
  with npm/temp redirected to `D:\` -> exit 0; 2 files passed; 153 tests passed.
- `cd backend; npx tsc --noEmit` with npm/temp redirected to `D:\` -> exit 0.
- `cd backend; npm test -- --reporter=dot --silent` with npm/temp redirected
  to `D:\` -> exit 0; 67 files passed; 2156 tests passed.
- `git diff --check` -> exit 0; CRLF warnings only.
- `git diff --cached --check` -> exit 0.
- Review gate -> PASS WITH WARNING (backend + curriculum + kids safety +
  prompt + QA ran; frontend not applicable; acceptance auditor not applicable
  until manual production smoke).
- Targeted staged scope: 9 backend product/test files plus 5 workflow evidence
  files; no `.env` files staged; no secrets in staged diff.

Push:
- `git push origin main` -> success (`5208c2c..ae5eb8b main -> main`).

Railway:
- `aiteacher` backend deployment
  `de818d67-e947-4f7f-98f8-48e9e327885e` -> SUCCESS at commit `ae5eb8b`.
- `aware-alignment` frontend deployment
  `439bdd8c-9ebf-44cd-8d38-ed6585348ca3` -> SUCCESS at commit `ae5eb8b`
  (monorepo auto-deploy; no frontend product files changed in this repair).

Post-deploy verification:
- Backend `/health` -> HTTP 200; `status=ok`; postgres ok; redis ok; uptime
  22s at `2026-07-10T07:14:04.688Z`.
- Frontend `/demo/setup` -> HTTP 200; served bundle
  `/assets/index-Cq-fCicY.js`.
- Backend logs -> migrations applied, `[server] listening on 0.0.0.0:8080`,
  PostgreSQL ready, Redis connected, Redis ping OK, Redis ready, WS attached.
- Frontend logs -> Caddy server running on `:8080`.
- Recent backend/frontend HTTP 4xx/5xx log checks returned no entries.
- Backend/frontend critical error-pattern sweeps returned no entries.
- 10-minute stability window recheck at `2026-07-10T07:23:55.579Z` -> backend
  `/health` HTTP 200 with uptime 613s and postgres/redis ok; frontend
  `/demo/setup` HTTP 200.
- Final backend/frontend HTTP 4xx/5xx log checks for the last 10 minutes
  returned no entries.
- Final backend/frontend critical error-pattern sweeps returned no entries.

Pending:
- Manual authenticated owner paid lesson section `1.1` smoke with real
  microphone remains required to verify warm-up/readiness, teacher-like
  gap-fill feedback, clarification wording, and speaking mini-dialogue behavior.

---

## DEPLOYMENT RECORD - Paid lesson AI intelligence repair - 2026-07-10

Authorization:
- User explicitly requested `нужен деплой`.

Reviewed commit:
- `5208c2c8bec4ed72b6aa1e13d05fe7cfbd4de01f`
  (`fix(lesson): polish paid tutor responses`)

Pre-deploy gates:
- `cd backend; npx tsc --noEmit` with npm/temp redirected to `D:\` -> exit 0.
- `cd backend; npm test -- --reporter=dot --silent` with npm/temp redirected
  to `D:\` -> exit 0; 67 files passed; 2152 tests passed.
- `git diff --check` -> exit 0; CRLF warnings only.
- Review gate -> PASS (backend + curriculum + kids safety + QA passed;
  frontend not applicable; acceptance auditor not applicable until manual
  production smoke).
- Targeted staged scope: 8 backend product/test files plus workflow evidence;
  no `.env` files staged; no secrets in staged diff.

Push:
- `git push origin main` -> success (`8d67c9b..5208c2c main -> main`).

Railway:
- `aiteacher` backend deployment
  `11426479-9ed4-49a7-b9b6-7013f96180d3` -> SUCCESS at commit `5208c2c`.
- `aware-alignment` frontend deployment
  `1ce94080-f4df-404b-88b5-d6817bf81cc4` -> SUCCESS at commit `5208c2c`
  (monorepo auto-deploy; no frontend product files changed).

Post-deploy verification:
- Backend `/health` -> HTTP 200; `status=ok`; postgres ok; redis ok; uptime
  45s at `2026-07-10T06:32:58.949Z`.
- Frontend `/demo/setup` -> HTTP 200; served bundle
  `/assets/index-Cq-fCicY.js`.
- Backend logs -> migrations applied, `[server] listening on 0.0.0.0:8080`,
  PostgreSQL ready, Redis ready, WS attached.
- Recent backend HTTP 4xx log check -> no entries.
- Recent backend HTTP 5xx log check -> no entries.
- Backend error-pattern sweep for `HTTP 400`, `Unhandled`, `ECONNREFUSED`,
  `Cannot find`, `Missing`, `Error:`, `voice_unavailable`,
  `STT_CONNECT_FAILED`, `Deepgram` -> no entries in tail 300.
- Frontend logs -> Caddy serving on `:8080`; `/demo/setup` handled with HTTP
  200; recent frontend HTTP 4xx/5xx log checks -> no entries.
- 10-minute stability window recheck at `2026-07-10T06:41:50Z` -> backend
  `/health` HTTP 200 with uptime 577s and postgres/redis ok; frontend
  `/demo/setup` HTTP 200.
- Final 10-minute backend/frontend HTTP 4xx/5xx log checks -> no entries.
- Final backend critical error-pattern sweep in tail 500 -> no entries.
- Final frontend error-pattern sweep in tail 200 -> no entries.

Pending:
- Manual authenticated owner paid lesson section `1.1` smoke with real
  microphone remains required.

---

## DEPLOYMENT RECORD - Paid voice smoke defect repair - 2026-07-10

Authorization:
- User explicitly requested `deploy`.

Reviewed commit:
- `8d67c9bf8f01ea6299dd734b7694612a004f2aab`
  (`fix(voice): stabilize paid STT turns and tutor phrasing`)

Pre-deploy gates:
- `cd backend; npx tsc --noEmit` -> exit 0.
- `cd backend; npm test -- --reporter=dot --silent` -> exit 0; 67 files
  passed; 2145 tests passed.
- `git diff --check` -> exit 0; CRLF warnings only.
- Review gate -> PASS WITH WARNING (backend + curriculum + kids safety + QA
  passed; frontend not applicable; acceptance auditor not applicable until
  manual production smoke).
- Targeted staged scope: 10 backend product/test files; no `.env` files
  staged; no secrets in diff.

Push:
- `git push origin main` -> success (`6409e63..8d67c9b main -> main`).

Railway:
- `aiteacher` backend deployment
  `5825f93f-b66a-43a6-a80b-e3777850ed2b` -> SUCCESS.
- `aware-alignment` frontend deployment
  `55ae43b3-7d59-44dc-a97b-d6a21c146cd5` -> SUCCESS.

Post-deploy verification:
- Backend `/health` -> HTTP 200; `status=ok`; postgres ok; redis ok; uptime
  25s at `2026-07-10T06:00:54.276Z`.
- Frontend `/demo/setup` -> HTTP 200.
- Backend logs -> migrations applied, `[server] listening on 0.0.0.0:8080`,
  PostgreSQL ready, Redis ready, WS attached.
- Voice logs -> `[stt:config] provider=deepgram model=nova-2 language=en` and
  `[stt:lifecycle] status="open"` observed for the owner lesson reconnect.
- Recent backend HTTP 4xx log check -> no entries.
- Recent backend HTTP 5xx log check -> no entries.
- Error-pattern sweep for `HTTP 400`, `Unhandled`, `ECONNREFUSED`, `Cannot
  find`, `Missing`, `Error:`, `voice_unavailable`, `STT_CONNECT_FAILED` -> no
  entries.

Pending:
- Manual authenticated owner paid lesson section `1.1` mic smoke with real
  microphone remains required.

---

## DEPLOYMENT RECORD - Paid lesson runtime TTS/cursor repair - 2026-07-09

### Pre-Deploy Gates

```powershell
cd backend
$env:npm_config_cache='D:\codex-npm-cache'
$env:TEMP='D:\codex-temp'
$env:TMP='D:\codex-temp'
npx tsc --noEmit
```
Result: `[x] exit 0`

```powershell
git diff --check
```
Result: `[x] exit 0` (CRLF warnings only)

```powershell
cd backend
npm test -- --reporter=dot --silent
```
Result: `[x] exit 0`; 66 files passed; 2133 tests passed.

### Commit and Push

Commit:
`a2c70bf1fe1e933762dd2ee38d9d4afd2db13635`
(`fix(lesson): stabilize paid TTS and cursor turns`)

Push:
`git push origin main` -> success (`f41c760..a2c70bf main -> main`)

### Railway Deploy Confirmation

```powershell
railway service status --all
```

Result:
- `aiteacher` -> `2cfe99c8-2ef2-4c8c-9dc3-4f439d41d576` -> `SUCCESS`
- `aware-alignment` -> `3af88065-c052-4577-831d-717841a9b69c` -> `SUCCESS`
- Postgres -> `SUCCESS`
- Redis -> `SUCCESS`

### Post-Deploy Verification

```powershell
Invoke-WebRequest https://aiteacher-production-cae8.up.railway.app/health
```
Result: HTTP 200; `status=ok`; postgres ok; redis ok.

```powershell
Invoke-WebRequest https://aware-alignment-production.up.railway.app/demo/setup
```
Result: HTTP 200.

Backend logs:
- migrations applied
- `[server] listening on 0.0.0.0:8080`
- `[server] PostgreSQL ready`
- `[server] Redis ready`
- `[server] WS endpoint: ws://localhost:8080/lesson`

HTTP 5xx logs:
`railway logs --service aiteacher --http --status "500..599" --lines 50 --since 10m`
-> no output.

Remaining verification:
- Manual authenticated owner paid lesson voice smoke remains pending.

---

> Complete every item in order. Do NOT skip items.
> Do NOT deploy if any item is вќЊ.

---

## PRE-DEPLOY GATES (all must be вњ…)

### 1. TypeScript Build
```powershell
npx tsc --noEmit
```
Result: `[x] exit 0` | `[ ] errors (list below)`  вЂ” verified 2026-06-13 (TSC_EXIT=0)

Errors (if any):
```
(none)
```

---

### 2. Full Test Suite
```powershell
npm test
```
Result: `[x] all pass (0 new failures)` | `[ ] failures (list below)`  вЂ” verified 2026-06-13

2060 pass / 63 fail (2123 total). All 63 failures pre-existing STT timing suites:
src/ws/__tests__/phase-16k-kids-stt-turn-finalization.test.ts,
phase-18-kids-stt-late-transcript.test.ts, phase-23-kids-stt-wait-ready-buffer.test.ts.

Failures (if any):
```
Pre-existing: 63 STT fake-timer/timing tests (= documented baseline, unrelated to V2)
New failures: (none)
```

---

### 3. Backend Code Review
Agent: `backend-reviewer`
Result: `[ ] PASS` | `[ ] PASS WITH WARNINGS` | `[ ] FAIL`

Critical issues (if any):
```
(none)
```

---

### 4. Git Status Check
```powershell
git status
git diff --stat HEAD
```
Result:
```
[x] No unintended files staged   вЂ” working tree clean
[x] No .env files staged         вЂ” only .env.example (template, no secrets) in last commit
[x] No secrets in diff
[x] Only targeted files changed  вЂ” HEAD = origin/main = a637c55, 0 ahead
```

---

### 5. Commit
```powershell
git add backend/src/[specific files]
git add frontend/src/[specific files]
git status  # verify staged files only
git commit -m "$(cat <<'EOF'
<commit message here>

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

Commit SHA: `[x] a637c55d3fcb74508ae54d82c729182def53d607` (Phase 9 pre-deploy: document V2 flags in .env.example)
Prior phase commits already on main: 1acfd57 (Phase 8), ff67d30 (Phase 7), 659d95a (Phases 1-6)

---

### 6. Push
```powershell
git push origin main
```
Result: `[x] pushed` | `[ ] rejected (resolve conflict first)`  вЂ” origin/main = a637c55, branch up to date, 0 commits ahead

---

### 7. Railway Deploy Confirmation
```powershell
railway logs --service aiteacher
```
Auto-deployed on push to main (GitHub-linked). `railway status --json` 2026-06-13:
- service `aiteacher` (Node backend): commit a637c55, status SUCCESS, 2026-06-13T16:14:06Z
- service `aware-alignment` (Caddy frontend): commit a637c55, status SUCCESS, 2026-06-13T16:14:06Z

Look for:
```
[x] [server] listening on 0.0.0.0:8080   (Railway maps PORTв†’8080; "4000" is local-dev port)
[x] No startup errors    (one benign Redis "already connecting" race вЂ” self-heals; [redis] connected confirmed)
[x] No missing env variable errors   (auth/TTS/OpenAI/Langfuse all loaded)
```

---

## POST-DEPLOY VERIFICATION (within 10 minutes)

### 8. Voice System Health
Railway logs to check:
```
[x] [tts:provider_check] logged at startup (openai selected, elevenlabs key present)
[~] {"event":"[stt:config]"} / [stt:lifecycle] open  в†ђ appears only on a live Kids session;
     NOT observable from startup logs alone вЂ” requires manual live verification (see PENDING below)
[x] No HTTP 400 errors (startup logs clean)
[x] No unhandled rejection errors (startup logs clean)
```

### 9. Lesson Flow Health
Railway logs to check:
```
[~] Kids session connects without error  в†ђ requires a live session; not exercised by startup logs
[~] Exercise context message sent        в†ђ requires a live session
[x] No WebSocket disconnects (WS endpoint attached: [ws] LessonWS attached at ws://localhost/lesson)
```
Health endpoint (live): GET /health в†’ HTTP 200 {postgres:ok, redis:ok}, uptime 94s, 2026-06-13T16:17:53Z.

### 10. Frontend Health
Browser console to check:
```
[x] Frontend serves: GET https://aware-alignment-production.up.railway.app/ в†’ HTTP 200
[~] No uncaught errors / WS connects / exercise panel renders в†ђ requires browser; manual verification PENDING
```

---

## ROLLBACK

If any post-deploy check fails:

```powershell
# Find last known-good SHA
git log --oneline -10

# Revert on Railway by redeploying previous commit
git revert HEAD --no-edit
git push origin main
```

Or via Railway dashboard: Deployments в†’ previous deploy в†’ Redeploy.

**Rollback triggers:**
- Server not listening within 60s of deploy
- Deepgram HTTP 400 appearing in logs after deploy
- Any billing/auth error in logs
- Kids session connection failure rate > 20%

---

## CHECKLIST STATUS

```
Latest completed deploy: Paid teacher English task-help deterministic gap-fill repair (commit 1ee5613) - 2026-07-10
Deployment status:       DEPLOYED
Authorization:           user asked Codex to test paid teacher AI behavior, fix failures, and decide whether the brain side is ready
Railway services:
  - aiteacher backend: deployment 8b0cd48e-edd1-4199-9736-1bc3ac573895 SUCCESS, commit 1ee5613
  - aware-alignment frontend: deployment e9e1d4b0-cb49-4a7b-8b1f-0bb769b8c889 SUCCESS, commit 1ee5613
Pre-deploy verification:
  - cd backend; npx vitest run src/lesson/__tests__/paid-vocab-flow.test.ts --reporter=dot --silent -> exit 0; 1 file / 8 tests passed
  - cd backend; npx vitest run src/lesson/__tests__/paid-vocab-flow.test.ts src/voice/__tests__/voice-turn-stabilizer.test.ts src/voice/stt-multilingual.test.ts src/exercises/runtime-qa/pedagogical-behavior.qa.test.ts --reporter=dot --silent -> exit 0; 4 files / 221 tests passed
  - cd backend; npx tsc --noEmit -> exit 0
  - cd backend; npm test -- --reporter=dot --silent -> exit 0; 68 files / 2174 tests passed
  - git diff --cached --check before product commit -> exit 0; CRLF warnings only
Post-deploy verification:
  - backend /health -> HTTP 200, status ok, postgres ok, redis ok, uptime 352s at 2026-07-10T14:06:12.695Z
  - frontend /demo/setup -> HTTP 200, served SPA HTML
  - backend logs -> migrations applied, server listening on 0.0.0.0:8080, PostgreSQL ready, Redis ready, WS attached
  - frontend logs -> Caddy serving on :8080
  - backend/frontend HTTP logs status 400..599 over checked 10-minute window -> no entries returned
  - backend/frontend critical log sweeps -> no findings
Pending:
  - manual authenticated paid lesson microphone smoke: EN answer, RU selector clarification, UA selector clarification, mixed answer cleanup, TTS/log correlation

Latest completed deploy: Paid lesson mic UX parity repair (commit 84110f3) - 2026-07-09
Deployment status:       DEPLOYED
Authorization:           user explicitly requested "deploy"
Railway services:
  - aiteacher backend: deployment d135b78f-08f1-401b-8b16-5269a0525828 SUCCESS, commit 84110f3
  - aware-alignment frontend: deployment 8bcac989-c795-414c-9aa5-7c7f8a5e66a9 SUCCESS, commit 84110f3
Pre-deploy verification:
  - cd frontend; npm run build -> exit 0; TypeScript and Vite production build completed
  - cd backend; npx tsc --noEmit -> exit 0
  - cd backend; npm test -- --reporter=dot --silent -> exit 0; 66 files, 2134 tests
  - git diff --check -> exit 0; CRLF warnings only
  - review gate -> PASS WITH WARNING (frontend + QA PASS; RISK-026)
Post-deploy verification:
  - backend /health -> HTTP 200, postgres ok, redis ok, uptime 42s at 2026-07-09T13:05:59.438Z
  - frontend /demo/setup -> HTTP 200, served /assets/index-BHvv8tow.js
  - backend logs -> migrations applied, server listening on 0.0.0.0:8080, PostgreSQL ready, Redis connected, WS attached
  - Redis startup race "already connecting/connected" observed, then [redis] connected and health redis ok
  - checked 10-minute HTTP 4xx/5xx log windows -> no entries returned
Pending:
  - manual authenticated owner paid lesson mic UX smoke for section 1.1

Latest completed deploy: Paid lesson voice/state follow-up repair (commit 2d15350) - 2026-07-09
Deployment status:       DEPLOYED
Authorization:           user explicitly requested "deploy"
Railway services:
  - aiteacher backend: deployment c1d6d54d-c1d2-4558-80af-9a79a5ca8cd2 SUCCESS, commit 2d15350
  - aware-alignment frontend: deployment ed41ec51-ed38-4708-8ce4-b4826ff4d8e2 SUCCESS, commit 2d15350
Pre-deploy verification:
  - cd backend; npx tsc --noEmit -> exit 0
  - cd backend; npm test -- --reporter=dot --silent -> exit 0; 66 files, 2134 tests
  - git diff --check -> exit 0; CRLF warnings only
  - review gate -> PASS WITH WARNING (backend + curriculum + QA PASS; RISK-025)
Post-deploy verification:
  - backend /health -> HTTP 200, postgres ok, redis ok, uptime 44s at 2026-07-09T12:44:05.215Z
  - frontend /demo/setup -> HTTP 200
  - backend logs -> migrations applied, server listening on 0.0.0.0:8080, PostgreSQL ready, Redis ready, WS attached
  - checked 10-minute HTTP 4xx/5xx log windows -> no entries returned
Pending:
  - manual authenticated owner paid lesson voice smoke for section 1.1

Latest completed deploy: Owner-only paid lesson access bypass (commit c2d7966) - 2026-07-09
Deployment status:       DEPLOYED
Authorization:           user explicitly requested "задеплой и сохрани все"
Railway services:
  - aiteacher backend: deployment fdf6da76-594f-4070-8ee7-f660125e8d01 SUCCESS, commit c2d7966
  - aware-alignment frontend: deployment 59712f47-9255-429e-af82-88198fbdcf0e SUCCESS, commit c2d7966
Pre-deploy verification:
  - cd backend; npx tsc --noEmit -> exit 0
  - cd backend; npm test -- --reporter=dot --silent -> exit 0; 65 files, 2131 tests
  - review gate -> PASS WITH WARNING (backend + QA PASS; RISK-023)
  - git diff --check -> exit 0; CRLF warnings only
Post-deploy verification:
  - backend /health -> HTTP 200, postgres ok, redis ok, uptime 20s at 2026-07-09T11:37:22Z
  - frontend /demo/setup -> HTTP 200
  - backend logs -> server listening, PostgreSQL ready, Redis ready, WS attached
Pending:
  - manual authenticated owner account smoke for /lesson/start and /classroom/:sessionId

Latest completed deploy: Kids STT teacher-echo target correction (commit ed10f86) - 2026-07-09
Deployment status:       DEPLOYED
Railway services:
  - aiteacher backend: deployment 2e247e8d-508c-4f0e-a961-be16974a4e46 SUCCESS, commit ed10f86
  - aware-alignment frontend: deployment 81bebd19-c2aa-4d84-b7d8-b8a1e7075e62 SUCCESS, commit ed10f86
Pre-deploy verification:
  - cd backend; npx tsc --noEmit -> exit 0
  - cd backend; npm test -- --reporter=dot --silent -> exit 0; 64 files, 2127 tests
  - review gate -> PASS (backend, QA, curriculum; frontend/safety/auditor N/A)
Post-deploy verification:
  - backend /health -> HTTP 200, postgres ok, redis ok, uptime 620s at 2026-07-09T08:15:01Z
  - backend logs -> server listening, PostgreSQL ready, Redis ready
  - 10-minute checked log window -> no HTTP 400, Unhandled, ECONNREFUSED, missing module, voice_unavailable, SESSION_VERIFICATION_FAILED, or NO_CHILD_PROFILE in checked tail
Pending:
  - manual browser/microphone retest for the exact `Say again. Blue.` correction path
Latest completed deploy: Kids /kids no-profile frontend crash fix (commit b0d56e9) вЂ” 2026-07-09
Deployment status:       DEPLOYED
Railway services:
  - aware-alignment frontend: deployment 4d0a2e07-305a-4c6d-9b5c-8a66be13fc73 SUCCESS, commit b0d56e9
  - aiteacher backend: deployment b8021d98-70a7-49cf-b9d5-653c715af410 SUCCESS, commit b0d56e9
Post-deploy verification:
  - frontend / and /kids -> HTTP 200
  - backend /health -> HTTP 200, postgres ok, redis ok
  - production browser verification: mocked authenticated no-child-profile /kids flow -> /kids/onboarding, pageErrors []

Last completed deploy: Kids Personalization V2 Phases 1-8 (commit a637c55) вЂ” 2026-06-13
Deployment status:     DEPLOYED (code live, ALL 7 V2 flags OFF in production = no behavior change)
Production flags:       railway variables в†’ none of the 7 KIDS_* V2 flags set = default OFF (verified)

PENDING (requires user go-ahead вЂ” manual production verification + prod env mutation):
  - Enable 7 V2 flags one phase at a time (master KIDS_PERSONALIZATION_V2 first), verifying logs between each
  - Live Kids voice session per tier to satisfy "All feature flags tested in production"
  - Browser-side frontend verification (console / WS / exercise panel)
```
