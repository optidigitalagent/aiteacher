// Shared enums
export * from './shared/enums.js';

// Shared constants
export * from './shared/constants.js';

// Shared errors
export * from './shared/errors.js';

// Score types and helpers
export * from './shared/score.js';

// Shared types
export * from './shared/types.js';

// Log events
export * from './shared/log-events.js';

// Contracts
export type { STTResult } from './contracts/stt-result.js';
export type { ActionPacket } from './contracts/action-packet.js';
export type { TurnRecord } from './contracts/turn-record.js';
export type { MasteryRecord } from './contracts/mastery-record.js';
export type { ChildProfile } from './contracts/child-profile.js';
export type { SessionMemory } from './contracts/session-memory.js';
export type {
  RedisSessionStore,
  PostgresProfileStore,
  SafetyEventStore,
} from './contracts/stores.js';

// State types
export type { ChildState } from './state/child-state.js';
export type { ItemState } from './state/item-state.js';
export type { SessionState } from './state/session-state.js';

// Vocabulary guard
export {
  CORE_TEACHER_VOCABULARY,
  CORE_TEACHER_VOCABULARY_SET,
  isCoreTeacherWordAllowed,
} from './teacher-response/core-teacher-vocabulary.js';

// Classification engine (Phase 3)
export type { ResponseClassificationResult, ClassificationSource, ClassificationInput, ActivityContext, ItemVocabularyContext, LLMClassifier, LLMClassificationInput, LLMClassificationResult } from './classification/index.js';
export { classifyResponse, runDeterministicClassifier, computeTimeoutFallback, normalizeText, editDistance, isNearMatch, isExactMatch, isWrongButRelated, containsTargetWord, phoneticKey, isPhoneticMatch, phoneticSimilarity, LABEL_TO_ACTION, LLM_ELIGIBLE_LABELS, UNSAFE_KEYWORDS, I_DONT_KNOW_PHRASES, REFUSAL_PHRASES } from './classification/index.js';

// Perception layer (Phase 2)
export type { PerceptionBundle, PerceptionInput, PromptContext, ChildStateSnapshot, UncertaintyReason, L1DetectionResult, NormalizedStt, LatencyAnalysis, SilenceAnalysis } from './perception/index.js';
export { buildPerceptionBundle, detectL1, L1_KEYWORD_MAP, normalizeSTT, analyzeLatency, analyzeSilence, computeInputQuality, InputQuality, PERCEPTION_UNCERTAINTY_THRESHOLD } from './perception/index.js';

// State Engine (Phase 4)
export { runStateEngine, computeConfidenceDeltas, computeNewRecoveryState, applyChildStateDeltas, createInitialChildState, updateItemState, createInitialItemState, applyCostDelta, buildTurnOnlyCostDelta, createInitialCostCounters, buildTurnRecord, appendTurn, recalculateSuccessFailureCounts, STATE_ENGINE_MAX_RECENT_TURNS, buildUpdatedSessionMemory, computeStaminaDelta, activityDidSwitch, consecutiveSameActivityCount } from './state-engine/index.js';
export type { StateEngineInput, StateEngineOutput, StateUpdateSummary, ConfidenceDeltas, ItemStateDeltas, CostCounterDelta, AppliedUpdate } from './state-engine/index.js';

// Learning Engine (Phase 5)
export { runLearningEngine, computeConsecutiveCorrect, computeConsecutiveWrong, computeConsecutiveSameActivity, countLabelInLastN, computeProgressionDecision, activityDemandLevel, activityAtLevel, highestFeasibleActivity, selectNextActivity, selectEasiestWin, hasMasteredItems, isMasteredForEasiestWin, computeMasteryUpdateCandidate, computeReviewCandidate, checkSessionClose, evaluateLessonFlow, canBeginClose, computeEngagementAdaptation, FRUSTRATION_STOP_E, FRUSTRATION_EASIEST_WIN_E, ADVANCE_CONSECUTIVE_CORRECT, ADVANCE_PROD_MIN, ADVANCE_COMP_MIN, LOWER_CONSECUTIVE_WRONG, SCAFFOLD_CONSECUTIVE_WRONG } from './learning-engine/index.js';
export type { LearningDecision, LearningEngineInput, CurrentItemContext, AvailableItem, ReviewQueueItem, MasteryUpdateCandidate, ReviewScheduleCandidate, EasiestWinResult, ProgressionOutcome, DerivedSignals } from './learning-engine/index.js';

// Teacher Response Engine (Phase 6)
export { runTeacherResponseEngine, buildTeacherResponsePlan, getFastTrackReaction, getSuccessAfterRecoveryReaction, applyPlaceholderGuard, hasUnresolvedPlaceholders, findPlaceholderPatterns, buildAllowedVocabSet, checkVocabulary, applyVocabularyGuard, enforceMaxLength, checkForbiddenPhrases, applyForbiddenPhraseGuard, buildActivityPrompt, buildScaffoldResponse, buildRecoveryResponse, routeTeacherResponse, getRenderedTemplate, getAllTemplatesForKey, pickTemplateVariant, renderTemplate } from './teacher-response/index.js';
export type { TeacherResponsePlan, TeacherResponseInput, TeacherResponseContext, ResponseMode, ResponseRoute, TeacherResponseEngineOutput, LLMTeacherResponder, LLMTeacherInput, LLMTeacherResponse, RecoveryType, RecoveryResponseParams, ScaffoldParams, ActivityPromptParams, FastTrackReaction, PlaceholderGuardResult, VocabularyGuardResult, VocabularyGuardApplyResult, LengthGuardResult, ForbiddenPhraseGuardResult, TemplateKey, TemplateVars } from './teacher-response/index.js';

// Runtime Orchestrator (Phase 7)
export { startKidsBrainSession, processKidsBrainTurn, processKidsBrainSilence, endKidsBrainSession, RuntimeActionPacketType, derivePromptType, buildActivityContext, buildPromptContext, buildChildStateSnapshot, buildCurrentItemContext, buildAvailableItems, buildAvailableActivities, deriveScaffoldLevel, buildTeacherResponseContext, buildRuntimeLog } from './runtime/index.js';
export type { RuntimeActionPacket, KidsBrainTurnInput, KidsBrainSilenceInput, KidsBrainSessionStartInput, RuntimeTurnResult, RuntimeSessionStartResult, RuntimeEndResult } from './runtime/index.js';
