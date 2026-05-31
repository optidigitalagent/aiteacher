import { AgeBand, LessonPhase } from '../../shared/enums.js';
import {
  KidsCurriculumActivityType,
  KidsCurriculumItemType,
  KidsFallbackPolicy,
  KidsTextbookActivityType,
  KidsStudentActionType,
  KidsCompletionRuleType,
  KidsRetryEscalationType,
} from '../curriculum-types.js';
import type {
  KidsCurriculumCourse,
  KidsCurriculumItem,
  KidsCurriculumLesson,
  KidsCurriculumPhase,
  KidsCurriculumUnit,
  KidsActivityDefinition,
  KidsExerciseDefinition,
  KidsReviewLink,
  KidsVocabularyItem,
} from '../curriculum-types.js';

// ─── Source reference ─────────────────────────────────────────────────────────
// Kid's Box 1 (Cambridge University Press, 2nd ed., 2014)
// Unit 1 "Hello!" — Pupil's Book pp. 4–9 | Teacher's Book pp. 13–22
// Copyright-safe extraction: vocabulary items, activity metadata, lesson
// structure, learning objectives, and page references only.
// No full page text, no verbatim story passages, no scanned content stored.

// ─── Lesson 1 vocabulary: Greetings ──────────────────────────────────────────
// PB p. 4–5 | TB pp. 13–15
// Target language: Hello, I'm ..., Goodbye, What's your name?

const ITEM_HELLO: KidsVocabularyItem = {
  itemId: 'KB1-U01-GRT-001',
  type: KidsCurriculumItemType.VOCABULARY,
  targetText: 'hello',
  normalizedAnswer: 'hello',
  l1Translations: { ru: 'привет', uk: 'привіт' },
  visualAsset: { assetId: 'kb1-u01-greeting-hello-card', assetType: 'image', available: false },
  audioAsset: { assetId: 'kb1-u01-greeting-hello-tts', assetType: 'tts_prompt', available: true },
  gestures: ['wave_hello'],
  difficulty: 1,
  tags: ['greeting', 'unit1', 'hello', 'kids-box-1'],
  article: undefined,
  acceptedAnswers: [
    { text: 'hello', normalized: 'hello', matchType: 'exact' },
    { text: 'hi', normalized: 'hello', matchType: 'phonetic' },
  ],
  distractors: [
    { itemId: 'KB1-U01-GRT-002', targetText: 'goodbye', semanticDistance: 'close' },
  ],
  firstPhoneme: 'h-h-h',
  semanticCluster: ['KB1-U01-GRT-002'],
};

const ITEM_GOODBYE: KidsVocabularyItem = {
  itemId: 'KB1-U01-GRT-002',
  type: KidsCurriculumItemType.VOCABULARY,
  targetText: 'goodbye',
  normalizedAnswer: 'goodbye',
  l1Translations: { ru: 'до свидания', uk: 'до побачення' },
  visualAsset: { assetId: 'kb1-u01-greeting-goodbye-card', assetType: 'image', available: false },
  audioAsset: { assetId: 'kb1-u01-greeting-goodbye-tts', assetType: 'tts_prompt', available: true },
  gestures: ['wave_goodbye'],
  difficulty: 1,
  tags: ['greeting', 'unit1', 'goodbye', 'kids-box-1'],
  article: undefined,
  acceptedAnswers: [
    { text: 'goodbye', normalized: 'goodbye', matchType: 'exact' },
    { text: 'bye', normalized: 'goodbye', matchType: 'phonetic' },
    { text: 'bye bye', normalized: 'goodbye', matchType: 'phonetic' },
  ],
  distractors: [
    { itemId: 'KB1-U01-GRT-001', targetText: 'hello', semanticDistance: 'close' },
  ],
  firstPhoneme: 'g-g-g',
  semanticCluster: ['KB1-U01-GRT-001'],
};

// Sentence frames — PB p. 4–5
const ITEM_WHATS_YOUR_NAME: KidsCurriculumItem = {
  itemId: 'KB1-U01-SFR-001',
  type: KidsCurriculumItemType.SENTENCE_FRAME,
  targetText: "What's your name?",
  normalizedAnswer: "what's your name",
  l1Translations: { ru: 'Как тебя зовут?', uk: 'Як тебе звати?' },
  visualAsset: { assetId: 'kb1-u01-sfr-whats-your-name-card', assetType: 'image', available: false },
  audioAsset: { assetId: 'kb1-u01-sfr-whats-your-name-tts', assetType: 'tts_prompt', available: true },
  gestures: ['point_to_other'],
  difficulty: 2,
  tags: ['phrase', 'question', 'unit1', 'kids-box-1'],
};

const ITEM_IM_NAME: KidsCurriculumItem = {
  itemId: 'KB1-U01-SFR-002',
  type: KidsCurriculumItemType.SENTENCE_FRAME,
  targetText: "I'm {childName}.",
  normalizedAnswer: "i'm",
  l1Translations: { ru: 'Меня зовут {childName}.', uk: "Мене звуть {childName}." },
  visualAsset: { assetId: 'kb1-u01-sfr-im-name-card', assetType: 'image', available: false },
  audioAsset: { assetId: 'kb1-u01-sfr-im-name-tts', assetType: 'tts_prompt', available: true },
  gestures: ['point_to_self'],
  difficulty: 2,
  tags: ['phrase', 'introduction', 'unit1', 'kids-box-1'],
};

const ITEM_HOW_ARE_YOU: KidsCurriculumItem = {
  itemId: 'KB1-U01-SFR-003',
  type: KidsCurriculumItemType.SENTENCE_FRAME,
  targetText: "I'm fine, thank you.",
  normalizedAnswer: "i'm fine thank you",
  l1Translations: { ru: 'Я в порядке, спасибо.', uk: 'Я в порядку, дякую.' },
  visualAsset: { assetId: 'kb1-u01-sfr-im-fine-card', assetType: 'image', available: false },
  audioAsset: { assetId: 'kb1-u01-sfr-im-fine-tts', assetType: 'tts_prompt', available: true },
  gestures: ['thumbs_up'],
  difficulty: 2,
  tags: ['phrase', 'wellbeing', 'unit1', 'kids-box-1'],
};

// ─── Lesson 2 vocabulary: Colours ────────────────────────────────────────────
// PB pp. 6–7 | TB p. 17
// Target language: blue, green, pink, purple, red, orange, yellow
// Song: "I can sing a rainbow" (mentioned in TB p. 17 — not stored verbatim)

const ITEM_BLUE: KidsVocabularyItem = {
  itemId: 'KB1-U01-COL-001',
  type: KidsCurriculumItemType.VOCABULARY,
  targetText: 'blue',
  normalizedAnswer: 'blue',
  l1Translations: { ru: 'синий', uk: 'синій' },
  visualAsset: { assetId: 'kb1-u01-colour-blue-card', assetType: 'image', available: false },
  audioAsset: { assetId: 'kb1-u01-colour-blue-tts', assetType: 'tts_prompt', available: true },
  gestures: ['point_blue'],
  difficulty: 1,
  tags: ['colour', 'unit1', 'kids-box-1'],
  article: undefined,
  acceptedAnswers: [
    { text: 'blue', normalized: 'blue', matchType: 'exact' },
  ],
  distractors: [
    { itemId: 'KB1-U01-COL-002', targetText: 'green', semanticDistance: 'close' },
    { itemId: 'KB1-U01-COL-006', targetText: 'red', semanticDistance: 'close' },
  ],
  firstPhoneme: 'b-b-b',
  semanticCluster: ['KB1-U01-COL-002', 'KB1-U01-COL-003', 'KB1-U01-COL-004', 'KB1-U01-COL-005', 'KB1-U01-COL-006', 'KB1-U01-COL-007'],
};

