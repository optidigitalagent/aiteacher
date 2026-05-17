// ── Exercise Engine — Core Types ──────────────────────────────────────────────
// The engine is the single source of truth for exercise state.
// GPT/Claude never controls progression — it only receives getPromptContext().

import type { ExerciseCursor } from '../lesson/types.js'

export type ExerciseType =
  | 'sentence_transformation'
  | 'fill_in_the_gap'
  | 'translation'
  | 'reading_comprehension'
  | 'paragraph_reading'
  | 'dialogue_practice'
  | 'multiple_choice'
  | 'matching'
  | 'pronunciation_practice'
  | 'audio_based'
  | 'discussion'
  | 'grammar_drill'
  | 'grammar_focus_fill'
  | 'personal_fill'
  | 'pair_speaking'
  | 'listening_matching'
  | 'listening_gap'
  | 'unknown'

export type ValidationMode =
  | 'exact'           // normalized exact string match
  | 'prefix_match'    // correct answer is prefix of student's (conjugation drills)
  | 'contains'        // student answer contains the correct answer
  | 'soft_ai'         // AI semantic evaluation for open-ended answers
  | 'any_response'    // any non-empty answer advances (discussion / pair_speaking)
  | 'not_applicable'  // cannot be validated — auto-skip

export type ProgressionCondition =
  | 'after_correct_answer'   // must answer correctly to advance
  | 'after_any_response'     // any answer advances (soft_speaking exercises)
  | 'after_single_response'  // advances after ONE response regardless of quality
  | 'auto_skip'              // skipped immediately without student interaction

export type StepDifficulty = 'easy' | 'medium' | 'hard'

export interface ValidationRule {
  mode: ValidationMode
  caseSensitive?: boolean
  stripPunctuation?: boolean
  allowedVariants?: string[]   // e.g. ["don't", "do not"] accepted for the same item
  scoreThreshold?: number      // soft_ai: minimum score to treat as correct (default 0.5)
  maxRetries?: number          // max wrong attempts before auto-reveal (default 3)
}

// ── Step ─────────────────────────────────────────────────────────────────────

export interface StepSpec {
  stepId: string               // "{exerciseId}_step_{index}"
  stepIndex: number            // 0-based position within the exercise
  question: string             // exact text shown/spoken to the student
  expectedAnswer: string       // authoritative correct answer ('' for open-ended)
  validationRule: ValidationRule
  hints: string[]              // progressive hints, used in order
  explanation: string          // shown after correct answer or after maxRetries
  progressionCondition: ProgressionCondition
  difficulty: StepDifficulty
}

// ── Exercise ──────────────────────────────────────────────────────────────────

export interface ExerciseMeta {
  lessonSection: string
  exerciseNumber: number
  unit: number
  difficulty: number           // 0.0–1.0
  skillFocus: string
  runtimeMode: 'deterministic_sequential' | 'soft_speaking' | 'unsupported'
  completionBehavior: 'single_response' | 'all_items' | 'skip'
  dependsOn?: number           // must not start until exercise N is completed
}

export interface ExerciseSpec {
  exerciseId: string           // server-assigned UUID
  exerciseType: ExerciseType
  instruction: string
  title: string
  description: string
  meta: ExerciseMeta
  steps: StepSpec[]
  options?: string[]           // word bank for matching / multiple_choice
  audioRef?: string            // future: reference to audio file
  lessonReference: string      // e.g. "Focus B1 Unit 1.2 Ex 3"
}

// ── Runtime state per exercise ────────────────────────────────────────────────

export interface StepAttempt {
  stepId: string
  stepIndex: number
  studentAnswer: string
  correct: boolean
  score: number
  attemptNumber: number        // 1-based
  hintsUsed: number
  timestamp: string
}

export type ExerciseStatus = 'pending' | 'active' | 'completed' | 'skipped' | 'abandoned'

export interface EngineExerciseState {
  exerciseId: string
  spec: ExerciseSpec
  currentStepIndex: number
  completedSteps: number[]     // step indices answered correctly
  failedSteps: number[]        // step indices with at least one wrong attempt
  stepAttempts: StepAttempt[]
  retryCount: number           // wrong attempts on current step
  hintsGiven: number           // total hints given in this exercise
  status: ExerciseStatus
  startedAt: string            // ISO
  completedAt?: string         // ISO
}

// ── Lesson-level engine state (persisted in Redis) ────────────────────────────

export interface EngineLessonState {
  lessonId: string
  sectionId: string
  exerciseQueue: ExerciseSpec[]       // ordered, backend-authoritative
  currentExerciseIndex: number        // index into exerciseQueue
  currentExerciseState?: EngineExerciseState
  completedExerciseIds: string[]
  skippedExerciseIds: string[]
  sessionStartedAt: string
  lastActivityAt: string
  engineVersion: number               // bump when schema changes; 1 = this version
}

// ── Validation ────────────────────────────────────────────────────────────────

export interface EngineValidationResult {
  correct: boolean
  score: number                // 0.0–1.0
  feedback: string             // teacher-style; never says "Wrong"
  hintsRemaining: number
  shouldRevealAnswer: boolean  // true when maxRetries exceeded
  correctAnswer: string        // for reveal
}

// ── Answer submission ─────────────────────────────────────────────────────────

export interface AnswerSubmission {
  lessonId: string
  studentAnswer: string
}

// ── Engine result returned to WS layer ───────────────────────────────────────

export type EngineAction =
  | 'step_correct'        // student answered correctly; advance
  | 'step_wrong'          // student answered incorrectly; retry
  | 'step_revealed'       // max retries hit; answer revealed; advance
  | 'exercise_complete'   // all steps done; next exercise loads
  | 'exercise_skipped'    // unsupported exercise; auto-skipped
  | 'lesson_complete'     // all exercises in queue done
  | 'soft_pass'           // open-ended answer accepted; advance
  | 'no_change'           // nothing to do (no active exercise)

export interface EngineResult {
  action: EngineAction
  validation: EngineValidationResult | null
  exerciseCursor: ExerciseCursor | null  // for frontend broadcast
  promptContext: string                  // injected into AI system prompt
  nextExerciseSpec?: ExerciseSpec        // set when action = exercise_complete
}

// ── Transition rules ──────────────────────────────────────────────────────────

export interface TransitionContext {
  currentExercise: EngineExerciseState
  queue: ExerciseSpec[]
  currentIndex: number
  completedExerciseNumbers: number[]
}
