import { WebSocketServer, WebSocket } from 'ws'
import type { IncomingMessage, Server } from 'http'
import { v4 as uuid } from 'uuid'
import { URL } from 'url'
import { query } from '../db/postgres.js'
import { verifyToken } from '../auth/jwt.js'
import { getSubscription, finalizeUsage } from '../billing/subscription-service.js'
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
import type { LessonPhase, LessonState, ErrorRecord } from '../lesson/types.js'
import { getFocusUnit } from '../lesson/focus-content.js'
import { getTeachersBookSection } from '../lesson/focus-teachers-book.js'
import { getFocusStudentBookSection } from '../lesson/focus-student-book.js'
import { getCatalogEntry } from '../lesson/curriculum-catalog.js'
import { LessonOrchestrator } from '../lesson/orchestrator.js'
import type { ExerciseErrorData } from '../lesson/orchestrator.js'
import type { CorrectionTurn } from '../lesson/types.js'
import { DeepgramSTT } from '../voice/stt.js'
import { speakToClient } from '../voice/tts.js'
import { loadExercise, recordAnswer } from '../exercises/exercise-store.js'
import { validateAnswer } from '../exercises/validator.js'
import { useSoftFeedback, buildProtocolOffTopicRecovery } from '../exercises/runtime/index.js'
import { updateStudentProfile } from '../lesson/profile-updater.js'
import { saveTip, getStudentTips } from '../lesson/tips-service.js'
import type { TipRecord } from '../lesson/tips-service.js'
import { getOrCreateSectionCard } from '../lesson/slide-cache.js'
import type { StudentConfused } from './message-types.js'

const HEARTBEAT_INTERVAL_MS = 30_000
const INACTIVITY_TIMEOUT_MS = 45 * 60 * 1000

// Derive unit number from a section string like "2.3" → 2
function unitFromSection(section: string): number {
  const n = parseInt(section.split('.')[0] ?? '1', 10)
  return Number.isNaN(n) || n < 1 ? 1 : n
}

// Resolve teacher display name from id
function teacherDisplayName(teacherId?: string): string {
  return teacherId === 'emma' ? 'Emma' : 'Alex'
}

// ── Voice input filter ────────────────────────────────────────────────────────
// Deepgram fires UtteranceEnd after 1500ms of silence, but short fillers and
// trailing-conjunction fragments still arrive as "complete" utterances.
// We filter them here before sending to the AI.

const FILLER_ONLY = /^(uh+|um+|hmm+|ah+|er+|mm+|yeah|yep|ok|okay|right|sure|wait|so)\s*[.,]?\s*$/i
const TRAILING_CONJUNCTION = /\b(and|but|because|so|or|if|when|that|I|the|a|an|to|of|in)\s*[.,]?\s*$/i
const SINGLE_PRONOUN = /^\s*I\s*$/i

function shouldProcessTranscript(text: string): boolean {
  const t = text.trim()
  if (!t) return false
  if (FILLER_ONLY.test(t)) return false
  if (SINGLE_PRONOUN.test(t)) return false
  if (TRAILING_CONJUNCTION.test(t)) return false
  return true
}

function buildFocusGreeting(
  _unit: number,
  section: string | undefined,
  grammarTarget: string,
  _textbookUnit: string,
  teacherId?: string,
): string {
  const tName = teacherDisplayName(teacherId)

  if (!section) {
    return `Hi! I'm ${tName}, your English teacher. Today we're working on ${grammarTarget}. I'll guide you through the exercises step by step. Just let me know when you're ready to start.`
  }

  const sb           = getFocusStudentBookSection(section)
  const catalogEntry = getCatalogEntry(section)
  const grammarFocus = sb?.grammarFocus ?? catalogEntry?.grammarFocus ?? grammarTarget
  const lessonTitle  = sb?.lessonTitle ?? catalogEntry?.topic ?? ''

  const topicPart = lessonTitle ? ` Today's topic is "${lessonTitle}."` : ''
  const focusPart = grammarFocus !== grammarTarget ? ` We'll practise ${grammarFocus}.` : ''

  return `Hi! I'm ${tName}.${topicPart} Section ${section}${grammarFocus ? ` covers ${grammarFocus}` : ''}.${focusPart} We'll work through the exercises together and I'll help at every step. Let me know when you're ready!`
}

// ── Phase 5: Map exercise type to ErrorRecord errorType ──────────────────────

function toErrorType(exerciseType: string): ErrorRecord['errorType'] {
  if (exerciseType === 'form_transformation') return 'form'
  if (exerciseType === 'reconstruction')      return 'word_order'
  return 'other'
}

// ── Phase 5: Save tips derived from lesson data at lesson end ────────────────
// Called fire-and-forget after result.ended. Reads Redis state for error history.

async function saveLessonEndTipsAsync(
  lessonId:  string,
  studentId: string,
  ws:        WebSocket,
): Promise<void> {
  try {
    const stateRaw = await redis.get(lessonStateKey(lessonId))
    if (!stateRaw) return
    const state = JSON.parse(stateRaw) as LessonState

    const saved: TipRecord[] = []

    // Tips from exercise errors (CORRECTION source)
    for (const err of state.errorsThisLesson ?? []) {
      if (!err.correctAnswer || err.correctAnswer.length > 255) continue
      const tip = await saveTip({
        studentId,
        lessonId,
        section:  state.focusLesson,
        category: err.errorType === 'vocabulary' ? 'VOCAB' : 'COMMON_MISTAKE',
        title:    err.correctAnswer.slice(0, 255),
        explanation:
          `Student wrote "${err.studentAnswer.slice(0, 100)}" — correct form is "${err.correctAnswer.slice(0, 100)}"`,
        example: err.exercise?.slice(0, 200),
        source:  'correction',
      })
      if (tip) saved.push(tip)
    }

    // Tips from vocabulary taught (VOCABULARY source)
    for (const word of state.vocabularyTaught ?? []) {
      if (!word || word.length > 200) continue
      const tip = await saveTip({
        studentId,
        lessonId,
        section:     state.focusLesson,
        category:    'VOCAB',
        title:       word.slice(0, 255),
        explanation: `Vocabulary introduced in section ${state.focusLesson ?? 'this lesson'}`,
        source:      'vocabulary',
      })
      if (tip) saved.push(tip)
    }

    // Broadcast new tips to frontend if still connected
    for (const tip of saved) {
      if (ws.readyState === WebSocket.OPEN) {
        send(ws, { type: 'tip_added', tip })
      }
    }

    const total = (state.errorsThisLesson?.length ?? 0) + (state.vocabularyTaught?.length ?? 0)
    console.log(`[tips] lesson_end saved=${saved.length} skipped_dupes=${total - saved.length} lessonId=${lessonId}`)
  } catch (err) {
    console.error('[tips] saveLessonEndTipsAsync error:', err)
  }
}

// ── Phase 6: Lesson snapshot persistence ─────────────────────────────────────
// Saves LessonState to PostgreSQL so lessons survive beyond the 4-hour Redis TTL.
// Called fire-and-forget on every WS disconnect while a lesson was active.

async function saveLessonSnapshot(
  lessonId:  string,
  sessionId: string | null,
  studentId: string,
): Promise<void> {
  try {
    const stateRaw = await redis.get(lessonStateKey(lessonId))
    if (!stateRaw) return
    await query(
      `INSERT INTO lesson_snapshots (lesson_id, session_id, student_id, snapshot)
       VALUES ($1, $2, $3, $4::jsonb)`,
      [lessonId, sessionId, studentId, stateRaw],
    )
    console.log(`[snapshot] saved lessonId=${lessonId}`)
  } catch (err) {
    console.error('[snapshot] save error:', err)
  }
}

// If Redis TTL expired for a lesson, attempt to restore the latest snapshot (max 24h old)
// back into Redis so the resume flow can proceed normally.
async function restoreSnapshotToRedis(lessonId: string): Promise<string | null> {
  try {
    const res = await query<{ snapshot: unknown }>(
      `SELECT snapshot FROM lesson_snapshots
       WHERE lesson_id = $1 AND created_at > NOW() - INTERVAL '24 hours'
       ORDER BY created_at DESC LIMIT 1`,
      [lessonId],
    )
    if (!res.rows[0]) return null
    const raw = JSON.stringify(res.rows[0].snapshot)
    await redis.set(lessonStateKey(lessonId), raw, 'EX', LESSON_TTL)
    console.log(`[snapshot] restored to Redis lessonId=${lessonId}`)
    return raw
  } catch (err) {
    console.error('[snapshot] restore error:', err)
    return null
  }
}

