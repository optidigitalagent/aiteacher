import { WebSocketServer, WebSocket } from 'ws'
import type { IncomingMessage, Server } from 'http'
import { v4 as uuid } from 'uuid'
import { query } from '../db/postgres.js'
import redis, {
  LESSON_TTL,
  lessonStateKey,
  lessonContextKey,
  activeSessionKey,
} from '../db/redis.js'
import {
  InboundMessageSchema,
  type OutboundMessage,
  type LessonConfig,
  type FocusLessonConfig,
} from './message-types.js'
import type { LessonPhase, LessonState } from '../lesson/types.js'
import { getFocusUnit } from '../lesson/focus-content.js'
import { LessonOrchestrator } from '../lesson/orchestrator.js'
import { DeepgramSTT } from '../voice/stt.js'
import { speakToClient } from '../voice/tts.js'
import { loadExercise, recordAnswer } from '../exercises/exercise-store.js'
import { validateAnswer } from '../exercises/validator.js'
import { updateStudentProfile } from '../lesson/profile-updater.js'

const HEARTBEAT_INTERVAL_MS = 30_000
const INACTIVITY_TIMEOUT_MS = 45 * 60 * 1000

const orchestrator = new LessonOrchestrator()

interface ClientMeta {
  lessonId:        string | null
  studentId:       string | null
  lessonStartedAt: number | null
  lastSeen:        number
  heartbeatRef:    ReturnType<typeof setInterval>
  timeoutRef:      ReturnType<typeof setTimeout>
  stt:             DeepgramSTT | null
  ttsController:   AbortController | null
}

const clients = new Map<WebSocket, ClientMeta>()

function send(ws: WebSocket, msg: OutboundMessage): void {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg))
}

function resetInactivityTimer(ws: WebSocket, meta: ClientMeta): void {
  clearTimeout(meta.timeoutRef)
  meta.lastSeen  = Date.now()
  meta.timeoutRef = setTimeout(() => ws.terminate(), INACTIVITY_TIMEOUT_MS)
}

async function handleLessonStart(
  ws: WebSocket,
  meta: ClientMeta,
  config: LessonConfig,
): Promise<void> {
  const lessonId = uuid()
  meta.lessonId        = lessonId
  meta.studentId       = config.studentId
  meta.lessonStartedAt = Date.now()

  await query(
    `INSERT INTO lessons (id, student_id, grammar_target, lesson_topic, textbook_unit)
     VALUES ($1, $2, $3, $4, $5)`,
    [lessonId, config.studentId, config.grammarTarget, config.lessonTopic, config.textbookUnit],
  )

  const initialState: LessonState = {
    lessonId,
    studentId:      config.studentId,
    phase:          'DIAGNOSTIC',
    mode:           'free',
    grammarTarget:  config.grammarTarget,
    lessonTopic:    config.lessonTopic,
    textbookUnit:   config.textbookUnit,
    exchangeCount:       0,
    exerciseCount:       0,
    consecutiveCorrect:  0,
    consecutiveErrors:   0,
    currentDifficulty:   0.5,
    deepThinkingExchanges: 0,
    vocabularyTaught:    [],
    errorsThisLesson:    [],
    studentConfirmedReading: false,
    ruleStatedCorrectly:     false,
    summaryDelivered:        false,
    startedAt:      new Date().toISOString(),
    phaseStartedAt: new Date().toISOString(),
  }

  const pipeline = redis.pipeline()
  pipeline.set(lessonStateKey(lessonId),           JSON.stringify(initialState), 'EX', LESSON_TTL)
  pipeline.set(lessonContextKey(lessonId),          JSON.stringify([]),            'EX', LESSON_TTL)
  pipeline.set(activeSessionKey(config.studentId), lessonId,                     'EX', LESSON_TTL)
  await pipeline.exec()

  meta.stt = new DeepgramSTT((transcript) => {
    send(ws, { type: 'transcript', text: transcript })
    void processInput(ws, meta, transcript)
  })

  const greeting = `Hello! I'm Alex, your English teacher. Today we'll work on "${config.grammarTarget}" using the topic "${config.lessonTopic}". Let's start — tell me one thing you already know about this topic.`

  send(ws, { type: 'ai_text', phase: 'DIAGNOSTIC', text: greeting })
  await ttsStream(ws, meta, greeting)
}

