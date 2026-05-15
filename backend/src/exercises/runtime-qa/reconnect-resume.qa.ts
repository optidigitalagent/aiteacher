// Reconnect / Resume QA Scenarios
// Covers: reload during exercise, reconnect during correction, WS recovery,
//         duplicate focus_lesson_start, resume with cursor/item/options.

import type { QAScenario } from './qa-types.js'

export interface ReconnectScenario {
  readonly scenarioId: string
  readonly title: string
  readonly description: string
  readonly setup: string
  readonly reconnectTrigger: string
  readonly expectedState: {
    lessonNotRestarted: boolean
    itemIndexPreserved: boolean
    correctionTurnPreserved: boolean
    matchingOptionsPreserved: boolean
    noItemRegression: boolean
    noDuplicateProgression: boolean
    currentExerciseIdPreserved: boolean
  }
  readonly forbiddenBehaviors: string[]
  readonly criticalChecks: string[]
}

export const RELOAD_DURING_ACTIVE_EXERCISE: ReconnectScenario = {
  scenarioId: 'reconnect_001',
  title: 'Reload during active exercise — resume from current item',
  description: 'Student reloads the page while on item 2 of 5 in a fill_gap exercise.',
  setup: 'Lesson active. Exercise fill_gap. itemIndex=1. No correction turn in progress.',
  reconnectTrigger: 'Browser refresh / page reload',
  expectedState: {
    lessonNotRestarted: true,
    itemIndexPreserved: true,
    correctionTurnPreserved: false,
    matchingOptionsPreserved: false,
    noItemRegression: true,
    noDuplicateProgression: true,
    currentExerciseIdPreserved: true,
  },
  forbiddenBehaviors: [
    'restart_lesson_on_reconnect',
    'advance_before_correct',
    'repeat_completed_item',
    'restart exercise from item 0',
  ],
  criticalChecks: [
    'currentExerciseId matches what was in Redis before reload',
    'itemIndex is 1 after reconnect (not 0)',
    'teacher greets from current item, not from beginning',
    'no duplicate focus_lesson_start emitted',
  ],
}

export const RECONNECT_DURING_CORRECTION: ReconnectScenario = {
  scenarioId: 'reconnect_002',
  title: 'Reconnect during correction ladder — correctionTurn preserved',
  description: 'Student disconnects after TURN_B incorrect answer (retry count = 2).',
  setup: 'Lesson active. fill_gap. itemIndex=0. correctionTurn=2. WS dropped.',
  reconnectTrigger: 'WebSocket disconnection and reconnection',
  expectedState: {
    lessonNotRestarted: true,
    itemIndexPreserved: true,
    correctionTurnPreserved: true,
    matchingOptionsPreserved: false,
    noItemRegression: true,
    noDuplicateProgression: true,
    currentExerciseIdPreserved: true,
  },
  forbiddenBehaviors: [
    'restart_lesson_on_reconnect',
    'skip_correction_turn',
    'reset correctionTurn to 0 after reconnect',
    'advance_before_correct',
  ],
  criticalChecks: [
    'correctionTurn is 2 after reconnect (not 0)',
    'teacher resumes at TURN_C (third hint), not TURN_A',
    'reveal happens at TURN_D, not before',
  ],
}

export const RECONNECT_DURING_MATCHING: ReconnectScenario = {
  scenarioId: 'reconnect_003',
  title: 'Reconnect during matching — options preserved',
  description: 'Student on matching item 2 of 4 when WS drops. Options a–d must be shown again.',
  setup: 'Lesson active. matching. itemIndex=1. options=[a,b,c,d]. WS dropped.',
  reconnectTrigger: 'WebSocket disconnection and reconnection',
  expectedState: {
    lessonNotRestarted: true,
    itemIndexPreserved: true,
    correctionTurnPreserved: false,
    matchingOptionsPreserved: true,
    noItemRegression: true,
    noDuplicateProgression: true,
    currentExerciseIdPreserved: true,
  },
  forbiddenBehaviors: [
    'restart_lesson_on_reconnect',
    'run_without_options',
    'ask_all_pairs_at_once',
    'lose matching options on reconnect',
  ],
  criticalChecks: [
    'options re-displayed after reconnect',
    'teacher returns to item 2 (not item 1)',
    'no pairs from item 1 re-asked',
  ],
}