// ── Phase 2 (recovery): Periodic remaining-time broadcast ────────────────────
// Sends lesson_timer_update every 60 seconds so the frontend can show
// the student how much lesson time remains without needing a local clock.
// Stops automatically when remaining time reaches zero.

function startTimerBroadcast(ws: WebSocket, meta: ClientMeta): void {
  // Send immediately so the frontend has an initial value
  if (meta.lessonStartedAt) {
    const initialRemaining = Math.max(0, MAX_LESSON_MS - (Date.now() - meta.lessonStartedAt))
    send(ws, { type: 'lesson_timer_update', remainingMs: initialRemaining })
  }

  meta.timerUpdateRef = setInterval(() => {
    try {
      if (!meta.lessonStartedAt) return
      const remaining = Math.max(0, MAX_LESSON_MS - (Date.now() - meta.lessonStartedAt))
      send(ws, { type: 'lesson_timer_update', remainingMs: remaining })
      if (remaining <= 0) {
        clearInterval(meta.timerUpdateRef!)
        meta.timerUpdateRef = null
      }
    } catch (err) {
      console.error('[ws] timer broadcast error (ignored):', (err instanceof Error ? err.message : err))
    }
  }, 60_000)
}

const orchestrator = new LessonOrchestrator()

const MAX_LESSON_MS = Number(process.env.PAID_PLAN_LESSON_MINUTES ?? 50) * 60_000

interface ClientMeta {
  lessonId:        string | null
  studentId:       string | null
  userId:          string | null
  sessionId:       string | null   // paid lesson session ID from /lesson/start
  usageId:         string | null   // paid_lesson_usage.id for minute tracking
  lessonStartedAt: number | null
  voiceId:         string | null   // selected TTS voice id
  teacherId:       string | null   // 'alex' | 'emma'
  lastSeen:        number
  heartbeatRef:    ReturnType<typeof setInterval>
  timeoutRef:      ReturnType<typeof setTimeout>
  maxDurationRef:  ReturnType<typeof setTimeout> | null
  warningRef:      ReturnType<typeof setTimeout> | null  // Phase 6: 5-min pre-timeout warning
  timerUpdateRef:  ReturnType<typeof setInterval> | null // Phase 2 recovery: 60s remaining-time broadcast
  stt:             DeepgramSTT | null
  ttsController:   AbortController | null
  ttsActive:       boolean         // true while TTS audio is streaming to client (echo gate)
  aiCallCount:     number          // number of orchestrator.process() calls this session
  ttsCharCount:    number          // total characters sent to TTS this session
  // Serialization guard: prevents concurrent processInput() calls from racing
  // on the same lesson state. If a second input arrives while AI is processing,
  // it is held in queuedInput and replayed when the current turn completes.
  aiProcessing:    boolean
  queuedInput:     string | null
  // Set when interrupt arrives while aiProcessing=true so ttsStream() skips
  // the subsequent TTS — the student already has the mic open.
  interruptPending: boolean
  // Click-to-send: STT transcripts accumulate here without auto-processing.
  // mic_stop from frontend triggers processInput with the accumulated text.
  pendingTranscript: string
  // True when mic_stop arrived before UtteranceEnd — process on next UtteranceEnd.
  pendingMicStop:    boolean
  // Timeout handle: fires 0.8s after pendingMicStop if UtteranceEnd never arrives.
  pendingMicStopTimeoutRef: ReturnType<typeof setTimeout> | null
  // True only while the student has an active mic recording open (mic_start received,
  // not yet finalized by mic_stop). Gates all STT callbacks so late Deepgram events
  // from a previous recording cannot contaminate the next turn.
  micActive: boolean
  // Phase 11: tracks when THIS connection's billing period started.
  // Separate from lessonStartedAt (which is the original lesson wall-clock start
  // used for timeout/remaining-time calculations). Using lessonStartedAt for
  // finalizeUsage caused double-billing on reconnect: after the first session is
  // finalized and a new usage record is created, elapsedMs = Date.now() - originalStart
  // would charge the full lesson duration again instead of just the current session.
  billingStartedAt: number | null
}

const clients = new Map<WebSocket, ClientMeta>()

// Phase 11: returns the existing WS connection that already owns a given lessonId,
// or null if no other connection is active for it. Used to enforce single-ownership.
function findActiveLessonOwner(lessonId: string, exclude: WebSocket): WebSocket | null {
  for (const [ws, m] of clients) {
    if (ws !== exclude && m.lessonId === lessonId) return ws
  }
  return null
}

function send(ws: WebSocket, msg: OutboundMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    try {
      ws.send(JSON.stringify(msg))
    } catch (err) {
      // ws.send() can throw if the socket transitions to CLOSING between the
      // readyState check and the actual send (race on event loop boundary).
      // Log and continue — do not let the error escape into an unguarded caller
      // (e.g. setInterval) where it would become an uncaughtException and crash.
      console.error('[ws] send error (ignored):', (err instanceof Error ? err.message : err))
    }
  }
}

function resetInactivityTimer(ws: WebSocket, meta: ClientMeta): void {
  clearTimeout(meta.timeoutRef)
  meta.lastSeen  = Date.now()
  meta.timeoutRef = setTimeout(() => ws.terminate(), INACTIVITY_TIMEOUT_MS)
}

async function checkAndLinkPaidSession(ws: WebSocket, meta: ClientMeta): Promise<boolean> {
  if (!meta.userId) {
    send(ws, { type: 'error', code: 'AUTH_REQUIRED', message: 'Authentication required.' })
    return false
  }

  // Validate subscription
  const sub = await getSubscription(meta.userId)
  if (!sub || sub.status !== 'active') {
    send(ws, { type: 'error', code: 'PAYMENT_REQUIRED', message: 'Active subscription required.' })
    ws.close(4402, 'Payment required')
    return false
  }
  if (sub.expiresAt && sub.expiresAt < new Date()) {
    send(ws, { type: 'error', code: 'SUBSCRIPTION_EXPIRED', message: 'Subscription expired.' })
    ws.close(4402, 'Subscription expired')
    return false
  }
  if (sub.minutesRemaining <= 0) {
    send(ws, { type: 'error', code: 'LESSON_LIMIT_REACHED', message: 'No lesson minutes remaining.' })
    ws.close(4402, 'Lesson limit reached')
    return false
  }

  // Link to existing usage record created by /lesson/start, or create a new one
  if (meta.sessionId) {
    const existing = await query<{ id: string }>(
      `SELECT id FROM paid_lesson_usage WHERE session_id = $1 AND user_id = $2 AND status = 'active'`,
      [meta.sessionId, meta.userId],
    )
    if (existing.rows[0]) {
      meta.usageId = existing.rows[0].id
    }
  }

  if (!meta.usageId) {
    const r = await query<{ id: string }>(
      `INSERT INTO paid_lesson_usage (user_id, session_id, started_at, status)
       VALUES ($1, $2, NOW(), 'active')
       RETURNING id`,
      [meta.userId, meta.sessionId],
    )
    meta.usageId = r.rows[0]?.id ?? null
  }

  return true
}

// ── Resume logic ──────────────────────────────────────────────────────────────
// Try to restore a lesson that was interrupted (browser close, network drop, etc.)
// Returns true if resumed successfully, false if a fresh lesson must be started.

