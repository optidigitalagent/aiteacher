import type pg from 'pg';
import type { SessionSummary } from '../shared/types.js';

/**
 * Optional convenience store for session summary read access.
 * Write path is on PostgresProfileStoreImpl.saveSessionSummary().
 * This store provides the read side (e.g. parent dashboard, Phase 9+).
 */
export class PostgresSessionSummaryStore {
  private readonly db: { query: <T extends pg.QueryResultRow>(text: string, params?: unknown[]) => Promise<pg.QueryResult<T>> };

  constructor(db: { query: <T extends pg.QueryResultRow>(text: string, params?: unknown[]) => Promise<pg.QueryResult<T>> }) {
    this.db = db;
  }

  async getSessionSummary(sessionId: string, userId: string): Promise<SessionSummary | null> {
    const result = await this.db.query<RawSummaryRow>(
      `SELECT ss.*
       FROM kids_brain_session_summaries ss
       JOIN kids_brain_child_profiles cp ON cp.child_id = ss.child_id
       WHERE ss.session_id = $1 AND cp.user_id = $2
       LIMIT 1`,
      [sessionId, userId],
    );
    if (result.rows.length === 0) return null;
    return rowToSummary(result.rows[0]);
  }

  async listSummariesForChild(childId: string, userId: string, limit = 20): Promise<SessionSummary[]> {
    const result = await this.db.query<RawSummaryRow>(
      `SELECT ss.*
       FROM kids_brain_session_summaries ss
       JOIN kids_brain_child_profiles cp ON cp.child_id = ss.child_id
       WHERE ss.child_id = $1 AND cp.user_id = $2
       ORDER BY ss.started_at DESC
       LIMIT $3`,
      [childId, userId, limit],
    );
    return result.rows.map(rowToSummary);
  }
}

interface RawSummaryRow extends pg.QueryResultRow {
  session_id: string;
  child_id: string;
  started_at: Date;
  ended_at: Date;
  duration_seconds: number;
  stop_reason: string;
  lesson_id: string | null;
  lesson_phase_reached: string | null;
  items_attempted_count: number;
  items_mastered_ids: string[];
  recovery_event_count: number;
  l1_rescue_used: boolean;
  speaking_turns_count: number;
  completion_rate: string | null;
  final_emotional_safety: string | null;
  parent_review_flagged: boolean;
  created_at: Date;
}

function rowToSummary(row: RawSummaryRow): SessionSummary {
  return {
    sessionId: row.session_id,
    childId: row.child_id,
    startedAt: row.started_at.toISOString(),
    endedAt: row.ended_at.toISOString(),
    durationSeconds: row.duration_seconds,
    stopReason: row.stop_reason,
    lessonId: row.lesson_id,
    lessonPhaseReached: row.lesson_phase_reached,
    itemsAttemptedCount: row.items_attempted_count,
    itemsMasteredIds: row.items_mastered_ids ?? [],
    recoveryEventCount: row.recovery_event_count,
    l1RescueUsed: row.l1_rescue_used,
    speakingTurnsCount: row.speaking_turns_count,
    completionRate: row.completion_rate !== null ? parseFloat(row.completion_rate) : null,
    finalEmotionalSafety: row.final_emotional_safety !== null ? parseFloat(row.final_emotional_safety) : null,
    parentReviewFlagged: row.parent_review_flagged,
  };
}
