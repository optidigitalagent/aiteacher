// Speaking Exercise QA Scenarios
// Covers: speaking_prompt, discussion, roleplay, brainstorm_60_second, show_interest_agree_disagree
// Critical: speaking must NEVER use exact-match validation.
// Critical: speaking must NEVER use TURN D answer reveal.

import type { QAScenario } from './qa-types.js'

const SPEAKING_RUNTIME: QAScenario['expectedRuntimeBehavior'] = {
  protocolName: 'speaking',
  runtimeMode: 'soft_speaking',
  locksItemUntilCorrect: false,
  usesSoftFeedback: true,
  allowsRetry: false,
}

const SPEAKING_TEACHER: QAScenario['expectedTeacherBehavior'] = {
  profile: 'speaking',
  givesHintBeforeReveal: false,
  revealsAnswerAtFinalStage: false,
  neverSaysWrong: true,
  alwaysEndsWithQuestion: true,
  maxSentencesPerTurn: 3,
}

const SPEAKING_VALIDATION: QAScenario['expectedValidationBehavior'] = {
  validationMode: 'soft_ai_feedback',
  rejectsBlankAnswer: true,
  noExactMatchForSpeaking: true,
}

const SPEAKING_PROGRESSION: QAScenario['expectedProgressionBehavior'] = {
  progressionMode: 'soft_completion',
  advancesOnCorrect: false,
  blocksOnIncorrect: false,
  noRepeatCompletedItems: true,
  noAdvanceBeforeCorrect: false,
}

const SPEAKING_RESUME: QAScenario['expectedResumeBehavior'] = {
  resumesFromCurrentItem: true,
  noLessonRestart: true,
  preservesCorrectionTurn: false,
  preservesMatchingOptions: false,
  noItemRegression: true,
  noDuplicateProgression: true,
}

const SPEAKING_OFF_TOPIC: QAScenario['expectedOffTopicRecovery'] = {
  redirectsToCurrentItem: true,
  preservesCorrectionState: false,
  noAccidentalAdvancement: true,
  noExerciseRestart: true,
}

// Soft correction — no TURN D reveal
const SPEAKING_CORRECTION: QAScenario['expectedCorrectionFlow'] = {
  turns: ['TURN_A'],
  revealOnlyAtFinalTurn: false,
  speakingExercisesSkipStrictLadder: true,
  retryCountPreservedOnReconnect: false,
}

export const SPEAKING_PROMPT_QA: QAScenario = {
  scenarioId: 'speaking_prompt_001',
  exerciseType: 'speaking_prompt',
  protocolType: 'speaking',
  title: 'Speaking prompt — soft feedback, no exact match, no reveal',
  instruction: 'Talk about a topic freely.',
  sampleExercise: {
    type: 'speaking_prompt',
    instruction: 'Talk about your favourite holiday.',
  },
  answerFixtures: [
    { studentAnswer: 'I love going to the mountains because it is relaxing.', isCorrect: true, note: 'good response' },
    { studentAnswer: 'Um.', isCorrect: true, note: 'minimal — soft feedback given' },
    { studentAnswer: '', isCorrect: false, note: 'blank rejected' },
  ],
  expectedRuntimeBehavior: SPEAKING_RUNTIME,
  expectedTeacherBehavior: SPEAKING_TEACHER,
  expectedValidationBehavior: SPEAKING_VALIDATION,
  expectedProgressionBehavior: SPEAKING_PROGRESSION,
  expectedResumeBehavior: SPEAKING_RESUME,
  expectedOffTopicRecovery: SPEAKING_OFF_TOPIC,
  expectedCorrectionFlow: SPEAKING_CORRECTION,
  allowedFailureModes: ['student gives minimal answer'],
  forbiddenBehaviors: [
    'exact_match_on_speaking',
    'advance_before_correct',
    'skip_correction_turn',
  ],
}

export const DISCUSSION_QA: QAScenario = {
  scenarioId: 'discussion_001',
  exerciseType: 'discussion',
  protocolType: 'speaking',
  title: 'Discussion — one follow-up maximum, natural progression',
  instruction: 'Discuss the topic.',
  sampleExercise: {
    type: 'discussion',
    instruction: 'Discuss: Is social media good or bad for young people?',
  },
  answerFixtures: [
    { studentAnswer: 'I think it can be both good and bad.', isCorrect: true, note: 'substantive response' },
    { studentAnswer: 'I don\'t know.', isCorrect: true, note: 'minimal — teacher asks follow-up once' },
  ],
  expectedRuntimeBehavior: SPEAKING_RUNTIME,
  expectedTeacherBehavior: SPEAKING_TEACHER,
  expectedValidationBehavior: SPEAKING_VALIDATION,
  expectedProgressionBehavior: SPEAKING_PROGRESSION,
  expectedResumeBehavior: SPEAKING_RESUME,
  expectedOffTopicRecovery: SPEAKING_OFF_TOPIC,
  expectedCorrectionFlow: SPEAKING_CORRECTION,
  allowedFailureModes: ['one follow-up before moving on'],
  forbiddenBehaviors: ['exact_match_on_speaking', 'advance_before_correct'],
}

