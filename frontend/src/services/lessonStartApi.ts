import { getStoredToken } from '../context/AuthContext'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

export interface LessonStartPayload {
  mode:          'textbook' | 'topic'
  bookId:        string
  bookTitle:     string
  sectionId:     string
  sectionNumber: string
  sectionTitle:  string
  sectionTopic:  string
  teacherId:     string
  voiceId:       string
}

export interface LessonStartResponse {
  sessionId: string
}

export async function startLesson(payload: LessonStartPayload): Promise<LessonStartResponse> {
  const token = getStoredToken()
  const res = await fetch(`${API_BASE}/lesson/start`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      mode:          payload.mode,
      bookId:        payload.bookId,
      sectionId:     payload.sectionId,
      sectionNumber: payload.sectionNumber,
      teacherId:     payload.teacherId,
      voiceId:       payload.voiceId,
    }),
  })
  if (!res.ok) throw new Error(`Server error: ${res.status}`)
  const data = await res.json() as Record<string, unknown>
  const sessionId = (data.sessionId ?? data.lessonId ?? data.id) as string | undefined
  if (!sessionId) throw new Error('No session ID returned')
  return { sessionId }
}
