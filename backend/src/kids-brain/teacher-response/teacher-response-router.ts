import {
  ClassificationLabel,
  RecoveryState,
  TeacherActionCode,
  FeedbackTone,
} from '../shared/enums.js';
import type { TeacherResponseInput } from './teacher-response-types.js';
import type { ResponseMode } from './teacher-response-types.js';
import type { RecoveryType } from './recovery-response-builder.js';

/** The routing decision produced by the response router. */
export interface ResponseRoute {
  mode: ResponseMode;
  /** Overridden action code (if router overrides the learning engine's suggestion). */
  actionCode: TeacherActionCode;
  /** Recovery type to use when mode === 'recovery_script'. */
  recoveryType: RecoveryType | null;
  tone: FeedbackTone;
  /** True when response is safety-blocked (unsafe_or_sensitive). */
  safetyBlocked: boolean;
  /** True when response should use LLM variation. */
  requiresLLM: boolean;
}

/**
 * Routes the teacher response to the appropriate mode and action code.
 *
 * Priority order (matches spec Phase 6 and Patch 6 pipeline):
 * 1. Safety close — unsafe_or_sensitive or safeToContinue=false
 * 2. Emotional shutdown — calm comfort, no curriculum
 * 3. Refusal — back off and offer choice
 * 4. Recovery states — recovery_script
 * 5. Normal classification → scripted/template
 */