const ITEM_GREEN: KidsVocabularyItem = {
  itemId: 'KB1-U01-COL-002',
  type: KidsCurriculumItemType.VOCABULARY,
  targetText: 'green',
  normalizedAnswer: 'green',
  l1Translations: { ru: 'зелёный', uk: 'зелений' },
  visualAsset: { assetId: 'kb1-u01-colour-green-card', assetType: 'image', available: false },
  audioAsset: { assetId: 'kb1-u01-colour-green-tts', assetType: 'tts_prompt', available: true },
  gestures: ['point_green'],
  difficulty: 1,
  tags: ['colour', 'unit1', 'kids-box-1'],
  article: undefined,
  acceptedAnswers: [
    { text: 'green', normalized: 'green', matchType: 'exact' },
  ],
  distractors: [
    { itemId: 'KB1-U01-COL-001', targetText: 'blue', semanticDistance: 'close' },
    { itemId: 'KB1-U01-COL-005', targetText: 'orange', semanticDistance: 'close' },
  ],
  firstPhoneme: 'g-g-g',
  semanticCluster: ['KB1-U01-COL-001', 'KB1-U01-COL-003', 'KB1-U01-COL-004', 'KB1-U01-COL-005', 'KB1-U01-COL-006', 'KB1-U01-COL-007'],
};

const ITEM_PINK: KidsVocabularyItem = {
  itemId: 'KB1-U01-COL-003',
  type: KidsCurriculumItemType.VOCABULARY,
  targetText: 'pink',
  normalizedAnswer: 'pink',
  l1Translations: { ru: 'розовый', uk: 'рожевий' },
  visualAsset: { assetId: 'kb1-u01-colour-pink-card', assetType: 'image', available: false },
  audioAsset: { assetId: 'kb1-u01-colour-pink-tts', assetType: 'tts_prompt', available: true },
  gestures: ['point_pink'],
  difficulty: 1,
  tags: ['colour', 'unit1', 'kids-box-1'],
  article: undefined,
  acceptedAnswers: [
    { text: 'pink', normalized: 'pink', matchType: 'exact' },
  ],
  distractors: [
    { itemId: 'KB1-U01-COL-004', targetText: 'purple', semanticDistance: 'close' },
    { itemId: 'KB1-U01-COL-006', targetText: 'red', semanticDistance: 'close' },
  ],
  firstPhoneme: 'p-p-p',
  semanticCluster: ['KB1-U01-COL-001', 'KB1-U01-COL-002', 'KB1-U01-COL-004', 'KB1-U01-COL-005', 'KB1-U01-COL-006', 'KB1-U01-COL-007'],
};

const ITEM_PURPLE: KidsVocabularyItem = {
  itemId: 'KB1-U01-COL-004',
  type: KidsCurriculumItemType.VOCABULARY,
  targetText: 'purple',
  normalizedAnswer: 'purple',
  l1Translations: { ru: 'фиолетовый', uk: 'фіолетовий' },
  visualAsset: { assetId: 'kb1-u01-colour-purple-card', assetType: 'image', available: false },
  audioAsset: { assetId: 'kb1-u01-colour-purple-tts', assetType: 'tts_prompt', available: true },
  gestures: ['point_purple'],
  difficulty: 2,
  tags: ['colour', 'unit1', 'kids-box-1'],
  article: undefined,
  acceptedAnswers: [
    { text: 'purple', normalized: 'purple', matchType: 'exact' },
    { text: 'perple', normalized: 'purple', matchType: 'phonetic' },
  ],
  distractors: [
    { itemId: 'KB1-U01-COL-003', targetText: 'pink', semanticDistance: 'close' },
    { itemId: 'KB1-U01-COL-001', targetText: 'blue', semanticDistance: 'close' },
  ],
  firstPhoneme: 'p-p-p',
  semanticCluster: ['KB1-U01-COL-001', 'KB1-U01-COL-002', 'KB1-U01-COL-003', 'KB1-U01-COL-005', 'KB1-U01-COL-006', 'KB1-U01-COL-007'],
};

const ITEM_ORANGE: KidsVocabularyItem = {
  itemId: 'KB1-U01-COL-005',
  type: KidsCurriculumItemType.VOCABULARY,
  targetText: 'orange',
  normalizedAnswer: 'orange',
  l1Translations: { ru: 'оранжевый', uk: 'помаранчевий' },
  visualAsset: { assetId: 'kb1-u01-colour-orange-card', assetType: 'image', available: false },
  audioAsset: { assetId: 'kb1-u01-colour-orange-tts', assetType: 'tts_prompt', available: true },
  gestures: ['point_orange'],
  difficulty: 2,
  tags: ['colour', 'unit1', 'kids-box-1'],
  article: undefined,
  acceptedAnswers: [
    { text: 'orange', normalized: 'orange', matchType: 'exact' },
    { text: 'orinch', normalized: 'orange', matchType: 'phonetic' },
  ],
  distractors: [
    { itemId: 'KB1-U01-COL-006', targetText: 'red', semanticDistance: 'close' },
    { itemId: 'KB1-U01-COL-007', targetText: 'yellow', semanticDistance: 'close' },
  ],
  firstPhoneme: 'o-o-o',
  semanticCluster: ['KB1-U01-COL-001', 'KB1-U01-COL-002', 'KB1-U01-COL-003', 'KB1-U01-COL-004', 'KB1-U01-COL-006', 'KB1-U01-COL-007'],
};

const ITEM_RED: KidsVocabularyItem = {
  itemId: 'KB1-U01-COL-006',
  type: KidsCurriculumItemType.VOCABULARY,
  targetText: 'red',
  normalizedAnswer: 'red',
  l1Translations: { ru: 'красный', uk: 'червоний' },
  visualAsset: { assetId: 'kb1-u01-colour-red-card', assetType: 'image', available: false },
  audioAsset: { assetId: 'kb1-u01-colour-red-tts', assetType: 'tts_prompt', available: true },
  gestures: ['point_red'],
  difficulty: 1,
  tags: ['colour', 'unit1', 'kids-box-1'],
  article: undefined,
  acceptedAnswers: [
    { text: 'red', normalized: 'red', matchType: 'exact' },
  ],
  distractors: [
    { itemId: 'KB1-U01-COL-005', targetText: 'orange', semanticDistance: 'close' },
    { itemId: 'KB1-U01-COL-003', targetText: 'pink', semanticDistance: 'close' },
  ],
  firstPhoneme: 'r-r-r',
  semanticCluster: ['KB1-U01-COL-001', 'KB1-U01-COL-002', 'KB1-U01-COL-003', 'KB1-U01-COL-004', 'KB1-U01-COL-005', 'KB1-U01-COL-007'],
};

const ITEM_YELLOW: KidsVocabularyItem = {
  itemId: 'KB1-U01-COL-007',
  type: KidsCurriculumItemType.VOCABULARY,
  targetText: 'yellow',
  normalizedAnswer: 'yellow',
  l1Translations: { ru: 'жёлтый', uk: 'жовтий' },
  visualAsset: { assetId: 'kb1-u01-colour-yellow-card', assetType: 'image', available: false },
  audioAsset: { assetId: 'kb1-u01-colour-yellow-tts', assetType: 'tts_prompt', available: true },
  gestures: ['point_yellow'],
  difficulty: 1,
  tags: ['colour', 'unit1', 'kids-box-1'],
  article: undefined,
  acceptedAnswers: [
    { text: 'yellow', normalized: 'yellow', matchType: 'exact' },
    { text: 'yello', normalized: 'yellow', matchType: 'phonetic' },
  ],
  distractors: [
    { itemId: 'KB1-U01-COL-005', targetText: 'orange', semanticDistance: 'close' },
    { itemId: 'KB1-U01-COL-002', targetText: 'green', semanticDistance: 'close' },
  ],
  firstPhoneme: 'y-y-y',
  semanticCluster: ['KB1-U01-COL-001', 'KB1-U01-COL-002', 'KB1-U01-COL-003', 'KB1-U01-COL-004', 'KB1-U01-COL-005', 'KB1-U01-COL-006'],
};

