# NEXT_ACTION.md

> This file always contains EXACTLY ONE next task.
> Goal Executor reads this before picking what to do.
> Update immediately when the task is picked up or completed.

---

## CURRENT NEXT ACTION

**Task:** Deploy and production-verify `/kids` no-profile crash fix
**Type:** DEPLOY-VERIFY
**Phase:** Phase 9 - Deployment
**Agent:** goal-executor -> deploy-railway + production-log-analyzer + QA tester

**Why this is next:**
  The planned `KIDS_WARMUP_ENABLED` live mic/STT verification is blocked because
  the user opened production `/kids` and hit a blank screen before onboarding.
  Browser console evidence showed `GET /api/kids/child-profile -> 404` followed
  by `TypeError: Cannot read properties of null (reading 'teacherId')`.
  The frontend repair is implemented and locally verified, but it is not yet
  deployed to production.

**Description:**
  Deploy commit containing `frontend/src/pages/KidsPrototypePage.tsx` null-profile
  guard, then verify production:
  1. Commit the repair and workflow checkpoint.
  2. Deploy the frontend service `aware-alignment` to Railway.
  3. Wait for Railway deployment `SUCCESS`.
  4. Verify production `/` and `/kids` return HTTP 200.
  5. For an authenticated user without child profile, verify `/kids` redirects
     to `/kids/onboarding` and does not throw a React page error.
  6. Check production logs for critical frontend/backend errors relevant to this
     flow.
  7. Update workflow evidence. On pass, restore next action to
     `KIDS_WARMUP_ENABLED` production enablement and live warmup mic/STT test.

**Latest verified local evidence (2026-07-09):**
  - `cd frontend; npm run build` -> exit 0; TypeScript + Vite production build
    passed; Vite chunk-size warning only.
  - Local production-build browser reproduction:
    Vite preview on `127.0.0.1:4173` + Playwright with mocked authenticated
    `/api/me` and mocked `/api/kids/child-profile -> 404` -> exit 0; final URL
    `/kids/onboarding`; `pageErrors: []`.

**Inputs:**
  - User production console evidence for `/kids` blank screen.
  - `frontend/src/pages/KidsPrototypePage.tsx`.
  - Railway frontend service `aware-alignment`.

**Success criterion for this next action:**
  The frontend fix is committed and deployed; production `/kids` no longer blank
  screens for authenticated users with no child profile; workflow checkpoint is
  updated with exact deployment and verification evidence.

**Current blocker / stop condition:**
  None for the repair deploy. After this deploy passes, the original manual
  warmup mic/STT verification blocker resumes for `KIDS_WARMUP_ENABLED`.

**On PASS:** Advance back to `KIDS_WARMUP_ENABLED` production enablement and
live warmup voice/STT verification.
**On FAIL:** Diagnose production deploy or route behavior; do not enable
`KIDS_WARMUP_ENABLED` until `/kids` onboarding access is working.

---

### Phase-advance rule (ALWAYS included after REVIEW tasks)
After a REVIEW PASS, Goal Executor MUST:
1. Mark phase complete in `GLOBAL_GOAL.md` phase table
2. Append completion entry to `GOAL_PROGRESS.md`
3. Detect next NEXT or PENDING phase from `GLOBAL_GOAL.md`
4. Write that phase's CODE task here
5. Continue immediately - no user confirmation required
