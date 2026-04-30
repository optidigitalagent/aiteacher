import Anthropic from '@anthropic-ai/sdk'
import 'dotenv/config'
import redis, { LESSON_TTL, lessonContextKey } from '../db/redis.js'
import { query } from '../db/postgres.js'
import { registerAIHandler, type AIHandlerFn } from '../lesson/orchestrator.js'
import type { LessonState, AIResponse, ExerciseData } from '../lesson/types.js'
import {
  buildSystemPrompt,
  trimHistory,
  type ChatMessage,
  type PromptContext,
} from './prompt-builder.js'
import { queryRAG } from './rag.js'

const MODEL = 'claude-sonnet-4-6'

let client: Anthropic | null = null

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
    id:             '',
    type:           (e['type'] as ExerciseData['type']) ?? 'form_transformation',
    question:       e['question'],
    correct_answer: e['correct_answer'],
    hint:           typeof e['hint'] === 'string' ? e['hint'] : '',
    difficulty:     typeof e['difficulty'] === 'number' ? e['difficulty'] : 0.3,
    exerciseNumber: typeof e['exerciseNumber'] === 'number' ? e['exerciseNumber'] : undefined,
    instruction:    typeof e['instruction'] === 'string' ? e['instruction'] : undefined,
    skillFocus:     typeof e['skillFocus'] === 'string' ? e['skillFocus'] : undefined,
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
  return {
    speech:        "I'm thinking... could you repeat that?",
    display_text:  "I'm thinking... could you repeat that?",
    next_action:   'continue_phase',
    exercise:      null,
    internal_note: `[fallback] parse error in phase ${state.phase}`,
  }
}

// ── Main AI handler ───────────────────────────────────────────────────────────

const handler: AIHandlerFn = async (state: LessonState, inputText: string) => {
  if (!client) throw new Error('[claude] client not initialised')

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
  const messages: Anthropic.MessageParam[] = [
    ...history.map(m => ({
      role:    m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user', content: inputText },
  ]

  // ── Streaming call with 15s timeout ──────────────────────────────────────

  let aiText = ''
  const controller = new AbortController()
  const timeout    = setTimeout(() => controller.abort(), 15_000)

  try {
    const stream = await client.messages.create(
      {
        model:      MODEL,
        max_tokens: 400,
        system: [
          {
            type:          'text',
            text:          systemPrompt,
            cache_control: { type: 'ephemeral' },
          },
        ],
        messages,
        stream: true,
      },
      { signal: controller.signal },
    )

    for await (const event of stream) {
      if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta'
      ) {
        aiText += event.delta.text
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('abort') || msg.includes('AbortError')) {
      console.warn('[claude] request timed out after 15s')
    } else {
      console.error('[claude] API error:', msg)
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

  console.log(`[claude] phase=${state.phase} next_action=${aiResp.next_action} tokens~=${Math.ceil(aiText.length / 4)}`)
  return aiResp
}

// ── Export ────────────────────────────────────────────────────────────────────

export function setupClaude(): void {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('[claude] ANTHROPIC_API_KEY not set — using stub responses')
    return
  }
  client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  registerAIHandler(handler)
  console.log(`[claude] handler registered (model: ${MODEL})`)
}