async function resumeLesson(
  ws: WebSocket,
  meta: ClientMeta,
  existingLessonId: string,
): Promise<boolean> {
  // Phase 6: try Redis first; if expired, attempt DB snapshot restore
  let stateRaw = await redis.get(lessonStateKey(existingLessonId))
  if (!stateRaw) {
    console.log(`[ws] Redis miss — attempting snapshot restore for lessonId=${existingLessonId}`)
    stateRaw = await restoreSnapshotToRedis(existingLessonId)
    if (!stateRaw) {
      console.log(`[ws] resume skipped — no Redis state and no recent snapshot for lessonId=${existingLessonId}`)
      return false
    }
  }

  const state = JSON.parse(stateRaw) as LessonState

  // Phase 11: block resume of already-ended lessons.
  // lesson_sessions.status = 'completed' is the primary guard, but this is a
  // backup for the race window between lesson end and session status update.
  if (state.phase === 'END') {
    console.log(`[ws] resume blocked — lesson phase=END lessonId=${existingLessonId}`)
    return false  // fall through to fresh lesson creation
  }

  // Calculate how much time is left from the original lesson start
  const originalStart = new Date(state.startedAt).getTime()
  const elapsedMs     = Date.now() - originalStart
  const remainingMs   = Math.max(0, MAX_LESSON_MS - elapsedMs)

  if (remainingMs <= 60_000) {
    // Less than 1 minute remaining — not worth resuming
    send(ws, { type: 'error', code: 'SESSION_TIME_LIMIT', message: 'Lesson time has expired. Please start a new lesson.' })
    return true  // handled — don't start fresh
  }

  // Phase 11: enforce single-ownership — only one WS connection may own a lesson.
  // If another tab has the same lesson open, terminate it before resuming here.
  // This prevents two concurrent timers, two STT streams, and concurrent Redis writes.
  const staleOwner = findActiveLessonOwner(existingLessonId, ws)
  if (staleOwner) {
    console.log(`[ws] evicting stale owner for lessonId=${existingLessonId} — new tab took ownership`)
    send(staleOwner, { type: 'error', code: 'LESSON_TAKEN_OVER', message: 'This lesson was resumed in another tab.' })
    staleOwner.terminate()
  }

  // Restore meta state
  meta.lessonId  = existingLessonId
  meta.studentId = state.studentId
  meta.voiceId   = state.voiceId   ?? meta.voiceId
  meta.teacherId = state.teacherId ?? meta.teacherId

  // Phase 6 bug fix: use the ORIGINAL lesson start time for timeout/remaining-time.
  // processInput() computes remainingMs as MAX_LESSON_MS - (Date.now() - lessonStartedAt).
  // Setting this to Date.now() would make the AI think there are 50 full minutes remaining
  // after every reconnect, defeating the time-aware prompting added in Phase 4.
  meta.lessonStartedAt = originalStart

  // Phase 11: billing period starts NOW for this reconnection session.
  // Each session charges only for its own duration — NOT from the original lesson start.
  // Using originalStart here would cause double-billing: after the first session's
  // finalizeUsage creates a new usage record, the second call charges from originalStart
  // again, billing the full elapsed lesson time instead of just this session's time.
  meta.billingStartedAt = Date.now()

  // Reset hard cap to exact remaining time
  meta.maxDurationRef = setTimeout(() => {
    // Guard: lesson may have already ended naturally before timeout fires
    if (!meta.lessonId) return
    console.log(`[paid-lesson] lesson_timeout session=${meta.sessionId} lessonId=${meta.lessonId}`)
    send(ws, { type: 'error', code: 'SESSION_TIME_LIMIT', message: 'Maximum lesson duration reached.' })
    ws.close(4408, 'Time limit reached')
  }, remainingMs)

  // Phase 6: 5-minute warning before the hard cap
  if (remainingMs > 5 * 60_000) {
    meta.warningRef = setTimeout(() => {
      send(ws, { type: 'lesson_time_warning', remainingMs: 5 * 60_000 })
      console.log(`[paid-lesson] time_warning_sent remainingMs=300000 session=${meta.sessionId}`)
    }, remainingMs - 5 * 60_000)
  }

  // Phase 2 recovery: start periodic remaining-time broadcast using restored start time
  startTimerBroadcast(ws, meta)

  // Restart STT for new connection (click-to-send mode).
  // Always close the previous STT first to avoid duplicate Deepgram connections
  // and queue-flush errors if the old instance is still in CONNECTING state.
  meta.stt?.close()
  meta.stt               = null
  meta.pendingTranscript = ''
  meta.pendingMicStop    = false
  meta.micActive         = false  // set true on next mic_start
  meta.stt = createSTT(ws, meta)

  const tName   = teacherDisplayName(meta.teacherId ?? undefined)
  const exNote  = state.currentExerciseNum > 0
    ? ` We were on Exercise ${state.currentExerciseNum}.`
    : ''
  const resumeMsg = `Welcome back! I'm ${tName}.${exNote} Let's continue — what do you remember from where we stopped?`

  // Send lesson_resumed only (no separate ai_text to avoid duplicate chat message)
  send(ws, {
    type:        'lesson_resumed',
    phase:       state.phase,
    exerciseNum: state.currentExerciseNum,
    message:     resumeMsg,
  })

  // Phase 3: restore exercise cursor state on resume if an exercise was active
  if (state.currentExerciseNum > 0 && state.currentItem) {
    send(ws, {
      type: 'exercise_cursor_updated',
      cursor: {
        unit:           state.focusUnit,
        section:        state.focusLesson,
        exerciseNumber: state.currentExerciseNum,
        // Phase 11: use stored exerciseType — falls back to 'unknown' only for old snapshots
        exerciseType:   state.activeExerciseType ?? 'unknown',
        // Phase 2.7: restore full instruction + items + options so matching exercises display correctly
        instruction:    state.exerciseInstruction ?? '',
        currentItem:    state.currentItem,
        itemIndex:      state.itemIndex ?? 0,
        itemTotal:      state.exerciseItems?.length ?? 0,
        completedItems: state.completedItems ?? [],
        failedItems:    state.failedItems    ?? [],
        wordBoxState:   state.wordBoxState   ?? null,
        items:          state.exerciseItems,
        options:        state.exerciseOptions,
        // Phase 2.6: restore authoritative exerciseId so frontend pendingId stays in sync
        exerciseId:     state.currentExerciseId ?? null,
      },
    })
    console.log(
      `[ws] resume_cursor_sent type=${state.activeExerciseType ?? 'unknown'} ` +
      `items=${state.exerciseItems?.length ?? 0} options=${state.exerciseOptions?.length ?? 0} ` +
      `exerciseId=${state.currentExerciseId ?? 'none'}`,
    )
  }

  // Phase 11: stamp lesson_id on the new usage record created for this reconnect session
  if (meta.usageId) {
    query(
      `UPDATE paid_lesson_usage SET lesson_id = $1 WHERE id = $2`,
      [existingLessonId, meta.usageId],
    ).catch((err: unknown) => console.error('[ws] resume usage lesson_id stamp error:', err))
  }

  await ttsStream(ws, meta, resumeMsg)

  console.log(`[ws] lesson resumed lessonId=${existingLessonId} phase=${state.phase} exercise=${state.currentExerciseNum} remainingMs=${remainingMs}`)
  return true
}

async function handleLessonStart(
  ws: WebSocket,
  meta: ClientMeta,
  config: LessonConfig,
): Promise<void> {
  if (!await checkAndLinkPaidSession(ws, meta)) return

  const effectiveStudentId = meta.studentId ?? config.studentId
  const lessonId = uuid()
  meta.lessonId        = lessonId
  meta.studentId       = effectiveStudentId
  meta.lessonStartedAt = Date.now()
  // Phase 11: billing period starts when this connection starts a new lesson
  meta.billingStartedAt = Date.now()

  // Enforce 50-minute hard cap per paid session
  meta.maxDurationRef = setTimeout(() => {
    // Guard: lesson may have already ended naturally before timeout fires
    if (!meta.lessonId) return
    console.log(`[paid-lesson] lesson_timeout session=${meta.sessionId} lessonId=${meta.lessonId}`)
    send(ws, { type: 'error', code: 'SESSION_TIME_LIMIT', message: 'Maximum lesson duration reached.' })
    ws.close(4408, 'Time limit reached')
  }, MAX_LESSON_MS)

  // Phase 6: warn 5 minutes before the hard cap
  if (MAX_LESSON_MS > 5 * 60_000) {
    meta.warningRef = setTimeout(() => {
      send(ws, { type: 'lesson_time_warning', remainingMs: 5 * 60_000 })
      console.log(`[paid-lesson] time_warning_sent session=${meta.sessionId}`)
    }, MAX_LESSON_MS - 5 * 60_000)
  }

  await query(
    `INSERT INTO lessons (id, student_id, grammar_target, lesson_topic, textbook_unit)
     VALUES ($1, $2, $3, $4, $5)`,
    [lessonId, effectiveStudentId, config.grammarTarget, config.lessonTopic, config.textbookUnit],
  )

  const initialState: LessonState = {
    lessonId,
    studentId:      effectiveStudentId,
    phase:          'DIAGNOSTIC',
    mode:           'free',
    grammarTarget:  config.grammarTarget,
    lessonTopic:    config.lessonTopic,
    textbookUnit:   config.textbookUnit,
    currentExerciseNum:  0,
    completedExercises:  [],
    // Phase 3: item-level cursor
    itemIndex:      0,
    currentItem:    '',
    completedItems: [],
    failedItems:    [],
    wordBoxState:   null,
    // Phase 2: correction tracking
    itemRetryCount: 0,
    correctionTurn: null,
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
    overviewShown:           false,
    startedAt:      new Date().toISOString(),
    phaseStartedAt: new Date().toISOString(),
  }

  const pipeline = redis.pipeline()
  pipeline.set(lessonStateKey(lessonId),              JSON.stringify(initialState), 'EX', LESSON_TTL)
  pipeline.set(lessonContextKey(lessonId),             JSON.stringify([]),            'EX', LESSON_TTL)
  pipeline.set(activeSessionKey(effectiveStudentId),  lessonId,                     'EX', LESSON_TTL)
  await pipeline.exec()

  meta.micActive = false  // set true on first mic_start
  meta.stt = createSTT(ws, meta)

  // Phase 2 recovery: start periodic remaining-time broadcast
  startTimerBroadcast(ws, meta)

  const greeting = `Hello! I'm Alex, your English teacher. Today we'll work on "${config.grammarTarget}" — the topic is "${config.lessonTopic}". To begin: can you give me one example sentence using this grammar?`

  console.log(`[paid-lesson] lesson_start_new lessonId=${lessonId} session=${meta.sessionId} unit=${config.textbookUnit}`)
  send(ws, { type: 'ai_text', phase: 'DIAGNOSTIC', text: greeting })
  await ttsStream(ws, meta, greeting)
}

