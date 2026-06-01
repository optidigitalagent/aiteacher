import type pg from 'pg';
import type { PostgresProfileStore } from '../contracts/stores.js';
import type { ChildProfile } from '../contracts/child-profile.js';
import type { MasteryRecord } from '../contracts/mastery-record.js';
import type { SessionSummary } from '../shared/types.js';
import { MasteryLevel, ActivityType } from '../shared/enums.js';

/**
 * Postgres implementation for ChildProfile, MasteryRecord, and SessionSummary.
 *
 * Phase 16C PII minimization: firstName is NOT persisted.
 * An empty buffer is written to first_name_encrypted and 'friend' is returned on reads.
 * Real encryption (AES-256-GCM) is deferred to a future phase.
 * childId is the only opaque identifier used for analytics linkage.
 *
 * Scale conversion (Patch 7): postgres stores mastery confidence on 0–100 engine scale.
 * ChildProfile uses 0.0–1.0 session scale. Conversion happens here on read/write.
 */
export class PostgresProfileStoreImpl implements PostgresProfileStore {
  private readonly db: { query: <T extends pg.QueryResultRow>(text: string, params?: unknown[]) => Promise<pg.QueryResult<T>> };

  constructor(db: { query: <T extends pg.QueryResultRow>(text: string, params?: unknown[]) => Promise<pg.QueryResult<T>> }) {
    this.db = db;
  }

  async getChildProfile(childId: string, userId: string): Promise<ChildProfile | null> {
    const result = await this.db.query<RawChildProfileRow>(
      `SELECT * FROM kids_brain_child_profiles
       WHERE child_id = $1 AND user_id = $2
       LIMIT 1`,
      [childId, userId],
    );
    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    const masteryRecords = await this.getAllMasteryForChild(childId);
    return rowToProfile(row, masteryRecords);
  }

  async saveChildProfile(profile: ChildProfile): Promise<void> {
    // Phase 16C: do not persist real name — write empty buffer.
    const firstNameBytes = Buffer.alloc(0);
    await this.db.query(
      `INSERT INTO kids_brain_child_profiles (
         child_id, user_id, first_name_encrypted, age_band,
         production_confidence_baseline, l1_dependency_baseline,
         sessions_completed, last_session_date, stt_reliability_estimate,
         high_engagement_topics, preferred_activity_types,
         preferred_character_id, safe_preferences, recent_successes,
         created_at, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       ON CONFLICT (child_id) DO UPDATE SET
         first_name_encrypted = EXCLUDED.first_name_encrypted,
         age_band = EXCLUDED.age_band,
         production_confidence_baseline = EXCLUDED.production_confidence_baseline,
         l1_dependency_baseline = EXCLUDED.l1_dependency_baseline,
         sessions_completed = EXCLUDED.sessions_completed,
         last_session_date = EXCLUDED.last_session_date,
         stt_reliability_estimate = EXCLUDED.stt_reliability_estimate,
         high_engagement_topics = EXCLUDED.high_engagement_topics,
         preferred_activity_types = EXCLUDED.preferred_activity_types,
         preferred_character_id = EXCLUDED.preferred_character_id,
         safe_preferences = EXCLUDED.safe_preferences,
         recent_successes = EXCLUDED.recent_successes,
         updated_at = now()`,
      [
        profile.childId,
        profile.userId,
        firstNameBytes,
        profile.ageBand,
        profile.productionConfidenceBaseline,
        profile.l1DependencyBaseline,
        profile.sessionsCompleted,
        profile.lastSessionDate,
        profile.sttReliabilityEstimate,
        profile.highEngagementTopics,
        profile.preferredActivityTypes,
        profile.preferredCharacterId,
        profile.safePreferences,
        profile.recentSuccesses,
        profile.createdAt,
        profile.updatedAt,
      ],
    );
  }

  async getMasteryRecord(childId: string, itemId: string): Promise<MasteryRecord | null> {
    const result = await this.db.query<RawMasteryRow>(
      `SELECT * FROM kids_brain_mastery_records
       WHERE child_id = $1 AND item_id = $2
       LIMIT 1`,
      [childId, itemId],
    );
    if (result.rows.length === 0) return null;
    return rowToMastery(result.rows[0]);
  }

  async saveMasteryRecord(record: MasteryRecord & { childId: string }): Promise<void> {
    await this.db.query(
      `INSERT INTO kids_brain_mastery_records (
         child_id, item_id, mastery_level,
         production_confidence, comprehension_confidence,
         correct_production_count, correct_comprehension_count,
         sessions_seen, sessions_with_correct_production,
         prompted_correct_count, unprompted_correct_count,
         activity_types_succeeded,
         last_seen_at, last_correct_at, review_due_at,
         introduced_at, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       ON CONFLICT (child_id, item_id) DO UPDATE SET
         mastery_level = EXCLUDED.mastery_level,
         production_confidence = EXCLUDED.production_confidence,
         comprehension_confidence = EXCLUDED.comprehension_confidence,
         correct_production_count = EXCLUDED.correct_production_count,
         correct_comprehension_count = EXCLUDED.correct_comprehension_count,
         sessions_seen = EXCLUDED.sessions_seen,
         sessions_with_correct_production = EXCLUDED.sessions_with_correct_production,
         prompted_correct_count = EXCLUDED.prompted_correct_count,
         unprompted_correct_count = EXCLUDED.unprompted_correct_count,
         activity_types_succeeded = EXCLUDED.activity_types_succeeded,
         last_seen_at = EXCLUDED.last_seen_at,
         last_correct_at = EXCLUDED.last_correct_at,
         review_due_at = EXCLUDED.review_due_at,
         updated_at = now()`,
      [
        record.childId,
        record.itemId,
        record.masteryLevel,
        record.productionConfidence,       // already on 0–100 engine scale
        record.comprehensionConfidence,    // already on 0–100 engine scale
        record.correctProductionCount,
        record.correctComprehensionCount,
        record.sessionsSeen,
        record.sessionsWithCorrectProduction,
        record.promptedCorrectCount,
        record.unpromptedCorrectCount,
        record.activityTypesSucceeded,
        record.lastSeenAt,
        record.lastCorrectAt,
        record.reviewDueAt,
        record.introducedAt,
        record.updatedAt,
      ],
    );
  }

