/**
 * Phase 13D — Exercise Runtime Bridge tests.
 *
 * Proves:
 *  A. Session bootstrap seeds first exercise
 *  B. currentExerciseId starts at readiness exercise (ex-01)
 *  C. Readiness handshake advances to listen_and_repeat_blue (ex-02)
 *  D. 2 correct answers complete blue exercise → advance to ex-03-green
 *  E. currentTargetItemId changes blue → green after blue exercise completes
 *  F. completedExerciseIds includes completed exercise
 *  G. exerciseAttemptCount resets after exercise completion
 *  H. exerciseCorrectCount resets after exercise completion
 *  I. Wrong answer increments exerciseAttemptCount but not correctCount
 *  J. Session memory fields are JSON-serializable
 *  K. Existing no-exercise lessons still work (PROTO_ANIMALS)
 *  L. currentExerciseId is null after last exercise completes (lesson close)
 *  M. CHOOSE exercise completes after 1 correct choice
 *  N. exerciseAttemptCount increments for CORRECT_REPETITIONS until completion
 *  O. No WebSocket protocol changes (RuntimeActionPacketType unchanged)
 */

import { describe, it, expect } from 'vitest';
import {
  AgeBand,
  ClassificationLabel,
  ActivityType,
} from '../../shared/enums.js';
import { AGE_PROFILE_6_7, AGE_PROFILE_8_9 } from '../../shared/types.js';
import { startKidsBrainSession, processKidsBrainTurn, RuntimeActionPacketType } from '../index.js';
import type { KidsBrainSessionStartInput, KidsBrainTurnInput } from '../runtime-types.js';
import type { SessionMemory } from '../../contracts/session-memory.js';
import type { STTResult } from '../../contracts/stt-result.js';

// ── Constants ──────────────────────────────────────────────────────────────────

const KB1_LESSON_2_WORDS = ['blue', 'green', 'pink', 'purple', 'orange', 'red', 'yellow'];
const PROTO_WORDS = ['cat', 'dog', 'lion', 'monkey', 'elephant', 'tiger'];

const EX_01_ID = 'kb1-u01-l02-ex-01-readiness';
const EX_02_ID = 'kb1-u01-l02-ex-02-blue';
const EX_03_ID = 'kb1-u01-l02-ex-03-green';
const EX_10_ID = 'kb1-u01-l02-ex-10-close';

// ── STT helpers ────────────────────────────────────────────────────────────────

function makeCorrectStt(text: string): STTResult {
  return {
    text,
    confidence: 1.0,
    languageCode: 'en-US',
    alternatives: [],
    speechStartMs: 100,
    speechEndMs: 700,
    speechDurationMs: 600,
    audioEnergyLevel: 0.85,
    provider: 'google_chirp_v2',
    providerRequestId: '13d-correct',
    processingLatencyMs: 50,
  };
}

function makeWrongStt(text: string): STTResult {
  return {
    text,
    confidence: 0.8,
    languageCode: 'en-US',
    alternatives: [],
    speechStartMs: 100,
    speechEndMs: 600,
    speechDurationMs: 500,
    audioEnergyLevel: 0.7,
    provider: 'google_chirp_v2',
    providerRequestId: '13d-wrong',
    processingLatencyMs: 50,
  };
}

// ── Session factories ──────────────────────────────────────────────────────────

function makeSessionInput(
  sessionId: string,
  words = KB1_LESSON_2_WORDS,
  ageBand = AgeBand.SIX_SEVEN,
): KidsBrainSessionStartInput {
  return {
    sessionId,
    userId: `user-${sessionId}`,
    childId: `child-${sessionId}`,
    childFirstName: 'Lily',
    ageBand,
    ageProfile: ageBand === AgeBand.EIGHT_NINE ? AGE_PROFILE_8_9 : AGE_PROFILE_6_7,
    lessonTargetWords: [...words],
    unitReviewWords: [],
    characterNames: ['milo'],
    timestamp: new Date().toISOString(),
  };
}

