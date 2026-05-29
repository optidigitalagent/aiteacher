import { ClassificationLabel, MasteryLevel } from '../shared/enums.js';
import type { LearningEngineInput, MasteryUpdateCandidate, ProgressionOutcome } from './learning-engine-types.js';
import type { MasteryRecord } from '../contracts/mastery-record.js';

/**
 * Computes a session-scoped mastery update candidate (Phase 5 — no persistence).
 *
 * False mastery guards (spec §13.2):
 * - Single session cannot reach secure or automatic
 * - Prompted correct cannot reach automatic
 * - Timeout fallback cannot update mastery
 * - L1-only answers cannot update production mastery
 * - repeated_after_model is weak evidence
 * - near_correct may support developing but not secure alone
 */
export function computeMasteryUpdateCandidate(
  input: LearningEngineInput,
  _outcome: ProgressionOutcome,
): MasteryUpdateCandidate | null {
  const { classificationResult, currentItemContext, stateEngineOutput } = input;
  const label = classificationResult.label;
  const isTimeoutFallback = classificationResult.source === 'timeout_fallback';
  const currentRecord = currentItemContext.masteryRecord;
  const currentLevel = currentRecord?.masteryLevel ?? MasteryLevel.EMERGING;
  const itemId = currentItemContext.itemId;

  // GUARD: timeout_fallback cannot update mastery (spec §13.2, Patch 4)
  if (isTimeoutFallback) {
    return {
      itemId,
      itemType: 'vocabulary',
      proposedLevel: currentLevel,
      evidence: [],
      eligibleForPersistence: false,
      blockedReasons: ['timeout_fallback source cannot update mastery'],
    };
  }

  // GUARD: L1-only answers cannot update production mastery
  if (label === ClassificationLabel.L1_TRANSLATION || label === ClassificationLabel.L1_HELP_REQUEST) {
    return {
      itemId,
      itemType: 'vocabulary',
      proposedLevel: currentLevel,
      evidence: ['L1 answer confirms comprehension only'],
      eligibleForPersistence: false,
      blockedReasons: ['L1-only answer cannot update production mastery'],
    };
  }

  // GUARD: No mastery update for non-classification labels
  if (!classificationResult.eligibleForMasteryUpdate) {
    return null;
  }

  // Build evidence list and determine proposed level
  const evidence: string[] = [];
  const blockedReasons: string[] = [];
  let eligibleForPersistence = true;

  evidence.push(`classification: ${label}`);
  evidence.push(`confidence: ${classificationResult.confidence.toFixed(2)}`);

  // Determine delta evidence strength from label
  const isModelGiven = input.currentActivityContext.modelWasGiven;

  if (label === ClassificationLabel.REPEATED_AFTER_MODEL) {
    evidence.push('evidence_weight: weak (repeated_after_model)');
    blockedReasons.push('repeated_after_model is weak evidence — cannot reach developing alone');
    eligibleForPersistence = false;
  } else if (label === ClassificationLabel.NEAR_CORRECT) {
    evidence.push('evidence_weight: partial (near_correct supports developing)');
    // Near correct may support developing but never secure alone
    if (currentLevel === MasteryLevel.DEVELOPING) {
      blockedReasons.push('near_correct alone is insufficient to advance beyond developing');
      eligibleForPersistence = false;
    }
  } else if (isModelGiven) {
    evidence.push('evidence_weight: moderate (prompted correct)');
    blockedReasons.push('prompted correct cannot produce automatic mastery');
    // Allow developing but block automatic
  } else if (label === ClassificationLabel.CORRECT_CONFIDENT) {
    evidence.push('evidence_weight: strong (unprompted correct_confident)');
  } else if (label === ClassificationLabel.CORRECT_HESITANT) {
    evidence.push('evidence_weight: moderate (correct_hesitant)');
  }

  // Compute proposed mastery level
  const proposedLevel = computeProposedMasteryLevel(
    label,
    currentLevel,
    currentRecord,
    isModelGiven,
    evidence,
    blockedReasons,
  );

  // HARD GUARD: single session cannot reach secure or automatic (spec §13.2)
  const isSingleSessionOnly = currentRecord === null || currentRecord.sessionsSeen <= 1;
  if (isSingleSessionOnly && (proposedLevel === MasteryLevel.SECURE || proposedLevel === MasteryLevel.AUTOMATIC)) {
    blockedReasons.push('single session cannot produce secure or automatic mastery');
    eligibleForPersistence = false;
    return {
      itemId,
      itemType: 'vocabulary',
      proposedLevel: MasteryLevel.DEVELOPING, // cap at developing for single session
      evidence,
      eligibleForPersistence: false,
      blockedReasons,
    };
  }

  // HARD GUARD: prompted correct cannot produce automatic (spec §13.2)
  if (isModelGiven && proposedLevel === MasteryLevel.AUTOMATIC) {
    blockedReasons.push('prompted correct cannot produce automatic mastery');
    eligibleForPersistence = false;
  }

  return {
    itemId,
    itemType: 'vocabulary',
    proposedLevel,
    evidence,
    eligibleForPersistence: eligibleForPersistence && blockedReasons.length === 0,
    blockedReasons,
  };
}

function computeProposedMasteryLevel(
  label: ClassificationLabel,
  currentLevel: MasteryLevel,
  record: MasteryRecord | null,
  isModelGiven: boolean,
  evidence: string[],
  blockedReasons: string[],
): MasteryLevel {
  // Downgrade labels that do not merit advancement
  if (
    label === ClassificationLabel.REPEATED_AFTER_MODEL ||
    label === ClassificationLabel.NEAR_CORRECT
  ) {
    // These may stabilise at current level but cannot advance
    return currentLevel;
  }

  // For correct answers, check advancement criteria
  if (
    label === ClassificationLabel.CORRECT_CONFIDENT ||
    label === ClassificationLabel.CORRECT_HESITANT
  ) {
    return tryAdvanceMasteryLevel(currentLevel, record, isModelGiven, evidence, blockedReasons);
  }

  return currentLevel;
}

function tryAdvanceMasteryLevel(
  current: MasteryLevel,
  record: MasteryRecord | null,
  isModelGiven: boolean,
  evidence: string[],
  blockedReasons: string[],
): MasteryLevel {
  switch (current) {
    case MasteryLevel.EMERGING: {
      // emerging → developing: correct_comprehension >= 2 in same session (spec §13.1)
      const compCount = (record?.correctComprehensionCount ?? 0) + 1;
      if (compCount >= 2) {
        evidence.push('emerging→developing: comprehension count met');
        return MasteryLevel.DEVELOPING;
      }
      return MasteryLevel.EMERGING;
    }

    case MasteryLevel.DEVELOPING: {
      // developing → secure requires cross-session evidence (cannot in single session)
      blockedReasons.push('developing→secure requires ≥2 sessions of correct production');
      return MasteryLevel.DEVELOPING;
    }

    case MasteryLevel.SECURE: {
      // secure → automatic requires extensive evidence + time (cannot in single session)
      if (isModelGiven) {
        blockedReasons.push('prompted correct cannot produce automatic mastery');
        return MasteryLevel.SECURE;
      }
      blockedReasons.push('secure→automatic requires ≥5 sessions + 2 weeks since introduction');
      return MasteryLevel.SECURE;
    }

    case MasteryLevel.AUTOMATIC:
      return MasteryLevel.AUTOMATIC;
  }
}
