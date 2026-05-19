// Teaching Context Builder — assembles all exercise teaching runtime signals into a
// single prompt block that is injected into the Teacher Brain system prompt.
//
// This replaces the simple buildBehaviorContext() for paid lesson flows.
// Integration point: called from teacher-brain-builder.ts → buildPaidLessonTeacherBrainContext().

import { detectTeachingMode, describeModeForContext } from './teaching-mode-runtime.js'
import type { TeachingModeInput } from './teaching-mode-runtime.js'
import {
  determineDemoContext,
} from './demonstration-policy.js'
import type { DemoInput } from './demonstration-policy.js'
import { evaluateTaskBoundary } from './task-boundary-guard.js'
import type { TaskBoundaryInput } from './task-boundary-guard.js'
import { buildFrontendSyncGuard } from './frontend-sync-guard.js'
import type { FrontendSyncInput } from './frontend-sync-guard.js'
import {
  buildRetryEscalation,
  buildOpeningInstruction,
} from './retry-escalation.js'
import type { RetryEscalationInput } from './retry-escalation.js'
import {
  getExerciseFormatPolicy,
  isExerciseTypeSupported,
  getUnsupportedReason,
  getExpectedAnswerPolicy,
} from './exercise-format-registry.js'
import {
  getExerciseTeachingProtocol,
  buildProtocolTeacherGuidance,
} from './exercise-teaching-protocols.js'
import {
  traceExerciseTypeSelected,
  traceTeachingModeChanged,
  traceDemonstrationPolicySelected,
  traceFrontendSyncGuardTriggered,
  traceTaskBoundaryGuardTriggered,
  traceHintStrategySelected,
  traceRetryStrategySelected,
} from './exercise-teaching-tracer.js'

export interface ExerciseTeachingContextInput {
  lessonId:           string
  exerciseType:       string
  exerciseNumber:     number
  itemIndex:          number
  itemTotal:          number
  currentItem:        string
  correctionTurn:     string | null
  completedItems:     number[]
  failedItems?:       number[]
  items?:             string[]
  options?:           string[]
  completionState?:   string
  pendingTransition?: boolean
  correctAnswer?:     string
  studentAnswer?:     string
  isFirstEncounter:   boolean
  runtimeMode:        string
  isUnsupported:      boolean
}

export interface ExerciseTeachingContextResult {
  contextBlock: string
  teachingMode: string
  demoDecision: string
}

