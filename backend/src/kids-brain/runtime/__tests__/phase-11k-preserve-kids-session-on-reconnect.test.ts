/**
 * Phase 11K — Preserve Kids Session On Reconnect
 *
 * Tests prove that reconnectSession correctly:
 * A. Returns an existing session for the matching userId
 * B. Preserves currentTargetItemId from the stored session
 * C. Preserves currentActivityId from the stored session
 * D. Preserves hasStartedFirstExercise from the stored session
 * E. Does NOT call Redis SET when returning an existing session
 * F. Redis value is unchanged after reconnectSession
 * G. Returns null when no session exists (cold-start path)
 * H. Returns null when userId does not match (cross-user protection)
 * K. Phase 11I activity progression survives a save/reconnect round-trip
 */

import { describe, it, expect, vi } from 'vitest';
import { RedisSessionStoreImpl } from '../../infrastructure/redis-session.store.js';
import { startKidsBrainSession } from '../index.js';
import type { KidsBrainSessionStartInput } from '../runtime-types.js';
import { AgeBand, ActivityType } from '../../shared/enums.js';
import { AGE_PROFILE_6_7 } from '../../shared/types.js';
import type { SessionMemory } from '../../contracts/session-memory.js';

// ── Mock Redis ─────────────────────────────────────────────────────────────────

