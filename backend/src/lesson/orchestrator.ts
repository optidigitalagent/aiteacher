import redis, { LESSON_TTL, lessonStateKey } from '../db/redis.js'
import { query } from '../db/postgres.js'
import {
  type LessonPhase,
  type LessonState,
  type AIResponse,
  type OrchestratorResult,
  type ExerciseCursor,
  type ErrorRecord,
  type CorrectionTurn,
} from './types.js'
import { shouldTransition, applyAISignal } from './transitions.js'
import { saveExercise } from '../exercises/exercise-store.js'

// ── Stub responses per phase (replaced by Claude in Phase 3) ─────────────────

const PHASE_INTRO: Record<LessonPhase, (s: LessonState) => string> = {
  DIAGNOSTIC: (s) =>
    `Let's start! Tell me one thing you already know about ${s.grammarTarget}. Give me a simple example sentence.`,
  CONTEXT_INPUT: (s) =>
    `Great start! Now listen to this short text about ${s.lessonTopic}: "In 1953, Edmund Hillary and Tenzing Norgay climbed Everest. They left camp at 4 AM, reached the summit, took photos, and returned safely." What actions did Hillary perform?`,
  RULE_DISCOVERY: (_) =>
    `Good. Look at these verbs: 'climbed', 'reached', 'returned'. What do they all have at the end? What does that tell you about how Past Simple is formed?`,
  EXERCISES: (s) =>
    `Let's practice ${s.grammarTarget}! Exercise ${s.exerciseCount + 1}: Fill in the verb. "In 1953, Hillary _____ (reach) the summit." What's the correct form?`,
  VOCABULARY: (_) =>
    `Great work! Let's learn some key words. Word 1: 'summit' — the highest point of a mountain. Can also be a verb: 'to summit Everest'. Can you use 'summit' in your own sentence?`,
  DEEP_THINKING: (_) =>
    `Almost done! Hillary said: "It is not the mountain we conquer, but ourselves." Do you agree? Answer in 2–3 sentences, using past tense at least once.`,
  WRAP_UP: (s) =>
    `Excellent lesson! You practised ${s.grammarTarget} and worked through real exercises. For homework: review the vocabulary we covered today and try to use it in conversation. See you next lesson!`,
  END: (_) =>
    `Lesson complete. Well done!`,
}

function stubResponse(state: LessonState): AIResponse {
  const text = PHASE_INTRO[state.phase](state)
  return {
    speech:        text,
    display_text:  text,
    next_action:   'continue_phase',
    exercise:      null,
    internal_note: `[stub] phase=${state.phase} exchanges=${state.exchangeCount}`,
  }
}

// ── AI handler plugin (Phase 3 replaces this with Claude) ────────────────────

// Phase 4: call-site context forwarded from the WS layer to the AI handler
export interface OrchestratorCallContext {
  remainingMs?: number  // remaining lesson milliseconds for time-aware prompting
}

// Phase 5: error detail passed from WS layer to populate errorsThisLesson
export interface ExerciseErrorData {
  exercise:      string
  studentAnswer: string
  correctAnswer: string
  errorType:     ErrorRecord['errorType']
}

export type AIHandlerFn = (state: LessonState, input: string, ctx?: OrchestratorCallContext) => Promise<AIResponse>

let aiHandler: AIHandlerFn = async (state) => stubResponse(state)

function retryToTurn(retryCount: number): CorrectionTurn {
  if (retryCount <= 1) return 'A'
  if (retryCount === 2) return 'B'
  if (retryCount === 3) return 'C'
  return 'D'
}

export function registerAIHandler(fn: AIHandlerFn): void {
  aiHandler = fn
}

// ── Orchestrator ──────────────────────────────────────────────────────────────

