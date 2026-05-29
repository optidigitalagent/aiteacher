/**
 * LLM Teacher Responder — interface definition only (Phase 6).
 *
 * The LLM is a language production tool only (spec §2.4).
 * It generates spoken teacher utterances within hard template constraints.
 *
 * Phase 6 defines the interface. Real LLM implementation belongs to a future phase.
 *
 * What LLM may be used for:
 * - Mild personalization of praise
 * - Story continuity variation
 * - Non-critical wording variation
 *
 * What LLM must NOT own:
 * - Safety decisions
 * - Recovery state
 * - Progression
 * - Mastery
 * - Activity choice
 * - Whether to close session
 *
 * All LLM output must pass (in order):
 * 1. Placeholder guard
 * 2. Vocabulary guard
 * 3. Length guard
 * 4. Forbidden phrase guard
 */

/** Minimal normalized context sent to the LLM (spec §12.2). No PII, no raw scores. */
export interface LLMTeacherInput {
  childFirstName: string;
  ageBand: string;
  currentActivity: string;
  targetItem: string;
  /** Normalized only — never raw transcript text (spec §12.2). */
  sttTextNormalized: string;
  promptType: string;
  attemptNumber: number;
  /** Last 2 classification labels only (spec §12.2). */
  recentClassificationLabels: string[];
  teacherCharacter: string;
  /** Template structure the LLM must respect. */
  templateConstraint: string;
  /** Maximum tokens the LLM may use (spec §10.3: 40 default, 80 absolute max). */
  maxTokens: number;
}

/** Response from the LLM teacher responder. */
export interface LLMTeacherResponse {
  /** Generated teacher text. Must pass all guards before delivery. */
  text: string;
  /** LLM confidence 0.0–1.0 (self-reported or model logprob). */
  confidence: number;
  /** Model ID used for this response (for observability). */
  modelId: string;
}

/**
 * Interface contract for LLM-based teacher response generation.
 *
 * Phase 6: Interface definition only. No real LLM calls are made.
 * Downstream integration layer is responsible for implementing this interface.
 */
export interface LLMTeacherResponder {
  /**
   * Generates a teacher utterance using the LLM.
   * The caller MUST pass the result through all guards before delivery.
   * The LLM has no authority over safety, recovery, or progression.
   */
  buildResponse(input: LLMTeacherInput): Promise<LLMTeacherResponse>;
}
