// ── Exercise Engine — Main Facade ─────────────────────────────────────────────
// Public API for the WS layer and orchestrator.
// This class owns all exercise state and progression.
// Claude/GPT never calls these methods — only the backend WS handler does.
//
// API contract:
//   engine.init(lessonId, sectionId)        — start a new lesson
//   engine.submitAnswer(lessonId, answer)   — student answered a step
//   engine.skipCurrent(lessonId)            — skip the current exercise
//   engine.getState(lessonId)               — read current state (no mutation)
//   engine.getPromptContext(lessonId)       — inject into AI system prompt
//   engine.getCursor(lessonId)              — send to frontend as ExerciseCursor
//   engine.recover(lessonId, sectionId)     — restore after WS reconnect

import type {
  EngineLessonState,
  EngineExerciseState,
  EngineResult,
  EngineAction,
  AnswerSubmission,
} from './types.js'
import { loadExercisesForSection } from './exercise-loader.js'
import { validateStep } from './validation-hooks.js'
import {
  initExerciseState,
  advanceStep,
  skipExercise,
  recordAttempt,
  getCurrentStep,
  isExerciseComplete,
  shouldAutoAdvance,
} from './step-progression-manager.js'
import {
  findNextExercise,
  resolveEngineAction,
  shouldAutoSkip,
  isLessonComplete,
  resolveCompletedExerciseNumbers,
} from './exercise-transitions.js'
import { loadEngineState, saveEngineState } from './exercise-sync.js'
import { recoverEngineState, validateRecoveredState } from './exercise-recovery.js'
import { formatCursor, buildPromptContext } from './frontend-formatter.js'
import type { ExerciseCursor } from '../lesson/types.js'

export class ExerciseEngine {

  // ── Initialise a new lesson ─────────────────────────────────────────────────

  async init(lessonId: string, sectionId: string): Promise<EngineLessonState> {
    if (!sectionId || sectionId === 'free') {
      const emptyState: EngineLessonState = {
        lessonId,
        sectionId:            'free',
        exerciseQueue:        [],
        currentExerciseIndex: 0,
        completedExerciseIds: [],
        skippedExerciseIds:   [],
        sessionStartedAt:     new Date().toISOString(),
        lastActivityAt:       new Date().toISOString(),
        engineVersion:        1,
      }
      await saveEngineState(lessonId, emptyState)
      return emptyState
    }

    const { exercises } = loadExercisesForSection(sectionId)
    const firstSpec     = exercises[0]

    let firstExState: EngineExerciseState | undefined
    let skippedIds: string[] = []

    if (firstSpec) {
      if (shouldAutoSkip(firstSpec)) {
        firstExState = skipExercise(initExerciseState(firstSpec))
        skippedIds   = [firstSpec.exerciseId]
      } else {
        firstExState = initExerciseState(firstSpec)
      }
    }

    const state: EngineLessonState = {
      lessonId,
      sectionId,
      exerciseQueue:        exercises,
      currentExerciseIndex: 0,
      currentExerciseState: firstExState,
      completedExerciseIds: [],
      skippedExerciseIds:   skippedIds,
      sessionStartedAt:     new Date().toISOString(),
      lastActivityAt:       new Date().toISOString(),
      engineVersion:        1,
    }

    await saveEngineState(lessonId, state)
    console.log(
      `[engine] init lessonId=${lessonId} section=${sectionId} ` +
      `exercises=${exercises.length}`,
    )
    return state
  }

  // ── Submit a student answer ─────────────────────────────────────────────────

