import { ClassificationLabel } from '../shared/enums.js';
import type { ItemState } from '../state/item-state.js';
import type { ActivityContext } from '../classification/classification-types.js';
import type { ItemStateDeltas } from './state-engine-types.js';

const SUCCESS_LABELS = new Set<ClassificationLabel>([
  ClassificationLabel.CORRECT_CONFIDENT,
  ClassificationLabel.CORRECT_HESITANT,
  ClassificationLabel.NEAR_CORRECT,
  ClassificationLabel.PRONUNCIATION_VARIANT,
  ClassificationLabel.PARTIAL_ANSWER,
  ClassificationLabel.REPEATED_AFTER_MODEL,
]);

const L1_LABELS = new Set<ClassificationLabel>([
  ClassificationLabel.L1_TRANSLATION,
  ClassificationLabel.L1_HELP_REQUEST,
  ClassificationLabel.L1_REFUSAL,
  ClassificationLabel.CODE_SWITCH,
]);

const SILENCE_LABELS = new Set<ClassificationLabel>([
  ClassificationLabel.SILENCE_SHORT,
  ClassificationLabel.SILENCE_MEDIUM,
  ClassificationLabel.SILENCE_LONG,
  ClassificationLabel.NO_RESPONSE,
]);

/** Computes deltas for item-level counters from a classification label. */
function computeItemDeltas(
  label: ClassificationLabel,
  modelWasGiven: boolean,
): ItemStateDeltas {
  const isSuccess = SUCCESS_LABELS.has(label);
  const isL1 = L1_LABELS.has(label);
  const isSilence = SILENCE_LABELS.has(label);

  const correctAttemptsAdded = isSuccess ? 1 : 0;
  const promptedCorrectAdded = isSuccess && modelWasGiven ? 1 : 0;
  const unpromptedCorrectAdded = isSuccess && !modelWasGiven ? 1 : 0;
  const l1ResponsesAdded = isL1 ? 1 : 0;
  const silenceCountAdded = isSilence ? 1 : 0;

  return {
    attemptsAdded: 1,
    correctAttemptsAdded,
    promptedCorrectAdded,
    unpromptedCorrectAdded,
    l1ResponsesAdded,
    silenceCountAdded,
  };
}

/**
 * Applies a classification result to the session-scoped ItemState.
 * Returns a new ItemState — input is never mutated.
 *
 * Does NOT update persistent MasteryRecord (that is Phase 5).
 * Only updates session-scoped state.
 */
export function updateItemState(
  current: ItemState,
  label: ClassificationLabel,
  activityContext: ActivityContext,
  timestamp: string,
): { newItemState: ItemState; deltas: ItemStateDeltas } {
  const deltas = computeItemDeltas(label, activityContext.modelWasGiven);

  const newItemState: ItemState = {
    ...current,
    attemptCount: current.attemptCount + deltas.attemptsAdded,
    correctAttempts: current.correctAttempts + deltas.correctAttemptsAdded,
    promptedCorrectAttempts: current.promptedCorrectAttempts + deltas.promptedCorrectAdded,
    unpromptedCorrectAttempts: current.unpromptedCorrectAttempts + deltas.unpromptedCorrectAdded,
    l1Responses: current.l1Responses + deltas.l1ResponsesAdded,
    silenceCount: current.silenceCount + deltas.silenceCountAdded,
    lastClassification: label,
    lastSeenAt: timestamp,
  };

  return { newItemState, deltas };
}

/**
 * Creates a new session-scoped ItemState for an item never seen this session.
 */
export function createInitialItemState(itemId: string): ItemState {
  return {
    itemId,
    itemMastery: 0,
    attemptCount: 0,
    modelGiven: false,
    l1AnchorUsed: false,
    comprehensionNotEstablishedThisSession: false,
    correctAttempts: 0,
    promptedCorrectAttempts: 0,
    unpromptedCorrectAttempts: 0,
    l1Responses: 0,
    silenceCount: 0,
    lastClassification: null,
    lastSeenAt: null,
  };
}
