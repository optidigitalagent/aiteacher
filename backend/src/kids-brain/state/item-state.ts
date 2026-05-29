import type { ClassificationLabel } from '../shared/enums.js';

/**
 * Per-vocabulary-item state tracked within a session (§7.2).
 * item_mastery threshold 0.70 = learned for session purposes.
 */
export interface ItemState {
  itemId: string;

  /** 0.0–1.0; threshold 0.70 = learned for session */
  itemMastery: number;

  attemptCount: number;

  /** Was teacher model provided for this item this session? */
  modelGiven: boolean;

  /** Was L1 anchor used for this item this session? */
  l1AnchorUsed: boolean;

  /** Marks item as not comprehended despite full scaffold (Patch 9). */
  comprehensionNotEstablishedThisSession: boolean;

  // ── Added by Phase 4 (State Engine) ────────────────────────────────────────

  /** Count of correct attempts (confident + hesitant + near-correct). */
  correctAttempts: number;

  /** Correct attempts that were prompted by a teacher model. */
  promptedCorrectAttempts: number;

  /** Correct attempts made without teacher model (unprompted). */
  unpromptedCorrectAttempts: number;

  /** Count of L1-language responses for this item. */
  l1Responses: number;

  /** Count of silence responses for this item. */
  silenceCount: number;

  /** Most recent classification label for this item. */
  lastClassification: ClassificationLabel | null;

  /** ISO 8601 timestamp of most recent attempt. */
  lastSeenAt: string | null;
}