// ─── Lesson 3 vocabulary: Numbers 1–10 ───────────────────────────────────────
// PB p. 5 | TB p. 15
// Target language: one, two, three, four, five, six, seven, eight, nine, ten
// Chant: numbers 1–10 (mentioned in TB p. 15 — structure referenced, not stored)

const ITEM_ONE: KidsVocabularyItem = {
  itemId: 'KB1-U01-NUM-001',
  type: KidsCurriculumItemType.VOCABULARY,
  targetText: 'one',
  normalizedAnswer: 'one',
  l1Translations: { ru: 'один', uk: 'один' },
  visualAsset: { assetId: 'kb1-u01-number-1-card', assetType: 'image', available: false },
  audioAsset: { assetId: 'kb1-u01-number-1-tts', assetType: 'tts_prompt', available: true },
  gestures: ['hold_up_1_finger'],
  difficulty: 1,
  tags: ['number', 'unit1', 'kids-box-1', 'phonics-s'],
  article: undefined,
  acceptedAnswers: [
    { text: 'one', normalized: 'one', matchType: 'exact' },
    { text: '1', normalized: 'one', matchType: 'exact' },
  ],
  distractors: [
    { itemId: 'KB1-U01-NUM-002', targetText: 'two', semanticDistance: 'close' },
    { itemId: 'KB1-U01-NUM-003', targetText: 'three', semanticDistance: 'close' },
  ],
  firstPhoneme: 'w-w-w',
  semanticCluster: ['KB1-U01-NUM-002', 'KB1-U01-NUM-003', 'KB1-U01-NUM-004', 'KB1-U01-NUM-005'],
};

const ITEM_TWO: KidsVocabularyItem = {
  itemId: 'KB1-U01-NUM-002',
  type: KidsCurriculumItemType.VOCABULARY,
  targetText: 'two',
  normalizedAnswer: 'two',
  l1Translations: { ru: 'два', uk: 'два' },
  visualAsset: { assetId: 'kb1-u01-number-2-card', assetType: 'image', available: false },
  audioAsset: { assetId: 'kb1-u01-number-2-tts', assetType: 'tts_prompt', available: true },
  gestures: ['hold_up_2_fingers'],
  difficulty: 1,
  tags: ['number', 'unit1', 'kids-box-1'],
  article: undefined,
  acceptedAnswers: [
    { text: 'two', normalized: 'two', matchType: 'exact' },
    { text: '2', normalized: 'two', matchType: 'exact' },
    { text: 'to', normalized: 'two', matchType: 'phonetic' },
    { text: 'too', normalized: 'two', matchType: 'phonetic' },
  ],
  distractors: [
    { itemId: 'KB1-U01-NUM-001', targetText: 'one', semanticDistance: 'close' },
    { itemId: 'KB1-U01-NUM-003', targetText: 'three', semanticDistance: 'close' },
  ],
  firstPhoneme: 't-t-t',
  semanticCluster: ['KB1-U01-NUM-001', 'KB1-U01-NUM-003', 'KB1-U01-NUM-004', 'KB1-U01-NUM-005'],
};

const ITEM_THREE: KidsVocabularyItem = {
  itemId: 'KB1-U01-NUM-003',
  type: KidsCurriculumItemType.VOCABULARY,
  targetText: 'three',
  normalizedAnswer: 'three',
  l1Translations: { ru: 'три', uk: 'три' },
  visualAsset: { assetId: 'kb1-u01-number-3-card', assetType: 'image', available: false },
  audioAsset: { assetId: 'kb1-u01-number-3-tts', assetType: 'tts_prompt', available: true },
  gestures: ['hold_up_3_fingers'],
  difficulty: 1,
  tags: ['number', 'unit1', 'kids-box-1'],
  article: undefined,
  acceptedAnswers: [
    { text: 'three', normalized: 'three', matchType: 'exact' },
    { text: '3', normalized: 'three', matchType: 'exact' },
    { text: 'free', normalized: 'three', matchType: 'phonetic' },
  ],
  distractors: [
    { itemId: 'KB1-U01-NUM-002', targetText: 'two', semanticDistance: 'close' },
    { itemId: 'KB1-U01-NUM-004', targetText: 'four', semanticDistance: 'close' },
  ],
  firstPhoneme: 'th-th-th',
  semanticCluster: ['KB1-U01-NUM-001', 'KB1-U01-NUM-002', 'KB1-U01-NUM-004', 'KB1-U01-NUM-005'],
};

const ITEM_FOUR: KidsVocabularyItem = {
  itemId: 'KB1-U01-NUM-004',
  type: KidsCurriculumItemType.VOCABULARY,
  targetText: 'four',
  normalizedAnswer: 'four',
  l1Translations: { ru: 'четыре', uk: 'чотири' },
  visualAsset: { assetId: 'kb1-u01-number-4-card', assetType: 'image', available: false },
  audioAsset: { assetId: 'kb1-u01-number-4-tts', assetType: 'tts_prompt', available: true },
  gestures: ['hold_up_4_fingers'],
  difficulty: 1,
  tags: ['number', 'unit1', 'kids-box-1'],
  article: undefined,
  acceptedAnswers: [
    { text: 'four', normalized: 'four', matchType: 'exact' },
    { text: '4', normalized: 'four', matchType: 'exact' },
    { text: 'for', normalized: 'four', matchType: 'phonetic' },
  ],
  distractors: [
    { itemId: 'KB1-U01-NUM-003', targetText: 'three', semanticDistance: 'close' },
    { itemId: 'KB1-U01-NUM-005', targetText: 'five', semanticDistance: 'close' },
  ],
  firstPhoneme: 'f-f-f',
  semanticCluster: ['KB1-U01-NUM-002', 'KB1-U01-NUM-003', 'KB1-U01-NUM-005', 'KB1-U01-NUM-006'],
};

const ITEM_FIVE: KidsVocabularyItem = {
  itemId: 'KB1-U01-NUM-005',
  type: KidsCurriculumItemType.VOCABULARY,
  targetText: 'five',
  normalizedAnswer: 'five',
  l1Translations: { ru: 'пять', uk: 'п\'ять' },
  visualAsset: { assetId: 'kb1-u01-number-5-card', assetType: 'image', available: false },
  audioAsset: { assetId: 'kb1-u01-number-5-tts', assetType: 'tts_prompt', available: true },
  gestures: ['hold_up_5_fingers'],
  difficulty: 1,
  tags: ['number', 'unit1', 'kids-box-1'],
  article: undefined,
  acceptedAnswers: [
    { text: 'five', normalized: 'five', matchType: 'exact' },
    { text: '5', normalized: 'five', matchType: 'exact' },
  ],
  distractors: [
    { itemId: 'KB1-U01-NUM-004', targetText: 'four', semanticDistance: 'close' },
    { itemId: 'KB1-U01-NUM-006', targetText: 'six', semanticDistance: 'close' },
  ],
  firstPhoneme: 'f-f-f',
  semanticCluster: ['KB1-U01-NUM-003', 'KB1-U01-NUM-004', 'KB1-U01-NUM-006', 'KB1-U01-NUM-007'],
};

