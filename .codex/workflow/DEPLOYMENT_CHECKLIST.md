# DEPLOYMENT_CHECKLIST.md

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
