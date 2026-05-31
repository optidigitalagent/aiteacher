import { describe, it, expect } from 'vitest';
import { AgeBand, LessonPhase } from '../../shared/enums.js';
import {
  KidsTextbookActivityType,
  KidsStudentActionType,
  KidsCompletionRuleType,
  KidsRetryEscalationType,
  KidsCurriculumActivityType,
  KidsCurriculumItemType,
  KidsFallbackPolicy,
} from '../curriculum-types.js';
import type {
  KidsExerciseDefinition,
  KidsCompletionRule,
  KidsRetryPolicy,
  KidsCurriculumLesson,
  KidsCurriculumItem,
  KidsCurriculumPhase,
  KidsActivityDefinition,
} from '../curriculum-types.js';
import {
  validateKidsExerciseDefinition,
  validateExerciseCompletionRule,
  validateExerciseRetryPolicy,
  validateLessonExercises,
  validateKidsCurriculumLesson,
} from '../curriculum-validators.js';
import { PROTO_ANIMALS_LESSON } from '../prototype-animals-lesson.js';
import { KB1_U01_L02_COLOURS, KIDS_BOX_1_COURSE } from '../kids-box/kids-box-unit-01.js';

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const validCompletionRule: KidsCompletionRule = {
  type: KidsCompletionRuleType.CORRECT_REPETITIONS,
  requiredCorrectCount: 2,
  allowPartialCompletion: false,
};

const validRetryPolicy: KidsRetryPolicy = {
  maxAttempts: 3,
  escalationLadder: [
    KidsRetryEscalationType.REPEAT_PROMPT,
    KidsRetryEscalationType.MODEL_ANSWER,
    KidsRetryEscalationType.MOVE_ON,
  ],
  fallbackExerciseId: null,
  resetOnCorrect: true,
};

const validExercise: KidsExerciseDefinition = {
  exerciseId: 'kb1-u01-l02-ex-01',
  lessonId: 'kb1-u01-l02',
  order: 1,
  pageRef: 'KB1-PB-p12',
  textbookActivityType: KidsTextbookActivityType.LISTEN_AND_REPEAT,
  studentActionType: KidsStudentActionType.REPEAT_WORD,
  targetItemIds: ['item-blue'],
  teacherInstruction: 'Listen and repeat the colour.',
  prompt: { text: 'Blue!' },
  choices: [],
  expectedAnswers: ['blue'],
  completionRule: validCompletionRule,
  retryPolicy: validRetryPolicy,
  nextExerciseId: null,
  requiresVisualUI: false,
  allowedWithoutVisualUI: true,
  tags: ['colours'],
};

const minimalItem: KidsCurriculumItem = {
  itemId: 'item-blue',
  type: KidsCurriculumItemType.VOCABULARY,
  targetText: 'blue',
  normalizedAnswer: 'blue',
  l1Translations: { uk: 'синій' },
  gestures: [],
  difficulty: 1,
  tags: ['colours'],
};

const minimalPhase: KidsCurriculumPhase = {
  phaseId: 'phase-intro',
  type: LessonPhase.INTRODUCTION,
  order: 1,
  estimatedSeconds: 120,
  allowedActivities: [KidsCurriculumActivityType.LISTEN_AND_REPEAT],
  exitCriteria: 'Child repeats all targets',
};

const audioSafeActivity: KidsActivityDefinition = {
  activityId: 'ACT-REPEAT',
  type: KidsCurriculumActivityType.LISTEN_AND_REPEAT,
  requiredItemTypes: [KidsCurriculumItemType.VOCABULARY],
  requiresVisualUI: false,
  requiresAudio: true,
  requiresSpeech: true,
  allowedWithoutVisualUI: true,
  promptTemplates: [],
  successCriteria: 'Child repeats target word',
  fallbackPolicy: KidsFallbackPolicy.USE_AUDIO_SAFE_FALLBACK,
};

