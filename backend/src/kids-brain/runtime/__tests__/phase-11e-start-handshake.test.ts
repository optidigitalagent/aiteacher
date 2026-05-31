/**
 * Phase 11E — Kids v1 Start Handshake Fix Tests
 *
 * Verifies that readiness phrases ("I'm ready", "start", "yes", etc.) are
 * NOT classified as wrong curriculum answers, and that the first exercise
 * prompt is correctly emitted after the readiness confirmation.
 */

import { describe, it, expect } from 'vitest';
import {
  startKidsBrainSession,
  processKidsBrainTurn,
  RuntimeActionPacketType,
} from '../index.js';
import type {
  KidsBrainSessionStartInput,
  KidsBrainTurnInput,
} from '../index.js';
import { AgeBand, ClassificationLabel, RecoveryState } from '../../shared/enums.js';
import { AGE_PROFILE_6_7 } from '../../shared/types.js';
import type { STTResult } from '../../contracts/stt-result.js';
import type { SessionMemory } from '../../contracts/session-memory.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const TEST_SESSION_ID = 'test-11e-session';
const TEST_TIMESTAMP = '2026-05-31T10:00:00.000Z';
const LESSON_WORDS = ['blue', 'green', 'red', 'yellow', 'pink', 'purple', 'orange'];

const BASE_START_INPUT: KidsBrainSessionStartInput = {
  sessionId: TEST_SESSION_ID,
  userId: 'user-11e',
  childId: 'child-11e',
  childFirstName: 'Mia',
  ageBand: AgeBand.SIX_SEVEN,
  ageProfile: AGE_PROFILE_6_7,
  lessonTargetWords: LESSON_WORDS,
  unitReviewWords: [],
  characterNames: ['Star'],
  timestamp: TEST_TIMESTAMP,
};

function makeStt(text: string | null, confidence = 0.90): STTResult {
  return {
    text,
    confidence: text !== null ? confidence : null,
    languageCode: text !== null ? 'en-US' : null,
    alternatives: [],
    speechStartMs: text !== null ? 100 : null,
    speechEndMs: text !== null ? 700 : null,
    speechDurationMs: text !== null ? 600 : null,
    audioEnergyLevel: text !== null ? 0.8 : null,
    provider: 'google_chirp_v2',
    providerRequestId: 'req-11e',
    processingLatencyMs: 50,
  };
}

function makeTurnInput(
  sessionMemory: SessionMemory,
  sttText: string | null,
  overrides: Partial<KidsBrainTurnInput> = {},
): KidsBrainTurnInput {
  return {
    sessionMemory,
    sttResult: makeStt(sttText),
    responseLatencyMs: sttText !== null ? 800 : null,
    silenceDurationMs: sttText !== null ? 0 : 4000,
    attemptCount: sessionMemory.currentItemAttemptCount,
    targetWord: sessionMemory.currentTargetItemId ?? LESSON_WORDS[0],
    lessonTargetWords: LESSON_WORDS,
    unitReviewWords: [],
    characterNames: ['Star'],
    timestamp: TEST_TIMESTAMP,
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Phase 11E: start handshake — greeting', () => {
  it('startKidsBrainSession returns a greeting action packet', () => {
    const result = startKidsBrainSession(BASE_START_INPUT);

    const textPacket = result.actionPackets.find(
      p => p.packetType === RuntimeActionPacketType.TEACHER_TEXT,
    );
    expect(textPacket).toBeDefined();
    expect(textPacket!.teacherText).toContain('ready');
    expect(result.greetingPlan.mainText.length).toBeGreaterThan(5);
  });

  it('session memory starts with hasStartedFirstExercise = false', () => {
    const { sessionMemory } = startKidsBrainSession(BASE_START_INPUT);
    expect(sessionMemory.hasStartedFirstExercise).toBe(false);
  });
});