  async submitAnswer(submission: AnswerSubmission): Promise<EngineResult> {
    const { lessonId, studentAnswer } = submission
    const state = await this.requireState(lessonId)

    const exState = state.currentExerciseState
    if (!exState || isExerciseComplete(exState)) {
      return this.noChangeResult(state)
    }

    // Auto-advance guard: unsupported exercises skip without validation
    if (shouldAutoAdvance(exState)) {
      return this.processAutoSkip(state, exState)
    }

    const step = getCurrentStep(exState)
    if (!step) return this.noChangeResult(state)

    // Validate
    const validation = await validateStep(step, studentAnswer, exState.retryCount)

    // Record attempt (immutable update)
    const updatedExState = recordAttempt(exState, studentAnswer, validation)

    const isLastStep  = updatedExState.currentStepIndex >= exState.spec.steps.length - 1
    const action = resolveEngineAction({
      correct:      validation.correct,
      shouldReveal: validation.shouldRevealAnswer,
      isLastStep:   validation.correct && isLastStep,
      isSkipped:    false,
    })

    // Advance only when ValidationService approved progression
    const finalExState = validation.allowProgression
      ? advanceStep(updatedExState)
      : updatedExState

    // Check if exercise is now complete
    const exerciseNowComplete = isExerciseComplete(finalExState)

    let finalState: EngineLessonState = { ...state, currentExerciseState: finalExState }

    if (exerciseNowComplete) {
      finalState = this.closeCurrentExercise(finalState, finalExState)
      await saveEngineState(lessonId, finalState)

      const completedNumbers = resolveCompletedExerciseNumbers(finalState)
      const nextSpec = findNextExercise({
        queue:                    finalState.exerciseQueue,
        currentIndex:             finalState.currentExerciseIndex,
        completedExerciseNumbers: completedNumbers,
        currentExercise:          finalExState,
      })

      if (!nextSpec) {
        console.log(`[engine] lesson_complete lessonId=${lessonId}`)
        return {
          action:          'lesson_complete',
          validation,
          exerciseCursor:  null,
          promptContext:   buildPromptContext(undefined, finalState),
        }
      }

      // Load next exercise — drain auto-skipped exercises until we reach an active one
      let nextExState = shouldAutoSkip(nextSpec)
        ? skipExercise(initExerciseState(nextSpec))
        : initExerciseState(nextSpec)
      let currentNextSpec = nextSpec

      finalState = this.mountNextExercise(finalState, nextExState, currentNextSpec)

      while (nextExState.status === 'skipped') {
        finalState = this.closeCurrentExercise(finalState, nextExState)
        const drained = resolveCompletedExerciseNumbers(finalState)
        const afterSkip = findNextExercise({
          queue:                    finalState.exerciseQueue,
          currentIndex:             finalState.currentExerciseIndex,
          completedExerciseNumbers: drained,
          currentExercise:          nextExState,
        })
        if (!afterSkip) {
          await saveEngineState(lessonId, finalState)
          console.log(`[engine] lesson_complete (all remaining skipped) lessonId=${lessonId}`)
          return {
            action:         'lesson_complete',
            validation,
            exerciseCursor: null,
            promptContext:  buildPromptContext(undefined, finalState),
          }
        }
        nextExState = shouldAutoSkip(afterSkip)
          ? skipExercise(initExerciseState(afterSkip))
          : initExerciseState(afterSkip)
        currentNextSpec = afterSkip
        finalState = this.mountNextExercise(finalState, nextExState, afterSkip)
      }

      await saveEngineState(lessonId, finalState)

      console.log(
        `[engine] exercise_complete → next #${currentNextSpec.meta.exerciseNumber} ` +
        `type=${currentNextSpec.exerciseType} lessonId=${lessonId}`,
      )

      return {
        action:           'exercise_complete',
        validation,
        exerciseCursor:   formatCursor(nextExState, finalState),
        promptContext:    buildPromptContext(nextExState, finalState),
        nextExerciseSpec: currentNextSpec,
      }
    }

    // Exercise still active — persist and return
    await saveEngineState(lessonId, finalState)

    console.log(
      `[engine] step_result action=${action} step=${finalExState.currentStepIndex - (validation.correct ? 0 : 0)} ` +
      `correct=${validation.correct} lessonId=${lessonId}`,
    )

    return {
      action,
      validation,
      exerciseCursor: formatCursor(finalExState, finalState),
      promptContext:  buildPromptContext(finalExState, finalState),
    }
  }

  // ── Skip the current exercise ───────────────────────────────────────────────

  async skipCurrent(lessonId: string): Promise<EngineResult> {
    const state   = await this.requireState(lessonId)
    const exState = state.currentExerciseState
    if (!exState) return this.noChangeResult(state)

    const skipped = skipExercise(exState)
    let finalState = this.closeCurrentExercise({ ...state, currentExerciseState: skipped }, skipped)

    const completedNumbers = resolveCompletedExerciseNumbers(finalState)
    const nextSpec = findNextExercise({
      queue:                    finalState.exerciseQueue,
      currentIndex:             finalState.currentExerciseIndex,
      completedExerciseNumbers: completedNumbers,
      currentExercise:          skipped,
    })

    if (!nextSpec) {
      await saveEngineState(lessonId, finalState)
      return {
        action:         'lesson_complete',
        validation:     null,
        exerciseCursor: null,
        promptContext:  buildPromptContext(undefined, finalState),
      }
    }

    const nextExState = shouldAutoSkip(nextSpec)
      ? skipExercise(initExerciseState(nextSpec))
      : initExerciseState(nextSpec)

    finalState = this.mountNextExercise(finalState, nextExState, nextSpec)
    await saveEngineState(lessonId, finalState)

    console.log(`[engine] skip → next #${nextSpec.meta.exerciseNumber} lessonId=${lessonId}`)

    return {
      action:           'exercise_skipped',
      validation:       null,
      exerciseCursor:   formatCursor(nextExState, finalState),
      promptContext:    buildPromptContext(nextExState, finalState),
      nextExerciseSpec: nextSpec,
    }
  }

