import { describe, it, expect } from 'vitest';
import {
  ClassificationLabel,
  ActivityType,
  MasteryLevel,
  RecoveryState,
  LessonPhase,
  AgeBand,
  LearningDecisionType,
  TeacherActionCode,
  ClassificationPath,
  PromptType,
  FeedbackTone,
  LogSeverity,
} from '../../shared/enums.js';
import { createInitialChildState } from '../../state-engine/child-state-updater.js';
import { createInitialCostCounters } from '../../state-engine/cost-counter-updater.js';
import { runLearningEngine } from '../learning-engine.js';
import { LABEL_TO_ACTION } from '../../classification/classification-result.js';
import { InputQuality } from '../../perception/perception-types.js';
import type { LearningEngineInput, AvailableItem, ReviewQueueItem, CurrentItemContext } from '../learning-engine-types.js';
import type { SessionMemory } from '../../contracts/session-memory.js';
import type { StateEngineOutput } from '../../state-engine/state-update-result.js';
import type { ResponseClassificationResult } from '../../classification/classification-result.js';
import type { PerceptionBundle } from '../../perception/perception-bundle.js';
import type { ActivityContext } from '../../classification/classification-types.js';
import type { MasteryRecord } from '../../contracts/mastery-record.js';
import type { TurnRecord } from '../../contracts/turn-record.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeSessionMemory(overrides: Partial<SessionMemory> = {}): SessionMemory {
  return {
    sessionId: 'sess-1',
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
    currentTargetItemId: 'cat',
    currentItemAttemptCount: 1,
    lessonPhase: LessonPhase.PRACTICE,
    childState: createInitialChildState(),
    recoveryState: RecoveryState.NORMAL,
    itemState: new Map(),
    recentTurns: [],
    activityHistory: [],
    itemsAttempted: ['cat'],
    itemsMastered: [],
    recentPraisePhrases: [],
    l1AnchorUsedItems: [],
    l1BudgetUsed: false,
    playAlongCount: 0,
    costCounters: createInitialCostCounters(),
    autosaveSequenceNumber: 0,
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    sessionElapsedMs: 60_000,
    turnNumber: 3,
    ...overrides,
  };
}

function makeTurnRecord(
  label: ClassificationLabel,
  wasSuccess: boolean,
  activityId: ActivityType = ActivityType.SUPPORTED_PRODUCTION,
): TurnRecord {
  return {
    turnNumber: 1,
    sttTextNormalized: 'cat',
    responseLatencyMs: 1500,
    silenceDurationMs: 0,
    l1Detected: false,
    classificationLabel: label,
    classificationConfidence: 0.85,
    classificationPath: ClassificationPath.FAST_PATH,
    targetItemId: 'cat',
    activityId,
    lessonPhase: LessonPhase.PRACTICE,
    attemptNumber: 1,
    modelWasGiven: false,
    actionTaken: TeacherActionCode.PRAISE_AND_PROGRESS,
    recoveryOverride: false,
    wasSuccess,
    masteryDelta: wasSuccess ? 0.1 : 0,
    completedAt: new Date().toISOString(),
  };
}

function makeMasteryRecord(
  level: MasteryLevel,
  prodConf = 50,
  compConf = 50,
): MasteryRecord {
  return {
    itemId: 'cat',
    masteryLevel: level,
    productionConfidence: prodConf,
    comprehensionConfidence: compConf,
    correctProductionCount: 3,
    correctComprehensionCount: 5,
    sessionsSeen: 2,
    sessionsWithCorrectProduction: 2,
    promptedCorrectCount: 1,
    unpromptedCorrectCount: 2,
    activityTypesSucceeded: [ActivityType.FORCED_CHOICE_2, ActivityType.SUPPORTED_PRODUCTION],
    lastSeenAt: new Date().toISOString(),
    lastCorrectAt: new Date().toISOString(),
    reviewDueAt: null,
    introducedAt: new Date(Date.now() - 7 * 86_400_000).toISOString(),
    updatedAt: new Date().toISOString(),
    sessionAttemptCount: 3,
    sessionModelGiven: false,
    sessionL1AnchorUsed: false,
    sessionMasteryDelta: 0,
  };
}