async function handleFocusLessonStart(
  ws: WebSocket,
  meta: ClientMeta,
  config: FocusLessonConfig,
): Promise<void> {
  console.log(`[paid-lesson] begin clicked session=${meta.sessionId} unit=${config.unit} section=${config.section ?? 'none'}`)

  // Guard: reject duplicate focus_lesson_start on the same WS connection
  if (meta.lessonId) {
    console.log(`[paid-lesson] duplicate_begin_ignored lessonId=${meta.lessonId}`)
    return
  }

  if (!await checkAndLinkPaidSession(ws, meta)) return

  // ── Store teacher + voice from config (before any early return) ──────────
  if (config.teacherId) meta.teacherId = config.teacherId
  if (config.voiceId)   meta.voiceId   = config.voiceId

  // ── Derive unit from section number (e.g. "2.3" → unit 2) ───────────────
  // The frontend sends VITE_LESSON_UNIT which may not match the actual section.
  // Always trust the section number over the unit field.
  const effectiveUnit = config.section ? unitFromSection(config.section) : config.unit

  // ── Resume check: if this sessionId already has an active lesson in DB ───
  if (meta.sessionId && meta.userId) {
    const existingRow = await query<{ lesson_id: string | null }>(
      `SELECT lesson_id FROM lesson_sessions WHERE session_id = $1 AND user_id = $2 AND status = 'active'`,
      [meta.sessionId, meta.userId],
    )
    const existingLessonId = existingRow.rows[0]?.lesson_id
    console.log(
      `[paid-lesson] focus_lesson_start_path session=${meta.sessionId} ` +
      `existing_lesson=${existingLessonId ?? 'none'}`,
    )
    if (existingLessonId) {
      const resumed = await resumeLesson(ws, meta, existingLessonId)
      if (resumed) {
        console.log(`[paid-lesson] focus_lesson_start_resumed lessonId=${existingLessonId} session=${meta.sessionId}`)
        return
      }
      console.log(`[paid-lesson] focus_lesson_start_resume_failed_new_lesson session=${meta.sessionId}`)
      // Redis expired — fall through to create a new lesson
    }
  }

  const unitData = getFocusUnit(effectiveUnit)
  if (!unitData) {
    send(ws, { type: 'error', code: 'UNIT_NOT_FOUND', message: `Focus 2 Unit ${effectiveUnit} is not available yet.` })
    return
  }

  const effectiveStudentId = meta.studentId ?? config.studentId
  if (!effectiveStudentId) {
    send(ws, { type: 'error', code: 'NO_STUDENT', message: 'No authenticated student.' })
    return
  }

  const lessonId = uuid()
  meta.lessonId        = lessonId
  meta.studentId       = effectiveStudentId
  meta.lessonStartedAt = Date.now()
  // Phase 11: billing period starts when this connection starts a new lesson
  meta.billingStartedAt = Date.now()

  // Enforce 50-minute hard cap per paid session
  meta.maxDurationRef = setTimeout(() => {
    // Guard: lesson may have already ended naturally before timeout fires
    if (!meta.lessonId) return
    console.log(`[paid-lesson] lesson_timeout session=${meta.sessionId} lessonId=${meta.lessonId}`)
    send(ws, { type: 'error', code: 'SESSION_TIME_LIMIT', message: 'Maximum lesson duration reached.' })
    ws.close(4408, 'Time limit reached')
  }, MAX_LESSON_MS)

  // Phase 6: warn 5 minutes before the hard cap
  if (MAX_LESSON_MS > 5 * 60_000) {
    meta.warningRef = setTimeout(() => {
      send(ws, { type: 'lesson_time_warning', remainingMs: 5 * 60_000 })
      console.log(`[paid-lesson] time_warning_sent session=${meta.sessionId}`)
    }, MAX_LESSON_MS - 5 * 60_000)
  }

  // When a specific section is selected, use its metadata as the authoritative
  // source for grammarTarget and lessonTopic — not the unit-level defaults.
  let grammarTarget = unitData.grammarTarget
  let lessonTopic   = unitData.lessonTopic
  if (config.section) {
    const sectionData = getFocusStudentBookSection(config.section)
    if (sectionData?.grammarFocus) grammarTarget = sectionData.grammarFocus
    if (sectionData?.lessonTitle)  lessonTopic   = sectionData.lessonTitle
  }

  await query(
    `INSERT INTO lessons (id, student_id, grammar_target, lesson_topic, textbook_unit)
     VALUES ($1, $2, $3, $4, $5)`,
    [lessonId, effectiveStudentId, grammarTarget, lessonTopic, unitData.textbookUnit],
  )

  // Write lessonId back to lesson_sessions so reconnections can resume
  // Phase 11: also stamp lesson_id on the usage record for per-lesson billing queries
  if (meta.sessionId) {
    await query(
      `UPDATE lesson_sessions SET lesson_id = $1, status = 'active', updated_at = NOW() WHERE session_id = $2`,
      [lessonId, meta.sessionId],
    )
  }
  if (meta.usageId) {
    query(
      `UPDATE paid_lesson_usage SET lesson_id = $1 WHERE id = $2`,
      [lessonId, meta.usageId],
    ).catch((err: unknown) => console.error('[ws] usage lesson_id stamp error:', err))
  }

  const initialState: LessonState = {
    lessonId,
    studentId:      effectiveStudentId,
    phase:          'DIAGNOSTIC',
    mode:           'focus',
    focusUnit:      effectiveUnit,
    focusLesson:    config.section,
    grammarTarget,
    lessonTopic,
    textbookUnit:   unitData.textbookUnit,
    teacherId:      meta.teacherId ?? undefined,
    voiceId:        meta.voiceId   ?? undefined,
    currentExerciseNum:  0,
    completedExercises:  [],
    // Phase 3: item-level cursor
    itemIndex:      0,
    currentItem:    '',
    completedItems: [],
    failedItems:    [],
    wordBoxState:   null,
    // Phase 2: correction tracking
    itemRetryCount: 0,
    correctionTurn: null,
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
    overviewShown:           false,
    startedAt:      new Date().toISOString(),
    phaseStartedAt: new Date().toISOString(),
  }

  const pipeline = redis.pipeline()
  pipeline.set(lessonStateKey(lessonId),             JSON.stringify(initialState), 'EX', LESSON_TTL)
  pipeline.set(lessonContextKey(lessonId),            JSON.stringify([]),            'EX', LESSON_TTL)
  pipeline.set(activeSessionKey(effectiveStudentId), lessonId,                     'EX', LESSON_TTL)
  await pipeline.exec()

  meta.micActive = false  // set true on first mic_start
  meta.stt = createSTT(ws, meta)

  console.log(`[paid-lesson] lesson_start_new lessonId=${lessonId} session=${meta.sessionId} unit=${effectiveUnit} section=${config.section ?? 'none'}`)

  // Phase 2 recovery: start periodic remaining-time broadcast
  startTimerBroadcast(ws, meta)

  // Personalise greeting with selected teacher name
  const greeting = buildFocusGreeting(effectiveUnit, config.section, unitData.grammarTarget, unitData.textbookUnit, meta.teacherId ?? undefined)

  send(ws, { type: 'ai_text', phase: 'DIAGNOSTIC', text: greeting })

  // For grammar sections, asynchronously generate/load the section overview card
  if (config.section) {
    const sb = getFocusStudentBookSection(config.section)
    const ce = getCatalogEntry(config.section)
    const isGrammar = sb?.type === 'Grammar' || ce?.type === 'grammar'
    if (isGrammar) sendSectionCardAsync(ws, config.section)
  }

  // Phase 5: send recent tips so the frontend Tips drawer can populate immediately
  void getStudentTips(effectiveStudentId, 30).then((tips) => {
    if (tips.length > 0 && ws.readyState === WebSocket.OPEN) {
      send(ws, { type: 'tip_list', tips })
    }
  }).catch((err: unknown) => {
    console.error('[tips] tip_list send error:', err)
  })

  await ttsStream(ws, meta, greeting)
}

