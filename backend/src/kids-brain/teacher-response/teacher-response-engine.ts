import { randomUUID } from 'node:crypto';
import {
  ClassificationLabel,
  FeedbackTone,
  TeacherActionCode,
  AgeBand,
} from '../shared/enums.js';
import { LOG_EVENTS } from '../shared/log-events.js';
import { LogSeverity } from '../shared/enums.js';
import type { LogEvent } from '../shared/log-events.js';

import type { TeacherResponseInput } from './teacher-response-types.js';
import type { TeacherResponsePlan } from './teacher-response-plan.js';
import { buildTeacherResponsePlan } from './teacher-response-plan.js';

import { routeTeacherResponse } from './teacher-response-router.js';
import { getFastTrackReaction, getSuccessAfterRecoveryReaction } from './fast-track-reactions.js';
import { buildRecoveryResponse } from './recovery-response-builder.js';
import { buildActivityPrompt } from './activity-prompt-builder.js';
import { buildScaffoldResponse } from './scaffold-response-builder.js';
import { getRenderedTemplate } from './response-template-bank.js';
import { applyPlaceholderGuard } from './placeholder-guard.js';
import { applyVocabularyGuard, buildAllowedVocabSet } from './vocabulary-guard.js';
import { applyForbiddenPhraseGuard, enforceMaxLength } from './teacher-language-policy.js';
import {
  UNIVERSAL_FALLBACK_TEXT,
  SAFETY_CLOSE_TEXT,
  PRAISE_VARIANTS,
} from './teacher-response-constants.js';

/** Full output of the Teacher Response Engine per turn. */
export interface TeacherResponseEngineOutput {
  plan: TeacherResponsePlan;
  logsToEmit: LogEvent[];
}

// ── Guard pipeline ─────────────────────────────────────────────────────────────

interface GuardResult {
  text: string;
  blockedVocabulary: string[];
  placeholdersRemoved: boolean;
  logsToEmit: LogEvent[];
}

function applyAllGuards(
  text: string,
  fallbackText: string,
  sessionId: string,
  turnNumber: number,
  allowedVocabSet: Set<string>,
  ageBand: AgeBand,
): GuardResult {
  const logs: LogEvent[] = [];
  let current = text;
  let placeholdersRemoved = false;
  let blockedVocabulary: string[] = [];

  // Step 1: Placeholder guard
  const phResult = applyPlaceholderGuard(current, fallbackText);
  if (phResult.wasTriggered) {
    placeholdersRemoved = true;
    current = phResult.text;
    logs.push({
      event: LOG_EVENTS.PLACEHOLDER_GUARD_TRIGGERED,
      severity: LogSeverity.WARNING,
      sessionId,
      turnNumber,
      timestamp: new Date().toISOString(),
      payload: { patternsFound: phResult.patternsFound, originalText: text },
    });
  }

  // Step 2: Forbidden phrase guard
  const fpResult = applyForbiddenPhraseGuard(current, fallbackText);
  if (fpResult.guardApplied) {
    current = fpResult.text;
    logs.push({
      event: LOG_EVENTS.FORBIDDEN_PHRASE_BLOCKED,
      severity: LogSeverity.WARNING,
      sessionId,
      turnNumber,
      timestamp: new Date().toISOString(),
      payload: { blocked: fpResult.blocked },
    });
  }

  // Step 3: Vocabulary guard
  const vocabResult = applyVocabularyGuard(current, allowedVocabSet, fallbackText);
  if (vocabResult.guardApplied) {
    blockedVocabulary = vocabResult.blocked;
    current = vocabResult.text;
    logs.push({
      event: LOG_EVENTS.VOCAB_GUARD_BLOCK,
      severity: LogSeverity.WARNING,
      sessionId,
      turnNumber,
      timestamp: new Date().toISOString(),
      payload: {
        blockedTokens: vocabResult.blocked,
        originalText: text,
      },
    });
  }

  // Step 4: Length guard
  const lenResult = enforceMaxLength(current, ageBand);
  current = lenResult.text;

  return { text: current, blockedVocabulary, placeholdersRemoved, logsToEmit: logs };
}

// ── Text builder ───────────────────────────────────────────────────────────────

