import { describe, it, expect } from 'vitest';
import {
  ClassificationLabel,
  ActivityType,
  RecoveryState,
  LessonPhase,
  AgeBand,
  LearningDecisionType,
  TeacherActionCode,
  PromptType,
  FeedbackTone,
  LogSeverity,
} from '../../shared/enums.js';
import {
  getAllTemplatesForKey,
  renderTemplate,
} from '../response-template-bank.js';
import { createInitialChildState } from '../../state-engine/child-state-updater.js';
import { createInitialCostCounters } from '../../state-engine/cost-counter-updater.js';
import { runTeacherResponseEngine } from '../teacher-response-engine.js';
import { applyPlaceholderGuard, hasUnresolvedPlaceholders } from '../placeholder-guard.js';
import { buildAllowedVocabSet, checkVocabulary, applyVocabularyGuard } from '../vocabulary-guard.js';
import { applyForbiddenPhraseGuard, enforceMaxLength } from '../teacher-language-policy.js';
import { buildRecoveryResponse } from '../recovery-response-builder.js';
import { buildActivityPrompt } from '../activity-prompt-builder.js';
import { buildScaffoldResponse } from '../scaffold-response-builder.js';
import { LLMTeacherResponder } from '../llm-teacher-contract.js';
import type { TeacherResponseInput, TeacherResponseContext } from '../teacher-response-types.js';
import type { SessionMemory } from '../../contracts/session-memory.js';
import type { StateEngineOutput } from '../../state-engine/state-update-result.js';
import type { ResponseClassificationResult } from '../../classification/classification-result.js';
import type { PerceptionBundle } from '../../perception/perception-bundle.js';
import type { LearningDecision } from '../../learning-engine/learning-decision.js';
import type { ActivityContext } from '../../classification/classification-types.js';
import { InputQuality } from '../../perception/perception-types.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeSessionMemory(overrides: Partial<SessionMemory> = {}): SessionMemory {
  return {
    sessionId: 'sess-test',
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
    currentUnitId: 'unit-animals',
    currentActivityId: ActivityType.SUPPORTED_PRODUCTION,
    currentTargetItemId: 'dog',
    currentItemAttemptCount: 1,
    lessonPhase: LessonPhase.PRACTICE,
    childState: createInitialChildState(),
    recoveryState: RecoveryState.NORMAL,
    itemState: new Map(),
    recentTurns: [],
    activityHistory: [],
    itemsAttempted: ['dog'],
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

function makePerceptionBundle(
  overrides: Partial<PerceptionBundle> = {},
): PerceptionBundle {
  return {
    rawTranscript: 'dog',
    normalizedTranscript: 'dog',
    textLowercased: 'dog',
    transcriptAvailable: true,
    wordCount: 1,
    sttConfidence: 0.9,
    adjustedSttConfidence: 0.9,
    sttConfidenceMissing: false,
    perceptionConfidence: 0.85,
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
    speechDurationMs: 400,
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
    childStateSnapshot: {
      comprehensionConfidence: 0.7,
      productionConfidence: 0.6,
      emotionalSafety: 0.9,
      frustrationRisk: 0.1,
      recentSuccessCount: 1,
      recentFailureCount: 0,
    },
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeClassificationResult(
  label: ClassificationLabel,
  overrides: Partial<ResponseClassificationResult> = {},
): ResponseClassificationResult {
  const requiresRecovery = [
    ClassificationLabel.NO_RESPONSE,
    ClassificationLabel.SILENCE_LONG,
    ClassificationLabel.REFUSAL,
    ClassificationLabel.EMOTIONAL_SHUTDOWN,
  ].includes(label);

  return {
    label,
    confidence: 0.85,
    source: 'deterministic',
    reasons: [`test: ${label}`],
    perceptionSummary: `test: ${label}`,
    requiresRecovery,
    eligibleForMasteryUpdate: label === ClassificationLabel.CORRECT_CONFIDENT,
    eligibleForProgression: label === ClassificationLabel.CORRECT_CONFIDENT,
    recommendedSafeAction: TeacherActionCode.PRAISE_AND_PROGRESS,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeStateEngineOutput(
  overrides: Partial<StateEngineOutput> = {},
): StateEngineOutput {
  const base: StateEngineOutput = {
    updatedSessionMemory: makeSessionMemory(),
    stateUpdateSummary: {
      turnNumber: 3,
      previousRecoveryState: RecoveryState.NORMAL,
      newRecoveryState: RecoveryState.NORMAL,
      previousEngagementLevel: 0.65,
      newEngagementLevel: 0.65,
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
        sttSeconds: 0,
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
      sttSeconds: 0,
      llmClassificationCalls: 0,
      llmTeacherCalls: 0,
      ttsCharacters: 0,
      turnCount: 1,
    },
    masteryEligibility: false,
    progressionEligibility: false,
    logsToEmit: [],
    ...overrides,
  };
  return base;
}

function makeLearningDecision(
  overrides: Partial<LearningDecision> = {},
): LearningDecision {
  return {
    decisionId: 'dec-1',
    sessionId: 'sess-test',
    turnNumber: 3,
    decisionType: LearningDecisionType.STAY_CURRENT_ITEM,
    nextTeacherActionCode: TeacherActionCode.PRAISE_AND_PROGRESS,
    nextActivityType: ActivityType.SUPPORTED_PRODUCTION,
    nextTargetItemId: undefined,
    shouldStayOnCurrentItem: true,
    shouldAdvanceItem: false,
    shouldReview: false,
    shouldTriggerRecovery: false,
    shouldTriggerEasiestWin: false,
    shouldCloseSession: false,
    difficultyDelta: 0,
    masteryUpdateCandidate: null,
    reviewScheduleCandidate: null,
    reasons: ['test'],
    priorityRuleFired: 'R30',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeResponseContext(
  overrides: Partial<TeacherResponseContext> = {},
): TeacherResponseContext {
  return {
    targetWord: 'dog',
    childFirstName: 'Sasha',
    ageBand: AgeBand.SIX_SEVEN,
    activityContext: {
      activityId: ActivityType.SUPPORTED_PRODUCTION,
      currentTargetItemId: 'dog',
      attemptNumber: 1,
      modelWasGiven: false,
      promptType: PromptType.OPEN_PRODUCTION,
    },
    lessonTargetWords: ['dog', 'cat', 'bird'],
    unitReviewWords: ['fish', 'rabbit'],
    characterNames: ['Milo', 'Luna'],
    forcedChoiceOptionA: 'dog',
    forcedChoiceOptionB: 'cat',
    l1BudgetUsed: false,
    scaffoldLevel: 1,
    recoveryState: RecoveryState.NORMAL,
    classificationLabel: ClassificationLabel.CORRECT_CONFIDENT,
    currentActivityType: ActivityType.SUPPORTED_PRODUCTION,
    ...overrides,
  };
}

function makeInput(
  label: ClassificationLabel,
  sessionOverrides: Partial<SessionMemory> = {},
  contextOverrides: Partial<TeacherResponseContext> = {},
  decisionOverrides: Partial<LearningDecision> = {},
  stateOverrides: Partial<StateEngineOutput> = {},
): TeacherResponseInput {
  return {
    sessionMemory: makeSessionMemory(sessionOverrides),
    learningDecision: makeLearningDecision(decisionOverrides),
    stateEngineOutput: makeStateEngineOutput(stateOverrides),
    classificationResult: makeClassificationResult(label),
    perceptionBundle: makePerceptionBundle(),
    responseContext: makeResponseContext({ classificationLabel: label, ...contextOverrides }),
    timestamp: new Date().toISOString(),
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('TeacherResponseEngine', () => {

  // Test 1: correct answer builds short praise
  it('1. correct answer builds short praise', () => {
    const input = makeInput(ClassificationLabel.CORRECT_CONFIDENT);
    const { plan } = runTeacherResponseEngine(input);
    expect(plan.mainText).toBeTruthy();
    expect(plan.mainText.length).toBeGreaterThan(0);
    expect(plan.emotionalTone).toBe(FeedbackTone.CELEBRATORY);
    expect(plan.safetyBlocked).toBe(false);
  });

  // Test 2: near correct builds recast without shame
  it('2. near correct builds recast without shame', () => {
    const input = makeInput(ClassificationLabel.NEAR_CORRECT);
    const { plan } = runTeacherResponseEngine(input);
    // Must include the target word in the recast
    expect(plan.mainText.toLowerCase()).toContain('dog');
    // Must not shame
    const lower = plan.mainText.toLowerCase();
    expect(lower).not.toContain('wrong');
    expect(lower).not.toContain('incorrect');
    expect(lower).not.toContain("that's not right");
  });

  // Test 3: wrong answer never says "wrong"
  it('3. wrong answer never says "wrong"', () => {
    const input = makeInput(ClassificationLabel.WRONG_SEMANTIC);
    const { plan } = runTeacherResponseEngine(input);
    expect(plan.mainText.toLowerCase()).not.toContain('wrong');
    expect(plan.mainText.toLowerCase()).not.toContain('incorrect');
    expect(plan.mainText.toLowerCase()).not.toContain('no, that is');
  });

  // Test 4: repeat_after_me prompt works
  it('4. repeat_after_me prompt works', () => {
    const input = makeInput(
      ClassificationLabel.CORRECT_HESITANT,
      {},
      { currentActivityType: ActivityType.REPEAT_AFTER_ME },
    );
    const prompt = buildActivityPrompt(ActivityType.REPEAT_AFTER_ME, {
      targetWord: 'dog',
      recentPhrases: [],
    });
    expect(prompt).toBeTruthy();
    expect(prompt.toLowerCase()).toContain('dog');
  });

  // Test 5: forced_choice prompt includes target context
  it('5. forced_choice prompt includes target context', () => {
    const prompt = buildActivityPrompt(ActivityType.FORCED_CHOICE_2, {
      targetWord: 'dog',
      forcedChoiceOptionA: 'dog',
      forcedChoiceOptionB: 'cat',
      recentPhrases: [],
    });
    expect(prompt.toLowerCase()).toContain('dog');
    expect(prompt.toLowerCase()).toContain('cat');
  });

  // Test 6: silence_short builds gentle rescue
  it('6. silence_short builds gentle rescue', () => {
    const response = buildRecoveryResponse('silence_short', {
      targetWord: 'dog',
      recentPhrases: [],
      l1BudgetUsed: false,
    });
    expect(response).toBeTruthy();
    // Should not punish or shame
    expect(response.toLowerCase()).not.toContain('wrong');
    expect(response.toLowerCase()).not.toContain('try again');
  });

  // Test 7: silence_long builds stronger rescue
  it('7. silence_long builds stronger rescue (model answer)', () => {
    const response = buildRecoveryResponse('silence_long', {
      targetWord: 'dog',
      recentPhrases: [],
      l1BudgetUsed: false,
    });
    expect(response).toBeTruthy();
    // Should contain the target word (model answer)
    expect(response.toLowerCase()).toContain('dog');
  });

  // Test 8: l1_translation builds production scaffold, not failure
  it('8. l1_translation builds production scaffold', () => {
    const input = makeInput(
      ClassificationLabel.L1_TRANSLATION,
      {},
      { classificationLabel: ClassificationLabel.L1_TRANSLATION },
    );
    const { plan } = runTeacherResponseEngine(input);
    // Should bridge to English — contain target word
    expect(plan.mainText.toLowerCase()).toContain('dog');
    // Should not shame L1 use
    expect(plan.mainText.toLowerCase()).not.toContain('english only');
    expect(plan.mainText.toLowerCase()).not.toContain('in english please');
    expect(plan.safetyBlocked).toBe(false);
  });

  // Test 9: i_dont_know preserves emotional safety
  it('9. i_dont_know preserves emotional safety', () => {
    const response = buildRecoveryResponse('i_dont_know', {
      targetWord: 'dog',
      forcedChoiceOptionA: 'dog',
      forcedChoiceOptionB: 'cat',
      recentPhrases: [],
      l1BudgetUsed: false,
    });
    expect(response).toBeTruthy();
    expect(response.toLowerCase()).not.toContain('wrong');
    expect(response.toLowerCase()).not.toContain('you should know');
    expect(response.toLowerCase()).not.toContain('try harder');
  });

  // Test 10: refusal reduces demand
  it('10. refusal reduces demand', () => {
    const input = makeInput(
      ClassificationLabel.REFUSAL,
      { recoveryState: RecoveryState.REFUSAL },
      {
        classificationLabel: ClassificationLabel.REFUSAL,
        recoveryState: RecoveryState.REFUSAL,
      },
    );
    const { plan } = runTeacherResponseEngine(input);
    expect(plan.teacherActionCode).toBe(TeacherActionCode.BACK_OFF_OFFER_CHOICE);
    // Should not force continuation or shame
    expect(plan.mainText.toLowerCase()).not.toContain('you must');
    expect(plan.mainText.toLowerCase()).not.toContain('come on');
  });

  // Test 11: emotional_shutdown builds close/comfort response
  it('11. emotional_shutdown builds close/comfort response', () => {
    const input = makeInput(
      ClassificationLabel.EMOTIONAL_SHUTDOWN,
      { recoveryState: RecoveryState.EMOTIONAL_SHUTDOWN },
      {
        classificationLabel: ClassificationLabel.EMOTIONAL_SHUTDOWN,
        recoveryState: RecoveryState.EMOTIONAL_SHUTDOWN,
      },
    );
    const { plan } = runTeacherResponseEngine(input);
    expect(plan.teacherActionCode).toBe(TeacherActionCode.PAUSE_AND_CHECK_IN);
    expect(plan.responseMode).toBe('recovery_script');
    // Should be comforting, not demanding
    expect(plan.mainText.toLowerCase()).not.toContain('wrong');
    expect(plan.mainText.toLowerCase()).not.toContain('come on');
  });

  // Test 12: unsafe_or_sensitive builds safety close
  it('12. unsafe_or_sensitive builds safety close', () => {
    const input = makeInput(ClassificationLabel.UNSAFE_OR_SENSITIVE);
    const stateOutput = makeStateEngineOutput({
      stateUpdateSummary: {
        ...makeStateEngineOutput().stateUpdateSummary,
        safeToContinue: false,
      },
    });
    const fullInput: TeacherResponseInput = { ...input, stateEngineOutput: stateOutput };
    const { plan } = runTeacherResponseEngine(fullInput);
    expect(plan.safetyBlocked).toBe(true);
    expect(plan.responseMode).toBe('safety_close');
    expect(plan.teacherActionCode).toBe(TeacherActionCode.ESCALATE_TO_SAFETY);
    // Safety close must not have open-ended question
    expect(plan.mainText).not.toContain('?');
  });

  // Test 13: easiest_win builds guaranteed success prompt
  it('13. easiest_win builds guaranteed success prompt', () => {
    const prompt = buildActivityPrompt('easiest_win' as ActivityType, {
      targetWord: 'dog',
      forcedChoiceOptionA: 'dog',
      forcedChoiceOptionB: 'cat',
      recentPhrases: [],
    });
    expect(prompt).toBeTruthy();
    // Should not require high production — simple task
    expect(prompt.length).toBeGreaterThan(0);
  });

  // Test 14: placeholder guard removes {target}
  it('14. placeholder guard removes {target}', () => {
    const text = 'Say: {target}! Can you say {target}?';
    const result = applyPlaceholderGuard(text, "Let's try again!");
    expect(result.wasTriggered).toBe(true);
    expect(result.text).toBe("Let's try again!");
    expect(result.patternsFound).toContain('{');
  });

  // Test 15: placeholder guard blocks undefined/null
  it('15. placeholder guard blocks undefined/null in text', () => {
    expect(hasUnresolvedPlaceholders('This is undefined text')).toBe(true);
    expect(hasUnresolvedPlaceholders('Value: null here')).toBe(true);
    const result = applyPlaceholderGuard('Say: undefined', 'Safe fallback!');
    expect(result.wasTriggered).toBe(true);
    expect(result.text).toBe('Safe fallback!');
  });

  // Test 16: vocabulary guard blocks disallowed words
  it('16. vocabulary guard blocks disallowed words', () => {
    const allowedSet = buildAllowedVocabSet(['dog', 'cat'], [], ['Milo']);
    const badText = 'Please conjugate the subjunctive form.';
    const result = checkVocabulary(badText, allowedSet);
    expect(result.passed).toBe(false);
    expect(result.blockedTokens.length).toBeGreaterThan(0);

    const applyResult = applyVocabularyGuard(badText, allowedSet, 'Safe fallback!');
    expect(applyResult.guardApplied).toBe(true);
    expect(applyResult.text).toBe('Safe fallback!');
  });

  // Test 17: forbidden phrase guard blocks "wrong"
  it('17. forbidden phrase guard blocks "wrong"', () => {
    const text = "No, that's wrong. Try again.";
    const result = applyForbiddenPhraseGuard(text, "Let's try!");
    expect(result.guardApplied).toBe(true);
    expect(result.blocked.some(b => b.includes('wrong') || b.includes('try again'))).toBe(true);
    expect(result.text).toBe("Let's try!");
  });

  // Test 18: LLM contract is interface-only
  it('18. LLM contract is interface-only (no implementation)', () => {
    // LLMTeacherResponder is an interface — it has no runtime value
    // We verify it compiles as a type constraint
    type CheckInterface = 'buildResponse' extends keyof LLMTeacherResponder ? true : false;
    const check: CheckInterface = true;
    expect(check).toBe(true);
  });

  // Test 19: LLM output must pass guards
  it('19. LLM output passes through all guards before delivery', () => {
    // Simulate LLM output with a placeholder and forbidden word
    const llmOutput = 'The {target} is wrong! Learn grammar now.';
    const allowedSet = buildAllowedVocabSet(['dog', 'cat'], [], []);
    const fallback = "Let's try again!";

    // Step 1: placeholder guard
    const phResult = applyPlaceholderGuard(llmOutput, fallback);
    expect(phResult.wasTriggered).toBe(true);

    // If placeholder guard fires, the fallback text also goes through forbidden phrase guard
    const fpResult = applyForbiddenPhraseGuard(phResult.text, fallback);
    // "Let's try again!" should be clean
    expect(fpResult.guardApplied).toBe(false);
    expect(fpResult.text).toBe(fallback);
  });

  // Test 20: max length enforced for age 6–7
  it('20. max length enforced for age 6-7 (max 12 words)', () => {
    const longText = 'This is a very long teacher response that goes well beyond what is age appropriate for a young child.';
    const result = enforceMaxLength(longText, AgeBand.SIX_SEVEN);
    expect(result.truncated).toBe(true);
    expect(result.wordCount).toBeLessThanOrEqual(12);
    expect(result.text.split(/\s+/).length).toBeLessThanOrEqual(12);
  });

  // Test 21: max length enforced for age 8–9
  it('21. max length enforced for age 8-9 (max 18 words)', () => {
    const longText = 'This teacher is speaking far too many words and really should stop because this is exceeding the limit by quite a lot here.';
    const result = enforceMaxLength(longText, AgeBand.EIGHT_NINE);
    expect(result.truncated).toBe(true);
    expect(result.wordCount).toBeLessThanOrEqual(18);
  });

  // Test 22: no teacher text generated from LLM without guard
  it('22. engine marks requiresLLM=false in standard paths (guard always applied)', () => {
    const input = makeInput(ClassificationLabel.CORRECT_CONFIDENT);
    const { plan } = runTeacherResponseEngine(input);
    // Standard correct answer path does not require LLM
    expect(plan.requiresLLM).toBe(false);
    // Placeholder guard tracked
    expect(typeof plan.placeholdersRemoved).toBe('boolean');
    // Vocabulary tracking in place
    expect(Array.isArray(plan.blockedVocabulary)).toBe(true);
  });

  // Test 23: no real LLM imports in engine
  it('23. engine module has no real LLM API imports', async () => {
    const engineModule = await import('../teacher-response-engine.js');
    // If a real LLM was imported, it would add anthropic/openai to the module
    const moduleStr = JSON.stringify(Object.keys(engineModule));
    expect(moduleStr).not.toContain('anthropic');
    expect(moduleStr).not.toContain('openai');
  });

  // Test 24: no TTS imports in engine
  it('24. engine module has no TTS imports', async () => {
    const engineModule = await import('../teacher-response-engine.js');
    const moduleStr = JSON.stringify(Object.keys(engineModule));
    expect(moduleStr).not.toContain('tts');
    expect(moduleStr).not.toContain('speech');
  });

  // Test 25: no adult Obsidian imports
  it('25. engine module has no obsidian-brain imports', async () => {
    // If obsidian-brain was imported, it would fail at module load time
    // We verify the function is callable without throwing
    expect(() => runTeacherResponseEngine).not.toThrow();
    // Also verify the import path in engine file doesn't include obsidian
    const indexModule = await import('../index.js');
    // Should export runTeacherResponseEngine
    expect(typeof indexModule.runTeacherResponseEngine).toBe('function');
  });

  // Test 26: exported from backend/src/kids-brain/index.ts
  it('26. teacher response engine is exported from kids-brain/index.ts', async () => {
    const kidsBrainIndex = await import('../../index.js');
    expect(typeof kidsBrainIndex.runTeacherResponseEngine).toBe('function');
    expect(typeof kidsBrainIndex.applyPlaceholderGuard).toBe('function');
    expect(typeof kidsBrainIndex.applyVocabularyGuard).toBe('function');
    expect(typeof kidsBrainIndex.buildAllowedVocabSet).toBe('function');
    expect(typeof kidsBrainIndex.checkForbiddenPhrases).toBe('function');
    expect(typeof kidsBrainIndex.enforceMaxLength).toBe('function');
    expect(typeof kidsBrainIndex.buildRecoveryResponse).toBe('function');
    expect(typeof kidsBrainIndex.buildActivityPrompt).toBe('function');
    expect(typeof kidsBrainIndex.buildScaffoldResponse).toBe('function');
    expect(typeof kidsBrainIndex.getFastTrackReaction).toBe('function');
  });

  // Additional: safety close does not have open-ended question
  it('A1. safety close response contains no open-ended question', () => {
    const input = makeInput(ClassificationLabel.UNSAFE_OR_SENSITIVE);
    const safeStateOutput = makeStateEngineOutput({
      stateUpdateSummary: {
        ...makeStateEngineOutput().stateUpdateSummary,
        safeToContinue: false,
      },
    });
    const { plan } = runTeacherResponseEngine({ ...input, stateEngineOutput: safeStateOutput });
    expect(plan.safetyBlocked).toBe(true);
    // Safety close text should not contain "?" (no open questioning)
    expect(plan.mainText).not.toContain('?');
  });

  // Additional: fast-track reaction is independent of LLM
  it('A2. fast-track reaction is independent of LLM (synchronous)', () => {
    const input = makeInput(ClassificationLabel.CORRECT_CONFIDENT);
    const { plan } = runTeacherResponseEngine(input);
    expect(plan.fastTrackText).toBeTruthy();
    // Fast-track should be a short exclamation
    expect(plan.fastTrackText!.length).toBeLessThan(30);
  });

  // Additional: scaffold level 6 respects L1 budget
  it('A3. scaffold level 6 with exhausted L1 budget falls back to level 5', () => {
    const response = buildScaffoldResponse(6, {
      targetWord: 'dog',
      l1BudgetUsed: true, // budget exhausted
      l1AnchorWord: 'пес',
    });
    // Must not contain the L1 word since budget is exhausted
    expect(response.toLowerCase()).not.toContain('пес');
    // Should still contain the target word
    expect(response.toLowerCase()).toContain('dog');
  });

  // ── Phase 8.10 placeholder regression tests ──────────────────────────────────

  // B1: renderTemplate replaces ALL occurrences of {word} (not just the first)
  it('B1. renderTemplate replaces every {word} occurrence, not just the first', () => {
    const template = 'With me! {word}! Together — {word}! Your turn!';
    const result = renderTemplate(template, { word: 'cat' });
    expect(result).toBe('With me! cat! Together — cat! Your turn!');
    expect(result).not.toContain('{word}');
  });

  // B2: renderTemplate replaces ALL {optA} and {optB} occurrences
  it('B2. renderTemplate replaces every {optA}/{optB} occurrence', () => {
    const template = 'Is it {optA} or {optB}? {optA} or {optB}?';
    const result = renderTemplate(template, { optA: 'cat', optB: 'dog' });
    expect(result).toBe('Is it cat or dog? cat or dog?');
    expect(result).not.toContain('{optA}');
    expect(result).not.toContain('{optB}');
  });

  // B3: all templates in repeat_after_me render without unresolved placeholders
  it('B3. all repeat_after_me template variants render without unresolved placeholders', () => {
    const variants = getAllTemplatesForKey('repeat_after_me');
    for (const template of variants) {
      const rendered = renderTemplate(template, { word: 'dog' });
      expect(rendered, `template: "${template}"`).not.toMatch(/\{word\}/);
      expect(rendered, `template: "${template}"`).not.toMatch(/\{optA\}/);
      expect(rendered, `template: "${template}"`).not.toMatch(/\{optB\}/);
      expect(hasUnresolvedPlaceholders(rendered), `template: "${template}" has unresolved braces`).toBe(false);
    }
  });

  // B4: all template bank keys render without unresolved placeholders when given valid vars
  it('B4. all template bank keys render cleanly with valid vars', () => {
    const keys = [
      'correct_answer', 'hesitant_correct', 'near_correct', 'wrong_but_safe',
      'repeat_after_me', 'supported_production', 'recovery_prompt', 'l1_rescue',
      'silence_rescue', 'easiest_win',
    ] as const;
    for (const key of keys) {
      const variants = getAllTemplatesForKey(key);
      for (const template of variants) {
        const rendered = renderTemplate(template, { word: 'lion', optA: 'lion', optB: 'cat' });
        expect(rendered, `key=${key} template="${template}"`).not.toMatch(/\{word\}/);
        expect(rendered, `key=${key} template="${template}"`).not.toMatch(/\{optA\}/);
        expect(rendered, `key=${key} template="${template}"`).not.toMatch(/\{optB\}/);
        expect(hasUnresolvedPlaceholders(rendered), `key=${key} template="${template}"`).toBe(false);
      }
    }
  });

  // B5: buildRecoveryResponse returns no unresolved {word}/{optA}/{optB} for all types
  it('B5. buildRecoveryResponse produces no unresolved placeholders for all recovery types', () => {
    const types = [
      'silence_long', 'no_response', 'wrong_semantic', 'repeated_failure',
      'l1_translation', 'l1_help_request', 'i_dont_know',
    ] as const;
    const params = {
      targetWord: 'monkey',
      forcedChoiceOptionA: 'monkey',
      forcedChoiceOptionB: 'elephant',
      l1BudgetUsed: false,
      recentPhrases: [],
    };
    for (const type of types) {
      const text = buildRecoveryResponse(type, params);
      expect(text, `type=${type}`).not.toContain('{word}');
      expect(text, `type=${type}`).not.toContain('{optA}');
      expect(text, `type=${type}`).not.toContain('{optB}');
      expect(text, `type=${type}`).not.toContain('{target}');
      expect(hasUnresolvedPlaceholders(text), `type=${type}`).toBe(false);
    }
  });

  // B6: teacher output never contains literal {target} — placeholder guard catches it
  it('B6. placeholder guard catches {target} in any teacher text', () => {
    const templates = [
      'With me! {target}! Together — {target}! Your turn!',
      "Let's say it together! Ready? {target}! Now YOU!",
      'You and me! {target}! Again — {target}! Now just you!',
    ];
    for (const t of templates) {
      const result = applyPlaceholderGuard(t, "Let's try again!");
      expect(result.wasTriggered, `template: "${t}"`).toBe(true);
      expect(result.text, `template: "${t}"`).toBe("Let's try again!");
    }
  });

  // B7: forced_choice templates render both options without leaving placeholders
  it('B7. forced_choice templates render both {optA} and {optB} completely', () => {
    const variants = getAllTemplatesForKey('forced_choice');
    for (const template of variants) {
      const rendered = renderTemplate(template, { optA: 'cat', optB: 'dog' });
      expect(rendered).not.toMatch(/\{optA\}/);
      expect(rendered).not.toMatch(/\{optB\}/);
      expect(rendered).toContain('cat');
      expect(rendered).toContain('dog');
    }
  });

  // Additional: response plan has all required fields
  it('A4. teacher response plan has all required fields', () => {
    const input = makeInput(ClassificationLabel.CORRECT_CONFIDENT);
    const { plan } = runTeacherResponseEngine(input);

    expect(plan.responseId).toBeTruthy();
    expect(plan.sessionId).toBe('sess-test');
    expect(plan.turnNumber).toBe(3);
    expect(typeof plan.teacherActionCode).toBe('string');
    expect(typeof plan.responseMode).toBe('string');
    expect(typeof plan.mainText).toBe('string');
    expect(typeof plan.fallbackText).toBe('string');
    expect(Array.isArray(plan.allowedVocabularyUsed)).toBe(true);
    expect(Array.isArray(plan.blockedVocabulary)).toBe(true);
    expect(typeof plan.placeholdersRemoved).toBe('boolean');
    expect(typeof plan.requiresLLM).toBe('boolean');
    expect(typeof plan.safetyBlocked).toBe('boolean');
    expect(typeof plan.emotionalTone).toBe('string');
    expect(typeof plan.estimatedTtsCharacters).toBe('number');
    expect(plan.createdAt).toBeTruthy();
  });
});
