// ── Memory System — Core Types ─────────────────────────────────────────────────
// Backend-owned. AI Teacher reads summaries only — never writes raw memory.

export type LearningSpeed = 'slow' | 'normal' | 'fast'
export type ConfidenceTrend = 'declining' | 'stable' | 'improving'
export type CorrectionStyle = 'ladder' | 'direct' | 'gentle'
export type MemoryEventType = 'validation' | 'exercise_complete' | 'lesson_complete'

// ── Phase 3B: Adaptive Signal Types ──────────────────────────────────────────

export type MistakeCategory =
  | 'tense'
  | 'auxiliary_verb'
  | 'word_order'
  | 'subject_verb_agreement'
  | 'vocabulary_choice'
  | 'answer_shape'
  | 'too_short'
  | 'repeated_failure'
  | 'off_topic'
  | 'unknown'

export type HintDepthSignal = 'normal' | 'reduced' | 'increased'

export interface AdaptiveSignal {
  userId: string
  sessionId: string
  sectionId: string
  exerciseId: string
  exerciseType: string
  skillTag: string
  outcome: 'correct' | 'wrong' | 'revealed' | 'skipped'
  retryCount: number
  correctionTurn: 'A' | 'B' | 'C' | 'D' | null
  mistakeCategory: MistakeCategory
  answerShapeIssue: boolean
  confidenceScore: number
  timestamp: string
}

// ── Session Memory (Redis, short-lived) ──────────────────────────────────────

export interface SessionMemory {
  lessonId: string
  userId: string
  mistakeStreak: number        // consecutive wrong answers
  hintsUsed: number
  voiceAttempts: number
  correctionTypes: string[]    // recent correction types this session
  recentTopics: string[]
  // Phase 3B: Adaptive signal fields (optional for backward compat with existing Redis sessions)
  wrongStreakBySkill?: Record<string, number>
  correctStreak?: number
  answerShapeIssues?: Record<string, number>
  lastCorrectionTurnByType?: Record<string, 'A' | 'B' | 'C' | 'D'>
  hintDepthSignal?: HintDepthSignal
}

// ── Validation Event (recorded per answer) ───────────────────────────────────

export interface ValidationEventInput {
  userId: string
  sessionId: string
  lessonId: string
  exerciseId: string
  exerciseType: string
  stepId: string
  topic?: string
  sectionId?: string
  isCorrect: boolean
  score: number                // 0–1 from engine
  retryCount: number
  mistakeTypes?: string[]      // derived from exercise type + correctness
}

// ── Exercise Completion Event ─────────────────────────────────────────────────

export interface ExerciseCompletedInput {
  userId: string
  sessionId: string
  lessonId: string
  exerciseId: string
  exerciseType: string
  sectionId?: string
  topic?: string
  totalSteps: number
  correctSteps: number
  totalHints: number
}

// ── Lesson Completion Event ───────────────────────────────────────────────────

export interface LessonCompletedInput {
  userId: string
  sessionId: string
  lessonId: string
  bookId?: string
  sectionId?: string
  phaseReached?: string
  completedExercises: string[]
  durationSeconds: number
  voiceAttemptCount: number
}

// ── Phase 3D.1: Persistent Mastery Schema ────────────────────────────────────

export type ConfidenceLevel = 'low' | 'medium' | 'high'

export interface StudentSkillMastery {
  id: string
  userId: string
  skillTag: string
  exerciseType: string
  totalAttempts: number
  correctCount: number
  wrongCount: number
  revealedCount: number
  answerShapeIssueCount: number
  avgRetryCount: number
  recentWrongStreak: number
  confidenceLevel: ConfidenceLevel
  lastMistakeCategory: MistakeCategory | null
  lastPracticedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface MasteryUpdateInput {
  userId: string
  skillTag: string
  exerciseType: string
  outcome: 'correct' | 'wrong' | 'revealed' | 'skipped'
  retryCount: number
  answerShapeIssue: boolean
  mistakeCategory?: MistakeCategory
}

// ── Teacher Memory Summary (read-only, injected into AI prompt) ──────────────

export interface TeacherMemorySummary {
  level: string
  weakTopics: string[]
  commonMistakes: string[]
  pronunciationIssues: string[]
  preferredPacing: LearningSpeed
  correctionStyle: CorrectionStyle
  recentPatternSummary: string   // 1–2 sentence plain English summary
}

// ── Student Memory Profile (long-term DB row) ─────────────────────────────────

export interface StudentMemoryProfile {
  userId: string
  learningLevel: string
  averageAccuracy: number
  learningSpeed: LearningSpeed
  confidenceTrend: ConfidenceTrend
  preferredCorrectionStyle: CorrectionStyle
  weakTopics: string[]
  strongTopics: string[]
  pronunciationIssues: string[]
  vocabularyWeaknesses: string[]
  grammarWeaknesses: string[]
  revisionRecommendations: string[]
  totalLessons: number
  totalExercisesAttempted: number
  totalCorrect: number
  updatedAt: Date
}
