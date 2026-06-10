# NEXT_ACTION.md

> This file always contains EXACTLY ONE next task.
> Goal Executor reads this before picking what to do.
> Update immediately when the task is picked up or completed.

---

## CURRENT NEXT ACTION

**Task:** Phase 6 — QA + Railway deploy
**Type:** DEPLOY
**Agent:** deploy-railway
**Description:**
  Phases 1-5 are complete and committed (commit 2aa5dfa).
  Remaining steps:
  1. git push origin main → triggers Railway deploy
  2. Monitor Railway build log — look for migration 023 run or run manually
  3. GET /health → expect 200
  4. GET /api/kids/child-profile with no token → expect 401
  5. POST /api/kids/child-profile with valid token → verify 201
  6. Start Kids lesson session without profile (KIDS_REQUIRE_PROFILE=true) → expect 4403
  7. Confirm no new errors in Railway log for 10 min

**Inputs:**
  - commit 2aa5dfa (all 13 changed/created files)
  - backend/migrations/023_kids_onboarding_fields.sql (must run on prod DB)

**Success criterion:**
  Railway live, migration applied, all AC verified, no critical errors.

**Blocker:**
  Migration 023 must run on production PostgreSQL — can be applied via Railway CLI or psql.

---

## PHASE SEQUENCE (after sign-off)

```
Phase 1 — Entry Point
  Add Kids Mode button/section to authenticated platform (HomePage + LearningPage)
  Auth guard: unauthenticated → redirect to login
  Estimated: 1–2h

Phase 2 — Onboarding Wizard
  KidsOnboardingPage.tsx (new)
  KidsPrototypePage.tsx (refactor: check profile, show lobby)
  App.tsx: add /kids/onboarding route
  Estimated: 3–4h

Phase 3 — Backend API + Migration
  backend/migrations/023_kids_onboarding_fields.sql
  backend/src/api/kids-profile-routes.ts
  backend/src/api/routes.ts or server.ts (mount new routes)
  Estimated: 2–3h

Phase 4 — Kids Brain Integration
  backend/src/ws/lesson-ws.ts (load profile at focus_lesson_start)
  backend/src/kids-brain/teacher-response/interest-personalizer.ts (new)
  KidsSessionMemory type extension
  Estimated: 2–3h

Phase 5 — Tests
  backend/src/api/__tests__/kids-child-profile-api.test.ts
  backend/src/kids-brain/teacher-response/__tests__/interest-personalizer.test.ts
  kids-brain-v1-real-ws-smoke.test.ts (new: no-profile → 4403)
  Estimated: 2–3h

Phase 6 — QA + Deploy
  tsc --noEmit, npm test, Railway deploy, production verification
  Estimated: 1h
```

---

## TEMPLATE FOR NEXT TASK ENTRY

```
## CURRENT NEXT ACTION

**Task:** <short name>
**Type:** CODE | TEST | REVIEW | DEPLOY | RESEARCH | PLAN | USER ACTION
**Agent:** goal-executor | planner | implementer | backend-reviewer |
           frontend-reviewer | curriculum-reviewer | qa-tester |
           production-log-analyzer | deploy-railway
**Description:**
  <what exactly to do — concrete, not vague>

**Inputs:**
  - <files to read>

**Success criterion:**
  <how to verify the task is done — testable, not vague>

**Blocker:**
  <what could block this, or "None expected">
```