export function routeTeacherResponse(input: TeacherResponseInput): ResponseRoute {
  const label = input.classificationResult.label;
  const safeToContinue = input.stateEngineOutput.stateUpdateSummary.safeToContinue;
  const recoveryState = input.responseContext.recoveryState;
  const actionCode = input.learningDecision.nextTeacherActionCode;

  // ── Priority 1: Safety close ─────────────────────────────────────────────────
  if (label === ClassificationLabel.UNSAFE_OR_SENSITIVE || !safeToContinue) {
    return {
      mode: 'safety_close',
      actionCode: TeacherActionCode.ESCALATE_TO_SAFETY,
      recoveryType: 'unsafe_or_sensitive',
      tone: FeedbackTone.NEUTRAL,
      safetyBlocked: true,
      requiresLLM: false,
    };
  }

  // ── Priority 2: Emotional shutdown ───────────────────────────────────────────
  if (
    recoveryState === RecoveryState.EMOTIONAL_SHUTDOWN ||
    label === ClassificationLabel.EMOTIONAL_SHUTDOWN
  ) {
    return {
      mode: 'recovery_script',
      actionCode: TeacherActionCode.PAUSE_AND_CHECK_IN,
      recoveryType: 'emotional_shutdown',
      tone: FeedbackTone.GENTLE_CORRECTION,
      safetyBlocked: false,
      requiresLLM: false,
    };
  }

  // ── Priority 3: Refusal ───────────────────────────────────────────────────────
  if (
    recoveryState === RecoveryState.REFUSAL ||
    label === ClassificationLabel.REFUSAL ||
    label === ClassificationLabel.L1_REFUSAL
  ) {
    return {
      mode: 'recovery_script',
      actionCode: TeacherActionCode.BACK_OFF_OFFER_CHOICE,
      recoveryType: 'refusal',
      tone: FeedbackTone.GENTLE_CORRECTION,
      safetyBlocked: false,
      requiresLLM: false,
    };
  }

  // ── Priority 4: Frustration / Repeated failure recovery ─────────────────────
  if (
    recoveryState === RecoveryState.REPEATED_FAILURE ||
    recoveryState === RecoveryState.FRUSTRATION_RISK
  ) {
    return {
      mode: 'recovery_script',
      actionCode: TeacherActionCode.GIVE_EASIEST_WIN,
      recoveryType: 'repeated_failure',
      tone: FeedbackTone.WARM,
      safetyBlocked: false,
      requiresLLM: false,
    };
  }

  // ── Priority 5: Silence-based recovery ───────────────────────────────────────
  if (label === ClassificationLabel.SILENCE_SHORT) {
    return {
      mode: 'recovery_script',
      actionCode: TeacherActionCode.HOLD_CURRENT_ITEM,
      recoveryType: 'silence_short',
      tone: FeedbackTone.WARM,
      safetyBlocked: false,
      requiresLLM: false,
    };
  }

  if (label === ClassificationLabel.SILENCE_LONG) {
    return {
      mode: 'recovery_script',
      actionCode: TeacherActionCode.MODEL_ANSWER,
      recoveryType: 'silence_long',
      tone: FeedbackTone.WARM,
      safetyBlocked: false,
      requiresLLM: false,
    };
  }

  if (label === ClassificationLabel.SILENCE_MEDIUM) {
    return {
      mode: 'recovery_script',
      actionCode: TeacherActionCode.MODEL_ANSWER,
      recoveryType: 'silence_short', // gentle scaffold
      tone: FeedbackTone.WARM,
      safetyBlocked: false,
      requiresLLM: false,
    };
  }

  if (label === ClassificationLabel.NO_RESPONSE) {
    return {
      mode: 'recovery_script',
      actionCode: TeacherActionCode.PAUSE_AND_CHECK_IN,
      recoveryType: 'no_response',
      tone: FeedbackTone.WARM,
      safetyBlocked: false,
      requiresLLM: false,
    };
  }

  // ── Priority 6: L1 responses ─────────────────────────────────────────────────
  if (label === ClassificationLabel.L1_TRANSLATION) {
    return {
      mode: 'recovery_script',
      actionCode: TeacherActionCode.WARM_PRAISE_CONFIRM,
      recoveryType: 'l1_translation',
      tone: FeedbackTone.WARM,
      safetyBlocked: false,
      requiresLLM: false,
    };
  }

  if (label === ClassificationLabel.L1_HELP_REQUEST) {
    return {
      mode: 'recovery_script',
      actionCode: TeacherActionCode.USE_L1_ANCHOR,
      recoveryType: 'l1_help_request',
      tone: FeedbackTone.WARM,
      safetyBlocked: false,
      requiresLLM: false,
    };
  }

  // ── Priority 7: I don't know ──────────────────────────────────────────────────
  if (label === ClassificationLabel.I_DONT_KNOW) {
    return {
      mode: 'recovery_script',
      actionCode: TeacherActionCode.ASK_FORCED_CHOICE,
      recoveryType: 'i_dont_know',
      tone: FeedbackTone.WARM,
      safetyBlocked: false,
      requiresLLM: false,
    };
  }

  // ── Priority 8: Wrong answers ─────────────────────────────────────────────────
  if (
    label === ClassificationLabel.WRONG_SEMANTIC ||
    label === ClassificationLabel.WRONG_BUT_RELATED
  ) {
    return {
      mode: 'recovery_script',
      actionCode: TeacherActionCode.RECAST_AND_CONFIRM,
      recoveryType: 'wrong_semantic',
      tone: FeedbackTone.GENTLE_CORRECTION,
      safetyBlocked: false,
      requiresLLM: false,
    };
  }

  // ── Priority 9: Correct / near-correct ───────────────────────────────────────
  if (label === ClassificationLabel.CORRECT_CONFIDENT) {
    return {
      mode: input.learningDecision.shouldTriggerEasiestWin ? 'scripted' : 'template',
      actionCode,
      recoveryType: null,
      tone: FeedbackTone.CELEBRATORY,
      safetyBlocked: false,
      requiresLLM: false,
    };
  }

  if (
    label === ClassificationLabel.CORRECT_HESITANT ||
    label === ClassificationLabel.NEAR_CORRECT ||
    label === ClassificationLabel.PRONUNCIATION_VARIANT
  ) {
    return {
      mode: 'template',
      actionCode,
      recoveryType: null,
      tone: FeedbackTone.WARM,
      safetyBlocked: false,
      requiresLLM: false,
    };
  }

  if (label === ClassificationLabel.REPEATED_AFTER_MODEL) {
    return {
      mode: 'template',
      actionCode: TeacherActionCode.PRAISE_ECHO_THEN_CHECK,
      recoveryType: null,
      tone: FeedbackTone.WARM,
      safetyBlocked: false,
      requiresLLM: false,
    };
  }

  if (label === ClassificationLabel.PARTIAL_ANSWER) {
    return {
      mode: 'template',
      actionCode: TeacherActionCode.COMPLETE_ANSWER_MODEL,
      recoveryType: null,
      tone: FeedbackTone.WARM,
      safetyBlocked: false,
      requiresLLM: false,
    };
  }

  // ── Priority 10: Playful / distraction ────────────────────────────────────────
  if (label === ClassificationLabel.PLAYFUL_NONSENSE) {
    return {
      mode: 'scripted',
      actionCode: TeacherActionCode.PLAY_ALONG_BRIEFLY,
      recoveryType: null,
      tone: FeedbackTone.WARM,
      safetyBlocked: false,
      requiresLLM: false,
    };
  }

  // ── Default: fall back to learning decision ────────────────────────────────────
  return {
    mode: 'fallback_safe',
    actionCode,
    recoveryType: null,
    tone: FeedbackTone.WARM,
    safetyBlocked: false,
    requiresLLM: false,
  };
}
