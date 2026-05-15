// Matching Exercise QA Scenarios
// Covers: matching, vocabulary_matching, find_opposites
// Critical: matching must NEVER use deterministic/transform protocol.
// Critical: matching must NEVER run without visible options.

import type { QAScenario } from './qa-types.js'

const MATCHING_RUNTIME: QAScenario['expectedRuntimeBehavior'] = {
  protocolName: 'matching',
  runtimeMode: 'matching_sequential',
  locksItemUntilCorrect: true,
  usesSoftFeedback: false,
  allowsRetry: true,
}

const MATCHING_TEACHER: QAScenario['expectedTeacherBehavior'] = {
  profile: 'matching',
  givesHintBeforeReveal: true,
  revealsAnswerAtFinalStage: true,
  neverSaysWrong: true,
  alwaysEndsWithQuestion: true,
  maxSentencesPerTurn: 3,
}

const MATCHING_RESUME: QAScenario['expectedResumeBehavior'] = {
  resumesFromCurrentItem: true,
  noLessonRestart: true,
  preservesCorrectionTurn: true,
  preservesMatchingOptions: true,
  noItemRegression: true,
  noDuplicateProgression: true,
}

const MATCHING_OFF_TOPIC: QAScenario['expectedOffTopicRecovery'] = {
  redirectsToCurrentItem: true,
  preservesCorrectionState: true,
  noAccidentalAdvancement: true,
  noExerciseRestart: true,
}

const MATCHING_CORRECTION: QAScenario['expectedCorrectionFlow'] = {
  turns: ['TURN_A', 'TURN_B'],
  revealOnlyAtFinalTurn: true,
  speakingExercisesSkipStrictLadder: false,
  retryCountPreservedOnReconnect: true,
}

export const MATCHING_LETTER_QA: QAScenario = {
  scenarioId: 'matching_001',
  exerciseType: 'matching',
  protocolType: 'matching',
  title: 'Matching — letter answer variants (A, "letter A", "option A", "one A")',
  instruction: 'Match the words with their definitions.',
  sampleExercise: {
    type: 'matching',
    instruction: 'Match 1–4 with a–d.',
    items: ['1. happy', '2. angry', '3. tired', '4. scared'],
    options: ['a) pleased', 'b) furious', 'c) exhausted', 'd) frightened'],
    correctAnswer: 'a',
  },
  answerFixtures: [
    { studentAnswer: 'a', isCorrect: true, note: 'bare letter' },
    { studentAnswer: 'A', isCorrect: true, note: 'uppercase' },
    { studentAnswer: 'letter a', isCorrect: true, note: '"letter" prefix' },
    { studentAnswer: 'option a', isCorrect: true, note: '"option" prefix' },
    { studentAnswer: 'one a', isCorrect: true, note: '"one" prefix' },
    { studentAnswer: 'pleased', isCorrect: true, note: 'text of correct option' },
    { studentAnswer: 'b', isCorrect: false, note: 'wrong letter' },
    { studentAnswer: 'furious', isCorrect: false, note: 'wrong text option' },
  ],
  expectedRuntimeBehavior: MATCHING_RUNTIME,
  expectedTeacherBehavior: MATCHING_TEACHER,
  expectedValidationBehavior: {
    validationMode: 'matching_letter_or_text',
    acceptsLetterAnswer: true,
    acceptsTextAnswer: true,
    rejectsBlankAnswer: true,
    noExactMatchForSpeaking: false,
  },
  expectedProgressionBehavior: {
    progressionMode: 'one_match_at_a_time',
    advancesOnCorrect: true,
    blocksOnIncorrect: true,
    noRepeatCompletedItems: true,
    noAdvanceBeforeCorrect: true,
  },
  expectedResumeBehavior: MATCHING_RESUME,
  expectedOffTopicRecovery: MATCHING_OFF_TOPIC,
  expectedCorrectionFlow: MATCHING_CORRECTION,
  allowedFailureModes: [],
  forbiddenBehaviors: [
    'matching_uses_transform_protocol',
    'run_without_options',
    'ask_all_pairs_at_once',
    'advance_before_correct',
    'repeat_completed_item',
  ],
}

export const MATCHING_TEXT_QA: QAScenario = {
  scenarioId: 'matching_002',
  exerciseType: 'matching',
  protocolType: 'matching',
  title: 'Matching — text answer accepted alongside letter',
  instruction: 'Match the words with their meanings.',
  sampleExercise: {
    type: 'matching',
    instruction: 'Match 1–3 with a–c.',
    items: ['1. enormous', '2. tiny', '3. ancient'],
    options: ['a) very old', 'b) very small', 'c) very large'],
    correctAnswer: 'c',
  },
  answerFixtures: [
    { studentAnswer: 'c', isCorrect: true },
    { studentAnswer: 'very large', isCorrect: true, note: 'text match' },
    { studentAnswer: 'a', isCorrect: false },
    { studentAnswer: 'very old', isCorrect: false, note: 'wrong text' },
  ],
  expectedRuntimeBehavior: MATCHING_RUNTIME,
  expectedTeacherBehavior: MATCHING_TEACHER,
  expectedValidationBehavior: {
    validationMode: 'matching_letter_or_text',
    acceptsLetterAnswer: true,
    acceptsTextAnswer: true,
    rejectsBlankAnswer: true,
    noExactMatchForSpeaking: false,
  },
  expectedProgressionBehavior: {
    progressionMode: 'one_match_at_a_time',
    advancesOnCorrect: true,
    blocksOnIncorrect: true,
    noRepeatCompletedItems: true,
    noAdvanceBeforeCorrect: true,
  },
  expectedResumeBehavior: MATCHING_RESUME,
  expectedOffTopicRecovery: MATCHING_OFF_TOPIC,
  expectedCorrectionFlow: MATCHING_CORRECTION,
  allowedFailureModes: [],
  forbiddenBehaviors: ['matching_uses_transform_protocol', 'run_without_options', 'ask_all_pairs_at_once'],
}

