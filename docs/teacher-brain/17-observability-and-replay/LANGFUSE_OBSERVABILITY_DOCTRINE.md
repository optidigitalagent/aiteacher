# Langfuse Observability Doctrine

## Purpose

This document defines the observability contract for the AI Teacher runtime.
Tracing exists to diagnose bugs, desync, and pedagogical regressions — not to surveil students.

---

## Core Principle

One Langfuse trace = one lesson session.

The trace timeline mirrors the actual runtime sequence a student experiences:
Student input → STT → Interpretation → Validation → Teacher Generation → Cursor Update → Frontend Sync

---

## What We Trace

| Span name               | When created                                  | What it records                                               |
|-------------------------|-----------------------------------------------|---------------------------------------------------------------|
| `ai_teacher_lesson`     | Lesson start (handleFocusLessonStart)         | lessonId, sectionId, unitId, userId hash, sessionId           |
| `stt_result`            | processInput entry (real student input only)  | transcriptLength, transcriptPreview (≤120 chars), inputMode   |
| `spoken_interpretation` | After interpretSpokenAnswer                   | exerciseType, resolvedUtterance, canonicalAnswer, issueType   |
| `validation`            | After manifest/engine validation              | exerciseId, itemIndex, correct, allowProgression, issueType   |
| `teacher_generation`    | After orchestrator.process returns            | phase, responseLength                                         |
| `progression`           | On cursor advance (optional)                  | exerciseId, itemIndex, action, cursorBefore/after             |
| `frontend_sync`         | On exercise_cursor_updated emit (optional)    | emittedEventType, exerciseId, itemIndex, exerciseType         |
| `runtime_error`         | In WS message handler catch blocks           | errorName, errorMessage, stackPreview (≤300 chars)            |

Root span ends on natural `lesson_end` or WS disconnect.

---

## What We Never Trace

- Audio chunks or binary payloads
- Full AI system prompts or conversation history
- Raw JWT tokens or auth credentials
- LiqPay payment data
- Google OAuth data
- Full textbook pages or OCR output
- Raw user profile JSON
- Any string > 500 chars (truncated automatically)
- Keys containing: password, token, secret, jwt, apikey, api_key, auth

---

## Privacy Model

User IDs are SHA-256 hashed and truncated to 16 hex chars before storage.
Session IDs are logged as-is (they are non-sensitive random UUIDs).
Transcript previews are limited to 120 characters.
No PII beyond what is needed to correlate a trace with a lesson.

---

## Failure Safety

All trace functions are wrapped in try/catch and never throw.
If Langfuse API is unreachable, lesson runtime continues unchanged.
If env vars are missing, all trace functions are no-ops (logged once at startup).
Tracing adds < 1ms overhead per span (synchronous OTel span creation).

---

## Configuration

Set in Railway (or .env) before deployment:

```
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_SECRET_KEY=sk-lf-...
LANGFUSE_HOST=https://us.cloud.langfuse.com
```

If `LANGFUSE_HOST` is absent, defaults to `https://cloud.langfuse.com`.

The module reads `LANGFUSE_HOST` first, then falls back to `LANGFUSE_BASE_URL` (official Langfuse env var name).

---

## SDK

- Package: `@langfuse/tracing@5.x`, `@langfuse/otel@5.x`, `@opentelemetry/sdk-node@0.x`
- API: `startObservation()` / `propagateAttributes()` from `@langfuse/tracing`
- Exporter: `LangfuseSpanProcessor` from `@langfuse/otel`
- No LangChain. No auto-instrumentation. No OTel metrics or logs.

---

## Where Traces Appear in Langfuse

1. Open Langfuse → your project → **Traces** tab
2. Each row is one `ai_teacher_lesson` trace (= one lesson session)
3. Click a trace to see the span tree: stt_result → validation → teacher_generation → etc.
4. Root span duration = lesson duration
5. Filter by `sessionId` in metadata to find a specific student session
6. Error spans are tagged with `level: ERROR` and appear highlighted