const ITEM_SIX: KidsVocabularyItem = {
  itemId: 'KB1-U01-NUM-006',
  type: KidsCurriculumItemType.VOCABULARY,
  targetText: 'six',
  normalizedAnswer: 'six',
  l1Translations: { ru: 'шесть', uk: 'шість' },
  visualAsset: { assetId: 'kb1-u01-number-6-card', assetType: 'image', available: false },
  audioAsset: { assetId: 'kb1-u01-number-6-tts', assetType: 'tts_prompt', available: true },
  gestures: ['hold_up_5_and_1_fingers'],
  difficulty: 1,
  // Phonics focus: /s/ sound — TB p. 20 "Six stars" tongue twister
  tags: ['number', 'unit1', 'phonics-s', 'kids-box-1'],
  article: undefined,
  acceptedAnswers: [
    { text: 'six', normalized: 'six', matchType: 'exact' },
    { text: '6', normalized: 'six', matchType: 'exact' },
  ],
  distractors: [
    { itemId: 'KB1-U01-NUM-005', targetText: 'five', semanticDistance: 'close' },
    { itemId: 'KB1-U01-NUM-007', targetText: 'seven', semanticDistance: 'close' },
  ],
  firstPhoneme: 's-s-s',
  semanticCluster: ['KB1-U01-NUM-004', 'KB1-U01-NUM-005', 'KB1-U01-NUM-007', 'KB1-U01-NUM-008'],
};

const ITEM_SEVEN: KidsVocabularyItem = {
  itemId: 'KB1-U01-NUM-007',
  type: KidsCurriculumItemType.VOCABULARY,
  targetText: 'seven',
  normalizedAnswer: 'seven',
  l1Translations: { ru: 'семь', uk: 'сім' },
  visualAsset: { assetId: 'kb1-u01-number-7-card', assetType: 'image', available: false },
  audioAsset: { assetId: 'kb1-u01-number-7-tts', assetType: 'tts_prompt', available: true },
  gestures: ['hold_up_5_and_2_fingers'],
  difficulty: 2,
  tags: ['number', 'unit1', 'kids-box-1'],
  article: undefined,
  acceptedAnswers: [
    { text: 'seven', normalized: 'seven', matchType: 'exact' },
    { text: '7', normalized: 'seven', matchType: 'exact' },
    { text: 'sefen', normalized: 'seven', matchType: 'phonetic' },
  ],
  distractors: [
    { itemId: 'KB1-U01-NUM-006', targetText: 'six', semanticDistance: 'close' },
    { itemId: 'KB1-U01-NUM-008', targetText: 'eight', semanticDistance: 'close' },
  ],
  firstPhoneme: 's-s-s',
  semanticCluster: ['KB1-U01-NUM-005', 'KB1-U01-NUM-006', 'KB1-U01-NUM-008', 'KB1-U01-NUM-009'],
};

const ITEM_EIGHT: KidsVocabularyItem = {
  itemId: 'KB1-U01-NUM-008',
  type: KidsCurriculumItemType.VOCABULARY,
  targetText: 'eight',
  normalizedAnswer: 'eight',
  l1Translations: { ru: 'восемь', uk: 'вісім' },
  visualAsset: { assetId: 'kb1-u01-number-8-card', assetType: 'image', available: false },
  audioAsset: { assetId: 'kb1-u01-number-8-tts', assetType: 'tts_prompt', available: true },
  gestures: ['hold_up_5_and_3_fingers'],
  difficulty: 2,
  tags: ['number', 'unit1', 'kids-box-1'],
  article: undefined,
  acceptedAnswers: [
    { text: 'eight', normalized: 'eight', matchType: 'exact' },
    { text: '8', normalized: 'eight', matchType: 'exact' },
    { text: 'ate', normalized: 'eight', matchType: 'phonetic' },
  ],
  distractors: [
    { itemId: 'KB1-U01-NUM-007', targetText: 'seven', semanticDistance: 'close' },
    { itemId: 'KB1-U01-NUM-009', targetText: 'nine', semanticDistance: 'close' },
  ],
  firstPhoneme: 'e-e-e',
  semanticCluster: ['KB1-U01-NUM-006', 'KB1-U01-NUM-007', 'KB1-U01-NUM-009', 'KB1-U01-NUM-010'],
};

const ITEM_NINE: KidsVocabularyItem = {
  itemId: 'KB1-U01-NUM-009',
  type: KidsCurriculumItemType.VOCABULARY,
  targetText: 'nine',
  normalizedAnswer: 'nine',
  l1Translations: { ru: 'девять', uk: 'дев\'ять' },
  visualAsset: { assetId: 'kb1-u01-number-9-card', assetType: 'image', available: false },
  audioAsset: { assetId: 'kb1-u01-number-9-tts', assetType: 'tts_prompt', available: true },
  gestures: ['hold_up_5_and_4_fingers'],
  difficulty: 2,
  tags: ['number', 'unit1', 'kids-box-1'],
  article: undefined,
  acceptedAnswers: [
    { text: 'nine', normalized: 'nine', matchType: 'exact' },
    { text: '9', normalized: 'nine', matchType: 'exact' },
  ],
  distractors: [
    { itemId: 'KB1-U01-NUM-008', targetText: 'eight', semanticDistance: 'close' },
    { itemId: 'KB1-U01-NUM-010', targetText: 'ten', semanticDistance: 'close' },
  ],
  firstPhoneme: 'n-n-n',
  semanticCluster: ['KB1-U01-NUM-007', 'KB1-U01-NUM-008', 'KB1-U01-NUM-010', 'KB1-U01-NUM-006'],
};

const ITEM_TEN: KidsVocabularyItem = {
  itemId: 'KB1-U01-NUM-010',
  type: KidsCurriculumItemType.VOCABULARY,
  targetText: 'ten',
  normalizedAnswer: 'ten',
  l1Translations: { ru: 'десять', uk: 'десять' },
  visualAsset: { assetId: 'kb1-u01-number-10-card', assetType: 'image', available: false },
  audioAsset: { assetId: 'kb1-u01-number-10-tts', assetType: 'tts_prompt', available: true },
  gestures: ['hold_up_10_fingers'],
  difficulty: 2,
  tags: ['number', 'unit1', 'kids-box-1'],
  article: undefined,
  acceptedAnswers: [
    { text: 'ten', normalized: 'ten', matchType: 'exact' },
    { text: '10', normalized: 'ten', matchType: 'exact' },
  ],
  distractors: [
    { itemId: 'KB1-U01-NUM-009', targetText: 'nine', semanticDistance: 'close' },
    { itemId: 'KB1-U01-NUM-008', targetText: 'eight', semanticDistance: 'close' },
  ],
  firstPhoneme: 't-t-t',
  semanticCluster: ['KB1-U01-NUM-007', 'KB1-U01-NUM-008', 'KB1-U01-NUM-009', 'KB1-U01-NUM-006'],
};

// ─── Shared activity definitions ──────────────────────────────────────────────

const ACTIVITY_LISTEN_AND_REPEAT: KidsActivityDefinition = {
  activityId: 'kb1-u01-listen-repeat',
  type: KidsCurriculumActivityType.LISTEN_AND_REPEAT,
  requiredItemTypes: [KidsCurriculumItemType.VOCABULARY],
  requiresVisualUI: false,
  requiresAudio: true,
  requiresSpeech: true,
  allowedWithoutVisualUI: true,
  promptTemplates: [
    {
      templateId: 'kb1-u01-listen-repeat-01',
      activityType: KidsCurriculumActivityType.LISTEN_AND_REPEAT,
      text: 'Listen — {target}! Now you say it!',
      requiresVisualUI: false,
    },
    {
      templateId: 'kb1-u01-listen-repeat-02',
      activityType: KidsCurriculumActivityType.LISTEN_AND_REPEAT,
      text: '{target}! Your turn — say {target}!',
      requiresVisualUI: false,
    },
    {
      templateId: 'kb1-u01-listen-repeat-03',
      activityType: KidsCurriculumActivityType.LISTEN_AND_REPEAT,
      text: "Listen carefully — {target}! Let's say it together!",
      requiresVisualUI: false,
    },
  ],
  successCriteria: 'Child repeats the target word clearly after the teacher model.',
  fallbackPolicy: KidsFallbackPolicy.USE_AUDIO_SAFE_FALLBACK,
};

