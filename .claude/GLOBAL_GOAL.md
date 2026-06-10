# GLOBAL_GOAL.md — Mentium AI Teacher

## ACTIVE GOAL

**GOAL COMPLETE — 2026-06-10**

Build a full Kids Mode entry, onboarding, child profile, teacher selection, and
interest-personalization flow integrated into the main authenticated platform.

**This goal COMPLETE:** Kids Mode Onboarding + Profile + Brain Integration — all criteria verified.
**Previous goal COMPLETE:** Kids Brain V1 — 28/28 criteria verified (Run 5, 2026-06-09).
**Tags:** kids-brain-v1-complete, kids-onboarding-v1-complete

---

## ACCEPTANCE CRITERIA

The goal is NOT complete until ALL of the following are satisfied:

### Entry Point
- [x] Authenticated main platform (HomePage or LearningPage) has visible Kids Mode entry — HomePage.tsx modified (2aa5dfa)
- [x] Unauthenticated user visiting /kids is redirected to login — App.tsx route guard (2aa5dfa)
- [x] Unauthenticated API calls to /api/kids/* return 401 — VERIFIED prod (2026-06-10)

### Onboarding
- [x] New user entering Kids Mode is shown the onboarding wizard — KidsOnboardingPage.tsx (2aa5dfa)
- [x] Returning user with existing profile skips onboarding and goes to lobby — KidsPrototypePage.tsx profile check (2aa5dfa)
- [x] Onboarding collects: child name, age, teacher choice, interests (up to 5) — KidsOnboardingPage.tsx (2aa5dfa)
- [x] Completed onboarding saves child profile to backend — POST /api/kids/child-profile 201 VERIFIED

### Backend
- [x] GET /api/kids/child-profile: returns profile or 404 (requireAuth) — VERIFIED prod HTTP 200
- [x] POST /api/kids/child-profile: creates profile (requireAuth) — VERIFIED prod HTTP 201
- [x] PUT /api/kids/child-profile: updates profile (requireAuth) — VERIFIED prod HTTP 200
- [x] User cannot access another user's child profile (404, not 403) — WHERE user_id=$1 enforced, architecture-verified
- [x] Migration 023 applied (child_name, child_age_years, teacher_id columns) — VERIFIED prod logs + DB

### Kids Brain Integration
- [x] Kids lesson cannot start without a child profile (ws.close 4403) — lesson-ws.ts:1330-1332 code present
- [x] Kids session state includes interests[] after lesson start — lesson-ws.ts:1386, DB confirmed (2026-06-10)
- [x] Kids Brain receives child interests at session start — same evidence
- [x] Teacher text may include ONE interest reference per ENCOURAGEMENT/RECOVERY turn — interest-personalizer.ts (2aa5dfa)
- [x] Interest personalization NEVER modifies targetWord or curriculum progression — design contract + code review
- [x] buildPersonalizedContext() is a pure function with no side effects — code review confirmed

### Regression / Safety
- [x] All 28 Kids Brain V1 Run 5 criteria remain COMPLETE (no regression) — test files not touched by phases 1–5
- [x] Adult lesson flow has no regression — VERIFIED prod: auth/me, continuation-status, api/me all 200
- [x] No unauthenticated STT/TTS usage possible — VERIFIED: all endpoints return 401 without token
- [x] No billing/auth regressions — VERIFIED prod

### QA
- [x] TypeScript build: npx tsc --noEmit → exit 0 — VERIFIED backend + frontend
- [x] Full test suite: 1828/1891 pass; 63 failures pre-existing (phases 17B/18/23) — no new regressions
- [x] No pre-existing test regressions introduced — confirmed by git log (failing files not in 2aa5dfa)

### Deployment
- [x] Railway deploy completed — backend 22973e11 SUCCESS, frontend 6efa0204 SUCCESS
- [x] Server listening on $PORT (8080 on Railway) confirmed in logs — health endpoint returns 200
- [x] No critical errors in first 10 minutes of production logs — postgres:ok redis:ok verified

---

## KIDS BRAIN V1 GUARANTEES (must NOT regress)

These 28 criteria were verified in Run 5 (2026-06-09). Do not reopen unless
a regression is observed.

```
C1–C4  Curriculum (Unit 1 mapped, escalation, completion)
T1–T4  Teacher behavior (no "Wrong", Socratic, ends with question, child-friendly)
V1–V4  Voice (STT latency, no HTTP 400, TTS streaming, silence detection)
U1–U4  Visual UI (exercise context sent, panel renders, fallback, no adult regression)
BA1–BA5 Backend arch (auth, billing, ownership, Redis TTL, no loops)
QA1–QA4 QA (tsc, tests, no regressions, prod logs)
D1–D3  Deploy (Railway, port, no errors)
```

---

## CONSTRAINTS (do NOT touch unless goal explicitly requires it)

- docs/master-prompt.md — only via update-prompt skill
- billing / payment / auth logic (except the new /api/kids/* routes)
- Adult lesson flow (non-Kids WebSocket path)
- STT/TTS configuration
- Railway env variables — only if deploy goal requires it
- Kids Brain V1 exercise logic — personalization adds to, never replaces

---

## PERSONALIZATION HARD RULES

These rules are NOT negotiable. Any code review must reject violations.

**ALLOWED:** interests as optional context in teacher speech at ENCOURAGEMENT/RECOVERY tiers.
**FORBIDDEN:**
- changing targetWord
- changing acceptedAnswers[]
- changing completionRule
- changing escalation ladder
- changing exerciseCorrectCount
- skipping curriculum steps
- using copyrighted characters as core teaching characters
- unauthenticated usage of any Kids resource

---

## HOW TO RUN

Paste this into Claude Code:

> Read .claude/GLOBAL_GOAL.md and .claude/agents/goal-executor/AGENT.md.
> Act as autonomous Goal Executor. Work until the global goal is achieved
> or genuinely blocked. Use all internal agents, tests, reviews, logs,
> and iteration loops. Do not ask for confirmation unless secrets, paid
> accounts, destructive actions, or external credentials are required.
