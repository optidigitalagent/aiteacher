# GLOBAL_GOAL.md - Mentium AI Teacher

## ACTIVE GOAL

**Ordinary Mentium lesson mode production readiness - STARTED 2026-07-09**

Make the ordinary, non-Kids Mentium textbook/demo lesson flow the current
priority and verify it is safe to present.

**Paused goal:** Kids Personalization V2 Phase 9. Kids remains deployed with
`KIDS_PERSONALIZATION_V2=true` and `KIDS_WARMUP_ENABLED=true`, but live user
evidence on 2026-07-09 showed a separate Kids progression loop after correct
classification. Per user instruction, Kids work is paused and ordinary mode is
now higher priority.

---

## SCOPE

In scope:
- Ordinary adult/demo lesson entry points.
- Public section readiness API.
- Demo setup and demo classroom flow.
- Paid lesson start and paid classroom WebSocket flow when valid
  authentication/subscription evidence is available.
- Build, test, production health, and production-log checks.

Out of scope unless explicitly re-prioritized:
- Kids mode product fixes.
- Kids Brain progression/personalization changes.
- Billing/payment/auth logic changes.
- STT/TTS configuration changes.
- Prompt changes in `docs/master-prompt.md`.

---

## PHASE SEQUENCE

| Phase | Name | Status |
|-------|------|--------|
| 0 | Intake and baseline evidence | COMPLETE - local and production baseline green 2026-07-09 |
| 1 | Ordinary demo production smoke | NEXT |
| 2 | Ordinary paid lesson production smoke | PENDING |
| 3 | Review, risks, and completion audit | PENDING |

---

## ACCEPTANCE CRITERIA

The goal is NOT complete until all applicable criteria below are satisfied or
explicitly blocked by unavailable credentials.

### Baseline
- [x] Backend TypeScript compiles: `cd backend; npx tsc --noEmit` -> exit 0.
- [x] Full backend suite passes: `cd backend; npm test -- --reporter=dot --silent` -> 64 files, 2127 tests passed.
- [x] Ordinary/demo targeted suite passes: `cd backend; npx vitest run src/demo src/exercises/runtime-qa --reporter=dot --silent` -> 4 files, 298 tests passed.
- [x] Frontend production build passes: `cd frontend; npm run build` -> exit 0.
- [x] Production backend `/health` returns HTTP 200 with postgres ok and redis ok.
- [x] Production frontend `/demo/setup` returns HTTP 200.
- [x] Production `/lesson/sections/status` returns HTTP 200 with ready ordinary sections.

### Demo Flow
- [ ] Authenticated demo start can create or resume a demo session, or the
  blocker is recorded as `DEMO_USED` / unavailable auth.
- [ ] `/demo/classroom/:demoSessionId` renders without a white screen.
- [ ] Demo lesson core interaction is verified by browser/manual evidence or
  an automated harness using legitimate auth state.

### Paid Ordinary Flow
- [ ] Public section readiness identifies at least one `GOLD` section with
  `canStartPaidLesson=true`.
- [ ] Authenticated `/lesson/start` succeeds for a chosen ready section, or the
  blocker is recorded as unavailable subscription/auth.
- [ ] `/classroom/:sessionId` opens WebSocket and receives expected paid lesson
  events: `lesson_ready`, `ai_text`, `audio_chunk` or a documented voice
  fallback, and `teacher_turn_end`.
- [ ] No critical ordinary-flow production log errors are observed in the
  checked window.

### Review and Completion
- [ ] Mandatory review gate recorded: backend reviewer, frontend reviewer,
  curriculum reviewer, kids safety monitor, QA tester, acceptance auditor
  each marked RUN or NOT APPLICABLE with reason.
- [ ] Acceptance auditor returns GOAL COMPLETE, or the goal remains blocked
  with the exact missing credential/manual verification.

---

## CURRENT CONSTRAINTS

- Local C: drive has no free space; npm commands must use `D:\codex-npm-cache`
  and `D:\codex-temp` until disk space is restored.
- Do not use browser console JWTs pasted by the user as credentials.
- Do not perform new paid-service mutations or deploys without explicit user
  approval.
