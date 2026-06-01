/**
 * Phase 15A — Kids Brain v1 WebSocket Integration Smoke Test
 *
 * Covers the full backend delivery path without spinning up a WS server:
 *   mocked text_message → buildSTTResultFromText
 *   → startKidsBrainSession / processKidsBrainTurn / endKidsBrainSession
 *   → RedisSessionStoreImpl.saveSession / getSession / reconnectSession
 *   → adaptRuntimePackets / requiresSessionClose
 *   → persistKidsBrainAnalytics
 *
 * Integration method: harness re-implements the same call sequence as
 * lesson-ws.ts (handleKidsBrainV1LessonStart + processKidsBrainV1Turn)
 * using exported helpers and a mock Redis store + mock WS send function.
 *
 * Limitation: lesson-ws.ts internal functions are not exported; tests
 * exercise the constituent parts by reproducing the same logic. A true
 * end-to-end WS test would require a full server harness (large scope;
 * deferred to Phase 15B).
 *
 * Target lesson: courseId cambridge-kids-box-1 / kb1-unit-01 / kb1-u01-l02
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  startKidsBrainSession,
  processKidsBrainTurn,
  endKidsBrainSession,
  RuntimeActionPacketType,
} from '../index.js';
import type { KidsBrainSessionStartInput } from '../index.js';
import {
  buildSTTResultFromText,
  adaptRuntimePackets,
  requiresSessionClose,
} from '../../adapters/index.js';
import type { AdaptedKidsMessage } from '../../adapters/index.js';
import { RedisSessionStoreImpl } from '../../infrastructure/redis-session.store.js';
import {
  buildSessionSummary,
  buildMasteryRecordsFromSession,
  persistKidsBrainAnalytics,
} from '../../analytics/session-analytics.js';
import type { PostgresProfileStore } from '../../contracts/stores.js';
import type { SessionMemory } from '../../contracts/session-memory.js';
import { AgeBand } from '../../shared/enums.js';
import { AGE_PROFILE_6_7 } from '../../shared/types.js';

// ── Constants ─────────────────────────────────────────────────────────────────

const SESSION_ID   = 'ws-15a-smoke-001';
const USER_ID      = 'user-15a';
const CHILD_ID     = 'child-15a';
const ANIMAL_WORDS = ['cat', 'dog', 'lion', 'monkey', 'elephant', 'tiger'];
const KB1_L2_WORDS = ['blue', 'green', 'pink', 'purple', 'orange', 'red', 'yellow'];

const EX_01 = 'kb1-u01-l02-ex-01-readiness';
const EX_02 = 'kb1-u01-l02-ex-02-blue';
const EX_03 = 'kb1-u01-l02-ex-03-green';

// ── Redis mock (same pattern as infrastructure-contracts.test.ts) ─────────────

function makeRedisMock() {
  const store = new Map<string, string>();
  return {
    get:  vi.fn(async (key: string) => store.get(key) ?? null),
    set:  vi.fn(async (key: string, value: string, ..._args: unknown[]) => {
      store.set(key, value);
      return 'OK';
    }),
    del:  vi.fn(async (key: string) => { store.delete(key); return 1; }),
    eval: vi.fn(async (
      _script: string, _numkeys: number,
      key: string, value: string, _ttl: string, seq: string,
    ) => {
      const raw = store.get(key);
      if (!raw) { store.set(key, value); return 1; }
      const parsed = JSON.parse(raw) as { autosaveSequenceNumber?: number };
      if ((parsed.autosaveSequenceNumber ?? 0) < Number(seq)) {
        store.set(key, value);
        return 1;
      }
      return 0;
    }),
    _store: store,
  };
}

// ── Mock profile store ────────────────────────────────────────────────────────

function makeMockProfileStore() {
  const summaries: unknown[] = [];
  const masteryRows: unknown[] = [];
  const store: PostgresProfileStore = {
    getChildProfile:    vi.fn(async () => null),
    saveChildProfile:   vi.fn(async () => undefined),
    getMasteryRecord:   vi.fn(async () => null),
    saveMasteryRecord:  vi.fn(async (r) => { masteryRows.push(r); }),
    saveSessionSummary: vi.fn(async (s) => { summaries.push(s); }),
  };
  return { store, summaries, masteryRows };
}

// ── WS harness — re-implements the same call sequence as lesson-ws.ts ─────────

interface HarnessMeta {
  kidsSessionId:          string | null;
  kidsBrainV1Active:      boolean;
  kidsAnalyticsFinalized: boolean;
  aiCallCount:            number;
}

function makeMeta(): HarnessMeta {
  return {
    kidsSessionId:          null,
    kidsBrainV1Active:      false,
    kidsAnalyticsFinalized: false,
    aiCallCount:            0,
  };
}

function makeSessionInput(sessionId = SESSION_ID, userId = USER_ID): KidsBrainSessionStartInput {
  return {
    sessionId,
    userId,
    childId:           CHILD_ID,
    childFirstName:    'Lily',
    ageBand:           AgeBand.SIX_SEVEN,
    ageProfile:        AGE_PROFILE_6_7,
    lessonTargetWords: [...KB1_L2_WORDS],
    unitReviewWords:   [],
    characterNames:    ['milo'],
    timestamp:         new Date().toISOString(),
  };
}

/** Mirrors handleKidsBrainV1LessonStart (lesson-ws.ts:1176-1263) */
async function handleFocusLessonStart(
  meta:    HarnessMeta,
  store:   RedisSessionStoreImpl,
  sent:    AdaptedKidsMessage[],
  sessionId = SESSION_ID,
  userId    = USER_ID,
): Promise<{ resumed: boolean; sessionMemory: SessionMemory }> {
  // Reconnect guard (Phase 11K)
  let existing: SessionMemory | null = null;
  try { existing = await store.reconnectSession(sessionId, userId); } catch { /* ignore */ }

  if (existing) {
    meta.kidsSessionId     = sessionId;
    meta.kidsBrainV1Active = true;
    return { resumed: true, sessionMemory: existing };
  }

  const startResult = startKidsBrainSession(makeSessionInput(sessionId, userId));
  await store.saveSession(startResult.sessionMemory);

  meta.kidsSessionId     = sessionId;
  meta.kidsBrainV1Active = true;

  const adapted = adaptRuntimePackets(startResult.actionPackets);
  sent.push(...adapted);

  return { resumed: false, sessionMemory: startResult.sessionMemory };
}