  // ── Read-only state access ──────────────────────────────────────────────────

  async getState(lessonId: string): Promise<EngineLessonState | null> {
    return loadEngineState(lessonId)
  }

  async getPromptContext(lessonId: string): Promise<string> {
    const state = await loadEngineState(lessonId)
    if (!state) return ''
    return buildPromptContext(state.currentExerciseState, state)
  }

  async getCursor(lessonId: string): Promise<ExerciseCursor | null> {
    const state = await loadEngineState(lessonId)
    if (!state?.currentExerciseState) return null
    if (isExerciseComplete(state.currentExerciseState)) return null
    return formatCursor(state.currentExerciseState, state)
  }

  // ── Reconnect recovery ──────────────────────────────────────────────────────

  async recover(lessonId: string, sectionId: string): Promise<EngineLessonState> {
    const state = await recoverEngineState(lessonId, sectionId)

    if (!validateRecoveredState(state)) {
      console.warn(`[engine:recover] invalid state — re-initialising lessonId=${lessonId}`)
      return this.init(lessonId, sectionId)
    }

    // Refresh TTL on successful recovery
    await saveEngineState(lessonId, state)
    console.log(`[engine:recover] ok lessonId=${lessonId} exercise=${state.currentExerciseIndex}`)
    return state
  }

  // ── Internal helpers ────────────────────────────────────────────────────────

  private async requireState(lessonId: string): Promise<EngineLessonState> {
    const state = await loadEngineState(lessonId)
    if (!state) throw new Error(`[engine] no state for lessonId=${lessonId}`)
    return state
  }

  private closeCurrentExercise(
    state: EngineLessonState,
    closedExState: EngineExerciseState,
  ): EngineLessonState {
    const wasSkipped   = closedExState.status === 'skipped'
    const completedIds = wasSkipped
      ? state.completedExerciseIds
      : [...state.completedExerciseIds, closedExState.exerciseId]
    const skippedIds   = wasSkipped
      ? [...state.skippedExerciseIds, closedExState.exerciseId]
      : state.skippedExerciseIds

    return {
      ...state,
      completedExerciseIds: completedIds,
      skippedExerciseIds:   skippedIds,
    }
  }

  private mountNextExercise(
    state: EngineLessonState,
    nextExState: EngineExerciseState,
    nextSpec: import('./types.js').ExerciseSpec,
  ): EngineLessonState {
    const nextIndex = state.exerciseQueue.findIndex(e => e.exerciseId === nextSpec.exerciseId)
    const skippedIds = nextExState.status === 'skipped'
      ? [...state.skippedExerciseIds, nextSpec.exerciseId]
      : state.skippedExerciseIds

    return {
      ...state,
      currentExerciseIndex: nextIndex >= 0 ? nextIndex : state.currentExerciseIndex + 1,
      currentExerciseState: nextExState,
      skippedExerciseIds:   skippedIds,
    }
  }

  private async processAutoSkip(
    state: EngineLessonState,
    exState: EngineExerciseState,
  ): Promise<EngineResult> {
    const skipped   = skipExercise(exState)
    let finalState  = this.closeCurrentExercise({ ...state, currentExerciseState: skipped }, skipped)

    const completedNumbers = resolveCompletedExerciseNumbers(finalState)
    const nextSpec = findNextExercise({
      queue:                    finalState.exerciseQueue,
      currentIndex:             finalState.currentExerciseIndex,
      completedExerciseNumbers: completedNumbers,
      currentExercise:          skipped,
    })

    if (!nextSpec) {
      await saveEngineState(exState.exerciseId, finalState)
      return {
        action:         'lesson_complete',
        validation:     null,
        exerciseCursor: null,
        promptContext:  buildPromptContext(undefined, finalState),
      }
    }

    const nextExState = shouldAutoSkip(nextSpec)
      ? skipExercise(initExerciseState(nextSpec))
      : initExerciseState(nextSpec)

    finalState = this.mountNextExercise(finalState, nextExState, nextSpec)
    await saveEngineState(state.lessonId, finalState)

    return {
      action:           'exercise_skipped',
      validation:       null,
      exerciseCursor:   formatCursor(nextExState, finalState),
      promptContext:    buildPromptContext(nextExState, finalState),
      nextExerciseSpec: nextSpec,
    }
  }

  private noChangeResult(state: EngineLessonState): EngineResult {
    return {
      action:         'no_change',
      validation:     null,
      exerciseCursor: null,
      promptContext:  buildPromptContext(state.currentExerciseState, state),
    }
  }
}

// ── Singleton export ──────────────────────────────────────────────────────────
// One engine instance handles all lessons (stateless beyond Redis).

export const exerciseEngine = new ExerciseEngine()
