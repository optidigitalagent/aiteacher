/**
 * Phase 17A — Kids Brain Classification Fix
 *
 * Verifies that meaningful child speech (readiness confirmations, clarification
 * questions) is NOT misclassified as silence_medium.
 *
 * Production evidence:
 *   rawTranscript: "Yes. I'm ready." → was silence_medium (bug)
 *   rawTranscript: "What should I say?" → was silence_medium (bug)
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
import {
  runDeterministicClassifier,
} from '../../classification/deterministic-classifier.js';
import type { ActivityContext, ItemVocabularyContext } from '../../classification/classification-types.js';
import type { PerceptionBundle } from '../../perception/perception-bundle.js';
import { InputQuality } from '../../perception/perception-types.js';
import { PromptType, ActivityType } from '../../shared/enums.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const LESSON_WORDS = ['blue', 'green', 'pink', 'purple', 'orange', 'red', 'yellow'];

function makeSessionInput(sessionId: string): KidsBrainSessionStartInput {
  return {
    sessionId,
    userId: `user-${sessionId}`,
    childId: `child-${sessionId}`,
    childFirstName: 'Mia',
    ageBand: AgeBand.SIX_SEVEN,
    ageProfile: AGE_PROFILE_6_7,
    lessonTargetWords: [...LESSON_WORDS],
    unitReviewWords: [],
    characterNames: ['milo'],
    timestamp: new Date().toISOString(),
  };
}

function makeStt(text: string, confidence = 0.90): STTResult {
  return {
    text,
    confidence,
    languageCode: 'en-US',
    alternatives: [],
    speechStartMs: 100,
    speechEndMs: 700,
    speechDurationMs: 600,
    audioEnergyLevel: 0.80,
    provider: 'google_chirp_v2',
    providerRequestId: 'req-17a',
    processingLatencyMs: 50,
  };
}

/** STT with null confidence — simulates Deepgram omitting confidence score. */
function makeSttNullConf(text: string): STTResult {
  return { ...makeStt(text), confidence: null };
}

function makeFirstExerciseTurn(
  sessionMemory: SessionMemory,
  sttText: string,
  confidence?: number | null,
): KidsBrainTurnInput {
  const stt = confidence === null ? makeSttNullConf(sttText) : makeStt(sttText, confidence ?? 0.90);
  return {
    sessionMemory,
    sttResult: stt,
    responseLatencyMs: 800,
    silenceDurationMs: 0,
    attemptCount: sessionMemory.currentItemAttemptCount,
    targetWord: sessionMemory.currentTargetItemId ?? LESSON_WORDS[0],
    lessonTargetWords: [...LESSON_WORDS],
    unitReviewWords: [],
    characterNames: ['milo'],
    timestamp: new Date().toISOString(),
  };
}

/** Runs "start!" to trigger readiness intercept, then returns the updated session. */
async function advancePastReadiness(sessionId: string): Promise<SessionMemory> {
  const { sessionMemory } = startKidsBrainSession(makeSessionInput(sessionId));
  const result = await processKidsBrainTurn(makeFirstExerciseTurn(sessionMemory, 'start!'));
  return result.updatedSessionMemory;
}

// ── Perception fixture for unit tests ─────────────────────────────────────────

