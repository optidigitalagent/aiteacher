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
import { LessonOrchestrator } from '../lesson/orchestrator.js'
import type { ExerciseErrorData } from '../lesson/orchestrator.js'
import { DeepgramSTT } from '../voice/stt.js'
import { speakToClient } from '../voice/tts.js'
import { loadExercise, recordAnswer } from '../exercises/exercise-store.js'
import { validateAnswer } from '../exercises/validator.js'
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
  unit: number,
  section: string | undefined,
  grammarTarget: string,
  textbookUnit: string,
  teacherId?: string,
): string {
  const tName = teacherDisplayName(teacherId)

  if (!section) {
    return `Hello! I'm ${tName}. Today we're working on ${textbookUnit}. Grammar focus: ${grammarTarget}. Tell me one example sentence using this grammar — don't worry if it's not perfect.`
  }

  // Student Book is the authoritative source for the section title and content.
  const sb = getFocusStudentBookSection(section)
  const sectionTitle  = sb?.lessonTitle ?? section
  const grammarFocus  = sb?.grammarFocus ?? grammarTarget

  let body = `Today we're on section ${section} — "${sectionTitle}".`

  if (grammarFocus) {
    body += ` The grammar focus is: ${grammarFocus}.`
  }

  // Teacher Book is used only for structural info: which exercises exist and
  // whether there is a listening task. Never for section title or page numbers.
  const tb = getTeachersBookSection(unit, section)
  if (tb.found && tb.section) {
    const s = tb.section
    const hasAnswerKeys = s.answerKeys.filter(k => !k.isVideoActivity).length > 0
    const isListening   = s.answerKeys.some(k => k.isListeningActivity)
    const exercises     = s.answerKeys
      .filter(k => !k.isVideoActivity)
      .map(k => k.exerciseRef)
      .join(', ')

    if (hasAnswerKeys) {
      body += ` We'll work through: ${exercises}.`
    }

    if (isListening) {
      body += ` There's a listening task — you'll play the audio from your book and tell me what you hear. I have the answer key.`
    }
  }

  body += ` Open your book to this section. Tell me when you're on the page.`

  return `Hello! I'm ${tName}, your English teacher. ${body}`
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
    if (!meta.lessonStartedAt) return
    const remaining = Math.max(0, MAX_LESSON_MS - (Date.now() - meta.lessonStartedAt))
    send(ws, { type: 'lesson_timer_update', remainingMs: remaining })
    if (remaining <= 0) {
      clearInterval(meta.timerUpdateRef!)
      meta.timerUpdateRef = null
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
  // on the same lesson state. If true, new input is dropped until AI returns.
  aiProcessing:    boolean
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

  // Calculate how much time is left from the original lesson start
  const originalStart = new Date(state.startedAt).getTime()
  const elapsedMs     = Date.now() - originalStart
  const remainingMs   = Math.max(0, MAX_LESSON_MS - elapsedMs)

  if (remainingMs <= 60_000) {
    // Less than 1 minute remaining — not worth resuming
    send(ws, { type: 'error', code: 'SESSION_TIME_LIMIT', message: 'Lesson time has expired. Please start a new lesson.' })
    return true  // handled — don't start fresh
  }

  // Restore meta state
  meta.lessonId  = existingLessonId
  meta.studentId = state.studentId
  meta.voiceId   = state.voiceId   ?? meta.voiceId
  meta.teacherId = state.teacherId ?? meta.teacherId

  // Phase 6 bug fix: use the ORIGINAL lesson start time, not Date.now().
  // processInput() computes remainingMs as MAX_LESSON_MS - (Date.now() - lessonStartedAt).
  // Setting this to Date.now() would make the AI think there are 50 full minutes remaining
  // after every reconnect, defeating the time-aware prompting added in Phase 4.
  meta.lessonStartedAt = originalStart

  // Reset hard cap to exact remaining time
  meta.maxDurationRef = setTimeout(() => {
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

  // Restart STT for new connection
  meta.stt = new DeepgramSTT((transcript) => {
    send(ws, { type: 'transcript', text: transcript })
    if (meta.ttsActive) {
      console.log(`[paid-lesson] ignored_stt reason=teacher_speaking chars=${transcript.trim().length}`)
      return
    }
    if (!shouldProcessTranscript(transcript)) return
    send(ws, { type: 'student_message', text: transcript })
    void processInput(ws, meta, transcript)
  })

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
        exerciseType:   'form_transformation', // best-effort type on resume
        instruction:    '',
        currentItem:    state.currentItem,
        itemIndex:      state.itemIndex ?? 0,
        itemTotal:      0,
        completedItems: state.completedItems ?? [],
        failedItems:    state.failedItems    ?? [],
        wordBoxState:   state.wordBoxState   ?? null,
      },
    })
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

  // Enforce 50-minute hard cap per paid session
  meta.maxDurationRef = setTimeout(() => {
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

  meta.stt = new DeepgramSTT((transcript) => {
    send(ws, { type: 'transcript', text: transcript })
    if (meta.ttsActive) {
      console.log(`[paid-lesson] ignored_stt reason=teacher_speaking chars=${transcript.trim().length}`)
      return
    }
    if (!shouldProcessTranscript(transcript)) return
    send(ws, { type: 'student_message', text: transcript })
    void processInput(ws, meta, transcript)
  })

  // Phase 2 recovery: start periodic remaining-time broadcast
  startTimerBroadcast(ws, meta)

  const greeting = `Hello! I'm Alex, your English teacher. Today we'll work on "${config.grammarTarget}" using the topic "${config.lessonTopic}". Let's start — tell me one thing you already know about this topic.`

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
    if (existingLessonId) {
      const resumed = await resumeLesson(ws, meta, existingLessonId)
      if (resumed) return
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

  // Enforce 50-minute hard cap per paid session
  meta.maxDurationRef = setTimeout(() => {
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
  if (meta.sessionId) {
    await query(
      `UPDATE lesson_sessions SET lesson_id = $1, status = 'active', updated_at = NOW() WHERE session_id = $2`,
      [lessonId, meta.sessionId],
    )
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

  meta.stt = new DeepgramSTT((transcript) => {
    send(ws, { type: 'transcript', text: transcript })
    if (meta.ttsActive) {
      console.log(`[paid-lesson] ignored_stt reason=teacher_speaking chars=${transcript.trim().length}`)
      return
    }
    if (!shouldProcessTranscript(transcript)) {
      console.log(`[paid-lesson] ignored_audio_chunk reason=invalid_transcript chars=${transcript.trim().length}`)
      return
    }
    console.log(`[paid-lesson] student_turn_finalized chars=${transcript.trim().length}`)
    send(ws, { type: 'student_message', text: transcript })
    void processInput(ws, meta, transcript)
  })

  console.log(`[paid-lesson] ready session=${meta.sessionId} lessonId=${lessonId}`)

  // Phase 2 recovery: start periodic remaining-time broadcast
  startTimerBroadcast(ws, meta)

  // Personalise greeting with selected teacher name
  const greeting = buildFocusGreeting(effectiveUnit, config.section, unitData.grammarTarget, unitData.textbookUnit, meta.teacherId ?? undefined)

  send(ws, { type: 'ai_text', phase: 'DIAGNOSTIC', text: greeting })

  // For grammar sections, asynchronously generate/load the section overview card
  if (config.section) {
    const sb = getFocusStudentBookSection(config.section)
    if (sb?.type === 'Grammar') sendSectionCardAsync(ws, config.section)
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

async function processInput(
  ws: WebSocket,
  meta: ClientMeta,
  text: string,
  sendCard = false,
): Promise<void> {
  if (!meta.lessonId) {
    send(ws, { type: 'error', code: 'NO_LESSON', message: 'Start a lesson first.' })
    return
  }

  // Guard: if a previous AI call is still in-flight, drop the new input to
  // prevent concurrent reads/writes to the same Redis lesson state.
  if (meta.aiProcessing) {
    console.log(`[paid-lesson] ai_turn_skipped reason=concurrent_call input_chars=${text.trim().length}`)
    return
  }
  meta.aiProcessing = true

  // Phase 4: compute remaining lesson time for time-aware AI prompting
  const elapsedMs   = meta.lessonStartedAt ? Date.now() - meta.lessonStartedAt : 0
  const remainingMs = Math.max(0, MAX_LESSON_MS - elapsedMs)

  console.log(`[paid-lesson] ai_turn_started input_chars=${text.trim().length} remaining_min=${Math.round(remainingMs / 60_000)}`)
  let result: Awaited<ReturnType<typeof orchestrator.process>> | undefined
  try {
    result = await orchestrator.process(meta.lessonId, text, { remainingMs })
  } finally {
    meta.aiProcessing = false
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
    if (err instanceof Error && err.name !== 'AbortError') {
      console.error('[ws] TTS error:', err.message)
    }
    // Do NOT send teacher_turn_end on abort — frontend already handles interruption
  } finally {
    meta.ttsActive = false
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

  // Phase 5: pass error details so errorsThisLesson is populated for tips and agenda context
  const errorData: ExerciseErrorData | undefined = validation.correct ? undefined : {
    exercise:      exercise.question,
    studentAnswer: answer,
    correctAnswer: exercise.correct_answer,
    errorType:     toErrorType(exercise.type),
  }
  await orchestrator.recordExerciseResult(meta.lessonId, validation.correct, errorData)

  send(ws, { type: 'feedback', correct: validation.correct, explanation: validation.feedback })

  // Pass result to AI — enforces mastery loop and correction ladder
  const context = validation.correct
    ? `[EXERCISE RESULT] Student answered: "${answer}" — CORRECT.
Confirm with one word ("Exactly." / "Right." / "Correct.").
Explain WHY in one sentence — state the grammar rule that makes this correct.
Optionally ask one micro follow-up question to deepen understanding (e.g. "Why 'does' and not 'do' here?").
Then present the next item of this exercise, or if all items are done, announce exercise completion and introduce the next exercise.`
    : `[EXERCISE RESULT] Student answered: "${answer}" — INCORRECT.
Known correct answer (for your reference only — do NOT reveal it yet): "${exercise.correct_answer}".

CORRECTION LADDER — start at TURN A this turn. Do NOT skip ahead.
TURN A (this turn): Ask exactly ONE guiding question that targets the specific knowledge gap.
  Do NOT give any part of the answer. Do NOT recast the correct form yet.
  Think: what specific rule or knowledge caused this error? Ask about that.
  Examples:
    Wrong auxiliary → "For 'he', do we use do or does?"
    Wrong verb form → "Is this verb regular or irregular? What does that mean?"
    Wrong word order → "In English questions, where does the auxiliary verb go?"
  Set "exercise": null — do NOT advance until the retry is resolved.

On the student's next response (plain text, not "[EXERCISE RESULT]"):
  If correct → confirm + explain why + continue the exercise.
  If still wrong → escalate to TURN B (give one small hint, not the full answer).
  Each failed retry escalates one step: A → B → C → D.
  Only at TURN D (3 failed retries) may you give the full answer, then ask the student to repeat it.`

  await processInput(ws, meta, context)
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
  await processInput(ws, meta, confusionContext, true)
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
      if (ws.readyState === WebSocket.OPEN) ws.ping()
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
      ttsController:   null,
      ttsActive:       false,
      aiCallCount:     0,
      ttsCharCount:    0,
      aiProcessing:    false,
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
            await processInput(ws, meta, msg.text)
            break
          case 'audio_chunk':
            if (!meta.stt) {
              console.log('[paid-lesson] ignored_audio_chunk reason=before_begin')
              return
            }
            meta.stt.send(msg.data)
            break
          case 'interrupt':
            // Clear any buffered STT transcript so it doesn't fire after TTS stops
            meta.stt?.clearBuffer()
            meta.ttsController?.abort()
            console.log(`[paid-lesson] interrupt received ttsActive=${meta.ttsActive}`)
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

    ws.on('close', () => {
      clearInterval(meta.heartbeatRef)
      clearTimeout(meta.timeoutRef)
      if (meta.maxDurationRef)  clearTimeout(meta.maxDurationRef)
      if (meta.warningRef)      clearTimeout(meta.warningRef)    // Phase 6
      if (meta.timerUpdateRef)  clearInterval(meta.timerUpdateRef) // Phase 2 recovery
      meta.ttsController?.abort()
      meta.stt?.close()
      clients.delete(ws)
      console.log(`[ws] client disconnected, total=${clients.size}`)

      // Phase 6: persist snapshot to PostgreSQL before billing finalize.
      // This allows resume beyond the 4-hour Redis TTL.
      if (meta.lessonId && meta.studentId) {
        void saveLessonSnapshot(meta.lessonId, meta.sessionId, meta.studentId)
      }

      // Cost instrumentation + finalize paid lesson usage
      if (meta.usageId && meta.userId && meta.lessonStartedAt) {
        const elapsedMs       = Date.now() - meta.lessonStartedAt
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

        finalizeUsage(meta.usageId, meta.userId, meta.lessonStartedAt).catch((err: unknown) => {
          console.error('[ws] finalizeUsage error:', err)
        })
      }
    })

    ws.on('error', (err: Error) => {
      console.error('[ws] client error:', err.message)
    })
  })

  console.log('[ws] LessonWS attached at ws://localhost/lesson')
}