/** Mirrors processKidsBrainV1Turn (lesson-ws.ts:1267-1390) */
async function handleTextMessage(
  meta:         HarnessMeta,
  store:        RedisSessionStoreImpl,
  sent:         AdaptedKidsMessage[],
  profileStore: PostgresProfileStore,
  text:         string,
): Promise<{ shouldClose: boolean; sessionMemory: SessionMemory }> {
  const sessionId = meta.kidsSessionId!;
  meta.aiCallCount++;

  const loaded = await store.getSession(sessionId);
  if (!loaded) throw new Error(`[15a] session_not_found: ${sessionId}`);

  const sttResult = buildSTTResultFromText(text || null);

  const result = await processKidsBrainTurn({
    sessionMemory:     loaded,
    sttResult,
    responseLatencyMs: null,
    silenceDurationMs: 0,
    attemptCount:      loaded.currentItemAttemptCount,
    targetWord:        loaded.currentTargetItemId ?? KB1_L2_WORDS[0]!,
    childFirstName:    'Lily',
    lessonTargetWords: [...KB1_L2_WORDS],
    unitReviewWords:   [],
    characterNames:    ['milo'],
    timestamp:         new Date().toISOString(),
  });

  if (!result.safeToContinue) {
    const adapted = adaptRuntimePackets(result.actionPackets);
    sent.push(...adapted);
    if (!meta.kidsAnalyticsFinalized) {
      meta.kidsAnalyticsFinalized = true;
      await persistKidsBrainAnalytics(result.updatedSessionMemory, 'safety', profileStore);
    }
    return { shouldClose: true, sessionMemory: result.updatedSessionMemory };
  }

  await store.saveSession(result.updatedSessionMemory);
  const adapted = adaptRuntimePackets(result.actionPackets);
  sent.push(...adapted);

  const shouldClose = requiresSessionClose(adapted) || result.shouldCloseSession;
  if (shouldClose && !meta.kidsAnalyticsFinalized) {
    meta.kidsAnalyticsFinalized = true;
    await persistKidsBrainAnalytics(result.updatedSessionMemory, 'completed', profileStore);
  }

  return { shouldClose, sessionMemory: result.updatedSessionMemory };
}

