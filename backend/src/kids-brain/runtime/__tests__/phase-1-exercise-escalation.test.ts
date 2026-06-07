/**
 * Phase 1 — Escalation Ladder Tests.
 *
 * Proves:
 *  A. getEscalationTier maps attempt index to ladder rung
 *  B. getEscalationTier clamps beyond ladder length to last rung
 *  C. getEscalationTier returns null for empty ladder
 *  D. buildEscalationTeacherText REPEAT_PROMPT includes target word
 *  E. buildEscalationTeacherText MODEL_ANSWER includes firstPhoneme scaffold
 *  F. buildEscalationTeacherText MODEL_ANSWER falls back gracefully with no phoneme
 *  G. buildEscalationTeacherText ENCOURAGEMENT includes target word
 *  H. buildEscalationTeacherText MOVE_ON returns move-on text
 *  I. buildEscalationTeacherText SIMPLIFY_CHOICES uses choice list
 *  J. resolveItemFirstPhoneme returns correct phoneme for vocabulary item
 *  K. resolveItemFirstPhoneme returns null for unknown item
 *  L. shouldCompleteExercise returns true when MOVE_ON tier reached
 *  M. shouldCompleteExercise MOVE_ON fires regardless of classification label
 *  N. shouldCompleteExercise completes normally before MOVE_ON tier
 */

import { describe, it, expect } from 'vitest';
import {
  getEscalationTier,
  buildEscalationTeacherText,
  resolveItemFirstPhoneme,
  shouldCompleteExercise,
} from '../exercise-runner.js';
import {
  KidsRetryEscalationType,
  KidsCompletionRuleType,
  KidsTextbookActivityType,
  KidsStudentActionType,
  KidsCurriculumItemType,
} from '../../curriculum/curriculum-types.js';
import type { KidsExerciseDefinition } from '../../curriculum/curriculum-types.js';
import type { SessionMemory } from '../../contracts/session-memory.js';
import { ClassificationLabel, AgeBand, ActivityType } from '../../shared/enums.js';
import { AGE_PROFILE_6_7 } from '../../shared/types.js';
import { findLessonById } from '../../curriculum/curriculum-loader.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const FULL_LADDER = [
  KidsRetryEscalationType.REPEAT_PROMPT,
  KidsRetryEscalationType.MODEL_ANSWER,
  KidsRetryEscalationType.ENCOURAGEMENT,
  KidsRetryEscalationType.MOVE_ON,
];

function makeExercise(ladder: KidsRetryEscalationType[], maxAttempts = 4): KidsExerciseDefinition {
  return {
    exerciseId: 'test-ex',
    lessonId: 'test-lesson',
    order: 2,
    pageRef: 'PB p.1',
    textbookActivityType: KidsTextbookActivityType.LISTEN_AND_REPEAT,
    studentActionType: KidsStudentActionType.REPEAT_WORD,
    targetItemIds: ['KB1-U01-COL-001'],
    teacherInstruction: 'Say blue!',
    prompt: { text: 'Say it!', ttsText: 'Say blue!' },
    choices: [],
    expectedAnswers: ['blue'],
    completionRule: {
      type: KidsCompletionRuleType.CORRECT_REPETITIONS,
      requiredCorrectCount: 2,
      allowPartialCompletion: false,
    },
    retryPolicy: { maxAttempts, escalationLadder: ladder, fallbackExerciseId: null, resetOnCorrect: true },
    nextExerciseId: null,
    requiresVisualUI: false,
    allowedWithoutVisualUI: true,
    tags: [],
  };
}

function makeMemory(attemptCount: number, correctCount: number): SessionMemory {
  return {
    sessionId: 'test-session',
    userId: 'test-user',
    childId: 'test-child',
    ageBand: AgeBand.SIX_SEVEN,
    ageProfile: AGE_PROFILE_6_7,
    turnNumber: 1,
    currentActivityId: ActivityType.LISTEN_AND_POINT,
    currentTargetItemId: 'blue',
    currentItemAttemptCount: attemptCount,
    currentItemCorrectCount: correctCount,
    masteredItemIds: [],
    reviewItemIds: [],
    recentTurns: [],
    recentPraisePhrases: [],
    engagementScore: 0.7,
    confidenceScore: 0.5,
    lessonId: 'kb1-u01-l02',
    currentExerciseId: 'test-ex',
    currentExerciseOrder: 2,
    exerciseAttemptCount: attemptCount,
    exerciseCorrectCount: correctCount,
    completedExerciseIds: [],
    hasStartedFirstExercise: true,
  };
}

// ── A. getEscalationTier maps attempt index ────────────────────────────────────

