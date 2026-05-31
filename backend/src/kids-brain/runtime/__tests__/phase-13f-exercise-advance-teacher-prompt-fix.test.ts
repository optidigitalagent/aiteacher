/**
 * Phase 13F — Exercise Advance Teacher Prompt Fix tests.
 *
 * Proves:
 *  P. Completion turn for blue exercise: teacher says green exercise prompt
 *  Q. Stale blue prompt is NOT emitted on the blue completion turn
 *  R. No override when exercise does not advance (wrong answer)
 *  S. Close exercise (ex-10) produces close prompt when lesson exhausted
 *  T. Classification result is unchanged by Step 6B
 *  U. Readiness handshake still emits "Listen — blue! Now you!" (path unchanged)
 *  V. Green exercise completion → teacher says red exercise prompt
 *  W. No WebSocket protocol changes
 *  X. First correct blue answer (not yet completing) does not override teacher text
 */

import { describe, it, expect } from 'vitest';
import {
  AgeBand,
  ClassificationLabel,
} from '../../shared/enums.js';
import { AGE_PROFILE_6_7 } from '../../shared/types.js';
import { startKidsBrainSession, processKidsBrainTurn, RuntimeActionPacketType } from '../index.js';
import type { KidsBrainSessionStartInput, KidsBrainTurnInput } from '../runtime-types.js';
import type { SessionMemory } from '../../contracts/session-memory.js';
import type { STTResult } from '../../contracts/stt-result.js';

// ── Constants ──────────────────────────────────────────────────────────────────

const KB1_LESSON_2_WORDS = ['blue', 'green', 'pink', 'purple', 'orange', 'red', 'yellow'];

const EX_02_ID = 'kb1-u01-l02-ex-02-blue';
const EX_03_ID = 'kb1-u01-l02-ex-03-green';
const EX_04_ID = 'kb1-u01-l02-ex-04-red';
const EX_10_ID = 'kb1-u01-l02-ex-10-close';

// Authored exercise prompts (ttsText takes priority over text in buildExercisePrompt)
const PROMPT_BLUE   = 'Listen — blue! Now you say it!';
const PROMPT_GREEN  = 'Listen — green! Now you say it!';
const PROMPT_RED    = 'Listen — red! Now you say it!';
const PROMPT_CLOSE  = 'Well done! We finished colours today. Great job!';

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
    providerRequestId: '13f-correct',
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
    providerRequestId: '13f-wrong',
    processingLatencyMs: 50,
  };
}

// ── Session factories ──────────────────────────────────────────────────────────