// Reads the current lesson state to build an off-topic recovery suffix.
// Appended to student input when an exercise is active so the AI knows to
// answer briefly and return to the current item.
async function buildOffTopicGuard(lessonId: string): Promise<string> {
  try {
    const stateRaw = await redis.get(lessonStateKey(lessonId))
    if (!stateRaw) return ''
    const state = JSON.parse(stateRaw) as LessonState
    if (!state.currentExerciseNum || !state.currentItem) return ''
    const type = state.activeExerciseType ?? 'unknown'
    const recovery = buildProtocolOffTopicRecovery(type, state.currentItem, state.itemIndex ?? 0)
    return recovery
  } catch {
    return ''
  }
}

async function processInput(
  ws: WebSocket,
  meta: ClientMeta,
  text: string,
  sendCard = false,
  skipOffTopicGuard = false,
): Promise<void> {
  if (!meta.lessonId) {
    send(ws, { type: 'error', code: 'NO_LESSON', message: 'Start a lesson first.' })
    return
  }

  // Guard: if a previous AI call is still in-flight, queue the latest input
  // instead of silently dropping it. Only one pending input is kept (newest wins).
  if (meta.aiProcessing) {
    meta.queuedInput = text
    console.log(`[paid-lesson] ai_turn_queued input_chars=${text.trim().length}`)
    return
  }
  meta.aiProcessing = true

  // Phase 4: compute remaining lesson time for time-aware AI prompting
  const elapsedMs   = meta.lessonStartedAt ? Date.now() - meta.lessonStartedAt : 0
  const remainingMs = Math.max(0, MAX_LESSON_MS - elapsedMs)

  // Inject off-topic recovery guard for regular student turns when an exercise is active.
  // System-generated contexts (correction, confusion) set skipOffTopicGuard=true to avoid
  // double-injecting recovery instructions that are already protocol-encoded in the context.
  let inputText = text
  if (!skipOffTopicGuard) {
    const guard = await buildOffTopicGuard(meta.lessonId)
    if (guard) {
      inputText = text + guard
    }
  }

  console.log(`[paid-lesson] ai_turn_started input_chars=${text.trim().length} remaining_min=${Math.round(remainingMs / 60_000)}`)
  let result: Awaited<ReturnType<typeof orchestrator.process>> | undefined
  try {
    result = await orchestrator.process(meta.lessonId, inputText, { remainingMs })
  } finally {
    meta.aiProcessing = false
    // Process any input that arrived while AI was busy
    if (meta.queuedInput) {
      const queued    = meta.queuedInput
      meta.queuedInput = null
      console.log(`[paid-lesson] ai_turn_queued_replay input_chars=${queued.trim().length}`)
      processInput(ws, meta, queued).catch((err: unknown) =>
        console.error('[paid-lesson] processInput error (queued):', err))
    }
  }
  if (!result) return
  meta.aiCallCount++

  send(ws, { type: 'ai_text', phase: result.phase, text: result.text, displayText: result.displayText })

  // When handling confusion, send the AI's display_text as a teaching card
  if (sendCard && result.displayText && result.displayText !== result.text) {
    send(ws, { type: 'teaching_card', cardType: 'mini_explanation', displayText: result.displayText })
  }

  if (result.phaseChanged) {
    send(ws, { type: 'phase_change', from: result.previousPhase, to: result.phase })
    console.log(`[ws] phase ${result.previousPhase} → ${result.phase}`)
  }

  if (result.exercise) {
    send(ws, {
      type: 'exercise',
      exercise: {
        id:             result.exercise.id,
        exerciseType:   result.exercise.type,
        question:       result.exercise.question,
        hint:           result.exercise.hint,
        difficulty:     result.exercise.difficulty,
        exerciseNumber: result.exercise.exerciseNumber,
        instruction:    result.exercise.instruction,
        skillFocus:     result.exercise.skillFocus,
        items:          result.exercise.items,
        options:        result.exercise.options,
      },
    })
  }

  // Phase 3: send authoritative exercise cursor whenever it changes
  if (result.exerciseCursor) {
    send(ws, { type: 'exercise_cursor_updated', cursor: result.exerciseCursor })
    console.log(`[paid-lesson] cursor_updated exercise=#${result.exerciseCursor.exerciseNumber} item=${result.exerciseCursor.itemIndex}/${result.exerciseCursor.itemTotal}`)
  }

  if (result.ended) {
    // Phase 6: calculate elapsed from original lesson start (not WS connect time)
    const durationMin = meta.lessonStartedAt
      ? Math.round((Date.now() - meta.lessonStartedAt) / 60_000)
      : 0
    console.log(`[paid-lesson] lesson_end_natural lessonId=${meta.lessonId} session=${meta.sessionId} durationMin=${durationMin} exercises=${result.exerciseScore}`)
    send(ws, {
      type: 'lesson_end',
      summary: {
        lessonId:        meta.lessonId,
        phasesReached:   getPhasesUpTo(result.previousPhase),
        exerciseScore:   result.exerciseScore,    // Phase 6: real value from state.exerciseCount
        vocabularyCount: result.vocabularyCount,  // Phase 6: real value from state.vocabularyTaught.length
        durationMin,
      },
    })

    // Mark lesson_sessions completed so resume no longer triggers
    if (meta.sessionId) {
      query(
        `UPDATE lesson_sessions SET status = 'completed', updated_at = NOW() WHERE session_id = $1`,
        [meta.sessionId],
      ).catch((err: unknown) => console.error('[ws] session status update error:', err))
    }

    // Capture IDs before clearing meta (async operations below use these)
    const endedLessonId  = meta.lessonId
    const endedStudentId = meta.studentId

    // Update student profile async — don't block the response
    if (endedStudentId && endedLessonId) {
      updateStudentProfile(endedLessonId, endedStudentId).catch((err: unknown) => {
        console.error('[ws] profile update failed:', err)
      })
      // Phase 5: save learning tips derived from lesson data (errors + vocabulary)
      void saveLessonEndTipsAsync(endedLessonId, endedStudentId, ws)
    }

    meta.lessonId = null
    meta.stt?.close()
    meta.stt = null
    return
  }

  console.log(`[paid-lesson] ai_turn_completed phase=${result.phase}`)
  await ttsStream(ws, meta, result.text)
}

