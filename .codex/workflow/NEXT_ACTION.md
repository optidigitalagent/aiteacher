# NEXT_ACTION.md

> This file always contains EXACTLY ONE next task.
> Goal Executor reads this before picking what to do.
> Update immediately when the task is picked up or completed.

---

## CURRENT NEXT ACTION

**Task:** Commit, push, deploy RU/UA selector and mixed-answer repair, then run post-deploy checks
**Type:** DEPLOY
**Phase:** Phase 2 - deployment and running-product voice evidence
**Agent:** deploy-railway + live-qa-orchestrator + qa-tester + acceptance-auditor

**Why this is next:**
  The previous commit `34cfefe` was deployed, but the user reported remaining
  production issues: Ukrainian voice transcription still fails, mixed short
  answers with one correct phrase can still be rejected, and automation/live QA
  gaps remain. Follow-up local implementation and tests now pass; the next
  executable step is targeted commit/push/deploy and post-deploy verification.

**Completed evidence:**
  - Adult paid STT default remains `model=nova-3` and `language=multi`.
  - Kids STT explicitly remains `model=nova-2` and `language=en`.
  - Paid classroom has a minimal RU/UA selector for adult voice turns.
  - `mic_start.language` is server-validated as `multi`, `ru`, or `uk`.
  - Adult Deepgram live options can be rebuilt with explicit `language=ru` or
    `language=uk` for the next mic turn.
  - Expected-answer cleanup accepts `Like keen on` -> `keen on`,
    `keen on keen on` -> `keen on`, and short mixed answer lists such as
    `hobby spare time` / `keen on like`.
  - Cleanup still rejects `not keen on`, `not keen on like`, `my hobby`, and
    `my hobby spare time`.
  - Targeted tests:
    `npx vitest run src/voice/__tests__/voice-turn-stabilizer.test.ts src/voice/__tests__/stt-deepgram-options.test.ts src/voice/__tests__/kids-stt-config-parity.test.ts src/ws/__tests__/message-types.test.ts --reporter=dot --silent`
    -> exit 0; 4 files passed; 45 tests passed.
  - Backend TypeScript: `npx tsc --noEmit` -> exit 0.
  - Frontend build: `npm run build` -> exit 0.
  - Full backend suite: `npm test -- --reporter=dot --silent` -> exit 0;
    68 files passed; 2172 tests passed.
  - Telegram orchestrator tests: `node --test` -> exit 0; 4 tests passed.

**Exact next step:**
  Commit only the scoped product/workflow changes, push `main`, wait for
  Railway backend/frontend deployments, verify `/health`, startup logs, and
  critical error/HTTP 4xx/5xx log sweeps. Then in the running adult paid lesson,
  verify:
  1. English answer voice turn is transcribed as English and graded normally.
  2. RU selector sends `language=ru`; Russian clarification is recognized as
     Russian/RU clarification, not as an English answer.
  3. UA selector sends `language=uk`; Ukrainian clarification is recognized as
     Ukrainian/UA clarification, not as an English answer.
  4. `Like keen on` in one mic turn is accepted as `keen on` and teacher
     acknowledges the self-correction naturally.
  5. `keen on keen on` is accepted as repeated current expected answer.
  6. `hobby spare time` / `keen on like` style short mixed answer lists are
     accepted only when the current expected answer is present.
  7. Teacher may ask bounded topic-aware follow-ups in speaking/warmup, but
     deterministic gap-fill cursor/progression remains backend-owned.

**Current stop condition:**
  Deployment and running-product voice smoke are required. Do not mark the goal
  complete until the new deploy and live paid microphone scenarios above pass.