export const RECONNECT_DURING_SPEAKING: ReconnectScenario = {
  scenarioId: 'reconnect_004',
  title: 'Reconnect during speaking — soft state, no crash',
  description: 'Student disconnects mid-speaking exercise. No hard state to restore.',
  setup: 'Lesson active. speaking_prompt. WS dropped mid-response.',
  reconnectTrigger: 'WebSocket disconnection',
  expectedState: {
    lessonNotRestarted: true,
    itemIndexPreserved: false,
    correctionTurnPreserved: false,
    matchingOptionsPreserved: false,
    noItemRegression: true,
    noDuplicateProgression: true,
    currentExerciseIdPreserved: true,
  },
  forbiddenBehaviors: [
    'restart_lesson_on_reconnect',
    'exact_match_on_speaking',
    'crash on missing correctionTurn for speaking type',
  ],
  criticalChecks: [
    'no runtime crash on reconnect',
    'teacher re-asks speaking prompt naturally',
    'no hard correction ladder started for speaking type',
  ],
}

export const STALE_WS_RECOVERY: ReconnectScenario = {
  scenarioId: 'reconnect_005',
  title: 'Stale WebSocket recovery — no duplicate session',
  description: 'Old WS still open when student reconnects. Old session must be evicted.',
  setup: 'Lesson active on WS-A. Student reconnects on WS-B. WS-A still alive.',
  reconnectTrigger: 'New WS connection while old one still exists',
  expectedState: {
    lessonNotRestarted: true,
    itemIndexPreserved: true,
    correctionTurnPreserved: true,
    matchingOptionsPreserved: true,
    noItemRegression: true,
    noDuplicateProgression: true,
    currentExerciseIdPreserved: true,
  },
  forbiddenBehaviors: [
    'two concurrent sessions for same student',
    'WS-A continues processing after WS-B takes over',
    'restart_lesson_on_reconnect',
    'duplicate progression events',
  ],
  criticalChecks: [
    'WS-A evicted cleanly',
    'WS-B picks up exact Redis state',
    'no duplicate AI calls from both WS connections',
  ],
}

export const DUPLICATE_FOCUS_LESSON_START: ReconnectScenario = {
  scenarioId: 'reconnect_006',
  title: 'Duplicate focus_lesson_start — idempotent handling',
  description: 'focus_lesson_start emitted twice (frontend bug or race condition).',
  setup: 'Lesson in DIAGNOSTIC phase. focus_lesson_start fired twice within 500ms.',
  reconnectTrigger: 'Duplicate frontend event',
  expectedState: {
    lessonNotRestarted: true,
    itemIndexPreserved: true,
    correctionTurnPreserved: true,
    matchingOptionsPreserved: true,
    noItemRegression: true,
    noDuplicateProgression: true,
    currentExerciseIdPreserved: true,
  },
  forbiddenBehaviors: [
    'restart lesson on second focus_lesson_start',
    'duplicate AI greeting emitted',
    'duplicate progression from second event',
  ],
  criticalChecks: [
    'second focus_lesson_start is silently ignored or de-duped',
    'lesson state unchanged after second event',
  ],
}

export const RESUME_WITH_EXERCISE_CURSOR: ReconnectScenario = {
  scenarioId: 'reconnect_007',
  title: 'Resume with currentExerciseId in snapshot',
  description: 'Snapshot has currentExerciseId set. Runtime must resume from that exercise.',
  setup: 'Snapshot: { currentExerciseId: "ex-42", exerciseCursor: 3, itemIndex: 1 }',
  reconnectTrigger: 'Page reload after mid-lesson disconnect',
  expectedState: {
    lessonNotRestarted: true,
    itemIndexPreserved: true,
    correctionTurnPreserved: false,
    matchingOptionsPreserved: false,
    noItemRegression: true,
    noDuplicateProgression: true,
    currentExerciseIdPreserved: true,
  },
  forbiddenBehaviors: [
    'start from exercise 0 instead of exercise 3',
    'advance_before_correct',
    'restart_lesson_on_reconnect',
  ],
  criticalChecks: [
    'exerciseCursor=3 used (not 0)',
    'itemIndex=1 used (not 0)',
    'currentExerciseId="ex-42" matches loaded exercise',
  ],
}

export const ALL_RECONNECT_SCENARIOS: ReconnectScenario[] = [
  RELOAD_DURING_ACTIVE_EXERCISE,
  RECONNECT_DURING_CORRECTION,
  RECONNECT_DURING_MATCHING,
  RECONNECT_DURING_SPEAKING,
  STALE_WS_RECOVERY,
  DUPLICATE_FOCUS_LESSON_START,
  RESUME_WITH_EXERCISE_CURSOR,
]
