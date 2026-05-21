// ── Mastery Aggregator — Phase 3D.2 ──────────────────────────────────────────
// Lesson-end only. Reads Redis session memory + DB validation events, then
// upserts per-skill/per-type mastery rows into student_skill_mastery.
//
// Guarantees:
//   • Never called per answer turn — lesson-end only
//   • Fail-soft: any error is logged and discarded; lesson completion is unaffected
//   • No raw answers, transcripts, or full prompts stored
//   • No teacher context injection (Phase 3D.3 concern)

import { query } from '../db/postgres.js'
import { getSessionMemory } from './session-memory.js'
import { recordTraceEvent } from '../runtime/trace-recorder.js'
import { deriveMistakeCategory } from './mistake-analyzer.js'
import type { ConfidenceLevel, MistakeCategory } from './types.js'

// ── Normalization ─────────────────────────────────────────────────────────────
// Mirrors master-orchestrator normalizeSkillTag logic.
// Re-normalized here because DB topic stores raw skillFocus (not the Redis key).

export function normalizeSkillTagForMastery(value: string): string {
  if (!value?.trim()) return 'unknown'
  return value.trim().toLowerCase().replace(/\s+/g, '_').slice(0, 40)
}

// ── Confidence Derivation ─────────────────────────────────────────────────────
// Deterministic, pure function.

export function deriveConfidenceLevel(input: {
  accuracy: number
  avgRetryCount: number
  revealedCount: number
  recentWrongStreak: number
}): ConfidenceLevel {
  const { accuracy, avgRetryCount, revealedCount, recentWrongStreak } = input

  let level: ConfidenceLevel
  if (accuracy >= 0.85 && avgRetryCount <= 0.5 && revealedCount === 0) {
    level = 'high'
  } else if (accuracy >= 0.6) {
    level = 'medium'
  } else {
    level = 'low'
  }

  // Downgrade one level when indicated by revealed answers or sustained failure streak
  if (revealedCount > 0 || recentWrongStreak >= 3) {
    if (level === 'high') level = 'medium'
    else if (level === 'medium') level = 'low'
    // already low: no further downgrade
  }

  return level
}

// ── DB row types ──────────────────────────────────────────────────────────────

interface DBValidationEvent {
  exercise_type:     string
  topic:             string | null
  is_correct:        boolean
  retry_count:       number
  correctness_score: number   // 0–100 integer (stored as correctness_score * 100)
  mistake_types:     string[] // JSONB parsed by pg driver
  created_at:        Date
}

// ── Internal accumulator per (skillTag, exerciseType) group ───────────────────

interface MasteryGroupAccumulator {
  skillTag:            string
  exerciseType:        string
  totalAttempts:       number
  correctCount:        number
  wrongCount:          number
  retryTotal:          number   // sum of retry counts; divide by totalAttempts for avg
  lastMistakeCategory: MistakeCategory | null
  lastPracticedAt:     Date | null
}

// ── Core aggregation ──────────────────────────────────────────────────────────

