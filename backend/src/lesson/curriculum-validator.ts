// Curriculum validation utilities — Phase 7
// Validates section IDs, exercise types, cursor references.
// Logs missing content for debugging without crashing the runtime.

import { getCatalogEntry, getSectionDataQuality } from './curriculum-catalog.js'

export type ExerciseType =
  | 'fill_gap'
  | 'grammar_transform'
  | 'word_box'
  | 'reading'
  | 'speaking_prompt'
  | 'vocabulary_matching'
  | 'form_transformation'
  | 'multiple_choice'
  | 'error_correction'
  | 'listening_comprehension'
  | 'reflection_quiz'

const KNOWN_EXERCISE_TYPES = new Set<string>([
  'fill_gap',
  'grammar_transform',
  'word_box',
  'reading',
  'speaking_prompt',
  'vocabulary_matching',
  'form_transformation',
  'multiple_choice',
  'error_correction',
  'listening_comprehension',
  'reflection_quiz',
])

export interface ValidationResult {
  valid:    boolean
  reason?:  string
  fallback?: string
}

export function validateSectionId(sectionId: string): ValidationResult {
  const entry = getCatalogEntry(sectionId)
  if (!entry) {
    console.warn(`[curriculum] section_not_in_catalog sectionId=${sectionId}`)
    return { valid: false, reason: `Section ${sectionId} not found in Focus 2 catalog` }
  }
  if (!entry.enabled) {
    console.warn(`[curriculum] section_disabled sectionId=${sectionId} type=${entry.type}`)
    return { valid: false, reason: `Section ${sectionId} (${entry.type}) is not yet available` }
  }
  return { valid: true }
}

export function validateExerciseType(type: string): ValidationResult {
  if (KNOWN_EXERCISE_TYPES.has(type)) return { valid: true }
  console.warn(`[curriculum] unknown_exercise_type type=${type} — safe fallback: speaking_prompt`)
  return { valid: false, reason: `Unknown exercise type: ${type}`, fallback: 'speaking_prompt' }
}

export function logMissingContent(sectionId: string, field: string): void {
  const quality = getSectionDataQuality(sectionId)
  console.warn(`[curriculum] missing_content sectionId=${sectionId} field=${field} dataQuality=${quality}`)
}

export function validateCursorSection(unit: number, sectionId: string): ValidationResult {
  const entry = getCatalogEntry(sectionId)
  if (!entry) {
    console.warn(`[curriculum] cursor_section_not_found sectionId=${sectionId}`)
    return { valid: false, reason: 'Section not in catalog' }
  }
  if (entry.unit !== unit) {
    console.warn(`[curriculum] cursor_unit_mismatch sectionId=${sectionId} catalogUnit=${entry.unit} providedUnit=${unit}`)
    return { valid: false, reason: `Section ${sectionId} belongs to unit ${entry.unit}, not ${unit}` }
  }
  return { valid: true }
}

export function validateReadingChunkIndex(index: number, totalChunks: number): ValidationResult {
  if (index < 0) {
    console.warn(`[curriculum] reading_chunk_negative index=${index}`)
    return { valid: false, reason: 'Reading chunk index cannot be negative' }
  }
  if (index >= totalChunks) {
    console.warn(`[curriculum] reading_chunk_overflow index=${index} total=${totalChunks}`)
    return { valid: false, reason: `Reading chunk ${index} exceeds total ${totalChunks}` }
  }
  return { valid: true }
}

export function validateNextSectionLink(currentSectionId: string, nextSectionId: string | null): ValidationResult {
  if (!nextSectionId) {
    return { valid: true, reason: 'Course complete — no next section' }
  }
  const next = getCatalogEntry(nextSectionId)
  if (!next) {
    console.warn(`[curriculum] next_section_invalid currentSection=${currentSectionId} nextSection=${nextSectionId}`)
    return { valid: false, reason: `Next section ${nextSectionId} not in catalog` }
  }
  if (!next.enabled) {
    console.warn(`[curriculum] next_section_disabled nextSection=${nextSectionId}`)
    return { valid: false, reason: `Next section ${nextSectionId} is disabled` }
  }
  return { valid: true }
}
