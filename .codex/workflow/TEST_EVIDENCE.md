# Test Evidence Ledger

## Purpose

Keep high-signal evidence separate from long progress narratives.

## Entry Format

```text
Evidence id:
Goal/phase:
Commit:
Changed files:
Command:
Exit code:
Pass/fail counts:
Material output:
Pre-existing failures:
New failures:
Evidence gap:
Next verification:
```

## Rule

Claims such as "works", "fixed", "deployed", or "ready" must link to a test,
review, live QA, production log, or acceptance-audit evidence entry.

---

Evidence id: autonomous-v3-bot-unit-2026-07-10
Goal/phase: Autonomous Product Delivery V3 / Phase 3
Commit: no commit created
Changed files: `tools/telegram-orchestrator/src/orchestrator.mjs`,
`tools/telegram-orchestrator/src/server.mjs`, workflow contracts and skills
Command: `cd tools/telegram-orchestrator; node --test`
Exit code: 0
Pass/fail counts: 4 pass / 0 fail
Material output: redaction, goal packet, agent chain, and formatting tests
passed.
Pre-existing failures: none
New failures: none
Evidence gap: real Telegram Bot API command smoke pending
Next verification: run bot with `TELEGRAM_BOT_TOKEN` supplied from environment

Evidence id: autonomous-v3-bot-health-2026-07-10
Goal/phase: Autonomous Product Delivery V3 / Phase 3
Commit: no commit created
Command: local server smoke with `PORT=4110` and dummy
`INTERNAL_TELEGRAM_API_KEY`, then `GET /health`
Exit code: 0
Material output: HTTP 200 `{"ok":true}`
Evidence gap: no real Telegram polling in this smoke
Next verification: live Telegram command smoke

Evidence id: autonomous-v3-bot-internal-auth-2026-07-10
Goal/phase: Autonomous Product Delivery V3 / Phase 3
Commit: no commit created
Command: local server smoke with `PORT=4111` and dummy
`INTERNAL_TELEGRAM_API_KEY`, then unauthenticated and authenticated
`GET /internal/orchestrator/latest`
Exit code: 0
Material output: unauthenticated HTTP 401; authenticated HTTP 200
`{"ok":true,"goal":null}`
Evidence gap: only dummy secret was used
Next verification: live Telegram command smoke

Evidence id: autonomous-v3-bot-hardening-2026-07-10
Goal/phase: Autonomous Product Delivery V3 / Phase 3
Commit: no commit created
Command: local server smoke with `PORT=4115` and dummy
`INTERNAL_TELEGRAM_API_KEY`, then invalid JSON and disallowed chat event relay
requests to `/internal/orchestrator/events`
Exit code: 0
Material output: invalid JSON HTTP 400; disallowed `telegramChatId` HTTP 403
Evidence gap: no real Telegram polling in this smoke
Next verification: live Telegram command smoke with allowlisted chat id

Evidence id: autonomous-v3-secret-scan-2026-07-10
Goal/phase: Autonomous Product Delivery V3 / Phase 3
Commit: no commit created
Command: `rg "8970573556|AAFvbPMh|TELEGRAM_BOT_TOKEN=.*[A-Za-z0-9_:-]{10,}" . -g "!node_modules" -g "!.git"`
Exit code: 1
Material output: no matches
Evidence gap: chat history still contained the token; rotate it after smoke
Next verification: BotFather token rotation
# Test Evidence - Paid Teacher Multilingual Voice and Conversational Tutor Behavior

## 2026-07-10

**Targeted backend tests:**
`cd backend; npx vitest run src/voice/__tests__/voice-turn-stabilizer.test.ts src/voice/__tests__/stt-deepgram-options.test.ts src/voice/__tests__/kids-stt-config-parity.test.ts src/lesson/__tests__/paid-vocab-flow.test.ts src/exercises/runtime-qa/pedagogical-behavior.qa.test.ts --reporter=dot --silent`
with `npm_config_cache=D:\codex-npm-cache`, `TEMP=D:\codex-temp`,
`TMP=D:\codex-temp` -> exit 0; 5 files passed; 200 tests passed.

**TypeScript:**
`cd backend; npx tsc --noEmit` with redirected npm/temp -> exit 0.

**Full backend suite:**
`cd backend; npm test -- --reporter=dot --silent` with redirected npm/temp ->
exit 0; 67 files passed; 2167 tests passed.

**Remaining evidence gap:**
Running-product adult paid microphone smoke for English, Russian, Ukrainian,
self-correction, repeated expected answer, TTS, and backend logs.

---
