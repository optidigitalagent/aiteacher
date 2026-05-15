import OpenAI from 'openai'
import 'dotenv/config'
import type { ExerciseData } from '../lesson/types.js'

export interface ValidationResult {
  correct:  boolean
  score:    number   // 0.0–1.0
  feedback: string  // what the teacher says (recasting style, no "Wrong")
}

// ── Type routing categories ───────────────────────────────────────────────────

// Deterministic exact-match after normalization
const DETERMINISTIC_TYPES = new Set([
  'form_transformation',
  'fill_gap',
  'error_correction',
  'vocabulary',
])

// Matching-specific voice-safe normalization
const MATCHING_TYPES = new Set([
  'matching',
  'vocabulary_matching',
])

// AI semantic evaluation (soft or structured)
const AI_EVAL_TYPES = new Set([
  'reconstruction',
  'free_production',
  'speaking_prompt',
])

// Unsupported — should not enter normal validation runtime
const UNSUPPORTED_TYPES = new Set([
  'reading',
  'listening',
  'writing',
  'pronunciation_focus',
  'gapped_text',
])

// ── Text normalization ────────────────────────────────────────────────────────

function normalise(text: string): string {
  return text.trim().toLowerCase().replace(/[.,!?;:'"]/g, '').replace(/\s+/g, ' ')
}

// ── Matching: voice-safe letter extraction ────────────────────────────────────
// Handles common STT variants when the correct answer is a single letter (A–D).
// Only applied for matching/vocabulary_matching with single-letter correct answers.

const PHONETIC_TO_LETTER: Record<string, string> = {
  ay: 'a', bee: 'b', see: 'c', dee: 'd',
}

function extractSpokenLetter(raw: string): string | null {
  const s = raw.trim().toLowerCase()

  // Direct single letter "a", "b", "c", "d"
  if (/^[a-d]$/.test(s)) return s

  // Phonetics: "ay" → "a", "bee" → "b", "see" → "c", "dee" → "d"
  if (PHONETIC_TO_LETTER[s]) return PHONETIC_TO_LETTER[s]

  // "letter A", "option A", "the answer is A"
  const prefixLetter = s.match(/(?:letter|option|answer(?:\s+is)?)\s+([a-d])\b/)
  if (prefixLetter) return prefixLetter[1]

  // "letter ay/bee/see/dee"
  const prefixPhonetic = s.match(/(?:letter|option|answer(?:\s+is)?)\s+(ay|bee|see|dee)\b/)
  if (prefixPhonetic) return PHONETIC_TO_LETTER[prefixPhonetic[1]] ?? null

  // "1 A", "one A", "number one A", "1-a"
  const numberedLetter = s.match(/(?:\d+|one|two|three|four|five|six)\s*[-\s]+([a-d])\b/)
  if (numberedLetter) return numberedLetter[1]

  const numberedPhonetic = s.match(/(?:\d+|one|two|three|four|five|six)\s*[-\s]+(ay|bee|see|dee)\b/)
  if (numberedPhonetic) return PHONETIC_TO_LETTER[numberedPhonetic[1]] ?? null

  return null
}

function validateMatchingAnswer(
  studentAnswer: string,
  correctAnswer: string,
): ValidationResult {
  const normCorrect   = correctAnswer.trim().toLowerCase()
  const isLetterBased = /^[a-d]$/.test(normCorrect)

  if (isLetterBased) {
    const extracted = extractSpokenLetter(studentAnswer)
    if (extracted === normCorrect) {
      return { correct: true, score: 1.0, feedback: 'Correct match!' }
    }
    // Fallback: direct normalised comparison
    if (normalise(studentAnswer) === normCorrect) {
      return { correct: true, score: 1.0, feedback: 'Correct match!' }
    }
    return { correct: false, score: 0, feedback: 'Not quite — check the matching again.' }
  }

  // Text-based correct answer: standard normalization
  if (normalise(studentAnswer) === normalise(correctAnswer)) {
    return { correct: true, score: 1.0, feedback: 'Correct!' }
  }
  return { correct: false, score: 0, feedback: 'Not quite — check the matching again.' }
}

// ── Main routing ──────────────────────────────────────────────────────────────

export async function validateAnswer(
  exercise: ExerciseData,
  studentAnswer: string,
): Promise<ValidationResult> {
  const type = exercise.type

  // Fast exact-match path (works for all types as a quick win)
  if (normalise(studentAnswer) === normalise(exercise.correct_answer)) {
    return { correct: true, score: 1.0, feedback: 'Exactly right!' }
  }

  // Unsupported types: return safe non-destructive result — do not enter correction ladder
  if (UNSUPPORTED_TYPES.has(type)) {
    console.warn(`[validator] unsupported exercise type "${type}" reached validation — returning safe result`)
    return { correct: false, score: 0.5, feedback: 'This exercise type is not yet supported for automated validation.' }
  }

  // Matching types: voice-safe letter normalization
  if (MATCHING_TYPES.has(type)) {
    return validateMatchingAnswer(studentAnswer, exercise.correct_answer)
  }

  // Deterministic types: require exact match (AI hallucination risk too high)
  if (DETERMINISTIC_TYPES.has(type)) {
    return { correct: false, score: 0, feedback: 'Not quite — listen to the teacher for the correct form.' }
  }

  // AI semantic evaluation: reconstruction, free_production, speaking_prompt
  if (AI_EVAL_TYPES.has(type)) {
    const result = await aiEvaluate(exercise, studentAnswer)

    // Soft pass for open speaking tasks: score ≥ 0.5 counts as correct for progression.
    // This prevents open-ended answers from failing only because they differ from
    // the stored correct_answer text while still being grammatically valid.
    if ((type === 'speaking_prompt' || type === 'free_production') && !result.correct && result.score >= 0.5) {
      return { ...result, correct: true }
    }

    return result
  }

  // Unknown future type: safe fallback — do not silently exact-match
  console.warn(`[validator] unknown exercise type "${type}" — returning safe fallback`)
  return { correct: false, score: 0.5, feedback: 'This exercise type is not yet supported for automated validation.' }
}

// ── AI semantic evaluation ────────────────────────────────────────────────────

async function aiEvaluate(
  exercise: ExerciseData,
  studentAnswer: string,
): Promise<ValidationResult> {
  const apiKey = process.env.OPENAI_API_KEY ?? ''
  if (!apiKey) {
    // Cannot evaluate without key — return soft neutral result so correction ladder
    // does not loop destructively.
    return { correct: false, score: 0.5, feedback: 'Answer received — please continue.' }
  }

  const client = new OpenAI({ apiKey })

  const prompt = `You are an English teacher evaluating a student's answer.

Exercise type: ${exercise.type}
Question: ${exercise.question}
Expected answer: ${exercise.correct_answer}
Student's answer: ${studentAnswer}

Rules:
- For form_transformation: the verb form must be grammatically correct.
- For error_correction: the student must have fixed all errors in the sentence.
- For reconstruction: accept ANY grammatically correct word order — do not penalise valid alternative orderings.
- For free_production: accept any answer that fulfils the task with correct grammar.
- For speaking_prompt: this is an open speaking task — accept any fluent, on-topic response. Score 0.5–1.0 for reasonable attempts.
- NEVER say "Wrong" or "Incorrect" in feedback. Use recasting: show the correct form naturally in a sentence, then explain why.
- For reconstruction/speaking_prompt/free_production: if the answer is weak, ask for ONE specific improvement. Do NOT reveal a fixed "correct answer".

Return JSON only:
{
  "correct": true or false,
  "score": 0.0 to 1.0,
  "feedback": "One sentence. If wrong: use recasting or ask for improvement. If right: acknowledge and push deeper."
}`

  try {
    const res = await client.chat.completions.create({
      model:           process.env.OPENAI_MODEL ?? 'gpt-4o',
      temperature:     0,
      max_tokens:      120,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = res.choices[0]?.message?.content ?? '{}'
    const obj = JSON.parse(raw) as Partial<ValidationResult>

    return {
      correct:  Boolean(obj.correct),
      score:    typeof obj.score === 'number' ? Math.min(1, Math.max(0, obj.score)) : (obj.correct ? 1 : 0),
      feedback: typeof obj.feedback === 'string' ? obj.feedback : 'Good attempt!',
    }
  } catch {
    // AI evaluation unavailable — fail safely without starting destructive correction ladder
    return { correct: false, score: 0.5, feedback: 'Could not evaluate — please try again.' }
  }
}
