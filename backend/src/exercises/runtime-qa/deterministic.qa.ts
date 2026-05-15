// Deterministic Exercise QA Scenarios
// Covers: fill_gap, choose_from_box, complete_correct_form, form_transformation,
//         rewrite_sentence, write_questions, error_correction, multiple_choice, true_false, collocations

import type { QAScenario } from './qa-types.js'

const STANDARD_RESUME: QAScenario['expectedResumeBehavior'] = {
  resumesFromCurrentItem: true,
  noLessonRestart: true,
  preservesCorrectionTurn: true,
  preservesMatchingOptions: false,
  noItemRegression: true,
  noDuplicateProgression: true,
}

const STANDARD_OFF_TOPIC: QAScenario['expectedOffTopicRecovery'] = {
  redirectsToCurrentItem: true,
  preservesCorrectionState: true,
  noAccidentalAdvancement: true,
  noExerciseRestart: true,
}

const STANDARD_CORRECTION: QAScenario['expectedCorrectionFlow'] = {
  turns: ['TURN_A', 'TURN_B', 'TURN_C', 'TURN_D'],
  revealOnlyAtFinalTurn: true,
  speakingExercisesSkipStrictLadder: false,
  retryCountPreservedOnReconnect: true,
}

const DETERMINISTIC_TEACHER: QAScenario['expectedTeacherBehavior'] = {
  profile: 'deterministic',
  givesHintBeforeReveal: true,
  revealsAnswerAtFinalStage: true,
  neverSaysWrong: true,
  alwaysEndsWithQuestion: true,
  maxSentencesPerTurn: 3,
}

const DETERMINISTIC_RUNTIME: QAScenario['expectedRuntimeBehavior'] = {
  protocolName: 'deterministic',
  runtimeMode: 'deterministic_sequential',
  locksItemUntilCorrect: true,
  usesSoftFeedback: false,
  allowsRetry: true,
}

export const FILL_GAP_QA: QAScenario = {
  scenarioId: 'fill_gap_001',
  exerciseType: 'fill_gap',
  protocolType: 'deterministic',
  title: 'Fill gap — correct/wrong/retry/reveal cycle',
  instruction: 'Fill in the blanks with the correct word.',
  sampleExercise: {
    type: 'fill_gap',
    instruction: 'Fill in the blank.',
    items: ['She ___ (go) to school every day.'],
    correctAnswer: 'goes',
  },
  answerFixtures: [
    { studentAnswer: 'goes', isCorrect: true, note: 'exact match' },
    { studentAnswer: 'GOES', isCorrect: true, note: 'normalized uppercase' },
    { studentAnswer: 'go', isCorrect: false, note: 'wrong form — TURN A hint' },
    { studentAnswer: 'going', isCorrect: false, note: 'wrong form — TURN B hint' },
    { studentAnswer: '', isCorrect: false, note: 'blank — reject immediately' },
  ],
  expectedRuntimeBehavior: DETERMINISTIC_RUNTIME,
  expectedTeacherBehavior: DETERMINISTIC_TEACHER,
  expectedValidationBehavior: {
    validationMode: 'deterministic_normalized',
    rejectsBlankAnswer: true,
    noExactMatchForSpeaking: false,
  },
  expectedProgressionBehavior: {
    progressionMode: 'locked_item',
    advancesOnCorrect: true,
    blocksOnIncorrect: true,
    noRepeatCompletedItems: true,
    noAdvanceBeforeCorrect: true,
  },
  expectedResumeBehavior: STANDARD_RESUME,
  expectedOffTopicRecovery: STANDARD_OFF_TOPIC,
  expectedCorrectionFlow: STANDARD_CORRECTION,
  allowedFailureModes: ['student may ask for hint'],
  forbiddenBehaviors: [
    'advance_before_correct',
    'repeat_completed_item',
    'reveal_on_first_hint',
    'restart_lesson_on_reconnect',
  ],
}

