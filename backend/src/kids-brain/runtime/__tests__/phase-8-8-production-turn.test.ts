/**
 * Phase 8.8 — production turn verification (Task 3).
 * Simulates the exact production wiring after fixes:
 *   lessonTargetWords = KIDS_PROTOTYPE_TARGET_WORDS
 *   targetWord        = sessionMemory.currentTargetItemId ?? KIDS_PROTOTYPE_TARGET_WORDS[0]
 *
 * Child says "cat" → must be CORRECT, not RANDOM_NONSENSE.
 */

import { describe, it, expect } from 'vitest';
import { AgeBand, ClassificationLabel, RecoveryState } from '../../shared/enums.js';
import { AGE_PROFILE_6_7 } from '../../shared/types.js';
import { startKidsBrainSession, processKidsBrainTurn } from '../index.js';
import type { KidsBrainSessionStartInput, KidsBrainTurnInput } from '../runtime-types.js';
import type { STTResult } from '../../contracts/stt-result.js';

// ── Constants matching lesson-ws.ts Phase 8.8 wiring ─────────────────────────

const KIDS_PROTOTYPE_TARGET_WORDS = ['cat', 'dog', 'lion', 'monkey', 'elephant', 'tiger'];

function makeSttResult(text: string): STTResult {
  return {
    text,
    confidence: 0.90,
    languageCode: 'en-US',
    alternatives: [],
    speechStartMs: 100,
    speechEndMs: 1000,
    speechDurationMs: 900,
    audioEnergyLevel: 0.75,
    provider: 'google_chirp_v2',
    providerRequestId: 'phase-8-8-verify',
    processingLatencyMs: 50,
  };
}

describe('Phase 8.8 — production turn simulation', () => {

  it('child says "cat": classified as CORRECT, not RANDOM_NONSENSE, progression eligible, recovery not triggered', async () => {
    // 1. Session start with fixed vocabulary (mirrors lesson-ws.ts after Phase 8.8)
    const startInput: KidsBrainSessionStartInput = {
      sessionId: 'phase-8-8-session',
      userId:    'user-phase-8-8',
      childId:   'child-phase-8-8',
      childFirstName: 'friend',
      ageBand:   AgeBand.SIX_SEVEN,
      ageProfile: AGE_PROFILE_6_7,
      lessonTargetWords: KIDS_PROTOTYPE_TARGET_WORDS,   // Blocker 1 fix
      unitReviewWords:   [],
      characterNames:    ['milo'],
      timestamp: new Date().toISOString(),
    };

    const { sessionMemory } = startKidsBrainSession(startInput);

    // Confirm Blocker 3 fix: currentTargetItemId is now seeded from lessonTargetWords[0]
    expect(sessionMemory.currentTargetItemId).toBe('cat');

    // 2. Per-turn call with fixed targetWord (mirrors lesson-ws.ts after Phase 8.8)
    const targetWord = sessionMemory.currentTargetItemId ?? KIDS_PROTOTYPE_TARGET_WORDS[0]; // Blocker 2 fix

    const turnInput: KidsBrainTurnInput = {
      sessionMemory,
      sttResult:         makeSttResult('cat'),
      responseLatencyMs: 900,
      silenceDurationMs: 0,
      attemptCount:      sessionMemory.currentItemAttemptCount,
      targetWord,                                        // Blocker 2 fix
      childFirstName:    'friend',
      lessonTargetWords: KIDS_PROTOTYPE_TARGET_WORDS,    // Blocker 1 fix
      unitReviewWords:   [],
      characterNames:    ['milo'],
      timestamp:         new Date().toISOString(),
    };

    const result = await processKidsBrainTurn(turnInput);

    const label = result.classificationResult.label;

    // ── Assertions matching Task 3 specification ──────────────────────────────

    // classification = correct (one of the three correct labels)
    const CORRECT_LABELS = new Set([
      ClassificationLabel.CORRECT_CONFIDENT,
      ClassificationLabel.CORRECT_HESITANT,
      ClassificationLabel.NEAR_CORRECT,
    ]);
    expect(CORRECT_LABELS.has(label), `Expected correct label, got: ${label}`).toBe(true);

    // not RANDOM_NONSENSE
    expect(label).not.toBe(ClassificationLabel.RANDOM_NONSENSE);

    // progression eligible
    expect(result.classificationResult.eligibleForProgression).toBe(true);

    // recovery not triggered
    expect(result.updatedSessionMemory.recoveryState).toBe(RecoveryState.NORMAL);
    expect(result.stateEngineOutput.triggeredRecoveryChange).toBe(false);

    // session safe to continue
    expect(result.safeToContinue).toBe(true);
  });

});
