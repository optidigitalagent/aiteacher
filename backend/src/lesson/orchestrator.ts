import redis, { LESSON_TTL, lessonStateKey } from '../db/redis.js'
import { query } from '../db/postgres.js'
import {
  type LessonPhase,
  type LessonState,
  type AIResponse,
  type OrchestratorResult,
  type ExerciseCursor,
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
    `Excellent lesson! You practised ${s.grammarTarget} and worked through real exercises. For homework: open your textbook, unit ${s.textbookUnit}, exercises 3 and 4. See you next lesson!`,
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

export type AIHandlerFn = (state: LessonState, input: string) => Promise<AIResponse>

let aiHandler: AIHandlerFn = async (state) => stubResponse(state)

export function registerAIHandler(fn: AIHandlerFn): void {
  aiHandler = fn
}

// ── Orchestrator ──────────────────────────────────────────────────────────────

export class LessonOrchestrator {
  async process(lessonId: string, inputText: string): Promise<OrchestratorResult> {
    const state = await this.loadState(lessonId)
    const previousPhase = state.phase

    const inputPreview = inputText.length > 80 ? inputText.slice(0, 80) + '…' : inputText
    console.log(`[orch] section=${state.focusLesson ?? 'free'} phase=${state.phase} exercise=${state.currentExerciseNum} exchanges=${state.exchangeCount} input="${inputPreview}"`)

    // Log student input
    await this.logEvent(lessonId, 'student_utterance', { text: inputText })

    // Update exchange counters
    state.exchangeCount++
    if (state.phase === 'DEEP_THINKING') state.deepThinkingExchanges++

    // Get AI response (stub or Claude)
    const aiResp = await aiHandler(state, inputText)

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
        // Reset item-level cursor for new exercise
        state.itemIndex      = 0
        state.currentItem    = aiResp.exercise.question
        state.completedItems = []
        state.failedItems    = []
        console.log(`[orch] exercise advanced to #${state.currentExerciseNum}, completed=[${state.completedExercises.join(',')}]`)
      } else if (!newNum && state.currentExerciseNum === 0) {
        // Free mode or AI omitted exerciseNumber — start at 1
        state.currentExerciseNum = 1
        state.itemIndex          = 0
        state.currentItem        = aiResp.exercise.question
        state.completedItems     = []
        state.failedItems        = []
      } else {
        // Same exercise — check if this is a new item or retry
        const incomingItem = aiResp.exercise.question ?? ''
        if (incomingItem && incomingItem !== state.currentItem && state.currentItem) {
          // Different question text within same exercise → student moved to next item
          if (!state.completedItems.includes(state.itemIndex)) {
            state.completedItems = [...state.completedItems, state.itemIndex]
          }
          state.itemIndex   = state.completedItems.length
          state.currentItem = incomingItem
          console.log(`[orch] item advanced to #${state.itemIndex} within exercise #${state.currentExerciseNum}`)
        } else if (incomingItem && !state.currentItem) {
          // First item of this exercise
          state.currentItem = incomingItem
        }
      }

      // Build cursor for this exercise response
      const itemTotal = aiResp.exercise.items?.length ?? 0
      exerciseCursor = {
        unit:          state.focusUnit,
        section:       state.focusLesson,
        exerciseNumber: state.currentExerciseNum,
        exerciseType:   aiResp.exercise.type,
        instruction:    aiResp.exercise.instruction ?? '',
        currentItem:    state.currentItem,
        itemIndex:      state.itemIndex,
        itemTotal,
        completedItems: state.completedItems,
        failedItems:    state.failedItems,
        wordBoxState:   state.wordBoxState,
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
    }
  }

  // Called after student answers an exercise
  async recordExerciseResult(lessonId: string, correct: boolean): Promise<void> {
    const state = await this.loadState(lessonId)

    if (correct) {
      state.exerciseCount++
      state.consecutiveCorrect++
      state.consecutiveErrors = 0
    } else {
      state.consecutiveErrors++
      state.consecutiveCorrect = 0
      // Track failed item index so AI can give extra attention to it
      if (!state.failedItems.includes(state.itemIndex)) {
        state.failedItems = [...state.failedItems, state.itemIndex]
      }
    }

    // Difficulty adaptation (from exercise-engine.md)
    if (state.consecutiveErrors >= 2) {
      state.currentDifficulty = Math.max(0.1, state.currentDifficulty - 0.2)
    } else if (state.consecutiveCorrect >= 3) {
      state.currentDifficulty = Math.min(1.0, state.currentDifficulty + 0.15)
    }

    await this.saveState(lessonId, state)
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
