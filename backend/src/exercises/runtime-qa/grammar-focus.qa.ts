// Grammar Focus QA Scenarios
// Covers: grammar_focus, remember_this
// Rules: brief explanation only, quick check question, no lecture, transition to practice.

import type { QAScenario } from './qa-types.js'

const GRAMMAR_RUNTIME: QAScenario['expectedRuntimeBehavior'] = {
  protocolName: 'grammar_focus',
  runtimeMode: 'grammar_explanation',
  locksItemUntilCorrect: false,
  usesSoftFeedback: true,
  allowsRetry: true,
}

const GRAMMAR_TEACHER: QAScenario['expectedTeacherBehavior'] = {
  profile: 'grammar_focus',
  givesHintBeforeReveal: true,
  revealsAnswerAtFinalStage: false,
  neverSaysWrong: true,
  alwaysEndsWithQuestion: true,
  maxSentencesPerTurn: 3,
  noLectureMode: true,
}

const GRAMMAR_VALIDATION: QAScenario['expectedValidationBehavior'] = {
  validationMode: 'soft_ai_feedback',
  rejectsBlankAnswer: true,
  noExactMatchForSpeaking: true,
}

const GRAMMAR_RESUME: QAScenario['expectedResumeBehavior'] = {
  resumesFromCurrentItem: true,
  noLessonRestart: true,
  preservesCorrectionTurn: false,
  preservesMatchingOptions: false,
  noItemRegression: true,
  noDuplicateProgression: true,
}

const GRAMMAR_OFF_TOPIC: QAScenario['expectedOffTopicRecovery'] = {
  redirectsToCurrentItem: true,
  preservesCorrectionState: false,
  noAccidentalAdvancement: true,
  noExerciseRestart: true,
}

export const GRAMMAR_FOCUS_QA: QAScenario = {
  scenarioId: 'grammar_focus_001',
  exerciseType: 'grammar_focus',
  protocolType: 'grammar_focus',
  title: 'Grammar focus — concise explanation + check question',
  instruction: 'Explain the grammar point and ask one check question.',
  sampleExercise: {
    type: 'grammar_focus',
    instruction: 'Grammar Focus: Present Perfect vs Past Simple.',
  },
  answerFixtures: [
    { studentAnswer: 'Present perfect for past with present result.', isCorrect: true, note: 'good check answer' },
    { studentAnswer: 'I don\'t know.', isCorrect: false, note: 'teacher re-explains and asks again' },
  ],
  expectedRuntimeBehavior: GRAMMAR_RUNTIME,
  expectedTeacherBehavior: GRAMMAR_TEACHER,
  expectedValidationBehavior: GRAMMAR_VALIDATION,
  expectedProgressionBehavior: {
    progressionMode: 'explanation_then_check',
    advancesOnCorrect: true,
    blocksOnIncorrect: false,
    noRepeatCompletedItems: true,
    noAdvanceBeforeCorrect: false,
  },
  expectedResumeBehavior: GRAMMAR_RESUME,
  expectedOffTopicRecovery: GRAMMAR_OFF_TOPIC,
  expectedCorrectionFlow: {
    turns: ['TURN_A', 'TURN_B'],
    revealOnlyAtFinalTurn: false,
    speakingExercisesSkipStrictLadder: true,
    retryCountPreservedOnReconnect: false,
  },
  allowedFailureModes: [],
  forbiddenBehaviors: ['advance_before_correct', 'exact_match_on_speaking'],
}

export const REMEMBER_THIS_QA: QAScenario = {
  scenarioId: 'remember_this_001',
  exerciseType: 'remember_this',
  protocolType: 'grammar_focus',
  title: 'Remember this — teacher explanation mode',
  instruction: 'State the important note and ask a quick check.',
  sampleExercise: {
    type: 'remember_this',
    instruction: 'Remember! We use "used to" for past habits, not present.',
  },
  answerFixtures: [
    { studentAnswer: 'Used to is for past habits.', isCorrect: true },
    { studentAnswer: 'Present habits.', isCorrect: false, note: 'wrong — re-explain once' },
  ],
  expectedRuntimeBehavior: {
    ...GRAMMAR_RUNTIME,
    runtimeMode: 'teacher_explanation',
  },
  expectedTeacherBehavior: GRAMMAR_TEACHER,
  expectedValidationBehavior: GRAMMAR_VALIDATION,
  expectedProgressionBehavior: {
    progressionMode: 'explanation_then_check',
    advancesOnCorrect: true,
    blocksOnIncorrect: false,
    noRepeatCompletedItems: true,
    noAdvanceBeforeCorrect: false,
  },
  expectedResumeBehavior: GRAMMAR_RESUME,
  expectedOffTopicRecovery: GRAMMAR_OFF_TOPIC,
  expectedCorrectionFlow: {
    turns: ['TURN_A', 'TURN_B'],
    revealOnlyAtFinalTurn: false,
    speakingExercisesSkipStrictLadder: true,
    retryCountPreservedOnReconnect: false,
  },
  allowedFailureModes: [],
  forbiddenBehaviors: ['advance_before_correct', 'exact_match_on_speaking'],
}

export const ALL_GRAMMAR_FOCUS_SCENARIOS: QAScenario[] = [
  GRAMMAR_FOCUS_QA,
  REMEMBER_THIS_QA,
]
