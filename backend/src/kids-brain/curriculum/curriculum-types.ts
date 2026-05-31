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

// ─── Textbook Exercise Enums ──────────────────────────────────────────────────

export enum KidsTextbookActivityType {
  LISTEN_AND_REPEAT = 'listen_and_repeat',
  LISTEN_AND_POINT = 'listen_and_point',
  LISTEN_AND_CHOOSE = 'listen_and_choose',
  ASK_AND_ANSWER = 'ask_and_answer',
  CHANT = 'chant',
  STORY_LISTEN = 'story_listen',
  REVIEW = 'review',
  PHONICS = 'phonics',
  VALUES_DISCUSSION = 'values_discussion',
}

export enum KidsStudentActionType {
  REPEAT_WORD = 'repeat_word',
  SAY_CHOICE = 'say_choice',
  ANSWER_QUESTION = 'answer_question',
  JOIN_CHANT = 'join_chant',
  FREE_PRODUCTION = 'free_production',
  LISTEN_ONLY = 'listen_only',
}

export enum KidsCompletionRuleType {
  CORRECT_REPETITIONS = 'correct_repetitions',
  CORRECT_CHOICE = 'correct_choice',
  ALL_TARGETS_COMPLETED = 'all_targets_completed',
  TEACHER_CONTROLLED = 'teacher_controlled',
  TIME_OR_TURN_LIMIT = 'time_or_turn_limit',
}

export enum KidsRetryEscalationType {
  REPEAT_PROMPT = 'repeat_prompt',
  SIMPLIFY_CHOICES = 'simplify_choices',
  MODEL_ANSWER = 'model_answer',
  ENCOURAGEMENT = 'encouragement',
  MOVE_ON = 'move_on',
}

// ─── Exercise payload types ───────────────────────────────────────────────────

export interface KidsExerciseVisualPayload {
  assets: KidsVisualAssetRef[];
  layoutHint?: string;
}

export interface KidsExerciseAudioPayload {
  assets: KidsAudioAssetRef[];
  playbackOrder?: string[];
}

export interface KidsExercisePrompt {
  text: string;
  ttsText?: string;
}

export interface KidsExerciseChoice {
  choiceId: string;
  text: string;
}

export interface KidsExerciseStep {
  stepId: string;
  order: number;
  instruction: string;
  targetItemId?: string;
}

// ─── Completion rule ──────────────────────────────────────────────────────────

export interface KidsCompletionRule {
  type: KidsCompletionRuleType;
  requiredCorrectCount?: number;
  maxTurns?: number;
  requiredTargetItemIds?: string[];
  allowPartialCompletion: boolean;
}

// ─── Retry policy ─────────────────────────────────────────────────────────────

export interface KidsRetryPolicy {
  maxAttempts: number;
  escalationLadder: KidsRetryEscalationType[];
  fallbackExerciseId: string | null;
  resetOnCorrect: boolean;
}

// ─── Exercise definition ──────────────────────────────────────────────────────

export interface KidsExerciseDefinition {
  exerciseId: string;
  lessonId: string;
  order: number;
  pageRef: string;
  textbookActivityType: KidsTextbookActivityType;
  studentActionType: KidsStudentActionType;
  targetItemIds: string[];
  teacherInstruction: string;
  prompt: KidsExercisePrompt;
  choices: KidsExerciseChoice[];
  expectedAnswers: string[];
  visualPromptPayload?: KidsExerciseVisualPayload;
  audioPromptPayload?: KidsExerciseAudioPayload;
  completionRule: KidsCompletionRule;
  retryPolicy: KidsRetryPolicy;
  nextExerciseId: string | null;
  requiresVisualUI: boolean;
  allowedWithoutVisualUI: boolean;
  tags: string[];
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
  exercises?: KidsExerciseDefinition[];
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
