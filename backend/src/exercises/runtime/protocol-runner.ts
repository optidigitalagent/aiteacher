// Protocol Runner
// Central router: selects the runtime protocol for a canonical exercise type
// and exposes helper functions used by the WS layer and orchestrator.

import { getExercisePolicy } from '../protocols/index.js'
import { deterministicProtocol } from './deterministic.protocol.js'
import { matchingProtocol } from './matching.protocol.js'
import { speakingProtocol } from './speaking.protocol.js'
import { grammarFocusProtocol } from './grammar-focus.protocol.js'
import { unsupportedProtocol } from './unsupported.protocol.js'
import type { ExerciseProtocol } from './protocol-types.js'
import type { CorrectionTurn } from '../../lesson/types.js'

// ── Protocol selection ────────────────────────────────────────────────────────

export function selectProtocol(type: string): ExerciseProtocol {
  const policy = getExercisePolicy(type)

  switch (policy.runtimeMode) {
    case 'deterministic_sequential':
      return deterministicProtocol

    case 'matching_sequential':
      return matchingProtocol

    case 'soft_speaking':
    case 'warmup_activation':
      return speakingProtocol

    case 'grammar_explanation':
    case 'teacher_explanation':
      return grammarFocusProtocol

    case 'skipped':
    case 'future_listening_mode':
    case 'future_reading_mode':
    case 'future_writing_mode':
    case 'future_pronunciation_mode':
    default:
      return unsupportedProtocol
  }
}

// ── Derived helpers ───────────────────────────────────────────────────────────

/** True when the current item must be locked until correct (hard progression gate). */
export function shouldLockProgression(type: string): boolean {
  return selectProtocol(type).shouldLockCurrentItem()
}

/** True when the exercise type uses soft AI feedback instead of binary correct/wrong. */
export function useSoftFeedback(type: string): boolean {
  return selectProtocol(type).shouldUseSoftFeedback()
}

/**
 * Build the correction context string for an incorrect answer.
 * Injected into the AI input so it knows which turn it's on and what to do.
 */
export function buildProtocolCorrection(
  type: string,
  studentAnswer: string,
  correctAnswer: string,
  turn: CorrectionTurn,
): string {
  const protocol = selectProtocol(type)
  console.log(`[protocol] correction type=${type} protocol=${protocol.protocolName} turn=${turn}`)
  return protocol.buildCorrection(studentAnswer, correctAnswer, turn)
}

/**
 * Build the off-topic recovery suffix appended to the student's input.
 * Returns '' when the exercise type has no active item to return to (unsupported).
 */
export function buildProtocolOffTopicRecovery(
  type: string,
  currentItem: string,
  itemIndex: number,
): string {
  const protocol = selectProtocol(type)
  const recovery = protocol.buildOffTopicRecovery(currentItem, itemIndex)
  if (recovery) {
    console.log(`[offtopic] type=${type} protocol=${protocol.protocolName} returnedToItem=${itemIndex + 1}`)
  }
  return recovery
}
