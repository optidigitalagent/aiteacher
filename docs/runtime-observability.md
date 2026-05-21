# Runtime Observability — AI Teacher

## Overview

The runtime observability layer is a two-tier system:

| Layer | Purpose | Dependency |
|---|---|---|
| **Langfuse tracing** (`src/observability/`) | Distributed trace of lesson turns (STT, validation, teacher generation) | Requires Langfuse credentials |
| **Runtime trace recorder** (`src/runtime/`) | Lightweight structured log of WS/session lifecycle boundary events | No external dependency — uses stderr |

This document covers **both** tiers and explains how to correlate them.

---

## 1. Enabling Traces

### Langfuse (existing)

Set in `backend/.env`:
```
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_SECRET_KEY=sk-lf-...
LANGFUSE_HOST=https://cloud.langfuse.com   # optional — defaults to cloud
```

If keys are absent, Langfuse silently no-ops. Lesson runtime is unaffected.

### Runtime Trace Recorder (new)

Set in `backend/.env`:
```
ENABLE_RUNTIME_TRACE=1
```

When enabled, writes one JSON line to `stderr` per runtime boundary event:
```json
{"RUNTIME_TRACE":{"traceId":"...","sessionId":"ses_abc","userIdHash":"a3f7b2c1...","eventType":"lesson_ready_emitted","payloadSummary":"session=ses_abc","timestamp":"2026-05-21T14:23:01.123Z","severity":"info"}}
```

**Default is 0 (off).**  
Safe in staging/QA. In production: only enable if log volume is budgeted (~8–20 events per lesson, depending on length).

---

## 2. Runtime Event Lifecycle Map

```
TCP connect
    │
    ▼
ws_attach_succeeded ────────────────────── [trace-recorder]
    │
    ├─ reattach=true (grace window) ──────► lesson_resync_emitted
    │
    ├─ late_recover (post-grace) ─────────► lesson_resync_emitted
    │
    └─ fresh session ─────────────────────► lesson_ready_emitted
                                                │
                                    focus_lesson_start / lesson_start
                                                │
                                    startLessonTrace ────────────── [Langfuse]
                                                │
                                    exercise_cursor_updated_emitted (init)
                                                │
                              ┌─────────────────┴──────────────────┐
                              │  student input (voice / text)       │
                              │                                     │
                              ▼                                     │
                    teacher_turn_started ─── [trace-recorder]       │
                              │                                     │
                    traceSttResult ────────── [Langfuse]            │
                              │                                     │
                    engine.submitAnswer / orchestrator.process      │
                              │                                     │
                    traceValidation ───────── [Langfuse]            │
                              │                                     │
                    (guard check)                                   │
                    guard_triggered / runtime_violation_detected    │
                              │                 (if AI text bad)    │
                    traceTeacherGeneration ─── [Langfuse]           │
                    teacher_turn_completed ─── [trace-recorder]     │
                              │                                     │
                    tts_generated / tts_skipped ── [trace-recorder] │
                              │                                     │
                    teacher_turn_end (WS event)                     │
                              │                                     │
                              └─────────────────────────────────────┘
                                                │
                              lesson ends (natural / timeout / disconnect)
                                                │
                              endLessonTrace ─────────────── [Langfuse]
```

---

## 3. Trace Event Schema

### RuntimeTraceEvent (trace-recorder output)

```typescript
interface RuntimeTraceEvent {
  traceId:        string              // UUID per event
  sessionId:      string | null       // lesson_sessions.session_id
  userIdHash:     string | null       // SHA-256 prefix of userId — NOT raw
  eventType:      RuntimeTraceEventType
  cursorVersion?: number              // ExerciseCursor.cursorVersion when relevant
  exerciseId?:    string
  exerciseType?:  string
  payloadSummary: string              // max 200 chars — no secrets
  timestamp:      string              // ISO 8601
  severity:       'debug'|'info'|'warn'|'error'
  metadata?:      Record<string, unknown>   // sanitized — banned keys removed
}
```

### Event types and what they diagnose

| Event | Severity | What it means | Failure it helps diagnose |
|---|---|---|---|
| `ws_attach_succeeded` | info | Authenticated WS connection established | Client can't connect; session ID mismatch |
| `ws_attach_denied` | warn | JWT auth failed, WS closed 4001 | Expired tokens; wrong API URL |
| `lesson_ready_emitted` | info | Frontend told to show "Begin Lesson" | Frontend stuck on loading; lesson not starting |
| `lesson_resync_emitted` | info | Grace reconnect or late-recover sent resync | Reconnect loop; cursor not restored |
| `teacher_turn_started` | debug | AI call initiated (processInput entered) | Queued inputs; AI call not triggered |
| `teacher_turn_completed` | info | AI call returned, result available | Silent AI turn; missing teacher response |
| `exercise_cursor_updated_emitted` | info | exercise_cursor_updated sent to frontend | Frontend stuck on wrong exercise/item |
| `tts_generated` | debug | TTS audio stream started | Audio not playing; TTS silent branches |
| `tts_skipped` | debug | TTS skipped due to student interrupt | teacher_turn_end not sent; mic lifecycle broken |
| `guard_triggered` | warn | Stale-item guard rewrote teacher text | AI referencing wrong item number frequently |
| `runtime_violation_detected` | warn | Execution output guard rewrote teacher text | AI announcing inactive exercises |

---

## 4. Instrumentation Points

All trace calls are in `backend/src/ws/lesson-ws.ts`. Each is a single synchronous call to `recordTraceEvent()` from `../runtime/index.js`.