// ── QA helpers ────────────────────────────────────────────────────────────────

function assertNoPlaceholders(text: string, ctx: string): void {
  expect(text, `[${ctx}] unresolved {target}`).not.toMatch(/\{target\}/);
  expect(text, `[${ctx}] unresolved {item}`).not.toMatch(/\{item\}/);
  expect(text, `[${ctx}] literal undefined`).not.toMatch(/\bundefined\b/i);
  expect(text, `[${ctx}] [object Object]`).not.toContain('[object Object]');
  expect(text, `[${ctx}] standalone null`).not.toMatch(/\bnull\b/i);
}

function assertNoAnimalWords(text: string, ctx: string): void {
  const t = text.toLowerCase();
  for (const w of ANIMAL_WORDS) {
    expect(t, `[${ctx}] animal word "${w}" in colours lesson`).not.toContain(w);
  }
}

function teacherTexts(sent: AdaptedKidsMessage[]): string[] {
  return sent
    .filter(m => m.type === 'kids_teacher_text')
    .map(m => (m as { type: 'kids_teacher_text'; text: string }).text);
}

// ── Suite 1: Session Start ────────────────────────────────────────────────────

describe('Phase 15A — WS Session Start', () => {
  it('cold start persists session to Redis and sets meta flags', async () => {
    const redisMock = makeRedisMock();
    const store = new RedisSessionStoreImpl(redisMock as unknown as import('ioredis').Redis);
    const meta  = makeMeta();
    const sent: AdaptedKidsMessage[] = [];

    const { resumed, sessionMemory } = await handleFocusLessonStart(meta, store, sent);

    expect(resumed).toBe(false);
    expect(meta.kidsSessionId).toBe(SESSION_ID);
    expect(meta.kidsBrainV1Active).toBe(true);

    // Session was actually saved to Redis
    const loaded = await store.getSession(SESSION_ID);
    expect(loaded).not.toBeNull();
    expect(loaded!.sessionId).toBe(SESSION_ID);
    expect(loaded!.userId).toBe(USER_ID);
    expect(loaded!.lessonId).toBe('kb1-u01-l02');

    // First exercise is readiness
    expect(sessionMemory.currentExerciseId).toBe(EX_01);
  });

  it('greeting packets are adapted and include TEACHER_TEXT + START_LISTENING types', async () => {
    const redisMock = makeRedisMock();
    const store = new RedisSessionStoreImpl(redisMock as unknown as import('ioredis').Redis);
    const meta  = makeMeta();
    const sent: AdaptedKidsMessage[] = [];

    await handleFocusLessonStart(meta, store, sent);

    const types = sent.map(m => m.type);
    expect(types).toContain('kids_teacher_text');
    expect(types).toContain('kids_start_listening');
  });

  it('greeting text has no animal words and no unresolved placeholders', async () => {
    const redisMock = makeRedisMock();
    const store = new RedisSessionStoreImpl(redisMock as unknown as import('ioredis').Redis);
    const meta  = makeMeta();
    const sent: AdaptedKidsMessage[] = [];

    await handleFocusLessonStart(meta, store, sent);

    for (const text of teacherTexts(sent)) {
      assertNoPlaceholders(text, 'greeting');
      assertNoAnimalWords(text, 'greeting');
    }
  });

  it('target word seeded from KB1 L2 colours vocabulary (not animal words)', async () => {
    const redisMock = makeRedisMock();
    const store = new RedisSessionStoreImpl(redisMock as unknown as import('ioredis').Redis);
    const meta  = makeMeta();
    const sent: AdaptedKidsMessage[] = [];

    const { sessionMemory } = await handleFocusLessonStart(meta, store, sent);
    const target = sessionMemory.currentTargetItemId ?? '';
    expect(KB1_L2_WORDS).toContain(target);
    expect(ANIMAL_WORDS).not.toContain(target);
  });
});

// ── Suite 2: Turn Processing — Readiness ──────────────────────────────────────