function makePerception(transcript: string, perceptionConfidence = 0.40): PerceptionBundle {
  return {
    rawTranscript: transcript,
    normalizedTranscript: transcript,
    textLowercased: transcript.toLowerCase(),
    transcriptAvailable: true,
    wordCount: transcript.split(/\s+/).length,
    sttConfidence: 0.43,
    adjustedSttConfidence: 0.43,
    sttConfidenceMissing: false,
    perceptionConfidence,
    alternatives: [],
    detectedLanguageHints: [],
    l1Detected: false,
    l1ScriptDetected: false,
    l1KeywordDetected: false,
    l1Script: null,
    l1IntentHint: null,
    l1Word: null,
    responseLatencyMs: 800,
    silenceDurationMs: 0,
    speechDurationMs: 600,
    isVeryFast: false,
    isHesitant: false,
    isFastAnswer: false,
    isNormalAnswer: true,
    isSlowAnswer: false,
    isMissingLatency: false,
    hasAudio: true,
    isSilence: false,
    isShortSilence: true,
    isLongSilence: false,
    isNoResponse: false,
    inputQuality: InputQuality.USABLE,
    uncertaintyReasons: ['low_stt_confidence'],
    safeForDeterministicClassification: false,
    requiresLLMAssistedClassification: true,
    promptContext: {
      promptType: PromptType.OPEN_PRODUCTION,
      targetItem: 'blue',
      activityType: ActivityType.SUPPORTED_PRODUCTION,
    },
    childStateSnapshot: {
      comprehensionConfidence: 0.6,
      productionConfidence: 0.5,
      emotionalSafety: 0.75,
      frustrationRisk: 0.1,
      recentSuccessCount: 1,
      recentFailureCount: 0,
    },
    createdAt: new Date().toISOString(),
  };
}

function makeActivity(targetWord = 'blue'): ActivityContext {
  return {
    activityId: ActivityType.SUPPORTED_PRODUCTION,
    currentTargetItemId: targetWord,
    attemptNumber: 1,
    modelWasGiven: false,
    promptType: PromptType.OPEN_PRODUCTION,
  };
}

function makeVocabContext(targetWord = 'blue'): ItemVocabularyContext {
  return {
    targetWord,
    relatedWords: LESSON_WORDS.filter(w => w !== targetWord),
    vocabularyGroup: [...LESSON_WORDS],
  };
}

const AGE_PROFILE_FIXTURE = AGE_PROFILE_6_7;

// ── Unit Tests: Deterministic Classifier ─────────────────────────────────────

describe('Phase 17A: deterministic classifier — clarification phrases', () => {
  it('"What should I say?" → CLARIFICATION_REQUEST, not silence', () => {
    const result = runDeterministicClassifier(
      makePerception('What should I say?'),
      makeActivity(),
      AGE_PROFILE_FIXTURE,
      makeVocabContext(),
    );
    expect(result).not.toBeNull();
    expect(result!.label).toBe(ClassificationLabel.CLARIFICATION_REQUEST);
    expect(result!.source).toBe('deterministic');
  });

  it('"What do I say?" → CLARIFICATION_REQUEST', () => {
    const result = runDeterministicClassifier(
      makePerception('What do I say?'),
      makeActivity(),
      AGE_PROFILE_FIXTURE,
      makeVocabContext(),
    );
    expect(result).not.toBeNull();
    expect(result!.label).toBe(ClassificationLabel.CLARIFICATION_REQUEST);
  });

  it('"help me" → CLARIFICATION_REQUEST', () => {
    const result = runDeterministicClassifier(
      makePerception('help me'),
      makeActivity(),
      AGE_PROFILE_FIXTURE,
      makeVocabContext(),
    );
    expect(result).not.toBeNull();
    expect(result!.label).toBe(ClassificationLabel.CLARIFICATION_REQUEST);
  });

  it('"say what" → CLARIFICATION_REQUEST', () => {
    const result = runDeterministicClassifier(
      makePerception('say what'),
      makeActivity(),
      AGE_PROFILE_FIXTURE,
      makeVocabContext(),
    );
    expect(result).not.toBeNull();
    expect(result!.label).toBe(ClassificationLabel.CLARIFICATION_REQUEST);
  });

  it('"what word" → CLARIFICATION_REQUEST', () => {
    const result = runDeterministicClassifier(
      makePerception('what word'),
      makeActivity(),
      AGE_PROFILE_FIXTURE,
      makeVocabContext(),
    );
    expect(result).not.toBeNull();
    expect(result!.label).toBe(ClassificationLabel.CLARIFICATION_REQUEST);
  });
});

