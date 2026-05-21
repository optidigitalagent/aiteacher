export { memoryService } from './memory-service.js'
export type {
  TeacherMemorySummary,
  StudentMemoryProfile,
  ValidationEventInput,
  ExerciseCompletedInput,
  LessonCompletedInput,
  SessionMemory,
  AdaptiveSignal,
  MistakeCategory,
  HintDepthSignal,
} from './types.js'
export { formatTeacherMemorySummaryForPrompt } from './memory-summary-builder.js'
export { getSessionMemory, updateAdaptiveSignal, buildAdaptiveLearningContextBlock } from './session-memory.js'
export type { AdaptiveContextParams } from './session-memory.js'
export { deriveMistakeCategory } from './mistake-analyzer.js'
export { aggregateMasteryFromSession, deriveConfidenceLevel, loadTopWeakSkills, normalizeSkillTagForMastery } from './mastery-aggregator.js'
