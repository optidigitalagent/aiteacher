/**
 * All Learning Engine threshold constants.
 * Engine-scale values (0–100) are used for all comparisons (Patch 7).
 * Session-scale inputs (0.0–1.0) are converted before these are applied.
 * All [C]-marked values require empirical calibration after deployment.
 */

// ── Rule identifiers (from progression-rules.yaml) ───────────────────────────

export const RULE_R01 = 'R01_extreme_frustration_stop';
export const RULE_R02 = 'R02_extreme_disengagement_stop';
export const RULE_R03 = 'R03_no_response_repeated_stop';
export const RULE_R10 = 'R10_frustration_easiest_win';
export const RULE_R11 = 'R11_frustration_scaffold_before_advance';
export const RULE_R20 = 'R20_advance_on_triple_confident';
export const RULE_R21 = 'R21_advance_on_double_confident_high_confidence';
export const RULE_R22 = 'R22_advance_to_next_item_sentence_production';
export const RULE_R30 = 'R30_stay_on_correct_hesitant';
export const RULE_R31 = 'R31_stay_on_correct_prompted';
export const RULE_R32 = 'R32_repeat_after_partial_correct';
export const RULE_R40 = 'R40_scaffold_on_wrong_semantic';
export const RULE_R41 = 'R41_scaffold_on_double_wrong';
export const RULE_R42 = 'R42_scaffold_on_comprehension_below_threshold';
export const RULE_R43 = 'R43_scaffold_on_max_repeats';
export const RULE_R50 = 'R50_lower_on_no_response';
export const RULE_R51 = 'R51_lower_on_random_wrong';
export const RULE_R52 = 'R52_lower_on_triple_wrong';
export const RULE_R60 = 'R60_trigger_consolidation_review';
export const RULE_R61 = 'R61_review_overdue_item';
export const RULE_R70 = 'R70_switch_on_low_engagement';
export const RULE_R71 = 'R71_insert_novelty_on_medium_low_engagement';
export const RULE_R72 = 'R72_reduce_challenge_on_high_fatigue';
export const RULE_R80 = 'R80_off_task_no_mastery_update';
export const RULE_R81 = 'R81_imitation_only_scaffold';
export const RULE_R82 = 'R82_activity_max_duration_switch';

// Special priority-chain rules
export const RULE_SAFETY_CLOSE = 'R_SAFETY_CLOSE';
export const RULE_EMOTIONAL_SHUTDOWN = 'R_EMOTIONAL_SHUTDOWN';
export const RULE_TIMEOUT = 'R_TIMEOUT';
export const RULE_REFUSAL = 'R_REFUSAL_RECOVERY';
export const RULE_REPAIRED_SUCCESS = 'R_REPAIRED_SUCCESS';
export const RULE_UNCERTAINTY_HOLD = 'R_UNCERTAINTY_HOLD';
export const RULE_OVEREXCITED = 'R_OVEREXCITED';
export const RULE_L1_PRODUCTION_GAP = 'R_L1_PRODUCTION_GAP';
export const RULE_I_DONT_KNOW = 'R_I_DONT_KNOW';
export const RULE_SILENCE_SHORT = 'R_SILENCE_SHORT_HOLD';
export const RULE_DEFAULT_STAY = 'R_DEFAULT_STAY';

// ── Frustration thresholds — engine scale 0–100 (spec §8.3) ──────────────────

export const FRUSTRATION_STOP_E = 90;           // R01: stop_lesson
export const FRUSTRATION_EASIEST_WIN_E = 75;    // R10: easiest_win
export const FRUSTRATION_FORBID_ADVANCE_E = 70; // global forbidden transition
export const FRUSTRATION_SCAFFOLD_E = 60;        // R11: forbid advance, require scaffold

// ── Engagement thresholds — engine scale 0–100 (spec §8.3, R02, R70) ─────────

export const ENGAGEMENT_STOP_E = 10;
export const ENGAGEMENT_LOW_E = 35;
export const ENGAGEMENT_MEDIUM_LOW_E = 50;
export const ENGAGEMENT_HIGH_E = 70;
export const ENGAGEMENT_STOP_MIN_ELAPSED_S = 300; // R02: at least 5 min in session

// ── Activity / stamina thresholds — engine scale ──────────────────────────────

export const ACTIVITY_FATIGUE_SWITCH_E = 70;
export const STAMINA_CLOSE_E = 15;
export const STAMINA_NO_NEW_ITEMS_E = 25;
export const COMPREHENSION_FLOOR_E = 35;         // minimum comp before production

// ── Advance thresholds (0–100) — spec §8.4 ───────────────────────────────────

export const ADVANCE_PROD_MIN = 65;
export const ADVANCE_COMP_MIN = 65;
export const ADVANCE_PROD_MIN_HIGH = 75;
export const ADVANCE_COMP_MIN_HIGH = 75;
export const ADVANCE_FRUSTRATION_MAX = 60;
export const ADVANCE_FRUSTRATION_MAX_STRICT = 50;

// ── Count-based thresholds ────────────────────────────────────────────────────

export const ADVANCE_CONSECUTIVE_CORRECT = 2;    // min consecutive correct to advance
export const ADVANCE_CONSECUTIVE_CORRECT_TRIPLE = 3;
export const SCAFFOLD_CONSECUTIVE_WRONG = 2;
export const LOWER_CONSECUTIVE_WRONG = 3;
export const NO_RESPONSE_STOP_COUNT = 3;         // R03: last 3 = no_response → stop
export const IMITATION_ONLY_SCAFFOLD_COUNT = 3;  // R81
export const MAX_CONSECUTIVE_STAY = 3;           // after max → scaffold
export const MAX_CONSECUTIVE_REPEAT = 2;
export const OVEREXCITED_FAST_COUNT = 3;          // [C] requires calibration

// ── Time thresholds (seconds) ─────────────────────────────────────────────────

export const ENGAGEMENT_NOVELTY_ELAPSED_S = 600; // R71: 10 min
export const ACTIVITY_MAX_DURATION_S = 180;       // R82: 3 min on one activity

// ── Mastery candidate thresholds (0–100) ─────────────────────────────────────

export const MASTERY_SECURE_PROD_MIN = 70;
export const MASTERY_AUTOMATIC_PROD_MIN = 85;
export const MASTERY_AUTOMATIC_COMP_MIN = 85;

// ── Review scheduling ─────────────────────────────────────────────────────────

export const MS_PER_HOUR = 3_600_000;
export const MS_PER_DAY = 86_400_000;
export const REVIEW_FAILED_EMERGING_HOURS = 1;
export const REVIEW_FAILED_DEVELOPING_HOURS = 4;
export const REVIEW_FAILED_SECURE_DAYS = 2;
export const REVIEW_FAILED_AUTOMATIC_DAYS = 7;
export const REVIEW_DEVELOPING_HOURS = 24;
export const REVIEW_SECURE_DAYS = 7;
export const REVIEW_AUTOMATIC_DAYS = 14;
export const REVIEW_SAME_SESSION_GAP_MINUTES = 10;

// ── Easiest win ───────────────────────────────────────────────────────────────

export const EASIEST_WIN_MASTERED_LEVELS: ReadonlyArray<string> = ['secure', 'automatic'];
