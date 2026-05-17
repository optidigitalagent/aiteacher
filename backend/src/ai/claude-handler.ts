import Anthropic from '@anthropic-ai/sdk'
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
import {
  parseTeacherBrainResponse,
  stripTeacherBrainBlock,
  validateTeacherBrainAction,
} from './teacher-brain/index.js'
import { detectHiddenAnswerSource } from './teacher-brain/teacher-brain-executability.js'
import { queryRAG } from './rag.js'
import { getTipsForContext } from '../lesson/tips-service.js'
import {
  normalizeExerciseType,
  inferExerciseTypeFromInstruction,
  isExerciseAllowedInCurrentRuntime,
  isInstructionResourceBlocked,
  isListeningSectionSafe,
  getExercisePolicy,
  isMixedExerciseBoundary,
} from '../exercises/protocols/index.js'
import { getFocusStudentBookSection } from '../lesson/focus-student-book.js'

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

// Classify raw AI exercise JSON to a canonical type using Phase 1 protocol helpers.
// Instruction-based inference overrides AI-declared type for strong signals.
function classifyExerciseType(e: Record<string, unknown>): { finalType: string; reason: string } {
  const aiType = typeof e['type'] === 'string' ? e['type'].trim() : ''

  const instructionText = [
    (e['instruction'] as string | undefined) ?? '',
    (e['question']    as string | undefined) ?? '',
  ].join(' ')

  const normalizedAiType = normalizeExerciseType(aiType)
  const inferredType     = inferExerciseTypeFromInstruction(instructionText)

  let finalType: string
  let reason: string

  if (inferredType && inferredType !== normalizedAiType) {
    // Instruction text carries strong structural signal — override AI declaration
    finalType = inferredType
    reason    = `instruction_override: ai="${aiType}" inferred="${inferredType}"`
  } else if (normalizedAiType !== 'unknown') {
    finalType = normalizedAiType
    reason    = `ai_declared: "${aiType}" normalized="${normalizedAiType}"`
  } else if (inferredType) {
    finalType = inferredType
    reason    = `inference_fallback: ai_type_unknown inferred="${inferredType}"`
  } else {
    finalType = 'speaking_prompt'  // safest fallback — voice-compatible, no correct_answer required
    reason    = 'unknown_fallback: defaulted to speaking_prompt'
  }

  console.log(`[exercise:type] aiType="${aiType}" inferred="${inferredType ?? 'none'}" final="${finalType}" reason="${reason}"`)
  return { finalType, reason }
}

function parseExercise(raw: unknown): ExerciseData | null {
  if (!raw || typeof raw !== 'object') return null
  const e = raw as Record<string, unknown>

  const { finalType } = classifyExerciseType(e)

  // Policy gate: block postponed/unsupported types before any further processing
  const allowed = isExerciseAllowedInCurrentRuntime(finalType)
  const policy  = getExercisePolicy(finalType)
  console.log(`[exercise:policy] type="${finalType}" allowed=${allowed} status="${policy.supportStatus}" downgrade="${policy.downgradeStrategy}"`)

  if (!allowed) {
    console.log(`[exercise:downgrade] type="${finalType}" strategy="${policy.downgradeStrategy}" reason="type not allowed in current runtime"`)
    return null
  }

  // Resource-content gate: block exercises whose instruction/question text references
  // unsupported resources (audio, image, long-text writing) even when the classified
  // type is allowed. Catches type="speaking_prompt" + instruction="Look at the photos...".
  const instructionText = [
    (e['instruction'] as string | undefined) ?? '',
    (e['question']    as string | undefined) ?? '',
  ].join(' ')
  const resourceBlock = isInstructionResourceBlocked(instructionText)
  if (resourceBlock.blocked) {
    console.log(`[exercise:skip] type="${finalType}" reason="${resourceBlock.reason}"`)
    return null
  }

  // Snapshot shape validation is deferred to orchestrator.process(), where it runs
  // AFTER enriching the exercise with cached state data (items/options). Validating
  // here would block subsequent matching/deterministic items that omit those fields
  // because they are already rendered on the student's screen.

  const items = Array.isArray(e['items'])
    ? (e['items'] as unknown[]).filter((i): i is string => typeof i === 'string')
    : undefined
  const options = Array.isArray(e['options'])
    ? (e['options'] as unknown[]).filter((o): o is string => typeof o === 'string')
    : undefined

  return {
    id:             '',
    type:           finalType,
    question:       typeof e['question'] === 'string' ? e['question'] : '',
    // correct_answer is optional for soft types (speaking, discussion, etc.)
    correct_answer: typeof e['correct_answer'] === 'string' ? e['correct_answer'] : '',
    hint:           typeof e['hint']        === 'string' ? e['hint']        : '',
    difficulty:     typeof e['difficulty']  === 'number' ? e['difficulty']  : 0.3,
    exerciseNumber: typeof e['exerciseNumber'] === 'number' ? e['exerciseNumber'] : undefined,
    instruction:    typeof e['instruction'] === 'string' ? e['instruction'] : undefined,
    skillFocus:     typeof e['skillFocus']  === 'string' ? e['skillFocus']  : undefined,
    items:          items   && items.length   > 0 ? items   : undefined,
    options:        options && options.length > 0 ? options : undefined,
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
    speech:        'Let me try that again. What did you say?',
    display_text:  'Let me try that again. What did you say?',
    next_action:   'continue_phase',
    exercise:      null,
    internal_note: `[fallback] parse error in phase ${state.phase}`,
  }
}

