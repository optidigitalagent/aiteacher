import OpenAI from 'openai'
import 'dotenv/config'
import type { ExerciseData } from '../lesson/types.js'

export interface ValidationResult {
  correct:  boolean
  score:    number   // 0.0–1.0
  feedback: string  // what the teacher says (recasting style, no "Wrong")
}

function normalise(text: string): string {
  return text.trim().toLowerCase().replace(/[.,!?;:'"]/g, '').replace(/\s+/g, ' ')
}

export async function validateAnswer(
  exercise: ExerciseData,
  studentAnswer: string,
): Promise<ValidationResult> {
  // Fast path — exact match after normalisation
  if (normalise(studentAnswer) === normalise(exercise.correct_answer)) {
    return { correct: true, score: 1.0, feedback: 'Exactly right!' }
  }

  // Free production always needs AI (open-ended, many valid answers)
  // Other types: AI for semantic evaluation of non-exact answers
  return aiEvaluate(exercise, studentAnswer)
}

async function aiEvaluate(
  exercise: ExerciseData,
  studentAnswer: string,
): Promise<ValidationResult> {
  const apiKey = process.env.OPENAI_API_KEY ?? ''
  if (!apiKey) {
    return { correct: true, score: 0.5, feedback: 'Answer recorded.' }
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
- For reconstruction: accept any grammatically correct word order.
- For free_production: accept any answer that fulfils the task with correct grammar.
- NEVER say "Wrong" or "Incorrect" in feedback. Use recasting: show the correct form naturally in a sentence, then explain why.

Return JSON only:
{
  "correct": true or false,
  "score": 0.0 to 1.0,
  "feedback": "One sentence. If wrong: use recasting. If right: acknowledge and push deeper."
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
    return { correct: false, score: 0, feedback: 'Could not evaluate — please try again.' }
  }
}
