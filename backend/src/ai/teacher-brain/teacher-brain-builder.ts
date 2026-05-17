// Teacher Brain Builder — centralized prompt/context assembler.
//
// Phase B: produces supplementary guidance injected into prompt-builder.ts.
// Does NOT replace prompt-builder.ts yet — provides integration hooks only.
// Backwards compatible: existing prompt behavior unchanged.
//
// Future phases will migrate prompt-builder sections into this module.

import type { LessonState } from '../../lesson/types.js'
import type { TeacherBrainContext } from './teacher-brain.types.js'
import { CORRECTION_LADDER_DESCRIPTIONS, TEACHER_COMMUNICATION_PRINCIPLES } from './teacher-brain.constants.js'
import { getRulesForMode, ANTI_CHAOS_RULES, SKIP_RULES, HUMAN_TUTOR_RULES } from './teacher-brain-rules.js'
import { selectExamples, formatExampleForPrompt } from './teacher-brain-examples.js'
import {
  normalizeTeacherBrainContext,
  formatAISafeContext,
  formatAuthorityBoundary,
  type NormalizeContextInput,
} from './teacher-brain-context.js'
import {
  analyzeExecutability,
  formatExecutabilityForPrompt,
  buildGreetingGuidance,
  buildSpeechRuntimeConsistencyRule,
  EXERCISE_INTRO_RULES,
} from './teacher-brain-executability.js'

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

// ── Phase C: Primary paid lesson Teacher Brain context ──────────────────────
//
// Replaces buildTeacherBrainGuidance for focus mode.
// Applies to all lesson phases, not just EXERCISES.
// Contains explicit OVERRIDE declaration so conflicting rules above are superseded.

export function buildPaidLessonTeacherBrainContext(input: TeacherBrainGuidanceInput): string {
  const ctx = normalizeTeacherBrainContext(input as NormalizeContextInput)
  const { state, teacherName } = input

  const sections = [
    buildIsolationContractSection(),       // AI Isolation Layer: verbal-only contract
    buildCoreSection(),
    buildGreetingSection(teacherName ?? 'Alex', state),
    buildRuntimeTruthSection(ctx),
    buildExecutabilitySection(ctx, state),
    buildSpeechRuntimeSyncSection(ctx),    // Phase E.1: speech/runtime consistency rule
    buildBehaviorContractSection(ctx),
    buildHumanTutorSection(ctx, state),    // Phase H: human tutor behavior
    buildForbiddenSection(ctx),
    buildExamplesSection(ctx),
    buildStructuredOutputInstruction(),
  ].filter(Boolean)

  return [
    '╔═══════════════════════════════════════════════╗',
    '║  TEACHER BRAIN — PRIMARY BEHAVIORAL CONTRACT  ║',
    '║  OVERRIDES any conflicting rules stated above ║',
    '╚═══════════════════════════════════════════════╝',
    sections.join('\n\n'),
    '════════════════════════════════════════════════',
  ].join('\n')
}