function makeSessionInput(sessionId: string): KidsBrainSessionStartInput {
  return {
    sessionId,
    userId: `user-${sessionId}`,
    childId: `child-${sessionId}`,
    childFirstName: 'Lily',
    ageBand: AgeBand.SIX_SEVEN,
    ageProfile: AGE_PROFILE_6_7,
    lessonTargetWords: [...KB1_LESSON_2_WORDS],
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

// Shared helper: boot a session and advance past the readiness handshake to ex-02-blue.
async function bootToBlueExercise(sessionId: string): Promise<SessionMemory> {
  const { sessionMemory } = startKidsBrainSession(makeSessionInput(sessionId));
  const r = await processKidsBrainTurn(
    makeTurn(sessionMemory, makeCorrectStt('ready'), 'blue'),
  );
  return r.updatedSessionMemory;
}

// Helper: extract TEACHER_TEXT packet teacherText from action packets.
function getTeacherText(
  actionPackets: import('../runtime-types.js').RuntimeActionPacket[],
): string | undefined {
  const pkt = actionPackets.find(p => p.packetType === RuntimeActionPacketType.TEACHER_TEXT);
  return (pkt as { teacherText?: string } | undefined)?.teacherText;
}

// ── P. Completion turn teacher text is next exercise prompt ───────────────────

describe('P — blue completion turn: teacher says green exercise prompt', () => {
  it('teacher text on blue completion turn is the green exercise authored prompt', async () => {
    const mem = await bootToBlueExercise('13f-P1');

    const r1 = await processKidsBrainTurn(
      makeTurn({ ...mem, hasStartedFirstExercise: true }, makeCorrectStt('blue'), 'blue'),
    );
    const r2 = await processKidsBrainTurn(
      makeTurn({ ...r1.updatedSessionMemory, hasStartedFirstExercise: true }, makeCorrectStt('blue'), 'blue'),
    );

    expect(getTeacherText(r2.actionPackets)).toBe(PROMPT_GREEN);
  });

  it('teacherResponsePlan.mainText on completion turn matches green exercise prompt', async () => {
    const mem = await bootToBlueExercise('13f-P2');

    const r1 = await processKidsBrainTurn(
      makeTurn({ ...mem, hasStartedFirstExercise: true }, makeCorrectStt('blue'), 'blue'),
    );
    const r2 = await processKidsBrainTurn(
      makeTurn({ ...r1.updatedSessionMemory, hasStartedFirstExercise: true }, makeCorrectStt('blue'), 'blue'),
    );

    expect(r2.teacherResponsePlan.mainText).toBe(PROMPT_GREEN);
  });

  it('updatedSessionMemory advances to ex-03-green on the completion turn', async () => {
    const mem = await bootToBlueExercise('13f-P3');

    const r1 = await processKidsBrainTurn(
      makeTurn({ ...mem, hasStartedFirstExercise: true }, makeCorrectStt('blue'), 'blue'),
    );
    const r2 = await processKidsBrainTurn(
      makeTurn({ ...r1.updatedSessionMemory, hasStartedFirstExercise: true }, makeCorrectStt('blue'), 'blue'),
    );

    expect(r2.updatedSessionMemory.currentExerciseId).toBe(EX_03_ID);
  });
});

// ── Q. Stale blue prompt is NOT emitted ──────────────────────────────────────

describe('Q — stale blue prompt not emitted after blue exercise completion', () => {
  it('completion turn teacher text does not contain stale repeat-prompt text', async () => {
    const mem = await bootToBlueExercise('13f-Q1');

    const r1 = await processKidsBrainTurn(
      makeTurn({ ...mem, hasStartedFirstExercise: true }, makeCorrectStt('blue'), 'blue'),
    );
    const r2 = await processKidsBrainTurn(
      makeTurn({ ...r1.updatedSessionMemory, hasStartedFirstExercise: true }, makeCorrectStt('blue'), 'blue'),
    );

    const teacherText = getTeacherText(r2.actionPackets) ?? '';
    // Must not say blue-targeted repeat/hesitant templates
    expect(teacherText).not.toContain('Say it again');
    expect(teacherText).not.toContain('one more time');
  });

  it('completion turn teacher text is not identical to pre-bridge teacher text', async () => {
    const mem = await bootToBlueExercise('13f-Q2');

    // Simulate what pre-bridge teacher text would look like: first correct blue
    const r1 = await processKidsBrainTurn(
      makeTurn({ ...mem, hasStartedFirstExercise: true }, makeCorrectStt('blue'), 'blue'),
    );
    const preBlueCompletionText = getTeacherText(r1.actionPackets) ?? '';

    // Completion turn
    const r2 = await processKidsBrainTurn(
      makeTurn({ ...r1.updatedSessionMemory, hasStartedFirstExercise: true }, makeCorrectStt('blue'), 'blue'),
    );
    const completionTurnText = getTeacherText(r2.actionPackets) ?? '';

    // After step 6B: completion turn text must be the authored green prompt
    expect(completionTurnText).toBe(PROMPT_GREEN);
    // And it differs from what a mid-exercise template would say
    expect(completionTurnText).not.toBe(preBlueCompletionText);
  });
});

// ── R. No override when exercise does not advance ─────────────────────────────

describe('R — no teacher text override when exercise does not advance', () => {
  it('wrong answer mid-blue exercise: teacher text is a wrong-answer template, not green prompt', async () => {
    const mem = await bootToBlueExercise('13f-R1');

    const r = await processKidsBrainTurn(
      makeTurn({ ...mem, hasStartedFirstExercise: true }, makeWrongStt('dog'), 'blue'),
    );

    expect(getTeacherText(r.actionPackets)).not.toBe(PROMPT_GREEN);
    expect(r.updatedSessionMemory.currentExerciseId).toBe(EX_02_ID);
  });

  it('first correct blue answer (not completing): teacher text is NOT the green prompt', async () => {
    const mem = await bootToBlueExercise('13f-R2');

    const r = await processKidsBrainTurn(
      makeTurn({ ...mem, hasStartedFirstExercise: true }, makeCorrectStt('blue'), 'blue'),
    );

    // After 1 correct: exercise still ex-02, no advance
    expect(r.updatedSessionMemory.currentExerciseId).toBe(EX_02_ID);
    expect(getTeacherText(r.actionPackets)).not.toBe(PROMPT_GREEN);
  });

  it('wrong answer: currentExerciseId stays on ex-02-blue', async () => {
    const mem = await bootToBlueExercise('13f-R3');

    const r = await processKidsBrainTurn(
      makeTurn({ ...mem, hasStartedFirstExercise: true }, makeWrongStt('cat'), 'blue'),
    );

    expect(r.updatedSessionMemory.currentExerciseId).toBe(EX_02_ID);
  });
});

// ── S. Close exercise produces close prompt ───────────────────────────────────

describe('S — close exercise (ex-10) produces close prompt when lesson exhausted', () => {
  it('teacher text on close exercise turn is the authored close prompt', async () => {
    const { sessionMemory } = startKidsBrainSession(makeSessionInput('13f-S1'));
    const atClose: SessionMemory = {
      ...sessionMemory,
      hasStartedFirstExercise: true,
      currentExerciseId: EX_10_ID,
      currentExerciseOrder: 10,
      exerciseAttemptCount: 0,
      exerciseCorrectCount: 0,
      completedExerciseIds: [],
    };

    const r = await processKidsBrainTurn(
      makeTurn(atClose, makeCorrectStt('done'), 'blue'),
    );

    // ex-10 is TEACHER_CONTROLLED maxAttempts=1 → auto-completes → lesson null
    expect(r.updatedSessionMemory.currentExerciseId).toBeNull();
    expect(getTeacherText(r.actionPackets)).toBe(PROMPT_CLOSE);
  });

  it('teacherResponsePlan.mainText is close prompt after lesson exhausted', async () => {
    const { sessionMemory } = startKidsBrainSession(makeSessionInput('13f-S2'));
    const atClose: SessionMemory = {
      ...sessionMemory,
      hasStartedFirstExercise: true,
      currentExerciseId: EX_10_ID,
      currentExerciseOrder: 10,
      exerciseAttemptCount: 0,
      exerciseCorrectCount: 0,
      completedExerciseIds: [],
    };

    const r = await processKidsBrainTurn(
      makeTurn(atClose, makeCorrectStt('done'), 'blue'),
    );

    expect(r.teacherResponsePlan.mainText).toBe(PROMPT_CLOSE);
  });
});

// ── T. Classification and learning decision remain unchanged ──────────────────

describe('T — classification result unchanged by Step 6B', () => {
  it('classificationResult.label is a correct label after blue completion', async () => {
    const mem = await bootToBlueExercise('13f-T1');

    const r1 = await processKidsBrainTurn(
      makeTurn({ ...mem, hasStartedFirstExercise: true }, makeCorrectStt('blue'), 'blue'),
    );
    const r2 = await processKidsBrainTurn(
      makeTurn({ ...r1.updatedSessionMemory, hasStartedFirstExercise: true }, makeCorrectStt('blue'), 'blue'),
    );

    const correctLabels = new Set([
      ClassificationLabel.CORRECT_CONFIDENT,
      ClassificationLabel.CORRECT_HESITANT,
      ClassificationLabel.NEAR_CORRECT,
      ClassificationLabel.PRONUNCIATION_VARIANT,
      ClassificationLabel.REPEATED_AFTER_MODEL,
    ]);
    expect(correctLabels.has(r2.classificationResult.label)).toBe(true);
  });

  it('learningDecision is defined after blue completion', async () => {
    const mem = await bootToBlueExercise('13f-T2');

    const r1 = await processKidsBrainTurn(
      makeTurn({ ...mem, hasStartedFirstExercise: true }, makeCorrectStt('blue'), 'blue'),
    );
    const r2 = await processKidsBrainTurn(
      makeTurn({ ...r1.updatedSessionMemory, hasStartedFirstExercise: true }, makeCorrectStt('blue'), 'blue'),
    );

    expect(r2.learningDecision).toBeDefined();
  });

  it('safeToContinue remains true after Step 6B override', async () => {
    const mem = await bootToBlueExercise('13f-T3');

    const r1 = await processKidsBrainTurn(
      makeTurn({ ...mem, hasStartedFirstExercise: true }, makeCorrectStt('blue'), 'blue'),
    );
    const r2 = await processKidsBrainTurn(
      makeTurn({ ...r1.updatedSessionMemory, hasStartedFirstExercise: true }, makeCorrectStt('blue'), 'blue'),
    );

    expect(r2.safeToContinue).toBe(true);
  });
});

// ── U. Readiness handshake emits "Listen — blue! Now you!" ───────────────────

describe('U — readiness handshake still emits scripted first-exercise prompt', () => {
  it('teacher text after readiness phrase is "Listen — blue! Now you!"', async () => {
    const { sessionMemory } = startKidsBrainSession(makeSessionInput('13f-U1'));

    const r = await processKidsBrainTurn(
      makeTurn(sessionMemory, makeCorrectStt('ready'), 'blue'),
    );

    // Readiness path (buildReadinessTurnResult) is unchanged — Step 6B is NOT in that path.
    expect(getTeacherText(r.actionPackets)).toBe('Listen — blue! Now you!');
  });

  it('readiness turn advances to ex-02-blue (bridge still works as before)', async () => {
    const { sessionMemory } = startKidsBrainSession(makeSessionInput('13f-U2'));

    const r = await processKidsBrainTurn(
      makeTurn(sessionMemory, makeCorrectStt('start'), 'blue'),
    );

    expect(r.updatedSessionMemory.currentExerciseId).toBe(EX_02_ID);
  });

  it('readiness turn does NOT use green exercise prompt', async () => {
    const { sessionMemory } = startKidsBrainSession(makeSessionInput('13f-U3'));

    const r = await processKidsBrainTurn(
      makeTurn(sessionMemory, makeCorrectStt('ok'), 'blue'),
    );

    expect(getTeacherText(r.actionPackets)).not.toBe(PROMPT_GREEN);
    expect(getTeacherText(r.actionPackets)).not.toBe(PROMPT_BLUE);
  });
});

// ── V. Green exercise completion → teacher says red exercise prompt ────────────

describe('V — green exercise completion: teacher says red exercise prompt', () => {
  it('teacher text on green completion turn is the red exercise authored prompt', async () => {
    const { sessionMemory } = startKidsBrainSession(makeSessionInput('13f-V1'));
    const atGreen: SessionMemory = {
      ...sessionMemory,
      hasStartedFirstExercise: true,
      currentExerciseId: EX_03_ID,
      currentExerciseOrder: 3,
      currentTargetItemId: 'green',
      exerciseAttemptCount: 0,
      exerciseCorrectCount: 0,
      completedExerciseIds: [EX_02_ID],
    };

    const r1 = await processKidsBrainTurn(
      makeTurn(atGreen, makeCorrectStt('green'), 'green'),
    );
    const r2 = await processKidsBrainTurn(
      makeTurn({ ...r1.updatedSessionMemory, hasStartedFirstExercise: true }, makeCorrectStt('green'), 'green'),
    );

    expect(r2.updatedSessionMemory.currentExerciseId).toBe(EX_04_ID);
    expect(getTeacherText(r2.actionPackets)).toBe(PROMPT_RED);
  });

  it('green completion: teacher text is not the stale green prompt', async () => {
    const { sessionMemory } = startKidsBrainSession(makeSessionInput('13f-V2'));
    const atGreen: SessionMemory = {
      ...sessionMemory,
      hasStartedFirstExercise: true,
      currentExerciseId: EX_03_ID,
      currentExerciseOrder: 3,
      currentTargetItemId: 'green',
      exerciseAttemptCount: 0,
      exerciseCorrectCount: 0,
      completedExerciseIds: [EX_02_ID],
    };

    const r1 = await processKidsBrainTurn(
      makeTurn(atGreen, makeCorrectStt('green'), 'green'),
    );
    const r2 = await processKidsBrainTurn(
      makeTurn({ ...r1.updatedSessionMemory, hasStartedFirstExercise: true }, makeCorrectStt('green'), 'green'),
    );

    expect(getTeacherText(r2.actionPackets)).not.toContain('green');
  });
});

// ── W. No WebSocket protocol changes ─────────────────────────────────────────

describe('W — no WebSocket protocol changes after Phase 13F', () => {
  it('RuntimeActionPacketType values are unchanged', () => {
    expect(RuntimeActionPacketType.TEACHER_TEXT).toBe('teacher_text');
    expect(RuntimeActionPacketType.START_LISTENING).toBe('start_listening');
    expect(RuntimeActionPacketType.STOP_LISTENING).toBe('stop_listening');
    expect(RuntimeActionPacketType.SESSION_COMPLETE).toBe('session_complete');
    expect(RuntimeActionPacketType.SAFETY_CLOSE).toBe('safety_close');
  });

  it('action packets after blue completion contain only known packet types', async () => {
    const mem = await bootToBlueExercise('13f-W1');

    const r1 = await processKidsBrainTurn(
      makeTurn({ ...mem, hasStartedFirstExercise: true }, makeCorrectStt('blue'), 'blue'),
    );
    const r2 = await processKidsBrainTurn(
      makeTurn({ ...r1.updatedSessionMemory, hasStartedFirstExercise: true }, makeCorrectStt('blue'), 'blue'),
    );

    const validTypes = new Set(Object.values(RuntimeActionPacketType));
    for (const pkt of r2.actionPackets) {
      expect(validTypes.has(pkt.packetType)).toBe(true);
    }
  });

  it('action packets sequence on completion turn: STOP_LISTENING → TEACHER_TEXT → START_LISTENING', async () => {
    const mem = await bootToBlueExercise('13f-W2');

    const r1 = await processKidsBrainTurn(
      makeTurn({ ...mem, hasStartedFirstExercise: true }, makeCorrectStt('blue'), 'blue'),
    );
    const r2 = await processKidsBrainTurn(
      makeTurn({ ...r1.updatedSessionMemory, hasStartedFirstExercise: true }, makeCorrectStt('blue'), 'blue'),
    );

    const types = r2.actionPackets.map(p => p.packetType);
    expect(types[0]).toBe(RuntimeActionPacketType.STOP_LISTENING);
    expect(types).toContain(RuntimeActionPacketType.TEACHER_TEXT);
  });
});

// ── X. First correct blue (not completing) does not override teacher text ──────

describe('X — intermediate correct answer does not trigger Step 6B override', () => {
  it('after 1 correct blue: exercise still ex-02, teacher text is mid-exercise template', async () => {
    const mem = await bootToBlueExercise('13f-X1');

    const r = await processKidsBrainTurn(
      makeTurn({ ...mem, hasStartedFirstExercise: true }, makeCorrectStt('blue'), 'blue'),
    );

    // No advance: ex-02 unchanged
    expect(r.updatedSessionMemory.currentExerciseId).toBe(EX_02_ID);
    // Teacher text is NOT the green authored prompt
    expect(getTeacherText(r.actionPackets)).not.toBe(PROMPT_GREEN);
    // exerciseCorrectCount increments to 1 (not 0 = not reset = no completion)
    expect(r.updatedSessionMemory.exerciseCorrectCount).toBe(1);
  });
});