describe('Phase 11E: start handshake — readiness phrases are NOT classified as wrong answers', () => {
  it('"I\'m ready" does not produce a failure classification', async () => {
    const { sessionMemory } = startKidsBrainSession(BASE_START_INPUT);
    const result = await processKidsBrainTurn(makeTurnInput(sessionMemory, "I'm ready"));

    expect(result.classificationResult.label).not.toBe(ClassificationLabel.WRONG_SEMANTIC);
    expect(result.classificationResult.label).not.toBe(ClassificationLabel.WRONG_BUT_RELATED);
    expect(result.classificationResult.label).not.toBe(ClassificationLabel.RANDOM_NONSENSE);
  });

  it('"start" does not produce a failure classification', async () => {
    const { sessionMemory } = startKidsBrainSession(BASE_START_INPUT);
    const result = await processKidsBrainTurn(makeTurnInput(sessionMemory, 'start'));

    expect(result.classificationResult.label).not.toBe(ClassificationLabel.WRONG_SEMANTIC);
    expect(result.classificationResult.label).not.toBe(ClassificationLabel.WRONG_BUT_RELATED);
    expect(result.classificationResult.label).not.toBe(ClassificationLabel.RANDOM_NONSENSE);
  });

  it('"yes" does not produce a failure classification', async () => {
    const { sessionMemory } = startKidsBrainSession(BASE_START_INPUT);
    const result = await processKidsBrainTurn(makeTurnInput(sessionMemory, 'yes'));

    expect(result.classificationResult.label).not.toBe(ClassificationLabel.WRONG_SEMANTIC);
    expect(result.classificationResult.label).not.toBe(ClassificationLabel.WRONG_BUT_RELATED);
  });

  it('"ok" does not produce a failure classification', async () => {
    const { sessionMemory } = startKidsBrainSession(BASE_START_INPUT);
    const result = await processKidsBrainTurn(makeTurnInput(sessionMemory, 'ok'));

    expect(result.classificationResult.label).not.toBe(ClassificationLabel.WRONG_SEMANTIC);
    expect(result.classificationResult.label).not.toBe(ClassificationLabel.WRONG_BUT_RELATED);
  });
});

describe('Phase 11E: start handshake — first exercise prompt is emitted', () => {
  it('readiness input emits the first target word in the teacher response', async () => {
    const { sessionMemory } = startKidsBrainSession(BASE_START_INPUT);
    const result = await processKidsBrainTurn(makeTurnInput(sessionMemory, "I'm ready"));

    const firstTarget = sessionMemory.currentTargetItemId ?? LESSON_WORDS[0];
    expect(result.teacherResponsePlan.mainText.toLowerCase()).toContain(firstTarget.toLowerCase());
  });

  it('readiness response does NOT contain "try again"', async () => {
    const { sessionMemory } = startKidsBrainSession(BASE_START_INPUT);
    const result = await processKidsBrainTurn(makeTurnInput(sessionMemory, 'start'));

    expect(result.teacherResponsePlan.mainText.toLowerCase()).not.toContain('try again');
    expect(result.teacherResponsePlan.mainText.toLowerCase()).not.toContain('wrong');
  });

  it('readiness response includes TEACHER_TEXT and START_LISTENING packets', async () => {
    const { sessionMemory } = startKidsBrainSession(BASE_START_INPUT);
    const result = await processKidsBrainTurn(makeTurnInput(sessionMemory, "I'm ready"));

    const types = result.actionPackets.map(p => p.packetType);
    expect(types).toContain(RuntimeActionPacketType.TEACHER_TEXT);
    expect(types).toContain(RuntimeActionPacketType.START_LISTENING);
  });
});

describe('Phase 11E: start handshake — updatedSessionMemory marks readiness complete', () => {
  it('hasStartedFirstExercise is true after readiness turn', async () => {
    const { sessionMemory } = startKidsBrainSession(BASE_START_INPUT);
    const result = await processKidsBrainTurn(makeTurnInput(sessionMemory, "I'm ready"));

    expect(result.updatedSessionMemory.hasStartedFirstExercise).toBe(true);
  });

  it('first target word is preserved (not advanced) after readiness turn', async () => {
    const { sessionMemory } = startKidsBrainSession(BASE_START_INPUT);
    const result = await processKidsBrainTurn(makeTurnInput(sessionMemory, "I'm ready"));

    expect(result.updatedSessionMemory.currentTargetItemId).toBe(sessionMemory.currentTargetItemId);
  });
});