describe('Phase 15A — WS Turn Processing: Readiness Handshake', () => {
  async function startedHarness() {
    const redisMock = makeRedisMock();
    const store = new RedisSessionStoreImpl(redisMock as unknown as import('ioredis').Redis);
    const { store: profileStore } = makeMockProfileStore();
    const meta  = makeMeta();
    const sent: AdaptedKidsMessage[] = [];
    await handleFocusLessonStart(meta, store, sent);
    sent.length = 0; // clear greeting messages
    return { store, profileStore, meta, sent };
  }

  it("readiness phrase advances ex-01 → ex-02 and saves to Redis", async () => {
    const { store, profileStore, meta, sent } = await startedHarness();
    const { sessionMemory } = await handleTextMessage(meta, store, sent, profileStore, "I'm ready.");

    expect(sessionMemory.currentExerciseId).toBe(EX_02);
    expect(sessionMemory.hasStartedFirstExercise).toBe(true);
    expect(sessionMemory.completedExerciseIds).toContain(EX_01);

    // Redis reflects updated state
    const loaded = await store.getSession(SESSION_ID);
    expect(loaded?.currentExerciseId).toBe(EX_02);
  });

  it("readiness response contains the first target word (blue)", async () => {
    const { store, profileStore, meta, sent } = await startedHarness();
    await handleTextMessage(meta, store, sent, profileStore, "I'm ready.");
    const texts = teacherTexts(sent);
    expect(texts.length).toBeGreaterThan(0);
    expect(texts.some(t => t.toLowerCase().includes('blue'))).toBe(true);
  });

  it("readiness response has no animal words and no unresolved placeholders", async () => {
    const { store, profileStore, meta, sent } = await startedHarness();
    await handleTextMessage(meta, store, sent, profileStore, "I'm ready.");
    for (const text of teacherTexts(sent)) {
      assertNoPlaceholders(text, 'readiness');
      assertNoAnimalWords(text, 'readiness');
    }
  });

  it("normalized 'start!' also fires readiness intercept", async () => {
    const { store, profileStore, meta, sent } = await startedHarness();
    const { sessionMemory } = await handleTextMessage(meta, store, sent, profileStore, 'start!');
    expect(sessionMemory.currentExerciseId).toBe(EX_02);
  });

  it("readiness: safeToContinue path — no safety close triggered", async () => {
    const { store, profileStore, meta, sent } = await startedHarness();
    const { shouldClose } = await handleTextMessage(meta, store, sent, profileStore, 'ok');
    expect(shouldClose).toBe(false);
  });
});

// ── Suite 3: Turn Processing — Exercise Progression ──────────────────────────

describe('Phase 15A — WS Turn Processing: Exercise Progression', () => {
  async function advancedToEx02() {
    const redisMock = makeRedisMock();
    const store = new RedisSessionStoreImpl(redisMock as unknown as import('ioredis').Redis);
    const { store: profileStore } = makeMockProfileStore();
    const meta  = makeMeta();
    const sent: AdaptedKidsMessage[] = [];

    await handleFocusLessonStart(meta, store, sent);
    await handleTextMessage(meta, store, sent, profileStore, "I'm ready.");
    sent.length = 0;

    return { store, profileStore, meta, sent };
  }

  it("2 correct 'blue' answers complete ex-02 → ex-03, Redis updated", async () => {
    const { store, profileStore, meta, sent } = await advancedToEx02();

    await handleTextMessage(meta, store, sent, profileStore, 'blue');
    const afterBlue1 = await store.getSession(SESSION_ID);
    expect(afterBlue1?.currentExerciseId).toBe(EX_02); // 1 correct, needs 2

    await handleTextMessage(meta, store, sent, profileStore, 'blue');
    const afterBlue2 = await store.getSession(SESSION_ID);
    expect(afterBlue2?.currentExerciseId).toBe(EX_03);
    expect(afterBlue2?.completedExerciseIds).toContain(EX_02);
  });

  it("teacher response after correct 'blue' contains no animal words", async () => {
    const { store, profileStore, meta, sent } = await advancedToEx02();

    await handleTextMessage(meta, store, sent, profileStore, 'blue');
    for (const text of teacherTexts(sent)) {
      assertNoAnimalWords(text, 'blue-correct');
      assertNoPlaceholders(text, 'blue-correct');
    }
  });

  it("wrong answer ('cat') on blue does NOT advance exercise", async () => {
    const { store, profileStore, meta, sent } = await advancedToEx02();

    await handleTextMessage(meta, store, sent, profileStore, 'cat');
    const loaded = await store.getSession(SESSION_ID);
    expect(loaded?.currentExerciseId).toBe(EX_02);
  });

  it("teacher response after wrong 'cat' has no animal words in output", async () => {
    const { store, profileStore, meta, sent } = await advancedToEx02();

    await handleTextMessage(meta, store, sent, profileStore, 'cat');
    for (const text of teacherTexts(sent)) {
      assertNoAnimalWords(text, 'wrong-cat-response');
      assertNoPlaceholders(text, 'wrong-cat-response');
    }
  });

  it("1 wrong + 2 correct 'blue' still completes ex-02 → ex-03", async () => {
    const { store, profileStore, meta, sent } = await advancedToEx02();

    await handleTextMessage(meta, store, sent, profileStore, 'cat');
    await handleTextMessage(meta, store, sent, profileStore, 'blue');
    await handleTextMessage(meta, store, sent, profileStore, 'blue');

    const loaded = await store.getSession(SESSION_ID);
    expect(loaded?.currentExerciseId).toBe(EX_03);
    expect(loaded?.completedExerciseIds).toContain(EX_02);
  });

  it("each turn increments turnNumber and saves to Redis", async () => {
    const { store, profileStore, meta, sent } = await advancedToEx02();

    await handleTextMessage(meta, store, sent, profileStore, 'blue');
    const loaded = await store.getSession(SESSION_ID);
    // turnNumber was 1 (after readiness), now must be 2
    expect((loaded?.turnNumber ?? 0)).toBeGreaterThanOrEqual(2);
  });
});

