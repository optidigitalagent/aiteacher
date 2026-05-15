// Unsupported / Downgrade Exercise QA Scenarios
// Covers: listening, writing, pronunciation_focus, reading_long_text, gapped_text,
//         complete_table, complete_cartoon_captions
// Critical: unsupported types must NEVER enter the validator.
// Critical: no hallucinated audio/image content.
// Critical: no broken cursor on unsupported type.

import type { QAScenario } from './qa-types.js'

const UNSUPPORTED_RUNTIME: QAScenario['expectedRuntimeBehavior'] = {
  protocolName: 'unsupported',
  runtimeMode: 'skipped',
  locksItemUntilCorrect: false,
  usesSoftFeedback: false,
  allowsRetry: false,
}

const UNSUPPORTED_TEACHER: QAScenario['expectedTeacherBehavior'] = {
  profile: 'unsupported',
  givesHintBeforeReveal: false,
  revealsAnswerAtFinalStage: false,
  neverSaysWrong: true,
  alwaysEndsWithQuestion: false,
  maxSentencesPerTurn: 2,
}

const UNSUPPORTED_VALIDATION: QAScenario['expectedValidationBehavior'] = {
  validationMode: 'unsupported',
  rejectsBlankAnswer: false,
  noExactMatchForSpeaking: true,
}

const UNSUPPORTED_PROGRESSION: QAScenario['expectedProgressionBehavior'] = {
  progressionMode: 'skip',
  advancesOnCorrect: false,
  blocksOnIncorrect: false,
  noRepeatCompletedItems: true,
  noAdvanceBeforeCorrect: false,
}

const UNSUPPORTED_RESUME: QAScenario['expectedResumeBehavior'] = {
  resumesFromCurrentItem: false,
  noLessonRestart: true,
  preservesCorrectionTurn: false,
  preservesMatchingOptions: false,
  noItemRegression: true,
  noDuplicateProgression: true,
}

const UNSUPPORTED_OFF_TOPIC: QAScenario['expectedOffTopicRecovery'] = {
  redirectsToCurrentItem: false,
  preservesCorrectionState: false,
  noAccidentalAdvancement: true,
  noExerciseRestart: true,
}

const UNSUPPORTED_CORRECTION: QAScenario['expectedCorrectionFlow'] = {
  turns: [],
  revealOnlyAtFinalTurn: false,
  speakingExercisesSkipStrictLadder: true,
  retryCountPreservedOnReconnect: false,
}

export const LISTENING_UNSUPPORTED_QA: QAScenario = {
  scenarioId: 'listening_001',
  exerciseType: 'listening',
  protocolType: 'unsupported',
  title: 'Listening — safe skip, no hallucinated audio',
  instruction: 'Listen to the recording and answer the questions.',
  sampleExercise: {
    type: 'listening',
    instruction: 'Listen to track 4.2 and answer.',
    items: ['What did the speaker say?'],
  },
  answerFixtures: [],
  expectedRuntimeBehavior: {
    ...UNSUPPORTED_RUNTIME,
    runtimeMode: 'future_listening_mode',
  },
  expectedTeacherBehavior: UNSUPPORTED_TEACHER,
  expectedValidationBehavior: UNSUPPORTED_VALIDATION,
  expectedProgressionBehavior: UNSUPPORTED_PROGRESSION,
  expectedResumeBehavior: UNSUPPORTED_RESUME,
  expectedOffTopicRecovery: UNSUPPORTED_OFF_TOPIC,
  expectedCorrectionFlow: UNSUPPORTED_CORRECTION,
  allowedFailureModes: ['teacher offers speaking prompt instead'],
  forbiddenBehaviors: [
    'enter_validator_when_unsupported',
    'hallucinate_audio_content',
    'break_cursor_on_unsupported',
    'matching_uses_transform_protocol',
  ],
}

