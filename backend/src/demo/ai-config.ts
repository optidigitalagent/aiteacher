// Central AI configuration for demo lessons.
// All cost limits and model names are configurable via env variables.
// Never import this module into migration files or auth code.

import type { DemoSession } from './lesson-engine.js'

// ── Config object ─────────────────────────────────────────────────────────────

export const DEMO_AI_CONFIG = {
  // Cheap model by default — gpt-4.1-mini is ~83% cheaper than gpt-4o
  model:                  process.env.OPENAI_DEMO_MODEL             ?? 'gpt-4.1-mini',
  translateModel:         process.env.OPENAI_TRANSLATE_MODEL         ?? 'gpt-4.1-mini',
  maxCalls:               parseInt(process.env.DEMO_AI_MAX_CALLS                  ?? '8',    10),
  maxInputTokensPerCall:  parseInt(process.env.DEMO_AI_MAX_INPUT_TOKENS_PER_CALL  ?? '900',  10),
  maxOutputTokensPerCall: parseInt(process.env.DEMO_AI_MAX_OUTPUT_TOKENS_PER_CALL ?? '220',  10),
  maxEstimatedCostUsd:    parseFloat(process.env.DEMO_AI_MAX_ESTIMATED_COST_USD   ?? '0.05'),
  // Default rates for gpt-4.1-mini: $0.40/1M input, $1.60/1M output
  inputCostPer1M:         parseFloat(process.env.DEMO_AI_INPUT_COST_PER_1M        ?? '0.40'),
  outputCostPer1M:        parseFloat(process.env.DEMO_AI_OUTPUT_COST_PER_1M       ?? '1.60'),
} as const

// ── Purpose types ─────────────────────────────────────────────────────────────

export type AllowedAIPurpose =
  | 'unclear_meaning_inference'
  | 'unclear_meaning_confirmation_response'
  | 'speaking_eval'
  | 'speaking_followup_eval'
  | 'writing_eval'
  | 'final_result'
  | 'unknown_help_short'
  | 'fallback_teacher_response'
  | 'student_question_answer'  // grammar/task question — rule-based first, AI only if no pack match

// Blocked purposes are never passed to canUseDemoAI — they are rejected before this call.
// Listed here for documentation: spam | gibberish | repetition_spam | profanity_only |
// prompt_injection | known_vocab_help | cached_translate | empty_input | overlong_input

// ── Cost helpers ──────────────────────────────────────────────────────────────

export function estimateCost(inputTokens: number, outputTokens: number): number {
  return (
    (inputTokens  / 1_000_000) * DEMO_AI_CONFIG.inputCostPer1M +
    (outputTokens / 1_000_000) * DEMO_AI_CONFIG.outputCostPer1M
  )
}

export interface CanUseAIResult {
  allowed: boolean
  reason?: string
  estimatedCost: number
}

// ── Cost firewall ─────────────────────────────────────────────────────────────
// Call this before EVERY AI call in the demo pipeline.
// It checks call count, token caps, and session cost cap.