const ACTIVITY_FORCED_CHOICE_AUDIO: KidsActivityDefinition = {
  activityId: 'kb1-u01-forced-choice-audio',
  type: KidsCurriculumActivityType.FORCED_CHOICE_AUDIO,
  requiredItemTypes: [KidsCurriculumItemType.VOCABULARY],
  requiresVisualUI: false,
  requiresAudio: true,
  requiresSpeech: true,
  allowedWithoutVisualUI: true,
  promptTemplates: [
    {
      templateId: 'kb1-u01-forced-choice-01',
      activityType: KidsCurriculumActivityType.FORCED_CHOICE_AUDIO,
      text: '{choiceA} or {choiceB}? Which one?',
      requiresVisualUI: false,
    },
    {
      templateId: 'kb1-u01-forced-choice-02',
      activityType: KidsCurriculumActivityType.FORCED_CHOICE_AUDIO,
      text: 'Is it {choiceA} or {choiceB}?',
      requiresVisualUI: false,
    },
  ],
  successCriteria: 'Child correctly identifies the target word from two spoken options.',
  fallbackPolicy: KidsFallbackPolicy.USE_AUDIO_SAFE_FALLBACK,
};

const ACTIVITY_CHANT: KidsActivityDefinition = {
  activityId: 'kb1-u01-chant',
  type: KidsCurriculumActivityType.CHANT,
  requiredItemTypes: [KidsCurriculumItemType.VOCABULARY],
  requiresVisualUI: false,
  requiresAudio: true,
  requiresSpeech: true,
  allowedWithoutVisualUI: true,
  promptTemplates: [
    {
      templateId: 'kb1-u01-chant-01',
      activityType: KidsCurriculumActivityType.CHANT,
      text: "Let's say it together — {target}!",
      requiresVisualUI: false,
    },
    {
      templateId: 'kb1-u01-chant-02',
      activityType: KidsCurriculumActivityType.CHANT,
      text: 'Say it with me — {target}!',
      requiresVisualUI: false,
    },
  ],
  successCriteria: 'Child joins in the chant and produces target words rhythmically.',
  fallbackPolicy: KidsFallbackPolicy.USE_AUDIO_SAFE_FALLBACK,
};

const ACTIVITY_REVIEW_PRODUCTION: KidsActivityDefinition = {
  activityId: 'kb1-u01-review-production',
  type: KidsCurriculumActivityType.REVIEW_PRODUCTION,
  requiredItemTypes: [KidsCurriculumItemType.VOCABULARY],
  requiresVisualUI: false,
  requiresAudio: true,
  requiresSpeech: true,
  allowedWithoutVisualUI: true,
  promptTemplates: [
    {
      templateId: 'kb1-u01-review-01',
      activityType: KidsCurriculumActivityType.REVIEW_PRODUCTION,
      text: 'Great! Now say {target} one more time!',
      requiresVisualUI: false,
    },
    {
      templateId: 'kb1-u01-review-02',
      activityType: KidsCurriculumActivityType.REVIEW_PRODUCTION,
      text: 'Well done! One more — {target}!',
      requiresVisualUI: false,
    },
  ],
  successCriteria: 'Child produces the target word independently without scaffolding.',
  fallbackPolicy: KidsFallbackPolicy.USE_AUDIO_SAFE_FALLBACK,
};

// ─── Shared phase builder ─────────────────────────────────────────────────────

function buildStandardPhases(lessonSlug: string): KidsCurriculumPhase[] {
  return [
    {
      phaseId: `${lessonSlug}-warm-up`,
      type: LessonPhase.WARM_UP,
      order: 1,
      estimatedSeconds: 60,
      allowedActivities: [KidsCurriculumActivityType.LISTEN_AND_REPEAT],
      exitCriteria: 'Child is settled and responding to teacher.',
    },
    {
      phaseId: `${lessonSlug}-introduction`,
      type: LessonPhase.INTRODUCTION,
      order: 2,
      estimatedSeconds: 180,
      allowedActivities: [
        KidsCurriculumActivityType.LISTEN_AND_REPEAT,
        KidsCurriculumActivityType.CHANT,
      ],
      exitCriteria: 'All target items introduced at least once.',
    },
    {
      phaseId: `${lessonSlug}-practice`,
      type: LessonPhase.PRACTICE,
      order: 3,
      estimatedSeconds: 240,
      allowedActivities: [
        KidsCurriculumActivityType.LISTEN_AND_REPEAT,
        KidsCurriculumActivityType.FORCED_CHOICE_AUDIO,
      ],
      exitCriteria: 'Child has attempted each target item at least twice.',
    },
    {
      phaseId: `${lessonSlug}-consolidation`,
      type: LessonPhase.CONSOLIDATION,
      order: 4,
      estimatedSeconds: 120,
      allowedActivities: [
        KidsCurriculumActivityType.FORCED_CHOICE_AUDIO,
        KidsCurriculumActivityType.REVIEW_PRODUCTION,
      ],
      exitCriteria: 'Child producing target items with minimal scaffolding.',
    },
    {
      phaseId: `${lessonSlug}-close`,
      type: LessonPhase.CLOSE,
      order: 5,
      estimatedSeconds: 60,
      allowedActivities: [KidsCurriculumActivityType.REVIEW_PRODUCTION],
      exitCriteria: 'Child celebrates success and lesson ends warmly.',
    },
  ];
}

// ─── Lesson 1: Greetings ──────────────────────────────────────────────────────
// PB pp. 4–5 | TB pp. 13–15
// Textbook activities: Listen and point (PB4), Listen and repeat (PB4),
//   Listen and do the actions (PB5), Say the chant — numbers chant (PB5)
// Note: character names (Star family) used as context, not vocabulary targets

const LESSON_1_REVIEW_LINKS: KidsReviewLink[] = [
  {
    itemId: 'KB1-U01-GRT-002',
    sourceUnitId: 'kb1-unit-01',
    sourceLessonId: 'kb1-u01-l01',
    reviewReason: 'semantic_cluster',
  },
  {
    itemId: 'KB1-U01-SFR-001',
    sourceUnitId: 'kb1-unit-01',
    sourceLessonId: 'kb1-u01-l01',
    reviewReason: 'semantic_cluster',
  },
];

export const KB1_U01_L01_GREETINGS: KidsCurriculumLesson = {
  lessonId: 'kb1-u01-l01',
  unitId: 'kb1-unit-01',
  title: 'Hello! Greetings and Names',
  estimatedMinutes: 10,
  allowedAgeBands: [AgeBand.SIX_SEVEN, AgeBand.EIGHT_NINE],
  learningObjectives: [
    'Say hello and goodbye',
    'Introduce yourself with "I\'m [name]"',
    'Ask "What\'s your name?" and respond',
    'Respond to "How are you?" with "I\'m fine, thank you"',
  ],
  phases: buildStandardPhases('kb1-u01-l01'),
  items: [
    ITEM_HELLO,
    ITEM_GOODBYE,
    ITEM_WHATS_YOUR_NAME,
    ITEM_IM_NAME,
    ITEM_HOW_ARE_YOU,
  ],
  activities: [
    ACTIVITY_LISTEN_AND_REPEAT,
    ACTIVITY_CHANT,
    ACTIVITY_FORCED_CHOICE_AUDIO,
    ACTIVITY_REVIEW_PRODUCTION,
  ],
  reviewLinks: LESSON_1_REVIEW_LINKS,
};

