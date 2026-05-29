// Types and interfaces
export type { ResponseClassificationResult, ClassificationSource } from './classification-result.js';
export type { ClassificationInput, ActivityContext, ItemVocabularyContext } from './classification-types.js';
export type { LLMClassifier, LLMClassificationInput, LLMClassificationResult } from './llm-classifier-contract.js';

// Constants
export {
  NEAR_MATCH_EDIT_DISTANCE_MAX,
  CORRECT_CONFIDENT_MIN_ADJ_CONFIDENCE,
  CORRECT_HESITANT_MIN_ADJ_CONFIDENCE,
  SAFETY_CONFIDENCE_THRESHOLD,
  MASTERY_ELIGIBLE_MIN_CONFIDENCE,
  I_DONT_KNOW_PHRASES,
  REFUSAL_PHRASES,
  UNSAFE_KEYWORDS,
} from './classification-constants.js';

export { LLM_ELIGIBLE_LABELS } from './llm-classifier-contract.js';
export { LABEL_TO_ACTION } from './classification-result.js';

// Semantic helpers
export { normalizeText, editDistance, isNearMatch, isExactMatch, isWrongButRelated, containsTargetWord } from './semantic-matcher.js';

// Phonetic helpers
export { phoneticKey, isPhoneticMatch, phoneticSimilarity } from './phonetic-matcher.js';

// Classifiers
export { runDeterministicClassifier } from './deterministic-classifier.js';
export { computeTimeoutFallback } from './timeout-fallback.js';
export { classifyResponse } from './classification-router.js';