  async saveSessionSummary(summary: SessionSummary): Promise<void> {
    await this.db.query(
      `INSERT INTO kids_brain_session_summaries (
         session_id, child_id, started_at, ended_at, duration_seconds,
         stop_reason, lesson_id, lesson_phase_reached,
         items_attempted_count, items_mastered_ids,
         recovery_event_count, l1_rescue_used, speaking_turns_count,
         completion_rate, final_emotional_safety, parent_review_flagged,
         created_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,now())
       ON CONFLICT (session_id) DO NOTHING`,
      [
        summary.sessionId,
        summary.childId,
        summary.startedAt,
        summary.endedAt,
        summary.durationSeconds,
        summary.stopReason,
        summary.lessonId,
        summary.lessonPhaseReached,
        summary.itemsAttemptedCount,
        summary.itemsMasteredIds,
        summary.recoveryEventCount,
        summary.l1RescueUsed,
        summary.speakingTurnsCount,
        summary.completionRate,
        summary.finalEmotionalSafety,
        summary.parentReviewFlagged,
      ],
    );
  }

  // ── Internal helpers ───────────────────────────────────────────────────────

  private async getAllMasteryForChild(childId: string): Promise<Map<string, MasteryRecord>> {
    const result = await this.db.query<RawMasteryRow>(
      `SELECT * FROM kids_brain_mastery_records WHERE child_id = $1`,
      [childId],
    );
    const map = new Map<string, MasteryRecord>();
    for (const row of result.rows) {
      const record = rowToMastery(row);
      map.set(record.itemId, record);
    }
    return map;
  }
}

// ── Row mappers ───────────────────────────────────────────────────────────────

interface RawChildProfileRow extends pg.QueryResultRow {
  child_id: string;
  user_id: string;
  first_name_encrypted: Buffer;
  age_band: string;
  production_confidence_baseline: string;
  l1_dependency_baseline: string;
  sessions_completed: number;
  last_session_date: Date | null;
  stt_reliability_estimate: string;
  high_engagement_topics: string[] | null;
  preferred_activity_types: string[] | null;
  preferred_character_id: string | null;
  safe_preferences: boolean;
  recent_successes: string[];
  created_at: Date;
  updated_at: Date;
}

interface RawMasteryRow extends pg.QueryResultRow {
  id: string;
  child_id: string;
  item_id: string;
  mastery_level: string;
  production_confidence: string;
  comprehension_confidence: string;
  correct_production_count: number;
  correct_comprehension_count: number;
  sessions_seen: number;
  sessions_with_correct_production: number;
  prompted_correct_count: number;
  unprompted_correct_count: number;
  activity_types_succeeded: string[];
  last_seen_at: Date | null;
  last_correct_at: Date | null;
  review_due_at: Date | null;
  introduced_lesson_id: string | null;
  introduced_at: Date;
  updated_at: Date;
}

function rowToProfile(row: RawChildProfileRow, mastery: Map<string, MasteryRecord>): ChildProfile {
  return {
    childId: row.child_id,
    userId: row.user_id,
    firstName: 'friend', // Phase 16C: real name not decoded — display-safe fallback only
    ageBand: row.age_band as ChildProfile['ageBand'],
    productionConfidenceBaseline: parseFloat(row.production_confidence_baseline),
    l1DependencyBaseline: parseFloat(row.l1_dependency_baseline),
    sessionsCompleted: row.sessions_completed,
    lastSessionDate: row.last_session_date ? row.last_session_date.toISOString().split('T')[0] : null,
    sttReliabilityEstimate: parseFloat(row.stt_reliability_estimate),
    highEngagementTopics: row.high_engagement_topics ?? [],
    preferredActivityTypes: (row.preferred_activity_types ?? []) as ActivityType[],
    preferredCharacterId: row.preferred_character_id,
    safePreferences: row.safe_preferences,
    recentSuccesses: row.recent_successes ?? [],
    vocabularyMastery: mastery,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function rowToMastery(row: RawMasteryRow): MasteryRecord {
  return {
    itemId: row.item_id,
    masteryLevel: row.mastery_level as MasteryLevel,
    productionConfidence: parseFloat(row.production_confidence),
    comprehensionConfidence: parseFloat(row.comprehension_confidence),
    correctProductionCount: row.correct_production_count,
    correctComprehensionCount: row.correct_comprehension_count,
    sessionsSeen: row.sessions_seen,
    sessionsWithCorrectProduction: row.sessions_with_correct_production,
    promptedCorrectCount: row.prompted_correct_count,
    unpromptedCorrectCount: row.unprompted_correct_count,
    activityTypesSucceeded: (row.activity_types_succeeded ?? []) as ActivityType[],
    lastSeenAt: row.last_seen_at ? row.last_seen_at.toISOString() : null,
    lastCorrectAt: row.last_correct_at ? row.last_correct_at.toISOString() : null,
    reviewDueAt: row.review_due_at ? row.review_due_at.toISOString() : null,
    introducedAt: row.introduced_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    // Session-ephemeral fields — reset to defaults on load from DB
    sessionAttemptCount: 0,
    sessionModelGiven: false,
    sessionL1AnchorUsed: false,
    sessionMasteryDelta: 0,
  };
}
