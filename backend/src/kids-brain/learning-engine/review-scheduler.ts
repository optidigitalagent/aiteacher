import { ClassificationLabel, MasteryLevel } from '../shared/enums.js';
import type { LearningEngineInput, ReviewScheduleCandidate, ProgressionOutcome } from './learning-engine-types.js';
import {
  MS_PER_HOUR,
  MS_PER_DAY,
  REVIEW_DEVELOPING_HOURS,
  REVIEW_SECURE_DAYS,
  REVIEW_AUTOMATIC_DAYS,
  REVIEW_FAILED_EMERGING_HOURS,
  REVIEW_FAILED_DEVELOPING_HOURS,
  REVIEW_FAILED_SECURE_DAYS,
  REVIEW_FAILED_AUTOMATIC_DAYS,
  REVIEW_SAME_SESSION_GAP_MINUTES,
} from './learning-constants.js';

/**
 * Computes a review schedule candidate (Phase 5 — computed only, not persisted).
 *
 * Rules (spec §13.5, review-and-spacing-engine.yaml):
 * - l1_translation → schedule next_lesson_review for production gap
 * - near_correct / pronunciation_variant → pronunciation review
 * - correct after developing → same_session_review
 * - failed review → shorter interval
 * - don't overload same session with reviews (max 1 candidate per turn)
 */
export function computeReviewCandidate(
  input: LearningEngineInput,
  outcome: ProgressionOutcome,
): ReviewScheduleCandidate | null {
  const { classificationResult, currentItemContext, timestamp } = input;
  const label = classificationResult.label;
  const isTimeoutFallback = classificationResult.source === 'timeout_fallback';
  const masteryRecord = currentItemContext.masteryRecord;
  const itemId = currentItemContext.itemId;
  const nowMs = new Date(timestamp).getTime();

  // Timeout fallback: no review candidate
  if (isTimeoutFallback) return null;

  // L1 translation: schedule next_lesson_review for production gap (Patch 9)
  if (label === ClassificationLabel.L1_TRANSLATION || label === ClassificationLabel.L1_HELP_REQUEST) {
    return {
      itemId,
      reviewType: 'next_lesson_review',
      scheduledForMs: nowMs + REVIEW_DEVELOPING_HOURS * MS_PER_HOUR,
      priority: 1,
      reasons: ['L1 answer detected — production gap requires next-lesson review'],
    };
  }

  // Near correct / pronunciation variant: schedule pronunciation review
  if (
    label === ClassificationLabel.NEAR_CORRECT ||
    label === ClassificationLabel.PRONUNCIATION_VARIANT
  ) {
    const currentLevel = masteryRecord?.masteryLevel ?? MasteryLevel.EMERGING;
    return {
      itemId,
      reviewType: 'next_lesson_review',
      scheduledForMs: nowMs + REVIEW_DEVELOPING_HOURS * MS_PER_HOUR,
      priority: 2,
      reasons: [`Pronunciation/near-correct detected at level ${currentLevel}`],
    };
  }

  // Correct answer: schedule based on mastery level
  const isCorrect =
    label === ClassificationLabel.CORRECT_CONFIDENT ||
    label === ClassificationLabel.CORRECT_HESITANT;

  if (isCorrect && masteryRecord !== null) {
    const level = masteryRecord.masteryLevel;
    return buildCorrectReviewCandidate(itemId, level, nowMs);
  }

  // Failed correct (wrong, silence): shorten review interval
  const isWrong =
    label === ClassificationLabel.WRONG_SEMANTIC ||
    label === ClassificationLabel.WRONG_BUT_RELATED ||
    label === ClassificationLabel.RANDOM_NONSENSE ||
    label === ClassificationLabel.NO_RESPONSE ||
    label === ClassificationLabel.SILENCE_LONG;

  if (isWrong && masteryRecord !== null) {
    const level = masteryRecord.masteryLevel;
    return buildFailedReviewCandidate(itemId, level, nowMs);
  }

  // Same-session review for items in practice phase with basic mastery
  if (outcome.shouldAdvanceItem && masteryRecord !== null) {
    return {
      itemId,
      reviewType: 'same_session_review',
      scheduledForMs: nowMs + REVIEW_SAME_SESSION_GAP_MINUTES * 60 * 1000,
      priority: 3,
      reasons: ['Item advancing — schedule same-session consolidation review'],
    };
  }

  return null;
}

function buildCorrectReviewCandidate(
  itemId: string,
  level: MasteryLevel,
  nowMs: number,
): ReviewScheduleCandidate {
  switch (level) {
    case MasteryLevel.EMERGING:
      return {
        itemId,
        reviewType: 'same_session_review',
        scheduledForMs: nowMs + 4 * MS_PER_HOUR,
        priority: 3,
        reasons: ['Emerging mastery: schedule same-day review'],
      };

    case MasteryLevel.DEVELOPING:
      return {
        itemId,
        reviewType: 'next_lesson_review',
        scheduledForMs: nowMs + REVIEW_DEVELOPING_HOURS * MS_PER_HOUR,
        priority: 2,
        reasons: ['Developing mastery: schedule next-lesson review'],
      };

    case MasteryLevel.SECURE:
      return {
        itemId,
        reviewType: 'weekly_review',
        scheduledForMs: nowMs + REVIEW_SECURE_DAYS * MS_PER_DAY,
        priority: 4,
        reasons: ['Secure mastery: schedule 7-day spaced review'],
      };

    case MasteryLevel.AUTOMATIC:
      return {
        itemId,
        reviewType: 'weekly_review',
        scheduledForMs: nowMs + REVIEW_AUTOMATIC_DAYS * MS_PER_DAY,
        priority: 5,
        reasons: ['Automatic mastery: schedule 14-day spaced review'],
      };
  }
}

function buildFailedReviewCandidate(
  itemId: string,
  level: MasteryLevel,
  nowMs: number,
): ReviewScheduleCandidate {
  switch (level) {
    case MasteryLevel.EMERGING:
      return {
        itemId,
        reviewType: 'same_session_review',
        scheduledForMs: nowMs + REVIEW_FAILED_EMERGING_HOURS * MS_PER_HOUR,
        priority: 1,
        reasons: ['Failed at emerging: retry in same session if possible'],
      };

    case MasteryLevel.DEVELOPING:
      return {
        itemId,
        reviewType: 'same_session_review',
        scheduledForMs: nowMs + REVIEW_FAILED_DEVELOPING_HOURS * MS_PER_HOUR,
        priority: 1,
        reasons: ['Failed at developing: retry soon'],
      };

    case MasteryLevel.SECURE:
      return {
        itemId,
        reviewType: 'next_lesson_review',
        scheduledForMs: nowMs + REVIEW_FAILED_SECURE_DAYS * MS_PER_DAY,
        priority: 1,
        reasons: ['Review failure at secure: shorten to 2-day interval, flag mastery check'],
      };

    case MasteryLevel.AUTOMATIC:
      return {
        itemId,
        reviewType: 'next_lesson_review',
        scheduledForMs: nowMs + REVIEW_FAILED_AUTOMATIC_DAYS * MS_PER_DAY,
        priority: 1,
        reasons: ['Review failure at automatic: shorten to 7-day interval, flag mastery check'],
      };
  }
}
