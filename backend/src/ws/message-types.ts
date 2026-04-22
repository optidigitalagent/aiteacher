import { z } from 'zod'

// ─── Inbound (Client → Server) ───────────────────────────────────────────────

export const LessonConfigSchema = z.object({
  studentId:     z.string().uuid(),
  grammarTarget: z.string().min(1),
  lessonTopic:   z.string().min(1),
  textbookUnit:  z.string().min(1),
})

export const InboundMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type:    z.literal('lesson_start'),
    payload: LessonConfigSchema,
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
])

export type InboundMessage  = z.infer<typeof InboundMessageSchema>
export type LessonConfig    = z.infer<typeof LessonConfigSchema>

// ─── Outbound (Server → Client) ──────────────────────────────────────────────

export type LessonPhase =
  | 'DIAGNOSTIC'
  | 'CONTEXT_INPUT'
  | 'RULE_DISCOVERY'
  | 'EXERCISES'
  | 'VOCABULARY'
  | 'DEEP_THINKING'
  | 'WRAP_UP'

export interface OutboundAiText {
  type:  'ai_text'
  text:  string
  phase: LessonPhase
}

export interface OutboundAudioChunk {
  type: 'audio_chunk'
  data: string // base64 MP3
}

export interface OutboundExercise {
  type:     'exercise'
  exercise: {
    id:            string
    exerciseType:  string
    question:      string
    difficulty:    number
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
    lessonId:       string
    phasesReached:  LessonPhase[]
    exerciseScore:  number
    vocabularyCount: number
    durationMin:    number
  }
}

export interface OutboundError {
  type:    'error'
  code:    string
  message: string
}

export type OutboundMessage =
  | OutboundAiText
  | OutboundAudioChunk
  | OutboundExercise
  | OutboundPhaseChange
  | OutboundFeedback
  | OutboundLessonEnd
  | OutboundError
