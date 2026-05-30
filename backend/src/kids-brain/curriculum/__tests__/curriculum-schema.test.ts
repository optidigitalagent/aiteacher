import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { AgeBand, LessonPhase } from '../../shared/enums.js';
import {
  KidsCurriculumActivityType,
  KidsCurriculumItemType,
  KidsFallbackPolicy,
  type KidsCurriculumCourse,
  type KidsCurriculumLesson,
  type KidsCurriculumItem,
  type KidsActivityDefinition,
  type KidsCurriculumPhase,
  type KidsTeacherPromptTemplate,
} from '../curriculum-types.js';
import { APPROVED_TEMPLATE_VARIABLES, ACTIVITY_UI_SAFETY_RULES } from '../curriculum-schema.js';
import {
  validateKidsCurriculumCourse,
  validateKidsCurriculumLesson,
  validateKidsCurriculumActivity,
  validateNoPlaceholderLeaks,
  validateFinalOutputNoPlaceholders,
  validateActivityUISafety,
  validateLessonHasNoVisualRequiredActivityWithoutVisualSupport,
} from '../curriculum-validators.js';

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const minimalPhase: KidsCurriculumPhase = {
  phaseId: 'phase-intro',
  type: LessonPhase.INTRODUCTION,
  order: 1,
  estimatedSeconds: 120,
  allowedActivities: [KidsCurriculumActivityType.LISTEN_AND_REPEAT],
  exitCriteria: 'Child repeats all target words at least once',
};