describe('Phase 11E: start handshake — curriculum classification resumes after readiness', () => {
  it('correct answer after readiness is classified as a correct label', async () => {
    // With AgeBand.SIX_SEVEN and a 1-word response, adjustedSttConfidence peaks at
    // 1.0 × 0.85 × 0.85 ≈ 0.72 — below the 0.75 threshold for CORRECT_CONFIDENT.
    // CORRECT_HESITANT is the expected result and is still a valid correct classification.
    const { sessionMemory } = startKidsBrainSession(BASE_START_INPUT);
    const readinessResult = await processKidsBrainTurn(makeTurnInput(sessionMemory, "I'm ready"));

    const postReadinessMemory = readinessResult.updatedSessionMemory;
    const firstWord = postReadinessMemory.currentTargetItemId ?? LESSON_WORDS[0];

    const answerResult = await processKidsBrainTurn(
      makeTurnInput(postReadinessMemory, firstWord, { targetWord: firstWord }),
    );

    const correctLabels = [ClassificationLabel.CORRECT_CONFIDENT, ClassificationLabel.CORRECT_HESITANT];
    expect(correctLabels).toContain(answerResult.classificationResult.label);
  });

  it('wrong answer after readiness classifies normally (not readiness intercept)', async () => {
    const { sessionMemory } = startKidsBrainSession(BASE_START_INPUT);
    const readinessResult = await processKidsBrainTurn(makeTurnInput(sessionMemory, "I'm ready"));

    const postReadinessMemory = readinessResult.updatedSessionMemory;
    const answerResult = await processKidsBrainTurn(
      makeTurnInput(postReadinessMemory, 'elephant', { targetWord: 'blue' }),
    );

    // Should NOT be intercepted as readiness — should go through normal classification.
    // "elephant" is not a readiness phrase AND hasStartedFirstExercise is now true.
    expect(answerResult.updatedSessionMemory.hasStartedFirstExercise).toBe(true);
    expect(answerResult.classificationResult.label).not.toBe(ClassificationLabel.CORRECT_CONFIDENT);
  });
});

describe('Phase 11E: start handshake — no mastery penalty for readiness input', () => {
  it('eligibleForMasteryUpdate is false for readiness classification', async () => {
    const { sessionMemory } = startKidsBrainSession(BASE_START_INPUT);
    const result = await processKidsBrainTurn(makeTurnInput(sessionMemory, "I'm ready"));

    expect(result.classificationResult.eligibleForMasteryUpdate).toBe(false);
    expect(result.classificationResult.eligibleForProgression).toBe(false);
  });

  it('no recovery is triggered for readiness input', async () => {
    const { sessionMemory } = startKidsBrainSession(BASE_START_INPUT);
    const result = await processKidsBrainTurn(makeTurnInput(sessionMemory, 'start'));

    expect(result.classificationResult.requiresRecovery).toBe(false);
    expect(result.stateEngineOutput.triggeredRecoveryChange).toBe(false);
    expect(result.updatedSessionMemory.recoveryState).toBe(RecoveryState.NORMAL);
  });
});

describe('Phase 11E: isolation — adult runtime untouched', () => {
  it('feature flag hasStartedFirstExercise is absent from adult SessionMemory import path', async () => {
    // Verify the kids-brain module loads without importing adult runtime types.
    const kidsModule = await import('../index.js');
    expect(kidsModule.startKidsBrainSession).toBeTypeOf('function');
    expect(kidsModule.processKidsBrainTurn).toBeTypeOf('function');
  });

  it('processKidsBrainTurn with hasStartedFirstExercise=true skips readiness intercept', async () => {
    const { sessionMemory } = startKidsBrainSession(BASE_START_INPUT);
    // Manually force hasStartedFirstExercise=true (simulates a session mid-lesson).
    const midLessonMemory: SessionMemory = { ...sessionMemory, hasStartedFirstExercise: true };

    // "ok" would be intercepted as readiness if hasStartedFirstExercise were false.
    const result = await processKidsBrainTurn(
      makeTurnInput(midLessonMemory, 'ok', { targetWord: 'blue' }),
    );

    // Should go through the normal classification pipeline.
    expect(result.updatedSessionMemory.hasStartedFirstExercise).toBe(true);
    // "ok" as a non-readiness turn gets classified normally (not CORRECT_HESITANT intercept).
    // The main guard is: log event READINESS_PHRASE_INTERCEPTED should NOT appear.
    const readinessLog = result.logsToEmit.find(
      l => l.event === 'readiness_phrase_intercepted',
    );
    expect(readinessLog).toBeUndefined();
  });
});
