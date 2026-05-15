import type { ExerciseProtocol, ProgressionContext, ValidationSignal, ProtocolDirective } from './protocol-types.js'
import type { CorrectionTurn } from '../../lesson/types.js'

export const unsupportedProtocol: ExerciseProtocol = {
  protocolName: 'unsupported',

  canAdvance(_correct: boolean, _retryCount: number): boolean {
    // Skip immediately — never block on unsupported types.
    return true
  },

  validateSignal(_studentAnswer: string, _correctAnswer: string): ValidationSignal {
    return 'no_validate'
  },

  handleCorrect(_ctx: ProgressionContext): ProtocolDirective {
    return 'skip'
  },

  handleIncorrect(_retryCount: number): ProtocolDirective {
    return 'skip'
  },

  buildCorrection(_studentAnswer: string, _correctAnswer: string, _turn: CorrectionTurn): string {
    return `[UNSUPPORTED EXERCISE] This exercise type is not supported in the current runtime.
Explain briefly that this exercise requires a feature not yet available (audio/visual/writing mode).
Move to the next exercise. Do NOT attempt validation. Do NOT invent exercise content.`
  },

  buildOffTopicRecovery(_currentItem: string, _itemIndex: number): string {
    // Unsupported types have no active exercise to recover to.
    return ''
  },

  shouldRevealAnswer(_retryCount: number): boolean {
    return false
  },

  shouldLockCurrentItem(): boolean {
    // Never lock on unsupported types.
    return false
  },

  shouldUseSoftFeedback(): boolean {
    return false
  },
}
