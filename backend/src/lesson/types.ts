// ── Visible Payload — exercise content rendered on student's screen ───────────

export interface TextBlock {
  id: string
  title?: string
  speaker?: string
  text: string
}

export interface PromptCard {
  id: string
  prompt: string
  helperText?: string
}

export interface Statement {
  id: string
  text: string
}

export interface VisibleContext {
  hasReadingText: boolean
  hasTextBlocks: boolean
  hasOptions: boolean
  hasWordBox: boolean
  hasPromptCards: boolean
  hasStatements: boolean
}

// ── Slide / Teaching Cards ────────────────────────────────────────────────────

export interface SlideBlock {
  label:    string
  form?:    string
  example?: string
}

export interface SlideSpec {
  bookId:         string
  sectionId:      string
  slideType:      'grammar_overview' | 'mini_explanation' | 'audio_task'
  title:          string
  blocks:         SlideBlock[]
  commonMistake?: string
  tryThis?:       string
  createdAt:      string
}

export type LessonPhase =
  | 'DIAGNOSTIC'
  | 'CONTEXT_INPUT'
  | 'RULE_DISCOVERY'
  | 'EXERCISES'
  | 'VOCABULARY'
  | 'DEEP_THINKING'
  | 'WRAP_UP'
  | 'END'

export type CorrectionTurn = 'A' | 'B' | 'C' | 'D'

export type LessonMode = 'free' | 'focus'

export interface LessonState {
  lessonId:    string
  studentId:   string
  phase:       LessonPhase
  mode:        LessonMode    // 'free' = user-driven, 'focus' = strict textbook
  focusUnit?:   number        // only set when mode === 'focus'
  focusLesson?: string        // sub-unit section, e.g. "1.2", "3.4"
  grammarTarget: string
  lessonTopic:   string
  textbookUnit:  string
  teacherId?:   string        // 'alex' | 'emma' — persisted for resume
  voiceId?:    string        // 'onyx' | 'echo' | 'nova' | 'shimmer' — persisted for resume
  activeExerciseType?: string  // Phase 11: persisted so resume sends correct type instead of 'unknown'

  // exchange counters
  exchangeCount:      number
  exerciseCount:      number
  consecutiveCorrect: number
  consecutiveErrors:  number
  currentDifficulty:  number
  deepThinkingExchanges: number

  // exercise sequencing (Focus mode: tracks which textbook exercise we're on)
  currentExerciseNum: number      // 1-based; 0 = not started yet
  completedExercises: number[]    // exercise numbers already given to student

  // Phase 3: item-level exercise cursor (persisted in Redis, survives reconnect)
  itemIndex:      number          // 0-based index of current item within currentExerciseNum
  currentItem:    string          // exact text of the current item being asked
  completedItems: number[]        // item indices completed in current exercise
  failedItems:    number[]        // item indices where student made errors
  wordBoxState:   WordBoxState | null  // word-box tracking for vocabulary exercises

  // Phase 2: explicit correction tracking per item
  itemRetryCount: number          // wrong attempts on current item; 0 = first try
  correctionTurn: CorrectionTurn | null  // ladder stage; null = not in correction

  // Phase 2: full exercise content cached for orchestrator-owned cursor rebuilds
  exerciseItems?:       string[]  // all items of current exercise
  exerciseInstruction?: string    // exercise instruction text
  exerciseOptions?:     string[]  // word bank for matching/vocabulary

  // Phase 2.6: authoritative server-assigned exercise ID + correct answer for current item
  currentExerciseId?:     string | null  // populated after saveExercise(); cleared on lesson end
  currentCorrectAnswer?:  string         // correct_answer for the current item; '' when unknown

  // Phase G.1: manifest-authoritative correct answers for all items in current exercise.
  // Populated from section manifest when a deterministic_sequential exercise starts.
  // Survives correction turns so recordCorrectAnswer() can set the next item's correct answer
  // without needing a runtime manifest lookup.
  exerciseCorrectAnswers?: string[]

  // content tracking
  vocabularyTaught: string[]
  errorsThisLesson: ErrorRecord[]

  // phase-transition flags (set by Claude in Phase 3)
  studentConfirmedReading: boolean
  ruleStatedCorrectly:     boolean
  summaryDelivered:        boolean
  overviewShown:           boolean  // CONTEXT_INPUT: grammar card shown once, never repeat

  startedAt:     string // ISO
  phaseStartedAt: string // ISO
}

// Word-box tracking: words available to student + words already used
export interface WordBoxState {
  available: string[]
  used:      string[]
}

// Exact cursor position within the textbook — broadcast to frontend as exercise_cursor_updated
export interface ExerciseCursor {
  unit?:          number
  section?:       string
  exerciseNumber: number
  exerciseType:   string
  instruction:    string
  currentItem:    string
  itemIndex:      number
  itemTotal:      number
  completedItems: number[]
  failedItems:    number[]
  wordBoxState?:  WordBoxState | null
  items?:         string[]   // all items in this exercise for full-context display
  options?:       string[]   // answer word bank (matching/vocabulary) — visible to student
  // Phase 2.6: authoritative server-assigned exercise ID — frontend pendingId must follow this
  exerciseId?:    string | null

  // Visible payload — content that must be displayed on the student's screen
  readingText?:   string          // full reading passage (for reading comprehension exercises)
  textBlocks?:    TextBlock[]     // structured article/comment blocks
  promptCards?:   PromptCard[]    // discussion/speaking task cards
  statements?:    Statement[]     // agree/disagree or opinion statements
  visibleContext?: VisibleContext  // summary of what is visible (used by Teacher Brain guard)
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
  type:         string   // canonical type from exercise-protocols; string to accommodate all policy types
  question:     string   // CURRENT ITEM ONLY — the single item being asked right now
  correct_answer: string
  hint:         string
  difficulty:   number
  exerciseNumber?: number  // textbook exercise number (1, 2, 3…)
  instruction?:    string  // what the student must do, e.g. "Complete each sentence with the correct form"
  skillFocus?:     string  // grammar/skill being practiced
  items?:          string[] // ALL items of this exercise for card display (["1. text", "2. text", …])
  options?:        string[] // answer word bank for matching/vocabulary exercises (visible to student)
}

export interface OrchestratorResult {
  text:           string
  displayText:    string        // formatted display_text from AI (may contain card markdown)
  phase:          LessonPhase
  phaseChanged:   boolean
  previousPhase:  LessonPhase
  exercise:       ExerciseData | null
  ended:          boolean
  exerciseCursor: ExerciseCursor | null  // Phase 3: item-level cursor broadcast
  // Phase 6: real lesson stats — populated only when ended=true
  exerciseScore:   number       // state.exerciseCount (correct answers)
  vocabularyCount: number       // state.vocabularyTaught.length
}
