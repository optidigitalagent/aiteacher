/**
 * Phase 16C — Child PII Protection Tests
 *
 * Verifies:
 * 1. Postgres store does not persist real firstName (empty buffer written)
 * 2. Postgres store returns 'friend' on read (name never decoded)
 * 3. SessionSummary has no firstName — only childId
 * 4. Mastery records have no firstName — only childId
 * 5. childId is preserved in all analytics records
 * 6. Runtime works without childFirstName (optional field)
 * 7. Teacher response context falls back to 'friend' when name omitted
 * 8. lesson-ws.ts passes 'friend' not a real child name
 * 9. SessionMemory schema has no childFirstName field
 * 10. Session start log omits child name
 */

import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  buildSessionSummary,
  buildMasteryRecordsFromSession,
} from '../../analytics/session-analytics.js';
import { buildTeacherResponseContext } from '../runtime-context.js';
import { startKidsBrainSession, processKidsBrainTurn } from '../index.js';
import { PostgresProfileStoreImpl } from '../../infrastructure/postgres-profile.store.js';
import type { SessionMemory } from '../../contracts/session-memory.js';
import type { KidsBrainTurnInput, KidsBrainSessionStartInput } from '../runtime-types.js';
import type { STTResult } from '../../contracts/stt-result.js';
import type { ChildProfile } from '../../contracts/child-profile.js';
import type { ItemState } from '../../state/item-state.js';
import type { ChildState } from '../../state/child-state.js';
import {
  AgeBand,
  ActivityType,
  LessonPhase,
  RecoveryState,
  ClassificationLabel,
} from '../../shared/enums.js';
import { AGE_PROFILE_6_7 } from '../../shared/types.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

const WS_PATH = resolve(__dirname, '../../../ws/lesson-ws.ts');
const WS_CONTENT = readFileSync(WS_PATH, 'utf-8');

const SESSION_MEMORY_PATH = resolve(__dirname, '../../contracts/session-memory.ts');
const SESSION_MEMORY_CONTENT = readFileSync(SESSION_MEMORY_PATH, 'utf-8');

const BOOTSTRAP_PATH = resolve(__dirname, '../session-bootstrap.ts');
const BOOTSTRAP_CONTENT = readFileSync(BOOTSTRAP_PATH, 'utf-8');

function makeChildState(): ChildState {
  return {
    comprehensionConfidence: 0.5,
    productionConfidence: 0.5,
    pronunciationConfidence: 0.5,
    emotionalSafety: 0.8,
    engagementLevel: 0.7,
    frustrationRisk: 0.1,
    sessionStamina: 1.0,
    activityFatigue: 0.0,
    l1Dependency: 0.1,
    recentSuccessCount: 2,
    recentFailureCount: 0,
    recoveryLevel: RecoveryState.NORMAL,
    noveltyNeed: 0.0,
    refusalRisk: 0.0,
  };
}

function makeItemState(itemId: string): ItemState {
  return {
    itemId,
    itemMastery: 0.75,
    attemptCount: 3,
    modelGiven: false,
    l1AnchorUsed: false,
    comprehensionNotEstablishedThisSession: false,
    correctAttempts: 2,
    promptedCorrectAttempts: 1,
    unpromptedCorrectAttempts: 1,
    l1Responses: 0,
    silenceCount: 0,
    lastClassification: null,
    lastSeenAt: '2026-06-01T10:05:00.000Z',
  };
}