export async function aggregateMasteryFromSession(userId: string, lessonId: string): Promise<void> {
  recordTraceEvent({
    eventType:      'mastery_aggregation_started',
    sessionId:      lessonId,
    payloadSummary: `userId_prefix=${userId.slice(0, 8)} lessonId_prefix=${lessonId.slice(0, 8)}`,
    severity:       'info',
  })

  try {
    // 1. Load session memory from Redis (adaptive signals recorded during the lesson)
    const sessionMem = await getSessionMemory(lessonId, userId)

    // 2. Load validation events for this lesson from DB
    const res = await query<DBValidationEvent>(
      `SELECT exercise_type, topic, is_correct, retry_count, correctness_score,
              mistake_types, created_at
       FROM student_memory_events
       WHERE user_id = $1 AND lesson_id = $2 AND event_type = 'validation'
       ORDER BY created_at ASC`,
      [userId, lessonId],
    )

    const events = res.rows
    if (events.length === 0) {
      recordTraceEvent({
        eventType:      'mastery_aggregation_started',
        sessionId:      lessonId,
        payloadSummary: `no_validation_events userId_prefix=${userId.slice(0, 8)}`,
        severity:       'debug',
      })
      return
    }

    // 3. Group by (skillTag, exerciseType), re-normalizing topic → skillTag
    const groups = new Map<string, MasteryGroupAccumulator>()

    for (const event of events) {
      // Critical: re-normalize topic using same logic as Phase 3B Redis keys
      const skillTag  = normalizeSkillTagForMastery(event.topic ?? event.exercise_type)
      const groupKey  = `${skillTag}::${event.exercise_type}`

      let g = groups.get(groupKey)
      if (!g) {
        g = {
          skillTag,
          exerciseType:        event.exercise_type,
          totalAttempts:       0,
          correctCount:        0,
          wrongCount:          0,
          retryTotal:          0,
          lastMistakeCategory: null,
          lastPracticedAt:     null,
        }
        groups.set(groupKey, g)
      }

      g.totalAttempts++
      g.retryTotal += event.retry_count

      if (event.is_correct) {
        g.correctCount++
      } else {
        g.wrongCount++
        // Derive a bounded MistakeCategory from available event signals
        const category = deriveMistakeCategory({
          exerciseType:     event.exercise_type,
          skillTag,
          retryCount:       event.retry_count,
          answerShapeIssue: false, // not stored per-event in current schema
          score:            event.correctness_score / 100,
        })
        g.lastMistakeCategory = category
      }

      const eventDate = new Date(event.created_at)
      if (!g.lastPracticedAt || eventDate > g.lastPracticedAt) {
        g.lastPracticedAt = eventDate
      }
    }

    // 4. Upsert each group into student_skill_mastery
    let updatedRows = 0

    for (const g of groups.values()) {
      const avgRetryCount = g.retryTotal / Math.max(g.totalAttempts, 1)

      // Redis signals for this group (keyed by exerciseType for shape issues, skillTag for streak)
      const answerShapeIssueCount = sessionMem.answerShapeIssues?.[g.exerciseType] ?? 0
      const recentWrongStreak     = sessionMem.wrongStreakBySkill?.[g.skillTag]     ?? 0

      // Confidence for INSERT case (no prior history) — DO UPDATE case uses combined SQL
      const sessionAccuracy = g.correctCount / Math.max(g.totalAttempts, 1)
      const confidenceForInsert = deriveConfidenceLevel({
        accuracy:         sessionAccuracy,
        avgRetryCount,
        revealedCount:    0, // not tracked from DB events in 3D.2
        recentWrongStreak,
      })

      // Single-query upsert that preserves historical totals via ON CONFLICT DO UPDATE.
      // Confidence in the DO UPDATE path is recomputed from combined totals inline.
      // Weighted avg_retry_count is derived from historical and session totals.
      await query(
        `INSERT INTO student_skill_mastery
           (user_id, skill_tag, exercise_type,
            total_attempts, correct_count, wrong_count, revealed_count,
            answer_shape_issue_count, avg_retry_count, recent_wrong_streak,
            confidence_level, last_mistake_category, last_practiced_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,0,$7,$8,$9,$10,$11,$12,NOW())
         ON CONFLICT (user_id, skill_tag, exercise_type) DO UPDATE SET
           total_attempts            = student_skill_mastery.total_attempts + EXCLUDED.total_attempts,
           correct_count             = student_skill_mastery.correct_count  + EXCLUDED.correct_count,
           wrong_count               = student_skill_mastery.wrong_count    + EXCLUDED.wrong_count,
           answer_shape_issue_count  = student_skill_mastery.answer_shape_issue_count + EXCLUDED.answer_shape_issue_count,
           avg_retry_count           = COALESCE(
             (
               student_skill_mastery.avg_retry_count * student_skill_mastery.total_attempts +
               EXCLUDED.avg_retry_count              * EXCLUDED.total_attempts
             ) / NULLIF(student_skill_mastery.total_attempts + EXCLUDED.total_attempts, 0),
             0
           ),
           recent_wrong_streak       = EXCLUDED.recent_wrong_streak,
           last_mistake_category     = COALESCE(
             EXCLUDED.last_mistake_category,
             student_skill_mastery.last_mistake_category
           ),
           last_practiced_at         = GREATEST(
             EXCLUDED.last_practiced_at,
             student_skill_mastery.last_practiced_at
           ),
           confidence_level          = CASE
             -- Base HIGH: accuracy >= 0.85, avg_retry <= 0.5, revealed = 0
             -- No downgrade (streak < 3, revealed remains 0)
             WHEN (student_skill_mastery.correct_count + EXCLUDED.correct_count)::float /
                  NULLIF(student_skill_mastery.total_attempts + EXCLUDED.total_attempts, 0) >= 0.85
               AND COALESCE(
                     (student_skill_mastery.avg_retry_count * student_skill_mastery.total_attempts +
                      EXCLUDED.avg_retry_count * EXCLUDED.total_attempts) /
                     NULLIF(student_skill_mastery.total_attempts + EXCLUDED.total_attempts, 0),
                     0
                   ) <= 0.5
               AND student_skill_mastery.revealed_count = 0
               AND EXCLUDED.recent_wrong_streak < 3
               THEN 'high'
             -- Base HIGH downgraded to MEDIUM by wrong streak
             WHEN (student_skill_mastery.correct_count + EXCLUDED.correct_count)::float /
                  NULLIF(student_skill_mastery.total_attempts + EXCLUDED.total_attempts, 0) >= 0.85
               AND COALESCE(
                     (student_skill_mastery.avg_retry_count * student_skill_mastery.total_attempts +
                      EXCLUDED.avg_retry_count * EXCLUDED.total_attempts) /
                     NULLIF(student_skill_mastery.total_attempts + EXCLUDED.total_attempts, 0),
                     0
                   ) <= 0.5
               AND student_skill_mastery.revealed_count = 0
               AND EXCLUDED.recent_wrong_streak >= 3
               THEN 'medium'
             -- Base MEDIUM: accuracy >= 0.6, no downgrade
             WHEN (student_skill_mastery.correct_count + EXCLUDED.correct_count)::float /
                  NULLIF(student_skill_mastery.total_attempts + EXCLUDED.total_attempts, 0) >= 0.6
               AND NOT (student_skill_mastery.revealed_count > 0 OR EXCLUDED.recent_wrong_streak >= 3)
               THEN 'medium'
             -- Base MEDIUM downgraded to LOW by revealed or streak
             WHEN (student_skill_mastery.correct_count + EXCLUDED.correct_count)::float /
                  NULLIF(student_skill_mastery.total_attempts + EXCLUDED.total_attempts, 0) >= 0.6
               THEN 'low'
             -- Base LOW
             ELSE 'low'
           END,
           updated_at                = NOW()`,
        [
          userId,
          g.skillTag,
          g.exerciseType,
          g.totalAttempts,
          g.correctCount,
          g.wrongCount,
          answerShapeIssueCount,
          avgRetryCount,
          recentWrongStreak,
          confidenceForInsert,
          g.lastMistakeCategory ?? null,
          g.lastPracticedAt ?? new Date(),
        ],
      )

      updatedRows++
    }

    recordTraceEvent({
      eventType:      'mastery_state_updated',
      sessionId:      lessonId,
      payloadSummary: `groups=${groups.size} rows_upserted=${updatedRows} events=${events.length} userId_prefix=${userId.slice(0, 8)}`,
      severity:       'info',
    })

    console.log(
      `[mastery-aggregator] aggregated lessonId=${lessonId}` +
      ` groups=${groups.size} rows=${updatedRows} events=${events.length}`,
    )

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)

    console.warn('[mastery-aggregator] aggregation failed (ignored):', message)

    recordTraceEvent({
      eventType:      'mastery_aggregation_failed',
      sessionId:      lessonId,
      payloadSummary: `error=${message.slice(0, 100)} userId_prefix=${userId.slice(0, 8)}`,
      severity:       'warn',
    })
    // fail-soft: never re-throw — lesson completion must not be affected
  }
}

// ── Weak skill loader — Phase 3D.3 stub ──────────────────────────────────────
// Returns the user's lowest-confidence skills for advisory use in future phases.
// Phase 3D.3 will inject this into the teacher context block.

export async function loadTopWeakSkills(
  userId: string,
  limit = 5,
): Promise<Array<{ skillTag: string; exerciseType: string; confidenceLevel: ConfidenceLevel }>> {
  try {
    const res = await query<{ skill_tag: string; exercise_type: string; confidence_level: string }>(
      `SELECT skill_tag, exercise_type, confidence_level
       FROM student_skill_mastery
       WHERE user_id = $1
       ORDER BY
         CASE confidence_level WHEN 'low' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
         last_practiced_at DESC NULLS LAST
       LIMIT $2`,
      [userId, limit],
    )
    return res.rows.map(r => ({
      skillTag:        r.skill_tag,
      exerciseType:    r.exercise_type,
      confidenceLevel: r.confidence_level as ConfidenceLevel,
    }))
  } catch {
    return []
  }
}
