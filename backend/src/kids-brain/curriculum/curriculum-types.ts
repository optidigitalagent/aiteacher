import type { AgeBand, LessonPhase } from '../shared/enums.js';

// ─── Curriculum-facing activity types ────────────────────────────────────────
// Separate from runtime ActivityType — stable authoring layer, runtime maps these.

export enum KidsCurriculumActivityType {
  LISTEN_AND_REPEAT = 'listen_and_repeat',
  FORCED_CHOICE_AUDIO = 'forced_choice_audio',
  FORCED_CHOICE_VISUAL = 'forced_choice_visual',
  LISTEN_AND_POINT = 'listen_and_point',
  FIND_THE_OBJECT = 'find_the_object',
  CHANT = 'chant',
  OPEN_ANSWER = 'open_answer',
  REVIEW_PRODUCTION = 'review_production',
}

export enum KidsCurriculumItemType {
  VOCABULARY = 'vocabulary',
  SENTENCE_FRAME = 'sentence_frame',
  CHANT_LINE = 'chant_line',
}

export enum KidsFallbackPolicy {
  USE_AUDIO_SAFE_FALLBACK = 'use_audio_safe_fallback',
  SKIP_ACTIVITY = 'skip_activity',
  LOWER_DIFFICULTY = 'lower_difficulty',
}

// ─── Asset refs ───────────────────────────────────────────────────────────────

export interface KidsVisualAssetRef {
  assetId: string;
  assetType: 'image' | 'animation';
  /** false = visual UI does not yet support this; block visual prompts */
  available: boolean;
  /** Populated only when asset file exists in repo/CDN */
  url?: string;
}

export interface KidsAudioAssetRef {
  assetId: string;
  assetType: 'sfx' | 'tts_prompt' | 'recorded';
  available: boolean;
  url?: string;
}

// ─── Supporting types ─────────────────────────────────────────────────────────

export interface KidsAcceptedAnswer {
  text: string;
  normalized: string;
  matchType: 'exact' | 'phonetic' | 'partial';
}

export interface KidsDistractor {
  itemId: string;
  targetText: string;
  semanticDistance: 'close' | 'far';
}

/** Cross-reference to a review item from a prior unit or lesson. */
export interface KidsReviewLink {
  itemId: string;
  sourceUnitId: string;
  sourceLessonId: string;
  reviewReason: 'spaced_repetition' | 'semantic_cluster' | 'unit_review';
}

// ─── Teacher prompt template ──────────────────────────────────────────────────

/** A scripted teacher utterance template. May contain approved placeholder variables. */
export interface KidsTeacherPromptTemplate {
  templateId: string;
  activityType: KidsCurriculumActivityType;
  /** Text may contain approved placeholders: {target} {choiceA} {choiceB} {childName} {characterName} */
  text: string;
  requiresVisualUI: boolean;
  /** Undefined = allowed for all age bands */
  ageBandRestriction?: AgeBand;
}

// ─── Curriculum item ──────────────────────────────────────────────────────────

export interface KidsCurriculumItem {
  itemId: string;
  type: KidsCurriculumItemType;
  /** Canonical target text the child should produce (e.g. "cat", "It's a cat") */
  targetText: string;
  /** STT-normalized form used for answer matching */
  normalizedAnswer: string;
  l1Translations: Record<string, string>;
  visualAsset?: KidsVisualAssetRef;
  audioAsset?: KidsAudioAssetRef;
  /** TPR gesture identifiers (e.g. "mime_stroking_cat") */
  gestures: string[];
  difficulty: 1 | 2 | 3;
  tags: string[];
}

/** A vocabulary noun/verb/adjective item — specialisation of KidsCurriculumItem. */
export interface KidsVocabularyItem extends KidsCurriculumItem {
  type: KidsCurriculumItemType.VOCABULARY;
  article?: 'a' | 'an';
  /** All accepted STT surface forms */
  acceptedAnswers: KidsAcceptedAnswer[];
  /** Distractor items for forced-choice activities */
  distractors: KidsDistractor[];
  /** Leading phoneme scaffold (e.g. "c-c-c" for "cat") */
  firstPhoneme: string;
  /** ItemIds of semantically related items in the same cluster */
  semanticCluster: string[];
}

// ─── Activity definition ──────────────────────────────────────────────────────

export interface KidsActivityDefinition {
  activityId: string;
  type: KidsCurriculumActivityType;
  requiredItemTypes: KidsCurriculumItemType[];
  requiresVisualUI: boolean;
  requiresAudio: boolean;
  requiresSpeech: boolean;
  allowedWithoutVisualUI: boolean;
  promptTemplates: KidsTeacherPromptTemplate[];
  /** Human-readable description of what counts as success */
  successCriteria: string;
  fallbackPolicy: KidsFallbackPolicy;
}

// ─── Lesson phase ─────────────────────────────────────────────────────────────

export interface KidsCurriculumPhase {
  phaseId: string;
  /** Maps to the runtime LessonPhase enum */
  type: LessonPhase;
  /** 1-based ordering within the lesson */
  order: number;
  estimatedSeconds: number;
  allowedActivities: KidsCurriculumActivityType[];
  /** Human-readable exit condition */
  exitCriteria: string;
}

// ─── Lesson ───────────────────────────────────────────────────────────────────

export interface KidsCurriculumLesson {
  lessonId: string;
  unitId: string;
  title: string;
  estimatedMinutes: number;
  allowedAgeBands: AgeBand[];
  learningObjectives: string[];
  phases: KidsCurriculumPhase[];
  items: KidsCurriculumItem[];
  activities: KidsActivityDefinition[];
  reviewLinks: KidsReviewLink[];
}

// ─── Unit ─────────────────────────────────────────────────────────────────────

export interface KidsCurriculumUnit {
  unitId: string;
  title: string;
  theme: string;
  targetAgeBands: AgeBand[];
  lessons: KidsCurriculumLesson[];
}

// ─── Course ───────────────────────────────────────────────────────────────────

export interface KidsCurriculumCourse {
  courseId: string;
  version: string;
  title: string;
  /** Content authorship attribution (e.g. "Mentium-original") */
  source: string;
  cefrLevel: string;
  ageBands: AgeBand[];
  units: KidsCurriculumUnit[];
}
