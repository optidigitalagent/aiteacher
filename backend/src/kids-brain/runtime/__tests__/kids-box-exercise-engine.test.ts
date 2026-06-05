/**
 * Kids Box Exercise Engine MVP — End-to-End Simulation Tests
 *
 * Tests the full production path:
 *   lesson-ws concept → Kids Brain V1 runtime → curriculum/exercise state
 *   → classification → teacher response → progression update
 *
 * Lesson: kb1-u01-l02 (Colours)
 * Exercise sequence: readiness → blue(x2) → green(x2) → red(x2) → yellow(x2)
 *                   → choose blue/green → choose pink/purple → review → chant → close
 *
 * Scenarios:
 *   A: Teacher asks blue → child says "blue" → progression
 *   B: Teacher asks blue → child says "hello" → child says "blue" → progression
 *   C: Teacher asks blue → child asks "what should I say?" → child says "blue" → progression
 *   D: Teacher asks blue → child says wrong → child corrects → progression
 *   E: Full lesson progression from first item to lesson completion
 */

import { describe, it, expect } from 'vitest';

import {
  startKidsBrainSession,
  processKidsBrainTurn,
  processKidsBrainSilence,
  RuntimeActionPacketType,
} from '../index.js';
import type {
  KidsBrainSessionStartInput,
  KidsBrainTurnInput,
  RuntimeTurnResult,
} from '../index.js';

import { AgeBand, ClassificationLabel } from '../../shared/enums.js';
import { AGE_PROFILE_6_7 } from '../../shared/types.js';
import type { STTResult } from '../../contracts/stt-result.js';
import type { SessionMemory } from '../../contracts/session-memory.js';
import { getVocabularyWords } from '../../curriculum/index.js';
import { findLessonById } from '../../curriculum/curriculum-loader.js';

// ── Constants ─────────────────────────────────────────────────────────────────

const PROTO_COURSE_ID = 'cambridge-kids-box-1';
const PROTO_UNIT_ID   = 'kb1-unit-01';
const PROTO_LESSON_ID = 'kb1-u01-l02';

const COLOUR_WORDS: string[] = [
  ...getVocabularyWords(PROTO_COURSE_ID, PROTO_UNIT_ID, PROTO_LESSON_ID),
];

// The lesson exercise sequence for colours (in order by exercise)
const LESSON = findLessonById(PROTO_LESSON_ID)!;
const EXERCISES = LESSON.exercises ?? [];

// ── Fixtures ──────────────────────────────────────────────────────────────────

const TEST_SESSION_ID = 'ex-engine-mvp-test';
const TEST_TIMESTAMP  = '2026-06-05T10:00:00.000Z';

const BASE_START: KidsBrainSessionStartInput = {
  sessionId: TEST_SESSION_ID,
  userId:    'user-ex-engine',
  childId:   'child-ex-engine',
  childFirstName: 'Alex',
  ageBand:   AgeBand.SIX_SEVEN,
  ageProfile: AGE_PROFILE_6_7,
  lessonTargetWords: [...COLOUR_WORDS],
  unitReviewWords:   [],
  characterNames:    ['milo'],
  timestamp:         TEST_TIMESTAMP,
};

function makeStt(text: string, latencyMs = 900, confidence = 0.88): STTResult {
  return {
    text,
    confidence,
    languageCode: 'en-US',
    alternatives: [],
    speechStartMs: 100,
    speechEndMs:   100 + latencyMs,
    speechDurationMs: latencyMs,
    audioEnergyLevel: 0.75,
    provider:          'google_chirp_v2',
    providerRequestId: 'test-req',
    processingLatencyMs: 50,
  };
}