async function ttsStream(ws: WebSocket, meta: ClientMeta, text: string): Promise<void> {
  // Student interrupted while AI was processing — skip TTS for this turn.
  // teacher_turn_end is still sent so the frontend mic lifecycle completes cleanly.
  if (meta.interruptPending) {
    meta.interruptPending = false
    meta.ttsActive = false
    console.log(`[paid-lesson] tts_skipped reason=interrupt_pending chars=${text.length}`)
    send(ws, { type: 'teacher_turn_end' })
    return
  }
  meta.ttsCharCount += text.length
  meta.ttsActive = true
  const prev = meta.ttsController
  meta.ttsController = new AbortController()
  // Abort previous AFTER registering new controller so the chain is clean
  try { prev?.abort() } catch { /* ignore abort-chain side effects */ }
  console.log(`[paid-lesson] teacher_speaking start chars=${text.length}`)
  try {
    await speakToClient(
      (msg) => send(ws, msg),
      text,
      meta.ttsController.signal,
      meta.voiceId ?? undefined,
    )
    console.log(`[paid-lesson] teacher_speaking end chars=${text.length}`)
    // Signal frontend that all TTS audio has been sent for this turn.
    // The client uses this to calculate accurate audio-queue completion time
    // and disable the mic until the queued audio actually finishes playing.
    send(ws, { type: 'teacher_turn_end' })
  } catch (err: unknown) {
    const isAbort = err instanceof Error && err.name === 'AbortError'
    if (!isAbort) {
      console.error('[ws] TTS error:', err instanceof Error ? err.message : err)
      // Send teacher_turn_end so the frontend mic lifecycle completes even on TTS failure.
      // Without this the frontend stays in isSpeaking=true forever and the mic never enables.
      send(ws, { type: 'teacher_turn_end' })
    }
    // Do NOT send teacher_turn_end on abort — frontend already handles interruption
  } finally {
    meta.ttsActive = false
  }
}

// Exercise-type-specific guiding questions for TURN A (narrows the hint direction)
const TYPE_TURN_A_SUPPLEMENT: Partial<Record<string, string>> = {
  matching:            'What connects these two items? Think about their category or relationship.',
  vocabulary_matching: 'Think about what this word means in context. Does it fit this definition?',
  fill_gap:            'Think about tense and agreement — what does the grammar context require here?',
  form_transformation: 'Keep the same meaning — what specifically needs to change: verb form, word order, or auxiliary?',
  error_correction:    'Look at the underlined element. Does it follow the grammar rule we practised?',
  reading:             'Hear the stressed syllable — where does the stress fall in this word?',
  speaking_prompt:     'Is the verb form correct? Think about the tense the exercise is asking for.',
  reconstruction:      'Start with the first element. Where does the subject / auxiliary go in English?',
}

// Exercise-type-specific hints for TURN B (one concrete missing piece)
const TYPE_TURN_B_SUPPLEMENT: Partial<Record<string, string>> = {
  matching:            'Give a category clue: both items belong to the same semantic group — try again with that in mind.',
  vocabulary_matching: 'Look at the sentence context. The word is used to describe [meaning area] — which option fits?',
  fill_gap:            'The action is [ongoing / completed / relating to now] — which verb form shows that?',
  form_transformation: 'The structure you need starts with [first word of the correct form]. What comes after that?',
  error_correction:    'The error is specifically in the [verb / article / preposition / word order]. Read just that part aloud.',
  speaking_prompt:     'The verb needs [tense marker]. Say the sentence again with that correction.',
}

function buildCorrectionContext(answer: string, correctAnswer: string, turn: CorrectionTurn, exerciseType?: string): string {
  const turnANote = exerciseType && TYPE_TURN_A_SUPPLEMENT[exerciseType]
    ? `\n  Exercise-type guidance: ${TYPE_TURN_A_SUPPLEMENT[exerciseType]}`
    : '\n  Examples: "For \'he\', do we use do or does?" / "Is this verb regular or irregular?"'

  const turnBNote = exerciseType && TYPE_TURN_B_SUPPLEMENT[exerciseType]
    ? `\n  Exercise-type guidance: ${TYPE_TURN_B_SUPPLEMENT[exerciseType]}`
    : '\n  Examples: "Third person singular uses ___, not \'do\'." / "This is an irregular verb: go → ..."'

  const TURN_INSTRUCTIONS: Record<CorrectionTurn, string> = {
    A: `TURN A (attempt 1): Ask ONE guiding question targeting the exact knowledge gap. Give ZERO part of the answer.
  Think: what specific rule caused this error? Ask about only that.${turnANote}`,
    B: `TURN B (attempt 2): Give ONE small hint — one missing piece of information. Do NOT reveal the full answer.${turnBNote}`,
    C: `TURN C (attempt 3): Give a STRONGER hint. Student is still stuck — fill in almost everything.
  Examples: "It starts with 'Does he...' — what verb comes next?" / "go → _ent in the past. Fill in the blank."`,
    D: `TURN D (attempt 4+): REVEAL THE FULL ANSWER NOW.
  Say: "The answer is ${correctAnswer}. [Brief rule in one sentence]. Now repeat the full sentence after me."
  Wait for the student to repeat correctly, then advance to the next item.`,
  }

  return `[EXERCISE RESULT] Student answered: "${answer}" — INCORRECT.
Correct answer (Teacher's Book reference — do NOT reveal until TURN D): "${correctAnswer}".

CORRECTION LADDER — you are at ${turn === 'D' ? 'TURN D — REVEAL THE ANSWER' : `TURN ${turn}`}:
${TURN_INSTRUCTIONS[turn]}

Set "exercise": null — do NOT advance the item until the student answers correctly (or until TURN D is resolved).
Do NOT restart at TURN A. You are at TURN ${turn}. Stay here.`
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

  // Phase 2.6: include score in feedback event (backward-compatible — frontend ignores unknown fields)
  send(ws, { type: 'feedback', correct: validation.correct, explanation: validation.feedback, score: validation.score })

  // Soft-feedback types (speaking, discussion, roleplay, grammar_focus, etc.) must NOT
  // use the binary correction ladder — there is no single "correct answer" to reveal.
  // Protocol runner determines this from the exercise type's runtimeMode.
  const isOpenSpeaking = useSoftFeedback(exercise.type)

  let context: string

  if (validation.correct) {
    // Advance item in orchestrator and get updated cursor immediately
    const cursor = await orchestrator.recordCorrectAnswer(meta.lessonId)

    // Broadcast cursor before AI responds so frontend is immediately in sync
    if (cursor) {
      send(ws, { type: 'exercise_cursor_updated', cursor })
      console.log(`[paid-lesson] cursor_advanced exercise=#${cursor.exerciseNumber} item=${cursor.itemIndex}/${cursor.itemTotal}`)
    }

    const exerciseDone = cursor && cursor.itemIndex >= cursor.itemTotal
    const nextItemHint = cursor && !exerciseDone && cursor.currentItem
      ? `\nThe orchestrator has advanced to item ${cursor.itemIndex + 1}: "${cursor.currentItem}". Present it now.`
      : ''
    const completionHint = exerciseDone
      ? `\nAll items of Exercise ${cursor?.exerciseNumber ?? exercise.exerciseNumber} are now complete. Announce completion and introduce the next exercise.`
      : ''

    context = `[EXERCISE RESULT] Student answered: "${answer}" — CORRECT.
Confirm with one word ("Exactly." / "Right." / "Correct.").
Explain WHY in one sentence — state the grammar rule that makes this correct.${nextItemHint}${completionHint}`
  } else if (isOpenSpeaking) {
    // Open speaking: soft improvement request — no correction ladder, no "reveal the answer"
    const scoreNote = validation.score > 0 ? ` Score: ${(validation.score * 100).toFixed(0)}/100.` : ''
    context = `[EXERCISE RESULT - OPEN SPEAKING] Student answered: "${answer}".${scoreNote}
Evaluator feedback: "${validation.feedback}"
This is an open speaking task — there is no single fixed correct answer.
Ask the student to try again with ONE specific improvement suggestion.
Do NOT reveal a model answer. Do NOT use the correction ladder.
Set exercise: null — do not advance the item yet.`
  } else {
    // Phase 5: pass error details so errorsThisLesson is populated for tips and agenda context
    const errorData: ExerciseErrorData = {
      exercise:      exercise.question,
      studentAnswer: answer,
      correctAnswer: exercise.correct_answer,
      errorType:     toErrorType(exercise.type),
    }
    const turn = await orchestrator.recordWrongAnswer(meta.lessonId, errorData)
    context = buildCorrectionContext(answer, exercise.correct_answer, turn, exercise.type)
  }

  // Protocol correction context already contains off-topic recovery info — skip guard.
  await processInput(ws, meta, context, false, true)
}

