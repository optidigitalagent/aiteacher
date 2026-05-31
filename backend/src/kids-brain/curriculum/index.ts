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
  // Exercise schema types
  KidsExerciseVisualPayload,
  KidsExerciseAudioPayload,
  KidsExercisePrompt,
  KidsExerciseChoice,
  KidsExerciseStep,
  KidsCompletionRule,
  KidsRetryPolicy,
  KidsExerciseDefinition,
} from './curriculum-types.js';

export {
  KidsCurriculumActivityType,
  KidsCurriculumItemType,
  KidsFallbackPolicy,
  // Exercise schema enums
  KidsTextbookActivityType,
  KidsStudentActionType,
  KidsCompletionRuleType,
  KidsRetryEscalationType,
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
  // Exercise validators
  validateKidsExerciseDefinition,
  validateExerciseCompletionRule,
  validateExerciseRetryPolicy,
  validateLessonExercises,
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

// Kid's Box 1 — Course map (metadata only, all 12 units)
export type {
  UnitExtractionStatus,
  KidsBoxPageRange,
  KidsBoxUnitMapEntry,
  KidsBoxReviewBlock,
  KidsBoxCLILSection,
  KidsBox1CourseMap,
} from './kids-box/kids-box-1-course-map.js';
export { KIDS_BOX_1_COURSE_MAP } from './kids-box/kids-box-1-course-map.js';

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
