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
}
