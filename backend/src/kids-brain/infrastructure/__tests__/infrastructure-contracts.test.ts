import { describe, it, expect, vi, beforeEach } from 'vitest';
import { existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { RedisSessionStoreImpl, KIDS_SESSION_KEY_PREFIX } from '../redis-session.store.js';
import { PostgresProfileStoreImpl } from '../postgres-profile.store.js';
import { PostgresSafetyEventStoreImpl } from '../postgres-safety-event.store.js';
import type { SessionMemory } from '../../contracts/session-memory.js';
import type { ChildProfile } from '../../contracts/child-profile.js';
import type { MasteryRecord } from '../../contracts/mastery-record.js';
import type { SafetyEvent } from '../../shared/types.js';
import { AgeBand, ActivityType, MasteryLevel, RecoveryState, LessonPhase, ClassificationLabel } from '../../shared/enums.js';
import type { ChildState } from '../../state/child-state.js';
import type { ItemState } from '../../state/item-state.js';

// ── 1. Migration files exist ──────────────────────────────────────────────────

describe('migrations 019–022 exist', () => {
  const migrationsDir = resolve(__dirname, '../../../../migrations');

  it.each([
    '019_kids_child_profiles.sql',
    '020_kids_mastery_records.sql',
    '021_kids_session_summaries.sql',
    '022_kids_safety_events.sql',
  ])('migration file %s exists', (filename) => {
    expect(existsSync(join(migrationsDir, filename))).toBe(true);
  });
});

// ── 2. Migration loader includes 019–022 ──────────────────────────────────────

describe('migration loaders include kids brain migrations', () => {
  it('migrate.ts includes all four kids brain migrations', async () => {
    const migratePath = resolve(__dirname, '../../../db/migrate.ts');
    const { readFileSync } = await import('node:fs');
    const content = readFileSync(migratePath, 'utf-8');
    expect(content).toContain('019_kids_child_profiles.sql');
    expect(content).toContain('020_kids_mastery_records.sql');
    expect(content).toContain('021_kids_session_summaries.sql');
    expect(content).toContain('022_kids_safety_events.sql');
  });

  it('postgres.ts includes all four kids brain migrations', async () => {
    const postgresPath = resolve(__dirname, '../../../db/postgres.ts');
    const { readFileSync } = await import('node:fs');
    const content = readFileSync(postgresPath, 'utf-8');
    expect(content).toContain('019_kids_child_profiles.sql');
    expect(content).toContain('020_kids_mastery_records.sql');
    expect(content).toContain('021_kids_session_summaries.sql');
    expect(content).toContain('022_kids_safety_events.sql');
  });
});

// ── 3. Redis store serializes/deserializes SessionMemory ─────────────────────

function makeChildState(): ChildState {
  return {
    comprehensionConfidence: 0.5,
    productionConfidence: 0.3,
    pronunciationConfidence: 0.4,
    emotionalSafety: 0.75,
    engagementLevel: 0.65,
    frustrationRisk: 0.05,
    sessionStamina: 1.0,
    activityFatigue: 0.0,
    l1Dependency: 0.2,
    recentSuccessCount: 0,
    recentFailureCount: 0,
    recoveryLevel: RecoveryState.NORMAL,
    noveltyNeed: 0.0,
    refusalRisk: 0.0,
  };
}

function makeItemState(itemId: string): ItemState {
  return {
    itemId,
    itemMastery: 0.0,
    attemptCount: 0,
    modelGiven: false,
    l1AnchorUsed: false,
    comprehensionNotEstablishedThisSession: false,
    correctAttempts: 0,
    promptedCorrectAttempts: 0,
    unpromptedCorrectAttempts: 0,
    l1Responses: 0,
    silenceCount: 0,
    lastClassification: null,
    lastSeenAt: null,
  };
}

function makeSessionMemory(sessionId = 'test-session-id', userId = 'test-user-id'): SessionMemory {
  const itemState = new Map<string, ItemState>();
  itemState.set('dog', makeItemState('dog'));
  itemState.set('cat', makeItemState('cat'));

  return {
    sessionId,
    userId,
    childId: 'test-child-id',
    mode: 'mentium_kids',
    ageProfile: {
      ageBand: AgeBand.SIX_SEVEN,
      maxSessionSeconds: 1500,
      maxDailyMinutes: 25,
      sttChildSpeechPrior: 0.85,
      maxSilenceBeforeActMs: 3000,
      maxWordsPerSentence: 10,
      maxClauses: 1,
    },
    ageBand: AgeBand.SIX_SEVEN,
    currentUnitId: 'unit-1',
    currentActivityId: ActivityType.REPEAT_AFTER_ME,
    currentTargetItemId: 'dog',
    currentItemAttemptCount: 0,
    lessonPhase: LessonPhase.WARM_UP,
    childState: makeChildState(),
    recoveryState: RecoveryState.NORMAL,
    itemState,
    recentTurns: [],
    activityHistory: [],
    itemsAttempted: [],
    itemsMastered: [],
    recentPraisePhrases: [],
    l1AnchorUsedItems: [],
    l1BudgetUsed: false,
    playAlongCount: 0,
    costCounters: {
      tokensGenerated: 0,
      llmCallsClassification: 0,
      llmCallsTeacherResponse: 0,
      sttSeconds: 0,
      ttsCharacters: 0,
      turnCount: 0,
    },
    autosaveSequenceNumber: 1,
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    sessionElapsedMs: 0,
    turnNumber: 0,
  };
}

function makeRedisMock() {
  const store = new Map<string, string>();

  return {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    set: vi.fn(async (key: string, value: string, ..._args: unknown[]) => {
      store.set(key, value);
      return 'OK';
    }),
    del: vi.fn(async (key: string) => {
      store.delete(key);
      return 1;
    }),
    eval: vi.fn(async (_script: string, _numkeys: number, key: string, value: string, ttl: string, seq: string) => {
      const raw = store.get(key);
      if (!raw) {
        store.set(key, value);
        return 1;
      }
      const parsed = JSON.parse(raw) as { autosaveSequenceNumber?: number };
      const storedSeq = parsed.autosaveSequenceNumber ?? 0;
      if (storedSeq < Number(seq)) {
        store.set(key, value);
        return 1;
      }
      return 0;
    }),
    _store: store,
  };
}

describe('RedisSessionStore', () => {
  it('serializes and deserializes SessionMemory including Map<string, ItemState>', async () => {
    const redisMock = makeRedisMock();
    const store = new RedisSessionStoreImpl(redisMock as unknown as import('ioredis').Redis);
    const session = makeSessionMemory();

    await store.saveSession(session);
    const loaded = await store.getSession(session.sessionId);

    expect(loaded).not.toBeNull();
    expect(loaded!.sessionId).toBe(session.sessionId);
    expect(loaded!.itemState).toBeInstanceOf(Map);
    expect(loaded!.itemState.has('dog')).toBe(true);
    expect(loaded!.itemState.has('cat')).toBe(true);
    expect(loaded!.itemState.get('dog')!.itemId).toBe('dog');
  });

  it('returns null for non-existent session', async () => {
    const redisMock = makeRedisMock();
    const store = new RedisSessionStoreImpl(redisMock as unknown as import('ioredis').Redis);
    const result = await store.getSession('does-not-exist');
    expect(result).toBeNull();
  });

  it('uses kids:session: key prefix', async () => {
    const redisMock = makeRedisMock();
    const store = new RedisSessionStoreImpl(redisMock as unknown as import('ioredis').Redis);
    const session = makeSessionMemory('my-session');
    await store.saveSession(session);
    expect(redisMock.set.mock.calls[0][0]).toBe(`${KIDS_SESSION_KEY_PREFIX}my-session`);
  });

  it('deleteSession removes the key', async () => {
    const redisMock = makeRedisMock();
    const store = new RedisSessionStoreImpl(redisMock as unknown as import('ioredis').Redis);
    const session = makeSessionMemory();
    await store.saveSession(session);
    await store.deleteSession(session.sessionId);
    expect(redisMock.del).toHaveBeenCalledWith(`${KIDS_SESSION_KEY_PREFIX}${session.sessionId}`);
    const result = await store.getSession(session.sessionId);
    expect(result).toBeNull();
  });
});

// ── 4. Redis reconnect rejects wrong userId ───────────────────────────────────

describe('RedisSessionStore reconnect ownership', () => {
  it('returns session when userId matches', async () => {
    const redisMock = makeRedisMock();
    const store = new RedisSessionStoreImpl(redisMock as unknown as import('ioredis').Redis);
    const session = makeSessionMemory('sess-1', 'owner-user');
    await store.saveSession(session);

    const result = await store.reconnectSession('sess-1', 'owner-user');
    expect(result).not.toBeNull();
    expect(result!.userId).toBe('owner-user');
  });

  it('returns null when userId does not match', async () => {
    const redisMock = makeRedisMock();
    const store = new RedisSessionStoreImpl(redisMock as unknown as import('ioredis').Redis);
    const session = makeSessionMemory('sess-2', 'owner-user');
    await store.saveSession(session);

    const result = await store.reconnectSession('sess-2', 'attacker-user');
    expect(result).toBeNull();
  });

  it('returns null for missing session', async () => {
    const redisMock = makeRedisMock();
    const store = new RedisSessionStoreImpl(redisMock as unknown as import('ioredis').Redis);
    const result = await store.reconnectSession('nonexistent', 'any-user');
    expect(result).toBeNull();
  });
});

// ── 5. Redis autosave sequence prevents stale overwrite ───────────────────────

describe('RedisSessionStore autosave sequence guard', () => {
  it('writes when no existing session', async () => {
    const redisMock = makeRedisMock();
    const store = new RedisSessionStoreImpl(redisMock as unknown as import('ioredis').Redis);
    const session = makeSessionMemory();
    await store.autosaveSession(session, 1);
    const loaded = await store.getSession(session.sessionId);
    expect(loaded).not.toBeNull();
  });

  it('writes when incoming sequenceNumber is higher than stored', async () => {
    const redisMock = makeRedisMock();
    const store = new RedisSessionStoreImpl(redisMock as unknown as import('ioredis').Redis);

    const session = makeSessionMemory();
    session.autosaveSequenceNumber = 5;
    await store.saveSession(session);

    const updatedSession = { ...session, autosaveSequenceNumber: 10, turnNumber: 10 };
    updatedSession.itemState = session.itemState;
    await store.autosaveSession(updatedSession as SessionMemory, 10);

    const loaded = await store.getSession(session.sessionId);
    expect(loaded!.turnNumber).toBe(10);
  });

  it('does not overwrite when incoming sequenceNumber is lower than stored', async () => {
    const redisMock = makeRedisMock();
    const store = new RedisSessionStoreImpl(redisMock as unknown as import('ioredis').Redis);

    const session = makeSessionMemory();
    session.autosaveSequenceNumber = 10;
    session.turnNumber = 10;
    await store.saveSession(session);

    const staleSession = { ...session, autosaveSequenceNumber: 3, turnNumber: 3 };
    staleSession.itemState = session.itemState;
    await store.autosaveSession(staleSession as SessionMemory, 3);

    const loaded = await store.getSession(session.sessionId);
    expect(loaded!.turnNumber).toBe(10); // stale write was blocked
  });
});

// ── 6. Postgres profile store maps ChildProfile safely ────────────────────────

type MockDb = { query: ReturnType<typeof vi.fn> };

function makeQueryMock(rows: unknown[] = []): MockDb {
  return {
    query: vi.fn(async () => ({ rows, rowCount: rows.length })),
  };
}

function makeProfileStore(db: MockDb): PostgresProfileStoreImpl {
  return new PostgresProfileStoreImpl(db as unknown as ConstructorParameters<typeof PostgresProfileStoreImpl>[0]);
}

function makeSafetyStore(db: MockDb): PostgresSafetyEventStoreImpl {
  return new PostgresSafetyEventStoreImpl(db as unknown as ConstructorParameters<typeof PostgresSafetyEventStoreImpl>[0]);
}

describe('PostgresProfileStore', () => {
  it('saveChildProfile calls INSERT with correct fields', async () => {
    const db = makeQueryMock([]);
    const store = makeProfileStore(db);

    const profile: ChildProfile = {
      childId: 'child-uuid',
      userId: 'user-uuid',
      firstName: 'Sasha',
      ageBand: AgeBand.SIX_SEVEN,
      productionConfidenceBaseline: 0.3,
      l1DependencyBaseline: 0.2,
      sessionsCompleted: 0,
      lastSessionDate: null,
      sttReliabilityEstimate: 0.72,
      highEngagementTopics: ['animals'],
      preferredActivityTypes: [],
      preferredCharacterId: null,
      safePreferences: true,
      recentSuccesses: [],
      vocabularyMastery: new Map(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await store.saveChildProfile(profile);
    expect(db.query).toHaveBeenCalled();
    const calls = db.query.mock.calls as unknown[][];
    const [sql, params] = calls[0] as [string, unknown[]];
    expect(String(sql)).toContain('kids_brain_child_profiles');
    expect((params as unknown[]).includes('child-uuid')).toBe(true);
    // firstName should be stored as buffer (no plaintext PII in param string)
    const firstNameParam = (params as unknown[])[2];
    expect(Buffer.isBuffer(firstNameParam)).toBe(true);
    expect((firstNameParam as Buffer).toString('utf-8')).toBe('Sasha');
  });

  it('getChildProfile returns null when no row found', async () => {
    const db = makeQueryMock([]);
    const store = makeProfileStore(db);
    const result = await store.getChildProfile('missing-child', 'user-uuid');
    expect(result).toBeNull();
  });
});

// ── 7. Postgres mastery store maps MasteryRecord safely ───────────────────────

describe('PostgresProfileStore mastery', () => {
  it('saveMasteryRecord calls INSERT with child_id and item_id', async () => {
    const db = makeQueryMock([]);
    const store = makeProfileStore(db);

    const record: MasteryRecord & { childId: string } = {
      childId: 'child-uuid',
      itemId: 'dog',
      masteryLevel: MasteryLevel.EMERGING,
      productionConfidence: 20,
      comprehensionConfidence: 30,
      correctProductionCount: 0,
      correctComprehensionCount: 0,
      sessionsSeen: 1,
      sessionsWithCorrectProduction: 0,
      promptedCorrectCount: 0,
      unpromptedCorrectCount: 0,
      activityTypesSucceeded: [],
      lastSeenAt: null,
      lastCorrectAt: null,
      reviewDueAt: null,
      introducedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sessionAttemptCount: 0,
      sessionModelGiven: false,
      sessionL1AnchorUsed: false,
      sessionMasteryDelta: 0,
    };

    await store.saveMasteryRecord(record);
    expect(db.query).toHaveBeenCalled();
    const calls = db.query.mock.calls as unknown[][];
    const [sql, params] = calls[0] as [string, unknown[]];
    expect(String(sql)).toContain('kids_brain_mastery_records');
    expect((params as unknown[])[0]).toBe('child-uuid');
    expect((params as unknown[])[1]).toBe('dog');
  });

  it('getMasteryRecord returns null when no row found', async () => {
    const db = makeQueryMock([]);
    const store = makeProfileStore(db);
    const result = await store.getMasteryRecord('child-uuid', 'unknown-item');
    expect(result).toBeNull();
  });
});

// ── 8. Safety event store does not require FK to child_profiles ───────────────

describe('PostgresSafetyEventStore', () => {
  it('createSafetyEvent writes without requiring FK', async () => {
    const db = makeQueryMock([]);
    const store = makeSafetyStore(db);

    const event: SafetyEvent = {
      sessionId: 'session-uuid',
      childId: 'child-uuid-no-profile', // no FK constraint on this table
      eventType: 'unsafe_or_sensitive',
      confidenceScore: 0.95,
      detectionMethod: 'keyword_list',
      reviewStatus: 'pending',
      occurredAt: new Date().toISOString(),
    };

    await store.createSafetyEvent(event);
    expect(db.query).toHaveBeenCalledTimes(1);
    const calls = db.query.mock.calls as unknown[][];
    const [sql] = calls[0] as [string];
    expect(String(sql)).toContain('kids_brain_safety_events');
    // No JOIN or REFERENCES to kids_brain_child_profiles in insert path
    expect(String(sql)).not.toContain('kids_brain_child_profiles');
  });

  it('listSafetyEventsForReview queries pending events', async () => {
    const db = makeQueryMock([]);
    const store = makeSafetyStore(db);

    await store.listSafetyEventsForReview();
    const calls = db.query.mock.calls as unknown[][];
    const [sql] = calls[0] as [string];
    expect(String(sql)).toContain("review_status = 'pending'");
  });
});

// ── 15. Phase 8: lesson-ws.ts wired to Kids Brain v1 ─────────────────────────

describe('Phase 8 wiring: lesson-ws.ts imports kids-brain runtime', () => {
  it('lesson-ws.ts imports kids-brain/runtime (v1) AND retains kids-runtime (fallback)', async () => {
    const { readFileSync } = await import('node:fs');
    const wsPath = resolve(__dirname, '../../../ws/lesson-ws.ts');
    const content = readFileSync(wsPath, 'utf-8');
    // Old fallback preserved
    expect(content).toContain("kids-runtime/orchestrator");
    // New v1 runtime wired
    expect(content).toContain("kids-brain/runtime");
    // Feature flag present
    expect(content).toContain("USE_KIDS_BRAIN_V1");
    // Both session functions present
    expect(content).toContain("handleKidsBrainV1LessonStart");
    expect(content).toContain("processKidsBrainV1Turn");
  });
});

// ── 16. No adult Obsidian imports in kids-brain ───────────────────────────────

describe('adult isolation: no obsidian imports in kids-brain infrastructure', () => {
  const checkFile = (filePath: string) => {
    const { readFileSync } = require('node:fs') as typeof import('node:fs');
    const content = readFileSync(filePath, 'utf-8');
    expect(content).not.toMatch(/obsidian-brain|obsidian\/|teacher-brain|engine\//);
  };

  it('redis-session.store.ts has no adult imports', () => {
    checkFile(resolve(__dirname, '../redis-session.store.ts'));
  });

  it('postgres-profile.store.ts has no adult imports', () => {
    checkFile(resolve(__dirname, '../postgres-profile.store.ts'));
  });

  it('postgres-safety-event.store.ts has no adult imports', () => {
    checkFile(resolve(__dirname, '../postgres-safety-event.store.ts'));
  });
});
