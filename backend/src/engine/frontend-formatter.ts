// ── Frontend Formatter ────────────────────────────────────────────────────────
// Converts EngineExerciseState → ExerciseCursor (wire format for frontend).
// The frontend never needs to know about internal engine types.
// Shape must be compatible with the existing ExerciseCursor type in lesson/types.ts

import type { ExerciseCursor } from '../lesson/types.js'
import type { EngineExerciseState, EngineLessonState } from './types.js'
import { getCurrentStep } from './step-progression-manager.js'

export function formatCursor(
  exState: EngineExerciseState,
  lessonState: EngineLessonState,
): ExerciseCursor {
  const spec     = exState.spec
  const step     = getCurrentStep(exState)
  const allItems = spec.steps.map(s => s.question)

  return {
    exerciseId:     spec.exerciseId,
    exerciseNumber: spec.meta.exerciseNumber,
    exerciseType:   spec.exerciseType,
    instruction:    spec.instruction,
    currentItem:    step?.question ?? '',
    itemIndex:      exState.currentStepIndex,
    itemTotal:      spec.steps.length,
    completedItems: exState.completedSteps,
    failedItems:    exState.failedSteps,
    items:          allItems,
    options:        spec.options,
    unit:           spec.meta.unit,
    section:        spec.meta.lessonSection,
    wordBoxState:   null,
  }
}

// Null cursor — sent when no exercise is active
export function nullCursor(): null {
  return null
}

// ── AI Prompt Context ──────────────────────────────────────────────────────────
// What the Teacher Brain reads to know the current exercise state.
// This is the ONLY channel through which the engine informs the AI.
// The AI cannot modify this data — it is read-only context.

export function buildPromptContext(
  exState: EngineExerciseState | undefined,
  lessonState: EngineLessonState,
): string {
  if (!exState || exState.status === 'completed' || exState.status === 'skipped') {
    const completedCount = lessonState.completedExerciseIds.length
    const totalCount     = lessonState.exerciseQueue.length
    const remaining      = totalCount - completedCount - lessonState.skippedExerciseIds.length

    if (remaining <= 0) {
      return [
        `=== EXERCISE ENGINE STATE ===`,
        `STATUS: All exercises complete. Move to WRAP_UP phase.`,
        `Completed: ${completedCount}/${totalCount}`,
        `=== END ENGINE STATE ===`,
      ].join('\n')
    }

    return [
      `=== EXERCISE ENGINE STATE ===`,
      `STATUS: Exercise transition. Waiting for next exercise to load.`,
      `Completed: ${completedCount}/${totalCount}`,
      `=== END ENGINE STATE ===`,
    ].join('\n')
  }

  const spec  = exState.spec
  const step  = getCurrentStep(exState)
  const stats = {
    done:  exState.completedSteps.length,
    total: spec.steps.length,
  }

  const lines: string[] = [
    `=== EXERCISE ENGINE STATE (backend-authoritative) ===`,
    `RULE: You are the teacher voice. The engine controls all progression.`,
    `RULE: Do NOT invent items, steps, or exercise numbers.`,
    `RULE: Do NOT advance to a new exercise — the engine will do that.`,
    ``,
    `Section: ${spec.meta.lessonSection} | Unit: ${spec.meta.unit}`,
    `Exercise: ${spec.meta.exerciseNumber} — ${spec.exerciseType.replace(/_/g, ' ')}`,
    `Instruction: "${spec.instruction}"`,
    `Progress: step ${stats.done + 1} of ${stats.total}`,
    `Status: ${exState.status}`,
    `Retries on current step: ${exState.retryCount}`,
  ]

  if (step) {
    lines.push(``)
    lines.push(`CURRENT STEP (ask this ONLY):`)
    lines.push(`  Question: "${step.question}"`)
    if (step.expectedAnswer && exState.retryCount >= 2) {
      lines.push(`  Hint available: "${step.hints[exState.retryCount - 1] ?? step.hints.at(-1)}"`)
    }
  }

  if (exState.completedSteps.length > 0) {
    lines.push(``)
    lines.push(`Completed steps: [${exState.completedSteps.join(', ')}]`)
  }

  if (exState.failedSteps.length > 0) {
    lines.push(`Failed steps: [${exState.failedSteps.join(', ')}] — student struggled here`)
  }

  lines.push(`=== END ENGINE STATE ===`)

  return lines.join('\n')
}
