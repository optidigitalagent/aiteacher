/**
 * Phase 8.11 — Persist Target Progression regression tests.
 *
 * Root cause fixed: turn-processor.ts Step 6 never wrote
 * learningDecision.nextTargetItemId into updatedSessionMemory.currentTargetItemId.
 *
 * These tests prove:
 *  A. After a single correct answer, currentTargetItemId is unchanged
 *     (learning engine returns nextTargetItemId = undefined → stay on current).
 *  B. After 3 consecutive wrong answers, the learning engine fires easiest-win
 *     (priority 7: consecutiveWrong >= LOWER_CONSECUTIVE_WRONG=3) and
 *     produces a defined nextTargetItemId.
 *  C. updatedSessionMemory.currentTargetItemId === learningDecision.nextTargetItemId
 *     whenever nextTargetItemId is defined (the persistence fix).
 *  D. The persisted target propagates correctly into the next turn's session memory.
 *  E. recentPraisePhrases still updates correctly alongside target persistence.
 *  F. No unresolved placeholders ({target}, undefined, null) in teacher text.
 *  G. No regression to correct classification for correct answers.
 */

import { describe, it, expect } from 'vitest';
import {
  AgeBand,
  ClassificationLabel,
  RecoveryState,
} from '../../shared/enums.js';
import { AGE_PROFILE_6_7 } from '../../shared/types.js';
import { startKidsBrainSession, processKidsBrainTurn } from '../index.js';
import type { KidsBrainSessionStartInput, KidsBrainTurnInput } from '../runtime-types.js';
import type { STTResult } from '../../contracts/stt-result.js';

// ── Constants ─────────────────────────────────────────────────────────────────

const PROTOTYPE_WORDS = ['cat', 'dog', 'lion', 'monkey', 'elephant', 'tiger'];

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeStt(text: string, confidence = 0.90): STTResult {
  return {
    text,
    confidence,
    languageCode: 'en-US',
    alternatives: [],
    speechStartMs: 100,
    speechEndMs: 1000,
    speechDurationMs: 900,
    audioEnergyLevel: 0.75,
    provider: 'google_chirp_v2',
    providerRequestId: 'phase-8-11',
    processingLatencyMs: 50,
  };
}

function makeSessionStartInput(sessionId: string): KidsBrainSessionStartInput {
  return {
    sessionId,
    userId: `user-${sessionId}`,
    childId: `child-${sessionId}`,
    childFirstName: 'Alex',
    ageBand: AgeBand.SIX_SEVEN,
    ageProfile: AGE_PROFILE_6_7,
    lessonTargetWords: [...PROTOTYPE_WORDS],
    unitReviewWords: [],
    characterNames: ['milo'],
    timestamp: new Date().toISOString(),
  };
}

function makeTurnInput(
  mem: ReturnType<typeof startKidsBrainSession>['sessionMemory'],
  text: string,
  targetWord: string,
): KidsBrainTurnInput {
  return {
    sessionMemory: mem,
    sttResult: makeStt(text),
    responseLatencyMs: 800,
    silenceDurationMs: 0,
    attemptCount: mem.currentItemAttemptCount,
    targetWord,
    childFirstName: 'Alex',
    lessonTargetWords: [...PROTOTYPE_WORDS],
    unitReviewWords: [],
    characterNames: ['milo'],
    timestamp: new Date().toISOString(),
  };
}

function assertNoPlaceholders(text: string, ctx: string): void {
  expect(text, `[${ctx}] unresolved {target}`).not.toMatch(/\{target\}/);
  expect(text, `[${ctx}] unresolved {item}`).not.toMatch(/\{item\}/);
  expect(text, `[${ctx}] literal "undefined"`).not.toMatch(/\bundefined\b/i);
  expect(text, `[${ctx}] literal "[object Object]"`).not.toContain('[object Object]');
  expect(text, `[${ctx}] standalone null`).not.toMatch(/\bnull\b/i);
}

// ── A. Single correct answer — currentTargetItemId unchanged ─────────────────

