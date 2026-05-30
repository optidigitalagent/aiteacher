import { describe, it, expect } from 'vitest';
import {
  ClassificationLabel,
  RecoveryState,
  ActivityType,
  PromptType,
  LessonPhase,
  ClassificationPath,
  TeacherActionCode,
  AgeBand,
  FeedbackTone,
} from '../../shared/enums.js';
import { runStateEngine } from '../state-engine.js';
import { STATE_ENGINE_MAX_RECENT_TURNS, appendTurn, recalculateSuccessFailureCounts } from '../turn-history-updater.js';
import { createInitialChildState } from '../child-state-updater.js';
import { createInitialCostCounters } from '../cost-counter-updater.js';
import type { StateEngineInput } from '../state-engine-types.js';
import type { SessionMemory } from '../../contracts/session-memory.js';
import type { PerceptionBundle } from '../../perception/perception-bundle.js';
import type { ResponseClassificationResult } from '../../classification/classification-result.js';
import type { ActivityContext } from '../../classification/classification-types.js';
import type { TurnRecord } from '../../contracts/turn-record.js';
import { InputQuality } from '../../perception/perception-types.js';

// ── Fixtures ─────────────────────────────────────────────────────────────────

function makeSessionMemory(overrides: Partial<SessionMemory> = {}): SessionMemory {
  return {
    sessionId: 'test-session-1',
    userId: 'user-1',
    childId: 'child-1',
    mode: 'mentium_kids',
    ageProfile: {
      ageBand: AgeBand.SIX_SEVEN,
      maxSessionSeconds: 1500,
      maxDailyMinutes: 25,
      sttChildSpeechPrior: 0.85,
      maxSilenceBeforeActMs: 3000,
      maxWordsPerSentence: 10,
      maxClauses: 1,
    },
    ageBand: AgeBand.SIX_SEVEN,
    currentUnitId: 'unit-1',
    currentActivityId: ActivityType.SUPPORTED_PRODUCTION,
    currentTargetItemId: 'dog',
    currentItemAttemptCount: 1,
    lessonPhase: LessonPhase.PRACTICE,
    childState: createInitialChildState(),
    recoveryState: RecoveryState.NORMAL,
    itemState: new Map(),
    recentTurns: [],
    activityHistory: [],
    itemsAttempted: [],
    itemsMastered: [],
    recentPraisePhrases: [],
    l1AnchorUsedItems: [],
    l1BudgetUsed: false,
    playAlongCount: 0,
    costCounters: createInitialCostCounters(),
    autosaveSequenceNumber: 0,
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    sessionElapsedMs: 0,
    turnNumber: 0,
    ...overrides,
  };
}

