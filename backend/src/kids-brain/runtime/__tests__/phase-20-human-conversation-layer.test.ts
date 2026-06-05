/**
 * Phase 20 — Human Conversation Layer
 *
 * Verifies that real child speech is NEVER classified as silence.
 * Any non-empty transcript must produce a meaningful label and a teacher
 * response that always contains the current target word.
 *
 * Production evidence that prompted this fix:
 *   rawTranscript: "Great."  → was silence_medium (bug)
 *   rawTranscript: "Hello."  → was silence_medium (bug)
 *   rawTranscript: "Hello?"  → was silence_medium (bug)
 *
 * Test structure:
 *   A) Unit: deterministic classifier — social speech detection
 *   B) Unit: timeout fallback — transcript guard
 *   C) Integration: 100+ real child transcript scenarios
 *   D) Integration: core product scenarios (goal spec)
 *   E) Regression: correct answer still progresses
 *   F) Regression: actual silence still works
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
import { AgeBand, ClassificationLabel } from '../../shared/enums.js';
import { AGE_PROFILE_6_7 } from '../../shared/types.js';
import type { STTResult } from '../../contracts/stt-result.js';
import type { SessionMemory } from '../../contracts/session-memory.js';
import { runDeterministicClassifier } from '../../classification/deterministic-classifier.js';
import { computeTimeoutFallback } from '../../classification/timeout-fallback.js';
import type { ActivityContext, ItemVocabularyContext } from '../../classification/classification-types.js';
import type { PerceptionBundle } from '../../perception/perception-bundle.js';
import { InputQuality } from '../../perception/perception-types.js';
import { PromptType, ActivityType } from '../../shared/enums.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const TARGET_WORD = 'blue';
const LESSON_WORDS = ['blue', 'green', 'pink', 'purple', 'orange', 'red', 'yellow'];

const SILENCE_LABELS = new Set([
  ClassificationLabel.SILENCE_SHORT,
  ClassificationLabel.SILENCE_MEDIUM,
  ClassificationLabel.SILENCE_LONG,
  ClassificationLabel.NO_RESPONSE,
]);

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

function makeStt(text: string, confidence = 0.85): STTResult {
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
    providerRequestId: 'req-p20',
    processingLatencyMs: 50,
  };
}

function makeSttLowConf(text: string): STTResult {
  return { ...makeStt(text), confidence: 0.35 };
}

async function advancePastReadiness(sessionId: string): Promise<SessionMemory> {
  const { sessionMemory } = startKidsBrainSession(makeSessionInput(sessionId));
  const result = await processKidsBrainTurn({
    sessionMemory,
    sttResult: makeStt('start'),
    responseLatencyMs: 800,
    silenceDurationMs: 0,
    attemptCount: sessionMemory.currentItemAttemptCount,
    targetWord: sessionMemory.currentTargetItemId ?? TARGET_WORD,
    lessonTargetWords: [...LESSON_WORDS],
    unitReviewWords: [],
    characterNames: ['milo'],
    timestamp: new Date().toISOString(),
  });
  return result.updatedSessionMemory;
}

async function runTurn(
  sessionMemory: SessionMemory,
  transcript: string,
  confidence = 0.85,
): Promise<ReturnType<typeof processKidsBrainTurn>> {
  const stt = confidence < 0.50 ? makeSttLowConf(transcript) : makeStt(transcript, confidence);
  const input: KidsBrainTurnInput = {
    sessionMemory,
    sttResult: stt,
    responseLatencyMs: 800,
    silenceDurationMs: 0,
    attemptCount: sessionMemory.currentItemAttemptCount,
    targetWord: sessionMemory.currentTargetItemId ?? TARGET_WORD,
    lessonTargetWords: [...LESSON_WORDS],
    unitReviewWords: [],
    characterNames: ['milo'],
    timestamp: new Date().toISOString(),
  };
  return processKidsBrainTurn(input);
}

function makePerception(
  transcript: string,
  perceptionConfidence = 0.40,
  adjustedSttConfidence = 0.43,
): PerceptionBundle {
  return {
    rawTranscript: transcript,
    normalizedTranscript: transcript,
    textLowercased: transcript.toLowerCase(),
    transcriptAvailable: true,
    wordCount: transcript.split(/\s+/).length,
    sttConfidence: adjustedSttConfidence,
    adjustedSttConfidence,
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
      targetItem: TARGET_WORD,
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

function makeActivity(targetWord = TARGET_WORD): ActivityContext {
  return {
    activityId: ActivityType.SUPPORTED_PRODUCTION,
    currentTargetItemId: targetWord,
    attemptNumber: 1,
    modelWasGiven: false,
    promptType: PromptType.OPEN_PRODUCTION,
  };
}

function makeVocabContext(targetWord = TARGET_WORD): ItemVocabularyContext {
  return {
    targetWord,
    relatedWords: LESSON_WORDS.filter(w => w !== targetWord),
    vocabularyGroup: [...LESSON_WORDS],
  };
}

const AGE_PROFILE = AGE_PROFILE_6_7;

// ── A: Unit tests — deterministic classifier social speech ────────────────────

describe('Phase 20A: deterministic classifier — greetings never silence', () => {
  const greetings = [
    'hello', 'Hello.', 'Hello?', 'hello!',
    'hi', 'Hi!', 'Hi.', 'hi there',
    'hey', 'Hey!',
    'hi teacher', 'hello teacher',
    'good morning', 'good afternoon', 'good evening',
  ];

  greetings.forEach(phrase => {
    it(`"${phrase}" → SOCIAL_SPEECH, not silence`, () => {
      const result = runDeterministicClassifier(
        makePerception(phrase),
        makeActivity(),
        AGE_PROFILE,
        makeVocabContext(),
      );
      expect(result, `"${phrase}" should not fall through to null`).not.toBeNull();
      expect(result!.label, `"${phrase}" should be SOCIAL_SPEECH`).toBe(ClassificationLabel.SOCIAL_SPEECH);
      expect(SILENCE_LABELS.has(result!.label), `"${phrase}" must not be silence`).toBe(false);
    });
  });
});

describe('Phase 20A: deterministic classifier — acknowledgements never silence', () => {
  const acks = [
    'great', 'Great!', 'Great.',
    'yay', 'Yay!',
    'wow', 'Wow!',
    'cool', 'Cool!',
    'nice', 'awesome', 'fantastic', 'wonderful', 'amazing',
    'super', 'perfect', 'brilliant', 'alright',
    'hurray', 'hooray', 'woohoo', 'woo',
  ];

  acks.forEach(phrase => {
    it(`"${phrase}" → SOCIAL_SPEECH, not silence`, () => {
      const result = runDeterministicClassifier(
        makePerception(phrase),
        makeActivity(),
        AGE_PROFILE,
        makeVocabContext(),
      );
      expect(result).not.toBeNull();
      expect(result!.label).toBe(ClassificationLabel.SOCIAL_SPEECH);
      expect(SILENCE_LABELS.has(result!.label)).toBe(false);
    });
  });
});

describe('Phase 20A: deterministic classifier — stalling phrases never silence', () => {
  const stalls = [
    'wait', 'Wait!', 'Wait...',
    'one second', 'one moment', 'hold on',
    'just a second', 'just a moment',
  ];

  stalls.forEach(phrase => {
    it(`"${phrase}" → SOCIAL_SPEECH, not silence`, () => {
      const result = runDeterministicClassifier(
        makePerception(phrase),
        makeActivity(),
        AGE_PROFILE,
        makeVocabContext(),
      );
      expect(result).not.toBeNull();
      expect(result!.label).toBe(ClassificationLabel.SOCIAL_SPEECH);
      expect(SILENCE_LABELS.has(result!.label)).toBe(false);
    });
  });
});

describe('Phase 20A: deterministic classifier — single affirmatives never silence', () => {
  const affirms = ['yes', 'Yes!', 'Yes.', 'yeah', 'yep', 'yup', 'sure', 'okay', 'ok', 'Okay!'];

  affirms.forEach(phrase => {
    it(`"${phrase}" (mid-exercise) → SOCIAL_SPEECH or CLARIFICATION_REQUEST, never silence`, () => {
      const result = runDeterministicClassifier(
        makePerception(phrase),
        makeActivity(),
        AGE_PROFILE,
        makeVocabContext(),
      );
      expect(result).not.toBeNull();
      expect(SILENCE_LABELS.has(result!.label)).toBe(false);
    });
  });
});

describe('Phase 20A: deterministic classifier — confusion phrases never silence', () => {
  const confusion = ['what', 'What?', 'huh', 'hm', 'eh'];

  confusion.forEach(phrase => {
    it(`"${phrase}" → SOCIAL_SPEECH, not silence`, () => {
      const result = runDeterministicClassifier(
        makePerception(phrase),
        makeActivity(),
        AGE_PROFILE,
        makeVocabContext(),
      );
      expect(result).not.toBeNull();
      expect(result!.label).toBe(ClassificationLabel.SOCIAL_SPEECH);
      expect(SILENCE_LABELS.has(result!.label)).toBe(false);
    });
  });
});

describe('Phase 20A: deterministic classifier — SOCIAL_SPEECH flags', () => {
  it('SOCIAL_SPEECH is not mastery-eligible', () => {
    const result = runDeterministicClassifier(
      makePerception('hello'),
      makeActivity(),
      AGE_PROFILE,
      makeVocabContext(),
    );
    expect(result!.eligibleForMasteryUpdate).toBe(false);
    expect(result!.eligibleForProgression).toBe(false);
  });

  it('SOCIAL_SPEECH does not require recovery', () => {
    const result = runDeterministicClassifier(
      makePerception('great'),
      makeActivity(),
      AGE_PROFILE,
      makeVocabContext(),
    );
    expect(result!.requiresRecovery).toBe(false);
  });
});

// ── B: Unit tests — timeout fallback transcript guard ─────────────────────────

describe('Phase 20B: timeout fallback — transcript guard (never silence when transcript exists)', () => {
  const transcriptCases = [
    { label: 'low perceptionConfidence with transcript', perception: makePerception('hello', 0.30, 0.30) },
    { label: 'very low perceptionConfidence with transcript', perception: makePerception('great', 0.20, 0.20) },
    { label: 'zero perceptionConfidence with transcript', perception: makePerception('okay', 0.10, 0.10) },
  ];

  transcriptCases.forEach(({ label, perception }) => {
    it(`${label} → NOT SILENCE_MEDIUM`, () => {
      const result = computeTimeoutFallback(perception, TARGET_WORD, 0);
      expect(result.label).not.toBe(ClassificationLabel.SILENCE_MEDIUM);
      expect(result.label).not.toBe(ClassificationLabel.SILENCE_LONG);
      expect(result.label).not.toBe(ClassificationLabel.SILENCE_SHORT);
      expect(SILENCE_LABELS.has(result.label)).toBe(false);
    });
  });

  it('no transcript + low confidence → SILENCE_MEDIUM (real silence still works)', () => {
    const noTranscriptPerception: PerceptionBundle = {
      ...makePerception('', 0.30),
      transcriptAvailable: false,
      normalizedTranscript: null,
      rawTranscript: null,
      textLowercased: '',
    };
    const result = computeTimeoutFallback(noTranscriptPerception, TARGET_WORD, 0);
    expect(result.label).toBe(ClassificationLabel.SILENCE_MEDIUM);
  });

  it('isSilence + transcript → NOT SILENCE_LONG (transcript guard)', () => {
    const silenceWithTranscript: PerceptionBundle = {
      ...makePerception('hello', 0.40),
      isSilence: true,
      isShortSilence: false,
      isLongSilence: true,
      silenceDurationMs: 5000,
    };
    const result = computeTimeoutFallback(silenceWithTranscript, TARGET_WORD, 0);
    expect(result.label).not.toBe(ClassificationLabel.SILENCE_LONG);
  });
});

// ── C: Integration — 100+ real child transcript scenarios ─────────────────────

describe('Phase 20C: integration — real child transcripts never become silence', () => {
  // The complete list of real child utterances that must never be silence.
  const realChildTranscripts = [
    // Greetings
    'hello', 'Hello.', 'Hello?', 'Hello!',
    'hi', 'Hi!', 'Hi.', 'Hey!', 'hey',
    'hi teacher', 'hello teacher',
    'good morning',
    // Acknowledgements / reactions
    'great', 'Great!', 'Great.',
    'yay', 'Yay!',
    'okay', 'ok', 'Okay!',
    'wow', 'cool', 'nice', 'awesome',
    // Stalling
    'wait', 'Wait!',
    'one second', 'hold on',
    // Confusion
    'what', 'What?', 'huh',
    // Affirmatives
    'yes', 'Yes!', 'yeah', 'yep', 'sure',
    // Readiness expressions
    'i am ready', 'yes i am ready', 'lets go', 'let\'s go',
    // Clarification requests
    'what should i say', 'what do i say', 'help me', 'tell me',
    // Help requests
    "i don't know", 'i dont know', 'idk',
    // Wrong answers (in-vocabulary)
    'red', 'green', 'pink', 'purple', 'orange', 'yellow',
    // Excitement / celebration
    'woohoo', 'hurray', 'hooray',
    // Partial confusion
    'is this blue', 'is that blue',
    // Mixed social
    'okay okay', 'alright', 'got it',
    // Longer off-topic but meaningful
    'i forgot', 'can you repeat',
    // Teacher-directed
    'can you help me', 'what is it',
    // Other
    'hm', 'eh',
  ];

  realChildTranscripts.forEach((transcript, idx) => {
    it(`#${idx + 1} "${transcript}" → not silence`, async () => {
      const mem = await advancePastReadiness(`p20c-${idx}`);
      const result = await runTurn(mem, transcript);
      expect(
        SILENCE_LABELS.has(result.classificationResult.label),
        `"${transcript}" must not be classified as silence (got: ${result.classificationResult.label})`,
      ).toBe(false);
    });
  });
});

describe('Phase 20C: integration — teacher response always contains target word', () => {
  // Subset of transcripts that are off-task (not target word, not i-dont-know help paths)
  const socialTranscripts = [
    'hello', 'Hello.', 'Hello?',
    'great', 'Great!',
    'yay', 'wow', 'cool',
    'wait', 'one second',
    'what', 'huh',
    'okay', 'yes', 'yeah',
    'hi teacher', 'alright',
    'woohoo', 'hurray',
  ];

  socialTranscripts.forEach((transcript, idx) => {
    it(`social "${transcript}" → teacher response includes target word`, async () => {
      const mem = await advancePastReadiness(`p20c-tw-${idx}`);
      const targetWord = (mem.currentTargetItemId ?? TARGET_WORD).toLowerCase();
      const result = await runTurn(mem, transcript);
      const responseText = result.teacherResponsePlan.mainText.toLowerCase();
      expect(
        responseText,
        `response to "${transcript}" must include target word "${targetWord}"`,
      ).toContain(targetWord);
    });
  });
});

describe('Phase 20C: integration — teacher response has no vague filler', () => {
  const VAGUE_PHRASES = [
    "let's try again",
    "take your time",
    "it's ok, i'm here",
    "hmm... i wonder",
    "it's okay, i'm here",
  ];

  const checkTranscripts = ['hello', 'great', 'yay', 'okay', 'wait', 'what'];

  checkTranscripts.forEach((transcript, idx) => {
    it(`"${transcript}" → no vague filler in response`, async () => {
      const mem = await advancePastReadiness(`p20c-vf-${idx}`);
      const result = await runTurn(mem, transcript);
      const text = result.teacherResponsePlan.mainText.toLowerCase();
      VAGUE_PHRASES.forEach(vague => {
        expect(
          text,
          `response to "${transcript}" must not contain "${vague}"`,
        ).not.toContain(vague);
      });
    });
  });
});

describe('Phase 20C: integration — low-confidence transcript never silence', () => {
  // These simulate real Deepgram transcripts with low confidence scores
  // that were previously getting silence_medium via timeout fallback Rule 4.
  const lowConfTranscripts = ['hello', 'great', 'okay', 'wait', 'yes', 'hi', 'yay', 'wow'];

  lowConfTranscripts.forEach((transcript, idx) => {
    it(`low-conf "${transcript}" → not silence`, async () => {
      const mem = await advancePastReadiness(`p20c-lc-${idx}`);
      const result = await runTurn(mem, transcript, 0.35);
      expect(
        SILENCE_LABELS.has(result.classificationResult.label),
        `low-conf "${transcript}" (got: ${result.classificationResult.label}) must not be silence`,
      ).toBe(false);
    });
  });

  lowConfTranscripts.forEach((transcript, idx) => {
    it(`low-conf "${transcript}" → response includes target word`, async () => {
      const mem = await advancePastReadiness(`p20c-lc-tw-${idx}`);
      const targetWord = (mem.currentTargetItemId ?? TARGET_WORD).toLowerCase();
      const result = await runTurn(mem, transcript, 0.35);
      expect(
        result.teacherResponsePlan.mainText.toLowerCase(),
      ).toContain(targetWord);
    });
  });
});

// ── D: Integration — goal spec core scenarios ─────────────────────────────────

describe('Phase 20D: goal spec scenarios', () => {
  it('S1: "Hello." with target blue → not silence, response includes blue', async () => {
    const mem = await advancePastReadiness('p20d-s1');
    const result = await runTurn(mem, 'Hello.');
    expect(SILENCE_LABELS.has(result.classificationResult.label)).toBe(false);
    expect(result.teacherResponsePlan.mainText.toLowerCase()).toContain('blue');
  });

  it('S2: "Great." with target blue → not silence, response includes blue', async () => {
    const mem = await advancePastReadiness('p20d-s2');
    const result = await runTurn(mem, 'Great.');
    expect(SILENCE_LABELS.has(result.classificationResult.label)).toBe(false);
    expect(result.teacherResponsePlan.mainText.toLowerCase()).toContain('blue');
  });

  it('S3: "Hello?" with target blue → not silence, response includes blue', async () => {
    const mem = await advancePastReadiness('p20d-s3');
    const result = await runTurn(mem, 'Hello?');
    expect(SILENCE_LABELS.has(result.classificationResult.label)).toBe(false);
    expect(result.teacherResponsePlan.mainText.toLowerCase()).toContain('blue');
  });

  it('S4: "What should I say?" → CLARIFICATION_REQUEST, response includes blue', async () => {
    const mem = await advancePastReadiness('p20d-s4');
    const result = await runTurn(mem, 'What should I say?');
    expect(result.classificationResult.label).toBe(ClassificationLabel.CLARIFICATION_REQUEST);
    expect(result.teacherResponsePlan.mainText.toLowerCase()).toContain('blue');
  });

  it('S5: "I don\'t know" → I_DONT_KNOW, response includes target word', async () => {
    const mem = await advancePastReadiness('p20d-s5');
    const targetWord = (mem.currentTargetItemId ?? TARGET_WORD).toLowerCase();
    const result = await runTurn(mem, "I don't know");
    expect(result.classificationResult.label).toBe(ClassificationLabel.I_DONT_KNOW);
    expect(result.classificationResult.eligibleForProgression).toBe(false);
    expect(result.teacherResponsePlan.mainText.toLowerCase()).toContain(targetWord);
  });

  it('S6: "red" with target blue → not correct, no progression, response includes blue', async () => {
    const mem = await advancePastReadiness('p20d-s6');
    const result = await runTurn(mem, 'red', 0.92);
    expect([
      ClassificationLabel.CORRECT_CONFIDENT,
      ClassificationLabel.CORRECT_HESITANT,
    ]).not.toContain(result.classificationResult.label);
    expect(result.classificationResult.eligibleForProgression).toBe(false);
    expect(result.teacherResponsePlan.mainText.toLowerCase()).toContain('blue');
  });

  it('S7: "blue" with target blue → CORRECT, progression allowed', async () => {
    const mem = await advancePastReadiness('p20d-s7');
    const result = await runTurn(mem, 'blue', 0.92);
    expect([
      ClassificationLabel.CORRECT_CONFIDENT,
      ClassificationLabel.CORRECT_HESITANT,
    ]).toContain(result.classificationResult.label);
    expect(result.classificationResult.eligibleForProgression).toBe(true);
  });

  it('S8: null/empty transcript → silence classification, response includes target word', async () => {
    const mem = await advancePastReadiness('p20d-s8');
    const result = await processKidsBrainTurn({
      sessionMemory: mem,
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
        providerRequestId: 'p20-silence',
        processingLatencyMs: 0,
      },
      responseLatencyMs: null,
      silenceDurationMs: 4000,
      attemptCount: mem.currentItemAttemptCount,
      targetWord: mem.currentTargetItemId ?? TARGET_WORD,
      lessonTargetWords: [...LESSON_WORDS],
      unitReviewWords: [],
      characterNames: ['milo'],
      timestamp: new Date().toISOString(),
    });
    expect(SILENCE_LABELS.has(result.classificationResult.label)).toBe(true);
    const targetWord = (mem.currentTargetItemId ?? TARGET_WORD).toLowerCase();
    expect(result.teacherResponsePlan.mainText.toLowerCase()).toContain(targetWord);
  });

  it('S9: mini-flow hello → clarification → blue → progression', async () => {
    const mem0 = await advancePastReadiness('p20d-s9');
    const targetWord = mem0.currentTargetItemId ?? TARGET_WORD;

    // hello — not silence, contains target word
    const r1 = await runTurn(mem0, 'hello');
    expect(SILENCE_LABELS.has(r1.classificationResult.label)).toBe(false);
    expect(r1.teacherResponsePlan.mainText.toLowerCase()).toContain(targetWord.toLowerCase());

    // clarification — not silence, contains target word
    const r2 = await runTurn(r1.updatedSessionMemory, 'What should I say?');
    expect(r2.classificationResult.label).toBe(ClassificationLabel.CLARIFICATION_REQUEST);
    expect(r2.teacherResponsePlan.mainText.toLowerCase()).toContain(targetWord.toLowerCase());

    // correct answer — progression
    const r3 = await runTurn(r2.updatedSessionMemory, targetWord, 0.92);
    expect([
      ClassificationLabel.CORRECT_CONFIDENT,
      ClassificationLabel.CORRECT_HESITANT,
    ]).toContain(r3.classificationResult.label);
    expect(r3.classificationResult.eligibleForProgression).toBe(true);
  });

  it('S10: action packets always include TEACHER_TEXT + START_LISTENING for social speech', async () => {
    const mem = await advancePastReadiness('p20d-s10');
    const result = await runTurn(mem, 'hello');
    const types = result.actionPackets.map(p => p.packetType);
    expect(types).toContain(RuntimeActionPacketType.TEACHER_TEXT);
    expect(types).toContain(RuntimeActionPacketType.START_LISTENING);
  });
});

// ── E: Regression — correct answer still progresses ──────────────────────────

describe('Phase 20E: regression — correct answer unaffected', () => {
  it('"blue" still classified as correct (not SOCIAL_SPEECH)', async () => {
    const mem = await advancePastReadiness('p20e-r1');
    const result = await runTurn(mem, 'blue', 0.92);
    expect([
      ClassificationLabel.CORRECT_CONFIDENT,
      ClassificationLabel.CORRECT_HESITANT,
    ]).toContain(result.classificationResult.label);
    expect(result.classificationResult.label).not.toBe(ClassificationLabel.SOCIAL_SPEECH);
  });

  it('"blue" is eligible for mastery update', async () => {
    const mem = await advancePastReadiness('p20e-r2');
    const result = await runTurn(mem, 'blue', 0.95);
    expect(result.classificationResult.eligibleForMasteryUpdate).toBe(true);
    expect(result.classificationResult.eligibleForProgression).toBe(true);
  });

  it('deterministic classifier: "blue" → correct, not SOCIAL_SPEECH', () => {
    const result = runDeterministicClassifier(
      makePerception('blue', 0.85, 0.85),
      makeActivity('blue'),
      AGE_PROFILE,
      makeVocabContext('blue'),
    );
    expect(result).not.toBeNull();
    expect([
      ClassificationLabel.CORRECT_CONFIDENT,
      ClassificationLabel.CORRECT_HESITANT,
    ]).toContain(result!.label);
    expect(result!.label).not.toBe(ClassificationLabel.SOCIAL_SPEECH);
  });
});

// ── F: Regression — actual silence still works ────────────────────────────────

describe('Phase 20F: regression — actual silence still routed correctly', () => {
  it('null transcript + 4s silence → silence label, response includes target word', async () => {
    const mem = await advancePastReadiness('p20f-s1');
    const result = await processKidsBrainTurn({
      sessionMemory: mem,
      sttResult: {
        text: null, confidence: null, languageCode: null,
        alternatives: [], speechStartMs: null, speechEndMs: null,
        speechDurationMs: null, audioEnergyLevel: null,
        provider: 'google_chirp_v2', providerRequestId: 'p20f-sil',
        processingLatencyMs: 0,
      },
      responseLatencyMs: null,
      silenceDurationMs: 4000,
      attemptCount: mem.currentItemAttemptCount,
      targetWord: mem.currentTargetItemId ?? TARGET_WORD,
      lessonTargetWords: [...LESSON_WORDS],
      unitReviewWords: [],
      characterNames: ['milo'],
      timestamp: new Date().toISOString(),
    });
    expect(SILENCE_LABELS.has(result.classificationResult.label)).toBe(true);
    const targetWord = (mem.currentTargetItemId ?? TARGET_WORD).toLowerCase();
    expect(result.teacherResponsePlan.mainText.toLowerCase()).toContain(targetWord);
  });

  it('null transcript + 8s silence → silence label (SILENCE_LONG or similar)', async () => {
    const mem = await advancePastReadiness('p20f-s2');
    const result = await processKidsBrainTurn({
      sessionMemory: mem,
      sttResult: {
        text: null, confidence: null, languageCode: null,
        alternatives: [], speechStartMs: null, speechEndMs: null,
        speechDurationMs: null, audioEnergyLevel: null,
        provider: 'google_chirp_v2', providerRequestId: 'p20f-sil2',
        processingLatencyMs: 0,
      },
      responseLatencyMs: null,
      silenceDurationMs: 8000,
      attemptCount: mem.currentItemAttemptCount,
      targetWord: mem.currentTargetItemId ?? TARGET_WORD,
      lessonTargetWords: [...LESSON_WORDS],
      unitReviewWords: [],
      characterNames: ['milo'],
      timestamp: new Date().toISOString(),
    });
    expect(SILENCE_LABELS.has(result.classificationResult.label)).toBe(true);
  });

  it('silence never labeled as SOCIAL_SPEECH', async () => {
    const mem = await advancePastReadiness('p20f-s3');
    const result = await processKidsBrainTurn({
      sessionMemory: mem,
      sttResult: {
        text: null, confidence: null, languageCode: null,
        alternatives: [], speechStartMs: null, speechEndMs: null,
        speechDurationMs: null, audioEnergyLevel: null,
        provider: 'google_chirp_v2', providerRequestId: 'p20f-sil3',
        processingLatencyMs: 0,
      },
      responseLatencyMs: null,
      silenceDurationMs: 5000,
      attemptCount: mem.currentItemAttemptCount,
      targetWord: mem.currentTargetItemId ?? TARGET_WORD,
      lessonTargetWords: [...LESSON_WORDS],
      unitReviewWords: [],
      characterNames: ['milo'],
      timestamp: new Date().toISOString(),
    });
    expect(result.classificationResult.label).not.toBe(ClassificationLabel.SOCIAL_SPEECH);
  });

  it('timeout fallback with isSilence=true + no transcript → SILENCE_LONG', () => {
    const silencePerception: PerceptionBundle = {
      ...makePerception('', 0.10),
      transcriptAvailable: false,
      normalizedTranscript: null,
      rawTranscript: null,
      textLowercased: '',
      isSilence: true,
      isShortSilence: false,
      isLongSilence: true,
      silenceDurationMs: 5000,
    };
    const result = computeTimeoutFallback(silencePerception, TARGET_WORD, 0);
    expect(result.label).toBe(ClassificationLabel.SILENCE_LONG);
  });
});

// ── G: Unit tests — silence_short recovery includes target word ───────────────

describe('Phase 20G: silence_short recovery includes target word', () => {
  it('silence_short recovery response contains target word', async () => {
    const mem = await advancePastReadiness('p20g-s1');
    const targetWord = mem.currentTargetItemId ?? TARGET_WORD;

    // Short silence (< 3s threshold)
    const result = await processKidsBrainTurn({
      sessionMemory: mem,
      sttResult: {
        text: null, confidence: null, languageCode: null,
        alternatives: [], speechStartMs: null, speechEndMs: null,
        speechDurationMs: null, audioEnergyLevel: null,
        provider: 'google_chirp_v2', providerRequestId: 'p20g-ss',
        processingLatencyMs: 0,
      },
      responseLatencyMs: null,
      silenceDurationMs: 1500,
      attemptCount: mem.currentItemAttemptCount,
      targetWord,
      lessonTargetWords: [...LESSON_WORDS],
      unitReviewWords: [],
      characterNames: ['milo'],
      timestamp: new Date().toISOString(),
    });

    const text = result.teacherResponsePlan.mainText.toLowerCase();
    expect(text).toContain(targetWord.toLowerCase());
    expect(text).not.toContain("hmm");
    expect(text).not.toContain("take your time");
    expect(text).not.toContain("i'm here");
  });
});