export const CHOOSE_FROM_BOX_QA: QAScenario = {
  scenarioId: 'choose_from_box_001',
  exerciseType: 'choose_from_box',
  protocolType: 'deterministic',
  title: 'Choose from box — options visible, one sentence at a time',
  instruction: 'Use the words in the box to fill the gaps.',
  sampleExercise: {
    type: 'choose_from_box',
    instruction: 'Use: make / do / have',
    items: ['She likes to ___ her homework early.'],
    options: ['make', 'do', 'have'],
    correctAnswer: 'do',
  },
  answerFixtures: [
    { studentAnswer: 'do', isCorrect: true },
    { studentAnswer: 'make', isCorrect: false, note: 'wrong box word' },
    { studentAnswer: 'have', isCorrect: false, note: 'wrong box word' },
  ],
  expectedRuntimeBehavior: DETERMINISTIC_RUNTIME,
  expectedTeacherBehavior: DETERMINISTIC_TEACHER,
  expectedValidationBehavior: {
    validationMode: 'deterministic_normalized',
    rejectsBlankAnswer: true,
    noExactMatchForSpeaking: false,
  },
  expectedProgressionBehavior: {
    progressionMode: 'locked_item',
    advancesOnCorrect: true,
    blocksOnIncorrect: true,
    noRepeatCompletedItems: true,
    noAdvanceBeforeCorrect: true,
  },
  expectedResumeBehavior: STANDARD_RESUME,
  expectedOffTopicRecovery: STANDARD_OFF_TOPIC,
  expectedCorrectionFlow: STANDARD_CORRECTION,
  allowedFailureModes: [],
  forbiddenBehaviors: ['advance_before_correct', 'repeat_completed_item', 'reveal_on_first_hint'],
}

export const COMPLETE_CORRECT_FORM_QA: QAScenario = {
  scenarioId: 'complete_correct_form_001',
  exerciseType: 'complete_correct_form',
  protocolType: 'deterministic',
  title: 'Complete correct form — verb form in brackets',
  instruction: 'Put the verb in the correct form.',
  sampleExercise: {
    type: 'complete_correct_form',
    instruction: 'Use the correct form of the verb in brackets.',
    items: ['They ___ (visit) us last weekend.'],
    correctAnswer: 'visited',
  },
  answerFixtures: [
    { studentAnswer: 'visited', isCorrect: true },
    { studentAnswer: 'visit', isCorrect: false, note: 'missing past tense' },
    { studentAnswer: 'are visiting', isCorrect: false, note: 'wrong tense' },
  ],
  expectedRuntimeBehavior: DETERMINISTIC_RUNTIME,
  expectedTeacherBehavior: DETERMINISTIC_TEACHER,
  expectedValidationBehavior: {
    validationMode: 'deterministic_normalized',
    rejectsBlankAnswer: true,
    noExactMatchForSpeaking: false,
  },
  expectedProgressionBehavior: {
    progressionMode: 'locked_item',
    advancesOnCorrect: true,
    blocksOnIncorrect: true,
    noRepeatCompletedItems: true,
    noAdvanceBeforeCorrect: true,
  },
  expectedResumeBehavior: STANDARD_RESUME,
  expectedOffTopicRecovery: STANDARD_OFF_TOPIC,
  expectedCorrectionFlow: STANDARD_CORRECTION,
  allowedFailureModes: [],
  forbiddenBehaviors: ['advance_before_correct', 'reveal_on_first_hint', 'repeat_completed_item'],
}

export const FORM_TRANSFORMATION_QA: QAScenario = {
  scenarioId: 'form_transformation_001',
  exerciseType: 'form_transformation',
  protocolType: 'deterministic',
  title: 'Form transformation — rewrite sentence with key word',
  instruction: 'Complete the second sentence so it has the same meaning.',
  sampleExercise: {
    type: 'form_transformation',
    instruction: 'Use the word in capitals.',
    items: ['She started cooking an hour ago. BEEN\nShe ___ for an hour.'],
    correctAnswer: 'has been cooking',
  },
  answerFixtures: [
    { studentAnswer: 'has been cooking', isCorrect: true },
    { studentAnswer: 'was cooking', isCorrect: false, note: 'wrong tense' },
  ],
  expectedRuntimeBehavior: DETERMINISTIC_RUNTIME,
  expectedTeacherBehavior: DETERMINISTIC_TEACHER,
  expectedValidationBehavior: {
    validationMode: 'deterministic_normalized',
    rejectsBlankAnswer: true,
    noExactMatchForSpeaking: false,
  },
  expectedProgressionBehavior: {
    progressionMode: 'locked_item',
    advancesOnCorrect: true,
    blocksOnIncorrect: true,
    noRepeatCompletedItems: true,
    noAdvanceBeforeCorrect: true,
  },
  expectedResumeBehavior: STANDARD_RESUME,
  expectedOffTopicRecovery: STANDARD_OFF_TOPIC,
  expectedCorrectionFlow: STANDARD_CORRECTION,
  allowedFailureModes: ['ai_semantic_fallback'],
  forbiddenBehaviors: ['advance_before_correct', 'reveal_on_first_hint'],
}

