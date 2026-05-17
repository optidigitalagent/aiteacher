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
} from '../engine/types.js'
import { exerciseEngine } from '../engine/exercise-engine.js'
import { memoryService } from '../memory/index.js'

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
  // Events to emit to frontend (in order: cursor first, then feedback)
  cursorUpdate:   ExerciseCursor | null
  feedback:       FeedbackEvent | null
  // Teacher Brain input — null means skip AI call (lesson complete, error, empty)
  teacherInput:   string | null
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

// ── Internal: build correction context block for wrong answers ────────────────

function buildCorrectionBlock(
  studentAnswer: string,
  correctAnswer: string,
  turn: CorrectionTurn,
  currentItem?: string,
): string {
  const TURN_INSTRUCTIONS: Record<CorrectionTurn, string> = {
    A: `TURN A (attempt 1): Ask ONE guiding question targeting the exact knowledge gap. Give ZERO part of the answer.\n  Think: what specific rule caused this error? Ask about only that.`,
    B: `TURN B (attempt 2): Give ONE small hint — one missing piece of information. Do NOT reveal the full answer.`,
    C: `TURN C (attempt 3): Give a STRONGER hint. Student is still stuck — fill in almost everything.`,
    D: `TURN D (attempt 4+): REVEAL THE FULL ANSWER NOW.\n  Say: "The answer is ${correctAnswer}. [Brief rule in one sentence]. Now repeat the full sentence after me."\n  Wait for the student to repeat correctly, then advance to the next item.`,
  }
  const retryAnchor = (turn !== 'D' && currentItem)
    ? `\nCLOSING REQUIREMENT: After your ${turn === 'A' ? 'guiding question' : 'hint'}, end with: "Try again — ${currentItem}" so the student knows what to answer.`
    : ''
  return (
    `[EXERCISE RESULT] Student answered: "${studentAnswer}" — INCORRECT.\n` +
    `Correct answer (Teacher's Book reference — do NOT reveal until TURN D): "${correctAnswer}".\n\n` +
    `CORRECTION LADDER — you are at ${turn === 'D' ? 'TURN D — REVEAL THE ANSWER' : `TURN ${turn}`}:\n` +
    `${TURN_INSTRUCTIONS[turn]}${retryAnchor}\n\n` +
    `Set "exercise": null — do NOT advance the item until the student answers correctly (or until TURN D is resolved).\n` +
    `Do NOT restart at TURN A. You are at TURN ${turn}. Stay here.`
  )
}

// ── Internal: build Teacher Brain context from engine result ─────────────────

function buildTeacherContextFromResult(result: EngineResult, studentAnswer: string): string {
  const stateBlock = result.promptContext

  let answerBlock: string

  if (result.action === 'step_correct' || result.action === 'soft_pass') {
    const cursor           = result.exerciseCursor
    const exerciseDone     = !cursor?.currentItem
    const continuationContract = exerciseDone
      ? `\nEXERCISE TURN COMPLETION CONTRACT: After step 2, announce exercise complete. ` +
        `Then introduce the next exercise immediately in the same response.`
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
    const currentItem = result.exerciseCursor?.currentItem ?? ''
    answerBlock = buildCorrectionBlock(studentAnswer, result.validation.correctAnswer, turn, currentItem)
  } else if (result.action === 'step_revealed' && result.validation) {
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

  return stateBlock ? stateBlock + '\n\n' + answerBlock : answerBlock
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

    // Build Teacher Brain context — AI verbalizes engine decision only
    const teacherInput = buildTeacherContextFromResult(result, studentAnswer)
    console.log(`[master-orch] teacher_response_requested lessonId=${lessonId} action=${result.action}`)

    return {
      cursorUpdate:   result.exerciseCursor,
      feedback:       feedbackEvent,
      teacherInput,
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
