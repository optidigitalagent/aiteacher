function buildWsBase(): string {
  const explicit = import.meta.env.VITE_WS_URL as string | undefined
  if (explicit) return explicit
  const api = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:4000'
  return api.replace(/^https:\/\//, 'wss://').replace(/^http:\/\//, 'ws://')
}
const WS_BASE = buildWsBase()

// ── Outbound (backend → frontend) ────────────────────────────────────────────

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
  | { type: 'feedback';         correct: boolean; explanation: string }
  | { type: 'lesson_end';       summary: LessonSummary }
  | { type: 'transcript';       text: string }
  | { type: 'error';            code: string; message: string }
  | { type: 'teaching_card';    cardType: string; displayText: string }
  | { type: 'section_card';     sectionId: string; card: unknown }
  | { type: 'lesson_resumed';   phase: string; exerciseNum: number; message: string }
  | { type: 'student_message';  text: string }
  | { type: 'teacher_turn_end' }

export type SendFn = (payload: object) => void

// ── Connection ────────────────────────────────────────────────────────────────

export function createClassroomSocket(
  onMessage:  (msg: BackendMessage) => void,
  onOpen?:    () => void,
  onClose?:   () => void,
  token?:     string,
  sessionId?: string,
): WebSocket {
  let url = token ? `${WS_BASE}/lesson?token=${encodeURIComponent(token)}` : `${WS_BASE}/lesson`
  if (sessionId) url += `&sessionId=${encodeURIComponent(sessionId)}`
  const ws = new WebSocket(url)

  ws.onopen = () => {
    console.log('[Classroom WS] connected to', url)
    onOpen?.()
  }
  ws.onclose = (ev) => {
    console.log('[Classroom WS] disconnected — code:', ev.code, 'reason:', ev.reason || '(none)')
    onClose?.()
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
