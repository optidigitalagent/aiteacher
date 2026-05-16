// Teacher Brain Builder — centralized prompt/context assembler.
//
// Phase B: produces supplementary guidance injected into prompt-builder.ts.
// Does NOT replace prompt-builder.ts yet — provides integration hooks only.
// Backwards compatible: existing prompt behavior unchanged.
//
// Future phases will migrate prompt-builder sections into this module.

import type { LessonState } from '../../lesson/types.js'
import type { TeacherBrainContext } from './teacher-brain.types.js'
import { CORRECTION_LADDER_DESCRIPTIONS } from './teacher-brain.constants.js'
import { getRulesForMode } from './teacher-brain-rules.js'
import { selectExamples, formatExampleForPrompt } from './teacher-brain-examples.js'
import {
  normalizeTeacherBrainContext,
  formatAISafeContext,
  formatAuthorityBoundary,
  type NormalizeContextInput,
} from './teacher-brain-context.js'

export interface TeacherBrainGuidanceInput {
  state: LessonState
  studentName: string
  studentLevel: string
  teacherName?: string
  remainingSeconds?: number
}

// Returns the teacher brain guidance block for injection into the main system prompt.
// This is the Phase B integration hook — additive and backwards compatible.
export function buildTeacherBrainGuidance(input: TeacherBrainGuidanceInput): string {
  const ctx = normalizeTeacherBrainContext(input as NormalizeContextInput)

  const sections: string[] = []

  sections.push(buildContextSection(ctx))
  sections.push(buildRulesSection(ctx))
  sections.push(buildExamplesSection(ctx))

  return [
    '=== TEACHER BRAIN GUIDANCE ===',
    sections.filter(Boolean).join('\n\n'),
    '=== END TEACHER BRAIN GUIDANCE ===',
  ].join('\n')
}

function buildContextSection(ctx: TeacherBrainContext): string {
  const contextLines = formatAISafeContext(ctx)
  const authorityLines = formatAuthorityBoundary()
  return `--- CURRENT EXERCISE CONTEXT ---\n${contextLines}\n\n${authorityLines}`
}

function buildRulesSection(ctx: TeacherBrainContext): string {
  const mode = ctx.exercise.runtimeMode
  const rules = getRulesForMode(mode)

  if (rules.length === 0) return ''

  const correctionNote = ctx.exercise.correctionTurn
    ? `\nCORRECTION TURN ${ctx.exercise.correctionTurn}: ${CORRECTION_LADDER_DESCRIPTIONS[ctx.exercise.correctionTurn]}`
    : ''

  const topRules = rules.slice(0, 8).map(r => `• ${r}`).join('\n')
  return `--- ACTIVE RULES (${mode}) ---\n${topRules}${correctionNote}`
}

function buildExamplesSection(ctx: TeacherBrainContext): string {
  const query = {
    exerciseType: ctx.exercise.exerciseType,
    correctionTurn: ctx.exercise.correctionTurn ?? undefined,
    isSkip: ctx.exercise.isUnsupported,
    isSideQuestion: false,
    isConfusion: false,
  }

  const examples = selectExamples(query, 2)
  if (examples.length === 0) return ''

  const formatted = examples.map(formatExampleForPrompt).join('\n\n')
  return `--- RELEVANT EXAMPLES ---\n${formatted}`
}

// Phase C hook: validate AI's structured response against backend state.
// Returns true when validation passes (always true in Phase B — observation mode only).
export function validateTeacherResponse(
  _proposedAction: string,
  _ctx: TeacherBrainContext,
): boolean {
  // Phase B: observation mode — log only, never block
  // Phase C: will compare proposedAction + exerciseNum + itemIndex against ctx
  return true
}

// Phase D hook: assemble the complete Context Composer output.
// In Phase B, returns empty string (prompt-builder.ts still owns context assembly).
export function buildContextComposerOutput(_ctx: TeacherBrainContext): string {
  return ''
}

// Phase E hook: assemble the Behavior Policy Engine output.
// In Phase B, returns empty string (teacher-behaviors/ still owns behavior context).
export function buildBehaviorPolicyOutput(_ctx: TeacherBrainContext): string {
  return ''
}

// Phase F hook: assemble the Example Retriever output.
// In Phase B, this is used by buildExamplesSection above.
export function buildExampleRetrieverOutput(ctx: TeacherBrainContext): string {
  return buildExamplesSection(ctx)
}

export type { TeacherBrainContext }
