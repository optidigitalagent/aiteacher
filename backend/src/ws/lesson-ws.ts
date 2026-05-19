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
  type ResyncTranscriptEntry,
} from './message-types.js'
import type { LessonPhase, LessonState, ErrorRecord, ExerciseCursor, CorrectionTurn } from '../lesson/types.js'
import { getFocusUnit } from '../lesson/focus-content.js'
import { getTeachersBookSection } from '../lesson/focus-teachers-book.js'
import { getFocusStudentBookSection } from '../lesson/focus-student-book.js'
import { getCatalogEntry } from '../lesson/curriculum-catalog.js'
import { LessonOrchestrator } from '../lesson/orchestrator.js'
import type { ExerciseErrorData } from '../lesson/orchestrator.js'
import { DeepgramSTT } from '../voice/stt.js'
import { speakToClient } from '../voice/tts.js'
import { loadExercise, recordAnswer } from '../exercises/exercise-store.js'
import { validateAnswer } from '../exercises/validator.js'
import { useSoftFeedback, buildProtocolOffTopicRecovery } from '../exercises/runtime/index.js'
import { updateStudentProfile } from '../lesson/profile-updater.js'
import { saveTip, getStudentTips } from '../lesson/tips-service.js'
import type { TipRecord } from '../lesson/tips-service.js'
import { getOrCreateSectionCard } from '../lesson/slide-cache.js'
import { getManifestExerciseEntry } from '../lesson/section-manifest.js'
import type { ManifestItem } from '../lesson/section-manifest.js'
import type { StudentConfused } from './message-types.js'
import { exerciseEngine } from '../engine/exercise-engine.js'
import type { EngineResult, EngineValidationResult } from '../engine/types.js'
import { memoryService } from '../memory/index.js'
import { masterOrchestrator } from '../lesson/master-orchestrator.js'
import { guardTeacherResponse, buildFallbackGuardContext } from '../engine/stale-item-guard.js'
import {
  buildExerciseExecutionState,
  buildExecutionStatePromptBlock,
  guardExecutionOutput,
} from '../engine/execution-output-guard.js'
import {
  validateSoftSpeakingAnswer,
  getSoftAttempts,
  incrementSoftAttempts,
  resetSoftAttempts,
  type SoftSpeakingValidationResult,
} from '../validation/soft-speaking-validator.js'
import { interpretSpokenAnswer } from '../interpretation/index.js'
import {
  startLessonTrace,
  endLessonTrace,
  traceSttResult,
  traceValidation,
  traceTeacherGeneration,
  traceRuntimeError,
} from '../observability/index.js'
import { hashUserId } from '../observability/langfuse-client.js'
import { recordStudentMessage, recordTeacherMessage, recordSystemEvent } from '../lesson/transcript-recorder.js'
import { classifyVoiceTranscript } from '../voice/voice-turn-stabilizer.js'

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

// Returns true only when student input looks like a genuine side question or
// meta-request. Short exercise answers ("Stupid", "A", "letter B", "negative")
// must return false so they are routed to exercise answer handling, not the
// off-topic recovery path.
const OFF_TOPIC_REQUEST_PATTERNS = [
  /\bwhat\s+(does|is|are|do|did|means?|should)\b/i,
  /\bhow\s+(do|does|did|can|should|to)\b/i,
  /\bwhy\b/i,
  /\bcan\s+you\b/i,
  /\bcould\s+you\b/i,
  /\bexplain\b/i,
  /\brepeat\b/i,
  /\bdon'?t\s+(understand|get)\b/i,
  /\bI'?m\s+(confused|lost)\b/i,
  /\bwhat\s+should\b/i,
  /\bI\s+don'?t\s+know\s+what\b/i,
  // Bare single-word confusion that the patterns above miss: "How?", "What?", "Why?", "Huh?"
  /^\s*(how|what|why|huh)\s*[?!.]*\s*$/i,
  // "what do you mean" — common rephrasing not caught by the what+verb pattern above
  /\bwhat\s+do\s+you\s+mean\b/i,
  // Imperative meta-requests: student asking teacher to do something rather than answering
  /\bshow\s+me\b/i,
  /\btell\s+me\b/i,
  /\bgive\s+me\b/i,
  /\bpoint\s+(me|to)\b/i,
  /\bI\s+don'?t\s+know\b/i,
  /\bI\s+need\s+(help|a\s+hint|more\s+time)\b/i,
  /\bI'?m\s+not\s+sure\b/i,
  /\bcan\s+we\s+(go\s+over|review|see|look\s+at)\b/i,
]

function looksLikeOffTopicRequest(text: string): boolean {
  return OFF_TOPIC_REQUEST_PATTERNS.some(p => p.test(text.trim()))
}

// STT noise detector: very short or non-alphabetic transcripts should never be
// submitted to the engine as answers. The engine only receives clean voice text.
// "Noise" means < 2 chars, no letter characters, or < 30% letter ratio (gibberish).
function isSttNoise(text: string): boolean {
  const t = text.trim()
  if (t.length < 2) return true
  const letters = (t.match(/[a-zA-Zа-яА-ЯёЁ]/g) ?? []).length
  if (letters === 0) return true
  return letters / t.length < 0.30
}

// Phase G: detect student intent to move to the next exercise after exercise completion.
// Covers voice-transcribed variants like "Let's next", "next exercise", "we have done this".
const TRANSITION_INTENT_RE = /\b(next|continue|move on|let'?s go|let me go|skip to|done|we'?ve done|already did|we have done|finished|let'?s next|let'?s do next|next one|next exercise)\b/i

function looksLikeTransitionIntent(text: string): boolean {
  return TRANSITION_INTENT_RE.test(text.trim())
}

// Normalize student input for intent detection.
// Handles smart apostrophes (U+2018–U+2019) that Deepgram emits in transcripts,
// trailing punctuation that voice-to-text appends, and case/whitespace noise.
function normalizeIntentText(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[‘’‚‛′]/g, "'")  // smart apostrophes → ASCII
    .replace(/\s+/g, ' ')
    .replace(/[.!?…]+$/, '')
    .trim()
}

