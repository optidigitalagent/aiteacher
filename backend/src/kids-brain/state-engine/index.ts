export { runStateEngine } from './state-engine.js';

export type { StateEngineInput, StateUpdateSummary, ConfidenceDeltas, ItemStateDeltas, CostCounterDelta } from './state-engine-types.js';
export type { StateEngineOutput, AppliedUpdate } from './state-update-result.js';

export { computeConfidenceDeltas } from './confidence-updater.js';
export { computeNewRecoveryState } from './recovery-state-updater.js';
export { applyChildStateDeltas, createInitialChildState } from './child-state-updater.js';
export { updateItemState, createInitialItemState } from './item-state-updater.js';
export { applyCostDelta, buildTurnOnlyCostDelta, createInitialCostCounters } from './cost-counter-updater.js';
export { buildTurnRecord, appendTurn, recalculateSuccessFailureCounts, STATE_ENGINE_MAX_RECENT_TURNS } from './turn-history-updater.js';
export { buildUpdatedSessionMemory } from './session-memory-updater.js';
export { computeStaminaDelta, activityDidSwitch, consecutiveSameActivityCount } from './engagement-updater.js';