describe('A — getEscalationTier maps attempt index to ladder rung', () => {
  it('attempt 0 → REPEAT_PROMPT', () => {
    const ex = makeExercise(FULL_LADDER);
    expect(getEscalationTier(ex, 0)).toBe(KidsRetryEscalationType.REPEAT_PROMPT);
  });
  it('attempt 1 → MODEL_ANSWER', () => {
    const ex = makeExercise(FULL_LADDER);
    expect(getEscalationTier(ex, 1)).toBe(KidsRetryEscalationType.MODEL_ANSWER);
  });
  it('attempt 2 → ENCOURAGEMENT', () => {
    const ex = makeExercise(FULL_LADDER);
    expect(getEscalationTier(ex, 2)).toBe(KidsRetryEscalationType.ENCOURAGEMENT);
  });
  it('attempt 3 → MOVE_ON', () => {
    const ex = makeExercise(FULL_LADDER);
    expect(getEscalationTier(ex, 3)).toBe(KidsRetryEscalationType.MOVE_ON);
  });
});

// ── B. Clamps beyond ladder length ────────────────────────────────────────────

describe('B — getEscalationTier clamps beyond ladder length', () => {
  it('attempt 5 on 4-rung ladder → MOVE_ON (last rung)', () => {
    const ex = makeExercise(FULL_LADDER);
    expect(getEscalationTier(ex, 5)).toBe(KidsRetryEscalationType.MOVE_ON);
  });
  it('attempt 10 on 4-rung ladder → MOVE_ON', () => {
    const ex = makeExercise(FULL_LADDER);
    expect(getEscalationTier(ex, 10)).toBe(KidsRetryEscalationType.MOVE_ON);
  });
});

// ── C. Empty ladder ───────────────────────────────────────────────────────────

describe('C — getEscalationTier returns null for empty ladder', () => {
  it('empty ladder returns null', () => {
    const ex = makeExercise([]);
    expect(getEscalationTier(ex, 0)).toBeNull();
  });
});

// ── D. REPEAT_PROMPT teacher text ────────────────────────────────────────────

describe('D — buildEscalationTeacherText REPEAT_PROMPT includes target word', () => {
  it('contains the target word', () => {
    const text = buildEscalationTeacherText(KidsRetryEscalationType.REPEAT_PROMPT, 'blue', 'b-b-b');
    expect(text).not.toBeNull();
    expect(text!.toLowerCase()).toContain('blue');
  });
});

// ── E. MODEL_ANSWER includes firstPhoneme scaffold ────────────────────────────

describe('E — buildEscalationTeacherText MODEL_ANSWER includes firstPhoneme', () => {
  it('contains phoneme scaffold and target word', () => {
    const text = buildEscalationTeacherText(KidsRetryEscalationType.MODEL_ANSWER, 'blue', 'b-b-b');
    expect(text).not.toBeNull();
    expect(text!).toContain('b-b-b');
    expect(text!.toLowerCase()).toContain('blue');
  });
});

// ── F. MODEL_ANSWER fallback without phoneme ──────────────────────────────────

describe('F — buildEscalationTeacherText MODEL_ANSWER falls back gracefully without phoneme', () => {
  it('returns non-null text without phoneme', () => {
    const text = buildEscalationTeacherText(KidsRetryEscalationType.MODEL_ANSWER, 'blue', null);
    expect(text).not.toBeNull();
    expect(text!.toLowerCase()).toContain('blue');
    expect(text!).not.toContain('undefined');
  });
});

// ── G. ENCOURAGEMENT includes target word ────────────────────────────────────

describe('G — buildEscalationTeacherText ENCOURAGEMENT', () => {
  it('contains the target word', () => {
    const text = buildEscalationTeacherText(KidsRetryEscalationType.ENCOURAGEMENT, 'blue', null);
    expect(text).not.toBeNull();
    expect(text!.toLowerCase()).toContain('blue');
  });
});

// ── H. MOVE_ON teacher text ───────────────────────────────────────────────────

describe('H — buildEscalationTeacherText MOVE_ON', () => {
  it('returns move-on text', () => {
    const text = buildEscalationTeacherText(KidsRetryEscalationType.MOVE_ON, 'blue', null);
    expect(text).not.toBeNull();
    expect(text!.toLowerCase()).toMatch(/move on|let.s move/);
  });
});

// ── I. SIMPLIFY_CHOICES uses choice list ──────────────────────────────────────