async function handleFocusLessonStart(
  ws: WebSocket,
  meta: ClientMeta,
  config: FocusLessonConfig,
): Promise<void> {
  const unitData = getFocusUnit(config.unit)
  if (!unitData) {
    send(ws, { type: 'error', code: 'UNIT_NOT_FOUND', message: `Focus 2 Unit ${config.unit} is not available yet.` })
    return
  }

  const lessonId = uuid()
  meta.lessonId        = lessonId
  meta.studentId       = config.studentId
  meta.lessonStartedAt = Date.now()

  await query(
    `INSERT INTO lessons (id, student_id, grammar_target, lesson_topic, textbook_unit)
     VALUES ($1, $2, $3, $4, $5)`,
    [lessonId, config.studentId, unitData.grammarTarget, unitData.lessonTopic, unitData.textbookUnit],
  )

  const initialState: LessonState = {
    lessonId,
    studentId:      config.studentId,
    phase:          'DIAGNOSTIC',
    mode:           'focus',
    focusUnit:      config.unit,
    grammarTarget:  unitData.grammarTarget,
    lessonTopic:    unitData.lessonTopic,
    textbookUnit:   unitData.textbookUnit,
    exchangeCount:       0,
    exerciseCount:       0,
    consecutiveCorrect:  0,
    consecutiveErrors:   0,
    currentDifficulty:   0.5,
    deepThinkingExchanges: 0,
    vocabularyTaught:    [],
    errorsThisLesson:    [],
    studentConfirmedReading: false,
    ruleStatedCorrectly:     false,
    summaryDelivered:        false,
    startedAt:      new Date().toISOString(),
    phaseStartedAt: new Date().toISOString(),
  }

  const pipeline = redis.pipeline()
  pipeline.set(lessonStateKey(lessonId),           JSON.stringify(initialState), 'EX', LESSON_TTL)
  pipeline.set(lessonContextKey(lessonId),          JSON.stringify([]),            'EX', LESSON_TTL)
  pipeline.set(activeSessionKey(config.studentId), lessonId,                     'EX', LESSON_TTL)
  await pipeline.exec()

  meta.stt = new DeepgramSTT((transcript) => {
    send(ws, { type: 'transcript', text: transcript })
    void processInput(ws, meta, transcript)
  })

  const greeting = `Hello! I'm Alex. Today we're working on ${unitData.textbookUnit}: "${unitData.title}". The grammar focus is ${unitData.grammarTarget}. To start — can you give me one example sentence using this grammar? Don't worry if it's not perfect.`

  send(ws, { type: 'ai_text', phase: 'DIAGNOSTIC', text: greeting })
  await ttsStream(ws, meta, greeting)
}

async function processInput(
  ws: WebSocket,
  meta: ClientMeta,
  text: string,
): Promise<void> {
  if (!meta.lessonId) {
    send(ws, { type: 'error', code: 'NO_LESSON', message: 'Start a lesson first.' })
    return
  }

  const result = await orchestrator.process(meta.lessonId, text)

  send(ws, { type: 'ai_text', phase: result.phase, text: result.text })

  if (result.phaseChanged) {
    send(ws, { type: 'phase_change', from: result.previousPhase, to: result.phase })
    console.log(`[ws] phase ${result.previousPhase} → ${result.phase}`)
  }

  if (result.exercise) {
    send(ws, {
      type: 'exercise',
      exercise: {
        id:           result.exercise.id,
        exerciseType: result.exercise.type,
        question:     result.exercise.question,
        hint:         result.exercise.hint,
        difficulty:   result.exercise.difficulty,
      },
    })
  }

  if (result.ended) {
    const durationMin = meta.lessonStartedAt
      ? Math.round((Date.now() - meta.lessonStartedAt) / 60_000)
      : 0
    send(ws, {
      type: 'lesson_end',
      summary: {
        lessonId:       meta.lessonId,
        phasesReached:  getPhasesUpTo(result.previousPhase),
        exerciseScore:  0,
        vocabularyCount: 0,
        durationMin,
      },
    })

    // Update student profile async — don't block the response
    if (meta.studentId) {
      const lessonId  = meta.lessonId
      const studentId = meta.studentId
      updateStudentProfile(lessonId, studentId).catch((err: unknown) => {
        console.error('[ws] profile update failed:', err)
      })
    }

    meta.lessonId = null
    meta.stt?.close()
    meta.stt = null
    return
  }

  await ttsStream(ws, meta, result.text)
}

async function ttsStream(ws: WebSocket, meta: ClientMeta, text: string): Promise<void> {
  const prev = meta.ttsController
  meta.ttsController = new AbortController()
  // Abort previous AFTER registering new controller so the chain is clean
  try { prev?.abort() } catch { /* ignore abort-chain side effects */ }
  try {
    await speakToClient((msg) => send(ws, msg), text, meta.ttsController.signal)
  } catch (err: unknown) {
    if (err instanceof Error && err.name !== 'AbortError') {
      console.error('[ws] TTS error:', err.message)
    }
  }
}