function buildMainText(
  input: TeacherResponseInput,
  route: ReturnType<typeof routeTeacherResponse>,
): string {
  const ctx = input.responseContext;
  const label = input.classificationResult.label;
  const word = ctx.targetWord ?? '';
  const optA = ctx.forcedChoiceOptionA ?? word;
  const optB = ctx.forcedChoiceOptionB ?? 'this';
  const recentPhrases = input.sessionMemory.recentPraisePhrases;

  // Safety close — scripted, no variation
  if (route.mode === 'safety_close') {
    return SAFETY_CLOSE_TEXT;
  }

  // Recovery scripts
  if (route.mode === 'recovery_script' && route.recoveryType !== null) {
    return buildRecoveryResponse(route.recoveryType, {
      targetWord: ctx.targetWord,
      forcedChoiceOptionA: optA,
      forcedChoiceOptionB: optB,
      l1BudgetUsed: ctx.l1BudgetUsed,
      recentPhrases,
    });
  }

  // Correct answer
  if (
    label === ClassificationLabel.CORRECT_CONFIDENT &&
    route.mode !== 'fallback_safe'
  ) {
    const praiseVariants = PRAISE_VARIANTS.filter(v => !recentPhrases.includes(v));
    const pool = praiseVariants.length > 0 ? praiseVariants : [...PRAISE_VARIANTS];
    const praise = pool[Math.floor(Math.random() * pool.length)];
    return word ? `${word}! ${praise} You said ${word}!` : praise;
  }

  // Hesitant correct
  if (label === ClassificationLabel.CORRECT_HESITANT) {
    return getRenderedTemplate('hesitant_correct', { word }, recentPhrases);
  }

  // Near correct — recast without shame
  if (
    label === ClassificationLabel.NEAR_CORRECT ||
    label === ClassificationLabel.PRONUNCIATION_VARIANT
  ) {
    return getRenderedTemplate('near_correct', { word }, recentPhrases);
  }

  // Repeated after model
  if (label === ClassificationLabel.REPEATED_AFTER_MODEL) {
    return getRenderedTemplate('repeat_after_me', { word }, recentPhrases);
  }

  // Partial answer — complete the model
  if (label === ClassificationLabel.PARTIAL_ANSWER) {
    return word ? `Yes! And ${word}! Say the whole thing: ${word}!` : UNIVERSAL_FALLBACK_TEXT;
  }

  // Playful nonsense — play along briefly then redirect
  if (label === ClassificationLabel.PLAYFUL_NONSENSE) {
    return word
      ? `Ha! Is it a ${word}? What do you think?`
      : "Hmm! What is it? Can you find it?";
  }

  // Scaffold path — use scaffold builder
  if (
    route.mode === 'template' &&
    input.learningDecision.difficultyDelta < 0
  ) {
    return buildScaffoldResponse(ctx.scaffoldLevel, {
      targetWord: ctx.targetWord,
      forcedChoiceOptionA: optA,
      forcedChoiceOptionB: optB,
      l1BudgetUsed: ctx.l1BudgetUsed,
    });
  }

  // Activity prompt for normal practice
  if (route.mode === 'template' || route.mode === 'scripted') {
    return buildActivityPrompt(ctx.currentActivityType, {
      targetWord: ctx.targetWord,
      forcedChoiceOptionA: optA,
      forcedChoiceOptionB: optB,
      recentPhrases,
    });
  }

  // Fallback safe
  return UNIVERSAL_FALLBACK_TEXT;
}

// ── Main engine function ───────────────────────────────────────────────────────

/**
 * Runs the Teacher Response Engine for one turn.
 *
 * Pipeline:
 * 1. Route to response mode
 * 2. Build fast-track reaction
 * 3. Build main text
 * 4. Apply all guards (placeholder, forbidden phrase, vocabulary, length)
 * 5. Assemble TeacherResponsePlan
 *
 * Phase 6 constraints:
 * - No real LLM calls
 * - No TTS calls
 * - No Redis/Postgres writes
 * - No production WebSocket wiring
 */