// ── AI Isolation Contract ──────────────────────────────────────────────────────
// Injected first in every paid lesson prompt. States the fundamental contract:
// AI is a verbal teaching layer — it reads state but never controls progression.
function buildIsolationContractSection(): string {
  return [
    '── AI ISOLATION CONTRACT (read first — overrides everything) ──',
    'You are the TEACHER VOICE. You are NOT the controller.',
    'Backend already chose the current step. Backend already validated the answer.',
    '',
    'OUTPUT CONTRACT — your response is verbal/speech ONLY:',
    '  • Return only what you SAY to the student (speech + display_text).',
    '  • Do NOT return: nextExerciseId, nextItemId, isCorrect, allowProgression,',
    '    completedExercise, frontendState, validationOverride.',
    '  • Do NOT include exercise structure (items[], options[], correct_answer) as',
    '    authoritative data — backend manifest is the single source of truth.',
    '',
    'VALIDATION ALIGNMENT — always agree with the backend result:',
    '  • Backend says CORRECT → short encouragement + move to next instruction.',
    '  • Backend says INCORRECT → correction hint based on student mistake.',
    '  • NEVER say answer is correct if backend validation says incorrect.',
    '  • NEVER say answer is wrong if backend validation says correct.',
    '',
    'PROGRESSION ALIGNMENT — never move the cursor yourself:',
    '  • Do NOT reference next item/exercise unless backend state shows transition.',
    '  • Do NOT announce exercise completion unless backend state shows all items done.',
    '  • Do NOT re-open completed exercises under any circumstances.',
    '',
    'SAFE FALLBACK (when state is unclear):',
    '  • "Let\'s stay on this item. Try once more." — for correction state.',
    '  • "You\'re close. Look at the auxiliary verb." — specific targeted hint.',
    '  • "I need the current exercise state before continuing." — state missing.',
    '  • NEVER say "I\'m thinking...", "Could you repeat that?", "What do you want to do?"',
  ].join('\n')
}

function buildCoreSection(): string {
  const principles = (TEACHER_COMMUNICATION_PRINCIPLES as readonly string[])
    .slice(0, 8)
    .map(p => `• ${p}`)
    .join('\n')
  return `── CORE TEACHER BRAIN ──\n${principles}`
}

// Phase E: Greeting + exercise intro cleanup guidance
function buildGreetingSection(teacherName: string, state: LessonState): string {
  // Only inject greeting guidance when the lesson hasn't started exercises yet
  const needsGreeting = state.phase === 'DIAGNOSTIC' || state.exchangeCount <= 1
  if (!needsGreeting) return ''

  const topic = state.lessonTopic ?? state.grammarTarget ?? 'today\'s topic'
  return buildGreetingGuidance(teacherName, topic)
}

// Phase E: Exercise executability gate — injects content-level analysis for the current exercise
function buildExecutabilitySection(ctx: TeacherBrainContext, state: LessonState): string {
  const hasExerciseData = !!(state.exerciseInstruction ?? state.exerciseItems?.length)
  if (!hasExerciseData && !ctx.exercise.isUnsupported) return ''

  // If the context already flagged this as unsupported via type, show the content block signals too
  if (ctx.exercise.isUnsupported && ctx.exercise.contentBlockSignals?.length) {
    const signals = ctx.exercise.contentBlockSignals.map(s => `  • ${s}`).join('\n')
    return [
      '── EXECUTABILITY GATE (Phase E) ──',
      `BLOCKED — ${ctx.exercise.contentSemanticClass ?? ctx.exercise.unsupportedReason ?? 'hidden dependency'}`,
      `Content signals detected:\n${signals}`,
      `FORBIDDEN: adapting, converting, or improvising this exercise in any form.`,
      `REQUIRED: one-sentence skip + present next exercise in same response.`,
    ].join('\n')
  }

  // If the type is supported but we have content to analyze, run a fresh check
  if (!ctx.exercise.isUnsupported && hasExerciseData) {
    const decision = analyzeExecutability({
      exerciseType: ctx.exercise.exerciseType,
      instruction: state.exerciseInstruction ?? '',
      items: state.exerciseItems ?? [],
      options: state.exerciseOptions ?? [],
      exerciseNumber: ctx.exercise.exerciseNum,
    })

    if (!decision.executable) {
      return [
        '── EXECUTABILITY GATE (Phase E) ──',
        formatExecutabilityForPrompt(decision),
      ].join('\n')
    }

    // Exercise is executable — confirm it and add intro rules
    const introRules = (EXERCISE_INTRO_RULES as readonly string[])
      .map(r => `• ${r}`)
      .join('\n')
    return [
      '── EXECUTABILITY GATE (Phase E) ──',
      `EXECUTABLE — ${decision.classification} (${decision.confidence} confidence)`,
      `Student has all required information to attempt this exercise.`,
      `\n── EXERCISE INTRO RULES ──`,
      introRules,
    ].join('\n')
  }

  return ''
}