function makeProtoSessionInput(sessionId: string): KidsBrainSessionStartInput {
  return {
    sessionId,
    userId: `user-${sessionId}`,
    childId: `child-${sessionId}`,
    childFirstName: 'Leo',
    ageBand: AgeBand.SIX_SEVEN,
    ageProfile: AGE_PROFILE_6_7,
    lessonTargetWords: [...PROTO_WORDS],
    unitReviewWords: [],
    characterNames: ['milo'],
    timestamp: new Date().toISOString(),
  };
}

function makeTurn(
  mem: SessionMemory,
  stt: STTResult,
  targetWord: string,
  words = KB1_LESSON_2_WORDS,
  latencyMs = 800,
): KidsBrainTurnInput {
  return {
    sessionMemory: mem,
    sttResult: stt,
    responseLatencyMs: latencyMs,
    silenceDurationMs: 0,
    attemptCount: mem.currentItemAttemptCount,
    targetWord,
    childFirstName: 'Lily',
    lessonTargetWords: [...words],
    unitReviewWords: [],
    characterNames: ['milo'],
    timestamp: new Date().toISOString(),
  };
}

// ── A & B. Bootstrap seeds exercise state ─────────────────────────────────────

describe('A+B — session bootstrap seeds first exercise', () => {
  it('currentExerciseId is set after bootstrap', () => {
    const { sessionMemory } = startKidsBrainSession(makeSessionInput('13d-A1'));
    expect(sessionMemory.currentExerciseId).toBeDefined();
    expect(sessionMemory.currentExerciseId).not.toBeNull();
  });

  it('currentExerciseId starts at ex-01-readiness', () => {
    const { sessionMemory } = startKidsBrainSession(makeSessionInput('13d-A2'));
    expect(sessionMemory.currentExerciseId).toBe(EX_01_ID);
  });

  it('currentExerciseOrder starts at 1', () => {
    const { sessionMemory } = startKidsBrainSession(makeSessionInput('13d-A3'));
    expect(sessionMemory.currentExerciseOrder).toBe(1);
  });

  it('exerciseAttemptCount starts at 0', () => {
    const { sessionMemory } = startKidsBrainSession(makeSessionInput('13d-A4'));
    expect(sessionMemory.exerciseAttemptCount).toBe(0);
  });

  it('exerciseCorrectCount starts at 0', () => {
    const { sessionMemory } = startKidsBrainSession(makeSessionInput('13d-A5'));
    expect(sessionMemory.exerciseCorrectCount).toBe(0);
  });

  it('completedExerciseIds starts as empty array', () => {
    const { sessionMemory } = startKidsBrainSession(makeSessionInput('13d-A6'));
    expect(sessionMemory.completedExerciseIds).toEqual([]);
  });
});

// ── C. Readiness handshake advances exercise from ex-01 → ex-02 ───────────────

describe('C — readiness handshake advances to listen_and_repeat_blue (ex-02)', () => {
  it('currentExerciseId becomes ex-02-blue after readiness phrase', async () => {
    const { sessionMemory } = startKidsBrainSession(makeSessionInput('13d-C1'));
    expect(sessionMemory.currentExerciseId).toBe(EX_01_ID);

    const result = await processKidsBrainTurn(
      makeTurn(sessionMemory, makeCorrectStt("I'm ready"), 'blue'),
    );

    expect(result.updatedSessionMemory.currentExerciseId).toBe(EX_02_ID);
  });

  it('ex-01 is in completedExerciseIds after readiness', async () => {
    const { sessionMemory } = startKidsBrainSession(makeSessionInput('13d-C2'));

    const result = await processKidsBrainTurn(
      makeTurn(sessionMemory, makeCorrectStt('ready'), 'blue'),
    );

    expect(result.updatedSessionMemory.completedExerciseIds).toContain(EX_01_ID);
  });

  it('currentTargetItemId stays blue after readiness', async () => {
    const { sessionMemory } = startKidsBrainSession(makeSessionInput('13d-C3'));
    expect(sessionMemory.currentTargetItemId).toBe('blue');

    const result = await processKidsBrainTurn(
      makeTurn(sessionMemory, makeCorrectStt('start'), 'blue'),
    );

    // ex-02 targets 'blue' — no change
    expect(result.updatedSessionMemory.currentTargetItemId).toBe('blue');
  });

  it('exerciseAttemptCount resets to 0 after readiness exercise completes', async () => {
    const { sessionMemory } = startKidsBrainSession(makeSessionInput('13d-C4'));

    const result = await processKidsBrainTurn(
      makeTurn(sessionMemory, makeCorrectStt('yes'), 'blue'),
    );

    expect(result.updatedSessionMemory.exerciseAttemptCount).toBe(0);
    expect(result.updatedSessionMemory.exerciseCorrectCount).toBe(0);
  });
});

