/**
 * Phase 13D.1 — Readiness Phrase Normalization Fix Tests
 *
 * Verifies that sentence-ending punctuation from STT or typed input does not
 * block the readiness intercept, so "I'm ready." and "start!" correctly trigger
 * the first exercise prompt instead of falling through to normal classification.
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
import { AgeBand, RecoveryState } from '../../shared/enums.js';
import { AGE_PROFILE_6_7 } from '../../shared/types.js';
import type { STTResult } from '../../contracts/stt-result.js';
import type { SessionMemory } from '../../contracts/session-memory.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const LESSON_WORDS = ['blue', 'green', 'pink', 'purple', 'orange', 'red', 'yellow'];
const EX_01_ID = 'kb1-u01-l02-ex-01-readiness';
const EX_02_ID = 'kb1-u01-l02-ex-02-blue';

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

function makeStt(text: string): STTResult {
  return {
    text,
    confidence: 0.90,
    languageCode: 'en-US',
    alternatives: [],
    speechStartMs: 100,
    speechEndMs: 700,
    speechDurationMs: 600,
    audioEnergyLevel: 0.80,
    provider: 'google_chirp_v2',
    providerRequestId: 'req-13d1',
    processingLatencyMs: 50,
  };
}

function makeTurn(
  sessionMemory: SessionMemory,
  sttText: string,
): KidsBrainTurnInput {
  return {
    sessionMemory,
    sttResult: makeStt(sttText),
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

// ── Helpers ───────────────────────────────────────────────────────────────────

async function runReadinessPhrase(sessionId: string, phrase: string) {
  const { sessionMemory } = startKidsBrainSession(makeSessionInput(sessionId));
  return processKidsBrainTurn(makeTurn(sessionMemory, phrase));
}

function wasReadinessIntercepted(result: Awaited<ReturnType<typeof processKidsBrainTurn>>): boolean {
  return result.logsToEmit.some(l => l.event === 'readiness_phrase_intercepted');
}

// ── Punctuated variants match ─────────────────────────────────────────────────

describe('Phase 13D.1: readiness normalization — punctuated variants are intercepted', () => {
  it('"I\'m ready" (no punctuation) is intercepted', async () => {
    const result = await runReadinessPhrase('13d1-p01', "I'm ready");
    expect(wasReadinessIntercepted(result)).toBe(true);
    expect(result.updatedSessionMemory.hasStartedFirstExercise).toBe(true);
  });

  it('"I\'m ready." (trailing period) is intercepted', async () => {
    const result = await runReadinessPhrase('13d1-p02', "I'm ready.");
    expect(wasReadinessIntercepted(result)).toBe(true);
    expect(result.updatedSessionMemory.hasStartedFirstExercise).toBe(true);
  });

  it('"I\'m ready!" (trailing exclamation) is intercepted', async () => {
    const result = await runReadinessPhrase('13d1-p03', "I'm ready!");
    expect(wasReadinessIntercepted(result)).toBe(true);
    expect(result.updatedSessionMemory.hasStartedFirstExercise).toBe(true);
  });

  it('"Im ready!" (no apostrophe + exclamation) is intercepted', async () => {
    const result = await runReadinessPhrase('13d1-p04', 'Im ready!');
    expect(wasReadinessIntercepted(result)).toBe(true);
    expect(result.updatedSessionMemory.hasStartedFirstExercise).toBe(true);
  });

  it('"ready." (single word + period) is intercepted', async () => {
    const result = await runReadinessPhrase('13d1-p05', 'ready.');
    expect(wasReadinessIntercepted(result)).toBe(true);
    expect(result.updatedSessionMemory.hasStartedFirstExercise).toBe(true);
  });

  it('"start!" (exclamation) is intercepted', async () => {
    const result = await runReadinessPhrase('13d1-p06', 'start!');
    expect(wasReadinessIntercepted(result)).toBe(true);
    expect(result.updatedSessionMemory.hasStartedFirstExercise).toBe(true);
  });

  it('"okay," (trailing comma) is intercepted', async () => {
    const result = await runReadinessPhrase('13d1-p07', 'okay,');
    expect(wasReadinessIntercepted(result)).toBe(true);
    expect(result.updatedSessionMemory.hasStartedFirstExercise).toBe(true);
  });

  it('"ok." (period) is intercepted', async () => {
    const result = await runReadinessPhrase('13d1-p08', 'ok.');
    expect(wasReadinessIntercepted(result)).toBe(true);
    expect(result.updatedSessionMemory.hasStartedFirstExercise).toBe(true);
  });

  it('"let\'s go!" (apostrophe preserved, exclamation stripped) is intercepted', async () => {
    const result = await runReadinessPhrase('13d1-p09', "let's go!");
    expect(wasReadinessIntercepted(result)).toBe(true);
    expect(result.updatedSessionMemory.hasStartedFirstExercise).toBe(true);
  });
});

// ── Non-readiness phrases do not match ───────────────────────────────────────

describe('Phase 13D.1: readiness normalization — non-readiness phrases are NOT intercepted', () => {
  it('"hello" does not match', async () => {
    const result = await runReadinessPhrase('13d1-n01', 'hello');
    expect(wasReadinessIntercepted(result)).toBe(false);
    expect(result.updatedSessionMemory.hasStartedFirstExercise).toBe(false);
  });

  it('"long unrelated sentence with punctuation." does not match', async () => {
    const result = await runReadinessPhrase('13d1-n02', 'I want to play outside today.');
    expect(wasReadinessIntercepted(result)).toBe(false);
    expect(result.updatedSessionMemory.hasStartedFirstExercise).toBe(false);
  });
});

// ── Integration: emits correct first exercise prompt ─────────────────────────

describe('Phase 13D.1: integration — punctuated readiness emits first exercise prompt', () => {
  it('"I\'m ready." emits "Listen — blue! Now you!"', async () => {
    const result = await runReadinessPhrase('13d1-i01', "I'm ready.");
    expect(result.teacherResponsePlan.mainText).toContain('blue');
    expect(result.teacherResponsePlan.mainText).toContain('Listen');
  });

  it('"I\'m ready." response does NOT contain "try again"', async () => {
    const result = await runReadinessPhrase('13d1-i02', "I'm ready.");
    expect(result.teacherResponsePlan.mainText.toLowerCase()).not.toContain('try again');
    expect(result.teacherResponsePlan.mainText.toLowerCase()).not.toContain('wrong');
  });

  it('"I\'m ready." emits TEACHER_TEXT and START_LISTENING packets', async () => {
    const result = await runReadinessPhrase('13d1-i03', "I'm ready.");
    const types = result.actionPackets.map(p => p.packetType);
    expect(types).toContain(RuntimeActionPacketType.TEACHER_TEXT);
    expect(types).toContain(RuntimeActionPacketType.START_LISTENING);
  });

  it('"I\'m ready." sets hasStartedFirstExercise=true', async () => {
    const result = await runReadinessPhrase('13d1-i04', "I'm ready.");
    expect(result.updatedSessionMemory.hasStartedFirstExercise).toBe(true);
  });

  it('"I\'m ready." advances currentExerciseId from ex-01 to ex-02', async () => {
    const { sessionMemory } = startKidsBrainSession(makeSessionInput('13d1-i05'));
    expect(sessionMemory.currentExerciseId).toBe(EX_01_ID);

    const result = await processKidsBrainTurn(makeTurn(sessionMemory, "I'm ready."));
    expect(result.updatedSessionMemory.currentExerciseId).toBe(EX_02_ID);
  });

  it('"start!" advances currentExerciseId from ex-01 to ex-02', async () => {
    const { sessionMemory } = startKidsBrainSession(makeSessionInput('13d1-i06'));
    expect(sessionMemory.currentExerciseId).toBe(EX_01_ID);

    const result = await processKidsBrainTurn(makeTurn(sessionMemory, 'start!'));
    expect(result.updatedSessionMemory.currentExerciseId).toBe(EX_02_ID);
  });
});

// ── No mastery penalty or recovery triggered ──────────────────────────────────

describe('Phase 13D.1: integration — no mastery penalty or recovery for punctuated readiness', () => {
  it('"I\'m ready." → eligibleForMasteryUpdate=false', async () => {
    const result = await runReadinessPhrase('13d1-m01', "I'm ready.");
    expect(result.classificationResult.eligibleForMasteryUpdate).toBe(false);
    expect(result.classificationResult.eligibleForProgression).toBe(false);
  });

  it('"start!" → requiresRecovery=false', async () => {
    const result = await runReadinessPhrase('13d1-m02', 'start!');
    expect(result.classificationResult.requiresRecovery).toBe(false);
  });

  it('"ok." → recoveryState stays NORMAL', async () => {
    const result = await runReadinessPhrase('13d1-m03', 'ok.');
    expect(result.updatedSessionMemory.recoveryState).toBe(RecoveryState.NORMAL);
  });

  it('"let\'s go!" → stateEngine does not trigger recovery', async () => {
    const result = await runReadinessPhrase('13d1-m04', "let's go!");
    expect(result.stateEngineOutput.triggeredRecoveryChange).toBe(false);
  });
});
