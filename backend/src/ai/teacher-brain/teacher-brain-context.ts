import type { LessonState } from '../../lesson/types.js'
import type {
  TeacherBrainContext,
  ExerciseRuntimeState,
  StudentState,
  TeacherGuidanceMode,
  TeacherPersona,
  UnsupportedReason,
} from './teacher-brain.types.js'
import { EXERCISE_RUNTIME_MODE_MAP, UNSUPPORTED_EXERCISE_TYPES } from './teacher-brain.constants.js'
import { analyzeExecutability, mapBlockReasonToUnsupportedReason } from './teacher-brain-executability.js'

// ── Authority separation ─────────────────────────────────────────────────────
//
// BACKEND TRUTH (never inferred by AI):
//   exerciseNum, itemIndex, correctionTurn, completedItems, completedExercises
//
// AI ADVISORY LAYER (what AI reads to decide HOW to teach):
//   item text, student name, level, exercise type, persona

function resolveRuntimeMode(exerciseType: string | undefined): ExerciseRuntimeState['runtimeMode'] {
  if (!exerciseType) return 'deterministic_sequential'
  return EXERCISE_RUNTIME_MODE_MAP[exerciseType] ?? 'deterministic_sequential'
}

function resolveUnsupportedReason(exerciseType: string | undefined): UnsupportedReason | undefined {
  if (!exerciseType) return undefined

  const audioTypes = ['listening', 'audio_reconstruction']
  const imageTypes = ['photo_task', 'image_task']
  const writingTypes = ['essay_writing', 'email_writing']
  const partnerTypes = ['pairwork_hidden']
  const hiddenTypes = ['hidden_context', 'textbook_reference', 'external_reading', 'hidden_answer_dependent']

  if (audioTypes.includes(exerciseType)) return 'requires_audio'
  if (imageTypes.includes(exerciseType)) return 'requires_image'
  if (writingTypes.includes(exerciseType)) return 'requires_written_composition'
  if (partnerTypes.includes(exerciseType)) return 'requires_partner_card'
  if (hiddenTypes.includes(exerciseType)) return 'requires_hidden_context'
  return undefined
}

function resolveGuidanceMode(
  state: LessonState,
  isUnsupported: boolean,
): TeacherGuidanceMode {
  if (isUnsupported) return 'skip_and_continue'
  if (state.correctionTurn) return 'correction_ladder'

  const exerciseType = state.activeExerciseType ?? ''
  const softTypes = ['speaking_prompt', 'discussion', 'roleplay', 'brainstorm', 'interview',
    'show_interest_agree_disagree', 'show_what_you_know', 'write_sentences_from_prompts', 'free_production']

  if (softTypes.includes(exerciseType)) return 'soft_feedback'
  return 'correction_ladder'
}

function normalizeExerciseState(state: LessonState): ExerciseRuntimeState {
  const exerciseType = state.activeExerciseType ?? 'unknown'
  const typeUnsupported = (UNSUPPORTED_EXERCISE_TYPES as readonly string[]).includes(exerciseType)

  // Phase E: run content-level executability analysis when exercise data is available.
  // This catches exercises that pass the type check but are actually blocked by content
  // (e.g., a 'discussion' exercise whose items are listening comprehension questions).
  let contentBlocked = false
  let contentBlockReason: UnsupportedReason | undefined
  let contentBlockSignals: string[] | undefined
  let contentSemanticClass: string | undefined

  if (!typeUnsupported && (state.exerciseInstruction ?? state.exerciseItems?.length)) {
    const decision = analyzeExecutability({
      exerciseType,
      instruction: state.exerciseInstruction ?? '',
      items: state.exerciseItems ?? [],
      options: state.exerciseOptions ?? [],
      exerciseNumber: state.currentExerciseNum,
    })
    if (!decision.executable && decision.reason) {
      contentBlocked = true
      contentBlockReason = mapBlockReasonToUnsupportedReason(decision.reason)
      contentBlockSignals = decision.blockedSignals
      contentSemanticClass = decision.classification
    }
  }

  const isUnsupported = typeUnsupported || contentBlocked
  const runtimeMode = isUnsupported ? 'unsupported' : resolveRuntimeMode(exerciseType)

  return {
    exerciseNum: state.currentExerciseNum,
    exerciseType,
    runtimeMode,
    itemIndex: state.itemIndex,
    currentItem: state.currentItem ?? '',
    correctionTurn: state.correctionTurn,
    completedItems: state.completedItems ?? [],
    isUnsupported,
    unsupportedReason: typeUnsupported
      ? resolveUnsupportedReason(exerciseType)
      : contentBlockReason,
    contentBlockSignals,
    contentSemanticClass,
  }
}