export const WRITING_UNSUPPORTED_QA: QAScenario = {
  scenarioId: 'writing_001',
  exerciseType: 'writing_task',
  protocolType: 'unsupported',
  title: 'Writing task — explain limitation, do not run as voice',
  instruction: 'Write an email of 100–150 words.',
  sampleExercise: {
    type: 'writing_task',
    instruction: 'Write an email to a friend about your holiday.',
  },
  answerFixtures: [],
  expectedRuntimeBehavior: {
    ...UNSUPPORTED_RUNTIME,
    runtimeMode: 'future_writing_mode',
  },
  expectedTeacherBehavior: UNSUPPORTED_TEACHER,
  expectedValidationBehavior: UNSUPPORTED_VALIDATION,
  expectedProgressionBehavior: UNSUPPORTED_PROGRESSION,
  expectedResumeBehavior: UNSUPPORTED_RESUME,
  expectedOffTopicRecovery: UNSUPPORTED_OFF_TOPIC,
  expectedCorrectionFlow: UNSUPPORTED_CORRECTION,
  allowedFailureModes: ['teacher describes what good answer includes'],
  forbiddenBehaviors: [
    'run_writing_as_voice',
    'enter_validator_when_unsupported',
    'break_cursor_on_unsupported',
  ],
}

export const PRONUNCIATION_UNSUPPORTED_QA: QAScenario = {
  scenarioId: 'pronunciation_001',
  exerciseType: 'pronunciation_focus',
  protocolType: 'unsupported',
  title: 'Pronunciation focus — skip, no scoring API',
  instruction: 'Listen and mark the stress.',
  sampleExercise: {
    type: 'pronunciation_focus',
    instruction: 'Mark the word stress in these words.',
    items: ['photograph', 'photography', 'photographic'],
  },
  answerFixtures: [],
  expectedRuntimeBehavior: {
    ...UNSUPPORTED_RUNTIME,
    runtimeMode: 'future_pronunciation_mode',
  },
  expectedTeacherBehavior: UNSUPPORTED_TEACHER,
  expectedValidationBehavior: UNSUPPORTED_VALIDATION,
  expectedProgressionBehavior: UNSUPPORTED_PROGRESSION,
  expectedResumeBehavior: UNSUPPORTED_RESUME,
  expectedOffTopicRecovery: UNSUPPORTED_OFF_TOPIC,
  expectedCorrectionFlow: UNSUPPORTED_CORRECTION,
  allowedFailureModes: ['teacher explains and skips'],
  forbiddenBehaviors: [
    'enter_validator_when_unsupported',
    'hallucinate_audio_content',
    'break_cursor_on_unsupported',
  ],
}

export const READING_LONG_TEXT_UNSUPPORTED_QA: QAScenario = {
  scenarioId: 'reading_long_text_001',
  exerciseType: 'reading_long_text',
  protocolType: 'unsupported',
  title: 'Reading long text — no paragraph mode available',
  instruction: 'Read the text and answer the questions.',
  sampleExercise: {
    type: 'reading_long_text',
    instruction: 'Read the article about climate change.',
    items: ['What is the main topic?'],
  },
  answerFixtures: [],
  expectedRuntimeBehavior: {
    ...UNSUPPORTED_RUNTIME,
    runtimeMode: 'future_reading_mode',
  },
  expectedTeacherBehavior: UNSUPPORTED_TEACHER,
  expectedValidationBehavior: UNSUPPORTED_VALIDATION,
  expectedProgressionBehavior: UNSUPPORTED_PROGRESSION,
  expectedResumeBehavior: UNSUPPORTED_RESUME,
  expectedOffTopicRecovery: UNSUPPORTED_OFF_TOPIC,
  expectedCorrectionFlow: UNSUPPORTED_CORRECTION,
  allowedFailureModes: ['teacher summarises topic verbally'],
  forbiddenBehaviors: [
    'enter_validator_when_unsupported',
    'break_cursor_on_unsupported',
  ],
}

