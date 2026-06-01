# Phase 16B — Kids v1 Runtime Safety Patch Report

## Files Modified

| File | Change |
|------|--------|
| `backend/src/ws/lesson-ws.ts` | 3 safety patches (TTS cap, logsToEmit, reconnect resume) |
| `backend/src/kids-brain/runtime/__tests__/phase-16b-runtime-safety.test.ts` | New — 26 tests verifying all safety fixes |
| `backend/src/kids-brain/analytics/__tests__/session-analytics.test.ts` | Updated regex `{1,6000}` → `{1,12000}` to accommodate longer function body |
| `backend/src/ws/__tests__/kids-brain-v1-real-ws-smoke.test.ts` | Updated test F reconnect assertion to match new resume behavior |

## Fix 1: TTS Chars Cap Enforcement

### Location
`processKidsBrainV1Turn` in `backend/src/ws/lesson-ws.ts`, after the LLM cap check and before `meta.aiCallCount++`.

### Behavior
When `meta.ttsCharCount >= KIDS_MAX_TTS_CHARS` at the start of a turn:
1. Logs `[kids-v1] tts_cap_reached session=… chars=… cap=…`
2. Sends `ai_text` with safe close text: `"Great work today! Time to finish."` — **no TTS call**
3. Finalizes analytics via `persistKidsBrainAnalytics` (guarded by `kidsAnalyticsFinalized`)
4. Updates `kids_sessions` DB row to `status = 'completed'`
5. Deletes Redis session
6. Sends `lesson_end` packet with summary
7. Closes WebSocket with code `1000` (normal) — **not 4400 (error)**
8. Returns — no further LLM or TTS calls made

### Invariants Preserved
- Existing LLM cap still closes with code `4400` and error message (unchanged)
- Existing duration cap still closes with code `4400` (unchanged)
- TTS cap is a **graceful** close; LLM cap is an **error** close
- No infinite loop possible — returns immediately after close

## Fix 2: logsToEmit Emission

### Location
`processKidsBrainV1Turn`, immediately after `processKidsBrainTurn` try/catch, before the safety close check.

### Behavior
Iterates `result.logsToEmit` and emits each `LogEvent` to the server's structured log stream:
- `severity === 'ERROR' || severity === 'CRITICAL'` → `console.error`
- All other severities → `console.log`
- Log label: `[kids-v1-log] session=… event=… turn=…` + `logEvent.payload` as JSON
- **Not forwarded to client** — diagnostics only
- Includes `sessionId` on every log line

## Fix 3: Reconnect Resume Message

### Location
`handleKidsBrainV1LessonStart`, inside the `existingMemory` truthy branch.

### Behavior
When `reconnectSession()` finds an existing Redis session:
1. Sets `meta.kidsSessionId = sessionId` (unchanged)
2. Logs `[kids-v1] session_resumed …` (unchanged)
3. **NEW**: Derives `target = existingMemory.currentTargetItemId`
4. **NEW**: Sends `ai_text` resume message:
   - With target: `"Hi again! Let's keep going. Listen — {target}! Now you!"`
   - Without target: `"Hi again! Let's keep going."`
5. **NEW**: Calls `kidsTtsStream` for audio delivery
6. Returns — cold start path is skipped (unchanged)

### State Preservation
- `currentExerciseId` not reset
- `currentTargetItemId` not reset (read, not overwritten)
- Analytics finalization guard (`kidsAnalyticsFinalized`) not triggered
- Redis session not deleted or overwritten

## Tests Added

**File**: `backend/src/kids-brain/runtime/__tests__/phase-16b-runtime-safety.test.ts`

26 tests across 9 describe blocks:

| Describe | Tests |
|----------|-------|
| TTS cap: guard present | 3 |
| TTS cap: no TTS call on cap exceeded | 2 |
| TTS cap: graceful close with safe ai_text | 3 |
| LLM cap: existing behavior preserved | 3 |
| logsToEmit: structured logs emitted | 4 |
| Reconnect resume: child-facing message sent | 4 |
| Reconnect resume: state preservation | 3 |
| No WebSocket protocol changes | 2 |
| No curriculum changes | 2 |

## Commands Run

```
cd backend
npx tsc --noEmit         → 0 errors
npx vitest run src/kids-brain   → 849/849 passed
npx vitest run src/ws           → 12/12 passed
```

(Combined: 861/861 tests passing)

## Test Results

```
Test Files: 31 passed
Tests:      861 passed
TS errors:  0
```

## Remaining Risks

| Risk | Severity | Notes |
|------|----------|-------|
| No kids UI | High | Phase 16A finding — not in scope for 16B |
| `first_name` unencrypted in Redis | High | Phase 16A finding — not in scope for 16B |
| TTS cap path sends `ai_text` but no TTS audio | Low | Intentional — cap exceeded, audio suppressed |
| Resume TTS may fail if audio context not yet primed on mobile | Low | Same risk as cold-start greeting |
| `logsToEmit` from `startKidsBrainSession` (greeting) still not emitted | Low | Session start result `logsToEmit` not hooked — next phase |

## Next Required Phase

**Phase 16C** — Kids v1 Internal QA Readiness:
- Fix unencrypted `first_name` in Redis (encrypt or remove)
- Wire kids UI (minimal child-facing interface)
- Wire `logsToEmit` from session start result
- Address remaining Phase 16A blockers before beta
