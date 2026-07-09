# NEXT_ACTION.md

> This file always contains EXACTLY ONE next task.
> Goal Executor reads this before picking what to do.
> Update immediately when the task is picked up or completed.

---

## CURRENT NEXT ACTION

**Task:** Manual authenticated production smoke for ordinary Mentium flow
**Type:** MANUAL-PROD-VERIFY
**Phase:** Ordinary mode Phase 1 - Demo production smoke
**Agent:** goal-executor + lesson-qa

**Why this is next:**
  The user explicitly deprioritized Kids after a live Kids loop and said the
  ordinary mode is much more important. Local and production baseline checks
  are green. The remaining evidence gap is a real ordinary lesson smoke:
  demo classroom first, then paid classroom if valid auth/subscription exists.

**Completed evidence:**
  - `cd backend; npx tsc --noEmit` -> exit 0.
  - `cd backend; npx vitest run src/demo src/exercises/runtime-qa --reporter=dot --silent`
    -> exit 0; 4 files passed; 298 tests passed.
  - `cd backend; npm test -- --reporter=dot --silent`
    -> exit 0; 64 files passed; 2127 tests passed.
  - `cd frontend; npm run build` -> exit 0; Vite chunk-size warning only.
  - Production `/health` -> HTTP 200, postgres ok, redis ok.
  - Production `/demo/setup` -> HTTP 200.
  - Production `/lesson/sections/status` -> HTTP 200; GOLD ready sections
    include `1.1`, `1.2`, `1.4`, `2.1`, `2.3`, `3.1`, `4.1`, `4.3`,
    `5.1`, `5.3`, `6.1`, `6.3`, `7.1`, `7.3`, `8.1`, `8.3`.

**Blocker evidence:**
  - `POST /demo/start` without legitimate auth -> HTTP 401.
  - `POST /lesson/start` without legitimate auth -> HTTP 401.
  - Source confirms both routes use `requireAuth`.
  - Browser-console JWTs pasted in chat must not be used as credentials.

**Manual test steps:**
  1. In your normal logged-in browser, open
     `https://aware-alignment-production.up.railway.app/demo/setup`.
  2. Start the demo if available. Expected: it navigates to
     `/demo/classroom/:demoSessionId`, no white screen.
  3. Do one simple demo interaction. Expected: the UI responds and does not
     crash. If you see `DEMO_USED`, report that exact message.
  4. If paid ordinary mode is available, open Learning, choose GOLD section
     `1.1` (or another GOLD ready section), start the lesson, and enter
     `/classroom/:sessionId`.
  5. Expected paid lesson console: `lesson_ready`, then after Begin Lesson
     `ai_text`, `audio_chunk` or a documented voice fallback, and
     `teacher_turn_end`. No `PAYMENT_REQUIRED`, `SUBSCRIPTION_EXPIRED`,
     `INVALID_SESSION`, or white screen.
  6. Send the console snippet or report the exact visible error. Goal Executor
     will inspect production logs for the same time window.

**Success criterion:**
  Ordinary demo and/or paid lesson flow is production-smoked with direct
  evidence, or the exact missing credential/quota/subscription blocker is
  recorded.

**Current stop condition:**
  AGENTS stop rule 1/4 - legitimate authenticated production browser session
  and possible paid entitlement/manual verification are required.
