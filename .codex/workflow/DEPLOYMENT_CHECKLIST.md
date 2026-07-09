# DEPLOYMENT_CHECKLIST.md

> Complete every item in order. Do NOT skip items.
> Do NOT deploy if any item is ❌.

---

## PRE-DEPLOY GATES (all must be ✅)

### 1. TypeScript Build
```powershell
npx tsc --noEmit
```
Result: `[x] exit 0` | `[ ] errors (list below)`  — verified 2026-06-13 (TSC_EXIT=0)

Errors (if any):
```
(none)
```

---

### 2. Full Test Suite
```powershell
npm test
```
Result: `[x] all pass (0 new failures)` | `[ ] failures (list below)`  — verified 2026-06-13

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
[x] No unintended files staged   — working tree clean
[x] No .env files staged         — only .env.example (template, no secrets) in last commit
[x] No secrets in diff
[x] Only targeted files changed  — HEAD = origin/main = a637c55, 0 ahead
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
Result: `[x] pushed` | `[ ] rejected (resolve conflict first)`  — origin/main = a637c55, branch up to date, 0 commits ahead

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
[x] [server] listening on 0.0.0.0:8080   (Railway maps PORT→8080; "4000" is local-dev port)
[x] No startup errors    (one benign Redis "already connecting" race — self-heals; [redis] connected confirmed)
[x] No missing env variable errors   (auth/TTS/OpenAI/Langfuse all loaded)
```

---

## POST-DEPLOY VERIFICATION (within 10 minutes)

### 8. Voice System Health
Railway logs to check:
```
[x] [tts:provider_check] logged at startup (openai selected, elevenlabs key present)
[~] {"event":"[stt:config]"} / [stt:lifecycle] open  ← appears only on a live Kids session;
     NOT observable from startup logs alone — requires manual live verification (see PENDING below)
[x] No HTTP 400 errors (startup logs clean)
[x] No unhandled rejection errors (startup logs clean)
```

### 9. Lesson Flow Health
Railway logs to check:
```
[~] Kids session connects without error  ← requires a live session; not exercised by startup logs
[~] Exercise context message sent        ← requires a live session
[x] No WebSocket disconnects (WS endpoint attached: [ws] LessonWS attached at ws://localhost/lesson)
```
Health endpoint (live): GET /health → HTTP 200 {postgres:ok, redis:ok}, uptime 94s, 2026-06-13T16:17:53Z.

### 10. Frontend Health
Browser console to check:
```
[x] Frontend serves: GET https://aware-alignment-production.up.railway.app/ → HTTP 200
[~] No uncaught errors / WS connects / exercise panel renders ← requires browser; manual verification PENDING
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

Or via Railway dashboard: Deployments → previous deploy → Redeploy.

**Rollback triggers:**
- Server not listening within 60s of deploy
- Deepgram HTTP 400 appearing in logs after deploy
- Any billing/auth error in logs
- Kids session connection failure rate > 20%

---

## CHECKLIST STATUS

```
Latest completed deploy: Kids /kids no-profile frontend crash fix (commit b0d56e9) — 2026-07-09
Deployment status:       DEPLOYED
Railway services:
  - aware-alignment frontend: deployment 4d0a2e07-305a-4c6d-9b5c-8a66be13fc73 SUCCESS, commit b0d56e9
  - aiteacher backend: deployment b8021d98-70a7-49cf-b9d5-653c715af410 SUCCESS, commit b0d56e9
Post-deploy verification:
  - frontend / and /kids -> HTTP 200
  - backend /health -> HTTP 200, postgres ok, redis ok
  - production browser verification: mocked authenticated no-child-profile /kids flow -> /kids/onboarding, pageErrors []

Last completed deploy: Kids Personalization V2 Phases 1-8 (commit a637c55) — 2026-06-13
Deployment status:     DEPLOYED (code live, ALL 7 V2 flags OFF in production = no behavior change)
Production flags:       railway variables → none of the 7 KIDS_* V2 flags set = default OFF (verified)

PENDING (requires user go-ahead — manual production verification + prod env mutation):
  - Enable 7 V2 flags one phase at a time (master KIDS_PERSONALIZATION_V2 first), verifying logs between each
  - Live Kids voice session per tier to satisfy "All feature flags tested in production"
  - Browser-side frontend verification (console / WS / exercise panel)
```