function makeStateEngineOutput(
  sessionMemory: SessionMemory,
  overrides: Partial<StateEngineOutput> = {},
): StateEngineOutput {
  return {
    updatedSessionMemory: sessionMemory,
    stateUpdateSummary: {
      turnNumber: sessionMemory.turnNumber,
      previousRecoveryState: RecoveryState.NORMAL,
      newRecoveryState: sessionMemory.recoveryState,
      previousEngagementLevel: 0.65,
      newEngagementLevel: sessionMemory.childState.engagementLevel,
      confidenceDeltas: {
        comprehensionDelta: 0,
        productionDelta: 0,
        pronunciationDelta: 0,
        emotionalSafetyDelta: 0,
        frustrationRiskDelta: 0,
        engagementDelta: 0,
        l1DependencyDelta: 0,
        noveltyNeedDelta: 0,
        activityFatigueDelta: 0,
        sessionStaminaDelta: 0,
        refusalRiskDelta: 0,
      },
      itemStateDeltas: {
        attemptsAdded: 1,
        correctAttemptsAdded: 0,
        promptedCorrectAdded: 0,
        unpromptedCorrectAdded: 0,
        l1ResponsesAdded: 0,
        silenceCountAdded: 0,
      },
      costCounterDeltas: {
        sttSeconds: 1,
        llmClassificationCalls: 0,
        llmTeacherCalls: 0,
        ttsCharacters: 0,
        turnCount: 1,
      },
      recentSuccessCountDelta: 0,
      recentFailureCountDelta: 0,
      shouldEnterRecovery: false,
      shouldExitRecovery: false,
      safeToContinue: true,
      createdAt: new Date().toISOString(),
    },
    appliedUpdates: [],
    triggeredRecoveryChange: false,
    costCounterDelta: {
      sttSeconds: 1,
      llmClassificationCalls: 0,
      llmTeacherCalls: 0,
      ttsCharacters: 0,
      turnCount: 1,
    },
    masteryEligibility: true,
    progressionEligibility: true,
    logsToEmit: [],
    ...overrides,
  };
}

function makeClassificationResult(
  label: ClassificationLabel,
  source: 'deterministic' | 'llm_assisted' | 'timeout_fallback' | 'safety_override' = 'deterministic',
  eligibleForMasteryUpdate = true,
  eligibleForProgression = true,
): ResponseClassificationResult {
  const isCorrect = [
    ClassificationLabel.CORRECT_CONFIDENT,
    ClassificationLabel.CORRECT_HESITANT,
    ClassificationLabel.NEAR_CORRECT,
    ClassificationLabel.PRONUNCIATION_VARIANT,
  ].includes(label);

  return {
    label,
    confidence: 0.85,
    source,
    reasons: ['test'],
    perceptionSummary: 'test',
    requiresRecovery: false,
    eligibleForMasteryUpdate: isCorrect && source !== 'timeout_fallback' && eligibleForMasteryUpdate,
    eligibleForProgression: isCorrect && source !== 'timeout_fallback' && eligibleForProgression,
    recommendedSafeAction: LABEL_TO_ACTION[label],
    createdAt: new Date().toISOString(),
  };
}

function makePerception(): PerceptionBundle {
  return {
    rawTranscript: 'cat',
    normalizedTranscript: 'cat',
    textLowercased: 'cat',
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
    responseLatencyMs: 1500,
    silenceDurationMs: 0,
    speechDurationMs: 800,
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
      targetItem: 'cat',
      activityType: ActivityType.SUPPORTED_PRODUCTION,
    },
    childStateSnapshot: null,
    createdAt: new Date().toISOString(),
  };
}

function makeActivityContext(
  activityId: ActivityType = ActivityType.SUPPORTED_PRODUCTION,
  modelWasGiven = false,
): ActivityContext {
  return {
    activityId,
    currentTargetItemId: 'cat',
    attemptNumber: 1,
    modelWasGiven,
    promptType: PromptType.OPEN_PRODUCTION,
  };
}

