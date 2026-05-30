import { KidsCurriculumActivityType } from './curriculum-types.js';
import type {
  KidsCurriculumCourse,
  KidsCurriculumLesson,
  KidsActivityDefinition,
  KidsTeacherPromptTemplate,
} from './curriculum-types.js';
import { APPROVED_TEMPLATE_VARIABLES, ACTIVITY_UI_SAFETY_RULES } from './curriculum-schema.js';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

const PLACEHOLDER_REGEX = /\{[^}]+\}/g;

function ok(): ValidationResult {
  return { valid: true, errors: [] };
}

function fail(errors: string[]): ValidationResult {
  return { valid: false, errors };
}

// ─── Course validator ─────────────────────────────────────────────────────────

export function validateKidsCurriculumCourse(course: unknown): ValidationResult {
  if (!course || typeof course !== 'object') {
    return fail(['course must be an object']);
  }
  const c = course as Record<string, unknown>;
  const errors: string[] = [];

  if (!c.courseId || typeof c.courseId !== 'string') errors.push('courseId is required');
  if (!c.version || typeof c.version !== 'string') errors.push('version is required');
  if (!c.title || typeof c.title !== 'string') errors.push('title is required');
  if (!c.source || typeof c.source !== 'string') errors.push('source is required');
  if (!c.cefrLevel || typeof c.cefrLevel !== 'string') errors.push('cefrLevel is required');
  if (!Array.isArray(c.ageBands) || c.ageBands.length === 0) {
    errors.push('ageBands must be a non-empty array');
  }
  if (!Array.isArray(c.units)) errors.push('units must be an array');

  return errors.length ? fail(errors) : ok();
}

// ─── Lesson validator ─────────────────────────────────────────────────────────

export function validateKidsCurriculumLesson(lesson: unknown): ValidationResult {
  if (!lesson || typeof lesson !== 'object') {
    return fail(['lesson must be an object']);
  }
  const l = lesson as Record<string, unknown>;
  const errors: string[] = [];

  if (!l.lessonId || typeof l.lessonId !== 'string') errors.push('lessonId is required');
  if (!l.unitId || typeof l.unitId !== 'string') errors.push('unitId is required');
  if (!l.title || typeof l.title !== 'string') errors.push('title is required');
  if (typeof l.estimatedMinutes !== 'number') errors.push('estimatedMinutes is required');
  if (!Array.isArray(l.allowedAgeBands) || l.allowedAgeBands.length === 0) {
    errors.push('allowedAgeBands must be a non-empty array');
  }
  if (!Array.isArray(l.learningObjectives)) errors.push('learningObjectives must be an array');
  if (!Array.isArray(l.phases) || l.phases.length === 0) {
    errors.push('phases must be a non-empty array');
  }
  if (!Array.isArray(l.items)) errors.push('items must be an array');
  if (!Array.isArray(l.activities)) errors.push('activities must be an array');
  if (!Array.isArray(l.reviewLinks)) errors.push('reviewLinks must be an array');

  if (Array.isArray(l.items)) {
    (l.items as unknown[]).forEach((item, i) => {
      if (!item || typeof item !== 'object') {
        errors.push(`items[${i}] must be an object`);
        return;
      }
      const it = item as Record<string, unknown>;
      if (!it.normalizedAnswer || typeof it.normalizedAnswer !== 'string') {
        errors.push(`items[${i}] is missing normalizedAnswer`);
      }
    });
  }

  return errors.length ? fail(errors) : ok();
}

// ─── Activity validator ───────────────────────────────────────────────────────

