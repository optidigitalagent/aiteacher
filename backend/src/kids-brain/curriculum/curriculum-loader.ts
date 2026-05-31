import { PROTO_ANIMALS_COURSE } from './prototype-animals-lesson.js';
import { KIDS_BOX_1_COURSE } from './kids-box/kids-box-unit-01.js';
import type {
  KidsCurriculumCourse,
  KidsCurriculumUnit,
  KidsCurriculumLesson,
  KidsCurriculumItem,
  KidsActivityDefinition,
  KidsVocabularyItem,
} from './curriculum-types.js';
import { KidsCurriculumItemType } from './curriculum-types.js';
import {
  validateKidsCurriculumCourse,
  validateKidsCurriculumLesson,
  validateLessonHasNoVisualRequiredActivityWithoutVisualSupport,
} from './curriculum-validators.js';

// ─── Static registry ──────────────────────────────────────────────────────────

const REGISTERED_COURSES: readonly KidsCurriculumCourse[] = Object.freeze([
  PROTO_ANIMALS_COURSE,
  KIDS_BOX_1_COURSE,
]);

// ─── Lookup helpers ───────────────────────────────────────────────────────────

function findCourse(courseId: string): KidsCurriculumCourse | null {
  return REGISTERED_COURSES.find(c => c.courseId === courseId) ?? null;
}

function findUnit(courseId: string, unitId: string): KidsCurriculumUnit | null {
  return findCourse(courseId)?.units.find(u => u.unitId === unitId) ?? null;
}

function findLesson(
  courseId: string,
  unitId: string,
  lessonId: string,
): KidsCurriculumLesson | null {
  return findUnit(courseId, unitId)?.lessons.find(l => l.lessonId === lessonId) ?? null;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function listCourses(): readonly KidsCurriculumCourse[] {
  return [...REGISTERED_COURSES];
}

export function loadCourse(courseId: string): KidsCurriculumCourse | null {
  return findCourse(courseId);
}

export function loadUnit(courseId: string, unitId: string): KidsCurriculumUnit | null {
  return findUnit(courseId, unitId);
}

export function loadLesson(
  courseId: string,
  unitId: string,
  lessonId: string,
): KidsCurriculumLesson | null {
  return findLesson(courseId, unitId, lessonId);
}

export function loadItem(
  courseId: string,
  unitId: string,
  lessonId: string,
  itemId: string,
): KidsCurriculumItem | null {
  const lesson = findLesson(courseId, unitId, lessonId);
  if (!lesson) return null;
  return lesson.items.find(i => i.itemId === itemId) ?? null;
}

export function listLessonItems(
  courseId: string,
  unitId: string,
  lessonId: string,
): readonly KidsCurriculumItem[] {
  const lesson = findLesson(courseId, unitId, lessonId);
  if (!lesson) return [];
  return [...lesson.items];
}

export function listLessonActivities(
  courseId: string,
  unitId: string,
  lessonId: string,
): readonly KidsActivityDefinition[] {
  const lesson = findLesson(courseId, unitId, lessonId);
  if (!lesson) return [];
  return [...lesson.activities];
}

export function getActivityById(
  courseId: string,
  unitId: string,
  lessonId: string,
  activityId: string,
): KidsActivityDefinition | null {
  const lesson = findLesson(courseId, unitId, lessonId);
  if (!lesson) return null;
  return lesson.activities.find(a => a.activityId === activityId) ?? null;
}

export function getVocabularyWords(
  courseId: string,
  unitId: string,
  lessonId: string,
): readonly string[] {
  const lesson = findLesson(courseId, unitId, lessonId);
  if (!lesson) return [];
  return lesson.items
    .filter(i => i.type === KidsCurriculumItemType.VOCABULARY)
    .map(i => i.targetText);
}

export function getVocabularyItems(
  courseId: string,
  unitId: string,
  lessonId: string,
): readonly KidsVocabularyItem[] {
  const lesson = findLesson(courseId, unitId, lessonId);
  if (!lesson) return [];
  return lesson.items.filter(
    (i): i is KidsVocabularyItem => i.type === KidsCurriculumItemType.VOCABULARY,
  );
}

/**
 * Returns up to `count` distractor items from the same lesson, excluding the target.
 * Deterministic: preserves lesson item order.
 * Throws if count < 0.
 */
export function getDistractors(
  courseId: string,
  unitId: string,
  lessonId: string,
  targetItemId: string,
  count: number,
): readonly KidsCurriculumItem[] {
  if (count < 0) throw new Error('getDistractors: count must be >= 0');
  if (count === 0) return [];

  const lesson = findLesson(courseId, unitId, lessonId);
  if (!lesson) return [];

  const targetExists = lesson.items.some(i => i.itemId === targetItemId);
  if (!targetExists) return [];

  return lesson.items.filter(i => i.itemId !== targetItemId).slice(0, count);
}

/**
 * Returns only activities where allowedWithoutVisualUI=true AND requiresVisualUI=false.
 */
export function getVisualSafeActivities(
  courseId: string,
  unitId: string,
  lessonId: string,
): readonly KidsActivityDefinition[] {
  const lesson = findLesson(courseId, unitId, lessonId);
  if (!lesson) return [];
  return lesson.activities.filter(
    a => a.allowedWithoutVisualUI === true && a.requiresVisualUI === false,
  );
}

export function getLessonForPrototype(): KidsCurriculumLesson {
  return PROTO_ANIMALS_COURSE.units[0].lessons[0];
}

/**
 * Finds a lesson by lessonId across all registered courses and units.
 * Returns null if not found.
 */
export function findLessonById(lessonId: string): KidsCurriculumLesson | null {
  for (const course of REGISTERED_COURSES) {
    for (const unit of course.units) {
      const lesson = unit.lessons.find(l => l.lessonId === lessonId);
      if (lesson) return lesson;
    }
  }
  return null;
}

/**
 * Returns exercises for a lesson by lessonId, sorted by order.
 * Returns an empty array if the lesson has no exercises.
 */
export function loadLessonExercises(
  lessonId: string,
): readonly import('./curriculum-types.js').KidsExerciseDefinition[] {
  return findLessonById(lessonId)?.exercises ?? [];
}

// ─── Validation ───────────────────────────────────────────────────────────────

export interface CurriculaValidationResult {
  ok: boolean;
  errors: string[];
}

export function validateRegisteredCurricula(): CurriculaValidationResult {
  const errors: string[] = [];

  for (const course of REGISTERED_COURSES) {
    const courseResult = validateKidsCurriculumCourse(course);
    if (!courseResult.valid) {
      errors.push(...courseResult.errors.map(e => `[${course.courseId}] ${e}`));
    }

    for (const unit of course.units) {
      for (const lesson of unit.lessons) {
        const lessonResult = validateKidsCurriculumLesson(lesson);
        if (!lessonResult.valid) {
          errors.push(
            ...lessonResult.errors.map(e => `[${course.courseId}/${lesson.lessonId}] ${e}`),
          );
        }

        const visualResult = validateLessonHasNoVisualRequiredActivityWithoutVisualSupport(
          lesson,
          false,
        );
        if (!visualResult.valid) {
          errors.push(
            ...visualResult.errors.map(e => `[${course.courseId}/${lesson.lessonId}] ${e}`),
          );
        }
      }
    }
  }

  return { ok: errors.length === 0, errors };
}
