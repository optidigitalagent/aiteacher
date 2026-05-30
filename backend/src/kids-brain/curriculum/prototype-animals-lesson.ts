import { AgeBand, LessonPhase } from '../shared/enums.js';
import {
  KidsCurriculumActivityType,
  KidsCurriculumItemType,
  KidsFallbackPolicy,
} from './curriculum-types.js';
import type {
  KidsCurriculumCourse,
  KidsCurriculumLesson,
  KidsCurriculumPhase,
  KidsCurriculumUnit,
  KidsActivityDefinition,
  KidsReviewLink,
  KidsVocabularyItem,
} from './curriculum-types.js';

// ─── Vocabulary items ─────────────────────────────────────────────────────────

const ITEM_CAT: KidsVocabularyItem = {
  itemId: 'PROTO-ANIM-001',
  type: KidsCurriculumItemType.VOCABULARY,
  targetText: 'cat',
  normalizedAnswer: 'cat',
  l1Translations: { ru: 'кот', uk: 'кіт' },
  visualAsset: { assetId: 'animal-cat-card', assetType: 'image', available: false },
  audioAsset: { assetId: 'animal-cat-tts', assetType: 'tts_prompt', available: true },
  gestures: ['mime_stroking_cat'],
  difficulty: 1,
  tags: ['animal', 'zoo', 'pet', 'starter'],
  article: 'a',
  acceptedAnswers: [
    { text: 'cat', normalized: 'cat', matchType: 'exact' },
    { text: 'a cat', normalized: 'cat', matchType: 'partial' },
  ],
  distractors: [
    { itemId: 'PROTO-ANIM-002', targetText: 'dog', semanticDistance: 'close' },
    { itemId: 'PROTO-ANIM-003', targetText: 'lion', semanticDistance: 'close' },
  ],
  firstPhoneme: 'c-c-c',
  semanticCluster: ['PROTO-ANIM-002', 'PROTO-ANIM-003', 'PROTO-ANIM-004', 'PROTO-ANIM-005'],
};

const ITEM_DOG: KidsVocabularyItem = {
  itemId: 'PROTO-ANIM-002',
  type: KidsCurriculumItemType.VOCABULARY,
  targetText: 'dog',
  normalizedAnswer: 'dog',
  l1Translations: { ru: 'собака', uk: 'собака' },
  visualAsset: { assetId: 'animal-dog-card', assetType: 'image', available: false },
  audioAsset: { assetId: 'animal-dog-tts', assetType: 'tts_prompt', available: true },
  gestures: ['mime_petting_dog'],
  difficulty: 1,
  tags: ['animal', 'zoo', 'pet', 'starter'],
  article: 'a',
  acceptedAnswers: [
    { text: 'dog', normalized: 'dog', matchType: 'exact' },
    { text: 'a dog', normalized: 'dog', matchType: 'partial' },
  ],
  distractors: [
    { itemId: 'PROTO-ANIM-001', targetText: 'cat', semanticDistance: 'close' },
    { itemId: 'PROTO-ANIM-004', targetText: 'monkey', semanticDistance: 'close' },
  ],
  firstPhoneme: 'd-d-d',
  semanticCluster: ['PROTO-ANIM-001', 'PROTO-ANIM-003', 'PROTO-ANIM-004', 'PROTO-ANIM-006'],
};

const ITEM_LION: KidsVocabularyItem = {
  itemId: 'PROTO-ANIM-003',
  type: KidsCurriculumItemType.VOCABULARY,
  targetText: 'lion',
  normalizedAnswer: 'lion',
  l1Translations: { ru: 'лев', uk: 'лев' },
  visualAsset: { assetId: 'animal-lion-card', assetType: 'image', available: false },
  audioAsset: { assetId: 'animal-lion-tts', assetType: 'tts_prompt', available: true },
  gestures: ['mime_lion_shake_mane'],
  difficulty: 2,
  tags: ['animal', 'zoo', 'wild'],
  article: 'a',
  acceptedAnswers: [
    { text: 'lion', normalized: 'lion', matchType: 'exact' },
    { text: 'a lion', normalized: 'lion', matchType: 'partial' },
  ],
  distractors: [
    { itemId: 'PROTO-ANIM-006', targetText: 'tiger', semanticDistance: 'close' },
    { itemId: 'PROTO-ANIM-001', targetText: 'cat', semanticDistance: 'far' },
  ],
  firstPhoneme: 'l-l-l',
  semanticCluster: ['PROTO-ANIM-006', 'PROTO-ANIM-004', 'PROTO-ANIM-001', 'PROTO-ANIM-002'],
};

