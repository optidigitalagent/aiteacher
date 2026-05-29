import type { MasteryLevel, ActivityType } from '../shared/enums.js';
import type { EngineScore } from '../shared/score.js';

/**
 * Cross-session mastery state for a single vocabulary item — Patch 11 §7.4.
 * Persisted to Postgres. Session-ephemeral fields (session_*) are not written to DB.
 */
export interface MasteryRecord {
  itemId: string;
  masteryLevel: MasteryLevel;

  // Confidence scores — 0–100 canonical Learning Engine scale (Patch 7)
  productionConfidence: EngineScore;
  comprehensionConfidence: EngineScore;

  // Evidence counters
  correctProductionCount: number;
  correctComprehensionCount: number;
  sessionsSeen: number;
  sessionsWithCorrectProduction: number;
  promptedCorrectCount: number;
  unpromptedCorrectCount: number;
  activityTypesSucceeded: ActivityType[];

  // Timestamps (ISO 8601)
  lastSeenAt: string | null;
  lastCorrectAt: string | null;
  reviewDueAt: string | null;
  introducedAt: string;
  updatedAt: string;

  // Session-ephemeral fields (not persisted; reset at session start)
  sessionAttemptCount: number;
  sessionModelGiven: boolean;
  sessionL1AnchorUsed: boolean;
  sessionMasteryDelta: number; // Accumulated delta; committed at session end
}
