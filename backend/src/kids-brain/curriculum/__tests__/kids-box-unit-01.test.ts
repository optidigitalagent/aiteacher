import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  KB1_U01_L01_GREETINGS,
  KB1_U01_L02_COLOURS,
  KB1_U01_L03_NUMBERS,
  KB1_UNIT_01,
  KIDS_BOX_1_COURSE,
} from '../kids-box/kids-box-unit-01.js';
import {
  KidsCurriculumActivityType,
  KidsCurriculumItemType,
} from '../curriculum-types.js';
import {
  validateKidsCurriculumCourse,
  validateKidsCurriculumLesson,
  validateNoPlaceholderLeaks,
  validateFinalOutputNoPlaceholders,
  validateLessonHasNoVisualRequiredActivityWithoutVisualSupport,
} from '../curriculum-validators.js';

const ALL_LESSONS = [KB1_U01_L01_GREETINGS, KB1_U01_L02_COLOURS, KB1_U01_L03_NUMBERS];

const FORBIDDEN_ACTIVITY_TYPES = [
  KidsCurriculumActivityType.LISTEN_AND_POINT,
  KidsCurriculumActivityType.FORCED_CHOICE_VISUAL,
  KidsCurriculumActivityType.FIND_THE_OBJECT,
];

const EXPECTED_COLOURS = ['blue', 'green', 'pink', 'purple', 'red', 'orange', 'yellow'];
const EXPECTED_NUMBERS = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const EXPECTED_GREETINGS = ['hello', 'goodbye'];

// ─── Course-level tests ───────────────────────────────────────────────────────

