import type { ExerciseProtocol, ProgressionContext, ValidationSignal, ProtocolDirective } from './protocol-types.js'
import type { CorrectionTurn } from '../../lesson/types.js'

export const speakingProtocol: ExerciseProtocol = {
  protocolName: 'speaking',

  canAdvance(_correct: boolean, _retryCount: number): boolean {
    // Always allow advancement after one substantive response — no hard lock.
    return true
  },

  validateSignal(_studentAnswer: string, _correctAnswer: string): ValidationSignal {
    // All speaking tasks route to AI semantic evaluation.
    return 'soft_pass'
  },

  handleCorrect(_ctx: ProgressionContext): ProtocolDirective {
    return 'advance'
  },

  handleIncorrect(_retryCount: number): ProtocolDirective {
    // Soft continue — one improvement suggestion, then move on.
    return 'continue'
  },

  buildCorrection(_studentAnswer: string, _correctAnswer: string, _turn: CorrectionTurn): string {
    return `[SOFT SPEAKING FEEDBACK] This is an open speaking task — there is no single fixed correct answer.
Acknowledge the student's effort. Give ONE specific improvement suggestion (grammar, vocabulary, or task completion).
Do NOT say "The correct answer is…".
Do NOT lock the student on this item — offer the improvement suggestion, then continue.
Set "exercise": null.`
  },

  buildOffTopicRecovery(currentItem: string, _itemIndex: number): string {
    const taskHint = currentItem ? ` Try to talk about: "${currentItem.slice(0, 60)}"` : ''
    return `\n\n[PROTOCOL: OFF-TOPIC RECOVERY] Answer briefly. Then gently refocus the student on the speaking task.${taskHint}`
  },

  shouldRevealAnswer(_retryCount: number): boolean {
    // Never reveal a "correct answer" for open speaking tasks.
    return false
  },

  shouldLockCurrentItem(): boolean {
    // No hard lock for open speaking.
    return false
  },

  shouldUseSoftFeedback(): boolean {
    return true
  },
}
