// Runtime Trace Recorder — lightweight, env-gated, sink-agnostic.
//
// Records authoritative runtime boundary events for AI Teacher lessons.
// Default: no-op. Set ENABLE_RUNTIME_TRACE=1 to emit structured JSON to stderr.
//
// Design guarantees:
//   • Zero async I/O — synchronous structured log only (no DB writes per event)
//   • No extra AI calls
//   • No auth tokens, secrets, or full transcripts logged
//   • No-op when ENABLE_RUNTIME_TRACE !== '1'
//   • Best-effort — never throws into lesson runtime
//
// Future sinks can be added without changing callers:
//   addSink(fn: (event: RuntimeTraceEvent) => void)

import { randomUUID } from 'node:crypto'

// ── Event Schema ──────────────────────────────────────────────────────────────

export type RuntimeTraceEventType =
  | 'ws_attach_succeeded'
  | 'ws_attach_denied'
  | 'lesson_ready_emitted'
  | 'teacher_turn_started'
  | 'teacher_turn_completed'
  | 'exercise_cursor_updated_emitted'
  | 'lesson_resync_emitted'
  | 'tts_generated'
  | 'tts_skipped'
  | 'guard_triggered'
  | 'runtime_violation_detected'
  | 'conversation_continuity_updated'
  | 'conversation_phrase_rotated'
  | 'conversation_softened_for_uncertainty'
  // Phase 3B: Adaptive Signal Logging
  | 'adaptive_signal_recorded'
  | 'adaptive_session_state_updated'
  // Phase 3C: Adaptive Context Injection
  | 'adaptive_context_injected'
  | 'adaptive_context_skipped'
  // Phase 3D.2: Lesson-End Mastery Aggregation
  | 'mastery_aggregation_started'
  | 'mastery_state_updated'
  | 'mastery_aggregation_failed'

export type TraceEventSeverity = 'debug' | 'info' | 'warn' | 'error'

export interface RuntimeTraceEvent {
  traceId:        string
  sessionId:      string | null
  userIdHash:     string | null   // SHA-256 prefix — never raw userId
  eventType:      RuntimeTraceEventType
  cursorVersion?: number
  exerciseId?:    string
  exerciseType?:  string
  payloadSummary: string          // max 200 chars — no secrets
  timestamp:      string          // ISO 8601
  severity:       TraceEventSeverity
  metadata?:      Record<string, unknown>
}

// ── Input (caller-friendly — fewer required fields) ───────────────────────────

export interface TraceInput {
  sessionId?:     string | null
  userIdHash?:    string | null
  eventType:      RuntimeTraceEventType
  cursorVersion?: number
  exerciseId?:    string
  exerciseType?:  string
  payloadSummary: string
  severity?:      TraceEventSeverity
  metadata?:      Record<string, unknown>
}

// ── Sink type ─────────────────────────────────────────────────────────────────

type TraceSink = (event: RuntimeTraceEvent) => void

// ── Private helpers ───────────────────────────────────────────────────────────

const BANNED_KEYS = new Set([
  'password', 'token', 'secret', 'jwt', 'apikey', 'api_key',
  'auth', 'authorization', 'bearer',
])

function sanitizeMetadata(
  meta: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!meta) return undefined
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(meta)) {
    if (BANNED_KEYS.has(k.toLowerCase())) continue
    out[k] = typeof v === 'string' && v.length > 200 ? v.slice(0, 200) + '…' : v
  }
  return out
}

function trunc(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n) + '…'
}

// ── Structured JSON log sink ──────────────────────────────────────────────────
// Writes one JSON line per event to stderr.
// Format is directly consumable by log aggregators (Datadog, CloudWatch, Loki, etc.)

function stdErrSink(event: RuntimeTraceEvent): void {
  try {
    process.stderr.write(JSON.stringify({ RUNTIME_TRACE: event }) + '\n')
  } catch {
    // ignore write errors — never propagate into lesson runtime
  }
}

// ── RuntimeTraceRecorder ──────────────────────────────────────────────────────

class RuntimeTraceRecorder {
  private readonly sinks: TraceSink[] = [stdErrSink]

  // Register an additional sink (e.g. Langfuse, OTel, admin dashboard).
  // Sinks receive every event regardless of severity.
  addSink(fn: TraceSink): void {
    this.sinks.push(fn)
  }

  record(input: TraceInput): void {
    // Hot path: check env on every call so the flag can be changed at runtime.
    // The flag is off by default — zero cost in production unless explicitly enabled.
    if (process.env.ENABLE_RUNTIME_TRACE !== '1') return

    try {
      const event: RuntimeTraceEvent = {
        traceId:        randomUUID(),
        sessionId:      input.sessionId ?? null,
        userIdHash:     input.userIdHash ?? null,
        eventType:      input.eventType,
        cursorVersion:  input.cursorVersion,
        exerciseId:     input.exerciseId,
        exerciseType:   input.exerciseType,
        payloadSummary: trunc(input.payloadSummary, 200),
        timestamp:      new Date().toISOString(),
        severity:       input.severity ?? 'info',
        metadata:       sanitizeMetadata(input.metadata),
      }

      for (const sink of this.sinks) {
        try {
          sink(event)
        } catch {
          // individual sink failure must never propagate
        }
      }
    } catch {
      // building the event failed — never propagate into lesson runtime
    }
  }
}

// ── Singleton ─────────────────────────────────────────────────────────────────

export const traceRecorder = new RuntimeTraceRecorder()

// ── Public helper ─────────────────────────────────────────────────────────────

export function recordTraceEvent(input: TraceInput): void {
  traceRecorder.record(input)
}
