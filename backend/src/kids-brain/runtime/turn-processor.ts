/**
 * Kids Brain Turn Processor (Phase 7).
 *
 * Runs the full internal pipeline for one turn:
 *   Perception → Classification → State Engine → Learning Engine → Teacher Response Engine
 *
 * Phase 7 constraints:
 * - No LLM calls (llmClassifier: undefined passed to classifyResponse)
 * - No TTS calls
 * - No Redis/Postgres writes
 * - No production WebSocket wiring
 * - Input SessionMemory is never mutated
 */

import { randomUUID } from 'node:crypto';
import { LogSeverity, TeacherActionCode, FeedbackTone, ClassificationLabel } from '../shared/enums.js';
import { LOG_EVENTS } from '../shared/log-events.js';
import type { LogEvent } from '../shared/log-events.js';

import { buildPerceptionBundle } from '../perception/perception-builder.js';
import type { PerceptionInput } from '../perception/perception-types.js';

import { classifyResponse } from '../classification/classification-router.js';
import { buildResult } from '../classification/classification-result.js';
import type { ClassificationInput } from '../classification/classification-types.js';

import { runStateEngine } from '../state-engine/state-engine.js';
import type { StateEngineInput } from '../state-engine/state-engine-types.js';

import { runLearningEngine } from '../learning-engine/learning-engine.js';
import type { LearningEngineInput } from '../learning-engine/learning-engine-types.js';

import { runTeacherResponseEngine } from '../teacher-response/teacher-response-engine.js';
import type { TeacherResponseInput } from '../teacher-response/teacher-response-types.js';

import type { KidsBrainTurnInput, RuntimeActionPacket } from './runtime-types.js';
import { RuntimeActionPacketType } from './runtime-types.js';
import type { RuntimeTurnResult } from './runtime-result.js';
import { applyExerciseBridge, buildExercisePrompt } from './exercise-runner.js';
import { findLessonById } from '../curriculum/curriculum-loader.js';
import {
  buildActivityContext,
  buildPromptContext,
  buildChildStateSnapshot,
  buildCurrentItemContext,
  buildAvailableItems,
  buildAvailableActivities,
  buildTeacherResponseContext,
} from './runtime-context.js';
import { buildTeacherResponsePlan } from '../teacher-response/teacher-response-plan.js';
import type { TeacherResponsePlan } from '../teacher-response/teacher-response-plan.js';
import type { PerceptionBundle } from '../perception/perception-bundle.js';
import type { SessionMemory } from '../contracts/session-memory.js';

const DEFAULT_TTS_VOICE = 'default_teacher_v1';

// ── Phase 13D: Exercise bridge ────────────────────────────────────────────────

/**
 * Applies the exercise progression bridge to session memory.
 * No-ops when the session has no exercise state (old sessions, no-exercise lessons).
 */
function runExerciseBridge(
  memory: SessionMemory,
  classificationLabel: import('../shared/enums.js').ClassificationLabel,
): SessionMemory {
  if (!memory.currentExerciseId || !memory.lessonId) return memory;
  const lesson = findLessonById(memory.lessonId);
  if (!lesson || !lesson.exercises?.length) return memory;
  return applyExerciseBridge(memory, classificationLabel, lesson);
}

// ── Readiness handshake ───────────────────────────────────────────────────────

const READINESS_PHRASES = new Set([
  "i'm ready",
  "im ready",
  "ready",
  "yes",
  "yep",
  "ok",
  "okay",
  "start",
  "let's go",
  "lets go",
  "go",
]);

