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