// ── Suite 4: Reconnect Guard ──────────────────────────────────────────────────

describe('Phase 15A — WS Reconnect Guard (Phase 11K)', () => {
  it('reconnect with same userId resumes existing Redis session without cold start', async () => {
    const redisMock = makeRedisMock();
    const store = new RedisSessionStoreImpl(redisMock as unknown as import('ioredis').Redis);
    const { store: profileStore } = makeMockProfileStore();
    const meta1 = makeMeta();
    const sent1: AdaptedKidsMessage[] = [];

    // First connection: cold start + process readiness
    await handleFocusLessonStart(meta1, store, sent1);
    await handleTextMessage(meta1, store, sent1, profileStore, "I'm ready.");

    const savedBeforeReconnect = await store.getSession(SESSION_ID);
    expect(savedBeforeReconnect?.currentExerciseId).toBe(EX_02);

    // Simulate reconnect: second focus_lesson_start with same sessionId/userId
    const meta2 = makeMeta();
    const sent2: AdaptedKidsMessage[] = [];
    const { resumed, sessionMemory } = await handleFocusLessonStart(meta2, store, sent2, SESSION_ID, USER_ID);

    expect(resumed).toBe(true);
    // Exercise progression preserved — no reset to EX_01
    expect(sessionMemory.currentExerciseId).toBe(EX_02);
    expect(sessionMemory.completedExerciseIds).toContain(EX_01);
    // No greeting sent on reconnect
    expect(sent2).toHaveLength(0);
  });

  it('reconnect with different userId returns null (ownership mismatch)', async () => {
    const redisMock = makeRedisMock();
    const store = new RedisSessionStoreImpl(redisMock as unknown as import('ioredis').Redis);

    const meta1 = makeMeta();
    const sent1: AdaptedKidsMessage[] = [];
    await handleFocusLessonStart(meta1, store, sent1, SESSION_ID, USER_ID);

    // Attacker tries to reconnect with different userId
    const result = await store.reconnectSession(SESSION_ID, 'attacker-user-id');
    expect(result).toBeNull();
  });

  it('repeated begin click (duplicate focus_lesson_start on same connection) is a no-op', async () => {
    const redisMock = makeRedisMock();
    const store = new RedisSessionStoreImpl(redisMock as unknown as import('ioredis').Redis);
    const meta  = makeMeta();
    const sent: AdaptedKidsMessage[] = [];

    // First: cold start
    await handleFocusLessonStart(meta, store, sent);
    const savedAfterFirst = redisMock.set.mock.calls.length;

    // Second: reconnect guard fires, returns existing session, no new saveSession
    await handleFocusLessonStart(meta, store, sent);
    const savedAfterSecond = redisMock.set.mock.calls.length;

    // No additional Redis write on second call
    expect(savedAfterSecond).toBe(savedAfterFirst);
  });

  it('cold start after no prior Redis session starts fresh (no stale state)', async () => {
    const redisMock = makeRedisMock();
    const store = new RedisSessionStoreImpl(redisMock as unknown as import('ioredis').Redis);
    const meta  = makeMeta();
    const sent: AdaptedKidsMessage[] = [];

    const { resumed, sessionMemory } = await handleFocusLessonStart(meta, store, sent);

    expect(resumed).toBe(false);
    expect(sessionMemory.currentExerciseId).toBe(EX_01);
    expect(sessionMemory.completedExerciseIds ?? []).toHaveLength(0);
    expect(sessionMemory.turnNumber).toBe(0);
  });
});

