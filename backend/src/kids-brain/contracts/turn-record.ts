import type {
  ClassificationLabel,
  ClassificationPath,
  LessonPhase,
  TeacherActionCode,
  ActivityType,
} from '../shared/enums.js';

/**
 * Canonical per-turn event record stored in session memory (last 5 turns) — Patch 10 §4.3.
 * All fields use closed enum types; no free string literals outside those enums.
 */
export interface TurnRecord {
  turnNumber: number; // Monotonic, starts at 1 for session

  // Input
  sttTextNormalized: string | null; // Romanized, lowercased; never raw
  responseLatencyMs: number | null;
  silenceDurationMs: number;
  l1Detected: boolean;

  // Classification result
  classificationLabel: ClassificationLabel;
  classificationConfidence: number; // 0.0–1.0
  classificationPath: ClassificationPath;

  // Context at time of turn
  targetItemId: string | null;
  activityId: ActivityType;
  lessonPhase: LessonPhase;
  attemptNumber: number; // Attempts on this item in this session
  modelWasGiven: boolean; // Was teacher model provided before this response?

  // Decision taken
  actionTaken: TeacherActionCode;
  recoveryOverride: boolean; // Did recovery module override activity engine?

  // Outcome
  wasSuccess: boolean; // true for correct_confident, correct_hesitant, near_correct
  masteryDelta: number; // Change applied to item mastery this turn (0 if no update)

  completedAt: string; // ISO 8601
}
