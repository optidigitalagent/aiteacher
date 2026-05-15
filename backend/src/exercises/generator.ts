import OpenAI from 'openai'
import type { LessonState, ExerciseData } from '../lesson/types.js'

type ExerciseType = ExerciseData['type']
type GeneratableType = 'form_transformation' | 'error_correction' | 'reconstruction' | 'free_production'

interface GeneratorCtx {
  state:        LessonState
  ragContext:   string    // textbook chunks for this lesson
  errorPatterns: string[] // known student weak spots
}

const oai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY ?? '' })

// ── Prompt templates per exercise type ────────────────────────────────────────

function prompt_formTransformation(ctx: GeneratorCtx): string {
  return `You are generating an English grammar exercise for a ${ctx.state.lessonTopic} lesson.
Grammar target: ${ctx.state.grammarTarget}
Difficulty: ${ctx.state.currentDifficulty.toFixed(1)} (0=easy, 1=hard)
Student weak points: ${ctx.errorPatterns.join('; ') || 'none noted'}
Textbook context: ${ctx.ragContext || 'use standard examples'}

Generate a FORM TRANSFORMATION exercise (fill-in-the-blank verb form).
Use vocabulary related to ${ctx.state.lessonTopic}.

Rules for difficulty:
- 0.0–0.3: regular verbs only, positive statements
- 0.3–0.6: mix regular + common irregular, include negatives
- 0.6–1.0: less common irregular verbs, questions, complex sentences

Return ONLY valid JSON:
{
  "question": "Sentence with _____ (infinitive) for the student to fill in",
  "correct_answer": "the exact correct form",
  "hint": "One-sentence hint without giving the answer away"
}`
}

function prompt_errorCorrection(ctx: GeneratorCtx): string {
  return `You are generating an English grammar exercise for a ${ctx.state.lessonTopic} lesson.
Grammar target: ${ctx.state.grammarTarget}
Difficulty: ${ctx.state.currentDifficulty.toFixed(1)} (0=easy, 1=hard)
Student weak points: ${ctx.errorPatterns.join('; ') || 'none noted'}

Generate an ERROR CORRECTION exercise. Write a sentence with 1–2 deliberate grammatical errors.
Use ${ctx.state.lessonTopic} vocabulary.
Prefer errors that match the student's known weak points if any.

Return ONLY valid JSON:
{
  "question": "Find and fix the mistake(s): [sentence with error(s)]",
  "correct_answer": "The fully corrected sentence",
  "hint": "One hint about what kind of error to look for"
}`
}

function prompt_reconstruction(ctx: GeneratorCtx): string {
  return `You are generating an English grammar exercise for a ${ctx.state.lessonTopic} lesson.
Grammar target: ${ctx.state.grammarTarget}
Difficulty: ${ctx.state.currentDifficulty.toFixed(1)}

Generate a SENTENCE RECONSTRUCTION exercise. Provide scrambled words for the student to reorder.
Use ${ctx.state.lessonTopic} vocabulary.
Difficulty 0–0.4: simple 6–7 word sentences. 0.4–1.0: longer with adverbs, prepositional phrases.

Return ONLY valid JSON:
{
  "question": "Make a correct sentence: [word1 / word2 / word3 / ...]",
  "correct_answer": "The primary correct ordering (accept other grammatically valid orderings too)",
  "hint": "One hint about word order rule"
}`
}

function prompt_freeProduction(ctx: GeneratorCtx): string {
  return `You are generating an English grammar exercise for a ${ctx.state.lessonTopic} lesson.
Grammar target: ${ctx.state.grammarTarget}
Student level: difficulty ${ctx.state.currentDifficulty.toFixed(1)}

Generate a FREE PRODUCTION exercise. The student writes or speaks freely using the target grammar.
The task must:
- Connect to ${ctx.state.lessonTopic}
- Require using ${ctx.state.grammarTarget} at least once
- Be achievable in 3–5 sentences

Return ONLY valid JSON:
{
  "question": "Open-ended prompt asking student to produce language (3–5 sentences expected)",
  "correct_answer": "Brief description of what a good answer contains (not a model answer)",
  "hint": "One sentence reminding them which grammar structure to use"
}`
}

const PROMPTS: Record<GeneratableType, (ctx: GeneratorCtx) => string> = {
  form_transformation: prompt_formTransformation,
  error_correction:    prompt_errorCorrection,
  reconstruction:      prompt_reconstruction,
  free_production:     prompt_freeProduction,
}

// ── Sequence logic ─────────────────────────────────────────────────────────────

// Returns the next exercise type to generate based on lesson progress.
// Rule: start with Type1, ensure Type2 + Type4 appear, else repeat Type1.
export function nextExerciseType(exerciseCount: number, usedTypes: ExerciseType[]): ExerciseType {
  const has = (t: ExerciseType) => usedTypes.includes(t)

  if (exerciseCount === 0) return 'form_transformation'
  if (exerciseCount === 2 && !has('error_correction')) return 'error_correction'
  if (exerciseCount === 4 && !has('reconstruction'))   return 'reconstruction'
  if (exerciseCount >= 5  && !has('free_production'))  return 'free_production'

  // After all types used: cycle back based on difficulty
  const diff = exerciseCount % 4
  const cycle: ExerciseType[] = ['form_transformation', 'error_correction', 'reconstruction', 'form_transformation']
  return cycle[diff] ?? 'form_transformation'
}

// ── Main generator ─────────────────────────────────────────────────────────────

export async function generateExercise(
  type:         ExerciseType,
  ctx:          GeneratorCtx,
): Promise<ExerciseData | null> {
  if (!process.env.OPENAI_API_KEY) return null

  const promptFn = (PROMPTS as Partial<Record<ExerciseType, (ctx: GeneratorCtx) => string>>)[type]
  if (!promptFn) return null
  const systemPrompt = promptFn(ctx)

  try {
    const completion = await oai.chat.completions.create({
      model:           'gpt-4o-mini',     // cheaper for generation; correctness validated separately
      temperature:     0.8,
      max_tokens:      200,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: systemPrompt }],
    })

    const raw  = completion.choices[0]?.message?.content ?? '{}'
    const obj  = JSON.parse(raw) as Partial<{ question: string; correct_answer: string; hint: string }>

    if (!obj.question || !obj.correct_answer) return null

    return {
      id:             '',                        // set by exercise-store.ts on save
      type,
      question:       obj.question,
      correct_answer: obj.correct_answer,
      hint:           obj.hint ?? '',
      difficulty:     ctx.state.currentDifficulty,
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[generator] failed:', msg)
    return null
  }
}
