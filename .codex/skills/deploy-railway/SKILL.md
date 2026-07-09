---
name: "deploy-railway"
description: "Execute the user-authorized Railway deployment checklist with preflight and post-deploy verification."
---

> Codex adaptation: follow AGENTS.md first. Treat .codex/workflow/ as the
> writable workflow state. Do not modify .claude. Use subagents only when the
> user explicitly requests delegation or parallel agent work; otherwise execute
> this checklist in the current session. External research and external writes
> require authorization from the current request.

> Automation V2: apply `.codex/workflow/DEPLOYMENT_GATE.md` before any external
> mutation. A paid deploy requires explicit approval unless the current request
> already grants it. Persist exact deploy and verification evidence so
> `Continue.` can resume safely.

# Agent: Deploy Railway

## Role
Prepare and execute a safe Railway deployment. Verify the deployment
succeeded via logs. Write deployment evidence to `GOAL_PROGRESS.md` and
update `DEPLOYMENT_CHECKLIST.md`. Alert Goal Executor if post-deploy
verification fails.

---

## Inputs
- `.codex/workflow/DEPLOYMENT_CHECKLIST.md` — all pre-deploy gates
- `.codex/workflow/GOAL_PROGRESS.md` — what was implemented and tested
- `.codex/workflow/REVIEW_REPORT.md` — reviewer verdict
- `AGENTS.md` — safety constraints

---

## Outputs
- Updated `DEPLOYMENT_CHECKLIST.md` (all items checked)
- Updated `GOAL_PROGRESS.md` with deployment evidence
- Deploy command output (commit SHA, push result, Railway logs)

---

## Process

### Gate 1: TypeScript build
```powershell
npx tsc --noEmit
```
MUST be exit 0. If not → STOP, do not deploy, report to Goal Executor.

### Gate 2: Tests
```powershell
npm test
```
MUST be all pass (except pre-existing fsm.test.ts).
If new failures → STOP, do not deploy.

### Gate 3: Reviewer verdict
Read `REVIEW_REPORT.md`.
MUST be `✅ PASS` or `⚠️ PASS WITH WARNINGS`.
If `❌ FAIL` → STOP, do not deploy.

### Gate 4: Git status check
```powershell
git status
git diff --stat HEAD
```
Verify:
- No unintended files staged
- No .env files in diff
- No secrets visible in diff
- Only the files listed in GOAL_PROGRESS.md are changed

### Gate 5: Targeted commit
```powershell
git add backend/src/<specific files>
git add frontend/src/<specific files>
git status  # verify what is staged
git commit -m "$(cat <<'EOF'
<message describing what was implemented>

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```
Record commit SHA.

### Gate 6: Push
```powershell
git push origin main
```
If rejected → do NOT force push. Investigate conflict first.

### Gate 7: Railway deploy verification
```powershell
railway logs --tail 100
```
Wait up to 60 seconds for:
```
[server] listening on port 4000
```

If not seen within 60s:
```powershell
railway logs --tail 200
```
Look for startup crash. Report to Goal Executor.

---

## Post-Deploy Checks (10 minutes)

Run after deploy. Look for these in Railway logs:

### Required (must be present)
```
[server] listening on port 4000
```

### Good signs (present = healthy)
```
[stt:config] provider=deepgram ...
[db] connected to PostgreSQL
[redis] connected
```

### Bad signs (any present = possible issue)
```
HTTP 400              → Deepgram config issue
Unhandled rejection   → Missing try/catch
ECONNREFUSED          → DB or Redis not connected
Error: Cannot find    → Missing module or env var
```

---

## Rollback Decision

Initiate rollback if:
- Server not listening after 60s
- Unhandled rejection at startup
- Missing env var error
- Deepgram HTTP 400 in first 5 minutes (was not present before deploy)

Rollback command:
```powershell
git revert HEAD --no-edit
git push origin main
```
Or use Railway dashboard: Deployments → previous deploy → Redeploy.

---

## Strict Rules

- NEVER deploy if TypeScript build has errors
- NEVER deploy if tests fail (excluding pre-existing fsm.test.ts)
- NEVER deploy if REVIEW_REPORT.md shows ❌ FAIL
- NEVER use `git add .` — only targeted git add
- NEVER commit .env files
- NEVER force push to main
- ALWAYS record commit SHA before claiming deploy complete
- ALWAYS verify `[server] listening on port 4000` before claiming deploy success

---

## Evidence Requirements

```
DEPLOY COMPLETE

Pre-deploy gates:
  TypeScript build: npx tsc --noEmit → exit 0
  Full test suite:  npm test → X/Y pass
  Reviewer verdict: PASS | PASS WITH WARNINGS
  Git status:       clean (no unintended files)

Commit:
  SHA: <sha>
  Message: <first line>
  Files: <N files committed>

Push:
  git push origin main → success

Railway:
  [server] listening on port 4000 → ✅ SEEN at <timestamp>
  Startup errors: none | <list>

Post-deploy (10 min):
  HTTP 400 errors: none | <N>
  Unhandled rejections: none | <N>
  STT config logged: yes | no
  Overall: HEALTHY | DEGRADED (describe)

Rollback needed: no | yes (reason: <...>)
```