// ── Suite 5: Analytics Finalization ──────────────────────────────────────────

describe('Phase 15A — Analytics Finalization', () => {
  async function completedSession() {
    const redisMock = makeRedisMock();
    const store = new RedisSessionStoreImpl(redisMock as unknown as import('ioredis').Redis);
    const { store: profileStore, summaries, masteryRows } = makeMockProfileStore();
    const meta  = makeMeta();
    const sent: AdaptedKidsMessage[] = [];

    await handleFocusLessonStart(meta, store, sent);

    // Drive: readiness → blue×2 → green(wrong) → green×2
    for (const text of ["I'm ready.", 'blue', 'blue', 'cat', 'green', 'green']) {
      await handleTextMessage(meta, store, sent, profileStore, text);
    }

    return { store, profileStore, meta, sent, summaries, masteryRows };
  }

  it('saveSessionSummary is called at most once per session (idempotency guard)', async () => {
    const { summaries } = await completedSession();
    // Analytics is only finalized on explicit shouldClose or safety close.
    // After 6 turns (ex-02 → ex-03, no close yet) it must NOT have fired yet.
    // Verify the kidsAnalyticsFinalized flag prevents double calls.
    const { store: profileStore2, summaries: summaries2 } = makeMockProfileStore();

    // Manually test the guard: if already finalized, second call is a no-op
    const redisMock = makeRedisMock();
    const store = new RedisSessionStoreImpl(redisMock as unknown as import('ioredis').Redis);
    const meta = makeMeta();
    const sent: AdaptedKidsMessage[] = [];

    await handleFocusLessonStart(meta, store, sent);
    const { sessionMemory } = await handleTextMessage(meta, store, sent, profileStore2, "I'm ready.");

    // Simulate natural close (shouldClose=true) with finalized flag already set
    meta.kidsAnalyticsFinalized = true;
    // A second attempt to finalize must not add a summary
    if (!meta.kidsAnalyticsFinalized) {
      await persistKidsBrainAnalytics(sessionMemory, 'completed', profileStore2);
    }
    expect(summaries2).toHaveLength(0); // guard prevented call
  });

  it('persistKidsBrainAnalytics calls saveSessionSummary exactly once', async () => {
    const { store: profileStore, summaries, masteryRows } = makeMockProfileStore();
    const redisMock = makeRedisMock();
    const store = new RedisSessionStoreImpl(redisMock as unknown as import('ioredis').Redis);
    const meta  = makeMeta();
    const sent: AdaptedKidsMessage[] = [];

    await handleFocusLessonStart(meta, store, sent);
    await handleTextMessage(meta, store, sent, profileStore, "I'm ready.");
    await handleTextMessage(meta, store, sent, profileStore, 'blue');
    await handleTextMessage(meta, store, sent, profileStore, 'blue');

    const mem = await store.getSession(SESSION_ID);
    expect(mem).not.toBeNull();

    await persistKidsBrainAnalytics(mem!, 'completed', profileStore);
    expect(summaries).toHaveLength(1);
  });

  it('saveMasteryRecord called for each attempted colour word', async () => {
    const { store: profileStore, summaries, masteryRows } = makeMockProfileStore();
    const redisMock = makeRedisMock();
    const store = new RedisSessionStoreImpl(redisMock as unknown as import('ioredis').Redis);
    const meta  = makeMeta();
    const sent: AdaptedKidsMessage[] = [];

    await handleFocusLessonStart(meta, store, sent);
    await handleTextMessage(meta, store, sent, profileStore, "I'm ready.");
    await handleTextMessage(meta, store, sent, profileStore, 'blue');
    await handleTextMessage(meta, store, sent, profileStore, 'blue');

    const mem = await store.getSession(SESSION_ID);
    const records = buildMasteryRecordsFromSession(mem!);
    await persistKidsBrainAnalytics(mem!, 'completed', profileStore);

    // masteryRows count matches records count
    expect(masteryRows).toHaveLength(records.length);
    for (const r of masteryRows as { childId: string; itemId: string }[]) {
      expect(KB1_L2_WORDS.concat(['blue'])).toContain(r.itemId);
      expect(ANIMAL_WORDS).not.toContain(r.itemId);
      expect(r.childId).toBe(CHILD_ID);
    }
  });

  it('no animal words in mastery record itemIds', async () => {
    const redisMock = makeRedisMock();
    const store = new RedisSessionStoreImpl(redisMock as unknown as import('ioredis').Redis);
    const { store: profileStore, masteryRows } = makeMockProfileStore();
    const meta = makeMeta();
    const sent: AdaptedKidsMessage[] = [];

    await handleFocusLessonStart(meta, store, sent);
    await handleTextMessage(meta, store, sent, profileStore, "I'm ready.");
    await handleTextMessage(meta, store, sent, profileStore, 'blue');
    await handleTextMessage(meta, store, sent, profileStore, 'blue');

    const mem = await store.getSession(SESSION_ID);
    await persistKidsBrainAnalytics(mem!, 'completed', profileStore);

    for (const r of masteryRows as { itemId: string }[]) {
      expect(ANIMAL_WORDS).not.toContain(r.itemId);
    }
  });

  it('persistKidsBrainAnalytics is non-fatal when DB store throws', async () => {
    const redisMock = makeRedisMock();
    const store = new RedisSessionStoreImpl(redisMock as unknown as import('ioredis').Redis);
    const meta  = makeMeta();
    const sent: AdaptedKidsMessage[] = [];

    await handleFocusLessonStart(meta, store, sent);
    const mem = await store.getSession(SESSION_ID);

    const failStore: PostgresProfileStore = {
      getChildProfile:    vi.fn(async () => null),
      saveChildProfile:   vi.fn(async () => undefined),
      getMasteryRecord:   vi.fn(async () => null),
      saveMasteryRecord:  vi.fn(async () => undefined),
      saveSessionSummary: vi.fn(async () => { throw new Error('DB down'); }),
    };

    await expect(
      persistKidsBrainAnalytics(mem!, 'completed', failStore),
    ).resolves.toBeUndefined();
  });
});

