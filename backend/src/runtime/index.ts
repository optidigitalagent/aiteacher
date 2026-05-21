// Runtime observability public API.
// Import from here in lesson-ws.ts and other runtime files.

export { recordTraceEvent, traceRecorder } from './trace-recorder.js'
export type {
  RuntimeTraceEvent,
  RuntimeTraceEventType,
  TraceInput,
  TraceEventSeverity,
} from './trace-recorder.js'

export {
  getOrCreateContinuity,
  clearContinuity,
  detectEmotionalSignal,
  detectUncertainty,
  updateContinuityFromStudentInput,
  chooseSupportResponse,
  chooseTransitionAck,
  avoidRepeatedPhrase,
} from './conversation-continuity.js'
export type {
  EmotionalSignal,
  TeacherMove,
  ConversationContinuityState,
} from './conversation-continuity.js'

export {
  detectAndExplainVocabQuestion,
  chooseHumanReaction,
  chooseCuriousFollowup,
  softenExpansionRequest,
  chooseShortAnswerReaction,
  chooseCorrectionBridge,
  chooseReflectiveTransition,
} from './conversation-moves.js'