function normalizeReadinessPhrase(text: string): string {
  return text
    .toLowerCase()
    .replace(/[.!?,]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isReadinessPhrase(text: string): boolean {
  return READINESS_PHRASES.has(normalizeReadinessPhrase(text));
}

/**
 * Handles the first child input when the session is still in the readiness-
 * confirmation phase (hasStartedFirstExercise === false).
 *
 * Instead of classifying the phrase against the first target word, this path:
 * 1. Runs perception + a neutral synthetic classification (no mastery/recovery effects).
 * 2. Runs state engine normally (increments turnNumber, positive engagement signal).
 * 3. Emits a scripted first-exercise prompt: "Listen — [word]! Now you!"
 * 4. Sets hasStartedFirstExercise = true so subsequent turns use the normal pipeline.
 */
async function buildReadinessTurnResult(
  input: KidsBrainTurnInput,
  sessionMemory: SessionMemory,
  perceptionBundle: PerceptionBundle,
  inputTurnNumber: number,
  logs: LogEvent[],
): Promise<RuntimeTurnResult> {
  const sessionId = sessionMemory.sessionId;

  logs.push(makeLog(
    LOG_EVENTS.READINESS_PHRASE_INTERCEPTED,
    sessionId,
    inputTurnNumber,
    LogSeverity.INFO,
    { normalizedText: perceptionBundle.normalizedTranscript ?? '' },
  ));

  // Neutral synthetic classification: child made a positive attempt.
  // Override mastery/progression/recovery flags so nothing is counted.
  const syntheticClassification = buildResult({
    label: ClassificationLabel.CORRECT_HESITANT,
    confidence: 1.0,
    source: 'deterministic',
    reasons: ['readiness_phrase_intercepted'],
    perception: perceptionBundle,
    requiresRecovery: false,
    eligibleForMasteryUpdate: false,
    eligibleForProgression: false,
  });

  // Run state engine: increments turnNumber, applies small positive deltas.
  const activityContext = buildActivityContext(sessionMemory);
  const stateInput: StateEngineInput = {
    sessionMemory,
    perceptionBundle,
    classificationResult: syntheticClassification,
    currentActivityContext: activityContext,
    timestamp: input.timestamp,
  };
  const stateOutput = runStateEngine(stateInput);
  logs.push(...stateOutput.logsToEmit);

  // Run learning engine: with eligibleForProgression=false, stays on current item.
  const learningInput: LearningEngineInput = {
    sessionMemory,
    stateEngineOutput: stateOutput,
    classificationResult: syntheticClassification,
    perceptionBundle,
    currentActivityContext: activityContext,
    currentItemContext: buildCurrentItemContext(sessionMemory),
    availableActivities: buildAvailableActivities(),
    availableItems: buildAvailableItems(input.lessonTargetWords, sessionMemory.currentTargetItemId),
    timestamp: input.timestamp,
  };
  const learningDecision = runLearningEngine(learningInput);

  // Scripted first-exercise prompt. Never say "try again" here.
  const firstWord = sessionMemory.currentTargetItemId ?? input.targetWord ?? input.lessonTargetWords[0] ?? '';
  const firstExerciseText = firstWord
    ? `Listen — ${firstWord}! Now you!`
    : "Ready! Let's start!";

  const plan = buildTeacherResponsePlan({
    responseId: randomUUID(),
    sessionId,
    turnNumber: stateOutput.updatedSessionMemory.turnNumber,
    teacherActionCode: TeacherActionCode.MODEL_ANSWER,
    responseMode: 'scripted',
    mainText: firstExerciseText,
    fallbackText: "Let's go! Say the word!",
    allowedVocabularyUsed: firstWord ? [firstWord] : [],
    blockedVocabulary: [],
    placeholdersRemoved: false,
    requiresLLM: false,
    safetyBlocked: false,
    emotionalTone: FeedbackTone.WARM,
  });

  // Mark readiness complete. Always stay on first target — child hasn't answered yet.
  const memAfterReadiness: SessionMemory = {
    ...stateOutput.updatedSessionMemory,
    hasStartedFirstExercise: true,
    currentTargetItemId: sessionMemory.currentTargetItemId,
  };

  // Phase 13D: advance readiness exercise (ex-01 is TEACHER_CONTROLLED, maxAttempts:1 → auto-completes).
  const updatedSessionMemory = runExerciseBridge(memAfterReadiness, syntheticClassification.label);

  const turnNumber = updatedSessionMemory.turnNumber;
  const actionPackets = buildActionPackets(plan, sessionId, turnNumber, false);

  return {
    sessionId,
    turnNumber,
    perceptionBundle,
    classificationResult: syntheticClassification,
    stateEngineOutput: stateOutput,
    learningDecision,
    teacherResponsePlan: plan,
    updatedSessionMemory,
    actionPackets,
    logsToEmit: logs,
    safeToContinue: true,
    shouldCloseSession: false,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Converts a TeacherResponsePlan into RuntimeActionPacket[].
 *
 * Packet sequence:
 * 1. STOP_LISTENING — always first; signals frontend to stop recording
 * 2. SAFETY_CLOSE  — if safetyBlocked (terminates sequence)
 * 3. TEACHER_TEXT  — main teacher utterance
 * 4. SESSION_COMPLETE — if shouldCloseSession (terminates sequence)
 * 5. START_LISTENING — if session continues
 */
function buildActionPackets(
  plan: TeacherResponsePlan,
  sessionId: string,
  turnNumber: number,
  shouldCloseSession: boolean,
): RuntimeActionPacket[] {
  const packets: RuntimeActionPacket[] = [];

  // Always stop listening before teacher speaks
  packets.push({
    packetType: RuntimeActionPacketType.STOP_LISTENING,
    sessionId,
    turnNumber,
    ttsVoiceId: DEFAULT_TTS_VOICE,
  });

  // Safety close overrides everything
  if (plan.safetyBlocked) {
    packets.push({
      packetType: RuntimeActionPacketType.SAFETY_CLOSE,
      sessionId,
      turnNumber,
      teacherText: plan.mainText,
      feedbackTone: plan.emotionalTone,
      waitMs: 2000,
      nextPrompt: null,
      teacherActionCode: plan.teacherActionCode,
      ttsVoiceId: DEFAULT_TTS_VOICE,
    });
    return packets;
  }

  // Teacher text
  packets.push({
    packetType: RuntimeActionPacketType.TEACHER_TEXT,
    sessionId,
    turnNumber,
    teacherText: plan.mainText,
    feedbackTone: plan.emotionalTone,
    waitMs: 1500,
    nextPrompt: null,
    teacherActionCode: plan.teacherActionCode,
    ttsVoiceId: DEFAULT_TTS_VOICE,
  });

  // Session end
  if (shouldCloseSession) {
    packets.push({
      packetType: RuntimeActionPacketType.SESSION_COMPLETE,
      sessionId,
      turnNumber,
      ttsVoiceId: DEFAULT_TTS_VOICE,
    });
    return packets;
  }

  // Continue — start listening for child response
  packets.push({
    packetType: RuntimeActionPacketType.START_LISTENING,
    sessionId,
    turnNumber,
    waitMs: 0,
    ttsVoiceId: DEFAULT_TTS_VOICE,
  });

  return packets;
}

function makeLog(
  event: (typeof LOG_EVENTS)[keyof typeof LOG_EVENTS],
  sessionId: string,
  turnNumber: number,
  severity: LogSeverity,
  payload: Record<string, unknown>,
): LogEvent {
  return {
    event,
    severity,
    sessionId,
    turnNumber,
    timestamp: new Date().toISOString(),
    payload,
  };
}

/**
 * Processes one turn through the full Kids Brain pipeline.
 *
 * Must be async because classifyResponse may call an LLM classifier;
 * in Phase 7, no LLM is injected (llmClassifier: undefined), so the
 * async call resolves through the deterministic fast-path only.
 */
export async function processKidsBrainTurn(
  input: KidsBrainTurnInput,
): Promise<RuntimeTurnResult> {
  const logs: LogEvent[] = [];
  const { sessionMemory } = input;
  const sessionId = sessionMemory.sessionId;
  const inputTurnNumber = sessionMemory.turnNumber;

  logs.push(makeLog(
    LOG_EVENTS.KIDS_TURN_STARTED,
    sessionId,
    inputTurnNumber,
    LogSeverity.DEBUG,
    {
      silenceDurationMs: input.silenceDurationMs,
      hasTranscript: input.sttResult.text !== null,
      targetWord: input.targetWord,
    },
  ));

  // ── Step 1: Perception ────────────────────────────────────────────────────────

  const perceptionInput: PerceptionInput = {
    stt: input.sttResult,
    responseLatencyMs: input.responseLatencyMs,
    silenceDurationMs: input.silenceDurationMs,
    ageBand: sessionMemory.ageBand,
    attemptCount: input.attemptCount,
    promptContext: buildPromptContext(sessionMemory, input.targetWord),
    recentTurns: sessionMemory.recentTurns,
    childState: buildChildStateSnapshot(sessionMemory),
  };

  const perceptionBundle = buildPerceptionBundle(perceptionInput);

  logs.push(makeLog(
    LOG_EVENTS.PERCEPTION_COMPLETED,
    sessionId,
    inputTurnNumber,
    LogSeverity.DEBUG,
    {
      transcriptAvailable: perceptionBundle.transcriptAvailable,
      l1Detected: perceptionBundle.l1Detected,
      isSilence: perceptionBundle.isSilence,
      inputQuality: perceptionBundle.inputQuality,
      rawTranscript: perceptionBundle.rawTranscript,
      normalizedTranscript: perceptionBundle.normalizedTranscript,
      wordCount: perceptionBundle.wordCount,
      adjustedSttConfidence: perceptionBundle.adjustedSttConfidence,
      perceptionConfidence: perceptionBundle.perceptionConfidence,
    },
  ));

  // ── Readiness handshake guard ─────────────────────────────────────────────────
  // When the session has not yet started its first exercise, readiness phrases
  // ("I'm ready", "start", "yes", "ok", etc.) must NOT be classified as wrong
  // answers against the first curriculum target word.
  if (
    !sessionMemory.hasStartedFirstExercise &&
    perceptionBundle.normalizedTranscript !== null &&
    isReadinessPhrase(perceptionBundle.normalizedTranscript)
  ) {
    return buildReadinessTurnResult(input, sessionMemory, perceptionBundle, inputTurnNumber, logs);
  }

  // ── Step 2: Classification ────────────────────────────────────────────────────

  const activityContext = buildActivityContext(sessionMemory);

  const classificationInput: ClassificationInput = {
    perception: perceptionBundle,
    activityContext,
    recentTurns: sessionMemory.recentTurns,
    ageProfile: sessionMemory.ageProfile,
    // No llmClassifier — Phase 7: no LLM calls
    vocabularyContext: input.targetWord
      ? {
          targetWord: input.targetWord,
          relatedWords: input.lessonTargetWords.filter(w => w !== input.targetWord),
          vocabularyGroup: input.lessonTargetWords,
        }
      : undefined,
  };

  const classificationResult = await classifyResponse(classificationInput);

  logs.push(makeLog(
    LOG_EVENTS.CLASSIFICATION_COMPLETED,
    sessionId,
    inputTurnNumber,
    LogSeverity.DEBUG,
    {
      label: classificationResult.label,
      confidence: classificationResult.confidence,
      source: classificationResult.source,
      requiresRecovery: classificationResult.requiresRecovery,
      eligibleForMasteryUpdate: classificationResult.eligibleForMasteryUpdate,
      eligibleForProgression: classificationResult.eligibleForProgression,
      targetWord: input.targetWord,
      vocabContextTargetWord: classificationInput.vocabularyContext?.targetWord ?? null,
      activityContextTargetItemId: activityContext.currentTargetItemId,
      transcript: perceptionBundle.normalizedTranscript,
      safeForDeterministic: perceptionBundle.safeForDeterministicClassification,
    },
  ));

  // ── Step 3: State Engine ──────────────────────────────────────────────────────

  const stateInput: StateEngineInput = {
    sessionMemory,
    perceptionBundle,
    classificationResult,
    currentActivityContext: activityContext,
    timestamp: input.timestamp,
  };

  const stateOutput = runStateEngine(stateInput);

  logs.push(...stateOutput.logsToEmit);

  // ── Step 4: Learning Engine ───────────────────────────────────────────────────

  const learningInput: LearningEngineInput = {
    sessionMemory,
    stateEngineOutput: stateOutput,
    classificationResult,
    perceptionBundle,
    currentActivityContext: activityContext,
    currentItemContext: buildCurrentItemContext(sessionMemory),
    availableActivities: buildAvailableActivities(),
    availableItems: buildAvailableItems(input.lessonTargetWords, sessionMemory.currentTargetItemId),
    timestamp: input.timestamp,
  };

  const learningDecision = runLearningEngine(learningInput);

  // ── Step 5: Teacher Response Engine ──────────────────────────────────────────

  const responseContext = buildTeacherResponseContext(
    input,
    stateOutput.updatedSessionMemory,
    learningDecision.difficultyDelta,
    classificationResult.label,
  );

  const teacherInput: TeacherResponseInput = {
    sessionMemory: stateOutput.updatedSessionMemory,
    learningDecision,
    stateEngineOutput: stateOutput,
    classificationResult,
    perceptionBundle,
    responseContext,
    timestamp: input.timestamp,
  };

  const teacherOutput = runTeacherResponseEngine(teacherInput);

  logs.push(...teacherOutput.logsToEmit);

  // ── Step 6: Update recentPraisePhrases and persist target progression ─────────

  const baseMemory = stateOutput.updatedSessionMemory;
  const memWithPraise = teacherOutput.praisePhraseUsed !== null
    ? {
        ...baseMemory,
        recentPraisePhrases: [...baseMemory.recentPraisePhrases, teacherOutput.praisePhraseUsed].slice(-3),
      }
    : baseMemory;

  // Persist activity and target item advancement from the learning engine decision.
  // currentActivityId must be updated every turn so subsequent turns see the new
  // activity (e.g. LISTEN_AND_POINT → REPEAT_AFTER_ME). Without this, the activity
  // is frozen at session-start value and R22 (the only item-advance rule) is never
  // reached, leaving the child stuck on the first vocabulary item indefinitely.
  const memAfterLearning: SessionMemory = {
    ...memWithPraise,
    currentActivityId: learningDecision.nextActivityType,
    ...(learningDecision.nextTargetItemId !== undefined
      ? { currentTargetItemId: learningDecision.nextTargetItemId }
      : {}),
  };

  // Phase 13D: apply exercise bridge AFTER learning engine, so exercise sequence
  // takes precedence over learning engine item advancement.
  const updatedSessionMemory = runExerciseBridge(memAfterLearning, classificationResult.label);

  // ── Step 6B: exercise-advance intercept (Phase 13F) ───────────────────────────
  // If the bridge advanced the exercise, override plan.mainText with the next
  // exercise's authored prompt. This mirrors the paid lesson pattern: teacher text
  // must always reflect post-transition state, never pre-bridge state.
  const prevExerciseId = memAfterLearning.currentExerciseId ?? null;
  const nextExerciseId = updatedSessionMemory.currentExerciseId ?? null;

  if (prevExerciseId !== nextExerciseId) {
    const lesson = memAfterLearning.lessonId ? findLessonById(memAfterLearning.lessonId) : null;

    if (nextExerciseId !== null) {
      // Advanced to next exercise — use its authored prompt.
      const nextExercise = lesson?.exercises?.find(e => e.exerciseId === nextExerciseId) ?? null;
      if (nextExercise) {
        teacherOutput.plan = { ...teacherOutput.plan, mainText: buildExercisePrompt(nextExercise) };
      }
    } else if (prevExerciseId !== null) {
      // Lesson exhausted — use the just-completed exercise's closing prompt.
      const closingExercise = lesson?.exercises?.find(e => e.exerciseId === prevExerciseId) ?? null;
      const closingPrompt = closingExercise
        ? buildExercisePrompt(closingExercise)
        : "Great job today! We're all done!";
      teacherOutput.plan = { ...teacherOutput.plan, mainText: closingPrompt };
    }
  }

  // ── Step 7: Build action packets ──────────────────────────────────────────────

  const updatedTurnNumber = updatedSessionMemory.turnNumber;
  const safeToContinue = stateOutput.stateUpdateSummary.safeToContinue;
  const shouldCloseSession =
    learningDecision.shouldCloseSession || teacherOutput.plan.safetyBlocked;

  const actionPackets = buildActionPackets(
    teacherOutput.plan,
    sessionId,
    updatedTurnNumber,
    shouldCloseSession,
  );

  return {
    sessionId,
    turnNumber: updatedTurnNumber,
    perceptionBundle,
    classificationResult,
    stateEngineOutput: stateOutput,
    learningDecision,
    teacherResponsePlan: teacherOutput.plan,
    updatedSessionMemory,
    actionPackets,
    logsToEmit: logs,
    safeToContinue,
    shouldCloseSession,
    createdAt: new Date().toISOString(),
  };
}
