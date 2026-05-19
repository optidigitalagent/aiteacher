// ── Canonical Exercise Cursor ─────────────────────────────────────────────────
// Single authoritative cursor object for every runtime layer.
// Every subsystem (engine, orchestrator, teacher brain, frontend, transcript,
// resync) MUST read from this — never from their own local cache.
//
// Authority rules:
//   • Only engine transitions may WRITE the canonical cursor.
//   • AI responses, frontend events, transcript replays: READ-ONLY.
//   • Source must always be 'engine'. 'unsafe_fallback' marks missing manifests.

import redis from '../db/redis.js'
import type { ExerciseCursor } from '../lesson/types.js'
import type { EngineExerciseState, EngineLessonState } from './types.js'
import { getCurrentStep } from './step-progression-manager.js'

const CURSOR_TTL = 14_400  // 4 hours — matches lesson and engine TTLs

export type CanonicalCursorSource = 'engine' | 'unsafe_fallback' | 'none'

export interface CanonicalExerciseCursor {
  lessonId:            string
  sectionId:           string
  exerciseId:          string
  exerciseNumber:      number
  exerciseType:        string
  exerciseTitle:       string
  itemIndex:           number
  itemTotal:           number
  currentItem:         string
  currentItemId:       string
  expectedAnswerShape: string  // 'exact' | 'open' | 'any' (for teacher brain)
  retryCount:          number
  correctionTurn:      'A' | 'B' | 'C' | 'D' | null
  completedItemIds:    string[]
  completedExerciseIds: string[]
  visiblePayload:      ExerciseCursor | null
  source:              CanonicalCursorSource
  cursorVersion:       number
  updatedAt:           string
}

export function canonicalCursorKey(lessonId: string): string {
  return `cursor:canonical:${lessonId}`
}

// ── Build from engine state ───────────────────────────────────────────────────

export function buildCanonicalCursor(
  exState: EngineExerciseState,
  lessonState: EngineLessonState,
): CanonicalExerciseCursor {
  const spec    = exState.spec
  const step    = getCurrentStep(exState)
  const version = lessonState.cursorVersion ?? 0

  const completedItemIds = exState.completedSteps.map(
    idx => spec.steps[idx]?.stepId ?? `${spec.exerciseId}_step_${idx}`,
  )

  const correctionTurn = computeCorrectionTurn(exState.retryCount)

  return {
    lessonId:            lessonState.lessonId,
    sectionId:           lessonState.sectionId,
    exerciseId:          spec.exerciseId,
    exerciseNumber:      spec.meta.exerciseNumber,
    exerciseType:        spec.exerciseType,
    exerciseTitle:       spec.title,
    itemIndex:           exState.currentStepIndex,
    itemTotal:           spec.steps.length,
    currentItem:         step?.question ?? '',
    currentItemId:       step?.stepId   ?? '',
    expectedAnswerShape: resolveAnswerShape(spec.meta.runtimeMode),
    retryCount:          exState.retryCount,
    correctionTurn,
    completedItemIds,
    completedExerciseIds: lessonState.completedExerciseIds,
    visiblePayload:      null,  // caller sets this from formatCursor() if needed
    source:              'engine',
    cursorVersion:       version,
    updatedAt:           new Date().toISOString(),
  }
}

// ── Redis persistence ─────────────────────────────────────────────────────────

export async function saveCanonicalCursor(
  lessonId: string,
  cursor: CanonicalExerciseCursor,
): Promise<void> {
  try {
    await redis.set(canonicalCursorKey(lessonId), JSON.stringify(cursor), 'EX', CURSOR_TTL)
    console.log(
      `[cursor] canonical_updated lessonId=${lessonId} exercise=#${cursor.exerciseNumber}` +
      ` item=${cursor.itemIndex + 1}/${cursor.itemTotal} version=${cursor.cursorVersion} reason=engine_write`,
    )
  } catch (err) {
    console.error(`[cursor] canonical_save_failed lessonId=${lessonId}`, err)
  }
}

export async function loadCanonicalCursor(lessonId: string): Promise<CanonicalExerciseCursor | null> {
  try {
    const raw = await redis.get(canonicalCursorKey(lessonId))
    if (!raw) return null
    return JSON.parse(raw) as CanonicalExerciseCursor
  } catch {
    return null
  }
}

export async function deleteCanonicalCursor(lessonId: string): Promise<void> {
  await redis.del(canonicalCursorKey(lessonId)).catch(() => { /* non-fatal */ })
}

// ── Primary read API — all runtime layers use this ───────────────────────────
// Falls back to building from engine state when Redis cursor is missing.

export async function getCanonicalExerciseCursor(
  lessonId: string,
): Promise<CanonicalExerciseCursor | null> {
  const cached = await loadCanonicalCursor(lessonId)
  if (cached) return cached
  return null
}

// ── Logging helper ────────────────────────────────────────────────────────────

export function logCanonicalCursor(
  cursor: CanonicalExerciseCursor,
  reason: string,
): void {
  console.log(
    `[cursor] canonical_built lessonId=${cursor.lessonId}` +
    ` exercise=#${cursor.exerciseNumber} item=${cursor.itemIndex + 1}/${cursor.itemTotal}` +
    ` version=${cursor.cursorVersion} reason=${reason}`,
  )
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function computeCorrectionTurn(
  retryCount: number,
): 'A' | 'B' | 'C' | 'D' | null {
  if (retryCount <= 0) return null
  if (retryCount === 1) return 'A'
  if (retryCount === 2) return 'B'
  if (retryCount === 3) return 'C'
  return 'D'
}

function resolveAnswerShape(runtimeMode: string): string {
  switch (runtimeMode) {
    case 'deterministic_sequential': return 'exact'
    case 'soft_speaking':            return 'open'
    default:                         return 'any'
  }
}