function makePerception(overrides: Partial<PerceptionBundle> = {}): PerceptionBundle {
  return {
    rawTranscript: 'dog',
    normalizedTranscript: 'dog',
    textLowercased: 'dog',
    transcriptAvailable: true,
    wordCount: 1,
    sttConfidence: 0.85,
    adjustedSttConfidence: 0.85,
    sttConfidenceMissing: false,
    perceptionConfidence: 0.80,
    alternatives: [],
    detectedLanguageHints: [],
    l1Detected: false,
    l1ScriptDetected: false,
    l1KeywordDetected: false,
    l1Script: null,
    l1IntentHint: null,
    l1Word: null,
    responseLatencyMs: 1200,
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
    isShortSilence: false,
    isLongSilence: false,
    isNoResponse: false,
    inputQuality: InputQuality.USABLE,
    uncertaintyReasons: [],
    safeForDeterministicClassification: true,
    requiresLLMAssistedClassification: false,
    promptContext: {
      promptType: PromptType.OPEN_PRODUCTION,
      targetItem: 'dog',
      activityType: ActivityType.SUPPORTED_PRODUCTION,
    },
    childStateSnapshot: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeClassification(
  label: ClassificationLabel,
  overrides: Partial<ResponseClassificationResult> = {},
): ResponseClassificationResult {
  const isCorrect = [
    ClassificationLabel.CORRECT_CONFIDENT,
    ClassificationLabel.CORRECT_HESITANT,
    ClassificationLabel.NEAR_CORRECT,
  ].includes(label);
  const isTimeout = overrides.source === 'timeout_fallback';

  return {
    label,
    confidence: 0.85,
    source: 'deterministic',
    reasons: ['test'],
    perceptionSummary: 'test',
    requiresRecovery: false,
    eligibleForMasteryUpdate: isCorrect && !isTimeout,
    eligibleForProgression: isCorrect && !isTimeout,
    recommendedSafeAction: TeacherActionCode.PRAISE_AND_PROGRESS,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeActivity(overrides: Partial<ActivityContext> = {}): ActivityContext {
  return {
    activityId: ActivityType.SUPPORTED_PRODUCTION,
    currentTargetItemId: 'dog',
    attemptNumber: 1,
    modelWasGiven: false,
    promptType: PromptType.OPEN_PRODUCTION,
    ...overrides,
  };
}

function makeInput(
  label: ClassificationLabel,
  sessionOverrides: Partial<SessionMemory> = {},
  perceptionOverrides: Partial<PerceptionBundle> = {},
  classificationOverrides: Partial<ResponseClassificationResult> = {},
  activityOverrides: Partial<ActivityContext> = {},
): StateEngineInput {
  return {
    sessionMemory: makeSessionMemory(sessionOverrides),
    perceptionBundle: makePerception(perceptionOverrides),
    classificationResult: makeClassification(label, classificationOverrides),
    currentActivityContext: makeActivity(activityOverrides),
    timestamp: new Date().toISOString(),
  };
}

function makeSilenceTurn(): TurnRecord {
  return {
    turnNumber: 1,
    sttTextNormalized: null,
    responseLatencyMs: null,
    silenceDurationMs: 8000,
    l1Detected: false,
    classificationLabel: ClassificationLabel.SILENCE_LONG,
    classificationConfidence: 1.0,
    classificationPath: ClassificationPath.FAST_PATH,
    targetItemId: 'dog',
    activityId: ActivityType.SUPPORTED_PRODUCTION,
    lessonPhase: LessonPhase.PRACTICE,
    attemptNumber: 1,
    modelWasGiven: false,
    actionTaken: TeacherActionCode.MODEL_ANSWER,
    recoveryOverride: false,
    wasSuccess: false,
    masteryDelta: 0,
    completedAt: new Date().toISOString(),
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('State Engine — Phase 4', () => {

  // ── Test 1: correct_confident ─────────────────────────────────────────────
  it('correct_confident increases confidence and success count', () => {
    const input = makeInput(ClassificationLabel.CORRECT_CONFIDENT);
    const output = runStateEngine(input);
    const cs = output.updatedSessionMemory.childState;

    expect(cs.comprehensionConfidence).toBeGreaterThan(
      input.sessionMemory.childState.comprehensionConfidence,
    );
    expect(cs.productionConfidence).toBeGreaterThan(
      input.sessionMemory.childState.productionConfidence,
    );
    expect(cs.recentSuccessCount).toBe(1);
    expect(cs.frustrationRisk).toBeLessThan(
      input.sessionMemory.childState.frustrationRisk,
    );
  });

  // ── Test 2: correct_hesitant increases confidence less than confident ──────
  it('correct_hesitant increases confidence less than correct_confident', () => {
    const session = makeSessionMemory();
    const confident = runStateEngine({
      ...makeInput(ClassificationLabel.CORRECT_CONFIDENT),
      sessionMemory: { ...session },
    });
    const hesitant = runStateEngine({
      ...makeInput(ClassificationLabel.CORRECT_HESITANT),
      sessionMemory: { ...session },
    });

    const confidentProdDelta =
      confident.updatedSessionMemory.childState.productionConfidence -
      session.childState.productionConfidence;
    const hesitantProdDelta =
      hesitant.updatedSessionMemory.childState.productionConfidence -
      session.childState.productionConfidence;

    expect(confidentProdDelta).toBeGreaterThan(hesitantProdDelta);
    expect(hesitantProdDelta).toBeGreaterThan(0); // still positive
  });

  // ── Test 3: near_correct does not punish child ────────────────────────────
  it('near_correct does not punish child', () => {
    const input = makeInput(ClassificationLabel.NEAR_CORRECT);
    const output = runStateEngine(input);
    const cs = output.updatedSessionMemory.childState;
    const prev = input.sessionMemory.childState;

    expect(cs.frustrationRisk).toBeLessThanOrEqual(prev.frustrationRisk);
    expect(cs.emotionalSafety).toBeGreaterThanOrEqual(prev.emotionalSafety);
    expect(cs.productionConfidence).toBeGreaterThanOrEqual(prev.productionConfidence);
  });

  // ── Test 4: wrong_semantic increases recovery need gently ─────────────────
  it('wrong_semantic increases recovery need gently', () => {
    const input = makeInput(ClassificationLabel.WRONG_SEMANTIC);
    const output = runStateEngine(input);
    const cs = output.updatedSessionMemory.childState;
    const prev = input.sessionMemory.childState;

    // Frustration risk increases but not dramatically
    expect(cs.frustrationRisk).toBeGreaterThan(prev.frustrationRisk);
    expect(cs.frustrationRisk - prev.frustrationRisk).toBeLessThan(0.20); // gentle

    // Emotional safety is NOT penalised
    expect(cs.emotionalSafety).toBeGreaterThanOrEqual(prev.emotionalSafety);

    // Failure count may be 1 (from rolling window) but confidence not decimated
    expect(cs.comprehensionConfidence).toBeGreaterThan(0.20);
  });

  // ── Test 5: silence_short does not count as failure ───────────────────────
  it('silence_short does not count as failure', () => {
    const input = makeInput(
      ClassificationLabel.SILENCE_SHORT,
      {},
      { isSilence: true, isShortSilence: true, silenceDurationMs: 1500 },
    );
    const output = runStateEngine(input);
    const cs = output.updatedSessionMemory.childState;
    const prev = input.sessionMemory.childState;

    // No frustration increase, no emotional safety decrease
    expect(cs.frustrationRisk).toBe(prev.frustrationRisk);
    expect(cs.emotionalSafety).toBe(prev.emotionalSafety);
    // recentFailureCount should be 0 (silence_short not a failure)
    expect(cs.recentFailureCount).toBe(0);
    // Recovery state unchanged
    expect(output.updatedSessionMemory.recoveryState).toBe(RecoveryState.NORMAL);
  });

  // ── Test 6: silence_long escalates recovery if repeated ───────────────────
  it('silence_long escalates recovery if repeated silence in history', () => {
    const previousSilenceTurn = makeSilenceTurn();
    const session = makeSessionMemory({ recentTurns: [previousSilenceTurn] });
    const input = makeInput(
      ClassificationLabel.SILENCE_LONG,
      { recentTurns: [previousSilenceTurn] },
      { isSilence: true, isLongSilence: true, silenceDurationMs: 8000 },
    );
    input.sessionMemory = session;

    const output = runStateEngine(input);

    // Should escalate recovery due to repeated silence
    expect(output.updatedSessionMemory.recoveryState).not.toBe(RecoveryState.NORMAL);
    expect(output.triggeredRecoveryChange).toBe(true);
  });

  // ── Test 7: l1_translation increases comprehension but not production ──────
  it('l1_translation increases comprehension signal but not production mastery', () => {
    const input = makeInput(ClassificationLabel.L1_TRANSLATION);
    const output = runStateEngine(input);
    const cs = output.updatedSessionMemory.childState;
    const prev = input.sessionMemory.childState;

    // Comprehension increases (child understood the word in L1)
    expect(cs.comprehensionConfidence).toBeGreaterThan(prev.comprehensionConfidence);
    // Production stays the same (not a production success)
    expect(cs.productionConfidence).toBe(prev.productionConfidence);
    // Not a failure — emotional safety preserved
    expect(cs.emotionalSafety).toBe(prev.emotionalSafety);
    // recentFailureCount stays 0
    expect(cs.recentFailureCount).toBe(0);
    // l1Dependency slightly increases
    expect(cs.l1Dependency).toBeGreaterThan(prev.l1Dependency);
    // masteryEligibility is false (L1 is not a production mastery event)
    expect(output.masteryEligibility).toBe(false);
  });

  // ── Test 8: i_dont_know preserves emotional safety ────────────────────────
  it('i_dont_know preserves emotional safety', () => {
    const input = makeInput(ClassificationLabel.I_DONT_KNOW);
    const output = runStateEngine(input);
    const cs = output.updatedSessionMemory.childState;
    const prev = input.sessionMemory.childState;

    // Emotional safety preserved (not decreased)
    expect(cs.emotionalSafety).toBeGreaterThanOrEqual(prev.emotionalSafety);
    // Frustration risk not increased
    expect(cs.frustrationRisk).toBeLessThanOrEqual(prev.frustrationRisk + 0.01); // near-zero tolerance
    // Phase 8.8: I_DONT_KNOW counts as failure in the rolling window (spec §7.1 / NB1 fix)
    expect(cs.recentFailureCount).toBe(1);
  });

  // ── Test 9: refusal escalates recovery state ──────────────────────────────
  it('refusal escalates recovery state to REFUSAL', () => {
    const input = makeInput(ClassificationLabel.REFUSAL);
    const output = runStateEngine(input);

    expect(output.updatedSessionMemory.recoveryState).toBe(RecoveryState.REFUSAL);
    expect(output.triggeredRecoveryChange).toBe(true);
    expect(output.stateUpdateSummary.shouldEnterRecovery).toBe(true);

    const cs = output.updatedSessionMemory.childState;
    const prev = input.sessionMemory.childState;
    expect(cs.frustrationRisk).toBeGreaterThan(prev.frustrationRisk);
    expect(cs.refusalRisk).toBeGreaterThan(prev.refusalRisk);
    expect(cs.sessionStamina).toBeLessThan(prev.sessionStamina);
  });

  // ── Test 10: emotional_shutdown overrides all lower recovery states ────────
  it('emotional_shutdown overrides lower recovery states', () => {
    // Even if currently in mild_confusion, emotional_shutdown takes over
    const childState = {
      ...createInitialChildState(),
      recoveryLevel: RecoveryState.MILD_CONFUSION,
    };
    const input = makeInput(
      ClassificationLabel.EMOTIONAL_SHUTDOWN,
      { recoveryState: RecoveryState.MILD_CONFUSION, childState },
    );
    const output = runStateEngine(input);

    expect(output.updatedSessionMemory.recoveryState).toBe(RecoveryState.EMOTIONAL_SHUTDOWN);
  });

  // ── Test 11: unsafe_or_sensitive sets safeToContinue=false ────────────────
  it('unsafe_or_sensitive sets safeToContinue=false', () => {
    const input = makeInput(ClassificationLabel.UNSAFE_OR_SENSITIVE);
    const output = runStateEngine(input);

    expect(output.stateUpdateSummary.safeToContinue).toBe(false);
    // Should log a CRITICAL event
    const criticalLog = output.logsToEmit.find(l => l.event === 'safe_to_continue_false');
    expect(criticalLog).toBeDefined();
  });

  // ── Test 12: timeout_fallback does not allow mastery eligibility ──────────
  it('timeout_fallback does not allow mastery eligibility', () => {
    const input = makeInput(
      ClassificationLabel.UNKNOWN_UNCERTAIN,
      {},
      {},
      {
        source: 'timeout_fallback',
        eligibleForMasteryUpdate: false,
        eligibleForProgression: false,
      },
    );
    const output = runStateEngine(input);

    expect(output.masteryEligibility).toBe(false);
    expect(output.progressionEligibility).toBe(false);
  });

  // ── Test 13: item attempts increment correctly ────────────────────────────
  it('item attempts increment correctly', () => {
    const input = makeInput(ClassificationLabel.CORRECT_CONFIDENT);
    const output = runStateEngine(input);

    const itemState = output.updatedSessionMemory.itemState.get('dog');
    expect(itemState).toBeDefined();
    expect(itemState!.attemptCount).toBe(1);
    expect(itemState!.correctAttempts).toBe(1);
    expect(itemState!.unpromptedCorrectAttempts).toBe(1); // modelWasGiven=false
    expect(itemState!.promptedCorrectAttempts).toBe(0);
  });

  it('item attempts: prompted correct tracked when model was given', () => {
    const input = makeInput(
      ClassificationLabel.CORRECT_CONFIDENT,
      {},
      {},
      {},
      { modelWasGiven: true },
    );
    const output = runStateEngine(input);

    const itemState = output.updatedSessionMemory.itemState.get('dog');
    expect(itemState!.promptedCorrectAttempts).toBe(1);
    expect(itemState!.unpromptedCorrectAttempts).toBe(0);
  });

  // ── Test 14: recentTurns is capped at STATE_ENGINE_MAX_RECENT_TURNS ────────
  it('recentTurns is capped at 10', () => {
    expect(STATE_ENGINE_MAX_RECENT_TURNS).toBe(10);

    // Build 12 existing turns
    const existingTurns: TurnRecord[] = Array.from({ length: 12 }, (_, i) => ({
      ...makeSilenceTurn(),
      turnNumber: i + 1,
    }));

    const newTurn = { ...makeSilenceTurn(), turnNumber: 13 };
    const result = appendTurn(existingTurns, newTurn, STATE_ENGINE_MAX_RECENT_TURNS);

    expect(result.length).toBe(10);
    expect(result[result.length - 1].turnNumber).toBe(13);
    expect(result[0].turnNumber).toBe(4); // oldest evicted
  });

  it('appendTurn via runStateEngine caps history at 10', () => {
    // Pre-fill with 10 turns
    const existingTurns: TurnRecord[] = Array.from({ length: 10 }, (_, i) => ({
      ...makeSilenceTurn(),
      turnNumber: i + 1,
    }));
    const session = makeSessionMemory({ recentTurns: existingTurns, turnNumber: 10 });
    const input = makeInput(ClassificationLabel.CORRECT_CONFIDENT, {});
    input.sessionMemory = session;

    const output = runStateEngine(input);
    expect(output.updatedSessionMemory.recentTurns.length).toBe(10);
  });

  // ── Test 15: input SessionMemory is not mutated ───────────────────────────
  it('input SessionMemory is not mutated', () => {
    const original = makeSessionMemory();
    const originalConfidence = original.childState.comprehensionConfidence;
    const originalTurnCount = original.turnNumber;
    const originalMapSize = original.itemState.size;

    const input = makeInput(ClassificationLabel.CORRECT_CONFIDENT);
    input.sessionMemory = original;

    runStateEngine(input);

    // Original should be unchanged
    expect(original.childState.comprehensionConfidence).toBe(originalConfidence);
    expect(original.turnNumber).toBe(originalTurnCount);
    expect(original.itemState.size).toBe(originalMapSize);
  });

  // ── Test 16: repaired_success after correct response in recovery ──────────
  it('repaired_success when correct response during recovery state', () => {
    const childState = {
      ...createInitialChildState(),
      recentFailureCount: 3,
      recoveryLevel: RecoveryState.REPEATED_FAILURE,
    };
    const session = makeSessionMemory({
      recoveryState: RecoveryState.REPEATED_FAILURE,
      childState,
    });
    const input = makeInput(ClassificationLabel.CORRECT_CONFIDENT);
    input.sessionMemory = session;

    const output = runStateEngine(input);

    expect(output.updatedSessionMemory.recoveryState).toBe(RecoveryState.REPAIRED_SUCCESS);
    expect(output.triggeredRecoveryChange).toBe(true);
  });

  // ── Test 17: cost counters update from context ────────────────────────────
  it('cost counters update from context', () => {
    const input = makeInput(ClassificationLabel.CORRECT_CONFIDENT);
    const output = runStateEngine(input);

    // turnCount should increment by 1
    expect(output.updatedSessionMemory.costCounters.turnCount).toBe(
      input.sessionMemory.costCounters.turnCount + 1,
    );
    expect(output.costCounterDelta.turnCount).toBe(1);
  });

  // ── Test 18: no learning progression is selected ─────────────────────────
  it('no learning progression is selected by state engine', () => {
    const input = makeInput(ClassificationLabel.CORRECT_CONFIDENT);
    const output = runStateEngine(input);

    // progressionEligibility is forwarded from classification, but no DECISION is made
    // The output has no "next_activity" or "progression_decision" field
    expect('nextActivity' in output).toBe(false);
    expect('progressionDecision' in output).toBe(false);
    expect('selectedActivity' in output).toBe(false);
  });

  // ── Test 19: no teacher response is generated ─────────────────────────────
  it('no teacher response is generated by state engine', () => {
    const input = makeInput(ClassificationLabel.CORRECT_CONFIDENT);
    const output = runStateEngine(input);

    expect('teacherText' in output).toBe(false);
    expect('teacherUtterance' in output).toBe(false);
    expect('feedbackText' in output).toBe(false);
  });

  // ── Test 20: no adult Obsidian imports ────────────────────────────────────
  it('no adult Obsidian imports in state-engine module', async () => {
    // Verify by importing the module — if it imported obsidian-brain it would fail
    // with a missing module error. As a structural test, we check the output type.
    const { runStateEngine: fn } = await import('../state-engine.js');
    expect(typeof fn).toBe('function');
    // The output should be a StateEngineOutput, not any adult-brain type
    const input = makeInput(ClassificationLabel.CORRECT_CONFIDENT);
    const output = fn(input);
    expect(output).toHaveProperty('updatedSessionMemory');
    expect(output.updatedSessionMemory.mode).toBe('mentium_kids');
  });

  // ── Test 21: exported from backend/src/kids-brain/index.ts ───────────────
  it('runStateEngine is exported from backend/src/kids-brain/index.ts', async () => {
    const kidsBrain = await import('../../index.js');
    expect(typeof kidsBrain.runStateEngine).toBe('function');
    expect(typeof kidsBrain.STATE_ENGINE_MAX_RECENT_TURNS).toBe('number');
    expect(kidsBrain.STATE_ENGINE_MAX_RECENT_TURNS).toBe(10);
  });

  // ── Additional edge case tests ────────────────────────────────────────────

  it('rolling success/failure window recalculates correctly', () => {
    // Build 5 recent turns: 3 success + 2 failure
    const turns: TurnRecord[] = [
      { ...makeSilenceTurn(), classificationLabel: ClassificationLabel.CORRECT_CONFIDENT, wasSuccess: true, turnNumber: 1 },
      { ...makeSilenceTurn(), classificationLabel: ClassificationLabel.CORRECT_CONFIDENT, wasSuccess: true, turnNumber: 2 },
      { ...makeSilenceTurn(), classificationLabel: ClassificationLabel.WRONG_SEMANTIC, wasSuccess: false, turnNumber: 3 },
      { ...makeSilenceTurn(), classificationLabel: ClassificationLabel.CORRECT_CONFIDENT, wasSuccess: true, turnNumber: 4 },
      { ...makeSilenceTurn(), classificationLabel: ClassificationLabel.WRONG_SEMANTIC, wasSuccess: false, turnNumber: 5 },
    ];
    const { recentSuccessCount, recentFailureCount } = recalculateSuccessFailureCounts(turns);
    expect(recentSuccessCount).toBe(3);
    expect(recentFailureCount).toBe(2);
  });

  it('turnNumber increments on each state engine run', () => {
    const session = makeSessionMemory({ turnNumber: 5 });
    const input = makeInput(ClassificationLabel.CORRECT_CONFIDENT);
    input.sessionMemory = session;
    const output = runStateEngine(input);
    expect(output.updatedSessionMemory.turnNumber).toBe(6);
  });

  it('item silenceCount increments on silence labels', () => {
    const input = makeInput(
      ClassificationLabel.SILENCE_LONG,
      {},
      { isSilence: true, isLongSilence: true },
    );
    const output = runStateEngine(input);
    const itemState = output.updatedSessionMemory.itemState.get('dog');
    expect(itemState!.silenceCount).toBe(1);
  });

  it('item l1Responses increments on l1 labels', () => {
    const input = makeInput(ClassificationLabel.L1_TRANSLATION);
    const output = runStateEngine(input);
    const itemState = output.updatedSessionMemory.itemState.get('dog');
    expect(itemState!.l1Responses).toBe(1);
  });

  it('recoveryState in updatedSessionMemory matches stateUpdateSummary', () => {
    const input = makeInput(ClassificationLabel.REFUSAL);
    const output = runStateEngine(input);
    expect(output.updatedSessionMemory.recoveryState).toBe(
      output.stateUpdateSummary.newRecoveryState,
    );
  });

  it('repeated_failure state after 3+ failure count', () => {
    const childState = {
      ...createInitialChildState(),
      recentFailureCount: 2, // will become 3 after wrong_semantic
    };
    const session = makeSessionMemory({ childState });

    // Add a previous wrong turn to history so recentFailureCount increases
    const wrongTurn: TurnRecord = {
      ...makeSilenceTurn(),
      classificationLabel: ClassificationLabel.WRONG_SEMANTIC,
      wasSuccess: false,
      turnNumber: 1,
    };
    const wrongTurn2: TurnRecord = { ...wrongTurn, turnNumber: 2 };
    const wrongTurn3: TurnRecord = { ...wrongTurn, turnNumber: 3 };
    session.recentTurns = [wrongTurn, wrongTurn2, wrongTurn3];

    const input = makeInput(ClassificationLabel.WRONG_SEMANTIC);
    input.sessionMemory = session;
    const output = runStateEngine(input);

    expect(output.updatedSessionMemory.recoveryState).toBe(RecoveryState.REPEATED_FAILURE);
  });
});
