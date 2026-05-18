// Observability type definitions for AI Teacher runtime tracing.
// All types are minimal — only data safe to log (no secrets, no audio, no full prompts).

export interface LessonTraceMeta {
  lessonId:    string
  sessionId:   string | null
  userIdHash:  string | null   // SHA-256 prefix, never raw userId
  sectionId:   string | null
  unitId:      string | null
  startedAt:   string
  environment: string
}

export interface SttSpanData {
  transcriptLength:   number
  transcriptPreview:  string   // max 120 chars
  inputMode:          'voice' | 'text'
  turnId?:            string | null
}

export interface InterpretationSpanData {
  exerciseType:              string
  resolvedUtterancePreview:  string   // max 120 chars
  interpretedAnswer?:        string | null
  canonicalAnswer?:          string | null
  issueType?:                string | null
  missingSlots?:             string[]
  confidence?:               number | null
}

export interface ValidationSpanData {
  exerciseId:       string
  itemIndex:        number
  correct:          boolean
  allowProgression: boolean
  retryRequired:    boolean
  issueType?:       string | null
}

export interface TeacherGenerationSpanData {
  phase:         string
  promptType?:   string | null
  responseLength?: number
  teacherMode?:  string | null
  studentState?: string | null
}

export interface ProgressionSpanData {
  exerciseId?:   string | null
  itemIndex:     number
  action:        string
  reason?:       string | null
  cursorBefore?: Record<string, unknown> | null
  cursorAfter?:  Record<string, unknown> | null
}

export interface FrontendSyncSpanData {
  emittedEventType: string
  exerciseId?:      string | null
  itemIndex?:       number | null
  exerciseType?:    string | null
}

export interface RuntimeErrorSpanData {
  errorName:    string
  errorMessage: string
  stackPreview?: string | null
  lessonId?:    string | null
  sessionId?:   string | null
}

export interface LessonEndSpanData {
  durationMin:      number
  exerciseScore?:   number
  vocabularyCount?: number
  phasesReached?:   string[]
  endReason?:       string | null
}
