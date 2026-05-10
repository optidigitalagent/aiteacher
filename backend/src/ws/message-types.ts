import { z } from 'zod'
export type { LessonPhase } from '../lesson/types.js'

// ─── Inbound (Client → Server) ───────────────────────────────────────────────

export const LessonConfigSchema = z.object({
  studentId:     z.string().uuid(),
  grammarTarget: z.string().min(1),
  lessonTopic:   z.string().min(1),
  textbookUnit:  z.string().min(1),
})

// Focus textbook mode: student picks a section (e.g. "1.2"), backend derives unit
// studentId is optional — authenticated requests use the JWT's studentId
export const FocusLessonConfigSchema = z.object({
  studentId: z.string().uuid().optional(),
  unit:      z.number().int().min(1).max(12),
  section:   z.string().regex(/^\d+\.\d+$/).optional(), // e.g. "1.1", "2.3"
  teacherId: z.string().optional(),  // 'alex' | 'emma'
  voiceId:   z.string().optional(),  // 'onyx' | 'echo' | 'nova' | 'shimmer'
})

export const InboundMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type:    z.literal('lesson_start'),
    payload: LessonConfigSchema,
  }),
  z.object({
    type:    z.literal('focus_lesson_start'),
    payload: FocusLessonConfigSchema,
  }),
  z.object({
    type: z.literal('text_message'),
    text: z.string().min(1).max(2000),
  }),
  z.object({
    type: z.literal('audio_chunk'),
    data: z.string(), // base64 PCM
  }),
  z.object({
    type:       z.literal('exercise_answer'),
    exerciseId: z.string().uuid(),
    answer:     z.string().min(1),
  }),
  z.object({
    type: z.literal('interrupt'),
  }),
  z.object({
    type:               z.literal('student_confused'),
    sectionId:          z.string().optional(),
    phase:              z.string().optional(),
    currentExerciseNum: z.number().optional(),
    lastTeacherMessage: z.string().max(500).optional(),
    lastExercise:       z.string().max(500).optional(),
    studentLastAnswer:  z.string().max(500).optional(),
  }),
])

export type InboundMessage    = z.infer<typeof InboundMessageSchema>
export type LessonConfig      = z.infer<typeof LessonConfigSchema>
export type FocusLessonConfig = z.infer<typeof FocusLessonConfigSchema>
export type StudentConfused   = Extract<InboundMessage, { type: 'student_confused' }>

// ─── Outbound (Server → Client) ──────────────────────────────────────────────

import type { LessonPhase, SlideSpec, ExerciseCursor } from '../lesson/types.js'
import type { TipRecord } from '../lesson/tips-service.js'
export type { TipRecord }

export interface OutboundAiText {
  type:         'ai_text'
  text:         string
  phase:        LessonPhase
  displayText?: string   // formatted version (may contain **Rule:** cards)
}

export interface OutboundAudioChunk {
  type: 'audio_chunk'
  data: string // base64 MP3
}

export interface OutboundExercise {
  type:     'exercise'
  exercise: {
    id:             string
    exerciseType:   string
    question:       string
    hint:           string
    difficulty:     number
    // Structured lesson card fields — present when AI populates them
    exerciseNumber?: number    // textbook exercise number
    instruction?:    string    // what the student must do
    skillFocus?:     string    // grammar/skill being practiced
    items?:          string[]  // sub-items for multi-part exercises
  }
}

export interface OutboundPhaseChange {
  type: 'phase_change'
  from: LessonPhase
  to:   LessonPhase
}

export interface OutboundFeedback {
  type:        'feedback'
  correct:     boolean
  explanation: string
}

export interface OutboundLessonEnd {
  type:    'lesson_end'
  summary: {
    lessonId:        string
    phasesReached:   LessonPhase[]
    exerciseScore:   number
    vocabularyCount: number
    durationMin:     number
  }
}

export interface OutboundTranscript {
  type: 'transcript'
  text: string
}

export interface OutboundError {
  type:    'error'
  code:    string
  message: string
}

/** Sent when AI returns a mini teaching card (confusion response or rule confirmation). */
export interface OutboundTeachingCard {
  type:         'teaching_card'
  cardType:     'mini_explanation' | 'grammar_overview'
  displayText:  string   // formatted markdown from AI — use for rendering
}

/** Sent once per Focus grammar section (cached, reusable across students). */
export interface OutboundSectionCard {
  type:      'section_card'
  sectionId: string
  card:      SlideSpec
}

/** Sent when a disconnected student reconnects and their lesson is resumed from Redis. */
export interface OutboundLessonResumed {
  type:        'lesson_resumed'
  phase:       LessonPhase
  exerciseNum: number
  message:     string
}

/** Sent when the student's voice transcript passes the filter and is sent to the AI. */
export interface OutboundStudentMessage {
  type: 'student_message'
  text: string
}

/** Sent after the backend finishes streaming all TTS audio for a teacher turn. */
export interface OutboundTeacherTurnEnd {
  type: 'teacher_turn_end'
}

/**
 * Sent immediately after the backend authenticates the WS connection and
 * validates the paid session. The frontend should show "Begin Lesson" only
 * after receiving this event — not just on WS open.
 */
export interface OutboundLessonReady {
  type:      'lesson_ready'
  sessionId: string | null
}

/**
 * Phase 3: Sent after every AI turn that produces or updates an exercise.
 * Contains the authoritative item-level cursor for the current exercise.
 * Frontend renders exercise state from this — never from local inference.
 */
export interface OutboundExerciseCursorUpdated {
  type:   'exercise_cursor_updated'
  cursor: ExerciseCursor
}

export type { ExerciseCursor }

/**
 * Phase 5: Sent when a new learning tip is created (confusion, correction, vocabulary).
 * Frontend appends to the local tip list.
 */
export interface OutboundTipAdded {
  type: 'tip_added'
  tip:  TipRecord
}

/**
 * Phase 5: Sent at lesson start with the student's recent tip history.
 * Allows the frontend to show the Tips drawer without a separate REST call.
 */
export interface OutboundTipList {
  type: 'tip_list'
  tips: TipRecord[]
}

export type OutboundMessage =
  | OutboundAiText
  | OutboundAudioChunk
  | OutboundExercise
  | OutboundPhaseChange
  | OutboundFeedback
  | OutboundLessonEnd
  | OutboundTranscript
  | OutboundError
  | OutboundTeachingCard
  | OutboundSectionCard
  | OutboundLessonResumed
  | OutboundStudentMessage
  | OutboundTeacherTurnEnd
  | OutboundLessonReady
  | OutboundExerciseCursorUpdated
  | OutboundTipAdded
  | OutboundTipList
