# PHASE 8 COMPLETE

## 1. Summary

Phase 8 was a production stabilization pass — no new features, no architecture changes. Six targeted fixes were applied to close silent failure modes that would cause billing loss, runtime hangs, and confusing state after deploy or natural lesson end. Before Phase 8, Railway SIGTERM killed active WebSocket sessions with no billing finalization, STT transcript callbacks silently swallowed errors, the 50-minute timeout could fire against an already-ended lesson, resume sessions carried a hardcoded wrong exercise type, and the frontend continued updating the lesson timer display after the lesson had ended. After Phase 8, all six failure modes are closed and both TypeScript builds pass with 0 errors.

## 2. Goals Completed

Completed:
- STT void→catch: all three `void processInput(...)` calls converted to `.catch()` with named log messages
- SIGTERM graceful shutdown: `closeAllActiveClients()` export added; SIGTERM handler with 5-second finalization wait added to `index.ts`
- Timeout guard: all three `maxDurationRef` timeout callbacks now check `if (!meta.lessonId) return` before firing
- Resume cursor type: hardcoded `'form_transformation'` changed to `'unknown'` with a comment explaining the AI corrects it next turn
- Structured lifecycle logs: `lesson_start_new` and `lesson_end_natural` log lines added with lessonId, sessionId, unit, duration, exerciseScore
- Frontend stale timer guard: `lesson_timer_update` handler in ClassroomLayout now checks `!paidLessonEnded` before updating state
- IIFE refactor: section-step render IIFE in LearningPage.tsx extracted to named `renderSectionStep()` function inside component body

NOT completed (moved to next phase or future):
- No goals were descoped; all seven targeted items from the Phase 8 spec are done

## 3. Changed Files

Backend:
- `backend/src/ws/lesson-ws.ts` — 6 fixes: STT void→catch (×3), timeout guard (×3), resume cursor type, lifecycle log lines, `closeAllActiveClients` export
- `backend/src/index.ts` — added `closeAllActiveClients` import and SIGTERM handler with 5-second graceful shutdown

Frontend:
- `frontend/src/features/classroom/components/ClassroomLayout.tsx` — `lesson_timer_update` case now guards `!paidLessonEnded`
- `frontend/src/pages/LearningPage.tsx` — IIFE at former line 856 extracted to named `renderSectionStep()` function

Database:
- No database changes.

Docs:
- `docs/phase/PHASE_8_HANDOFF.md` — this document (new)

## 4. Backend Changes

**STT error propagation (`lesson-ws.ts`)**
Three locations previously used `void processInput(ws, meta, transcript)` inside STT transcript callbacks: the `handleLessonStart` STT path, the `handleFocusLessonStart` STT path, and the `resumeLesson` STT path. Using `void` discards promise rejections silently — `index.ts` has an `unhandledRejection` handler but it only fires for truly unhandled rejections, and in practice the rejection may be swallowed depending on Node.js event loop timing. All three are now:
```typescript
processInput(ws, meta, transcript).catch((err: unknown) =>
  console.error('[paid-lesson] processInput error (stt):', err),
)
```

**SIGTERM graceful shutdown (`lesson-ws.ts` + `index.ts`)**
Railway sends SIGTERM before every deploy. Without a handler, the Node process exits immediately, leaving active WebSocket sessions with no `ws.close` firing — the `close` handler (which calls `finalizeBilling`, saves lesson snapshots, clears Redis) never runs, causing billing row corruption. Fix:
- `lesson-ws.ts` exports `closeAllActiveClients()` which iterates the internal `clients` Map and calls `ws.terminate()` on each. `terminate()` triggers the `close` event synchronously, allowing billing finalization to run.
- `index.ts` listens for `SIGTERM`, calls `closeAllActiveClients()`, logs the count, then waits 5 000 ms before `process.exit(0)`. The 5-second window lets the async finalization callbacks (PostgreSQL write, Redis delete) complete before the process exits.

**Timeout guard (`lesson-ws.ts`)**
All three `maxDurationRef = setTimeout(...)` callbacks now begin with:
```typescript
if (!meta.lessonId) return
```
`meta.lessonId` is set to `null` when a lesson ends naturally (in the `close` handler and in the `lesson_end` branch of `processInput`). If the 50-minute timeout fires after a natural end, the guard silently returns instead of sending `SESSION_TIME_LIMIT` to a dead/reused session.

