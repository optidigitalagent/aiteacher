// Observability public API.
// Import from here in lesson-ws.ts and other runtime files.

export {
  initObservability,
  flushObservability,
  isObservabilityEnabled,
  hashUserId,
} from './langfuse-client.js'

export {
  startLessonTrace,
  endLessonTrace,
  traceRuntimeSpan,
  traceSttResult,
  traceInterpretation,
  traceValidation,
  traceTeacherGeneration,
  traceProgression,
  traceFrontendSync,
  traceRuntimeError,
} from './lesson-tracer.js'

export type {
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