function makeMockRedis() {
  const store = new Map<string, string>();
  return {
    store,
    get: vi.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
    set: vi.fn((key: string, value: string, ..._args: unknown[]) => {
      store.set(key, value);
      return Promise.resolve('OK');
    }),
    del: vi.fn((key: string) => {
      store.delete(key);
      return Promise.resolve(1);
    }),
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeSessionInput(
  sessionId: string,
  userId: string,
  words = ['blue', 'green', 'red'],
): KidsBrainSessionStartInput {
  return {
    sessionId,
    userId,
    childId: `child-${sessionId}`,
    childFirstName: 'Alex',
    ageBand: AgeBand.SIX_SEVEN,
    ageProfile: AGE_PROFILE_6_7,
    lessonTargetWords: [...words],
    unitReviewWords: [],
    characterNames: ['milo'],
    timestamp: new Date().toISOString(),
  };
}

// ── A. Returns existing session for matching userId ────────────────────────────

describe('A — reconnectSession returns existing session for matching userId', () => {
  it('returns the stored SessionMemory when userId matches', async () => {
    const mockRedis = makeMockRedis();
    const storeImpl = new RedisSessionStoreImpl(mockRedis as any);

    const { sessionMemory } = startKidsBrainSession(makeSessionInput('11k-A1', 'user-001'));
    await storeImpl.saveSession(sessionMemory);

    const result = await storeImpl.reconnectSession('11k-A1', 'user-001');

    expect(result).not.toBeNull();
    expect(result!.sessionId).toBe('11k-A1');
    expect(result!.userId).toBe('user-001');
  });

  it('returns the session mode as mentium_kids', async () => {
    const mockRedis = makeMockRedis();
    const storeImpl = new RedisSessionStoreImpl(mockRedis as any);

    const { sessionMemory } = startKidsBrainSession(makeSessionInput('11k-A2', 'user-001'));
    await storeImpl.saveSession(sessionMemory);

    const result = await storeImpl.reconnectSession('11k-A2', 'user-001');

    expect(result!.mode).toBe('mentium_kids');
  });
});

// ── B. currentTargetItemId is preserved ────────────────────────────────────────

describe('B — currentTargetItemId is preserved on reconnect', () => {
  it('returns the same currentTargetItemId that was stored', async () => {
    const mockRedis = makeMockRedis();
    const storeImpl = new RedisSessionStoreImpl(mockRedis as any);

    const { sessionMemory } = startKidsBrainSession(makeSessionInput('11k-B1', 'user-001'));
    const advanced: SessionMemory = { ...sessionMemory, currentTargetItemId: 'green' };
    await storeImpl.saveSession(advanced);

    const result = await storeImpl.reconnectSession('11k-B1', 'user-001');

    expect(result!.currentTargetItemId).toBe('green');
  });

  it('initial blue target is preserved when no progression occurred', async () => {
    const mockRedis = makeMockRedis();
    const storeImpl = new RedisSessionStoreImpl(mockRedis as any);

    const { sessionMemory } = startKidsBrainSession(
      makeSessionInput('11k-B2', 'user-001', ['blue', 'green', 'red']),
    );
    await storeImpl.saveSession(sessionMemory);

    const result = await storeImpl.reconnectSession('11k-B2', 'user-001');

    expect(result!.currentTargetItemId).toBe('blue');
  });
});

// ── C. currentActivityId is preserved ─────────────────────────────────────────

describe('C — currentActivityId is preserved on reconnect', () => {
  it('returns the stored currentActivityId (SENTENCE_PRODUCTION)', async () => {
    const mockRedis = makeMockRedis();
    const storeImpl = new RedisSessionStoreImpl(mockRedis as any);

    const { sessionMemory } = startKidsBrainSession(makeSessionInput('11k-C1', 'user-001'));
    const advanced: SessionMemory = {
      ...sessionMemory,
      currentActivityId: ActivityType.SENTENCE_PRODUCTION,
    };
    await storeImpl.saveSession(advanced);

    const result = await storeImpl.reconnectSession('11k-C1', 'user-001');

    expect(result!.currentActivityId).toBe(ActivityType.SENTENCE_PRODUCTION);
  });

  it('returns LISTEN_AND_POINT when session was fresh at disconnect', async () => {
    const mockRedis = makeMockRedis();
    const storeImpl = new RedisSessionStoreImpl(mockRedis as any);

    const { sessionMemory } = startKidsBrainSession(makeSessionInput('11k-C2', 'user-001'));
    await storeImpl.saveSession(sessionMemory);

    const result = await storeImpl.reconnectSession('11k-C2', 'user-001');

    expect(result!.currentActivityId).toBe(ActivityType.LISTEN_AND_POINT);
  });
});

// ── D. hasStartedFirstExercise is preserved ────────────────────────────────────

describe('D — hasStartedFirstExercise is preserved on reconnect', () => {
  it('returns hasStartedFirstExercise=true when it was true before disconnect', async () => {
    const mockRedis = makeMockRedis();
    const storeImpl = new RedisSessionStoreImpl(mockRedis as any);

    const { sessionMemory } = startKidsBrainSession(makeSessionInput('11k-D1', 'user-001'));
    const withHandshake: SessionMemory = { ...sessionMemory, hasStartedFirstExercise: true };
    await storeImpl.saveSession(withHandshake);

    const result = await storeImpl.reconnectSession('11k-D1', 'user-001');

    expect(result!.hasStartedFirstExercise).toBe(true);
  });

  it('hasStartedFirstExercise=false is preserved when exercise had not started', async () => {
    const mockRedis = makeMockRedis();
    const storeImpl = new RedisSessionStoreImpl(mockRedis as any);

    const { sessionMemory } = startKidsBrainSession(makeSessionInput('11k-D2', 'user-001'));
    // fresh session: hasStartedFirstExercise is false
    await storeImpl.saveSession(sessionMemory);

    const result = await storeImpl.reconnectSession('11k-D2', 'user-001');

    expect(result!.hasStartedFirstExercise).toBeFalsy();
  });
});

// ── E. Redis SET not called during reconnectSession ───────────────────────────

describe('E — reconnectSession does not overwrite Redis (SET not called)', () => {
  it('set call count does not increase after reconnectSession', async () => {
    const mockRedis = makeMockRedis();
    const storeImpl = new RedisSessionStoreImpl(mockRedis as any);

    const { sessionMemory } = startKidsBrainSession(makeSessionInput('11k-E1', 'user-001'));
    await storeImpl.saveSession(sessionMemory);

    const setCallsBefore = (mockRedis.set as ReturnType<typeof vi.fn>).mock.calls.length;

    await storeImpl.reconnectSession('11k-E1', 'user-001');

    expect((mockRedis.set as ReturnType<typeof vi.fn>).mock.calls.length).toBe(setCallsBefore);
  });
});

// ── F. Redis value unchanged after reconnectSession ───────────────────────────

describe('F — stored Redis value is identical before and after reconnectSession', () => {
  it('raw JSON in the mock store is unchanged after reconnectSession', async () => {
    const mockRedis = makeMockRedis();
    const storeImpl = new RedisSessionStoreImpl(mockRedis as any);

    const { sessionMemory } = startKidsBrainSession(makeSessionInput('11k-F1', 'user-001'));
    await storeImpl.saveSession(sessionMemory);

    const before = mockRedis.store.get('kids:session:11k-F1');

    await storeImpl.reconnectSession('11k-F1', 'user-001');

    const after = mockRedis.store.get('kids:session:11k-F1');
    expect(after).toBe(before);
  });
});

// ── G. Returns null when no session exists ─────────────────────────────────────

describe('G — reconnectSession returns null for unknown sessionId (cold-start path)', () => {
  it('returns null when no session exists in Redis', async () => {
    const mockRedis = makeMockRedis();
    const storeImpl = new RedisSessionStoreImpl(mockRedis as any);

    const result = await storeImpl.reconnectSession('11k-G1-nonexistent', 'user-001');

    expect(result).toBeNull();
  });

  it('cold start: saveSession followed by getSession round-trip works after null reconnect', async () => {
    const mockRedis = makeMockRedis();
    const storeImpl = new RedisSessionStoreImpl(mockRedis as any);

    // First call: no session
    const first = await storeImpl.reconnectSession('11k-G2', 'user-001');
    expect(first).toBeNull();

    // Simulate cold start: save fresh session
    const { sessionMemory } = startKidsBrainSession(makeSessionInput('11k-G2', 'user-001'));
    await storeImpl.saveSession(sessionMemory);

    // Second call: session now exists
    const second = await storeImpl.reconnectSession('11k-G2', 'user-001');
    expect(second).not.toBeNull();
    expect(second!.sessionId).toBe('11k-G2');
  });
});

// ── H. Cross-user reconnect is blocked ────────────────────────────────────────

describe('H — cross-user reconnect does not resume another user\'s session', () => {
  it('returns null when userId does not match the session owner', async () => {
    const mockRedis = makeMockRedis();
    const storeImpl = new RedisSessionStoreImpl(mockRedis as any);

    const { sessionMemory } = startKidsBrainSession(makeSessionInput('11k-H1', 'user-owner'));
    await storeImpl.saveSession(sessionMemory);

    const result = await storeImpl.reconnectSession('11k-H1', 'user-attacker');

    expect(result).toBeNull();
  });

  it('cross-user reconnect does not modify the stored session', async () => {
    const mockRedis = makeMockRedis();
    const storeImpl = new RedisSessionStoreImpl(mockRedis as any);

    const { sessionMemory } = startKidsBrainSession(makeSessionInput('11k-H2', 'user-owner'));
    await storeImpl.saveSession(sessionMemory);

    const before = mockRedis.store.get('kids:session:11k-H2');

    // Attacker fails
    await storeImpl.reconnectSession('11k-H2', 'user-attacker');

    const after = mockRedis.store.get('kids:session:11k-H2');
    expect(after).toBe(before);
  });

  it('valid owner can still reconnect after a failed cross-user attempt', async () => {
    const mockRedis = makeMockRedis();
    const storeImpl = new RedisSessionStoreImpl(mockRedis as any);

    const { sessionMemory } = startKidsBrainSession(makeSessionInput('11k-H3', 'user-owner'));
    await storeImpl.saveSession(sessionMemory);

    // Attacker fails
    const attackerResult = await storeImpl.reconnectSession('11k-H3', 'user-attacker');
    expect(attackerResult).toBeNull();

    // Owner still succeeds
    const ownerResult = await storeImpl.reconnectSession('11k-H3', 'user-owner');
    expect(ownerResult).not.toBeNull();
    expect(ownerResult!.userId).toBe('user-owner');
  });
});

// ── K. Phase 11I activity progression survives reconnect round-trip ───────────

describe('K — Phase 11I activity progression survives save/reconnect cycle', () => {
  it('advanced target item and activity are both preserved', async () => {
    const mockRedis = makeMockRedis();
    const storeImpl = new RedisSessionStoreImpl(mockRedis as any);

    const { sessionMemory } = startKidsBrainSession(
      makeSessionInput('11k-K1', 'user-001', ['blue', 'green', 'pink']),
    );

    const progressed: SessionMemory = {
      ...sessionMemory,
      currentTargetItemId: 'green',
      currentActivityId: ActivityType.SENTENCE_FRAME_PRODUCTION,
      hasStartedFirstExercise: true,
      turnNumber: 5,
    };

    await storeImpl.saveSession(progressed);
    const result = await storeImpl.reconnectSession('11k-K1', 'user-001');

    expect(result!.currentTargetItemId).toBe('green');
    expect(result!.currentActivityId).toBe(ActivityType.SENTENCE_FRAME_PRODUCTION);
    expect(result!.hasStartedFirstExercise).toBe(true);
    expect(result!.turnNumber).toBe(5);
  });

  it('blue→green advancement (R22 result) is fully preserved through reconnect', async () => {
    const mockRedis = makeMockRedis();
    const storeImpl = new RedisSessionStoreImpl(mockRedis as any);

    const { sessionMemory } = startKidsBrainSession(
      makeSessionInput('11k-K2', 'user-001', ['blue', 'green', 'pink']),
    );

    // Simulate the state after Phase 11I R22 fires: blue→green
    const afterR22: SessionMemory = {
      ...sessionMemory,
      currentTargetItemId: 'green',
      currentActivityId: ActivityType.LISTEN_AND_POINT,
      hasStartedFirstExercise: true,
      turnNumber: 8,
    };

    await storeImpl.saveSession(afterR22);
    const resumed = await storeImpl.reconnectSession('11k-K2', 'user-001');

    expect(resumed!.currentTargetItemId).toBe('green');
    expect(resumed!.currentActivityId).toBe(ActivityType.LISTEN_AND_POINT);
    expect(resumed!.turnNumber).toBe(8);
  });

  it('itemState Map is preserved through serialization round-trip on reconnect', async () => {
    const mockRedis = makeMockRedis();
    const storeImpl = new RedisSessionStoreImpl(mockRedis as any);

    const { sessionMemory } = startKidsBrainSession(
      makeSessionInput('11k-K3', 'user-001', ['blue', 'green']),
    );

    // Manually add an item to the Map to verify Map serialization survives
    const withItemState: SessionMemory = {
      ...sessionMemory,
      itemState: new Map([
        ['blue', { attempts: 3, successes: 2, lastAttemptAt: new Date().toISOString() } as any],
      ]),
    };

    await storeImpl.saveSession(withItemState);
    const resumed = await storeImpl.reconnectSession('11k-K3', 'user-001');

    expect(resumed!.itemState).toBeInstanceOf(Map);
    expect(resumed!.itemState.has('blue')).toBe(true);
  });
});