// Readiness intent: student signaling they are ready to begin exercises.
// Conservative anchored matching on normalized text.
// "go" alone matches; "I go to school" does NOT (too long after normalization).
const READINESS_INTENT_RE = /^(i'm\s+ready|i\s+am\s+ready|ready|let's\s+start|start|go|let's\s+go|ok(ay)?,?\s+(let's\s+(go|start)|go|start)|alright,?\s+(let's\s+(go|start)|go|start))$/i

function isReadinessIntent(text: string): boolean {
  const normalized = normalizeIntentText(text)
  return READINESS_INTENT_RE.test(normalized)
}

// Phase G: returns a [EXERCISE COMPLETE] signal when exercise is done and student wants to move on.
// Reads from engine state (not legacy LessonState) to avoid false-positive completion signals.
// Only fires when engine reports the current exercise is no longer active (completed/skipped).
async function buildExerciseCompletionSignal(lessonId: string, text: string): Promise<string> {
  try {
    if (!looksLikeTransitionIntent(text)) return ''

    const engState = await exerciseEngine.getState(lessonId)
    if (!engState || engState.sectionId === 'free') return ''

    const exState = engState.currentExerciseState
    // Engine exercise is still active — do NOT inject false completion signal
    if (exState && exState.status === 'active') return ''

    // No active exercise state means either completed/skipped or between exercises
    const completedCount = engState.completedExerciseIds.length
    if (completedCount === 0 && !exState) return ''

    // Find the last completed exercise number to compute "next"
    const lastCompletedId = exState?.exerciseId ?? engState.completedExerciseIds.at(-1)
    const lastSpec = engState.exerciseQueue.find(e => e.exerciseId === lastCompletedId)
    if (!lastSpec) return ''

    const doneNum = lastSpec.meta.exerciseNumber
    const nextNum = doneNum + 1

    console.log(`[ws] exercise_completion_signal injected exercise=#${doneNum} student="${text.slice(0, 60)}"`)
    return `[EXERCISE ${doneNum} COMPLETE — TRANSITION REQUIRED] ` +
      `Exercise ${doneNum} is fully done. ` +
      `Student says: "${text.trim()}" — they want to move forward. ` +
      `MANDATORY: Do NOT say "I'm thinking" or "could you repeat that". ` +
      `Announce Exercise ${nextNum} immediately. ` +
      `If Exercise ${nextNum} needs audio or photo, skip it and go to Exercise ${nextNum + 1}.`
  } catch {
    return ''
  }
}

// Forces the Redis LessonState phase to EXERCISES when the engine is already serving exercises
// but the orchestrator phase has not yet caught up (e.g. still DIAGNOSTIC after greeting).
async function forcePhaseToExercises(lessonId: string): Promise<void> {
  try {
    const stateRaw = await redis.get(lessonStateKey(lessonId))
    if (!stateRaw) return
    const state = JSON.parse(stateRaw) as LessonState
    if (state.phase === 'EXERCISES') return
    const prev = state.phase
    state.phase = 'EXERCISES'
    await redis.set(lessonStateKey(lessonId), JSON.stringify(state), 'EX', LESSON_TTL)
    console.log(`[ws] phase_forced_to_exercises from=${prev} lessonId=${lessonId}`)
  } catch (err) {
    console.error('[ws] forcePhaseToExercises error (non-fatal):', err instanceof Error ? err.message : err)
  }
}

function buildFocusGreeting(
  _unit: number,
  section: string | undefined,
  grammarTarget: string,
  _textbookUnit: string,
  teacherId?: string,
): string {
  const tName = teacherDisplayName(teacherId)
  let focus = grammarTarget
  if (section) {
    const sb           = getFocusStudentBookSection(section)
    const catalogEntry = getCatalogEntry(section)
    focus = sb?.grammarFocus ?? catalogEntry?.grammarFocus ?? grammarTarget
  }
  return `Hi! I'm ${tName}. Today we'll practise ${focus}. Tell me when you're ready.`
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
  connectionId:    string           // unique per WS connection — used for ownership logging
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
  // Voice turn deduplication: generated on mic_start, used to prevent the same
  // voice turn from being submitted twice (e.g. UtteranceEnd + mic_stop race).
  voiceTurnId:              string | null
  lastSubmittedVoiceTurnId: string | null
  // Stabilization window: 450ms timer started on mic_stop.
  // Keeps micActive=true while waiting for late Deepgram is_final segments.
  // Replaced the legacy pendingMicStop+800ms-timeout path.
  stabilizationRef:         ReturnType<typeof setTimeout> | null
  // Phase 11: tracks when THIS connection's billing period started.
  // Separate from lessonStartedAt (which is the original lesson wall-clock start
  // used for timeout/remaining-time calculations). Using lessonStartedAt for
  // finalizeUsage caused double-billing on reconnect: after the first session is
  // finalized and a new usage record is created, elapsedMs = Date.now() - originalStart
  // would charge the full lesson duration again instead of just the current session.
  billingStartedAt: number | null
}

const clients = new Map<WebSocket, ClientMeta>()

// ── Reconnect grace window ────────────────────────────────────────────────────
// On abnormal disconnect (code 1006), keeps session state alive for 60 s so the
// same user/session can reattach without a full lesson resume or teacher greeting.
// Normal/intentional disconnects (1000, 4xxx) skip the grace window and finalize
// billing immediately as before.

const RECONNECT_GRACE_MS = 60_000

interface GraceEntry {
  meta:      ClientMeta
  lessonId:  string
  sessionId: string
  userId:    string
  timerRef:  ReturnType<typeof setTimeout>
}
const gracePeriod = new Map<string, GraceEntry>()

// Build and send a lesson_resync packet using engine + Redis state.
// Called when the same user reattaches within the grace window.
// Does NOT call AI and does NOT send any teacher greeting.
async function sendLessonResync(ws: WebSocket, meta: ClientMeta): Promise<void> {
  if (!meta.lessonId || !meta.sessionId) return
  try {
    let cursor = null
    try { cursor = await exerciseEngine.getCursor(meta.lessonId) } catch { /* non-fatal */ }

    const stateRaw = await redis.get(lessonStateKey(meta.lessonId))
    let state: LessonState | null = null
    if (stateRaw) state = JSON.parse(stateRaw) as LessonState

    const originalStart = state
      ? new Date(state.startedAt).getTime()
      : (meta.lessonStartedAt ?? Date.now())
    const remainingMs = Math.max(0, MAX_LESSON_MS - (Date.now() - originalStart))

    // Fetch last 10 visible transcript events for chat restore — authenticated, current lesson only.
    // Excludes system events. Fail-soft: missing transcript does not block resync.
    let recentTranscript: ResyncTranscriptEntry[] | null = null
    try {
      const tRows = await query<{ speaker: string; message: string }>(
        `SELECT speaker, message FROM lesson_transcript_events
         WHERE lesson_id = $1 AND speaker IN ('teacher', 'student')
         ORDER BY created_at DESC LIMIT 10`,
        [meta.lessonId],
      )
      if (tRows.rows.length > 0) {
        recentTranscript = tRows.rows
          .reverse()
          .map(r => ({ speaker: r.speaker as 'teacher' | 'student', text: r.message }))
        console.log(`[resync] transcript_restored lessonId=${meta.lessonId} count=${recentTranscript.length}`)
      }
    } catch {
      // non-fatal — resync proceeds without transcript
    }

    const hasVisiblePayload = !!(cursor?.readingText || cursor?.textBlocks?.length || cursor?.options?.length)
    if (cursor) {
      console.log(
        `[visible_payload] resync section=${state?.focusLesson ?? 'unknown'} ` +
        `exercise=${cursor.exerciseNumber} fields=${hasVisiblePayload ? 'readingText/textBlocks/options' : 'none'}`,
      )
    }

    send(ws, {
      type:                'lesson_resync',
      lessonId:            meta.lessonId,
      sessionId:           meta.sessionId,
      phase:               (state?.phase ?? 'EXERCISES') as import('./message-types.js').OutboundLessonResync['phase'],
      exerciseNumber:      cursor?.exerciseNumber ?? state?.currentExerciseNum ?? 0,
      totalExercises:      cursor?.itemTotal ?? 0,
      currentExerciseType: cursor?.exerciseType ?? state?.activeExerciseType ?? 'unknown',
      currentItemIndex:    cursor?.itemIndex ?? state?.itemIndex ?? 0,
      itemTotal:           cursor?.itemTotal ?? state?.exerciseItems?.length ?? 0,
      visiblePayload:      cursor ?? null,
      correctionTurn:      state?.correctionTurn ?? null,
      retryCount:          state?.itemRetryCount ?? 0,
      teacherTurnActive:   meta.ttsActive,
      studentTurnAllowed:  !meta.ttsActive && !meta.aiProcessing,
      remainingMs,
      recentTranscript,
    })
    console.log(
      `[ws:reconnect] resync_sent lessonId=${meta.lessonId} ` +
      `exercise=${cursor?.exerciseNumber ?? 0} item=${cursor?.itemIndex ?? 0} ` +
      `visible_payload=${hasVisiblePayload} transcript_count=${recentTranscript?.length ?? 0}`,
    )
  } catch (err) {
    console.error('[ws:reconnect] sendLessonResync error:', err instanceof Error ? err.message : err)
  }
}

// Phase 11: returns the existing WS connection that already owns a given lessonId,
// or null if no other connection is active for it. Used to enforce single-ownership.
function findActiveLessonOwner(lessonId: string, exclude: WebSocket): WebSocket | null {
  for (const [ws, m] of clients) {
    if (ws !== exclude && m.lessonId === lessonId) return ws
  }
  return null
}

// Late-reconnect recovery: called when isReattach=false but a recoverable lesson
// may still exist in the DB (e.g. grace period expired, or code 1001 disconnect).
// Sets up the full lesson context and sends lesson_resync instead of lesson_ready.
// Returns true if recovery succeeded (caller must NOT send lesson_ready).
async function tryLateRecover(
  ws:        WebSocket,
  meta:      ClientMeta,
  sessionId: string,
  userId:    string,
): Promise<boolean> {
  // Step 1: find active lesson_session in DB
  let lessonId: string | null = null
  try {
    const row = await query<{ lesson_id: string | null }>(
      `SELECT lesson_id FROM lesson_sessions WHERE session_id = $1 AND user_id = $2 AND status = 'active'`,
      [sessionId, userId],
    )
    lessonId = row.rows[0]?.lesson_id ?? null
  } catch (err) {
    console.error('[ws:reconnect] tryLateRecover DB error:', err instanceof Error ? err.message : err)
    return false
  }
  if (!lessonId) return false

  // Step 2: load Redis lesson state (restore from snapshot if expired)
  let stateRaw: string | null = null
  try {
    stateRaw = await redis.get(lessonStateKey(lessonId))
  } catch { /* non-fatal */ }
  if (!stateRaw) {
    stateRaw = await restoreSnapshotToRedis(lessonId)
    if (!stateRaw) {
      console.log(`[ws:reconnect] late_recover_no_state lessonId=${lessonId}`)
      return false
    }
  }

  let state: LessonState
  try {
    state = JSON.parse(stateRaw) as LessonState
  } catch {
    return false
  }

  // Block recovery for ended lessons
  if (state.phase === 'END') {
    console.log(`[ws:reconnect] late_recover_blocked phase=END lessonId=${lessonId}`)
    return false
  }

  // Block if nearly out of time
  const originalStart = new Date(state.startedAt).getTime()
  const remainingMs   = Math.max(0, MAX_LESSON_MS - (Date.now() - originalStart))
  if (remainingMs <= 60_000) {
    console.log(`[ws:reconnect] late_recover_blocked time_expired lessonId=${lessonId}`)
    return false
  }

  // Evict any existing active owner for this lesson
  const staleOwner = findActiveLessonOwner(lessonId, ws)
  if (staleOwner) {
    console.log(`[ws:ownership] owner_replaced session=${sessionId} old=stale new=${meta.connectionId}`)
    send(staleOwner, { type: 'error', code: 'LESSON_TAKEN_OVER', message: 'This lesson was resumed in another tab.' })
    staleOwner.terminate()
  }

  // Restore meta
  meta.lessonId         = lessonId
  meta.studentId        = state.studentId ?? meta.studentId
  meta.voiceId          = state.voiceId   ?? null
  meta.teacherId        = state.teacherId ?? null
  meta.lessonStartedAt  = originalStart
  meta.billingStartedAt = Date.now()

  // Link or create usage record for this reconnect session
  try {
    const usageRow = await query<{ id: string }>(
      `SELECT id FROM paid_lesson_usage WHERE session_id = $1 AND user_id = $2 AND status = 'active'
       ORDER BY started_at DESC LIMIT 1`,
      [sessionId, userId],
    )
    if (usageRow.rows[0]) {
      meta.usageId = usageRow.rows[0].id
    } else {
      const r = await query<{ id: string }>(
        `INSERT INTO paid_lesson_usage (user_id, session_id, lesson_id, started_at, status)
         VALUES ($1, $2, $3, NOW(), 'active') RETURNING id`,
        [userId, sessionId, lessonId],
      )
      meta.usageId = r.rows[0]?.id ?? null
    }
  } catch (err) {
    console.error('[ws:reconnect] late_recover_usage_error:', err instanceof Error ? err.message : err)
    // non-fatal — continue without billing record
  }

  // Re-arm max-duration timeout with remaining lesson time
  meta.maxDurationRef = setTimeout(() => {
    if (!meta.lessonId) return
    console.log(`[paid-lesson] lesson_timeout session=${meta.sessionId} lessonId=${meta.lessonId}`)
    send(ws, { type: 'error', code: 'SESSION_TIME_LIMIT', message: 'Maximum lesson duration reached.' })
    ws.close(4408, 'Time limit reached')
  }, remainingMs)

  // 5-min warning
  if (remainingMs > 5 * 60_000) {
    meta.warningRef = setTimeout(() => {
      send(ws, { type: 'lesson_time_warning', remainingMs: 5 * 60_000 })
      console.log(`[paid-lesson] time_warning_sent remainingMs=300000 session=${sessionId}`)
    }, remainingMs - 5 * 60_000)
  }

  // Start periodic timer broadcast
  startTimerBroadcast(ws, meta)

  // Create fresh STT for this connection
  meta.stt?.close()
  meta.stt               = null
  meta.pendingTranscript = ''
  meta.pendingMicStop    = false
  meta.micActive         = false
  meta.stt = createSTT(ws, meta)

  // Record reconnect event in transcript
  recordSystemEvent({
    lessonId,
    sessionId,
    userId,
    studentId: meta.studentId,
    message:   'websocket_late_reconnect',
  })

  console.log(`[ws:reconnect] recoverable_found session=${sessionId} lessonId=${lessonId}`)
  console.log(`[ws:reconnect] lesson_ready_suppressed session=${sessionId}`)
  console.log(`[ws:ownership] owner_set session=${sessionId} connectionId=${meta.connectionId}`)

  // Send resync — no greeting, no AI call, no lesson restart
  await sendLessonResync(ws, meta)
  return true
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

  // Guard: advance cursor past any completed items so a stale/corrupted itemIndex
  // is never re-sent to the student on resume.
  if (
    state.currentExerciseNum > 0 &&
    state.exerciseItems?.length &&
    (state.completedItems ?? []).includes(state.itemIndex ?? 0)
  ) {
    const completedSet = state.completedItems ?? []
    let next = state.itemIndex ?? 0
    while (completedSet.includes(next) && next < state.exerciseItems.length) {
      next++
    }
    state.itemIndex   = next
    state.currentItem = next < state.exerciseItems.length ? state.exerciseItems[next] : ''
    await redis.set(lessonStateKey(existingLessonId), JSON.stringify(state), 'EX', LESSON_TTL)
    console.log(`[ws] resume_cursor_corrected itemIndex=${next} exercise=#${state.currentExerciseNum}`)
  }

  // Master Orchestrator: recover engine state on reconnect.
  // Engine state lives in a separate Redis key, independent of LessonState.
  // If recovery succeeds, the engine cursor is the authoritative source for the frontend.
  // If recovery fails, emit INVALID_ENGINE_STATE and continue with cached LessonState cursor.
  const engineSection = state.focusLesson ?? 'free'
  let engineCursorSent = false
  const recovery = await masterOrchestrator.recoverSession({ lessonId: existingLessonId, sectionId: engineSection })
  if (recovery.engineCursor) {
    send(ws, { type: 'exercise_cursor_updated', cursor: recovery.engineCursor })
    engineCursorSent = true
  }
  if (recovery.error) {
    send(ws, { type: 'error', code: recovery.error.code, message: recovery.error.message })
  }

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
  recordSystemEvent({ lessonId: existingLessonId, sessionId: meta.sessionId, userId: meta.userId, studentId: meta.studentId, message: 'lesson_resumed', phase: state.phase })
  recordTeacherMessage({ lessonId: existingLessonId, sessionId: meta.sessionId, userId: meta.userId, studentId: meta.studentId, text: resumeMsg, phase: state.phase, source: 'ai' })

  // Phase 3 / Engine Migration: restore exercise cursor state on resume if an exercise was active.
  // Prefer engine cursor (already sent above) — fall back to LessonState cursor for legacy snapshots.
  if (!engineCursorSent && state.currentExerciseNum > 0 && state.currentItem) {
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
      `[ws] resume_legacy_cursor_sent type=${state.activeExerciseType ?? 'unknown'} ` +
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

  startLessonTrace(lessonId, {
    lessonId,
    sessionId:   meta.sessionId,
    userIdHash:  hashUserId(effectiveStudentId),
    sectionId:   null,
    unitId:      config.textbookUnit ?? null,
    startedAt:   new Date().toISOString(),
    environment: process.env.NODE_ENV ?? 'development',
  })

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

  // Engine Authority Migration: init engine for free-mode lesson (empty queue)
  try {
    await exerciseEngine.init(lessonId, 'free')
    console.log(`[engine] initialized lessonId=${lessonId} section=free`)
  } catch (err) {
    console.error('[engine] init failed (non-fatal):', err instanceof Error ? err.message : err)
  }

  meta.micActive = false  // set true on first mic_start
  meta.stt = createSTT(ws, meta)

  // Phase 2 recovery: start periodic remaining-time broadcast
  startTimerBroadcast(ws, meta)

  const greeting = `Hello! I'm Alex, your English teacher. Today we'll work on "${config.grammarTarget}" — the topic is "${config.lessonTopic}". To begin: can you give me one example sentence using this grammar?`

  console.log(`[paid-lesson] lesson_start_new lessonId=${lessonId} session=${meta.sessionId} unit=${config.textbookUnit}`)
  recordSystemEvent({ lessonId, sessionId: meta.sessionId, userId: meta.userId, studentId: meta.studentId, message: 'lesson_start', phase: 'DIAGNOSTIC', metadata: { grammarTarget: config.grammarTarget, lessonTopic: config.lessonTopic, unit: config.textbookUnit } })
  send(ws, { type: 'ai_text', phase: 'DIAGNOSTIC', text: greeting })
  recordTeacherMessage({ lessonId, sessionId: meta.sessionId, userId: meta.userId, studentId: meta.studentId, text: greeting, phase: 'DIAGNOSTIC', source: 'ai' })
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

  startLessonTrace(lessonId, {
    lessonId,
    sessionId:   meta.sessionId,
    userIdHash:  hashUserId(effectiveStudentId),
    sectionId:   config.section ?? null,
    unitId:      String(effectiveUnit),
    startedAt:   new Date().toISOString(),
    environment: process.env.NODE_ENV ?? 'development',
  })

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

  // Engine Authority Migration: initialize Exercise Engine before STT/AI.
  // Engine owns all exercise state; AI only narrates what the engine decides.
  const engineSection = config.section ?? 'free'
  try {
    await exerciseEngine.init(lessonId, engineSection)
    console.log(`[engine] initialized lessonId=${lessonId} section=${engineSection}`)
  } catch (err) {
    console.error('[engine] init failed (non-fatal, legacy path continues):', err instanceof Error ? err.message : err)
  }

  meta.micActive = false  // set true on first mic_start
  meta.stt = createSTT(ws, meta)

  console.log(`[paid-lesson] lesson_start_new lessonId=${lessonId} session=${meta.sessionId} unit=${effectiveUnit} section=${config.section ?? 'none'}`)

  // Phase 2 recovery: start periodic remaining-time broadcast
  startTimerBroadcast(ws, meta)

  // Personalise greeting with selected teacher name
  const greeting = buildFocusGreeting(effectiveUnit, config.section, unitData.grammarTarget, unitData.textbookUnit, meta.teacherId ?? undefined)

  recordSystemEvent({ lessonId, sessionId: meta.sessionId, userId: meta.userId, studentId: meta.studentId, message: 'lesson_start', phase: 'DIAGNOSTIC', metadata: { grammarTarget, lessonTopic, unit: effectiveUnit, section: config.section ?? null } })
  send(ws, { type: 'ai_text', phase: 'DIAGNOSTIC', text: greeting })
  recordTeacherMessage({ lessonId, sessionId: meta.sessionId, userId: meta.userId, studentId: meta.studentId, text: greeting, phase: 'DIAGNOSTIC', source: 'ai' })

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
// ── Phase G.1: Manifest-authoritative voice answer validation ─────────────────
//
// For manifest-backed deterministic_sequential exercises, student voice answers
// are validated here — against the manifest — before being forwarded to the AI.
// The AI receives an [EXERCISE RESULT] block and only verbalizes the decision.
// This removes AI control over item progression entirely for these exercises.

function validateManifestAnswer(studentText: string, item: ManifestItem): boolean {
  const norm = (s: string) =>
    s.trim().toLowerCase().replace(/[.,!?;:'"]/g, '').replace(/\s+/g, ' ')
  const ns = norm(studentText)
  const ne = norm(item.correctAnswer)

  // 1. Exact match (student says exactly "do" or exactly the expected sentence)
  if (ns === ne) return true

  // 2. Student says the full sentence with blank filled correctly.
  //    Strip leading "N." / "N)" item-number prefix before sentence-fill comparison —
  //    "3. ___ you ever met him?" must normalise to "___ you ever met him?" so that
  //    "Have you ever met him?" correctly matches after filling the blank.
  if (item.text.includes('___')) {
    const cleanText = item.text.replace(/^\d+[.)]\s*/, '')
    const filled    = cleanText.replace('___', item.correctAnswer)
    if (ns === norm(filled)) return true
  }

  // 3. Single-word expected answer — accept if student utterance is short (≤4 words)
  //    and contains the expected word. Guards against false positives from long sentences.
  if (!item.correctAnswer.includes(' ')) {
    const words = ns.split(' ')
    if (words.length <= 4 && words.includes(ne)) return true
  }

  return false
}

interface ManifestVoiceResult {
  correct:              boolean
  cursor:               ExerciseCursor | null    // set when correct
  correctionTurn:       CorrectionTurn | null   // set when incorrect
  exerciseNum:          number
  itemIndex:            number
  item:                 ManifestItem
  engineResult?:        EngineResult            // Engine Authority Migration: set when routed through engine
  isSoftSpeaking?:      boolean                 // Phase A: true for discussion/personal_fill/pair_speaking
  softSpeakingRetry?:   SoftSpeakingValidationResult  // set when validator blocks progression
}

// Attempts manifest-authoritative validation for the current voice input.
// Returns null when conditions are not met (not a deterministic manifest exercise, etc.).
// Engine Authority Migration: routes through exerciseEngine.submitAnswer() when engine
// has active state for this lesson. Falls back to legacy orchestrator calls for old snapshots.
async function tryManifestValidateVoice(
  lessonId: string,
  studentText: string,
): Promise<ManifestVoiceResult | null> {
  try {
    // Engine path: if engine has active deterministic exercise state, use it as authority
    const engineState = await exerciseEngine.getState(lessonId)
    if (
      engineState &&
      engineState.sectionId !== 'free' &&
      engineState.currentExerciseState &&
      engineState.currentExerciseState.status === 'active'
    ) {
      const exState = engineState.currentExerciseState
      const spec    = exState.spec
      // Intercept deterministic_sequential exercises (exact/contains validation)
      if (spec.meta.runtimeMode === 'deterministic_sequential') {
        // Readiness intent must never be treated as a deterministic exercise answer.
        if (isReadinessIntent(studentText)) {
          const normalized = normalizeIntentText(studentText)
          console.log(
            `[engine] readiness_intent_detected raw="${studentText.slice(0, 80)}" normalized="${normalized}"`,
          )
          console.log(
            `[engine] readiness_not_submitted_to_engine exercise=#${spec.meta.exerciseNumber} lessonId=${lessonId}`,
          )
          return null
        }
        // Grammar-fill voice path: run interpretation to extract canonical answer.
        // Resolves self-corrections ("ease. not ease. is." → "is") and sentence-embedded
        // auxiliaries ("What are he doing?" → "are") before submitting to the engine.
        const currentStep     = exState.spec.steps[exState.currentStepIndex]
        const isGrammarFill   = /grammar_fill|grammar_focus_fill|fill_in/i.test(spec.exerciseType)
        let submittedAnswer   = studentText
        if (isGrammarFill && currentStep?.expectedAnswer) {
          const interp = interpretSpokenAnswer({
            rawTranscript:  studentText,
            exerciseType:   spec.exerciseType,
            expectedAnswer: currentStep.expectedAnswer,
            acceptedAnswers: currentStep.validationRule.allowedVariants ?? [],
            inputMode:      'voice',
          })
          if (interp.canonicalAnswer) {
            console.log(
              `[interpretation] grammar_fill_canonical="${interp.canonicalAnswer}" ` +
              `raw="${studentText.slice(0, 40)}" exercise=#${spec.meta.exerciseNumber} lessonId=${lessonId}`,
            )
            submittedAnswer = interp.canonicalAnswer
          }
        }

        const result = await exerciseEngine.submitAnswer({ lessonId, studentAnswer: submittedAnswer })
        console.log(
          `[engine] voice_validate action=${result.action} ` +
          `exercise=#${spec.meta.exerciseNumber} lessonId=${lessonId} ` +
          `student="${submittedAnswer.slice(0, 60)}"`,
        )
        const correct = result.action === 'step_correct' || result.action === 'exercise_complete' ||
          result.action === 'soft_pass' || result.action === 'step_revealed'
        const dummyItem: ManifestItem = {
          text:          exState.spec.steps[exState.currentStepIndex]?.question ?? '',
          correctAnswer: result.validation?.correctAnswer ?? '',
        }
        const turn: CorrectionTurn | null = (!correct && result.validation)
          ? engineValidationToTurn(result.validation)
          : null
        return {
          correct,
          cursor:         result.exerciseCursor,
          correctionTurn: turn,
          exerciseNum:    spec.meta.exerciseNumber,
          itemIndex:      exState.currentStepIndex,
          item:           dummyItem,
          engineResult:   result,
        }
      }

      // Soft-speaking exercises: deterministic quality gate before engine submission.
      // Backend decides allowProgression — AI never makes this call.
      if (spec.meta.runtimeMode === 'soft_speaking') {
        // Readiness intent must never be treated as an exercise answer.
        if (isReadinessIntent(studentText)) {
          const normalized = normalizeIntentText(studentText)
          console.log(
            `[engine] readiness_intent_detected raw="${studentText.slice(0, 80)}" normalized="${normalized}"`,
          )
          console.log(
            `[engine] readiness_not_submitted_to_engine exercise=#${spec.meta.exerciseNumber} lessonId=${lessonId}`,
          )
          console.log(
            `[engine] soft_speaking_ignored_readiness exercise=#${spec.meta.exerciseNumber} lessonId=${lessonId}`,
          )
          return null  // caller handles readiness presentation; do not submit to engine
        }

        const attemptCount = await getSoftAttempts(lessonId, spec.exerciseId)
        const ssResult = validateSoftSpeakingAnswer({
          exerciseId:        spec.exerciseId,
          exerciseNumber:    spec.meta.exerciseNumber,
          exerciseType:      spec.exerciseType,
          instruction:       spec.instruction,
          itemText:          exState.spec.steps[exState.currentStepIndex]?.question ?? spec.instruction,
          studentTranscript: studentText,
          attemptCount,
        })

        console.log(
          `[soft-speaking] evaluated exercise=#${spec.meta.exerciseNumber} ` +
          `issue=${ssResult.issueType} allowProgression=${ssResult.allowProgression} ` +
          `attempt=${attemptCount + 1} lessonId=${lessonId}`,
        )

        const dummyItem: ManifestItem = {
          text:          exState.spec.steps[exState.currentStepIndex]?.question ?? '',
          correctAnswer: '',
        }

        if (!ssResult.allowProgression) {
          // Rejected — increment attempt count but do NOT submit to engine
          await incrementSoftAttempts(lessonId, spec.exerciseId)
          console.log(
            `[soft-speaking] retry_required exercise=#${spec.meta.exerciseNumber} ` +
            `issue=${ssResult.issueType} student="${studentText.slice(0, 60)}" lessonId=${lessonId}`,
          )
          return {
            correct:            false,
            cursor:             null,
            correctionTurn:     null,
            exerciseNum:        spec.meta.exerciseNumber,
            itemIndex:          exState.currentStepIndex,
            item:               dummyItem,
            isSoftSpeaking:     true,
            softSpeakingRetry:  ssResult,
          }
        }

        // Accepted — submit to engine and reset attempt counter
        if (ssResult.issueType === 'pronunciation_or_stt') {
          console.log(
            `[soft-speaking] pronunciation_or_stt interpreted="${ssResult.interpretedMeaning ?? ''}" lessonId=${lessonId}`,
          )
        }
        const accepted = ssResult.issueType === 'acceptable_with_repair' ? 'acceptable_with_repair' : 'accepted'
        console.log(
          `[soft-speaking] ${accepted} exercise=#${spec.meta.exerciseNumber} ` +
          `interpreted="${ssResult.interpretedMeaning ?? studentText.slice(0, 60)}" lessonId=${lessonId}`,
        )
        await resetSoftAttempts(lessonId, spec.exerciseId)

        const result = await exerciseEngine.submitAnswer({ lessonId, studentAnswer: studentText })
        console.log(
          `[engine] soft_speaking_advance action=${result.action} ` +
          `exercise=#${spec.meta.exerciseNumber} lessonId=${lessonId} ` +
          `student="${studentText.slice(0, 60)}"`,
        )
        return {
          correct:            true,
          cursor:             result.exerciseCursor,
          correctionTurn:     null,
          exerciseNum:        spec.meta.exerciseNumber,
          itemIndex:          exState.currentStepIndex,
          item:               dummyItem,
          engineResult:       result,
          isSoftSpeaking:     true,
          softSpeakingRetry:  ssResult,  // pass along for repair hint if acceptable_with_repair
        }
      }
    }

    // Legacy path: read LessonState and validate via manifest lookup
    const stateRaw = await redis.get(lessonStateKey(lessonId))
    if (!stateRaw) return null
    const state = JSON.parse(stateRaw) as LessonState

    if (state.phase !== 'EXERCISES')     return null
    if (!state.currentExerciseNum)       return null
    if (!state.currentItem)              return null
    if (!state.focusLesson)              return null

    // Look up exercise in manifest — must be deterministic_sequential with items
    const manifestEx = getManifestExerciseEntry(state.focusLesson, state.currentExerciseNum)
    if (!manifestEx || manifestEx.runtimeMode !== 'deterministic_sequential') return null
    if (!manifestEx.items?.length) return null

    const itemIdx = state.itemIndex ?? 0
    const item    = manifestEx.items[itemIdx]
    if (!item || !item.correctAnswer) return null

    // Exercise already hard-closed — do not validate
    if (state.completedExercises.includes(state.currentExerciseNum)) return null

    const correct = validateManifestAnswer(studentText, item)
    console.log(
      `[manifest] legacy_voice_validate exercise=#${state.currentExerciseNum} ` +
      `item=${itemIdx} correct=${correct} student="${studentText.slice(0, 60)}"`,
    )

    if (correct) {
      const cursor = await orchestrator.recordCorrectAnswer(lessonId)
      return { correct: true, cursor, correctionTurn: null, exerciseNum: state.currentExerciseNum, itemIndex: itemIdx, item }
    } else {
      const errorData: ExerciseErrorData = {
        exercise:      item.text,
        studentAnswer: studentText,
        correctAnswer: item.correctAnswer,
        errorType:     'other',
      }
      const turn = await orchestrator.recordWrongAnswer(lessonId, errorData)
      return { correct: false, cursor: null, correctionTurn: turn, exerciseNum: state.currentExerciseNum, itemIndex: itemIdx, item }
    }
  } catch (err) {
    console.error('[manifest] voice_validate error:', err instanceof Error ? err.message : err)
    return null
  }
}

// Phase A: AI context for soft_speaking exercises — natural acknowledgment, not correction ladder.
function buildSoftSpeakingContext(result: EngineResult, studentText: string): string {
  const stateBlock = result.promptContext

  let answerBlock: string
  if (result.action === 'step_correct') {
    const cursor   = result.exerciseCursor
    const nextItem = cursor?.currentItem
    const itemIdx  = cursor?.itemIndex ?? 0
    console.log(
      `[ws] teacher_context_cursor_sync action=step_correct ` +
      `exercise=#${cursor?.exerciseNumber} item=${itemIdx}/${cursor?.itemTotal}`,
    )
    const contract = nextItem
      ? `\nNEXT STEP: After your acknowledgment, present item ${itemIdx + 1}: "${nextItem}". Do not ask additional questions first.\nANTI-STALE: Do NOT reference or repeat the item the student just answered. Move forward only.`
      : ''
    answerBlock = `[SPEAKING RESULT] Student answered: "${studentText}".\n` +
      `Acknowledge naturally in 1 sentence (not "Exactly." — use "Nice." / "Good." / "Interesting."). ` +
      `If there is one clear language error, note it in a second sentence only. Keep total response short.${contract}`
  } else if (result.action === 'exercise_complete') {
    const cursor   = result.exerciseCursor
    const nextExNum = cursor?.exerciseNumber
    const nextItem  = cursor?.currentItem
    console.log(
      `[ws] teacher_context_cursor_sync action=exercise_complete ` +
      `next_exercise=#${nextExNum} item=0/${cursor?.itemTotal}`,
    )
    const contract  = nextItem
      ? `\nEXERCISE COMPLETE: Move immediately to Exercise ${nextExNum}. Present its first item: "${nextItem}".`
      : `\nEXERCISE COMPLETE: Move immediately to Exercise ${nextExNum ?? 'next'}.`
    answerBlock = `[SPEAKING RESULT] Student answered: "${studentText}".\n` +
      `Briefly acknowledge (one sentence). ${contract}`
  } else {
    // lesson_complete or no_change — hand off to standard path
    answerBlock = `[SPEAKING RESULT] Student answered: "${studentText}". Continue naturally.`
  }

  return stateBlock ? stateBlock + '\n\n' + answerBlock : answerBlock
}

// Builds a deterministic repair/retry prompt for the Teacher Brain when soft-speaking
// validation rejects the student's answer. Teacher phrases naturally but must not progress.
// Includes interpretation result so Teacher Brain responds to interpreted meaning, not raw STT.
function buildSoftSpeakingRetryContext(mv: ManifestVoiceResult, studentText: string): string {
  const r      = mv.softSpeakingRetry!
  const repair = r.repairPrompt ?? r.teacherHint ?? 'Try again with a complete sentence.'

  const interpretationLine = r.interpretedMeaning
    ? `Interpreted student intent: "${r.interpretedMeaning}" (do NOT respond to raw STT noise).`
    : ''

  const lines = [
    `[SPEAKING RETRY — EXERCISE ${mv.exerciseNum}]`,
    `Student said: "${studentText}"`,
    `Validation issue: ${r.issueType}`,
    interpretationLine,
    `MANDATORY: Do NOT mark this exercise complete. Do NOT advance. Keep Exercise ${mv.exerciseNum} active.`,
    `MANDATORY: Do NOT say "Exercise complete." Do NOT introduce Exercise ${mv.exerciseNum + 1} or any other exercise.`,
    `Your response MUST deliver this repair prompt (phrase naturally, keep short — one or two sentences):`,
    repair,
    `End with a clear retry instruction.`,
  ].filter(Boolean)

  return lines.join('\n')
}

// Builds a repair hint context when soft-speaking answer is accepted but imperfect.
function buildSoftSpeakingAcceptedContext(mv: ManifestVoiceResult, studentText: string): string {
  const r = mv.softSpeakingRetry!
  const hint = r.teacherHint ?? ''
  const engineCtx = mv.engineResult ? buildSoftSpeakingContext(mv.engineResult, studentText) : ''
  if (!hint) return engineCtx
  // Prepend repair hint then let normal progression context follow
  const hintBlock = `[SPEAKING REPAIR HINT] After your acknowledgment, add: "${hint}"\n`
  return hintBlock + engineCtx
}

// Builds the [EXERCISE RESULT] context block injected as AI input after manifest validation.
// Engine Authority Migration: when engineResult is present, delegates to buildEngineAnswerContext
// so the AI receives the full engine state block alongside the correction/confirmation.
function buildManifestVoiceContext(mv: ManifestVoiceResult, studentText: string): string {
  // Soft-speaking retry: validator blocked progression — build repair context
  if (mv.isSoftSpeaking && !mv.correct && mv.softSpeakingRetry) {
    return buildSoftSpeakingRetryContext(mv, studentText)
  }

  // Soft-speaking accepted with repair hint
  if (mv.isSoftSpeaking && mv.correct && mv.softSpeakingRetry?.issueType === 'acceptable_with_repair' && mv.engineResult) {
    return buildSoftSpeakingAcceptedContext(mv, studentText)
  }

  // Engine path: use richer engine context when available
  if (mv.engineResult) {
    if (mv.isSoftSpeaking) return buildSoftSpeakingContext(mv.engineResult, studentText)
    return buildEngineAnswerContext(mv.engineResult, studentText)
  }

  // Legacy path: build from ManifestVoiceResult fields
  if (mv.correct) {
    const cursor = mv.cursor
    const exerciseDone = cursor ? cursor.itemIndex >= cursor.itemTotal : false
    const continuationContract = exerciseDone
      ? `\nEXERCISE TURN COMPLETION CONTRACT: After step 2, announce ` +
        `"Exercise ${mv.exerciseNum} complete." ` +
        `Then introduce the next exercise immediately in the same response.`
      : cursor?.currentItem
      ? `\nEXERCISE TURN COMPLETION CONTRACT: After step 2, present item ` +
        `${cursor.itemIndex + 1}: "${cursor.currentItem}" in the same response. ` +
        `Do NOT stop after confirmation. Presenting the next item is mandatory.`
      : ''

    return (
      `[EXERCISE RESULT] Student answered: "${studentText}" — CORRECT.\n` +
      `Your response MUST follow this structure in order:\n` +
      `1. ONE confirmation word only: "Exactly." / "Right." / "Correct."\n` +
      `2. WHY in one sentence: the rule or connection that makes this correct.${continuationContract}`
    )
  } else {
    return buildCorrectionContext(
      studentText,
      mv.item.correctAnswer,
      mv.correctionTurn!,
      undefined,
      mv.item.text,
    )
  }
}

// Appended to student input when an exercise is active so the AI knows to
// answer briefly and return to the current item.
// Prefers the engine cursor (always current) over Redis LessonState (may lag one turn
// behind on correction turns where the engine advanced but Redis wasn't re-synced yet).
async function buildOffTopicGuard(lessonId: string): Promise<string> {
  try {
    let currentItem  = ''
    let itemIndex    = 0
    let exerciseNum  = 0
    let exerciseType = 'unknown'

    // 1. Try engine cursor first — authoritative, never stale
    try {
      const engineCursor = await exerciseEngine.getCursor(lessonId)
      if (engineCursor?.currentItem) {
        currentItem  = engineCursor.currentItem
        itemIndex    = engineCursor.itemIndex ?? 0
        exerciseNum  = engineCursor.exerciseNumber ?? 0
        exerciseType = engineCursor.exerciseType ?? 'unknown'
        console.log(
          `[off-topic-guard] item_from_engine exercise=#${exerciseNum} item=${itemIndex} lessonId=${lessonId}`,
        )
      }
    } catch { /* non-fatal — fall through to Redis */ }

    // 2. Fall back to Redis LessonState when engine cursor is unavailable
    if (!currentItem) {
      const stateRaw = await redis.get(lessonStateKey(lessonId))
      if (!stateRaw) return ''
      const state = JSON.parse(stateRaw) as LessonState
      if (!state.currentExerciseNum || !state.currentItem) return ''
      currentItem  = state.currentItem
      itemIndex    = state.itemIndex ?? 0
      exerciseNum  = state.currentExerciseNum
      exerciseType = state.activeExerciseType ?? 'unknown'
      console.log(
        `[off-topic-guard] item_from_redis_state exercise=#${exerciseNum} item=${itemIndex} lessonId=${lessonId}`,
      )
    }

    const recovery = buildProtocolOffTopicRecovery(exerciseType, currentItem, itemIndex)

    // Explicit current-item lock so the AI always returns to the engine-authoritative position,
    // not to any item it infers from conversation history.
    const itemNum  = itemIndex + 1
    const itemLock =
      `\n\nCURRENT ITEM LOCK (backend-authoritative from engine): ` +
      `After answering the student's question, return EXACTLY to ` +
      `Exercise ${exerciseNum}, Number ${itemNum}: "${currentItem}". ` +
      `Do NOT reference any other item from conversation history. ` +
      `Do NOT advance the exercise. Do NOT increment the retry count.`

    return recovery + itemLock
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

  // Trace student input (voice or text) — skip system-generated context strings
  if (!skipOffTopicGuard && !text.trimStart().startsWith('[')) {
    traceSttResult(meta.lessonId, {
      transcriptLength:  text.trim().length,
      transcriptPreview: text.slice(0, 120),
      inputMode:         meta.voiceTurnId ? 'voice' : 'text',
      turnId:            meta.voiceTurnId,
    })
  }

  // Phase 4: compute remaining lesson time for time-aware AI prompting
  const elapsedMs   = meta.lessonStartedAt ? Date.now() - meta.lessonStartedAt : 0
  const remainingMs = Math.max(0, MAX_LESSON_MS - elapsedMs)

  // Inject off-topic recovery guard only when the student input actually looks like
  // a side question or meta-request. Short exercise answers ("Stupid", "A", "letter B",
  // "negative") must NOT trigger recovery — they belong to exercise answer handling.
  // System-generated contexts (correction, confusion) skip this entirely via skipOffTopicGuard.
  let inputText = text
  let manifestValidation: ManifestVoiceResult | null = null
  if (!skipOffTopicGuard) {
    if (looksLikeOffTopicRequest(text)) {
      const guard = await buildOffTopicGuard(meta.lessonId)
      if (guard) {
        inputText = text + guard
      }
    } else {
      // Readiness intent — intercept before any engine or manifest validation.
      // "I'm ready" / "ready" / "let's go" starts exercises but must NOT answer Exercise 1.
      let readinessHandled = false
      if (isReadinessIntent(text)) {
        const rdyState = await exerciseEngine.getState(meta.lessonId)
        if (
          rdyState &&
          rdyState.sectionId !== 'free' &&
          rdyState.currentExerciseState &&
          rdyState.currentExerciseState.status === 'active'
        ) {
          readinessHandled = true
          const normalizedRdy = normalizeIntentText(text)
          console.log(`[ws] readiness_intent_detected raw="${text.slice(0, 80)}" normalized="${normalizedRdy}" lessonId=${meta.lessonId}`)
          console.log(`[ws] readiness_not_submitted_to_engine lessonId=${meta.lessonId}`)
          await forcePhaseToExercises(meta.lessonId)
          const rdyCursor = await exerciseEngine.getCursor(meta.lessonId)
          if (rdyCursor) {
            send(ws, { type: 'exercise_cursor_updated', cursor: rdyCursor })
            console.log(
              `[ws] readiness_cursor_emitted exercise=#${rdyCursor.exerciseNumber} item=${rdyCursor.itemIndex}/${rdyCursor.itemTotal} lessonId=${meta.lessonId}`,
            )
          }
          const rdySpec    = rdyState.currentExerciseState.spec
          const rdyExState = rdyState.currentExerciseState
          const rdyStep    = rdySpec.steps[rdyExState.currentStepIndex]
          inputText = [
            `[LESSON START — EXERCISES PHASE]`,
            `Student said they are ready to start. Do NOT treat this as an exercise answer.`,
            `MANDATORY: Introduce Exercise ${rdySpec.meta.exerciseNumber} now.`,
            rdySpec.instruction ? `Instruction: "${rdySpec.instruction}"` : ``,
            rdyStep?.question
              ? `Present item 1: "${rdyStep.question}". Wait for the student's answer.`
              : `Present the exercise and wait for the student's answer.`,
            `Do NOT say "I'm thinking". Do NOT skip any items. Start from item 1.`,
          ].filter(Boolean).join('\n')
        }
      }

      if (!readinessHandled) {
        // STT noise guard: reject garbage transcripts before they reach the engine.
        // Noise (< 30% letter ratio, < 2 chars) must never count as an exercise answer.
        if (isSttNoise(text)) {
          console.log(`[ws] stt_noise_detected raw="${text.slice(0, 60)}" lessonId=${meta.lessonId}`)
          const engineCursorForNoise = await exerciseEngine.getCursor(meta.lessonId).catch(() => null)
          if (engineCursorForNoise?.currentItem) {
            inputText =
              `[STT NOISE] The voice transcript was unclear or too short to process.\n` +
              `Do NOT treat this as an exercise answer. Do NOT advance the exercise.\n` +
              `Tell the student you did not catch that and ask them to try again.\n` +
              `Then re-present the CURRENT item: Exercise ${engineCursorForNoise.exerciseNumber}, ` +
              `Number ${(engineCursorForNoise.itemIndex ?? 0) + 1}: "${engineCursorForNoise.currentItem}"`
            console.log(`[ws] stt_noise_returning_to_item exercise=#${engineCursorForNoise.exerciseNumber} item=${engineCursorForNoise.itemIndex} lessonId=${meta.lessonId}`)
          } else {
            inputText =
              `[STT NOISE] The voice transcript was unclear. Ask the student to repeat what they said.`
          }
        } else {
        // Phase G: detect exercise-complete + transition intent to prevent stale re-anchor
        // and the "I'm thinking..." forbidden response after exercise completion.
        const completionSignal = await buildExerciseCompletionSignal(meta.lessonId, text)
        if (completionSignal) {
          inputText = completionSignal
        } else {
          // Master Orchestrator handles deterministic engine exercises (text/voice parity).
          // Returns null when no active deterministic exercise — fall back to legacy path.
          const orchVoiceResult = await masterOrchestrator.handleVoiceAnswer({
            lessonId:        meta.lessonId,
            userId:          meta.userId,
            sessionId:       meta.sessionId,
            studentAnswer:   text,
            lessonStartedAt: meta.lessonStartedAt,
          })

          if (orchVoiceResult && !orchVoiceResult.error) {
            // Orchestrator handled this — emit pre-events and use teacher context
            masterOrchestrator.emitFrontendSnapshot(orchVoiceResult, (event) => send(ws, event as Parameters<typeof send>[1]), meta.lessonId)

            if (orchVoiceResult.lessonComplete && orchVoiceResult.lessonSummary) {
              const durationMin = meta.lessonStartedAt
                ? Math.round((Date.now() - meta.lessonStartedAt) / 60_000)
                : 0
              send(ws, {
                type: 'lesson_end',
                summary: {
                  lessonId: meta.lessonId,
                  phasesReached:   ['DIAGNOSTIC', 'EXERCISES', 'WRAP_UP'],
                  exerciseScore:   orchVoiceResult.lessonSummary.exerciseScore,
                  vocabularyCount: 0,
                  durationMin,
                },
              })
              meta.lessonId = null
              meta.stt?.close()
              meta.stt = null
              meta.aiProcessing = false
              if (meta.queuedInput) {
                const queued    = meta.queuedInput
                meta.queuedInput = null
                processInput(ws, meta, queued).catch((err: unknown) =>
                  console.error('[paid-lesson] processInput error (queued-voice-complete):', err))
              }
              return
            }

            if (orchVoiceResult.teacherInput) {
              inputText = orchVoiceResult.teacherInput
            }
          } else {
            // Legacy path: manifest validation for non-engine or older snapshots
            manifestValidation = await tryManifestValidateVoice(meta.lessonId, text)
            if (manifestValidation) {
              traceValidation(meta.lessonId, {
                exerciseId:       manifestValidation.engineResult?.exerciseCursor?.exerciseId ?? `ex_${manifestValidation.exerciseNum}`,
                itemIndex:        manifestValidation.itemIndex,
                correct:          manifestValidation.correct,
                allowProgression: manifestValidation.softSpeakingRetry
                  ? manifestValidation.softSpeakingRetry.allowProgression
                  : manifestValidation.correct,
                retryRequired:    manifestValidation.softSpeakingRetry
                  ? !manifestValidation.softSpeakingRetry.allowProgression
                  : !manifestValidation.correct,
                issueType:        manifestValidation.softSpeakingRetry?.issueType ?? null,
              })
              inputText = buildManifestVoiceContext(manifestValidation, text)

              const isSoftRetry = manifestValidation.isSoftSpeaking && !manifestValidation.correct && !!manifestValidation.softSpeakingRetry
              const engineResult = manifestValidation.engineResult

              // Cursor: only emit when progression was allowed (no cursor on retry)
              const cursorToSend = engineResult?.exerciseCursor ?? manifestValidation.cursor
              if (cursorToSend && !isSoftRetry) {
                send(ws, { type: 'exercise_cursor_updated', cursor: cursorToSend })
                console.log(
                  `[engine] voice_cursor_emitted exercise=#${cursorToSend.exerciseNumber} ` +
                  `item=${cursorToSend.itemIndex}/${cursorToSend.itemTotal} ` +
                  `via=${engineResult ? 'engine' : 'manifest'}`,
                )
              }

              // Feedback: skip event for soft-speaking retry — teacher voice conveys the repair
              if (!isSoftRetry) {
                if (engineResult?.validation) {
                  send(ws, {
                    type:        'feedback',
                    correct:     engineResult.validation.correct,
                    explanation: engineResult.validation.feedback,
                    score:       engineResult.validation.score,
                  })
                } else {
                  send(ws, {
                    type:        'feedback',
                    correct:      manifestValidation.correct,
                    explanation: '',
                    score:       manifestValidation.correct ? 1.0 : 0,
                  })
                }
              }
            }
          }
        }
        } // close noise-guard else
      }
    }
  }

  // Engine Authority Migration: inject engine prompt context into AI system prompt.
  // Teacher Brain reads engine state as a system block — it cannot modify engine state.
  let enginePromptContext = ''
  try {
    enginePromptContext = await exerciseEngine.getPromptContext(meta.lessonId)
  } catch { /* non-fatal — AI proceeds without engine context */ }

  // Unsafe-fallback guard: if queue is empty (no manifest), inject explicit block
  // to prevent AI from improvising exercises.
  if (enginePromptContext.includes('fallback_used=true') || enginePromptContext.includes('No manifest loaded')) {
    try {
      const engState = await exerciseEngine.getState(meta.lessonId)
      const sectionId = engState?.sectionId ?? 'unknown'
      const fallbackBlock = buildFallbackGuardContext(sectionId)
      enginePromptContext = fallbackBlock + '\n\n' + enginePromptContext
      console.log(`[teacher_guard] fallback_block_injected sectionId=${sectionId} lessonId=${meta.lessonId}`)
    } catch { /* non-fatal */ }
  }

  // Strict Execution State: inject EXERCISE NUMBER LOCK as the first block of engine context.
  // This prevents the AI from announcing inactive exercises or skipping ahead.
  // Loaded only when engine has an active exercise (non-fallback path).
  if (enginePromptContext.includes('(backend-authoritative)')) {
    try {
      const execState = await buildExerciseExecutionState(meta.lessonId)
      if (execState) {
        const execBlock = buildExecutionStatePromptBlock(execState)
        enginePromptContext = execBlock + '\n\n' + enginePromptContext
        console.log(
          `[execution_guard] state_injected exercise=#${execState.activeExerciseNumber}` +
          ` item=${execState.activeItemIndex + 1}/${execState.itemTotal}` +
          ` lessonId=${meta.lessonId}`,
        )
      }
    } catch { /* non-fatal */ }
  }

  // Memory System: load compact student memory summary for Teacher Brain (read-only).
  // Loaded once per AI turn. Failure is non-fatal — lesson continues without memory context.
  let memoryBlock = ''
  if (meta.userId) {
    try {
      memoryBlock = await memoryService.getTeacherMemoryPromptBlock(meta.userId)
    } catch { /* non-fatal */ }
  }

  console.log(`[paid-lesson] ai_turn_started input_chars=${text.trim().length} remaining_min=${Math.round(remainingMs / 60_000)}`)
  let result: Awaited<ReturnType<typeof orchestrator.process>> | undefined
  try {
    result = await orchestrator.process(meta.lessonId, inputText, {
      remainingMs,
      enginePromptContext: enginePromptContext || undefined,
      memoryBlock:         memoryBlock || undefined,
    })
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

  traceTeacherGeneration(meta.lessonId ?? '', {
    phase:          result.phase,
    responseLength: result.text?.length ?? 0,
  })

  // ── Stale Item Guard ──────────────────────────────────────────────────────
  // In EXERCISES phase, validate teacher text against canonical cursor before send.
  // If AI referenced a stale item number (e.g. "Number 1" when on item 3), rewrite.
  let guardedText = result.text
  if (result.phase === 'EXERCISES' && meta.lessonId) {
    try {
      const canonicalCursor = await exerciseEngine.getCursor(meta.lessonId)
      const guardResult = guardTeacherResponse(result.text, canonicalCursor, result.phase)
      if (!guardResult.safe) {
        console.log(
          `[teacher_guard] stale_item_blocked lessonId=${meta.lessonId}` +
          ` old="${guardResult.blockedPhrase?.slice(0, 60)}"` +
          ` current=item${(canonicalCursor?.itemIndex ?? 0) + 1}:exercise#${canonicalCursor?.exerciseNumber ?? '?'}`,
        )
        guardedText = guardResult.text
      }
    } catch { /* non-fatal — send original text */ }

    // ── Execution Output Guard ──────────────────────────────────────────────
    // Extends stale-item guard: catches EXERCISE-level violations (inactive exercise
    // announcements, missing-content claims, premature completion).
    try {
      const execState     = await buildExerciseExecutionState(meta.lessonId)
      const execGuard     = guardExecutionOutput(guardedText, execState, result.phase)
      if (!execGuard.safe) {
        console.log(
          `[execution_guard] violation type=${execGuard.violationType}` +
          ` active=#${execState?.activeExerciseNumber ?? '?'}` +
          ` blocked="${execGuard.violation?.slice(0, 60)}"` +
          ` lessonId=${meta.lessonId}`,
        )
        guardedText = execGuard.text
      }
    } catch { /* non-fatal — send guarded text from stale-item guard */ }
  }

  send(ws, { type: 'ai_text', phase: result.phase, text: guardedText, displayText: result.displayText })
  if (meta.lessonId && meta.userId) {
    recordTeacherMessage({
      lessonId:       meta.lessonId,
      sessionId:      meta.sessionId,
      userId:         meta.userId,
      studentId:      meta.studentId,
      text:           guardedText,  // record guarded text (not raw AI output)
      phase:          result.phase,
      exerciseNumber: result.exercise?.exerciseNumber ?? result.exerciseCursor?.exerciseNumber ?? null,
      exerciseType:   result.exercise?.type          ?? result.exerciseCursor?.exerciseType   ?? null,
      itemIndex:      result.exerciseCursor?.itemIndex ?? null,
      itemTotal:      result.exerciseCursor?.itemTotal ?? null,
      correctionTurn: manifestValidation?.correctionTurn ?? null,
      source:         'ai',
      metadata:       { aiCallCount: meta.aiCallCount },
    })
  }

  // When handling confusion, send the AI's display_text as a teaching card
  if (sendCard && result.displayText && result.displayText !== result.text) {
    send(ws, { type: 'teaching_card', cardType: 'mini_explanation', displayText: result.displayText })
  }

  if (result.phaseChanged) {
    send(ws, { type: 'phase_change', from: result.previousPhase, to: result.phase })
    console.log(`[ws] phase ${result.previousPhase} → ${result.phase}`)
    if (meta.lessonId && meta.userId) {
      recordSystemEvent({ lessonId: meta.lessonId, sessionId: meta.sessionId, userId: meta.userId, studentId: meta.studentId, message: `phase_change from=${result.previousPhase} to=${result.phase}`, phase: result.phase })
    }
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

    // Supplementary analytics: engine-aware exercise count (fire-and-forget)
    const _analyticsLessonId  = meta.lessonId
    const _analyticsSessionId = meta.sessionId
    const _analyticsScore     = result.exerciseScore
    void exerciseEngine.getState(_analyticsLessonId!).then((engState) => {
      const engCompleted = engState?.completedExerciseIds?.length ?? 0
      const bestCount    = engCompleted > 0 ? engCompleted : _analyticsScore
      if (bestCount !== _analyticsScore || engCompleted > 0) {
        console.log(`[transcript] lesson_end_analytics lessonId=${_analyticsLessonId} session=${_analyticsSessionId} exercisesCompleted=${bestCount} engineCompleted=${engCompleted} legacyScore=${_analyticsScore}`)
      }
    }).catch(() => { /* non-fatal */ })

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
    if (meta.lessonId && meta.userId) {
      recordSystemEvent({ lessonId: meta.lessonId, sessionId: meta.sessionId, userId: meta.userId, studentId: meta.studentId, message: 'lesson_end', phase: 'END', metadata: { durationMin, exerciseScore: result.exerciseScore, vocabularyCount: result.vocabularyCount } })
    }

    endLessonTrace(meta.lessonId ?? '', {
      durationMin,
      exerciseScore:   result.exerciseScore,
      vocabularyCount: result.vocabularyCount,
      phasesReached:   getPhasesUpTo(result.previousPhase),
      endReason:       'natural',
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

    // Record lesson completion memory — fire-and-forget
    if (meta.userId && endedLessonId) {
      const durationSec = meta.lessonStartedAt
        ? Math.round((Date.now() - meta.lessonStartedAt) / 1_000)
        : 0
      const endedUserId = meta.userId
      // Load completed exercises from Redis state for memory record
      redis.get(lessonStateKey(endedLessonId)).then((raw) => {
        try {
          const s = raw ? JSON.parse(raw) as { completedExercises?: number[]; focusLesson?: string; phase?: string } : {}
          return memoryService.recordLessonCompleted({
            userId:             endedUserId,
            sessionId:          meta.sessionId ?? endedLessonId,
            lessonId:           endedLessonId,
            sectionId:          s.focusLesson,
            phaseReached:       result.previousPhase,
            completedExercises: (s.completedExercises ?? []).map(String),
            durationSeconds:    durationSec,
            voiceAttemptCount:  0,
          })
        } catch {
          return Promise.resolve()
        }
      }).catch(() => { /* fail-soft */ })
    }

    meta.lessonId = null
    meta.stt?.close()
    meta.stt = null
    return
  }

  console.log(`[paid-lesson] ai_turn_completed phase=${result.phase}`)

  // Phase A: always broadcast engine cursor after AI turn in EXERCISES phase.
  // Ensures PaidExerciseCard appears for soft_speaking exercises where the orchestrator
  // does not emit a cursor, and refreshes cursor state after every AI exchange.
  if (result.phase === 'EXERCISES' && meta.lessonId) {
    try {
      const liveCursor = await exerciseEngine.getCursor(meta.lessonId)
      if (liveCursor && !result.exerciseCursor) {
        send(ws, { type: 'exercise_cursor_updated', cursor: liveCursor })
        console.log(`[paid-lesson] cursor_post_turn exercise=#${liveCursor.exerciseNumber} type=${liveCursor.exerciseType}`)
      }
    } catch { /* non-fatal */ }
  }

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

// Phase G: derive a manifest-aware TURN A hint based on the expected answer.
// Prevents AI from asking "do or does?" when the correct answer is "Have" (Present Perfect).
function deriveAnswerContext(correctAnswer: string): string {
  const lower = correctAnswer.toLowerCase().trim()
  if (['have', 'has', 'had'].includes(lower)) {
    return `The expected answer is a Present Perfect auxiliary. Focus your guiding question on which auxiliary verb starts Present Perfect questions. Do NOT ask about "do or does".`
  }
  if (['is', 'are', 'was', 'were', 'am'].includes(lower)) {
    return `The expected answer is a form of "be". Ask about which "be" form matches the subject and tense here.`
  }
  if (lower === 'do') {
    return `The expected answer is "do". Focus on Present Simple questions with I/you/we/they.`
  }
  if (lower === 'does') {
    return `The expected answer is "does". Focus on Present Simple questions with he/she/it.`
  }
  if (lower === 'did') {
    return `The expected answer is "did". Focus on Past Simple question formation.`
  }
  if (['will', 'would', 'can', 'could', 'shall', 'should', 'may', 'might', 'must'].includes(lower)) {
    return `The expected answer is a modal verb. Ask about which modal fits this context.`
  }
  return ''
}

function buildCorrectionContext(answer: string, correctAnswer: string, turn: CorrectionTurn, exerciseType?: string, currentItem?: string): string {
  // Phase G: manifest-aware TURN A — override generic examples with answer-specific context
  const answerContext = deriveAnswerContext(correctAnswer)
  const turnANote = exerciseType && TYPE_TURN_A_SUPPLEMENT[exerciseType]
    ? `\n  Exercise-type guidance: ${TYPE_TURN_A_SUPPLEMENT[exerciseType]}`
    : answerContext
    ? `\n  ${answerContext}`
    : '\n  Think: what specific grammar rule or form determines the correct answer here?'

  const turnBNote = exerciseType && TYPE_TURN_B_SUPPLEMENT[exerciseType]
    ? `\n  Exercise-type guidance: ${TYPE_TURN_B_SUPPLEMENT[exerciseType]}`
    : '\n  Focus on the one specific element the student got wrong.'

  const TURN_INSTRUCTIONS: Record<CorrectionTurn, string> = {
    A: `TURN A (attempt 1): Ask ONE guiding question targeting the exact knowledge gap. Give ZERO part of the answer.
  Think: what specific rule caused this error? Ask about only that.${turnANote}`,
    B: `TURN B (attempt 2): Give ONE small hint — one missing piece of information. Do NOT reveal the full answer.${turnBNote}`,
    C: `TURN C (attempt 3): Give a STRONGER hint. Student is still stuck — fill in almost everything.
  Example: "The auxiliary here is not 'do' — think about which tense this question uses, then say the auxiliary."`,
    D: `TURN D (attempt 4+): REVEAL THE FULL ANSWER NOW.
  Say: "The answer is ${correctAnswer}. [Brief rule in one sentence]. Now repeat the full sentence after me."
  Wait for the student to repeat correctly, then advance to the next item.`,
  }

  // For TURN A–C: mandate ending with a retry of the current item so the student
  // always knows what to answer next. TURN D already ends with "repeat after me".
  const retryAnchor = (turn !== 'D' && currentItem)
    ? `\nCLOSING REQUIREMENT: After your ${turn === 'A' ? 'guiding question' : 'hint'}, end with: "Try again — ${currentItem}" so the student knows what to answer.`
    : ''

  return `[EXERCISE RESULT] Student answered: "${answer}" — INCORRECT.
Correct answer (Teacher's Book reference — do NOT reveal until TURN D): "${correctAnswer}".

CORRECTION LADDER — you are at ${turn === 'D' ? 'TURN D — REVEAL THE ANSWER' : `TURN ${turn}`}:
${TURN_INSTRUCTIONS[turn]}${retryAnchor}

Set "exercise": null — do NOT advance the item until the student answers correctly (or until TURN D is resolved).
Do NOT restart at TURN A. You are at TURN ${turn}. Stay here.`
}

// ── Engine Authority Migration: answer handling helpers ───────────────────────

// Map engine validation hintsRemaining → correction ladder turn (A/B/C/D).
// hintsRemaining is computed as max(0, maxRetries - retryCount - 1) in validation-hooks.ts.
function engineValidationToTurn(v: EngineValidationResult): CorrectionTurn {
  if (v.shouldRevealAnswer) return 'D'
  if (v.hintsRemaining >= 2) return 'A'
  if (v.hintsRemaining === 1) return 'B'
  return 'C'
}

// Build the [EXERCISE RESULT] AI context block from an EngineResult.
// The engine's promptContext (=== EXERCISE ENGINE STATE ===) is prepended so
// Teacher Brain reads deterministic state before seeing the correction/confirmation.
function buildEngineAnswerContext(result: EngineResult, studentAnswer: string): string {
  const stateBlock = result.promptContext  // === EXERCISE ENGINE STATE === block

  let answerBlock: string

  if (result.action === 'step_correct' || result.action === 'soft_pass') {
    const cursor = result.exerciseCursor
    const exerciseDone = !cursor?.currentItem
    const continuationContract = exerciseDone
      ? `\nEXERCISE TURN COMPLETION CONTRACT: After step 2, announce exercise complete. ` +
        `Then introduce the next exercise immediately in the same response.`
      : cursor?.currentItem
      ? `\nEXERCISE TURN COMPLETION CONTRACT: After step 2, present item ` +
        `${(cursor.itemIndex ?? 0) + 1}: "${cursor.currentItem}" in the same response. ` +
        `Do NOT stop after confirmation. Presenting the next item is mandatory.`
      : ''
    answerBlock = `[EXERCISE RESULT] Student answered: "${studentAnswer}" — CORRECT.\n` +
      `Your response MUST follow this structure in order:\n` +
      `1. ONE confirmation word only: "Exactly." / "Right." / "Correct."\n` +
      `2. WHY in one sentence: the rule or connection that makes this correct.${continuationContract}`
  } else if (result.action === 'exercise_complete') {
    const cursor = result.exerciseCursor
    const nextExNum = cursor?.exerciseNumber ?? ''
    const continuationContract = cursor?.currentItem
      ? `\nEXERCISE TURN COMPLETION CONTRACT: This exercise is done. Immediately present Exercise ${nextExNum} item 1: "${cursor.currentItem}".`
      : `\nEXERCISE TURN COMPLETION CONTRACT: This exercise is done. Move to Exercise ${nextExNum} immediately.`
    answerBlock = `[EXERCISE RESULT] Student answered: "${studentAnswer}" — CORRECT (exercise completed).\n` +
      `Your response MUST follow this structure in order:\n` +
      `1. ONE confirmation word only: "Exactly." / "Right." / "Correct."\n` +
      `2. WHY in one sentence.${continuationContract}`
  } else if (result.action === 'step_wrong' && result.validation) {
    const turn = engineValidationToTurn(result.validation)
    const currentItem = result.exerciseCursor?.currentItem ?? ''
    answerBlock = buildCorrectionContext(studentAnswer, result.validation.correctAnswer, turn, undefined, currentItem)
  } else if (result.action === 'step_revealed' && result.validation) {
    answerBlock = `[EXERCISE RESULT] Student answered: "${studentAnswer}" — INCORRECT (max retries reached).\n` +
      `TURN D: REVEAL THE FULL ANSWER NOW.\n` +
      `Say: "The answer is ${result.validation.correctAnswer}. ` +
      `[Brief rule in one sentence]. Now repeat the full sentence after me."\n` +
      `Wait for the student to repeat, then advance to the next item.`
  } else if (result.action === 'exercise_skipped') {
    const cursor    = result.exerciseCursor
    const nextExNum = cursor?.exerciseNumber ?? ''
    answerBlock = `[ENGINE] Exercise auto-skipped (requires unavailable resource). ` +
      `In one sentence: skip announcement. Then immediately present Exercise ${nextExNum}` +
      (cursor?.currentItem ? ` item 1: "${cursor.currentItem}".` : '.')
  } else if (result.action === 'lesson_complete') {
    answerBlock = `[ENGINE] All exercises complete. Move to WRAP_UP phase. ` +
      `Summarise what the student practised and close the lesson warmly.`
  } else {
    answerBlock = `[ENGINE] No active exercise step. Continue the lesson naturally.`
  }

  return stateBlock ? stateBlock + '\n\n' + answerBlock : answerBlock
}

// Engine-authoritative exercise answer handler.
// Delegates all coordination to MasterLessonOrchestrator — WS is I/O only here.
async function handleEngineExerciseAnswer(
  ws: WebSocket,
  meta: ClientMeta,
  answer: string,
): Promise<void> {
  const lessonId = meta.lessonId!

  const orchResult = await masterOrchestrator.handleStudentAnswer({
    lessonId,
    userId:          meta.userId,
    sessionId:       meta.sessionId,
    studentAnswer:   answer,
    lessonStartedAt: meta.lessonStartedAt,
  })

  if (orchResult.error) {
    send(ws, { type: 'error', code: orchResult.error.code, message: orchResult.error.message })
    return
  }

  // Emit events in deterministic order: cursor first, then feedback
  masterOrchestrator.emitFrontendSnapshot(orchResult, (event) => send(ws, event as Parameters<typeof send>[1]), lessonId)

  // Lesson complete — emit lesson_end, no AI call
  if (orchResult.lessonComplete && orchResult.lessonSummary) {
    const durationMin = meta.lessonStartedAt
      ? Math.round((Date.now() - meta.lessonStartedAt) / 60_000)
      : 0
    send(ws, {
      type: 'lesson_end',
      summary: {
        lessonId,
        phasesReached:   ['DIAGNOSTIC', 'EXERCISES', 'WRAP_UP'],
        exerciseScore:   orchResult.lessonSummary.exerciseScore,
        vocabularyCount: 0,
        durationMin,
      },
    })
    return
  }

  // Teacher Brain narrates engine decision — correction context already contains
  // off-topic recovery info so the off-topic guard is skipped
  if (orchResult.teacherInput) {
    await processInput(ws, meta, orchResult.teacherInput, false, true)
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

  if (meta.userId) {
    recordStudentMessage({ lessonId: meta.lessonId, sessionId: meta.sessionId, userId: meta.userId, studentId: meta.studentId, text: answer, source: 'ws' })
  }

  // Engine Authority Migration: route through engine when a manifest-backed lesson is active.
  // Legacy DB-validation path is kept for free-mode lessons and exercises not in the engine.
  try {
    const engineState = await exerciseEngine.getState(meta.lessonId)
    if (engineState && engineState.sectionId !== 'free' && engineState.currentExerciseState) {
      console.log(`[engine] routing exercise_answer through engine lessonId=${meta.lessonId} exerciseId=${exerciseId}`)
      await handleEngineExerciseAnswer(ws, meta, answer)
      return
    }
  } catch (err) {
    console.error('[engine] getState failed in handleExerciseAnswer (falling back to legacy):', err instanceof Error ? err.message : err)
  }

  // ── Legacy path: DB-stored exercise validation (free mode / non-manifest) ──

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
      console.log(`[paid-lesson] legacy_cursor_advanced exercise=#${cursor.exerciseNumber} item=${cursor.itemIndex}/${cursor.itemTotal}`)
    }

    const exerciseDone = cursor && cursor.itemIndex >= cursor.itemTotal
    const continuationContract = exerciseDone
      ? `\nEXERCISE TURN COMPLETION CONTRACT: After step 2, announce ` +
        `"Exercise ${cursor?.exerciseNumber ?? exercise.exerciseNumber} complete." ` +
        `Then introduce the next exercise immediately in the same response.`
      : cursor?.currentItem
      ? `\nEXERCISE TURN COMPLETION CONTRACT: After step 2, present item ` +
        `${cursor.itemIndex + 1}: "${cursor.currentItem}" in the same response. ` +
        `Do NOT stop after confirmation. Presenting the next item is mandatory.`
      : ''

    context = `[EXERCISE RESULT] Student answered: "${answer}" — CORRECT.
Your response MUST follow this structure in order:
1. ONE confirmation word only: "Exactly." / "Right." / "Correct."
2. WHY in one sentence: the rule or connection that makes this correct.${continuationContract}`
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
    context = buildCorrectionContext(answer, exercise.correct_answer, turn, exercise.type, exercise.question)
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
          const tid = meta.voiceTurnId
          if (tid && tid === meta.lastSubmittedVoiceTurnId) {
            console.log(`[voice] duplicate_turn_rejected turnId=${tid} trigger=mic_stop`)
          } else {
            meta.lastSubmittedVoiceTurnId = tid
            console.log(`[voice] student_turn_submit chars=${fullText.length} turnId=${tid} trigger=mic_stop`)
            send(ws, { type: 'student_message', text: fullText })
            if (meta.lessonId && meta.userId) {
              recordStudentMessage({ lessonId: meta.lessonId, sessionId: meta.sessionId, userId: meta.userId, studentId: meta.studentId, text: fullText, source: 'stt' })
            }
            processInput(ws, meta, fullText).catch((err: unknown) =>
              console.error('[paid-lesson] processInput error (stt-micstop):', err))
          }
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

    // ── Reconnect grace check ─────────────────────────────────────────────
    // If the same user/session is reconnecting within the 60-second grace
    // window after an abnormal disconnect, reattach to the existing lesson
    // state instead of starting fresh. No greeting, no lesson restart, no
    // AI call — just a state resync packet.
    const graceEntry   = wsSessionId ? gracePeriod.get(wsSessionId) : null
    const isReattach   = !!(graceEntry && graceEntry.userId === jwtUserId)
    if (isReattach) {
      clearTimeout(graceEntry!.timerRef)
      gracePeriod.delete(wsSessionId!)
      console.log(`[ws:reconnect] reattached lessonId=${graceEntry!.lessonId} session=${wsSessionId}`)
    }

    const heartbeatRef = setInterval(() => {
      try {
        if (ws.readyState === WebSocket.OPEN) ws.ping()
      } catch (err) {
        console.error('[ws] ping error (ignored):', (err instanceof Error ? err.message : err))
      }
    }, HEARTBEAT_INTERVAL_MS)

    let meta: ClientMeta
    if (isReattach) {
      // Restore old meta with fresh connection-specific fields
      const old = graceEntry!.meta
      meta = {
        ...old,
        connectionId:             uuid(),  // new connection ID on each new TCP socket
        heartbeatRef,
        timeoutRef:               setTimeout(() => ws.terminate(), INACTIVITY_TIMEOUT_MS),
        maxDurationRef:           null,   // re-armed below
        warningRef:               null,
        timerUpdateRef:           null,   // re-armed below
        stt:                      null,   // re-created below
        ttsController:            null,
        ttsActive:                false,
        aiProcessing:             false,
        queuedInput:              null,
        interruptPending:         false,
        pendingTranscript:        '',
        pendingMicStop:           false,
        pendingMicStopTimeoutRef: null,
        micActive:                false,
        stabilizationRef:         null,
        lastSeen:                 Date.now(),
      }
    } else {
      meta = {
        connectionId:    uuid(),
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
        warningRef:      null,
        timerUpdateRef:  null,
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
        voiceTurnId:              null,
        lastSubmittedVoiceTurnId: null,
        stabilizationRef:         null,
        billingStartedAt: null,
      }
    }

    clients.set(ws, meta)
    console.log(`[ws] client connected (user=${jwtUserId} session=${wsSessionId} reattach=${isReattach}), total=${clients.size}`)

    if (!isReattach) {
      // Before showing "Begin Lesson", check if this session has a recoverable
      // active lesson (handles grace-expired reconnects and code-1001 disconnects).
      // If a lesson is found, send lesson_resync instead of lesson_ready.
      let laterRecovered = false
      if (wsSessionId && jwtUserId) {
        try {
          laterRecovered = await tryLateRecover(ws, meta, wsSessionId, jwtUserId)
        } catch (err) {
          console.error('[ws:reconnect] tryLateRecover threw:', err instanceof Error ? err.message : err)
        }
      }
      if (!laterRecovered) {
        // No recoverable lesson — signal frontend to show "Begin Lesson"
        console.log(`[ws:ownership] owner_set session=${wsSessionId ?? 'none'} connectionId=${meta.connectionId}`)
        send(ws, { type: 'lesson_ready', sessionId: wsSessionId })
      }
    } else if (meta.lessonId) {
      // ── Grace-window reattach path ────────────────────────────────────
      console.log(`[ws:ownership] owner_set session=${wsSessionId} connectionId=${meta.connectionId}`)

      // Re-create STT for the new TCP connection
      meta.stt = createSTT(ws, meta)

      // Re-arm max-duration timeout with the remaining lesson time
      if (meta.lessonStartedAt) {
        const elapsedMs   = Date.now() - meta.lessonStartedAt
        const remainingMs = Math.max(0, MAX_LESSON_MS - elapsedMs)
        if (remainingMs > 60_000) {
          meta.maxDurationRef = setTimeout(() => {
            if (!meta.lessonId) return
            console.log(`[paid-lesson] lesson_timeout session=${meta.sessionId} lessonId=${meta.lessonId}`)
            send(ws, { type: 'error', code: 'SESSION_TIME_LIMIT', message: 'Maximum lesson duration reached.' })
            ws.close(4408, 'Time limit reached')
          }, remainingMs)
        }
      }

      // Re-start periodic timer broadcast
      startTimerBroadcast(ws, meta)

      // Record reconnect in transcript (one system event, no teacher message)
      if (meta.userId) {
        recordSystemEvent({
          lessonId:  meta.lessonId,
          sessionId: meta.sessionId,
          userId:    meta.userId,
          studentId: meta.studentId,
          message:   'websocket_resumed',
        })
      }

      // Send resync packet — no greeting, no AI call, no lesson restart
      sendLessonResync(ws, meta).catch((err: unknown) =>
        console.error('[ws:reconnect] sendLessonResync error:', err))
    }

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
            if (meta.lessonId && meta.userId) {
              recordStudentMessage({ lessonId: meta.lessonId, sessionId: meta.sessionId, userId: meta.userId, studentId: meta.studentId, text: msg.text, source: 'ws' })
            }
            await processInput(ws, meta, msg.text)
            break
          case 'mic_start': {
            // Duplicate mic_start while mic is already active — ignore to prevent
            // stale pipeline from opening a second STT stream.
            if (meta.micActive) {
              console.log('[ws:audio] duplicate_mic_start_ignored')
              break
            }
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
            meta.voiceTurnId       = uuid()  // new turn ID — resets dedup window
            meta.stt?.clearBuffer()
            console.log(`[voice] mic_start turnId=${meta.voiceTurnId} micActive=true`)
            break
          }
          case 'mic_stop': {
            // Stabilization window: keep micActive=true for 450ms after mic_stop so
            // late Deepgram is_final and UtteranceEnd events are still accepted.
            // This prevents "last words cut off" when audio is still in Deepgram pipeline.
            if (meta.pendingMicStopTimeoutRef) {
              clearTimeout(meta.pendingMicStopTimeoutRef)
              meta.pendingMicStopTimeoutRef = null
            }
            if (meta.stabilizationRef) {
              clearTimeout(meta.stabilizationRef)
            }
            meta.pendingMicStop = false  // onTranscript: accumulate path, not immediate-submit

            const STABILIZATION_MS = 450
            const captureTurnId = meta.voiceTurnId
            console.log(`[voice:turn] mic_stop turnId=${captureTurnId} stabilizing=${STABILIZATION_MS}ms`)

            meta.stabilizationRef = setTimeout(() => {
              void (async () => {
                meta.stabilizationRef = null
                meta.micActive        = false  // turn finalized — discard any further events

                // Merge Deepgram buffer (is_final segments not yet in pendingTranscript)
                const buffered = meta.stt?.flushBuffer() ?? ''
                if (buffered) {
                  meta.pendingTranscript = meta.pendingTranscript
                    ? meta.pendingTranscript + ' ' + buffered
                    : buffered
                }
                const raw = meta.pendingTranscript.trim()
                meta.pendingTranscript = ''
                meta.stt?.clearBuffer()

                if (!raw || !shouldProcessTranscript(raw)) {
                  console.log(`[voice:turn] no_transcript turnId=${captureTurnId}`)
                  if (meta.sessionId && meta.lessonId) {
                    ttsStream(ws, meta, "I didn't catch that. Try once more.").catch((err: unknown) =>
                      console.error('[voice] no_transcript_tts error:', err))
                  }
                  return
                }

                // Exercise-aware quality classification
                let exerciseType: string | undefined
                if (meta.lessonId) {
                  try {
                    const cursor = await exerciseEngine.getCursor(meta.lessonId)
                    exerciseType = cursor?.exerciseType
                  } catch { /* non-fatal — classifier falls back to permissive mode */ }
                }

                const classification = classifyVoiceTranscript(raw, exerciseType)
                if (!classification.usable) {
                  console.log(
                    `[voice:turn] rejected kind=${classification.kind} reason=${classification.reason} ` +
                    `preview="${raw.slice(0, 40)}" turnId=${captureTurnId}`,
                  )
                  if (meta.sessionId && meta.lessonId) {
                    ttsStream(ws, meta, "I didn't quite catch that. Could you say that again?").catch((err: unknown) =>
                      console.error('[voice] noise_reject_tts error:', err))
                  }
                  return
                }

                const finalText = classification.normalizedText
                if (classification.kind === 'repeat') {
                  console.log(`[voice:turn] deduped preview="${finalText.slice(0, 40)}" turnId=${captureTurnId}`)
                }

                // Dedup: prevent same turn from submitting twice (e.g., UtteranceEnd race)
                const tid = meta.voiceTurnId
                if (tid && tid === meta.lastSubmittedVoiceTurnId) {
                  console.log(`[voice:turn] duplicate_rejected turnId=${tid}`)
                  return
                }
                meta.lastSubmittedVoiceTurnId = tid

                console.log(
                  `[voice:turn] submitted chars=${finalText.length} ` +
                  `kind=${classification.kind} exerciseType=${exerciseType ?? 'unknown'} turnId=${tid}`,
                )
                send(ws, { type: 'student_message', text: finalText })
                if (meta.lessonId && meta.userId) {
                  recordStudentMessage({
                    lessonId: meta.lessonId, sessionId: meta.sessionId,
                    userId: meta.userId, studentId: meta.studentId,
                    text: finalText, source: 'stt',
                  })
                }
                processInput(ws, meta, finalText).catch((err: unknown) =>
                  console.error('[paid-lesson] processInput error (stabilized-mic-stop):', err))
              })()
            }, STABILIZATION_MS)
            break
          }
          case 'audio_chunk':
            if (!meta.stt) {
              console.log('[paid-lesson] ignored_audio_chunk reason=before_begin')
              return
            }
            if (!meta.micActive) {
              console.log('[ws:audio] stale_chunk_ignored')
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
        traceRuntimeError(meta.lessonId ?? 'unknown', {
          errorName:    err instanceof Error ? err.name    : 'Error',
          errorMessage: err instanceof Error ? err.message : String(err),
          stackPreview: err instanceof Error ? (err.stack?.slice(0, 300) ?? null) : null,
          lessonId:     meta.lessonId,
          sessionId:    meta.sessionId,
        })
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
      if (meta.stabilizationRef)        clearTimeout(meta.stabilizationRef)
      meta.ttsController?.abort()
      meta.stt?.close()
      meta.stt = null
      clients.delete(ws)
      console.log(
        `[ws] client disconnected code=${code} reason="${reason.toString() || '(none)'}" ` +
        `session=${meta.sessionId ?? 'none'} lessonId=${meta.lessonId ?? 'none'} total=${clients.size}`,
      )

      // Observability: end lesson trace for lessons that ended via disconnect
      if (meta.lessonId) {
        const discDurationMin = meta.lessonStartedAt
          ? Math.round((Date.now() - meta.lessonStartedAt) / 60_000)
          : 0
        endLessonTrace(meta.lessonId, { durationMin: discDurationMin, endReason: 'disconnected' })
        if (meta.userId) {
          recordSystemEvent({ lessonId: meta.lessonId, sessionId: meta.sessionId, userId: meta.userId, studentId: meta.studentId, message: `websocket_disconnected code=${code}`, metadata: { wsCode: code, reason: reason.toString().slice(0, 100) || null } })
        }
        console.log(`[ws:reconnect] disconnected session=${meta.sessionId ?? 'none'} code=${code}`)
      }

      // Phase 6: persist snapshot to PostgreSQL before billing finalize.
      // This allows resume beyond the 4-hour Redis TTL.
      if (meta.lessonId && meta.studentId) {
        void saveLessonSnapshot(meta.lessonId, meta.sessionId, meta.studentId)
      }

      // ── Grace window: hold billing for 60 s on abnormal disconnect ───────────
      // Code 1006 = abnormal closure (network drop, proxy timeout, browser killed).
      // Code 0 = occurs on some platforms when TCP resets before WS handshake.
      // We keep meta alive in gracePeriod so the same user/session can reattach
      // cleanly without a teacher greeting or lesson restart.
      // Normal/intentional closes (1000, 4xxx) finalize billing immediately.

      // code 1001 = "going away" (browser navigating / tab close) — treated as
      // abnormal for reconnect purposes since mobile browsers emit this on network drops.
      const isAbnormalWithLesson = (code === 1006 || code === 1001 || code === 0) &&
        !!meta.lessonId && !!meta.sessionId && !!meta.userId &&
        !!meta.usageId && !!meta.billingStartedAt

      if (isAbnormalWithLesson) {
        const graceKey = meta.sessionId!
        // Evict any stale grace entry for this session before replacing
        const stale = gracePeriod.get(graceKey)
        if (stale) {
          clearTimeout(stale.timerRef)
          gracePeriod.delete(graceKey)
        }
        console.log(`[ws:reconnect] grace_started lessonId=${meta.lessonId} ttlMs=${RECONNECT_GRACE_MS}`)
        const timerRef = setTimeout(() => {
          gracePeriod.delete(graceKey)
          console.log(`[ws:reconnect] grace_expired lessonId=${meta.lessonId ?? 'none'} session=${graceKey}`)
          // Grace expired without reconnect — finalize billing now
          if (meta.usageId && meta.userId && meta.billingStartedAt) {
            finalizeUsage(meta.usageId, meta.userId, meta.billingStartedAt).catch((err: unknown) => {
              console.error('[ws] finalizeUsage error (grace expiry):', err)
            })
          }
        }, RECONNECT_GRACE_MS)
        gracePeriod.set(graceKey, {
          meta,
          lessonId:  meta.lessonId!,
          sessionId: meta.sessionId!,
          userId:    meta.userId!,
          timerRef,
        })
      } else {
        // Cost instrumentation + finalize paid lesson usage immediately
        if (meta.usageId && meta.userId && meta.billingStartedAt) {
          const elapsedMs       = Date.now() - meta.billingStartedAt
          const elapsedMin      = Math.round(elapsedMs / 60_000)
          const ttsProvider     = process.env.ELEVENLABS_API_KEY ? 'elevenlabs' : 'openai'
          const aiModel         = 'claude-sonnet-4-6'
          const sttProvider     = 'deepgram'
          const aiCostUsd       = meta.aiCallCount * 0.003
          const ttsCostUsd      = ttsProvider === 'openai'
            ? (meta.ttsCharCount / 1000) * 0.015
            : (meta.ttsCharCount / 1000) * 0.15
          const sttCostUsd      = elapsedMin * 0.006
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
