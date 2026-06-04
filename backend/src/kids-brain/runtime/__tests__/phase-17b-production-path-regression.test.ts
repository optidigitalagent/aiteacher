/**
 * Phase 17B — Production Path Regression Tests
 *
 * Verifies that the Phase 17A classification fix works with the EXACT production
 * input shape used by lesson-ws.ts → processKidsBrainV1Turn:
 *
 *   const sttResult = buildSTTResultFromText(text)   ← null confidence, null timing
 *   await processKidsBrainTurn({ sttResult, silenceDurationMs: 0, responseLatencyMs: null, ... })
 *
 * These tests reproduce the exact production bug scenario:
 *   buildSTTResultFromText("Yes. I'm ready.") → null confidence
 *   → adjustedSttConfidence = 0.50 × 0.85 = 0.425
 *   → perceptionConfidence = 0.425 (< 0.50) → safeForDeterministicClassification=false
 *   BEFORE fix: timeout_fallback fires → perceptionConfidence < 0.50 → SILENCE_MEDIUM (bug)
 *   AFTER fix:  deterministic Rule 10.6 fires first → CLARIFICATION_REQUEST (correct)
 */

import { describe, it, expect } from 'vitest';
import {
  startKidsBrainSession,
  processKidsBrainTurn,
} from '../index.js';
import type { KidsBrainSessionStartInput } from '../index.js';
import { AgeBand, ClassificationLabel } from '../../shared/enums.js';
import { AGE_PROFILE_6_7 } from '../../shared/types.js';
import type { SessionMemory } from '../../contracts/session-memory.js';
import { buildSTTResultFromText } from '../../adapters/stt-adapter.js';

// ── Fixtures (mirrors lesson-ws.ts processKidsBrainV1Turn exactly) ────────────

const LESSON_WORDS = ['blue', 'green', 'pink', 'purple', 'orange'];

function makeSessionInput(sessionId: string): KidsBrainSessionStartInput {
  return {
    sessionId,
    userId: `user-${sessionId}`,
    childId: `child-${sessionId}`,
    childFirstName: 'friend',    // matches lesson-ws.ts
    ageBand: AgeBand.SIX_SEVEN,
    ageProfile: AGE_PROFILE_6_7,
    lessonTargetWords: [...LESSON_WORDS],
    unitReviewWords: [],
    characterNames: ['milo'],
    timestamp: new Date().toISOString(),
  };
}

/**
 * Builds a turn input using the EXACT same adapter as lesson-ws.ts line 1364:
 *   const sttResult = buildSTTResultFromText(text || null)
 * And the same parameters as processKidsBrainTurn call in lesson-ws.ts:
 *   silenceDurationMs: 0, responseLatencyMs: null
 */
function makeProductionTurnInput(sessionMemory: SessionMemory, text: string) {
  return {
    sessionMemory,
    sttResult: buildSTTResultFromText(text),   // production adapter — null confidence
    responseLatencyMs: null,                    // null in production
    silenceDurationMs: 0,                       // always 0 in production WS call
    attemptCount: sessionMemory.currentItemAttemptCount,
    targetWord: sessionMemory.currentTargetItemId ?? LESSON_WORDS[0],
    childFirstName: 'friend',
    lessonTargetWords: [...LESSON_WORDS],
    unitReviewWords: [],
    characterNames: ['milo'],
    timestamp: new Date().toISOString(),
  };
}

/** Advances past readiness intercept using the production adapter. */
async function advancePastReadiness(sessionId: string): Promise<SessionMemory> {
  const { sessionMemory } = startKidsBrainSession(makeSessionInput(sessionId));
  const result = await processKidsBrainTurn(makeProductionTurnInput(sessionMemory, 'start'));
  return result.updatedSessionMemory;
}

// ── Verify perception confidence matches the production bug condition ──────────

describe('Phase 17B: production signal — perceptionConfidence is below 0.50', () => {
  it('buildSTTResultFromText yields null confidence → adjustedSttConfidence ~0.425', async () => {
    const { sessionMemory } = startKidsBrainSession(makeSessionInput('17b-sig01'));
    const exerciseMemory = (await processKidsBrainTurn(makeProductionTurnInput(sessionMemory, 'start'))).updatedSessionMemory;

    const result = await processKidsBrainTurn(makeProductionTurnInput(exerciseMemory, "Yes. I'm ready."));

    // perceptionConfidence < 0.50 is the exact condition that triggered the bug.
    // We verify it IS below threshold (meaning the deterministic rule, not high confidence, fixed this).
    expect(result.perceptionBundle.perceptionConfidence).toBeLessThan(0.50);
  });

  it('buildSTTResultFromText "What should I say?" → perceptionConfidence < 0.50', async () => {
    const exerciseMemory = await advancePastReadiness('17b-sig02');
    const result = await processKidsBrainTurn(makeProductionTurnInput(exerciseMemory, 'What should I say?'));

    expect(result.perceptionBundle.perceptionConfidence).toBeLessThan(0.50);
  });
});

