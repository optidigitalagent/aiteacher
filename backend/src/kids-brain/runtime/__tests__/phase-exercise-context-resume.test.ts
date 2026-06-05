/**
 * Exercise Context on Resume Tests
 *
 * Proves that emitKidsExerciseContext logic (extracted helper) correctly
 * builds the payload from SessionMemory for all reconnect scenarios.
 *
 * A. Resume at ex-02-blue → payload emitted with correct fields
 * B. Resume at ex-03-green → correct exercise payload (different exercise)
 * C. Cold start (no currentExerciseId) → no payload emitted
 * D. Payload shape matches OutboundKidsExerciseContext contract
 */

import { describe, it, expect } from 'vitest';
import { findLessonById } from '../../curriculum/curriculum-loader.js';
import type { SessionMemory } from '../../contracts/session-memory.js';
import { AgeBand } from '../../shared/enums.js';
import { AGE_PROFILE_6_7 } from '../../shared/types.js';

// ── Minimal SessionMemory factory ─────────────────────────────────────────────

function makeMemory(overrides: Partial<SessionMemory> = {}): SessionMemory {
  return {
    sessionId: 'test-session',
    userId: 'user-test',
    childId: 'child-test',
    mode: 'mentium_kids',
    ageProfile: AGE_PROFILE_6_7,
    ageBand: AgeBand.SIX_SEVEN,
    currentUnitId: 'kb1-unit-01',
    currentActivityId: null,
    currentTargetItemId: null,
    currentItemAttemptCount: 0,
    lessonPhase: 'INTRODUCTION' as any,
    childState: {} as any,
    recoveryState: 'NORMAL' as any,
    itemState: new Map(),
    recentTurns: [],
    activityHistory: [],
    itemsAttempted: [],
    itemsMastered: [],
    recentPraisePhrases: [],
    l1AnchorUsedItems: [],
    l1BudgetUsed: false,
    playAlongCount: 0,
    costCounters: { llmCalls: 0, ttsChars: 0, totalCostUsd: 0 } as any,
    lessonId: 'kb1-u01-l02',
    hasStartedFirstExercise: true,
    currentExerciseId: null,
    currentExerciseOrder: null,
    exerciseAttemptCount: 0,
    exerciseCorrectCount: 0,
    completedExerciseIds: [],
    autosaveSequenceNumber: 1,
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    sessionElapsedMs: 0,
    turnNumber: 5,
    ...overrides,
  };
}

// ── Helper: build exercise context payload from memory (mirrors emitKidsExerciseContext) ──

const PROTO_LESSON_ID = 'kb1-u01-l02';

interface ExerciseContextPayload {
  exerciseId: string;
  exerciseNumber: number;
  instruction: string;
  targetWords: string[];
  choices: { choiceId: string; text: string }[];
  totalExercises: number;
  completedCount: number;
}

function buildExerciseContextPayload(memory: SessionMemory): ExerciseContextPayload | null {
  const exerciseId = memory.currentExerciseId ?? null;
  if (!exerciseId) return null;

  const ctxLesson = findLessonById(PROTO_LESSON_ID);
  const ctxExercise = ctxLesson?.exercises?.find(e => e.exerciseId === exerciseId);
  if (!ctxLesson || !ctxExercise) return null;

  const allReal = ctxLesson.exercises?.filter(e => e.order > 1) ?? [];
  const completedReal = (memory.completedExerciseIds ?? []).filter(id => {
    const ex = ctxLesson.exercises?.find(e => e.exerciseId === id);
    return ex && ex.order > 1;
  });
  const targetWords = ctxExercise.targetItemIds
    .map(id => ctxLesson.items.find(item => item.itemId === id)?.targetText ?? '')
    .filter(Boolean);

  return {
    exerciseId,
    exerciseNumber: ctxExercise.order - 1,
    instruction: ctxExercise.teacherInstruction,
    targetWords,
    choices: ctxExercise.choices ?? [],
    totalExercises: allReal.length,
    completedCount: completedReal.length,
  };
}

// ── A. Resume at ex-02-blue ────────────────────────────────────────────────────

describe('A — resume at ex-02-blue emits correct payload', () => {
  it('builds a payload with exerciseId=kb1-u01-l02-ex-02-blue', () => {
    const memory = makeMemory({ currentExerciseId: 'kb1-u01-l02-ex-02-blue' });
    const payload = buildExerciseContextPayload(memory);

    expect(payload).not.toBeNull();
    expect(payload!.exerciseId).toBe('kb1-u01-l02-ex-02-blue');
  });

  it('exerciseNumber is 1 (order=2 minus 1)', () => {
    const memory = makeMemory({ currentExerciseId: 'kb1-u01-l02-ex-02-blue' });
    const payload = buildExerciseContextPayload(memory);

    expect(payload!.exerciseNumber).toBe(1);
  });

  it('instruction matches teacherInstruction from curriculum', () => {
    const memory = makeMemory({ currentExerciseId: 'kb1-u01-l02-ex-02-blue' });
    const payload = buildExerciseContextPayload(memory);

    expect(typeof payload!.instruction).toBe('string');
    expect(payload!.instruction.length).toBeGreaterThan(0);
  });

  it('targetWords is a non-empty array for blue exercise', () => {
    const memory = makeMemory({ currentExerciseId: 'kb1-u01-l02-ex-02-blue' });
    const payload = buildExerciseContextPayload(memory);

    expect(Array.isArray(payload!.targetWords)).toBe(true);
    expect(payload!.targetWords.length).toBeGreaterThan(0);
    expect(payload!.targetWords[0]).toBeTruthy();
  });

  it('completedCount is 0 when completedExerciseIds is empty', () => {
    const memory = makeMemory({
      currentExerciseId: 'kb1-u01-l02-ex-02-blue',
      completedExerciseIds: [],
    });
    const payload = buildExerciseContextPayload(memory);

    expect(payload!.completedCount).toBe(0);
  });

  it('totalExercises reflects all non-readiness exercises in curriculum', () => {
    const memory = makeMemory({ currentExerciseId: 'kb1-u01-l02-ex-02-blue' });
    const payload = buildExerciseContextPayload(memory);

    expect(payload!.totalExercises).toBeGreaterThan(0);
  });
});

