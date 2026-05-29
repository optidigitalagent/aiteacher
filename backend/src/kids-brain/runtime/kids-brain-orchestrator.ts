/**
 * Kids Brain Orchestrator — Phase 7 public API.
 *
 * Connects the four runtime entry points:
 *   startKidsBrainSession()
 *   processKidsBrainTurn()
 *   processKidsBrainSilence()
 *   endKidsBrainSession()
 *
 * This is internal orchestration only (Phase 7 scope).
 * Not wired to production WebSocket yet.
 */

import { LogSeverity, TeacherActionCode, FeedbackTone } from '../shared/enums.js';
import { LOG_EVENTS } from '../shared/log-events.js';
import type { LogEvent } from '../shared/log-events.js';
import type { SessionMemory } from '../contracts/session-memory.js';
import { buildTeacherResponsePlan } from '../teacher-response/teacher-response-plan.js';
import type { RuntimeActionPacket, KidsBrainSessionStartInput, KidsBrainTurnInput, KidsBrainSilenceInput } from './runtime-types.js';
import { RuntimeActionPacketType } from './runtime-types.js';
import type { RuntimeSessionStartResult, RuntimeTurnResult, RuntimeEndResult } from './runtime-result.js';
import { startKidsBrainSession } from './session-bootstrap.js';
import { processKidsBrainTurn } from './turn-processor.js';
import { processKidsBrainSilence } from './silence-processor.js';
import { randomUUID } from 'node:crypto';

const DEFAULT_TTS_VOICE = 'default_teacher_v1';

const SESSION_CLOSE_TEXT = "Great work today! See you next time! Bye-bye!";
const SESSION_CLOSE_FALLBACK = "Goodbye! Well done!";

/**
 * Ends a Kids Brain session.
 *
 * Produces a safe closing result:
 * - Scripted closing teacher utterance
 * - SESSION_COMPLETE action packet
 * - No TTS, no external API calls, no persistence
 */
export async function endKidsBrainSession(
  sessionMemory: SessionMemory,
): Promise<RuntimeEndResult> {
  const logs: LogEvent[] = [];
  const sessionId = sessionMemory.sessionId;
  const turnNumber = sessionMemory.turnNumber;

  const closingPlan = buildTeacherResponsePlan({
    responseId: randomUUID(),
    sessionId,
    turnNumber,
    teacherActionCode: TeacherActionCode.CLOSE_LESSON,
    responseMode: 'scripted',
    mainText: SESSION_CLOSE_TEXT,
    fallbackText: SESSION_CLOSE_FALLBACK,
    allowedVocabularyUsed: [],
    blockedVocabulary: [],
    placeholdersRemoved: false,
    requiresLLM: false,
    safetyBlocked: false,
    emotionalTone: FeedbackTone.CELEBRATORY,
  });

  const actionPackets: RuntimeActionPacket[] = [
    {
      packetType: RuntimeActionPacketType.TEACHER_TEXT,
      sessionId,
      turnNumber,
      teacherText: closingPlan.mainText,
      feedbackTone: closingPlan.emotionalTone,
      waitMs: 2000,
      nextPrompt: null,
      teacherActionCode: closingPlan.teacherActionCode,
      ttsVoiceId: DEFAULT_TTS_VOICE,
    },
    {
      packetType: RuntimeActionPacketType.SESSION_COMPLETE,
      sessionId,
      turnNumber,
      ttsVoiceId: DEFAULT_TTS_VOICE,
    },
  ];

  logs.push({
    event: LOG_EVENTS.SESSION_COMPLETED,
    severity: LogSeverity.INFO,
    sessionId,
    turnNumber,
    timestamp: new Date().toISOString(),
    payload: {
      totalTurns: turnNumber,
      sessionElapsedMs: sessionMemory.sessionElapsedMs,
    },
  });

  return {
    sessionId,
    finalSessionMemory: sessionMemory,
    actionPackets,
    logsToEmit: logs,
    createdAt: new Date().toISOString(),
  };
}

// Re-export the full Phase 7 API
export {
  startKidsBrainSession,
  processKidsBrainTurn,
  processKidsBrainSilence,
};

export type {
  KidsBrainSessionStartInput,
  KidsBrainTurnInput,
  KidsBrainSilenceInput,
};
