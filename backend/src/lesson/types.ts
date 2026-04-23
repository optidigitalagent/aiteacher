export type LessonPhase =
  | 'DIAGNOSTIC'
  | 'CONTEXT_INPUT'
  | 'RULE_DISCOVERY'
  | 'EXERCISES'
  | 'VOCABULARY'
  | 'DEEP_THINKING'
  | 'WRAP_UP'
  | 'END'

export type LessonMode = 'free' | 'focus'

export interface LessonState {
  lessonId:    string
  studentId:   string
  phase:       LessonPhase
  mode:        LessonMode    // 'free' = user-driven, 'focus' = strict textbook
  focusUnit?:  number        // only set when mode === 'focus'
  grammarTarget: string
  lessonTopic:   string
  textbookUnit:  string

  // exchange counters
  exchangeCount:      number
  exerciseCount:      number
  consecutiveCorrect: number
  consecutiveErrors:  number
  currentDifficulty:  number
  deepThinkingExchanges: number

  // content tracking
  vocabularyTaught: string[]
  errorsThisLesson: ErrorRecord[]

  // phase-transition flags (set by Claude in Phase 3)
  studentConfirmedReading: boolean
  ruleStatedCorrectly:     boolean
  summaryDelivered:        boolean

  startedAt:     string // ISO
  phaseStartedAt: string // ISO
}

export interface ErrorRecord {
  exercise:      string
  studentAnswer: string
  correctAnswer: string
  errorType: 'form' | 'irregular' | 'word_order' | 'vocabulary' | 'other'
  timestamp: string
}

// Claude's JSON response shape (Phase 3 will return this)
export interface AIResponse {
  speech:       string
  display_text: string
  // "continue_phase" | "transition_to:PHASE" | "end_lesson"
  // flags: "student_confirmed_reading" | "rule_stated_correctly" | "summary_delivered"
  next_action:  string
  exercise:     ExerciseData | null
  internal_note: string
}

export interface ExerciseData {
  id:           string
  type: 'form_transformation' | 'error_correction' | 'reconstruction' | 'free_production'
  question:     string
  correct_answer: string
  hint:         string
  difficulty:   number
}

export interface OrchestratorResult {
  text:          string
  phase:         LessonPhase
  phaseChanged:  boolean
  previousPhase: LessonPhase
  exercise:      ExerciseData | null
  ended:         boolean
}