// Phase E.1: Speech/runtime consistency — prevents the "exercise=0 desync" failure.
// Injected on every paid lesson turn so the AI always knows the contract.
function buildSpeechRuntimeSyncSection(ctx: TeacherBrainContext): string {
  return buildSpeechRuntimeConsistencyRule(ctx.exercise.exerciseNum)
}

function buildRuntimeTruthSection(ctx: TeacherBrainContext): string {
  const lines: string[] = ['── CURRENT RUNTIME TRUTH (backend-authoritative — never infer) ──']

  lines.push(`Phase: ${ctx.phase} | Exercise: ${ctx.exercise.exerciseNum} | Type: ${ctx.exercise.exerciseType}`)
  lines.push(`Mode: ${ctx.exercise.runtimeMode.toUpperCase()}`)

  if (ctx.exercise.isUnsupported) {
    const semanticNote = ctx.exercise.contentSemanticClass
      ? ` [${ctx.exercise.contentSemanticClass}]`
      : ''
    lines.push(`STATUS: UNSUPPORTED${semanticNote} — ${ctx.exercise.unsupportedReason ?? 'requires unavailable resource'}`)
    lines.push('REQUIRED ACTION: One-sentence skip + present next exercise in same response')
    lines.push('NO ADAPTATION — do not rewrite, rephrase, or convert this exercise into any other format')
    if (ctx.completedExercises.length > 0) {
      lines.push(`Completed exercises: [${ctx.completedExercises.join(', ')}] — permanently closed`)
    }
    return lines.join('\n')
  }

  if (ctx.exercise.currentItem) {
    lines.push(`Item ${ctx.exercise.itemIndex} (0-based): "${ctx.exercise.currentItem}"`)
  }

  if (ctx.exercise.correctionTurn) {
    lines.push(`CORRECTION STATE: TURN ${ctx.exercise.correctionTurn} — ${CORRECTION_LADDER_DESCRIPTIONS[ctx.exercise.correctionTurn]}`)
    lines.push('Do NOT re-derive correction turn from history. Do NOT restart at TURN A.')
  }

  if (ctx.exercise.completedItems.length > 0) {
    lines.push(`Completed items: [${ctx.exercise.completedItems.join(', ')}] — NEVER re-ask`)
  }

  if (ctx.completedExercises.length > 0) {
    lines.push(`Completed exercises: [${ctx.completedExercises.join(', ')}] — permanently closed`)
  }

  lines.push('AI cursor authority: READ ONLY — backend owns exerciseNum, itemIndex, correctionTurn')

  return lines.join('\n')
}

function buildBehaviorContractSection(ctx: TeacherBrainContext): string {
  const mode = ctx.exercise.runtimeMode
  const rules = getRulesForMode(mode)

  if (rules.length === 0) return ''

  const topRules = (rules as readonly string[]).slice(0, 6).map(r => `• ${r}`).join('\n')

  let correctionNote = ''
  if (ctx.exercise.correctionTurn && mode !== 'soft_speaking' && mode !== 'grammar_explanation') {
    correctionNote = `\nCURRENT TURN ${ctx.exercise.correctionTurn}: ${CORRECTION_LADDER_DESCRIPTIONS[ctx.exercise.correctionTurn]}`
  }

  return `── EXERCISE BEHAVIOR CONTRACT (${mode}) ──\n${topRules}${correctionNote}`
}

