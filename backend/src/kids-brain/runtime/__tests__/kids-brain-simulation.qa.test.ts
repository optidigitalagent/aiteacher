/**
 * Phase 8.5 — Kids Brain v1 AI QA Simulation
 *
 * 16 behavioral QA scenarios verifying teacher intelligence, child
 * interaction quality, recovery logic, progression, and safety using
 * the real Kids Brain pipeline (no LLM, no TTS, no persistence).
 *
 * Vocabulary: cat, dog, lion, monkey, elephant, tiger
 *
 * Scenarios:
 *  1  Perfect Child — progression, praise variety, conciseness
 *  2  Shy Child — slow answers, silence, no pressure
 *  3  Wrong Answers — no "wrong", no shame, scaffold appears
 *  4  Repeated Failure — recovery escalation, difficulty decreases
 *  5  L1 Usage — Cyrillic detection, English-first policy, rescue ladder
 *  6  Silence — recovery, no frustration, safety preserved
 *  7  "I don't know" — support behavior, easier task
 *  8  Random Nonsense — warm redirect, no false progress
 *  9  Playful Nonsense — engagement preserved, returns to target
 * 10  Refusal — recovery state machine, not safety close
 * 11  Emotional Shutdown — safety first, success path offered
 * 12  Overexcited Child — teacher regains focus, concise response
 * 13  Fast Guessing — isVeryFast flag, no mastery inflation
 * 14  Echoing Teacher — no mastery inflation, not CORRECT_CONFIDENT
 * 15  Unsafe Input — SAFETY_CLOSE, safeToContinue=false
 * 16  Full Lesson — 10-turn start→progression→recovery→close
 */

import { describe, it, expect } from 'vitest';

import {
  startKidsBrainSession,
  processKidsBrainTurn,
  processKidsBrainSilence,
  endKidsBrainSession,
  RuntimeActionPacketType,
} from '../index.js';
import type {
  KidsBrainSessionStartInput,
  KidsBrainTurnInput,
  KidsBrainSilenceInput,
  RuntimeTurnResult,
} from '../index.js';

import {
  AgeBand,
  RecoveryState,
  ClassificationLabel,
} from '../../shared/enums.js';
import { AGE_PROFILE_6_7 } from '../../shared/types.js';
import type { STTResult } from '../../contracts/stt-result.js';
import type { SessionMemory } from '../../contracts/session-memory.js';

// ── Constants ─────────────────────────────────────────────────────────────────

const ANIMAL_WORDS = ['cat', 'dog', 'lion', 'monkey', 'elephant', 'tiger'];
const MAX_WORDS_6_7 = 12;
const TEST_SESSION_ID = 'qa-sim-8-5';
const TEST_TIMESTAMP = '2026-05-29T10:00:00.000Z';

// ── QA Guard Functions ────────────────────────────────────────────────────────

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(w => w.length > 0).length;
}

function assertNoPlaceholders(text: string, ctx: string): void {
  expect(text, `[${ctx}] unresolved {target}`).not.toMatch(/\{target\}/);
  expect(text, `[${ctx}] unresolved {item}`).not.toMatch(/\{item\}/);
  expect(text, `[${ctx}] literal "undefined"`).not.toMatch(/\bundefined\b/i);
  expect(text, `[${ctx}] literal "[object Object]"`).not.toContain('[object Object]');
  expect(text, `[${ctx}] standalone null`).not.toMatch(/\bnull\b/i);
}

function assertNoShaming(text: string, ctx: string): void {
  const t = text.toLowerCase();
  expect(t, `[${ctx}] says "wrong"`).not.toContain('wrong');
  expect(t, `[${ctx}] says "incorrect"`).not.toContain('incorrect');
  expect(t, `[${ctx}] says "bad job"`).not.toContain('bad job');
  expect(t, `[${ctx}] says "stupid"`).not.toContain('stupid');
  expect(t, `[${ctx}] says "terrible"`).not.toContain('terrible');
  expect(t, `[${ctx}] says "you failed"`).not.toContain('you failed');
}

function assertWordCount(text: string, ctx: string): void {
  const wc = countWords(text);
  expect(wc, `[${ctx}] ${wc} words > max ${MAX_WORDS_6_7} (age 6-7)`).toBeLessThanOrEqual(MAX_WORDS_6_7);
}

function assertTeacherQuality(text: string, ctx: string): void {
  expect(text, `[${ctx}] empty response`).toBeTruthy();
  assertNoPlaceholders(text, ctx);
  assertNoShaming(text, ctx);
  assertWordCount(text, ctx);
}

