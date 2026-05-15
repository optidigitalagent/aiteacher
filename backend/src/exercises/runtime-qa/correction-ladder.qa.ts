// Correction Ladder QA Scenarios
// Covers: TURN_A, TURN_B, TURN_C, TURN_D escalation.
// Critical: reveal ONLY at TURN_D. Speaking bypasses strict ladder.

import type { QAScenario } from './qa-types.js'

export interface CorrectionLadderScenario {
  readonly scenarioId: string
  readonly exerciseType: string
  readonly title: string
  readonly description: string
  readonly turns: Array<{
    turn: string
    retryCount: number
    studentAnswer: string
    expectedTeacherAction: string
    shouldReveal: boolean
    shouldAdvance: boolean
  }>
  readonly forbiddenBehaviors: string[]
  readonly criticalChecks: string[]
}

export const FILL_GAP_CORRECTION_LADDER: CorrectionLadderScenario = {
  scenarioId: 'correction_001',
  exerciseType: 'fill_gap',
  title: 'Fill gap — full A→B→C→D correction ladder',
  description: 'Student fails all turns. Reveal happens only at TURN_D.',
  turns: [
    {
      turn: 'TURN_A',
      retryCount: 1,
      studentAnswer: 'go',
      expectedTeacherAction: 'Mini hint — point to grammar pattern (present simple 3rd person).',
      shouldReveal: false,
      shouldAdvance: false,
    },
    {
      turn: 'TURN_B',
      retryCount: 2,
      studentAnswer: 'going',
      expectedTeacherAction: 'Stronger hint — give the first letter or rule name.',
      shouldReveal: false,
      shouldAdvance: false,
    },
    {
      turn: 'TURN_C',
      retryCount: 3,
      studentAnswer: 'gone',
      expectedTeacherAction: 'Near-reveal hint — give most of the answer structure.',
      shouldReveal: false,
      shouldAdvance: false,
    },
    {
      turn: 'TURN_D',
      retryCount: 4,
      studentAnswer: 'goed',
      expectedTeacherAction: 'Reveal the correct answer. State it clearly. Then move forward.',
      shouldReveal: true,
      shouldAdvance: true,
    },
  ],
  forbiddenBehaviors: [
    'reveal_on_first_hint',
    'reveal before TURN_D',
    'advance_before_correct',
    'skip TURN_B or TURN_C',
    'loop back to TURN_A after TURN_D',
  ],
  criticalChecks: [
    'shouldRevealAnswer(retryCount=1) === false',
    'shouldRevealAnswer(retryCount=2) === false',
    'shouldRevealAnswer(retryCount=3) === false',
    'shouldRevealAnswer(retryCount=4) === true',
    'handleIncorrect(retryCount=4) === "advance"',
  ],
}

export const MATCHING_CORRECTION_LADDER: CorrectionLadderScenario = {
  scenarioId: 'correction_002',
  exerciseType: 'matching',
  title: 'Matching — 2-turn correction (TURN_A hint, TURN_B reveal)',
  description: 'Matching uses a shorter 2-turn ladder. Reveal at second fail.',
  turns: [
    {
      turn: 'TURN_A',
      retryCount: 1,
      studentAnswer: 'b',
      expectedTeacherAction: 'Hint — remind student to check remaining options, eliminate obvious wrong.',
      shouldReveal: false,
      shouldAdvance: false,
    },
    {
      turn: 'TURN_B',
      retryCount: 2,
      studentAnswer: 'c',
      expectedTeacherAction: 'Reveal the correct letter and move to next pair.',
      shouldReveal: true,
      shouldAdvance: true,
    },
  ],
  forbiddenBehaviors: [
    'reveal_on_first_hint',
    'ask_all_pairs_at_once',
    'run_without_options',
    'continue matching beyond reveal without advancing',
  ],
  criticalChecks: [
    'shouldRevealAnswer(retryCount=1) === false',
    'shouldRevealAnswer(retryCount=2) === true',
    'handleIncorrect(retryCount=2) === "advance"',
  ],
}