export const ROLEPLAY_QA: QAScenario = {
  scenarioId: 'roleplay_001',
  exerciseType: 'roleplay',
  protocolType: 'speaking',
  title: 'Roleplay — soft feedback, teacher plays other role',
  instruction: 'Roleplay the given scenario.',
  sampleExercise: {
    type: 'roleplay',
    instruction: 'Student A: You are a customer. Student B: You are a shop assistant.',
  },
  answerFixtures: [
    { studentAnswer: 'Hello, I\'d like to return this shirt please.', isCorrect: true },
    { studentAnswer: 'I want shirt back.', isCorrect: true, note: 'soft feedback on grammar' },
  ],
  expectedRuntimeBehavior: SPEAKING_RUNTIME,
  expectedTeacherBehavior: {
    ...SPEAKING_TEACHER,
    noLectureMode: true,
  },
  expectedValidationBehavior: SPEAKING_VALIDATION,
  expectedProgressionBehavior: SPEAKING_PROGRESSION,
  expectedResumeBehavior: SPEAKING_RESUME,
  expectedOffTopicRecovery: SPEAKING_OFF_TOPIC,
  expectedCorrectionFlow: SPEAKING_CORRECTION,
  allowedFailureModes: [],
  forbiddenBehaviors: ['exact_match_on_speaking', 'advance_before_correct'],
}

export const BRAINSTORM_QA: QAScenario = {
  scenarioId: 'brainstorm_001',
  exerciseType: 'brainstorm_60_second',
  protocolType: 'speaking',
  title: 'Brainstorm — warmup activation, no validation required',
  instruction: 'Think of as many words as you can.',
  sampleExercise: {
    type: 'brainstorm_60_second',
    instruction: 'Name as many sports as you can in 60 seconds.',
  },
  answerFixtures: [
    { studentAnswer: 'football, tennis, swimming, basketball', isCorrect: true, note: 'many items' },
    { studentAnswer: 'football', isCorrect: true, note: 'single item also accepted' },
  ],
  expectedRuntimeBehavior: {
    protocolName: 'speaking',
    runtimeMode: 'warmup_activation',
    locksItemUntilCorrect: false,
    usesSoftFeedback: true,
    allowsRetry: false,
  },
  expectedTeacherBehavior: SPEAKING_TEACHER,
  expectedValidationBehavior: SPEAKING_VALIDATION,
  expectedProgressionBehavior: SPEAKING_PROGRESSION,
  expectedResumeBehavior: SPEAKING_RESUME,
  expectedOffTopicRecovery: SPEAKING_OFF_TOPIC,
  expectedCorrectionFlow: SPEAKING_CORRECTION,
  allowedFailureModes: [],
  forbiddenBehaviors: ['exact_match_on_speaking'],
}

export const SHOW_INTEREST_QA: QAScenario = {
  scenarioId: 'show_interest_001',
  exerciseType: 'show_interest_agree_disagree',
  protocolType: 'speaking',
  title: 'Show interest/agree/disagree — soft reaction expected',
  instruction: 'React to the statement.',
  sampleExercise: {
    type: 'show_interest_agree_disagree',
    instruction: 'React: "I think homework should be banned."',
  },
  answerFixtures: [
    { studentAnswer: 'Really? That\'s interesting! I agree because...', isCorrect: true },
    { studentAnswer: 'I disagree.', isCorrect: true, note: 'brief is fine' },
  ],
  expectedRuntimeBehavior: SPEAKING_RUNTIME,
  expectedTeacherBehavior: SPEAKING_TEACHER,
  expectedValidationBehavior: SPEAKING_VALIDATION,
  expectedProgressionBehavior: SPEAKING_PROGRESSION,
  expectedResumeBehavior: SPEAKING_RESUME,
  expectedOffTopicRecovery: SPEAKING_OFF_TOPIC,
  expectedCorrectionFlow: SPEAKING_CORRECTION,
  allowedFailureModes: [],
  forbiddenBehaviors: ['exact_match_on_speaking', 'advance_before_correct'],
}

export const ALL_SPEAKING_SCENARIOS: QAScenario[] = [
  SPEAKING_PROMPT_QA,
  DISCUSSION_QA,
  ROLEPLAY_QA,
  BRAINSTORM_QA,
  SHOW_INTEREST_QA,
]
