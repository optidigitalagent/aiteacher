# Phase 15B — Real WS Server Smoke Test Report

**Date:** 2026-06-01  
**Status:** COMPLETE  
**Tests:** 12 new / 835 total passing / 0 TypeScript errors

---

## Files Modified / Created

| File | Action |
|------|--------|
| `backend/src/ws/__tests__/kids-brain-v1-real-ws-smoke.test.ts` | **Created** — 12 new real WS smoke tests |

No existing files were modified. No frontend, curriculum, or WebSocket protocol changes.

---

## Real WS Method Used

**`attachLessonWS(server: Server)`** — production export from `lesson-ws.ts`.

A real `http.Server` is created in-process, `attachLessonWS` is attached, and a real `ws.WebSocket` client connects to it. All frames are sent and received over a live TCP socket. No helper re-implementation; the actual `lesson-ws.ts` message router handles every frame.

```
WS client (ws.WebSocket)
  → TCP socket
  → lesson-ws.ts (attachLessonWS / WebSocketServer)
  → handleFocusLessonStart → handleKidsBrainV1LessonStart
  → startKidsBrainSession / processKidsBrainTurn / endKidsBrainSession
  → RedisSessionStoreImpl (in-memory mock Redis)
  → adaptRuntimePackets → processKidsV1Packets
  → send(ws, { type: 'ai_text', ... })  ← received by test WS client
```

**Test seam added:** `vi.hoisted(() => { process.env['USE_KIDS_BRAIN_V1'] = 'true' })` runs before any module evaluates the module-level const `USE_KIDS_BRAIN_V1`. No production code modified.

---

## Frames Sent

| Step | Frame | Payload |
|------|-------|---------|
| A | *(connect)* | `?token=tok-15b&sessionId=sess-15b-smoke` |
| B | `focus_lesson_start` | `{ unit: 1 }` |
| C | `text_message` | `"I'm ready."` |
| D | `text_message` | `"blue"` |
| E | `text_message` | `"blue"` |
| F | *(new WS connect + focus_lesson_start)* | same token + sessionId |
| G | `text_message` | `"green"` |

---

## Frames Received / Verified

| Step | Expected frame | Assertion | Result |
|------|---------------|-----------|--------|
| A | `lesson_ready` | `sessionId = 'sess-15b-smoke'` | **PASS** |
| B | `lesson_ready` + `ai_text` | greeting received, no animal words, no placeholders | **PASS** |
| C | `ai_text` | text contains "blue" (EX-02 prompt) | **PASS** |
| D | `ai_text` | non-empty positive response, no animal words | **PASS** |
| E | `ai_text` | text contains "green" (EX-02→EX-03 advance) | **PASS** |
| F | `lesson_ready` only | zero `ai_text` frames — no fresh greeting | **PASS** |
| G | `ai_text` | non-empty, no animal words, does not accuse green as blue | **PASS** |

---

## Frame Flow Trace (from test stdout)

```
[ws] LessonWS attached at ws://localhost/lesson

A — connect
[ws] client connected (user=u-15b-001 session=sess-15b-smoke reattach=false)

B — focus_lesson_start
[paid-lesson] begin clicked session=sess-15b-smoke unit=1 section=none
[kids-v1] session_persisted session=sess-15b-smoke
[kids-v1] session_started user=u-15b-001 session=sess-15b-smoke
→ lesson_ready emitted (line 1215)
→ ai_text (greeting) emitted

C — "I'm ready."
[transcript] recorded speaker=student lessonId=sess-15b-smoke
→ ai_text "Listen — blue! Now you!" (EX-02 prompt)

D — "blue" (1st correct)
[transcript] recorded speaker=student lessonId=sess-15b-smoke
→ ai_text positive feedback (EX-02, 1/2 correct)

E — "blue" (2nd correct)
[transcript] recorded speaker=student lessonId=sess-15b-smoke
→ ai_text "Listen — green! Now you!" (EX-02 complete, EX-03 started)

— WS1 closed (code 1000) —
[ws] client disconnected code=1000 session=sess-15b-smoke

F — reconnect (WS2 connect + focus_lesson_start)
[ws] client connected (user=u-15b-001 session=sess-15b-smoke reattach=false)
[kids-v1] session_resumed session=sess-15b-smoke item=green activity=listen_and_point
→ lesson_ready emitted (line 1215)
→ NO ai_text (reconnectSession() returned existing session, cold-start skipped)

G — "green"
[transcript] recorded speaker=student lessonId=sess-15b-smoke
→ ai_text (teacher targets green, correct answer acknowledged)

— WS2 closed (code 1000) —
```

---

## Reconnect Result

**PASS** — Phase 11K reconnect guard verified at real WS server level:

- WS1 closes with code 1000 after steps A–E; session is persisted in mock Redis under `kids:session:sess-15b-smoke`.
- WS2 connects with identical `token` + `sessionId`; `reconnectSession()` finds the stored session.
- `handleKidsBrainV1LessonStart` returns early after `reconnectSession()` returns non-null — no cold-start greeting.
- Log confirms: `[kids-v1] session_resumed session=sess-15b-smoke item=green activity=listen_and_point`
- Zero `ai_text` frames received by WS2 before sending the first `text_message`.

---

## Analytics Verification

