import type { BehaviorProfile } from './teacher-behavior-types.js'
import type { CorrectionTurn } from '../../lesson/types.js'

const DETERMINISTIC_HINTS: Record<CorrectionTurn, string> = {
  A: 'Ask about the grammar rule behind THIS item (verb form / word order / collocation). Give zero of the answer.',
  B: 'Give the pattern or category (e.g. "with he/she/it, use ___"). No direct word yet.',
  C: 'Give the start of the answer (first letter, first word, or auxiliary). Almost the full answer.',
  D: 'REVEAL fully. Ask student to say the complete correct sentence. Advance after repetition.',
}

const MATCHING_HINTS: Record<CorrectionTurn, string> = {
  A: 'Eliminate 1 wrong option by naming its category/relationship. Do NOT reveal the correct one yet.',
  B: 'REVEAL: "The correct match is [answer]." Move immediately to the next item.',
  C: 'REVEAL: "The correct match is [answer]." Move immediately to the next item.',
  D: 'REVEAL: "The correct match is [answer]." Move immediately to the next item.',
}

export function buildHintGuide(profile: BehaviorProfile, correctionTurn: CorrectionTurn | null): string {
  if (!correctionTurn) return ''
  if (profile === 'deterministic') {
    const h = DETERMINISTIC_HINTS[correctionTurn]
    return h ? `HINT GUIDANCE (TURN ${correctionTurn}): ${h}` : ''
  }
  if (profile === 'matching') {
    const h = MATCHING_HINTS[correctionTurn]
    return h ? `HINT GUIDANCE (TURN ${correctionTurn}): ${h}` : ''
  }
  return ''
}
