// Types
export type {
  KidsVisualAssetRef,
  KidsAudioAssetRef,
  KidsAcceptedAnswer,
  KidsDistractor,
  KidsReviewLink,
  KidsTeacherPromptTemplate,
  KidsCurriculumItem,
  KidsVocabularyItem,
  KidsActivityDefinition,
  KidsCurriculumPhase,
  KidsCurriculumLesson,
  KidsCurriculumUnit,
  KidsCurriculumCourse,
} from './curriculum-types.js';

export {
  KidsCurriculumActivityType,
  KidsCurriculumItemType,
  KidsFallbackPolicy,
} from './curriculum-types.js';

// Schema constants
export { APPROVED_TEMPLATE_VARIABLES, ACTIVITY_UI_SAFETY_RULES } from './curriculum-schema.js';
export type { ActivityUISafetyRule } from './curriculum-schema.js';

// Validators
export type { ValidationResult } from './curriculum-validators.js';
export {
  validateKidsCurriculumCourse,
  validateKidsCurriculumLesson,
  validateKidsCurriculumActivity,
  validateNoPlaceholderLeaks,
  validateFinalOutputNoPlaceholders,
  validateActivityUISafety,
  validateLessonHasNoVisualRequiredActivityWithoutVisualSupport,
} from './curriculum-validators.js';