**Resume cursor type (`lesson-ws.ts`)**
On resume, the exercise cursor `exerciseType` field was previously hardcoded to `'form_transformation'`. This is wrong for vocabulary, reading, and all non-grammar sections. Changed to `'unknown'` with a comment: the AI reads the current LessonState from Redis on the next turn and issues the correct exercise type in its JSON response, which the orchestrator applies to the cursor. No other resume logic was changed.

**Lifecycle log lines (`lesson-ws.ts`)**
Two log events added for production observability:
- `lesson_start_new` — emitted in both `handleLessonStart` and `handleFocusLessonStart` immediately after the lessonId is set, with unit and section fields
- `lesson_end_natural` — emitted in `processInput` when `result.phase === 'END'`, with durationMin and exerciseScore

These are plain `console.log` lines; Railway's log aggregation picks them up for filtering.

## 5. Frontend Changes

**Stale timer guard (`ClassroomLayout.tsx`)**
The `lesson_timer_update` WebSocket event is sent by the backend every 60 seconds with `remainingMs`. Previously, the handler updated `lessonRemainingMin` state unconditionally. If the lesson ended (setting `paidLessonEnded = true`) and a timer update arrived afterward, it would overwrite the final "0 minutes" display with stale data. The handler now checks `!isDemoMode && !paidLessonEnded` before calling `setLessonRemainingMin`, matching the existing guard pattern already in place for other post-lesson events.

**IIFE refactor (`LearningPage.tsx`)**
The "Choose a section" step (Step 2 of the setup wizard) was rendered by an inline immediately-invoked function expression inside JSX. IIFEs in JSX are hard to read, hard to test, and cause linter warnings. The IIFE was extracted to a named function `renderSectionStep()` defined inside the component body (before the `return` statement), capturing `selectedBook`, `continuationStatus`, `selectedSection`, and `selectSection` via closure. The JSX call site is now a single readable line:
```tsx
{stepKey === 'section' && selectedBook && renderSectionStep()}
```
Behavior is identical — no visual or functional change.

## 6. Database Changes

No database changes. Next migration remains `013`.

## 7. Runtime Behavior Changes

Before:
- Railway deploy → SIGTERM → process exits immediately → active lessons lose billing rows, no snapshot saved, Redis key stays dirty
- STT errors in processInput silently swallowed → lesson hangs, no log
- If lesson ends naturally within 50 minutes, the timeout still fires and sends SESSION_TIME_LIMIT to the client → confusing UI flash
- Resume always starts with `exerciseType: 'form_transformation'` regardless of actual section type → AI may mismatch exercise format on first resumed turn
- After lesson ends in the browser, backend timer updates could flicker the "0 min remaining" display back to a stale value

After:
- Railway deploy → SIGTERM → all WS clients terminated → close handlers run → billing finalized → 5s wait → clean exit
- STT processInput errors are logged with `[paid-lesson] processInput error (stt):` prefix
- Timeout that fires after natural lesson end is a no-op (guarded by `!meta.lessonId`)
- Resume starts with `exerciseType: 'unknown'` — AI corrects it on first turn via its JSON response
- `lesson_timer_update` is ignored after `paidLessonEnded = true` in the browser

## 8. WebSocket/Event Changes

No websocket event changes. All event types and payloads in `message-types.ts` are unchanged.

## 9. AI/Prompt Changes

No AI/prompt changes. The system prompt in `prompt-builder.ts`, the orchestrator logic, and all phase FSM transitions are unchanged.

## 10. Cost Impact

No meaningful cost impact. All changes are error-handling and guard logic; no new AI calls, STT connections, or TTS streams are added. The structured log lines emit to stdout only.

## 11. Tests Performed

Tested:
- `npx tsc --noEmit` in `backend/` — exit 0, 0 errors
- `npx tsc --noEmit` in `frontend/` — exit 0, 0 errors
- Manual code review of all three STT callback sites in `lesson-ws.ts` confirming `.catch()` is present
- Manual code review of all three `maxDurationRef` callback bodies confirming the `!meta.lessonId` guard is present
- Verified `renderSectionStep()` function captures correct variables and the old IIFE call site is removed
- Verified `paidLessonEnded` guard in `ClassroomLayout.tsx` `lesson_timer_update` case

Note: No end-to-end lesson flow was tested in this session (no running backend/frontend). All changes are targeted fixes to existing logic paths; no new control flow was introduced.

## 12. Known Remaining Issues

