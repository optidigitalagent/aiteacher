// ── Master Lesson Orchestrator ────────────────────────────────────────────────
// Central coordination layer that routes lesson events across deterministic
// subsystems: Exercise Engine → Validation → Memory → Teacher Brain.
//
// Authority contract:
//   Exercise Engine  — owns progression and cursor
//   Validation       — owns correctness and allowProgression
//   Teacher Brain    — verbal response only (reads teacherInput from this module)
//   Memory           — write-only, fail-soft, never blocks lesson flow
//   WS layer         — I/O only: emit events returned here, call TTS
//   AI/GPT           — NEVER controls progression or state

import type { ExerciseCursor, CorrectionTurn } from './types.js'
import type {
  EngineResult,
  EngineValidationResult,
  EngineLessonState,
  EngineTurnResult,
  EngineTurnKind,
  TeacherAction,
} from '../engine/types.js'
import { exerciseEngine } from '../engine/exercise-engine.js'
import {
  memoryService,
  updateAdaptiveSignal,
  deriveMistakeCategory,
  getSessionMemory,
  buildAdaptiveLearningContextBlock,
} from '../memory/index.js'
import type { AdaptiveSignal } from '../memory/index.js'
import { recordTraceEvent } from '../runtime/trace-recorder.js'
import {
  recordNodeAttempt,
  recordNodeCompleted,
  recordNodeSkipped,
  recordMisconception,
} from './pedagogical-progress-graph.js'
import { getHintPolicy } from '../behavior-runtime/exercise-teaching/exercise-format-registry.js'
import redis from '../db/redis.js'
import type { ExpectedAnswerNormalization } from '../voice/voice-turn-stabilizer.js'
import { buildMultilingualPhraseAnswer, detectMultilingualInterruption } from '../runtime/conversation-moves.js'

const PAID_OPENING_WARMUP_TTL_SECONDS = 14_400

function paidOpeningWarmupKey(lessonId: string): string {
  return `paid_opening_warmup:${lessonId}`
}

async function getPaidOpeningWarmupPending(lessonId: string): Promise<boolean> {
  try {
    return await redis.get(paidOpeningWarmupKey(lessonId)) === 'pending'
  } catch {
    return false
  }
}

async function markPaidOpeningWarmupPending(lessonId: string): Promise<void> {
  try {
    await redis.set(paidOpeningWarmupKey(lessonId), 'pending', 'EX', PAID_OPENING_WARMUP_TTL_SECONDS)
  } catch { /* non-fatal */ }
}

async function clearPaidOpeningWarmupPending(lessonId: string): Promise<void> {
  try {
    await redis.del(paidOpeningWarmupKey(lessonId))
  } catch { /* non-fatal */ }
}