// ── D & E. 2 correct answers complete blue exercise, target advances to green ──

describe('D+E — 2 correct blue answers complete ex-02, target advances to green', () => {
  async function getPostReadinessMem(sessionId: string): Promise<SessionMemory> {
    const { sessionMemory } = startKidsBrainSession(makeSessionInput(sessionId));
    const r = await processKidsBrainTurn(
      makeTurn(sessionMemory, makeCorrectStt('ready'), 'blue'),
    );
    return r.updatedSessionMemory;
  }

  it('after 1 correct blue, exercise is still ex-02 (not yet complete)', async () => {
    const mem = await getPostReadinessMem('13d-D1');
    expect(mem.currentExerciseId).toBe(EX_02_ID);

    const r1 = await processKidsBrainTurn(
      makeTurn({ ...mem, hasStartedFirstExercise: true }, makeCorrectStt('blue'), 'blue'),
    );

    expect(r1.updatedSessionMemory.currentExerciseId).toBe(EX_02_ID);
    expect(r1.updatedSessionMemory.exerciseCorrectCount).toBe(1);
  });

  it('after 2 correct blue, exercise advances to ex-03-green', async () => {
    const mem = await getPostReadinessMem('13d-D2');

    const r1 = await processKidsBrainTurn(
      makeTurn({ ...mem, hasStartedFirstExercise: true }, makeCorrectStt('blue'), 'blue'),
    );
    const r2 = await processKidsBrainTurn(
      makeTurn({ ...r1.updatedSessionMemory, hasStartedFirstExercise: true }, makeCorrectStt('blue'), 'blue'),
    );

    expect(r2.updatedSessionMemory.currentExerciseId).toBe(EX_03_ID);
  });

  it('currentTargetItemId changes from blue to green when ex-02 completes', async () => {
    const mem = await getPostReadinessMem('13d-E1');

    const r1 = await processKidsBrainTurn(
      makeTurn({ ...mem, hasStartedFirstExercise: true }, makeCorrectStt('blue'), 'blue'),
    );
    const r2 = await processKidsBrainTurn(
      makeTurn({ ...r1.updatedSessionMemory, hasStartedFirstExercise: true }, makeCorrectStt('blue'), 'blue'),
    );

    expect(r2.updatedSessionMemory.currentTargetItemId).toBe('green');
  });

  it('currentExerciseOrder advances to 3 after blue completes', async () => {
    const mem = await getPostReadinessMem('13d-D3');

    const r1 = await processKidsBrainTurn(
      makeTurn({ ...mem, hasStartedFirstExercise: true }, makeCorrectStt('blue'), 'blue'),
    );
    const r2 = await processKidsBrainTurn(
      makeTurn({ ...r1.updatedSessionMemory, hasStartedFirstExercise: true }, makeCorrectStt('blue'), 'blue'),
    );

    expect(r2.updatedSessionMemory.currentExerciseOrder).toBe(3);
  });
});

// ── F. completedExerciseIds accumulates completed exercises ───────────────────