export const MATCHING_NO_OPTIONS_QA: QAScenario = {
  scenarioId: 'matching_003',
  exerciseType: 'matching',
  protocolType: 'matching',
  title: 'Matching — guard: must NOT run without options',
  instruction: 'Matching without options payload should be blocked.',
  sampleExercise: {
    type: 'matching',
    instruction: 'Match 1–3.',
    items: ['1. happy', '2. angry', '3. tired'],
    options: [],
    correctAnswer: 'a',
  },
  answerFixtures: [],
  expectedRuntimeBehavior: MATCHING_RUNTIME,
  expectedTeacherBehavior: MATCHING_TEACHER,
  expectedValidationBehavior: {
    validationMode: 'matching_letter_or_text',
    rejectsBlankAnswer: true,
    noExactMatchForSpeaking: false,
  },
  expectedProgressionBehavior: {
    progressionMode: 'one_match_at_a_time',
    advancesOnCorrect: false,
    blocksOnIncorrect: true,
    noRepeatCompletedItems: true,
    noAdvanceBeforeCorrect: true,
  },
  expectedResumeBehavior: MATCHING_RESUME,
  expectedOffTopicRecovery: MATCHING_OFF_TOPIC,
  expectedCorrectionFlow: MATCHING_CORRECTION,
  allowedFailureModes: ['options_gate_blocks_exercise'],
  forbiddenBehaviors: ['run_without_options', 'matching_uses_transform_protocol'],
}

export const VOCABULARY_MATCHING_QA: QAScenario = {
  scenarioId: 'vocabulary_matching_001',
  exerciseType: 'vocabulary_matching',
  protocolType: 'matching',
  title: 'Vocabulary matching — one pair at a time',
  instruction: 'Match vocabulary words with their definitions.',
  sampleExercise: {
    type: 'vocabulary_matching',
    instruction: 'Match words 1–4 with definitions a–d.',
    items: ['1. ambitious', '2. generous', '3. reliable', '4. stubborn'],
    options: ['a) always willing to give', 'b) can be trusted', 'c) wanting to succeed', 'd) not changing opinion'],
    correctAnswer: 'c',
  },
  answerFixtures: [
    { studentAnswer: 'c', isCorrect: true },
    { studentAnswer: 'wanting to succeed', isCorrect: true, note: 'text match' },
    { studentAnswer: 'a', isCorrect: false },
  ],
  expectedRuntimeBehavior: MATCHING_RUNTIME,
  expectedTeacherBehavior: MATCHING_TEACHER,
  expectedValidationBehavior: {
    validationMode: 'matching_letter_or_text',
    acceptsLetterAnswer: true,
    acceptsTextAnswer: true,
    rejectsBlankAnswer: true,
    noExactMatchForSpeaking: false,
  },
  expectedProgressionBehavior: {
    progressionMode: 'one_match_at_a_time',
    advancesOnCorrect: true,
    blocksOnIncorrect: true,
    noRepeatCompletedItems: true,
    noAdvanceBeforeCorrect: true,
  },
  expectedResumeBehavior: MATCHING_RESUME,
  expectedOffTopicRecovery: MATCHING_OFF_TOPIC,
  expectedCorrectionFlow: MATCHING_CORRECTION,
  allowedFailureModes: [],
  forbiddenBehaviors: ['ask_all_pairs_at_once', 'run_without_options', 'matching_uses_transform_protocol'],
}

export const FIND_OPPOSITES_QA: QAScenario = {
  scenarioId: 'find_opposites_001',
  exerciseType: 'find_opposites',
  protocolType: 'matching',
  title: 'Find opposites — antonym matching with options',
  instruction: 'Match words with their opposites.',
  sampleExercise: {
    type: 'find_opposites',
    instruction: 'Find the opposite.',
    items: ['1. hot'],
    options: ['a) cold', 'b) warm', 'c) cool'],
    correctAnswer: 'a',
  },
  answerFixtures: [
    { studentAnswer: 'a', isCorrect: true },
    { studentAnswer: 'cold', isCorrect: true },
    { studentAnswer: 'b', isCorrect: false },
  ],
  expectedRuntimeBehavior: MATCHING_RUNTIME,
  expectedTeacherBehavior: MATCHING_TEACHER,
  expectedValidationBehavior: {
    validationMode: 'deterministic_normalized',
    rejectsBlankAnswer: true,
    noExactMatchForSpeaking: false,
  },
  expectedProgressionBehavior: {
    progressionMode: 'one_match_at_a_time',
    advancesOnCorrect: true,
    blocksOnIncorrect: true,
    noRepeatCompletedItems: true,
    noAdvanceBeforeCorrect: true,
  },
  expectedResumeBehavior: MATCHING_RESUME,
  expectedOffTopicRecovery: MATCHING_OFF_TOPIC,
  expectedCorrectionFlow: MATCHING_CORRECTION,
  allowedFailureModes: [],
  forbiddenBehaviors: ['matching_uses_transform_protocol', 'run_without_options', 'ask_all_pairs_at_once'],
}

export const ALL_MATCHING_SCENARIOS: QAScenario[] = [
  MATCHING_LETTER_QA,
  MATCHING_TEXT_QA,
  MATCHING_NO_OPTIONS_QA,
  VOCABULARY_MATCHING_QA,
  FIND_OPPOSITES_QA,
]
