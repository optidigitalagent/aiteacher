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
import {
  isExerciseAllowedInCurrentRuntime,
  getExercisePolicy,
  validateSnapshotShape,
} from '../exercises/protocols/index.js'
import { selectProtocol } from '../exercises/runtime/index.js'

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
    const rawAiTarget = applyAISignal(state, aiResp.next_action)
    const ruleTarget  = shouldTransition(state)

    // Locked-exercise phase guard: if a hard-lock item is unresolved, AI cannot drive a phase exit
    let aiTarget = rawAiTarget
    if (
      rawAiTarget !== null &&
      state.phase === 'EXERCISES' &&
      state.currentExerciseNum > 0 &&
      state.currentItem &&
      state.activeExerciseType &&
      selectProtocol(state.activeExerciseType).shouldLockCurrentItem()
    ) {
      console.log(`[phase_guard] blocked transition_to=${rawAiTarget} reason=active_locked_exercise type=${state.activeExerciseType}`)
      aiTarget = null
    }

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

    // parseExercise() in claude-handler intentionally skips snapshot validation so that
    // subsequent items (same exerciseNumber) can reach the orchestrator even when the AI
    // omits items/options that are already rendered on screen. We enrich from cached state
    // before running snapshot validation here — the authoritative gate for new exercises.
    const incomingExercise = aiResp.exercise

    // Enrich subsequent items in the same exercise with cached state data.
    // AI may omit items/options for item N+1 (they are already visible to the student).
    // Without enrichment the snapshot validation below would block the exercise, leaving
    // state.currentExerciseId pointing at the previous item and causing stale-UUID
    // validation failures when the student submits the next answer.
    if (incomingExercise && state.currentExerciseNum > 0) {
      const sameExercise = !incomingExercise.exerciseNumber
        || incomingExercise.exerciseNumber === state.currentExerciseNum
      if (sameExercise) {
        if (!incomingExercise.items?.length && state.exerciseItems?.length) {
          incomingExercise.items = state.exerciseItems
        }
        if (!incomingExercise.options?.length && state.exerciseOptions?.length) {
          incomingExercise.options = state.exerciseOptions
        }
        if (!incomingExercise.instruction && state.exerciseInstruction) {
          incomingExercise.instruction = state.exerciseInstruction
        }
      }
    }

    const exerciseTypeAllowed = incomingExercise
      ? isExerciseAllowedInCurrentRuntime(incomingExercise.type)
      : false

    const snapValidation = (incomingExercise && exerciseTypeAllowed)
      ? validateSnapshotShape(incomingExercise.type, incomingExercise as unknown as Record<string, unknown>)
      : { ok: false as const, reason: 'no exercise or type blocked' }

    const exerciseBlocked = Boolean(incomingExercise && (!exerciseTypeAllowed || !snapValidation.ok))

    if (exerciseBlocked && incomingExercise) {
      const policy = getExercisePolicy(incomingExercise.type)
      if (!exerciseTypeAllowed) {
        console.warn(`[exercise:policy] type="${incomingExercise.type}" allowed=false downgrade="${policy.downgradeStrategy}" lessonId=${lessonId}`)
        console.log(`[exercise:downgrade] type="${incomingExercise.type}" strategy="${policy.downgradeStrategy}" reason="orchestrator defense-in-depth: type not allowed"`)
      } else {
        console.warn(
          `[exercise:snapshot] type="${incomingExercise.type}" ok=false reason="${snapValidation.reason}" lessonId=${lessonId}` +
          ` items=${incomingExercise.items?.length ?? 0} options=${incomingExercise.options?.length ?? 0}`,
        )
        console.log(`[exercise:downgrade] type="${incomingExercise.type}" strategy="preserve_cursor" reason="${snapValidation.reason ?? 'snapshot_invalid'}"`)
      }
      // Rebuild cursor from existing state so the frontend stays in sync
      if (state.currentExerciseNum > 0 && state.currentItem) {
        const itemTotal = state.exerciseItems?.length ?? 0
        exerciseCursor = {
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
          exerciseId:     state.currentExerciseId ?? null,
        }
      }
    } else if (incomingExercise) {
      const acceptedProtocol = selectProtocol(incomingExercise.type)
      console.log(`[orch] exercise_accepted type="${incomingExercise.type}" items=${incomingExercise.items?.length ?? 0} options=${incomingExercise.options?.length ?? 0}`)
      console.log(`[protocol] type=${incomingExercise.type} protocol=${acceptedProtocol.protocolName} lock=${acceptedProtocol.shouldLockCurrentItem()} soft=${acceptedProtocol.shouldUseSoftFeedback()}`)
      const newNum = incomingExercise.exerciseNumber
      if (newNum !== undefined && newNum > 0 && newNum !== state.currentExerciseNum) {
        // Moving to a new textbook exercise — mark previous as complete
        if (state.currentExerciseNum > 0 && !state.completedExercises.includes(state.currentExerciseNum)) {
          state.completedExercises = [...state.completedExercises, state.currentExerciseNum]
        }
        state.currentExerciseNum = newNum
        // Reset item-level cursor and correction state for new exercise
        state.itemIndex       = 0
        state.currentItem     = incomingExercise.question
        state.completedItems  = []
        state.failedItems     = []
        state.itemRetryCount  = 0
        state.correctionTurn  = null
        // Phase 2.6: populate correct answer for current item
        state.currentCorrectAnswer = incomingExercise.correct_answer ?? ''
        // Cache full exercise content for orchestrator-owned cursor rebuilds
        if (incomingExercise.items?.length)    state.exerciseItems       = incomingExercise.items
        if (incomingExercise.instruction)      state.exerciseInstruction = incomingExercise.instruction
        if (incomingExercise.options?.length)  state.exerciseOptions     = incomingExercise.options
        console.log(`[orch] exercise advanced to #${state.currentExerciseNum}, completed=[${state.completedExercises.join(',')}]`)
      } else if (!newNum && state.currentExerciseNum === 0) {
        // Free mode or AI omitted exerciseNumber — start at 1
        state.currentExerciseNum    = 1
        state.itemIndex             = 0
        state.currentItem           = incomingExercise.question
        state.completedItems        = []
        state.failedItems           = []
        state.itemRetryCount        = 0
        state.correctionTurn        = null
        state.currentCorrectAnswer  = incomingExercise.correct_answer ?? ''
        if (incomingExercise.items?.length)   state.exerciseItems       = incomingExercise.items
        if (incomingExercise.instruction)     state.exerciseInstruction = incomingExercise.instruction
        if (incomingExercise.options?.length) state.exerciseOptions     = incomingExercise.options
      } else {
        // Same exercise — check if AI is signaling a new item or returning from correction
        const incomingItem = incomingExercise.question ?? ''

        // Guard: never regress to an already-completed item
        // Normalise both sides (strip "N."/"N)" prefix, lowercase) so "clever" matches "1. clever"
        const stripItemPrefix = (s: string) => s.replace(/^\d+[.)]\s*/, '').trim().toLowerCase()
        const normIncoming    = stripItemPrefix(incomingItem)
        const isRegression    = normIncoming !== '' && (state.exerciseItems ?? [])
          .some((item, i) => state.completedItems.includes(i) && stripItemPrefix(item) === normIncoming)

        // For locked protocol types (matching, deterministic), item cursor is authoritative
        // from recordCorrectAnswer() only. AI item text must not override that position —
        // the AI may return a slightly different string (e.g. "Number 2: serious" vs "2. serious")
        // which would otherwise trigger a spurious double-advancement.
        const isLocked = state.activeExerciseType
          ? selectProtocol(state.activeExerciseType).shouldLockCurrentItem()
          : false

        if (!isLocked && incomingItem && incomingItem !== state.currentItem && state.currentItem && !isRegression) {
          // AI signaled a different item — treat as advancement and reset correction
          if (!state.completedItems.includes(state.itemIndex)) {
            state.completedItems = [...state.completedItems, state.itemIndex]
          }
          state.itemIndex             = state.completedItems.length
          state.currentItem           = incomingItem
          state.itemRetryCount        = 0
          state.correctionTurn        = null
          state.currentCorrectAnswer  = incomingExercise.correct_answer ?? ''
          console.log(`[orch] item advanced to #${state.itemIndex} within exercise #${state.currentExerciseNum}`)
        } else if (incomingItem && !state.currentItem) {
          // For locked types: prefer the authoritative items array over whatever the AI returned
          // (AI may re-send a completed item text when currentItem was cleared by recordCorrectAnswer)
          if (isLocked && state.exerciseItems?.length && (state.itemIndex ?? 0) < state.exerciseItems.length) {
            state.currentItem = state.exerciseItems[state.itemIndex ?? 0]
          } else {
            state.currentItem = incomingItem
          }
          state.currentCorrectAnswer = incomingExercise.correct_answer ?? ''
        } else if (incomingExercise.correct_answer) {
          // Same item, same exercise — refresh correct answer in case AI updated it
          state.currentCorrectAnswer = incomingExercise.correct_answer
        }
        // Refresh instruction/options if AI provided updates
        if (incomingExercise.instruction)     state.exerciseInstruction = incomingExercise.instruction
        if (incomingExercise.options?.length) state.exerciseOptions     = incomingExercise.options
      }

      // Persist exercise type so resume can restore the correct cursor type (Phase 11)
      state.activeExerciseType = incomingExercise.type
    }
    // If AI returns no exercise on a correction turn, do NOT clear existing cursor state.
    // The exercise is still active — just waiting for the student's next attempt.

    // ── Completed-item regression guard ──────────────────────────────────────
    // Repair cursor if AI processing regressed itemIndex to a completed slot.
    // Runs unconditionally so it also catches races on correction turns and
    // cases where the AI changes exerciseNumber mid-exercise, resetting state.
    if (
      state.phase === 'EXERCISES' &&
      state.currentExerciseNum > 0 &&
      state.completedItems.length > 0 &&
      state.completedItems.includes(state.itemIndex ?? 0) &&
      state.exerciseItems?.length
    ) {
      let next = state.itemIndex ?? 0
      while (state.completedItems.includes(next) && next < state.exerciseItems.length) {
        next++
      }
      const corrected = next < state.exerciseItems.length ? state.exerciseItems[next] : ''
      console.log(
        `[orch] regression_corrected itemIndex=${state.itemIndex}→${next} ` +
        `completedItems=[${state.completedItems.join(',')}] exercise=#${state.currentExerciseNum}`,
      )
      state.itemIndex   = next
      state.currentItem = corrected
    }

    // ── Item continuity enforcement for locked exercises ──────────────────────
    // When a locked exercise has an unresolved item and this turn was NOT a
    // structured exercise-answer turn (correct/wrong via handleExerciseAnswer),
    // append a backend-authoritative re-anchor to the AI speech so the student
    // always knows which item to answer next — even if the AI drifted after an
    // explanation or side question.
    //
    // Skipped when:
    //   • wasExerciseAnswerTurn — correct/wrong answer turns already carry their
    //     own anchors (continuationContract / retryAnchor in buildCorrectionContext)
    //   • confirmsCorrect — AI opened with a confirmation word → likely a correct-
    //     answer voice turn; do not double-state the item
    //   • itemInTail — the current item text already appears at the end of the AI
    //     response, so the AI anchored correctly without our help
    const wasExerciseAnswerTurn = inputText.includes('[EXERCISE RESULT]')
    if (
      !wasExerciseAnswerTurn &&
      state.phase === 'EXERCISES' &&
      state.currentExerciseNum > 0 &&
      state.currentItem &&
      state.activeExerciseType &&
      selectProtocol(state.activeExerciseType).shouldLockCurrentItem()
    ) {
      // Defense-in-depth: if itemIndex still points to a completed item (e.g. exerciseItems
      // was not available for the regression guard above), find the first non-completed item.
      let anchorIndex = state.itemIndex ?? 0
      let anchorItem  = state.currentItem
      if (state.completedItems.includes(anchorIndex) && state.exerciseItems?.length) {
        for (let i = 0; i < state.exerciseItems.length; i++) {
          if (!state.completedItems.includes(i)) {
            anchorIndex = i
            anchorItem  = state.exerciseItems[i]
            break
          }
        }
      }
      // Skip re-anchor when every item is already completed (exercise is finishing)
      const allItemsDone = state.exerciseItems?.length
        ? state.exerciseItems.every((_, i) => state.completedItems.includes(i))
        : state.completedItems.includes(anchorIndex)
      const itemNum   = anchorIndex + 1
      // Strip "N." / "N)" prefix to avoid "Number 3: 3. interesting" redundancy
      const itemLabel = anchorItem.replace(/^\d+[.)]\s*/, '').trim() || anchorItem
      const reAnchor  = `Now let's continue. Number ${itemNum}: ${itemLabel}`
      const confirmsCorrect = /^(correct|right|exactly|yes|good|perfect|well done|not bad)/i
        .test(aiResp.speech.trim())
      const tail      = aiResp.speech.slice(-100).toLowerCase()
      const checkLen  = Math.min(itemLabel.length, 8)
      const itemInTail = checkLen >= 4 && tail.includes(itemLabel.slice(0, checkLen).toLowerCase())
      // Skip re-anchor when AI speech already references a later item
      // (AI advanced correctly on its own — appending old anchor would confuse student)
      const mentionsLaterItem = (() => {
        const sl = aiResp.speech.toLowerCase()
        const maxN = state.exerciseItems?.length ?? 20
        for (let n = anchorIndex + 2; n <= maxN; n++) {
          if (sl.includes(`number ${n}`)) return true
        }
        return false
      })()
      if (!allItemsDone && !confirmsCorrect && !itemInTail && !mentionsLaterItem) {
        aiResp.speech += `\n\n${reAnchor}`
        console.log(
          `[continuity] re_anchor_appended exercise=#${state.currentExerciseNum} ` +
          `item=${itemNum} type=${state.activeExerciseType}`,
        )
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
    // Skip save when exercise is blocked (unsupported type or invalid snapshot)
    const exercise = (incomingExercise && !exerciseBlocked)
      ? await saveExercise(lessonId, incomingExercise)
      : null

    // Phase 2.6: build cursor AFTER saveExercise so exerciseId is the authoritative server UUID.
    // Also persist currentExerciseId in state for resume and recordCorrectAnswer().
    if (exercise) {
      state.currentExerciseId = exercise.id
      const itemTotal = state.exerciseItems?.length ?? incomingExercise?.items?.length ?? 0
      exerciseCursor = {
        unit:           state.focusUnit,
        section:        state.focusLesson,
        exerciseNumber: state.currentExerciseNum,
        exerciseType:   exercise.type,
        instruction:    state.exerciseInstruction ?? incomingExercise?.instruction ?? '',
        currentItem:    state.currentItem,
        itemIndex:      state.itemIndex,
        itemTotal,
        completedItems: state.completedItems,
        failedItems:    state.failedItems,
        wordBoxState:   state.wordBoxState,
        items:          state.exerciseItems ?? incomingExercise?.items,
        options:        state.exerciseOptions ?? incomingExercise?.options,
        exerciseId:     exercise.id,
      }
      // Persist updated exerciseId (second save — intentional; keeps cursor authoritative)
      await this.saveState(lessonId, state)
    }

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
    // Phase 2.6: next item's correct answer is unknown until AI responds
    state.currentCorrectAnswer = ''

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
      // Phase 2.6: keep exerciseId stable until a new exercise loads
      exerciseId:     state.currentExerciseId ?? null,
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
    // Normalize Phase 2.6 fields for old snapshots
    state.currentExerciseId    ??= null
    state.currentCorrectAnswer ??= ''
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
