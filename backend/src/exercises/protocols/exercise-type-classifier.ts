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

// ── Listening-section safety check ───────────────────────────────────────────
// Exercise types that are safe to run inside a Listening section because they
// do NOT require the student to recall audio content (they use visible text or
// free speaking instead). Everything else in a Listening section is implicitly
// audio-dependent and must be hard-skipped.

const LISTENING_SECTION_SAFE_TYPES = new Set<string>([
  'speaking_prompt',
  'discussion',
  'roleplay',
  'show_interest_agree_disagree',
  'brainstorm_60_second',
  'show_what_you_know',
  'grammar_focus',
  'remember_this',
  'free_production',
  'write_sentences_from_prompts',
])

export function isListeningSectionSafe(type: string): boolean {
  return LISTENING_SECTION_SAFE_TYPES.has(normalizeExerciseType(type))
}

// ── Mixed exercise boundary detection ────────────────────────────────────────
// Detects when the AI has merged two adjacent textbook exercises:
//   Exercise N  : discussion/pair-work intro  ("In pairs discuss who your role models are.")
//   Exercise N+1: listening comprehension Qs  ("Who inspires you?", "What does he do?")
//
// The merged result looks like a discussion exercise, but its items[] come from a
// listening task — the answers require hidden audio and cannot be given by the student.
//
// Detection heuristic:
//   • Instruction matches a discussion/pair-work signal ("in pairs", "discuss", "with a partner")
//   • Exercise has ≥3 items that are ALL short (≤10 words) WH-questions
// When both are true, the exercise is structurally invalid (cross-boundary merge) → hard skip.

const DISCUSSION_INTRO_RE = /\b(in pairs|with (a|your) partner|ask and answer|discuss( with)?)\b/i

export function isMixedExerciseBoundary(exercise: {
  instruction?: string
  items?: string[]
}): { mixed: boolean; reason: string } {
  const instruction = exercise.instruction ?? ''
  const items = exercise.items ?? []

  if (!DISCUSSION_INTRO_RE.test(instruction) || items.length < 3) {
    return { mixed: false, reason: '' }
  }

  // Count items that look like listening-comprehension questions:
  // short (≤10 words), starting with a WH-word, and not an open invitation to share opinions.
  const comprehensionItems = items.filter(item => {
    const text = item.replace(/^\d+[.)]\s*/, '').trim()
    const wordCount = text.split(/\s+/).length
    return wordCount <= 10 && /^(who|what|where|when|why|how|which)\b/i.test(text)
  })

  if (comprehensionItems.length >= 3) {
    return {
      mixed: true,
      reason: `discussion_intro_with_${comprehensionItems.length}_comprehension_items`,
    }
  }

  return { mixed: false, reason: '' }
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
