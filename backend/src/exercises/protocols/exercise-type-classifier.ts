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

// ── Forbidden resource content check ─────────────────────────────────────────
// Defense-in-depth: blocks exercises whose instruction/question text contains
// keywords that indicate an unsupported resource (audio, image, long-text writing)
// even when the AI-declared exercise type passes the policy gate.
// Primary case: AI returns type="speaking_prompt" with
// instruction="Look at the photos and describe each person."

const FORBIDDEN_RESOURCE_KEYWORDS: Array<{ keyword: string; reason: string }> = [
  { keyword: 'listen',          reason: 'requires_audio' },
  { keyword: 'audio',           reason: 'requires_audio' },
  { keyword: 'mp3',             reason: 'requires_audio' },
  { keyword: 'track',           reason: 'requires_audio' },
  { keyword: 'photo',           reason: 'requires_image' },
  { keyword: 'photos',          reason: 'requires_image' },
  { keyword: 'picture',         reason: 'requires_image' },
  { keyword: 'pictures',        reason: 'requires_image' },
  { keyword: 'read the text',   reason: 'requires_long_text' },
  { keyword: 'write an email',  reason: 'requires_writing_mode' },
  { keyword: 'write a letter',  reason: 'requires_writing_mode' },
]

export function isInstructionResourceBlocked(instruction: string): { blocked: boolean; reason: string } {
  const lower = instruction.toLowerCase()
  for (const { keyword, reason } of FORBIDDEN_RESOURCE_KEYWORDS) {
    if (lower.includes(keyword)) {
      return { blocked: true, reason: `${reason}:keyword="${keyword}"` }
    }
  }
  return { blocked: false, reason: '' }
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