export class LessonOrchestrator {
  async process(lessonId: string, inputText: string, callCtx?: OrchestratorCallContext): Promise<OrchestratorResult> {
    const state = await this.loadState(lessonId)
    const previousPhase = state.phase

    const inputPreview = inputText.length > 80 ? inputText.slice(0, 80) + '…' : inputText
    console.log(`[orch] section=${state.focusLesson ?? 'free'} phase=${state.phase} exercise=${state.currentExerciseNum} exchanges=${state.exchangeCount} input="${inputPreview}"`)

    // Log student input
    await this.logEvent(lessonId, 'student_utterance', { text: inputText })

    // Update exchange counters
    state.exchangeCount++
    if (state.phase === 'DEEP_THINKING') state.deepThinkingExchanges++

    // Get AI response (stub or Claude) — forward remaining-time context for time-aware prompting
    const aiResp = await aiHandler(state, inputText, callCtx)

    // Apply AI signal first (forward-only), then check rule-based transitions
    const aiTarget   = applyAISignal(state, aiResp.next_action)
    const ruleTarget = shouldTransition(state)
    const target: LessonPhase | null = aiTarget ?? ruleTarget

    let phaseChanged = false
    if (target && target !== state.phase) {
      state.phase          = target
      state.phaseStartedAt = new Date().toISOString()
      phaseChanged         = true
      await this.logEvent(lessonId, 'phase_change', { from: previousPhase, to: target })
      console.log(`[orch] phase transition: ${previousPhase} → ${target}`)
    }

    // Track which textbook exercise we're on.
    // currentExerciseNum = the exercise currently being worked on (0 = not started).
    // Only advance when the AI returns an exercise with a DIFFERENT exerciseNumber.
    // Items within the same exercise share the same exerciseNumber → no increment.
    let exerciseCursor: ExerciseCursor | null = null

    if (aiResp.exercise) {
      const newNum = aiResp.exercise.exerciseNumber
      if (newNum !== undefined && newNum > 0 && newNum !== state.currentExerciseNum) {
        // Moving to a new textbook exercise — mark previous as complete
        if (state.currentExerciseNum > 0 && !state.completedExercises.includes(state.currentExerciseNum)) {
          state.completedExercises = [...state.completedExercises, state.currentExerciseNum]
        }
        state.currentExerciseNum = newNum
        // Reset item-level cursor and correction state for new exercise
        state.itemIndex       = 0
        state.currentItem     = aiResp.exercise.question
        state.completedItems  = []
        state.failedItems     = []
        state.itemRetryCount  = 0
        state.correctionTurn  = null
        // Cache full exercise content for orchestrator-owned cursor rebuilds
        if (aiResp.exercise.items?.length)    state.exerciseItems       = aiResp.exercise.items
        if (aiResp.exercise.instruction)      state.exerciseInstruction = aiResp.exercise.instruction
        if (aiResp.exercise.options?.length)  state.exerciseOptions     = aiResp.exercise.options
        console.log(`[orch] exercise advanced to #${state.currentExerciseNum}, completed=[${state.completedExercises.join(',')}]`)
      } else if (!newNum && state.currentExerciseNum === 0) {
        // Free mode or AI omitted exerciseNumber — start at 1
        state.currentExerciseNum  = 1
        state.itemIndex           = 0
        state.currentItem         = aiResp.exercise.question
        state.completedItems      = []
        state.failedItems         = []
        state.itemRetryCount      = 0
        state.correctionTurn      = null
        if (aiResp.exercise.items?.length)   state.exerciseItems       = aiResp.exercise.items
        if (aiResp.exercise.instruction)     state.exerciseInstruction = aiResp.exercise.instruction
        if (aiResp.exercise.options?.length) state.exerciseOptions     = aiResp.exercise.options
      } else {
        // Same exercise — check if AI is signaling a new item or returning from correction
        const incomingItem = aiResp.exercise.question ?? ''

        // Guard: never regress to an already-completed item
        const completedTexts = (state.exerciseItems ?? [])
          .filter((_, i) => state.completedItems.includes(i))
        const isRegression = incomingItem && completedTexts.includes(incomingItem)

        if (incomingItem && incomingItem !== state.currentItem && state.currentItem && !isRegression) {
          // AI signaled a different item — treat as advancement and reset correction
          if (!state.completedItems.includes(state.itemIndex)) {
            state.completedItems = [...state.completedItems, state.itemIndex]
          }
          state.itemIndex      = state.completedItems.length
          state.currentItem    = incomingItem
          state.itemRetryCount = 0
          state.correctionTurn = null
          console.log(`[orch] item advanced to #${state.itemIndex} within exercise #${state.currentExerciseNum}`)
        } else if (incomingItem && !state.currentItem) {
          // First item assignment OR cleared slot after recordCorrectAnswer
          state.currentItem = incomingItem
        }
        // Refresh instruction/options if AI provided updates
        if (aiResp.exercise.instruction)     state.exerciseInstruction = aiResp.exercise.instruction
        if (aiResp.exercise.options?.length) state.exerciseOptions     = aiResp.exercise.options
      }

      // Persist exercise type so resume can restore the correct cursor type (Phase 11)
      state.activeExerciseType = aiResp.exercise.type

      // Build cursor using cached state values as primary, AI response as fallback
      const itemTotal = state.exerciseItems?.length ?? aiResp.exercise.items?.length ?? 0
      exerciseCursor = {
        unit:           state.focusUnit,
        section:        state.focusLesson,
        exerciseNumber: state.currentExerciseNum,
        exerciseType:   aiResp.exercise.type,
        instruction:    state.exerciseInstruction ?? aiResp.exercise.instruction ?? '',
        currentItem:    state.currentItem,
        itemIndex:      state.itemIndex,
        itemTotal,
        completedItems: state.completedItems,
        failedItems:    state.failedItems,
        wordBoxState:   state.wordBoxState,
        items:          state.exerciseItems ?? aiResp.exercise.items,
        options:        state.exerciseOptions ?? aiResp.exercise.options,
      }
    }

    await this.saveState(lessonId, state)
    await this.logEvent(lessonId, 'ai_response', { text: aiResp.speech, phase: state.phase })

    // Mark lesson complete in DB
    if (state.phase === 'END') {
      await query(
        `UPDATE lessons SET status = 'completed', ended_at = NOW(), phase_reached = $1 WHERE id = $2`,
        [previousPhase, lessonId],
      )
    }

    // Persist exercise (override AI's UUID with server UUID)
    const exercise = aiResp.exercise
      ? await saveExercise(lessonId, aiResp.exercise)
      : null

    return {
      text:           aiResp.speech,
      displayText:    aiResp.display_text ?? aiResp.speech,
      phase:          state.phase,
      phaseChanged,
      previousPhase,
      exercise,
      ended:          state.phase === 'END',
      exerciseCursor,
      // Phase 6: pass real lesson stats so lesson_end summary is accurate
      exerciseScore:   state.phase === 'END' ? state.exerciseCount           : 0,
      vocabularyCount: state.phase === 'END' ? state.vocabularyTaught.length : 0,
    }
  }

