// Core vocabulary (Patch 5 / §10A — pre-existing, preserved)
export {
  CORE_TEACHER_VOCABULARY,
  CORE_TEACHER_VOCABULARY_SET,
  isCoreTeacherWordAllowed,
} from './core-teacher-vocabulary.js';

// Types
export type { ResponseMode, TeacherResponseContext, TeacherResponseInput } from './teacher-response-types.js';
export type { TeacherResponsePlan, BuildTeacherResponsePlanParams } from './teacher-response-plan.js';
export { buildTeacherResponsePlan } from './teacher-response-plan.js';

// Constants
export {
  MAX_WORDS_BY_AGE,
  PLACEHOLDER_PATTERNS,
  FORBIDDEN_PHRASES,
  PRAISE_VARIANTS,
  EFFORT_PRAISE_VARIANTS,
  UNIVERSAL_FALLBACK_TEXT,
  SAFETY_CLOSE_TEXT,
  RECOVERY_CLOSE_TEXT,
} from './teacher-response-constants.js';

// Template bank
export type { TemplateKey, TemplateVars } from './response-template-bank.js';
export {
  getRenderedTemplate,
  getAllTemplatesForKey,
  pickTemplateVariant,
  renderTemplate,
} from './response-template-bank.js';

// Fast-track reactions
export type { FastTrackReaction } from './fast-track-reactions.js';
export {
  getFastTrackReaction,
  getSuccessAfterRecoveryReaction,
} from './fast-track-reactions.js';

// Placeholder guard
export type { PlaceholderGuardResult } from './placeholder-guard.js';
export {
  hasUnresolvedPlaceholders,
  findPlaceholderPatterns,
  applyPlaceholderGuard,
} from './placeholder-guard.js';

// Vocabulary guard
export type { VocabularyGuardResult, VocabularyGuardApplyResult } from './vocabulary-guard.js';
export {
  buildAllowedVocabSet,
  checkVocabulary,
  applyVocabularyGuard,
} from './vocabulary-guard.js';

// Language policy
export type { LengthGuardResult, ForbiddenPhraseGuardResult } from './teacher-language-policy.js';
export {
  enforceMaxLength,
  checkForbiddenPhrases,
  applyForbiddenPhraseGuard,
} from './teacher-language-policy.js';

// Activity prompt builder
export type { ActivityPromptParams } from './activity-prompt-builder.js';
export { buildActivityPrompt } from './activity-prompt-builder.js';

// Scaffold response builder
export type { ScaffoldParams } from './scaffold-response-builder.js';
export { buildScaffoldResponse } from './scaffold-response-builder.js';

// Recovery response builder
export type { RecoveryType, RecoveryResponseParams } from './recovery-response-builder.js';
export { buildRecoveryResponse } from './recovery-response-builder.js';

// LLM contract (interface only)
export type { LLMTeacherInput, LLMTeacherResponse, LLMTeacherResponder } from './llm-teacher-contract.js';

// Router
export type { ResponseRoute } from './teacher-response-router.js';
export { routeTeacherResponse } from './teacher-response-router.js';

// Main engine
export type { TeacherResponseEngineOutput } from './teacher-response-engine.js';
export { runTeacherResponseEngine } from './teacher-response-engine.js';
