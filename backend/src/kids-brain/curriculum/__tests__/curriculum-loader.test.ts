import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  listCourses,
  loadCourse,
  loadUnit,
  loadLesson,
  loadItem,
  listLessonItems,
  listLessonActivities,
  getActivityById,
  getVocabularyWords,
  getVocabularyItems,
  getDistractors,
  getVisualSafeActivities,
  getLessonForPrototype,
  validateRegisteredCurricula,
} from '../curriculum-loader.js';
import { KidsCurriculumActivityType } from '../curriculum-types.js';

const COURSE_ID = 'mentium-kids-prototype-animals';
const UNIT_ID = 'animals-zoo-001';
const LESSON_ID = 'animals-zoo-lesson-001';
const CAT_ITEM_ID = 'PROTO-ANIM-001';

describe('curriculum-loader', () => {
  // 1. listCourses returns prototype course
  it('1. listCourses returns prototype course', () => {
    const courses = listCourses();
    expect(courses.length).toBeGreaterThan(0);
    const ids = courses.map(c => c.courseId);
    expect(ids).toContain(COURSE_ID);
  });

  // 2. loadCourse returns prototype course by ID
  it('2. loadCourse returns prototype course by ID', () => {
    const course = loadCourse(COURSE_ID);
    expect(course).not.toBeNull();
    expect(course!.courseId).toBe(COURSE_ID);
    expect(course!.title).toBe('Mentium Kids Prototype Animals');
  });

  // 3. loadCourse returns null for missing course
  it('3. loadCourse returns null for missing course', () => {
    const course = loadCourse('no-such-course');
    expect(course).toBeNull();
  });

  // 4. loadUnit returns animals unit
  it('4. loadUnit returns animals unit', () => {
    const unit = loadUnit(COURSE_ID, UNIT_ID);
    expect(unit).not.toBeNull();
    expect(unit!.unitId).toBe(UNIT_ID);
    expect(unit!.theme).toBe('animals');
  });

  // 5. loadLesson returns animals lesson
  it('5. loadLesson returns animals lesson', () => {
    const lesson = loadLesson(COURSE_ID, UNIT_ID, LESSON_ID);
    expect(lesson).not.toBeNull();
    expect(lesson!.lessonId).toBe(LESSON_ID);
    expect(lesson!.title).toBe('Zoo Animals Starter');
  });

  // 6. loadItem returns cat item
  it('6. loadItem returns cat item', () => {
    const item = loadItem(COURSE_ID, UNIT_ID, LESSON_ID, CAT_ITEM_ID);
    expect(item).not.toBeNull();
    expect(item!.itemId).toBe(CAT_ITEM_ID);
    expect(item!.targetText).toBe('cat');
  });

  // 7. loadItem returns null for missing item
  it('7. loadItem returns null for missing item', () => {
    const item = loadItem(COURSE_ID, UNIT_ID, LESSON_ID, 'PROTO-ANIM-MISSING');
    expect(item).toBeNull();
  });

  // 8. listLessonItems returns 6 items
  it('8. listLessonItems returns 6 items', () => {
    const items = listLessonItems(COURSE_ID, UNIT_ID, LESSON_ID);
    expect(items).toHaveLength(6);
  });

  // 9. getVocabularyWords returns cat/dog/lion/monkey/elephant/tiger in order
  it('9. getVocabularyWords returns animals in lesson order', () => {
    const words = getVocabularyWords(COURSE_ID, UNIT_ID, LESSON_ID);
    expect(words).toEqual(['cat', 'dog', 'lion', 'monkey', 'elephant', 'tiger']);
  });

  // 10. getVocabularyItems returns 6 vocabulary items
  it('10. getVocabularyItems returns 6 vocabulary items', () => {
    const items = getVocabularyItems(COURSE_ID, UNIT_ID, LESSON_ID);
    expect(items).toHaveLength(6);
    for (const item of items) {
      expect(item.type).toBe('vocabulary');
      expect(Array.isArray(item.acceptedAnswers)).toBe(true);
    }
  });

  // 11. listLessonActivities returns 4 activities
  it('11. listLessonActivities returns 4 activities', () => {
    const activities = listLessonActivities(COURSE_ID, UNIT_ID, LESSON_ID);
    expect(activities).toHaveLength(4);
  });

  // 12. getActivityById returns listen_and_repeat
  it('12. getActivityById returns listen_and_repeat activity', () => {
    const activity = getActivityById(COURSE_ID, UNIT_ID, LESSON_ID, 'proto-anim-listen-repeat');
    expect(activity).not.toBeNull();
    expect(activity!.type).toBe(KidsCurriculumActivityType.LISTEN_AND_REPEAT);
  });

  // 13. getDistractors(cat, 2) returns dog/lion
  it('13. getDistractors(cat, 2) returns dog then lion', () => {
    const distractors = getDistractors(COURSE_ID, UNIT_ID, LESSON_ID, CAT_ITEM_ID, 2);
    expect(distractors).toHaveLength(2);
    expect(distractors[0].targetText).toBe('dog');
    expect(distractors[1].targetText).toBe('lion');
  });

  // 14. getDistractors excludes target
  it('14. getDistractors never includes the target item', () => {
    const distractors = getDistractors(COURSE_ID, UNIT_ID, LESSON_ID, CAT_ITEM_ID, 5);
    const ids = distractors.map(i => i.itemId);
    expect(ids).not.toContain(CAT_ITEM_ID);
  });

  // 15. getDistractors count 0 returns []
  it('15. getDistractors with count=0 returns []', () => {
    const distractors = getDistractors(COURSE_ID, UNIT_ID, LESSON_ID, CAT_ITEM_ID, 0);
    expect(distractors).toEqual([]);
  });

  // 16. getDistractors negative count throws
  it('16. getDistractors with negative count throws', () => {
    expect(() =>
      getDistractors(COURSE_ID, UNIT_ID, LESSON_ID, CAT_ITEM_ID, -1),
    ).toThrow('count must be >= 0');
  });

  // 17. getDistractors missing target returns []
  it('17. getDistractors with missing targetItemId returns []', () => {
    const distractors = getDistractors(COURSE_ID, UNIT_ID, LESSON_ID, 'PROTO-ANIM-GHOST', 3);
    expect(distractors).toEqual([]);
  });

  // 18. getVisualSafeActivities returns only visual-safe activities
  it('18. getVisualSafeActivities returns only allowedWithoutVisualUI=true and requiresVisualUI=false', () => {
    const safe = getVisualSafeActivities(COURSE_ID, UNIT_ID, LESSON_ID);
    expect(safe.length).toBeGreaterThan(0);
    for (const a of safe) {
      expect(a.allowedWithoutVisualUI).toBe(true);
      expect(a.requiresVisualUI).toBe(false);
    }
  });

  // 19. validateRegisteredCurricula returns ok=true
  it('19. validateRegisteredCurricula returns ok=true with no errors', () => {
    const result = validateRegisteredCurricula();
    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  // 20. returned arrays cannot mutate registry state
  it('20. mutating a returned array does not affect the registry', () => {
    const items1 = listLessonItems(COURSE_ID, UNIT_ID, LESSON_ID) as KidsCurriculumItem[];

    // Attempt to mutate the returned array
    (items1 as unknown[]).push({ itemId: 'INJECTED', targetText: 'injected' });

    const items2 = listLessonItems(COURSE_ID, UNIT_ID, LESSON_ID);
    expect(items2).toHaveLength(6);
    const ids = items2.map(i => i.itemId);
    expect(ids).not.toContain('INJECTED');
  });

  // 21. public exports available from index.ts
  it('21. all loader functions exported from curriculum/index.ts', async () => {
    const mod = await import('../index.js');
    expect(typeof mod.listCourses).toBe('function');
    expect(typeof mod.loadCourse).toBe('function');
    expect(typeof mod.loadUnit).toBe('function');
    expect(typeof mod.loadLesson).toBe('function');
    expect(typeof mod.loadItem).toBe('function');
    expect(typeof mod.listLessonItems).toBe('function');
    expect(typeof mod.listLessonActivities).toBe('function');
    expect(typeof mod.getActivityById).toBe('function');
    expect(typeof mod.getVocabularyWords).toBe('function');
    expect(typeof mod.getVocabularyItems).toBe('function');
    expect(typeof mod.getDistractors).toBe('function');
    expect(typeof mod.getVisualSafeActivities).toBe('function');
    expect(typeof mod.getLessonForPrototype).toBe('function');
    expect(typeof mod.validateRegisteredCurricula).toBe('function');
  });

  // 22. no adult runtime imports
  it('22. curriculum-loader.ts has no adult runtime imports', () => {
    const filePath = resolve(join(__dirname, '..', 'curriculum-loader.ts'));
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
          `curriculum-loader.ts must not import from adult module "${forbidden}"`,
        ).not.toContain(forbidden);
      }
    }
  });

  // Bonus: getLessonForPrototype shortcut
  it('getLessonForPrototype returns the prototype animals lesson', () => {
    const lesson = getLessonForPrototype();
    expect(lesson.lessonId).toBe(LESSON_ID);
    expect(lesson.items).toHaveLength(6);
  });

  // Bonus: loadUnit returns null for bad courseId
  it('loadUnit returns null for missing course', () => {
    const unit = loadUnit('no-course', UNIT_ID);
    expect(unit).toBeNull();
  });

  // Bonus: listLessonItems returns [] for unknown lesson
  it('listLessonItems returns [] for unknown lesson', () => {
    const items = listLessonItems(COURSE_ID, UNIT_ID, 'no-such-lesson');
    expect(items).toEqual([]);
  });
});

// Needed for TypeScript to resolve the imported type used in test 20
import type { KidsCurriculumItem } from '../curriculum-types.js';