function makeSessionMemory(childId = 'child-pii-16c'): SessionMemory {
  const itemState = new Map<string, ItemState>();
  itemState.set('blue', makeItemState('blue'));

  return {
    sessionId: 'session-pii-16c',
    userId: 'user-pii-16c',
    childId,
    mode: 'mentium_kids',
    ageProfile: AGE_PROFILE_6_7,
    ageBand: AgeBand.SIX_SEVEN,
    currentUnitId: null,
    currentActivityId: ActivityType.REPEAT_AFTER_ME,
    currentTargetItemId: 'blue',
    currentItemAttemptCount: 3,
    lessonPhase: LessonPhase.WARM_UP,
    childState: makeChildState(),
    recoveryState: RecoveryState.NORMAL,
    itemState,
    recentTurns: [],
    activityHistory: [],
    itemsAttempted: ['blue'],
    itemsMastered: ['blue'],
    recentPraisePhrases: [],
    l1AnchorUsedItems: [],
    l1BudgetUsed: false,
    playAlongCount: 2,
    costCounters: {
      tokensGenerated: 0,
      llmCallsClassification: 0,
      llmCallsTeacherResponse: 0,
      sttSeconds: 10,
      ttsCharacters: 200,
      turnCount: 5,
    },
    autosaveSequenceNumber: 5,
    hasStartedFirstExercise: true,
    currentExerciseId: null,
    currentExerciseOrder: null,
    exerciseAttemptCount: 0,
    exerciseCorrectCount: 0,
    completedExerciseIds: [],
    startedAt: '2026-06-01T10:00:00.000Z',
    updatedAt: '2026-06-01T10:05:00.000Z',
    sessionElapsedMs: 300000,
    turnNumber: 5,
  };
}

function makeStt(text: string): STTResult {
  return {
    text,
    confidence: 0.9,
    languageCode: 'en-US',
    alternatives: [],
    speechStartMs: 100,
    speechEndMs: 900,
    speechDurationMs: 800,
    audioEnergyLevel: 0.8,
    provider: 'google_chirp_v2',
    providerRequestId: 'pii-test',
    processingLatencyMs: 50,
  };
}

function makeTurnInput(mem: SessionMemory, overrides: Partial<KidsBrainTurnInput> = {}): KidsBrainTurnInput {
  return {
    sessionMemory: mem,
    sttResult: makeStt('blue'),
    responseLatencyMs: 500,
    silenceDurationMs: 0,
    attemptCount: 1,
    targetWord: 'blue',
    lessonTargetWords: ['blue', 'red', 'green'],
    unitReviewWords: [],
    characterNames: ['milo'],
    timestamp: '2026-06-01T10:05:00.000Z',
    ...overrides,
  };
}

function makeProfileStore(mockDb: { query: ReturnType<typeof vi.fn> }): PostgresProfileStoreImpl {
  return new PostgresProfileStoreImpl(mockDb as unknown as ConstructorParameters<typeof PostgresProfileStoreImpl>[0]);
}

// ── 1. Postgres store: save does not persist real name ────────────────────────