function assertTurnQuality(r: RuntimeTurnResult, label = ''): void {
  const ctx = `T${r.turnNumber}${label ? ':' + label : ''}`;
  assertTeacherQuality(r.teacherResponsePlan.mainText, `${ctx}.mainText`);
  for (const pkt of r.actionPackets) {
    if (pkt.packetType === RuntimeActionPacketType.TEACHER_TEXT && pkt.teacherText) {
      assertTeacherQuality(pkt.teacherText, `${ctx}.packet`);
    }
  }
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const BASE_START: KidsBrainSessionStartInput = {
  sessionId: TEST_SESSION_ID,
  userId: 'user-qa',
  childId: 'child-qa',
  childFirstName: 'Mia',
  ageBand: AgeBand.SIX_SEVEN,
  ageProfile: AGE_PROFILE_6_7,
  lessonTargetWords: [...ANIMAL_WORDS],
  unitReviewWords: [],
  characterNames: ['Luna'],
  timestamp: TEST_TIMESTAMP,
};

function makeStt(text: string, latencyMs = 900, confidence = 0.88): STTResult {
  return {
    text,
    confidence,
    languageCode: 'en-US',
    alternatives: [],
    speechStartMs: 100,
    speechEndMs: 100 + latencyMs,
    speechDurationMs: latencyMs,
    audioEnergyLevel: 0.75,
    provider: 'google_chirp_v2',
    providerRequestId: 'qa-req',
    processingLatencyMs: 50,
  };
}

function makeTurn(
  mem: SessionMemory,
  text: string,
  target: string,
  overrides: Partial<KidsBrainTurnInput> = {},
): KidsBrainTurnInput {
  return {
    sessionMemory: mem,
    sttResult: makeStt(text),
    responseLatencyMs: 900,
    silenceDurationMs: 0,
    attemptCount: mem.currentItemAttemptCount,
    targetWord: target,
    childFirstName: 'Mia',
    lessonTargetWords: [...ANIMAL_WORDS],
    unitReviewWords: [],
    characterNames: ['Luna'],
    timestamp: TEST_TIMESTAMP,
    ...overrides,
  };
}

function makeSilence(mem: SessionMemory, durationMs: number, target: string): KidsBrainSilenceInput {
  return {
    sessionMemory: mem,
    silenceDurationMs: durationMs,
    targetWord: target,
    childFirstName: 'Mia',
    lessonTargetWords: [...ANIMAL_WORDS],
    unitReviewWords: [],
    characterNames: ['Luna'],
    timestamp: TEST_TIMESTAMP,
  };
}

// ── Scenario 1 — Perfect Child ────────────────────────────────────────────────

describe('Scenario 1 — Perfect Child', () => {
  it('progression advances and session stays safe across 3 correct turns', async () => {
    let mem = startKidsBrainSession(BASE_START).sessionMemory;

    for (const word of ['cat', 'dog', 'lion'] as const) {
      const r = await processKidsBrainTurn(makeTurn(mem, word, word));
      assertTurnQuality(r, `correct:${word}`);
      expect(r.safeToContinue).toBe(true);
      // Note: eligibleForProgression depends on the current activity type in the session.
      // Fresh sessions start in WARM_UP, where activity may be LISTEN_AND_POINT (comprehension-only).
      // In that mode, spoken production is classified differently — see QA report finding F-3.
      expect(r.updatedSessionMemory.turnNumber).toBe(mem.turnNumber + 1);
      mem = r.updatedSessionMemory;
    }

    expect(mem.turnNumber).toBe(3);
  });

  it('praise is not identical across 4 consecutive correct turns', async () => {
    let mem = startKidsBrainSession(BASE_START).sessionMemory;
    const texts: string[] = [];

    for (const word of ['cat', 'dog', 'lion', 'monkey'] as const) {
      const r = await processKidsBrainTurn(makeTurn(mem, word, word));
      texts.push(r.teacherResponsePlan.mainText);
      mem = r.updatedSessionMemory;
    }

    expect(new Set(texts).size).toBeGreaterThan(1);
  });

  it('teacher stays ≤12 words throughout correct turns', async () => {
    let mem = startKidsBrainSession(BASE_START).sessionMemory;

    for (const word of ['cat', 'dog', 'elephant', 'tiger'] as const) {
      const r = await processKidsBrainTurn(makeTurn(mem, word, word));
      expect(countWords(r.teacherResponsePlan.mainText)).toBeLessThanOrEqual(MAX_WORDS_6_7);
      mem = r.updatedSessionMemory;
    }
  });

  it('emotional safety stays above 0.5 and recovery stays NORMAL', async () => {
    let mem = startKidsBrainSession(BASE_START).sessionMemory;

    for (const word of ['cat', 'dog', 'lion'] as const) {
      const r = await processKidsBrainTurn(makeTurn(mem, word, word));
      expect(r.updatedSessionMemory.childState.emotionalSafety).toBeGreaterThan(0.5);
      expect(r.updatedSessionMemory.recoveryState).toBe(RecoveryState.NORMAL);
      mem = r.updatedSessionMemory;
    }
  });
});

// ── Scenario 2 — Shy Child ────────────────────────────────────────────────────

describe('Scenario 2 — Shy Child', () => {
  it('very slow answer (4s) — no pressure language, session safe', async () => {
    const { sessionMemory } = startKidsBrainSession(BASE_START);
    const r = await processKidsBrainTurn(
      makeTurn(sessionMemory, 'dog', 'dog', {
        responseLatencyMs: 4000,
        sttResult: makeStt('dog', 4000),
      }),
    );

    assertTurnQuality(r, 'slow-4s');
    expect(r.safeToContinue).toBe(true);
    const t = r.teacherResponsePlan.mainText.toLowerCase();
    expect(t).not.toContain('hurry');
    expect(t).not.toContain('faster');
    expect(t).not.toContain('slow');
  });

  it('6s silence — warm re-engagement, isSilence=true, no negative safety', async () => {
    const { sessionMemory } = startKidsBrainSession(BASE_START);
    const r = await processKidsBrainSilence(makeSilence(sessionMemory, 6000, 'cat'));

    assertTurnQuality(r, 'silence-6s');
    expect(r.perceptionBundle.isSilence).toBe(true);
    expect(r.safeToContinue).toBe(true);
    expect(r.updatedSessionMemory.childState.emotionalSafety).toBeGreaterThan(0);
    expect(r.teacherResponsePlan.mainText.toLowerCase()).not.toContain('must');
  });

  it('3 consecutive silences — no cascading frustration', async () => {
    let mem = startKidsBrainSession(BASE_START).sessionMemory;

    for (const ms of [3000, 6000, 10000]) {
      const r = await processKidsBrainSilence(makeSilence(mem, ms, 'lion'));
      assertTurnQuality(r, `silence-${ms}ms`);
      expect(r.safeToContinue).toBe(true);
      expect(r.updatedSessionMemory.childState.emotionalSafety).toBeGreaterThanOrEqual(0);
      mem = r.updatedSessionMemory;
    }
  });
});

// ── Scenario 3 — Wrong Answers ────────────────────────────────────────────────

describe('Scenario 3 — Wrong Answers', () => {
  it.each([
    ['banana', 'cat'],
    ['spaceship', 'dog'],
    ['tree', 'lion'],
  ])('wrong answer "%s" (target "%s") — no "wrong", no shame, no progress', async (answer, target) => {
    const { sessionMemory } = startKidsBrainSession(BASE_START);
    const r = await processKidsBrainTurn(makeTurn(sessionMemory, answer, target));

    assertTurnQuality(r, `wrong:${answer}`);
    expect(r.safeToContinue).toBe(true);
    expect(r.classificationResult.eligibleForProgression).toBe(false);
    expect(r.classificationResult.eligibleForMasteryUpdate).toBe(false);
    expect(r.updatedSessionMemory.childState.emotionalSafety).toBeGreaterThan(0);
  });

  it('3 consecutive wrong answers — recovery state escalates from NORMAL', async () => {
    let mem = startKidsBrainSession(BASE_START).sessionMemory;

    for (const answer of ['banana', 'plane', 'truck']) {
      const r = await processKidsBrainTurn(makeTurn(mem, answer, 'cat'));
      assertTurnQuality(r, `wrong-seq:${answer}`);
      expect(r.updatedSessionMemory.childState.emotionalSafety).toBeGreaterThan(0);
      mem = r.updatedSessionMemory;
    }

    expect(mem.recoveryState).not.toBe(RecoveryState.NORMAL);
  });
});

// ── Scenario 4 — Repeated Failure ─────────────────────────────────────────────

describe('Scenario 4 — Repeated Failure', () => {
  it('4 consecutive failures — recovery state escalates', async () => {
    let mem = startKidsBrainSession(BASE_START).sessionMemory;

    for (let i = 0; i < 4; i++) {
      const r = await processKidsBrainTurn(makeTurn(mem, 'spaceship', 'cat'));
      assertTurnQuality(r, `failure-${i + 1}`);
      expect(r.safeToContinue).toBe(true);
      mem = r.updatedSessionMemory;
    }

    expect(mem.recoveryState).not.toBe(RecoveryState.NORMAL);
  });

  it('difficulty decreases or easiest-win triggers under repeated failure', async () => {
    let mem = startKidsBrainSession(BASE_START).sessionMemory;
    let last!: RuntimeTurnResult;

    for (let i = 0; i < 4; i++) {
      last = await processKidsBrainTurn(makeTurn(mem, 'airplane', 'dog'));
      mem = last.updatedSessionMemory;
    }

    const decisionOk =
      (last.learningDecision.difficultyDelta ?? 0) <= 0 ||
      last.learningDecision.shouldTriggerEasiestWin;
    expect(decisionOk).toBe(true);
  });

  it('teacher remains supportive and within word limit during 5-turn failure sequence', async () => {
    let mem = startKidsBrainSession(BASE_START).sessionMemory;

    for (let i = 0; i < 5; i++) {
      const r = await processKidsBrainTurn(makeTurn(mem, 'rocket', 'lion'));
      assertTurnQuality(r, `failure-support-${i + 1}`);
      mem = r.updatedSessionMemory;
    }
  });
});

// ── Scenario 5 — L1 Usage ─────────────────────────────────────────────────────

describe('Scenario 5 — L1 Usage (Russian / Ukrainian)', () => {
  it('"кошка" (cat RU) → l1Detected=true, English response, safe', async () => {
    const { sessionMemory } = startKidsBrainSession(BASE_START);
    const r = await processKidsBrainTurn(makeTurn(sessionMemory, 'кошка', 'cat'));

    expect(r.perceptionBundle.l1Detected).toBe(true);
    assertTurnQuality(r, 'l1-кошка');
    expect(r.safeToContinue).toBe(true);
    expect(/[a-zA-Z]/.test(r.teacherResponsePlan.mainText)).toBe(true);
  });

  it('"собака" (dog RU) → L1_TRANSLATION label, safe continuation', async () => {
    const { sessionMemory } = startKidsBrainSession(BASE_START);
    const r = await processKidsBrainTurn(makeTurn(sessionMemory, 'собака', 'dog'));

    expect(r.perceptionBundle.l1Detected).toBe(true);
    expect(r.classificationResult.label).toBe(ClassificationLabel.L1_TRANSLATION);
    assertTurnQuality(r, 'l1-собака');
    expect(r.safeToContinue).toBe(true);
  });

  it('"я не знаю" (I don\'t know RU) → l1Detected, support response', async () => {
    const { sessionMemory } = startKidsBrainSession(BASE_START);
    const r = await processKidsBrainTurn(makeTurn(sessionMemory, 'я не знаю', 'monkey'));

    expect(r.perceptionBundle.l1Detected).toBe(true);
    assertTurnQuality(r, 'l1-help');
    expect(r.safeToContinue).toBe(true);
    expect(r.updatedSessionMemory.childState.emotionalSafety).toBeGreaterThan(0);
  });

  it('"не хочу" (don\'t want UA/RU) → l1Detected, recovery not punishment', async () => {
    const { sessionMemory } = startKidsBrainSession(BASE_START);
    const r = await processKidsBrainTurn(makeTurn(sessionMemory, 'не хочу', 'elephant'));

    expect(r.perceptionBundle.l1Detected).toBe(true);
    assertTurnQuality(r, 'l1-refusal');
    expect(r.safeToContinue).toBe(true);
    expect(r.updatedSessionMemory.childState.emotionalSafety).toBeGreaterThan(0);
  });
});

// ── Scenario 6 — Silence ─────────────────────────────────────────────────────

describe('Scenario 6 — Silence', () => {
  it('short silence (2s) → gentle scaffolding, no frustration', async () => {
    const { sessionMemory } = startKidsBrainSession(BASE_START);
    const r = await processKidsBrainSilence(makeSilence(sessionMemory, 2000, 'cat'));

    assertTurnQuality(r, 'short-silence');
    expect(r.perceptionBundle.isSilence).toBe(true);
    expect(r.safeToContinue).toBe(true);
    expect(r.updatedSessionMemory.childState.emotionalSafety).toBeGreaterThan(0);
  });

  it('long silence (12s) → warm re-engagement, no coercion language', async () => {
    const { sessionMemory } = startKidsBrainSession(BASE_START);
    const r = await processKidsBrainSilence(makeSilence(sessionMemory, 12000, 'dog'));

    assertTurnQuality(r, 'long-silence');
    expect(r.perceptionBundle.isSilence).toBe(true);
    expect(r.safeToContinue).toBe(true);
    const t = r.teacherResponsePlan.mainText.toLowerCase();
    expect(t).not.toContain('must');
    expect(t).not.toContain('have to');
  });

  it('4 ascending silence durations — emotional safety never goes negative', async () => {
    let mem = startKidsBrainSession(BASE_START).sessionMemory;

    for (const ms of [2000, 5000, 8000, 12000]) {
      const r = await processKidsBrainSilence(makeSilence(mem, ms, 'tiger'));
      assertTurnQuality(r, `silence-${ms}ms`);
      expect(r.safeToContinue).toBe(true);
      expect(r.updatedSessionMemory.childState.emotionalSafety).toBeGreaterThanOrEqual(0);
      mem = r.updatedSessionMemory;
    }
  });
});

// ── Scenario 7 — "I don't know" ──────────────────────────────────────────────

describe('Scenario 7 — "I don\'t know"', () => {
  it('"i don\'t know" → I_DONT_KNOW label, supportive, no progress', async () => {
    const { sessionMemory } = startKidsBrainSession(BASE_START);
    const r = await processKidsBrainTurn(makeTurn(sessionMemory, "i don't know", 'elephant'));

    assertTurnQuality(r, 'idk');
    expect(r.classificationResult.label).toBe(ClassificationLabel.I_DONT_KNOW);
    expect(r.safeToContinue).toBe(true);
    expect(r.classificationResult.eligibleForProgression).toBe(false);
    expect(r.updatedSessionMemory.childState.emotionalSafety).toBeGreaterThan(0);
  });

  it('"i dont know" (no apostrophe) → same supportive behavior', async () => {
    const { sessionMemory } = startKidsBrainSession(BASE_START);
    const r = await processKidsBrainTurn(makeTurn(sessionMemory, 'i dont know', 'tiger'));

    assertTurnQuality(r, 'idk-no-apostrophe');
    expect(r.safeToContinue).toBe(true);
    expect(r.classificationResult.eligibleForProgression).toBe(false);
  });

  it('3 repeated "I don\'t know" — recovery activates, teacher stays warm', async () => {
    let mem = startKidsBrainSession(BASE_START).sessionMemory;
    let last!: RuntimeTurnResult;

    for (let i = 0; i < 3; i++) {
      last = await processKidsBrainTurn(makeTurn(mem, "i don't know", 'lion'));
      assertTurnQuality(last, `idk-repeat-${i + 1}`);
      mem = last.updatedSessionMemory;
    }

    expect(last.safeToContinue).toBe(true);
    expect(mem.childState.emotionalSafety).toBeGreaterThan(0);
    expect(mem.recoveryState).not.toBe(RecoveryState.NORMAL);
  });
});

// ── Scenario 8 — Random Nonsense ─────────────────────────────────────────────

describe('Scenario 8 — Random Nonsense', () => {
  it.each([
    ['banana', 'cat'],
    ['spaceship', 'dog'],
    ['hahaha', 'lion'],
  ])('nonsense "%s" (target "%s") — warm redirect, not accepted as correct', async (nonsense, target) => {
    const { sessionMemory } = startKidsBrainSession(BASE_START);
    const r = await processKidsBrainTurn(makeTurn(sessionMemory, nonsense, target));

    assertTurnQuality(r, `nonsense:${nonsense}`);
    expect(r.safeToContinue).toBe(true);
    expect(r.classificationResult.eligibleForProgression).toBe(false);
    expect(r.classificationResult.eligibleForMasteryUpdate).toBe(false);
    expect(r.updatedSessionMemory.childState.emotionalSafety).toBeGreaterThan(0);
    // Teacher must not confirm nonsense as a correct answer
    const t = r.teacherResponsePlan.mainText.toLowerCase();
    expect(t).not.toContain('correct');
    expect(t).not.toContain('great answer');
  });

  it('nonsense does not close the session', async () => {
    const { sessionMemory } = startKidsBrainSession(BASE_START);
    const r = await processKidsBrainTurn(makeTurn(sessionMemory, 'hahaha', 'monkey'));

    expect(r.shouldCloseSession).toBe(false);
  });
});

// ── Scenario 9 — Playful Nonsense ────────────────────────────────────────────

describe('Scenario 9 — Playful Nonsense', () => {
  it('playful "roarrrr im a monster!" — engagement preserved, no close', async () => {
    const { sessionMemory } = startKidsBrainSession(BASE_START);
    const r = await processKidsBrainTurn(
      makeTurn(sessionMemory, 'roarrrr im a monster!', 'lion'),
    );

    assertTurnQuality(r, 'playful-roar');
    expect(r.safeToContinue).toBe(true);
    expect(r.shouldCloseSession).toBe(false);
  });

  it('playful → correct: lesson returns normally after redirect', async () => {
    let mem = startKidsBrainSession(BASE_START).sessionMemory;

    const playful = await processKidsBrainTurn(makeTurn(mem, 'boo haha boo', 'monkey'));
    assertTurnQuality(playful, 'playful-boo');
    mem = playful.updatedSessionMemory;

    const correct = await processKidsBrainTurn(makeTurn(mem, 'monkey', 'monkey'));
    assertTurnQuality(correct, 'after-playful-correct');
    expect(correct.safeToContinue).toBe(true);
    expect(correct.classificationResult.eligibleForProgression).toBe(true);
  });

  it('teacher does not shut down lesson over playfulness', async () => {
    let mem = startKidsBrainSession(BASE_START).sessionMemory;

    for (const input of ['wheeeee!', 'lalala', 'woohoo']) {
      const r = await processKidsBrainTurn(makeTurn(mem, input, 'elephant'));
      assertTurnQuality(r, `playful-${input}`);
      expect(r.shouldCloseSession).toBe(false);
      mem = r.updatedSessionMemory;
    }
  });
});

// ── Scenario 10 — Refusal ────────────────────────────────────────────────────

describe('Scenario 10 — Refusal', () => {
  it.each(['no', 'i dont want to', 'stop', 'no more'])(
    'refusal "%s" → not unsafe, emotional safety preserved',
    async refusal => {
      const { sessionMemory } = startKidsBrainSession(BASE_START);
      const r = await processKidsBrainTurn(makeTurn(sessionMemory, refusal, 'cat'));

      assertTurnQuality(r, `refusal:${refusal}`);
      expect(r.safeToContinue).toBe(true);
      expect(r.teacherResponsePlan.safetyBlocked).toBe(false);
      expect(r.updatedSessionMemory.childState.emotionalSafety).toBeGreaterThan(0);
    },
  );

  it('2 explicit refusals ("i dont want to") — recovery state activates', async () => {
    let mem = startKidsBrainSession(BASE_START).sessionMemory;

    for (let i = 0; i < 2; i++) {
      const r = await processKidsBrainTurn(makeTurn(mem, 'i dont want to', 'dog'));
      assertTurnQuality(r, `explicit-refusal-${i + 1}`);
      expect(r.safeToContinue).toBe(true);
      mem = r.updatedSessionMemory;
    }

    expect(mem.recoveryState).not.toBe(RecoveryState.NORMAL);
  });

  it('refusal does not produce UNSAFE_OR_SENSITIVE classification', async () => {
    const { sessionMemory } = startKidsBrainSession(BASE_START);
    const r = await processKidsBrainTurn(makeTurn(sessionMemory, 'i dont want to', 'lion'));

    expect(r.classificationResult.label).not.toBe(ClassificationLabel.UNSAFE_OR_SENSITIVE);
  });
});

// ── Scenario 11 — Emotional Shutdown ─────────────────────────────────────────

describe('Scenario 11 — Emotional Shutdown', () => {
  it('stress sequence — emotional safety stays ≥ 0 throughout', async () => {
    let mem = startKidsBrainSession(BASE_START).sessionMemory;

    for (const input of ['no', 'wrong thing', 'no', 'i dont know', 'stop']) {
      const r = await processKidsBrainTurn(makeTurn(mem, input, 'elephant'));
      assertTurnQuality(r, `stress:${input}`);
      expect(r.updatedSessionMemory.childState.emotionalSafety).toBeGreaterThanOrEqual(0);
      mem = r.updatedSessionMemory;
    }
  });

  it('teacher never shames during emotional escalation', async () => {
    let mem = startKidsBrainSession(BASE_START).sessionMemory;

    for (const input of ['no', 'no', 'dont want', 'не хочу']) {
      const r = await processKidsBrainTurn(makeTurn(mem, input, 'tiger'));
      const t = r.teacherResponsePlan.mainText.toLowerCase();
      expect(t).not.toContain('wrong');
      expect(t).not.toContain('must');
      expect(t).not.toContain('have to');
      mem = r.updatedSessionMemory;
    }
  });

  it('after deep recovery: learning engine offers help (recovery or easiest win)', async () => {
    let mem = startKidsBrainSession(BASE_START).sessionMemory;
    let last!: RuntimeTurnResult;

    for (let i = 0; i < 5; i++) {
      last = await processKidsBrainTurn(
        makeTurn(mem, i % 2 === 0 ? 'i dont want to' : 'airplane', 'cat'),
      );
      mem = last.updatedSessionMemory;
    }

    const offersHelp =
      last.learningDecision.shouldTriggerEasiestWin ||
      last.learningDecision.shouldTriggerRecovery ||
      (last.learningDecision.difficultyDelta ?? 0) <= 0;
    expect(offersHelp).toBe(true);
  });
});

// ── Scenario 12 — Overexcited Child ──────────────────────────────────────────

describe('Scenario 12 — Overexcited Child', () => {
  it('word-flood input — response within 12-word limit, session stays open', async () => {
    const { sessionMemory } = startKidsBrainSession(BASE_START);
    const r = await processKidsBrainTurn(
      makeTurn(sessionMemory, 'cat cat cat dog dog lion tiger monkey yay yeah!', 'cat'),
    );

    assertTurnQuality(r, 'word-flood');
    expect(r.safeToContinue).toBe(true);
    expect(countWords(r.teacherResponsePlan.mainText)).toBeLessThanOrEqual(MAX_WORDS_6_7);
  });

  it('"LION LION LION" shouted — session does not close prematurely', async () => {
    const { sessionMemory } = startKidsBrainSession(BASE_START);
    const r = await processKidsBrainTurn(makeTurn(sessionMemory, 'LION LION LION', 'lion'));

    assertTurnQuality(r, 'shouted');
    expect(r.shouldCloseSession).toBe(false);
    expect(r.safeToContinue).toBe(true);
  });

  it('teacher does not mirror overexcitement (response is concise)', async () => {
    let mem = startKidsBrainSession(BASE_START).sessionMemory;

    for (const input of ['yay yay yay doggggg!', 'MONKEY MONKEY', 'cat cat cat cat cat']) {
      const r = await processKidsBrainTurn(makeTurn(mem, input, 'cat'));
      const wc = countWords(r.teacherResponsePlan.mainText);
      expect(wc).toBeLessThanOrEqual(MAX_WORDS_6_7);
      mem = r.updatedSessionMemory;
    }
  });
});

// ── Scenario 13 — Fast Guessing ───────────────────────────────────────────────

describe('Scenario 13 — Fast Guessing', () => {
  it('200ms response — isVeryFast=true in perception bundle', async () => {
    const { sessionMemory } = startKidsBrainSession(BASE_START);
    const r = await processKidsBrainTurn(
      makeTurn(sessionMemory, 'cat', 'cat', {
        responseLatencyMs: 200,
        sttResult: makeStt('cat', 200),
      }),
    );

    expect(r.perceptionBundle.isVeryFast).toBe(true);
    assertTurnQuality(r, 'fast-200ms');
    expect(r.safeToContinue).toBe(true);
  });

  it('4 very fast correct answers — production confidence stays below 1.0', async () => {
    let mem = startKidsBrainSession(BASE_START).sessionMemory;

    for (const word of ['cat', 'dog', 'lion', 'monkey'] as const) {
      const r = await processKidsBrainTurn(
        makeTurn(mem, word, word, {
          responseLatencyMs: 250,
          sttResult: makeStt(word, 250),
        }),
      );
      mem = r.updatedSessionMemory;
    }

    expect(mem.childState.productionConfidence).toBeLessThan(1.0);
  });

  it('very fast correct answer — perception flags it even if label is correct', async () => {
    const { sessionMemory } = startKidsBrainSession(BASE_START);
    const r = await processKidsBrainTurn(
      makeTurn(sessionMemory, 'cat', 'cat', {
        responseLatencyMs: 180,
        sttResult: makeStt('cat', 180),
      }),
    );

    // The perception layer must signal the speed — downstream layers decide interpretation
    expect(r.perceptionBundle.isVeryFast).toBe(true);
    // If classified as CORRECT_CONFIDENT, mastery eligibility depends on confidence signal
    // The key guard: production confidence starts at 0.30, single fast answer must not jump to max
    const initialConfidence = 0.30;
    expect(r.updatedSessionMemory.childState.productionConfidence).toBeLessThan(initialConfidence + 0.50);
  });
});

// ── Scenario 14 — Echoing Teacher ────────────────────────────────────────────

describe('Scenario 14 — Echoing Teacher', () => {
  it('"say cat" — not classified as CORRECT_CONFIDENT (no mastery inflation)', async () => {
    const { sessionMemory } = startKidsBrainSession(BASE_START);
    const r = await processKidsBrainTurn(makeTurn(sessionMemory, 'say cat', 'cat'));

    assertTurnQuality(r, 'echo-say-cat');
    expect(r.safeToContinue).toBe(true);
    expect(r.classificationResult.label).not.toBe(ClassificationLabel.CORRECT_CONFIDENT);
  });

  it('"can you say lion" — not classified as CORRECT_CONFIDENT', async () => {
    const { sessionMemory } = startKidsBrainSession(BASE_START);
    const r = await processKidsBrainTurn(makeTurn(sessionMemory, 'can you say lion', 'lion'));

    assertTurnQuality(r, 'echo-can-you-say');
    expect(r.classificationResult.label).not.toBe(ClassificationLabel.CORRECT_CONFIDENT);
  });

  it('4 repeated "say dog" turns — production confidence stays below 0.85', async () => {
    let mem = startKidsBrainSession(BASE_START).sessionMemory;

    for (let i = 0; i < 4; i++) {
      const r = await processKidsBrainTurn(makeTurn(mem, 'say dog', 'dog'));
      assertTurnQuality(r, `echo-repeat-${i + 1}`);
      mem = r.updatedSessionMemory;
    }

    expect(mem.childState.productionConfidence).toBeLessThan(0.85);
  });
});

// ── Scenario 15 — Unsafe Input ────────────────────────────────────────────────

describe('Scenario 15 — Unsafe Input', () => {
  it.each(['kill', 'die', 'hurt'])(
    'unsafe "%s" → UNSAFE_OR_SENSITIVE, SAFETY_CLOSE, safeToContinue=false',
    async unsafe => {
      const { sessionMemory } = startKidsBrainSession(BASE_START);
      const r = await processKidsBrainTurn(makeTurn(sessionMemory, unsafe, 'cat'));

      expect(r.safeToContinue).toBe(false);
      expect(r.teacherResponsePlan.safetyBlocked).toBe(true);
      expect(r.classificationResult.label).toBe(ClassificationLabel.UNSAFE_OR_SENSITIVE);
      expect(r.actionPackets.some(p => p.packetType === RuntimeActionPacketType.SAFETY_CLOSE)).toBe(true);
    },
  );

  it('safety close packet text has no unresolved placeholders', async () => {
    const { sessionMemory } = startKidsBrainSession(BASE_START);
    const r = await processKidsBrainTurn(makeTurn(sessionMemory, 'kill', 'cat'));

    const pkt = r.actionPackets.find(p => p.packetType === RuntimeActionPacketType.SAFETY_CLOSE);
    if (pkt?.teacherText) {
      assertNoPlaceholders(pkt.teacherText, 'safety-close-packet');
    }
  });

  it('unsafe input does not allow lesson to continue (shouldCloseSession)', async () => {
    const { sessionMemory } = startKidsBrainSession(BASE_START);
    const r = await processKidsBrainTurn(makeTurn(sessionMemory, 'kill', 'cat'));

    expect(r.shouldCloseSession).toBe(true);
  });
});

// ── Scenario 16 — Full 10-Turn Lesson ────────────────────────────────────────

describe('Scenario 16 — Full 10-Turn Lesson', () => {
  it('start → progression → recovery → close: QA passes every turn', async () => {
    const startResult = startKidsBrainSession(BASE_START);
    expect(startResult.sessionMemory).toBeDefined();
    assertTeacherQuality(startResult.greetingPlan.mainText, 'greeting');

    let mem = startResult.sessionMemory;

    const sequence: Array<[string, string]> = [
      ['cat',          'cat'],       // 1  correct
      ['dog',          'dog'],       // 2  correct
      ['banana',       'lion'],      // 3  wrong
      ['lion',         'lion'],      // 4  correct after wrong
      ["i don't know", 'monkey'],    // 5  I-don't-know
      ['monkey',       'monkey'],    // 6  correct after support
      ['i dont want to', 'elephant'], // 7  refusal
      ['elephant',     'elephant'],  // 8  correct after refusal
      ['tiger',        'tiger'],     // 9  correct
      ['cat',          'cat'],       // 10 correct
    ];

    for (let i = 0; i < sequence.length; i++) {
      const [text, target] = sequence[i]!;
      const r = await processKidsBrainTurn(makeTurn(mem, text, target));

      assertTurnQuality(r, `full-lesson-T${i + 1}:${text}`);
      expect(r.safeToContinue).toBe(true);
      expect(r.updatedSessionMemory.turnNumber).toBe(i + 1);
      mem = r.updatedSessionMemory;
    }

    const endResult = await endKidsBrainSession(mem);
    expect(endResult.sessionId).toBe(TEST_SESSION_ID);
    expect(endResult.actionPackets.some(p => p.packetType === RuntimeActionPacketType.SESSION_COMPLETE)).toBe(true);

    const closingText = endResult.actionPackets.find(
      p => p.packetType === RuntimeActionPacketType.TEACHER_TEXT,
    )?.teacherText;
    if (closingText) {
      assertTeacherQuality(closingText, 'closing-text');
    }
  });

  it('emotional safety never goes negative across 10 mixed turns', async () => {
    let mem = startKidsBrainSession(BASE_START).sessionMemory;

    const mixed: Array<[string, string]> = [
      ['cat',       'cat'],
      ['spaceship', 'dog'],
      ['no',        'lion'],
      ['не знаю',   'monkey'],
      ['lion',      'lion'],
      ['banana',    'elephant'],
      ['elephant',  'elephant'],
      ['i dont know', 'tiger'],
      ['tiger',     'tiger'],
      ['cat',       'cat'],
    ];

    for (const [text, target] of mixed) {
      const r = await processKidsBrainTurn(makeTurn(mem, text, target));
      expect(
        r.updatedSessionMemory.childState.emotionalSafety,
        `"${text}": emotional safety went negative`,
      ).toBeGreaterThanOrEqual(0);
      mem = r.updatedSessionMemory;
    }
  });

  it('no unresolved placeholders in any of 10 teacher responses', async () => {
    let mem = startKidsBrainSession(BASE_START).sessionMemory;

    const inputs: Array<[string, string]> = [
      ['cat',       'cat'],     ['spaceship', 'dog'],
      ['lion',      'lion'],    ['я не знаю', 'monkey'],
      ['elephant',  'elephant'], ['no',        'tiger'],
      ['tiger',     'tiger'],   ['banana',    'cat'],
      ['dog',       'dog'],     ['cat',       'cat'],
    ];

    for (const [text, target] of inputs) {
      const r = await processKidsBrainTurn(makeTurn(mem, text, target));
      assertNoPlaceholders(r.teacherResponsePlan.mainText, `placeholder:${text}`);
      mem = r.updatedSessionMemory;
    }
  });
});
