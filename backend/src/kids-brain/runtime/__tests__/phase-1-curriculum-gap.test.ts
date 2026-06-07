/**
 * Phase 1 — Curriculum Gap Tests.
 *
 * Proves that pink, purple, and orange now have Listen & Repeat exercises
 * in Lesson 2, and that the exercise chain is correctly stitched.
 *
 * A. Pink L&R exercise exists with correct properties
 * B. Purple L&R exercise exists with correct properties
 * C. Orange L&R exercise exists with correct properties
 * D. Yellow → pink → purple → orange → choose-pair-1 chain is valid
 * E. choose-pair-2 → choose-pair-3 (red vs orange) → review chain is valid
 * F. New exercises have CORRECT_REPETITIONS completion rule
 * G. New exercises have escalation ladder with MOVE_ON as last rung
 * H. Orders are sequential (no gaps or duplicates)
 * I. All exercise IDs in the lesson are unique
 * J. ex-10-close has order 14
 */

import { describe, it, expect } from 'vitest';
import { findLessonById } from '../../curriculum/curriculum-loader.js';
import {
  KidsTextbookActivityType,
  KidsStudentActionType,
  KidsCompletionRuleType,
  KidsRetryEscalationType,
} from '../../curriculum/curriculum-types.js';

const LESSON_ID = 'kb1-u01-l02';

function getLesson() {
  const lesson = findLessonById(LESSON_ID);
  if (!lesson) throw new Error(`Lesson ${LESSON_ID} not found`);
  return lesson;
}

describe('A — pink Listen & Repeat exists', () => {
  it('pink L&R exercise is present and correct', () => {
    const lesson = getLesson();
    const ex = lesson.exercises?.find(e => e.exerciseId === 'kb1-u01-l02-ex-06b-pink');
    expect(ex).toBeDefined();
    expect(ex!.textbookActivityType).toBe(KidsTextbookActivityType.LISTEN_AND_REPEAT);
    expect(ex!.studentActionType).toBe(KidsStudentActionType.REPEAT_WORD);
    expect(ex!.targetItemIds).toContain('KB1-U01-COL-003');
    expect(ex!.expectedAnswers).toContain('pink');
  });
});

describe('B — purple Listen & Repeat exists', () => {
  it('purple L&R exercise is present and correct', () => {
    const lesson = getLesson();
    const ex = lesson.exercises?.find(e => e.exerciseId === 'kb1-u01-l02-ex-07b-purple');
    expect(ex).toBeDefined();
    expect(ex!.textbookActivityType).toBe(KidsTextbookActivityType.LISTEN_AND_REPEAT);
    expect(ex!.targetItemIds).toContain('KB1-U01-COL-004');
    expect(ex!.expectedAnswers).toContain('purple');
  });
});

describe('C — orange Listen & Repeat exists', () => {
  it('orange L&R exercise is present and correct', () => {
    const lesson = getLesson();
    const ex = lesson.exercises?.find(e => e.exerciseId === 'kb1-u01-l02-ex-08b-orange');
    expect(ex).toBeDefined();
    expect(ex!.textbookActivityType).toBe(KidsTextbookActivityType.LISTEN_AND_REPEAT);
    expect(ex!.targetItemIds).toContain('KB1-U01-COL-005');
    expect(ex!.expectedAnswers).toContain('orange');
  });
});

describe('D — yellow → pink → purple → orange → choose-pair-1 chain', () => {
  it('yellow nextExerciseId points to pink', () => {
    const lesson = getLesson();
    const yellow = lesson.exercises?.find(e => e.exerciseId === 'kb1-u01-l02-ex-05-yellow');
    expect(yellow?.nextExerciseId).toBe('kb1-u01-l02-ex-06b-pink');
  });
  it('pink nextExerciseId points to purple', () => {
    const lesson = getLesson();
    const pink = lesson.exercises?.find(e => e.exerciseId === 'kb1-u01-l02-ex-06b-pink');
    expect(pink?.nextExerciseId).toBe('kb1-u01-l02-ex-07b-purple');
  });
  it('purple nextExerciseId points to orange', () => {
    const lesson = getLesson();
    const purple = lesson.exercises?.find(e => e.exerciseId === 'kb1-u01-l02-ex-07b-purple');
    expect(purple?.nextExerciseId).toBe('kb1-u01-l02-ex-08b-orange');
  });
  it('orange nextExerciseId points to choose-pair-1', () => {
    const lesson = getLesson();
    const orange = lesson.exercises?.find(e => e.exerciseId === 'kb1-u01-l02-ex-08b-orange');
    expect(orange?.nextExerciseId).toBe('kb1-u01-l02-ex-06-choose-pair-1');
  });
});

