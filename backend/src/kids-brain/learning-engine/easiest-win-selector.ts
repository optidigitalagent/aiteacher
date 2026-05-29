import { ActivityType, MasteryLevel } from '../shared/enums.js';
import type { LearningEngineInput, EasiestWinResult, AvailableItem } from './learning-engine-types.js';
import { EASIEST_WIN_MASTERED_LEVELS } from './learning-constants.js';

/**
 * Selects the easiest possible win item and activity (spec §9.3, Patch 8).
 *
 * Priority:
 * 1. Items with mastery_level = secure or automatic → forced_choice_2 or repeat_after_me
 * 2. Cold-start (no mastered items): use current item at forced_choice_2 (attempt 1)
 * 3. Cold-start attempt 2: repeat_after_me with teacher model x3
 * 4. Cold-start attempt 3: scripted floor — teacher provides answer, accepts echo
 */
export function selectEasiestWin(
  input: LearningEngineInput,
  trigger: string,
): EasiestWinResult {
  const { availableItems, currentItemContext } = input;

  const masteredItems = availableItems.filter(
    (item) =>
      !item.isCurrentItem &&
      item.masteryRecord !== null &&
      EASIEST_WIN_MASTERED_LEVELS.includes(item.masteryRecord.masteryLevel),
  );

  if (masteredItems.length > 0) {
    // Normal protocol: pick the item with the highest mastery confidence
    const best = pickBestMasteredItem(masteredItems);
    return {
      itemId: best.itemId,
      activityType: ActivityType.FORCED_CHOICE_2,
      isColdStart: false,
      coldStartLevel: 1,
      stayOnCurrentItem: false,
    };
  }

  // Cold-start fallback (Patch 8): no items at secure/automatic
  return buildColdStartResult(input, trigger);
}

function pickBestMasteredItem(items: AvailableItem[]): AvailableItem {
  return items.reduce((best, item) => {
    const bestConf = best.masteryRecord?.productionConfidence ?? 0;
    const itemConf = item.masteryRecord?.productionConfidence ?? 0;
    return itemConf > bestConf ? item : best;
  });
}

function buildColdStartResult(
  input: LearningEngineInput,
  _trigger: string,
): EasiestWinResult {
  const { currentItemContext, availableItems } = input;
  const updatedMemory = input.stateEngineOutput.updatedSessionMemory;

  // Determine cold-start level from item attempt count this session
  const currentItemState = updatedMemory.itemState.get(currentItemContext.itemId);
  const attemptCount = currentItemState?.attemptCount ?? 0;

  // Find simplest phonological item from available items (fewest attempts = freshest)
  const candidates = availableItems.filter((i) => !i.isCurrentItem);
  const simplest = candidates.length > 0
    ? candidates.reduce((a, b) => {
        const aAttempts = updatedMemory.itemState.get(a.itemId)?.attemptCount ?? 0;
        const bAttempts = updatedMemory.itemState.get(b.itemId)?.attemptCount ?? 0;
        return aAttempts <= bAttempts ? a : b;
      })
    : null;

  if (attemptCount === 0) {
    // Level 1: forced_choice_2 with target item vs clearly unrelated
    return {
      itemId: simplest?.itemId ?? currentItemContext.itemId,
      activityType: ActivityType.FORCED_CHOICE_2,
      isColdStart: true,
      coldStartLevel: 1,
      stayOnCurrentItem: simplest === null,
    };
  }

  if (attemptCount === 1) {
    // Level 2: repeat_after_me on simplest phonological item
    return {
      itemId: simplest?.itemId ?? currentItemContext.itemId,
      activityType: ActivityType.REPEAT_AFTER_ME,
      isColdStart: true,
      coldStartLevel: 2,
      stayOnCurrentItem: simplest === null,
    };
  }

  // Level 3: scripted floor — teacher provides answer, accepts echo
  // Activity is still repeat_after_me but teacher models x3 (template handles this)
  return {
    itemId: currentItemContext.itemId,
    activityType: ActivityType.REPEAT_AFTER_ME,
    isColdStart: true,
    coldStartLevel: 3,
    stayOnCurrentItem: true,
  };
}

/** Checks if any mastered items (secure/automatic) are available in this session. */
export function hasMasteredItems(input: LearningEngineInput): boolean {
  return input.availableItems.some(
    (item) =>
      !item.isCurrentItem &&
      item.masteryRecord !== null &&
      EASIEST_WIN_MASTERED_LEVELS.includes(item.masteryRecord.masteryLevel),
  );
}

/** Checks whether the mastery level qualifies as "mastered" for easiest win. */
export function isMasteredForEasiestWin(level: MasteryLevel): boolean {
  return level === MasteryLevel.SECURE || level === MasteryLevel.AUTOMATIC;
}
