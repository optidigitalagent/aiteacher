import { ClassificationLabel } from '../shared/enums.js';
import type { ConfidenceDeltas } from './state-engine-types.js';
import type { ActivityContext } from '../classification/classification-types.js';
import type { ChildState } from '../state/child-state.js';
import type { SessionMemory } from '../contracts/session-memory.js';

// ── Named delta constants (0–100 engine scale, per §7.1 and §8.1) ────────────
// All values are [C]-marked — conservative first-pass; require empirical calibration.

const COMPREHENSION_CORRECT_CONFIDENT = 15;
const COMPREHENSION_CORRECT_HESITANT = 8;
const COMPREHENSION_NEAR_CORRECT = 8;
const COMPREHENSION_PRONUNCIATION_VARIANT = 5;
const COMPREHENSION_PARTIAL_ANSWER = 5;
const COMPREHENSION_L1_TRANSLATION = 8; // §7.1: +0.08
const COMPREHENSION_WRONG_SEMANTIC = -10; // §7.1: −0.10 (conservative — do not punish harshly)
const COMPREHENSION_WRONG_BUT_RELATED = -5;
const COMPREHENSION_SILENCE_LONG = -5; // §7.1: −0.05

const PRODUCTION_CORRECT_CONFIDENT = 12; // §7.1: +0.12
const PRODUCTION_CORRECT_HESITANT = 6;   // §7.1: +0.06
const PRODUCTION_NEAR_CORRECT = 6;
const PRODUCTION_PRONUNCIATION_VARIANT = 4;
const PRODUCTION_WRONG_SEMANTIC = -5;    // §7.1: −0.05 (conservative)
const PRODUCTION_WRONG_BUT_RELATED = -3;
const PRODUCTION_REFUSAL = -8;           // §7.1: −0.08
const PRODUCTION_L1_REFUSAL = -4;
// L1 translation: comprehension signal only, NOT a production boost
const PRODUCTION_L1_TRANSLATION = 0;

const PRONUNCIATION_NEAR_CORRECT = 5;
const PRONUNCIATION_PRONUNCIATION_VARIANT = 8;
const PRONUNCIATION_CORRECT_CONFIDENT = 3;

const EMOTIONAL_SAFETY_CORRECT_CONFIDENT = 8;  // §7.1: +0.08
const EMOTIONAL_SAFETY_CORRECT_HESITANT = 4;
const EMOTIONAL_SAFETY_REPEATED_FAILURE = -10; // §7.1: −0.10 per event
const EMOTIONAL_SAFETY_REFUSAL = -8;           // §7.1: −0.08
const EMOTIONAL_SAFETY_EMOTIONAL_SHUTDOWN = -12;

const FRUSTRATION_CORRECT_CONFIDENT = -15;     // §7.1: −0.15
const FRUSTRATION_CORRECT_HESITANT = -8;
const FRUSTRATION_REFUSAL = 20;               // §7.1: +0.20
const FRUSTRATION_L1_REFUSAL = 15;
const FRUSTRATION_WRONG_SEMANTIC = 8;          // gradual increase on wrong
const FRUSTRATION_WRONG_BUT_RELATED = 5;
const FRUSTRATION_EMOTIONAL_SHUTDOWN = 20;

const L1_DEPENDENCY_L1_TRANSLATION = 3;       // §7.1 increase l1Dependency slightly
const L1_DEPENDENCY_L1_HELP_REQUEST = 2;
const L1_DEPENDENCY_L1_REFUSAL = 4;
const L1_DEPENDENCY_CODE_SWITCH = 2;

const REFUSAL_RISK_REFUSAL = 20;
const REFUSAL_RISK_L1_REFUSAL = 15;
const REFUSAL_RISK_EMOTIONAL_SHUTDOWN = 25;
const REFUSAL_RISK_CORRECT_CONFIDENT = -5;

const NOVELTY_NEED_SAME_ACTIVITY = 7;          // §7.1: +0.07 per turn same activity
const NOVELTY_NEED_ACTIVITY_SWITCH = -100;     // Reset on switch (clamps to 0)

const ACTIVITY_FATIGUE_SAME_ACTIVITY = 7;      // §7.1: +0.07 per turn same activity
const ACTIVITY_FATIGUE_SWITCH = -100;          // Reset on switch