describe('I — buildEscalationTeacherText SIMPLIFY_CHOICES', () => {
  it('includes choice words when provided', () => {
    const text = buildEscalationTeacherText(
      KidsRetryEscalationType.SIMPLIFY_CHOICES,
      'blue',
      null,
      ['blue', 'green'],
    );
    expect(text).not.toBeNull();
    expect(text!.toLowerCase()).toContain('blue');
    expect(text!.toLowerCase()).toContain('green');
  });
});

// ── J. resolveItemFirstPhoneme returns correct phoneme ────────────────────────

describe('J — resolveItemFirstPhoneme returns correct phoneme', () => {
  it('KB1-U01-COL-001 (blue) → b-b-b', () => {
    const lesson = findLessonById('kb1-u01-l02')!;
    expect(resolveItemFirstPhoneme(lesson, 'KB1-U01-COL-001')).toBe('b-b-b');
  });
  it('KB1-U01-COL-003 (pink) → p-p-p', () => {
    const lesson = findLessonById('kb1-u01-l02')!;
    expect(resolveItemFirstPhoneme(lesson, 'KB1-U01-COL-003')).toBe('p-p-p');
  });
  it('KB1-U01-COL-005 (orange) → o-o-o', () => {
    const lesson = findLessonById('kb1-u01-l02')!;
    expect(resolveItemFirstPhoneme(lesson, 'KB1-U01-COL-005')).toBe('o-o-o');
  });
});

// ── K. resolveItemFirstPhoneme returns null for unknown item ──────────────────

describe('K — resolveItemFirstPhoneme null for unknown item', () => {
  it('returns null for non-existent item', () => {
    const lesson = findLessonById('kb1-u01-l02')!;
    expect(resolveItemFirstPhoneme(lesson, 'KB1-DOES-NOT-EXIST')).toBeNull();
  });
});

// ── L. shouldCompleteExercise returns true at MOVE_ON tier ───────────────────

describe('L — shouldCompleteExercise MOVE_ON forced advance', () => {
  it('returns true at attempt 3 (MOVE_ON rung) even with wrong answer', () => {
    const ex = makeExercise(FULL_LADDER);
    const mem = makeMemory(3, 0); // 3 wrong attempts, MOVE_ON rung
    expect(shouldCompleteExercise(ex, mem, ClassificationLabel.WRONG_WORD)).toBe(true);
  });
  it('returns true at attempt 3 with silence', () => {
    const ex = makeExercise(FULL_LADDER);
    const mem = makeMemory(3, 0);
    expect(shouldCompleteExercise(ex, mem, ClassificationLabel.SILENCE_LONG)).toBe(true);
  });
});

// ── M. MOVE_ON regardless of label ───────────────────────────────────────────

describe('M — MOVE_ON fires for any classification label at MOVE_ON rung', () => {
  it.each([
    ClassificationLabel.SILENCE_SHORT,
    ClassificationLabel.SILENCE_MEDIUM,
    ClassificationLabel.WRONG_WORD,
    ClassificationLabel.L1_DETECTED,
    ClassificationLabel.NOISE_ONLY,
  ])('label %s at attempt 3 → forced completion', (label) => {
    const ex = makeExercise(FULL_LADDER);
    const mem = makeMemory(3, 0);
    expect(shouldCompleteExercise(ex, mem, label)).toBe(true);
  });
});

// ── N. Normal completion before MOVE_ON ──────────────────────────────────────

describe('N — normal completion before MOVE_ON tier', () => {
  it('2 correct answers completes CORRECT_REPETITIONS exercise at attempt 1', () => {
    const ex = makeExercise(FULL_LADDER);
    const mem = makeMemory(1, 1); // 1 correct so far, 1 attempt
    expect(shouldCompleteExercise(ex, mem, ClassificationLabel.CORRECT_CONFIDENT)).toBe(true);
  });
  it('1 correct answer does not complete when requiredCorrectCount=2', () => {
    const ex = makeExercise(FULL_LADDER);
    const mem = makeMemory(0, 0); // first attempt
    expect(shouldCompleteExercise(ex, mem, ClassificationLabel.CORRECT_CONFIDENT)).toBe(false);
  });
  it('wrong answer at attempt 0 does not complete', () => {
    const ex = makeExercise(FULL_LADDER);
    const mem = makeMemory(0, 0);
    expect(shouldCompleteExercise(ex, mem, ClassificationLabel.WRONG_WORD)).toBe(false);
  });
  it('wrong answer at attempt 2 (ENCOURAGEMENT) does not complete', () => {
    const ex = makeExercise(FULL_LADDER);
    const mem = makeMemory(2, 0);
    expect(shouldCompleteExercise(ex, mem, ClassificationLabel.WRONG_WORD)).toBe(false);
  });
});