export function runTeacherResponseEngine(
  input: TeacherResponseInput,
): TeacherResponseEngineOutput {
  const logs: LogEvent[] = [];
  const { sessionMemory, responseContext } = input;
  const sessionId = sessionMemory.sessionId;
  const turnNumber = sessionMemory.turnNumber;
  const ageBand = responseContext.ageBand;

  // Emit start log
  logs.push({
    event: LOG_EVENTS.TEACHER_RESPONSE_STARTED,
    severity: LogSeverity.DEBUG,
    sessionId,
    turnNumber,
    timestamp: new Date().toISOString(),
    payload: {
      label: input.classificationResult.label,
      recoveryState: responseContext.recoveryState,
      actionCode: input.learningDecision.nextTeacherActionCode,
    },
  });

  // Step 1: Route
  const route = routeTeacherResponse(input);

  // Step 2: Fast-track reaction
  const label = input.classificationResult.label;
  const isRepaired = input.learningDecision.decisionType === 'repaired_success';
  const fastTrackReaction = isRepaired
    ? getSuccessAfterRecoveryReaction(sessionMemory.recentPraisePhrases)
    : getFastTrackReaction(label, sessionMemory.recentPraisePhrases);

  // Step 3: Build main text (before guards)
  let rawMainText = buildMainText(input, route);

  // Step 4: Build allowed vocab set for this session
  const allowedVocabSet = buildAllowedVocabSet(
    responseContext.lessonTargetWords,
    responseContext.unitReviewWords,
    responseContext.characterNames,
  );

  // Step 5: Apply all guards
  const guardResult = applyAllGuards(
    rawMainText,
    UNIVERSAL_FALLBACK_TEXT,
    sessionId,
    turnNumber,
    allowedVocabSet,
    ageBand,
  );

  logs.push(...guardResult.logsToEmit);

  // Detect if fallback was used
  const usedFallback = guardResult.text === UNIVERSAL_FALLBACK_TEXT && rawMainText !== UNIVERSAL_FALLBACK_TEXT;
  if (usedFallback) {
    logs.push({
      event: LOG_EVENTS.TEACHER_RESPONSE_FALLBACK_USED,
      severity: LogSeverity.WARNING,
      sessionId,
      turnNumber,
      timestamp: new Date().toISOString(),
      payload: { originalText: rawMainText, reason: 'guard_blocked' },
    });
  }

  // Step 6: Build LLM prompt for llm_assisted mode (no actual LLM call in Phase 6)
  let llmPrompt: string | undefined;
  if (route.requiresLLM) {
    const ctx = responseContext;
    llmPrompt =
      `Child: ${input.perceptionBundle.normalizedTranscript ?? '(no speech)'} | ` +
      `Target: ${ctx.targetWord ?? 'none'} | Activity: ${ctx.currentActivityType} | ` +
      `Template: ${guardResult.text}`;
    logs.push({
      event: LOG_EVENTS.LLM_TEACHER_REQUESTED,
      severity: LogSeverity.INFO,
      sessionId,
      turnNumber,
      timestamp: new Date().toISOString(),
      payload: { promptLength: llmPrompt.length },
    });
  }

  // Safety close log
  if (route.safetyBlocked) {
    logs.push({
      event: LOG_EVENTS.SAFETY_CLOSE_RESPONSE_BUILT,
      severity: LogSeverity.CRITICAL,
      sessionId,
      turnNumber,
      timestamp: new Date().toISOString(),
      payload: { label: input.classificationResult.label },
    });
  }

  // Compute allowed vocabulary used in the final text
  const finalTokens = guardResult.text.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/).filter(Boolean);
  const allowedUsed = finalTokens.filter(t => allowedVocabSet.has(t));

  // Step 7: Assemble plan
  const plan = buildTeacherResponsePlan({
    responseId: randomUUID(),
    sessionId,
    turnNumber,
    teacherActionCode: route.actionCode,
    responseMode: usedFallback ? 'fallback_safe' : route.mode,
    fastTrackText: fastTrackReaction.text,
    mainText: guardResult.text,
    fallbackText: UNIVERSAL_FALLBACK_TEXT,
    allowedVocabularyUsed: allowedUsed,
    blockedVocabulary: guardResult.blockedVocabulary,
    placeholdersRemoved: guardResult.placeholdersRemoved,
    requiresLLM: route.requiresLLM,
    llmPrompt,
    safetyBlocked: route.safetyBlocked,
    emotionalTone: route.tone,
  });

  // Emit completion log
  logs.push({
    event: LOG_EVENTS.TEACHER_RESPONSE_BUILT,
    severity: LogSeverity.INFO,
    sessionId,
    turnNumber,
    timestamp: new Date().toISOString(),
    payload: {
      mode: plan.responseMode,
      actionCode: plan.teacherActionCode,
      ttsChars: plan.estimatedTtsCharacters,
      safetyBlocked: plan.safetyBlocked,
    },
  });

  return { plan, logsToEmit: logs };
}
