# NEXT_ACTION.md

> This file always contains EXACTLY ONE next task.
> Goal Executor reads this before picking what to do.
> Update immediately when the task is picked up or completed.

---

## CURRENT NEXT ACTION

**Task:** Run a production Kids voice session to capture T2–T4 and V1–V4 log evidence
**Type:** USER ACTION (requires real mic + browser + authenticated Kids session)
**Agent:** user / production-log-analyzer
**Description:**
  Acceptance auditor Run 3 (2026-06-08) found that 9 criteria remain PARTIAL.
  All remaining gaps require a live production voice session with a real student.

  21 of 30 criteria are now COMPLETE. The code is correct, deployed, and tested.
  The only remaining evidence gaps are observability items that cannot be
  captured without a real voice session.

  **What needs to happen:**

  1. Open https://aware-alignment-production.up.railway.app/kids (or the Kids URL)
  2. Sign in with a real user account
  3. Start a Kids voice session (at least 3 exercise turns)
  4. After the session, run:
     ```
     railway logs --service aiteacher 2>&1 | grep -E "kids|stt|tts|latency|silence|teacher" | head -50
     ```
  5. Save the log output and paste it for the goal-executor to evaluate.

  **Evidence needed to close remaining PARTIAL criteria:**
  - T2: "Socratic method" — look for teacher not giving answer first in turn log
  - T3: "Ends with question" — look for teacher_text field ending in ? or instruction
  - T4: "Child-friendly" — look for turn teacher_text word count ≤ 12–18 words
  - V1: "STT latency < 2.5s" — look for [kids-v1] latency_ms line showing < 2500
  - V2: "No Deepgram HTTP 400" — confirm no [stt:error] during session
  - V3: "TTS streams" — look for [tts:stream] or streaming chunk log
  - V4: "Silence detection" — look for [stt:utteranceEnd] or silence_detected line

  **Optional (if available) — closes BA3:**
  - If you have a test JWT token, provide PLAYWRIGHT_TEST_TOKEN and the D-group
    tests can be run to verify session ownership end-to-end.

  **Optional fix — closes BA4:**
  - Update backend/src/kids-brain/store/redis-session.store.ts:49
    from `EX', 1800` to `'EX', 14400` if Kids sessions can exceed 30 min.

**Inputs:**
  - Production Kids session logs from Railway
  - User provides log output to goal-executor

**Success criterion:**
  Railway log contains at least one Kids session turn with:
  - Teacher response visible (teacher_text or similar)
  - No [stt:error] HTTP 400
  - Latency evidence or no latency spike in timing

**Blocker:**
  Requires user to run a real voice session with a microphone.
  Goal Executor cannot initiate a voice session programmatically.

**FOLLOW-ON after this task:**
  - goal-executor evaluates logs against T2-T4, V1-V4 criteria
  - If all pass → re-run acceptance-auditor → may achieve GOAL COMPLETE
  - If BA4 (30-min TTL) needs fixing → implementer updates redis-session.store.ts

---

## INSTRUCTIONS FOR GOAL EXECUTOR

After completing any task:
1. Check all acceptance criteria in GLOBAL_GOAL.md
2. If criteria remain unsatisfied → write the next concrete task here
3. If all criteria satisfied → write "GOAL COMPLETE" and notify user
4. If blocked after 3 attempts → write "BLOCKED: <reason>" and notify user

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