describe('PII guard: postgres store does not persist real firstName', () => {
  it('saveChildProfile writes empty buffer for first_name_encrypted', async () => {
    const db = { query: vi.fn(async () => ({ rows: [], rowCount: 0 })) };
    const store = makeProfileStore(db);

    const profile: ChildProfile = {
      childId: 'child-uuid',
      userId: 'user-uuid',
      firstName: 'Sophia', // real child name — must NOT reach the DB
      ageBand: AgeBand.SIX_SEVEN,
      productionConfidenceBaseline: 0.3,
      l1DependencyBaseline: 0.2,
      sessionsCompleted: 0,
      lastSessionDate: null,
      sttReliabilityEstimate: 0.72,
      highEngagementTopics: [],
      preferredActivityTypes: [],
      preferredCharacterId: null,
      safePreferences: true,
      recentSuccesses: [],
      vocabularyMastery: new Map(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await store.saveChildProfile(profile);

    const calls = db.query.mock.calls as unknown[][];
    const [, params] = calls[0] as [string, unknown[]];
    const firstNameParam = (params as unknown[])[2];

    expect(Buffer.isBuffer(firstNameParam)).toBe(true);
    expect((firstNameParam as Buffer).length).toBe(0); // name NOT stored
  });

  it('saveChildProfile does not include real name string in SQL params', async () => {
    const db = { query: vi.fn(async () => ({ rows: [], rowCount: 0 })) };
    const store = makeProfileStore(db);

    const profile: ChildProfile = {
      childId: 'child-uuid',
      userId: 'user-uuid',
      firstName: 'Anastasia',
      ageBand: AgeBand.SIX_SEVEN,
      productionConfidenceBaseline: 0.3,
      l1DependencyBaseline: 0.2,
      sessionsCompleted: 0,
      lastSessionDate: null,
      sttReliabilityEstimate: 0.72,
      highEngagementTopics: [],
      preferredActivityTypes: [],
      preferredCharacterId: null,
      safePreferences: true,
      recentSuccesses: [],
      vocabularyMastery: new Map(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await store.saveChildProfile(profile);

    const calls = db.query.mock.calls as unknown[][];
    const [, params] = calls[0] as [string, unknown[]];
    // No string param in the list should be the real child name
    const stringParams = (params as unknown[]).filter(p => typeof p === 'string');
    expect(stringParams).not.toContain('Anastasia');
  });
});

// ── 2. Postgres store: read returns 'friend' ──────────────────────────────────

describe('PII guard: postgres store returns "friend" on getChildProfile', () => {
  it('returns firstName as "friend" regardless of stored bytes', async () => {
    const profileRow = {
      child_id: 'child-uuid',
      user_id: 'user-uuid',
      first_name_encrypted: Buffer.from('Sophia', 'utf-8'), // old storage with a real name
      age_band: 'six_seven',
      production_confidence_baseline: '0.3',
      l1_dependency_baseline: '0.2',
      sessions_completed: 1,
      last_session_date: null,
      stt_reliability_estimate: '0.72',
      high_engagement_topics: [],
      preferred_activity_types: [],
      preferred_character_id: null,
      safe_preferences: true,
      recent_successes: [],
      created_at: new Date(),
      updated_at: new Date(),
    };
    const db = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [profileRow], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }),
    };
    const store = makeProfileStore(db as unknown as { query: ReturnType<typeof vi.fn> });
    const result = await store.getChildProfile('child-uuid', 'user-uuid');

    expect(result).not.toBeNull();
    expect(result!.firstName).toBe('friend');
  });

  it('returns childId unchanged (opaque identifier preserved)', async () => {
    const profileRow = {
      child_id: 'child-opaque-id-abc123',
      user_id: 'user-uuid',
      first_name_encrypted: Buffer.from('Mia', 'utf-8'),
      age_band: 'six_seven',
      production_confidence_baseline: '0.3',
      l1_dependency_baseline: '0.2',
      sessions_completed: 2,
      last_session_date: null,
      stt_reliability_estimate: '0.72',
      high_engagement_topics: [],
      preferred_activity_types: [],
      preferred_character_id: null,
      safe_preferences: true,
      recent_successes: [],
      created_at: new Date(),
      updated_at: new Date(),
    };
    const db = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [profileRow], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }),
    };
    const store = makeProfileStore(db as unknown as { query: ReturnType<typeof vi.fn> });
    const result = await store.getChildProfile('child-opaque-id-abc123', 'user-uuid');

    expect(result).not.toBeNull();
    expect(result!.childId).toBe('child-opaque-id-abc123'); // opaque ID preserved
    expect(result!.firstName).toBe('friend');               // real name never exposed
  });
});

// ── 3. Analytics: SessionSummary has no firstName ─────────────────────────────

describe('PII guard: SessionSummary contains no firstName', () => {
  it('buildSessionSummary result has no firstName property', () => {
    const mem = makeSessionMemory('child-pii-16c');
    const summary = buildSessionSummary(mem, 'completed', new Date().toISOString());

    expect('firstName' in summary).toBe(false);
    expect('childFirstName' in summary).toBe(false);
  });

  it('buildSessionSummary stores only childId for person linkage', () => {
    const mem = makeSessionMemory('child-analytics-id-xyz');
    const summary = buildSessionSummary(mem, 'completed', new Date().toISOString());

    expect(summary.childId).toBe('child-analytics-id-xyz');
  });
});

