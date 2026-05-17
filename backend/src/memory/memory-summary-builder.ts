// ── Memory Summary Builder — compact read-only context for Teacher Brain ────────
// Output must be short: injected into system prompt, not a DB dump.

import { query } from '../db/postgres.js'
import type { TeacherMemorySummary, StudentMemoryProfile } from './types.js'
import { aggregateWeakTopics } from './mistake-analyzer.js'

async function loadProfile(userId: string): Promise<StudentMemoryProfile | null> {
  const res = await query<{
    learning_level: string
    average_accuracy: number
    learning_speed: string
    confidence_trend: string
    preferred_correction_style: string
    weak_topics: string[]
    strong_topics: string[]
    pronunciation_issues: string[]
    vocabulary_weaknesses: string[]
    grammar_weaknesses: string[]
    revision_recommendations: string[]
    total_lessons: number
    total_exercises_attempted: number
    total_correct: number
    updated_at: Date
  }>(
    `SELECT learning_level, average_accuracy, learning_speed, confidence_trend,
            preferred_correction_style, weak_topics, strong_topics,
            pronunciation_issues, vocabulary_weaknesses, grammar_weaknesses,
            revision_recommendations, total_lessons, total_exercises_attempted,
            total_correct, updated_at
     FROM student_memory_profiles WHERE user_id = $1`,
    [userId],
  )
  const r = res.rows[0]
  if (!r) return null

  return {
    userId,
    learningLevel:             r.learning_level,
    averageAccuracy:           Number(r.average_accuracy),
    learningSpeed:             (r.learning_speed ?? 'normal') as StudentMemoryProfile['learningSpeed'],
    confidenceTrend:           (r.confidence_trend ?? 'stable') as StudentMemoryProfile['confidenceTrend'],
    preferredCorrectionStyle:  (r.preferred_correction_style ?? 'ladder') as StudentMemoryProfile['preferredCorrectionStyle'],
    weakTopics:                Array.isArray(r.weak_topics) ? r.weak_topics : [],
    strongTopics:              Array.isArray(r.strong_topics) ? r.strong_topics : [],
    pronunciationIssues:       Array.isArray(r.pronunciation_issues) ? r.pronunciation_issues : [],
    vocabularyWeaknesses:      Array.isArray(r.vocabulary_weaknesses) ? r.vocabulary_weaknesses : [],
    grammarWeaknesses:         Array.isArray(r.grammar_weaknesses) ? r.grammar_weaknesses : [],
    revisionRecommendations:   Array.isArray(r.revision_recommendations) ? r.revision_recommendations : [],
    totalLessons:              r.total_lessons,
    totalExercisesAttempted:   r.total_exercises_attempted,
    totalCorrect:              r.total_correct,
    updatedAt:                 r.updated_at,
  }
}

async function loadRecentMistakeEvents(userId: string, limit = 50): Promise<
  Array<{ exerciseType: string; topic: string | null; mistakeTypes: string[] }>
> {
  const res = await query<{ exercise_type: string; topic: string | null; mistake_types: string[] }>(
    `SELECT exercise_type, topic, mistake_types
     FROM student_memory_events
     WHERE user_id = $1 AND event_type = 'validation' AND is_correct = false
     ORDER BY created_at DESC
     LIMIT $2`,
    [userId, limit],
  )
  return res.rows.map(r => ({
    exerciseType: r.exercise_type,
    topic: r.topic,
    mistakeTypes: Array.isArray(r.mistake_types) ? r.mistake_types : [],
  }))
}

function buildRecentPatternSummary(
  profile: StudentMemoryProfile | null,
  weakTopics: string[],
): string {
  if (!profile || profile.totalLessons === 0) return 'First session — no prior data.'

  const acc = profile.averageAccuracy
  const accDesc = acc >= 80 ? 'strong accuracy' : acc >= 60 ? 'moderate accuracy' : 'needs support'

  const weakStr = weakTopics.length > 0
    ? `Recurring struggles: ${weakTopics.slice(0, 3).join(', ')}.`
    : 'No recurring struggle areas detected.'

  return `${profile.totalLessons} lesson(s) completed, ${accDesc} (${Math.round(acc)}% avg). ${weakStr}`
}

// ── Public API ─────────────────────────────────────────────────────────────────

export async function buildTeacherMemorySummary(userId: string): Promise<TeacherMemorySummary | null> {
  try {
    const [profile, recentMistakes] = await Promise.all([
      loadProfile(userId),
      loadRecentMistakeEvents(userId),
    ])

    const dynamicWeakTopics = aggregateWeakTopics(recentMistakes, 5)

    const weakTopics = profile
      ? [...new Set([...dynamicWeakTopics, ...profile.weakTopics])].slice(0, 5)
      : dynamicWeakTopics

    return {
      level:                profile?.learningLevel ?? 'Beginner',
      weakTopics,
      commonMistakes:       dynamicWeakTopics,
      pronunciationIssues:  profile?.pronunciationIssues ?? [],
      preferredPacing:      profile?.learningSpeed ?? 'normal',
      correctionStyle:      profile?.preferredCorrectionStyle ?? 'ladder',
      recentPatternSummary: buildRecentPatternSummary(profile, weakTopics),
    }
  } catch (err) {
    console.error('[memory-summary] load error (ignored):', err)
    return null
  }
}

// Format the summary as a compact string for injection into the AI system prompt.
export function formatTeacherMemorySummaryForPrompt(summary: TeacherMemorySummary): string {
  const lines: string[] = ['=== STUDENT LEARNING MEMORY (read-only, backend-authoritative) ===']
  lines.push(`Level: ${summary.level}`)
  lines.push(`Accuracy trend: ${summary.recentPatternSummary}`)
  if (summary.weakTopics.length > 0) {
    lines.push(`Weak areas: ${summary.weakTopics.join(', ')}`)
  }
  if (summary.pronunciationIssues.length > 0) {
    lines.push(`Pronunciation issues: ${summary.pronunciationIssues.slice(0, 3).join(', ')}`)
  }
  lines.push(`Preferred pacing: ${summary.preferredPacing} | Correction style: ${summary.correctionStyle}`)
  lines.push('RULE: Use this to adapt your STYLE only. Do NOT skip or change exercises based on this.')
  lines.push('=== END STUDENT MEMORY ===')
  return lines.join('\n')
}
