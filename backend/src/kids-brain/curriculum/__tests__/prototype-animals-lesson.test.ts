import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  PROTO_ANIMALS_COURSE,
  PROTO_ANIMALS_LESSON,
} from '../prototype-animals-lesson.js';
import {
  KidsCurriculumActivityType,
} from '../curriculum-types.js';
import {
  validateKidsCurriculumCourse,
  validateKidsCurriculumLesson,
  validateNoPlaceholderLeaks,
  validateFinalOutputNoPlaceholders,
  validateLessonHasNoVisualRequiredActivityWithoutVisualSupport,
} from '../curriculum-validators.js';

const EXPECTED_ANIMAL_WORDS = ['cat', 'dog', 'lion', 'monkey', 'elephant', 'tiger'];

const FORBIDDEN_ACTIVITY_TYPES = [
  KidsCurriculumActivityType.LISTEN_AND_POINT,
  KidsCurriculumActivityType.FORCED_CHOICE_VISUAL,
  KidsCurriculumActivityType.FIND_THE_OBJECT,
];

describe('prototype-animals-lesson', () => {
  it('1. prototype course validates', () => {
    const result = validateKidsCurriculumCourse(PROTO_ANIMALS_COURSE);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('2. prototype lesson validates', () => {
    const result = validateKidsCurriculumLesson(PROTO_ANIMALS_LESSON);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('3. lesson has exactly 6 vocabulary items', () => {
    expect(PROTO_ANIMALS_LESSON.items).toHaveLength(6);
  });

  it('4. all expected animal words exist', () => {
    const targetTexts = PROTO_ANIMALS_LESSON.items.map(i => i.targetText);
    for (const word of EXPECTED_ANIMAL_WORDS) {
      expect(targetTexts, `missing animal word: ${word}`).toContain(word);
    }
  });

  it('5. all items have Russian and Ukrainian translations', () => {
    for (const item of PROTO_ANIMALS_LESSON.items) {
      expect(
        item.l1Translations['ru'],
        `${item.targetText} missing Russian translation`,
      ).toBeTruthy();
      expect(
        item.l1Translations['uk'],
        `${item.targetText} missing Ukrainian translation`,
      ).toBeTruthy();
    }
  });

  it('6. all items have visual asset refs', () => {
    for (const item of PROTO_ANIMALS_LESSON.items) {
      expect(item.visualAsset, `${item.targetText} missing visualAsset`).toBeDefined();
      expect(typeof item.visualAsset!.assetId).toBe('string');
      expect(item.visualAsset!.assetId.length).toBeGreaterThan(0);
    }
  });

  it('7. all items have audio asset refs', () => {
    for (const item of PROTO_ANIMALS_LESSON.items) {
      expect(item.audioAsset, `${item.targetText} missing audioAsset`).toBeDefined();
      expect(typeof item.audioAsset!.assetId).toBe('string');
      expect(item.audioAsset!.assetId.length).toBeGreaterThan(0);
    }
  });

  it('8. all activities are visual-safe (allowedWithoutVisualUI=true)', () => {
    for (const activity of PROTO_ANIMALS_LESSON.activities) {
      expect(
        activity.allowedWithoutVisualUI,
        `activity ${activity.activityId} is not visual-safe`,
      ).toBe(true);
      expect(
        activity.requiresVisualUI,
        `activity ${activity.activityId} requires visual UI`,
      ).toBe(false);
    }
  });

  it('9. no listen_and_point activity exists', () => {
    const types = PROTO_ANIMALS_LESSON.activities.map(a => a.type);
    expect(types).not.toContain(KidsCurriculumActivityType.LISTEN_AND_POINT);
  });

  it('10. no forced_choice_visual activity exists', () => {
    const types = PROTO_ANIMALS_LESSON.activities.map(a => a.type);
    expect(types).not.toContain(KidsCurriculumActivityType.FORCED_CHOICE_VISUAL);
  });

  it('11. no find_the_object activity exists', () => {
    const types = PROTO_ANIMALS_LESSON.activities.map(a => a.type);
    expect(types).not.toContain(KidsCurriculumActivityType.FIND_THE_OBJECT);
  });

  it('12. all prompt templates pass approved placeholder validation', () => {
    for (const activity of PROTO_ANIMALS_LESSON.activities) {
      for (const template of activity.promptTemplates) {
        const result = validateNoPlaceholderLeaks(template);
        expect(
          result.valid,
          `template "${template.templateId}" has unapproved placeholders: ${result.errors.join(', ')}`,
        ).toBe(true);
      }
    }
  });

  it('13. no final-output placeholder leaks in rendered sample prompts', () => {
    const substitutions: Record<string, string> = {
      '{target}': 'cat',
      '{choiceA}': 'cat',
      '{choiceB}': 'dog',
      '{childName}': 'Alex',
      '{characterName}': 'Zara',
    };

    for (const activity of PROTO_ANIMALS_LESSON.activities) {
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
  });

  it('14. review links exist', () => {
    expect(PROTO_ANIMALS_LESSON.reviewLinks.length).toBeGreaterThan(0);
    for (const link of PROTO_ANIMALS_LESSON.reviewLinks) {
      expect(typeof link.itemId).toBe('string');
      expect(link.itemId.length).toBeGreaterThan(0);
      expect(typeof link.sourceUnitId).toBe('string');
      expect(typeof link.sourceLessonId).toBe('string');
      expect(['spaced_repetition', 'semantic_cluster', 'unit_review']).toContain(link.reviewReason);
    }
  });

  it('15. public export exists from curriculum/index.ts', async () => {
    const mod = await import('../index.js');
    expect(mod.PROTO_ANIMALS_LESSON).toBeDefined();
    expect(mod.PROTO_ANIMALS_UNIT).toBeDefined();
    expect(mod.PROTO_ANIMALS_COURSE).toBeDefined();
    expect(mod.PROTO_ANIMALS_LESSON.lessonId).toBe('animals-zoo-lesson-001');
    expect(mod.PROTO_ANIMALS_COURSE.courseId).toBe('mentium-kids-prototype-animals');
  });

  it('16. no adult runtime imports in prototype-animals-lesson.ts', () => {
    const filePath = resolve(join(__dirname, '..', 'prototype-animals-lesson.ts'));
    const content = readFileSync(filePath, 'utf-8');
    const importLines = content
      .split('\n')
      .filter(l => l.trimStart().startsWith('import'));

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
          `prototype-animals-lesson.ts must not import from adult module "${forbidden}"`,
        ).not.toContain(forbidden);
      }
    }
  });

  it('course course-level consistency: lesson appears in unit which appears in course', () => {
    const unit = PROTO_ANIMALS_COURSE.units[0];
    expect(unit).toBeDefined();
    expect(unit.unitId).toBe(PROTO_ANIMALS_LESSON.unitId);
    const lesson = unit.lessons[0];
    expect(lesson.lessonId).toBe(PROTO_ANIMALS_LESSON.lessonId);
  });

  it('lesson passes visual-safe check with visualSupport=false', () => {
    const result = validateLessonHasNoVisualRequiredActivityWithoutVisualSupport(
      PROTO_ANIMALS_LESSON,
      false,
    );
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('no forbidden activity types appear in any phase allowedActivities', () => {
    for (const phase of PROTO_ANIMALS_LESSON.phases) {
      for (const forbidden of FORBIDDEN_ACTIVITY_TYPES) {
        expect(
          phase.allowedActivities,
          `phase "${phase.phaseId}" contains forbidden activity type ${forbidden}`,
        ).not.toContain(forbidden);
      }
    }
  });
});