| Assertion | Result |
|-----------|--------|
| `persistKidsBrainAnalytics` not called during turns A–G | **PASS** |
| Redis session key `kids:session:sess-15b-smoke` exists after flow | **PASS** |
| Session JSON parseable; `sessionId` and `userId` correct | **PASS** |
| No animal vocabulary in session state JSON | **PASS** |

**Limitation — natural session close:** Full analytics finalization (via `shouldCloseSession = true`) requires completing all 10 exercises (EX-01 through EX-10). The smoke test covers turns A–G (partial session, at EX-03). `persistKidsBrainAnalytics` is therefore not invoked in this test run.

Analytics persistence is verified at helper level in Phase 15A (38 tests: `saveSessionSummary × 1`, `saveMasteryRecord × N`, `kidsAnalyticsFinalized` guard — all confirmed, 823 passing).

---

## Test Seams Added

| Seam | Location | Production impact |
|------|----------|-------------------|
| `vi.hoisted(() => { process.env['USE_KIDS_BRAIN_V1'] = 'true' })` | Test file only | None — `vi.hoisted` is a Vitest test primitive; it does not touch production modules |

No exports added to `lesson-ws.ts`. No production code modified.

---

## Mocked Dependencies

| Module | Mock type | Why |
|--------|-----------|-----|
| `db/redis.js` | In-memory Map | Avoids real ioredis connection at module load |
| `db/postgres.js` | SQL-pattern router | Avoids real PG pool; routes `kids_sessions` check correctly |
| `auth/jwt.js` | `verifyToken` returns test payload | Avoids JWT_SECRET requirement |
| `voice/tts.js` | `speakToClient` no-op | Avoids OpenAI TTS API calls |
| `voice/stt.js` | `DeepgramSTT` no-op class | Avoids Deepgram WebSocket connection |
| `billing/subscription-service.js` | No-op stubs | Avoids billing DB queries |
| `observability/index.js` | No-op stubs | Avoids `@langfuse/tracing` global OTel registration |
| `observability/langfuse-client.js` | No-op + `hashUserId` | Avoids `@langfuse/otel` / `@opentelemetry/sdk-node` init |
| `kids-brain/analytics/session-analytics.js` | `persistKidsBrainAnalytics` spy | Tracks analytics calls without real DB |

**Not mocked (run normally with mocked deps):**
- `kids-brain/runtime/index.js` — pure deterministic logic, no LLM calls (Phase 7)
- `kids-brain/adapters/index.js` — pure adapters
- `kids-brain/infrastructure/index.js` — `RedisSessionStoreImpl` uses mocked Redis ✓
- `kids-brain/curriculum/index.js` — static curriculum data
- `runtime/index.js` — pure (only Node built-ins: `node:crypto`)
- `lesson/transcript-recorder.js` — uses mocked `query`; `recordStudentMessage` is called and resolves silently

---

## Limitations

1. **No natural session close via WS** — completing all 10 exercises would require 20+ correct answers across 10 exercises. `persistKidsBrainAnalytics` is therefore not triggered in this test; it is covered at helper level in Phase 15A.

2. **No real Redis** — uses in-memory Map mock. Lua CAS guard is simulated; real Redis cluster behavior (MULTI/EXEC, expiry precision) is not tested.

3. **No real Postgres** — `query` mock matches SQL patterns; actual DB schema constraints are not exercised.

4. **No TTS audio path** — `speakToClient` is a no-op mock. Audio chunk frames and `teacher_turn_end` are not verified.

5. **No STT audio path** — voice frames (`mic_start`, `audio_chunk`, `mic_stop`) are not tested; only `text_message` frames are exercised.

6. **No max-duration timer** — `KIDS_MAX_DURATION_MS` (20 min) timer fires are not tested; they would require fast-forward time mocks.

---

## Commands Run

```bash
cd backend
npx tsc --noEmit
# → 0 errors

npx vitest run src/ws/__tests__/kids-brain-v1-real-ws-smoke.test.ts
# → 12/12 passing

npx vitest run src/kids-brain
# → 823/823 passing
```

---

## Test Results

```
Test Files: 1 passed (1)
     Tests: 12 passed (12)
  Duration: 3.49s
```

```
Test Files: 29 passed (29)      (kids-brain suite, no regressions)
     Tests: 823 passed (823)
  Duration: 6.68s
```

New Phase 15B test suite breakdown (12 tests):

| Suite | Tests |
|-------|-------|
| Frame Flow A–E (real WS server) | 5 |
| Reconnect F–G (real WS server) | 2 |
| Analytics Guard & Protocol Integrity | 5 |

Running total: **835 tests passing** (823 kids-brain + 12 ws smoke).

---

## Next Required Phase

**Phase 16 — Kids Brain v1 Production Readiness: Hardening & Launch Checklist**

Scope:
- Full E2E analytics path (all 10 exercises via WS, verify `persistKidsBrainAnalytics` call)
- Real Redis integration test (replace Map mock with ioredis + test Redis)
- `KIDS_MAX_DURATION_MS` timer fire test (fast-forward with fake timers)
- TTS audio frame verification (`speakToClient` integration or real TTS call)
- Kids Brain v1 production flag audit (env vars, Railway config, logging)
- WebSocket stability under reconnect race conditions
- Parent review dashboard integration (mastery records surfaced to frontend)