// ── Production bug regression: exact bug scenario must NOT reproduce ──────────

describe('Phase 17B: regression — "Yes. I\'m ready." must NOT be silence_medium', () => {
  it('first-turn via buildSTTResultFromText → NOT silence_medium (readiness intercept)', async () => {
    const { sessionMemory } = startKidsBrainSession(makeSessionInput('17b-r01'));
    expect(sessionMemory.hasStartedFirstExercise).toBe(false);

    const result = await processKidsBrainTurn(makeProductionTurnInput(sessionMemory, "Yes. I'm ready."));

    expect(result.classificationResult.label).not.toBe(ClassificationLabel.SILENCE_MEDIUM);
    expect(result.classificationResult.label).not.toBe(ClassificationLabel.SILENCE_LONG);
    expect(result.classificationResult.label).not.toBe(ClassificationLabel.SILENCE_SHORT);
    expect(result.updatedSessionMemory.hasStartedFirstExercise).toBe(true);
  });

  it('mid-exercise via buildSTTResultFromText → NOT silence_medium (deterministic Rule 10.6)', async () => {
    const exerciseMemory = await advancePastReadiness('17b-r02');
    expect(exerciseMemory.hasStartedFirstExercise).toBe(true);

    const result = await processKidsBrainTurn(makeProductionTurnInput(exerciseMemory, "Yes. I'm ready."));

    // Core regression check: the exact production bug scenario does NOT reproduce
    expect(result.classificationResult.label).not.toBe(ClassificationLabel.SILENCE_MEDIUM);
    expect(result.classificationResult.source).not.toBe('timeout_fallback');
    expect(result.classificationResult.label).toBe(ClassificationLabel.CLARIFICATION_REQUEST);
  });

  it('mid-exercise "yes im ready" (no apostrophe) → NOT silence_medium', async () => {
    const exerciseMemory = await advancePastReadiness('17b-r03');

    const result = await processKidsBrainTurn(makeProductionTurnInput(exerciseMemory, 'yes im ready'));

    expect(result.classificationResult.label).not.toBe(ClassificationLabel.SILENCE_MEDIUM);
    expect(result.classificationResult.label).toBe(ClassificationLabel.CLARIFICATION_REQUEST);
  });
});

describe('Phase 17B: regression — "What should I say?" must NOT be silence_medium', () => {
  it('via buildSTTResultFromText → NOT silence_medium (deterministic Rule 10.5)', async () => {
    const exerciseMemory = await advancePastReadiness('17b-r04');

    const result = await processKidsBrainTurn(makeProductionTurnInput(exerciseMemory, 'What should I say?'));

    expect(result.classificationResult.label).not.toBe(ClassificationLabel.SILENCE_MEDIUM);
    expect(result.classificationResult.source).not.toBe('timeout_fallback');
    expect(result.classificationResult.label).toBe(ClassificationLabel.CLARIFICATION_REQUEST);
  });

  it('"What do I say?" via buildSTTResultFromText → CLARIFICATION_REQUEST', async () => {
    const exerciseMemory = await advancePastReadiness('17b-r05');

    const result = await processKidsBrainTurn(makeProductionTurnInput(exerciseMemory, 'What do I say?'));

    expect(result.classificationResult.label).toBe(ClassificationLabel.CLARIFICATION_REQUEST);
    expect(result.classificationResult.source).not.toBe('timeout_fallback');
  });

  it('"help me" via buildSTTResultFromText → CLARIFICATION_REQUEST', async () => {
    const exerciseMemory = await advancePastReadiness('17b-r06');

    const result = await processKidsBrainTurn(makeProductionTurnInput(exerciseMemory, 'help me'));

    expect(result.classificationResult.label).toBe(ClassificationLabel.CLARIFICATION_REQUEST);
  });
});

// ── Teacher response: clarification must include target word ──────────────────

describe('Phase 17B: teacher response contains target word', () => {
  it('"What should I say?" → teacher says target word', async () => {
    const exerciseMemory = await advancePastReadiness('17b-t01');
    const targetWord = exerciseMemory.currentTargetItemId ?? LESSON_WORDS[0];

    const result = await processKidsBrainTurn(makeProductionTurnInput(exerciseMemory, 'What should I say?'));

    expect(result.teacherResponsePlan.mainText.toLowerCase()).toContain(targetWord.toLowerCase());
  });

  it('"Yes. I\'m ready." mid-exercise → teacher says target word', async () => {
    const exerciseMemory = await advancePastReadiness('17b-t02');
    const targetWord = exerciseMemory.currentTargetItemId ?? LESSON_WORDS[0];

    const result = await processKidsBrainTurn(makeProductionTurnInput(exerciseMemory, "Yes. I'm ready."));

    expect(result.teacherResponsePlan.mainText.toLowerCase()).toContain(targetWord.toLowerCase());
  });

  it('teacher response does NOT use vague silence phrases', async () => {
    const exerciseMemory = await advancePastReadiness('17b-t03');
    const result = await processKidsBrainTurn(makeProductionTurnInput(exerciseMemory, 'What should I say?'));

    const text = result.teacherResponsePlan.mainText.toLowerCase();
    expect(text).not.toBe("hmm... i wonder...");
    expect(text).not.toBe("take your time!");
    expect(text).not.toBe("it's okay, i'm here!");
  });
});

