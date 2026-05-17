// ── Validation Hooks ──────────────────────────────────────────────────────────
// Deterministic answer validation. Routes by ValidationMode.
// AI evaluation (soft_ai) is the last resort — exact/contains/prefix always run first.
// GPT never makes pass/fail decisions for deterministic exercise types.

import OpenAI from 'openai'
import type { StepSpec, EngineValidationResult, ValidationRule } from './types.js'

// ── Text normalization ────────────────────────────────────────────────────────

function normalize(text: string, rule: ValidationRule): string {
  let s = text.trim()
  if (!rule.caseSensitive) s = s.toLowerCase()
  if (rule.stripPunctuation !== false) s = s.replace(/[.,!?;:'"()\-]/g, '')
  return s.replace(/\s+/g, ' ').trim()
}

// ── Variant expansion ─────────────────────────────────────────────────────────

function matchesVariants(studentNorm: string, rule: ValidationRule): boolean {
  for (const variant of rule.allowedVariants ?? []) {
    if (studentNorm === normalize(variant, rule)) return true
  }
  return false
}

// ── Mode-specific validators ──────────────────────────────────────────────────

function validateExact(student: string, expected: string, rule: ValidationRule): boolean {
  const sn = normalize(student, rule)
  const en = normalize(expected, rule)
  return sn === en || matchesVariants(sn, rule)
}

function validateContains(student: string, expected: string, rule: ValidationRule): boolean {
  const sn = normalize(student, rule)
  const en = normalize(expected, rule)
  return sn.includes(en) || matchesVariants(sn, rule)
}

function validatePrefix(student: string, expected: string, rule: ValidationRule): boolean {
  const sn = normalize(student, rule)
  const en = normalize(expected, rule)
  return sn.startsWith(en) || sn === en || matchesVariants(sn, rule)
}

// ── AI semantic evaluation ─────────────────────────────────────────────────────

async function validateSoftAI(
  step: StepSpec,
  studentAnswer: string,
): Promise<{ correct: boolean; score: number; feedback: string }> {
  const apiKey = process.env.OPENAI_API_KEY ?? ''
  if (!apiKey) {
    return { correct: true, score: 0.6, feedback: 'Answer received — continuing.' }
  }

  const client = new OpenAI({ apiKey })
  const threshold = step.validationRule.scoreThreshold ?? 0.5

  const prompt = `You are an English teacher evaluating a student's spoken answer.
Exercise: ${step.question}
Expected: ${step.expectedAnswer || '(open-ended — any relevant answer is acceptable)'}
Student said: "${studentAnswer}"

Rules:
- NEVER say "Wrong" or "Incorrect". Use natural recasting.
- For open-ended tasks: accept any fluent, on-topic response. Score 0.5–1.0.
- For fill-in tasks: the answer must be grammatically correct for the context.
- If wrong: show correct form naturally in a sentence, then explain WHY briefly.

Return JSON only: { "correct": bool, "score": 0.0–1.0, "feedback": "one sentence" }`

  try {
    const res = await client.chat.completions.create({
      model:           process.env.OPENAI_MODEL ?? 'gpt-4o',
      temperature:     0,
      max_tokens:      100,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: prompt }],
    })
    const obj = JSON.parse(res.choices[0]?.message?.content ?? '{}') as {
      correct?: boolean; score?: number; feedback?: string
    }
    const score = typeof obj.score === 'number' ? Math.min(1, Math.max(0, obj.score)) : (obj.correct ? 1 : 0)
    // Threshold: score ≥ threshold counts as correct for soft types
    const correct = Boolean(obj.correct) || score >= threshold
    return {
      correct,
      score,
      feedback: typeof obj.feedback === 'string' ? obj.feedback : 'Good attempt — let\'s continue.',
    }
  } catch {
    return { correct: true, score: 0.5, feedback: 'Answer received — let\'s continue.' }
  }
}

// ── Main entry point ──────────────────────────────────────────────────────────

export async function validateStep(
  step: StepSpec,
  studentAnswer: string,
  retryCount: number,
): Promise<EngineValidationResult> {
  const rule = step.validationRule
  const maxRetries = rule.maxRetries ?? 3
  const shouldReveal = retryCount >= maxRetries

  // Auto-skip types: always pass without evaluation
  if (rule.mode === 'not_applicable') {
    return {
      correct:           true,
      score:             1.0,
      feedback:          'Exercise skipped.',
      hintsRemaining:    0,
      shouldRevealAnswer: false,
      correctAnswer:     '',
    }
  }

  // Any-response: always pass
  if (rule.mode === 'any_response') {
    const hasContent = studentAnswer.trim().length > 2
    return {
      correct:           hasContent,
      score:             hasContent ? 1.0 : 0.0,
      feedback:          hasContent ? 'Thanks for sharing!' : 'Please give an answer to continue.',
      hintsRemaining:    0,
      shouldRevealAnswer: false,
      correctAnswer:     '',
    }
  }

  // No expected answer → soft AI
  if (!step.expectedAnswer && rule.mode !== 'soft_ai') {
    return {
      correct:           true,
      score:             0.7,
      feedback:          'Good answer!',
      hintsRemaining:    0,
      shouldRevealAnswer: false,
      correctAnswer:     '',
    }
  }

  // Deterministic modes (exact / contains / prefix_match)
  const isDeterministic = rule.mode === 'exact' || rule.mode === 'contains' || rule.mode === 'prefix_match'
  let correct = false
  let feedback = ''

  if (rule.mode === 'exact') {
    correct = validateExact(studentAnswer, step.expectedAnswer, rule)
  } else if (rule.mode === 'contains') {
    correct = validateContains(studentAnswer, step.expectedAnswer, rule)
  } else if (rule.mode === 'prefix_match') {
    correct = validatePrefix(studentAnswer, step.expectedAnswer, rule)
  }

  if (isDeterministic) {
    // If max retries exceeded, reveal and move on
    if (!correct && shouldReveal) {
      return {
        correct:           true,  // advance anyway after reveal
        score:             0.0,
        feedback:          `The answer is "${step.expectedAnswer}". Let's keep going.`,
        hintsRemaining:    0,
        shouldRevealAnswer: true,
        correctAnswer:     step.expectedAnswer,
      }
    }

    const hintsUsed = Math.min(retryCount, step.hints.length)
    const hintsRemaining = Math.max(0, maxRetries - retryCount - 1)
    feedback = correct
      ? 'Exactly right!'
      : (step.hints[hintsUsed - 1] ?? `Not quite — the answer is "${step.expectedAnswer}".`)

    return {
      correct,
      score:             correct ? 1.0 : 0.0,
      feedback,
      hintsRemaining,
      shouldRevealAnswer: false,
      correctAnswer:     step.expectedAnswer,
    }
  }

  // Soft AI evaluation
  const aiResult = await validateSoftAI(step, studentAnswer)
  if (!aiResult.correct && shouldReveal) {
    return {
      correct:           true,
      score:             0.0,
      feedback:          `The answer is "${step.expectedAnswer}". Let's continue.`,
      hintsRemaining:    0,
      shouldRevealAnswer: true,
      correctAnswer:     step.expectedAnswer,
    }
  }

  return {
    correct:           aiResult.correct,
    score:             aiResult.score,
    feedback:          aiResult.feedback,
    hintsRemaining:    Math.max(0, maxRetries - retryCount - 1),
    shouldRevealAnswer: false,
    correctAnswer:     step.expectedAnswer,
  }
}
