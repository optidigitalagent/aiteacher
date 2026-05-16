import type { ExerciseProtocol, ProgressionContext, ValidationSignal, ProtocolDirective } from './protocol-types.js'
import type { CorrectionTurn } from '../../lesson/types.js'

const PHONETIC_TO_LETTER: Record<string, string> = {
  ay: 'a', bee: 'b', see: 'c', dee: 'd',
}

function extractSpokenLetter(raw: string): string | null {
  const s = raw.trim().toLowerCase()

  if (/^[a-d]$/.test(s)) return s
  if (PHONETIC_TO_LETTER[s]) return PHONETIC_TO_LETTER[s]!

  const prefixLetter = s.match(/(?:letter|option|answer(?:\s+is)?)\s+([a-d])\b/)
  if (prefixLetter) return prefixLetter[1]!

  const prefixPhonetic = s.match(/(?:letter|option|answer(?:\s+is)?)\s+(ay|bee|see|dee)\b/)
  if (prefixPhonetic) return PHONETIC_TO_LETTER[prefixPhonetic[1]!] ?? null

  const numberedLetter = s.match(/(?:\d+|one|two|three|four|five|six)\s*[-\s]+([a-d])\b/)
  if (numberedLetter) return numberedLetter[1]!

  return null
}

function normalise(text: string): string {
  return text.trim().toLowerCase().replace(/[.,!?;:'"]/g, '').replace(/\s+/g, ' ')
}

export const matchingProtocol: ExerciseProtocol = {
  protocolName: 'matching',

  canAdvance(correct: boolean, _retryCount: number): boolean {
    return correct
  },

  validateSignal(studentAnswer: string, correctAnswer: string): ValidationSignal {
    const normCorrect = correctAnswer.trim().toLowerCase()
    const isLetterBased = /^[a-d]$/.test(normCorrect)

    if (isLetterBased) {
      const extracted = extractSpokenLetter(studentAnswer)
      if (extracted === normCorrect) return 'correct'
      if (normalise(studentAnswer) === normCorrect) return 'correct'
      return 'incorrect'
    }

    if (normalise(studentAnswer) === normalise(correctAnswer)) return 'correct'
    return 'incorrect'
  },

  handleCorrect(_ctx: ProgressionContext): ProtocolDirective {
    return 'advance'
  },

  handleIncorrect(retryCount: number): ProtocolDirective {
    // Reveal on second fail for matching — faster than deterministic ladder.
    if (retryCount >= 2) return 'advance'
    return 'retry'
  },

  buildCorrection(studentAnswer: string, correctAnswer: string, turn: CorrectionTurn): string {
    const shouldReveal = turn === 'C' || turn === 'D'

    if (shouldReveal) {
      return `[MATCHING CORRECTION] Student answered: "${studentAnswer}" — INCORRECT.
TURN ${turn}: Reveal the correct pair now.
Say: "The correct match is ${correctAnswer}." Then immediately move to the next item.
Set "exercise": null.`
    }

    return `[MATCHING CORRECTION] Student answered: "${studentAnswer}" — INCORRECT.
Correct answer: "${correctAnswer}".
TURN ${turn}: Remind the student to look at the remaining options. Eliminate one obviously wrong option as a category clue. Do NOT reveal the answer yet.
Set "exercise": null — stay on the current matching item.`
  },

  buildOffTopicRecovery(currentItem: string, itemIndex: number): string {
    const itemNum  = itemIndex + 1
    // Strip leading "N." / "N)" prefix so the anchor phrase is not doubly-numbered
    const label    = currentItem.replace(/^\d+[.)]\s*/, '').trim() || currentItem
    const itemHint = label ? ` ("${label.slice(0, 40)}")` : ''
    return (
      `\n\n[PROTOCOL: OFF-TOPIC RECOVERY — LOCKED EXERCISE]\n` +
      `Step 1: Answer the student's question in 1–2 sentences.\n` +
      `Step 2: MANDATORY CLOSING — end your response with exactly: "Now let's continue. Number ${itemNum}${itemHint}."\n` +
      `FORBIDDEN: Do NOT return to Number 1. Do NOT re-ask completed items. ` +
      `The current unresolved item is Number ${itemNum}.`
    )
  },

  shouldRevealAnswer(retryCount: number): boolean {
    return retryCount >= 2
  },

  shouldLockCurrentItem(): boolean {
    return true
  },

  shouldUseSoftFeedback(): boolean {
    return false
  },
}