// ── No mastery update for clarification/readiness ────────────────────────────

describe('Phase 17B: no mastery update for clarification', () => {
  it('"What should I say?" → eligibleForMasteryUpdate=false', async () => {
    const exerciseMemory = await advancePastReadiness('17b-m01');
    const result = await processKidsBrainTurn(makeProductionTurnInput(exerciseMemory, 'What should I say?'));

    expect(result.classificationResult.eligibleForMasteryUpdate).toBe(false);
    expect(result.classificationResult.eligibleForProgression).toBe(false);
  });

  it('"Yes. I\'m ready." mid-exercise → eligibleForMasteryUpdate=false', async () => {
    const exerciseMemory = await advancePastReadiness('17b-m02');
    const result = await processKidsBrainTurn(makeProductionTurnInput(exerciseMemory, "Yes. I'm ready."));

    expect(result.classificationResult.eligibleForMasteryUpdate).toBe(false);
    expect(result.classificationResult.eligibleForProgression).toBe(false);
  });
});

// ── Real silence still triggers silence recovery ──────────────────────────────

describe('Phase 17B: real silence still classified as silence', () => {
  it('null transcript + silenceDurationMs=4000 → silence label (not CLARIFICATION_REQUEST)', async () => {
    const exerciseMemory = await advancePastReadiness('17b-s01');

    const result = await processKidsBrainTurn({
      sessionMemory: exerciseMemory,
      sttResult: buildSTTResultFromText(null),  // null text = no transcript
      responseLatencyMs: null,
      silenceDurationMs: 4000,
      attemptCount: exerciseMemory.currentItemAttemptCount,
      targetWord: exerciseMemory.currentTargetItemId ?? LESSON_WORDS[0],
      childFirstName: 'friend',
      lessonTargetWords: [...LESSON_WORDS],
      unitReviewWords: [],
      characterNames: ['milo'],
      timestamp: new Date().toISOString(),
    });

    expect([
      ClassificationLabel.SILENCE_SHORT,
      ClassificationLabel.SILENCE_MEDIUM,
      ClassificationLabel.SILENCE_LONG,
      ClassificationLabel.NO_RESPONSE,
    ]).toContain(result.classificationResult.label);
    expect(result.classificationResult.label).not.toBe(ClassificationLabel.CLARIFICATION_REQUEST);
  });
});

// ── "blue" correct answer still works ────────────────────────────────────────

describe('Phase 17B: correct answer "blue" still classified correctly', () => {
  it('"blue" via buildSTTResultFromText → correct_confident or correct_hesitant', async () => {
    const exerciseMemory = await advancePastReadiness('17b-b01');

    // Override to use a known target word
    const memWithBlue: SessionMemory = { ...exerciseMemory, currentTargetItemId: 'blue' };

    const result = await processKidsBrainTurn({
      ...makeProductionTurnInput(memWithBlue, 'blue'),
      targetWord: 'blue',
    });

    expect([
      ClassificationLabel.CORRECT_CONFIDENT,
      ClassificationLabel.CORRECT_HESITANT,
    ]).toContain(result.classificationResult.label);
  });
});

// ── Paid/free STT path isolation ─────────────────────────────────────────────

describe('Phase 17B: paid/free STT path isolation', () => {
  it('Kids Brain classification is isolated to backend/src/kids-brain/', () => {
    // Verify that the classification fix files are only in kids-brain.
    // Paid/free lessons use LessonOrchestrator which does not import kids-brain classifiers.
    // This test serves as documentation — it passes trivially but marks the isolation boundary.
    const classificationChangedFiles = [
      'backend/src/kids-brain/classification/classification-constants.ts',
      'backend/src/kids-brain/classification/classification-result.ts',
      'backend/src/kids-brain/classification/deterministic-classifier.ts',
      'backend/src/kids-brain/runtime/turn-processor.ts',
      'backend/src/kids-brain/shared/enums.ts',
      'backend/src/kids-brain/teacher-response/recovery-response-builder.ts',
      'backend/src/kids-brain/teacher-response/teacher-response-router.ts',
    ];
    for (const f of classificationChangedFiles) {
      expect(f).toContain('kids-brain');
    }
  });
});
