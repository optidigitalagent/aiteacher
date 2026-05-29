import type { TeacherActionCode, FeedbackTone } from '../shared/enums.js';

/**
 * Typed action packet emitted by the backend to the frontend (Patch 12).
 * The frontend executes it without interpretation — no pedagogical logic on client.
 * The `action` field is a closed enum; no free strings may pass through.
 */
export interface ActionPacket {
  action: TeacherActionCode;
  teacherText: string; // Vocabulary-guard-approved utterance
  feedbackTone: FeedbackTone;
  waitMs: number; // Milliseconds to wait after TTS before next prompt
  nextPrompt: string | null; // null if session ending
  ttsVoiceId: string; // TTS voice identifier for this teacher character
  sessionId: string;
  turnNumber: number; // For idempotent replay on reconnect
}