export function validateKidsCurriculumActivity(activity: unknown): ValidationResult {
  if (!activity || typeof activity !== 'object') {
    return fail(['activity must be an object']);
  }
  const a = activity as Record<string, unknown>;
  const errors: string[] = [];

  if (!a.activityId || typeof a.activityId !== 'string') errors.push('activityId is required');
  if (
    !a.type ||
    !Object.values(KidsCurriculumActivityType).includes(a.type as KidsCurriculumActivityType)
  ) {
    errors.push('type must be a valid KidsCurriculumActivityType');
  }
  if (!Array.isArray(a.requiredItemTypes)) errors.push('requiredItemTypes must be an array');
  if (typeof a.requiresVisualUI !== 'boolean') errors.push('requiresVisualUI must be a boolean');
  if (typeof a.requiresAudio !== 'boolean') errors.push('requiresAudio must be a boolean');
  if (typeof a.requiresSpeech !== 'boolean') errors.push('requiresSpeech must be a boolean');
  if (typeof a.allowedWithoutVisualUI !== 'boolean') {
    errors.push('allowedWithoutVisualUI must be a boolean');
  }
  if (!Array.isArray(a.promptTemplates)) errors.push('promptTemplates must be an array');
  if (!a.successCriteria || typeof a.successCriteria !== 'string') {
    errors.push('successCriteria is required');
  }
  if (!a.fallbackPolicy) errors.push('fallbackPolicy is required');

  return errors.length ? fail(errors) : ok();
}

// ─── Template placeholder validators ─────────────────────────────────────────

/**
 * Authoring-time check: template text may only contain approved placeholder variables.
 * Unknown {tokens} are schema violations.
 */
export function validateNoPlaceholderLeaks(template: KidsTeacherPromptTemplate): ValidationResult {
  const matches = template.text.match(PLACEHOLDER_REGEX) ?? [];
  const unapproved = matches.filter(p => !APPROVED_TEMPLATE_VARIABLES.includes(p));
  if (unapproved.length > 0) {
    return fail([
      `Template "${template.templateId}" contains unapproved placeholder(s): ${unapproved.join(', ')}`,
    ]);
  }
  return ok();
}

/**
 * Final-output check: no {token} of any kind may appear in rendered teacher text.
 * Even approved variables ({target} etc.) must have been resolved before delivery.
 */
export function validateFinalOutputNoPlaceholders(text: string): ValidationResult {
  const matches = text.match(PLACEHOLDER_REGEX) ?? [];
  if (matches.length > 0) {
    return fail([`Final output contains unresolved placeholder(s): ${matches.join(', ')}`]);
  }
  return ok();
}

// ─── UI safety validators ─────────────────────────────────────────────────────

/**
 * Checks that a single activity definition is consistent with the canonical UI safety rules.
 */
export function validateActivityUISafety(activity: KidsActivityDefinition): ValidationResult {
  const rule = ACTIVITY_UI_SAFETY_RULES[activity.type];
  if (!rule) {
    return fail([`No UI safety rule defined for activity type: ${activity.type}`]);
  }
  const errors: string[] = [];

  if (activity.requiresVisualUI !== rule.requiresVisualUI) {
    errors.push(
      `Activity "${activity.activityId}" requiresVisualUI=${activity.requiresVisualUI} ` +
        `but schema rule says ${rule.requiresVisualUI}`,
    );
  }
  if (activity.allowedWithoutVisualUI !== rule.allowedWithoutVisualUI) {
    errors.push(
      `Activity "${activity.activityId}" allowedWithoutVisualUI=${activity.allowedWithoutVisualUI} ` +
        `but schema rule says ${rule.allowedWithoutVisualUI}`,
    );
  }

  return errors.length ? fail(errors) : ok();
}

/**
 * Checks that a lesson contains no visual-required activities when the child UI
 * has no visual support. Should be called at session start before loading the lesson.
 */
export function validateLessonHasNoVisualRequiredActivityWithoutVisualSupport(
  lesson: KidsCurriculumLesson,
  visualSupport: boolean,
): ValidationResult {
  if (visualSupport) return ok();
  const violations = lesson.activities.filter(a => a.requiresVisualUI);
  if (violations.length > 0) {
    return fail(
      violations.map(
        a =>
          `Activity "${a.activityId}" (${a.type}) requires visual UI but visualSupport=false`,
      ),
    );
  }
  return ok();
}
