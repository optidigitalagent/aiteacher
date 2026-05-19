// ── Frontend Formatter ────────────────────────────────────────────────────────
// Converts EngineExerciseState → ExerciseCursor (wire format for frontend).
// The frontend never needs to know about internal engine types.
// Shape must be compatible with the existing ExerciseCursor type in lesson/types.ts

import type { ExerciseCursor, VisibleContext } from '../lesson/types.js'
import type { EngineExerciseState, EngineLessonState } from './types.js'
import { getCurrentStep } from './step-progression-manager.js'

export function formatCursor(
  exState: EngineExerciseState,
  lessonState: EngineLessonState,
): ExerciseCursor {
  const spec     = exState.spec
  const step     = getCurrentStep(exState)
  const allItems = spec.steps.map(s => s.question)

  // Build visibleContext summary for Teacher Brain guard
  const visibleContext: VisibleContext = {
    hasReadingText:  !!(spec.readingText),
    hasTextBlocks:   !!(spec.textBlocks && spec.textBlocks.length > 0),
    hasOptions:      !!(spec.options && spec.options.length > 0),
    hasWordBox:      !!(spec.options && spec.options.length > 0),
    hasPromptCards:  !!(spec.promptCards && spec.promptCards.length > 0),
    hasStatements:   !!(spec.statements && spec.statements.length > 0),
  }

  const cursor: ExerciseCursor = {
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
    visibleContext,
    cursorVersion:  lessonState.cursorVersion ?? 0,
  }

  // Attach visible payload fields — only if present (keep wire payload minimal)
  if (spec.readingText)  cursor.readingText  = spec.readingText
  if (spec.textBlocks && spec.textBlocks.length > 0)   cursor.textBlocks   = spec.textBlocks
  if (spec.promptCards && spec.promptCards.length > 0)  cursor.promptCards  = spec.promptCards
  if (spec.statements && spec.statements.length > 0)    cursor.statements   = spec.statements

  console.log(
    `[visible_payload] frontend_sent exercise=${spec.meta.exerciseNumber} type="${spec.exerciseType}" ` +
    `fields=${buildPayloadSummary(cursor)}`,
  )

  return cursor
}