export const SPEAKING_NO_STRICT_LADDER: CorrectionLadderScenario = {
  scenarioId: 'correction_003',
  exerciseType: 'speaking_prompt',
  title: 'Speaking — NO strict correction ladder, NO reveal',
  description: 'Speaking exercises use soft feedback. No TURN_D reveal. No exact-match gate.',
  turns: [
    {
      turn: 'SOFT_FEEDBACK',
      retryCount: 0,
      studentAnswer: 'I go to school every day.',
      expectedTeacherAction: 'Note grammar (present vs present simple). Give one useful comment. Move on.',
      shouldReveal: false,
      shouldAdvance: true,
    },
  ],
  forbiddenBehaviors: [
    'exact_match_on_speaking',
    'run strict A→D ladder for speaking',
    'reveal "the correct answer" for speaking',
    'block progression until exact answer for speaking',
  ],
  criticalChecks: [
    'shouldUseSoftFeedback() === true for speaking',
    'shouldLockCurrentItem() === false for speaking',
    'shouldRevealAnswer(any retryCount) === false for speaking',
  ],
}

export const RETRY_COUNT_PRESERVED_RECONNECT: CorrectionLadderScenario = {
  scenarioId: 'correction_004',
  exerciseType: 'fill_gap',
  title: 'Correction ladder — retry count preserved after reconnect',
  description: 'Student is at TURN_B (retryCount=2) when WS drops. After reconnect, stays at TURN_B.',
  turns: [
    {
      turn: 'TURN_B (post-reconnect)',
      retryCount: 2,
      studentAnswer: 'goes',
      expectedTeacherAction: 'Resume at TURN_B level — stronger hint. Not back to TURN_A.',
      shouldReveal: false,
      shouldAdvance: true,
    },
  ],
  forbiddenBehaviors: [
    'reset correctionTurn to 0 after reconnect',
    'restart_lesson_on_reconnect',
    'skip to TURN_D prematurely',
  ],
  criticalChecks: [
    'correctionTurn in Redis snapshot === 2 before reconnect',
    'correctionTurn === 2 after reconnect',
    'teacher behavior matches TURN_B level, not TURN_A',
  ],
}

export const NO_ADVANCE_BEFORE_REVEAL: CorrectionLadderScenario = {
  scenarioId: 'correction_005',
  exerciseType: 'error_correction',
  title: 'Error correction — item locked until TURN_D or correct answer',
  description: 'Item must not advance between TURN_A and TURN_C. Only advance on correct OR at TURN_D.',
  turns: [
    {
      turn: 'TURN_A',
      retryCount: 1,
      studentAnswer: 'She don\'t like coffee.',
      expectedTeacherAction: 'Hint — find the verb form issue.',
      shouldReveal: false,
      shouldAdvance: false,
    },
    {
      turn: 'TURN_B',
      retryCount: 2,
      studentAnswer: 'She not like coffee.',
      expectedTeacherAction: 'Stronger hint — still wrong.',
      shouldReveal: false,
      shouldAdvance: false,
    },
    {
      turn: 'CORRECT',
      retryCount: 2,
      studentAnswer: 'She doesn\'t like coffee.',
      expectedTeacherAction: 'Correct! Advance to next item.',
      shouldReveal: false,
      shouldAdvance: true,
    },
  ],
  forbiddenBehaviors: [
    'advance_before_correct',
    'advance during TURN_A or TURN_B without correct answer',
    'reveal_on_first_hint',
  ],
  criticalChecks: [
    'canAdvance(false, 1) === false',
    'canAdvance(false, 2) === false',
    'canAdvance(true, 2) === true',
  ],
}

export const ALL_CORRECTION_LADDER_SCENARIOS: CorrectionLadderScenario[] = [
  FILL_GAP_CORRECTION_LADDER,
  MATCHING_CORRECTION_LADDER,
  SPEAKING_NO_STRICT_LADDER,
  RETRY_COUNT_PRESERVED_RECONNECT,
  NO_ADVANCE_BEFORE_REVEAL,
]