export function buildExerciseTeachingContext(
  input: ExerciseTeachingContextInput,
): ExerciseTeachingContextResult {
  const {
    lessonId, exerciseType, exerciseNumber, itemIndex, itemTotal,
    currentItem, correctionTurn, completedItems, items, options,
    completionState, pendingTransition, correctAnswer, studentAnswer,
    isFirstEncounter, runtimeMode, isUnsupported,
  } = input

  // ── Step 1: Resolve mode ──────────────────────────────────────────────────

  const modeInput: TeachingModeInput = {
    itemIndex,
    correctionTurn,
    completedItemCount: completedItems.length,
    exerciseCompleted:  completionState === 'complete' || completionState === 'skipped',
    isUnsupported,
    runtimeMode,
  }
  const teachingMode = detectTeachingMode(modeInput)

  traceExerciseTypeSelected(lessonId, exerciseType, exerciseNumber, isExerciseTypeSupported(exerciseType))
  traceTeachingModeChanged(lessonId, teachingMode, exerciseType, itemIndex, correctionTurn)

  // ── Step 2: Unsupported fast-path ─────────────────────────────────────────

  if (isUnsupported) {
    const reason = getUnsupportedReason(exerciseType) ?? 'requires unavailable resources'
    return {
      contextBlock: [
        '╔═ EXERCISE TEACHING BRAIN ═╗',
        `Exercise ${exerciseNumber} | Type: ${exerciseType} | Mode: UNSUPPORTED`,
        `⚠ UNSUPPORTED — ${reason}`,
        'REQUIRED: One-sentence skip + present next exercise in SAME response.',
        'FORBIDDEN: Adapting, converting, or improvising. No vocabulary extraction. No topic discussion.',
        '╚═══════════════════════════╝',
      ].join('\n'),
      teachingMode: 'UNSUPPORTED',
      demoDecision: 'no_demo',
    }
  }

  // ── Step 3: Collect policy ────────────────────────────────────────────────

  const policy          = getExerciseFormatPolicy(exerciseType)
  const answerPolicy    = getExpectedAnswerPolicy(exerciseType)
  const hintPolicy      = policy.hintPolicy
  const renderPolicy    = policy.frontendRenderPolicy
  const sections: string[] = []

  sections.push(`╔═ EXERCISE TEACHING BRAIN ═╗`)
  sections.push(
    `Exercise ${exerciseNumber} | Type: ${exerciseType} | Mode: ${teachingMode}`,
    `Item ${itemIndex + 1}/${itemTotal} | Correction: ${correctionTurn ?? 'none'} | RuntimeMode: ${runtimeMode}`,
  )

  // ── Step 4: Mode-specific instruction ────────────────────────────────────

  sections.push(`\n── MODE: ${describeModeForContext(teachingMode)} ──`)

  if (teachingMode === 'INSTRUCTION') {
    sections.push(buildOpeningInstruction(exerciseType, exerciseNumber))

    const demoInput: DemoInput = {
      exerciseType, itemIndex, correctionTurn, completedItemCount: completedItems.length,
      isFirstEncounter, runtimeMode,
    }
    const demoCtx = determineDemoContext(demoInput)
    traceDemonstrationPolicySelected(lessonId, demoCtx.decision, exerciseType, isFirstEncounter)

    if (demoCtx.instruction) {
      sections.push(demoCtx.instruction)
    }
  }

  // ── Step 5: Expected answer format ───────────────────────────────────────

  sections.push(
    `\n── EXPECTED ANSWER (${answerPolicy.format}) ──`,
    `Tell student: "${answerPolicy.answerDescription}"`,
    `Partial answer rule: ${answerPolicy.partialAnswerRule}`,
    `Voice adaptation: ${answerPolicy.voiceAdaptation}`,
  )

  // ── Step 6: Correction/hint guidance (when in correction) ────────────────

  if (correctionTurn && (teachingMode === 'CORRECTION' || teachingMode === 'HINT' || teachingMode === 'RETRY')) {
    const validTurns = ['A', 'B', 'C', 'D'] as const
    type CorrTurn = typeof validTurns[number]
    const safeTurn: CorrTurn = validTurns.includes(correctionTurn as CorrTurn)
      ? (correctionTurn as CorrTurn)
      : 'A'

    traceHintStrategySelected(lessonId, exerciseType, correctionTurn, hintPolicy[`turn${safeTurn}` as keyof typeof hintPolicy] as string)

    const retryInput: RetryEscalationInput = {
      exerciseType,
      correctionTurn: safeTurn,
      currentItem,
      studentAnswer:  studentAnswer ?? '',
      correctAnswer:  correctAnswer ?? '',
      itemIndex,
      runtimeMode,
    }
    const retryResult = buildRetryEscalation(retryInput)

    traceRetryStrategySelected(lessonId, exerciseType, correctionTurn, retryResult.shouldReveal)
    sections.push('\n' + retryResult.instruction)
  }

  // ── Step 7: Task boundary guard ───────────────────────────────────────────

  const boundaryInput: TaskBoundaryInput = {
    exerciseType,
    itemIndex,
    itemTotal,
    completedItems,
    correctionTurn,
    currentCorrectAnswer: correctAnswer ?? '',
    revealOnTurn: hintPolicy.revealOnTurn,
  }
  const boundaryResult = evaluateTaskBoundary(boundaryInput)

  if (boundaryResult.triggered) {
    traceTaskBoundaryGuardTriggered(lessonId, exerciseType, itemIndex, boundaryResult.violations)
    sections.push('\n' + boundaryResult.instruction)
  }

  // ── Step 8: Frontend sync guard ──────────────────────────────────────────

  const syncInput: FrontendSyncInput = {
    exerciseType, exerciseNumber, itemIndex, itemTotal, currentItem,
    items, options, completedItems, completionState, pendingTransition,
  }
  const syncResult = buildFrontendSyncGuard(syncInput)

  if (syncResult.triggered) {
    traceFrontendSyncGuardTriggered(lessonId, exerciseType, itemIndex, syncResult.instruction.split('\n').length)
    sections.push('\n' + syncResult.instruction)
  }

  // ── Step 9: Screen awareness note ────────────────────────────────────────

  if (renderPolicy.screenAwarenessNote) {
    sections.push(`\n── SCREEN STATE ──\n${renderPolicy.screenAwarenessNote}`)
  }

  // ── Step 10: Canonical protocol guidance (answerMode, shortAnswerPolicy, etc.) ──

  try {
    const protocol = getExerciseTeachingProtocol(exerciseType)
    const isDiscussionComplete =
      (completionState === 'complete') &&
      (runtimeMode === 'soft_speaking' || exerciseType === 'discussion' || exerciseType === 'speaking_prompt')
    const protocolBlock = buildProtocolTeacherGuidance(protocol, {
      exerciseType,
      correctionTurn,
      studentAnswer,
      runtimeMode,
      isDiscussionComplete,
    })
    sections.push('\n' + protocolBlock)
  } catch (err) {
    console.error('[teaching-protocol] guidance_build_error (non-fatal):', err instanceof Error ? err.message : err)
  }

  sections.push('\n╚═══════════════════════════╝')

  return {
    contextBlock: sections.join('\n'),
    teachingMode: String(teachingMode),
    demoDecision: '',
  }
}
