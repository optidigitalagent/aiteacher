import type { ExerciseProtocol, ProgressionContext, ValidationSignal, ProtocolDirective } from './protocol-types.js'
import type { CorrectionTurn } from '../../lesson/types.js'

function normalise(text: string): string {
  return text.trim().toLowerCase().replace(/[.,!?;:'"]/g, '').replace(/\s+/g, ' ')
}

export const deterministicProtocol: ExerciseProtocol = {
  protocolName: 'deterministic',

  canAdvance(correct: boolean, _retryCount: number): boolean {
    return correct
  },

  validateSignal(studentAnswer: string, correctAnswer: string): ValidationSignal {
    if (normalise(studentAnswer) === normalise(correctAnswer)) return 'correct'
    return 'incorrect'
  },

  handleCorrect(_ctx: ProgressionContext): ProtocolDirective {
    return 'advance'
  },

  handleIncorrect(retryCount: number): ProtocolDirective {
    // Exhausted correction ladder (TURN D or beyond) — force advance to unblock the student.
    if (retryCount >= 4) return 'advance'
    return 'retry'
  },

  buildCorrection(studentAnswer: string, correctAnswer: string, turn: CorrectionTurn): string {
    const INSTRUCTIONS: Record<CorrectionTurn, string> = {
      A: `TURN A: Ask ONE guiding question about the specific grammar rule that caused this error. Give ZERO part of the answer.
  Think: what rule did the student miss? Ask about only that.`,
      B: `TURN B: Give ONE small hint — one missing piece of information. Do NOT reveal the full answer.`,
      C: `TURN C: Give a STRONGER hint. Fill in almost everything.
  Example: "It starts with '${correctAnswer.split(' ')[0] ?? '…'}' — what comes next?"`,
      D: `TURN D: REVEAL THE FULL ANSWER NOW.
  Say: "The answer is ${correctAnswer}. [Brief rule in one sentence]. Now repeat the full sentence after me."
  Wait for the student to repeat correctly, then advance to the next item.`,
    }
    return `[DETERMINISTIC CORRECTION] Student answered: "${studentAnswer}" — INCORRECT.
Correct answer (do NOT reveal until TURN D): "${correctAnswer}".

CORRECTION LADDER — you are at ${turn === 'D' ? 'TURN D — REVEAL THE ANSWER' : `TURN ${turn}`}:
${INSTRUCTIONS[turn]}

Set "exercise": null — do NOT advance the item until the student answers correctly or TURN D resolves.
Do NOT restart at TURN A. You are at TURN ${turn}. Stay here.`
  },

  buildOffTopicRecovery(currentItem: string, itemIndex: number): string {
    const itemNum = itemIndex + 1
    const itemHint = currentItem ? ` — "${currentItem.slice(0, 60)}"` : ''
    return `\n\n[PROTOCOL: OFF-TOPIC RECOVERY] Answer the question briefly. Then immediately return to the exercise: "Now, let's get back to number ${itemNum}${itemHint}. What's your answer?"`
  },

  shouldRevealAnswer(retryCount: number): boolean {
    return retryCount >= 4
  },

  shouldLockCurrentItem(): boolean {
    return true
  },

  shouldUseSoftFeedback(): boolean {
    return false
  },
}