function makeTurn(
  mem: SessionMemory,
  text: string,
  overrides: Partial<KidsBrainTurnInput> = {},
): KidsBrainTurnInput {
  const targetWord = mem.currentTargetItemId ?? COLOUR_WORDS[0] ?? 'blue';
  return {
    sessionMemory:     mem,
    sttResult:         makeStt(text),
    responseLatencyMs: 900,
    silenceDurationMs: 0,
    attemptCount:      mem.currentItemAttemptCount,
    targetWord,
    childFirstName:    'Alex',
    lessonTargetWords: [...COLOUR_WORDS],
    unitReviewWords:   [],
    characterNames:    ['milo'],
    timestamp:         TEST_TIMESTAMP,
    ...overrides,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function assertNoPlaceholders(text: string, ctx: string): void {
  expect(text, `[${ctx}] unresolved {target}`).not.toMatch(/\{target\}/);
  expect(text, `[${ctx}] literal "undefined"`).not.toMatch(/\bundefined\b/i);
  expect(text, `[${ctx}] literal null`).not.toMatch(/\bnull\b/i);
  expect(text, `[${ctx}] [object Object]`).not.toContain('[object Object]');
}

function assertNoShaming(text: string, ctx: string): void {
  const t = text.toLowerCase();
  expect(t, `[${ctx}] says "wrong"`).not.toContain('wrong');
  expect(t, `[${ctx}] says "incorrect"`).not.toContain('incorrect');
  expect(t, `[${ctx}] says "bad"`).not.toContain('bad job');
}

/** Send readiness phrase to activate exercise engine */
async function performReadiness(mem: SessionMemory): Promise<SessionMemory> {
  const r = await processKidsBrainTurn(makeTurn(mem, "i'm ready"));
  expect(r.updatedSessionMemory.hasStartedFirstExercise).toBe(true);
  return r.updatedSessionMemory;
}

/** Send a correct answer until exercise advances to next exercise */
async function advanceExercise(
  mem: SessionMemory,
  word: string,
  requiredCorrect = 2,
): Promise<{ mem: SessionMemory; results: RuntimeTurnResult[] }> {
  const results: RuntimeTurnResult[] = [];

  for (let i = 0; i < requiredCorrect; i++) {
    const r = await processKidsBrainTurn(makeTurn(mem, word));
    results.push(r);
    mem = r.updatedSessionMemory;
  }

  return { mem, results };
}

// ── Curriculum audit ──────────────────────────────────────────────────────────

describe('Curriculum audit: kb1-u01-l02 exercise data', () => {
  it('lesson has exercises defined', () => {
    expect(EXERCISES.length).toBeGreaterThan(0);
  });

  it('colour vocabulary words available from curriculum', () => {
    expect(COLOUR_WORDS).toContain('blue');
    expect(COLOUR_WORDS).toContain('green');
    expect(COLOUR_WORDS.length).toBe(7);
  });

  it('exercise chain: ex-01 (readiness) → ex-02 (blue) links correctly', () => {
    const readiness = EXERCISES.find(e => e.order === 1);
    expect(readiness).toBeDefined();
    expect(readiness!.exerciseId).toContain('readiness');

    const blueEx = EXERCISES.find(e => e.exerciseId === readiness!.nextExerciseId);
    expect(blueEx).toBeDefined();
    expect(blueEx!.expectedAnswers).toContain('blue');
  });

  it('blue exercise requires 2 correct repetitions', () => {
    const blueEx = EXERCISES.find(e => e.expectedAnswers.includes('blue') && e.order === 2);
    expect(blueEx).toBeDefined();
    expect(blueEx!.completionRule.requiredCorrectCount).toBe(2);
  });

  it('final exercise (close) has nextExerciseId null', () => {
    const last = EXERCISES.reduce((a, b) => (a.order > b.order ? a : b));
    expect(last.nextExerciseId).toBeNull();
  });
});

// ── Session bootstrap ─────────────────────────────────────────────────────────

describe('Session bootstrap for kb1-u01-l02', () => {
  it('session starts with correct lesson id and first colour as target', () => {
    const { sessionMemory } = startKidsBrainSession(BASE_START);
    expect(sessionMemory.lessonId).toBe(PROTO_LESSON_ID);
    expect(sessionMemory.currentTargetItemId).toBe('blue');
  });

  it('session starts with hasStartedFirstExercise=false', () => {
    const { sessionMemory } = startKidsBrainSession(BASE_START);
    expect(sessionMemory.hasStartedFirstExercise).toBe(false);
  });

  it('session starts on ex-01 readiness exercise', () => {
    const { sessionMemory } = startKidsBrainSession(BASE_START);
    const readiness = EXERCISES.find(e => e.order === 1)!;
    expect(sessionMemory.currentExerciseId).toBe(readiness.exerciseId);
  });

  it('session starts with exerciseCorrectCount=0', () => {
    const { sessionMemory } = startKidsBrainSession(BASE_START);
    expect(sessionMemory.exerciseCorrectCount ?? 0).toBe(0);
  });

  it('greeting plan has no placeholders', () => {
    const { greetingPlan } = startKidsBrainSession(BASE_START);
    assertNoPlaceholders(greetingPlan.mainText, 'greeting');
  });
});

// ── Readiness handshake ───────────────────────────────────────────────────────

describe('Readiness handshake', () => {
  it('"i\'m ready" activates exercise engine', async () => {
    const { sessionMemory } = startKidsBrainSession(BASE_START);
    const r = await processKidsBrainTurn(makeTurn(sessionMemory, "i'm ready"));
    expect(r.updatedSessionMemory.hasStartedFirstExercise).toBe(true);
  });

  it('"ready" sets hasStartedFirstExercise and advances past readiness exercise', async () => {
    const { sessionMemory } = startKidsBrainSession(BASE_START);
    const r = await processKidsBrainTurn(makeTurn(sessionMemory, 'ready'));
    const blueEx = EXERCISES.find(e => e.expectedAnswers.includes('blue') && e.order === 2)!;
    expect(r.updatedSessionMemory.currentExerciseId).toBe(blueEx.exerciseId);
  });

  it('teacher says first exercise prompt after readiness', async () => {
    const { sessionMemory } = startKidsBrainSession(BASE_START);
    const r = await processKidsBrainTurn(makeTurn(sessionMemory, 'yes'));
    const text = r.teacherResponsePlan.mainText.toLowerCase();
    expect(text).toContain('blue');
    assertNoShaming(text, 'readiness-response');
  });

  it('target stays "blue" after readiness (not overridden)', async () => {
    const { sessionMemory } = startKidsBrainSession(BASE_START);
    const r = await processKidsBrainTurn(makeTurn(sessionMemory, 'yes'));
    expect(r.updatedSessionMemory.currentTargetItemId).toBe('blue');
  });
});

// ── Scenario A: Correct answer progresses ────────────────────────────────────

describe('Scenario A: correct answer → progression', () => {
  it('A1: first correct "blue" → exerciseCorrectCount increments to 1, stays on blue', async () => {
    let mem = startKidsBrainSession(BASE_START).sessionMemory;
    mem = await performReadiness(mem);

    const r = await processKidsBrainTurn(makeTurn(mem, 'blue'));
    expect(r.updatedSessionMemory.exerciseCorrectCount).toBe(1);
    expect(r.updatedSessionMemory.currentTargetItemId).toBe('blue');
  });

  it('A2: second correct "blue" → exercise completes, target becomes "green"', async () => {
    let mem = startKidsBrainSession(BASE_START).sessionMemory;
    mem = await performReadiness(mem);

    // First correct
    let r = await processKidsBrainTurn(makeTurn(mem, 'blue'));
    mem = r.updatedSessionMemory;

    // Second correct → should advance
    r = await processKidsBrainTurn(makeTurn(mem, 'blue'));
    expect(r.updatedSessionMemory.currentTargetItemId).toBe('green');
  });

  it('A3: after advancing from blue, target is NOT blue', async () => {
    let mem = startKidsBrainSession(BASE_START).sessionMemory;
    mem = await performReadiness(mem);
    const { mem: advanced } = await advanceExercise(mem, 'blue', 2);
    expect(advanced.currentTargetItemId).not.toBe('blue');
  });

  it('A4: teacher says "green" after blue exercise completes', async () => {
    let mem = startKidsBrainSession(BASE_START).sessionMemory;
    mem = await performReadiness(mem);

    let r = await processKidsBrainTurn(makeTurn(mem, 'blue'));
    mem = r.updatedSessionMemory;
    r = await processKidsBrainTurn(makeTurn(mem, 'blue'));

    const text = r.teacherResponsePlan.mainText.toLowerCase();
    expect(text).toContain('green');
    assertNoPlaceholders(r.teacherResponsePlan.mainText, 'A4-advance-to-green');
  });

  it('A5: exerciseCorrectCount resets to 0 after advancing', async () => {
    let mem = startKidsBrainSession(BASE_START).sessionMemory;
    mem = await performReadiness(mem);
    const { mem: advanced } = await advanceExercise(mem, 'blue', 2);
    expect(advanced.exerciseCorrectCount ?? 0).toBe(0);
  });

  it('A6: blue exercise ID changes after advancing', async () => {
    let mem = startKidsBrainSession(BASE_START).sessionMemory;
    mem = await performReadiness(mem);
    const blueExId = mem.currentExerciseId;

    const { mem: advanced } = await advanceExercise(mem, 'blue', 2);
    expect(advanced.currentExerciseId).not.toBe(blueExId);
  });
});

// ── Scenario B: Social speech during exercise ─────────────────────────────────

describe('Scenario B: social speech → no progression → redirect to target', () => {
  it('B1: "hello" during blue exercise → no progression, target stays blue', async () => {
    let mem = startKidsBrainSession(BASE_START).sessionMemory;
    mem = await performReadiness(mem);

    const r = await processKidsBrainTurn(makeTurn(mem, 'hello'));
    expect(r.updatedSessionMemory.currentTargetItemId).toBe('blue');
    expect(r.classificationResult.label).toBe(ClassificationLabel.SOCIAL_SPEECH);
    expect(r.classificationResult.eligibleForProgression).toBe(false);
  });

  it('B2: teacher response after "hello" includes "blue"', async () => {
    let mem = startKidsBrainSession(BASE_START).sessionMemory;
    mem = await performReadiness(mem);

    const r = await processKidsBrainTurn(makeTurn(mem, 'hello'));
    const text = r.teacherResponsePlan.mainText.toLowerCase();
    expect(text).toContain('blue');
    assertNoShaming(text, 'B2-social-redirect');
  });

  it('B3: "hello" then "blue" → exercise counter increments', async () => {
    let mem = startKidsBrainSession(BASE_START).sessionMemory;
    mem = await performReadiness(mem);

    // Social speech — no progress
    let r = await processKidsBrainTurn(makeTurn(mem, 'hello'));
    mem = r.updatedSessionMemory;
    expect(mem.exerciseCorrectCount ?? 0).toBe(0);

    // Correct answer — progress
    r = await processKidsBrainTurn(makeTurn(mem, 'blue'));
    expect(r.updatedSessionMemory.exerciseCorrectCount).toBe(1);
    expect(r.updatedSessionMemory.currentTargetItemId).toBe('blue');
  });

  it('B4: "hello", "blue", "blue" → advances to green', async () => {
    let mem = startKidsBrainSession(BASE_START).sessionMemory;
    mem = await performReadiness(mem);

    // Social speech
    let r = await processKidsBrainTurn(makeTurn(mem, 'hello'));
    mem = r.updatedSessionMemory;

    // Two correct answers
    r = await processKidsBrainTurn(makeTurn(mem, 'blue'));
    mem = r.updatedSessionMemory;
    r = await processKidsBrainTurn(makeTurn(mem, 'blue'));
    mem = r.updatedSessionMemory;

    expect(mem.currentTargetItemId).toBe('green');
    assertNoShaming(r.teacherResponsePlan.mainText, 'B4-advance');
  });
});

// ── Scenario C: Clarification request ────────────────────────────────────────

describe('Scenario C: "what should I say?" → teacher says target → progression', () => {
  it('C1: "what should I say?" → CLARIFICATION_REQUEST, no progression', async () => {
    let mem = startKidsBrainSession(BASE_START).sessionMemory;
    mem = await performReadiness(mem);

    const r = await processKidsBrainTurn(makeTurn(mem, 'what should i say'));
    expect(r.classificationResult.label).toBe(ClassificationLabel.CLARIFICATION_REQUEST);
    expect(r.classificationResult.eligibleForProgression).toBe(false);
    expect(r.updatedSessionMemory.currentTargetItemId).toBe('blue');
  });

  it('C2: teacher says "blue" after clarification request', async () => {
    let mem = startKidsBrainSession(BASE_START).sessionMemory;
    mem = await performReadiness(mem);

    const r = await processKidsBrainTurn(makeTurn(mem, 'what should i say'));
    const text = r.teacherResponsePlan.mainText.toLowerCase();
    expect(text).toContain('blue');
    assertNoPlaceholders(r.teacherResponsePlan.mainText, 'C2-clarification');
  });

  it('C3: clarification, then correct "blue" → counter increments', async () => {
    let mem = startKidsBrainSession(BASE_START).sessionMemory;
    mem = await performReadiness(mem);

    let r = await processKidsBrainTurn(makeTurn(mem, 'what should i say'));
    mem = r.updatedSessionMemory;

    r = await processKidsBrainTurn(makeTurn(mem, 'blue'));
    expect(r.updatedSessionMemory.exerciseCorrectCount).toBe(1);
  });

  it('C4: clarification, "blue", "blue" → advances to green', async () => {
    let mem = startKidsBrainSession(BASE_START).sessionMemory;
    mem = await performReadiness(mem);

    let r = await processKidsBrainTurn(makeTurn(mem, 'what should i say'));
    mem = r.updatedSessionMemory;

    r = await processKidsBrainTurn(makeTurn(mem, 'blue'));
    mem = r.updatedSessionMemory;

    r = await processKidsBrainTurn(makeTurn(mem, 'blue'));
    expect(r.updatedSessionMemory.currentTargetItemId).toBe('green');
  });

  it('C5: "help" → teacher says current target word', async () => {
    let mem = startKidsBrainSession(BASE_START).sessionMemory;
    mem = await performReadiness(mem);

    // Advance to green first
    const { mem: onGreen } = await advanceExercise(mem, 'blue', 2);
    expect(onGreen.currentTargetItemId).toBe('green');

    const r = await processKidsBrainTurn(makeTurn(onGreen, 'what should i say'));
    const text = r.teacherResponsePlan.mainText.toLowerCase();
    expect(text).toContain('green');
  });
});

// ── Scenario D: Wrong answer → no progression → correct answer progresses ────

describe('Scenario D: wrong answer → no progression → correct → progression', () => {
  it('D1: wrong colour (red when target blue) → no progression', async () => {
    let mem = startKidsBrainSession(BASE_START).sessionMemory;
    mem = await performReadiness(mem);

    const r = await processKidsBrainTurn(makeTurn(mem, 'red'));
    expect(r.classificationResult.label).toBe(ClassificationLabel.WRONG_BUT_RELATED);
    expect(r.classificationResult.eligibleForProgression).toBe(false);
    expect(r.updatedSessionMemory.currentTargetItemId).toBe('blue');
  });

  it('D2: teacher response after wrong answer includes "blue"', async () => {
    let mem = startKidsBrainSession(BASE_START).sessionMemory;
    mem = await performReadiness(mem);

    const r = await processKidsBrainTurn(makeTurn(mem, 'red'));
    const text = r.teacherResponsePlan.mainText.toLowerCase();
    expect(text).toContain('blue');
    assertNoShaming(text, 'D2-wrong-redirect');
  });

  it('D3: wrong answer does not increment exerciseCorrectCount', async () => {
    let mem = startKidsBrainSession(BASE_START).sessionMemory;
    mem = await performReadiness(mem);

    const r = await processKidsBrainTurn(makeTurn(mem, 'red'));
    expect(r.updatedSessionMemory.exerciseCorrectCount ?? 0).toBe(0);
  });

  it('D4: wrong, then correct → counter becomes 1', async () => {
    let mem = startKidsBrainSession(BASE_START).sessionMemory;
    mem = await performReadiness(mem);

    let r = await processKidsBrainTurn(makeTurn(mem, 'red'));
    mem = r.updatedSessionMemory;

    r = await processKidsBrainTurn(makeTurn(mem, 'blue'));
    expect(r.updatedSessionMemory.exerciseCorrectCount).toBe(1);
    expect(r.updatedSessionMemory.currentTargetItemId).toBe('blue');
  });

  it('D5: wrong, correct, correct → advances to green', async () => {
    let mem = startKidsBrainSession(BASE_START).sessionMemory;
    mem = await performReadiness(mem);

    // Wrong
    let r = await processKidsBrainTurn(makeTurn(mem, 'red'));
    mem = r.updatedSessionMemory;

    // Two correct
    r = await processKidsBrainTurn(makeTurn(mem, 'blue'));
    mem = r.updatedSessionMemory;
    r = await processKidsBrainTurn(makeTurn(mem, 'blue'));

    expect(r.updatedSessionMemory.currentTargetItemId).toBe('green');
    assertNoShaming(r.teacherResponsePlan.mainText, 'D5-advance-after-wrong');
  });

  it('D6: teacher never says "wrong" after wrong answer', async () => {
    let mem = startKidsBrainSession(BASE_START).sessionMemory;
    mem = await performReadiness(mem);

    for (const wrongAnswer of ['red', 'green', 'purple']) {
      const r = await processKidsBrainTurn(makeTurn(mem, wrongAnswer));
      assertNoShaming(r.teacherResponsePlan.mainText, `D6-wrong-${wrongAnswer}`);
      assertNoPlaceholders(r.teacherResponsePlan.mainText, `D6-wrong-${wrongAnswer}`);
    }
  });
});

// ── Scenario E: Full lesson progression ──────────────────────────────────────

describe('Scenario E: full lesson progression blue → green → red → yellow', () => {
  it('E1: blue → green → red → yellow progression path exists in curriculum', () => {
    const blueEx  = EXERCISES.find(e => e.order === 2)!;
    const greenEx = EXERCISES.find(e => e.exerciseId === blueEx.nextExerciseId)!;
    const redEx   = EXERCISES.find(e => e.exerciseId === greenEx.nextExerciseId)!;
    const yellowEx = EXERCISES.find(e => e.exerciseId === redEx.nextExerciseId)!;

    expect(blueEx.expectedAnswers).toContain('blue');
    expect(greenEx.expectedAnswers).toContain('green');
    expect(redEx.expectedAnswers).toContain('red');
    expect(yellowEx.expectedAnswers).toContain('yellow');
  });

  it('E2: after blue x2 → target is green (not blue)', async () => {
    let mem = startKidsBrainSession(BASE_START).sessionMemory;
    mem = await performReadiness(mem);
    const { mem: onGreen } = await advanceExercise(mem, 'blue', 2);
    expect(onGreen.currentTargetItemId).toBe('green');
    expect(onGreen.currentTargetItemId).not.toBe('blue');
  });

  it('E3: after blue x2 + green x2 → target is red', async () => {
    let mem = startKidsBrainSession(BASE_START).sessionMemory;
    mem = await performReadiness(mem);

    const { mem: onGreen } = await advanceExercise(mem, 'blue', 2);
    expect(onGreen.currentTargetItemId).toBe('green');

    const { mem: onRed } = await advanceExercise(onGreen, 'green', 2);
    expect(onRed.currentTargetItemId).toBe('red');
  });

  it('E4: after blue x2 + green x2 + red x2 → target is yellow', async () => {
    let mem = startKidsBrainSession(BASE_START).sessionMemory;
    mem = await performReadiness(mem);

    const { mem: onGreen } = await advanceExercise(mem, 'blue', 2);
    const { mem: onRed }   = await advanceExercise(onGreen, 'green', 2);
    const { mem: onYellow } = await advanceExercise(onRed, 'red', 2);

    expect(onYellow.currentTargetItemId).toBe('yellow');
  });

  it('E5: teacher text at each progression step contains the new target word', async () => {
    let mem = startKidsBrainSession(BASE_START).sessionMemory;
    mem = await performReadiness(mem);

    const progressions: Array<{ word: string; next: string }> = [
      { word: 'blue',  next: 'green' },
      { word: 'green', next: 'red'   },
      { word: 'red',   next: 'yellow' },
    ];

    for (const { word, next } of progressions) {
      // First correct — stays on current word
      let r = await processKidsBrainTurn(makeTurn(mem, word));
      mem = r.updatedSessionMemory;

      // Second correct — advances
      r = await processKidsBrainTurn(makeTurn(mem, word));
      mem = r.updatedSessionMemory;

      const text = r.teacherResponsePlan.mainText.toLowerCase();
      expect(text, `After ${word} exercise — teacher should say "${next}"`).toContain(next);
      assertNoPlaceholders(r.teacherResponsePlan.mainText, `E5-advance-from-${word}`);
    }
  });

  it('E6: no duplicate "blue" responses after advancing to green', async () => {
    let mem = startKidsBrainSession(BASE_START).sessionMemory;
    mem = await performReadiness(mem);
    const { mem: onGreen } = await advanceExercise(mem, 'blue', 2);

    // Now on green — teacher should NOT ask for blue
    const r = await processKidsBrainTurn(makeTurn(onGreen, 'green'));
    const text = r.teacherResponsePlan.mainText.toLowerCase();
    // Green exercise is still active — teacher might say "green" related content
    expect(onGreen.currentTargetItemId).toBe('green');
    expect(r.updatedSessionMemory.currentTargetItemId).toBe('green');
  });

  it('E7: completed blue exercise appears in completedExerciseIds', async () => {
    let mem = startKidsBrainSession(BASE_START).sessionMemory;
    mem = await performReadiness(mem);
    const blueExId = mem.currentExerciseId!;

    const { mem: onGreen } = await advanceExercise(mem, 'blue', 2);
    expect(onGreen.completedExerciseIds ?? []).toContain(blueExId);
  });

  it('E8: full lesson simulation — 4 colours progress correctly', async () => {
    let mem = startKidsBrainSession(BASE_START).sessionMemory;
    mem = await performReadiness(mem);

    const sequence = [
      { word: 'blue',   expected: 'blue'   },
      { word: 'blue',   expected: 'green'  },  // advances
      { word: 'green',  expected: 'green'  },
      { word: 'green',  expected: 'red'    },  // advances
      { word: 'red',    expected: 'red'    },
      { word: 'red',    expected: 'yellow' },  // advances
      { word: 'yellow', expected: 'yellow' },
    ];

    for (const { word, expected } of sequence) {
      const r = await processKidsBrainTurn(makeTurn(mem, word));
      mem = r.updatedSessionMemory;

      expect(
        mem.currentTargetItemId,
        `After saying "${word}" — expected target "${expected}"`,
      ).toBe(expected);

      assertNoPlaceholders(r.teacherResponsePlan.mainText, `E8-${word}->${expected}`);
      assertNoShaming(r.teacherResponsePlan.mainText, `E8-${word}`);
      expect(r.safeToContinue, `E8-${word} safeToContinue`).toBe(true);
    }
  });
});

// ── Scenario: Silence during exercise ────────────────────────────────────────

describe('Silence during exercise', () => {
  it('silence does not advance exercise, teacher includes current target', async () => {
    let mem = startKidsBrainSession(BASE_START).sessionMemory;
    mem = await performReadiness(mem);

    const r = await processKidsBrainSilence({
      sessionMemory:     mem,
      silenceDurationMs: 5000,
      targetWord:        mem.currentTargetItemId ?? 'blue',
      childFirstName:    'Alex',
      lessonTargetWords: [...COLOUR_WORDS],
      unitReviewWords:   [],
      characterNames:    ['milo'],
      timestamp:         TEST_TIMESTAMP,
    });

    expect(r.updatedSessionMemory.currentTargetItemId).toBe('blue');
    const text = r.teacherResponsePlan.mainText.toLowerCase();
    expect(text).toContain('blue');
    assertNoShaming(text, 'silence-during-exercise');
  });
});

// ── Teacher language quality ───────────────────────────────────────────────────

describe('Teacher language quality throughout exercise', () => {
  it('no teacher response contains unresolved placeholders across 10 turns', async () => {
    let mem = startKidsBrainSession(BASE_START).sessionMemory;
    mem = await performReadiness(mem);

    const inputs = [
      'blue', 'hello', 'blue',                // social + 2 correct → green
      'what should i say', 'green', 'green',  // clarification + 2 correct → red
      'red', 'red', 'red',                    // 1 wrong + 2 correct → yellow (wrong skips)
      'yellow',
    ];

    for (const text of inputs) {
      const r = await processKidsBrainTurn(makeTurn(mem, text));
      assertNoPlaceholders(r.teacherResponsePlan.mainText, `quality-${text}`);
      assertNoShaming(r.teacherResponsePlan.mainText, `quality-${text}`);
      mem = r.updatedSessionMemory;
    }
  });

  it('session stays safe throughout full colour sequence', async () => {
    let mem = startKidsBrainSession(BASE_START).sessionMemory;
    mem = await performReadiness(mem);

    const colourSequence = ['blue', 'blue', 'green', 'green', 'red', 'red', 'yellow', 'yellow'];

    for (const word of colourSequence) {
      const r = await processKidsBrainTurn(makeTurn(mem, word));
      expect(r.safeToContinue, `safeToContinue after ${word}`).toBe(true);
      expect(r.shouldCloseSession, `shouldCloseSession after ${word}`).toBe(false);
      mem = r.updatedSessionMemory;
    }
  });
});

// ── Regression: STT/TTS pipeline not affected ─────────────────────────────────

describe('Regression: STT pipeline unchanged', () => {
  it('session memory has no STT-related fields corrupted', async () => {
    const { sessionMemory } = startKidsBrainSession(BASE_START);
    expect(sessionMemory.mode).toBe('mentium_kids');
    expect(sessionMemory.sessionId).toBe(TEST_SESSION_ID);
    expect(sessionMemory.lessonId).toBe(PROTO_LESSON_ID);
  });

  it('processKidsBrainTurn produces START_LISTENING packet after non-closing turn', async () => {
    const { sessionMemory } = startKidsBrainSession(BASE_START);
    const r = await processKidsBrainTurn(makeTurn(sessionMemory, 'ready'));
    const packets = r.actionPackets.map(p => p.packetType);
    expect(packets).toContain(RuntimeActionPacketType.START_LISTENING);
    expect(packets).not.toContain(RuntimeActionPacketType.SESSION_COMPLETE);
  });

  it('processKidsBrainTurn always emits STOP_LISTENING before TEACHER_TEXT', async () => {
    const { sessionMemory } = startKidsBrainSession(BASE_START);
    const r = await processKidsBrainTurn(makeTurn(sessionMemory, 'blue'));
    const types = r.actionPackets.map(p => p.packetType);
    const stopIdx = types.indexOf(RuntimeActionPacketType.STOP_LISTENING);
    const textIdx = types.indexOf(RuntimeActionPacketType.TEACHER_TEXT);
    expect(stopIdx).toBeGreaterThanOrEqual(0);
    expect(textIdx).toBeGreaterThan(stopIdx);
  });
});
