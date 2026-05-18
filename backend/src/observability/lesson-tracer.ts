// Lesson-scoped observability wrapper.
//
// One Langfuse trace = one lesson session (startLessonTrace → endLessonTrace).
// All functions are best-effort: they never throw into lesson runtime.
// All functions are no-op when Langfuse is not configured.

import { startObservation, propagateAttributes } from '@langfuse/tracing'
import type { LangfuseObservation } from '@langfuse/tracing'
import { isObservabilityEnabled } from './langfuse-client.js'
import type {
  LessonTraceMeta,
  SttSpanData,
  InterpretationSpanData,
  ValidationSpanData,
  TeacherGenerationSpanData,
  ProgressionSpanData,
  FrontendSyncSpanData,
  RuntimeErrorSpanData,
  LessonEndSpanData,
} from './types.js'

// One entry per active lesson session.
const activeLessons = new Map<string, LangfuseObservation>()

// ── Sanitization helpers ──────────────────────────────────────────────────────

function trunc(s: string, maxLen: number): string {
  return s.length <= maxLen ? s : s.slice(0, maxLen) + '…'
}

const BANNED_KEYS = ['password', 'token', 'secret', 'jwt', 'apikey', 'api_key', 'auth']

function sanitize(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(data)) {
    if (BANNED_KEYS.some(b => k.toLowerCase().includes(b))) continue
    out[k] = typeof v === 'string' && v.length > 500 ? trunc(v, 500) : v
  }
  return out
}

// ── Lesson lifecycle ──────────────────────────────────────────────────────────

export function startLessonTrace(lessonId: string, meta: LessonTraceMeta): void {
  if (!isObservabilityEnabled()) return
  if (activeLessons.has(lessonId)) return   // idempotent
  try {
    propagateAttributes(
      {
        userId:    meta.userIdHash ?? undefined,
        sessionId: meta.sessionId ?? undefined,
      },
      () => {
        const trace = startObservation('ai_teacher_lesson', {
          input: sanitize({
            lessonId:    meta.lessonId,
            sectionId:   meta.sectionId ?? '',
            unitId:      meta.unitId ?? '',
            startedAt:   meta.startedAt,
          }),
          metadata: sanitize({
            sectionId:   meta.sectionId ?? '',
            unitId:      meta.unitId ?? '',
            sessionId:   meta.sessionId ?? '',
          }),
          environment: meta.environment,
        })
        activeLessons.set(lessonId, trace)
      },
    )
  } catch (err) {
    console.error('[observability] startLessonTrace failed (non-fatal):', err instanceof Error ? err.message : err)
  }
}

export function endLessonTrace(lessonId: string, data?: LessonEndSpanData): void {
  const trace = activeLessons.get(lessonId)
  if (!trace) return
  try {
    if (data) {
      trace.updateOtelSpanAttributes({
        output: sanitize({
          durationMin:     data.durationMin,
          exerciseScore:   data.exerciseScore ?? 0,
          vocabularyCount: data.vocabularyCount ?? 0,
          phasesReached:   data.phasesReached ?? [],
          endReason:       data.endReason ?? 'unknown',
        }),
      })
    }
    trace.end()
  } catch (err) {
    console.error('[observability] endLessonTrace failed (non-fatal):', err instanceof Error ? err.message : err)
  } finally {
    activeLessons.delete(lessonId)
  }
}

// ── Runtime spans ─────────────────────────────────────────────────────────────

export function traceRuntimeSpan(
  lessonId: string,
  spanName: string,
  data:     Record<string, unknown>,
): void {
  const trace = activeLessons.get(lessonId)
  if (!trace) return
  try {
    const span = trace.startObservation(spanName, {
      input: sanitize(data),
    })
    span.end()
  } catch (err) {
    console.error(`[observability] traceRuntimeSpan(${spanName}) failed (non-fatal):`, err instanceof Error ? err.message : err)
  }
}

export function traceSttResult(lessonId: string, data: SttSpanData): void {
  const trace = activeLessons.get(lessonId)
  if (!trace) return
  try {
    const span = trace.startObservation('stt_result', {
      input: sanitize({
        transcriptLength:  data.transcriptLength,
        transcriptPreview: trunc(data.transcriptPreview, 120),
        inputMode:         data.inputMode,
        turnId:            data.turnId ?? null,
      }),
    })
    span.end()
  } catch (err) {
    console.error('[observability] traceSttResult failed (non-fatal):', err instanceof Error ? err.message : err)
  }
}

