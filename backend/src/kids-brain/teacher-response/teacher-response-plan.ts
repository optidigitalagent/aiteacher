import type { TeacherActionCode, FeedbackTone } from '../shared/enums.js';
import type { ResponseMode } from './teacher-response-types.js';

/**
 * The final output of the Teacher Response Engine per turn (Phase 6 spec).
 * All guards have been applied; text is safe to deliver to TTS.
 */
export interface TeacherResponsePlan {
  responseId: string;
  sessionId: string;
  turnNumber: number;
  teacherActionCode: TeacherActionCode;
  responseMode: ResponseMode;
  /**
   * Pre-generated fast-track exclamation.
   * Fires immediately (pre-LLM or pre-template), always warm.
   * Independent of LLM.
   */
  fastTrackText?: string;
  /** Main teacher text after all guards applied. Safe for TTS. */
  mainText: string;
  /** Deterministic safe fallback used if mainText was replaced. */
  fallbackText: string;
  /** Tokens from the allowed vocabulary set that appear in mainText. */
  allowedVocabularyUsed: string[];
  /** Tokens blocked by the vocabulary guard (empty in valid output). */
  blockedVocabulary: string[];
  /** True when the placeholder guard triggered and replaced text. */
  placeholdersRemoved: boolean;
  /**
   * True when this response was designed for LLM variation.
   * The LLM has NOT been called in Phase 6; this is a flag for the
   * downstream integration layer to call the LLM contract.
   */
  requiresLLM: boolean;
  /**
   * Prompt to send to the LLM when requiresLLM=true.
   * undefined when requiresLLM=false.
   */
  llmPrompt?: string;
  /** True when a safety event forced a safety_close response. */
  safetyBlocked: boolean;
  emotionalTone: FeedbackTone;
  /** Estimated character count for TTS budget tracking. */
  estimatedTtsCharacters: number;
  createdAt: string; // ISO 8601
}

/** Parameters for building a TeacherResponsePlan. */
export interface BuildTeacherResponsePlanParams {
  responseId: string;
  sessionId: string;
  turnNumber: number;
  teacherActionCode: TeacherActionCode;
  responseMode: ResponseMode;
  fastTrackText?: string;
  mainText: string;
  fallbackText: string;
  allowedVocabularyUsed: string[];
  blockedVocabulary: string[];
  placeholdersRemoved: boolean;
  requiresLLM: boolean;
  llmPrompt?: string;
  safetyBlocked: boolean;
  emotionalTone: FeedbackTone;
}

/** Builds a TeacherResponsePlan with computed fields. */
export function buildTeacherResponsePlan(
  params: BuildTeacherResponsePlanParams,
): TeacherResponsePlan {
  return {
    responseId: params.responseId,
    sessionId: params.sessionId,
    turnNumber: params.turnNumber,
    teacherActionCode: params.teacherActionCode,
    responseMode: params.responseMode,
    fastTrackText: params.fastTrackText,
    mainText: params.mainText,
    fallbackText: params.fallbackText,
    allowedVocabularyUsed: params.allowedVocabularyUsed,
    blockedVocabulary: params.blockedVocabulary,
    placeholdersRemoved: params.placeholdersRemoved,
    requiresLLM: params.requiresLLM,
    llmPrompt: params.llmPrompt,
    safetyBlocked: params.safetyBlocked,
    emotionalTone: params.emotionalTone,
    estimatedTtsCharacters: params.mainText.length,
    createdAt: new Date().toISOString(),
  };
}
