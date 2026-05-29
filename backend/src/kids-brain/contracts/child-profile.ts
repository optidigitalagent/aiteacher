import type { AgeBand, ActivityType } from '../shared/enums.js';
import type { MasteryRecord } from './mastery-record.js';

/**
 * Persistent child profile (§7.3, §12.4, Patch 3 §3A.1).
 * Stored in Postgres with first_name AES-256-GCM encrypted at rest.
 * Must not include raw audio, full transcripts, emotional history, or family data.
 */
export interface ChildProfile {
  childId: string;
  userId: string; // Parent/guardian account reference

  // firstName is decrypted only at session load by postgres-profile.store.ts.
  // Never passed in plain text to LLM context.
  firstName: string;

  ageBand: AgeBand;

  // Baseline confidence scores on 0.0–1.0 session scale
  productionConfidenceBaseline: number;
  l1DependencyBaseline: number;

  // Long-term learning data
  vocabularyMastery: Map<string, MasteryRecord>;
  sessionsCompleted: number;
  lastSessionDate: string | null; // ISO 8601 date
  sttReliabilityEstimate: number; // per-child STT performance [C]
  highEngagementTopics: string[]; // inferred, not stated
  preferredActivityTypes: ActivityType[];

  // UI / character preferences
  preferredCharacterId: string | null;

  // Safe content preferences (parental controls flag set)
  safePreferences: boolean;

  // Snapshot of recent cross-session successes for continuity packet
  recentSuccesses: string[]; // item IDs of recently mastered words (up to 3)

  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}
