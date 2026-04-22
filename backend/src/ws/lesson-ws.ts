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
  type LessonPhase,
} from './message-types.js'

const HEARTBEAT_INTERVAL_MS = 30_000
const INACTIVITY_TIMEOUT_MS = 45 * 60 * 1000

interface ClientMeta {
  lessonId:     string | null
  studentId:    string | null
  lastSeen:     number
  heartbeatRef: ReturnType<typeof setInterval>
  timeoutRef:   ReturnType<typeof setTimeout>
}

const clients = new Map<WebSocket, ClientMeta>()

function send(ws: WebSocket, msg: OutboundMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg))
  }
}

function resetInactivityTimer(ws: WebSocket, meta: ClientMeta): void {
  clearTimeout(meta.timeoutRef)
  meta.lastSeen = Date.now()
  meta.timeoutRef = setTimeout(() => {
    ws.terminate()
  }, INACTIVITY_TIMEOUT_MS)
}

async function handleLessonStart(
  ws: WebSocket,
  meta: ClientMeta,
  config: LessonConfig,
): Promise<void> {
  const lessonId = uuid()
  meta.lessonId  = lessonId
  meta.studentId = config.studentId

  await query(
    `INSERT INTO lessons (id, student_id, grammar_target, lesson_topic, textbook_unit)
     VALUES ($1, $2, $3, $4, $5)`,
    [lessonId, config.studentId, config.grammarTarget, config.lessonTopic, config.textbookUnit],
  )

  const initialState = {
    lessonId,
    studentId:         config.studentId,
    phase:             'DIAGNOSTIC' as LessonPhase,
    grammarTarget:     config.grammarTarget,
    lessonTopic:       config.lessonTopic,
    textbookUnit:      config.textbookUnit,
    exerciseCount:     0,
    consecutiveCorrect: 0,
    consecutiveErrors:  0,
    currentDifficulty:  0.5,
    vocabularyTaught:   [],
    errorsThisLesson:   [],
    startedAt:          new Date().toISOString(),
    phaseStartedAt:     new Date().toISOString(),
  }

  const pipeline = redis.pipeline()
  pipeline.set(lessonStateKey(lessonId),   JSON.stringify(initialState), 'EX', LESSON_TTL)
  pipeline.set(lessonContextKey(lessonId), JSON.stringify([]),            'EX', LESSON_TTL)
  pipeline.set(activeSessionKey(config.studentId), lessonId,             'EX', LESSON_TTL)
  await pipeline.exec()

  send(ws, {
    type:  'ai_text',
    phase: 'DIAGNOSTIC',
    text:  `Hello! I'm your English teacher. Today we'll work on "${config.grammarTarget}" using the topic "${config.lessonTopic}". Let's start — tell me, what do you already know about this grammar point?`,
  })
}

async function handleTextMessage(
  ws: WebSocket,
  meta: ClientMeta,
  text: string,
): Promise<void> {
  if (!meta.lessonId) {
    send(ws, { type: 'error', code: 'NO_LESSON', message: 'Start a lesson first.' })
    return
  }

  // Phase 0 stub: echo + log event; real AI response comes in Phase 3
  await query(
    `INSERT INTO lesson_events (lesson_id, event_type, payload)
     VALUES ($1, $2, $3)`,
    [meta.lessonId, 'student_utterance', JSON.stringify({ text })],
  )

  send(ws, {
    type:  'ai_text',
    phase: 'DIAGNOSTIC',
    text:  `[Phase 0 stub] You said: "${text}". AI Teacher responses will be powered by Claude in Phase 3.`,
  })
}

export function attachLessonWS(server: Server): void {
  const wss = new WebSocketServer({ server, path: '/lesson' })

  wss.on('connection', (ws: WebSocket, _req: IncomingMessage) => {
    const heartbeatRef = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.ping()
    }, HEARTBEAT_INTERVAL_MS)

    const meta: ClientMeta = {
      lessonId:    null,
      studentId:   null,
      lastSeen:    Date.now(),
      heartbeatRef,
      timeoutRef:  setTimeout(() => ws.terminate(), INACTIVITY_TIMEOUT_MS),
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
          case 'text_message':
            await handleTextMessage(ws, meta, msg.text)
            break
          case 'audio_chunk':
            // Phase 1: Deepgram STT integration
            break
          case 'exercise_answer':
            // Phase 5: Exercise engine
            break
          case 'interrupt':
            // Phase 1: Stop TTS stream
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
      clients.delete(ws)
      console.log(`[ws] client disconnected, total=${clients.size}`)
    })

    ws.on('error', (err: Error) => {
      console.error('[ws] client error:', err.message)
    })
  })

  console.log('[ws] LessonWS attached at ws://localhost/lesson')
}