export const REWRITE_SENTENCE_QA: QAScenario = {
  scenarioId: 'rewrite_sentence_001',
  exerciseType: 'rewrite_sentence',
  protocolType: 'deterministic',
  title: 'Rewrite sentence — AI semantic validation',
  instruction: 'Rewrite the sentence using the given structure.',
  sampleExercise: {
    type: 'rewrite_sentence',
    instruction: 'Rewrite using a relative clause.',
    items: ['The woman who lives next door is a doctor.'],
    correctAnswer: 'The woman living next door is a doctor.',
  },
  answerFixtures: [
    { studentAnswer: 'The woman living next door is a doctor.', isCorrect: true, note: 'exact match' },
    { studentAnswer: 'The doctor is the woman next door who lives there.', isCorrect: false, note: 'wrong structure' },
  ],
  expectedRuntimeBehavior: DETERMINISTIC_RUNTIME,
  expectedTeacherBehavior: DETERMINISTIC_TEACHER,
  expectedValidationBehavior: {
    validationMode: 'ai_semantic',
    rejectsBlankAnswer: true,
    noExactMatchForSpeaking: false,
  },
  expectedProgressionBehavior: {
    progressionMode: 'locked_item',
    advancesOnCorrect: true,
    blocksOnIncorrect: true,
    noRepeatCompletedItems: true,
    noAdvanceBeforeCorrect: true,
  },
  expectedResumeBehavior: STANDARD_RESUME,
  expectedOffTopicRecovery: STANDARD_OFF_TOPIC,
  expectedCorrectionFlow: STANDARD_CORRECTION,
  allowedFailureModes: ['ai_semantic_evaluation'],
  forbiddenBehaviors: ['advance_before_correct', 'exact_match_on_speaking'],
}

export const WRITE_QUESTIONS_QA: QAScenario = {
  scenarioId: 'write_questions_001',
  exerciseType: 'write_questions',
  protocolType: 'deterministic',
  title: 'Write questions — AI semantic, question structure required',
  instruction: 'Write a question for the given answer.',
  sampleExercise: {
    type: 'write_questions',
    instruction: 'Write the question.',
    items: ['Answer: She went to Paris.\nQuestion: ___'],
    correctAnswer: 'Where did she go?',
  },
  answerFixtures: [
    { studentAnswer: 'Where did she go?', isCorrect: true },
    { studentAnswer: 'She went somewhere?', isCorrect: false, note: 'not a question' },
  ],
  expectedRuntimeBehavior: DETERMINISTIC_RUNTIME,
  expectedTeacherBehavior: DETERMINISTIC_TEACHER,
  expectedValidationBehavior: {
    validationMode: 'ai_semantic',
    rejectsBlankAnswer: true,
    noExactMatchForSpeaking: false,
  },
  expectedProgressionBehavior: {
    progressionMode: 'locked_item',
    advancesOnCorrect: true,
    blocksOnIncorrect: true,
    noRepeatCompletedItems: true,
    noAdvanceBeforeCorrect: true,
  },
  expectedResumeBehavior: STANDARD_RESUME,
  expectedOffTopicRecovery: STANDARD_OFF_TOPIC,
  expectedCorrectionFlow: STANDARD_CORRECTION,
  allowedFailureModes: [],
  forbiddenBehaviors: ['advance_before_correct', 'reveal_on_first_hint'],
}

export const ERROR_CORRECTION_QA: QAScenario = {
  scenarioId: 'error_correction_001',
  exerciseType: 'error_correction',
  protocolType: 'deterministic',
  title: 'Error correction — find and say the correct sentence',
  instruction: 'Find and correct the mistake.',
  sampleExercise: {
    type: 'error_correction',
    instruction: 'Correct the sentence.',
    items: ['She don\'t like coffee.'],
    correctAnswer: 'She doesn\'t like coffee.',
  },
  answerFixtures: [
    { studentAnswer: 'She doesn\'t like coffee.', isCorrect: true },
    { studentAnswer: 'She not like coffee.', isCorrect: false, note: 'still wrong' },
    { studentAnswer: 'don\'t', isCorrect: false, note: 'just the error, not corrected sentence' },
  ],
  expectedRuntimeBehavior: DETERMINISTIC_RUNTIME,
  expectedTeacherBehavior: DETERMINISTIC_TEACHER,
  expectedValidationBehavior: {
    validationMode: 'deterministic_normalized',
    rejectsBlankAnswer: true,
    noExactMatchForSpeaking: false,
  },
  expectedProgressionBehavior: {
    progressionMode: 'locked_item',
    advancesOnCorrect: true,
    blocksOnIncorrect: true,
    noRepeatCompletedItems: true,
    noAdvanceBeforeCorrect: true,
  },
  expectedResumeBehavior: STANDARD_RESUME,
  expectedOffTopicRecovery: STANDARD_OFF_TOPIC,
  expectedCorrectionFlow: STANDARD_CORRECTION,
  allowedFailureModes: [],
  forbiddenBehaviors: ['advance_before_correct', 'reveal_on_first_hint', 'repeat_completed_item'],
}