export function canUseDemoAI(
  session: DemoSession,
  purpose: AllowedAIPurpose,
  estimatedInputTokens: number,
  estimatedOutputTokens: number,
): CanUseAIResult {
  const estimatedCost = estimateCost(estimatedInputTokens, estimatedOutputTokens)

  if (session.ai_calls_used >= DEMO_AI_CONFIG.maxCalls) {
    console.log(`[demo-ai] blocked reason=budget_exhausted purpose=${purpose} calls_used=${session.ai_calls_used}`)
    return { allowed: false, reason: 'budget_exhausted', estimatedCost }
  }

  if (estimatedInputTokens > DEMO_AI_CONFIG.maxInputTokensPerCall) {
    console.log(`[demo-ai] blocked reason=input_too_large purpose=${purpose}`)
    return { allowed: false, reason: 'input_too_large', estimatedCost }
  }

  if (estimatedOutputTokens > DEMO_AI_CONFIG.maxOutputTokensPerCall) {
    console.log(`[demo-ai] blocked reason=output_too_large purpose=${purpose}`)
    return { allowed: false, reason: 'output_too_large', estimatedCost }
  }

  // Conservative session cost guard: assume all past calls used max tokens
  const sessionCostSoFar = session.ai_calls_used * estimateCost(
    DEMO_AI_CONFIG.maxInputTokensPerCall,
    DEMO_AI_CONFIG.maxOutputTokensPerCall,
  )
  if (sessionCostSoFar + estimatedCost > DEMO_AI_CONFIG.maxEstimatedCostUsd) {
    console.log(
      `[demo-ai] blocked reason=cost_cap_exceeded purpose=${purpose} estimated=${estimatedCost.toFixed(6)}`,
    )
    return { allowed: false, reason: 'cost_cap_exceeded', estimatedCost }
  }

  console.log(
    `[demo-ai] allowed purpose=${purpose} model=${DEMO_AI_CONFIG.model} estimated_cost=${estimatedCost.toFixed(6)}`,
  )
  return { allowed: true, estimatedCost }
}

// ── TTS / Voice cost policy ───────────────────────────────────────────────────
// OpenAI TTS: ~$15/1M chars.
//
// Budget target: ≤ $0.05 per demo total.
// TTS at 1600 chars/demo = $0.000024 — negligible vs AI text cost (~$0.008).
//
// ALLOWED message types for TTS (configure via DEMO_TTS_ALLOWED_MESSAGE_TYPES):
//   greeting           — personalized welcome
//   main_prompt        — step instruction / task question
//   follow_up_question — follow-up after feedback or MCQ
//   key_correction     — important grammar correction (legacy / generic)
//   speaking_feedback  — feedback on speaking task
//   writing_feedback   — feedback on writing task
//   final_result       — motivational end-of-demo message
//
// NEVER voice automatically (cost/UX guard):
//   spam_warning, help_reply, translate_result, retry_template,
//   long_explanation, generic_transition
//
// Default caps: 6 calls / 1600 chars per session.
// IMPLEMENTATION NOTE: call canUseDemoTTS() before every TTS API call.
// Track chars_used and calls_used in Redis: demo:tts:usage:{sessionId}

export const DEMO_TTS_CONFIG = {
  maxCharsPerSession: parseInt(process.env.DEMO_TTS_MAX_CHARS_PER_SESSION ?? '6000', 10),
  maxCallsPerSession: parseInt(process.env.DEMO_TTS_MAX_CALLS_PER_SESSION  ?? '25',  10),
  allowedMessageTypes: (
    process.env.DEMO_TTS_ALLOWED_MESSAGE_TYPES ??
    'greeting,main_prompt,follow_up_question,key_correction,speaking_feedback,writing_feedback,final_result'
  ).split(','),
  cacheEnabled: process.env.DEMO_TTS_CACHE_ENABLED !== 'false',
} as const

export function canUseDemoTTS(
  charsUsed: number,
  callsUsed: number,
  messageType: string,
  messageLength: number,
): { allowed: boolean; reason?: string } {
  if (!(DEMO_TTS_CONFIG.allowedMessageTypes as readonly string[]).includes(messageType)) {
    console.log(`[demo-tts] blocked reason=type_not_allowed type=${messageType}`)
    return { allowed: false, reason: `type_not_allowed:${messageType}` }
  }
  if (callsUsed >= DEMO_TTS_CONFIG.maxCallsPerSession) {
    console.log(`[demo-tts] blocked reason=call_limit calls=${callsUsed}`)
    return { allowed: false, reason: 'call_limit' }
  }
  if (charsUsed + messageLength > DEMO_TTS_CONFIG.maxCharsPerSession) {
    console.log(`[demo-tts] blocked reason=char_limit chars_used=${charsUsed} new=${messageLength}`)
    return { allowed: false, reason: 'char_limit' }
  }
  console.log(`[demo-tts] allowed type=${messageType} chars=${messageLength}`)
  return { allowed: true }
}
