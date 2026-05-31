import {
  KidsCurriculumActivityType,
  KidsStudentActionType,
  KidsTextbookActivityType,
  KidsCompletionRuleType,
  KidsRetryEscalationType,
} from './curriculum-types.js';
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

// ─── Exercise validators ──────────────────────────────────────────────────────

const MAX_INSTRUCTION_LENGTH = 200;

/** Action types that must supply at least one expectedAnswer. */
const ANSWER_PRODUCING_ACTIONS = new Set<string>([
  KidsStudentActionType.REPEAT_WORD,
  KidsStudentActionType.SAY_CHOICE,
  KidsStudentActionType.ANSWER_QUESTION,
]);

export function validateExerciseCompletionRule(rule: unknown): ValidationResult {
  if (!rule || typeof rule !== 'object') {
    return fail(['completionRule must be an object']);
  }
  const r = rule as Record<string, unknown>;
  const errors: string[] = [];

  const validTypes = Object.values(KidsCompletionRuleType) as string[];
  if (!r.type || !validTypes.includes(r.type as string)) {
    errors.push('completionRule.type must be a valid KidsCompletionRuleType');
  }
  if (typeof r.allowPartialCompletion !== 'boolean') {
    errors.push('completionRule.allowPartialCompletion must be a boolean');
  }
  if (r.requiredCorrectCount !== undefined && typeof r.requiredCorrectCount !== 'number') {
    errors.push('completionRule.requiredCorrectCount must be a number');
  }
  if (r.maxTurns !== undefined && typeof r.maxTurns !== 'number') {
    errors.push('completionRule.maxTurns must be a number');
  }

  return errors.length ? fail(errors) : ok();
}

export function validateExerciseRetryPolicy(policy: unknown): ValidationResult {
  if (!policy || typeof policy !== 'object') {
    return fail(['retryPolicy must be an object']);
  }
  const p = policy as Record<string, unknown>;
  const errors: string[] = [];

  if (typeof p.maxAttempts !== 'number' || p.maxAttempts < 1) {
    errors.push('retryPolicy.maxAttempts must be a positive number');
  }
  if (!Array.isArray(p.escalationLadder)) {
    errors.push('retryPolicy.escalationLadder must be an array');
  } else {
    const validEscalations = Object.values(KidsRetryEscalationType) as string[];
    const bad = (p.escalationLadder as unknown[]).filter(
      t => typeof t !== 'string' || !validEscalations.includes(t as string),
    );
    if (bad.length > 0) {
      errors.push(`retryPolicy.escalationLadder contains invalid type(s): ${bad.join(', ')}`);
    }
  }
  if (p.fallbackExerciseId !== null && typeof p.fallbackExerciseId !== 'string') {
    errors.push('retryPolicy.fallbackExerciseId must be a string or null');
  }
  if (typeof p.resetOnCorrect !== 'boolean') {
    errors.push('retryPolicy.resetOnCorrect must be a boolean');
  }

  return errors.length ? fail(errors) : ok();
}