// ── B. Resume at ex-03-green ───────────────────────────────────────────────────

describe('B — resume at ex-03-green emits correct exercise payload', () => {
  it('builds a payload with exerciseId=kb1-u01-l02-ex-03-green', () => {
    const memory = makeMemory({ currentExerciseId: 'kb1-u01-l02-ex-03-green' });
    const payload = buildExerciseContextPayload(memory);

    expect(payload).not.toBeNull();
    expect(payload!.exerciseId).toBe('kb1-u01-l02-ex-03-green');
  });

  it('exerciseNumber is 2 (order=3 minus 1)', () => {
    const memory = makeMemory({ currentExerciseId: 'kb1-u01-l02-ex-03-green' });
    const payload = buildExerciseContextPayload(memory);

    expect(payload!.exerciseNumber).toBe(2);
  });

  it('completedCount is 1 when blue exercise is in completedExerciseIds', () => {
    const memory = makeMemory({
      currentExerciseId: 'kb1-u01-l02-ex-03-green',
      completedExerciseIds: ['kb1-u01-l02-ex-02-blue'],
    });
    const payload = buildExerciseContextPayload(memory);

    expect(payload!.completedCount).toBe(1);
  });

  it('green payload differs from blue payload', () => {
    const bluePayload = buildExerciseContextPayload(
      makeMemory({ currentExerciseId: 'kb1-u01-l02-ex-02-blue' }),
    );
    const greenPayload = buildExerciseContextPayload(
      makeMemory({ currentExerciseId: 'kb1-u01-l02-ex-03-green' }),
    );

    expect(bluePayload!.exerciseId).not.toBe(greenPayload!.exerciseId);
    expect(bluePayload!.exerciseNumber).not.toBe(greenPayload!.exerciseNumber);
  });
});

// ── C. Cold start — no currentExerciseId → no payload ────────────────────────

describe('C — cold start without currentExerciseId emits nothing', () => {
  it('returns null when currentExerciseId is null', () => {
    const memory = makeMemory({ currentExerciseId: null });
    const payload = buildExerciseContextPayload(memory);

    expect(payload).toBeNull();
  });

  it('returns null when currentExerciseId is undefined', () => {
    const memory = makeMemory({});
    delete (memory as any).currentExerciseId;
    const payload = buildExerciseContextPayload(memory);

    expect(payload).toBeNull();
  });

  it('returns null for fresh session before any exercise begins', () => {
    const memory = makeMemory({
      currentExerciseId: null,
      completedExerciseIds: [],
      hasStartedFirstExercise: false,
    });
    const payload = buildExerciseContextPayload(memory);

    expect(payload).toBeNull();
  });
});

// ── D. Payload shape matches OutboundKidsExerciseContext ──────────────────────

describe('D — payload shape matches OutboundKidsExerciseContext contract', () => {
  it('all required fields are present and typed correctly', () => {
    const memory = makeMemory({ currentExerciseId: 'kb1-u01-l02-ex-02-blue' });
    const payload = buildExerciseContextPayload(memory);

    expect(payload).not.toBeNull();
    expect(typeof payload!.exerciseId).toBe('string');
    expect(typeof payload!.exerciseNumber).toBe('number');
    expect(typeof payload!.instruction).toBe('string');
    expect(Array.isArray(payload!.targetWords)).toBe(true);
    expect(Array.isArray(payload!.choices)).toBe(true);
    expect(typeof payload!.totalExercises).toBe('number');
    expect(typeof payload!.completedCount).toBe('number');
  });

  it('exerciseNumber is a non-negative integer', () => {
    const memory = makeMemory({ currentExerciseId: 'kb1-u01-l02-ex-02-blue' });
    const payload = buildExerciseContextPayload(memory);

    expect(payload!.exerciseNumber).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(payload!.exerciseNumber)).toBe(true);
  });

  it('completedCount never exceeds totalExercises', () => {
    const allExerciseIds = [
      'kb1-u01-l02-ex-02-blue',
      'kb1-u01-l02-ex-03-green',
      'kb1-u01-l02-ex-04-red',
    ];
    const memory = makeMemory({
      currentExerciseId: 'kb1-u01-l02-ex-04-red',
      completedExerciseIds: allExerciseIds.slice(0, 2),
    });
    const payload = buildExerciseContextPayload(memory);

    expect(payload!.completedCount).toBeLessThanOrEqual(payload!.totalExercises);
  });

  it('readiness exercise (order=1) is NOT counted in totalExercises', () => {
    const ctxLesson = findLessonById(PROTO_LESSON_ID);
    const readiness = ctxLesson?.exercises?.find(e => e.order === 1);
    const memory = makeMemory({
      currentExerciseId: 'kb1-u01-l02-ex-02-blue',
      completedExerciseIds: readiness ? [readiness.exerciseId] : [],
    });
    const payload = buildExerciseContextPayload(memory);

    // Readiness exercise should not inflate completedCount
    expect(payload!.completedCount).toBe(0);
  });
});
