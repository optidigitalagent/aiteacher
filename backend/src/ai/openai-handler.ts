import OpenAI from 'openai'
import 'dotenv/config'
import redis, { LESSON_TTL, lessonContextKey } from '../db/redis.js'
import { query } from '../db/postgres.js'
import { registerAIHandler, type AIHandlerFn, type OrchestratorCallContext } from '../lesson/orchestrator.js'
import type { LessonState, AIResponse, ExerciseData } from '../lesson/types.js'
import {
  buildSystemPrompt,
  trimHistory,
  type ChatMessage,
  type PromptContext,
} from './prompt-builder.js'
import { queryRAG } from './rag.js'

const MODEL = process.env.OPENAI_MODEL ?? 'gpt-4o'

// Singleton client — created once on setupOpenAI()
let client: OpenAI | null = null

// ── DB helpers ────────────────────────────────────────────────────────────────

interface StudentRow {
  name:            string
  age:             number
  level:           string
  grammar_mastery: Record<string, number> | null
  error_patterns:  string[] | null
}

async function loadStudent(studentId: string): Promise<StudentRow> {
  const res = await query<StudentRow>(
    `SELECT s.name, s.age, s.level,
            sp.grammar_mastery, sp.error_patterns
     FROM students s
     LEFT JOIN student_profiles sp ON sp.student_id = s.id
     WHERE s.id = $1`,
    [studentId],
  )
  return res.rows[0] ?? {
    name: 'Student', age: 15, level: 'B1',
    grammar_mastery: null, error_patterns: null,
  }
}

async function loadHistory(lessonId: string): Promise<ChatMessage[]> {
  const raw = await redis.get(lessonContextKey(lessonId))
  if (!raw) return []
  try { return JSON.parse(raw) as ChatMessage[] } catch { return [] }
}

async function saveHistory(lessonId: string, history: ChatMessage[]): Promise<void> {
  await redis.set(
    lessonContextKey(lessonId),
    JSON.stringify(trimHistory(history)),
    'EX', LESSON_TTL,
  )
}

// ── Response parsing ──────────────────────────────────────────────────────────

function parseExercise(raw: unknown): ExerciseData | null {
  if (!raw || typeof raw !== 'object') return null
  const e = raw as Record<string, unknown>
  if (typeof e['question'] !== 'string' || typeof e['correct_answer'] !== 'string') return null
  return {
    id:             '',   // server assigns UUID in exercise-store
    type:           (e['type'] as ExerciseData['type']) ?? 'form_transformation',
    question:       e['question'],
    correct_answer: e['correct_answer'],
    hint:           typeof e['hint'] === 'string' ? e['hint'] : '',
    difficulty:     typeof e['difficulty'] === 'number' ? e['difficulty'] : 0.3,
    exerciseNumber: typeof e['exerciseNumber'] === 'number' ? e['exerciseNumber'] : undefined,
    instruction:    typeof e['instruction'] === 'string' ? e['instruction'] : undefined,
    skillFocus:     typeof e['skillFocus'] === 'string' ? e['skillFocus'] : undefined,
    items:          Array.isArray(e['items'])
      ? (e['items'] as unknown[]).filter((i): i is string => typeof i === 'string')
      : undefined,
    options:        Array.isArray(e['options'])
      ? (e['options'] as unknown[]).filter((i): i is string => typeof i === 'string')
      : undefined,
  }
}

function parseSafe(text: string): AIResponse | null {
  try {
    const clean = text.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim()
    const obj   = JSON.parse(clean) as Partial<AIResponse & { exercise: unknown }>
    if (typeof obj.speech !== 'string' || typeof obj.next_action !== 'string') return null
    return {
      speech:        obj.speech,
      display_text:  obj.display_text ?? obj.speech,
      next_action:   obj.next_action,
      exercise:      parseExercise(obj.exercise) ?? null,
      internal_note: obj.internal_note ?? '',
    }
  } catch { return null }
}

function fallback(state: LessonState): AIResponse {
  let speech: string
  if (state.phase === 'EXERCISES' && state.currentItem) {
    const cleanItem = state.currentItem.replace(/^\d+[.)]\s*/, '').trim()
    speech = `Let's continue. ${cleanItem}`
  } else if (state.phase === 'EXERCISES' && state.currentExerciseNum > 0) {
    speech = `Let's continue with Exercise ${state.currentExerciseNum}.`
  } else {
    speech = `Go ahead.`
  }
  return {
    speech,
    display_text:  speech,
    next_action:   'continue_phase',
    exercise:      null,
    internal_note: `[fallback] parse error in phase ${state.phase}`,
  }
}

// ── Main AI handler ───────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const handler: AIHandlerFn = async (state: LessonState, inputText: string, _ctx?: OrchestratorCallContext) => {
  if (!client) throw new Error('[openai] client not initialised')

  const [student, history, ragContext] = await Promise.all([
    loadStudent(state.studentId),
    loadHistory(state.lessonId),
    queryRAG(state.grammarTarget, state.lessonTopic, state.textbookUnit),
  ])

  const ctx: PromptContext = {
    state,
    studentName:    student.name,
    studentAge:     student.age,
    studentLevel:   student.level,
    errorPatterns:  student.error_patterns  ?? [],
    grammarMastery: student.grammar_mastery ?? {},
    ragContext,
  }

  const systemPrompt = buildSystemPrompt(ctx)
  const messages: OpenAI.ChatCompletionMessageParam[] = [
    ...history.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    { role: 'user', content: inputText },
  ]

  // ── Streaming call with 15s timeout ──────────────────────────────────────

  let aiText = ''
  const controller = new AbortController()
  const timeout    = setTimeout(() => controller.abort(), 15_000)

  try {
    const stream = await client.chat.completions.create(
      {
        model:           MODEL,
        temperature:     0.7,
        max_tokens:      400,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
        stream: true,
      },
      { signal: controller.signal },
    )

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content
      if (delta) aiText += delta
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('abort') || msg.includes('AbortError')) {
      console.warn('[openai] request timed out after 15s')
    } else {
      console.error('[openai] API error:', msg)
    }
    return fallback(state)
  } finally {
    clearTimeout(timeout)
  }

  const aiResp = parseSafe(aiText) ?? fallback(state)

  // Roll conversation history
  history.push({ role: 'user',      content: inputText })
  history.push({ role: 'assistant', content: aiResp.speech })
  await saveHistory(state.lessonId, history)

  console.log(`[openai] phase=${state.phase} next_action=${aiResp.next_action} tokens~=${Math.ceil(aiText.length / 4)}`)
  return aiResp
}

// ── Export ────────────────────────────────────────────────────────────────────

export function setupOpenAI(): void {
  if (!process.env.OPENAI_API_KEY) {
    console.warn('[openai] OPENAI_API_KEY not set — using stub responses')
    return
  }
  client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  registerAIHandler(handler)
  console.log(`[openai] handler registered (model: ${MODEL})`)
}
