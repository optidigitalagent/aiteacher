# NEXT_ACTION.md

> This file always contains EXACTLY ONE next task.
> Goal Executor reads this before picking what to do.
> Update immediately when the task is picked up or completed.

---

## CURRENT NEXT ACTION

**Task:** Production smoke ordinary Mentium flow
**Type:** QA / PROD-VERIFY
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

**Execute exactly this:**
  1. Inspect whether a legitimate authenticated browser/session is available
     without using JWTs pasted in chat.
  2. If available, smoke `https://aware-alignment-production.up.railway.app/demo/setup`:
     start or resume demo, open `/demo/classroom/:demoSessionId`, verify no
     white screen and core lesson interaction.
  3. If demo is blocked by `DEMO_USED` or unavailable auth, record that exact
     blocker and continue to paid ordinary flow if valid subscription/auth is
     available.
  4. For paid flow, choose a GOLD ready section such as `1.1`, start a lesson
     through the UI or legitimate authenticated API, open `/classroom/:sessionId`,
     and verify `lesson_ready`, `ai_text`, `audio_chunk` or documented voice
     fallback, and `teacher_turn_end`.
  5. Inspect production logs for critical ordinary-flow errors in the checked
     window.

**Success criterion:**
  Ordinary demo and/or paid lesson flow is production-smoked with direct
  evidence, or the exact missing credential/quota/subscription blocker is
  recorded.

**Current stop condition if blocked:**
  AGENTS stop rule 1 or 4 - unavailable legitimate auth/subscription or manual
  production verification required.