describe('Phase 17A: deterministic classifier — mid-exercise readiness phrases', () => {
  it('"Yes. I\'m ready." → CLARIFICATION_REQUEST (mid-exercise)', () => {
    const result = runDeterministicClassifier(
      makePerception("Yes. I'm ready."),
      makeActivity(),
      AGE_PROFILE_FIXTURE,
      makeVocabContext(),
    );
    expect(result).not.toBeNull();
    expect(result!.label).toBe(ClassificationLabel.CLARIFICATION_REQUEST);
    expect(result!.source).toBe('deterministic');
  });

  it('"I\'m ready." (mid-exercise) → CLARIFICATION_REQUEST', () => {
    const result = runDeterministicClassifier(
      makePerception("I'm ready."),
      makeActivity(),
      AGE_PROFILE_FIXTURE,
      makeVocabContext(),
    );
    expect(result).not.toBeNull();
    expect(result!.label).toBe(ClassificationLabel.CLARIFICATION_REQUEST);
  });

  it('"yes i\'m ready" (mid-exercise) → CLARIFICATION_REQUEST', () => {
    const result = runDeterministicClassifier(
      makePerception("yes i'm ready"),
      makeActivity(),
      AGE_PROFILE_FIXTURE,
      makeVocabContext(),
    );
    expect(result).not.toBeNull();
    expect(result!.label).toBe(ClassificationLabel.CLARIFICATION_REQUEST);
  });

  it('"yes ok" (mid-exercise) → CLARIFICATION_REQUEST', () => {
    const result = runDeterministicClassifier(
      makePerception('yes ok'),
      makeActivity(),
      AGE_PROFILE_FIXTURE,
      makeVocabContext(),
    );
    expect(result).not.toBeNull();
    expect(result!.label).toBe(ClassificationLabel.CLARIFICATION_REQUEST);
  });
});

describe('Phase 17A: deterministic classifier — CLARIFICATION_REQUEST flags', () => {
  it('CLARIFICATION_REQUEST is not mastery-eligible', () => {
    const result = runDeterministicClassifier(
      makePerception('What should I say?'),
      makeActivity(),
      AGE_PROFILE_FIXTURE,
      makeVocabContext(),
    );
    expect(result!.eligibleForMasteryUpdate).toBe(false);
    expect(result!.eligibleForProgression).toBe(false);
    expect(result!.requiresRecovery).toBe(false);
  });
});

describe('Phase 17A: deterministic classifier — correct answer still works', () => {
  it('"blue" still classified as correct (exact match)', () => {
    const result = runDeterministicClassifier(
      makePerception('blue', 0.85),
      makeActivity('blue'),
      AGE_PROFILE_FIXTURE,
      makeVocabContext('blue'),
    );
    expect(result).not.toBeNull();
    expect([ClassificationLabel.CORRECT_CONFIDENT, ClassificationLabel.CORRECT_HESITANT]).toContain(result!.label);
  });

  it('wrong word with transcript is not treated as silence', () => {
    const result = runDeterministicClassifier(
      makePerception('cat', 0.85),
      makeActivity('blue'),
      AGE_PROFILE_FIXTURE,
      makeVocabContext('blue'),
    );
    // Wrong word but transcript exists — should NOT be silence
    if (result !== null) {
      expect([
        ClassificationLabel.SILENCE_SHORT,
        ClassificationLabel.SILENCE_MEDIUM,
        ClassificationLabel.SILENCE_LONG,
        ClassificationLabel.NO_RESPONSE,
      ]).not.toContain(result.label);
    }
    // If null → goes to LLM/fallback, but not silence from deterministic
  });
});

// ── Integration Tests: Full Turn Pipeline ─────────────────────────────────────

