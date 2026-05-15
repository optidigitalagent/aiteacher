import OpenAI from 'openai'
import 'dotenv/config'
import type { ExerciseData } from '../lesson/types.js'
import { selectProtocol } from './runtime/index.js'

export interface ValidationResult {
  correct:  boolean
  score:    number   // 0.0–1.0
  feedback: string  // what the teacher says (recasting style, no "Wrong")
}

// ── Text normalization ────────────────────────────────────────────────────────

function normalise(text: string): string {
  return text.trim().toLowerCase().replace(/[.,!?;:'"]/g, '').replace(/\s+/g, ' ')
}

// ── Main routing ──────────────────────────────────────────────────────────────

export async function validateAnswer(
  exercise: ExerciseData,
  studentAnswer: string,
): Promise<ValidationResult> {
  const type     = exercise.type
  const protocol = selectProtocol(type)

  // Fast exact-match path — works for all types as a quick win before protocol routing.
  if (normalise(studentAnswer) === normalise(exercise.correct_answer)) {
    return { correct: true, score: 1.0, feedback: 'Exactly right!' }
  }

  // Route via protocol signal.
  const signal = protocol.validateSignal(studentAnswer, exercise.correct_answer)
  console.log(`[validator] route=${protocol.protocolName} signal=${signal} type="${type}"`)

  // Unsupported types: return safe non-destructive result.
  // Never enter correction ladder for types that cannot be validated.
  if (signal === 'no_validate') {
    return { correct: false, score: 0.5, feedback: 'This exercise type is not yet supported for automated validation.' }
  }

  // Protocol decided this is correct (e.g. matching letter-based normalization found a match).
  if (signal === 'correct') {
    return { correct: true, score: 1.0, feedback: 'Correct!' }
  }

  // Soft feedback types (speaking, grammar_focus, warmup): route to AI semantic evaluation.
  if (signal === 'soft_pass') {
    const result = await aiEvaluate(exercise, studentAnswer)
    // Score ≥ 0.5 counts as correct for open-ended tasks so progression is not blocked
    // by valid but differently-worded responses.
    if (protocol.shouldUseSoftFeedback() && !result.correct && result.score >= 0.5) {
      return { ...result, correct: true }
    }
    return result
  }

  // signal === 'incorrect' from here.
  // Protocol-specific incorrect feedback.
  if (protocol.protocolName === 'matching') {
    return { correct: false, score: 0, feedback: 'Not quite — check the matching again.' }
  }

  // deterministic: exact match already failed above → incorrect.
  return { correct: false, score: 0, feedback: 'Not quite — listen to the teacher for the correct form.' }
}

// ── AI semantic evaluation ────────────────────────────────────────────────────

async function aiEvaluate(
  exercise: ExerciseData,
  studentAnswer: string,
): Promise<ValidationResult> {
  const apiKey = process.env.OPENAI_API_KEY ?? ''
  if (!apiKey) {
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
- For speaking_prompt / discussion / roleplay / show_what_you_know: open speaking — accept any fluent, on-topic response. Score 0.5–1.0 for reasonable attempts.
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
    return { correct: false, score: 0.5, feedback: 'Could not evaluate — please try again.' }
  }
}
