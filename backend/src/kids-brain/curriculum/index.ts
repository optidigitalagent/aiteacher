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

// Prototype lesson content
export {
  PROTO_ANIMALS_LESSON,
  PROTO_ANIMALS_UNIT,
  PROTO_ANIMALS_COURSE,
} from './prototype-animals-lesson.js';

// Kid's Box 1 — Unit 1 "Hello!"
export {
  KB1_U01_L01_GREETINGS,
  KB1_U01_L02_COLOURS,
  KB1_U01_L03_NUMBERS,
  KB1_UNIT_01,
  KIDS_BOX_1_COURSE,
} from './kids-box/kids-box-unit-01.js';

// Curriculum loader
export type { CurriculaValidationResult } from './curriculum-loader.js';
export {
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
} from './curriculum-loader.js';