async function handleStudentConfused(
  ws: WebSocket,
  meta: ClientMeta,
  msg: StudentConfused,
): Promise<void> {
  if (!meta.lessonId) {
    send(ws, { type: 'error', code: 'NO_LESSON', message: 'Start a lesson first.' })
    return
  }

  const parts: string[] = ['[STUDENT_CONFUSED] The student clicked "I don\'t understand".']
  if (msg.lastTeacherMessage) parts.push(`Last teacher message: "${msg.lastTeacherMessage}"`)
  if (msg.lastExercise)       parts.push(`Current exercise: "${msg.lastExercise}"`)
  if (msg.studentLastAnswer)  parts.push(`Student\'s last answer: "${msg.studentLastAnswer}"`)
  parts.push('Follow the CONFUSION PROTOCOL. Identify the specific knowledge gap. Present a MINI TEACHING CARD in display_text.')

  // Phase 5: save a confusion tip (non-blocking — runs before AI responds)
  const capturedLessonId  = meta.lessonId
  const capturedStudentId = meta.studentId
  if (capturedStudentId) {
    void (async () => {
      try {
        const stateRaw = await redis.get(lessonStateKey(capturedLessonId))
        if (!stateRaw) return
        const st = JSON.parse(stateRaw) as LessonState
        const exerciseContext = msg.lastExercise
          ? ` — exercise: "${msg.lastExercise.slice(0, 100)}"`
          : ''
        const tip = await saveTip({
          studentId:   capturedStudentId,
          lessonId:    capturedLessonId,
          section:     st.focusLesson,
          category:    'GRAMMAR',
          title:       st.grammarTarget.slice(0, 255),
          explanation: `Student needed clarification during ${st.phase} phase${exerciseContext}`,
          source:      'confusion',
        })
        if (tip && ws.readyState === WebSocket.OPEN) {
          send(ws, { type: 'tip_added', tip })
        }
      } catch (err) {
        console.error('[tips] confusion tip error:', err)
      }
    })()
  }

  const confusionContext = parts.join('\n')
  await processInput(ws, meta, confusionContext, true, true)
}

/** Fire-and-forget: generate (or load from cache) a section grammar card and send to client. */
function sendSectionCardAsync(ws: WebSocket, sectionId: string): void {
  getOrCreateSectionCard(sectionId)
    .then((card) => {
      if (card && ws.readyState === WebSocket.OPEN) {
        send(ws, { type: 'section_card', sectionId, card })
        console.log(`[ws] section_card sent for ${sectionId}`)
      }
    })
    .catch((err: unknown) => {
      console.error('[ws] section card generation failed:', err)
    })
}

const ALL_PHASES: LessonPhase[] = [
  'DIAGNOSTIC', 'CONTEXT_INPUT', 'RULE_DISCOVERY',
  'EXERCISES', 'VOCABULARY', 'DEEP_THINKING', 'WRAP_UP',
]
function getPhasesUpTo(phase: LessonPhase): LessonPhase[] {
  const idx = ALL_PHASES.indexOf(phase)
  return idx >= 0 ? ALL_PHASES.slice(0, idx + 1) : []
}

// ── STT factory ───────────────────────────────────────────────────────────────
// Single authoritative STT callback definition shared by lesson start, focus
// lesson start, and resume. Keeps all three paths byte-for-byte identical so
// a bug fix in callbacks applies everywhere.

function createSTT(ws: WebSocket, meta: ClientMeta): DeepgramSTT {
  return new DeepgramSTT(
    // ── onTranscript: fires on UtteranceEnd (silence ≥ UTTERANCE_END_MS) ────
    (transcript) => {
      if (meta.ttsActive) {
        console.log(`[paid-lesson] ignored_stt reason=teacher_speaking chars=${transcript.trim().length}`)
        return
      }
      // mic_stop is pending — student clicked stop before UtteranceEnd arrived.
      // Process regardless of micActive (the flag will be cleared below).
      if (meta.pendingMicStop) {
        if (meta.pendingMicStopTimeoutRef) {
          clearTimeout(meta.pendingMicStopTimeoutRef)
          meta.pendingMicStopTimeoutRef = null
        }
        const fullText = (meta.pendingTranscript
          ? meta.pendingTranscript + ' ' + transcript
          : transcript
        ).trim()
        meta.pendingMicStop    = false
        meta.pendingTranscript = ''
        meta.micActive         = false  // turn finalized — discard any further events
        meta.stt?.clearBuffer()
        if (fullText) {
          console.log(`[paid-lesson] student_turn_finalized chars=${fullText.length} trigger=mic_stop`)
          send(ws, { type: 'student_message', text: fullText })
          processInput(ws, meta, fullText).catch((err: unknown) =>
            console.error('[paid-lesson] processInput error (stt-micstop):', err))
        }
        return
      }
      // Discard late Deepgram events that arrive between turns
      if (!meta.micActive) return
      if (!shouldProcessTranscript(transcript)) {
        console.log(`[paid-lesson] ignored_stt reason=invalid_transcript chars=${transcript.trim().length}`)
        return
      }
      meta.pendingTranscript = meta.pendingTranscript
        ? meta.pendingTranscript + ' ' + transcript
        : transcript
      console.log(`[paid-lesson] stt_accumulated pending_chars=${meta.pendingTranscript.length}`)
      send(ws, { type: 'transcript', text: meta.pendingTranscript })
    },
    // ── onInterim: fires on is_final and interim Deepgram events ─────────────
    (interim) => {
      if (!meta.micActive || meta.ttsActive) return
      const fullInterim = meta.pendingTranscript
        ? meta.pendingTranscript + ' ' + interim
        : interim
      send(ws, { type: 'transcript', text: fullInterim })
    },
  )
}