const SESSION_STAMINA_REFUSAL = -8;
const SESSION_STAMINA_EMOTIONAL_SHUTDOWN = -12;

/**
 * Computes immutable confidence deltas (0–1 session scale) for all ChildState
 * variables based on the classification label.
 *
 * Phase 4 rule: wrong answers trigger gentle scaffolding signals, not punishment.
 * Silence does not count as failure.
 */
export function computeConfidenceDeltas(
  label: ClassificationLabel,
  childState: ChildState,
  activityContext: ActivityContext,
  sessionMemory: SessionMemory,
): ConfidenceDeltas {
  const activitySwitched =
    sessionMemory.currentActivityId !== null &&
    activityContext.activityId !== sessionMemory.currentActivityId;

  // Convert 0–100 engine-scale delta to 0–1 session-scale delta.
  // Do NOT use engineToSessionScore() here — that clamps to [0,1] and would zero out negatives.
  // Clamping of the final value happens in applyChildStateDeltas via clampSessionScore().
  const s = (engineDelta: number) => engineDelta / 100;

  switch (label) {
    case ClassificationLabel.CORRECT_CONFIDENT:
      return {
        comprehensionDelta: s(COMPREHENSION_CORRECT_CONFIDENT),
        productionDelta: s(PRODUCTION_CORRECT_CONFIDENT),
        pronunciationDelta: s(PRONUNCIATION_CORRECT_CONFIDENT),
        emotionalSafetyDelta: s(EMOTIONAL_SAFETY_CORRECT_CONFIDENT),
        frustrationRiskDelta: s(FRUSTRATION_CORRECT_CONFIDENT),
        engagementDelta: s(7), // §7.1: +0.07
        l1DependencyDelta: 0,
        noveltyNeedDelta: activitySwitched ? s(NOVELTY_NEED_ACTIVITY_SWITCH) : s(NOVELTY_NEED_SAME_ACTIVITY),
        activityFatigueDelta: activitySwitched ? s(ACTIVITY_FATIGUE_SWITCH) : s(ACTIVITY_FATIGUE_SAME_ACTIVITY),
        sessionStaminaDelta: 0,
        refusalRiskDelta: s(REFUSAL_RISK_CORRECT_CONFIDENT),
      };

    case ClassificationLabel.CORRECT_HESITANT:
      return {
        comprehensionDelta: s(COMPREHENSION_CORRECT_HESITANT),
        productionDelta: s(PRODUCTION_CORRECT_HESITANT),
        pronunciationDelta: 0,
        emotionalSafetyDelta: s(EMOTIONAL_SAFETY_CORRECT_HESITANT),
        frustrationRiskDelta: s(FRUSTRATION_CORRECT_HESITANT),
        engagementDelta: s(4),
        l1DependencyDelta: 0,
        noveltyNeedDelta: activitySwitched ? s(NOVELTY_NEED_ACTIVITY_SWITCH) : s(NOVELTY_NEED_SAME_ACTIVITY),
        activityFatigueDelta: activitySwitched ? s(ACTIVITY_FATIGUE_SWITCH) : s(ACTIVITY_FATIGUE_SAME_ACTIVITY),
        sessionStaminaDelta: 0,
        refusalRiskDelta: 0,
      };

    case ClassificationLabel.NEAR_CORRECT:
      return {
        comprehensionDelta: s(COMPREHENSION_NEAR_CORRECT),
        productionDelta: s(PRODUCTION_NEAR_CORRECT),
        pronunciationDelta: s(PRONUNCIATION_NEAR_CORRECT),
        emotionalSafetyDelta: s(4),
        frustrationRiskDelta: s(-5),
        engagementDelta: s(3),
        l1DependencyDelta: 0,
        noveltyNeedDelta: activitySwitched ? s(NOVELTY_NEED_ACTIVITY_SWITCH) : s(NOVELTY_NEED_SAME_ACTIVITY),
        activityFatigueDelta: activitySwitched ? s(ACTIVITY_FATIGUE_SWITCH) : s(ACTIVITY_FATIGUE_SAME_ACTIVITY),
        sessionStaminaDelta: 0,
        refusalRiskDelta: 0,
      };

    case ClassificationLabel.PRONUNCIATION_VARIANT:
      return {
        comprehensionDelta: s(COMPREHENSION_PRONUNCIATION_VARIANT),
        productionDelta: s(PRODUCTION_PRONUNCIATION_VARIANT),
        pronunciationDelta: s(PRONUNCIATION_PRONUNCIATION_VARIANT),
        emotionalSafetyDelta: s(3),
        frustrationRiskDelta: s(-3),
        engagementDelta: s(3),
        l1DependencyDelta: 0,
        noveltyNeedDelta: activitySwitched ? s(NOVELTY_NEED_ACTIVITY_SWITCH) : s(NOVELTY_NEED_SAME_ACTIVITY),
        activityFatigueDelta: activitySwitched ? s(ACTIVITY_FATIGUE_SWITCH) : s(ACTIVITY_FATIGUE_SAME_ACTIVITY),
        sessionStaminaDelta: 0,
        refusalRiskDelta: 0,
      };

    case ClassificationLabel.PARTIAL_ANSWER:
      return {
        comprehensionDelta: s(COMPREHENSION_PARTIAL_ANSWER),
        productionDelta: s(2),
        pronunciationDelta: 0,
        emotionalSafetyDelta: s(2),
        frustrationRiskDelta: 0,
        engagementDelta: s(2),
        l1DependencyDelta: 0,
        noveltyNeedDelta: activitySwitched ? s(NOVELTY_NEED_ACTIVITY_SWITCH) : s(NOVELTY_NEED_SAME_ACTIVITY),
        activityFatigueDelta: activitySwitched ? s(ACTIVITY_FATIGUE_SWITCH) : s(ACTIVITY_FATIGUE_SAME_ACTIVITY),
        sessionStaminaDelta: 0,
        refusalRiskDelta: 0,
      };

    case ClassificationLabel.REPEATED_AFTER_MODEL:
      return {
        comprehensionDelta: s(3),
        productionDelta: s(1),
        pronunciationDelta: s(2),
        emotionalSafetyDelta: s(2),
        frustrationRiskDelta: s(-3),
        engagementDelta: s(2),
        l1DependencyDelta: 0,
        noveltyNeedDelta: activitySwitched ? s(NOVELTY_NEED_ACTIVITY_SWITCH) : s(NOVELTY_NEED_SAME_ACTIVITY),
        activityFatigueDelta: activitySwitched ? s(ACTIVITY_FATIGUE_SWITCH) : s(ACTIVITY_FATIGUE_SAME_ACTIVITY),
        sessionStaminaDelta: 0,
        refusalRiskDelta: 0,
      };

    case ClassificationLabel.WRONG_SEMANTIC:
      return {
        comprehensionDelta: s(COMPREHENSION_WRONG_SEMANTIC),
        productionDelta: s(PRODUCTION_WRONG_SEMANTIC),
        pronunciationDelta: 0,
        emotionalSafetyDelta: 0, // do not punish emotionally
        frustrationRiskDelta: s(FRUSTRATION_WRONG_SEMANTIC),
        engagementDelta: 0,
        l1DependencyDelta: 0,
        noveltyNeedDelta: activitySwitched ? s(NOVELTY_NEED_ACTIVITY_SWITCH) : s(NOVELTY_NEED_SAME_ACTIVITY),
        activityFatigueDelta: activitySwitched ? s(ACTIVITY_FATIGUE_SWITCH) : s(ACTIVITY_FATIGUE_SAME_ACTIVITY),
        sessionStaminaDelta: 0,
        refusalRiskDelta: 0,
      };

    case ClassificationLabel.WRONG_BUT_RELATED:
      return {
        comprehensionDelta: 0, // no comprehension penalty — child has some understanding
        productionDelta: s(PRODUCTION_WRONG_BUT_RELATED),
        pronunciationDelta: 0,
        emotionalSafetyDelta: 0,
        frustrationRiskDelta: s(FRUSTRATION_WRONG_BUT_RELATED),
        engagementDelta: 0,
        l1DependencyDelta: 0,
        noveltyNeedDelta: activitySwitched ? s(NOVELTY_NEED_ACTIVITY_SWITCH) : s(NOVELTY_NEED_SAME_ACTIVITY),
        activityFatigueDelta: activitySwitched ? s(ACTIVITY_FATIGUE_SWITCH) : s(ACTIVITY_FATIGUE_SAME_ACTIVITY),
        sessionStaminaDelta: 0,
        refusalRiskDelta: 0,
      };

    case ClassificationLabel.RANDOM_NONSENSE:
    case ClassificationLabel.PLAYFUL_NONSENSE:
      return {
        comprehensionDelta: s(-3),
        productionDelta: 0,
        pronunciationDelta: 0,
        emotionalSafetyDelta: 0,
        frustrationRiskDelta: s(3),
        engagementDelta: 0,
        l1DependencyDelta: 0,
        noveltyNeedDelta: activitySwitched ? s(NOVELTY_NEED_ACTIVITY_SWITCH) : s(NOVELTY_NEED_SAME_ACTIVITY),
        activityFatigueDelta: activitySwitched ? s(ACTIVITY_FATIGUE_SWITCH) : s(ACTIVITY_FATIGUE_SAME_ACTIVITY),
        sessionStaminaDelta: 0,
        refusalRiskDelta: 0,
      };

    case ClassificationLabel.AVOIDANCE_NONSENSE:
      return {
        comprehensionDelta: s(-3),
        productionDelta: 0,
        pronunciationDelta: 0,
        emotionalSafetyDelta: s(-3),
        frustrationRiskDelta: s(8),
        engagementDelta: s(-5),
        l1DependencyDelta: 0,
        noveltyNeedDelta: s(5),
        activityFatigueDelta: s(5),
        sessionStaminaDelta: 0,
        refusalRiskDelta: s(5),
      };

    // Silence: do NOT count as failure; do NOT apply confidence penalties (§Phase 4 rules)
    case ClassificationLabel.SILENCE_SHORT:
      return zeroDeltas();

    case ClassificationLabel.SILENCE_MEDIUM:
      return {
        ...zeroDeltas(),
        comprehensionDelta: s(-2), // slight uncertainty signal
        noveltyNeedDelta: activitySwitched ? s(NOVELTY_NEED_ACTIVITY_SWITCH) : s(NOVELTY_NEED_SAME_ACTIVITY),
        activityFatigueDelta: activitySwitched ? s(ACTIVITY_FATIGUE_SWITCH) : s(ACTIVITY_FATIGUE_SAME_ACTIVITY),
      };

    case ClassificationLabel.SILENCE_LONG:
      return {
        ...zeroDeltas(),
        comprehensionDelta: s(COMPREHENSION_SILENCE_LONG), // §7.1: −0.05
        engagementDelta: s(-7), // §7.1: −0.07
        noveltyNeedDelta: activitySwitched ? s(NOVELTY_NEED_ACTIVITY_SWITCH) : s(NOVELTY_NEED_SAME_ACTIVITY),
        activityFatigueDelta: activitySwitched ? s(ACTIVITY_FATIGUE_SWITCH) : s(ACTIVITY_FATIGUE_SAME_ACTIVITY),
      };

    case ClassificationLabel.NO_RESPONSE:
      return {
        ...zeroDeltas(),
        comprehensionDelta: s(-5),
        engagementDelta: s(-7),
        noveltyNeedDelta: s(5),
        activityFatigueDelta: s(5),
      };

    // L1: comprehension success signal; production gap signal (§Phase 4 rules)
    case ClassificationLabel.L1_TRANSLATION:
      return {
        comprehensionDelta: s(COMPREHENSION_L1_TRANSLATION), // +0.08
        productionDelta: s(PRODUCTION_L1_TRANSLATION),        // 0 — no production boost
        pronunciationDelta: 0,
        emotionalSafetyDelta: 0,
        frustrationRiskDelta: 0,
        engagementDelta: 0,
        l1DependencyDelta: s(L1_DEPENDENCY_L1_TRANSLATION),
        noveltyNeedDelta: 0,
        activityFatigueDelta: 0,
        sessionStaminaDelta: 0,
        refusalRiskDelta: 0,
      };

    case ClassificationLabel.L1_HELP_REQUEST:
      return {
        ...zeroDeltas(),
        l1DependencyDelta: s(L1_DEPENDENCY_L1_HELP_REQUEST),
      };

    case ClassificationLabel.L1_REFUSAL:
      return {
        comprehensionDelta: 0,
        productionDelta: s(PRODUCTION_L1_REFUSAL),
        pronunciationDelta: 0,
        emotionalSafetyDelta: s(EMOTIONAL_SAFETY_REFUSAL),
        frustrationRiskDelta: s(FRUSTRATION_L1_REFUSAL),
        engagementDelta: s(-5),
        l1DependencyDelta: s(L1_DEPENDENCY_L1_REFUSAL),
        noveltyNeedDelta: s(5),
        activityFatigueDelta: s(5),
        sessionStaminaDelta: 0,
        refusalRiskDelta: s(REFUSAL_RISK_L1_REFUSAL),
      };

    case ClassificationLabel.CODE_SWITCH:
      return {
        ...zeroDeltas(),
        comprehensionDelta: s(3), // partial comprehension signal
        l1DependencyDelta: s(L1_DEPENDENCY_CODE_SWITCH),
      };

    // I don't know: do NOT count as failure; preserve emotional safety (§Phase 4 rules)
    case ClassificationLabel.I_DONT_KNOW:
      return {
        ...zeroDeltas(),
        comprehensionDelta: s(-3), // slight uncertainty — child flagged they don't know
        // frustrationRisk: no change (spec: "do not count as failure")
        // emotionalSafety: no change (spec: "preserve emotional safety")
      };

    // Refusal / emotional shutdown: escalate (§Phase 4 rules)
    case ClassificationLabel.REFUSAL:
      return {
        comprehensionDelta: 0,
        productionDelta: s(PRODUCTION_REFUSAL),
        pronunciationDelta: 0,
        emotionalSafetyDelta: s(EMOTIONAL_SAFETY_REFUSAL),
        frustrationRiskDelta: s(FRUSTRATION_REFUSAL),
        engagementDelta: s(-8),
        l1DependencyDelta: 0,
        noveltyNeedDelta: s(8),
        activityFatigueDelta: s(8),
        sessionStaminaDelta: s(SESSION_STAMINA_REFUSAL),
        refusalRiskDelta: s(REFUSAL_RISK_REFUSAL),
      };

    case ClassificationLabel.EMOTIONAL_SHUTDOWN:
      return {
        comprehensionDelta: 0,
        productionDelta: 0,
        pronunciationDelta: 0,
        emotionalSafetyDelta: s(EMOTIONAL_SAFETY_EMOTIONAL_SHUTDOWN),
        frustrationRiskDelta: s(FRUSTRATION_EMOTIONAL_SHUTDOWN),
        engagementDelta: s(-15),
        l1DependencyDelta: 0,
        noveltyNeedDelta: s(10),
        activityFatigueDelta: s(10),
        sessionStaminaDelta: s(SESSION_STAMINA_EMOTIONAL_SHUTDOWN),
        refusalRiskDelta: s(REFUSAL_RISK_EMOTIONAL_SHUTDOWN),
      };

    // Unsafe/sensitive: no confidence changes — only safeToContinue is affected
    case ClassificationLabel.UNSAFE_OR_SENSITIVE:
      return zeroDeltas();

    case ClassificationLabel.DISTRACTION:
    case ClassificationLabel.OFF_TOPIC_STORY:
      return {
        ...zeroDeltas(),
        engagementDelta: s(-5),
        noveltyNeedDelta: s(5),
        activityFatigueDelta: s(3),
      };

    case ClassificationLabel.OVEREXCITED:
      return {
        ...zeroDeltas(),
        engagementDelta: s(5),
        noveltyNeedDelta: s(-3),
      };

    case ClassificationLabel.TEST_THE_AI:
      return {
        ...zeroDeltas(),
        engagementDelta: s(2),
      };

    // Timeout fallback: do not punish child; update uncertainty only
    case ClassificationLabel.UNKNOWN_UNCERTAIN:
    default:
      return {
        ...zeroDeltas(),
        comprehensionDelta: s(-2), // slight uncertainty increase
      };
  }

  void childState; // reserved for future context-aware rules
}

function zeroDeltas(): ConfidenceDeltas {
  return {
    comprehensionDelta: 0,
    productionDelta: 0,
    pronunciationDelta: 0,
    emotionalSafetyDelta: 0,
    frustrationRiskDelta: 0,
    engagementDelta: 0,
    l1DependencyDelta: 0,
    noveltyNeedDelta: 0,
    activityFatigueDelta: 0,
    sessionStaminaDelta: 0,
    refusalRiskDelta: 0,
  };
}