// ─── Lesson 2: Colours ────────────────────────────────────────────────────────
// PB pp. 6–7 | TB p. 17
// Textbook activities: Colour flashcards, Sing the song (rainbow song, TB p. 17),
//   Listen and say the colour (PB7), Bingo game (mentioned in TB p. 17)
// Song structure: "red and yellow and pink and green, orange and purple and blue"
//   (not stored verbatim — structure reference only)

const LESSON_2_REVIEW_LINKS: KidsReviewLink[] = [
  {
    itemId: 'KB1-U01-GRT-001',
    sourceUnitId: 'kb1-unit-01',
    sourceLessonId: 'kb1-u01-l01',
    reviewReason: 'unit_review',
  },
  {
    itemId: 'KB1-U01-COL-002',
    sourceUnitId: 'kb1-unit-01',
    sourceLessonId: 'kb1-u01-l02',
    reviewReason: 'semantic_cluster',
  },
  {
    itemId: 'KB1-U01-COL-006',
    sourceUnitId: 'kb1-unit-01',
    sourceLessonId: 'kb1-u01-l02',
    reviewReason: 'semantic_cluster',
  },
];

// ─── Lesson 2 exercise sequence: Colours ─────────────────────────────────────
// PB pp. 6–7 | TB p. 17
// Copyright-safe: own-authored teacher instructions, activity metadata only.
// No verbatim textbook text, no story content, no song lyrics stored.