const ITEM_MONKEY: KidsVocabularyItem = {
  itemId: 'PROTO-ANIM-004',
  type: KidsCurriculumItemType.VOCABULARY,
  targetText: 'monkey',
  normalizedAnswer: 'monkey',
  l1Translations: { ru: 'обезьяна', uk: 'мавпа' },
  visualAsset: { assetId: 'animal-monkey-card', assetType: 'image', available: false },
  audioAsset: { assetId: 'animal-monkey-tts', assetType: 'tts_prompt', available: true },
  gestures: ['mime_monkey_swing'],
  difficulty: 2,
  tags: ['animal', 'zoo', 'wild'],
  article: 'a',
  acceptedAnswers: [
    { text: 'monkey', normalized: 'monkey', matchType: 'exact' },
    { text: 'a monkey', normalized: 'monkey', matchType: 'partial' },
  ],
  distractors: [
    { itemId: 'PROTO-ANIM-003', targetText: 'lion', semanticDistance: 'close' },
    { itemId: 'PROTO-ANIM-006', targetText: 'tiger', semanticDistance: 'close' },
  ],
  firstPhoneme: 'm-m-m',
  semanticCluster: ['PROTO-ANIM-003', 'PROTO-ANIM-006', 'PROTO-ANIM-002', 'PROTO-ANIM-005'],
};

const ITEM_ELEPHANT: KidsVocabularyItem = {
  itemId: 'PROTO-ANIM-005',
  type: KidsCurriculumItemType.VOCABULARY,
  targetText: 'elephant',
  normalizedAnswer: 'elephant',
  l1Translations: { ru: 'слон', uk: 'слон' },
  visualAsset: { assetId: 'animal-elephant-card', assetType: 'image', available: false },
  audioAsset: { assetId: 'animal-elephant-tts', assetType: 'tts_prompt', available: true },
  gestures: ['mime_elephant_trunk'],
  difficulty: 3,
  tags: ['animal', 'zoo', 'wild', 'big'],
  article: 'an',
  acceptedAnswers: [
    { text: 'elephant', normalized: 'elephant', matchType: 'exact' },
    { text: 'an elephant', normalized: 'elephant', matchType: 'partial' },
    { text: 'elefant', normalized: 'elephant', matchType: 'phonetic' },
  ],
  distractors: [
    { itemId: 'PROTO-ANIM-004', targetText: 'monkey', semanticDistance: 'close' },
    { itemId: 'PROTO-ANIM-002', targetText: 'dog', semanticDistance: 'far' },
  ],
  firstPhoneme: 'e-e-e',
  semanticCluster: ['PROTO-ANIM-004', 'PROTO-ANIM-006', 'PROTO-ANIM-003', 'PROTO-ANIM-001'],
};

const ITEM_TIGER: KidsVocabularyItem = {
  itemId: 'PROTO-ANIM-006',
  type: KidsCurriculumItemType.VOCABULARY,
  targetText: 'tiger',
  normalizedAnswer: 'tiger',
  l1Translations: { ru: 'тигр', uk: 'тигр' },
  visualAsset: { assetId: 'animal-tiger-card', assetType: 'image', available: false },
  audioAsset: { assetId: 'animal-tiger-tts', assetType: 'tts_prompt', available: true },
  gestures: ['mime_tiger_claws'],
  difficulty: 2,
  tags: ['animal', 'zoo', 'wild'],
  article: 'a',
  acceptedAnswers: [
    { text: 'tiger', normalized: 'tiger', matchType: 'exact' },
    { text: 'a tiger', normalized: 'tiger', matchType: 'partial' },
  ],
  distractors: [
    { itemId: 'PROTO-ANIM-003', targetText: 'lion', semanticDistance: 'close' },
    { itemId: 'PROTO-ANIM-004', targetText: 'monkey', semanticDistance: 'close' },
  ],
  firstPhoneme: 't-t-t',
  semanticCluster: ['PROTO-ANIM-003', 'PROTO-ANIM-004', 'PROTO-ANIM-001', 'PROTO-ANIM-002'],
};

// ─── Lesson phases ────────────────────────────────────────────────────────────