const minimalLesson: KidsCurriculumLesson = {
  lessonId: 'kb1-u01-l02',
  unitId: 'kb1-unit-01',
  title: 'Colours',
  estimatedMinutes: 15,
  allowedAgeBands: [AgeBand.SIX_SEVEN],
  learningObjectives: ['Learn colour words'],
  phases: [minimalPhase],
  items: [minimalItem],
  activities: [audioSafeActivity],
  reviewLinks: [],
};

// ─── Exercise definition tests ────────────────────────────────────────────────

describe('exercise-schema: validateKidsExerciseDefinition', () => {
  it('1. valid exercise passes', () => {
    const result = validateKidsExerciseDefinition(validExercise);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('2. missing exerciseId fails', () => {
    const bad = { ...validExercise, exerciseId: '' };
    const result = validateKidsExerciseDefinition(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('exerciseId'))).toBe(true);
  });

  it('3. missing completionRule fails', () => {
    const { completionRule: _cr, ...rest } = validExercise;
    const result = validateKidsExerciseDefinition(rest);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('completionRule'))).toBe(true);
  });

  it('4. invalid retryPolicy fails', () => {
    const bad = {
      ...validExercise,
      retryPolicy: { maxAttempts: 0, escalationLadder: [], fallbackExerciseId: null, resetOnCorrect: true },
    };
    const result = validateKidsExerciseDefinition(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('maxAttempts'))).toBe(true);
  });

  it('5. visual-required exercise without visual payload fails', () => {
    const bad: KidsExerciseDefinition = {
      ...validExercise,
      requiresVisualUI: true,
      allowedWithoutVisualUI: false,
      visualPromptPayload: undefined,
    };
    const result = validateKidsExerciseDefinition(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('visualPromptPayload'))).toBe(true);
  });

  it('6. listen_and_repeat exercise without visual UI passes', () => {
    const audioOnly: KidsExerciseDefinition = {
      ...validExercise,
      textbookActivityType: KidsTextbookActivityType.LISTEN_AND_REPEAT,
      requiresVisualUI: false,
      allowedWithoutVisualUI: true,
      visualPromptPayload: undefined,
    };
    const result = validateKidsExerciseDefinition(audioOnly);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('9. answer-producing action requires expectedAnswers', () => {
    const bad: KidsExerciseDefinition = {
      ...validExercise,
      studentActionType: KidsStudentActionType.REPEAT_WORD,
      expectedAnswers: [],
    };
    const result = validateKidsExerciseDefinition(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('expectedAnswers'))).toBe(true);
  });

  it('10. listen_only does not require expectedAnswers', () => {
    const listenOnly: KidsExerciseDefinition = {
      ...validExercise,
      studentActionType: KidsStudentActionType.LISTEN_ONLY,
      expectedAnswers: [],
    };
    const result = validateKidsExerciseDefinition(listenOnly);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});

// ─── Lesson exercises tests ───────────────────────────────────────────────────

describe('exercise-schema: validateLessonExercises', () => {
  it('11. lesson with valid ordered exercises passes', () => {
    const ex2: KidsExerciseDefinition = {
      ...validExercise,
      exerciseId: 'kb1-u01-l02-ex-02',
      order: 2,
      nextExerciseId: null,
    };
    const ex1: KidsExerciseDefinition = {
      ...validExercise,
      nextExerciseId: 'kb1-u01-l02-ex-02',
    };
    const lesson: KidsCurriculumLesson = { ...minimalLesson, exercises: [ex1, ex2] };
    const result = validateLessonExercises(lesson);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('12. lesson with duplicate exercise IDs fails', () => {
    const dupe: KidsExerciseDefinition = { ...validExercise, order: 2 };
    const lesson: KidsCurriculumLesson = { ...minimalLesson, exercises: [validExercise, dupe] };
    const result = validateLessonExercises(lesson);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('duplicate exerciseId'))).toBe(true);
  });

  it('13. lesson with invalid exercise order fails', () => {
    const sameOrder: KidsExerciseDefinition = {
      ...validExercise,
      exerciseId: 'kb1-u01-l02-ex-02',
      order: 1,
    };
    const lesson: KidsCurriculumLesson = { ...minimalLesson, exercises: [validExercise, sameOrder] };
    const result = validateLessonExercises(lesson);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('duplicate order'))).toBe(true);
  });

  it('7. nextExerciseId must reference an existing exercise', () => {
    const bad: KidsExerciseDefinition = {
      ...validExercise,
      nextExerciseId: 'does-not-exist',
    };
    const lesson: KidsCurriculumLesson = { ...minimalLesson, exercises: [bad] };
    const result = validateLessonExercises(lesson);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('does-not-exist'))).toBe(true);
  });

  it('8. targetItemIds must reference existing lesson items', () => {
    const bad: KidsExerciseDefinition = {
      ...validExercise,
      targetItemIds: ['item-does-not-exist'],
    };
    const lesson: KidsCurriculumLesson = { ...minimalLesson, exercises: [bad] };
    const result = validateLessonExercises(lesson);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('item-does-not-exist'))).toBe(true);
  });

  it('14. existing prototype animals lesson still validates', () => {
    const result = validateKidsCurriculumLesson(PROTO_ANIMALS_LESSON);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('15. existing Kid\'s Box Unit 1 Lesson 2 still validates', () => {
    const result = validateKidsCurriculumLesson(KB1_U01_L02_COLOURS);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});

// ─── Public exports test ──────────────────────────────────────────────────────

describe('exercise-schema: public exports', () => {
  it('16. public exports exist from index.ts', async () => {
    const mod = await import('../index.js');

    // New enums
    expect(mod.KidsTextbookActivityType).toBeDefined();
    expect(mod.KidsStudentActionType).toBeDefined();
    expect(mod.KidsCompletionRuleType).toBeDefined();
    expect(mod.KidsRetryEscalationType).toBeDefined();

    // New validators
    expect(typeof mod.validateKidsExerciseDefinition).toBe('function');
    expect(typeof mod.validateExerciseCompletionRule).toBe('function');
    expect(typeof mod.validateExerciseRetryPolicy).toBe('function');
    expect(typeof mod.validateLessonExercises).toBe('function');
  });
});

// ─── Completion rule and retry policy unit tests ──────────────────────────────

describe('exercise-schema: validateExerciseCompletionRule', () => {
  it('valid completion rule passes', () => {
    const result = validateExerciseCompletionRule(validCompletionRule);
    expect(result.valid).toBe(true);
  });

  it('invalid type fails', () => {
    const bad = { ...validCompletionRule, type: 'not_a_type' };
    const result = validateExerciseCompletionRule(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('type'))).toBe(true);
  });

  it('missing allowPartialCompletion fails', () => {
    const { allowPartialCompletion: _apc, ...rest } = validCompletionRule;
    const result = validateExerciseCompletionRule(rest);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('allowPartialCompletion'))).toBe(true);
  });
});

describe('exercise-schema: validateExerciseRetryPolicy', () => {
  it('valid retry policy passes', () => {
    const result = validateExerciseRetryPolicy(validRetryPolicy);
    expect(result.valid).toBe(true);
  });

  it('maxAttempts < 1 fails', () => {
    const bad = { ...validRetryPolicy, maxAttempts: 0 };
    const result = validateExerciseRetryPolicy(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('maxAttempts'))).toBe(true);
  });

  it('invalid escalation type fails', () => {
    const bad = { ...validRetryPolicy, escalationLadder: ['not_valid'] };
    const result = validateExerciseRetryPolicy(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('escalationLadder'))).toBe(true);
  });

  it('fallbackExerciseId as number fails', () => {
    const bad = { ...validRetryPolicy, fallbackExerciseId: 42 };
    const result = validateExerciseRetryPolicy(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('fallbackExerciseId'))).toBe(true);
  });
});
