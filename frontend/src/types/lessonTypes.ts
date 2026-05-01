// TODO: replace with API-generated types once backend /lesson/start contract is finalized

export interface LessonPlanSummary {
  sectionId: string
  topic: string
  expectedExercises: number
  lessonGoals: string[]
  teacherPreparation: string[]
}

export interface LessonPreparationRequest {
  mode: 'textbook' | 'topic'
  bookId: string
  sectionId: string
  sectionNumber: string
  teacherId: string
  voiceId: string
}

export interface LessonSessionMetadata {
  sessionId: string
  mode: 'textbook' | 'topic'
  bookId: string
  bookTitle: string
  sectionId: string
  sectionNumber: string
  sectionTitle: string
  sectionTopic: string
  teacherId: string
  teacherName: string
  teacherAvatarUrl?: string
  voiceId: string
  exerciseCount?: number
}
