import type pg from 'pg';
import type { SafetyEventStore } from '../contracts/stores.js';
import type { SafetyEvent } from '../shared/types.js';

/**
 * Append-only safety event store.
 * Write path only: safety/safety-audit-log.ts writes here.
 * Read path: human review tool only (not called from Kids Brain runtime).
 * child_id is NOT a FK — intentional per Patch 3 §3A.4 to preserve audit trail.
 */
export class PostgresSafetyEventStoreImpl implements SafetyEventStore {
  private readonly db: { query: <T extends pg.QueryResultRow>(text: string, params?: unknown[]) => Promise<pg.QueryResult<T>> };

  constructor(db: { query: <T extends pg.QueryResultRow>(text: string, params?: unknown[]) => Promise<pg.QueryResult<T>> }) {
    this.db = db;
  }

  async createSafetyEvent(event: SafetyEvent): Promise<void> {
    await this.db.query(
      `INSERT INTO kids_brain_safety_events (
         session_id, child_id, event_type, confidence_score,
         detection_method, review_status, occurred_at, reviewer_id, reviewed_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        event.sessionId,
        event.childId,
        event.eventType,
        event.confidenceScore,
        event.detectionMethod,
        event.reviewStatus,
        event.occurredAt,
        event.reviewerId ?? null,
        event.reviewedAt ?? null,
      ],
    );
  }

  /** Human-review-tool path only. Not callable from Kids Brain runtime AI modules. */
  async listSafetyEventsForReview(): Promise<SafetyEvent[]> {
    const result = await this.db.query<RawSafetyEventRow>(
      `SELECT * FROM kids_brain_safety_events
       WHERE review_status = 'pending'
       ORDER BY occurred_at DESC
       LIMIT 200`,
    );
    return result.rows.map(rowToSafetyEvent);
  }
}

interface RawSafetyEventRow extends pg.QueryResultRow {
  id: string;
  session_id: string;
  child_id: string;
  event_type: string;
  confidence_score: string;
  detection_method: string;
  review_status: string;
  occurred_at: Date;
  reviewer_id: string | null;
  reviewed_at: Date | null;
}

function rowToSafetyEvent(row: RawSafetyEventRow): SafetyEvent {
  return {
    sessionId: row.session_id,
    childId: row.child_id,
    eventType: row.event_type,
    confidenceScore: parseFloat(row.confidence_score),
    detectionMethod: row.detection_method as SafetyEvent['detectionMethod'],
    reviewStatus: row.review_status as SafetyEvent['reviewStatus'],
    occurredAt: row.occurred_at.toISOString(),
    reviewerId: row.reviewer_id ?? undefined,
    reviewedAt: row.reviewed_at ? row.reviewed_at.toISOString() : undefined,
  };
}
