# NEXT_ACTION.md

> This file always contains EXACTLY ONE next task.
> Goal Executor reads this before picking what to do.
> Update immediately when the task is picked up or completed.

---

## CURRENT NEXT ACTION

**Task:** Deploy owner-only paid lesson access bypass after explicit approval
**Type:** DEPLOY-BLOCKED
**Phase:** Phase 3 - Deploy and production owner smoke
**Agent:** goal-executor + deploy-railway

**Why this is next:**
  The backend implementation and local validation are complete. The user asked
  not to touch LiqPay keys/payment flow, and AGENTS requires explicit approval
  before paid-service production mutation/deployment.

**Completed evidence:**
  - `backend/src/billing/subscription-service.ts` grants virtual active access
    only when the server-side `users.email` is `artenon92@gmail.com`.
  - `backend/src/billing/__tests__/subscription-service.test.ts` covers owner
    access, case-insensitive matching, non-owner no-profile blocking, and
    normal active subscription preservation.
  - `cd backend; npx tsc --noEmit` -> exit 0.
  - `cd backend; npx vitest run src/auth/__tests__/require-auth-guard.test.ts src/billing/__tests__/subscription-service.test.ts --reporter=dot --silent`
    -> exit 0; 2 files passed; 10 tests passed.
  - `cd backend; npm test -- --reporter=dot --silent`
    -> exit 0; 65 files passed; 2131 tests passed.

**Blocked on:**
  Explicit approval to deploy to Railway and then production-smoke the owner
  account paid lesson path.

**Resume action after approval:**
  Commit the scoped backend/test/workflow changes, push/deploy through the
  existing Railway path, verify backend health/logs, then have
  `artenon92@gmail.com` start a ready GOLD paid section and confirm classroom
  entry without `PAYMENT_REQUIRED`, `SUBSCRIPTION_EXPIRED`, or
  `LESSON_LIMIT_REACHED`.