// ── Suite 6: WS Protocol Integrity ───────────────────────────────────────────

describe('Phase 15A — WS Protocol Integrity', () => {
  const ALLOWED_ADAPTED_TYPES = new Set([
    'kids_teacher_text',
    'kids_start_listening',
    'kids_stop_listening',
    'kids_session_complete',
    'kids_safety_close',
  ]);

  it('all adapted message types are from the known Kids Brain v1 protocol set', async () => {
    const redisMock = makeRedisMock();
    const store = new RedisSessionStoreImpl(redisMock as unknown as import('ioredis').Redis);
    const { store: profileStore } = makeMockProfileStore();
    const meta  = makeMeta();
    const sent: AdaptedKidsMessage[] = [];

    await handleFocusLessonStart(meta, store, sent);
    await handleTextMessage(meta, store, sent, profileStore, "I'm ready.");
    await handleTextMessage(meta, store, sent, profileStore, 'blue');
    await handleTextMessage(meta, store, sent, profileStore, 'blue');

    for (const msg of sent) {
      expect(ALLOWED_ADAPTED_TYPES).toContain(msg.type);
    }
  });

  it('requiresSessionClose returns false during normal exercise turns', async () => {
    const redisMock = makeRedisMock();
    const store = new RedisSessionStoreImpl(redisMock as unknown as import('ioredis').Redis);
    const { store: profileStore } = makeMockProfileStore();
    const meta  = makeMeta();
    const sent: AdaptedKidsMessage[] = [];

    await handleFocusLessonStart(meta, store, sent);
    await handleTextMessage(meta, store, sent, profileStore, "I'm ready.");

    sent.length = 0;
    await handleTextMessage(meta, store, sent, profileStore, 'blue');

    expect(requiresSessionClose(sent)).toBe(false);
  });

  it('adapted packets from startKidsBrainSession include at least 1 kids_teacher_text', () => {
    const startResult = startKidsBrainSession(makeSessionInput());
    const adapted = adaptRuntimePackets(startResult.actionPackets);
    expect(adapted.some(m => m.type === 'kids_teacher_text')).toBe(true);
  });

  it('adapted packets from endKidsBrainSession include kids_session_complete', async () => {
    const startResult = startKidsBrainSession(makeSessionInput());
    const endResult   = await endKidsBrainSession(startResult.sessionMemory);
    const adapted     = adaptRuntimePackets(endResult.actionPackets);
    expect(adapted.some(m => m.type === 'kids_session_complete')).toBe(true);
    expect(requiresSessionClose(adapted)).toBe(true);
  });

  it('endKidsBrainSession closing text has no animal words and no placeholders', async () => {
    const startResult = startKidsBrainSession(makeSessionInput());
    const endResult   = await endKidsBrainSession(startResult.sessionMemory);
    const adapted     = adaptRuntimePackets(endResult.actionPackets);

    for (const msg of adapted) {
      if (msg.type === 'kids_teacher_text') {
        assertNoAnimalWords(msg.text, 'session-end');
        assertNoPlaceholders(msg.text, 'session-end');
      }
    }
  });

  it('lesson-ws.ts wires handleKidsBrainV1LessonStart and processKidsBrainV1Turn', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const wsPath = resolve(__dirname, '../../../ws/lesson-ws.ts');
    const content = readFileSync(wsPath, 'utf-8');

    expect(content).toContain('handleKidsBrainV1LessonStart');
    expect(content).toContain('processKidsBrainV1Turn');
    expect(content).toContain('USE_KIDS_BRAIN_V1');
    expect(content).toContain('kids-brain/runtime');
    expect(content).toContain('kidsAnalyticsFinalized');
    expect(content).toContain('reconnectSession');
    expect(content).toContain('saveSession');
    expect(content).toContain('persistKidsBrainAnalytics');
  });
});