function buildPayloadSummary(cursor: ExerciseCursor): string {
  const fields: string[] = ['instruction', `items=${cursor.itemTotal}`]
  if (cursor.options?.length)     fields.push(`options=${cursor.options.length}`)
  if (cursor.readingText)         fields.push('readingText')
  if (cursor.textBlocks?.length)  fields.push(`textBlocks=${cursor.textBlocks.length}`)
  if (cursor.promptCards?.length) fields.push(`promptCards=${cursor.promptCards.length}`)
  if (cursor.statements?.length)  fields.push(`statements=${cursor.statements.length}`)
  return fields.join(',')
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
      // Distinguish between "no manifest loaded" and "all exercises genuinely complete"
      if (totalCount === 0) {
        return [
          `=== EXERCISE ENGINE STATE ===`,
          `STATUS: No manifest loaded for section "${lessonState.sectionId}". Engine queue is empty.`,
          `RULE: Do NOT invent or improvise exercises — no structured content is loaded.`,
          `RULE: Do NOT claim the section is complete or finished.`,
          `RULE: Say "We've finished the available exercise for this session. More structured exercises are not loaded yet."`,
          `exercise_queue_completed=false fallback_used=true`,
          `=== END ENGINE STATE ===`,
        ].join('\n')
      }

      return [
        `=== EXERCISE ENGINE STATE ===`,
        `STATUS: All exercises complete. Move to WRAP_UP phase.`,
        `Completed: ${completedCount}/${totalCount}`,
        `exercise_queue_completed=true`,
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
    lines.push(`CURRENT STEP (ask this ONLY — ignore all other items from conversation history):`)
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

  // ── Teacher Visible-Content Guard ────────────────────────────────────────
  // Tell Teacher Brain exactly what is visible on the student's screen.
  // Teacher must only reference content that is marked as visible here.
  lines.push(``)
  lines.push(`=== VISIBLE FRONTEND PAYLOAD (teacher content guard) ===`)
  lines.push(`What the student can currently SEE on their screen:`)
  lines.push(`  instruction: YES`)
  lines.push(`  items (${spec.steps.length} total): YES`)

  const vc = {
    hasOptions:     !!(spec.options && spec.options.length > 0),
    hasReadingText: !!(spec.readingText),
    hasTextBlocks:  !!(spec.textBlocks && spec.textBlocks.length > 0),
    hasPromptCards: !!(spec.promptCards && spec.promptCards.length > 0),
    hasStatements:  !!(spec.statements && spec.statements.length > 0),
  }

  lines.push(`  options/word box: ${vc.hasOptions ? `YES (${spec.options!.length} options)` : 'NO — do NOT say "look at the box"'}`)
  lines.push(`  reading text/article: ${vc.hasReadingText ? 'YES' : vc.hasTextBlocks ? `YES (${spec.textBlocks!.length} text blocks)` : 'NO — do NOT say "look at the text" or "read the paragraph"'}`)
  lines.push(`  prompt cards: ${vc.hasPromptCards ? 'YES' : 'NO'}`)
  lines.push(`  statements: ${vc.hasStatements ? `YES (${spec.statements!.length} statements visible)` : 'NO'}`)

  lines.push(``)
  lines.push(`TEACHER RULES (visible content guard):`)
  if (!vc.hasOptions) {
    lines.push(`  FORBIDDEN: "look at the box", "choose from the box", "the options are..." (no box visible)`)
  }
  if (!vc.hasReadingText && !vc.hasTextBlocks) {
    lines.push(`  FORBIDDEN: "look at the text", "read the passage", "find it in the article", "recall from the reading", "where did the text say..." (no reading text visible)`)
    lines.push(`  If student cannot see reading text: say "This reading passage is not visible on screen, so we'll skip this item safely."`)
    console.log(
      `[teacher_guard] blocked_invisible_reading section="${lessonState.sectionId ?? 'unknown'}" ` +
      `exercise=${spec.meta.exerciseNumber} type="${spec.exerciseType}"`,
    )
  }
  if (!vc.hasPromptCards && !vc.hasStatements && (spec.exerciseType === 'discussion' || spec.exerciseType === 'pair_speaking')) {
    lines.push(`  NOTE: Discussion task card not visible — rely on spoken instruction only.`)
  }
  lines.push(`=== END VISIBLE PAYLOAD ===`)

  // Engine authority constraints — injected every turn so the AI never overrides engine state
  lines.push(``)
  lines.push(`=== ENGINE AUTHORITY RULES (mandatory, no exceptions) ===`)
  lines.push(`1. OUTPUT: Set "exercise": null always. NEVER generate exercise JSON. Engine owns all exercise state.`)
  if (step) {
    lines.push(`2. ITEM LOCK: The ONLY valid item this turn is: "${step.question}"`)
    lines.push(`   Do NOT ask about, repeat, or reference any item from conversation history. History items are DONE.`)
  } else {
    lines.push(`2. ITEM LOCK: No active step. Do NOT invent or reference any item.`)
  }
  lines.push(`3. HISTORY BLACKOUT: Completed items DO NOT EXIST for this turn. Never say "let's continue with [old item]".`)
  lines.push(`4. NO SELF-VALIDATION: The [EXERCISE RESULT] block tells you correct/incorrect. NEVER decide this yourself.`)
  lines.push(`   FORBIDDEN: saying "Correct" or "Not quite" without [EXERCISE RESULT] present in your input.`)
  lines.push(`5. NO SELF-PROGRESSION: NEVER advance item or exercise yourself. Engine advances on correct answer only.`)
  lines.push(`6. STUDENT QUESTION: If student asks what/how/why/explain → answer in ONE sentence → return to CURRENT STEP.`)
  lines.push(`   Do NOT advance retry count. Do NOT change the current item.`)
  lines.push(`7. STT NOISE: If student input is unclear/fragmented → ask to try again. NEVER treat noise as an answer.`)
  lines.push(`=== END ENGINE AUTHORITY RULES ===`)

  lines.push(`=== END ENGINE STATE ===`)

  return lines.join('\n')
}