describe('Phase 17A: integration — "Yes. I\'m ready." first turn (readiness intercept)', () => {
  it('"Yes. I\'m ready." (first turn) → readiness intercepted, hasStartedFirstExercise=true', async () => {
    const { sessionMemory } = startKidsBrainSession(makeSessionInput('17a-i01'));
    expect(sessionMemory.hasStartedFirstExercise).toBe(false);

    const result = await processKidsBrainTurn(
      makeFirstExerciseTurn(sessionMemory, "Yes. I'm ready.", null),
    );

    expect(result.updatedSessionMemory.hasStartedFirstExercise).toBe(true);
    expect(result.logsToEmit.some(l => l.event === 'readiness_phrase_intercepted')).toBe(true);
  });

  it('"Yes. I\'m ready." (first turn) — classification not silence_medium', async () => {
    const { sessionMemory } = startKidsBrainSession(makeSessionInput('17a-i02'));
    const result = await processKidsBrainTurn(
      makeFirstExerciseTurn(sessionMemory, "Yes. I'm ready.", null),
    );

    expect(result.classificationResult.label).not.toBe(ClassificationLabel.SILENCE_MEDIUM);
    expect(result.classificationResult.label).not.toBe(ClassificationLabel.SILENCE_LONG);
    expect(result.classificationResult.label).not.toBe(ClassificationLabel.SILENCE_SHORT);
  });

  it('"Yes. I\'m ready." (first turn) — teacher response contains target word "blue"', async () => {
    const { sessionMemory } = startKidsBrainSession(makeSessionInput('17a-i03'));
    const result = await processKidsBrainTurn(
      makeFirstExerciseTurn(sessionMemory, "Yes. I'm ready.", null),
    );

    expect(result.teacherResponsePlan.mainText.toLowerCase()).toContain('blue');
  });

  it('"Yes. I\'m ready." (first turn) — no mastery update', async () => {
    const { sessionMemory } = startKidsBrainSession(makeSessionInput('17a-i04'));
    const result = await processKidsBrainTurn(
      makeFirstExerciseTurn(sessionMemory, "Yes. I'm ready.", null),
    );

    expect(result.classificationResult.eligibleForMasteryUpdate).toBe(false);
    expect(result.classificationResult.eligibleForProgression).toBe(false);
  });

  it('"Yes. I\'m ready." (first turn) — no recovery state triggered', async () => {
    const { sessionMemory } = startKidsBrainSession(makeSessionInput('17a-i05'));
    const result = await processKidsBrainTurn(
      makeFirstExerciseTurn(sessionMemory, "Yes. I'm ready.", null),
    );

    expect(result.updatedSessionMemory.recoveryState).toBe(RecoveryState.NORMAL);
  });
});

describe('Phase 17A: integration — "What should I say?" mid-exercise', () => {
  it('"What should I say?" → not silence_medium', async () => {
    const exerciseMemory = await advancePastReadiness('17a-c01');

    const result = await processKidsBrainTurn(
      makeFirstExerciseTurn(exerciseMemory, 'What should I say?', null),
    );

    expect(result.classificationResult.label).not.toBe(ClassificationLabel.SILENCE_MEDIUM);
    expect(result.classificationResult.label).toBe(ClassificationLabel.CLARIFICATION_REQUEST);
  });

  it('"What should I say?" → teacher response contains target word', async () => {
    const exerciseMemory = await advancePastReadiness('17a-c02');
    const targetWord = exerciseMemory.currentTargetItemId ?? 'blue';

    const result = await processKidsBrainTurn(
      makeFirstExerciseTurn(exerciseMemory, 'What should I say?', null),
    );

    expect(result.teacherResponsePlan.mainText.toLowerCase()).toContain(targetWord.toLowerCase());
  });

  it('"What should I say?" → teacher response is NOT vague silence recovery', async () => {
    const exerciseMemory = await advancePastReadiness('17a-c03');

    const result = await processKidsBrainTurn(
      makeFirstExerciseTurn(exerciseMemory, 'What should I say?', null),
    );

    const text = result.teacherResponsePlan.mainText.toLowerCase();
    expect(text).not.toBe("hmm... i wonder...");
    expect(text).not.toBe("take your time!");
    expect(text).not.toBe("it's okay, i'm here!");
  });

  it('"What should I say?" → no mastery update for blue', async () => {
    const exerciseMemory = await advancePastReadiness('17a-c04');

    const result = await processKidsBrainTurn(
      makeFirstExerciseTurn(exerciseMemory, 'What should I say?', null),
    );

    expect(result.classificationResult.eligibleForMasteryUpdate).toBe(false);
    expect(result.classificationResult.eligibleForProgression).toBe(false);
  });
});