describe('F — completedExerciseIds includes completed exercises', () => {
  it('ex-01 and ex-02 are in completedExerciseIds after both complete', async () => {
    const { sessionMemory } = startKidsBrainSession(makeSessionInput('13d-F1'));

    // Complete ex-01 via readiness
    const r0 = await processKidsBrainTurn(
      makeTurn(sessionMemory, makeCorrectStt('ready'), 'blue'),
    );
    const mem1 = r0.updatedSessionMemory;

    // Complete ex-02 via 2 correct blues
    const r1 = await processKidsBrainTurn(
      makeTurn({ ...mem1, hasStartedFirstExercise: true }, makeCorrectStt('blue'), 'blue'),
    );
    const r2 = await processKidsBrainTurn(
      makeTurn({ ...r1.updatedSessionMemory, hasStartedFirstExercise: true }, makeCorrectStt('blue'), 'blue'),
    );

    expect(r2.updatedSessionMemory.completedExerciseIds).toContain(EX_01_ID);
    expect(r2.updatedSessionMemory.completedExerciseIds).toContain(EX_02_ID);
  });
});

// ── G & H. Counters reset after exercise completion ───────────────────────────

describe('G+H — exerciseAttemptCount and exerciseCorrectCount reset after completion', () => {
  it('exerciseAttemptCount is 0 after ex-02 completes', async () => {
    const { sessionMemory } = startKidsBrainSession(makeSessionInput('13d-G1'));
    const r0 = await processKidsBrainTurn(
      makeTurn(sessionMemory, makeCorrectStt('ready'), 'blue'),
    );
    const mem = { ...r0.updatedSessionMemory, hasStartedFirstExercise: true };

    const r1 = await processKidsBrainTurn(makeTurn(mem, makeCorrectStt('blue'), 'blue'));
    const r2 = await processKidsBrainTurn(
      makeTurn({ ...r1.updatedSessionMemory, hasStartedFirstExercise: true }, makeCorrectStt('blue'), 'blue'),
    );

    expect(r2.updatedSessionMemory.exerciseAttemptCount).toBe(0);
  });

  it('exerciseCorrectCount is 0 after ex-02 completes', async () => {
    const { sessionMemory } = startKidsBrainSession(makeSessionInput('13d-H1'));
    const r0 = await processKidsBrainTurn(
      makeTurn(sessionMemory, makeCorrectStt('ready'), 'blue'),
    );
    const mem = { ...r0.updatedSessionMemory, hasStartedFirstExercise: true };

    const r1 = await processKidsBrainTurn(makeTurn(mem, makeCorrectStt('blue'), 'blue'));
    const r2 = await processKidsBrainTurn(
      makeTurn({ ...r1.updatedSessionMemory, hasStartedFirstExercise: true }, makeCorrectStt('blue'), 'blue'),
    );

    expect(r2.updatedSessionMemory.exerciseCorrectCount).toBe(0);
  });
});

// ── I. Wrong answer increments attemptCount but not correctCount ──────────────

describe('I — wrong answer increments exerciseAttemptCount', () => {
  it('wrong answer increments exerciseAttemptCount by 1', async () => {
    const { sessionMemory } = startKidsBrainSession(makeSessionInput('13d-I1'));
    const r0 = await processKidsBrainTurn(
      makeTurn(sessionMemory, makeCorrectStt('ready'), 'blue'),
    );
    const mem = { ...r0.updatedSessionMemory, hasStartedFirstExercise: true };
    const beforeCount = mem.exerciseAttemptCount ?? 0;

    const r1 = await processKidsBrainTurn(makeTurn(mem, makeWrongStt('dog'), 'blue'));

    expect(r1.updatedSessionMemory.exerciseAttemptCount).toBe(beforeCount + 1);
  });

  it('wrong answer does not increment exerciseCorrectCount', async () => {
    const { sessionMemory } = startKidsBrainSession(makeSessionInput('13d-I2'));
    const r0 = await processKidsBrainTurn(
      makeTurn(sessionMemory, makeCorrectStt('ready'), 'blue'),
    );
    const mem = { ...r0.updatedSessionMemory, hasStartedFirstExercise: true };
    const beforeCorrect = mem.exerciseCorrectCount ?? 0;

    const r1 = await processKidsBrainTurn(makeTurn(mem, makeWrongStt('dog'), 'blue'));

    expect(r1.updatedSessionMemory.exerciseCorrectCount).toBe(beforeCorrect);
  });

  it('correct answer increments exerciseCorrectCount', async () => {
    const { sessionMemory } = startKidsBrainSession(makeSessionInput('13d-I3'));
    const r0 = await processKidsBrainTurn(
      makeTurn(sessionMemory, makeCorrectStt('ready'), 'blue'),
    );
    const mem = { ...r0.updatedSessionMemory, hasStartedFirstExercise: true };

    // First correct answer (doesn't complete — needs 2)
    const r1 = await processKidsBrainTurn(makeTurn(mem, makeCorrectStt('blue'), 'blue'));

    expect(r1.updatedSessionMemory.exerciseCorrectCount).toBe(1);
  });

  it('currentExerciseId stays the same after wrong answer', async () => {
    const { sessionMemory } = startKidsBrainSession(makeSessionInput('13d-I4'));
    const r0 = await processKidsBrainTurn(
      makeTurn(sessionMemory, makeCorrectStt('ready'), 'blue'),
    );
    const mem = { ...r0.updatedSessionMemory, hasStartedFirstExercise: true };

    const r1 = await processKidsBrainTurn(makeTurn(mem, makeWrongStt('dog'), 'blue'));

    expect(r1.updatedSessionMemory.currentExerciseId).toBe(EX_02_ID);
  });
});