export function traceInterpretation(lessonId: string, data: InterpretationSpanData): void {
  const trace = activeLessons.get(lessonId)
  if (!trace) return
  try {
    const span = trace.startObservation('spoken_interpretation', {
      input: sanitize({
        exerciseType:             data.exerciseType,
        resolvedUtterancePreview: trunc(data.resolvedUtterancePreview, 120),
      }),
      output: sanitize({
        interpretedAnswer: data.interpretedAnswer ?? null,
        canonicalAnswer:   data.canonicalAnswer ?? null,
        issueType:         data.issueType ?? null,
        missingSlots:      data.missingSlots ?? [],
        confidence:        data.confidence ?? null,
      }),
    })
    span.end()
  } catch (err) {
    console.error('[observability] traceInterpretation failed (non-fatal):', err instanceof Error ? err.message : err)
  }
}

export function traceValidation(lessonId: string, data: ValidationSpanData): void {
  const trace = activeLessons.get(lessonId)
  if (!trace) return
  try {
    const span = trace.startObservation('validation', {
      input: sanitize({
        exerciseId: data.exerciseId,
        itemIndex:  data.itemIndex,
      }),
      output: sanitize({
        correct:          data.correct,
        allowProgression: data.allowProgression,
        retryRequired:    data.retryRequired,
        issueType:        data.issueType ?? null,
      }),
    })
    span.end()
  } catch (err) {
    console.error('[observability] traceValidation failed (non-fatal):', err instanceof Error ? err.message : err)
  }
}

export function traceTeacherGeneration(lessonId: string, data: TeacherGenerationSpanData): void {
  const trace = activeLessons.get(lessonId)
  if (!trace) return
  try {
    const span = trace.startObservation('teacher_generation', {
      input: sanitize({
        phase:      data.phase,
        promptType: data.promptType ?? null,
      }),
      output: sanitize({
        responseLength: data.responseLength ?? 0,
        teacherMode:    data.teacherMode ?? null,
        studentState:   data.studentState ?? null,
      }),
    })
    span.end()
  } catch (err) {
    console.error('[observability] traceTeacherGeneration failed (non-fatal):', err instanceof Error ? err.message : err)
  }
}

export function traceProgression(lessonId: string, data: ProgressionSpanData): void {
  const trace = activeLessons.get(lessonId)
  if (!trace) return
  try {
    const span = trace.startObservation('progression', {
      input: sanitize({
        exerciseId:   data.exerciseId ?? null,
        itemIndex:    data.itemIndex,
        action:       data.action,
        reason:       data.reason ?? null,
        cursorBefore: data.cursorBefore ?? null,
      }),
      output: sanitize({
        cursorAfter: data.cursorAfter ?? null,
      }),
    })
    span.end()
  } catch (err) {
    console.error('[observability] traceProgression failed (non-fatal):', err instanceof Error ? err.message : err)
  }
}

export function traceFrontendSync(lessonId: string, data: FrontendSyncSpanData): void {
  const trace = activeLessons.get(lessonId)
  if (!trace) return
  try {
    const span = trace.startObservation('frontend_sync', {
      input: sanitize({
        emittedEventType: data.emittedEventType,
        exerciseId:       data.exerciseId ?? null,
        itemIndex:        data.itemIndex ?? null,
        exerciseType:     data.exerciseType ?? null,
      }),
    })
    span.end()
  } catch (err) {
    console.error('[observability] traceFrontendSync failed (non-fatal):', err instanceof Error ? err.message : err)
  }
}

export function traceRuntimeError(lessonId: string, data: RuntimeErrorSpanData): void {
  const trace = activeLessons.get(lessonId)
  if (!trace) return
  try {
    const span = trace.startObservation('runtime_error', {
      input: sanitize({
        errorName:    data.errorName,
        errorMessage: trunc(data.errorMessage, 500),
        stackPreview: data.stackPreview ? trunc(data.stackPreview, 300) : null,
        lessonId:     data.lessonId ?? null,
        sessionId:    data.sessionId ?? null,
      }),
      level: 'ERROR',
    })
    span.end()
  } catch (err) {
    console.error('[observability] traceRuntimeError failed (non-fatal):', err instanceof Error ? err.message : err)
  }
}