describe('Phase 17A: integration — "Yes. I\'m ready." mid-exercise (after first exercise started)', () => {
  it('"Yes. I\'m ready." mid-exercise → CLARIFICATION_REQUEST, not silence_medium', async () => {
    const exerciseMemory = await advancePastReadiness('17a-m01');

    const result = await processKidsBrainTurn(
      makeFirstExerciseTurn(exerciseMemory, "Yes. I'm ready.", null),
    );

    expect(result.classificationResult.label).toBe(ClassificationLabel.CLARIFICATION_REQUEST);
    expect(result.classificationResult.label).not.toBe(ClassificationLabel.SILENCE_MEDIUM);
  });

  it('"Yes. I\'m ready." mid-exercise → teacher response contains target word', async () => {
    const exerciseMemory = await advancePastReadiness('17a-m02');
    const targetWord = exerciseMemory.currentTargetItemId ?? 'blue';

    const result = await processKidsBrainTurn(
      makeFirstExerciseTurn(exerciseMemory, "Yes. I'm ready.", null),
    );

    expect(result.teacherResponsePlan.mainText.toLowerCase()).toContain(targetWord.toLowerCase());
  });
});

describe('Phase 17A: integration — real silence still works', () => {
  it('actual silence → silence classification (not CLARIFICATION_REQUEST)', async () => {
    const exerciseMemory = await advancePastReadiness('17a-s01');

    // Silence turn: no transcript, silenceDurationMs > 0
    const result = await processKidsBrainTurn({
      sessionMemory: exerciseMemory,
      sttResult: {
        text: null,
        confidence: null,
        languageCode: null,
        alternatives: [],
        speechStartMs: null,
        speechEndMs: null,
        speechDurationMs: null,
        audioEnergyLevel: null,
        provider: 'google_chirp_v2',
        providerRequestId: 'silence-test',
        processingLatencyMs: 0,
      },
      responseLatencyMs: null,
      silenceDurationMs: 4000,
      attemptCount: exerciseMemory.currentItemAttemptCount,
      targetWord: exerciseMemory.currentTargetItemId ?? 'blue',
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

describe('Phase 17A: integration — "blue" correct answer still works', () => {
  it('"blue" spoken correctly → correct classification (mastery-eligible)', async () => {
    const exerciseMemory = await advancePastReadiness('17a-b01');

    const result = await processKidsBrainTurn(
      makeFirstExerciseTurn(exerciseMemory, 'blue', 0.92),
    );

    expect([
      ClassificationLabel.CORRECT_CONFIDENT,
      ClassificationLabel.CORRECT_HESITANT,
    ]).toContain(result.classificationResult.label);
  });
});

describe('Phase 17A: integration — STT packets still emitted', () => {
  it('"What should I say?" → emits TEACHER_TEXT and START_LISTENING', async () => {
    const exerciseMemory = await advancePastReadiness('17a-p01');

    const result = await processKidsBrainTurn(
      makeFirstExerciseTurn(exerciseMemory, 'What should I say?', null),
    );

    const types = result.actionPackets.map(p => p.packetType);
    expect(types).toContain(RuntimeActionPacketType.TEACHER_TEXT);
    expect(types).toContain(RuntimeActionPacketType.START_LISTENING);
  });

  it('"Yes. I\'m ready." mid-exercise → emits TEACHER_TEXT and START_LISTENING', async () => {
    const exerciseMemory = await advancePastReadiness('17a-p02');

    const result = await processKidsBrainTurn(
      makeFirstExerciseTurn(exerciseMemory, "Yes. I'm ready.", null),
    );

    const types = result.actionPackets.map(p => p.packetType);
    expect(types).toContain(RuntimeActionPacketType.TEACHER_TEXT);
    expect(types).toContain(RuntimeActionPacketType.START_LISTENING);
  });
});
