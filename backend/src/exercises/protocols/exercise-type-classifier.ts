// Exercise Type Classifier
// Maps raw exercise type strings and instruction text to canonical policies.

import { EXERCISE_POLICY_MAP } from './exercise-policy.js'
import { EXERCISE_TYPE_ALIASES } from './supported-exercise-types.js'
import type { CanonicalExerciseType } from './supported-exercise-types.js'
import type { ExercisePolicy, DowngradeStrategy, SnapshotValidationResult } from './exercise-protocols.js'

// ── Type normalisation ────────────────────────────────────────────────────────

export function normalizeExerciseType(inputType?: string): CanonicalExerciseType {
  if (!inputType) return 'unknown'

  const cleaned = inputType.trim().toLowerCase().replace(/[\s-]+/g, '_')

  // Direct match in policy map
  if (cleaned in EXERCISE_POLICY_MAP) return cleaned as CanonicalExerciseType

  // Alias lookup
  if (cleaned in EXERCISE_TYPE_ALIASES) return EXERCISE_TYPE_ALIASES[cleaned]!

  return 'unknown'
}

// ── Instruction-based inference ───────────────────────────────────────────────

export function inferExerciseTypeFromInstruction(instruction: string): CanonicalExerciseType | null {
  const lower = instruction.toLowerCase()

  for (const [type, policy] of Object.entries(EXERCISE_POLICY_MAP)) {
    if (type === 'unknown') continue
    for (const signal of policy.detectionSignals) {
      if (lower.includes(signal.toLowerCase())) {
        return type as CanonicalExerciseType
      }
    }
  }

  return null
}

// ── Policy retrieval ──────────────────────────────────────────────────────────

export function getExercisePolicy(type: string): ExercisePolicy {
  const canonical = normalizeExerciseType(type)
  return EXERCISE_POLICY_MAP[canonical] ?? EXERCISE_POLICY_MAP['unknown']
}

// ── Runtime gate ──────────────────────────────────────────────────────────────

export function isExerciseAllowedInCurrentRuntime(type: string): boolean {
  return getExercisePolicy(type).allowInCurrentRuntime
}

// ── Downgrade checks ──────────────────────────────────────────────────────────

export function shouldDowngradeExercise(type: string): boolean {
  const policy = getExercisePolicy(type)
  return !policy.allowInCurrentRuntime && policy.downgradeStrategy !== 'none'
}

export function getDowngradeStrategy(type: string): DowngradeStrategy {
  return getExercisePolicy(type).downgradeStrategy
}

// ── Snapshot shape validation ─────────────────────────────────────────────────

export function validateExerciseSnapshotShape(
  type: string,
  snapshot: Record<string, unknown>,
): SnapshotValidationResult {
  const policy = getExercisePolicy(type)

  if (!policy.allowInCurrentRuntime) {
    return { ok: false, reason: `Exercise type "${type}" is not supported in the current runtime (${policy.supportStatus}).` }
  }

  if (policy.requiresOptions) {
    const options = snapshot['options']
    if (!Array.isArray(options) || options.length === 0) {
      return { ok: false, reason: `Exercise type "${type}" requires options but none were provided.` }
    }
  }

  if (policy.requiresCorrectAnswer) {
    const correctAnswer = snapshot['correct_answer'] ?? snapshot['correctAnswer']
    if (!correctAnswer || (typeof correctAnswer === 'string' && correctAnswer.trim() === '')) {
      return { ok: false, reason: `Exercise type "${type}" requires a correct_answer but none was provided.` }
    }
  }

  const hasItem = snapshot['question'] ?? snapshot['item'] ?? snapshot['prompt']
  if (!hasItem && policy.runtimeMode !== 'grammar_explanation' && policy.runtimeMode !== 'teacher_explanation') {
    return { ok: false, reason: `Exercise type "${type}" requires a question/item/prompt.` }
  }

  return { ok: true }
}
