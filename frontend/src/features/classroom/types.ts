export type AvatarState = 'listening' | 'speaking' | 'thinking'

export type StepStatus = 'done' | 'active' | 'upcoming'

export type FeedbackState = 'correct' | 'wrong' | null

export interface Exercise {
  id:           string
  index:        number
  total:        number
  prompt:       string
  hint:         string
  sentence:     string  // contains "________" placeholder
  answer:       string
  exerciseType?: string
  skillFocus?:  string
  items?:       string[]
}

export interface LessonStep {
  id:     string
  label:  string
  status: StepStatus
}

export type MessageSender = 'ai' | 'user'

export interface ChatMessage {
  id:           string
  sender:       MessageSender
  text?:        string
  isTyping?:    boolean
  messageType?: string  // voice-eligible: 'greeting' | 'main_prompt' | 'follow_up_question' | 'key_correction' | 'speaking_feedback' | 'writing_feedback' | 'final_result'
}

export type VoiceTurnState =
  | 'idle'
  | 'listening'
  | 'partial_transcribing'
  | 'finalizing_transcript'
  | 'teacher_thinking'
  | 'teacher_speaking'
  | 'interrupted'
  | 'recovering'
  | 'error'

export interface VoiceState {
  isListening:       boolean
  isSpeaking:        boolean
  transcript:        string
  voiceTurnState:    VoiceTurnState
  isPartialTranscript: boolean
}

export interface TeachingCardData {
  title:      string
  body:       string
  ruleTable?: string[][]
  examples?:  string[]
}
