import type { PerceptionBundle } from '../perception/perception-bundle.js';
import type { TurnRecord } from '../contracts/turn-record.js';
import type { AgeProfile } from '../shared/types.js';
import type { PromptType } from '../shared/enums.js';
import type { LLMClassifier } from './llm-classifier-contract.js';

/** Activity context at the time of classification. */
export interface ActivityContext {
  activityId: string;
  currentTargetItemId: string | null;
  attemptNumber: number;
  modelWasGiven: boolean;
  promptType: PromptType;
}

/**
 * Optional vocabulary context for semantic matching.
 * When provided, enables wrong_but_related detection.
 */
export interface ItemVocabularyContext {
  /** The target word the child should produce. */
  targetWord: string;
  /** Other words in the same semantic category (e.g., other animals). */
  relatedWords: string[];
  /** All words in the current lesson's vocabulary set. */
  vocabularyGroup: string[];
}

/** Full input accepted by the Classification Engine (Phase 3). */
export interface ClassificationInput {
  perception: PerceptionBundle;
  activityContext: ActivityContext;
  recentTurns: TurnRecord[];
  ageProfile: AgeProfile;
  /** Optional — when provided enables wrong_but_related detection. */
  vocabularyContext?: ItemVocabularyContext;
  /** Optional — when provided enables LLM-assisted classification. */
  llmClassifier?: LLMClassifier;
}
