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

import { LogSeverity, TeacherActionCode, FeedbackTone } from '../shared/enums.js';
import { LOG_EVENTS } from '../shared/log-events.js';
import type { LogEvent } from '../shared/log-events.js';

import { buildPerceptionBundle } from '../perception/perception-builder.js';
import type { PerceptionInput } from '../perception/perception-types.js';

import { classifyResponse } from '../classification/classification-router.js';
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
import {
  buildActivityContext,
  buildPromptContext,
  buildChildStateSnapshot,
  buildCurrentItemContext,
  buildAvailableItems,
  buildAvailableActivities,
  buildTeacherResponseContext,
} from './runtime-context.js';
import type { TeacherResponsePlan } from '../teacher-response/teacher-response-plan.js';

const DEFAULT_TTS_VOICE = 'default_teacher_v1';

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
    },
  ));

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

  // ── Step 6: Build action packets ──────────────────────────────────────────────

  const updatedTurnNumber = stateOutput.updatedSessionMemory.turnNumber;
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
    updatedSessionMemory: stateOutput.updatedSessionMemory,
    actionPackets,
    logsToEmit: logs,
    safeToContinue,
    shouldCloseSession,
    createdAt: new Date().toISOString(),
  };
}