  // Called after student gives a CORRECT answer.
  // Advances item index, resets correction state, updates counters.
  // Returns the updated cursor for immediate broadcast to the frontend.
  async recordCorrectAnswer(lessonId: string): Promise<ExerciseCursor | null> {
    const state = await this.loadState(lessonId)

    state.exerciseCount++
    state.consecutiveCorrect++
    state.consecutiveErrors = 0
    if (state.consecutiveCorrect >= 3) {
      state.currentDifficulty = Math.min(1.0, state.currentDifficulty + 0.15)
    }

    // Mark current item complete and advance index
    if (!state.completedItems.includes(state.itemIndex)) {
      state.completedItems = [...state.completedItems, state.itemIndex]
    }
    state.itemIndex++

    // Resolve next item text from stored items array; clear if exercise is finished
    if (state.exerciseItems?.length && state.itemIndex < state.exerciseItems.length) {
      state.currentItem = state.exerciseItems[state.itemIndex]
    } else {
      state.currentItem = '' // exercise complete — AI will announce next exercise
    }

    // Reset correction state
    state.itemRetryCount = 0
    state.correctionTurn = null

    await this.saveState(lessonId, state)

    if (!state.currentExerciseNum) return null
    const itemTotal = state.exerciseItems?.length ?? 0
    return {
      unit:           state.focusUnit,
      section:        state.focusLesson,
      exerciseNumber: state.currentExerciseNum,
      exerciseType:   state.activeExerciseType ?? 'unknown',
      instruction:    state.exerciseInstruction ?? '',
      currentItem:    state.currentItem,
      itemIndex:      state.itemIndex,
      itemTotal,
      completedItems: state.completedItems,
      failedItems:    state.failedItems,
      wordBoxState:   state.wordBoxState,
      items:          state.exerciseItems,
      options:        state.exerciseOptions,
    }
  }

  // Called after student gives a WRONG answer.
  // Increments retry count, advances correction ladder, returns the turn letter.
  async recordWrongAnswer(lessonId: string, errorData?: ExerciseErrorData): Promise<CorrectionTurn> {
    const state = await this.loadState(lessonId)

    state.consecutiveErrors++
    state.consecutiveCorrect = 0
    if (state.consecutiveErrors >= 2) {
      state.currentDifficulty = Math.max(0.1, state.currentDifficulty - 0.2)
    }

    if (!state.failedItems.includes(state.itemIndex)) {
      state.failedItems = [...state.failedItems, state.itemIndex]
    }

    state.itemRetryCount = (state.itemRetryCount ?? 0) + 1
    const turn = retryToTurn(state.itemRetryCount)
    state.correctionTurn = turn

    if (errorData) {
      const record: ErrorRecord = {
        exercise:      errorData.exercise,
        studentAnswer: errorData.studentAnswer,
        correctAnswer: errorData.correctAnswer,
        errorType:     errorData.errorType,
        timestamp:     new Date().toISOString(),
      }
      state.errorsThisLesson = [...(state.errorsThisLesson ?? []), record].slice(-10)
    }

    await this.saveState(lessonId, state)
    return turn
  }

  private async loadState(lessonId: string): Promise<LessonState> {
    const raw = await redis.get(lessonStateKey(lessonId))
    if (!raw) throw new Error(`lesson state not found in Redis: ${lessonId}`)
    const state = JSON.parse(raw) as LessonState
    // Normalize Phase 3 cursor fields for states created before this phase
    state.itemIndex      ??= 0
    state.currentItem    ??= ''
    state.completedItems ??= []
    state.failedItems    ??= []
    state.wordBoxState   ??= null
    // Normalize Phase 2 correction tracking fields
    state.itemRetryCount ??= 0
    state.correctionTurn ??= null
    return state
  }

  private async saveState(lessonId: string, state: LessonState): Promise<void> {
    await redis.set(lessonStateKey(lessonId), JSON.stringify(state), 'EX', LESSON_TTL)
  }

  private async logEvent(lessonId: string, type: string, payload: unknown): Promise<void> {
    await query(
      `INSERT INTO lesson_events (lesson_id, event_type, payload) VALUES ($1, $2, $3)`,
      [lessonId, type, JSON.stringify(payload)],
    )
  }
}