describe('kids-box-unit-01: course', () => {
  it('1. course passes schema validation', () => {
    const result = validateKidsCurriculumCourse(KIDS_BOX_1_COURSE);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('2. courseId is cambridge-kids-box-1', () => {
    expect(KIDS_BOX_1_COURSE.courseId).toBe('cambridge-kids-box-1');
  });

  it('3. course contains exactly 1 unit (Unit 1)', () => {
    expect(KIDS_BOX_1_COURSE.units).toHaveLength(1);
    expect(KIDS_BOX_1_COURSE.units[0].unitId).toBe('kb1-unit-01');
  });

  it('4. unit contains exactly 3 lessons', () => {
    expect(KIDS_BOX_1_COURSE.units[0].lessons).toHaveLength(3);
  });

  it('5. lesson ids are unique across the unit', () => {
    const ids = KIDS_BOX_1_COURSE.units[0].lessons.map(l => l.lessonId);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });
});

// ─── Unit-level tests ─────────────────────────────────────────────────────────

describe('kids-box-unit-01: unit', () => {
  it('6. unit title is Hello!', () => {
    expect(KB1_UNIT_01.title).toBe('Hello!');
  });

  it('7. unit references correct lessons', () => {
    const ids = KB1_UNIT_01.lessons.map(l => l.lessonId);
    expect(ids).toContain('kb1-u01-l01');
    expect(ids).toContain('kb1-u01-l02');
    expect(ids).toContain('kb1-u01-l03');
  });

  it('8. all lessons have unitId matching kb1-unit-01', () => {
    for (const lesson of KB1_UNIT_01.lessons) {
      expect(lesson.unitId).toBe('kb1-unit-01');
    }
  });
});

// ─── Lesson 1: Greetings ──────────────────────────────────────────────────────

describe('kids-box-unit-01: lesson 1 — greetings', () => {
  it('9. lesson 1 passes schema validation', () => {
    const result = validateKidsCurriculumLesson(KB1_U01_L01_GREETINGS);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('10. lesson 1 has 5 items (2 vocabulary + 3 sentence frames)', () => {
    expect(KB1_U01_L01_GREETINGS.items).toHaveLength(5);
  });

  it('11. expected greeting vocabulary items exist', () => {
    const vocabTexts = KB1_U01_L01_GREETINGS.items
      .filter(i => i.type === KidsCurriculumItemType.VOCABULARY)
      .map(i => i.targetText);
    for (const word of EXPECTED_GREETINGS) {
      expect(vocabTexts, `missing greeting: ${word}`).toContain(word);
    }
  });

  it('12. sentence frame items have correct type', () => {
    const frames = KB1_U01_L01_GREETINGS.items.filter(
      i => i.type === KidsCurriculumItemType.SENTENCE_FRAME,
    );
    expect(frames.length).toBe(3);
  });

  it('13. lesson 1 passes visual-safe check', () => {
    const result = validateLessonHasNoVisualRequiredActivityWithoutVisualSupport(
      KB1_U01_L01_GREETINGS,
      false,
    );
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});

// ─── Lesson 2: Colours ────────────────────────────────────────────────────────

describe('kids-box-unit-01: lesson 2 — colours', () => {
  it('14. lesson 2 passes schema validation', () => {
    const result = validateKidsCurriculumLesson(KB1_U01_L02_COLOURS);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('15. lesson 2 has exactly 7 colour vocabulary items', () => {
    expect(KB1_U01_L02_COLOURS.items).toHaveLength(7);
    const vocab = KB1_U01_L02_COLOURS.items.filter(i => i.type === KidsCurriculumItemType.VOCABULARY);
    expect(vocab).toHaveLength(7);
  });

  it('16. all 7 expected colours are present', () => {
    const texts = KB1_U01_L02_COLOURS.items.map(i => i.targetText);
    for (const colour of EXPECTED_COLOURS) {
      expect(texts, `missing colour: ${colour}`).toContain(colour);
    }
  });

  it('17. colour item IDs are unique', () => {
    const ids = KB1_U01_L02_COLOURS.items.map(i => i.itemId);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('18. lesson 2 passes visual-safe check', () => {
    const result = validateLessonHasNoVisualRequiredActivityWithoutVisualSupport(
      KB1_U01_L02_COLOURS,
      false,
    );
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});

// ─── Lesson 3: Numbers ────────────────────────────────────────────────────────

describe('kids-box-unit-01: lesson 3 — numbers', () => {
  it('19. lesson 3 passes schema validation', () => {
    const result = validateKidsCurriculumLesson(KB1_U01_L03_NUMBERS);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('20. lesson 3 has exactly 10 number items', () => {
    expect(KB1_U01_L03_NUMBERS.items).toHaveLength(10);
  });

  it('21. all 10 expected number words are present', () => {
    const texts = KB1_U01_L03_NUMBERS.items.map(i => i.targetText);
    for (const num of EXPECTED_NUMBERS) {
      expect(texts, `missing number: ${num}`).toContain(num);
    }
  });

  it('22. number item IDs are unique', () => {
    const ids = KB1_U01_L03_NUMBERS.items.map(i => i.itemId);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('23. six has phonics-s tag (Unit 1 /s/ phonics focus)', () => {
    const six = KB1_U01_L03_NUMBERS.items.find(i => i.targetText === 'six');
    expect(six).toBeDefined();
    expect(six!.tags).toContain('phonics-s');
  });

  it('24. lesson 3 passes visual-safe check', () => {
    const result = validateLessonHasNoVisualRequiredActivityWithoutVisualSupport(
      KB1_U01_L03_NUMBERS,
      false,
    );
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});

// ─── Cross-lesson: vocabulary uniqueness ──────────────────────────────────────

describe('kids-box-unit-01: cross-lesson invariants', () => {
  it('25. all item IDs are unique across all 3 lessons', () => {
    const allIds = ALL_LESSONS.flatMap(l => l.items.map(i => i.itemId));
    const unique = new Set(allIds);
    expect(unique.size).toBe(allIds.length);
  });

  it('26. all vocabulary targetTexts within each lesson are unique', () => {
    for (const lesson of ALL_LESSONS) {
      const texts = lesson.items.map(i => i.targetText);
      const unique = new Set(texts);
      expect(unique.size, `duplicate targetText in lesson ${lesson.lessonId}`).toBe(texts.length);
    }
  });

  it('27. all items in all lessons have Russian and Ukrainian translations', () => {
    for (const lesson of ALL_LESSONS) {
      for (const item of lesson.items) {
        expect(
          item.l1Translations['ru'],
          `${item.itemId} missing Russian translation`,
        ).toBeTruthy();
        expect(
          item.l1Translations['uk'],
          `${item.itemId} missing Ukrainian translation`,
        ).toBeTruthy();
      }
    }
  });

  it('28. all items have audioAsset refs', () => {
    for (const lesson of ALL_LESSONS) {
      for (const item of lesson.items) {
        expect(item.audioAsset, `${item.itemId} missing audioAsset`).toBeDefined();
        expect(item.audioAsset!.assetId.length).toBeGreaterThan(0);
      }
    }
  });

  it('29. all items have normalizedAnswer', () => {
    for (const lesson of ALL_LESSONS) {
      for (const item of lesson.items) {
        expect(item.normalizedAnswer, `${item.itemId} missing normalizedAnswer`).toBeTruthy();
      }
    }
  });

  it('30. no forbidden visual activity types in any lesson', () => {
    for (const lesson of ALL_LESSONS) {
      const types = lesson.activities.map(a => a.type);
      for (const forbidden of FORBIDDEN_ACTIVITY_TYPES) {
        expect(
          types,
          `lesson ${lesson.lessonId} contains forbidden activity ${forbidden}`,
        ).not.toContain(forbidden);
      }
    }
  });

  it('31. all activities are visual-safe (allowedWithoutVisualUI=true)', () => {
    for (const lesson of ALL_LESSONS) {
      for (const activity of lesson.activities) {
        expect(
          activity.allowedWithoutVisualUI,
          `${activity.activityId} in lesson ${lesson.lessonId} is not visual-safe`,
        ).toBe(true);
        expect(
          activity.requiresVisualUI,
          `${activity.activityId} requires visual UI`,
        ).toBe(false);
      }
    }
  });

  it('32. all phase allowedActivities contain no forbidden types', () => {
    for (const lesson of ALL_LESSONS) {
      for (const phase of lesson.phases) {
        for (const forbidden of FORBIDDEN_ACTIVITY_TYPES) {
          expect(
            phase.allowedActivities,
            `phase ${phase.phaseId} has forbidden activity ${forbidden}`,
          ).not.toContain(forbidden);
        }
      }
    }
  });

  it('33. each lesson has exactly 5 phases in order 1-5', () => {
    for (const lesson of ALL_LESSONS) {
      expect(lesson.phases).toHaveLength(5);
      const orders = lesson.phases.map(p => p.order);
      expect(orders).toEqual([1, 2, 3, 4, 5]);
    }
  });

  it('34. all prompt templates pass approved placeholder validation', () => {
    for (const lesson of ALL_LESSONS) {
      for (const activity of lesson.activities) {
        for (const template of activity.promptTemplates) {
          const result = validateNoPlaceholderLeaks(template);
          expect(
            result.valid,
            `template "${template.templateId}" has unapproved placeholders: ${result.errors.join(', ')}`,
          ).toBe(true);
        }
      }
    }
  });

  it('35. rendered prompt templates have no unresolved placeholders', () => {
    const substitutions: Record<string, string> = {
      '{target}': 'blue',
      '{choiceA}': 'blue',
      '{choiceB}': 'green',
      '{childName}': 'Sofia',
      '{characterName}': 'Monty',
    };
    for (const lesson of ALL_LESSONS) {
      for (const activity of lesson.activities) {
        for (const template of activity.promptTemplates) {
          let rendered = template.text;
          for (const [placeholder, value] of Object.entries(substitutions)) {
            rendered = rendered.replaceAll(placeholder, value);
          }
          const result = validateFinalOutputNoPlaceholders(rendered);
          expect(
            result.valid,
            `template "${template.templateId}" has unresolved placeholders after render: "${rendered}"`,
          ).toBe(true);
        }
      }
    }
  });

  it('36. all review links reference valid itemIds within the unit', () => {
    const allItemIds = new Set(ALL_LESSONS.flatMap(l => l.items.map(i => i.itemId)));
    for (const lesson of ALL_LESSONS) {
      for (const link of lesson.reviewLinks) {
        expect(
          allItemIds.has(link.itemId),
          `review link itemId "${link.itemId}" in lesson ${lesson.lessonId} does not exist`,
        ).toBe(true);
        expect(typeof link.sourceUnitId).toBe('string');
        expect(typeof link.sourceLessonId).toBe('string');
        expect(['spaced_repetition', 'semantic_cluster', 'unit_review']).toContain(link.reviewReason);
      }
    }
  });

  it('37. all lessons have at least 2 learning objectives', () => {
    for (const lesson of ALL_LESSONS) {
      expect(
        lesson.learningObjectives.length,
        `lesson ${lesson.lessonId} needs at least 2 objectives`,
      ).toBeGreaterThanOrEqual(2);
    }
  });

  it('38. no adult runtime imports in kids-box-unit-01.ts', () => {
    const filePath = resolve(join(__dirname, '..', 'kids-box', 'kids-box-unit-01.ts'));
    const content = readFileSync(filePath, 'utf-8');
    const importLines = content.split('\n').filter(l => l.trimStart().startsWith('import'));
    const forbiddenPaths = [
      '/src/lesson/',
      '/demo-routes',
      '/behavior-runtime',
      '/teacher-brain',
      '/engine/',
      '/src/billing',
      'lesson-ws',
      'adult',
    ];
    for (const line of importLines) {
      for (const forbidden of forbiddenPaths) {
        expect(
          line,
          `kids-box-unit-01.ts must not import from adult module "${forbidden}"`,
        ).not.toContain(forbidden);
      }
    }
  });

  it('39. course-level: lesson appears in unit which appears in course', () => {
    const unit = KIDS_BOX_1_COURSE.units[0];
    expect(unit.unitId).toBe('kb1-unit-01');
    const lessonIds = unit.lessons.map(l => l.lessonId);
    expect(lessonIds).toContain('kb1-u01-l01');
    expect(lessonIds).toContain('kb1-u01-l02');
    expect(lessonIds).toContain('kb1-u01-l03');
  });
});
