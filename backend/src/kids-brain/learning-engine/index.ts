// Main entry point
export { runLearningEngine } from './learning-engine.js';

// Primary output type
export type { LearningDecision } from './learning-decision.js';

// Input and supporting types
export type {
  LearningEngineInput,
  CurrentItemContext,
  AvailableItem,
  ReviewQueueItem,
  MasteryUpdateCandidate,
  ReviewScheduleCandidate,
  EasiestWinResult,
  ProgressionOutcome,
  DerivedSignals,
} from './learning-engine-types.js';

// Constants (exported for configuration/testing)
export {
  FRUSTRATION_STOP_E,
  FRUSTRATION_EASIEST_WIN_E,
  FRUSTRATION_FORBID_ADVANCE_E,
  FRUSTRATION_SCAFFOLD_E,
  ADVANCE_CONSECUTIVE_CORRECT,
  ADVANCE_PROD_MIN,
  ADVANCE_COMP_MIN,
  LOWER_CONSECUTIVE_WRONG,
  SCAFFOLD_CONSECUTIVE_WRONG,
} from './learning-constants.js';

// Sub-engine utilities (for testing and downstream phases)
export {
  computeConsecutiveCorrect,
  computeConsecutiveWrong,
  computeConsecutiveSameActivity,
  countLabelInLastN,
  computeProgressionDecision,
} from './progression-engine.js';

export {
  activityDemandLevel,
  activityAtLevel,
  highestFeasibleActivity,
  selectNextActivity,
} from './activity-selection-engine.js';

export { selectEasiestWin, hasMasteredItems, isMasteredForEasiestWin } from './easiest-win-selector.js';
export { computeMasteryUpdateCandidate } from './mastery-engine.js';
export { computeReviewCandidate } from './review-scheduler.js';
export { checkSessionClose } from './session-completion-engine.js';
export { evaluateLessonFlow, canBeginClose } from './lesson-flow-engine.js';
export { computeEngagementAdaptation } from './engagement-adaptation-engine.js';
