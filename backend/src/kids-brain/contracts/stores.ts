import type { SessionMemory } from './session-memory.js';
import type { ChildProfile } from './child-profile.js';
import type { MasteryRecord } from './mastery-record.js';
import type { SessionSummary, SafetyEvent } from '../shared/types.js';

/**
 * Redis store interface for active session state (Patch 1 §1.2).
 * Implementation lives in memory/redis-session.store.ts (Phase 3).
 * In-memory session state is forbidden in production/staging.
 */
export interface RedisSessionStore {
  getSession(sessionId: string): Promise<SessionMemory | null>;
  saveSession(session: SessionMemory): Promise<void>;
  deleteSession(sessionId: string): Promise<void>;
  reconnectSession(
    sessionId: string,
    userId: string,
  ): Promise<SessionMemory | null>;
  autosaveSession(
    session: SessionMemory,
    sequenceNumber: number,
  ): Promise<void>;
}

/**
 * Postgres store interface for durable profile and mastery data (Patch 1 §1.3).
 * Implementation lives in memory/postgres-profile.store.ts (Phase 3).
 */
export interface PostgresProfileStore {
  getChildProfile(childId: string, userId: string): Promise<ChildProfile | null>;
  saveChildProfile(profile: ChildProfile): Promise<void>;
  getMasteryRecord(
    childId: string,
    itemId: string,
  ): Promise<MasteryRecord | null>;
  saveMasteryRecord(record: MasteryRecord & { childId: string }): Promise<void>;
  saveSessionSummary(summary: SessionSummary): Promise<void>;
}

/**
 * Isolated append-only safety event store (Patch 3 §3A.4).
 * Write-accessible by safety/safety-audit-log.ts only.
 * No runtime AI module reads from this store.
 */
export interface SafetyEventStore {
  createSafetyEvent(event: SafetyEvent): Promise<void>;
  listSafetyEventsForReview(): Promise<SafetyEvent[]>;
}
