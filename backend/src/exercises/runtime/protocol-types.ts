import type { CorrectionTurn } from '../../lesson/types.js'

export interface ProgressionContext {
  itemIndex: number
  itemTotal: number
  exerciseNumber: number
  currentItem: string
}

// Signal returned by validateSignal() — tells the caller what path to take.
// 'correct' / 'incorrect' are deterministic answers.
// 'soft_pass' routes to AI semantic evaluation.
// 'no_validate' means the type cannot be validated — return a safe fallback.
export type ValidationSignal = 'correct' | 'incorrect' | 'soft_pass' | 'no_validate'

export type ProtocolDirective = 'advance' | 'retry' | 'skip' | 'continue'

export interface ExerciseProtocol {
  readonly protocolName: string

  // Can the student advance to the next item?
  canAdvance(correct: boolean, retryCount: number): boolean

  // Classify the student's answer without side effects.
  validateSignal(studentAnswer: string, correctAnswer: string): ValidationSignal

  // What should the runtime do after a correct answer?
  handleCorrect(ctx: ProgressionContext): ProtocolDirective

  // What should the runtime do after a wrong answer?
  handleIncorrect(retryCount: number): ProtocolDirective

  // Build the AI context string for correction turns (injected into processInput).
  buildCorrection(studentAnswer: string, correctAnswer: string, turn: CorrectionTurn): string

  // Build a suffix appended to the student's input when they go off-topic
  // while an exercise is active. Returns '' when the protocol has no recovery.
  buildOffTopicRecovery(currentItem: string, itemIndex: number): string

  // Should the correct answer be revealed at this retry count?
  shouldRevealAnswer(retryCount: number): boolean

  // Is the current item locked until correct (hard progression gate)?
  shouldLockCurrentItem(): boolean

  // Does this protocol use soft AI feedback instead of binary correct/wrong?
  shouldUseSoftFeedback(): boolean
}