const LESSON_2_EXERCISES: KidsExerciseDefinition[] = [
  {
    exerciseId: 'kb1-u01-l02-ex-01-readiness',
    lessonId: 'kb1-u01-l02',
    order: 1,
    pageRef: 'PB p.6',
    textbookActivityType: KidsTextbookActivityType.REVIEW,
    studentActionType: KidsStudentActionType.LISTEN_ONLY,
    targetItemIds: [],
    teacherInstruction: "Ready for colours? Great! Let's start!",
    prompt: { text: "Let's learn colours!", ttsText: "Are you ready? Let's learn colours today!" },
    choices: [],
    expectedAnswers: [],
    audioPromptPayload: {
      assets: [{ assetId: 'kb1-u01-l02-readiness-tts', assetType: 'tts_prompt', available: true }],
    },
    completionRule: {
      type: KidsCompletionRuleType.TEACHER_CONTROLLED,
      allowPartialCompletion: false,
    },
    retryPolicy: {
      maxAttempts: 1,
      escalationLadder: [KidsRetryEscalationType.MOVE_ON],
      fallbackExerciseId: null,
      resetOnCorrect: false,
    },
    nextExerciseId: 'kb1-u01-l02-ex-02-blue',
    requiresVisualUI: false,
    allowedWithoutVisualUI: true,
    tags: ['readiness', 'colours', 'unit1', 'kb1-u01-l02'],
  },
  {
    exerciseId: 'kb1-u01-l02-ex-02-blue',
    lessonId: 'kb1-u01-l02',
    order: 2,
    pageRef: 'PB p.6',
    textbookActivityType: KidsTextbookActivityType.LISTEN_AND_REPEAT,
    studentActionType: KidsStudentActionType.REPEAT_WORD,
    targetItemIds: ['KB1-U01-COL-001'],
    teacherInstruction: 'Listen. Blue. Say blue!',
    prompt: { text: 'Listen — blue! Now you!', ttsText: 'Listen — blue! Now you say it!' },
    choices: [],
    expectedAnswers: ['blue'],
    audioPromptPayload: {
      assets: [{ assetId: 'kb1-u01-colour-blue-tts', assetType: 'tts_prompt', available: true }],
    },
    completionRule: {
      type: KidsCompletionRuleType.CORRECT_REPETITIONS,
      requiredCorrectCount: 2,
      allowPartialCompletion: false,
    },
    retryPolicy: {
      maxAttempts: 3,
      escalationLadder: [
        KidsRetryEscalationType.REPEAT_PROMPT,
        KidsRetryEscalationType.MODEL_ANSWER,
        KidsRetryEscalationType.ENCOURAGEMENT,
        KidsRetryEscalationType.MOVE_ON,
      ],
      fallbackExerciseId: null,
      resetOnCorrect: true,
    },
    nextExerciseId: 'kb1-u01-l02-ex-03-green',
    requiresVisualUI: false,
    allowedWithoutVisualUI: true,
    tags: ['listen-and-repeat', 'colour-blue', 'unit1', 'kb1-u01-l02'],
  },
  {
    exerciseId: 'kb1-u01-l02-ex-03-green',
    lessonId: 'kb1-u01-l02',
    order: 3,
    pageRef: 'PB p.6',
    textbookActivityType: KidsTextbookActivityType.LISTEN_AND_REPEAT,
    studentActionType: KidsStudentActionType.REPEAT_WORD,
    targetItemIds: ['KB1-U01-COL-002'],
    teacherInstruction: 'Listen. Green. Say green!',
    prompt: { text: 'Listen — green! Now you!', ttsText: 'Listen — green! Now you say it!' },
    choices: [],
    expectedAnswers: ['green'],
    audioPromptPayload: {
      assets: [{ assetId: 'kb1-u01-colour-green-tts', assetType: 'tts_prompt', available: true }],
    },
    completionRule: {
      type: KidsCompletionRuleType.CORRECT_REPETITIONS,
      requiredCorrectCount: 2,
      allowPartialCompletion: false,
    },
    retryPolicy: {
      maxAttempts: 3,
      escalationLadder: [
        KidsRetryEscalationType.REPEAT_PROMPT,
        KidsRetryEscalationType.MODEL_ANSWER,
        KidsRetryEscalationType.ENCOURAGEMENT,
        KidsRetryEscalationType.MOVE_ON,
      ],
      fallbackExerciseId: null,
      resetOnCorrect: true,
    },
    nextExerciseId: 'kb1-u01-l02-ex-04-red',
    requiresVisualUI: false,
    allowedWithoutVisualUI: true,
    tags: ['listen-and-repeat', 'colour-green', 'unit1', 'kb1-u01-l02'],
  },
  {
    exerciseId: 'kb1-u01-l02-ex-04-red',
    lessonId: 'kb1-u01-l02',
    order: 4,
    pageRef: 'PB p.6',
    textbookActivityType: KidsTextbookActivityType.LISTEN_AND_REPEAT,
    studentActionType: KidsStudentActionType.REPEAT_WORD,
    targetItemIds: ['KB1-U01-COL-006'],
    teacherInstruction: 'Listen. Red. Say red!',
    prompt: { text: 'Listen — red! Now you!', ttsText: 'Listen — red! Now you say it!' },
    choices: [],
    expectedAnswers: ['red'],
    audioPromptPayload: {
      assets: [{ assetId: 'kb1-u01-colour-red-tts', assetType: 'tts_prompt', available: true }],
    },
    completionRule: {
      type: KidsCompletionRuleType.CORRECT_REPETITIONS,
      requiredCorrectCount: 2,
      allowPartialCompletion: false,
    },
    retryPolicy: {
      maxAttempts: 3,
      escalationLadder: [
        KidsRetryEscalationType.REPEAT_PROMPT,
        KidsRetryEscalationType.MODEL_ANSWER,
        KidsRetryEscalationType.ENCOURAGEMENT,
        KidsRetryEscalationType.MOVE_ON,
      ],
      fallbackExerciseId: null,
      resetOnCorrect: true,
    },
    nextExerciseId: 'kb1-u01-l02-ex-05-yellow',
    requiresVisualUI: false,
    allowedWithoutVisualUI: true,
    tags: ['listen-and-repeat', 'colour-red', 'unit1', 'kb1-u01-l02'],
  },
  {
    exerciseId: 'kb1-u01-l02-ex-05-yellow',
    lessonId: 'kb1-u01-l02',
    order: 5,
    pageRef: 'PB p.6',
    textbookActivityType: KidsTextbookActivityType.LISTEN_AND_REPEAT,
    studentActionType: KidsStudentActionType.REPEAT_WORD,
    targetItemIds: ['KB1-U01-COL-007'],
    teacherInstruction: 'Listen. Yellow. Say yellow!',
    prompt: { text: 'Listen — yellow! Now you!', ttsText: 'Listen — yellow! Now you say it!' },
    choices: [],
    expectedAnswers: ['yellow'],
    audioPromptPayload: {
      assets: [{ assetId: 'kb1-u01-colour-yellow-tts', assetType: 'tts_prompt', available: true }],
    },
    completionRule: {
      type: KidsCompletionRuleType.CORRECT_REPETITIONS,
      requiredCorrectCount: 2,
      allowPartialCompletion: false,
    },
    retryPolicy: {
      maxAttempts: 3,
      escalationLadder: [
        KidsRetryEscalationType.REPEAT_PROMPT,
        KidsRetryEscalationType.MODEL_ANSWER,
        KidsRetryEscalationType.ENCOURAGEMENT,
        KidsRetryEscalationType.MOVE_ON,
      ],
      fallbackExerciseId: null,
      resetOnCorrect: true,
    },
    nextExerciseId: 'kb1-u01-l02-ex-06-choose-pair-1',
    requiresVisualUI: false,
    allowedWithoutVisualUI: true,
    tags: ['listen-and-repeat', 'colour-yellow', 'unit1', 'kb1-u01-l02'],
  },
  {
    exerciseId: 'kb1-u01-l02-ex-06-choose-pair-1',
    lessonId: 'kb1-u01-l02',
    order: 6,
    pageRef: 'PB p.7',
    textbookActivityType: KidsTextbookActivityType.LISTEN_AND_CHOOSE,
    studentActionType: KidsStudentActionType.SAY_CHOICE,
    targetItemIds: ['KB1-U01-COL-001', 'KB1-U01-COL-002'],
    teacherInstruction: 'Blue or green? Which one?',
    prompt: { text: 'Blue or green?', ttsText: 'Blue or green? Which colour is it?' },
    choices: [
      { choiceId: 'choice-blue', text: 'blue' },
      { choiceId: 'choice-green', text: 'green' },
    ],
    expectedAnswers: ['blue'],
    audioPromptPayload: {
      assets: [{ assetId: 'kb1-u01-colour-blue-tts', assetType: 'tts_prompt', available: true }],
    },
    completionRule: {
      type: KidsCompletionRuleType.CORRECT_CHOICE,
      requiredCorrectCount: 1,
      allowPartialCompletion: false,
    },
    retryPolicy: {
      maxAttempts: 2,
      escalationLadder: [
        KidsRetryEscalationType.REPEAT_PROMPT,
        KidsRetryEscalationType.MODEL_ANSWER,
        KidsRetryEscalationType.MOVE_ON,
      ],
      fallbackExerciseId: null,
      resetOnCorrect: true,
    },
    nextExerciseId: 'kb1-u01-l02-ex-07-choose-pair-2',
    requiresVisualUI: false,
    allowedWithoutVisualUI: true,
    tags: ['listen-and-choose', 'colour-blue', 'colour-green', 'unit1', 'kb1-u01-l02'],
  },
  {
    exerciseId: 'kb1-u01-l02-ex-07-choose-pair-2',
    lessonId: 'kb1-u01-l02',
    order: 7,
    pageRef: 'PB p.7',
    textbookActivityType: KidsTextbookActivityType.LISTEN_AND_CHOOSE,
    studentActionType: KidsStudentActionType.SAY_CHOICE,
    targetItemIds: ['KB1-U01-COL-003', 'KB1-U01-COL-004'],
    teacherInstruction: 'Pink or purple? Which one?',
    prompt: { text: 'Pink or purple?', ttsText: 'Pink or purple? Which colour is it?' },
    choices: [
      { choiceId: 'choice-pink', text: 'pink' },
      { choiceId: 'choice-purple', text: 'purple' },
    ],
    expectedAnswers: ['pink'],
    audioPromptPayload: {
      assets: [{ assetId: 'kb1-u01-colour-pink-tts', assetType: 'tts_prompt', available: true }],
    },
    completionRule: {
      type: KidsCompletionRuleType.CORRECT_CHOICE,
      requiredCorrectCount: 1,
      allowPartialCompletion: false,
    },
    retryPolicy: {
      maxAttempts: 2,
      escalationLadder: [
        KidsRetryEscalationType.REPEAT_PROMPT,
        KidsRetryEscalationType.MODEL_ANSWER,
        KidsRetryEscalationType.MOVE_ON,
      ],
      fallbackExerciseId: null,
      resetOnCorrect: true,
    },
    nextExerciseId: 'kb1-u01-l02-ex-08-say-review',
    requiresVisualUI: false,
    allowedWithoutVisualUI: true,
    tags: ['listen-and-choose', 'colour-pink', 'colour-purple', 'unit1', 'kb1-u01-l02'],
  },
  {
    exerciseId: 'kb1-u01-l02-ex-08-say-review',
    lessonId: 'kb1-u01-l02',
    order: 8,
    pageRef: 'PB p.7',
    textbookActivityType: KidsTextbookActivityType.REVIEW,
    studentActionType: KidsStudentActionType.FREE_PRODUCTION,
    targetItemIds: [
      'KB1-U01-COL-001',
      'KB1-U01-COL-002',
      'KB1-U01-COL-003',
      'KB1-U01-COL-004',
      'KB1-U01-COL-005',
      'KB1-U01-COL-006',
      'KB1-U01-COL-007',
    ],
    teacherInstruction: "Let's say the colours!",
    prompt: { text: 'Say the colours!', ttsText: 'Now say all the colours with me!' },
    choices: [],
    expectedAnswers: [],
    audioPromptPayload: {
      assets: [{ assetId: 'kb1-u01-l02-review-tts', assetType: 'tts_prompt', available: true }],
    },
    completionRule: {
      type: KidsCompletionRuleType.TEACHER_CONTROLLED,
      allowPartialCompletion: true,
    },
    retryPolicy: {
      maxAttempts: 2,
      escalationLadder: [
        KidsRetryEscalationType.ENCOURAGEMENT,
        KidsRetryEscalationType.MOVE_ON,
      ],
      fallbackExerciseId: null,
      resetOnCorrect: false,
    },
    nextExerciseId: 'kb1-u01-l02-ex-09-chant',
    requiresVisualUI: false,
    allowedWithoutVisualUI: true,
    tags: ['review', 'all-colours', 'unit1', 'kb1-u01-l02'],
  },
  {
    exerciseId: 'kb1-u01-l02-ex-09-chant',
    lessonId: 'kb1-u01-l02',
    order: 9,
    pageRef: 'PB p.7',
    textbookActivityType: KidsTextbookActivityType.CHANT,
    studentActionType: KidsStudentActionType.JOIN_CHANT,
    targetItemIds: [
      'KB1-U01-COL-001',
      'KB1-U01-COL-002',
      'KB1-U01-COL-003',
      'KB1-U01-COL-004',
      'KB1-U01-COL-005',
      'KB1-U01-COL-006',
      'KB1-U01-COL-007',
    ],
    teacherInstruction: "Let's say the colours!",
    prompt: {
      text: 'Chant the colours!',
      ttsText: 'Say the colours with me — blue, green, pink, purple, orange, red, yellow!',
    },
    choices: [],
    expectedAnswers: [],
    audioPromptPayload: {
      assets: [{ assetId: 'kb1-u01-l02-chant-tts', assetType: 'tts_prompt', available: true }],
    },
    completionRule: {
      type: KidsCompletionRuleType.TEACHER_CONTROLLED,
      allowPartialCompletion: true,
    },
    retryPolicy: {
      maxAttempts: 2,
      escalationLadder: [
        KidsRetryEscalationType.ENCOURAGEMENT,
        KidsRetryEscalationType.MOVE_ON,
      ],
      fallbackExerciseId: null,
      resetOnCorrect: false,
    },
    nextExerciseId: 'kb1-u01-l02-ex-10-close',
    requiresVisualUI: false,
    allowedWithoutVisualUI: true,
    tags: ['chant', 'all-colours', 'unit1', 'kb1-u01-l02'],
  },
  {
    exerciseId: 'kb1-u01-l02-ex-10-close',
    lessonId: 'kb1-u01-l02',
    order: 10,
    pageRef: 'PB p.7',
    textbookActivityType: KidsTextbookActivityType.REVIEW,
    studentActionType: KidsStudentActionType.LISTEN_ONLY,
    targetItemIds: [],
    teacherInstruction: 'Great work! We finished colours today.',
    prompt: { text: 'Well done! Colours done!', ttsText: 'Well done! We finished colours today. Great job!' },
    choices: [],
    expectedAnswers: [],
    audioPromptPayload: {
      assets: [{ assetId: 'kb1-u01-l02-close-tts', assetType: 'tts_prompt', available: true }],
    },
    completionRule: {
      type: KidsCompletionRuleType.TEACHER_CONTROLLED,
      allowPartialCompletion: false,
    },
    retryPolicy: {
      maxAttempts: 1,
      escalationLadder: [KidsRetryEscalationType.MOVE_ON],
      fallbackExerciseId: null,
      resetOnCorrect: false,
    },
    nextExerciseId: null,
    requiresVisualUI: false,
    allowedWithoutVisualUI: true,
    tags: ['close', 'colours', 'unit1', 'kb1-u01-l02'],
  },
];