const LESSON_PHASES: KidsCurriculumPhase[] = [
  {
    phaseId: 'animals-zoo-lesson-001-warm-up',
    type: LessonPhase.WARM_UP,
    order: 1,
    estimatedSeconds: 60,
    allowedActivities: [KidsCurriculumActivityType.LISTEN_AND_REPEAT],
    exitCriteria: 'Child is engaged and listening to teacher.',
  },
  {
    phaseId: 'animals-zoo-lesson-001-introduction',
    type: LessonPhase.INTRODUCTION,
    order: 2,
    estimatedSeconds: 180,
    allowedActivities: [
      KidsCurriculumActivityType.LISTEN_AND_REPEAT,
      KidsCurriculumActivityType.CHANT,
    ],
    exitCriteria: 'All 6 target words have been introduced at least once.',
  },
  {
    phaseId: 'animals-zoo-lesson-001-practice',
    type: LessonPhase.PRACTICE,
    order: 3,
    estimatedSeconds: 240,
    allowedActivities: [
      KidsCurriculumActivityType.LISTEN_AND_REPEAT,
      KidsCurriculumActivityType.FORCED_CHOICE_AUDIO,
    ],
    exitCriteria: 'Child attempts each target word at least twice.',
  },
  {
    phaseId: 'animals-zoo-lesson-001-consolidation',
    type: LessonPhase.CONSOLIDATION,
    order: 4,
    estimatedSeconds: 120,
    allowedActivities: [
      KidsCurriculumActivityType.FORCED_CHOICE_AUDIO,
      KidsCurriculumActivityType.REVIEW_PRODUCTION,
    ],
    exitCriteria: 'Child produces target words with minimal scaffolding.',
  },
  {
    phaseId: 'animals-zoo-lesson-001-close',
    type: LessonPhase.CLOSE,
    order: 5,
    estimatedSeconds: 60,
    allowedActivities: [KidsCurriculumActivityType.REVIEW_PRODUCTION],
    exitCriteria: 'Child celebrates success and lesson closes warmly.',
  },
];

// ─── Activity definitions ─────────────────────────────────────────────────────

const ACTIVITY_LISTEN_AND_REPEAT: KidsActivityDefinition = {
  activityId: 'proto-anim-listen-repeat',
  type: KidsCurriculumActivityType.LISTEN_AND_REPEAT,
  requiredItemTypes: [KidsCurriculumItemType.VOCABULARY],
  requiresVisualUI: false,
  requiresAudio: true,
  requiresSpeech: true,
  allowedWithoutVisualUI: true,
  promptTemplates: [
    {
      templateId: 'listen-repeat-01',
      activityType: KidsCurriculumActivityType.LISTEN_AND_REPEAT,
      text: 'Listen — {target}! Now you!',
      requiresVisualUI: false,
    },
    {
      templateId: 'listen-repeat-02',
      activityType: KidsCurriculumActivityType.LISTEN_AND_REPEAT,
      text: 'Listen carefully — {target}! Your turn!',
      requiresVisualUI: false,
    },
  ],
  successCriteria: 'Child repeats the target word after the teacher model.',
  fallbackPolicy: KidsFallbackPolicy.USE_AUDIO_SAFE_FALLBACK,
};

const ACTIVITY_FORCED_CHOICE_AUDIO: KidsActivityDefinition = {
  activityId: 'proto-anim-forced-choice-audio',
  type: KidsCurriculumActivityType.FORCED_CHOICE_AUDIO,
  requiredItemTypes: [KidsCurriculumItemType.VOCABULARY],
  requiresVisualUI: false,
  requiresAudio: true,
  requiresSpeech: true,
  allowedWithoutVisualUI: true,
  promptTemplates: [
    {
      templateId: 'forced-choice-audio-01',
      activityType: KidsCurriculumActivityType.FORCED_CHOICE_AUDIO,
      text: '{choiceA} or {choiceB}? Which is it?',
      requiresVisualUI: false,
    },
    {
      templateId: 'forced-choice-audio-02',
      activityType: KidsCurriculumActivityType.FORCED_CHOICE_AUDIO,
      text: 'Is it {choiceA} or {choiceB}?',
      requiresVisualUI: false,
    },
  ],
  successCriteria: 'Child correctly identifies the target word from two spoken options.',
  fallbackPolicy: KidsFallbackPolicy.USE_AUDIO_SAFE_FALLBACK,
};

const ACTIVITY_CHANT: KidsActivityDefinition = {
  activityId: 'proto-anim-chant',
  type: KidsCurriculumActivityType.CHANT,
  requiredItemTypes: [KidsCurriculumItemType.VOCABULARY],
  requiresVisualUI: false,
  requiresAudio: true,
  requiresSpeech: true,
  allowedWithoutVisualUI: true,
  promptTemplates: [
    {
      templateId: 'chant-01',
      activityType: KidsCurriculumActivityType.CHANT,
      text: "Let's sing our animal song!",
      requiresVisualUI: false,
    },
    {
      templateId: 'chant-02',
      activityType: KidsCurriculumActivityType.CHANT,
      text: 'Say it with me — {target}!',
      requiresVisualUI: false,
    },
  ],
  successCriteria: 'Child participates in the chant and produces target words.',
  fallbackPolicy: KidsFallbackPolicy.USE_AUDIO_SAFE_FALLBACK,
};

