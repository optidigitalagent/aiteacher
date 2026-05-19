function buildWsBase(): string {
  const explicit = import.meta.env.VITE_WS_URL as string | undefined
  if (explicit) return explicit
  const api = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:4000'
  return api.replace(/^https:\/\//, 'wss://').replace(/^http:\/\//, 'ws://')
}
const WS_BASE = buildWsBase()

// ── Visible payload types — content shown on student screen ──────────────────

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

// ── Outbound (backend → frontend) ────────────────────────────────────────────

export interface ExerciseCursor {
  unit?:              number
  section?:           string
  sessionId?:         string                                                // for answer submission
  exerciseNumber:     number
  exerciseType:       string
  instruction:        string
  currentItem:        string
  itemIndex:          number
  itemTotal:          number
  completedItems:     number[]
  failedItems:        number[]
  wordBoxState?:      { available: string[]; used: string[] } | null
  items?:             string[]                                              // all items for full-context display
  options?:           string[]                                              // answer word bank — visible to student
  exerciseId?:        string | null                                         // authoritative server-assigned ID
  expectedInputMode?: 'text' | 'voice' | 'choice' | 'any'                 // what kind of input the engine expects
  completionState?:   'active' | 'complete' | 'skipped'                   // exercise lifecycle state
  validationResult?:  { correct: boolean; explanation: string } | null     // last validation outcome
  pendingTransition?: string | null                                         // e.g. 'exercise_complete', 'section_complete'
  // Visible payload — content that must be displayed on the student's screen
  readingText?:       string          // full reading passage
  textBlocks?:        TextBlock[]     // structured article/comment blocks
  promptCards?:       PromptCard[]    // discussion/speaking task cards
  statements?:        Statement[]     // agree/disagree or opinion statements
  visibleContext?:    VisibleContext  // summary of what is visible
}

export interface BackendExercise {
  id:             string
  exerciseType:   string
  question:       string
  hint:           string
  difficulty:     number
  exerciseNumber?: number
  instruction?:   string
  skillFocus?:    string
  items?:         string[]
  options?:       string[]   // answer word bank for matching/vocabulary exercises
}

export interface LessonSummary {
  lessonId:        string
  phasesReached:   string[]
  exerciseScore:   number
  vocabularyCount: number
  durationMin:     number
}

export type BackendMessage =
  | { type: 'ai_text';          text: string; phase: string; displayText?: string }
  | { type: 'audio_chunk';      data: string }
  | { type: 'exercise';         exercise: BackendExercise }
  | { type: 'phase_change';     from: string; to: string }
  | { type: 'feedback';         correct: boolean; explanation: string; score?: number }
  | { type: 'lesson_end';       summary: LessonSummary }
  | { type: 'transcript';       text: string }
  | { type: 'error';            code: string; message: string }
  | { type: 'teaching_card';    cardType: string; displayText: string }
  | { type: 'section_card';     sectionId: string; card: unknown }
  | { type: 'lesson_resumed';   phase: string; exerciseNum: number; message: string }
  | { type: 'student_message';  text: string }
  | { type: 'teacher_turn_end' }
  | { type: 'lesson_ready';            sessionId: string | null }
  | { type: 'exercise_cursor_updated'; cursor: ExerciseCursor }
  | { type: 'tip_added';              tip: TipRecord }
  | { type: 'tip_list';               tips: TipRecord[] }
  // Engine-authoritative reconnect snapshot — replaces cursor from cache
  | { type: 'lesson_state_snapshot'; cursor: ExerciseCursor; phase: string; sessionId: string }
  // Deterministic validation result from the exercise engine
  | { type: 'validation_result'; correct: boolean; explanation: string; exerciseId: string; stepId?: string }
  // Engine-level errors (distinct from auth/billing errors in 'error')
  | { type: 'runtime_error'; code: string; message: string }
  // Phase 6
  | { type: 'lesson_time_warning'; remainingMs: number }
  // Phase 2 recovery: periodic remaining-time broadcast (every 60 seconds)
  | { type: 'lesson_timer_update'; remainingMs: number }
  // Reconnect grace-window resync: replaces any stale local state after reattach.
  // No teacher greeting. No AI call. No lesson restart.
  | {
      type:                'lesson_resync'
      lessonId:            string
      sessionId:           string
      phase:               string
      exerciseNumber:      number
      totalExercises:      number
      currentExerciseType: string
      currentItemIndex:    number
      itemTotal:           number
      visiblePayload:      ExerciseCursor | null
      correctionTurn:      string | null
      retryCount:          number
      teacherTurnActive:   boolean
      studentTurnAllowed:  boolean
      remainingMs:         number
      recentTranscript:    Array<{ speaker: 'teacher' | 'student'; text: string }> | null
    }

export interface TipRecord {
  id:          string
  studentId:   string
  lessonId?:   string | null
  section?:    string | null
  category:    'VOCAB' | 'PHRASE' | 'GRAMMAR' | 'PRONUNCIATION' | 'COMMON_MISTAKE'
  title:       string
  explanation: string
  example?:    string | null
  source:      'confusion' | 'correction' | 'vocabulary' | 'observation'
  createdAt:   string
}

export type SendFn = (payload: object) => void

// ── Connection ────────────────────────────────────────────────────────────────

export function createClassroomSocket(
  onMessage:  (msg: BackendMessage) => void,
  onOpen?:    () => void,
  onClose?:   (code: number) => void,
  token?:     string,
  sessionId?: string,
): WebSocket {
  let url = token ? `${WS_BASE}/lesson?token=${encodeURIComponent(token)}` : `${WS_BASE}/lesson`
  if (sessionId) url += `&sessionId=${encodeURIComponent(sessionId)}`
  const ws = new WebSocket(url)

  ws.onopen = () => {
    console.log('[Classroom WS] connected')
    onOpen?.()
  }
  ws.onclose = (ev) => {
    console.log('[Classroom WS] disconnected — code:', ev.code, 'reason:', ev.reason || '(none)')
    onClose?.(ev.code)
  }
  ws.onerror = (e) => {
    console.error('[Classroom WS] error', e)
  }
  ws.onmessage = (ev) => {
    try {
      const msg = JSON.parse(ev.data as string) as BackendMessage
      console.log('[Classroom IN]', msg.type, msg)
      onMessage(msg)
    } catch {
      console.warn('[Classroom IN] malformed frame:', ev.data)
    }
  }
  return ws
}

export function sendMessage(ws: WebSocket | null, payload: object): void {
  if (ws?.readyState === WebSocket.OPEN) {
    console.log('[Classroom OUT]', (payload as { type?: string }).type ?? '?', payload)
    ws.send(JSON.stringify(payload))
  }
}
