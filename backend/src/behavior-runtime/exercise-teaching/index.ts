// Exercise Teaching Brain — public API
//
// Primary entry point: buildExerciseTeachingContext()
// Returns a prompt block to inject into Teacher Brain system prompt.

export { buildExerciseTeachingContext } from './teaching-context-builder.js'
export type { ExerciseTeachingContextInput, ExerciseTeachingContextResult } from './teaching-context-builder.js'

export {
  getExerciseFormatPolicy,
  isExerciseTypeSupported,
  getUnsupportedReason,
  getTeacherInstructionPolicy,
  getDemonstrationPolicy,
  getExpectedAnswerPolicy,
  getHintPolicy,
  getRetryPolicy,
  getFrontendRenderPolicy,
} from './exercise-format-registry.js'
export type { ExerciseFormatPolicy, HintPolicy, RetryPolicy, FrontendRenderPolicy } from './exercise-format-registry.js'

export { detectTeachingMode, describeModeForContext } from './teaching-mode-runtime.js'
export type { TeachingMode, TeachingModeInput } from './teaching-mode-runtime.js'

export { determineDemoContext } from './demonstration-policy.js'
export type { DemoDecision, DemoContext, DemoInput } from './demonstration-policy.js'

export { evaluateTaskBoundary } from './task-boundary-guard.js'
export type { TaskBoundaryInput, TaskBoundaryResult } from './task-boundary-guard.js'

export { buildFrontendSyncGuard } from './frontend-sync-guard.js'
export type { FrontendSyncInput, FrontendSyncResult } from './frontend-sync-guard.js'

export { buildRetryEscalation, buildOpeningInstruction } from './retry-escalation.js'
export type { RetryEscalationInput, RetryEscalationResult } from './retry-escalation.js'

export { getExerciseTeachingProtocol, buildProtocolTeacherGuidance } from './exercise-teaching-protocols.js'
export type { ExerciseTeachingProtocol, AnswerMode, ProtocolGuidanceInput } from './exercise-teaching-protocols.js'