Remaining issues:
- **Resume exerciseType `'unknown'`** — the AI corrects this on the first resumed turn via JSON response, but if the AI fails to parse its own response (rare), the cursor type stays `'unknown'` for the session. No user-visible impact beyond potential logging noise. Low severity. Could be addressed in Phase 9 by storing `exerciseType` in `LessonState`.
- **5-second SIGTERM window** — if a lesson's billing finalization PostgreSQL write takes longer than 5 seconds (e.g., cold DB connection on Railway), the row may be incomplete. The 5-second value was chosen to be safe for warm connections. Low probability. Can be increased if Railway logs show cut-off writes.
- **No automated test coverage for Phase 8 fixes** — the fixes are straightforward but untested by any test suite. A future testing pass (per `docs/RUNTIME_TEST_MATRIX.md`) should add integration tests for the SIGTERM flow and timeout guard.

## 13. What Was Intentionally NOT Changed

Intentionally NOT changed:
- **WebSocket FSM (`lesson-ws.ts`)** — all phase transitions, the `aiProcessing` guard, the `ttsActive` gate, and the `MULTI/EXEC` Redis state update are preserved exactly
- **Billing logic (`billing-routes.ts`, `billing/` module)** — LiqPay flow, subscription gate, and minute accounting untouched
- **AI orchestrator (`orchestrator.ts`, `prompt-builder.ts`)** — no prompt changes, no call-frequency changes
- **STT/TTS pipeline (`stt.ts`, `tts.ts`)** — Deepgram and ElevenLabs integration untouched
- **Auth system** — JWT, Google OAuth, and session handling untouched
- **Demo system** — demo routes and demo WS flow untouched
- **Database schema** — no migrations; migrations table is at 012
- **WebSocket event contract** — all types in `message-types.ts` untouched

## 14. Risks Introduced

New risks:
- **`ws.terminate()` vs `ws.close()` in SIGTERM handler** — `terminate()` is used (not `close()`) because `close()` requires a handshake with the client and may not complete before Railway kills the process. `terminate()` fires the `close` event immediately without a network round-trip. This is the correct choice for shutdown, but it means clients receive a hard disconnect rather than a clean WebSocket close frame. The client already handles unclean disconnects via its reconnect logic and `lesson_timer_update` polling, so no data loss is expected. Low risk.
- **IIFE → named function in JSX** — `renderSectionStep()` is defined inside the component body, so it is recreated on every render. This is equivalent to the IIFE pattern (which also ran on every render). No performance regression. If `LearningPage` ever becomes performance-critical, this function should be wrapped in `useCallback` or moved outside the component. Negligible risk in current usage.

## 15. Deployment Notes

No new environment variables required. No new migrations to run. No service restarts needed beyond the normal Railway deploy cycle.

The SIGTERM handler will activate automatically on the next Railway deploy (Railway sends SIGTERM before stopping the old process). No configuration change needed.

## 16. Recommended Next Phase

Recommended next phase:
Phase 9 — Production Monitoring & Observability

After Phase 8 closes all known silent failure modes, the natural next step is to add structured logging or a lightweight error-tracking integration (e.g., Sentry) so that the newly-exposed error paths (STT `.catch()`, SIGTERM close count) are surfaced in a dashboard rather than buried in Railway's raw log stream. Additionally, storing `exerciseType` in `LessonState` (eliminating the `'unknown'` resume issue) and writing integration tests for the SIGTERM flow and timeout guard are high-value low-risk items.

## 17. Next Claude Session Instructions

Next Claude session should:
- Read `docs/PAID_LESSON_RUNTIME_ROADMAP.md` first
- Read `docs/phase/PHASE_8_HANDOFF.md` (this document)
- Read `docs/RUNTIME_GUARDRAILS.md`
- Read `docs/WEBSOCKET_EVENT_CONTRACT.md`
- Inspect `backend/src/ws/lesson-ws.ts` before touching any lesson flow — it is the most critical file and is 1 200+ lines
- Inspect `backend/src/lesson/types.ts` to understand `LessonState` before modifying state
- Preserve the `aiProcessing` guard and `ttsActive` gate in `lesson-ws.ts` — these prevent STT echo loops and concurrent AI calls
- Continue from Phase 9 ONLY

DO NOT:
- Remove or bypass the `aiProcessing` guard in `lesson-ws.ts`
- Change the `MAX_LESSON_MS` constant or the billing minute accounting without a full audit of the billing flow
- Add new STT or TTS code without reading `voice/stt.ts` and `voice/tts.ts` in full first
- Touch the demo system (`demo-routes.ts`, demo WS handling) — it is a separate flow and regressions are invisible without a live browser test
- Create a Phase 10 or beyond without completing Phase 9's observability work