// ── Main AI handler ───────────────────────────────────────────────────────────

const handler: AIHandlerFn = async (state: LessonState, inputText: string, callCtx?: OrchestratorCallContext) => {
  if (!client) throw new Error('[claude] client not initialised')

  const [student, history, ragContext, studentTips] = await Promise.all([
    loadStudent(state.studentId),
    loadHistory(state.lessonId),
    queryRAG(state.grammarTarget, state.lessonTopic, state.textbookUnit),
    // Phase 5: load recent tips for cross-session learning memory (max 5, section-relevant first)
    getTipsForContext(state.studentId, state.focusLesson, 5),
  ])

  const ctx: PromptContext = {
    state,
    studentName:    student.name,
    studentAge:     student.age,
    studentLevel:   student.level,
    errorPatterns:  student.error_patterns  ?? [],
    grammarMastery: student.grammar_mastery ?? {},
    ragContext,
    teacherName:    state.teacherId === 'emma' ? 'Emma' : 'Alex',
    // Phase 4: remaining lesson time for time-aware teacher prompting
    remainingSeconds: callCtx?.remainingMs !== undefined
      ? Math.floor(callCtx.remainingMs / 1000)
      : undefined,
    // Phase 5: persistent tips for cross-session learning continuity
    studentTips: studentTips.length > 0 ? studentTips : undefined,
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

  // ── Phase D: extract optional <TEACHER_BRAIN_JSON> block ─────────────────
  // Strip the block BEFORE parseSafe() so JSON.parse receives only the main JSON.
  // Fallback is transparent: if no block present, strippedText === aiText.
  const { visibleText: strippedText, structured: tbStructured, parseError: tbParseError } =
    parseTeacherBrainResponse(aiText)

  if (tbParseError) {
    console.log(`[teacher_brain] parse_error reason="${tbParseError}"`)
  }

  const aiResp = parseSafe(strippedText) ?? fallback(state)

  // Safety strip: remove any TB block that ended up inside speech / display_text
  aiResp.speech       = stripTeacherBrainBlock(aiResp.speech)
  aiResp.display_text = stripTeacherBrainBlock(aiResp.display_text)

  // Log and validate the structured action (observation mode — no state mutation)
  if (tbStructured) {
    const validation = validateTeacherBrainAction(tbStructured, {
      completedExercises: state.completedExercises,
      completedItems:     state.completedItems,
      currentExerciseNum: state.currentExerciseNum,
      itemIndex:          state.itemIndex,
      correctionTurn:     state.correctionTurn,
    })
    if (validation.ok) {
      console.log(
        `[teacher_brain] action=${tbStructured.action} valid=true` +
        ` exercise=${tbStructured.exerciseNum ?? 'n/a'}` +
        ` item=${tbStructured.itemIndex ?? 'n/a'}` +
        (tbStructured.confidence !== undefined ? ` confidence=${tbStructured.confidence}` : ''),
      )
    } else {
      console.log(
        `[teacher_brain] invalid_action action=${tbStructured.action}` +
        ` reason="${validation.reason}"`,
      )
    }
  }

  // ── Listening-section implicit audio block ────────────────────────────────
  // Exercises in a Listening section implicitly require the student to recall
  // audio content that doesn't exist in this runtime. Block any type that isn't
  // explicitly safe for Listening sections (i.e., self-contained speaking tasks).
  if (aiResp.exercise && state.focusLesson) {
    const sb = getFocusStudentBookSection(state.focusLesson)
    if (sb?.type === 'Listening' && !isListeningSectionSafe(aiResp.exercise.type)) {
      console.log(
        `[exercise:skip] type="${aiResp.exercise.type}" reason="listening_section_implicit_audio"` +
        ` section="${state.focusLesson}"`,
      )
      aiResp.exercise = null
    }
  }

  // ── Invisible-options block ───────────────────────────────────────────────
  // If the AI speech tells the student to choose from visible options or a word
  // bank, but the exercise JSON has no options array, the student has nothing to
  // choose from. Skip the exercise before it enters runtime.
  if (aiResp.exercise && !aiResp.exercise.options?.length) {
    const sl = aiResp.speech.toLowerCase()
    if (
      sl.includes('from the options') ||
      sl.includes('options on screen') ||
      sl.includes('from the word bank') ||
      sl.includes('word bank') ||
      sl.includes('choose from')
    ) {
      console.log(
        `[exercise:skip] type="${aiResp.exercise.type}" reason="speech_references_invisible_options"`,
      )
      aiResp.exercise = null
    }
  }

  // ── Mixed exercise boundary block ────────────────────────────────────────
  // Catches exercises where the AI merged Exercise N (discussion intro) with
  // Exercise N+1 (listening comprehension questions) into one JSON object.
  // These items require hidden audio — they cannot be answered without the recording.
  // The guard fires even when the declared type is allowed (e.g. "discussion")
  // because the content signals cross-boundary contamination.
  if (aiResp.exercise) {
    const mixCheck = isMixedExerciseBoundary(aiResp.exercise)
    if (mixCheck.mixed) {
      console.log(
        `[exercise:skip] type="${aiResp.exercise.type}" reason="mixed_exercise_boundary:${mixCheck.reason}"`,
      )
      aiResp.exercise = null
    }
  }

  // ── Phase E.1: Hidden answer source detection ────────────────────────────────
  // Catches exercises whose visible question text masks a hidden answer source.
  // Production failure: "Match the questions with answers" + items like "Who inspires you?"
  // passes all type/instruction gates but the answers come from a hidden audio recording.
  //
  // This runs on the ACTUAL returned exercise data, not on Redis state, so it catches
  // what the prompt-side executability gate (which runs on state) cannot see in time.
  //
  // When detected: set exercise = null AND patch speech to prevent speech/runtime desync.
  // Without speech patching: student hears "Exercise 2, match..." but backend shows exercise=0.
  if (aiResp.exercise) {
    const hasDecision = detectHiddenAnswerSource({
      exerciseType: aiResp.exercise.type,
      instruction:  aiResp.exercise.instruction ?? '',
      items:        aiResp.exercise.items        ?? [],
      options:      aiResp.exercise.options       ?? [],
      exerciseNumber: aiResp.exercise.exerciseNumber,
    })
    if (hasDecision.detected) {
      const exerciseNum = aiResp.exercise.exerciseNumber
      const numStr = exerciseNum ? `Exercise ${exerciseNum}` : 'This exercise'
      console.log(
        `[exercise:skip] type="${aiResp.exercise.type}" reason="hidden_answer_source:${hasDecision.classification}"` +
        ` signals="${hasDecision.signals.join('; ')}" lessonId=${state.lessonId}`,
      )
      // Patch speech to prevent desync: without this, student hears exercise announcement
      // but backend cursor stays at previous value — student cannot submit an answer.
      aiResp.speech       = `${numStr} requires context from a recording — we'll move on.`
      aiResp.display_text = aiResp.speech
      aiResp.exercise     = null
    }
  }

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
