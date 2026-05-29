import { ActivityType, PromptType, RecoveryState } from '../shared/enums.js';
import type { ClassificationLabel } from '../shared/enums.js';
import type { SessionMemory } from '../contracts/session-memory.js';
import type { ActivityContext } from '../classification/classification-types.js';
import type { TeacherResponseContext } from '../teacher-response/teacher-response-types.js';
import type { CurrentItemContext, AvailableItem } from '../learning-engine/learning-engine-types.js';
import type { ChildStateSnapshot, PromptContext } from '../perception/perception-types.js';
import type { KidsBrainTurnInput } from './runtime-types.js';

const ALL_ACTIVITIES: ActivityType[] = Object.values(ActivityType);

/**
 * Maps ActivityType to the appropriate PromptType for the perception and classification layers.
 * Defaults to OPEN_PRODUCTION when activityType is null or unrecognized.
 */
export function derivePromptType(activityType: ActivityType | null): PromptType {
  if (activityType === null) return PromptType.OPEN_PRODUCTION;
  switch (activityType) {
    case ActivityType.LISTEN_AND_POINT:
      return PromptType.LISTEN_ONLY;
    case ActivityType.REPEAT_AFTER_ME:
      return PromptType.REPEAT_AFTER_ME;
    case ActivityType.FORCED_CHOICE_2:
    case ActivityType.FORCED_CHOICE_4:
      return PromptType.FORCED_CHOICE;
    default:
      return PromptType.OPEN_PRODUCTION;
  }
}

/** Builds an ActivityContext from session memory for the current turn. */
export function buildActivityContext(sessionMemory: SessionMemory): ActivityContext {
  const currentActivity = sessionMemory.currentActivityId ?? ActivityType.LISTEN_AND_POINT;
  const itemState = sessionMemory.currentTargetItemId
    ? sessionMemory.itemState.get(sessionMemory.currentTargetItemId)
    : undefined;

  return {
    activityId: currentActivity,
    currentTargetItemId: sessionMemory.currentTargetItemId,
    attemptNumber: sessionMemory.currentItemAttemptCount,
    modelWasGiven: itemState?.modelGiven ?? false,
    promptType: derivePromptType(sessionMemory.currentActivityId),
  };
}

/** Builds a PromptContext for the perception layer. */
export function buildPromptContext(
  sessionMemory: SessionMemory,
  targetWord: string | null,
): PromptContext {
  return {
    promptType: derivePromptType(sessionMemory.currentActivityId),
    targetItem: targetWord,
    activityType: sessionMemory.currentActivityId,
  };
}

/** Builds a ChildStateSnapshot for the perception layer from the current session state. */
export function buildChildStateSnapshot(sessionMemory: SessionMemory): ChildStateSnapshot {
  const cs = sessionMemory.childState;
  return {
    comprehensionConfidence: cs.comprehensionConfidence,
    productionConfidence: cs.productionConfidence,
    emotionalSafety: cs.emotionalSafety,
    frustrationRisk: cs.frustrationRisk,
    recentSuccessCount: cs.recentSuccessCount,
    recentFailureCount: cs.recentFailureCount,
  };
}

/**
 * Builds a CurrentItemContext for the learning engine.
 * Phase 7: no persistence — masteryRecord is always null.
 */
export function buildCurrentItemContext(sessionMemory: SessionMemory): CurrentItemContext {
  return {
    itemId: sessionMemory.currentTargetItemId ?? 'unknown',
    masteryRecord: null,
    isReviewDue: false,
  };
}

/**
 * Builds the list of available items for the learning engine.
 * Phase 7: no persistence — all masteryRecords are null.
 */
export function buildAvailableItems(
  lessonTargetWords: string[],
  currentItemId: string | null,
): AvailableItem[] {
  const words = lessonTargetWords.length > 0 ? lessonTargetWords : [currentItemId ?? 'unknown'];
  return words.map(word => ({
    itemId: word,
    masteryRecord: null,
    isCurrentItem: word === currentItemId,
  }));
}

/** Returns all ActivityTypes available for the learning engine to select from. */
export function buildAvailableActivities(): ActivityType[] {
  return ALL_ACTIVITIES;
}

/**
 * Derives the appropriate scaffold level from the learning decision difficulty delta
 * and the current recovery state.
 * 1 = minimal scaffolding, 6 = maximum (L1 anchor, only if budget allows).
 */
export function deriveScaffoldLevel(
  difficultyDelta: number,
  recoveryState: RecoveryState,
): 1 | 2 | 3 | 4 | 5 | 6 {
  if (
    recoveryState === RecoveryState.EMOTIONAL_SHUTDOWN ||
    recoveryState === RecoveryState.REFUSAL
  ) {
    return 5;
  }
  if (recoveryState === RecoveryState.REPEATED_FAILURE) {
    return 4;
  }
  if (recoveryState === RecoveryState.FRUSTRATION_RISK) {
    return 3;
  }
  if (difficultyDelta <= -2) return 3;
  if (difficultyDelta === -1) return 2;
  return 1;
}

/**
 * Builds the TeacherResponseContext for the Teacher Response Engine.
 *
 * Uses the updated session memory (post-state-engine) and the actual classification label
 * from this turn to ensure the response context reflects the current turn's state.
 */
export function buildTeacherResponseContext(
  input: KidsBrainTurnInput,
  updatedSessionMemory: SessionMemory,
  difficultyDelta: number,
  classificationLabel: ClassificationLabel,
): TeacherResponseContext {
  const activityContext: ActivityContext = buildActivityContext(updatedSessionMemory);

  return {
    targetWord: input.targetWord,
    childFirstName: input.childFirstName ?? 'friend',
    ageBand: updatedSessionMemory.ageBand,
    activityContext,
    lessonTargetWords: input.lessonTargetWords,
    unitReviewWords: input.unitReviewWords,
    characterNames: input.characterNames,
    forcedChoiceOptionA: input.forcedChoiceOptionA,
    forcedChoiceOptionB: input.forcedChoiceOptionB,
    l1BudgetUsed: updatedSessionMemory.l1BudgetUsed,
    scaffoldLevel: deriveScaffoldLevel(difficultyDelta, updatedSessionMemory.recoveryState),
    recoveryState: updatedSessionMemory.recoveryState,
    classificationLabel,
    currentActivityType: updatedSessionMemory.currentActivityId ?? ActivityType.LISTEN_AND_POINT,
  };
}
