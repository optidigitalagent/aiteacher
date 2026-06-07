/**
 * Phase 13D — Exercise Runtime Bridge helpers.
 *
 * Pure functions that map curriculum exercise definitions to runtime state
 * transitions.  No LLM calls, no persistence, no side effects.
 */

import type {
  KidsCurriculumLesson,
  KidsExerciseDefinition,
  KidsVocabularyItem,
} from '../curriculum/curriculum-types.js';
import {
  KidsCompletionRuleType,
  KidsCurriculumItemType,
  KidsRetryEscalationType,
  KidsStudentActionType,
} from '../curriculum/curriculum-types.js';
import type { SessionMemory } from '../contracts/session-memory.js';
import { ClassificationLabel } from '../shared/enums.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

export function isCorrectLabel(label: ClassificationLabel): boolean {
  return (
    label === ClassificationLabel.CORRECT_CONFIDENT ||
    label === ClassificationLabel.CORRECT_HESITANT ||
    label === ClassificationLabel.NEAR_CORRECT ||
    label === ClassificationLabel.PRONUNCIATION_VARIANT ||
    label === ClassificationLabel.REPEATED_AFTER_MODEL
  );
}

/**
 * Returns true if this exercise is a listen-only TEACHER_CONTROLLED readiness
 * exercise (order 1) that must be silently advanced when the session has already
 * confirmed the child is ready (hasStartedFirstExercise=true).
 *
 * This guard prevents the readiness exercise from overriding target advances
 * produced by the learning engine (e.g. R22) in sessions that bypassed the
 * readiness handshake path (e.g. manually elevated test sessions).
 */