// ── J. Session memory fields are JSON-serializable ────────────────────────────

describe('J — exercise fields are JSON-serializable', () => {
  it('exercise fields survive JSON round-trip', () => {
    const { sessionMemory } = startKidsBrainSession(makeSessionInput('13d-J1'));

    const exerciseFields = {
      currentExerciseId: sessionMemory.currentExerciseId,
      currentExerciseOrder: sessionMemory.currentExerciseOrder,
      exerciseAttemptCount: sessionMemory.exerciseAttemptCount,
      exerciseCorrectCount: sessionMemory.exerciseCorrectCount,
      completedExerciseIds: sessionMemory.completedExerciseIds,
    };

    const serialized = JSON.stringify(exerciseFields);
    const parsed = JSON.parse(serialized);

    expect(parsed.currentExerciseId).toBe(EX_01_ID);
    expect(parsed.currentExerciseOrder).toBe(1);
    expect(parsed.exerciseAttemptCount).toBe(0);
    expect(parsed.exerciseCorrectCount).toBe(0);
    expect(parsed.completedExerciseIds).toEqual([]);
  });
});

// ── K. Existing no-exercise lessons still work ────────────────────────────────

describe('K — existing no-exercise lessons work without exercise state', () => {
  it('session with no exercise state proceeds normally (old session compat)', async () => {
    const { sessionMemory } = startKidsBrainSession(makeSessionInput('13d-K1'));
    // Simulate an old session that has no exercise fields
    const oldStyleMem: SessionMemory = {
      ...sessionMemory,
      currentExerciseId: undefined,
      currentExerciseOrder: undefined,
      exerciseAttemptCount: undefined,
      exerciseCorrectCount: undefined,
      completedExerciseIds: undefined,
      hasStartedFirstExercise: true,
    };

    const result = await processKidsBrainTurn(
      makeTurn(oldStyleMem, makeCorrectStt('blue'), 'blue'),
    );

    expect(result.updatedSessionMemory).toBeDefined();
    expect(result.safeToContinue).toBe(true);
    // Exercise fields remain absent (no seeding in bridge)
    expect(result.updatedSessionMemory.currentExerciseId).toBeUndefined();
  });

  it('proto animals lesson still processes turns normally', async () => {
    const protoInput = makeProtoSessionInput('13d-K2');
    const { sessionMemory } = startKidsBrainSession(protoInput);
    const mem = { ...sessionMemory, hasStartedFirstExercise: true };

    const result = await processKidsBrainTurn(
      makeTurn(mem, makeCorrectStt('cat'), 'cat', PROTO_WORDS),
    );

    expect(result.updatedSessionMemory).toBeDefined();
    expect(result.safeToContinue).toBe(true);
  });
});

// ── L. currentExerciseId is null after last exercise ─────────────────────────