| Point | Location in lesson-ws.ts | Event |
|---|---|---|
| WS connect success | `attachLessonWS` after `clients.set(ws, meta)` | `ws_attach_succeeded` |
| Fresh lesson signal | Before `send(ws, { type: 'lesson_ready' })` | `lesson_ready_emitted` |
| Reconnect resync | End of `sendLessonResync()` | `lesson_resync_emitted` |
| Init cursor (lesson start) | After `send(ws, { type: 'exercise_cursor_updated', cursor: initCursor })` | `exercise_cursor_updated_emitted` |
| AI turn gate | In `processInput()` after `remainingMs` computed | `teacher_turn_started` |
| AI turn result | In `processInput()` after `meta.aiCallCount++` | `teacher_turn_completed` |
| Stale-item guard fire | In stale-item guard `if (!guardResult.safe)` | `guard_triggered` |
| Execution guard fire | In execution guard `if (!execGuard.safe)` | `runtime_violation_detected` |
| TTS start | In `ttsStream()` before `speakToClient()` | `tts_generated` |
| TTS interrupt | In `ttsStream()` when `interruptPending` | `tts_skipped` |

---

## 5. Debugging a Failed Golden Runtime Test

### Step 1: Identify the failing test

Playwright Golden Runtime tests are in `tests/golden-runtime/`. Each test covers one section + scenario. The test output shows which WS events arrived and which did not.

### Step 2: Correlate with backend traces

Enable `ENABLE_RUNTIME_TRACE=1` and re-run the test. Grep stderr for the session:

```bash
# Start backend with trace enabled
ENABLE_RUNTIME_TRACE=1 npm run dev 2>&1 | grep RUNTIME_TRACE | jq .RUNTIME_TRACE

# Filter by session (from Playwright output or test logs)
ENABLE_RUNTIME_TRACE=1 npm run dev 2>&1 | grep RUNTIME_TRACE | \
  jq 'select(.RUNTIME_TRACE.sessionId == "ses_abc") | .RUNTIME_TRACE'
```

### Step 3: Check the event sequence

Expected happy-path sequence:
```
ws_attach_succeeded
lesson_ready_emitted          ← if missing: frontend will not show "Begin Lesson"
[focus_lesson_start WS msg]
exercise_cursor_updated_emitted source=init  ← if missing: frontend won't show exercise
teacher_turn_started           ← if missing: AI never called
teacher_turn_completed         ← if missing: AI call failed silently
tts_generated                  ← if missing: audio not streaming
```

### Step 4: Common failure patterns

| Pattern | Likely cause |
|---|---|
| `ws_attach_succeeded` but no `lesson_ready_emitted` | `tryLateRecover()` found a stale session — resync sent instead |
| `teacher_turn_started` but no `teacher_turn_completed` | `orchestrator.process()` threw; check `traceRuntimeError` in Langfuse |
| `guard_triggered` fires every turn | AI has incorrect cursor context — check `enginePromptContext` injection |
| `tts_skipped` unexpectedly | `interruptPending` flag not cleared; check `mic_stop` → `interrupt` ordering |
| `lesson_resync_emitted` with `transcript=0` | Transcript recorder not writing events; check `lesson_transcript_events` table |

### Step 5: Correlate with Playwright trace

Playwright captures WS frames in the trace viewer. Match `exercise_cursor_updated_emitted.cursorVersion` with WS frame `cursor.cursorVersion` to verify monotonicity.

---

## 6. Future Expansion Points

### Adding a Langfuse sink

The trace recorder supports additional sinks via `traceRecorder.addSink()`. Add this in `index.ts` during server startup after `initObservability()`:

```typescript
import { traceRecorder } from './runtime/index.js'
import { traceRuntimeSpan } from './observability/index.js'

traceRecorder.addSink((event) => {
  traceRuntimeSpan(event.sessionId ?? 'unknown', event.eventType, {
    severity:       event.severity,
    payloadSummary: event.payloadSummary,
    cursorVersion:  event.cursorVersion ?? null,
    exerciseType:   event.exerciseType ?? null,
  })
})
```

### Adding an OpenTelemetry sink

```typescript
import { trace } from '@opentelemetry/api'
traceRecorder.addSink((event) => {
  const span = trace.getTracer('ai-teacher').startSpan(event.eventType)
  span.setAttributes({ ...event })
  span.end()
})
```

### Adding a `/runtime/traces/:sessionId` endpoint

Only implement once an authenticated admin layer exists. The trace recorder currently writes to stderr — a future sink could buffer events per-session in Redis (with a 1h TTL) for the endpoint to read.

Until then: query traces from your log aggregator (Datadog, CloudWatch Logs Insights, etc.) using:
```
filter @message like /RUNTIME_TRACE/ and .RUNTIME_TRACE.sessionId = "ses_abc"
| fields @timestamp, .RUNTIME_TRACE.eventType, .RUNTIME_TRACE.payloadSummary
| sort @timestamp asc
```

---

## 7. Security & Privacy Considerations

- `userIdHash` is SHA-256 truncated to 16 hex chars — collision-resistant but not reversible
- No raw user IDs, emails, or JWTs in any trace event
- `payloadSummary` is capped at 200 chars with `sanitizeMetadata()` removing banned keys
- No full student transcripts — only `input_chars=N` counts
- No exercise answer content in trace events
- Metadata keys containing `password`, `token`, `secret`, `jwt`, `apikey`, `auth`, `bearer` are stripped