export const GAPPED_TEXT_UNSUPPORTED_QA: QAScenario = {
  scenarioId: 'gapped_text_001',
  exerciseType: 'gapped_text',
  protocolType: 'unsupported',
  title: 'Gapped text — requires long text, skipped in current runtime',
  instruction: 'Choose sentences A–F to fill gaps 1–5.',
  sampleExercise: {
    type: 'gapped_text',
    instruction: 'Choose sentences A–F.',
    items: ['Gap 1 in the text.'],
  },
  answerFixtures: [],
  expectedRuntimeBehavior: {
    ...UNSUPPORTED_RUNTIME,
    runtimeMode: 'future_reading_mode',
  },
  expectedTeacherBehavior: UNSUPPORTED_TEACHER,
  expectedValidationBehavior: UNSUPPORTED_VALIDATION,
  expectedProgressionBehavior: UNSUPPORTED_PROGRESSION,
  expectedResumeBehavior: UNSUPPORTED_RESUME,
  expectedOffTopicRecovery: UNSUPPORTED_OFF_TOPIC,
  expectedCorrectionFlow: UNSUPPORTED_CORRECTION,
  allowedFailureModes: [],
  forbiddenBehaviors: ['enter_validator_when_unsupported', 'break_cursor_on_unsupported'],
}

export const COMPLETE_TABLE_UNSUPPORTED_QA: QAScenario = {
  scenarioId: 'complete_table_001',
  exerciseType: 'complete_table',
  protocolType: 'unsupported',
  title: 'Complete table — requires visual rendering, skip',
  instruction: 'Complete the table.',
  sampleExercise: {
    type: 'complete_table',
    instruction: 'Complete the table with the correct information.',
  },
  answerFixtures: [],
  expectedRuntimeBehavior: UNSUPPORTED_RUNTIME,
  expectedTeacherBehavior: UNSUPPORTED_TEACHER,
  expectedValidationBehavior: UNSUPPORTED_VALIDATION,
  expectedProgressionBehavior: UNSUPPORTED_PROGRESSION,
  expectedResumeBehavior: UNSUPPORTED_RESUME,
  expectedOffTopicRecovery: UNSUPPORTED_OFF_TOPIC,
  expectedCorrectionFlow: UNSUPPORTED_CORRECTION,
  allowedFailureModes: ['teacher discusses topic verbally'],
  forbiddenBehaviors: [
    'hallucinate_image_content',
    'enter_validator_when_unsupported',
    'break_cursor_on_unsupported',
  ],
}

export const COMPLETE_CARTOON_UNSUPPORTED_QA: QAScenario = {
  scenarioId: 'complete_cartoon_001',
  exerciseType: 'complete_cartoon_captions',
  protocolType: 'unsupported',
  title: 'Complete cartoon captions — requires image, skip',
  instruction: 'Complete the speech bubbles.',
  sampleExercise: {
    type: 'complete_cartoon_captions',
    instruction: 'Look at the cartoon and complete the speech bubbles.',
  },
  answerFixtures: [],
  expectedRuntimeBehavior: UNSUPPORTED_RUNTIME,
  expectedTeacherBehavior: UNSUPPORTED_TEACHER,
  expectedValidationBehavior: UNSUPPORTED_VALIDATION,
  expectedProgressionBehavior: UNSUPPORTED_PROGRESSION,
  expectedResumeBehavior: UNSUPPORTED_RESUME,
  expectedOffTopicRecovery: UNSUPPORTED_OFF_TOPIC,
  expectedCorrectionFlow: UNSUPPORTED_CORRECTION,
  allowedFailureModes: [],
  forbiddenBehaviors: [
    'hallucinate_image_content',
    'enter_validator_when_unsupported',
    'break_cursor_on_unsupported',
  ],
}

export const ALL_UNSUPPORTED_SCENARIOS: QAScenario[] = [
  LISTENING_UNSUPPORTED_QA,
  WRITING_UNSUPPORTED_QA,
  PRONUNCIATION_UNSUPPORTED_QA,
  READING_LONG_TEXT_UNSUPPORTED_QA,
  GAPPED_TEXT_UNSUPPORTED_QA,
  COMPLETE_TABLE_UNSUPPORTED_QA,
  COMPLETE_CARTOON_UNSUPPORTED_QA,
]