// ── 4. Analytics: mastery records have no firstName ───────────────────────────

describe('PII guard: mastery records contain no firstName', () => {
  it('buildMasteryRecordsFromSession records have no firstName property', () => {
    const mem = makeSessionMemory('child-pii-16c');
    const records = buildMasteryRecordsFromSession(mem);

    for (const record of records) {
      expect('firstName' in record).toBe(false);
      expect('childFirstName' in record).toBe(false);
    }
  });

  it('buildMasteryRecordsFromSession records store only childId', () => {
    const mem = makeSessionMemory('child-mastery-id-abc');
    const records = buildMasteryRecordsFromSession(mem);

    expect(records.length).toBeGreaterThan(0);
    for (const record of records) {
      expect(record.childId).toBe('child-mastery-id-abc');
    }
  });
});

// ── 5. childId preserved across analytics ────────────────────────────────────

describe('PII guard: childId preserved for analytics linkage', () => {
  it('SessionSummary childId matches session memory childId', () => {
    const mem = makeSessionMemory('child-link-test');
    const summary = buildSessionSummary(mem, 'completed', new Date().toISOString());
    expect(summary.childId).toBe(mem.childId);
  });

  it('mastery record childIds match session memory childId', () => {
    const mem = makeSessionMemory('child-link-test');
    const records = buildMasteryRecordsFromSession(mem);
    for (const record of records) {
      expect(record.childId).toBe(mem.childId);
    }
  });
});

// ── 6. Runtime: works without childFirstName ─────────────────────────────────

describe('PII guard: runtime works without childFirstName', () => {
  it('processKidsBrainTurn completes without childFirstName provided', async () => {
    const startInput: KidsBrainSessionStartInput = {
      sessionId: 'pii-no-name-session',
      userId: 'user-pii',
      childId: 'child-pii',
      childFirstName: 'friend', // lesson-ws always passes this
      ageBand: AgeBand.SIX_SEVEN,
      ageProfile: AGE_PROFILE_6_7,
      lessonTargetWords: ['blue', 'red'],
      unitReviewWords: [],
      characterNames: ['milo'],
      timestamp: '2026-06-01T10:00:00.000Z',
    };
    const startResult = startKidsBrainSession(startInput);
    const mem = startResult.sessionMemory;

    // Turn input with NO childFirstName (omitted entirely)
    const turnInput = makeTurnInput(mem); // no childFirstName key

    const result = await processKidsBrainTurn(turnInput);

    expect(result.safeToContinue).toBeDefined();
    expect(result.actionPackets.length).toBeGreaterThan(0);
  });

  it('processKidsBrainTurn does not include child name in logsToEmit payloads', async () => {
    const startInput: KidsBrainSessionStartInput = {
      sessionId: 'pii-log-check',
      userId: 'user-pii',
      childId: 'child-pii',
      childFirstName: 'friend',
      ageBand: AgeBand.SIX_SEVEN,
      ageProfile: AGE_PROFILE_6_7,
      lessonTargetWords: ['blue'],
      unitReviewWords: [],
      characterNames: ['milo'],
      timestamp: '2026-06-01T10:00:00.000Z',
    };
    const startResult = startKidsBrainSession(startInput);
    const mem = { ...startResult.sessionMemory, hasStartedFirstExercise: true };

    const turnInput = makeTurnInput(mem);
    const result = await processKidsBrainTurn(turnInput);

    for (const log of result.logsToEmit) {
      const payloadStr = JSON.stringify(log.payload);
      // No real child name in any log payload
      expect(payloadStr).not.toContain('Sophia');
      expect(payloadStr).not.toContain('Mia');
      expect(payloadStr).not.toContain('Anastasia');
    }
  });
});

// ── 7. Teacher response context: 'friend' fallback ───────────────────────────

