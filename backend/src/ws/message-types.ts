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

import type { LessonPhase, SlideSpec } from '../lesson/types.js'

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