describe('E — choose-pair-2 → choose-pair-3 (red/orange) → review chain', () => {
  it('choose-pair-2 nextExerciseId points to choose-pair-3', () => {
    const lesson = getLesson();
    const cp2 = lesson.exercises?.find(e => e.exerciseId === 'kb1-u01-l02-ex-07-choose-pair-2');
    expect(cp2?.nextExerciseId).toBe('kb1-u01-l02-ex-09b-choose-pair-3');
  });
  it('choose-pair-3 has red and orange choices', () => {
    const lesson = getLesson();
    const cp3 = lesson.exercises?.find(e => e.exerciseId === 'kb1-u01-l02-ex-09b-choose-pair-3');
    expect(cp3).toBeDefined();
    const choiceTexts = cp3!.choices.map(c => c.text);
    expect(choiceTexts).toContain('red');
    expect(choiceTexts).toContain('orange');
  });
  it('choose-pair-3 nextExerciseId points to review', () => {
    const lesson = getLesson();
    const cp3 = lesson.exercises?.find(e => e.exerciseId === 'kb1-u01-l02-ex-09b-choose-pair-3');
    expect(cp3?.nextExerciseId).toBe('kb1-u01-l02-ex-08-say-review');
  });
});

describe('F — new exercises have CORRECT_REPETITIONS completion rule', () => {
  it.each(['kb1-u01-l02-ex-06b-pink', 'kb1-u01-l02-ex-07b-purple', 'kb1-u01-l02-ex-08b-orange'])(
    '%s has CORRECT_REPETITIONS with requiredCorrectCount 2',
    (exId) => {
      const lesson = getLesson();
      const ex = lesson.exercises?.find(e => e.exerciseId === exId)!;
      expect(ex.completionRule.type).toBe(KidsCompletionRuleType.CORRECT_REPETITIONS);
      expect(ex.completionRule.requiredCorrectCount).toBe(2);
    },
  );
});

describe('G — new exercises have MOVE_ON as last escalation rung', () => {
  it.each(['kb1-u01-l02-ex-06b-pink', 'kb1-u01-l02-ex-07b-purple', 'kb1-u01-l02-ex-08b-orange'])(
    '%s escalation ladder ends with MOVE_ON',
    (exId) => {
      const lesson = getLesson();
      const ex = lesson.exercises?.find(e => e.exerciseId === exId)!;
      const ladder = ex.retryPolicy.escalationLadder;
      expect(ladder[ladder.length - 1]).toBe(KidsRetryEscalationType.MOVE_ON);
    },
  );
});

describe('H — exercise orders are sequential with no duplicates', () => {
  it('all exercise orders are unique', () => {
    const lesson = getLesson();
    const orders = lesson.exercises?.map(e => e.order) ?? [];
    const unique = new Set(orders);
    expect(unique.size).toBe(orders.length);
  });
  it('orders start at 1 and are contiguous', () => {
    const lesson = getLesson();
    const orders = (lesson.exercises?.map(e => e.order) ?? []).sort((a, b) => a - b);
    for (let i = 0; i < orders.length; i++) {
      expect(orders[i]).toBe(i + 1);
    }
  });
});

describe('I — all exercise IDs in lesson are unique', () => {
  it('no duplicate exerciseIds', () => {
    const lesson = getLesson();
    const ids = lesson.exercises?.map(e => e.exerciseId) ?? [];
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });
});

describe('J — ex-10-close has order 14', () => {
  it('close exercise is at order 14', () => {
    const lesson = getLesson();
    const close = lesson.exercises?.find(e => e.exerciseId === 'kb1-u01-l02-ex-10-close');
    expect(close?.order).toBe(14);
  });
});
