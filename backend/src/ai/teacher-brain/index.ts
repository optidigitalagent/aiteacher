export type {
  TeacherAction,
  ForbiddenAction,
  ExerciseRuntimeMode,
  SupportedExerciseType,
  UnsupportedExerciseType,
  UnsupportedReason,
  TeacherGuidanceMode,
  TeacherPersona,
  StudentState,
  ExerciseRuntimeState,
  TeacherBrainContext,
  TeacherResponseContract,
  ExerciseBoundaryType,
  FewShotExample,
  RuleGroup,
  ActionDefinition,
  CorrectionTurn,
  TeacherBrainStructuredResponse,
  ParsedTeacherBrainResponse,
  TeacherBrainValidationState,
  TeacherBrainValidationResult,
} from './teacher-brain.types.js'

export {
  SUPPORTED_DETERMINISTIC_TYPES,
  SUPPORTED_MATCHING_TYPES,
  SUPPORTED_SPEAKING_TYPES,
  SUPPORTED_GRAMMAR_TYPES,
  UNSUPPORTED_EXERCISE_TYPES,
  FORBIDDEN_AI_BEHAVIORS,
  TEACHER_COMMUNICATION_PRINCIPLES,
  EXERCISE_RUNTIME_MODE_MAP,
  SKIP_POLICY,
  CORRECTION_LADDER_DESCRIPTIONS,
  ANTI_HALLUCINATION_RULES,
  TOKEN_BUDGET,
} from './teacher-brain.constants.js'

export {
  EXERCISE_RULES,
  TRANSITION_RULES,
  SPEAKING_RULES,
  CORRECTION_RULES,
  SKIP_RULES,
  MEMORY_RULES,
  ANTI_CHAOS_RULES,
  ALL_RULE_GROUPS,
  getRulesForMode,
} from './teacher-brain-rules.js'

export {
  EXAMPLES,
  selectExamples,
  formatExampleForPrompt,
} from './teacher-brain-examples.js'

export {
  ALLOWED_ACTIONS,
  FORBIDDEN_ACTIONS,
  isAllowedAction,
  isForbiddenAction,
  getActionDefinition,
  getForbiddenReason,
  validateActionIntegrity,
  validateTeacherBrainAction,
} from './teacher-brain-actions.js'

export {
  normalizeTeacherBrainContext,
  formatAISafeContext,
  formatAuthorityBoundary,
} from './teacher-brain-context.js'

export {
  validateResponseContract,
  parseResponseContract,
  extractTeacherText,
  buildValidationLog,
  RESPONSE_CONTRACT_SCHEMA,
  parseTeacherBrainResponse,
  stripTeacherBrainBlock,
} from './teacher-brain-response-contract.js'

export {
  buildTeacherBrainGuidance,
  buildPaidLessonTeacherBrainContext,
  validateTeacherResponse,
  buildContextComposerOutput,
  buildBehaviorPolicyOutput,
  buildExampleRetrieverOutput,
  buildStructuredOutputInstruction,
} from './teacher-brain-builder.js'

export {
  analyzeExecutability,
  detectHiddenAnswerSource,
  mapBlockReasonToUnsupportedReason,
  formatExecutabilityForPrompt,
  analyzeTextbookSectionContent,
  buildGreetingGuidance,
  buildSpeechRuntimeConsistencyRule,
  EXERCISE_INTRO_RULES,
} from './teacher-brain-executability.js'

export type {
  ExecutabilityBlockReason,
  TextbookSemanticClass,
  ExecutabilityInput,
  ExecutabilityDecision,
  HiddenAnswerSourceDecision,
  SectionAnalysis,
} from './teacher-brain-executability.js'