const ACTIVITY_REVIEW_PRODUCTION: KidsActivityDefinition = {
  activityId: 'proto-anim-review-production',
  type: KidsCurriculumActivityType.REVIEW_PRODUCTION,
  requiredItemTypes: [KidsCurriculumItemType.VOCABULARY],
  requiresVisualUI: false,
  requiresAudio: true,
  requiresSpeech: true,
  allowedWithoutVisualUI: true,
  promptTemplates: [
    {
      templateId: 'review-production-01',
      activityType: KidsCurriculumActivityType.REVIEW_PRODUCTION,
      text: 'Say {target} one more time!',
      requiresVisualUI: false,
    },
    {
      templateId: 'review-production-02',
      activityType: KidsCurriculumActivityType.REVIEW_PRODUCTION,
      text: 'Great! Now say {target}!',
      requiresVisualUI: false,
    },
  ],
  successCriteria: 'Child produces the target word independently.',
  fallbackPolicy: KidsFallbackPolicy.USE_AUDIO_SAFE_FALLBACK,
};

// ─── Review links ─────────────────────────────────────────────────────────────
// Simple within-lesson semantic cluster review pairs (no spaced repetition yet).

const REVIEW_LINKS: KidsReviewLink[] = [
  {
    itemId: 'PROTO-ANIM-002',
    sourceUnitId: 'animals-zoo-001',
    sourceLessonId: 'animals-zoo-lesson-001',
    reviewReason: 'semantic_cluster',
  },
  {
    itemId: 'PROTO-ANIM-003',
    sourceUnitId: 'animals-zoo-001',
    sourceLessonId: 'animals-zoo-lesson-001',
    reviewReason: 'semantic_cluster',
  },
  {
    itemId: 'PROTO-ANIM-001',
    sourceUnitId: 'animals-zoo-001',
    sourceLessonId: 'animals-zoo-lesson-001',
    reviewReason: 'semantic_cluster',
  },
  {
    itemId: 'PROTO-ANIM-004',
    sourceUnitId: 'animals-zoo-001',
    sourceLessonId: 'animals-zoo-lesson-001',
    reviewReason: 'semantic_cluster',
  },
];

// ─── Lesson ───────────────────────────────────────────────────────────────────

export const PROTO_ANIMALS_LESSON: KidsCurriculumLesson = {
  lessonId: 'animals-zoo-lesson-001',
  unitId: 'animals-zoo-001',
  title: 'Zoo Animals Starter',
  estimatedMinutes: 12,
  allowedAgeBands: [AgeBand.SIX_SEVEN, AgeBand.EIGHT_NINE],
  learningObjectives: [
    'Recognize 6 animal words: cat, dog, lion, monkey, elephant, tiger',
    'Say 6 animal words clearly',
    'Answer simple forced-choice animal questions',
    'Recover from mistakes without shame',
  ],
  phases: LESSON_PHASES,
  items: [ITEM_CAT, ITEM_DOG, ITEM_LION, ITEM_MONKEY, ITEM_ELEPHANT, ITEM_TIGER],
  activities: [
    ACTIVITY_LISTEN_AND_REPEAT,
    ACTIVITY_FORCED_CHOICE_AUDIO,
    ACTIVITY_CHANT,
    ACTIVITY_REVIEW_PRODUCTION,
  ],
  reviewLinks: REVIEW_LINKS,
};

// ─── Unit ─────────────────────────────────────────────────────────────────────

export const PROTO_ANIMALS_UNIT: KidsCurriculumUnit = {
  unitId: 'animals-zoo-001',
  title: 'At the Zoo',
  theme: 'animals',
  targetAgeBands: [AgeBand.SIX_SEVEN, AgeBand.EIGHT_NINE],
  lessons: [PROTO_ANIMALS_LESSON],
};

// ─── Course ───────────────────────────────────────────────────────────────────

export const PROTO_ANIMALS_COURSE: KidsCurriculumCourse = {
  courseId: 'mentium-kids-prototype-animals',
  version: '1.0.0',
  title: 'Mentium Kids Prototype Animals',
  source: 'mentium-authored-prototype',
  cefrLevel: 'pre-A1',
  ageBands: [AgeBand.SIX_SEVEN, AgeBand.EIGHT_NINE],
  units: [PROTO_ANIMALS_UNIT],
};
