import type { PerceptionBundle } from '../perception/perception-bundle.js';
import type { ResponseClassificationResult } from '../classification/classification-result.js';
import type { StateEngineOutput } from '../state-engine/state-update-result.js';
import type { LearningDecision } from '../learning-engine/learning-decision.js';
import type { TeacherResponsePlan } from '../teacher-response/teacher-response-plan.js';
import type { SessionMemory } from '../contracts/session-memory.js';
import type { LogEvent } from '../shared/log-events.js';
import type { RuntimeActionPacket } from './runtime-types.js';

/**
 * Full result of processing one turn through the Kids Brain pipeline (Phase 7).
 * Contains the output of every pipeline stage for observability and testing.
 *
 * Spec §Phase 7 RuntimeTurnResult fields.
 */
export interface RuntimeTurnResult {
  sessionId: string;
  turnNumber: number;
  perceptionBundle: PerceptionBundle;
  classificationResult: ResponseClassificationResult;
  stateEngineOutput: StateEngineOutput;
  learningDecision: LearningDecision;
  teacherResponsePlan: TeacherResponsePlan;
  updatedSessionMemory: SessionMemory;
  actionPackets: RuntimeActionPacket[];
  logsToEmit: LogEvent[];
  safeToContinue: boolean;
  shouldCloseSession: boolean;
  createdAt: string; // ISO 8601
}

/** Result of startKidsBrainSession(). */
export interface RuntimeSessionStartResult {
  sessionMemory: SessionMemory;
  greetingPlan: TeacherResponsePlan;
  actionPackets: RuntimeActionPacket[];
  logsToEmit: LogEvent[];
  createdAt: string; // ISO 8601
}

/** Result of endKidsBrainSession(). */
export interface RuntimeEndResult {
  sessionId: string;
  finalSessionMemory: SessionMemory;
  actionPackets: RuntimeActionPacket[];
  logsToEmit: LogEvent[];
  createdAt: string; // ISO 8601
}
