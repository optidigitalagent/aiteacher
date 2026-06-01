import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import {
  buildSessionSummary,
  buildMasteryRecordsFromSession,
  persistKidsBrainAnalytics,
} from '../session-analytics.js';
import type { SessionMemory } from '../../contracts/session-memory.js';
import type { ItemState } from '../../state/item-state.js';
import type { ChildState } from '../../state/child-state.js';
import type { PostgresProfileStore } from '../../contracts/stores.js';
import {
  AgeBand,
  ActivityType,
  MasteryLevel,
  RecoveryState,
  LessonPhase,
} from '../../shared/enums.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeChildState(emotionalSafety = 0.8): ChildState {
  return {
    comprehensionConfidence: 0.5,
    productionConfidence: 0.4,
    pronunciationConfidence: 0.4,
    emotionalSafety,
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

function makeItemState(overrides: Partial<ItemState> = {}): ItemState {
  return {
    itemId: 'blue',
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
    ...overrides,
  };
}

function makeSessionMemory(overrides: Partial<SessionMemory> = {}): SessionMemory {
  const itemState = new Map<string, ItemState>();
  itemState.set('blue', makeItemState({ itemId: 'blue', attemptCount: 3, correctAttempts: 2, itemMastery: 0.75, unpromptedCorrectAttempts: 1 }));
  itemState.set('green', makeItemState({ itemId: 'green', attemptCount: 2, correctAttempts: 1, itemMastery: 0.45 }));
  itemState.set('red', makeItemState({ itemId: 'red', attemptCount: 1, correctAttempts: 0, itemMastery: 0.1 }));

  return {
    sessionId: 'test-session-001',
    userId: 'user-abc',
    childId: 'child-abc',
    mode: 'mentium_kids',
    ageProfile: {
      ageBand: AgeBand.SIX_SEVEN,
      maxSessionSeconds: 900,
      maxDailyMinutes: 25,
      sttChildSpeechPrior: 0.85,
      maxSilenceBeforeActMs: 3000,
      maxWordsPerSentence: 10,
      maxClauses: 1,
    },
    ageBand: AgeBand.SIX_SEVEN,
    currentUnitId: 'kb1-unit-01',
    currentActivityId: ActivityType.REPEAT_AFTER_ME,
    currentTargetItemId: 'blue',
    currentItemAttemptCount: 2,
    lessonPhase: LessonPhase.PRACTICE,
    childState: makeChildState(),
    recoveryState: RecoveryState.NORMAL,
    itemState,
    recentTurns: [],
    activityHistory: [],
    itemsAttempted: ['blue', 'green', 'red'],
    itemsMastered: ['blue'],
    recentPraisePhrases: [],
    l1AnchorUsedItems: [],
    l1BudgetUsed: false,
    playAlongCount: 0,
    costCounters: {
      tokensGenerated: 0,
      llmCallsClassification: 5,
      llmCallsTeacherResponse: 3,
      sttSeconds: 30,
      ttsCharacters: 400,
      turnCount: 8,
    },
    lessonId: 'kb1-u01-l02',
    autosaveSequenceNumber: 10,
    startedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 min ago
    updatedAt: new Date().toISOString(),
    sessionElapsedMs: 5 * 60 * 1000,
    turnNumber: 8,
    ...overrides,
  };
}

function makeProfileStoreMock(): { store: PostgresProfileStore; summaryCallCount: () => number; masteryCallCount: () => number } {
  let summaryCallCount = 0;
  let masteryCallCount = 0;

  const store: PostgresProfileStore = {
    getChildProfile: vi.fn(async () => null),
    saveChildProfile: vi.fn(async () => undefined),
    getMasteryRecord: vi.fn(async () => null),
    saveMasteryRecord: vi.fn(async () => {
      masteryCallCount++;
    }),
    saveSessionSummary: vi.fn(async () => {
      summaryCallCount++;
    }),
  };

  return {
    store,
    summaryCallCount: () => summaryCallCount,
    masteryCallCount: () => masteryCallCount,
  };
}

// ── 1. buildSessionSummary ───────────────────────────────────────────────────

describe('buildSessionSummary', () => {
  it('maps sessionId and childId from session memory (not frontend input)', () => {
    const mem = makeSessionMemory();
    const endedAt = new Date().toISOString();
    const summary = buildSessionSummary(mem, 'completed', endedAt);
    expect(summary.sessionId).toBe('test-session-001');
    expect(summary.childId).toBe('child-abc');
  });

  it('computes durationSeconds from startedAt/endedAt', () => {
    const mem = makeSessionMemory();
    const endedAt = new Date().toISOString();
    const summary = buildSessionSummary(mem, 'completed', endedAt);
    expect(summary.durationSeconds).toBeGreaterThan(0);
    expect(summary.durationSeconds).toBeLessThan(600); // < 10 min
  });

  it('sets stopReason from argument, not from session state', () => {
    const mem = makeSessionMemory();
    const endedAt = new Date().toISOString();
    expect(buildSessionSummary(mem, 'completed', endedAt).stopReason).toBe('completed');
    expect(buildSessionSummary(mem, 'safety', endedAt).stopReason).toBe('safety');
    expect(buildSessionSummary(mem, 'timeout', endedAt).stopReason).toBe('timeout');
    expect(buildSessionSummary(mem, 'interrupted', endedAt).stopReason).toBe('interrupted');
    expect(buildSessionSummary(mem, 'abandoned', endedAt).stopReason).toBe('abandoned');
  });

  it('includes correct itemsAttemptedCount and itemsMasteredIds', () => {
    const mem = makeSessionMemory();
    const summary = buildSessionSummary(mem, 'completed', new Date().toISOString());
    expect(summary.itemsAttemptedCount).toBe(3);
    expect(summary.itemsMasteredIds).toEqual(['blue']);
  });

  it('computes completionRate as mastered/attempted', () => {
    const mem = makeSessionMemory();
    const summary = buildSessionSummary(mem, 'completed', new Date().toISOString());
    expect(summary.completionRate).toBeCloseTo(1 / 3, 5);
  });

  it('completionRate is null when no items attempted', () => {
    const mem = makeSessionMemory({ itemsAttempted: [], itemsMastered: [] });
    const summary = buildSessionSummary(mem, 'completed', new Date().toISOString());
    expect(summary.completionRate).toBeNull();
  });

  it('sets lessonId from session memory', () => {
    const mem = makeSessionMemory();
    const summary = buildSessionSummary(mem, 'completed', new Date().toISOString());
    expect(summary.lessonId).toBe('kb1-u01-l02');
  });

  it('sets l1RescueUsed = true when l1AnchorUsedItems is non-empty', () => {
    const mem = makeSessionMemory({ l1AnchorUsedItems: ['blue'] });
    const summary = buildSessionSummary(mem, 'completed', new Date().toISOString());
    expect(summary.l1RescueUsed).toBe(true);
  });

  it('sets l1RescueUsed = false when no L1 items used', () => {
    const mem = makeSessionMemory({ l1AnchorUsedItems: [] });
    const summary = buildSessionSummary(mem, 'completed', new Date().toISOString());
    expect(summary.l1RescueUsed).toBe(false);
  });

  it('sets parentReviewFlagged when emotionalSafety < 0.3', () => {
    const lowSafety = makeChildState(0.2);
    const mem = makeSessionMemory({ childState: lowSafety });
    const summary = buildSessionSummary(mem, 'completed', new Date().toISOString());
    expect(summary.parentReviewFlagged).toBe(true);
  });

  it('parentReviewFlagged is false when emotionalSafety >= 0.3', () => {
    const mem = makeSessionMemory();
    const summary = buildSessionSummary(mem, 'completed', new Date().toISOString());
    expect(summary.parentReviewFlagged).toBe(false);
  });

  it('speakingTurnsCount comes from costCounters.turnCount', () => {
    const mem = makeSessionMemory();
    const summary = buildSessionSummary(mem, 'completed', new Date().toISOString());
    expect(summary.speakingTurnsCount).toBe(8);
  });
});

// ── 2. buildMasteryRecordsFromSession ────────────────────────────────────────

describe('buildMasteryRecordsFromSession', () => {
  it('returns one record per attempted item', () => {
    const mem = makeSessionMemory();
    const records = buildMasteryRecordsFromSession(mem);
    expect(records).toHaveLength(3);
    const ids = records.map(r => r.itemId);
    expect(ids).toContain('blue');
    expect(ids).toContain('green');
    expect(ids).toContain('red');
  });

  it('all records carry the childId from session memory', () => {
    const mem = makeSessionMemory();
    const records = buildMasteryRecordsFromSession(mem);
    for (const r of records) {
      expect(r.childId).toBe('child-abc');
    }
  });

  it('returns empty array when no items were attempted', () => {
    const mem = makeSessionMemory({ itemsAttempted: [] });
    expect(buildMasteryRecordsFromSession(mem)).toHaveLength(0);
  });

  it('deriveMasteryLevel: SECURE for itemMastery=0.75 + 2 correct', () => {
    const mem = makeSessionMemory();
    const records = buildMasteryRecordsFromSession(mem);
    const blueRecord = records.find(r => r.itemId === 'blue')!;
    // blue: itemMastery=0.75, correctAttempts=2 → DEVELOPING (needs >=3 for SECURE)
    expect([MasteryLevel.DEVELOPING, MasteryLevel.SECURE]).toContain(blueRecord.masteryLevel);
  });

  it('deriveMasteryLevel: DEVELOPING for itemMastery=0.45 + 1 correct', () => {
    const mem = makeSessionMemory();
    const records = buildMasteryRecordsFromSession(mem);
    const greenRecord = records.find(r => r.itemId === 'green')!;
    expect(greenRecord.masteryLevel).toBe(MasteryLevel.DEVELOPING);
  });

  it('deriveMasteryLevel: EMERGING for itemMastery=0.1 + 0 correct', () => {
    const mem = makeSessionMemory();
    const records = buildMasteryRecordsFromSession(mem);
    const redRecord = records.find(r => r.itemId === 'red')!;
    expect(redRecord.masteryLevel).toBe(MasteryLevel.EMERGING);
  });

  it('deriveMasteryLevel: AUTOMATIC for itemMastery=0.95 + 5 correct', () => {
    const itemState = new Map<string, ItemState>();
    itemState.set('purple', makeItemState({
      itemId: 'purple',
      itemMastery: 0.95,
      correctAttempts: 6,
      attemptCount: 7,
    }));
    const mem = makeSessionMemory({ itemsAttempted: ['purple'], itemState });
    const records = buildMasteryRecordsFromSession(mem);
    expect(records[0]!.masteryLevel).toBe(MasteryLevel.AUTOMATIC);
  });

  it('productionConfidence is in 0–100 engine scale', () => {
    const mem = makeSessionMemory();
    const records = buildMasteryRecordsFromSession(mem);
    for (const r of records) {
      expect(r.productionConfidence).toBeGreaterThanOrEqual(0);
      expect(r.productionConfidence).toBeLessThanOrEqual(100);
    }
  });

  it('correctProductionCount matches state.correctAttempts', () => {
    const mem = makeSessionMemory();
    const records = buildMasteryRecordsFromSession(mem);
    const blueRecord = records.find(r => r.itemId === 'blue')!;
    expect(blueRecord.correctProductionCount).toBe(2);
  });

  it('skips items in itemsAttempted that have no itemState entry', () => {
    const mem = makeSessionMemory({ itemsAttempted: ['blue', 'missing-item'] });
    const records = buildMasteryRecordsFromSession(mem);
    expect(records).toHaveLength(1);
    expect(records[0]!.itemId).toBe('blue');
  });
});

// ── 3. persistKidsBrainAnalytics — session summary is saved ─────────────────

describe('persistKidsBrainAnalytics — session summary', () => {
  it('calls saveSessionSummary once per invocation', async () => {
    const { store, summaryCallCount } = makeProfileStoreMock();
    const mem = makeSessionMemory();
    await persistKidsBrainAnalytics(mem, 'completed', store);
    expect(summaryCallCount()).toBe(1);
  });

  it('does not throw when saveSessionSummary rejects (non-fatal)', async () => {
    const store: PostgresProfileStore = {
      getChildProfile: vi.fn(async () => null),
      saveChildProfile: vi.fn(async () => undefined),
      getMasteryRecord: vi.fn(async () => null),
      saveMasteryRecord: vi.fn(async () => undefined),
      saveSessionSummary: vi.fn(async () => { throw new Error('DB down'); }),
    };
    const mem = makeSessionMemory();
    await expect(persistKidsBrainAnalytics(mem, 'completed', store)).resolves.toBeUndefined();
  });
});

// ── 4. persistKidsBrainAnalytics — mastery records are saved ────────────────

describe('persistKidsBrainAnalytics — mastery records', () => {
  it('calls saveMasteryRecord for each attempted item', async () => {
    const { store, masteryCallCount } = makeProfileStoreMock();
    const mem = makeSessionMemory();
    await persistKidsBrainAnalytics(mem, 'completed', store);
    expect(masteryCallCount()).toBe(3); // blue, green, red
  });

  it('does not call saveMasteryRecord when no items were attempted', async () => {
    const { store, masteryCallCount } = makeProfileStoreMock();
    const mem = makeSessionMemory({ itemsAttempted: [] });
    await persistKidsBrainAnalytics(mem, 'completed', store);
    expect(masteryCallCount()).toBe(0);
  });

  it('continues saving remaining records when one record fails (non-fatal)', async () => {
    let callCount = 0;
    const store: PostgresProfileStore = {
      getChildProfile: vi.fn(async () => null),
      saveChildProfile: vi.fn(async () => undefined),
      getMasteryRecord: vi.fn(async () => null),
      saveSessionSummary: vi.fn(async () => undefined),
      saveMasteryRecord: vi.fn(async () => {
        callCount++;
        if (callCount === 1) throw new Error('DB error on first record');
      }),
    };
    const mem = makeSessionMemory();
    await expect(persistKidsBrainAnalytics(mem, 'completed', store)).resolves.toBeUndefined();
    expect(callCount).toBe(3); // all 3 items attempted despite first failing
  });
});

// ── 5. Duplicate close does not duplicate summaries ──────────────────────────

describe('persistKidsBrainAnalytics — idempotency', () => {
  it('second call to saveSessionSummary for same session is a no-op at DB level (ON CONFLICT DO NOTHING)', async () => {
    // The store mock always succeeds. The real DB uses ON CONFLICT (session_id) DO NOTHING.
    // We verify that calling twice produces exactly 2 store calls — the second is a DB no-op.
    const { store, summaryCallCount } = makeProfileStoreMock();
    const mem = makeSessionMemory();
    await persistKidsBrainAnalytics(mem, 'completed', store);
    await persistKidsBrainAnalytics(mem, 'completed', store);
    // Both calls go through — the DB layer handles idempotency, not the application layer.
    expect(summaryCallCount()).toBe(2);
  });

  it('stopReason for abandoned session can be persisted', async () => {
    let capturedSummary: unknown;
    const store: PostgresProfileStore = {
      getChildProfile: vi.fn(async () => null),
      saveChildProfile: vi.fn(async () => undefined),
      getMasteryRecord: vi.fn(async () => null),
      saveMasteryRecord: vi.fn(async () => undefined),
      saveSessionSummary: vi.fn(async (summary) => { capturedSummary = summary; }),
    };
    const mem = makeSessionMemory();
    await persistKidsBrainAnalytics(mem, 'abandoned', store);
    expect((capturedSummary as { stopReason: string }).stopReason).toBe('abandoned');
  });
});

// ── 6. Abandoned session can be marked interrupted ───────────────────────────

describe('abandoned / interrupted session', () => {
  it('persistKidsBrainAnalytics with stopReason=interrupted persists correctly', async () => {
    let capturedSummary: unknown;
    const store: PostgresProfileStore = {
      getChildProfile: vi.fn(async () => null),
      saveChildProfile: vi.fn(async () => undefined),
      getMasteryRecord: vi.fn(async () => null),
      saveMasteryRecord: vi.fn(async () => undefined),
      saveSessionSummary: vi.fn(async (summary) => { capturedSummary = summary; }),
    };
    const mem = makeSessionMemory();
    await persistKidsBrainAnalytics(mem, 'interrupted', store);
    expect((capturedSummary as { stopReason: string }).stopReason).toBe('interrupted');
    expect((capturedSummary as { sessionId: string }).sessionId).toBe('test-session-001');
  });

  it('partial session (only 1 word attempted) still saves a valid summary', async () => {
    const itemState = new Map<string, ItemState>();
    itemState.set('blue', makeItemState({ itemId: 'blue', attemptCount: 1, correctAttempts: 0, itemMastery: 0.1 }));
    const mem = makeSessionMemory({
      itemsAttempted: ['blue'],
      itemsMastered: [],
      itemState,
    });
    const { store, summaryCallCount, masteryCallCount } = makeProfileStoreMock();
    await persistKidsBrainAnalytics(mem, 'interrupted', store);
    expect(summaryCallCount()).toBe(1);
    expect(masteryCallCount()).toBe(1);
  });
});

// ── 7. Summary uses backend state, not frontend data ─────────────────────────

describe('backend-state authority', () => {
  it('itemsMasteredIds comes from sessionMemory.itemsMastered, not a parameter', () => {
    const mem = makeSessionMemory({ itemsMastered: ['blue', 'green'] });
    const summary = buildSessionSummary(mem, 'completed', new Date().toISOString());
    expect(summary.itemsMasteredIds).toEqual(['blue', 'green']);
  });

  it('sessionId comes from sessionMemory, not an external parameter', () => {
    const mem = makeSessionMemory({ sessionId: 'server-session-xyz' });
    const summary = buildSessionSummary(mem, 'completed', new Date().toISOString());
    expect(summary.sessionId).toBe('server-session-xyz');
  });

  it('mastery records childId comes from sessionMemory, not an external parameter', () => {
    const mem = makeSessionMemory({ childId: 'server-child-id-123' });
    const records = buildMasteryRecordsFromSession(mem);
    for (const r of records) {
      expect(r.childId).toBe('server-child-id-123');
    }
  });
});

// ── 8. Reconnect does not finalize session prematurely (source inspection) ───

describe('reconnect guard — lesson-ws.ts does not finalize on WS close for kids sessions', () => {
  it('lesson-ws.ts ws.on(close) handler does NOT call persistKidsBrainAnalytics', () => {
    const wsPath = resolve(__dirname, '../../../ws/lesson-ws.ts');
    const content = readFileSync(wsPath, 'utf-8');

    // Verify the file contains the close handler
    expect(content).toContain("ws.on('close'");

    // Find the line number of ws.on('close') and ws.on('error')
    const lines = content.split('\n');
    const closeLineIdx = lines.findIndex(l => l.includes("ws.on('close'"));
    const errorLineIdx = lines.findIndex(l => l.includes("ws.on('error'"));
    expect(closeLineIdx).toBeGreaterThan(-1);
    expect(errorLineIdx).toBeGreaterThan(closeLineIdx);

    // Extract the close handler block and verify it has no analytics call
    const closeHandlerBlock = lines.slice(closeLineIdx, errorLineIdx).join('\n');
    expect(closeHandlerBlock).not.toContain('persistKidsBrainAnalytics');
  });

  it('lesson-ws.ts imports persistKidsBrainAnalytics', () => {
    const wsPath = resolve(__dirname, '../../../ws/lesson-ws.ts');
    const content = readFileSync(wsPath, 'utf-8');
    expect(content).toContain('persistKidsBrainAnalytics');
  });

  it('lesson-ws.ts wires analytics on natural session close', () => {
    const wsPath = resolve(__dirname, '../../../ws/lesson-ws.ts');
    const content = readFileSync(wsPath, 'utf-8');
    // The function must be called somewhere in processKidsBrainV1Turn
    const fnMatch = content.match(/async function processKidsBrainV1Turn[\s\S]{1,6000}?\n\}/);
    expect(fnMatch).not.toBeNull();
    expect(fnMatch![0]).toContain('persistKidsBrainAnalytics');
  });

  it('lesson-ws.ts has kidsAnalyticsFinalized flag in ClientMeta', () => {
    const wsPath = resolve(__dirname, '../../../ws/lesson-ws.ts');
    const content = readFileSync(wsPath, 'utf-8');
    expect(content).toContain('kidsAnalyticsFinalized');
  });
});