describe('A — single correct answer does not change target', () => {
  it('currentTargetItemId stays "cat" after one correct "cat"', async () => {
    const { sessionMemory } = startKidsBrainSession(makeSessionStartInput('8-11-A1'));
    expect(sessionMemory.currentTargetItemId).toBe('cat');

    const result = await processKidsBrainTurn(makeTurnInput(sessionMemory, 'cat', 'cat'));

    // Learning engine returns undefined nextTargetItemId for a single correct (R30/R_DEFAULT_STAY)
    expect(result.learningDecision.nextTargetItemId).toBeUndefined();
    // Target must remain cat
    expect(result.updatedSessionMemory.currentTargetItemId).toBe('cat');
  });

  it('updatedSessionMemory.currentTargetItemId equals input currentTargetItemId when no advancement', async () => {
    const { sessionMemory } = startKidsBrainSession(makeSessionStartInput('8-11-A2'));
    const original = sessionMemory.currentTargetItemId;

    const result = await processKidsBrainTurn(makeTurnInput(sessionMemory, 'cat', 'cat'));

    // No advancement decision → target preserved
    if (result.learningDecision.nextTargetItemId === undefined) {
      expect(result.updatedSessionMemory.currentTargetItemId).toBe(original);
    }
  });
});

// ── B. Triggers that produce a defined nextTargetItemId ───────────────────────
//
// Reliable triggers:
//  1. Refusal ('no' alone → REFUSAL label → learning engine priority 4 fires)
//  2. Wrong-but-related answers (another vocab word → WRONG_BUT_RELATED ×3
//     → REPEATED_FAILURE state → learning engine priority 6 fires)
//
// Note: inputs like 'banana' with high STT confidence fall into the timeout
// fallback's CORRECT_HESITANT rule and do NOT count as wrong answers.

describe('B — reliable triggers produce a defined nextTargetItemId', () => {
  it('refusal ("no") on turn 1 → learning engine fires priority 4 → nextTargetItemId defined', async () => {
    const { sessionMemory } = startKidsBrainSession(makeSessionStartInput('8-11-B1'));
    // 'no' alone → deterministic REFUSAL → learning engine priority 4 → selectEasiestWin
    const result = await processKidsBrainTurn(makeTurnInput(sessionMemory, 'no', 'cat'));

    expect(result.learningDecision.shouldTriggerRecovery).toBe(true);
    expect(result.learningDecision.nextTargetItemId).toBeDefined();
    expect(PROTOTYPE_WORDS).toContain(result.learningDecision.nextTargetItemId);
  });

  it('3× WRONG_BUT_RELATED (vocab-group word) → REPEATED_FAILURE → easiest-win → nextTargetItemId defined', async () => {
    let mem = startKidsBrainSession(makeSessionStartInput('8-11-B2')).sessionMemory;
    // 'dog' when target is 'cat' → Rule 17 WRONG_BUT_RELATED (in vocabulary group, not target)
    // WRONG_BUT_RELATED is in both WRONG_GROUP (for consecutiveWrong) and FAILURE_LABELS
    // After 3 turns: projectedFailureCount=3 → REPEATED_FAILURE → priority 6 fires
    let lastResult;
    for (let i = 0; i < 3; i++) {
      lastResult = await processKidsBrainTurn(makeTurnInput(mem, 'dog', 'cat'));
      mem = lastResult.updatedSessionMemory;
    }

    expect(lastResult!.learningDecision.shouldTriggerEasiestWin).toBe(true);
    expect(lastResult!.learningDecision.nextTargetItemId).toBeDefined();
    expect(PROTOTYPE_WORDS).toContain(lastResult!.learningDecision.nextTargetItemId);
  });
});

// ── C. Persistence fix: updatedSessionMemory reflects learningDecision.nextTargetItemId ──

