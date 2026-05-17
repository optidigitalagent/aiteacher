// ── Exercise Loader ───────────────────────────────────────────────────────────
// Loads and orders ExerciseSpec[] for a given lesson section.
// Single source: section manifest (future: DB-backed textbook data).
// GPT never touches this path.

import type { ExerciseSpec } from './types.js'
import { parseManifestEntry } from './exercise-parser.js'
import { getManifestForSection } from '../lesson/section-manifest.js'

export interface LoadResult {
  exercises: ExerciseSpec[]
  sectionId: string
  unit: number
  totalExecutable: number
  totalSkipped: number
}

// ── Primary loader ────────────────────────────────────────────────────────────

export function loadExercisesForSection(sectionId: string): LoadResult {
  const manifest = getManifestForSection(sectionId)

  if (!manifest) {
    console.warn(`[engine:loader] no manifest found for section="${sectionId}" — returning empty queue`)
    return { exercises: [], sectionId, unit: 0, totalExecutable: 0, totalSkipped: 0 }
  }

  const exercises: ExerciseSpec[] = manifest.exercises.map(entry =>
    parseManifestEntry(entry, manifest.section, manifest.unit),
  )

  const totalExecutable = exercises.filter(e => e.meta.runtimeMode !== 'unsupported').length
  const totalSkipped    = exercises.filter(e => e.meta.runtimeMode === 'unsupported').length

  console.log(
    `[engine:loader] section="${sectionId}" loaded=${exercises.length} ` +
    `executable=${totalExecutable} skipped=${totalSkipped}`,
  )

  return {
    exercises,
    sectionId: manifest.section,
    unit:      manifest.unit,
    totalExecutable,
    totalSkipped,
  }
}

// ── Dependency resolver ───────────────────────────────────────────────────────
// Filters out exercises whose dependsOn exercise has not been completed yet.
// Called by the engine before returning the next exercise.

export function filterAvailableExercises(
  queue: ExerciseSpec[],
  completedExerciseNumbers: number[],
): ExerciseSpec[] {
  return queue.filter(ex => {
    if (!ex.meta.dependsOn) return true
    return completedExerciseNumbers.includes(ex.meta.dependsOn)
  })
}

// ── Free-lesson loader ────────────────────────────────────────────────────────
// For free-mode lessons (no textbook section), returns a minimal default queue.
// This preserves the deterministic engine contract even without a manifest.

export function loadFreeModePlaceholder(): LoadResult {
  return {
    exercises:       [],
    sectionId:       'free',
    unit:            0,
    totalExecutable: 0,
    totalSkipped:    0,
  }
}
