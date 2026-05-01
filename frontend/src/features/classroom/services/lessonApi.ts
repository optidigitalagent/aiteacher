// REST API layer — lesson flow goes through WebSocket (classroomSocket.ts).
// This file covers HTTP-only operations: profile reads, feedback submission.

const API_BASE = import.meta.env.VITE_API_URL ?? ''  // proxied via vite → /api → localhost:4000

export interface StudentProfile {
  name:             string
  age:              number
  level:            string
  textbook:         string | null
  current_unit:     number
  grammar_mastery:  Record<string, number>
  error_patterns:   string[]
  known_vocabulary: string[]
  weak_vocabulary:  string[]
  attention_span_min: number
  updated_at:       string
}

export async function getStudentProfile(studentId: string): Promise<StudentProfile> {
  const res = await fetch(`${API_BASE}/api/students/${studentId}/profile`)
  if (!res.ok) throw new Error(`profile fetch failed: ${res.status}`)
  return res.json() as Promise<StudentProfile>
}

export async function postLessonFeedback(
  lessonId: string,
  rating: number,
  comment?: string,
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/lessons/${lessonId}/feedback`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ rating, comment }),
  })
  if (!res.ok) throw new Error(`feedback post failed: ${res.status}`)
}
