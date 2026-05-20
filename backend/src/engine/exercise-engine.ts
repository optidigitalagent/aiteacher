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
import {
  buildCanonicalCursor,
  saveCanonicalCursor,
  logCanonicalCursor,
} from './canonical-cursor.js'
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

    console.log(
      `[engine:init] section="${sectionId}" lessonId=${lessonId} ` +
      `exerciseCount=${exercises.length} firstSpec=${firstSpec ? `ex#${firstSpec.meta.exerciseNumber} type=${firstSpec.exerciseType} mode=${firstSpec.meta.runtimeMode} steps=${firstSpec.steps.length}` : 'NONE'}`,
    )

    let firstExState: EngineExerciseState | undefined
    let skippedIds: string[] = []

    if (firstSpec) {
      if (shouldAutoSkip(firstSpec)) {
        firstExState = skipExercise(initExerciseState(firstSpec))
        skippedIds   = [firstSpec.exerciseId]
        console.log(`[engine:init] first_exercise_AUTO_SKIPPED ex#${firstSpec.meta.exerciseNumber} mode=${firstSpec.meta.runtimeMode} lessonId=${lessonId}`)
      } else {
        firstExState = initExerciseState(firstSpec)
        console.log(`[engine:init] first_exercise_ACTIVE ex#${firstSpec.meta.exerciseNumber} mode=${firstSpec.meta.runtimeMode} stepCount=${firstExState.spec.steps.length} lessonId=${lessonId}`)
      }
    } else {
      console.error(`[engine:init] NO_FIRST_EXERCISE section="${sectionId}" lessonId=${lessonId} — exerciseQueue is empty, getCursor will return null`)
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
      cursorVersion:        1,
    }

    await this.saveWithCanonicalCursor(lessonId, state, 'engine_init')
    console.log(
      `[engine] init_complete lessonId=${lessonId} section=${sectionId} ` +
      `exercises=${exercises.length} firstExerciseActive=${firstExState?.status === 'active'}`,
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

    // Bump cursor version on every item progression (correct answer or reveal)
    const versionBumped = validation.allowProgression || validation.shouldRevealAnswer
    let finalState: EngineLessonState = {
      ...state,
      currentExerciseState: finalExState,
      cursorVersion: versionBumped ? (state.cursorVersion ?? 0) + 1 : (state.cursorVersion ?? 0),
    }

    if (exerciseNowComplete) {
      finalState = this.closeCurrentExercise(this.bumpVersion(finalState), finalExState)
      await saveEngineState(lessonId, finalState)

      const completedNumbers = resolveCompletedExerciseNumbers(finalState)
      const nextSpec = findNextExercise({
        queue:                    finalState.exerciseQueue,
        currentIndex:             finalState.currentExerciseIndex,
        completedExerciseNumbers: completedNumbers,
        currentExercise:          finalExState,
      })

      if (!nextSpec) {
        console.log(
          `[engine] lesson_complete lessonId=${lessonId} ` +
          `exercise_queue_completed=true completed=${finalState.completedExerciseIds.length}/${finalState.exerciseQueue.length}`,
        )
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

      finalState = this.mountNextExercise(this.bumpVersion(finalState), nextExState, currentNextSpec)

      // Collect intermediate skipped cursors so the frontend never sees a gap > 1
      const skippedExerciseCursors: ExerciseCursor[] = []

      while (nextExState.status === 'skipped') {
        // Emit a cursor for this skipped exercise so frontend exerciseNumber sequence has no gap > 1
        skippedExerciseCursors.push(formatCursor(nextExState, finalState))
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
            action:                'lesson_complete',
            validation,
            exerciseCursor:        null,
            promptContext:         buildPromptContext(undefined, finalState),
            skippedExerciseCursors: skippedExerciseCursors.length > 0 ? skippedExerciseCursors : undefined,
          }
        }
        nextExState = shouldAutoSkip(afterSkip)
          ? skipExercise(initExerciseState(afterSkip))
          : initExerciseState(afterSkip)
        currentNextSpec = afterSkip
        finalState = this.mountNextExercise(this.bumpVersion(finalState), nextExState, afterSkip)
      }

      await this.saveWithCanonicalCursor(lessonId, finalState, 'exercise_complete')

      console.log(
        `[engine] exercise_complete → next #${currentNextSpec.meta.exerciseNumber} ` +
        `type=${currentNextSpec.exerciseType} lessonId=${lessonId}`,
      )

      return {
        action:                'exercise_complete',
        validation,
        exerciseCursor:        formatCursor(nextExState, finalState),
        promptContext:         buildPromptContext(nextExState, finalState),
        nextExerciseSpec:      currentNextSpec,
        skippedExerciseCursors: skippedExerciseCursors.length > 0 ? skippedExerciseCursors : undefined,
      }
    }

    // Exercise still active — persist and save canonical cursor if item advanced
    await this.saveWithCanonicalCursor(
      lessonId,
      finalState,
      versionBumped ? 'item_advanced' : 'retry',
    )

    console.log(
      `[engine] step_result action=${action} step=${finalExState.currentStepIndex} ` +
      `correct=${validation.correct} version=${finalState.cursorVersion} lessonId=${lessonId}`,
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
    let finalState = this.closeCurrentExercise(
      this.bumpVersion({ ...state, currentExerciseState: skipped }),
      skipped,
    )

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

    finalState = this.mountNextExercise(this.bumpVersion(finalState), nextExState, nextSpec)
    await this.saveWithCanonicalCursor(lessonId, finalState, 'exercise_skipped')

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
    if (!state) {
      console.error(`[engine:getCursor] state_not_found lessonId=${lessonId} — Redis may have lost state after init`)
      return null
    }
    if (!state.currentExerciseState) {
      console.error(`[engine:getCursor] no_current_exercise lessonId=${lessonId} section="${state.sectionId}" queue=${state.exerciseQueue.length}`)
      return null
    }
    const complete = isExerciseComplete(state.currentExerciseState)
    if (complete) {
      console.error(
        `[engine:getCursor] exercise_already_complete lessonId=${lessonId} ` +
        `status="${state.currentExerciseState.status}" ` +
        `stepIndex=${state.currentExerciseState.currentStepIndex}/${state.currentExerciseState.spec.steps.length}`,
      )
      return null
    }
    return formatCursor(state.currentExerciseState, state)
  }

  // ── Reconnect recovery ──────────────────────────────────────────────────────

  async recover(lessonId: string, sectionId: string): Promise<EngineLessonState> {
    const state = await recoverEngineState(lessonId, sectionId)

    if (!validateRecoveredState(state)) {
      console.warn(`[engine:recover] invalid state — re-initialising lessonId=${lessonId}`)
      return this.init(lessonId, sectionId)
    }

    // Refresh TTL on successful recovery and rebuild canonical cursor
    await this.saveWithCanonicalCursor(lessonId, state, 'session_recovered')
    console.log(`[engine:recover] ok lessonId=${lessonId} exercise=${state.currentExerciseIndex} version=${state.cursorVersion ?? 0}`)
    return state
  }

  // ── Internal helpers ────────────────────────────────────────────────────────

  private bumpVersion(state: EngineLessonState): EngineLessonState {
    return { ...state, cursorVersion: (state.cursorVersion ?? 0) + 1 }
  }

  private async saveWithCanonicalCursor(
    lessonId: string,
    state: EngineLessonState,
    reason: string,
  ): Promise<void> {
    await saveEngineState(lessonId, state)
    if (state.currentExerciseState && state.currentExerciseState.status === 'active') {
      const canonical = buildCanonicalCursor(state.currentExerciseState, state)
      logCanonicalCursor(canonical, reason)
      saveCanonicalCursor(lessonId, canonical).catch(() => { /* fail-soft */ })
    }
  }

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

    finalState = this.mountNextExercise(this.bumpVersion(finalState), nextExState, nextSpec)
    await this.saveWithCanonicalCursor(state.lessonId, finalState, 'auto_skip')

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