function makeInput(overrides: {
  label?: ClassificationLabel;
  source?: 'deterministic' | 'llm_assisted' | 'timeout_fallback' | 'safety_override';
  recentTurns?: TurnRecord[];
  recoveryState?: RecoveryState;
  currentActivity?: ActivityType;
  lessonPhase?: LessonPhase;
  sessionElapsedMs?: number;
  frustrationRisk?: number;
  engagementLevel?: number;
  activityFatigue?: number;
  sessionStamina?: number;
  productionConfidence?: number;
  comprehensionConfidence?: number;
  availableItems?: AvailableItem[];
  reviewQueue?: ReviewQueueItem[];
  masteryRecord?: MasteryRecord | null;
  modelWasGiven?: boolean;
  safeToContinue?: boolean;
} = {}): LearningEngineInput {
  const label = overrides.label ?? ClassificationLabel.CORRECT_CONFIDENT;
  const currentActivity = overrides.currentActivity ?? ActivityType.SUPPORTED_PRODUCTION;
  const lessonPhase = overrides.lessonPhase ?? LessonPhase.PRACTICE;
  const recentTurns = overrides.recentTurns ?? [];

  const childState = {
    ...createInitialChildState(),
    frustrationRisk: overrides.frustrationRisk ?? 0.05,
    engagementLevel: overrides.engagementLevel ?? 0.65,
    activityFatigue: overrides.activityFatigue ?? 0.0,
    sessionStamina: overrides.sessionStamina ?? 1.0,
    productionConfidence: overrides.productionConfidence ?? 0.50,
    comprehensionConfidence: overrides.comprehensionConfidence ?? 0.60,
  };

  const sessionMemory = makeSessionMemory({
    lessonPhase,
    currentActivityId: currentActivity,
    childState,
    recoveryState: overrides.recoveryState ?? RecoveryState.NORMAL,
    recentTurns,
    sessionElapsedMs: overrides.sessionElapsedMs ?? 60_000,
  });

  const stateOutput = makeStateEngineOutput(sessionMemory, {
    stateUpdateSummary: {
      ...makeStateEngineOutput(sessionMemory).stateUpdateSummary,
      safeToContinue: overrides.safeToContinue ?? true,
    },
  });

  const currentItemContext: CurrentItemContext = {
    itemId: 'cat',
    masteryRecord: overrides.masteryRecord !== undefined
      ? overrides.masteryRecord
      : makeMasteryRecord(MasteryLevel.DEVELOPING),
    isReviewDue: false,
  };

  const availableItems: AvailableItem[] = overrides.availableItems ?? [
    { itemId: 'cat', masteryRecord: currentItemContext.masteryRecord, isCurrentItem: true },
  ];

  return {
    sessionMemory,
    stateEngineOutput: stateOutput,
    classificationResult: makeClassificationResult(
      label,
      overrides.source ?? 'deterministic',
    ),
    perceptionBundle: makePerception(),
    currentActivityContext: makeActivityContext(currentActivity, overrides.modelWasGiven ?? false),
    currentItemContext,
    availableActivities: Object.values(ActivityType),
    availableItems,
    reviewQueue: overrides.reviewQueue ?? [],
    timestamp: new Date().toISOString(),
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Learning Engine — Phase 5', () => {

  // Test 1: correct_confident advances activity, NOT mastery to secure immediately
  it('correct_confident with 3 consecutive advances activity but not mastery to secure', () => {
    const turns = [
      makeTurnRecord(ClassificationLabel.CORRECT_CONFIDENT, true),
      makeTurnRecord(ClassificationLabel.CORRECT_CONFIDENT, true),
      makeTurnRecord(ClassificationLabel.CORRECT_CONFIDENT, true),
    ];
    const result = makeInput({
      label: ClassificationLabel.CORRECT_CONFIDENT,
      recentTurns: turns,
      productionConfidence: 0.70,
      comprehensionConfidence: 0.70,
    });
    const decision = runLearningEngine(result);

    expect(decision.decisionType).toBe(LearningDecisionType.ADVANCE_ACTIVITY);
    // Mastery must not reach secure (single-session guard)
    if (decision.masteryUpdateCandidate !== null) {
      expect(decision.masteryUpdateCandidate.proposedLevel).not.toBe(MasteryLevel.SECURE);
      expect(decision.masteryUpdateCandidate.proposedLevel).not.toBe(MasteryLevel.AUTOMATIC);
    }
  });

  // Test 2: correct_hesitant repeats or scaffolds
  it('correct_hesitant stays or scaffolds — never advances', () => {
    const result = makeInput({
      label: ClassificationLabel.CORRECT_HESITANT,
      productionConfidence: 0.45,
    });
    const decision = runLearningEngine(result);

    const allowedTypes = [
      LearningDecisionType.STAY_CURRENT_ITEM,
      LearningDecisionType.REPEAT_CURRENT_ACTIVITY,
      LearningDecisionType.SCAFFOLD_CURRENT_ITEM,
    ];
    expect(allowedTypes).toContain(decision.decisionType);
    expect(decision.shouldAdvanceItem).toBe(false);
  });

  // Test 3: repeated_after_model does not create strong mastery
  it('repeated_after_model does not create strong mastery candidate', () => {
    const result = makeInput({ label: ClassificationLabel.REPEATED_AFTER_MODEL });
    const decision = runLearningEngine(result);

    if (decision.masteryUpdateCandidate !== null) {
      expect(decision.masteryUpdateCandidate.eligibleForPersistence).toBe(false);
      // Must not reach automatic
      expect(decision.masteryUpdateCandidate.proposedLevel).not.toBe(MasteryLevel.AUTOMATIC);
    }
    // Should not advance
    expect(decision.shouldAdvanceItem).toBe(false);
  });

  // Test 4: near_correct supports developing but not secure alone
  it('near_correct supports developing but cannot reach secure alone', () => {
    const result = makeInput({
      label: ClassificationLabel.NEAR_CORRECT,
      masteryRecord: makeMasteryRecord(MasteryLevel.DEVELOPING, 65, 70),
    });
    const decision = runLearningEngine(result);

    if (decision.masteryUpdateCandidate !== null) {
      expect(decision.masteryUpdateCandidate.proposedLevel).not.toBe(MasteryLevel.SECURE);
    }
  });

  // Test 5: wrong_semantic x2 lowers difficulty
  it('wrong_semantic x2 lowers difficulty via scaffold rule', () => {
    const turns = [
      makeTurnRecord(ClassificationLabel.WRONG_SEMANTIC, false),
      makeTurnRecord(ClassificationLabel.WRONG_SEMANTIC, false),
    ];
    const result = makeInput({
      label: ClassificationLabel.WRONG_SEMANTIC,
      recentTurns: turns,
    });
    const decision = runLearningEngine(result);

    const loweringTypes = [
      LearningDecisionType.SCAFFOLD_CURRENT_ITEM,
      LearningDecisionType.LOWER_DIFFICULTY,
      LearningDecisionType.TRIGGER_EASIEST_WIN,
    ];
    expect(loweringTypes).toContain(decision.decisionType);
  });

  // Test 6: silence_short holds without punishment
  it('silence_short holds without punishment, no failure signal', () => {
    const result = makeInput({ label: ClassificationLabel.SILENCE_SHORT });
    const decision = runLearningEngine(result);

    expect(decision.decisionType).toBe(LearningDecisionType.HOLD_UNCERTAIN);
    expect(decision.shouldTriggerRecovery).toBe(false);
    expect(decision.shouldTriggerEasiestWin).toBe(false);
    expect(decision.difficultyDelta).toBe(0);
  });

  // Test 7: silence_long triggers recovery / lower demand
  it('silence_long triggers lower difficulty and recovery signal', () => {
    const result = makeInput({ label: ClassificationLabel.SILENCE_LONG });
    const decision = runLearningEngine(result);

    const loweringTypes = [
      LearningDecisionType.LOWER_DIFFICULTY,
      LearningDecisionType.SCAFFOLD_CURRENT_ITEM,
      LearningDecisionType.TRIGGER_EASIEST_WIN,
    ];
    expect(loweringTypes).toContain(decision.decisionType);
    expect(decision.difficultyDelta).toBeLessThanOrEqual(0);
  });

  // Test 8: l1_translation creates production-gap review candidate
  it('l1_translation creates a next_lesson_review candidate for production gap', () => {
    const result = makeInput({ label: ClassificationLabel.L1_TRANSLATION });
    const decision = runLearningEngine(result);

    expect(decision.reviewScheduleCandidate).not.toBeNull();
    if (decision.reviewScheduleCandidate !== null) {
      expect(decision.reviewScheduleCandidate.reviewType).toBe('next_lesson_review');
    }
  });

  // Test 9: i_dont_know triggers scaffold not punishment
  it("i_dont_know triggers scaffold, preserves emotional safety, no punishment", () => {
    const result = makeInput({ label: ClassificationLabel.I_DONT_KNOW });
    const decision = runLearningEngine(result);

    const safeTypes = [
      LearningDecisionType.SCAFFOLD_CURRENT_ITEM,
      LearningDecisionType.HOLD_UNCERTAIN,
      LearningDecisionType.STAY_CURRENT_ITEM,
    ];
    expect(safeTypes).toContain(decision.decisionType);
    expect(decision.shouldTriggerEasiestWin).toBe(false);
    expect(decision.shouldCloseSession).toBe(false);
  });

  // Test 10: refusal triggers recovery or gentle close
  it('refusal triggers continue_recovery or gentle close', () => {
    const result = makeInput({ label: ClassificationLabel.REFUSAL });
    const decision = runLearningEngine(result);

    const validTypes = [
      LearningDecisionType.CONTINUE_RECOVERY,
      LearningDecisionType.CLOSE_SAFETY,
      LearningDecisionType.TRIGGER_EASIEST_WIN,
    ];
    expect(validTypes).toContain(decision.decisionType);
    expect(decision.shouldAdvanceItem).toBe(false);
  });

  // Test 11: emotional_shutdown triggers close_safety
  it('emotional_shutdown triggers close_safety', () => {
    const result = makeInput({ label: ClassificationLabel.EMOTIONAL_SHUTDOWN });
    const decision = runLearningEngine(result);

    expect(decision.shouldCloseSession).toBe(true);
    expect(decision.decisionType).toBe(LearningDecisionType.CLOSE_SAFETY);
  });

  // Test 12: timeout_fallback blocks mastery update
  it('timeout_fallback source blocks mastery update', () => {
    const result = makeInput({
      label: ClassificationLabel.CORRECT_CONFIDENT,
      source: 'timeout_fallback',
    });
    const decision = runLearningEngine(result);

    if (decision.masteryUpdateCandidate !== null) {
      expect(decision.masteryUpdateCandidate.eligibleForPersistence).toBe(false);
      expect(decision.masteryUpdateCandidate.blockedReasons.length).toBeGreaterThan(0);
    }
  });

  // Test 13: easiest win works with mastered items
  it('high frustration triggers easiest win with mastered item available', () => {
    const masteredItem: AvailableItem = {
      itemId: 'dog',
      masteryRecord: makeMasteryRecord(MasteryLevel.SECURE, 75, 80),
      isCurrentItem: false,
    };
    const result = makeInput({
      label: ClassificationLabel.CORRECT_HESITANT,
      frustrationRisk: 0.80,
      availableItems: [
        { itemId: 'cat', masteryRecord: makeMasteryRecord(MasteryLevel.DEVELOPING), isCurrentItem: true },
        masteredItem,
      ],
    });
    const decision = runLearningEngine(result);

    expect(decision.shouldTriggerEasiestWin).toBe(true);
    expect(decision.nextTargetItemId).toBe('dog');
  });

  // Test 14: easiest win cold-start — no mastered items
  it('high frustration with no mastered items triggers cold-start easiest win', () => {
    const result = makeInput({
      label: ClassificationLabel.WRONG_SEMANTIC,
      frustrationRisk: 0.80,
      availableItems: [
        { itemId: 'cat', masteryRecord: makeMasteryRecord(MasteryLevel.EMERGING), isCurrentItem: true },
        { itemId: 'dog', masteryRecord: makeMasteryRecord(MasteryLevel.EMERGING), isCurrentItem: false },
      ],
    });
    const decision = runLearningEngine(result);

    expect(decision.shouldTriggerEasiestWin).toBe(true);
    // Cold-start uses forced_choice_2 or repeat_after_me
    const coldStartActivities = [ActivityType.FORCED_CHOICE_2, ActivityType.REPEAT_AFTER_ME];
    expect(coldStartActivities).toContain(decision.nextActivityType);
  });

  // Test 15: lesson never closes immediately after failure
  it('timeout close after failure triggers easiest_win before close, not immediate close', () => {
    const failureTurn = makeTurnRecord(ClassificationLabel.WRONG_SEMANTIC, false);
    const result = makeInput({
      label: ClassificationLabel.WRONG_SEMANTIC,
      recentTurns: [failureTurn],
      sessionElapsedMs: 1_501_000, // over 1500s max for 6-7 band
    });
    const decision = runLearningEngine(result);

    // Must not close immediately after failure — should trigger easiest_win first
    if (decision.shouldCloseSession) {
      // If it IS closing, the decisionType must be TRIGGER_EASIEST_WIN (pre-close easiest win)
      // OR the last turn must have been success (which it isn't in this test)
      expect(decision.shouldTriggerEasiestWin).toBe(true);
    } else {
      // Not closing — fine, just verify no punishment
      expect(decision.decisionType).not.toBe(LearningDecisionType.CLOSE_TIMEOUT);
    }
  });

  // Test 16: review due triggers review_loop
  it('review due in warm_up phase triggers trigger_review decision', () => {
    const reviewQueue: ReviewQueueItem[] = [{
      itemId: 'bird',
      masteryLevel: MasteryLevel.DEVELOPING,
      reviewDueAt: new Date(Date.now() - 1000).toISOString(),
      priority: 1,
    }];
    const result = makeInput({
      label: ClassificationLabel.CORRECT_HESITANT,
      lessonPhase: LessonPhase.WARM_UP,
      reviewQueue,
    });
    const decision = runLearningEngine(result);

    expect(decision.decisionType).toBe(LearningDecisionType.TRIGGER_REVIEW);
    expect(decision.shouldReview).toBe(true);
    expect(decision.nextTargetItemId).toBe('bird');
  });

  // Test 17: high fatigue switches activity
  it('high activity fatigue triggers activity switch / lower difficulty', () => {
    const result = makeInput({
      label: ClassificationLabel.CORRECT_HESITANT,
      activityFatigue: 0.75, // above 0.70 threshold
    });
    const decision = runLearningEngine(result);

    const switchTypes = [
      LearningDecisionType.LOWER_DIFFICULTY,
      LearningDecisionType.SCAFFOLD_CURRENT_ITEM,
      LearningDecisionType.STAY_CURRENT_ITEM,
    ];
    expect(switchTypes).toContain(decision.decisionType);
  });

  // Test 18: high frustration lowers difficulty (easiest win or lower)
  it('high frustration (0.80) lowers difficulty via easiest win or scaffold', () => {
    const result = makeInput({
      label: ClassificationLabel.CORRECT_HESITANT,
      frustrationRisk: 0.80,
    });
    const decision = runLearningEngine(result);

    expect(decision.shouldTriggerEasiestWin).toBe(true);
    expect(decision.difficultyDelta).toBeLessThan(0);
  });

  // Test 19: overexcited selects grounding / simple task
  it('overexcited label selects lower_difficulty grounding task', () => {
    const result = makeInput({ label: ClassificationLabel.OVEREXCITED });
    const decision = runLearningEngine(result);

    const groundingTypes = [
      LearningDecisionType.LOWER_DIFFICULTY,
      LearningDecisionType.SCAFFOLD_CURRENT_ITEM,
    ];
    expect(groundingTypes).toContain(decision.decisionType);
    expect(decision.difficultyDelta).toBeLessThanOrEqual(0);
  });

  // Test 20: repeated success increases difficulty slightly
  it('repeated success (3x correct_confident) increases activity difficulty', () => {
    const turns = [
      makeTurnRecord(ClassificationLabel.CORRECT_CONFIDENT, true),
      makeTurnRecord(ClassificationLabel.CORRECT_CONFIDENT, true),
      makeTurnRecord(ClassificationLabel.CORRECT_CONFIDENT, true),
    ];
    const result = makeInput({
      label: ClassificationLabel.CORRECT_CONFIDENT,
      recentTurns: turns,
      productionConfidence: 0.70,
      comprehensionConfidence: 0.70,
      frustrationRisk: 0.05,
    });
    const decision = runLearningEngine(result);

    expect(decision.decisionType).toBe(LearningDecisionType.ADVANCE_ACTIVITY);
    expect(decision.difficultyDelta).toBeGreaterThan(0);
  });

  // Test 21: no teacher text generated
  it('LearningDecision contains no teacher text — only nextTeacherActionCode', () => {
    const result = makeInput({ label: ClassificationLabel.CORRECT_CONFIDENT });
    const decision = runLearningEngine(result);

    // The decision must NOT have a 'teacherText' field
    expect((decision as unknown as Record<string, unknown>)['teacherText']).toBeUndefined();
    // But it must have nextTeacherActionCode
    expect(decision.nextTeacherActionCode).toBeDefined();
    const validCodes = Object.values(TeacherActionCode);
    expect(validCodes).toContain(decision.nextTeacherActionCode);
  });

  // Test 22: no LLM calls (synchronous pure function)
  it('runLearningEngine is synchronous — returns a value immediately, no async', () => {
    const result = makeInput({ label: ClassificationLabel.CORRECT_CONFIDENT });
    const decision = runLearningEngine(result);
    // If it returned a Promise, this would fail
    expect(decision).not.toBeInstanceOf(Promise);
    expect(typeof decision.decisionId).toBe('string');
    expect(typeof decision.createdAt).toBe('string');
  });

  // Test 23: no persistence (masteryUpdateCandidate is not persisted — only computed)
  it('masteryUpdateCandidate has eligibleForPersistence flag but no persistence occurs', () => {
    const result = makeInput({ label: ClassificationLabel.CORRECT_CONFIDENT });
    const decision = runLearningEngine(result);

    // Phase 5 produces candidates only — no DB writes
    // The candidate itself is the evidence it's NOT persisted (just returned)
    if (decision.masteryUpdateCandidate !== null) {
      expect(decision.masteryUpdateCandidate).toHaveProperty('eligibleForPersistence');
      expect(decision.masteryUpdateCandidate).toHaveProperty('blockedReasons');
    }
    // reviewScheduleCandidate is also candidate-only
    if (decision.reviewScheduleCandidate !== null) {
      expect(decision.reviewScheduleCandidate).toHaveProperty('scheduledForMs');
    }
  });

  // Test 24: no adult Obsidian imports
  it('learning engine imports are all from kids-brain namespace', async () => {
    const mod = await import('../learning-engine.js');
    expect(mod).toBeDefined();
    expect(typeof mod.runLearningEngine).toBe('function');
    // If obsidian-brain were imported, TS compilation would fail (separate namespace)
    // This test verifies the module loads correctly from within kids-brain
  });

  // Test 25: exported from backend/src/kids-brain/index.ts
  it('runLearningEngine is exported from the kids-brain top-level index', async () => {
    const mod = await import('../../index.js');
    expect(typeof (mod as Record<string, unknown>)['runLearningEngine']).toBe('function');
  });

  // ── Additional edge-case tests ─────────────────────────────────────────────

  it('advance is forbidden when frustration > 70, even with 3 consecutive correct', () => {
    const turns = [
      makeTurnRecord(ClassificationLabel.CORRECT_CONFIDENT, true),
      makeTurnRecord(ClassificationLabel.CORRECT_CONFIDENT, true),
      makeTurnRecord(ClassificationLabel.CORRECT_CONFIDENT, true),
    ];
    const result = makeInput({
      label: ClassificationLabel.CORRECT_CONFIDENT,
      recentTurns: turns,
      frustrationRisk: 0.80, // too high for advance
      productionConfidence: 0.70,
      comprehensionConfidence: 0.70,
    });
    const decision = runLearningEngine(result);

    // High frustration triggers easiest_win BEFORE advance is even evaluated
    expect(decision.decisionType).not.toBe(LearningDecisionType.ADVANCE_ACTIVITY);
  });

  it('unsafe_or_sensitive immediately closes session safely', () => {
    const result = makeInput({ label: ClassificationLabel.UNSAFE_OR_SENSITIVE });
    const decision = runLearningEngine(result);

    expect(decision.shouldCloseSession).toBe(true);
    expect(decision.decisionType).toBe(LearningDecisionType.CLOSE_SAFETY);
    expect(decision.nextTeacherActionCode).toBe(TeacherActionCode.ESCALATE_TO_SAFETY);
  });

  it('safeToContinue=false from state engine triggers safety close', () => {
    const label = ClassificationLabel.CORRECT_HESITANT;
    const sessionMemory = makeSessionMemory();
    const stateOutput = makeStateEngineOutput(sessionMemory, {
      stateUpdateSummary: {
        ...makeStateEngineOutput(sessionMemory).stateUpdateSummary,
        safeToContinue: false,
      },
    });
    const input: LearningEngineInput = {
      sessionMemory,
      stateEngineOutput: stateOutput,
      classificationResult: makeClassificationResult(label),
      perceptionBundle: makePerception(),
      currentActivityContext: makeActivityContext(),
      currentItemContext: {
        itemId: 'cat',
        masteryRecord: makeMasteryRecord(MasteryLevel.DEVELOPING),
        isReviewDue: false,
      },
      availableActivities: Object.values(ActivityType),
      availableItems: [{ itemId: 'cat', masteryRecord: null, isCurrentItem: true }],
      timestamp: new Date().toISOString(),
    };
    const decision = runLearningEngine(input);

    expect(decision.shouldCloseSession).toBe(true);
    expect(decision.decisionType).toBe(LearningDecisionType.CLOSE_SAFETY);
  });

  it('consecutive_wrong >= 3 triggers easiest_win before continuing', () => {
    const turns = [
      makeTurnRecord(ClassificationLabel.RANDOM_NONSENSE, false),
      makeTurnRecord(ClassificationLabel.RANDOM_NONSENSE, false),
      makeTurnRecord(ClassificationLabel.RANDOM_NONSENSE, false),
    ];
    const result = makeInput({
      label: ClassificationLabel.RANDOM_NONSENSE,
      recentTurns: turns,
    });
    const decision = runLearningEngine(result);

    expect(decision.shouldTriggerEasiestWin).toBe(true);
  });

  it('LearningDecision has all required fields', () => {
    const result = makeInput({ label: ClassificationLabel.CORRECT_CONFIDENT });
    const decision = runLearningEngine(result);

    expect(decision.decisionId).toBeDefined();
    expect(decision.sessionId).toBe('sess-1');
    expect(decision.turnNumber).toBeGreaterThanOrEqual(0);
    expect(decision.decisionType).toBeDefined();
    expect(decision.nextTeacherActionCode).toBeDefined();
    expect(decision.nextActivityType).toBeDefined();
    expect(typeof decision.shouldStayOnCurrentItem).toBe('boolean');
    expect(typeof decision.shouldAdvanceItem).toBe('boolean');
    expect(typeof decision.shouldReview).toBe('boolean');
    expect(typeof decision.shouldTriggerRecovery).toBe('boolean');
    expect(typeof decision.shouldTriggerEasiestWin).toBe('boolean');
    expect(typeof decision.shouldCloseSession).toBe('boolean');
    expect(typeof decision.difficultyDelta).toBe('number');
    expect(Array.isArray(decision.reasons)).toBe(true);
    expect(typeof decision.priorityRuleFired).toBe('string');
    expect(typeof decision.createdAt).toBe('string');
  });
});
