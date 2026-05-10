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
  sessionId:       string
  remainingMinutes: number
}

export type BillingErrorCode = 'PAYMENT_REQUIRED' | 'SUBSCRIPTION_EXPIRED' | 'LESSON_LIMIT_REACHED'

export class BillingError extends Error {
  code:             BillingErrorCode
  remainingMinutes: number | undefined

  constructor(code: BillingErrorCode, message: string, remainingMinutes?: number) {
    super(message)
    this.name             = 'BillingError'
    this.code             = code
    this.remainingMinutes = remainingMinutes
  }
}

export interface ContinuationStatus {
  canContinue:                  boolean
  canStartNew:                  boolean
  activeSessionId:              string | null
  activeSectionId:              string | null
  activeTeacherId:              string | null
  activeVoiceId:                string | null
  remainingMinutes:             number | null
  lastCompletedSection:         string | null
  subscriptionMinutesRemaining: number
}

export async function getContinuationStatus(): Promise<ContinuationStatus | null> {
  const token = getStoredToken()
  if (!token) return null
  try {
    const res = await fetch(`${API_BASE}/lesson/continuation-status`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return null
    return await res.json() as ContinuationStatus
  } catch {
    return null
  }
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

  if (res.status === 402) {
    const data = await res.json() as { code?: string; message?: string; remainingMinutes?: number }
    const code = (data.code ?? 'PAYMENT_REQUIRED') as BillingErrorCode
    throw new BillingError(code, data.message ?? 'Payment required', data.remainingMinutes)
  }

  if (!res.ok) throw new Error(`Server error: ${res.status}`)

  const data = await res.json() as Record<string, unknown>
  const sessionId = (data.sessionId ?? data.lessonId ?? data.id) as string | undefined
  if (!sessionId) throw new Error('No session ID returned')
  return { sessionId, remainingMinutes: Number(data.remainingMinutes ?? 0) }
}
