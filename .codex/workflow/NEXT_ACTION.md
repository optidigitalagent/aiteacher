# NEXT_ACTION.md

> This file always contains EXACTLY ONE next task.
> Goal Executor reads this before picking what to do.
> Update immediately when the task is picked up or completed.

---

## CURRENT NEXT ACTION

**Task:** Deploy and production-smoke paid lesson runtime TTS/cursor repair after explicit approval
**Type:** DEPLOY-PROD-VERIFY
**Phase:** Phase 3 - Deploy and production owner smoke
**Agent:** goal-executor + qa-tester

**Why this is next:**
  The owner paid-access bypass is already deployed, but the manual paid lesson
  smoke found ordinary paid lesson runtime defects: greeting TTS truncation and
  teacher wording that contradicted the backend cursor after `keen on`. The
  local repair is implemented and fully tested. A new Railway production deploy
  requires explicit approval before Codex can mutate production again.

**Completed evidence:**
  - `backend/src/voice/tts.ts` buffers ElevenLabs network chunks into one
    complete MP3 `audio_chunk`, matching the existing OpenAI behavior and
    preserving the frontend decode contract.
  - `backend/src/lesson/master-orchestrator.ts` returns
    `deterministicTeacherText` for deterministic engine correct/reveal turns.
  - `backend/src/ws/lesson-ws.ts` sends deterministic paid exercise teacher
    text directly, after cursor/feedback and without a Teacher Brain call.
  - `backend/src/lesson/__tests__/paid-vocab-flow.test.ts` reproduces the
    `hobby -> spare time -> Like/Enjoy/Enjoy/Keen on` section `1.1` path and
    verifies the next item is `I joined a gym to ___.`.
  - `backend/src/voice/__tests__/tts-fallback.test.ts` verifies two
    ElevenLabs network chunks become one `audio_chunk`.
  - `cd backend; npx vitest run src/lesson/__tests__/paid-vocab-flow.test.ts --reporter=dot --silent`
    -> exit 0; 1 file passed; 1 test passed.
  - `cd backend; npx vitest run src/voice/__tests__/tts-fallback.test.ts --reporter=dot --silent`
    -> exit 0; 1 file passed; 18 tests passed.
  - `cd backend; npx tsc --noEmit` -> exit 0.
  - `cd backend; npm test -- --reporter=dot --silent`
    -> exit 0; 66 files passed; 2133 tests passed.
  - Review gate: backend reviewer PASS WITH WARNING; curriculum reviewer PASS;
    QA tester PASS; frontend/kids safety/acceptance auditor not applicable.

**Exact next step after approval:**
  1. Run `git status --short --untracked-files=all` and `git diff --check`.
  2. Commit only the paid lesson runtime repair files plus workflow checkpoint.
  3. Push `main`.
  4. Wait for Railway backend/frontend deployment success.
  5. Production-smoke `artenon92@gmail.com` paid lesson section `1.1`:
     greeting TTS must include `Tell me when you're ready.`, and Exercise 1
     item progression must not contradict `keen on` / next item cursor state.

**Current stop condition:**
  Explicit approval is required before the new production deploy/mutation.