async function handleExerciseAnswer(
  ws: WebSocket,
  meta: ClientMeta,
  exerciseId: string,
  answer: string,
): Promise<void> {
  if (!meta.lessonId) {
    send(ws, { type: 'error', code: 'NO_LESSON', message: 'Start a lesson first.' })
    return
  }

  const exercise = await loadExercise(exerciseId)
  if (!exercise || exercise.lessonId !== meta.lessonId) {
    send(ws, { type: 'error', code: 'EXERCISE_NOT_FOUND', message: 'Exercise not found.' })
    return
  }

  const validation = await validateAnswer(exercise, answer)

  await recordAnswer(exerciseId, meta.lessonId, answer, validation.correct)
  await orchestrator.recordExerciseResult(meta.lessonId, validation.correct)

  send(ws, { type: 'feedback', correct: validation.correct, explanation: validation.feedback })

  // Pass result to AI so it can react and continue the lesson
  const context = validation.correct
    ? `[exercise result] My answer: "${answer}" — correct! Please continue.`
    : `[exercise result] My answer: "${answer}" — incorrect. Correct was: "${exercise.correct_answer}". Please help me understand and continue.`

  await processInput(ws, meta, context)
}

const ALL_PHASES: LessonPhase[] = [
  'DIAGNOSTIC', 'CONTEXT_INPUT', 'RULE_DISCOVERY',
  'EXERCISES', 'VOCABULARY', 'DEEP_THINKING', 'WRAP_UP',
]
function getPhasesUpTo(phase: LessonPhase): LessonPhase[] {
  const idx = ALL_PHASES.indexOf(phase)
  return idx >= 0 ? ALL_PHASES.slice(0, idx + 1) : []
}

export function attachLessonWS(server: Server): void {
  const wss = new WebSocketServer({ server, path: '/lesson' })

  wss.on('connection', (ws: WebSocket, _req: IncomingMessage) => {
    const heartbeatRef = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.ping()
    }, HEARTBEAT_INTERVAL_MS)

    const meta: ClientMeta = {
      lessonId:        null,
      studentId:       null,
      lessonStartedAt: null,
      lastSeen:        Date.now(),
      heartbeatRef,
      timeoutRef:      setTimeout(() => ws.terminate(), INACTIVITY_TIMEOUT_MS),
      stt:             null,
      ttsController:   null,
    }

    clients.set(ws, meta)
    console.log(`[ws] client connected, total=${clients.size}`)

    ws.on('message', async (raw: Buffer) => {
      resetInactivityTimer(ws, meta)

      let parsed: unknown
      try {
        parsed = JSON.parse(raw.toString())
      } catch {
        send(ws, { type: 'error', code: 'INVALID_JSON', message: 'Message must be valid JSON.' })
        return
      }

      const result = InboundMessageSchema.safeParse(parsed)
      if (!result.success) {
        send(ws, {
          type:    'error',
          code:    'INVALID_MESSAGE',
          message: result.error.issues[0]?.message ?? 'Unknown validation error',
        })
        return
      }

      const msg = result.data
      try {
        switch (msg.type) {
          case 'lesson_start':
            await handleLessonStart(ws, meta, msg.payload)
            break
          case 'focus_lesson_start':
            await handleFocusLessonStart(ws, meta, msg.payload)
            break
          case 'text_message':
            await processInput(ws, meta, msg.text)
            break
          case 'audio_chunk':
            meta.stt?.send(msg.data)
            break
          case 'interrupt':
            meta.ttsController?.abort()
            break
          case 'exercise_answer':
            await handleExerciseAnswer(ws, meta, msg.exerciseId, msg.answer)
            break
        }
      } catch (err) {
        console.error('[ws] handler error:', err)
        send(ws, { type: 'error', code: 'SERVER_ERROR', message: 'Internal error.' })
      }
    })

    ws.on('close', () => {
      clearInterval(meta.heartbeatRef)
      clearTimeout(meta.timeoutRef)
      meta.ttsController?.abort()
      meta.stt?.close()
      clients.delete(ws)
      console.log(`[ws] client disconnected, total=${clients.size}`)
    })

    ws.on('error', (err: Error) => {
      console.error('[ws] client error:', err.message)
    })
  })

  console.log('[ws] LessonWS attached at ws://localhost/lesson')
}