function buildForbiddenSection(ctx: TeacherBrainContext): string {
  const coreRules = (ANTI_CHAOS_RULES.rules as readonly string[]).slice(0, 8).map(r => `✗ ${r}`).join('\n')

  const skipAddendum = ctx.exercise.isUnsupported || ctx.exercise.runtimeMode === 'unsupported'
    ? '\nSKIP RULES (exercise is UNSUPPORTED):\n' +
      (SKIP_RULES.rules as readonly string[]).slice(0, 5).map(r => `✗ ${r}`).join('\n')
    : ''

  const listeningOverride =
    '\nLISTENING SECTION OVERRIDE (supersedes OPEN_TASK_GUIDANCE above):\n' +
    '✗ Do NOT convert listening exercises into "discuss the topic" speaking sessions\n' +
    '✗ Do NOT invent speaking prompts about the listening section topic\n' +
    '✗ Do NOT ask the student to guess what was said in an audio recording\n' +
    '✓ If exercise type is listening/audio_reconstruction → hard skip + next textbook exercise in same response\n' +
    '✓ Only run exercises with explicit non-audio types present in the section content above'

  return `── FORBIDDEN BEHAVIORS (override all above) ──\n${coreRules}${skipAddendum}${listeningOverride}`
}

// Phase H: Human tutor behavior — UI-aware teaching, STT tolerance, transition handling.
// Injected in EXERCISES phase only; focuses the AI on natural human teacher patterns.
function buildHumanTutorSection(ctx: TeacherBrainContext, state: LessonState): string {
  if (ctx.phase !== 'EXERCISES') return ''

  const { runtimeMode, currentItem, correctionTurn } = ctx.exercise

  const lines: string[] = [
    '── HUMAN TUTOR BEHAVIOR (Phase H) ──',
    ...HUMAN_TUTOR_RULES.rules.slice(0, 8).map(r => `• ${r}`),
  ]

  if (currentItem) {
    lines.push(`Item on screen: "${currentItem}" — do NOT repeat this verbatim in speech again`)
  }

  if (runtimeMode === 'deterministic_sequential' || runtimeMode === 'matching_sequential') {
    lines.push('EXERCISE INTENT: student must produce the FORM shown (question / gap fill / transformation) — not semantic content')
  }

  if (correctionTurn === 'D') {
    lines.push('TURN D — after student repeats correctly: confirm once ("Exactly.") then advance to next item. Do NOT ask to repeat again.')
  }

  const isExerciseComplete =
    (state.completedItems?.length ?? 0) > 0 &&
    (state.itemIndex ?? 0) >= (state.completedItems?.length ?? 0)
  if (isExerciseComplete) {
    lines.push('TRANSITION STATE: exercise items complete — any student response is a transition signal → move to next exercise immediately')
  }

  return lines.join('\n')
}

// Phase D: returns the structured output instruction injected into paid lesson prompts.
// Tells the AI to optionally append a <TEACHER_BRAIN_JSON> block after its JSON response.
export function buildStructuredOutputInstruction(): string {
  const allowedActions = [
    'present_item', 'continue_current_item', 'confirm_correct',
    'transition_next_exercise', 'skip_exercise', 'complete_lesson',
    'clarify_item', 'side_question_answered', 'request_retry',
    'complete_item', 'complete_exercise', 'ask_clarification',
    'answer_side_question', 'resume_current_item',
  ].join(' | ')

  return [
    '── STRUCTURED OUTPUT (optional, advisory only) ──',
    'After your JSON response, you MAY append a Teacher Brain block:',
    '<TEACHER_BRAIN_JSON>',
    '{"teacher_text":"Good. Number 2: funny.","action":"continue_current_item","exerciseNum":1,"itemIndex":1,"confidence":0.9,"reason":"student answered item 1 correctly"}',
    '</TEACHER_BRAIN_JSON>',
    `Allowed actions: ${allowedActions}`,
    '• teacher_text must match your speech (short form is fine)',
    '• reason is one short operational phrase — no chain-of-thought',
    '• exerciseNum and itemIndex are READ-ONLY observations — they do NOT advance the cursor.',
    '  Backend owns all cursor advancement. These fields are for logging only.',
    '• This block is advisory and observed but never used to mutate lesson state.',
    '• Omitting this block is safe — lesson continues normally.',
  ].join('\n')
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
