import { randomUUID } from 'node:crypto';
import {
  ActivityType,
  LessonPhase,
  RecoveryState,
  TeacherActionCode,
  FeedbackTone,
  LogSeverity,
} from '../shared/enums.js';
import { LOG_EVENTS } from '../shared/log-events.js';
import type { LogEvent } from '../shared/log-events.js';
import type { SessionMemory } from '../contracts/session-memory.js';
import type { CostCounters } from '../shared/types.js';
import { createInitialChildState } from '../state-engine/child-state-updater.js';
import { buildTeacherResponsePlan } from '../teacher-response/teacher-response-plan.js';
import type { TeacherResponsePlan } from '../teacher-response/teacher-response-plan.js';
import type { RuntimeActionPacket, KidsBrainSessionStartInput } from './runtime-types.js';
import { RuntimeActionPacketType } from './runtime-types.js';
import type { RuntimeSessionStartResult } from './runtime-result.js';

const DEFAULT_TTS_VOICE = 'default_teacher_v1';

/** Scripted lesson opening greeting (spec §10.2 — never LLM-generated). */
const GREETING_TEXT = "Hello! Let's play and learn English! Are you ready?";
const GREETING_FALLBACK = "Hello! Ready to learn?";

/** Creates the initial CostCounters with all counters zeroed. */
function createInitialCostCounters(): CostCounters {
  return {
    tokensGenerated: 0,
    llmCallsClassification: 0,
    llmCallsTeacherResponse: 0,
    sttSeconds: 0,
    ttsCharacters: 0,
    turnCount: 0,
  };
}

/**
 * Creates the initial SessionMemory for a new Kids Brain session.
 *
 * - mode is always 'mentium_kids'
 * - No persistence (no Redis/Postgres)
 * - Recovery state starts at NORMAL
 * - Lesson phase starts at WARM_UP
 */
function buildInitialSessionMemory(
  input: KidsBrainSessionStartInput,
): SessionMemory {
  return {
    sessionId: input.sessionId,
    userId: input.userId,
    childId: input.childId,
    mode: 'mentium_kids',

    ageProfile: input.ageProfile,
    ageBand: input.ageBand,

    currentUnitId: null,
    currentActivityId: ActivityType.LISTEN_AND_POINT,
    // Phase 8.8: seed first target word from lesson vocabulary so classifiers have a non-null target.
    currentTargetItemId: input.lessonTargetWords[0] ?? null,
    currentItemAttemptCount: 0,
    lessonPhase: LessonPhase.WARM_UP,

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

    startedAt: input.timestamp,
    updatedAt: input.timestamp,
    sessionElapsedMs: 0,
    turnNumber: 0,
  };
}

/**
 * Builds the scripted opening greeting TeacherResponsePlan.
 * The greeting is never LLM-generated (spec §10.2).
 */
function buildGreetingPlan(sessionId: string): TeacherResponsePlan {
  return buildTeacherResponsePlan({
    responseId: randomUUID(),
    sessionId,
    turnNumber: 0,
    teacherActionCode: TeacherActionCode.OPEN_LESSON,
    responseMode: 'scripted',
    mainText: GREETING_TEXT,
    fallbackText: GREETING_FALLBACK,
    allowedVocabularyUsed: [],
    blockedVocabulary: [],
    placeholdersRemoved: false,
    requiresLLM: false,
    safetyBlocked: false,
    emotionalTone: FeedbackTone.CELEBRATORY,
  });
}

/** Converts the greeting plan into action packets for the frontend. */
function buildGreetingPackets(
  plan: TeacherResponsePlan,
  sessionId: string,
): RuntimeActionPacket[] {
  return [
    {
      packetType: RuntimeActionPacketType.TEACHER_TEXT,
      sessionId,
      turnNumber: 0,
      teacherText: plan.mainText,
      feedbackTone: plan.emotionalTone,
      waitMs: 2000,
      nextPrompt: null,
      teacherActionCode: plan.teacherActionCode,
      ttsVoiceId: DEFAULT_TTS_VOICE,
    },
    {
      packetType: RuntimeActionPacketType.START_LISTENING,
      sessionId,
      turnNumber: 0,
      waitMs: 0,
      ttsVoiceId: DEFAULT_TTS_VOICE,
    },
  ];
}

/**
 * Starts a new Kids Brain session.
 *
 * Creates the initial SessionMemory, produces a scripted opening greeting,
 * and returns action packets for the frontend to execute.
 *
 * Phase 7 constraints:
 * - No persistence
 * - No LLM calls
 * - No TTS generation
 * - No Redis/Postgres
 */
export function startKidsBrainSession(
  input: KidsBrainSessionStartInput,
): RuntimeSessionStartResult {
  const logs: LogEvent[] = [];

  const sessionMemory = buildInitialSessionMemory(input);

  logs.push({
    event: LOG_EVENTS.KIDS_SESSION_STARTED,
    severity: LogSeverity.INFO,
    sessionId: input.sessionId,
    turnNumber: null,
    timestamp: input.timestamp,
    payload: {
      childId: input.childId,
      ageBand: input.ageBand,
      lessonTargetWords: input.lessonTargetWords.length,
    },
  });

  const greetingPlan = buildGreetingPlan(input.sessionId);
  const actionPackets = buildGreetingPackets(greetingPlan, input.sessionId);

  return {
    sessionMemory,
    greetingPlan,
    actionPackets,
    logsToEmit: logs,
    createdAt: input.timestamp,
  };
}
