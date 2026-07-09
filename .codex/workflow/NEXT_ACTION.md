# NEXT_ACTION.md

> This file always contains EXACTLY ONE next task.
> Goal Executor reads this before picking what to do.
> Update immediately when the task is picked up or completed.

---

## CURRENT NEXT ACTION

**Task:** Manual production owner smoke for paid lesson access
**Type:** MANUAL-PROD-VERIFY
**Phase:** Phase 3 - Deploy and production owner smoke
**Agent:** goal-executor + lesson-qa

**Why this is next:**
  The owner-only backend bypass has been committed, pushed, and deployed to
  Railway. The remaining evidence gap is a real authenticated production smoke
  for `artenon92@gmail.com`; Codex must not reuse JWTs observed in logs.

**Completed evidence:**
  - `backend/src/billing/subscription-service.ts` grants virtual active access
    only when the server-side `users.email` is `artenon92@gmail.com`.
  - `backend/src/billing/__tests__/subscription-service.test.ts` covers owner
    access, case-insensitive matching, non-owner no-profile blocking, and
    normal active subscription preservation.
  - `cd backend; npx tsc --noEmit` -> exit 0.
  - `cd backend; npm test -- --reporter=dot --silent`
    -> exit 0; 65 files passed; 2131 tests passed.
  - Commit `c2d796617eed81c12c21bd2493f9d62a454bfda7`
    (`fix(billing): allow owner paid lesson access`) pushed to `origin/main`.
  - Railway backend `aiteacher` deployment
    `fdf6da76-594f-4070-8ee7-f660125e8d01` reached SUCCESS at commit
    `c2d7966`.
  - Railway frontend `aware-alignment` deployment
    `59712f47-9255-429e-af82-88198fbdcf0e` reached SUCCESS at commit
    `c2d7966`.
  - Backend `/health` -> HTTP 200, postgres ok, redis ok.
  - Frontend `/demo/setup` -> HTTP 200.
  - Backend logs show migrations applied, `[server] listening on
    0.0.0.0:8080`, PostgreSQL ready, Redis ready, and WS endpoint attached.

**Manual smoke steps:**
  1. Log in as `artenon92@gmail.com` in the normal browser.
  2. Open `https://aware-alignment-production.up.railway.app/learning`.
  3. Choose a ready GOLD Focus 2 section such as `1.1`.
  4. Start the paid lesson.
  5. Expected: no redirect to `/pricing`, no `PAYMENT_REQUIRED`,
     `SUBSCRIPTION_EXPIRED`, or `LESSON_LIMIT_REACHED`; browser enters
     `/classroom/:sessionId`.
  6. Click Begin Lesson and confirm the classroom receives `lesson_ready`,
     `ai_text`, `audio_chunk` or a documented voice fallback, and
     `teacher_turn_end`.

**Current stop condition:**
  Manual production verification is required for the real authenticated owner
  account flow.
