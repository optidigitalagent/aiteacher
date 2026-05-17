// ── Manifest Builder ───────────────────────────────────────────────────────────
// Converts ParsedSection → SectionExerciseManifest.
// Output is 100% compatible with the existing section-manifest.ts format.
// The engine consumes this — no modifications needed downstream.

import type { ParsedSection, ParsedExercise, DetectedExerciseType } from '../types.js'
import {
  requiresAudio,
  requiresPartner,
  requiresPhoto,
  isListeningBased,
} from '../classifiers/exercise-type-classifier.js'
import type {
  SectionExerciseManifest,
  ExerciseManifestEntry,
  ManifestRuntimeMode,
  CompletionBehavior,
  UnsupportedReason,
  ManifestItem,
} from '../../lesson/section-manifest.js'

export function buildManifest(parsed: ParsedSection): SectionExerciseManifest {
  return {
    section:   parsed.sectionId,
    unit:      parsed.unitNumber,
    exercises: parsed.exercises.map(buildManifestEntry),
  }
}

// ── Entry builder ─────────────────────────────────────────────────────────────

function buildManifestEntry(ex: ParsedExercise): ExerciseManifestEntry {
  const type         = ex.typeDetection.type
  const audioNeeded  = requiresAudio(type) || isListeningBased(type) || hasListenKeyword(ex.instruction)
  const partnerNeeded = requiresPartner(type)
  const photoNeeded  = requiresPhoto(ex.instruction)
  const executable   = !audioNeeded && !photoNeeded
  const runtimeMode  = resolveRuntimeMode(type, audioNeeded)
  const completionBehavior = resolveCompletionBehavior(type, ex.items.length, runtimeMode)

  const entry: ExerciseManifestEntry = {
    num:               ex.exerciseNumber,
    type:              type,
    executable,
    runtimeMode,
    instruction:       ex.instruction,
    completionBehavior,
  }

  if (!executable) {
    entry.unsupportedReason = resolveUnsupportedReason(audioNeeded, partnerNeeded, photoNeeded)
  }

  if (ex.allowedPrompt && runtimeMode === 'soft_speaking') {
    entry.allowedPrompt = ex.allowedPrompt
  }

  if (executable && ex.items.length > 0) {
    entry.items = ex.items.map((item): ManifestItem => ({
      text:          item.text,
      correctAnswer: item.correctAnswer,
    }))
  }

  return entry
}

// ── Resolution helpers ────────────────────────────────────────────────────────

const SOFT_SPEAKING_TYPES: ReadonlySet<DetectedExerciseType> = new Set([
  'discussion',
  'pair_speaking',
  'personal_fill',
  'reading_comprehension',
  'paragraph_reading',
  'dialogue_practice',
  'translation',
  'vocabulary_list',
])

function resolveRuntimeMode(type: DetectedExerciseType, audioNeeded: boolean): ManifestRuntimeMode {
  if (audioNeeded) return 'unsupported'
  if (SOFT_SPEAKING_TYPES.has(type)) return 'soft_speaking'
  return 'deterministic_sequential'
}

function resolveCompletionBehavior(
  type: DetectedExerciseType,
  itemCount: number,
  runtimeMode: ManifestRuntimeMode,
): CompletionBehavior {
  if (runtimeMode === 'unsupported') return 'skip'
  if (type === 'discussion' || type === 'pair_speaking') return 'single_response'
  if (itemCount > 0) return 'all_items'
  return 'single_response'
}

function resolveUnsupportedReason(
  audioNeeded: boolean,
  partnerNeeded: boolean,
  photoNeeded: boolean,
): UnsupportedReason {
  if (audioNeeded)  return 'requires_audio'
  if (photoNeeded)  return 'requires_photo'
  if (partnerNeeded) return 'requires_partner'
  return 'requires_audio'
}

function hasListenKeyword(instruction: string): boolean {
  return /\blisten\b/i.test(instruction)
}