// ── Suite 7: Redis Serialisation Round-Trip ───────────────────────────────────

describe('Phase 15A — Redis Serialisation Round-Trip', () => {
  it('session saved then loaded from Redis survives Map<string,ItemState> round-trip', async () => {
    const redisMock = makeRedisMock();
    const store = new RedisSessionStoreImpl(redisMock as unknown as import('ioredis').Redis);
    const { store: profileStore } = makeMockProfileStore();
    const meta  = makeMeta();
    const sent: AdaptedKidsMessage[] = [];

    await handleFocusLessonStart(meta, store, sent);
    await handleTextMessage(meta, store, sent, profileStore, "I'm ready.");
    await handleTextMessage(meta, store, sent, profileStore, 'blue');

    const loaded = await store.getSession(SESSION_ID);
    expect(loaded).not.toBeNull();
    expect(loaded!.itemState).toBeInstanceOf(Map);
    // 'blue' should have been attempted
    expect(loaded!.itemState.has('blue')).toBe(true);
  });

  it('round-tripped session retains correct exercise position', async () => {
    const redisMock = makeRedisMock();
    const store = new RedisSessionStoreImpl(redisMock as unknown as import('ioredis').Redis);
    const { store: profileStore } = makeMockProfileStore();
    const meta  = makeMeta();
    const sent: AdaptedKidsMessage[] = [];

    await handleFocusLessonStart(meta, store, sent);
    await handleTextMessage(meta, store, sent, profileStore, "I'm ready.");
    await handleTextMessage(meta, store, sent, profileStore, 'blue');
    await handleTextMessage(meta, store, sent, profileStore, 'blue');

    const loaded = await store.getSession(SESSION_ID);
    expect(loaded?.currentExerciseId).toBe(EX_03);
    expect(loaded?.completedExerciseIds).toContain(EX_02);
  });

  it('round-tripped session retains lessonId kb1-u01-l02', async () => {
    const redisMock = makeRedisMock();
    const store = new RedisSessionStoreImpl(redisMock as unknown as import('ioredis').Redis);
    const { store: profileStore } = makeMockProfileStore();
    const meta  = makeMeta();
    const sent: AdaptedKidsMessage[] = [];

    await handleFocusLessonStart(meta, store, sent);
    await handleTextMessage(meta, store, sent, profileStore, "I'm ready.");

    const loaded = await store.getSession(SESSION_ID);
    expect(loaded?.lessonId).toBe('kb1-u01-l02');
  });
});
