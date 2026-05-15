import type { ExerciseProtocol, ProgressionContext, ValidationSignal, ProtocolDirective } from './protocol-types.js'
import type { CorrectionTurn } from '../../lesson/types.js'

export const grammarFocusProtocol: ExerciseProtocol = {
  protocolName: 'grammar_focus',

  canAdvance(_correct: boolean, _retryCount: number): boolean {
    // Advance after explanation + quick comprehension check.
    return true
  },

  validateSignal(_studentAnswer: string, _correctAnswer: string): ValidationSignal {
    // Grammar focus uses soft AI evaluation for the check question.
    return 'soft_pass'
  },

  handleCorrect(_ctx: ProgressionContext): ProtocolDirective {
    return 'advance'
  },

  handleIncorrect(_retryCount: number): ProtocolDirective {
    // Re-explain once, then ask the check question again.
    return 'retry'
  },

  buildCorrection(_studentAnswer: string, _correctAnswer: string, _turn: CorrectionTurn): string {
    return `[GRAMMAR FOCUS CORRECTION] The student's comprehension check answer was unclear or incorrect.
Re-explain the key grammar point briefly (1–2 sentences only — do NOT lecture).
Then ask the same comprehension check question again.
Do NOT run a full correction ladder — this is explanation mode, not an exercise drill.`
  },

  buildOffTopicRecovery(_currentItem: string, _itemIndex: number): string {
    return `\n\n[PROTOCOL: OFF-TOPIC RECOVERY] Answer the question briefly. Then return to the grammar explanation.`
  },

  shouldRevealAnswer(_retryCount: number): boolean {
    return false
  },

  shouldLockCurrentItem(): boolean {
    // Grammar focus does not hard-lock — it advances after the check.
    return false
  },

  shouldUseSoftFeedback(): boolean {
    return true
  },
}
