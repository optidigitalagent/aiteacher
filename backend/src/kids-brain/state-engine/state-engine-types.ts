import type { ActivityContext } from '../classification/classification-types.js';
import type { PerceptionBundle } from '../perception/perception-bundle.js';
import type { ResponseClassificationResult } from '../classification/classification-result.js';
import type { SessionMemory } from '../contracts/session-memory.js';
import type { RecoveryState } from '../shared/enums.js';

/** Full input contract for the State Engine (Phase 4). */
export interface StateEngineInput {
  sessionMemory: SessionMemory;
  perceptionBundle: PerceptionBundle;
  classificationResult: ResponseClassificationResult;
  currentActivityContext: ActivityContext;
  /** ISO 8601 timestamp for this processing turn. */
  timestamp: string;
}

/** Deltas applied to confidence scores this turn (0–1 session scale). */
export interface ConfidenceDeltas {
  comprehensionDelta: number;
  productionDelta: number;
  pronunciationDelta: number;
  emotionalSafetyDelta: number;
  frustrationRiskDelta: number;
  engagementDelta: number;
  l1DependencyDelta: number;
  noveltyNeedDelta: number;
  activityFatigueDelta: number;
  sessionStaminaDelta: number;
  refusalRiskDelta: number;
}

/** Deltas applied to item-state counters this turn. */
export interface ItemStateDeltas {
  attemptsAdded: number;
  correctAttemptsAdded: number;
  promptedCorrectAdded: number;
  unpromptedCorrectAdded: number;
  l1ResponsesAdded: number;
  silenceCountAdded: number;
}

/** Cost counter deltas for this turn (Phase 4). */
export interface CostCounterDelta {
  sttSeconds: number;
  llmClassificationCalls: number;
  llmTeacherCalls: number;
  ttsCharacters: number;
  turnCount: number;
}

/** Full summary of all state changes that occurred this turn. */
export interface StateUpdateSummary {
  turnNumber: number;
  previousRecoveryState: RecoveryState;
  newRecoveryState: RecoveryState;
  /** 0–1 session scale */
  previousEngagementLevel: number;
  /** 0–1 session scale */
  newEngagementLevel: number;
  confidenceDeltas: ConfidenceDeltas;
  itemStateDeltas: ItemStateDeltas;
  costCounterDeltas: CostCounterDelta;
  recentSuccessCountDelta: number;
  recentFailureCountDelta: number;
  shouldEnterRecovery: boolean;
  shouldExitRecovery: boolean;
  /** False only when label is unsafe_or_sensitive. */
  safeToContinue: boolean;
  createdAt: string; // ISO 8601
}
