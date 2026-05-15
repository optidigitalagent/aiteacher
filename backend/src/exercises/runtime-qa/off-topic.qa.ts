// Off-Topic Recovery QA Scenarios
// Covers: vocabulary question, grammar explanation request, random side question.
// Critical: brief answer, return to current item, correction state preserved, no advancement.

import type { QAScenario } from './qa-types.js'

export interface OffTopicScenario {
  readonly scenarioId: string
  readonly exerciseType: string
  readonly title: string
  readonly activeItem: string
  readonly itemIndex: number
  readonly studentOffTopicMessage: string
  readonly correctionStateBeforeOffTopic: {
    retryCount: number
    inCorrectionLadder: boolean
  }
  readonly expectedTeacherResponse: {
    answersOffTopicBriefly: boolean
    returnsToCurrentItem: boolean
    preservesCorrectionState: boolean
    noAccidentalAdvancement: boolean
    noExerciseRestart: boolean
    usesOffTopicRecoverySuffix: boolean
  }
  readonly forbiddenBehaviors: string[]
  readonly criticalChecks: string[]
}

export const VOCABULARY_MEANING_OFF_TOPIC: OffTopicScenario = {
  scenarioId: 'off_topic_001',
  exerciseType: 'fill_gap',
  title: 'Off-topic: vocabulary meaning during fill_gap',
  activeItem: 'She ___ (be) a teacher for ten years.',
  itemIndex: 2,
  studentOffTopicMessage: 'What does "decade" mean?',
  correctionStateBeforeOffTopic: { retryCount: 0, inCorrectionLadder: false },
  expectedTeacherResponse: {
    answersOffTopicBriefly: true,
    returnsToCurrentItem: true,
    preservesCorrectionState: true,
    noAccidentalAdvancement: true,
    noExerciseRestart: true,
    usesOffTopicRecoverySuffix: true,
  },
  forbiddenBehaviors: [
    'advance_during_off_topic',
    'ignore_off_topic_redirect',
    'restart the exercise',
    'lose itemIndex=2 after off-topic',
    'give long lecture on vocabulary',
  ],
  criticalChecks: [
    'buildOffTopicRecovery() returns non-empty string for fill_gap',
    'recovery suffix injected into AI input',
    'itemIndex is 2 after off-topic response',
    'correctionTurn unchanged after off-topic',
    'teacher returns to item 3 question after answer',
  ],
}

export const GRAMMAR_EXPLANATION_OFF_TOPIC: OffTopicScenario = {
  scenarioId: 'off_topic_002',
  exerciseType: 'complete_correct_form',
  title: 'Off-topic: grammar explanation request during exercise',
  activeItem: 'They ___ (not/see) each other since school.',
  itemIndex: 0,
  studentOffTopicMessage: 'Can you explain present perfect to me?',
  correctionStateBeforeOffTopic: { retryCount: 1, inCorrectionLadder: true },
  expectedTeacherResponse: {
    answersOffTopicBriefly: true,
    returnsToCurrentItem: true,
    preservesCorrectionState: true,
    noAccidentalAdvancement: true,
    noExerciseRestart: true,
    usesOffTopicRecoverySuffix: true,
  },
  forbiddenBehaviors: [
    'advance_during_off_topic',
    'reset correctionTurn to 0 on off-topic',
    'restart exercise from item 0',
    'give full grammar lecture instead of brief answer',
  ],
  criticalChecks: [
    'retryCount remains 1 after off-topic',
    'itemIndex remains 0 after off-topic',
    'teacher returns to TURN_B level (not TURN_A) after off-topic',
    'off-topic suffix: "Let\'s come back to item 1 now."',
  ],
}

export const RANDOM_QUESTION_OFF_TOPIC: OffTopicScenario = {
  scenarioId: 'off_topic_003',
  exerciseType: 'matching',
  title: 'Off-topic: random question during matching',
  activeItem: '1. enormous',
  itemIndex: 0,
  studentOffTopicMessage: 'What is the capital of France?',
  correctionStateBeforeOffTopic: { retryCount: 0, inCorrectionLadder: false },
  expectedTeacherResponse: {
    answersOffTopicBriefly: true,
    returnsToCurrentItem: true,
    preservesCorrectionState: true,
    noAccidentalAdvancement: true,
    noExerciseRestart: true,
    usesOffTopicRecoverySuffix: true,
  },
  forbiddenBehaviors: [
    'advance_during_off_topic',
    'run_without_options after off-topic',
    'ask_all_pairs_at_once after off-topic',
    'lose matching options on off-topic',
  ],
  criticalChecks: [
    'matching options still visible after off-topic',
    'teacher asks: "Which option matches \'enormous\'?"',
    'itemIndex remains 0',
  ],
}

export const OFF_TOPIC_DURING_SPEAKING: OffTopicScenario = {
  scenarioId: 'off_topic_004',
  exerciseType: 'speaking_prompt',
  title: 'Off-topic during speaking — soft redirect once only',
  activeItem: 'Talk about your favourite holiday.',
  itemIndex: 0,
  studentOffTopicMessage: 'What\'s the best restaurant in London?',
  correctionStateBeforeOffTopic: { retryCount: 0, inCorrectionLadder: false },
  expectedTeacherResponse: {
    answersOffTopicBriefly: true,
    returnsToCurrentItem: true,
    preservesCorrectionState: false,
    noAccidentalAdvancement: true,
    noExerciseRestart: true,
    usesOffTopicRecoverySuffix: false,
  },
  forbiddenBehaviors: [
    'exact_match_on_speaking',
    'restart exercise on off-topic',
    'give strict correction ladder for off-topic during speaking',
  ],
  criticalChecks: [
    'teacher redirects once: "Try to talk about your favourite holiday."',
    'no second off-topic redirect needed if student continues on-topic',
    'speaking mode preserved — no hard correction started',
  ],
}

export const OFF_TOPIC_DURING_UNSUPPORTED: OffTopicScenario = {
  scenarioId: 'off_topic_005',
  exerciseType: 'listening',
  title: 'Off-topic during unsupported exercise — no active item to return to',
  activeItem: '',
  itemIndex: 0,
  studentOffTopicMessage: 'What does "track" mean?',
  correctionStateBeforeOffTopic: { retryCount: 0, inCorrectionLadder: false },
  expectedTeacherResponse: {
    answersOffTopicBriefly: true,
    returnsToCurrentItem: false,
    preservesCorrectionState: false,
    noAccidentalAdvancement: true,
    noExerciseRestart: true,
    usesOffTopicRecoverySuffix: false,
  },
  forbiddenBehaviors: [
    'enter_validator_when_unsupported',
    'crash on missing activeItem for unsupported type',
    'hallucinate_audio_content',
  ],
  criticalChecks: [
    'buildOffTopicRecovery() returns "" for unsupported type',
    'no crash when activeItem is empty',
    'teacher answers briefly and continues naturally',
  ],
}

export const ALL_OFF_TOPIC_SCENARIOS: OffTopicScenario[] = [
  VOCABULARY_MEANING_OFF_TOPIC,
  GRAMMAR_EXPLANATION_OFF_TOPIC,
  RANDOM_QUESTION_OFF_TOPIC,
  OFF_TOPIC_DURING_SPEAKING,
  OFF_TOPIC_DURING_UNSUPPORTED,
]