describe('L — currentExerciseId is null after lesson sequence exhausted', () => {
  it('currentExerciseId becomes null after ex-10-close completes', async () => {
    // Directly set state at ex-10 (close exercise, TEACHER_CONTROLLED, maxAttempts:1)
    const { sessionMemory } = startKidsBrainSession(makeSessionInput('13d-L1'));
    const atClose: SessionMemory = {
      ...sessionMemory,
      hasStartedFirstExercise: true,
      currentExerciseId: EX_10_ID,
      currentExerciseOrder: 10,
      exerciseAttemptCount: 0,
      exerciseCorrectCount: 0,
      completedExerciseIds: [],
    };

    const result = await processKidsBrainTurn(
      makeTurn(atClose, makeCorrectStt('done'), 'blue'),
    );

    // ex-10 has nextExerciseId: null → exhausted
    expect(result.updatedSessionMemory.currentExerciseId).toBeNull();
  });
});

// ── M. CHOOSE exercise completes after 1 correct choice ──────────────────────

describe('M — CHOOSE exercise completes after 1 correct choice', () => {
  it('ex-06 (CORRECT_CHOICE, required=1) completes after 1 correct answer', async () => {
    const { sessionMemory } = startKidsBrainSession(makeSessionInput('13d-M1'));
    const atChoose: SessionMemory = {
      ...sessionMemory,
      hasStartedFirstExercise: true,
      currentExerciseId: 'kb1-u01-l02-ex-06-choose-pair-1',
      currentExerciseOrder: 6,
      exerciseAttemptCount: 0,
      exerciseCorrectCount: 0,
      completedExerciseIds: [],
    };

    const result = await processKidsBrainTurn(
      makeTurn(atChoose, makeCorrectStt('blue'), 'blue'),
    );

    expect(result.updatedSessionMemory.currentExerciseId).toBe('kb1-u01-l02-ex-07-choose-pair-2');
    expect(result.updatedSessionMemory.completedExerciseIds).toContain('kb1-u01-l02-ex-06-choose-pair-1');
  });
});

// ── N. exerciseAttemptCount increments correctly across multiple turns ─────────

describe('N — exerciseAttemptCount tracks turns within an exercise', () => {
  it('3 wrong turns increment exerciseAttemptCount to 3', async () => {
    const { sessionMemory } = startKidsBrainSession(makeSessionInput('13d-N1'));
    const r0 = await processKidsBrainTurn(
      makeTurn(sessionMemory, makeCorrectStt('ready'), 'blue'),
    );
    let mem = { ...r0.updatedSessionMemory, hasStartedFirstExercise: true };

    let mem2: SessionMemory = mem;
    for (let i = 0; i < 3; i++) {
      const r = await processKidsBrainTurn(makeTurn(mem2, makeWrongStt('wrong'), 'blue'));
      mem2 = r.updatedSessionMemory;
    }

    expect(mem2.exerciseAttemptCount).toBe(3);
    expect(mem2.currentExerciseId).toBe(EX_02_ID);
  });
});

// ── O. No WebSocket protocol changes ─────────────────────────────────────────

describe('O — no WebSocket protocol changes', () => {
  it('RuntimeActionPacketType values are unchanged', () => {
    expect(RuntimeActionPacketType.TEACHER_TEXT).toBe('teacher_text');
    expect(RuntimeActionPacketType.START_LISTENING).toBe('start_listening');
    expect(RuntimeActionPacketType.STOP_LISTENING).toBe('stop_listening');
    expect(RuntimeActionPacketType.SESSION_COMPLETE).toBe('session_complete');
    expect(RuntimeActionPacketType.SAFETY_CLOSE).toBe('safety_close');
  });

  it('action packets contain only known packet types after exercise advance', async () => {
    const { sessionMemory } = startKidsBrainSession(makeSessionInput('13d-O1'));
    const r0 = await processKidsBrainTurn(
      makeTurn(sessionMemory, makeCorrectStt('ready'), 'blue'),
    );

    const validTypes = new Set(Object.values(RuntimeActionPacketType));
    for (const pkt of r0.actionPackets) {
      expect(validTypes.has(pkt.packetType)).toBe(true);
    }
  });
});
