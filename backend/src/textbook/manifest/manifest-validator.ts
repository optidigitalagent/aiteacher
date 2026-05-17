// ── Manifest Validator ─────────────────────────────────────────────────────────
// Validates a SectionExerciseManifest before persisting.
// Catches structural errors (missing fields, empty answers on deterministic exercises)
// so bad data never reaches the engine.

import type { SectionExerciseManifest, ExerciseManifestEntry } from '../../lesson/section-manifest.js'

export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

export function validateManifest(manifest: SectionExerciseManifest): ValidationResult {
  const errors:   string[] = []
  const warnings: string[] = []

  if (!manifest.section) errors.push('Missing section ID')
  if (!manifest.unit || manifest.unit < 1) errors.push('Missing or invalid unit number')

  if (!Array.isArray(manifest.exercises) || manifest.exercises.length === 0) {
    errors.push('Manifest has no exercises')
    return { valid: false, errors, warnings }
  }

  let prevNum = 0
  for (const ex of manifest.exercises) {
    validateEntry(ex, errors, warnings, prevNum)
    prevNum = ex.num
  }

  return { valid: errors.length === 0, errors, warnings }
}

// ── Per-entry validation ──────────────────────────────────────────────────────

function validateEntry(
  ex: ExerciseManifestEntry,
  errors: string[],
  warnings: string[],
  prevNum: number,
): void {
  if (!ex.num || ex.num < 1) {
    errors.push(`Exercise has invalid number: ${String(ex.num)}`)
    return
  }

  if (ex.num !== prevNum + 1) {
    warnings.push(`Exercise numbering gap: ${prevNum} → ${ex.num}`)
  }

  if (!ex.instruction || ex.instruction.trim().length < 5) {
    errors.push(`Exercise ${ex.num}: instruction is missing or too short`)
  }

  if (!ex.type) {
    errors.push(`Exercise ${ex.num}: missing type`)
  }

  if (ex.type === 'unknown') {
    warnings.push(`Exercise ${ex.num}: type resolved to 'unknown' — manual review required`)
  }

  if (!ex.executable && !ex.unsupportedReason) {
    errors.push(`Exercise ${ex.num}: non-executable but unsupportedReason is missing`)
  }

  if (ex.executable && ex.runtimeMode === 'deterministic_sequential') {
    validateDeterministicEntry(ex, warnings)
  }
}

function validateDeterministicEntry(ex: ExerciseManifestEntry, warnings: string[]): void {
  if (!ex.items || ex.items.length === 0) {
    warnings.push(`Exercise ${ex.num}: deterministic_sequential has no items — will produce empty exercise`)
    return
  }

  const emptyAnswers = ex.items.filter(i => !i.correctAnswer).length
  if (emptyAnswers > 0) {
    warnings.push(
      `Exercise ${ex.num}: ${emptyAnswers} item(s) missing correctAnswer — ` +
      `provide teacher book text to populate these`,
    )
  }
}