export const KB1_U01_L02_COLOURS: KidsCurriculumLesson = {
  lessonId: 'kb1-u01-l02',
  unitId: 'kb1-unit-01',
  title: 'Colours — Blue, Green, Pink, Purple, Red, Orange, Yellow',
  estimatedMinutes: 12,
  allowedAgeBands: [AgeBand.SIX_SEVEN, AgeBand.EIGHT_NINE],
  learningObjectives: [
    'Recognise and say 7 colours: blue, green, pink, purple, red, orange, yellow',
    'Answer "What colour is it? / It\'s [colour]"',
    'Distinguish similar colours (pink vs purple, blue vs green)',
    'Join in a rainbow colours chant',
  ],
  phases: buildStandardPhases('kb1-u01-l02'),
  items: [
    ITEM_BLUE,
    ITEM_GREEN,
    ITEM_PINK,
    ITEM_PURPLE,
    ITEM_ORANGE,
    ITEM_RED,
    ITEM_YELLOW,
  ],
  activities: [
    ACTIVITY_LISTEN_AND_REPEAT,
    ACTIVITY_CHANT,
    ACTIVITY_FORCED_CHOICE_AUDIO,
    ACTIVITY_REVIEW_PRODUCTION,
  ],
  reviewLinks: LESSON_2_REVIEW_LINKS,
  exercises: LESSON_2_EXERCISES,
};

// ─── Lesson 3: Numbers 1–10 ───────────────────────────────────────────────────
// PB p. 5 | TB pp. 15
// Textbook activities: Display number flashcards, count on fingers (TB p. 15),
//   Say the chant — numbers 1–10 (PB5), "Six stars" /s/ phonics tongue twister (PB8)
// Key phonics: /s/ sound in "six" and "star" (TB pp. 19–20)
// Note: "How old are you? / I'm [number]." question pattern (TB p. 20)

const LESSON_3_REVIEW_LINKS: KidsReviewLink[] = [
  {
    itemId: 'KB1-U01-GRT-001',
    sourceUnitId: 'kb1-unit-01',
    sourceLessonId: 'kb1-u01-l01',
    reviewReason: 'unit_review',
  },
  {
    itemId: 'KB1-U01-COL-001',
    sourceUnitId: 'kb1-unit-01',
    sourceLessonId: 'kb1-u01-l02',
    reviewReason: 'unit_review',
  },
  {
    itemId: 'KB1-U01-NUM-006',
    sourceUnitId: 'kb1-unit-01',
    sourceLessonId: 'kb1-u01-l03',
    reviewReason: 'semantic_cluster',
  },
];

export const KB1_U01_L03_NUMBERS: KidsCurriculumLesson = {
  lessonId: 'kb1-u01-l03',
  unitId: 'kb1-unit-01',
  title: 'Numbers 1–10',
  estimatedMinutes: 12,
  allowedAgeBands: [AgeBand.SIX_SEVEN, AgeBand.EIGHT_NINE],
  learningObjectives: [
    'Count from one to ten in English',
    'Recognise and say number words one through ten',
    'Answer "How old are you? / I\'m [number]"',
    'Practise the /s/ sound through the "six" phonics focus',
  ],
  phases: buildStandardPhases('kb1-u01-l03'),
  items: [
    ITEM_ONE,
    ITEM_TWO,
    ITEM_THREE,
    ITEM_FOUR,
    ITEM_FIVE,
    ITEM_SIX,
    ITEM_SEVEN,
    ITEM_EIGHT,
    ITEM_NINE,
    ITEM_TEN,
  ],
  activities: [
    ACTIVITY_LISTEN_AND_REPEAT,
    ACTIVITY_CHANT,
    ACTIVITY_FORCED_CHOICE_AUDIO,
    ACTIVITY_REVIEW_PRODUCTION,
  ],
  reviewLinks: LESSON_3_REVIEW_LINKS,
};

// ─── Unit ─────────────────────────────────────────────────────────────────────
// Kid's Box 1, Unit 1 "Hello!" — PB pp. 4–9, TB pp. 13–22
// CEFR: pre-A1 | Ages: 6–9

export const KB1_UNIT_01: KidsCurriculumUnit = {
  unitId: 'kb1-unit-01',
  title: 'Hello!',
  theme: 'greetings-and-colours',
  targetAgeBands: [AgeBand.SIX_SEVEN, AgeBand.EIGHT_NINE],
  lessons: [KB1_U01_L01_GREETINGS, KB1_U01_L02_COLOURS, KB1_U01_L03_NUMBERS],
};

// ─── Course ───────────────────────────────────────────────────────────────────
// Source: Kid's Box 1, Cambridge University Press, 2nd Edition, 2014
// ISBN: 978-1-107-61757-5 (Pupil's Book), 978-1-107-63625-5 (Teacher's Book)
// Curriculum extracted for educational AI use — vocabulary and structure only.

export const KIDS_BOX_1_COURSE: KidsCurriculumCourse = {
  courseId: 'cambridge-kids-box-1',
  version: '1.0.0',
  title: "Kid's Box 1",
  source: 'cambridge-kids-box-1-2ed',
  cefrLevel: 'pre-A1',
  ageBands: [AgeBand.SIX_SEVEN, AgeBand.EIGHT_NINE],
  units: [KB1_UNIT_01],
};