export function attachLessonWS(server: Server): void {
  const wss = new WebSocketServer({ server, path: '/lesson' })

  wss.on('connection', async (ws: WebSocket, req: IncomingMessage) => {
    // ── JWT auth check ─────────────────────────────────────────────────────
    let jwtStudentId: string | null = null
    let jwtUserId:    string | null = null
    let wsSessionId:  string | null = null

    try {
      const rawUrl = req.url ?? ''
      const urlObj = new URL(rawUrl, 'http://localhost')
      const token  = urlObj.searchParams.get('token')
      wsSessionId  = urlObj.searchParams.get('sessionId')

      if (!token) {
        ws.close(4001, 'Authentication required')
        return
      }

      const payload = await verifyToken(token)
      if (!payload) {
        ws.close(4001, 'Invalid or expired token')
        return
      }

      jwtStudentId = payload.studentId
      jwtUserId    = payload.userId
    } catch {
      ws.close(4001, 'Auth error')
      return
    }
    // ──────────────────────────────────────────────────────────────────────

    const heartbeatRef = setInterval(() => {
      try {
        if (ws.readyState === WebSocket.OPEN) ws.ping()
      } catch (err) {
        console.error('[ws] ping error (ignored):', (err instanceof Error ? err.message : err))
      }
    }, HEARTBEAT_INTERVAL_MS)

    const meta: ClientMeta = {
      lessonId:        null,
      studentId:       jwtStudentId,
      userId:          jwtUserId,
      sessionId:       wsSessionId,
      usageId:         null,
      lessonStartedAt: null,
      voiceId:         null,
      teacherId:       null,
      lastSeen:        Date.now(),
      heartbeatRef,
      timeoutRef:      setTimeout(() => ws.terminate(), INACTIVITY_TIMEOUT_MS),
      maxDurationRef:  null,
      warningRef:      null,  // Phase 6
      timerUpdateRef:  null,  // Phase 2 recovery
      stt:             null,
      ttsController:    null,
      ttsActive:        false,
      aiCallCount:      0,
      ttsCharCount:     0,
      aiProcessing:     false,
      queuedInput:      null,
      interruptPending: false,
      pendingTranscript: '',
      pendingMicStop:    false,
      pendingMicStopTimeoutRef: null,
      micActive:         false,
      billingStartedAt: null,
    }

    clients.set(ws, meta)
    console.log(`[ws] client connected (user=${jwtUserId} session=${wsSessionId}), total=${clients.size}`)

    // Signal frontend that the connection is authenticated and the session is
    // validated. The "Begin Lesson" button should only appear after this event.
    send(ws, { type: 'lesson_ready', sessionId: wsSessionId })

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
            // Typed submission clears any accumulated STT state
            meta.pendingTranscript = ''
            meta.pendingMicStop    = false
            await processInput(ws, meta, msg.text)
            break
          case 'mic_start': {
            // New recording starting — hard-reset all STT state from previous recording.
            // This prevents stale pendingMicStop, stale transcript, and Deepgram buffer
            // from contaminating the new turn.
            if (meta.pendingMicStopTimeoutRef) {
              clearTimeout(meta.pendingMicStopTimeoutRef)
              meta.pendingMicStopTimeoutRef = null
            }
            meta.pendingMicStop    = false
            meta.pendingTranscript = ''
            meta.micActive         = true  // open the gate — accept STT events
            meta.stt?.clearBuffer()
            console.log(`[paid-lesson] mic_start — state reset micActive=true`)
            break
          }
          case 'mic_stop': {
            // Flush Deepgram's internal is_final buffer (segments that arrived since
            // the last UtteranceEnd) into pendingTranscript so we can submit immediately
            // without waiting up to 1500ms for UtteranceEnd to fire.
            const buffered = meta.stt?.flushBuffer() ?? ''
            if (buffered) {
              meta.pendingTranscript = meta.pendingTranscript
                ? meta.pendingTranscript + ' ' + buffered
                : buffered
            }
            const pending = meta.pendingTranscript.trim()
            if (pending) {
              // Text is ready — submit immediately, no UtteranceEnd wait needed.
              meta.pendingTranscript = ''
              meta.pendingMicStop    = false
              meta.micActive         = false  // turn finalized — discard further STT events
              if (meta.pendingMicStopTimeoutRef) {
                clearTimeout(meta.pendingMicStopTimeoutRef)
                meta.pendingMicStopTimeoutRef = null
              }
              if (shouldProcessTranscript(pending)) {
                meta.stt?.clearBuffer()
                console.log(`[paid-lesson] student_turn_finalized chars=${pending.length} trigger=mic_stop_flush`)
                send(ws, { type: 'student_message', text: pending })
                await processInput(ws, meta, pending)
              }
            } else {
              // Nothing accumulated yet — UtteranceEnd may still be in flight.
              // Wait briefly; the onTranscript callback will process when it arrives.
              meta.pendingMicStop = true
              console.log(`[paid-lesson] mic_stop_waiting_utterance_end`)
              if (meta.pendingMicStopTimeoutRef) clearTimeout(meta.pendingMicStopTimeoutRef)
              meta.pendingMicStopTimeoutRef = setTimeout(() => {
                if (!meta.pendingMicStop) return  // already handled by UtteranceEnd
                meta.pendingMicStop           = false
                meta.pendingMicStopTimeoutRef = null
                meta.micActive                = false  // turn finalized
                const delayed = meta.pendingTranscript.trim()
                meta.pendingTranscript = ''
                meta.stt?.clearBuffer()
                if (delayed && shouldProcessTranscript(delayed)) {
                  console.log(`[paid-lesson] student_turn_finalized chars=${delayed.length} trigger=mic_stop_timeout`)
                  send(ws, { type: 'student_message', text: delayed })
                  processInput(ws, meta, delayed).catch((err: unknown) =>
                    console.error('[paid-lesson] processInput error (mic_stop_timeout):', err))
                } else {
                  console.log(`[paid-lesson] mic_stop_timeout_no_text`)
                }
              }, 800)  // 800ms — enough for Deepgram's 300ms endpointing + network RTT
            }
            break
          }
          case 'audio_chunk':
            if (!meta.stt) {
              console.log(`[paid-lesson] ignored_audio_chunk reason=before_begin ws_state=${ws.readyState}`)
              return
            }
            if (ws.readyState !== WebSocket.OPEN) {
              console.log(`[paid-lesson] ignored_audio_chunk reason=ws_not_open ws_state=${ws.readyState}`)
              return
            }
            meta.stt.send(msg.data)
            break
          case 'interrupt':
            // Clear any buffered STT transcript so it doesn't fire after TTS stops
            meta.stt?.clearBuffer()
            meta.ttsController?.abort()
            // If interrupt arrives while AI is still processing, flag ttsStream() to
            // skip TTS for the response that's about to arrive — the student already
            // has the mic open and is ready to speak.
            if (meta.aiProcessing) {
              meta.interruptPending = true
            }
            console.log(`[paid-lesson] interrupt received ttsActive=${meta.ttsActive} aiProcessing=${meta.aiProcessing}`)
            break
          case 'exercise_answer':
            await handleExerciseAnswer(ws, meta, msg.exerciseId, msg.answer)
            break
          case 'student_confused':
            await handleStudentConfused(ws, meta, msg)
            break
        }
      } catch (err) {
        console.error('[ws] handler error:', err)
        send(ws, { type: 'error', code: 'SERVER_ERROR', message: 'Internal error.' })
      }
    })

    ws.on('close', (code: number, reason: Buffer) => {
      clearInterval(meta.heartbeatRef)
      clearTimeout(meta.timeoutRef)
      if (meta.maxDurationRef)           clearTimeout(meta.maxDurationRef)
      if (meta.warningRef)               clearTimeout(meta.warningRef)
      if (meta.timerUpdateRef)           clearInterval(meta.timerUpdateRef)
      if (meta.pendingMicStopTimeoutRef) clearTimeout(meta.pendingMicStopTimeoutRef)
      meta.ttsController?.abort()
      meta.stt?.close()
      clients.delete(ws)
      console.log(
        `[ws] client disconnected code=${code} reason="${reason.toString() || '(none)'}" ` +
        `session=${meta.sessionId ?? 'none'} lessonId=${meta.lessonId ?? 'none'} total=${clients.size}`,
      )

      // Phase 6: persist snapshot to PostgreSQL before billing finalize.
      // This allows resume beyond the 4-hour Redis TTL.
      if (meta.lessonId && meta.studentId) {
        void saveLessonSnapshot(meta.lessonId, meta.sessionId, meta.studentId)
      }

      // Cost instrumentation + finalize paid lesson usage
      // Phase 11: billingStartedAt tracks when THIS session's billing period began,
      // not when the original lesson started. This prevents double-billing on reconnect.
      if (meta.usageId && meta.userId && meta.billingStartedAt) {
        const elapsedMs       = Date.now() - meta.billingStartedAt
        const elapsedMin      = Math.round(elapsedMs / 60_000)
        const ttsProvider     = process.env.ELEVENLABS_API_KEY ? 'elevenlabs' : 'openai'
        const aiModel         = 'claude-sonnet-4-6'
        const sttProvider     = 'deepgram'
        const aiCostUsd       = meta.aiCallCount * 0.003                                         // ~$0.003 per exchange (cached prompt)
        const ttsCostUsd      = ttsProvider === 'openai'
          ? (meta.ttsCharCount / 1000) * 0.015                                                   // OpenAI TTS: $15/1M chars
          : (meta.ttsCharCount / 1000) * 0.15                                                    // ElevenLabs: conservative estimate
        const sttCostUsd      = elapsedMin * 0.006                                               // Deepgram Nova-2: ~$0.36/hr
        const estimatedCostUsd = aiCostUsd + ttsCostUsd + sttCostUsd
        console.log(
          `[paid-lesson-cost] session=${meta.sessionId ?? 'unknown'} ` +
          `aiCalls=${meta.aiCallCount} ttsChars=${meta.ttsCharCount} ` +
          `elapsedMinutes=${elapsedMin} estimatedCostUsd=${estimatedCostUsd.toFixed(4)} ` +
          `ttsProvider=${ttsProvider} aiModel=${aiModel} sttProvider=${sttProvider}`,
        )

        finalizeUsage(meta.usageId, meta.userId, meta.billingStartedAt).catch((err: unknown) => {
          console.error('[ws] finalizeUsage error:', err)
        })
      }
    })

    ws.on('error', (err: Error) => {
      console.error(`[ws] client error session=${meta.sessionId ?? 'none'} lessonId=${meta.lessonId ?? 'none'}: ${err.message}`)
    })
  })

  console.log('[ws] LessonWS attached at ws://localhost/lesson')
}

/**
 * Graceful shutdown: terminate all active WebSocket connections so their
 * close handlers run (billing finalization, snapshot save).
 * Called by SIGTERM handler in index.ts.
 */
export function closeAllActiveClients(): number {
  const count = clients.size
  for (const [ws] of clients) {
    try { ws.terminate() } catch { /* ignore */ }
  }
  return count
}