function normalizeStudentState(
  state: LessonState,
  studentName: string,
  studentLevel: string,
  remainingSeconds?: number,
): StudentState {
  const recentErrors = state.errorsThisLesson.slice(-3).map(e =>
    `${e.errorType}: "${e.studentAnswer}" → "${e.correctAnswer}"`,
  )

  return {
    name: studentName,
    level: studentLevel,
    correctionTurn: state.correctionTurn,
    itemRetryCount: state.itemRetryCount,
    currentItem: state.currentItem ?? '',
    exerciseNum: state.currentExerciseNum,
    itemIndex: state.itemIndex,
    remainingSeconds,
    recentErrors: recentErrors.length > 0 ? recentErrors : undefined,
  }
}

export interface NormalizeContextInput {
  state: LessonState
  studentName: string
  studentLevel: string
  teacherName?: string
  remainingSeconds?: number
}

export function normalizeTeacherBrainContext(input: NormalizeContextInput): TeacherBrainContext {
  const { state, studentName, studentLevel, teacherName, remainingSeconds } = input

  const persona: TeacherPersona = teacherName === 'Emma' ? 'Emma' : 'Alex'
  const exerciseState = normalizeExerciseState(state)
  const studentState = normalizeStudentState(state, studentName, studentLevel, remainingSeconds)
  const guidanceMode = resolveGuidanceMode(state, exerciseState.isUnsupported)

  return {
    lessonId: state.lessonId,
    phase: state.phase,
    persona,
    student: studentState,
    exercise: exerciseState,
    guidanceMode,
    completedExercises: state.completedExercises ?? [],
  }
}

// Formats the AI-safe context summary (what AI needs to know, not internal state details)
export function formatAISafeContext(ctx: TeacherBrainContext): string {
  const lines: string[] = []

  lines.push(`EXERCISE RUNTIME MODE: ${ctx.exercise.runtimeMode.toUpperCase()}`)

  if (ctx.exercise.isUnsupported) {
    lines.push(`EXERCISE STATUS: UNSUPPORTED — ${ctx.exercise.unsupportedReason ?? 'requires unavailable resource'}`)
    lines.push('ACTION REQUIRED: Hard skip + present next exercise in same response')
    return lines.join('\n')
  }

  lines.push(`EXERCISE TYPE: ${ctx.exercise.exerciseType}`)
  lines.push(`EXERCISE NUMBER: ${ctx.exercise.exerciseNum}`)
  lines.push(`ITEM INDEX: ${ctx.exercise.itemIndex} (0-based)`)

  if (ctx.exercise.correctionTurn) {
    lines.push(`CORRECTION STATE: TURN ${ctx.exercise.correctionTurn} — backend-authoritative, do NOT re-derive`)
  }

  if (ctx.exercise.completedItems.length > 0) {
    lines.push(`COMPLETED ITEMS: [${ctx.exercise.completedItems.join(', ')}] — NEVER re-ask these`)
  }

  lines.push(`GUIDANCE MODE: ${ctx.guidanceMode.toUpperCase()}`)

  return lines.join('\n')
}

// Separates what backend owns from what AI is allowed to reason about
export function formatAuthorityBoundary(): string {
  return [
    'BACKEND AUTHORITY (read from state — never infer):',
    '  exerciseNum, itemIndex, correctionTurn, completedItems, completedExercises',
    'AI ADVISORY LAYER (how to teach — use context below):',
    '  item text, student level, exercise type, persona style, example quality',
  ].join('\n')
}
