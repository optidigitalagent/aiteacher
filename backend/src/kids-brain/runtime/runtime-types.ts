import type { STTResult } from '../contracts/stt-result.js';
import type { SessionMemory } from '../contracts/session-memory.js';
import type { TeacherActionCode, FeedbackTone, AgeBand } from '../shared/enums.js';
import type { AgeProfile } from '../shared/types.js';

/**
 * Runtime action packet types (Phase 7).
 * Distinct from TeacherActionCode — these are orchestrator-level lifecycle signals.
 * Audio packets are not generated in Phase 7.
 */
export enum RuntimeActionPacketType {
  TEACHER_TEXT = 'teacher_text',
  START_LISTENING = 'start_listening',
  STOP_LISTENING = 'stop_listening',
  SESSION_COMPLETE = 'session_complete',
  SAFETY_CLOSE = 'safety_close',
}

/**
 * A single action packet emitted by the Kids Brain runtime orchestrator.
 * The frontend executes it without interpretation.
 */
export interface RuntimeActionPacket {
  packetType: RuntimeActionPacketType;
  sessionId: string;
  turnNumber: number;
  /** Teacher utterance text; present for TEACHER_TEXT and SAFETY_CLOSE packets. */
  teacherText?: string;
  feedbackTone?: FeedbackTone;
  /** Milliseconds frontend waits after TTS before the next prompt. */
  waitMs?: number;
  nextPrompt?: string | null;
  teacherActionCode?: TeacherActionCode;
  /** TTS voice identifier — placeholder value in Phase 7 (no TTS generated). */
  ttsVoiceId: string;
}

/** Input for a normal speech turn through the full Kids Brain pipeline. */
export interface KidsBrainTurnInput {
  sessionMemory: SessionMemory;
  sttResult: STTResult;
  responseLatencyMs: number | null;
  silenceDurationMs: number;
  /** Number of attempts on the current item this session. */
  attemptCount: number;
  /** Target word the child should produce (e.g. "dog"). null if no active item. */
  targetWord: string | null;
  /**
   * Child's display name — used in teacher utterances.
   * Defaults to "friend" if omitted (Phase 7: no persistence, name not in SessionMemory).
   */
  childFirstName?: string;
  /** Session target vocabulary words (lesson scope). */
  lessonTargetWords: string[];
  /** Review words from the current unit. */
  unitReviewWords: string[];
  /** Character names active in this lesson. */
  characterNames: string[];
  forcedChoiceOptionA?: string;
  forcedChoiceOptionB?: string;
  timestamp: string; // ISO 8601
}

/** Input for a silence turn (no child speech detected). */
export interface KidsBrainSilenceInput {
  sessionMemory: SessionMemory;
  silenceDurationMs: number;
  targetWord: string | null;
  childFirstName?: string;
  lessonTargetWords: string[];
  unitReviewWords: string[];
  characterNames: string[];
  timestamp: string; // ISO 8601
}

/** Input for starting a new Kids Brain session. */
export interface KidsBrainSessionStartInput {
  sessionId: string;
  userId: string;
  childId: string;
  childFirstName: string;
  ageBand: AgeBand;
  ageProfile: AgeProfile;
  lessonTargetWords: string[];
  unitReviewWords: string[];
  characterNames: string[];
  timestamp: string; // ISO 8601
}
