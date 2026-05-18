# Pedagogical Trace Schema

## Root Trace: `ai_teacher_lesson`

Represents one complete lesson session.

```json
{
  "name": "ai_teacher_lesson",
  "input": {
    "lessonId":    "uuid",
    "sectionId":   "1.2",
    "unitId":      "1",
    "startedAt":   "2026-05-18T10:00:00.000Z"
  },
  "output": {
    "durationMin":     45,
    "exerciseScore":   7,
    "vocabularyCount": 3,
    "phasesReached":   ["DIAGNOSTIC", "EXERCISES", "WRAP_UP"],
    "endReason":       "natural"
  },
  "metadata": {
    "sectionId": "1.2",
    "unitId":    "1",
    "sessionId": "uuid"
  },
  "userId":    "sha256_prefix_16chars",
  "sessionId": "uuid"
}
```

---

## Span: `stt_result`

Emitted when student voice or text input enters the processing pipeline.

```json
{
  "name": "stt_result",
  "input": {
    "transcriptLength":  42,
    "transcriptPreview": "have you ever been to London",
    "inputMode":         "voice",
    "turnId":            "uuid"
  }
}
```

**Notes:**
- `transcriptPreview` is truncated to 120 characters
- `inputMode` is `voice` when a `voiceTurnId` is present, otherwise `text`
- Not emitted for system-generated context strings (those starting with `[`)

---

## Span: `spoken_interpretation`

Emitted after the interpretation pipeline processes a voice answer.

```json
{
  "name": "spoken_interpretation",
  "input": {
    "exerciseType":             "grammar_fill",
    "resolvedUtterancePreview": "have"
  },
  "output": {
    "interpretedAnswer": "have",
    "canonicalAnswer":   "have",
    "issueType":         "accepted",
    "missingSlots":      [],
    "confidence":        0.95
  }
}
```

**Notes:**
- `resolvedUtterancePreview` is truncated to 120 chars
- `issueType` maps to `SoftSpeakingIssueType` or `InterpretationIssueType`
- `canonicalAnswer` is the normalized answer submitted to the engine

---

## Span: `validation`

Emitted after the engine or manifest validates the student's answer.

```json
{
  "name": "validation",
  "input": {
    "exerciseId": "ex_3",
    "itemIndex":  2
  },
  "output": {
    "correct":          true,
    "allowProgression": true,
    "retryRequired":    false,
    "issueType":        null
  }
}
```

**Key fields for debugging:**
- If `correct=false` and `retryRequired=false` → validation rejected answer but no retry requested (edge case)
- If `allowProgression=false` and `correct=true` → soft-speaking exercise accepted but quality gate blocked progress
- `issueType` on failures: `too_short` | `missing_reason` | `off_task` | `broken_grammar` | etc.

---

## Span: `teacher_generation`

Emitted after the AI Teacher generates a response.

```json
{
  "name": "teacher_generation",
  "input": {
    "phase":      "EXERCISES",
    "promptType": null
  },
  "output": {
    "responseLength": 184,
    "teacherMode":    null,
    "studentState":   null
  }
}
```

**Notes:**
- Full prompt is never logged (privacy + token budget)
- `responseLength` helps detect abnormally long/short responses
- `phase` indicates which lesson phase triggered the generation

---

## Span: `progression`

Emitted when the exercise cursor advances.

```json
{
  "name": "progression",
  "input": {
    "exerciseId":   "ex_3",
    "itemIndex":    2,
    "action":       "step_correct",
    "reason":       null,
    "cursorBefore": { "exerciseNumber": 3, "itemIndex": 2, "itemTotal": 5 }
  },
  "output": {
    "cursorAfter": { "exerciseNumber": 3, "itemIndex": 3, "itemTotal": 5 }
  }
}
```

---

## Span: `frontend_sync`

Emitted when `exercise_cursor_updated` is sent to the frontend.

```json
{
  "name": "frontend_sync",
  "input": {
    "emittedEventType": "exercise_cursor_updated",
    "exerciseId":       "ex_3",
    "itemIndex":        3,
    "exerciseType":     "grammar_fill"
  }
}
```

---

## Span: `runtime_error`

Emitted when an unhandled error occurs in the WS message handler.

```json
{
  "name": "runtime_error",
  "input": {
    "errorName":    "TypeError",
    "errorMessage": "Cannot read properties of null (reading 'lessonId')",
    "stackPreview": "TypeError: Cannot read properties...\n    at processInput (/app/src/ws/lesson-ws.ts:1432:5)",
    "lessonId":     "uuid",
    "sessionId":    "uuid"
  },
  "level": "ERROR"
}
```

---

## Trace Correlation Strategy

To find all spans for a specific issue:

1. **By lessonId**: Search Langfuse metadata for `lessonId = "uuid"`
2. **By sessionId**: Search `sessionId = "uuid"` in trace metadata
3. **By error**: Filter traces that contain a `runtime_error` span with `level=ERROR`
4. **By exercise**: Filter `validation` spans where `exerciseId = "ex_3"` and `correct=false`

---

## Schema Versioning

This schema corresponds to observability module version 1 (Phase 17).
Breaking changes to span names or field names require updating this document.
Backward-compatible additions (new optional fields) do not require a version bump.