const minimalItem: KidsCurriculumItem = {
  itemId: 'SMS-U1-N001',
  type: KidsCurriculumItemType.VOCABULARY,
  targetText: 'cat',
  normalizedAnswer: 'cat',
  l1Translations: { uk: 'кіт' },
  gestures: [],
  difficulty: 1,
  tags: ['animals'],
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

const visualRequiredActivity: KidsActivityDefinition = {
  activityId: 'ACT-FORCED-VISUAL',
  type: KidsCurriculumActivityType.FORCED_CHOICE_VISUAL,
  requiredItemTypes: [KidsCurriculumItemType.VOCABULARY],
  requiresVisualUI: true,
  requiresAudio: true,
  requiresSpeech: false,
  allowedWithoutVisualUI: false,
  promptTemplates: [],
  successCriteria: 'Child selects correct image card',
  fallbackPolicy: KidsFallbackPolicy.USE_AUDIO_SAFE_FALLBACK,
};

const minimalLesson: KidsCurriculumLesson = {
  lessonId: 'KB-U1-L1',
  unitId: 'KB-U1',
  title: 'Animals: Lesson 1',
  estimatedMinutes: 15,
  allowedAgeBands: [AgeBand.SIX_SEVEN],
  learningObjectives: ['Learn 4 animal words'],
  phases: [minimalPhase],
  items: [minimalItem],
  activities: [audioSafeActivity],
  reviewLinks: [],
};

const minimalCourse: KidsCurriculumCourse = {
  courseId: 'KB-STARTER',
  version: '1.0.0',
  title: 'Kids Box Starter',
  source: 'Mentium-original',
  cefrLevel: 'Pre-A1',
  ageBands: [AgeBand.SIX_SEVEN],
  units: [],
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('curriculum-schema', () => {
  it('1. valid minimal course passes', () => {
    const result = validateKidsCurriculumCourse(minimalCourse);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('2. valid minimal lesson passes', () => {
    const result = validateKidsCurriculumLesson(minimalLesson);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('3. missing courseId fails', () => {
    const bad = { ...minimalCourse, courseId: '' };
    const result = validateKidsCurriculumCourse(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('courseId'))).toBe(true);
  });

  it('4. missing lesson phases fails', () => {
    const bad = { ...minimalLesson, phases: [] };
    const result = validateKidsCurriculumLesson(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('phases'))).toBe(true);
  });

  it('5. item without normalizedAnswer fails', () => {
    const itemWithout = { ...minimalItem, normalizedAnswer: '' };
    const lesson = { ...minimalLesson, items: [itemWithout] };
    const result = validateKidsCurriculumLesson(lesson);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('normalizedAnswer'))).toBe(true);
  });

  it('6. visual activity requires visual UI', () => {
    const rule = ACTIVITY_UI_SAFETY_RULES[KidsCurriculumActivityType.FORCED_CHOICE_VISUAL];
    expect(rule.requiresVisualUI).toBe(true);
    expect(rule.allowedWithoutVisualUI).toBe(false);
  });

  it('7. listen_and_repeat allowed without visual UI', () => {
    const rule = ACTIVITY_UI_SAFETY_RULES[KidsCurriculumActivityType.LISTEN_AND_REPEAT];
    expect(rule.requiresVisualUI).toBe(false);
    expect(rule.allowedWithoutVisualUI).toBe(true);
  });

  it('8. forced_choice_visual rejected without visual support', () => {
    const lesson = { ...minimalLesson, activities: [visualRequiredActivity] };
    const result = validateLessonHasNoVisualRequiredActivityWithoutVisualSupport(lesson, false);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('ACT-FORCED-VISUAL'))).toBe(true);
  });

  it('9. prompt with approved placeholders passes', () => {
    const template: KidsTeacherPromptTemplate = {
      templateId: 'T001',
      activityType: KidsCurriculumActivityType.LISTEN_AND_REPEAT,
      text: 'Say {target} with me! Is it {choiceA} or {choiceB}? Hello {childName}!',
      requiresVisualUI: false,
    };
    const result = validateNoPlaceholderLeaks(template);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('10. prompt with unknown placeholder fails', () => {
    const template: KidsTeacherPromptTemplate = {
      templateId: 'T002',
      activityType: KidsCurriculumActivityType.LISTEN_AND_REPEAT,
      text: 'Say {unknownVar} now!',
      requiresVisualUI: false,
    };
    const result = validateNoPlaceholderLeaks(template);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('{unknownVar}');
  });

  it('11. final-output placeholder guard rejects {target}', () => {
    // {target} is approved at authoring time but must be resolved before delivery
    const result = validateFinalOutputNoPlaceholders('Say {target} now!');
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('{target}');
  });

  it('12. lesson with visual-required activity fails when visualSupport=false', () => {
    const lesson = { ...minimalLesson, activities: [visualRequiredActivity] };
    const result = validateLessonHasNoVisualRequiredActivityWithoutVisualSupport(lesson, false);
    expect(result.valid).toBe(false);
    expect(result.errors).not.toHaveLength(0);
  });

  it('13. lesson with only visual-safe activities passes when visualSupport=false', () => {
    const lesson = { ...minimalLesson, activities: [audioSafeActivity] };
    const result = validateLessonHasNoVisualRequiredActivityWithoutVisualSupport(lesson, false);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('14. no adult module imports in curriculum files', () => {
    const curriculumDir = resolve(join(__dirname, '..'));
    const files = ['curriculum-types.ts', 'curriculum-schema.ts', 'curriculum-validators.ts', 'index.ts'];
    const forbiddenPaths = [
      '/src/lesson/',
      '/demo-routes',
      '/behavior-runtime',
      '/teacher-brain',
      '/engine/',
      '/src/billing',
    ];

    for (const file of files) {
      const content = readFileSync(join(curriculumDir, file), 'utf-8');
      const importLines = content
        .split('\n')
        .filter(l => l.trimStart().startsWith('import'));
      for (const line of importLines) {
        for (const forbidden of forbiddenPaths) {
          expect(
            line,
            `${file} must not import from adult module "${forbidden}"`,
          ).not.toContain(forbidden);
        }
      }
    }
  });

  it('15. public exports available from index.ts', async () => {
    const mod = await import('../index.js');
    expect(mod.KidsCurriculumActivityType).toBeDefined();
    expect(mod.KidsCurriculumItemType).toBeDefined();
    expect(mod.KidsFallbackPolicy).toBeDefined();
    expect(mod.APPROVED_TEMPLATE_VARIABLES).toBeDefined();
    expect(mod.ACTIVITY_UI_SAFETY_RULES).toBeDefined();
    expect(typeof mod.validateKidsCurriculumCourse).toBe('function');
    expect(typeof mod.validateKidsCurriculumLesson).toBe('function');
    expect(typeof mod.validateKidsCurriculumActivity).toBe('function');
    expect(typeof mod.validateNoPlaceholderLeaks).toBe('function');
    expect(typeof mod.validateFinalOutputNoPlaceholders).toBe('function');
    expect(typeof mod.validateActivityUISafety).toBe('function');
    expect(typeof mod.validateLessonHasNoVisualRequiredActivityWithoutVisualSupport).toBe('function');
  });
});