function isListenOnlyReadinessExercise(exercise: KidsExerciseDefinition): boolean {
  return (
    exercise.order === 1 &&
    exercise.studentActionType === KidsStudentActionType.LISTEN_ONLY &&
    exercise.completionRule.type === KidsCompletionRuleType.TEACHER_CONTROLLED
  );
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns the exercise currently active in the session, or null if none.
 */
export function getCurrentExercise(
  memory: SessionMemory,
  lesson: KidsCurriculumLesson,
): KidsExerciseDefinition | null {
  if (!memory.currentExerciseId || !lesson.exercises?.length) return null;
  return lesson.exercises.find(e => e.exerciseId === memory.currentExerciseId) ?? null;
}

/**
 * Returns the next exercise in the authored sequence, or null when the lesson
 * is exhausted.
 */
export function getNextExercise(
  currentExercise: KidsExerciseDefinition,
  lesson: KidsCurriculumLesson,
): KidsExerciseDefinition | null {
  if (!currentExercise.nextExerciseId || !lesson.exercises?.length) return null;
  return lesson.exercises.find(e => e.exerciseId === currentExercise.nextExerciseId) ?? null;
}

/**
 * Evaluates whether the completion rule for the exercise has been satisfied
 * given the current memory state and this turn's classification label.
 *
 * Does NOT mutate memory — returns a boolean only.
 */
export function shouldCompleteExercise(
  exercise: KidsExerciseDefinition,
  memory: SessionMemory,
  classificationLabel: ClassificationLabel,
): boolean {
  const { completionRule, retryPolicy } = exercise;
  const attemptCount = memory.exerciseAttemptCount ?? 0;
  const correctCount = memory.exerciseCorrectCount ?? 0;
  const isCorrect = isCorrectLabel(classificationLabel);

  switch (completionRule.type) {
    case KidsCompletionRuleType.CORRECT_REPETITIONS:
    case KidsCompletionRuleType.CORRECT_CHOICE: {
      const required = completionRule.requiredCorrectCount ?? 1;
      if (isCorrect && (correctCount + 1) >= required) return true;
      // MOVE_ON tier forces advance when the escalation ladder is exhausted.
      return getEscalationTier(exercise, attemptCount) === KidsRetryEscalationType.MOVE_ON;
    }
    case KidsCompletionRuleType.TEACHER_CONTROLLED:
    case KidsCompletionRuleType.TIME_OR_TURN_LIMIT:
    case KidsCompletionRuleType.ALL_TARGETS_COMPLETED:
      // Auto-advance after maxAttempts turns regardless of correctness.
      return (attemptCount + 1) >= retryPolicy.maxAttempts;
    default:
      return false;
  }
}

/**
 * Returns the escalation tier for the given attempt count, clamped to the last
 * rung of the ladder.  Returns null when the ladder is empty.
 */
export function getEscalationTier(
  exercise: KidsExerciseDefinition,
  attemptCount: number,
): KidsRetryEscalationType | null {
  const ladder = exercise.retryPolicy.escalationLadder;
  if (!ladder.length) return null;
  const index = Math.min(attemptCount, ladder.length - 1);
  return ladder[index] ?? null;
}

/**
 * Builds a TTS-ready teacher scaffold text for the given escalation tier.
 * Returns null when no special text is needed (caller should use default prompt).
 */
export function buildEscalationTeacherText(
  tier: KidsRetryEscalationType,
  targetWord: string | null,
  firstPhoneme: string | null,
  choices?: string[],
): string | null {
  const word = targetWord ?? '…';
  switch (tier) {
    case KidsRetryEscalationType.REPEAT_PROMPT:
      return `Let's try again! Can you say ${word}?`;
    case KidsRetryEscalationType.MODEL_ANSWER:
      return firstPhoneme
        ? `Listen carefully! ${firstPhoneme}… ${word}! Can you say ${word}?`
        : `Listen — ${word}! Can you say it?`;
    case KidsRetryEscalationType.ENCOURAGEMENT:
      return `You can do it! Try one more time — ${word}!`;
    case KidsRetryEscalationType.SIMPLIFY_CHOICES:
      return choices?.length
        ? `Listen carefully — is it ${choices.join(' or ')}?`
        : `Let's try a simpler version. Can you say ${word}?`;
    case KidsRetryEscalationType.MOVE_ON:
      return `Well done for trying! Let's move on.`;
    default:
      return null;
  }
}

/**
 * Resolves a curriculum item ID to its firstPhoneme scaffold string.
 * Returns null when the item is not found or is not a vocabulary item.
 */
export function resolveItemFirstPhoneme(
  lesson: KidsCurriculumLesson,
  itemId: string,
): string | null {
  const item = lesson.items.find(i => i.itemId === itemId);
  if (!item || item.type !== KidsCurriculumItemType.VOCABULARY) return null;
  return (item as KidsVocabularyItem).firstPhoneme ?? null;
}

/**
 * Returns the TTS-ready teacher prompt text for the given exercise.
 */
export function buildExercisePrompt(exercise: KidsExerciseDefinition): string {
  return exercise.prompt.ttsText ?? exercise.prompt.text;
}

/**
 * Resolves a curriculum item ID (e.g. 'KB1-U01-COL-001') to its runtime
 * target text (e.g. 'blue').  Returns null if the item is not in the lesson.
 */
export function resolveItemTargetText(
  lesson: KidsCurriculumLesson,
  itemId: string,
): string | null {
  return lesson.items.find(i => i.itemId === itemId)?.targetText ?? null;
}

/**
 * Applies the exercise progression bridge to the session memory for one turn.
 *
 * Special case — listen-only readiness exercise (order 1, TEACHER_CONTROLLED):
 * When hasStartedFirstExercise is already true (child confirmed ready in a prior
 * turn, or session was elevated in tests), silently advance past it WITHOUT
 * overriding currentTargetItemId.  This preserves learning-engine target advances
 * (R22 etc.) that may have fired on the same turn.
 *
 * Normal case: evaluates the completion rule, advances the exercise on completion,
 * resets counters, and updates currentTargetItemId from the next exercise's first
 * target item.  Increments attempt/correct counters when the exercise is not done.
 */
export function applyExerciseBridge(
  memory: SessionMemory,
  classificationLabel: ClassificationLabel,
  lesson: KidsCurriculumLesson,
): SessionMemory {
  // Guard: exercise bridge only runs after the child has confirmed readiness.
  // Sessions that have never triggered the readiness handshake (hasStartedFirstExercise
  // is false or undefined) must not have their curriculum target overridden by the
  // exercise sequence.  The readiness path in turn-processor.ts sets
  // hasStartedFirstExercise=true before calling this function, so the bridge
  // correctly activates on that turn.
  if (!memory.hasStartedFirstExercise) return memory;

  const currentExercise = getCurrentExercise(memory, lesson);
  if (!currentExercise) return memory;

  // ── Silent readiness advance ──────────────────────────────────────────────
  // If hasStartedFirstExercise is true but the cursor still points to the
  // first listen-only exercise, advance it without touching currentTargetItemId.
  // This handles: (a) the readiness handshake turn (hasStartedFirstExercise is
  // set to true immediately before this function is called), and (b) elevated
  // test sessions where hasStartedFirstExercise=true was set manually without
  // going through the readiness handshake path.
  if (memory.hasStartedFirstExercise === true && isListenOnlyReadinessExercise(currentExercise)) {
    const nextExercise = getNextExercise(currentExercise, lesson);
    return {
      ...memory,
      completedExerciseIds: [
        ...(memory.completedExerciseIds ?? []),
        currentExercise.exerciseId,
      ],
      currentExerciseId: nextExercise?.exerciseId ?? null,
      currentExerciseOrder: nextExercise?.order ?? null,
      exerciseAttemptCount: 0,
      exerciseCorrectCount: 0,
      // currentTargetItemId intentionally NOT overridden: preserve learning engine result.
    };
  }

  // ── Normal completion check ───────────────────────────────────────────────
  const completed = shouldCompleteExercise(currentExercise, memory, classificationLabel);

  if (completed) {
    const nextExercise = getNextExercise(currentExercise, lesson);
    const nextTargetText = nextExercise?.targetItemIds[0]
      ? resolveItemTargetText(lesson, nextExercise.targetItemIds[0])
      : null;

    return {
      ...memory,
      completedExerciseIds: [
        ...(memory.completedExerciseIds ?? []),
        currentExercise.exerciseId,
      ],
      currentExerciseId: nextExercise?.exerciseId ?? null,
      currentExerciseOrder: nextExercise?.order ?? null,
      exerciseAttemptCount: 0,
      exerciseCorrectCount: 0,
      ...(nextTargetText !== null ? { currentTargetItemId: nextTargetText } : {}),
    };
  }

  // ── Increment counters ────────────────────────────────────────────────────
  const isCorrect = isCorrectLabel(classificationLabel);
  return {
    ...memory,
    exerciseAttemptCount: (memory.exerciseAttemptCount ?? 0) + 1,
    exerciseCorrectCount: isCorrect
      ? (memory.exerciseCorrectCount ?? 0) + 1
      : (memory.exerciseCorrectCount ?? 0),
  };
}