export function validateKidsExerciseDefinition(exercise: unknown): ValidationResult {
  if (!exercise || typeof exercise !== 'object') {
    return fail(['exercise must be an object']);
  }
  const e = exercise as Record<string, unknown>;
  const errors: string[] = [];

  if (!e.exerciseId || typeof e.exerciseId !== 'string') errors.push('exerciseId is required');
  if (!e.lessonId || typeof e.lessonId !== 'string') errors.push('lessonId is required');

  if (typeof e.order !== 'number' || e.order < 1) {
    errors.push('order must be a number >= 1');
  }

  if (!e.teacherInstruction || typeof e.teacherInstruction !== 'string') {
    errors.push('teacherInstruction is required');
  } else {
    if (e.teacherInstruction.length > MAX_INSTRUCTION_LENGTH) {
      errors.push(`teacherInstruction must not exceed ${MAX_INSTRUCTION_LENGTH} characters`);
    }
    const matches = e.teacherInstruction.match(PLACEHOLDER_REGEX) ?? [];
    const unapproved = matches.filter(p => !APPROVED_TEMPLATE_VARIABLES.includes(p));
    if (unapproved.length > 0) {
      errors.push(
        `teacherInstruction contains unapproved placeholder(s): ${unapproved.join(', ')}`,
      );
    }
  }

  const validActionTypes = Object.values(KidsStudentActionType) as string[];
  if (!e.studentActionType || !validActionTypes.includes(e.studentActionType as string)) {
    errors.push('studentActionType must be a valid KidsStudentActionType');
  }

  const validActivityTypes = Object.values(KidsTextbookActivityType) as string[];
  if (!e.textbookActivityType || !validActivityTypes.includes(e.textbookActivityType as string)) {
    errors.push('textbookActivityType must be a valid KidsTextbookActivityType');
  }

  if (!e.completionRule || typeof e.completionRule !== 'object') {
    errors.push('completionRule is required');
  } else {
    const ruleResult = validateExerciseCompletionRule(e.completionRule);
    if (!ruleResult.valid) errors.push(...ruleResult.errors);
  }

  if (!e.retryPolicy || typeof e.retryPolicy !== 'object') {
    errors.push('retryPolicy is required');
  } else {
    const policyResult = validateExerciseRetryPolicy(e.retryPolicy);
    if (!policyResult.valid) errors.push(...policyResult.errors);
  }

  if (e.requiresVisualUI === true) {
    if (!e.visualPromptPayload) {
      errors.push('visualPromptPayload is required when requiresVisualUI is true');
    }
    if (e.allowedWithoutVisualUI === true) {
      errors.push('allowedWithoutVisualUI must be false when requiresVisualUI is true');
    }
  }

  if (
    typeof e.studentActionType === 'string' &&
    ANSWER_PRODUCING_ACTIONS.has(e.studentActionType)
  ) {
    if (!Array.isArray(e.expectedAnswers) || (e.expectedAnswers as unknown[]).length === 0) {
      errors.push('expectedAnswers must be a non-empty array for answer-producing action types');
    }
  }

  if (Array.isArray(e.choices)) {
    (e.choices as unknown[]).forEach((choice, i) => {
      if (choice && typeof choice === 'object' && 'isCorrect' in (choice as object)) {
        errors.push(`choices[${i}] must not contain frontend-authoritative field "isCorrect"`);
      }
    });
  }

  return errors.length ? fail(errors) : ok();
}

export function validateLessonExercises(lesson: KidsCurriculumLesson): ValidationResult {
  const exercises = lesson.exercises;
  if (!exercises || exercises.length === 0) return ok();

  const errors: string[] = [];
  const lessonItemIds = new Set(lesson.items.map(it => it.itemId));
  const exerciseIds = new Set<string>();
  const seenOrders = new Set<number>();

  for (let i = 0; i < exercises.length; i++) {
    const ex = exercises[i];

    const defResult = validateKidsExerciseDefinition(ex);
    if (!defResult.valid) {
      errors.push(...defResult.errors.map(err => `exercises[${i}]: ${err}`));
    }

    if (ex.exerciseId) {
      if (exerciseIds.has(ex.exerciseId)) {
        errors.push(`exercises[${i}]: duplicate exerciseId "${ex.exerciseId}"`);
      } else {
        exerciseIds.add(ex.exerciseId);
      }
    }

    if (typeof ex.order === 'number') {
      if (seenOrders.has(ex.order)) {
        errors.push(`exercises[${i}]: duplicate order ${ex.order}`);
      } else {
        seenOrders.add(ex.order);
      }
    }

    if (Array.isArray(ex.targetItemIds)) {
      for (const id of ex.targetItemIds) {
        if (!lessonItemIds.has(id)) {
          errors.push(`exercises[${i}]: targetItemId "${id}" not found in lesson items`);
        }
      }
    }
  }

  // Second pass: validate nextExerciseId cross-references
  for (let i = 0; i < exercises.length; i++) {
    const ex = exercises[i];
    if (ex.nextExerciseId !== null && ex.nextExerciseId !== undefined) {
      if (!exerciseIds.has(ex.nextExerciseId)) {
        errors.push(
          `exercises[${i}]: nextExerciseId "${ex.nextExerciseId}" does not reference an existing exercise`,
        );
      }
    }
  }

  return errors.length ? fail(errors) : ok();
}