describe('PII guard: teacher response context uses friend fallback', () => {
  it('childFirstName defaults to "friend" when omitted from turn input', () => {
    const mem = makeSessionMemory();
    const input = makeTurnInput(mem); // no childFirstName
    const ctx = buildTeacherResponseContext(input, mem, 0, ClassificationLabel.CORRECT_CONFIDENT);
    expect(ctx.childFirstName).toBe('friend');
  });

  it('childFirstName is "friend" when explicitly passed as "friend"', () => {
    const mem = makeSessionMemory();
    const input = makeTurnInput(mem, { childFirstName: 'friend' });
    const ctx = buildTeacherResponseContext(input, mem, 0, ClassificationLabel.CORRECT_CONFIDENT);
    expect(ctx.childFirstName).toBe('friend');
  });
});

// ── 8. lesson-ws.ts: passes 'friend' not a real name ─────────────────────────

describe('PII guard: lesson-ws.ts uses display-safe name only', () => {
  it('all Kids Brain childFirstName usages in lesson-ws pass "friend"', () => {
    // Extract all childFirstName: '...' patterns in the Kids Brain WS section
    const matches = [...WS_CONTENT.matchAll(/childFirstName\s*:\s*['"]([^'"]+)['"]/g)];
    expect(matches.length).toBeGreaterThan(0);
    for (const match of matches) {
      expect(match[1]).toBe('friend');
    }
  });

  it('lesson-ws.ts does not contain any hardcoded real child names', () => {
    // Common real names that should never appear in production WS code
    const forbiddenNames = ['Sophia', 'Mia', 'Lily', 'Alex', 'Sasha', 'Leo'];
    for (const name of forbiddenNames) {
      expect(WS_CONTENT).not.toContain(`childFirstName: '${name}'`);
    }
  });
});

// ── 9. SessionMemory schema: no childFirstName field ─────────────────────────

describe('PII guard: SessionMemory schema has no childFirstName', () => {
  it('session-memory.ts interface does not declare childFirstName', () => {
    expect(SESSION_MEMORY_CONTENT).not.toContain('childFirstName');
  });

  it('session-memory.ts stores childId (opaque UUID) not a name', () => {
    expect(SESSION_MEMORY_CONTENT).toContain('childId');
  });
});

// ── 10. Session start log: omits child name ───────────────────────────────────

describe('PII guard: session start log omits child name', () => {
  it('KIDS_SESSION_STARTED log payload includes childId but not firstName', () => {
    // The payload block in session-bootstrap must have childId but no firstName/childFirstName
    const logPayloadMatch = BOOTSTRAP_CONTENT.match(/KIDS_SESSION_STARTED[\s\S]{0,500}?payload:\s*\{([\s\S]{0,300}?)\}/);
    expect(logPayloadMatch).not.toBeNull();
    const payloadBlock = logPayloadMatch![1];
    expect(payloadBlock).toContain('childId');
    expect(payloadBlock).not.toContain('firstName');
    expect(payloadBlock).not.toContain('childFirstName');
  });

  it('startKidsBrainSession logsToEmit do not include child name in payload', () => {
    const input: KidsBrainSessionStartInput = {
      sessionId: 'pii-start-log',
      userId: 'user-pii',
      childId: 'child-uuid-opaque',
      childFirstName: 'friend', // lesson-ws always passes 'friend'
      ageBand: AgeBand.SIX_SEVEN,
      ageProfile: AGE_PROFILE_6_7,
      lessonTargetWords: ['blue'],
      unitReviewWords: [],
      characterNames: ['milo'],
      timestamp: '2026-06-01T10:00:00.000Z',
    };
    const result = startKidsBrainSession(input);

    for (const log of result.logsToEmit) {
      const payloadStr = JSON.stringify(log.payload);
      expect(payloadStr).not.toContain('friend'); // even 'friend' should not appear in log payload
    }
  });
});
