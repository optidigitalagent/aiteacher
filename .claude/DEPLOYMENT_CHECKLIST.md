# DEPLOYMENT_CHECKLIST.md

> Complete every item in order. Do NOT skip items.
> Do NOT deploy if any item is ❌.

---

## PRE-DEPLOY GATES (all must be ✅)

### 1. TypeScript Build
```powershell
npx tsc --noEmit
```
Result: `[ ] exit 0` | `[ ] errors (list below)`

Errors (if any):
```
(none)
```

---

### 2. Full Test Suite
```powershell
npm test
```
Result: `[ ] all pass` | `[ ] failures (list below)`

Failures (if any):
```
Pre-existing: tests/fsm.test.ts (process.exit — not new)
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
[ ] No unintended files staged
[ ] No .env files staged
[ ] No secrets in diff
[ ] Only targeted files changed
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

Commit SHA: `[ ] <fill after commit>`

---

### 6. Push
```powershell
git push origin main
```
Result: `[ ] pushed` | `[ ] rejected (resolve conflict first)`

---

### 7. Railway Deploy Confirmation
```powershell
railway logs --tail 50
```
Look for:
```
[ ] [server] listening on port 4000
[ ] No startup errors
[ ] No missing env variable errors
```

---

## POST-DEPLOY VERIFICATION (within 10 minutes)

### 8. Voice System Health
Railway logs to check:
```
[ ] {"event":"[stt:config]",...}  ← Kids STT initialized correctly
[ ] {"event":"[stt:lifecycle]","status":"open",...}  ← Deepgram connected
[ ] No HTTP 400 errors
[ ] No unhandled rejection errors
```

### 9. Lesson Flow Health
Railway logs to check:
```
[ ] Kids session connects without error
[ ] Exercise context message sent (type: exercise_context)
[ ] No WebSocket disconnects within first 30s
```

### 10. Frontend Health
Browser console to check:
```
[ ] No uncaught errors
[ ] WebSocket connects successfully
[ ] Exercise panel renders (or graceful placeholder shown)
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
Last completed deploy: Phase 22/23 (commit a935927)
Pending deploy:        Phase 1–3 (exercise architecture)
Deployment status:     NOT DEPLOYED
```