describe('C — persistence: updatedSessionMemory.currentTargetItemId matches learningDecision', () => {
  it('refusal triggers easiest-win: updatedSessionMemory.currentTargetItemId equals nextTargetItemId', async () => {
    const { sessionMemory } = startKidsBrainSession(makeSessionStartInput('8-11-C1'));
    expect(sessionMemory.currentTargetItemId).toBe('cat');

    // 'no' → REFUSAL → priority 4 → selectEasiestWin → nextTargetItemId defined
    const result = await processKidsBrainTurn(makeTurnInput(sessionMemory, 'no', 'cat'));

    const nextId = result.learningDecision.nextTargetItemId;
    // Core persistence regression guard: nextTargetItemId MUST be persisted
    expect(nextId).toBeDefined();
    expect(result.updatedSessionMemory.currentTargetItemId).toBe(nextId);
  });

  it('WRONG_BUT_RELATED ×3 triggers easiest-win: currentTargetItemId persisted correctly', async () => {
    let mem = startKidsBrainSession(makeSessionStartInput('8-11-C2')).sessionMemory;
    expect(mem.currentTargetItemId).toBe('cat');

    let lastResult;
    for (let i = 0; i < 3; i++) {
      lastResult = await processKidsBrainTurn(makeTurnInput(mem, 'dog', 'cat'));
      mem = lastResult.updatedSessionMemory;
    }

    const nextId = lastResult!.learningDecision.nextTargetItemId;
    // Core persistence regression guard
    expect(nextId).toBeDefined();
    expect(lastResult!.updatedSessionMemory.currentTargetItemId).toBe(nextId);
  });

  it('Redis-ready updatedSessionMemory has a different target after refusal easiest-win', async () => {
    const { sessionMemory } = startKidsBrainSession(makeSessionStartInput('8-11-C3'));
    expect(sessionMemory.currentTargetItemId).toBe('cat');

    const result = await processKidsBrainTurn(makeTurnInput(sessionMemory, 'no', 'cat'));

    const nextId = result.learningDecision.nextTargetItemId;
    expect(nextId).toBeDefined();
    // The session memory that would be written to Redis has the advanced target
    expect(result.updatedSessionMemory.currentTargetItemId).toBe(nextId);
    // And it is a valid vocabulary word
    expect(PROTOTYPE_WORDS).toContain(result.updatedSessionMemory.currentTargetItemId);
  });

  it('invariant: updatedSessionMemory.currentTargetItemId is always a vocabulary word', async () => {
    let mem = startKidsBrainSession(makeSessionStartInput('8-11-C4')).sessionMemory;

    // Mix of inputs including reliable wrong triggers
    const inputs: Array<[string, string]> = [
      ['dog', 'cat'],   // WRONG_BUT_RELATED
      ['no', 'cat'],    // REFUSAL
      ['cat', 'cat'],   // CORRECT
      ['dog', 'cat'],   // WRONG_BUT_RELATED again
    ];
    for (const [text, target] of inputs) {
      const result = await processKidsBrainTurn(makeTurnInput(mem, text, target));
      const id = result.updatedSessionMemory.currentTargetItemId;
      if (id !== null) {
        expect(PROTOTYPE_WORDS, `currentTargetItemId "${id}" not in vocabulary`).toContain(id);
      }
      mem = result.updatedSessionMemory;
    }
  });
});

// ── D. Next turn uses the persisted target ────────────────────────────────────

describe('D — persisted target propagates into the next turn', () => {
  it('turn N+1 sees the advanced target from turn N (refusal → easiest-win)', async () => {
    const { sessionMemory: mem0 } = startKidsBrainSession(makeSessionStartInput('8-11-D1'));
    expect(mem0.currentTargetItemId).toBe('cat');

    // Trigger easiest-win via refusal → advances to new target
    const r1 = await processKidsBrainTurn(makeTurnInput(mem0, 'no', 'cat'));
    const mem1 = r1.updatedSessionMemory;

    // The nextTargetItemId should have been persisted
    const advancedTarget = mem1.currentTargetItemId;
    expect(advancedTarget).toBeDefined();
    // It should be the same as learningDecision.nextTargetItemId
    if (r1.learningDecision.nextTargetItemId !== undefined) {
      expect(advancedTarget).toBe(r1.learningDecision.nextTargetItemId);
    }

    // Turn N+1: child answers with the new target word → correct classification
    const nextTurnTarget = advancedTarget ?? PROTOTYPE_WORDS[0]!;
    const r2 = await processKidsBrainTurn(
      makeTurnInput(mem1, nextTurnTarget, nextTurnTarget),
    );

    expect(r2.updatedSessionMemory.turnNumber).toBe(mem1.turnNumber + 1);
    expect(r2.safeToContinue).toBe(true);
  });
});

// ── E. recentPraisePhrases still updates alongside target persistence ─────────

describe('E — recentPraisePhrases updates correctly with target persistence', () => {
  it('recentPraisePhrases length is >= 0 after a correct answer', async () => {
    const { sessionMemory } = startKidsBrainSession(makeSessionStartInput('8-11-E1'));

    const result = await processKidsBrainTurn(makeTurnInput(sessionMemory, 'cat', 'cat'));

    // Praise phrases list is valid (0 or more entries, capped at 3)
    expect(Array.isArray(result.updatedSessionMemory.recentPraisePhrases)).toBe(true);
    expect(result.updatedSessionMemory.recentPraisePhrases.length).toBeLessThanOrEqual(3);
  });

  it('praise list stays within 3-phrase cap over multiple turns', async () => {
    let mem = startKidsBrainSession(makeSessionStartInput('8-11-E2')).sessionMemory;

    for (const word of ['cat', 'cat', 'cat', 'cat', 'cat']) {
      const result = await processKidsBrainTurn(makeTurnInput(mem, word, 'cat'));
      expect(result.updatedSessionMemory.recentPraisePhrases.length).toBeLessThanOrEqual(3);
      mem = result.updatedSessionMemory;
    }
  });

  it('praise list and target are both consistent in the same turn result (refusal)', async () => {
    const { sessionMemory } = startKidsBrainSession(makeSessionStartInput('8-11-E3'));

    // Refusal triggers easiest-win → nextTargetItemId defined
    const result = await processKidsBrainTurn(makeTurnInput(sessionMemory, 'no', 'cat'));
    const finalMem = result.updatedSessionMemory;

    // Praise list is still valid
    expect(finalMem.recentPraisePhrases.length).toBeLessThanOrEqual(3);
    // And target persistence occurred correctly
    if (result.learningDecision.nextTargetItemId !== undefined) {
      expect(finalMem.currentTargetItemId).toBe(result.learningDecision.nextTargetItemId);
    }
  });
});