export const MULTIPLE_CHOICE_QA: QAScenario = {
  scenarioId: 'multiple_choice_001',
  exerciseType: 'multiple_choice',
  protocolType: 'deterministic',
  title: 'Multiple choice — letter or text answer',
  instruction: 'Choose the correct answer.',
  sampleExercise: {
    type: 'multiple_choice',
    instruction: 'Choose A, B, C or D.',
    items: ['She ___ to school by bus.\na) go  b) goes  c) gone  d) going'],
    options: ['a) go', 'b) goes', 'c) gone', 'd) going'],
    correctAnswer: 'b',
  },
  answerFixtures: [
    { studentAnswer: 'b', isCorrect: true, note: 'letter answer' },
    { studentAnswer: 'B', isCorrect: true, note: 'uppercase letter' },
    { studentAnswer: 'goes', isCorrect: true, note: 'text answer' },
    { studentAnswer: 'option b', isCorrect: true, note: '"option" prefix' },
    { studentAnswer: 'a', isCorrect: false },
    { studentAnswer: 'go', isCorrect: false },
  ],
  expectedRuntimeBehavior: DETERMINISTIC_RUNTIME,
  expectedTeacherBehavior: DETERMINISTIC_TEACHER,
  expectedValidationBehavior: {
    validationMode: 'matching_letter_or_text',
    acceptsLetterAnswer: true,
    acceptsTextAnswer: true,
    rejectsBlankAnswer: true,
    noExactMatchForSpeaking: false,
  },
  expectedProgressionBehavior: {
    progressionMode: 'locked_item',
    advancesOnCorrect: true,
    blocksOnIncorrect: true,
    noRepeatCompletedItems: true,
    noAdvanceBeforeCorrect: true,
  },
  expectedResumeBehavior: STANDARD_RESUME,
  expectedOffTopicRecovery: STANDARD_OFF_TOPIC,
  expectedCorrectionFlow: STANDARD_CORRECTION,
  allowedFailureModes: [],
  forbiddenBehaviors: ['advance_before_correct', 'run_without_options', 'repeat_completed_item'],
}

export const TRUE_FALSE_QA: QAScenario = {
  scenarioId: 'true_false_001',
  exerciseType: 'true_false',
  protocolType: 'deterministic',
  title: 'True/False — exact match on "true" or "false"',
  instruction: 'Say true or false.',
  sampleExercise: {
    type: 'true_false',
    instruction: 'True or false?',
    items: ['London is the capital of France.'],
    correctAnswer: 'false',
  },
  answerFixtures: [
    { studentAnswer: 'false', isCorrect: true },
    { studentAnswer: 'False', isCorrect: true, note: 'normalized' },
    { studentAnswer: 'true', isCorrect: false },
    { studentAnswer: 'yes', isCorrect: false, note: 'not a valid answer' },
  ],
  expectedRuntimeBehavior: DETERMINISTIC_RUNTIME,
  expectedTeacherBehavior: DETERMINISTIC_TEACHER,
  expectedValidationBehavior: {
    validationMode: 'deterministic_exact',
    rejectsBlankAnswer: true,
    noExactMatchForSpeaking: false,
  },
  expectedProgressionBehavior: {
    progressionMode: 'locked_item',
    advancesOnCorrect: true,
    blocksOnIncorrect: true,
    noRepeatCompletedItems: true,
    noAdvanceBeforeCorrect: true,
  },
  expectedResumeBehavior: STANDARD_RESUME,
  expectedOffTopicRecovery: STANDARD_OFF_TOPIC,
  expectedCorrectionFlow: STANDARD_CORRECTION,
  allowedFailureModes: [],
  forbiddenBehaviors: ['advance_before_correct', 'repeat_completed_item'],
}

export const ALL_DETERMINISTIC_SCENARIOS: QAScenario[] = [
  FILL_GAP_QA,
  CHOOSE_FROM_BOX_QA,
  COMPLETE_CORRECT_FORM_QA,
  FORM_TRANSFORMATION_QA,
  REWRITE_SENTENCE_QA,
  WRITE_QUESTIONS_QA,
  ERROR_CORRECTION_QA,
  MULTIPLE_CHOICE_QA,
  TRUE_FALSE_QA,
]
