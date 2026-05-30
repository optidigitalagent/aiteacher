import { KidsCurriculumActivityType } from './curriculum-types.js';

/**
 * Template placeholder variables allowed at authoring time.
 * Any other {token} in a template text is a schema violation.
 * These must ALL be resolved before final teacher output — see validateFinalOutputNoPlaceholders.
 */
export const APPROVED_TEMPLATE_VARIABLES: readonly string[] = [
  '{target}',
  '{choiceA}',
  '{choiceB}',
  '{childName}',
  '{characterName}',
] as const;

// ─── UI safety rules ──────────────────────────────────────────────────────────

export interface ActivityUISafetyRule {
  requiresVisualUI: boolean;
  allowedWithoutVisualUI: boolean;
  /** If set, activity is only allowed for this age band */
  ageBandRestriction?: string;
  notes: string;
}

/**
 * Canonical UI safety rules per curriculum activity type.
 * Activity definitions authored in lesson files must be consistent with these rules.
 * Validators enforce this consistency.
 */
export const ACTIVITY_UI_SAFETY_RULES: Readonly<
  Record<KidsCurriculumActivityType, ActivityUISafetyRule>
> = {
  [KidsCurriculumActivityType.LISTEN_AND_REPEAT]: {
    requiresVisualUI: false,
    allowedWithoutVisualUI: true,
    notes: 'Audio-only safe. Default fallback activity.',
  },
  [KidsCurriculumActivityType.FORCED_CHOICE_AUDIO]: {
    requiresVisualUI: false,
    allowedWithoutVisualUI: true,
    notes: 'Audio-only safe only when spoken choices exist in template.',
  },
  [KidsCurriculumActivityType.FORCED_CHOICE_VISUAL]: {
    requiresVisualUI: true,
    allowedWithoutVisualUI: false,
    notes: 'Requires image cards. Blocked until child UI exists.',
  },
  [KidsCurriculumActivityType.LISTEN_AND_POINT]: {
    requiresVisualUI: true,
    allowedWithoutVisualUI: false,
    notes: 'Requires visual target. Blocked until child UI exists.',
  },
  [KidsCurriculumActivityType.FIND_THE_OBJECT]: {
    requiresVisualUI: true,
    allowedWithoutVisualUI: false,
    notes: 'Requires visual scene. Blocked until child UI exists.',
  },
  [KidsCurriculumActivityType.CHANT]: {
    requiresVisualUI: false,
    allowedWithoutVisualUI: true,
    notes: 'Audio-only safe. No images needed.',
  },
  [KidsCurriculumActivityType.OPEN_ANSWER]: {
    requiresVisualUI: false,
    allowedWithoutVisualUI: true,
    ageBandRestriction: '8-9',
    notes: 'Allowed only for age band 8-9 or in later lesson phases.',
  },
  [KidsCurriculumActivityType.REVIEW_PRODUCTION]: {
    requiresVisualUI: false,
    allowedWithoutVisualUI: true,
    notes: 'Audio-only safe. Used in consolidation and review phases.',
  },
} as const;