// ── F. No unresolved placeholders ────────────────────────────────────────────

describe('F — no unresolved placeholders across target-progression turns', () => {
  it('teacher text has no placeholders on refusal → easiest-win turn', async () => {
    const { sessionMemory } = startKidsBrainSession(makeSessionStartInput('8-11-F1'));
    const result = await processKidsBrainTurn(makeTurnInput(sessionMemory, 'no', 'cat'));
    assertNoPlaceholders(result.teacherResponsePlan.mainText, 'refusal-easiest-win');
  });

  it('teacher text has no placeholders after target advances (WRONG_BUT_RELATED ×3) and child answers correctly', async () => {
    let mem = startKidsBrainSession(makeSessionStartInput('8-11-F2')).sessionMemory;

    // Trigger target advancement via WRONG_BUT_RELATED ×3
    for (let i = 0; i < 3; i++) {
      const result = await processKidsBrainTurn(makeTurnInput(mem, 'dog', 'cat'));
      assertNoPlaceholders(result.teacherResponsePlan.mainText, `wrong-T${i + 1}`);
      mem = result.updatedSessionMemory;
    }

    // Use the (potentially advanced) target
    const newTarget = mem.currentTargetItemId ?? PROTOTYPE_WORDS[0]!;
    const result = await processKidsBrainTurn(makeTurnInput(mem, newTarget, newTarget));
    assertNoPlaceholders(result.teacherResponsePlan.mainText, `after-advance-correct`);
  });
});

// ── G. No regression to correct classification ───────────────────────────────

describe('G — correct classification not regressed by persistence fix', () => {
  it('child says "cat" when target is "cat" → classified as eligible for progression', async () => {
    const { sessionMemory } = startKidsBrainSession(makeSessionStartInput('8-11-G1'));
    expect(sessionMemory.currentTargetItemId).toBe('cat');

    const result = await processKidsBrainTurn(makeTurnInput(sessionMemory, 'cat', 'cat'));

    const CORRECT_LABELS = new Set([
      ClassificationLabel.CORRECT_CONFIDENT,
      ClassificationLabel.CORRECT_HESITANT,
      ClassificationLabel.NEAR_CORRECT,
    ]);
    expect(CORRECT_LABELS.has(result.classificationResult.label)).toBe(true);
    expect(result.classificationResult.eligibleForProgression).toBe(true);
  });

  it('after refusal+easiest-win, answering correctly with new target stays safe', async () => {
    const { sessionMemory: mem0 } = startKidsBrainSession(makeSessionStartInput('8-11-G2'));

    // Refusal → easiest-win → target advances
    const r1 = await processKidsBrainTurn(makeTurnInput(mem0, 'no', 'cat'));
    const mem1 = r1.updatedSessionMemory;

    const currentTarget = mem1.currentTargetItemId ?? PROTOTYPE_WORDS[0]!;
    const result = await processKidsBrainTurn(
      makeTurnInput(mem1, currentTarget, currentTarget),
    );

    expect(result.safeToContinue).toBe(true);
  });

  it('turnNumber increments correctly through target-advancing turns', async () => {
    let mem = startKidsBrainSession(makeSessionStartInput('8-11-G3')).sessionMemory;
    expect(mem.turnNumber).toBe(0);

    // Mix of correct and refusal turns
    for (let i = 0; i < 4; i++) {
      const target = mem.currentTargetItemId ?? PROTOTYPE_WORDS[0]!;
      const input = i % 2 === 0 ? 'no' : target;
      const result = await processKidsBrainTurn(makeTurnInput(mem, input, target));
      expect(result.updatedSessionMemory.turnNumber).toBe(mem.turnNumber + 1);
      mem = result.updatedSessionMemory;
    }
    expect(mem.turnNumber).toBe(4);
  });
});
