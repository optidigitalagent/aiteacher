export type AvatarState = 'listening' | 'speaking' | 'thinking'

export type StepStatus = 'done' | 'active' | 'upcoming'

export type FeedbackState = 'correct' | 'wrong' | null

export interface Exercise {
  id:       string
  index:    number
  total:    number
  prompt:   string
  hint:     string
  sentence: string  // contains "________" placeholder
  answer:   string
}

export interface LessonStep {
  id:     string
  label:  string
  status: StepStatus
}

export type MessageSender = 'ai' | 'user'

export interface ChatMessage {
  id:        string
  sender:    MessageSender
  text?:     string
  isTyping?: boolean
}

export interface VoiceState {
  isListening: boolean
  isSpeaking:  boolean
  transcript:  string
}

export interface TeachingCardData {
  title:      string
  body:       string
  ruleTable?: string[][]
  examples?:  string[]
}