// Inline readiness guard — mirrors normalizeIntentText + READINESS_INTENT_RE in lesson-ws.ts.
// Kept local to avoid a circular import between lesson/ and ws/ layers.
function isReadinessIntentGuard(text: string): boolean {
  const normalized = text
    .trim()
    .toLowerCase()
    .replace(/[''‚‛′]/g, "'")
    .replace(/\s+/g, ' ')
    .replace(/[.!?…]+$/, '')
    .trim()
  return /^(i'm\s+ready|i\s+am\s+ready|ready|yes|yeah|yep|ok|okay|sure|let's\s+start|start|go|begin|let's\s+go|go\s+ahead|ok(ay)?,?\s+(let's\s+(go|start)|go|start)|alright,?\s+(let's\s+(go|start)|go|start))$/i.test(normalized)
}

function buildCurrentItemReturnPrompt(state: EngineLessonState): string {
  const exState = state.currentExerciseState
  const item = normalizeSpokenLine(exState?.spec.steps[exState.currentStepIndex]?.question ?? '')
  if (!exState || !item) return ''
  return `Exercise ${exState.spec.meta.exerciseNumber}, Number ${exState.currentStepIndex + 1}: ${item}`
}

const ENGLISH_TASK_HELP_RE =
  /\b(i\s+don'?t\s+understand|i\s+dont\s+understand|i'?m\s+confused|im\s+confused|i'?m\s+lost|im\s+lost|what\s+should\s+i\s+(?:do|say|write|answer)|what\s+do\s+i\s+(?:do|say|write|answer)|what\s+is\s+the\s+task|what\s+is\s+the\s+question|can\s+you\s+(?:explain|help|clarify)|could\s+you\s+(?:explain|help|clarify)|help\s+me)\b/i

function isEnglishTaskHelpRequest(text: string): boolean {
  return ENGLISH_TASK_HELP_RE.test(text.trim())
}

function buildEnglishTaskHelpAnswer(state: EngineLessonState): string {
  const exState = state.currentExerciseState
  const step = exState?.spec.steps[exState.currentStepIndex]
  const stepPrompt = buildCurrentItemReturnPrompt(state)
  if (!exState || !step || !stepPrompt) {
    return "No problem. Tell me what part is unclear, and we'll continue from the same point."
  }

  const instruction = normalizeSpokenLine(exState.spec.instruction)
  const expected = normalizeSpokenLine(step.expectedAnswer)
  const formatHint = expected
    ? `You need ${expected.split(/\s+/).filter(Boolean).length === 1 ? 'one word' : 'a short phrase'} for the blank.`
    : 'Answer the question in your own words.'
  const meaningHint = expected ? ` ${buildMeaningHint(expected)}` : ''
  const taskHint = instruction
    ? `The task is: ${instruction}`
    : 'Use the item on screen and give the missing answer.'

  return `${taskHint} ${formatHint}${meaningHint} Now, ${stepPrompt}`
}

// ── Runtime Error Codes ───────────────────────────────────────────────────────

export type RuntimeErrorCode =
  | 'INVALID_SESSION'
  | 'INVALID_ENGINE_STATE'
  | 'STALE_EXERCISE_ANSWER'
  | 'NO_ACTIVE_CURSOR'
  | 'UNAUTHENTICATED'
  | 'LESSON_COMPLETE'
  | 'RATE_LIMITED'
  | 'INTERNAL_RUNTIME_ERROR'

export interface RuntimeError {
  code:    RuntimeErrorCode
  message: string
}

// ── Feedback event ────────────────────────────────────────────────────────────

export interface FeedbackEvent {
  correct:     boolean
  explanation: string
  score:       number
}

// ── Lesson summary (for lesson_end event) ────────────────────────────────────

export interface LessonSummaryData {
  exerciseScore:        number
  sectionId:            string | undefined
  completedExerciseIds: string[]
  durationSeconds:      number
}

// ── Input types ───────────────────────────────────────────────────────────────

export interface StudentAnswerInput {
  lessonId:        string
  userId:          string | null
  sessionId:       string | null
  studentAnswer:   string
  lessonStartedAt: number | null
  voiceNormalizationReason?: ExpectedAnswerNormalization['reason']
  rawStudentAnswer?: string
}

export interface RecoveryInput {
  lessonId:  string
  sectionId: string
}

export interface LessonCompleteInput {
  userId:          string
  sessionId:       string | null
  lessonId:        string
  engineState:     EngineLessonState
  lessonStartedAt: number | null
}

// ── Result types ──────────────────────────────────────────────────────────────

export interface OrchestratorAnswerResult {
  // Events to emit to frontend (in order: skipped cursors, then cursor, then feedback)
  cursorUpdate:   ExerciseCursor | null
  // Intermediate skipped-exercise cursors emitted before cursorUpdate (gap fill)
  skippedCursors?: ExerciseCursor[]
  feedback:       FeedbackEvent | null
  // Teacher Brain input — null means skip AI call (lesson complete, error, empty)
  teacherInput:   string | null
  deterministicTeacherText?: string | null
  // True when engine action === 'lesson_complete'
  lessonComplete: boolean
  lessonSummary?: LessonSummaryData
  // Structured error — emit as WS error event
  error?:         RuntimeError
}

export interface RecoveryResult {
  engineCursor: ExerciseCursor | null
  error?:       RuntimeError
}

// ── Internal: engine validation → correction ladder turn ─────────────────────

function engineValidationToTurn(v: EngineValidationResult): CorrectionTurn {
  if (v.shouldRevealAnswer) return 'D'
  if (v.hintsRemaining >= 2) return 'A'
  if (v.hintsRemaining === 1) return 'B'
  return 'C'
}

// ── Internal: answer-shape hint — detects format mismatch without leaking answer ──
// Returns a one-line shape hint when the student's answer format is clearly wrong.
// Never reveals the correct answer. Used to supplement correction turns A/B.

function deriveAnswerShapeHint(
  exerciseType: string,
  studentAnswer: string,
  correctAnswer: string,
): string | null {
  const studentWordCount = studentAnswer.trim().split(/\s+/).filter(Boolean).length
  const correctWordCount = correctAnswer.trim().split(/\s+/).filter(Boolean).length

  switch (exerciseType) {
    case 'fill_gap':
    case 'choose_from_box':
    case 'replace_substitute_words':
      if (studentWordCount > 3) {
        return 'Answer shape: say just the missing word — not the full sentence.'
      }
      break
    case 'complete_correct_form':
      if (studentWordCount > 3) {
        return 'Answer shape: say just the correct form of the bracketed word — not the full sentence.'
      }
      break
    case 'form_transformation':
    case 'rewrite_sentence':
    case 'write_questions':
    case 'error_correction':
      if (studentWordCount < 3 && correctWordCount > 3) {
        return 'Answer shape: say the COMPLETE sentence — all words are required.'
      }
      break
    case 'reconstruction':
      if (studentWordCount < 3 && correctWordCount > 3) {
        return 'Answer shape: say all the words in the correct order — a full sentence.'
      }
      break
  }
  return null
}

// ── Internal: emit optional runtime trace event ───────────────────────────────

function traceCorrection(event: string, data: Record<string, unknown>): void {
  if (process.env.ENABLE_RUNTIME_TRACE !== '1') return
  process.stderr.write(JSON.stringify({ event, ...data, timestamp: Date.now() }) + '\n')
}

// ── Internal: build correction context block for wrong answers ────────────────
// Uses exercise-type-specific hint policy from the format registry so corrections
// reflect the actual knowledge gap (grammar form? word order? vocabulary match?)
// rather than falling back to generic "ask a guiding question" text.

function buildCorrectionBlock(
  studentAnswer: string,
  correctAnswer: string,
  turn: CorrectionTurn,
  exerciseType: string,
  currentItem?: string,
): string {
  const hintPolicy = getHintPolicy(exerciseType)
  const shapeHint  = deriveAnswerShapeHint(exerciseType, studentAnswer, correctAnswer)

  const TURN_INSTRUCTIONS: Record<CorrectionTurn, string> = {
    A: hintPolicy.turnA,
    B: hintPolicy.turnB,
    C: hintPolicy.turnC,
    D: `TURN D — REVEAL THE FULL ANSWER NOW.\n  Say: "The answer is ${correctAnswer}. [Brief rule in one sentence]. Now repeat the full sentence after me."\n  Wait for the student to repeat correctly, then advance to the next item.`,
  }

  const shapeHintLine = shapeHint ? `\nANSWER SHAPE REMINDER: ${shapeHint}` : ''

  // Phase 7 — UI-aware retry anchor: long items are already visible on screen, repeating them is robotic.
  // Short items (≤5 words) benefit from verbal echo; long items just need "Try again."
  const retryAnchor = (() => {
    if (turn === 'D' || !currentItem) return ''
    const wordCount = currentItem.trim().split(/\s+/).filter(Boolean).length
    const anchor = wordCount <= 5
      ? `"Try again — ${currentItem}"`
      : `"Try again." (item is already on screen — do NOT repeat it verbatim)`
    return `\nCLOSING REQUIREMENT: After your ${turn === 'A' ? 'guiding question' : 'hint'}, end with: ${anchor}`
  })()

  traceCorrection('correction_context_built', {
    exerciseType,
    turn,
    hintSource: 'type_specific',
    shapeHint:  shapeHint ?? null,
  })

  return (
    `[EXERCISE RESULT] Student answered: "${studentAnswer}" — INCORRECT.\n` +
    `Correct answer (Teacher's Book reference — do NOT reveal until TURN D): "${correctAnswer}".\n\n` +
    `CORRECTION LADDER — you are at ${turn === 'D' ? 'TURN D — REVEAL THE ANSWER' : `TURN ${turn}`}:\n` +
    `${TURN_INSTRUCTIONS[turn]}${shapeHintLine}${retryAnchor}\n\n` +
    `Set "exercise": null — do NOT advance the item until the student answers correctly (or until TURN D is resolved).\n` +
    `Do NOT restart at TURN A. You are at TURN ${turn}. Stay here.`
  )
}

// ── Internal: safe skill tag from ExerciseMeta.skillFocus ────────────────────
// Returns a short, bounded tag for adaptive signal logging.
// Falls back to exerciseType if skillFocus is absent or empty.

function normalizeSkillTag(skillFocus: string | null | undefined, exerciseType: string): string {
  if (!skillFocus?.trim()) return exerciseType
  return skillFocus.trim().toLowerCase().replace(/\s+/g, '_').slice(0, 40)
}

// ── Internal: build formal EngineTurnResult from EngineResult ────────────────
// This is the deterministic contract that tells the Teacher Brain exactly what
// happened and what it must do.  AI never mutates this object.

function buildEngineTurnResult(
  result: EngineResult,
  studentAnswer: string,
  preSubmitExState: import('../engine/types.js').EngineExerciseState,
): EngineTurnResult {
  const cursor     = result.exerciseCursor
  const validation = result.validation
  const spec       = preSubmitExState.spec

  // Map EngineAction → EngineTurnKind
  let kind: EngineTurnKind = 'unsupported'
  let teacherAction: TeacherAction = 'hint_same_item'
  let shouldAdvance   = false
  let shouldStayOnItem = true
  let correctionTurn: 'A' | 'B' | 'C' | 'D' | null = null

  switch (result.action) {
    case 'step_correct':
    case 'soft_pass':
      kind           = cursor?.currentItem ? 'item_advanced' : 'exercise_completed'
      teacherAction  = cursor?.currentItem ? 'praise_and_advance' : 'announce_exercise_complete'
      shouldAdvance  = true
      shouldStayOnItem = false
      break
    case 'exercise_complete':
      kind           = cursor?.currentItem ? 'next_exercise_ready' : 'exercise_completed'
      teacherAction  = 'transition_next_exercise'
      shouldAdvance  = true
      shouldStayOnItem = false
      break
    case 'step_wrong':
      kind           = 'answer_incorrect'
      correctionTurn = engineValidationToTurn(validation!)
      teacherAction  = correctionTurn === 'D' ? 'reveal_then_advance' : 'hint_same_item'
      shouldStayOnItem = true
      break
    case 'step_revealed':
      kind           = 'answer_incorrect'
      correctionTurn = 'D'
      teacherAction  = 'reveal_then_advance'
      shouldStayOnItem = true
      break
    case 'exercise_skipped':
      kind           = 'exercise_skipped'
      teacherAction  = 'transition_next_exercise'
      shouldAdvance  = true
      shouldStayOnItem = false
      break
    case 'lesson_complete':
      kind          = 'lesson_complete'
      teacherAction = 'wrap_up'
      shouldAdvance = true
      shouldStayOnItem = false
      break
    default:
      kind          = 'unsupported'
      teacherAction = 'hint_same_item'
  }

  // Authoritative current item — after correct answer engine has already advanced cursor,
  // so cursor.currentItem is the NEXT item (or empty when exercise is done).
  // For incorrect: current item stays at the pre-submit step question.
  const currentItem = shouldAdvance
    ? (cursor?.currentItem ?? '')
    : (spec.steps[preSubmitExState.currentStepIndex]?.question ?? '')

  const forbiddenActions: string[] = [
    'decide_correctness_independently',
    'reference_completed_items_from_history',
    'advance_without_engine_signal',
    'generate_exercise_json',
  ]
  if (shouldStayOnItem) {
    forbiddenActions.push('advance_to_next_item', 'complete_exercise')
  }
  if (shouldAdvance) {
    forbiddenActions.push('stay_on_completed_item', 'repeat_old_item')
  }

  return {
    handledByEngine: true,
    kind,
    exerciseNumber:  spec.meta.exerciseNumber,
    exerciseType:    spec.exerciseType,
    itemIndex:       shouldAdvance ? (cursor?.itemIndex ?? 0) : preSubmitExState.currentStepIndex,
    itemTotal:       spec.steps.length,
    currentItem,
    expectedAnswer:  correctionTurn === 'D' ? (validation?.correctAnswer ?? '') : '',
    studentAnswer,
    retryCount:      shouldStayOnItem ? preSubmitExState.retryCount + 1 : 0,
    correctionTurn,
    shouldAdvance,
    shouldStayOnItem,
    teacherAction,
    forbiddenActions,
  }
}

// ── Internal: build Teacher Brain context from engine result ─────────────────
// etr is the deterministic EngineTurnResult built immediately after engine.submitAnswer().
// It tells the Teacher Brain exactly what happened and what to do — the AI reads this and
// verbalizes the result. It must never override or contradict what etr says.

function buildTeacherContextFromResult(
  result: EngineResult,
  studentAnswer: string,
  etr: EngineTurnResult,
  adaptiveBlock?: string,
): string {
  const stateBlock = result.promptContext

  // HISTORY BLACKOUT + ITEM LOCK header — prepended to every teacher context so that
  // the AI cannot reference completed items from conversation history or decide
  // correctness independently.
  const itemNum = etr.itemIndex + 1
  const itemLockLine = etr.shouldAdvance
    ? etr.currentItem
      ? `ITEM LOCK: Engine advanced cursor. Next item is #${etr.itemIndex + 1}: "${etr.currentItem}". ` +
        `Do NOT reference any previous item.`
      : `ITEM LOCK: Engine completed exercise. Do NOT re-anchor to any previous item or exercise.`
    : `ITEM LOCK: Engine stays on item #${itemNum}: "${etr.currentItem}". ` +
      `Do NOT advance or reference any other item.`

  const historyBlackout =
    `=== ENGINE AUTHORITY CONTEXT (this turn only — read-only) ===\n` +
    `Kind: ${etr.kind} | Action required: ${etr.teacherAction}\n` +
    `Exercise: #${etr.exerciseNumber} (${etr.exerciseType}) | ` +
    `Item: ${etr.itemIndex + 1}/${etr.itemTotal} | ` +
    `Retry: ${etr.retryCount}${etr.correctionTurn ? ` | Turn: ${etr.correctionTurn}` : ''}\n` +
    `${itemLockLine}\n` +
    `HISTORY BLACKOUT: Items from conversation history are DONE. Never say "let's continue with [old item]".\n` +
    `Forbidden: ${etr.forbiddenActions.join(', ')}\n` +
    `=== END ENGINE AUTHORITY CONTEXT ===`

  let answerBlock: string

  if (result.action === 'step_correct' || result.action === 'soft_pass') {
    const cursor           = result.exerciseCursor
    const exerciseDone     = !cursor?.currentItem
    const isOpenEnded      = result.validation?.feedbackCode === 'OPEN_ENDED_REVIEW_REQUIRED'
    const wordCount        = studentAnswer.trim().split(/\s+/).filter(Boolean).length

    // Discussion / open-ended: if answer is too short, require one follow-up before completing.
    // Trigger on exercise type (not feedbackCode) because any_response validation never sets OPEN_ENDED_REVIEW_REQUIRED.
    const SOFT_SPEAKING_TYPES = new Set(['discussion', 'speaking_prompt', 'pair_speaking', 'roleplay', 'show_interest_agree_disagree', 'soft_speaking'])
    const isDiscussionLike = SOFT_SPEAKING_TYPES.has(etr.exerciseType) || isOpenEnded
    if (isDiscussionLike && wordCount < 8 && exerciseDone) {
      console.log(`[teaching-protocol] discussion_followup_required type=${etr.exerciseType} words=${wordCount}`)
    }
    const openEndedFollowUp =
      isDiscussionLike && wordCount < 8 && exerciseDone
        ? `\nDISCUSSION FOLLOW-UP REQUIRED: The student's answer is too brief (${wordCount} word(s)). ` +
          `Before announcing exercise complete, ask ONE specific follow-up question to draw out more detail ` +
          `(e.g. "Why exactly? Can you give one example?" or "What specifically about [topic]?"). ` +
          `Wait for the follow-up answer, THEN announce exercise complete and introduce the next exercise. ` +
          `FORBIDDEN: Do NOT say "Correct. Exercise done." after a ${wordCount}-word answer.`
        : ``

    const continuationContract = exerciseDone
      ? `\nEXERCISE TURN COMPLETION CONTRACT: After step 2, announce exercise complete. ` +
        `Then introduce the next exercise immediately in the same response.${openEndedFollowUp}`
      : cursor?.currentItem
      ? `\nEXERCISE TURN COMPLETION CONTRACT: After step 2, present item ` +
        `${(cursor.itemIndex ?? 0) + 1}: "${cursor.currentItem}" in the same response. ` +
        `Do NOT stop after confirmation. Presenting the next item is mandatory.`
      : ''
    answerBlock =
      `[EXERCISE RESULT] Student answered: "${studentAnswer}" — CORRECT.\n` +
      `Your response MUST follow this structure in order:\n` +
      `1. ONE confirmation word only: "Exactly." / "Right." / "Correct."\n` +
      `2. WHY in one sentence: the rule or connection that makes this correct.${continuationContract}`
  } else if (result.action === 'exercise_complete') {
    const cursor = result.exerciseCursor
    const continuationContract = cursor?.currentItem
      ? `\nEXERCISE TURN COMPLETION CONTRACT: Announce exercise complete, then present ` +
        `item 1: "${cursor.currentItem}" of the next exercise.`
      : `\nEXERCISE TURN COMPLETION CONTRACT: Announce exercise complete. Then introduce the next exercise immediately.`
    answerBlock =
      `[EXERCISE RESULT] Student answered: "${studentAnswer}" — CORRECT (exercise completed).\n` +
      `Your response MUST follow this structure in order:\n` +
      `1. ONE confirmation word only: "Exactly." / "Right." / "Correct."\n` +
      `2. WHY in one sentence.${continuationContract}`
  } else if (result.action === 'step_wrong' && result.validation) {
    const turn        = engineValidationToTurn(result.validation)
    const currentItem = etr.currentItem || (result.exerciseCursor?.currentItem ?? '')
    traceCorrection('answer_context_derived', {
      exerciseType:  etr.exerciseType,
      turn,
      retryCount:    etr.retryCount,
      studentAnswer: studentAnswer.slice(0, 60),
    })
    answerBlock = buildCorrectionBlock(
      studentAnswer,
      result.validation.correctAnswer,
      turn,
      etr.exerciseType,
      currentItem,
    )
  } else if (result.action === 'step_revealed' && result.validation) {
    traceCorrection('retry_guidance_selected', { exerciseType: etr.exerciseType, turn: 'D', forced: true })
    answerBlock =
      `[EXERCISE RESULT] Student answered: "${studentAnswer}" — INCORRECT (max retries reached).\n` +
      `TURN D: REVEAL THE FULL ANSWER NOW.\n` +
      `Say: "The answer is ${result.validation.correctAnswer}. ` +
      `[Brief rule in one sentence]. Now repeat the full sentence after me."\n` +
      `Wait for the student to repeat, then advance to the next item.`
  } else if (result.action === 'exercise_skipped') {
    const cursor = result.exerciseCursor
    answerBlock =
      `[ENGINE] Exercise auto-skipped (unsupported type). Announce skip briefly, then introduce ` +
      (cursor?.currentItem ? `item 1 of the next exercise: "${cursor.currentItem}"` : 'the next exercise') +
      ` immediately.`
  } else if (result.action === 'lesson_complete') {
    answerBlock =
      `[ENGINE] All exercises complete. Move to WRAP_UP phase. ` +
      `Summarise what the student practised and close the lesson warmly.`
  } else {
    answerBlock = `[ENGINE] No active exercise step. Continue the lesson naturally.`
  }

  const body = stateBlock ? stateBlock + '\n\n' + answerBlock : answerBlock
  // Phase 3C: Append advisory adaptive block after engine instructions (phrasing guide only).
  // Placed last so the AI reads it after the specific turn instructions — the "how" after the "what".
  const adaptiveSection = adaptiveBlock ? '\n\n' + adaptiveBlock : ''
  return historyBlackout + '\n\n' + body + adaptiveSection
}

function normalizeSpokenLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function pickVariant(options: readonly string[], seed: number): string {
  return options[Math.abs(seed) % options.length] ?? options[0]!
}

function buildNextItemPrompt(nextItem: string, seed: number): string {
  const lead = pickVariant([
    'Next one:',
    'Try this next:',
    'Now use it here:',
    'Let\'s put that into this one:',
  ], seed)
  return `${lead} ${nextItem}`
}

function isOpeningWarmupEligible(state: EngineLessonState): boolean {
  const exState = state.currentExerciseState
  if (!exState) return false
  return exState.status === 'active' &&
    exState.spec.meta.runtimeMode === 'deterministic_sequential' &&
    exState.spec.meta.exerciseNumber === 1 &&
    exState.currentStepIndex === 0 &&
    exState.completedSteps.length === 0 &&
    exState.stepAttempts.length === 0
}

function buildOpeningWarmupQuestion(state: EngineLessonState): string {
  const exState = state.currentExerciseState
  const focus = exState?.spec.meta.skillFocus.toLowerCase() ?? ''
  const firstItem = exState?.spec.steps[exState.currentStepIndex]?.question.toLowerCase() ?? ''
  if (state.sectionId === '1.1' || /hobby|free|spare|fit|time|photography/.test(`${focus} ${firstItem}`)) {
    return 'Great. Before we start, tell me one thing: did you have any free time today? What did you do?'
  }
  return 'Great. Before we start, tell me one quick thing about today\'s topic from your own life.'
}

function buildOpeningWarmupReturn(state: EngineLessonState): string {
  const exState = state.currentExerciseState
  if (!exState) return "Nice. That is real English practice already. Now let's continue."
  const spec = exState.spec
  const item = normalizeSpokenLine(spec.steps[exState.currentStepIndex]?.question ?? '')
  const instruction = normalizeSpokenLine(spec.instruction)
  return `Nice. That is real English practice already. Now let's use today's vocabulary. Exercise 1: ${instruction} Number 1: ${item}`
}

function buildReadinessRefocus(state: EngineLessonState): string {
  const exState = state.currentExerciseState
  const item = normalizeSpokenLine(exState?.spec.steps[exState.currentStepIndex]?.question ?? '')
  if (!item) return "Great, let's continue."
  return `Great, let's stay with this one: ${item}`
}

function isSoftSpeakingTransition(result: EngineResult): boolean {
  const nextMode = result.nextExerciseSpec?.meta.runtimeMode
  const cursorType = result.exerciseCursor?.exerciseType
  return nextMode === 'soft_speaking' || cursorType === 'discussion' || cursorType === 'speaking_prompt'
}

function buildMeaningHint(correctAnswer: string): string {
  switch (correctAnswer.toLowerCase().trim()) {
    case 'hobby':
      return 'You need the noun for an activity you enjoy.'
    case 'spare time':
    case 'free time':
      return 'You need the phrase for time when you are not working or studying.'
    case 'keen on':
      return 'You need the two-word phrase for being very interested in something.'
    case 'take up':
      return 'You need the phrasal verb for starting a new activity.'
    case 'give up':
      return 'You need the phrasal verb for stopping an activity.'
    case 'get fit':
      return 'You need the two-word phrase for becoming healthy and strong.'
    default:
      return 'Look for the vocabulary phrase that matches this sentence.'
  }
}

function buildCorrectAnswerReaction(
  answer: string,
  voiceNormalizationReason?: ExpectedAnswerNormalization['reason'],
): string {
  if (voiceNormalizationReason === 'self_corrected_to_expected_answer_tail') {
    return `You corrected it to "${answer.trim()}" yourself - good.`
  }
  if (voiceNormalizationReason === 'short_answer_list_contains_expected') {
    return `I heard the correct answer "${answer.trim()}" in that turn - good.`
  }
  if (voiceNormalizationReason === 'repeated_expected_answer_phrase') {
    return `Yes, "${answer.trim()}" is right - repeating it is okay.`
  }
  switch (answer.toLowerCase().trim()) {
    case 'hobby':
      return 'Good, "hobby" fits perfectly. Photography is a nice example too.'
    case 'spare time':
      return 'Yes, "spare time" is exactly right. We use it for time when school or work is finished.'
    case 'keen on':
      return 'Exactly, "keen on" means really interested in something.'
    case 'take up':
      return 'Nice, "take up" means to start a new activity.'
    case 'give up':
      return 'Right, "give up" means to stop doing something.'
    case 'get fit':
      return 'Good, "get fit" means become healthier and stronger.'
    case 'free time':
      return 'Yes, "free time" is the natural phrase here.'
    default:
      return pickVariant([
        'Nice, that fits the sentence.',
        'Good, that phrase works here.',
        'Yes, that is the right idea.',
        'Exactly, that matches the meaning.',
      ], answer.length)
  }
}

function buildDeterministicTeacherText(
  result: EngineResult,
  etr: EngineTurnResult,
  voiceNormalizationReason?: ExpectedAnswerNormalization['reason'],
): string | null {
  const cursor = result.exerciseCursor
  const nextItem = cursor?.currentItem ? normalizeSpokenLine(cursor.currentItem) : ''
  const currentItem = normalizeSpokenLine(etr.currentItem)
  const correctAnswer = result.validation?.correctAnswer
    ? normalizeSpokenLine(result.validation.correctAnswer)
    : ''
  const confirmation = buildCorrectAnswerReaction(etr.studentAnswer, voiceNormalizationReason)

  if (result.action === 'step_correct' || result.action === 'soft_pass') {
    return nextItem
      ? `${confirmation} ${buildNextItemPrompt(nextItem, etr.itemIndex)}`
      : `${confirmation} Exercise ${etr.exerciseNumber} is complete.`
  }

  if (result.action === 'exercise_complete') {
    if (nextItem && isSoftSpeakingTransition(result)) {
      const completedLabel = etr.exerciseType === 'fill_gap' ? 'vocabulary' : 'the practice'
      return `Nice, ${completedLabel} is done. Now let's use it in a real opinion: ${nextItem}`
    }
    return nextItem
      ? `${confirmation} Exercise ${etr.exerciseNumber} is complete. ${buildNextItemPrompt(nextItem, etr.itemIndex)}`
      : `${confirmation} Exercise ${etr.exerciseNumber} is complete.`
  }

  if (result.action === 'step_revealed' && result.validation?.correctAnswer) {
    const answer = normalizeSpokenLine(result.validation.correctAnswer)
    return nextItem
      ? `The answer is "${answer}". Let's continue. Now - ${nextItem}`
      : `The answer is "${answer}". Exercise ${etr.exerciseNumber} is complete.`
  }

  if (result.action === 'step_wrong') {
    const itemPrompt = currentItem ? ` Try again - ${currentItem}` : ' Try again.'
    if (etr.correctionTurn === 'C') {
      return currentItem
        ? `Stay with this sentence. Use the vocabulary phrase, then try once more - ${currentItem}`
        : 'Stay with this item. Try once more.'
    }
    if (etr.correctionTurn === 'B' && correctAnswer) {
      const answerWords = correctAnswer.split(/\s+/).filter(Boolean)
      if (answerWords.length > 1) {
        return `It is a ${answerWords.length}-word phrase: ${answerWords[0]} __.${itemPrompt}`
      }
      return `The word starts with "${correctAnswer.slice(0, 1)}".${itemPrompt}`
    }
    const hintLead = pickVariant([
      'Good try - I see the idea.',
      'Close - you are near it.',
      'Nearly - the meaning is close.',
      'You are on the right track.',
    ], etr.retryCount)
    return `${hintLead} ${buildMeaningHint(correctAnswer)}${itemPrompt}`
  }

  return null
}

// ── MasterLessonOrchestrator ──────────────────────────────────────────────────

export class MasterLessonOrchestrator {

  // ── Primary answer handler ──────────────────────────────────────────────────
  // Called for explicit exercise_answer events (text submission from UI) and
  // unified voice answers on deterministic engine exercises.
  //
  // Guarantees:
  //   • No AI call for empty / stale / invalid inputs
  //   • No AI call for lesson_complete (WS emits lesson_end directly)
  //   • Memory writes are fail-soft and never block lesson flow
  //   • Returns events in deterministic order: cursor → feedback → teacherInput

  async handleStudentAnswer(input: StudentAnswerInput): Promise<OrchestratorAnswerResult> {
    const { lessonId, userId, sessionId, studentAnswer, lessonStartedAt } = input

    // Cost safety: reject empty answer before any Redis or AI call
    if (!studentAnswer.trim()) {
      console.log(`[master-orch] skipped_ai_call reason=empty_answer lessonId=${lessonId}`)
      return {
        cursorUpdate:   null,
        feedback:       null,
        teacherInput:   null,
        lessonComplete: false,
        error: { code: 'NO_ACTIVE_CURSOR', message: 'Empty answer submitted.' },
      }
    }

    // Validate engine state — must have active exercise
    let engineState: EngineLessonState | null
    try {
      engineState = await exerciseEngine.getState(lessonId)
    } catch (err) {
      console.error('[master-orch] getState failed:', err instanceof Error ? err.message : err)
      return {
        cursorUpdate:   null,
        feedback:       null,
        teacherInput:   null,
        lessonComplete: false,
        error: { code: 'INVALID_ENGINE_STATE', message: 'Engine state could not be loaded.' },
      }
    }

    if (!engineState?.currentExerciseState) {
      console.log(`[master-orch] rejected_stale_event reason=no_active_exercise lessonId=${lessonId}`)
      return {
        cursorUpdate:   null,
        feedback:       null,
        teacherInput:   null,
        lessonComplete: false,
        error: { code: 'NO_ACTIVE_CURSOR', message: 'No active exercise in engine state.' },
      }
    }

    const exStatus = engineState.currentExerciseState.status
    if (exStatus === 'completed' || exStatus === 'skipped') {
      console.log(`[master-orch] rejected_stale_event reason=exercise_${exStatus} lessonId=${lessonId}`)
      return {
        cursorUpdate:   null,
        feedback:       null,
        teacherInput:   null,
        lessonComplete: false,
        error: { code: 'STALE_EXERCISE_ANSWER', message: 'Exercise already completed.' },
      }
    }

    if (await getPaidOpeningWarmupPending(lessonId)) {
      await clearPaidOpeningWarmupPending(lessonId)
      console.log(`[master-orch] paid_opening_warmup_answered lessonId=${lessonId}`)
      return {
        cursorUpdate:   null,
        feedback:       null,
        teacherInput:   null,
        deterministicTeacherText: buildOpeningWarmupReturn(engineState),
        lessonComplete: false,
      }
    }

    if (isReadinessIntentGuard(studentAnswer)) {
      const teacherText = isOpeningWarmupEligible(engineState)
        ? buildOpeningWarmupQuestion(engineState)
        : buildReadinessRefocus(engineState)
      if (isOpeningWarmupEligible(engineState)) {
        await markPaidOpeningWarmupPending(lessonId)
      }
      console.log(`[master-orch] readiness_not_submitted_to_engine lessonId=${lessonId}`)
      return {
        cursorUpdate:   null,
        feedback:       null,
        teacherInput:   null,
        deterministicTeacherText: teacherText,
        lessonComplete: false,
      }
    }

    if (isEnglishTaskHelpRequest(studentAnswer)) {
      const teacherText = buildEnglishTaskHelpAnswer(engineState)
      console.log(`[master-orch] english_task_help_not_submitted_to_engine lessonId=${lessonId}`)
      return {
        cursorUpdate:   null,
        feedback:       null,
        teacherInput:   null,
        deterministicTeacherText: teacherText,
        lessonComplete: false,
      }
    }

    const multilingual = detectMultilingualInterruption(studentAnswer)
    if (multilingual.detected) {
      const stepPrompt = buildCurrentItemReturnPrompt(engineState)
      const teacherText = buildMultilingualPhraseAnswer(studentAnswer, stepPrompt, sessionId ?? lessonId)
      console.log(`[master-orch] multilingual_clarification_not_submitted_to_engine lessonId=${lessonId}`)
      return {
        cursorUpdate:   null,
        feedback:       null,
        teacherInput:   null,
        deterministicTeacherText: teacherText,
        lessonComplete: false,
      }
    }

    console.log(`[master-orch] answer_handled lessonId=${lessonId} answer="${studentAnswer.slice(0, 40)}"`)

    // Snapshot pre-submit exercise state for memory recording
    const preSubmitExercise = engineState.currentExerciseState
    const preSubmitSpec     = preSubmitExercise.spec

    // Submit to Exercise Engine — single source of truth for progression
    let result: EngineResult
    try {
      result = await exerciseEngine.submitAnswer({ lessonId, studentAnswer })
    } catch (err) {
      console.error('[master-orch] submitAnswer failed:', err instanceof Error ? err.message : err)
      return {
        cursorUpdate:   null,
        feedback:       null,
        teacherInput:   null,
        lessonComplete: false,
        error: { code: 'INTERNAL_RUNTIME_ERROR', message: 'Engine answer submission failed.' },
      }
    }

    console.log(
      `[master-orch] answer_result action=${result.action}` +
      ` correct=${result.validation?.correct ?? 'n/a'} lessonId=${lessonId}`,
    )

    // Build formal engine turn result — deterministic contract for Teacher Brain
    const engineTurnResult = buildEngineTurnResult(result, studentAnswer, preSubmitExercise)
    console.log(
      `[master-orch] engine_turn_result kind=${engineTurnResult.kind}` +
      ` teacherAction=${engineTurnResult.teacherAction}` +
      ` item=${engineTurnResult.itemIndex}/${engineTurnResult.itemTotal}` +
      ` advance=${engineTurnResult.shouldAdvance}` +
      ` correctionTurn=${engineTurnResult.correctionTurn ?? 'n/a'}` +
      ` lessonId=${lessonId}`,
    )

    // Memory: record validation event — fail-soft, never blocks lesson flow
    if (userId && result.validation && preSubmitSpec) {
      memoryService.recordValidationEvent({
        userId,
        sessionId:    sessionId ?? lessonId,
        lessonId,
        exerciseId:   preSubmitExercise.exerciseId,
        exerciseType: preSubmitSpec.exerciseType,
        stepId:       preSubmitSpec.steps[preSubmitExercise.currentStepIndex]?.stepId ?? '',
        sectionId:    engineState.sectionId,
        topic:        preSubmitSpec.meta.skillFocus,
        isCorrect:    result.validation.correct,
        score:        result.validation.score,
        retryCount:   preSubmitExercise.retryCount,
      }).catch(() => { /* fail-soft */ })
    }

    // Memory: record exercise completion event — fail-soft
    if (userId && (result.action === 'exercise_complete' || result.action === 'lesson_complete')) {
      memoryService.recordExerciseCompleted({
        userId,
        sessionId:    sessionId ?? lessonId,
        lessonId,
        exerciseId:   preSubmitExercise.exerciseId,
        exerciseType: preSubmitSpec.exerciseType,
        sectionId:    engineState.sectionId,
        topic:        preSubmitSpec.meta.skillFocus,
        totalSteps:   preSubmitSpec.steps.length,
        correctSteps: preSubmitExercise.completedSteps.length,
        totalHints:   preSubmitExercise.hintsGiven,
      }).catch(() => { /* fail-soft */ })
    }

    // Pedagogical graph: record item attempt — fail-soft, never blocks lesson flow
    const pgSectionId  = engineState.sectionId
    const pgExerciseId = preSubmitExercise.exerciseId
    const pgStep       = preSubmitSpec.steps[preSubmitExercise.currentStepIndex]
    const pgItemNodeId = pgStep ? `${pgExerciseId}_item_${pgStep.stepId}` : null

    if (pgItemNodeId && pgStep && result.validation) {
      const isCorrect = result.validation.correct
      const pgLabel   = pgStep.question.slice(0, 100)
      recordNodeAttempt(lessonId, pgSectionId, pgItemNodeId, 'item', pgLabel, studentAnswer, isCorrect)
        .catch(() => { /* fail-soft */ })
      if (!isCorrect) {
        recordMisconception(lessonId, pgSectionId, pgItemNodeId, 'item', pgLabel, studentAnswer)
          .catch(() => { /* fail-soft */ })
        console.log(`[pedagogy_graph] misconception_recorded nodeId=${pgItemNodeId} lessonId=${lessonId}`)
      }
    }

    // Pedagogical graph: record exercise completion — fail-soft
    if (result.action === 'exercise_complete' || result.action === 'lesson_complete') {
      const pgExNodeId = `exercise_${pgExerciseId}`
      const pgExLabel  = `Exercise ${preSubmitSpec.meta.exerciseNumber}: ${preSubmitSpec.exerciseType}`
      recordNodeCompleted(lessonId, pgSectionId, pgExNodeId, 'exercise', pgExLabel)
        .catch(() => { /* fail-soft */ })
    }

    // Pedagogical graph: record exercise skip — fail-soft
    if (result.action === 'exercise_skipped') {
      const pgExNodeId = `exercise_${pgExerciseId}`
      const pgExLabel  = `Exercise ${preSubmitSpec.meta.exerciseNumber}: ${preSubmitSpec.exerciseType}`
      recordNodeSkipped(lessonId, pgSectionId, pgExNodeId, 'exercise', pgExLabel)
        .catch(() => { /* fail-soft */ })
    }

    // ── Adaptive outcome values (pure/sync — shared by Phase 3B and 3C) ──────────
    const adaptiveOutcome: AdaptiveSignal['outcome'] =
      result.action === 'step_correct'    ||
      result.action === 'soft_pass'       ||
      result.action === 'exercise_complete' ||
      result.action === 'lesson_complete'
        ? 'correct'
      : result.action === 'step_revealed'   ? 'revealed'
      : result.action === 'exercise_skipped' ? 'skipped'
      : 'wrong'

    const adaptiveSkillTag = normalizeSkillTag(preSubmitSpec.meta.skillFocus, preSubmitSpec.exerciseType)

    // answerShapeIssue: detect format mismatch on wrong answers (reuses existing pure fn)
    const adaptiveAnswerShapeIssue: boolean =
      adaptiveOutcome === 'wrong' && !!result.validation?.correctAnswer
        ? deriveAnswerShapeHint(preSubmitSpec.exerciseType, studentAnswer, result.validation.correctAnswer) !== null
        : false

    // Phase 3C: Read session memory (pre-update state = previous turns' signals) and build
    // advisory adaptive context block for the teacher correction context.
    // Fail-soft: omit block on any Redis error — lesson continues normally.
    // Advisory-only: this block may affect phrasing/hint depth. It cannot affect engine state,
    // cursor progression, payment, WS protocol, or lesson FSM.
    let adaptiveBlock = ''
    if (userId) {
      try {
        const sessionMem = await getSessionMemory(lessonId, userId)
        adaptiveBlock = buildAdaptiveLearningContextBlock({
          sessionMemory:                 sessionMem,
          exerciseType:                  preSubmitSpec.exerciseType,
          skillTag:                      adaptiveSkillTag,
          correctionTurn:                engineTurnResult.correctionTurn,
          answerShapeIssueAlreadyHinted: adaptiveAnswerShapeIssue,
          outcome:                       adaptiveOutcome,
        })

        if (adaptiveBlock) {
          recordTraceEvent({
            eventType:      'adaptive_context_injected',
            exerciseType:   preSubmitSpec.exerciseType,
            payloadSummary: `hintDepth=${sessionMem.hintDepthSignal ?? 'normal'} skill=${adaptiveSkillTag} shapeReminder=${(!adaptiveAnswerShapeIssue && (sessionMem.answerShapeIssues?.[preSubmitSpec.exerciseType] ?? 0) >= 2)} turn=${engineTurnResult.correctionTurn ?? 'none'}`,
            severity:       'debug',
          })
        } else {
          recordTraceEvent({
            eventType:      'adaptive_context_skipped',
            exerciseType:   preSubmitSpec.exerciseType,
            payloadSummary: `reason=default_signals exerciseType=${preSubmitSpec.exerciseType}`,
            severity:       'debug',
          })
        }
      } catch {
        // fail-soft: omit adaptive block, continue lesson normally
        console.warn(`[master-orch] adaptive_context_build_failed lessonId=${lessonId} (ignored)`)
      }
    }

    // Phase 3B: Adaptive Signal Logging — observes runtime truth, never alters it.
    // Fired AFTER adaptive block is built so the block reads the pre-update session state.
    // Fire-and-forget: fail-soft, does NOT block lesson progression or AI response.
    if (userId) {
      try {
        const mistakeCat = adaptiveOutcome !== 'correct'
          ? deriveMistakeCategory({
              exerciseType:     preSubmitSpec.exerciseType,
              skillTag:         adaptiveSkillTag,
              retryCount:       preSubmitExercise.retryCount,
              answerShapeIssue: adaptiveAnswerShapeIssue,
              score:            result.validation?.score ?? 0,
            })
          : 'unknown' as const

        const adaptiveSignal: AdaptiveSignal = {
          userId,
          sessionId:       sessionId ?? lessonId,
          sectionId:       engineState.sectionId ?? '',
          exerciseId:      preSubmitExercise.exerciseId,
          exerciseType:    preSubmitSpec.exerciseType,
          skillTag:        adaptiveSkillTag,
          outcome:         adaptiveOutcome,
          retryCount:      preSubmitExercise.retryCount,
          correctionTurn:  engineTurnResult.correctionTurn,
          mistakeCategory: mistakeCat,
          answerShapeIssue: adaptiveAnswerShapeIssue,
          confidenceScore: result.validation?.score ?? 1.0,
          timestamp:       new Date().toISOString(),
        }

        traceCorrection('adaptive_signal_recorded', {
          payloadSummary: `outcome=${adaptiveOutcome} exerciseType=${preSubmitSpec.exerciseType} mistakeCategory=${mistakeCat} skill=${adaptiveSkillTag} retry=${preSubmitExercise.retryCount} shape=${adaptiveAnswerShapeIssue}`,
        })

        updateAdaptiveSignal(lessonId, userId, adaptiveSignal).catch(() => { /* fail-soft */ })
      } catch {
        // adaptive signal build failure must never propagate into lesson runtime
      }
    }

    // Build feedback event for immediate frontend update
    const feedbackEvent: FeedbackEvent | null = result.validation
      ? {
          correct:     result.validation.correct,
          explanation: result.validation.feedback,
          score:       result.validation.score,
        }
      : null

    // Lesson complete — emit summary; no AI call
    if (result.action === 'lesson_complete') {
      const durationSeconds = lessonStartedAt
        ? Math.round((Date.now() - lessonStartedAt) / 1_000)
        : 0

      // Memory: record lesson completion — fail-soft
      if (userId) {
        memoryService.recordLessonCompleted({
          userId,
          sessionId:          sessionId ?? lessonId,
          lessonId,
          sectionId:          engineState.sectionId,
          phaseReached:       'EXERCISES',
          completedExercises: engineState.completedExerciseIds,
          durationSeconds,
          voiceAttemptCount:  0,
        }).catch(() => { /* fail-soft */ })
      }

      console.log(`[master-orch] lesson_completed lessonId=${lessonId} skipped_ai_call=true`)
      return {
        cursorUpdate:   null,
        feedback:       feedbackEvent,
        teacherInput:   null,
        lessonComplete: true,
        lessonSummary: {
          exerciseScore:        engineState.completedExerciseIds.length,
          sectionId:            engineState.sectionId,
          completedExerciseIds: engineState.completedExerciseIds,
          durationSeconds,
        },
      }
    }

    // Build Teacher Brain context — AI verbalizes engine decision only.
    // Phase 3C: adaptiveBlock is advisory; injected at end of context (phrasing guide only).
    const teacherInput = buildTeacherContextFromResult(result, studentAnswer, engineTurnResult, adaptiveBlock || undefined)
    const deterministicTeacherText = buildDeterministicTeacherText(
      result,
      engineTurnResult,
      input.voiceNormalizationReason,
    )
    console.log(`[master-orch] teacher_response_requested lessonId=${lessonId} action=${result.action}`)

    // Log canonical cursor version going into teacher context
    const cursorVersion = result.exerciseCursor?.cursorVersion ?? engineState.cursorVersion ?? 0
    console.log(
      `[cursor] teacher_context_cursor lessonId=${lessonId}` +
      ` exercise=#${engineTurnResult.exerciseNumber}` +
      ` item=${engineTurnResult.itemIndex + 1}/${engineTurnResult.itemTotal}` +
      ` version=${cursorVersion}`,
    )

    return {
      cursorUpdate:   result.exerciseCursor,
      skippedCursors: result.skippedExerciseCursors,
      feedback:       feedbackEvent,
      teacherInput,
      deterministicTeacherText,
      lessonComplete: false,
    }
  }

  // ── Voice answer handler ────────────────────────────────────────────────────
  // Routes voice transcript through handleStudentAnswer only when the engine
  // has an active deterministic exercise. Returns null otherwise — caller must
  // continue with the legacy manifest/AI path.
  //
  // Guarantees:
  //   • Returns null (no error thrown) on any non-fatal condition
  //   • No AI call; caller decides whether to call AI based on teacherInput
  //   • Identical engine path as handleStudentAnswer (text/voice parity)

  async handleVoiceAnswer(input: StudentAnswerInput): Promise<OrchestratorAnswerResult | null> {
    const { lessonId } = input
    try {
      const engineState = await exerciseEngine.getState(lessonId)
      if (
        !engineState ||
        engineState.sectionId === 'free' ||
        !engineState.currentExerciseState ||
        engineState.currentExerciseState.status !== 'active' ||
        engineState.currentExerciseState.spec.meta.runtimeMode !== 'deterministic_sequential'
      ) {
        return null  // not a deterministic engine exercise — caller handles normally
      }
      // Readiness guard: "I'm ready." / "ready!" must never reach exerciseEngine.submitAnswer().
      // Inline normalization mirrors normalizeIntentText() in lesson-ws.ts.
      console.log(`[master-orch] voice_answer_handled lessonId=${lessonId} answer="${input.studentAnswer.slice(0, 40)}"`)
      return this.handleStudentAnswer(input)
    } catch (err) {
      console.error('[master-orch] handleVoiceAnswer error:', err instanceof Error ? err.message : err)
      return null  // non-fatal — caller continues with normal voice processing
    }
  }

  // ── Session recovery ────────────────────────────────────────────────────────
  // Restores engine state on WS reconnect.
  // Guarantees: NO AI call. Returns cursor snapshot or structured error.

  async recoverSession(input: RecoveryInput): Promise<RecoveryResult> {
    const { lessonId, sectionId } = input
    try {
      const engineState = await exerciseEngine.recover(lessonId, sectionId)
      console.log(
        `[master-orch] session_recovered lessonId=${lessonId} section=${sectionId}` +
        ` exercises=${engineState.exerciseQueue.length}`,
      )
      const engineCursor = await exerciseEngine.getCursor(lessonId)
      if (engineCursor) {
        console.log(
          `[master-orch] cursor_snapshot exercise=#${engineCursor.exerciseNumber}` +
          ` item=${engineCursor.itemIndex}/${engineCursor.itemTotal} lessonId=${lessonId}`,
        )
      }
      return { engineCursor }
    } catch (err) {
      console.error('[master-orch] recoverSession failed:', err instanceof Error ? err.message : err)
      return {
        engineCursor: null,
        error: {
          code:    'INVALID_ENGINE_STATE',
          message: 'Engine state could not be recovered. Continuing with cached lesson state.',
        },
      }
    }
  }

  // ── Emit cursor and feedback snapshot ──────────────────────────────────────
  // Convenience helper for callers that need to emit both cursor and feedback
  // in the correct deterministic order.
  // Returns the cursor for callers that need it.
  emitFrontendSnapshot(
    result:   OrchestratorAnswerResult,
    emitFn:   (event: { type: string; [key: string]: unknown }) => void,
    lessonId: string,
  ): void {
    // Emit intermediate skipped cursors first so frontend never sees a gap > 1
    if (result.skippedCursors && result.skippedCursors.length > 0) {
      for (const sc of result.skippedCursors) {
        emitFn({ type: 'exercise_cursor_updated', cursor: sc })
        console.log(
          `[master-orch] skipped_cursor_emitted exercise=#${sc.exerciseNumber}` +
          ` type=${sc.exerciseType} lessonId=${lessonId}`,
        )
      }
    }
    if (result.cursorUpdate) {
      emitFn({ type: 'exercise_cursor_updated', cursor: result.cursorUpdate })
      console.log(
        `[master-orch] cursor_emitted exercise=#${result.cursorUpdate.exerciseNumber}` +
        ` item=${result.cursorUpdate.itemIndex}/${result.cursorUpdate.itemTotal} lessonId=${lessonId}`,
      )
    }
    if (result.feedback) {
      emitFn({
        type:        'feedback',
        correct:     result.feedback.correct,
        explanation: result.feedback.explanation,
        score:       result.feedback.score,
      })
    }
  }
}

// ── Singleton export ──────────────────────────────────────────────────────────

export const masterOrchestrator = new MasterLessonOrchestrator()
