/**
 * Phase 14J — Kids Brain v1 End-to-End QA Simulation
 *
 * courseId: cambridge-kids-box-1 | unitId: kb1-unit-01 | lessonId: kb1-u01-l02
 * Target words: blue, green, pink, purple, orange, red, yellow
 *
 * Exercise sequence (14 exercises after Phase 1 curriculum gap fix):
 *   ex-01-readiness (TEACHER_CONTROLLED, maxAttempts:1)
 *   → ex-02-blue    (CORRECT_REPETITIONS, required:2)
 *   → ex-03-green   (CORRECT_REPETITIONS, required:2) — includes 1 wrong answer
 *   → ex-04-red     (CORRECT_REPETITIONS, required:2)
 *   → ex-05-yellow  (CORRECT_REPETITIONS, required:2)
 *   → ex-06b-pink   (CORRECT_REPETITIONS, required:2)   ← Phase 1 new
 *   → ex-07b-purple (CORRECT_REPETITIONS, required:2)   ← Phase 1 new
 *   → ex-08b-orange (CORRECT_REPETITIONS, required:2)   ← Phase 1 new
 *   → ex-06-choose-pair-1 (CORRECT_CHOICE, required:1)
 *   → ex-07-choose-pair-2 (CORRECT_CHOICE, required:1)
 *   → ex-09b-choose-pair-3 (CORRECT_CHOICE, required:1) ← Phase 1 new
 *   → ex-08-say-review   (TEACHER_CONTROLLED, maxAttempts:2)
 *   → ex-09-chant        (TEACHER_CONTROLLED, maxAttempts:2)
 *   → ex-10-close        (TEACHER_CONTROLLED, maxAttempts:1)
 *   → null (lesson complete)
 *
 * Validates: session lifecycle, exercise progression, wrong-answer handling,
 *            analytics finalization, mastery records, safety invariants, cap limits.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  startKidsBrainSession,
  processKidsBrainTurn,
  endKidsBrainSession,
  RuntimeActionPacketType,
} from '../index.js';
import type {
  KidsBrainSessionStartInput,
  KidsBrainTurnInput,
} from '../runtime-types.js';
import {
  buildSessionSummary,
  buildMasteryRecordsFromSession,
  persistKidsBrainAnalytics,
} from '../../analytics/session-analytics.js';
import type { PostgresProfileStore } from '../../contracts/stores.js';
import {
  AgeBand,
  ActivityType,
  LessonPhase,
  RecoveryState,
} from '../../shared/enums.js';
import { AGE_PROFILE_6_7 } from '../../shared/types.js';
import type { STTResult } from '../../contracts/stt-result.js';
import type { SessionMemory } from '../../contracts/session-memory.js';
import type { ItemState } from '../../state/item-state.js';

// ── Constants ─────────────────────────────────────────────────────────────────

const KB1_L2_WORDS = ['blue', 'green', 'pink', 'purple', 'orange', 'red', 'yellow'];
const ANIMAL_WORDS  = ['cat', 'dog', 'lion', 'monkey', 'elephant', 'tiger'];

const SESSION_ID = 'qa-14j-e2e-001';
const TIMESTAMP  = '2026-06-01T10:00:00.000Z';

const EX_01   = 'kb1-u01-l02-ex-01-readiness';
const EX_02   = 'kb1-u01-l02-ex-02-blue';
const EX_03   = 'kb1-u01-l02-ex-03-green';
const EX_04   = 'kb1-u01-l02-ex-04-red';
const EX_05   = 'kb1-u01-l02-ex-05-yellow';
const EX_06B  = 'kb1-u01-l02-ex-06b-pink';
const EX_07B  = 'kb1-u01-l02-ex-07b-purple';
const EX_08B  = 'kb1-u01-l02-ex-08b-orange';
const EX_06   = 'kb1-u01-l02-ex-06-choose-pair-1';
const EX_07   = 'kb1-u01-l02-ex-07-choose-pair-2';
const EX_09B  = 'kb1-u01-l02-ex-09b-choose-pair-3';
const EX_08   = 'kb1-u01-l02-ex-08-say-review';
const EX_09   = 'kb1-u01-l02-ex-09-chant';
const EX_10   = 'kb1-u01-l02-ex-10-close';

// ── STT helpers ───────────────────────────────────────────────────────────────

function makeStt(text: string, confidence = 0.88): STTResult {
  return {
    text,
    confidence,
    languageCode: 'en-US',
    alternatives: [],
    speechStartMs: 100,
    speechEndMs: 900,
    speechDurationMs: 800,
    audioEnergyLevel: 0.8,
    provider: 'google_chirp_v2',
    providerRequestId: '14j-stt',
    processingLatencyMs: 50,
  };
}

const correctStt = (t: string): STTResult => makeStt(t, 1.0);
const wrongStt   = (t: string): STTResult => makeStt(t, 0.72);

// ── Factories ─────────────────────────────────────────────────────────────────

function makeSessionInput(): KidsBrainSessionStartInput {
  return {
    sessionId: SESSION_ID,
    userId: 'user-14j',
    childId: 'child-14j',
    childFirstName: 'Lily',
    ageBand: AgeBand.SIX_SEVEN,
    ageProfile: AGE_PROFILE_6_7,
    lessonTargetWords: [...KB1_L2_WORDS],
    unitReviewWords: [],
    characterNames: ['milo'],
    timestamp: TIMESTAMP,
  };
}

function makeTurn(
  mem: SessionMemory,
  stt: STTResult,
  target: string,
): KidsBrainTurnInput {
  return {
    sessionMemory: mem,
    sttResult: stt,
    responseLatencyMs: 800,
    silenceDurationMs: 0,
    attemptCount: mem.currentItemAttemptCount,
    targetWord: target,
    childFirstName: 'Lily',
    lessonTargetWords: [...KB1_L2_WORDS],
    unitReviewWords: [],
    characterNames: ['milo'],
    timestamp: new Date().toISOString(),
  };
}

// ── Mock store factory ────────────────────────────────────────────────────────

function makeMockStore() {
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

// ── ItemState helper ──────────────────────────────────────────────────────────

function makeItemState(id: string, attempts: number, correct: number, mastery: number): ItemState {
  return {
    itemId: id,
    itemMastery: mastery,
    attemptCount: attempts,
    correctAttempts: correct,
    modelGiven: false,
    l1AnchorUsed: false,
    comprehensionNotEstablishedThisSession: false,
    promptedCorrectAttempts: 0,
    unpromptedCorrectAttempts: correct,
    l1Responses: 0,
    silenceCount: 0,
    lastClassification: null,
    lastSeenAt: new Date().toISOString(),
  };
}

// ── QA guards ─────────────────────────────────────────────────────────────────

function assertNoPlaceholders(text: string, ctx: string): void {
  expect(text, `[${ctx}] unresolved {target}`).not.toMatch(/\{target\}/);
  expect(text, `[${ctx}] unresolved {item}`).not.toMatch(/\{item\}/);
  expect(text, `[${ctx}] literal undefined`).not.toMatch(/\bundefined\b/i);
  expect(text, `[${ctx}] [object Object]`).not.toContain('[object Object]');
  expect(text, `[${ctx}] standalone null`).not.toMatch(/\bnull\b/i);
}

function assertNoShaming(text: string, ctx: string): void {
  const t = text.toLowerCase();
  expect(t, `[${ctx}] says "wrong"`).not.toContain('wrong');
  expect(t, `[${ctx}] says "incorrect"`).not.toContain('incorrect');
  expect(t, `[${ctx}] says "bad job"`).not.toContain('bad job');
  expect(t, `[${ctx}] says "terrible"`).not.toContain('terrible');
}

function assertNoAnimalWords(text: string, ctx: string): void {
  const t = text.toLowerCase();
  for (const w of ANIMAL_WORDS) {
    expect(t, `[${ctx}] animal word "${w}" leaked into colours lesson`).not.toContain(w);
  }
}

function assertTeacherQuality(text: string, ctx: string): void {
  expect(text, `[${ctx}] empty response`).toBeTruthy();
  assertNoPlaceholders(text, ctx);
  assertNoShaming(text, ctx);
}

// ── Phase 14J — Session Bootstrap ─────────────────────────────────────────────

describe('Phase 14J — Session Bootstrap', () => {
  it('seeds lessonId kb1-u01-l02 and first exercise ex-01-readiness', () => {
    const { sessionMemory } = startKidsBrainSession(makeSessionInput());
    expect(sessionMemory.lessonId).toBe('kb1-u01-l02');
    expect(sessionMemory.currentExerciseId).toBe(EX_01);
    expect(sessionMemory.currentExerciseOrder).toBe(1);
    expect(sessionMemory.exerciseAttemptCount).toBe(0);
    expect(sessionMemory.exerciseCorrectCount).toBe(0);
    expect(sessionMemory.completedExerciseIds).toEqual([]);
    expect(sessionMemory.hasStartedFirstExercise).toBe(false);
  });

  it('seeds first target word from colour vocabulary, not animal vocabulary', () => {
    const { sessionMemory } = startKidsBrainSession(makeSessionInput());
    const target = sessionMemory.currentTargetItemId ?? '';
    expect(KB1_L2_WORDS).toContain(target);
    expect(ANIMAL_WORDS).not.toContain(target);
  });

  it('greeting text has no unresolved placeholders or animal words', () => {
    const { greetingPlan } = startKidsBrainSession(makeSessionInput());
    assertNoPlaceholders(greetingPlan.mainText, 'greeting');
    assertNoAnimalWords(greetingPlan.mainText, 'greeting');
  });

  it('greeting action packets include TEACHER_TEXT and START_LISTENING', () => {
    const { actionPackets } = startKidsBrainSession(makeSessionInput());
    const types = actionPackets.map(p => p.packetType);
    expect(types).toContain(RuntimeActionPacketType.TEACHER_TEXT);
    expect(types).toContain(RuntimeActionPacketType.START_LISTENING);
  });
});

// ── Phase 14J — Readiness Handshake ───────────────────────────────────────────

describe('Phase 14J — Readiness Handshake', () => {
  it('readiness phrase advances ex-01 → ex-02, sets hasStartedFirstExercise', async () => {
    const { sessionMemory } = startKidsBrainSession(makeSessionInput());
    const r = await processKidsBrainTurn(makeTurn(sessionMemory, correctStt("I'm ready"), 'blue'));

    expect(r.updatedSessionMemory.hasStartedFirstExercise).toBe(true);
    expect(r.updatedSessionMemory.currentExerciseId).toBe(EX_02);
    expect(r.updatedSessionMemory.completedExerciseIds).toContain(EX_01);
    expect(r.updatedSessionMemory.exerciseAttemptCount).toBe(0);
    expect(r.updatedSessionMemory.exerciseCorrectCount).toBe(0);
  });

  it('readiness response emits first-exercise prompt containing the target word (blue)', async () => {
    const { sessionMemory } = startKidsBrainSession(makeSessionInput());
    const r = await processKidsBrainTurn(makeTurn(sessionMemory, correctStt('ready'), 'blue'));

    assertTeacherQuality(r.teacherResponsePlan.mainText, 'readiness');
    expect(r.teacherResponsePlan.mainText.toLowerCase()).toContain('blue');
  });

  it('readiness: safeToContinue=true, shouldCloseSession=false', async () => {
    const { sessionMemory } = startKidsBrainSession(makeSessionInput());
    const r = await processKidsBrainTurn(makeTurn(sessionMemory, correctStt('ok'), 'blue'));

    expect(r.safeToContinue).toBe(true);
    expect(r.shouldCloseSession).toBe(false);
  });

  it('normalized readiness "start!" also advances ex-01 → ex-02', async () => {
    const { sessionMemory } = startKidsBrainSession(makeSessionInput());
    const r = await processKidsBrainTurn(makeTurn(sessionMemory, correctStt('start!'), 'blue'));

    expect(r.updatedSessionMemory.currentExerciseId).toBe(EX_02);
    expect(r.updatedSessionMemory.hasStartedFirstExercise).toBe(true);
  });
});

// ── Phase 14J — Full Lesson Simulation ────────────────────────────────────────

describe('Phase 14J — Full Lesson Simulation', () => {
  it('drives the complete Colours lesson: readiness → all 10 exercises → null', async () => {
    // ── 1. Bootstrap ──────────────────────────────────────────────────────
    const startResult = startKidsBrainSession(makeSessionInput());
    expect(startResult.sessionMemory.currentExerciseId).toBe(EX_01);
    let mem = startResult.sessionMemory;

    // ── 2. Readiness (ex-01 → ex-02) ──────────────────────────────────────
    const rReady = await processKidsBrainTurn(makeTurn(mem, correctStt("I'm ready"), 'blue'));
    assertTeacherQuality(rReady.teacherResponsePlan.mainText, 'readiness');
    expect(rReady.updatedSessionMemory.currentExerciseId).toBe(EX_02);
    expect(rReady.updatedSessionMemory.completedExerciseIds).toContain(EX_01);
    mem = rReady.updatedSessionMemory;

    // ── 3. ex-02-blue: 2 correct (CORRECT_REPETITIONS, required:2) ────────
    const rBlue1 = await processKidsBrainTurn(makeTurn(mem, correctStt('blue'), 'blue'));
    assertTeacherQuality(rBlue1.teacherResponsePlan.mainText, 'blue-1');
    expect(rBlue1.updatedSessionMemory.currentExerciseId).toBe(EX_02); // 1 correct, not done
    expect(rBlue1.updatedSessionMemory.exerciseCorrectCount).toBe(1);
    mem = rBlue1.updatedSessionMemory;

    const rBlue2 = await processKidsBrainTurn(makeTurn(mem, correctStt('blue'), 'blue'));
    assertTeacherQuality(rBlue2.teacherResponsePlan.mainText, 'blue-2');
    expect(rBlue2.updatedSessionMemory.currentExerciseId).toBe(EX_03);
    expect(rBlue2.updatedSessionMemory.completedExerciseIds).toContain(EX_02);
    expect(rBlue2.updatedSessionMemory.exerciseAttemptCount).toBe(0); // reset on advance
    expect(rBlue2.updatedSessionMemory.exerciseCorrectCount).toBe(0); // reset on advance
    mem = rBlue2.updatedSessionMemory;

    // ── 4. ex-03-green: 1 wrong + 2 correct ──────────────────────────────
    const rGreenWrong = await processKidsBrainTurn(makeTurn(mem, wrongStt('cat'), 'green'));
    assertTeacherQuality(rGreenWrong.teacherResponsePlan.mainText, 'green-wrong');
    assertNoAnimalWords(rGreenWrong.teacherResponsePlan.mainText, 'green-wrong');
    expect(rGreenWrong.updatedSessionMemory.currentExerciseId).toBe(EX_03); // no advance
    expect(rGreenWrong.updatedSessionMemory.exerciseCorrectCount).toBe(0);  // no change
    expect(rGreenWrong.updatedSessionMemory.exerciseAttemptCount).toBe(1);  // incremented
    expect(rGreenWrong.safeToContinue).toBe(true);
    mem = rGreenWrong.updatedSessionMemory;

    const rGreen1 = await processKidsBrainTurn(makeTurn(mem, correctStt('green'), 'green'));
    assertTeacherQuality(rGreen1.teacherResponsePlan.mainText, 'green-1');
    expect(rGreen1.updatedSessionMemory.currentExerciseId).toBe(EX_03); // needs 1 more correct
    expect(rGreen1.updatedSessionMemory.exerciseCorrectCount).toBe(1);
    mem = rGreen1.updatedSessionMemory;

    const rGreen2 = await processKidsBrainTurn(makeTurn(mem, correctStt('green'), 'green'));
    assertTeacherQuality(rGreen2.teacherResponsePlan.mainText, 'green-2');
    expect(rGreen2.updatedSessionMemory.currentExerciseId).toBe(EX_04);
    expect(rGreen2.updatedSessionMemory.completedExerciseIds).toContain(EX_03);
    mem = rGreen2.updatedSessionMemory;

    // ── 5. ex-04-red: 2 correct ───────────────────────────────────────────
    const rRed1 = await processKidsBrainTurn(makeTurn(mem, correctStt('red'), 'red'));
    assertTeacherQuality(rRed1.teacherResponsePlan.mainText, 'red-1');
    expect(rRed1.updatedSessionMemory.currentExerciseId).toBe(EX_04);
    mem = rRed1.updatedSessionMemory;

    const rRed2 = await processKidsBrainTurn(makeTurn(mem, correctStt('red'), 'red'));
    assertTeacherQuality(rRed2.teacherResponsePlan.mainText, 'red-2');
    expect(rRed2.updatedSessionMemory.currentExerciseId).toBe(EX_05);
    expect(rRed2.updatedSessionMemory.completedExerciseIds).toContain(EX_04);
    mem = rRed2.updatedSessionMemory;

    // ── 6. ex-05-yellow: 2 correct ────────────────────────────────────────
    const rYellow1 = await processKidsBrainTurn(makeTurn(mem, correctStt('yellow'), 'yellow'));
    assertTeacherQuality(rYellow1.teacherResponsePlan.mainText, 'yellow-1');
    expect(rYellow1.updatedSessionMemory.currentExerciseId).toBe(EX_05);
    mem = rYellow1.updatedSessionMemory;

    const rYellow2 = await processKidsBrainTurn(makeTurn(mem, correctStt('yellow'), 'yellow'));
    assertTeacherQuality(rYellow2.teacherResponsePlan.mainText, 'yellow-2');
    expect(rYellow2.updatedSessionMemory.currentExerciseId).toBe(EX_06B);
    expect(rYellow2.updatedSessionMemory.completedExerciseIds).toContain(EX_05);
    mem = rYellow2.updatedSessionMemory;

    // ── 6b. ex-06b-pink: 2 correct (CORRECT_REPETITIONS) ────────────────
    const rPink1 = await processKidsBrainTurn(makeTurn(mem, correctStt('pink'), 'pink'));
    assertTeacherQuality(rPink1.teacherResponsePlan.mainText, 'pink-1');
    expect(rPink1.updatedSessionMemory.currentExerciseId).toBe(EX_06B);
    mem = rPink1.updatedSessionMemory;

    const rPink2 = await processKidsBrainTurn(makeTurn(mem, correctStt('pink'), 'pink'));
    assertTeacherQuality(rPink2.teacherResponsePlan.mainText, 'pink-2');
    expect(rPink2.updatedSessionMemory.currentExerciseId).toBe(EX_07B);
    expect(rPink2.updatedSessionMemory.completedExerciseIds).toContain(EX_06B);
    mem = rPink2.updatedSessionMemory;

    // ── 7b. ex-07b-purple: 2 correct (CORRECT_REPETITIONS) ──────────────
    const rPurple1 = await processKidsBrainTurn(makeTurn(mem, correctStt('purple'), 'purple'));
    assertTeacherQuality(rPurple1.teacherResponsePlan.mainText, 'purple-1');
    expect(rPurple1.updatedSessionMemory.currentExerciseId).toBe(EX_07B);
    mem = rPurple1.updatedSessionMemory;

    const rPurple2 = await processKidsBrainTurn(makeTurn(mem, correctStt('purple'), 'purple'));
    assertTeacherQuality(rPurple2.teacherResponsePlan.mainText, 'purple-2');
    expect(rPurple2.updatedSessionMemory.currentExerciseId).toBe(EX_08B);
    expect(rPurple2.updatedSessionMemory.completedExerciseIds).toContain(EX_07B);
    mem = rPurple2.updatedSessionMemory;

    // ── 8b. ex-08b-orange: 2 correct (CORRECT_REPETITIONS) ──────────────
    const rOrange1 = await processKidsBrainTurn(makeTurn(mem, correctStt('orange'), 'orange'));
    assertTeacherQuality(rOrange1.teacherResponsePlan.mainText, 'orange-1');
    expect(rOrange1.updatedSessionMemory.currentExerciseId).toBe(EX_08B);
    mem = rOrange1.updatedSessionMemory;

    const rOrange2 = await processKidsBrainTurn(makeTurn(mem, correctStt('orange'), 'orange'));
    assertTeacherQuality(rOrange2.teacherResponsePlan.mainText, 'orange-2');
    expect(rOrange2.updatedSessionMemory.currentExerciseId).toBe(EX_06);
    expect(rOrange2.updatedSessionMemory.completedExerciseIds).toContain(EX_08B);
    mem = rOrange2.updatedSessionMemory;

    // ── 9. ex-06-choose-pair-1: 1 correct choice "blue" (CORRECT_CHOICE) ─
    const rChoose1 = await processKidsBrainTurn(makeTurn(mem, correctStt('blue'), 'blue'));
    assertTeacherQuality(rChoose1.teacherResponsePlan.mainText, 'choose-1');
    expect(rChoose1.updatedSessionMemory.currentExerciseId).toBe(EX_07);
    expect(rChoose1.updatedSessionMemory.completedExerciseIds).toContain(EX_06);
    mem = rChoose1.updatedSessionMemory;

    // ── 10. ex-07-choose-pair-2: 1 correct choice "pink" (CORRECT_CHOICE) ─
    const rChoose2 = await processKidsBrainTurn(makeTurn(mem, correctStt('pink'), 'pink'));
    assertTeacherQuality(rChoose2.teacherResponsePlan.mainText, 'choose-2');
    expect(rChoose2.updatedSessionMemory.currentExerciseId).toBe(EX_09B);
    expect(rChoose2.updatedSessionMemory.completedExerciseIds).toContain(EX_07);
    mem = rChoose2.updatedSessionMemory;

    // ── 11. ex-09b-choose-pair-3: 1 correct choice "red" (CORRECT_CHOICE) ─
    const rChoose3 = await processKidsBrainTurn(makeTurn(mem, correctStt('red'), 'red'));
    assertTeacherQuality(rChoose3.teacherResponsePlan.mainText, 'choose-3');
    expect(rChoose3.updatedSessionMemory.currentExerciseId).toBe(EX_08);
    expect(rChoose3.updatedSessionMemory.completedExerciseIds).toContain(EX_09B);
    mem = rChoose3.updatedSessionMemory;

    // ── 12. ex-08-say-review: 2 turns (TEACHER_CONTROLLED, maxAttempts:2) ─
    const rReview1 = await processKidsBrainTurn(makeTurn(mem, correctStt('blue green'), 'blue'));
    assertTeacherQuality(rReview1.teacherResponsePlan.mainText, 'review-1');
    expect(rReview1.updatedSessionMemory.currentExerciseId).toBe(EX_08); // 1 turn, not done
    expect(rReview1.updatedSessionMemory.exerciseAttemptCount).toBe(1);
    mem = rReview1.updatedSessionMemory;

    const rReview2 = await processKidsBrainTurn(makeTurn(mem, correctStt('red yellow'), 'blue'));
    assertTeacherQuality(rReview2.teacherResponsePlan.mainText, 'review-2');
    expect(rReview2.updatedSessionMemory.currentExerciseId).toBe(EX_09);
    expect(rReview2.updatedSessionMemory.completedExerciseIds).toContain(EX_08);
    mem = rReview2.updatedSessionMemory;

    // ── 10. ex-09-chant: 2 turns (TEACHER_CONTROLLED, maxAttempts:2) ──────
    const rChant1 = await processKidsBrainTurn(makeTurn(mem, correctStt('blue green pink'), 'blue'));
    assertTeacherQuality(rChant1.teacherResponsePlan.mainText, 'chant-1');
    expect(rChant1.updatedSessionMemory.currentExerciseId).toBe(EX_09); // 1 turn, not done
    expect(rChant1.updatedSessionMemory.exerciseAttemptCount).toBe(1);
    mem = rChant1.updatedSessionMemory;

    const rChant2 = await processKidsBrainTurn(makeTurn(mem, correctStt('red yellow purple'), 'blue'));
    assertTeacherQuality(rChant2.teacherResponsePlan.mainText, 'chant-2');
    expect(rChant2.updatedSessionMemory.currentExerciseId).toBe(EX_10);
    expect(rChant2.updatedSessionMemory.completedExerciseIds).toContain(EX_09);
    mem = rChant2.updatedSessionMemory;

    // ── 11. ex-10-close: 1 turn (TEACHER_CONTROLLED, maxAttempts:1) ───────
    const rClose = await processKidsBrainTurn(makeTurn(mem, correctStt('done'), 'blue'));
    assertTeacherQuality(rClose.teacherResponsePlan.mainText, 'close');
    expect(rClose.updatedSessionMemory.currentExerciseId).toBeNull();
    expect(rClose.updatedSessionMemory.completedExerciseIds).toContain(EX_10);
    expect(rClose.safeToContinue).toBe(true);
    mem = rClose.updatedSessionMemory;

    // ── 15. All 14 exercises in completedExerciseIds ──────────────────────
    const ALL_EX_IDS = [
      EX_01, EX_02, EX_03, EX_04, EX_05,
      EX_06B, EX_07B, EX_08B,
      EX_06, EX_07, EX_09B,
      EX_08, EX_09, EX_10,
    ];
    for (const exId of ALL_EX_IDS) {
      expect(mem.completedExerciseIds, `${exId} missing from completedExerciseIds`).toContain(exId);
    }
    expect(mem.completedExerciseIds).toHaveLength(14);

    // ── 16. Turn count and cap checks ─────────────────────────────────────
    // 24 turns: 1 readiness + 2 blue + 3 green + 2 red + 2 yellow
    //         + 2 pink + 2 purple + 2 orange + 1 choose1 + 1 choose2 + 1 choose3
    //         + 2 review + 2 chant + 1 close
    expect(mem.turnNumber).toBe(24);
    expect(mem.turnNumber).toBeLessThan(60);           // LLM call cap
    expect(mem.costCounters.ttsCharacters).toBeLessThan(8000); // TTS char cap

    // ── 14. Analytics summary ─────────────────────────────────────────────
    // endedAt is always after startedAt, regardless of test runner timezone
    const endedAt = new Date(new Date(mem.startedAt).getTime() + 12 * 60 * 1000).toISOString();
    const summary = buildSessionSummary(mem, 'completed', endedAt);
    expect(summary.sessionId).toBe(SESSION_ID);
    expect(summary.childId).toBe('child-14j');
    expect(summary.lessonId).toBe('kb1-u01-l02');
    expect(summary.stopReason).toBe('completed');
    expect(summary.durationSeconds).toBeGreaterThan(0);
    expect(summary.parentReviewFlagged).toBe(false);

    // ── 15. Mastery records ───────────────────────────────────────────────
    const records = buildMasteryRecordsFromSession(mem);
    // Session memory accumulates itemsAttempted as turns are processed
    for (const r of records) {
      expect(r.childId).toBe('child-14j');
      expect(r.masteryLevel).toBeDefined();
      expect(r.productionConfidence).toBeGreaterThanOrEqual(0);
      expect(r.productionConfidence).toBeLessThanOrEqual(100);
    }

    // ── 16. Persistence mock ──────────────────────────────────────────────
    const { store, summaries, masteryRows } = makeMockStore();
    await persistKidsBrainAnalytics(mem, 'completed', store);
    expect(summaries).toHaveLength(1);
    expect((summaries[0] as { stopReason: string }).stopReason).toBe('completed');
    expect(masteryRows.length).toBe(records.length);

    // ── 17. endKidsBrainSession returns SESSION_COMPLETE ──────────────────
    const endResult = await endKidsBrainSession(mem);
    expect(endResult.sessionId).toBe(SESSION_ID);
    expect(endResult.actionPackets.some(p => p.packetType === RuntimeActionPacketType.SESSION_COMPLETE)).toBe(true);
    const closingPacket = endResult.actionPackets.find(p => p.packetType === RuntimeActionPacketType.TEACHER_TEXT);
    if (closingPacket?.teacherText) {
      assertTeacherQuality(closingPacket.teacherText, 'session-end');
    }
  });
});

// ── Phase 14J — Wrong Answer Invariants ───────────────────────────────────────

describe('Phase 14J — Wrong Answer Invariants', () => {
  async function getEx02Mem(): Promise<SessionMemory> {
    const { sessionMemory } = startKidsBrainSession(makeSessionInput());
    const r = await processKidsBrainTurn(makeTurn(sessionMemory, correctStt('ready'), 'blue'));
    return r.updatedSessionMemory; // currentExerciseId = EX_02
  }

  it('wrong answer does not advance the exercise', async () => {
    const mem = await getEx02Mem();
    const r = await processKidsBrainTurn(makeTurn(mem, wrongStt('spaceship'), 'blue'));
    expect(r.updatedSessionMemory.currentExerciseId).toBe(EX_02);
  });

  it('wrong answer does not increment exerciseCorrectCount', async () => {
    const mem = await getEx02Mem();
    const r = await processKidsBrainTurn(makeTurn(mem, wrongStt('banana'), 'blue'));
    expect(r.updatedSessionMemory.exerciseCorrectCount).toBe(0);
  });

  it('wrong answer increments exerciseAttemptCount by 1', async () => {
    const mem = await getEx02Mem();
    const r = await processKidsBrainTurn(makeTurn(mem, wrongStt('spaceship'), 'blue'));
    expect(r.updatedSessionMemory.exerciseAttemptCount).toBe(1);
  });

  it('teacher response after wrong answer has no shame words', async () => {
    const mem = await getEx02Mem();
    const r = await processKidsBrainTurn(makeTurn(mem, wrongStt('banana'), 'blue'));
    assertNoShaming(r.teacherResponsePlan.mainText, 'wrong-answer');
  });

  it('"try again" phrase does not appear after a correct answer', async () => {
    const mem = await getEx02Mem();
    const r = await processKidsBrainTurn(makeTurn(mem, correctStt('blue'), 'blue'));
    expect(r.teacherResponsePlan.mainText.toLowerCase()).not.toContain('try again');
  });

  it('correct answers after a wrong still accumulate and complete the exercise', async () => {
    const mem = await getEx02Mem();
    // 1 wrong + 2 corrects → should complete ex-02
    const rWrong = await processKidsBrainTurn(makeTurn(mem, wrongStt('nope'), 'blue'));
    const rC1 = await processKidsBrainTurn(
      makeTurn(rWrong.updatedSessionMemory, correctStt('blue'), 'blue'),
    );
    const rC2 = await processKidsBrainTurn(
      makeTurn(rC1.updatedSessionMemory, correctStt('blue'), 'blue'),
    );

    expect(rC2.updatedSessionMemory.currentExerciseId).toBe(EX_03);
    expect(rC2.updatedSessionMemory.completedExerciseIds).toContain(EX_02);
  });

  it('session remains safe (safeToContinue=true) after wrong answer', async () => {
    const mem = await getEx02Mem();
    const r = await processKidsBrainTurn(makeTurn(mem, wrongStt('airplane'), 'blue'));
    expect(r.safeToContinue).toBe(true);
    expect(r.shouldCloseSession).toBe(false);
    expect(r.updatedSessionMemory.childState.emotionalSafety).toBeGreaterThan(0);
  });
});

// ── Phase 14J — Analytics: Session Summary ────────────────────────────────────

describe('Phase 14J — Analytics: Session Summary', () => {
  function makeCompletedMem(): SessionMemory {
    const { sessionMemory } = startKidsBrainSession(makeSessionInput());
    const itemState = new Map<string, ItemState>();
    itemState.set('blue',   makeItemState('blue',   3, 2, 0.70));
    itemState.set('green',  makeItemState('green',  3, 2, 0.70));
    itemState.set('red',    makeItemState('red',    2, 2, 0.70));
    itemState.set('yellow', makeItemState('yellow', 2, 2, 0.70));
    itemState.set('pink',   makeItemState('pink',   1, 1, 0.50));

    return {
      ...sessionMemory,
      childState: {
        ...sessionMemory.childState,
        emotionalSafety: 0.85,
      },
      itemState,
      itemsAttempted: ['blue', 'green', 'red', 'yellow', 'pink'],
      itemsMastered: ['blue', 'green', 'red', 'yellow'],
      costCounters: {
        tokensGenerated: 0,
        llmCallsClassification: 17,
        llmCallsTeacherResponse: 17,
        sttSeconds: 136,
        ttsCharacters: 850,
        turnCount: 17,
      },
      lessonId: 'kb1-u01-l02',
      currentExerciseId: null,
      currentExerciseOrder: null,
      exerciseAttemptCount: 0,
      exerciseCorrectCount: 0,
      completedExerciseIds: [EX_01, EX_02, EX_03, EX_04, EX_05, EX_06, EX_07, EX_08, EX_09, EX_10],
      startedAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString(),
      sessionElapsedMs: 12 * 60 * 1000,
      turnNumber: 17,
    };
  }

  it('summary carries correct sessionId, childId, lessonId', () => {
    const mem = makeCompletedMem();
    const summary = buildSessionSummary(mem, 'completed', new Date().toISOString());
    expect(summary.sessionId).toBe(SESSION_ID);
    expect(summary.childId).toBe('child-14j');
    expect(summary.lessonId).toBe('kb1-u01-l02');
  });

  it('stopReason is completed', () => {
    const mem = makeCompletedMem();
    const summary = buildSessionSummary(mem, 'completed', new Date().toISOString());
    expect(summary.stopReason).toBe('completed');
  });

  it('durationSeconds is positive (12-minute lesson)', () => {
    const mem = makeCompletedMem();
    const summary = buildSessionSummary(mem, 'completed', new Date().toISOString());
    expect(summary.durationSeconds).toBeGreaterThan(0);
    expect(summary.durationSeconds).toBeLessThan(1800);
  });

  it('itemsAttemptedCount matches 5 attempted colours', () => {
    const mem = makeCompletedMem();
    const summary = buildSessionSummary(mem, 'completed', new Date().toISOString());
    expect(summary.itemsAttemptedCount).toBe(5);
  });

  it('itemsMasteredIds lists all mastered colours', () => {
    const mem = makeCompletedMem();
    const summary = buildSessionSummary(mem, 'completed', new Date().toISOString());
    expect(summary.itemsMasteredIds).toEqual(
      expect.arrayContaining(['blue', 'green', 'red', 'yellow']),
    );
  });

  it('completionRate is mastered/attempted (4/5)', () => {
    const mem = makeCompletedMem();
    const summary = buildSessionSummary(mem, 'completed', new Date().toISOString());
    expect(summary.completionRate).toBeCloseTo(4 / 5, 5);
  });

  it('parentReviewFlagged is false when emotional safety is 0.85', () => {
    const mem = makeCompletedMem();
    const summary = buildSessionSummary(mem, 'completed', new Date().toISOString());
    expect(summary.parentReviewFlagged).toBe(false);
  });

  it('l1RescueUsed is false when no L1 anchors were used', () => {
    const mem = makeCompletedMem();
    const summary = buildSessionSummary(mem, 'completed', new Date().toISOString());
    expect(summary.l1RescueUsed).toBe(false);
  });

  it('speakingTurnsCount comes from costCounters.turnCount (17)', () => {
    const mem = makeCompletedMem();
    const summary = buildSessionSummary(mem, 'completed', new Date().toISOString());
    expect(summary.speakingTurnsCount).toBe(17);
  });
});

// ── Phase 14J — Analytics: Mastery Records ────────────────────────────────────

describe('Phase 14J — Analytics: Mastery Records', () => {
  function makeMemWithItems(words: string[]): SessionMemory {
    const { sessionMemory } = startKidsBrainSession(makeSessionInput());
    const itemState = new Map<string, ItemState>();
    for (const w of words) {
      itemState.set(w, makeItemState(w, 2, 2, 0.70));
    }
    return {
      ...sessionMemory,
      itemsAttempted: words,
      itemsMastered: words,
      itemState,
    };
  }

  it('returns one record per attempted colour word', () => {
    const mem = makeMemWithItems(['blue', 'green', 'red', 'yellow', 'pink']);
    const records = buildMasteryRecordsFromSession(mem);
    expect(records).toHaveLength(5);
    const ids = records.map(r => r.itemId);
    expect(ids).toEqual(expect.arrayContaining(['blue', 'green', 'red', 'yellow', 'pink']));
  });

  it('mastery records carry childId from session memory', () => {
    const mem = makeMemWithItems(['blue', 'green']);
    const records = buildMasteryRecordsFromSession(mem);
    for (const r of records) {
      expect(r.childId).toBe('child-14j');
    }
  });

  it('productionConfidence is in 0–100 scale for all records', () => {
    const mem = makeMemWithItems(['blue', 'green', 'red']);
    const records = buildMasteryRecordsFromSession(mem);
    for (const r of records) {
      expect(r.productionConfidence).toBeGreaterThanOrEqual(0);
      expect(r.productionConfidence).toBeLessThanOrEqual(100);
    }
  });

  it('returns empty array when no items were attempted', () => {
    const { sessionMemory } = startKidsBrainSession(makeSessionInput());
    expect(buildMasteryRecordsFromSession(sessionMemory)).toHaveLength(0);
  });

  it('correctProductionCount matches itemState.correctAttempts', () => {
    const mem = makeMemWithItems(['blue']);
    const records = buildMasteryRecordsFromSession(mem);
    expect(records[0]!.correctProductionCount).toBe(2); // makeItemState sets correct=2
  });

  it('no animal words appear as itemId in mastery records', () => {
    const mem = makeMemWithItems(['blue', 'green', 'red', 'yellow', 'pink']);
    const records = buildMasteryRecordsFromSession(mem);
    for (const r of records) {
      expect(ANIMAL_WORDS).not.toContain(r.itemId);
    }
  });
});

// ── Phase 14J — Analytics: Persistence ───────────────────────────────────────

describe('Phase 14J — Analytics: Persistence', () => {
  function makeAttemptedMem(): SessionMemory {
    const { sessionMemory } = startKidsBrainSession(makeSessionInput());
    const words = ['blue', 'green', 'red', 'yellow'];
    const itemState = new Map<string, ItemState>();
    for (const w of words) {
      itemState.set(w, makeItemState(w, 2, 2, 0.70));
    }
    return {
      ...sessionMemory,
      lessonId: 'kb1-u01-l02',
      itemsAttempted: words,
      itemsMastered: words,
      itemState,
    };
  }

  it('calls saveSessionSummary exactly once', async () => {
    const { store, summaries } = makeMockStore();
    await persistKidsBrainAnalytics(makeAttemptedMem(), 'completed', store);
    expect(summaries).toHaveLength(1);
  });

  it('persisted summary has stopReason=completed', async () => {
    const { store, summaries } = makeMockStore();
    await persistKidsBrainAnalytics(makeAttemptedMem(), 'completed', store);
    expect((summaries[0] as { stopReason: string }).stopReason).toBe('completed');
  });

  it('calls saveMasteryRecord once per attempted colour (4 words)', async () => {
    const { store, masteryRows } = makeMockStore();
    await persistKidsBrainAnalytics(makeAttemptedMem(), 'completed', store);
    expect(masteryRows).toHaveLength(4);
  });

  it('mastery records all have childId=child-14j', async () => {
    const { store, masteryRows } = makeMockStore();
    await persistKidsBrainAnalytics(makeAttemptedMem(), 'completed', store);
    for (const r of masteryRows) {
      expect((r as { childId: string }).childId).toBe('child-14j');
    }
  });

  it('persists non-fatally when saveSessionSummary throws', async () => {
    const badStore: PostgresProfileStore = {
      getChildProfile:    vi.fn(async () => null),
      saveChildProfile:   vi.fn(async () => undefined),
      getMasteryRecord:   vi.fn(async () => null),
      saveMasteryRecord:  vi.fn(async () => undefined),
      saveSessionSummary: vi.fn(async () => { throw new Error('DB down'); }),
    };
    await expect(
      persistKidsBrainAnalytics(makeAttemptedMem(), 'completed', badStore),
    ).resolves.toBeUndefined();
  });

  it('continues saving remaining records when first mastery record fails', async () => {
    let calls = 0;
    const partialStore: PostgresProfileStore = {
      getChildProfile:    vi.fn(async () => null),
      saveChildProfile:   vi.fn(async () => undefined),
      getMasteryRecord:   vi.fn(async () => null),
      saveSessionSummary: vi.fn(async () => undefined),
      saveMasteryRecord:  vi.fn(async () => {
        calls++;
        if (calls === 1) throw new Error('first record fails');
      }),
    };
    await expect(
      persistKidsBrainAnalytics(makeAttemptedMem(), 'completed', partialStore),
    ).resolves.toBeUndefined();
    expect(calls).toBe(4);
  });
});

// ── Phase 14J — Safety Invariants ─────────────────────────────────────────────

describe('Phase 14J — Safety Invariants', () => {
  it('no animal words in teacher responses across greeting, readiness, and first two exercises', async () => {
    const { sessionMemory, greetingPlan } = startKidsBrainSession(makeSessionInput());
    const texts: string[] = [greetingPlan.mainText];
    let mem = sessionMemory;

    const rReady = await processKidsBrainTurn(makeTurn(mem, correctStt('ready'), 'blue'));
    texts.push(rReady.teacherResponsePlan.mainText);
    mem = rReady.updatedSessionMemory;

    const rBlue1 = await processKidsBrainTurn(makeTurn(mem, correctStt('blue'), 'blue'));
    texts.push(rBlue1.teacherResponsePlan.mainText);
    mem = rBlue1.updatedSessionMemory;

    const rBlue2 = await processKidsBrainTurn(makeTurn(mem, correctStt('blue'), 'blue'));
    texts.push(rBlue2.teacherResponsePlan.mainText);

    for (const [i, text] of texts.entries()) {
      assertNoAnimalWords(text, `turn-${i}`);
    }
  });

  it('no unresolved placeholders across readiness and 4 mixed turns', async () => {
    const { sessionMemory } = startKidsBrainSession(makeSessionInput());
    let mem = sessionMemory;

    const rReady = await processKidsBrainTurn(makeTurn(mem, correctStt("I'm ready"), 'blue'));
    assertNoPlaceholders(rReady.teacherResponsePlan.mainText, 'readiness');
    mem = rReady.updatedSessionMemory;

    for (const [text, target] of [
      ['blue', 'blue'],
      ['blue', 'blue'],
      ['spaceship', 'green'],
      ['green', 'green'],
    ] as [string, string][]) {
      const r = await processKidsBrainTurn(makeTurn(mem, makeStt(text), target));
      assertNoPlaceholders(r.teacherResponsePlan.mainText, `${target}:${text}`);
      mem = r.updatedSessionMemory;
    }
  });

  it('LLM + TTS counters stay within caps after all 17 lesson turns', async () => {
    let mem = startKidsBrainSession(makeSessionInput()).sessionMemory;
    const sequence: [string, string][] = [
      ["I'm ready", 'blue'],
      ['blue', 'blue'], ['blue', 'blue'],
      ['cat', 'green'], ['green', 'green'], ['green', 'green'],
      ['red', 'red'], ['red', 'red'],
      ['yellow', 'yellow'], ['yellow', 'yellow'],
      ['blue', 'blue'],
      ['pink', 'pink'],
      ['blue green', 'blue'], ['red yellow', 'blue'],
      ['blue green pink', 'blue'], ['red yellow purple', 'blue'],
      ['done', 'blue'],
    ];

    for (const [text, target] of sequence) {
      const r = await processKidsBrainTurn(makeTurn(mem, makeStt(text), target));
      mem = r.updatedSessionMemory;
    }

    expect(mem.turnNumber).toBeLessThan(60);
    expect(mem.costCounters.ttsCharacters).toBeLessThan(8000);
    expect(mem.costCounters.llmCallsClassification).toBeLessThan(60);
    expect(mem.costCounters.llmCallsTeacherResponse).toBeLessThan(60);
  });

  it('emotional safety stays non-negative across all 17 lesson turns', async () => {
    let mem = startKidsBrainSession(makeSessionInput()).sessionMemory;
    const sequence: [string, string][] = [
      ["I'm ready", 'blue'],
      ['blue', 'blue'], ['blue', 'blue'],
      ['cat', 'green'], ['green', 'green'], ['green', 'green'],
      ['red', 'red'], ['red', 'red'],
      ['yellow', 'yellow'], ['yellow', 'yellow'],
      ['blue', 'blue'], ['pink', 'pink'],
      ['blue green', 'blue'], ['red yellow', 'blue'],
      ['blue green pink', 'blue'], ['red yellow purple', 'blue'],
      ['done', 'blue'],
    ];

    for (const [text, target] of sequence) {
      const r = await processKidsBrainTurn(makeTurn(mem, makeStt(text), target));
      expect(
        r.updatedSessionMemory.childState.emotionalSafety,
        `emotional safety dropped below 0 after "${text}"`,
      ).toBeGreaterThanOrEqual(0);
      mem = r.updatedSessionMemory;
    }
  });
});

// ── Phase 14J — Session End ───────────────────────────────────────────────────

describe('Phase 14J — Session End', () => {
  it('endKidsBrainSession returns SESSION_COMPLETE packet', async () => {
    const { sessionMemory } = startKidsBrainSession(makeSessionInput());
    const endResult = await endKidsBrainSession(sessionMemory);
    expect(endResult.sessionId).toBe(SESSION_ID);
    expect(
      endResult.actionPackets.some(p => p.packetType === RuntimeActionPacketType.SESSION_COMPLETE),
    ).toBe(true);
  });

  it('closing TEACHER_TEXT has no placeholders or animal words', async () => {
    const { sessionMemory } = startKidsBrainSession(makeSessionInput());
    const endResult = await endKidsBrainSession(sessionMemory);
    const closingPacket = endResult.actionPackets.find(
      p => p.packetType === RuntimeActionPacketType.TEACHER_TEXT,
    );
    if (closingPacket?.teacherText) {
      assertNoPlaceholders(closingPacket.teacherText, 'session-end-text');
      assertNoAnimalWords(closingPacket.teacherText, 'session-end-text');
    }
  });
});
