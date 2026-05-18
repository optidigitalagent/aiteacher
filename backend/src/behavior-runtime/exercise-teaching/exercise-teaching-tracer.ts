// Exercise Teaching Tracer — behavioral observability for exercise teaching runtime.
//
// Adds Langfuse spans for:
//   • exercise_type_selected
//   • teaching_mode_changed
//   • demonstration_policy_selected
//   • frontend_sync_guard_triggered
//   • task_boundary_guard_triggered
//   • hint_strategy_selected
//   • retry_strategy_selected
//
// All traces are best-effort — never throw into lesson runtime.

import { traceRuntimeSpan } from '../../observability/lesson-tracer.js'
import type { TeachingMode } from './teaching-mode-runtime.js'
import type { DemoDecision } from './demonstration-policy.js'

export function traceExerciseTypeSelected(
  lessonId:     string,
  exerciseType: string,
  exerciseNum:  number,
  supported:    boolean,
): void {
  traceRuntimeSpan(lessonId, 'exercise_type_selected', {
    exerciseType,
    exerciseNum,
    supported,
    reason: supported ? 'type_in_registry' : 'type_unsupported_or_unknown',
  })
}

export function traceTeachingModeChanged(
  lessonId:     string,
  mode:         TeachingMode,
  exerciseType: string,
  itemIndex:    number,
  correctionTurn: string | null,
): void {
  traceRuntimeSpan(lessonId, 'teaching_mode_changed', {
    mode,
    exerciseType,
    itemIndex,
    correctionTurn: correctionTurn ?? 'none',
    reason: modeReason(mode, correctionTurn),
  })
}

export function traceDemonstrationPolicySelected(
  lessonId:     string,
  decision:     DemoDecision,
  exerciseType: string,
  isFirstEncounter: boolean,
): void {
  traceRuntimeSpan(lessonId, 'demonstration_policy_selected', {
    decision,
    exerciseType,
    isFirstEncounter,
    reason: decision === 'full_demo'
      ? 'first_encounter_demo_required'
      : decision === 'brief_reminder'
      ? 'repeat_encounter_brief_reminder'
      : 'mid_exercise_no_demo',
  })
}

export function traceFrontendSyncGuardTriggered(
  lessonId:     string,
  exerciseType: string,
  itemIndex:    number,
  ruleCount:    number,
): void {
  traceRuntimeSpan(lessonId, 'frontend_sync_guard_triggered', {
    exerciseType,
    itemIndex,
    ruleCount,
    reason: 'visible_content_constraint_applied',
  })
}

export function traceTaskBoundaryGuardTriggered(
  lessonId:    string,
  exerciseType: string,
  itemIndex:   number,
  violations:  string[],
): void {
  traceRuntimeSpan(lessonId, 'task_boundary_guard_triggered', {
    exerciseType,
    itemIndex,
    violationCount: violations.length,
    violations:     violations.slice(0, 3).join(' | '),
    reason:         'boundary_protection_applied',
  })
}

export function traceHintStrategySelected(
  lessonId:     string,
  exerciseType: string,
  correctionTurn: string,
  hintType:     string,
): void {
  traceRuntimeSpan(lessonId, 'hint_strategy_selected', {
    exerciseType,
    correctionTurn,
    hintType,
    reason: `turn_${correctionTurn}_hint_policy`,
  })
}

export function traceRetryStrategySelected(
  lessonId:      string,
  exerciseType:  string,
  correctionTurn: string,
  shouldReveal:  boolean,
): void {
  traceRuntimeSpan(lessonId, 'retry_strategy_selected', {
    exerciseType,
    correctionTurn,
    shouldReveal,
    reason: shouldReveal
      ? `reveal_at_turn_${correctionTurn}`
      : `escalating_hint_turn_${correctionTurn}`,
  })
}

// ── Internal helper ───────────────────────────────────────────────────────────

function modeReason(mode: TeachingMode, correctionTurn: string | null): string {
  switch (mode) {
    case 'INSTRUCTION':   return 'item_0_no_correction_first_encounter'
    case 'DEMONSTRATION': return 'demo_required_for_new_type'
    case 'STUDENT_TASK':  return 'item_presented_awaiting_answer'
    case 'CORRECTION':    return `correction_turn_A`
    case 'HINT':          return `correction_turn_${correctionTurn ?? 'BC'}`
    case 'RETRY':         return 'correction_turn_D_reveal'
    case 'TRANSITION':    return 'exercise_completed_or_skipped'
  }
}
