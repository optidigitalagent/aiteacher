import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import type { FeedbackState, TeachingCardData } from '../types'
import type { LessonSessionMetadata } from '../../../types/lessonTypes'
import { useLessonSession }  from '../hooks/useLessonSession'
import { useClassroomChat }  from '../hooks/useClassroomChat'
import { useVoiceSession }   from '../hooks/useVoiceSession'
import { useDemoSession }    from '../hooks/useDemoSession'
import ClassroomHeader       from './ClassroomHeader'
import TeacherPanel          from './TeacherPanel'
import ExercisePanel         from './ExercisePanel'
import PaidExerciseCard      from './PaidExerciseCard'
import SectionProgressPanel  from './SectionProgressPanel'
import ChatPanel             from './ChatPanel'
import BottomControls        from './BottomControls'
import TeachingOverlay       from './TeachingOverlay'
import DemoStepCenter        from './DemoStepCenter'
import DemoResultOverlay     from './DemoResultOverlay'
import ExerciseAnchorBanner  from './ExerciseAnchorBanner'
import {
  createClassroomSocket,
  sendMessage,
  type BackendMessage,
  type TipRecord,
} from '../services/classroomSocket'
import TipsDrawer from './TipsDrawer'
import { useAuth, getStoredToken }      from '../../../context/AuthContext'
import { warmAudioContext, getScheduledAudioEndMs, primeAudioContext, requestMicPreflight } from '../services/voiceApi'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

const LESSON_UNIT = Number(import.meta.env.VITE_LESSON_UNIT ?? 1)
const ENV_SECTION = import.meta.env.VITE_LESSON_SECTION as string | undefined

export type ClassroomMode = 'demo' | 'paid'

export default function ClassroomLayout({ mode }: { mode: ClassroomMode }) {
  const { demoId, sessionId: paidSessionId } = useParams<{ sessionId?: string; demoId?: string }>()
  const location    = useLocation()
  const navigate    = useNavigate()
  const { isAuthenticated, isAuthLoading } = useAuth()
  const sessionMeta = (location.state as LessonSessionMetadata | null) ?? null

  const isDemoMode    = mode === 'demo'
  // section priority: navigation state > ?section= URL param > VITE_LESSON_SECTION env
  const urlSection      = new URLSearchParams(location.search).get('section') ?? undefined
  const resolvedSection = sessionMeta?.sectionNumber ?? urlSection ?? ENV_SECTION

  const wsRef = useRef<WebSocket | null>(null)
  const send = useCallback((payload: object) => {
    sendMessage(wsRef.current, payload)
  }, [])
  const [wsConnectError,  setWsConnectError]  = useState<string | null>(null)
  const [wsDisconnected,  setWsDisconnected]  = useState(false)
  const [lessonTakenOver, setLessonTakenOver] = useState(false)
  const [readyClicked,    setReadyClicked]    = useState(false)
  const lessonStartedRef = useRef(false)
  // Synchronous reconnect flag — readable inside WS message callbacks without stale closure.
  // Set true on WS open after a lesson was active; cleared on lesson_resync / lesson_resumed.
  const reconnectingRef      = useRef(false)
  const recoveryTimeoutRef   = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Production hooks (always called — rules of hooks) ────────────────────
  const {
    question, exerciseCursor, progress, steps,
    submitAnswer, onExercise, onPhaseChange, onCursorUpdated,
    currentPhase, setPhase,
    isRecovering, setIsRecovering, onStateSnapshot, onLessonResync,
  } = useLessonSession({ send, sessionId: paidSessionId ?? undefined })

  const {
    messages, pushUser, pushAI, setTyping, clearTyping, restoreMessages,
  } = useClassroomChat({ send })

  const {
    isListening, isSpeaking, transcript, isPartialTranscript, toggle, stopRecording,
    onAudioChunk, onTranscript, setSpeaking, onTeacherTurnEnd,
  } = useVoiceSession({ send })

  // ── Demo voice — Web Speech API (no WebSocket needed) ────────────────────
  type SpeechAlt = { transcript: string }
  type SpeechResult = ArrayLike<SpeechAlt> & { isFinal: boolean }
  type WebSpeechRec = {
    continuous: boolean; interimResults: boolean; lang: string
    onresult: ((e: { results: ArrayLike<SpeechResult> }) => void) | null
    onend: (() => void) | null
    onerror: (() => void) | null
    start(): void; stop(): void
  }
  const [demoListening,     setDemoListening]     = useState(false)
  const demoSpeechRef          = useRef<WebSpeechRec | null>(null)
  const demoTranscriptRef      = useRef('')
  const demoMicTimerRef        = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Tracks demo.isStaticAudioPlaying via ref so toggleDemoMic can read it without stale closure
  const demoStaticPlayingRef   = useRef(false)
  // Tracks demo.phase via ref so toggleDemoMic / handleSubmit can read it without stale closure
  const demoPhaseRef           = useRef<string>('loading')

  // Stable ref to demo.handleTextSubmit — populated after demo is declared below
  const demoSubmitRef = useRef<(t: string) => void>(() => {})
  // Stable ref to demo.interruptAudio — populated after demo is declared below
  const demoInterruptRef = useRef<() => void>(() => {})

  const toggleDemoMic = useCallback(() => {
    const ph = demoPhaseRef.current
    // Block recording before lesson starts or after it completes
    if (ph === 'loading' || ph === 'ready' || ph === 'intro' || ph === 'complete') return
    if (demoListening) {
      console.log('[demo-mic] clicked reason=stop_recording phase=' + ph)
      if (demoMicTimerRef.current) { clearTimeout(demoMicTimerRef.current); demoMicTimerRef.current = null }
      demoSpeechRef.current?.stop()
      return
    }
    const wasStaticPlaying = demoStaticPlayingRef.current
    console.log(`[demo-mic] clicked reason=start_recording phase=${ph} wasStaticPlaying=${wasStaticPlaying}`)
    // interruptAudio increments the generation counter — cancels any running playMessages loop
    // so it won't advance to the next message after the mic starts recording.
    demoInterruptRef.current()
    console.log(`[demo-mic] accepted stoppedAudio=${wasStaticPlaying}`)
    const w = window as unknown as Record<string, unknown>
    const SpeechRecCtor = (w['SpeechRecognition'] ?? w['webkitSpeechRecognition']) as
      (new () => WebSpeechRec) | undefined
    if (!SpeechRecCtor) {
      console.warn('[demo voice] SpeechRecognition not supported')
      return
    }
    demoTranscriptRef.current = ''
    const rec = new SpeechRecCtor()
    rec.continuous     = true
    rec.interimResults = true
    // Phase 7.6: English-first STT — default to en-US regardless of device locale.
    // RU/UA typed clarifications still reach multilingual rescue via the backend.
    // Phonetic Cyrillic renderings of English (from non-en-US STT) are normalised
    // by backend/src/demo/phonetic-normalizer before routing.
    rec.lang           = 'en-US'
    console.log(`[demo_stt_lang_selected] provider=WebSpeechAPI lang=en-US strategy=english_first device_locale=${navigator.language}`)
    rec.onresult = (e) => {
      let collected = ''
      for (let i = 0; i < e.results.length; i++) {
        collected += (e.results[i]![0] as SpeechAlt).transcript
      }
      demoTranscriptRef.current = collected
      setAnswer(collected)
    }
    rec.onend = () => {
      setDemoListening(false)
      demoSpeechRef.current = null
      if (demoMicTimerRef.current) { clearTimeout(demoMicTimerRef.current); demoMicTimerRef.current = null }
      const finalText = demoTranscriptRef.current.trim()
      if (finalText) {
        // Brief pause so state settles, then auto-submit
        setTimeout(() => { demoSubmitRef.current(finalText) }, 250)
      }
    }
    rec.onerror = () => {
      setDemoListening(false)
      demoSpeechRef.current = null
      if (demoMicTimerRef.current) { clearTimeout(demoMicTimerRef.current); demoMicTimerRef.current = null }
    }
    try {
      rec.start()
      setDemoListening(true)
      demoSpeechRef.current = rec
      // Auto-stop after 60 seconds
      demoMicTimerRef.current = setTimeout(() => { rec.stop() }, 60000)
    } catch {
      console.warn('[demo voice] start failed')
    }
  }, [demoListening])

  // ── Demo session hook (always called, enabled only in demo mode) ──────────
  const storedToken  = getStoredToken()
  const demoEnabled  = isDemoMode && !isAuthLoading && isAuthenticated
  const onDemoNotFound = useCallback(() => navigate('/'), [navigate])

  const demo = useDemoSession({
    demoId:     demoId ?? '',
    token:      storedToken ?? '',
    enabled:    demoEnabled,
    onNotFound: onDemoNotFound,
  })

  // Wire demoSubmitRef now that demo is available
  useEffect(() => {
    demoSubmitRef.current = (text: string) => {
      if (!text.trim()) return
      setAnswer('')
      demo.handleTextSubmit(text)
    }
  }, [demo.handleTextSubmit])

  // Keep refs in sync during render (direct assignment, not useEffect) so that by the time
  // the browser paints and the user can interact, the refs already reflect the current phase.
  // The useEffect pattern has a one-render lag: lessonStarted could flip to true (enabling
  // input) before demoPhaseRef.current is updated, causing handleSubmit to silently block.
  demoPhaseRef.current         = demo.phase
  demoStaticPlayingRef.current = demo.isStaticAudioPlaying
  demoInterruptRef.current     = demo.interruptAudio

  // ── Local UI state ────────────────────────────────────────────────────────
  const [answer,               setAnswer]               = useState('')
  const [feedback,             setFeedback]             = useState<FeedbackState>(null)
  const [feedbackExplanation,  setFeedbackExplanation]  = useState<string | null>(null)
  const [showHint,             setShowHint]             = useState(false)
  const [chatOpen,        setChatOpen]        = useState(() =>
    typeof window !== 'undefined' && window.innerWidth >= 900
  )
  // Mobile-only (≤600px) chat overlay state
  const [mobChatOpen,     setMobChatOpen]     = useState(false)
  const [teachingCard,    setTeachingCard]    = useState<TeachingCardData | null>(null)
  const [confirmedAnswer, setConfirmedAnswer] = useState('')
  const [lessonStarted,   setLessonStarted]   = useState(false)
  const [paidLessonReady, setPaidLessonReady] = useState(false)
  const beginSentRef = useRef(false)
  // Phase 7.9: prevents double-click during async mic preflight on demo Begin Lesson
  const demoBeginSentRef = useRef(false)
  // Set true when user sends interrupt so the next ai_text doesn't close the mic
  const interruptSentRef = useRef(false)
  // Demo help input
  const [showHelpInput,   setShowHelpInput]   = useState(false)
  const [helpInputValue,  setHelpInputValue]  = useState('')
  // Phase 7.9: mic preflight denied banner (demo mode)
  const [micPermissionDenied, setMicPermissionDenied] = useState(false)
  // Two-stage lesson end: first show modal inside classroom, then full results on click
  const [showFullResults, setShowFullResults] = useState(false)
  // Paid lesson end
  type PaidLessonSummary = {
    lessonId: string; durationMin: number; phasesReached: string[]
    exerciseScore: number; vocabularyCount: number
  }
  const [paidLessonEnded,    setPaidLessonEnded]    = useState(false)
  const [paidLessonSummary,  setPaidLessonSummary]  = useState<PaidLessonSummary | null>(null)
  // Phase 6: 5-minute pre-timeout warning — number of minutes remaining, null = no warning
  const [lessonTimeWarning, setLessonTimeWarning] = useState<number | null>(null)
  // Phase 2 recovery: remaining lesson minutes from backend periodic broadcast
  const [lessonRemainingMin, setLessonRemainingMin] = useState<number | null>(null)
  // Paid lesson exit guard
  const [showPaidLeaveModal, setShowPaidLeaveModal] = useState(false)
  // Phase 5: tips drawer
  const [tips,     setTips]     = useState<TipRecord[]>([])
  const [showTips, setShowTips] = useState(false)
  // Stale answer rejection message (STALE_EXERCISE_ANSWER engine error)
  const [staleAnswerMsg, setStaleAnswerMsg] = useState<string | null>(null)

  const answerRef = useRef('')
  useEffect(() => { answerRef.current = answer }, [answer])
  // Tracks the last transcript value seen in onMessageRef so the 'transcript'
  // handler can compare against it to avoid overwriting manually typed text.
  const lastTranscriptRef = useRef('')
  // Set true when mic_stop is sent; reset false when student_message echoes back.
  // Prevents late Deepgram UtteranceEnd events from repopulating the answer field
  // with the just-sent transcript after the student's turn is already being processed.
  const awaitingStudentMessageRef = useRef(false)

  // ── WS message handler ────────────────────────────────────────────────────
  const onMessageRef = useRef<(msg: BackendMessage) => void>(() => {})
  onMessageRef.current = (msg: BackendMessage) => {
    switch (msg.type) {
      case 'ai_text':
        if (!lessonStarted) { setLessonStarted(true); lessonStartedRef.current = true }
        clearTyping()
        if (import.meta.env.DEV) console.log('[cursor] teacher message received (speech only, not parsed for state)')
        pushAI(msg.text)
        // Always mark the teacher as speaking so TTS audio is never silently discarded.
        // When the student intentionally interrupted (interruptSentRef=true), keep the
        // mic open — stopRecording() would close it mid-recording. The mic will close
        // naturally on the NEXT ai_text once the student's recorded answer is processed.
        setSpeaking(true)
        if (interruptSentRef.current) {
          interruptSentRef.current = false
          // mic stays open — student is mid-recording after their interrupt
        } else {
          stopRecording()  // prevent echo when teacher speaks
        }
        break
      case 'audio_chunk':
        if (!interruptSentRef.current) {
          onAudioChunk(msg.data)
        }
        break
      case 'exercise':
        onExercise(msg.exercise)
        setTeachingCard(null)
        break
      case 'phase_change':
        onPhaseChange(msg.from, msg.to)
        break
      case 'feedback':
        setFeedback(msg.correct ? 'correct' : 'wrong')
        setFeedbackExplanation(msg.explanation || null)
        if (msg.correct) {
          setConfirmedAnswer(answerRef.current)
          setTimeout(() => setAnswer(''), 1800)
        }
        break
      case 'transcript': {
        // Guard: if we already sent mic_stop and are waiting for student_message echo,
        // discard any late UtteranceEnd transcripts — the turn is already in flight.
        if (awaitingStudentMessageRef.current) break
        // Mirror Deepgram transcript directly into the answer field.
        // Guard: don't overwrite text the student typed manually (i.e. answer
        // is non-empty AND differs from the previous transcript value).
        const prevT = lastTranscriptRef.current
        lastTranscriptRef.current = msg.text
        onTranscript(msg.text)
        setAnswer(prev => (!prev || prev === prevT) ? msg.text : prev)
        break
      }
      case 'teaching_card':
        setTeachingCard({ title: 'Explanation', body: msg.displayText })
        break
      case 'section_card':
        break
      case 'student_message':
        awaitingStudentMessageRef.current = false  // turn is now processing — unblock transcript handler
        lastTranscriptRef.current = ''
        pushUser(msg.text)
        setAnswer('')       // clear stale STT transcript from input field
        onTranscript('')    // clear transcript state
        setTyping()         // show AI processing indicator (mirrors demo behavior)
        break
      case 'teacher_turn_end':
        if (!isDemoMode) onTeacherTurnEnd()
        break
      case 'lesson_ready':
        // Backend confirmed auth + session validation — safe to show Begin Lesson.
        // GUARD: ignore during reconnect recovery — backend should send lesson_resync instead.
        // Stale lesson_ready can arrive when grace period is missed; we must not clear UI.
        if (!isDemoMode) {
          if (reconnectingRef.current) {
            console.log('[ws:reconnect] lesson_ready_ignored_during_recovery')
            break
          }
          setPaidLessonReady(true)
          setWsConnectError(null)   // clear any stale error from a previous connect attempt
          setWsDisconnected(false)
          // Grace period expired — allow Begin Lesson button to fire again
          if (lessonStartedRef.current) {
            beginSentRef.current = false
          }
        }
        break
      case 'lesson_resync': {
        // Grace-window reattach or late-recovery resync:
        // backend-authoritative state. No greeting, no AI call, no lesson restart.
        // Restore exercise cursor and phase; unblock mic if student's turn is allowed.
        if (!isDemoMode) {
          // Clear reconnect flag synchronously so subsequent lesson_ready (if any) is processed
          reconnectingRef.current = false
          if (recoveryTimeoutRef.current) {
            clearTimeout(recoveryTimeoutRef.current)
            recoveryTimeoutRef.current = null
          }
          setWsDisconnected(false)
          if (!lessonStarted) { setLessonStarted(true); lessonStartedRef.current = true }
          onLessonResync({
            phase:            msg.phase,
            visiblePayload:   msg.visiblePayload,
            exerciseNumber:   msg.exerciseNumber,
            currentItemIndex: msg.currentItemIndex,
          })
          if (msg.recentTranscript && msg.recentTranscript.length > 0) {
            restoreMessages(msg.recentTranscript)
          }
          console.log('[ws:reconnect] resync_received', {
            lessonId:         msg.lessonId,
            exercise:         msg.exerciseNumber,
            item:             msg.currentItemIndex,
            phase:            msg.phase,
            micAllowed:       msg.studentTurnAllowed,
            transcriptCount:  msg.recentTranscript?.length ?? 0,
          })
        }
        break
      }
      case 'lesson_resumed':
        reconnectingRef.current = false  // clear sync reconnect flag
        if (recoveryTimeoutRef.current) {
          clearTimeout(recoveryTimeoutRef.current)
          recoveryTimeoutRef.current = null
        }
        if (!lessonStarted) { setLessonStarted(true); lessonStartedRef.current = true }
        setPhase(msg.phase)  // restore phase awareness on resume
        setIsRecovering(false)  // resume confirms backend state is live
        pushAI(msg.message)
        setSpeaking(true)
        stopRecording()  // ensure mic is off during resume greeting TTS
        if (import.meta.env.DEV) console.log('[cursor] lesson_resumed clears recovering state')
        break
      case 'exercise_cursor_updated':
        onCursorUpdated(msg.cursor)
        break
      case 'lesson_state_snapshot':
        // Engine-authoritative reconnect snapshot — replace any stale local state
        onStateSnapshot(msg.cursor, msg.phase)
        if (!lessonStarted) { setLessonStarted(true); lessonStartedRef.current = true }
        if (import.meta.env.DEV) {
          console.log('[cursor] reconnect snapshot received from backend', msg)
        }
        break
      case 'validation_result':
        // Engine-level validation result (complement to 'feedback' for deterministic exercises)
        setFeedback(msg.correct ? 'correct' : 'wrong')
        setFeedbackExplanation(msg.explanation || null)
        if (msg.correct) {
          setConfirmedAnswer(answerRef.current)
          setTimeout(() => setAnswer(''), 1800)
        }
        if (import.meta.env.DEV) {
          console.log('[cursor] validation result received', { correct: msg.correct, exerciseId: msg.exerciseId })
        }
        break
      case 'runtime_error':
        // Engine-level errors — distinct from auth/billing errors
        console.error('[Classroom runtime_error]', msg.code, msg.message)
        if (msg.code === 'INVALID_ENGINE_STATE' || msg.code === 'INVALID_SESSION') {
          // Unrecoverable engine state — return student to lesson selection
          navigate('/learning', { replace: true })
        } else if (msg.code === 'STALE_EXERCISE_ANSWER') {
          // Student answered a stale exercise — keep current cursor, show brief message
          setStaleAnswerMsg('Your answer was for a previous exercise. Please answer the current item.')
          setTimeout(() => setStaleAnswerMsg(null), 4000)
          if (import.meta.env.DEV) {
            console.log('[cursor] stale answer rejected by engine')
          }
        }
        break
      case 'tip_list':
        setTips(msg.tips)
        break
      case 'tip_added':
        setTips(prev => {
          const exists = prev.some(t => t.id === msg.tip.id)
          return exists ? prev : [msg.tip, ...prev]
        })
        break
      case 'lesson_end':
        if (!isDemoMode) {
          setPaidLessonSummary({
            lessonId:       msg.summary.lessonId,
            durationMin:    msg.summary.durationMin,
            phasesReached:  msg.summary.phasesReached,
            exerciseScore:  msg.summary.exerciseScore,   // Phase 6: real value
            vocabularyCount: msg.summary.vocabularyCount, // Phase 6: real value
          })
          setPaidLessonEnded(true)
        }
        break
      case 'lesson_time_warning':
        // Phase 6: 5-minute warning before lesson hard cap
        if (!isDemoMode) setLessonTimeWarning(Math.floor(msg.remainingMs / 60_000))
        break
      case 'lesson_timer_update':
        // Phase 2 recovery: periodic remaining-time update from backend (every 60s)
        // Guard: stop updating after lesson ends to avoid stale timer state
        if (!isDemoMode && !paidLessonEnded) setLessonRemainingMin(Math.ceil(msg.remainingMs / 60_000))
        break
      case 'error':
        console.error('[Classroom WS] error:', msg.code, msg.message)
        if (msg.code === 'LESSON_TAKEN_OVER') {
          setLessonTakenOver(true)
        } else if (msg.code === 'INVALID_ENGINE_STATE' || msg.code === 'INVALID_SESSION') {
          // Unrecoverable session errors — navigate away safely
          navigate('/learning', { replace: true })
        } else if (msg.code === 'STALE_EXERCISE_ANSWER') {
          setStaleAnswerMsg('Your answer was for a previous exercise. Please answer the current item.')
          setTimeout(() => setStaleAnswerMsg(null), 4000)
        } else if (['PAYMENT_REQUIRED', 'SUBSCRIPTION_EXPIRED', 'LESSON_LIMIT_REACHED', 'AUTH_REQUIRED', 'SESSION_TIME_LIMIT', 'RATE_LIMITED', 'UNAUTHENTICATED'].includes(msg.code)) {
          setWsConnectError(msg.message)
        }
        break
      default: {
        const u = (msg as { type: string }).type
        console.warn('[Classroom UNKNOWN]', u, msg)
        break
      }
    }
  }

  // ── Connect WS once auth is confirmed (skipped in demo mode) ─────────────
  useEffect(() => {
    console.log('[classroom:ws-effect] fired', {
      isAuthLoading,
      isAuthenticated,
      isDemoMode,
      paidSessionId,
      storedToken: !!getStoredToken(),
    })
    if (isAuthLoading) {
      console.log('[classroom:ws-effect] waiting for auth')
      return
    }
    if (!isAuthenticated) {
      console.warn('[classroom:ws-effect] NOT authenticated → redirecting to /learning')
      navigate('/learning', { replace: true })
      return
    }
    if (isDemoMode) {
      console.log('[classroom:ws-effect] demo mode — no WS needed')
      return
    }

    let activeWs: WebSocket | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let attemptCount = 0
    const MAX_RECONNECT_ATTEMPTS = 5

    const connect = () => {
      const token = getStoredToken()
      console.log('[classroom:ws-effect] connect() called', { hasToken: !!token, paidSessionId })
      const ws = createClassroomSocket(
        (msg) => onMessageRef.current(msg),
        () => {
          // WS open: reset attempt counter on successful connection
          attemptCount = 0
          setWsDisconnected(false)
          console.log('[paid-lesson] ws_open session=' + paidSessionId + ' attempt=' + attemptCount)
          // If lesson had started before disconnect, enter recovering state until
          // backend sends lesson_resync, lesson_state_snapshot, or lesson_resumed.
          // reconnectingRef is a sync ref so the lesson_ready guard reads the correct value
          // even before the React state update (setIsRecovering) is flushed.
          if (lessonStartedRef.current) {
            reconnectingRef.current = true
            setIsRecovering(true)
            console.log('[cursor] reconnecting — waiting for backend resync')
            // Safety timeout: force-clear recovery state if no resync arrives within 10s
            if (recoveryTimeoutRef.current) clearTimeout(recoveryTimeoutRef.current)
            recoveryTimeoutRef.current = setTimeout(() => {
              recoveryTimeoutRef.current = null
              if (reconnectingRef.current) {
                reconnectingRef.current = false
                setIsRecovering(false)
                console.log('[ws:reconnect] recovery_timeout_cleared — no resync received')
              }
            }, 10_000)
          }
        },
        (code) => {
          // Always stop mic on disconnect to avoid stuck recording state
          stopRecording()

          setWsDisconnected(true)
          console.log(`[ws:reconnect] disconnected code=${code}`)

          if (!lessonStartedRef.current) {
            // Lesson had not started — show connection error, do not reconnect
            setWsConnectError('Could not connect to your teacher. Please check your connection and try again.')
            return
          }

          // Abnormal close (1006 = network drop) with an active lesson:
          // attempt auto-reconnect within the backend grace window (60 s)
          const isAbnormal = code === 1006 || code === 1001 || code === 0
          if (isAbnormal && attemptCount < MAX_RECONNECT_ATTEMPTS) {
            attemptCount++
            // Exponential back-off: 1s, 1.5s, 2.25s, 3.4s, 5s — all within 60s grace window
            const delay = Math.min(1000 * Math.pow(1.5, attemptCount - 1), 10_000)
            console.log(`[ws:reconnect] reconnecting attempt=${attemptCount} delayMs=${Math.round(delay)}`)
            reconnectTimer = setTimeout(connect, delay)
          } else if (attemptCount >= MAX_RECONNECT_ATTEMPTS) {
            console.log('[ws:reconnect] max_attempts_reached — manual reload required')
          }
          // Intentional/auth closes (1000, 4xxx) — do not reconnect
        },
        token ?? undefined,
        paidSessionId ?? undefined,
      )
      activeWs = ws
      wsRef.current = ws
    }

    connect()

    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer)
      if (recoveryTimeoutRef.current) {
        clearTimeout(recoveryTimeoutRef.current)
        recoveryTimeoutRef.current = null
      }
      reconnectingRef.current = false
      activeWs?.close()
      wsRef.current = null
    }
  }, [isAuthLoading, isAuthenticated, isDemoMode]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Side effects ──────────────────────────────────────────────────────────
  // Transcript → answer mirroring is now handled directly in the WS 'transcript'
  // case handler (onMessageRef) to avoid the isListening timing bug where the
  // final Deepgram transcript arrives after isListening becomes false.

  useEffect(() => {
    setAnswer('')
    setFeedback(null)
    setFeedbackExplanation(null)
    setShowHint(false)
    setConfirmedAnswer('')
  }, [question?.id])

  // Clear feedback and answer when the phase changes so stale feedback banners
  // don't persist after the EXERCISES phase ends with no new exercise arriving.
  useEffect(() => {
    setFeedback(null)
    setFeedbackExplanation(null)
    setAnswer('')
  }, [currentPhase])

  // ── Event handlers ────────────────────────────────────────────────────────
  // Used by ExercisePanel's "Check" button — requires legacy question state
  const handleCheck = useCallback(() => {
    if (!answer.trim() || !question) return
    if (awaitingStudentMessageRef.current) return  // mic turn already in flight — don't double-fire
    pushUser(answer)
    setTyping()
    submitAnswer(answer)
  }, [answer, question, pushUser, setTyping, submitAnswer])

  // Used by cursor-based paid exercises (PaidExerciseCard via BottomControls)
  // Works when only exerciseCursor is set — does NOT require legacy question state
  const handleCursorSubmit = useCallback(() => {
    if (!answer.trim()) return
    if (awaitingStudentMessageRef.current) return
    if (isRecovering) {
      if (import.meta.env.DEV) console.log('[cursor] submit blocked: recovering from reconnect')
      return
    }
    if (exerciseCursor?.completionState === 'complete') {
      if (import.meta.env.DEV) console.log('[cursor] submit blocked: exercise already complete')
      return
    }
    pushUser(answer)
    setTyping()
    submitAnswer(answer)
  }, [answer, isRecovering, exerciseCursor, pushUser, setTyping, submitAnswer])

  const handleSubmit = useCallback(() => {
    if (isDemoMode) {
      if (!answer.trim()) {
        console.log('[demo-submit] blocked reason=empty_answer')
        return
      }
      const ph = demoPhaseRef.current
      if (ph === 'loading' || ph === 'ready' || ph === 'intro') {
        console.log(`[demo-submit] blocked reason=phase_${ph}`)
        return
      }
      // User submitting interrupts any playing audio and cancels any running playMessages loop
      demo.interruptAudio()
      console.log('[demo-submit] accepted')
      const a = answer
      setAnswer('')
      demo.handleTextSubmit(a)
      return
    }
    if (!answer.trim()) return
    if (question) {
      // Legacy path: BackendExercise loaded (old exercise event)
      handleCheck()
    } else if (exerciseCursor) {
      // Engine cursor path: backend engine owns the exercise, no legacy question needed
      handleCursorSubmit()
    } else {
      // Free dialogue / speaking phase
      if (awaitingStudentMessageRef.current) return  // guard: mic turn already in flight
      pushUser(answer)
      setTyping()
      send({ type: 'text_message', text: answer })
      setAnswer('')
    }
  }, [isDemoMode, answer, demo.handleTextSubmit, demo.interruptAudio, question, exerciseCursor, handleCheck, handleCursorSubmit, pushUser, setTyping, send])

  // Begin Lesson: send focus_lesson_start only when user clicks the button
  const handleBeginLesson = useCallback(() => {
    if (beginSentRef.current) return  // prevent double-click
    beginSentRef.current = true
    // Warm audio context during user gesture so TTS chunks don't hit a suspended context
    warmAudioContext()
    console.log('[paid-lesson] begin clicked session=' + paidSessionId)
    sendMessage(wsRef.current, {
      type:    'focus_lesson_start',
      payload: {
        unit: LESSON_UNIT,
        ...(resolvedSection        ? { section:   resolvedSection }       : {}),
        ...(sessionMeta?.teacherId ? { teacherId: sessionMeta.teacherId } : {}),
        ...(sessionMeta?.voiceId   ? { voiceId:   sessionMeta.voiceId }   : {}),
      },
    })
  }, [paidSessionId, resolvedSection, sessionMeta])

  // Guarded mic toggle for paid mode.
  // Click 1 — starts recording, streams PCM to backend STT (live transcript shows in input).
  // Click 2 — stops recording, sends mic_stop so backend finalizes and processes the transcript.
  // When teacher is speaking: sends interrupt first, then opens mic.
  const paidToggle = useCallback(async () => {
    if (!lessonStarted) {
      console.log('[paid-lesson] mic_enabled=false reason=lesson_not_started')
      return
    }
    warmAudioContext()
    const wasListening = isListening
    // Block new recording while the previous turn's student_message echo hasn't arrived.
    // Without this guard the student can double-send by stopping and immediately restarting.
    if (!wasListening && awaitingStudentMessageRef.current) {
      console.log('[paid-lesson] mic_start blocked: previous turn still processing')
      return
    }
    // Only send interrupt when TTS audio is actively playing (>500ms left).
    // If the audio is just draining its final frames (≤500ms remaining), treat
    // this as a normal mic-start — sending interrupt here would set interruptSentRef,
    // which previously caused the teacher's next response TTS to be silently discarded.
    const audioRemaining = getScheduledAudioEndMs()
    if (isSpeaking && !isListening && audioRemaining > 500) {
      console.log(`[paid-lesson] mic_interrupt reason=student_wants_to_speak audioRemainingMs=${Math.round(audioRemaining)}`)
      send({ type: 'interrupt' })
      interruptSentRef.current = true
    } else if (isSpeaking && !isListening) {
      console.log(`[paid-lesson] mic_start_no_interrupt reason=audio_draining audioRemainingMs=${Math.round(audioRemaining)}`)
    }
    await toggle()
    if (wasListening) {
      // Mic just stopped — signal backend to finalize the transcript.
      // Clear the answer field immediately so the submit arrow cannot fire
      // exercise_answer for the same input before student_message echoes back.
      awaitingStudentMessageRef.current = true  // block late transcript events until echo arrives
      send({ type: 'mic_stop' })
      setAnswer('')
      lastTranscriptRef.current = ''
      // Safety valve: if no speech was detected the backend never sends student_message,
      // so awaitingStudentMessageRef would stay true forever and block the next mic click.
      // Clear after 1500ms if no student_message echo arrives (covers mic_stop_timeout_no_text).
      setTimeout(() => {
        if (awaitingStudentMessageRef.current) {
          awaitingStudentMessageRef.current = false
          console.log('[paid-lesson] mic_awaiting_cleared reason=no_text_timeout')
        }
      }, 1500)
    } else {
      // Mic just started — reset any stuck guard from a previous turn where
      // student_message never arrived (e.g. backend error mid-processing).
      // This prevents transcripts from being silently blocked on the new turn.
      awaitingStudentMessageRef.current = false
      lastTranscriptRef.current = ''
      send({ type: 'mic_start' })
    }
  }, [lessonStarted, isSpeaking, isListening, toggle, send])

  const handleExplain = useCallback(() => {
    if (isDemoMode) {
      setShowHelpInput(prev => !prev)
      if (!showHelpInput) setHelpInputValue('')
      return
    }
    const lastAiText = messages
      .filter((m) => m.sender === 'ai' && !m.isTyping && m.text)
      .slice(-1)[0]?.text
    send({
      type:               'student_confused',
      lastTeacherMessage: lastAiText,
      lastExercise:       question?.sentence,
      studentLastAnswer:  answerRef.current || undefined,
    })
  }, [isDemoMode, showHelpInput, send, messages, question])

  const handleHelpSubmit = useCallback(() => {
    const text = helpInputValue.trim()
    if (!text) return
    setHelpInputValue('')
    setShowHelpInput(false)
    demo.handleHelpRequest(text)
  }, [helpInputValue, demo])

  const handleReady = useCallback(() => {
    if (readyClicked) return
    setReadyClicked(true)
    const readyText = "I'm ready."
    pushUser(readyText)
    setTyping()
    send({ type: 'text_message', text: readyText })
  }, [readyClicked, pushUser, setTyping, send])

  const questionForPanel = question
    ? { ...question, answer: confirmedAnswer }
    : null

  // Mobile overlay messages — same source as desktop chat panel
  const mobChatMessages = useMemo(
    () => isDemoMode ? demo.chatMessages : messages,
    [isDemoMode, demo.chatMessages, messages]
  )

  // ── Guards ────────────────────────────────────────────────────────────────
  if (isAuthLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#F5F5F7' }}>
        <div style={{ textAlign: 'center', color: '#94A3B8', fontSize: 15 }}>
          <div style={{ width: 36, height: 36, border: '3px solid #E6EAF2', borderTopColor: '#7B8CFF', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          Loading…
        </div>
      </div>
    )
  }

  if (isDemoMode && demo.phase === 'error') {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg,#f0eeff 0%,#F5F5F7 40%,#fff5ee 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div style={{ background: 'white', borderRadius: 24, padding: 32, maxWidth: 360, width: '100%', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.12)' }}>
          <p style={{ color: '#64748B', marginBottom: 16 }}>{demo.error ?? 'Could not load your lesson.'}</p>
          <button onClick={() => window.location.reload()} style={{ padding: '10px 24px', background: 'linear-gradient(135deg,#6E7CFB,#9B8CFF)', color: 'white', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
            Try again
          </button>
        </div>
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{
      height: '100vh', display: 'flex', flexDirection: 'column',
      background: 'linear-gradient(160deg, #f0eeff 0%, #F5F5F7 40%, #fff5ee 100%)',
      overflow: 'hidden',
    }}>
      {/* Ambient blobs */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -160, left: -160, width: 700, height: 700, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,185,100,0.35) 0%, rgba(255,160,70,0.15) 45%, transparent 70%)', filter: 'blur(60px)' }} />
        <div style={{ position: 'absolute', bottom: -120, right: -120, width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(110,124,251,0.28) 0%, rgba(155,140,255,0.12) 45%, transparent 70%)', filter: 'blur(60px)' }} />
        <div style={{ position: 'absolute', top: '35%', left: '38%', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(155,140,255,0.12) 0%, transparent 70%)', filter: 'blur(80px)' }} />
      </div>

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
        <ClassroomHeader
          meta={isDemoMode ? null : sessionMeta}
          isDemo={isDemoMode}
          remainingMin={isDemoMode ? undefined : (lessonStarted ? lessonRemainingMin : undefined)}
          onExit={isDemoMode
            ? () => demo.setShowLeaveModal(true)
            : () => setShowPaidLeaveModal(true)
          }
        />

        <div
          className="cls-classroom-grid"
          style={{
            flex: 1, minHeight: 0,
            display: 'grid',
            gridTemplateColumns: chatOpen ? '160px 1fr 265px 148px' : '160px 1fr 148px',
            alignItems: 'stretch',
            gap: 14,
            padding: '16px 20px',
            paddingBottom: 110,
            overflow: 'hidden',
            transition: 'grid-template-columns 0.32s cubic-bezier(0.4,0,0.2,1)',
          }}
        >
          {/* Left — teacher avatar + voice state */}
          <TeacherPanel
            voiceState={{
              isListening:         isDemoMode ? demoListening : isListening,
              isSpeaking:          isDemoMode ? demo.isSpeaking : isSpeaking,
              transcript:          isDemoMode ? '' : transcript,
              voiceTurnState:      isDemoMode ? 'idle' : (isListening ? 'listening' : 'idle'),
              isPartialTranscript: !isDemoMode && isPartialTranscript,
            }}
            onExplain={handleExplain}
            teacherName={sessionMeta?.teacherName}
            teacherAvatarUrl={sessionMeta?.teacherAvatarUrl}
            isDemo={isDemoMode}
          />

          {/* Center — exercise, demo step, teaching overlay, or waiting state */}
          <div className="cls-classroom-center" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', minWidth: 0 }}>
            {isDemoMode ? (
              demo.phase === 'ready' ? (
                <div style={{ textAlign: 'center' }}>
                  <div style={{
                    fontSize: 13, color: '#9B8CFF', fontWeight: 600, marginBottom: 20,
                    letterSpacing: '0.04em', textTransform: 'uppercase',
                  }}>
                    Your lesson is ready
                  </div>
                  <button
                    onClick={async () => {
                      // Phase 7.9: prevent double-click during async mic preflight
                      if (demoBeginSentRef.current) return
                      demoBeginSentRef.current = true
                      // Both calls initiated synchronously within the gesture so the browser
                      // handles iOS autoplay unlock (Phase 7.8 silent buffer) AND the mic
                      // permission prompt from the same user interaction.
                      // primeAudioContext returns a Promise we pass through to startLesson.
                      // requestMicPreflight: stops tracks immediately — no recording started.
                      const primingPromise = primeAudioContext()
                      const micGranted = await requestMicPreflight()
                      if (!micGranted) {
                        setMicPermissionDenied(true)
                      }
                      void demo.startLesson(primingPromise)
                    }}
                    style={{
                      padding: '15px 44px',
                      background: 'linear-gradient(135deg, #6E7CFB 0%, #9B8CFF 100%)',
                      color: 'white', border: 'none', borderRadius: 20,
                      fontSize: 17, fontWeight: 700, cursor: 'pointer', letterSpacing: '-0.2px',
                      boxShadow: '0 8px 32px rgba(110,124,251,0.40), 0 2px 8px rgba(0,0,0,0.08)',
                      transition: 'transform 0.15s, box-shadow 0.15s',
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)'
                      ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '0 12px 40px rgba(110,124,251,0.5), 0 4px 12px rgba(0,0,0,0.1)'
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLButtonElement).style.transform = ''
                      ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '0 8px 32px rgba(110,124,251,0.40), 0 2px 8px rgba(0,0,0,0.08)'
                    }}
                  >
                    Begin Lesson ▶
                  </button>
                </div>
              ) : (
              <DemoStepCenter
                phase={demo.phase}
                currentStep={demo.currentStep}
                selectedOption={demo.selectedOption}
                onMcqSelect={demo.handleMcqSelect}
                submitting={demo.submitting}
                isSpeaking={demo.isSpeaking}
              />
              )
            ) : teachingCard ? (
              // Teaching card with exercise anchor — exercise context persists during side questions
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 720, alignItems: 'stretch' }}>
                <TeachingOverlay card={teachingCard} onDismiss={() => setTeachingCard(null)} />
                {(exerciseCursor || questionForPanel) && (
                  <ExerciseAnchorBanner
                    exerciseNum={exerciseCursor?.exerciseNumber ?? questionForPanel?.index ?? 1}
                    exerciseType={exerciseCursor?.exerciseType ?? questionForPanel?.exerciseType ?? ''}
                    instruction={exerciseCursor?.instruction ?? questionForPanel?.prompt ?? ''}
                  />
                )}
              </div>
            ) : exerciseCursor ? (
              <PaidExerciseCard cursor={exerciseCursor} feedback={feedback} feedbackExplanation={feedbackExplanation} />
            ) : questionForPanel ? (
              <ExercisePanel
                question={questionForPanel}
                answer={answer}
                feedback={feedback}
                showHint={showHint}
                onCheck={handleCheck}
                onHintToggle={() => setShowHint((h) => !h)}
              />
            ) : wsConnectError ? (
              <div style={{ textAlign: 'center', maxWidth: 320 }}>
                <div style={{ color: '#ef4444', fontSize: 15, fontWeight: 700, marginBottom: 10 }}>
                  Connection failed
                </div>
                <div style={{ color: '#64748B', fontSize: 14, marginBottom: 20, lineHeight: 1.6 }}>
                  {wsConnectError}
                </div>
                <button
                  onClick={() => window.location.reload()}
                  style={{
                    padding: '10px 28px', borderRadius: 12, border: 'none',
                    background: 'linear-gradient(135deg,#6E7CFB,#9B8CFF)',
                    color: 'white', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  Try again
                </button>
              </div>
            ) : !lessonStarted ? (
              paidLessonReady ? (
                <PaidBeginPanel meta={sessionMeta} onBegin={handleBeginLesson} />
              ) : (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ width: 36, height: 36, border: '3px solid #E6EAF2', borderTopColor: '#7B8CFF', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 14px' }} />
                  <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
                  <div style={{ fontSize: 15, color: '#64748B', fontWeight: 500 }}>Connecting to your teacher…</div>
                </div>
              )
            ) : (() => {
              // Dialogue phase: no exercise active — show last teacher message prominently
              const lastMsg = messages.filter(m => m.sender === 'ai' && !m.isTyping && m.text).slice(-1)[0]
              if (!lastMsg?.text) return null
              return (
                <div style={{
                  maxWidth: 560, width: '100%',
                  background: 'rgba(255,255,255,0.88)',
                  backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
                  borderRadius: 24, padding: '28px 32px',
                  boxShadow: '0 2px 0 rgba(255,255,255,1) inset, 0 20px 60px rgba(0,0,0,0.07)',
                  border: '1px solid rgba(255,255,255,0.7)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 12, flexShrink: 0,
                      background: 'linear-gradient(135deg,#6E7CFB,#9B8CFF)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'white', fontSize: 13, fontWeight: 800,
                    }}>
                      {(sessionMeta?.teacherName ?? 'T')[0].toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e' }}>
                        {sessionMeta?.teacherName ?? 'Teacher'}
                      </div>
                      {isSpeaking && (
                        <div style={{ fontSize: 11, color: '#6E7CFB', fontWeight: 600, marginTop: 1 }}>
                          Speaking…
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{
                    fontSize: 17, fontWeight: 600, color: '#1a1a2e',
                    lineHeight: 1.65, letterSpacing: '-0.1px',
                  }}>
                    {lastMsg.text}
                  </div>
                  {currentPhase === 'DIAGNOSTIC' && !readyClicked ? (
                    <button
                      onClick={handleReady}
                      style={{
                        marginTop: 20, width: '100%', padding: '14px 20px',
                        background: 'linear-gradient(135deg,#6E7CFB,#9B8CFF)',
                        color: 'white', border: 'none', borderRadius: 14,
                        fontSize: 16, fontWeight: 700, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        boxShadow: '0 6px 20px rgba(110,124,251,0.40)',
                        transition: 'transform 0.15s, opacity 0.15s',
                        letterSpacing: '-0.1px',
                      }}
                      onMouseOver={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)'; (e.currentTarget as HTMLButtonElement).style.opacity = '0.92' }}
                      onMouseOut={e => { (e.currentTarget as HTMLButtonElement).style.transform = ''; (e.currentTarget as HTMLButtonElement).style.opacity = '1' }}
                    >
                      Yes, I&apos;m ready <span style={{ fontSize: 18 }}>→</span>
                    </button>
                  ) : readyClicked && currentPhase === 'DIAGNOSTIC' ? (
                    <div style={{
                      marginTop: 18, fontSize: 13, color: '#6E7CFB', fontWeight: 600,
                      display: 'flex', alignItems: 'center', gap: 8,
                    }}>
                      <div style={{ width: 14, height: 14, border: '2px solid #EEF0FF', borderTopColor: '#6E7CFB', borderRadius: '50%', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />
                      Starting your first exercise…
                    </div>
                  ) : (
                    <div style={{
                      marginTop: 18, fontSize: 12, color: '#94A3B8', fontWeight: 500,
                      display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                      <span style={{ fontSize: 14 }}>🎤</span>
                      Use the microphone or type your response below
                    </div>
                  )}
                </div>
              )
            })()}
          </div>

          {/* Chat panel */}
          {chatOpen && (
            <ChatPanel
              messages={isDemoMode ? demo.chatMessages : messages}
              onHide={() => setChatOpen(false)}
              isDemoMode={isDemoMode}
              teacherName={isDemoMode ? 'Sophie' : (sessionMeta?.teacherName ?? 'Teacher')}
              onTranslate={isDemoMode
                ? (msgId, text) => demo.handleTranslateMessage(msgId, text, 'ru')
                : paidSessionId
                  ? async (_msgId: string, text: string) => {
                      try {
                        const token = getStoredToken()
                        const res = await fetch(`${API_BASE}/lesson/translate`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                          body: JSON.stringify({ sessionId: paidSessionId, text, targetLanguage: 'ru' }),
                        })
                        if (!res.ok) return null
                        const j = (await res.json()) as { translation?: string }
                        return j.translation ?? null
                      } catch { return null }
                    }
                  : undefined
              }
              voiceMuted={isDemoMode ? demo.voiceMuted : undefined}
              onToggleMute={isDemoMode ? demo.toggleVoiceMuted : undefined}
              voiceStates={isDemoMode ? demo.voiceStates : undefined}
              voiceMessages={isDemoMode ? demo.voiceMessages : undefined}
              onPlayAudio={isDemoMode ? demo.handlePlayAudio : undefined}
            />
          )}

          {/* Section / demo progress timeline */}
          <SectionProgressPanel
            steps={isDemoMode ? demo.steps : steps}
            progress={isDemoMode ? demo.progress : progress}
            chatOpen={chatOpen}
            onOpenChat={() => setChatOpen(true)}
            onCloseChat={() => setChatOpen(false)}
            sectionNumber={isDemoMode ? undefined : sessionMeta?.sectionNumber}
            sectionTopic={isDemoMode ? 'Demo Lesson' : (sessionMeta?.sectionTopic ?? sessionMeta?.sectionTitle)}
            exerciseCount={isDemoMode ? 4 : sessionMeta?.exerciseCount}
            currentExerciseNum={isDemoMode ? undefined : (exerciseCursor?.exerciseNumber ?? question?.index)}
          />
        </div>

        {/* Single input bar for all lesson interactions */}
        <BottomControls
          isListening={isDemoMode ? demoListening : isListening}
          value={answer}
          onChange={setAnswer}
          onSubmit={handleSubmit}
          onToggleMic={isDemoMode ? toggleDemoMic : paidToggle}
          onExplain={handleExplain}
          showExplain={lessonStarted || isDemoMode}
          isPartialTranscript={!isDemoMode && isPartialTranscript}
          inputDisabled={
            (isDemoMode && !demo.lessonStarted) ||
            (isDemoMode && demo.phase === 'complete') ||
            (!isDemoMode && !lessonStarted) ||
            (!isDemoMode && isRecovering) ||
            (!isDemoMode && exerciseCursor?.completionState === 'complete')
          }
          micDisabled={!isDemoMode && (!lessonStarted || isRecovering)}
          showHelpInput={isDemoMode ? showHelpInput : false}
          helpInputValue={helpInputValue}
          onHelpChange={setHelpInputValue}
          onHelpSubmit={handleHelpSubmit}
          onHelpClose={() => setShowHelpInput(false)}
        />
      </div>

      {/* ── Mobile-only chat toggle button (≤600px) ─────────────────────────── */}
      <button
        className="cls-mob-chat-btn"
        aria-label={mobChatOpen ? 'Close chat' : 'Open chat history'}
        onClick={() => setMobChatOpen(o => !o)}
      >
        {mobChatOpen ? '✕' : '💬'}
      </button>

      {/* Mobile chat overlay — compact panel over content, closes on backdrop click */}
      {mobChatOpen && (
        <>
          <div
            className="cls-mob-chat-backdrop"
            onClick={() => setMobChatOpen(false)}
          />
          <div className="cls-mob-chat-overlay">
            <ChatPanel
              messages={mobChatMessages}
              onHide={() => setMobChatOpen(false)}
              isDemoMode={isDemoMode}
              teacherName={isDemoMode ? 'Sophie' : (sessionMeta?.teacherName ?? 'Teacher')}
              onTranslate={isDemoMode
                ? (msgId, text) => demo.handleTranslateMessage(msgId, text, 'ru')
                : paidSessionId
                  ? async (_msgId: string, text: string) => {
                      try {
                        const token = getStoredToken()
                        const res = await fetch(`${API_BASE}/lesson/translate`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                          body: JSON.stringify({ sessionId: paidSessionId, text, targetLanguage: 'ru' }),
                        })
                        if (!res.ok) return null
                        const j = (await res.json()) as { translation?: string }
                        return j.translation ?? null
                      } catch { return null }
                    }
                  : undefined
              }
              voiceMuted={isDemoMode ? demo.voiceMuted : undefined}
              onToggleMute={isDemoMode ? demo.toggleVoiceMuted : undefined}
              voiceStates={isDemoMode ? demo.voiceStates : undefined}
              voiceMessages={isDemoMode ? demo.voiceMessages : undefined}
              onPlayAudio={isDemoMode ? demo.handlePlayAudio : undefined}
            />
          </div>
        </>
      )}

      {/* Demo overlays — two-stage: lesson-complete modal first, full results after button click */}
      {isDemoMode && demo.phase === 'complete' && demo.finalResult && !showFullResults && (
        <LessonCompleteModal
          teacherMessage={demo.finalResult.teacher_message}
          onViewResults={() => setShowFullResults(true)}
        />
      )}
      {isDemoMode && showFullResults && demo.finalResult && (
        <DemoResultOverlay
          result={demo.finalResult}
          interestArea={demo.interestArea}
          onNavigate={() => navigate('/pricing?from=demo_complete')}
        />
      )}
      {isDemoMode && demo.showLeaveModal && (
        <DemoLeaveModal
          onStay={() => demo.setShowLeaveModal(false)}
          onLeave={() => navigate('/')}
        />
      )}

      {/* Mobile audio unlock indicator — shown when TTS was blocked by autoplay policy.
          Tapping it warms the AudioContext so subsequent TTS messages play with sound.
          The lesson remains fully usable via text even without tapping this. */}
      {isDemoMode && demo.audioUnlockRequired && demo.lessonStarted && demo.phase !== 'complete' && (
        <button
          onClick={demo.unlockAudio}
          style={{
            position: 'fixed', top: 70, left: '50%', transform: 'translateX(-50%)',
            zIndex: 120,
            background: 'rgba(110,124,251,0.92)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
            borderRadius: 99, border: 'none',
            padding: '8px 18px',
            color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 8,
            boxShadow: '0 4px 20px rgba(110,124,251,0.40)',
            whiteSpace: 'nowrap',
          }}
        >
          <span style={{ fontSize: 15 }}>🔊</span>
          Tap to enable voice
        </button>
      )}

      {/* Phase 7.9: mic permission denied — lesson continues in text mode */}
      {isDemoMode && micPermissionDenied && demo.lessonStarted && demo.phase !== 'complete' && (
        <div
          style={{
            position: 'fixed', top: 116, left: '50%', transform: 'translateX(-50%)',
            zIndex: 120,
            background: 'rgba(245,158,11,0.95)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
            borderRadius: 16, border: 'none',
            padding: '10px 12px 10px 18px',
            color: '#78350f', fontSize: 13, fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 8,
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            maxWidth: 'min(460px, calc(100vw - 32px))',
          }}
        >
          <span style={{ fontSize: 16, flexShrink: 0 }}>🎤</span>
          <span style={{ flex: 1, lineHeight: 1.45 }}>
            Microphone permission is needed for speaking practice. You can still read the lesson text, but voice input will not work.
          </span>
          <button
            onClick={() => setMicPermissionDenied(false)}
            style={{
              background: 'rgba(0,0,0,0.12)', border: 'none', borderRadius: 99,
              width: 22, height: 22, fontSize: 12, fontWeight: 900,
              color: '#78350f', cursor: 'pointer', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 0,
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Recovery banner — waits for backend state snapshot after reconnect */}
      {!isDemoMode && isRecovering && !wsDisconnected && !paidLessonEnded && (
        <div style={{
          position: 'fixed', top: 56, left: 0, right: 0, zIndex: 90,
          background: 'rgba(110,124,251,0.92)', backdropFilter: 'blur(4px)',
          padding: '9px 20px',
          textAlign: 'center', fontSize: 13, fontWeight: 700, color: 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
        }}>
          <div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />
          Restoring your lesson state…
        </div>
      )}

      {/* Stale answer message — STALE_EXERCISE_ANSWER engine rejection */}
      {!isDemoMode && staleAnswerMsg && (
        <div style={{
          position: 'fixed', top: 56, left: '50%', transform: 'translateX(-50%)',
          zIndex: 130, background: 'rgba(245,158,11,0.95)', backdropFilter: 'blur(4px)',
          borderRadius: 12, padding: '8px 20px', fontSize: 13, fontWeight: 700,
          color: '#78350f', boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
          maxWidth: 'calc(100vw - 32px)', textAlign: 'center' as const, wordBreak: 'break-word' as const,
        }}>
          {staleAnswerMsg}
        </div>
      )}

      {/* WS disconnect banner — shows when connection drops mid-lesson */}
      {!isDemoMode && lessonStarted && wsDisconnected && !paidLessonEnded && (
        <div style={{
          position: 'fixed', top: 56, left: 0, right: 0, zIndex: 90,
          background: 'rgba(245,158,11,0.95)', backdropFilter: 'blur(4px)',
          padding: '9px 20px',
          textAlign: 'center', fontSize: 13, fontWeight: 700, color: '#78350f',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
        }}>
          <span>⚡</span>
          <span>Connection lost — trying to reconnect…</span>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: 'rgba(0,0,0,0.12)', border: 'none', borderRadius: 8,
              color: '#78350f', padding: '4px 12px', cursor: 'pointer',
              fontSize: 12, fontWeight: 700,
            }}
          >
            Reload
          </button>
        </div>
      )}

      {/* LESSON_TAKEN_OVER modal — shown when another tab took ownership */}
      {!isDemoMode && lessonTakenOver && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 250,
          background: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        }}>
          <div style={{
            background: 'white', borderRadius: 24, padding: '32px 28px',
            maxWidth: 400, width: '100%',
            boxShadow: '0 32px 64px rgba(15,23,42,0.22)', textAlign: 'center',
          }}>
            <div style={{ fontSize: 32, marginBottom: 14 }}>📱</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#0F172A', marginBottom: 10 }}>
              Lesson opened elsewhere
            </div>
            <div style={{ fontSize: 14, color: '#64748B', lineHeight: 1.65, marginBottom: 24 }}>
              This lesson was resumed in another tab or window. Your progress is saved.
            </div>
            <button
              onClick={() => window.location.reload()}
              style={{
                width: '100%', padding: '14px 20px', borderRadius: 16, border: 'none',
                background: 'linear-gradient(135deg,#6E7CFB,#9B8CFF)',
                color: 'white', fontSize: 15, fontWeight: 700, cursor: 'pointer',
                boxShadow: '0 8px 28px rgba(110,124,251,0.40)',
              }}
            >
              Take over this tab
            </button>
          </div>
        </div>
      )}

      {/* Phase 6: 5-minute time warning banner */}
      {!isDemoMode && lessonTimeWarning !== null && !paidLessonEnded && (
        <div style={{
          position: 'fixed', top: 64, left: '50%', transform: 'translateX(-50%)',
          zIndex: 130, background: 'rgba(251,191,36,0.95)', backdropFilter: 'blur(4px)',
          borderRadius: 12, padding: '8px 20px', fontSize: 13, fontWeight: 700,
          color: '#78350f', boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
          display: 'flex', alignItems: 'center', gap: 8,
          maxWidth: 'calc(100vw - 32px)',
        }}>
          <span style={{ fontSize: 16 }}>⏱</span>
          {lessonTimeWarning} {lessonTimeWarning === 1 ? 'minute' : 'minutes'} remaining in this lesson
        </div>
      )}

      {/* Paid lesson: completion modal */}
      {!isDemoMode && paidLessonEnded && paidLessonSummary && (
        <PaidLessonCompleteModal
          durationMin={paidLessonSummary.durationMin}
          exerciseScore={paidLessonSummary.exerciseScore}
          vocabularyCount={paidLessonSummary.vocabularyCount}
          onContinue={() => navigate('/learning')}
        />
      )}

      {/* Phase 5: Tips floating button (paid mode only, shown when tips exist) */}
      {!isDemoMode && tips.length > 0 && !showTips && (
        <button
          onClick={() => setShowTips(true)}
          title="My Learning Notes"
          style={{
            position: 'fixed', bottom: 120, right: 20, zIndex: 120,
            background: 'linear-gradient(135deg,#6E7CFB,#9B8CFF)',
            color: 'white', border: 'none', borderRadius: 16,
            padding: '9px 14px', fontSize: 12, fontWeight: 800,
            cursor: 'pointer', letterSpacing: '0.01em',
            boxShadow: '0 6px 24px rgba(110,124,251,0.45)',
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          <span style={{ fontSize: 14 }}>📖</span>
          Notes
          <span style={{
            background: 'rgba(255,255,255,0.25)',
            borderRadius: 99, padding: '1px 7px', fontSize: 11, fontWeight: 900,
          }}>
            {tips.length}
          </span>
        </button>
      )}

      {/* Phase 5: Tips drawer (paid mode only) */}
      {!isDemoMode && showTips && (
        <>
          <div
            onClick={() => setShowTips(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 140,
              background: 'rgba(15,23,42,0.25)',
              backdropFilter: 'blur(2px)',
            }}
          />
          <TipsDrawer tips={tips} onClose={() => setShowTips(false)} />
        </>
      )}

      {/* Paid lesson: exit guard */}
      {!isDemoMode && showPaidLeaveModal && (
        <PaidLeaveModal
          onStay={() => setShowPaidLeaveModal(false)}
          onLeave={() => {
            wsRef.current?.close()
            navigate('/learning')
          }}
        />
      )}
    </div>
  )
}

// ── Paid Begin Lesson panel — shown after WS connects, before lesson starts ──────────
function PaidBeginPanel({ meta, onBegin }: {
  meta:    import('../../../types/lessonTypes').LessonSessionMetadata | null
  onBegin: () => void
}) {
  const section = meta?.sectionNumber
  const topic   = meta?.sectionTopic ?? meta?.sectionTitle
  const teacher = meta?.teacherName

  return (
    <div style={{ textAlign: 'center', maxWidth: 360 }}>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        background: '#f0fdf4', color: '#16a34a', borderRadius: 99,
        padding: '5px 14px', fontSize: 11, fontWeight: 800,
        textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 20,
      }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
        Your teacher is ready
      </div>

      {(section || topic) && (
        <div style={{ marginBottom: 20 }}>
          {section && (
            <div style={{ fontSize: 13, color: '#94A3B8', fontWeight: 600, marginBottom: 4 }}>
              Section {section}
            </div>
          )}
          {topic && (
            <div style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', lineHeight: 1.4 }}>
              {topic}
            </div>
          )}
        </div>
      )}

      {teacher && (
        <div style={{ fontSize: 13, color: '#94A3B8', marginBottom: 24 }}>
          with {teacher}
        </div>
      )}

      <button
        onClick={onBegin}
        style={{
          padding: '15px 44px',
          background: 'linear-gradient(135deg, #6E7CFB 0%, #9B8CFF 100%)',
          color: 'white', border: 'none', borderRadius: 20,
          fontSize: 17, fontWeight: 700, cursor: 'pointer', letterSpacing: '-0.2px',
          boxShadow: '0 8px 32px rgba(110,124,251,0.40), 0 2px 8px rgba(0,0,0,0.08)',
          transition: 'transform 0.15s, box-shadow 0.15s',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)'
          ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '0 12px 40px rgba(110,124,251,0.5), 0 4px 12px rgba(0,0,0,0.1)'
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLButtonElement).style.transform = ''
          ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '0 8px 32px rgba(110,124,251,0.40), 0 2px 8px rgba(0,0,0,0.08)'
        }}
      >
        Begin Lesson ▶
      </button>

      <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 14, lineHeight: 1.6 }}>
        Your paid minutes start when you begin
      </div>
    </div>
  )
}

// ── Lesson complete modal — appears inside the classroom after final teacher message ──
// Chat remains visible and scrollable behind the dimmed overlay.
// User clicks "View my results" to proceed to the full results screen.
function LessonCompleteModal({ teacherMessage, onViewResults }: {
  teacherMessage: string
  onViewResults:  () => void
}) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{
        background: 'white', borderRadius: 24, padding: '32px 28px',
        maxWidth: 420, width: '100%',
        boxShadow: '0 32px 64px rgba(15,23,42,0.22)',
        textAlign: 'center',
      }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: '#f0fdf4', color: '#16a34a', borderRadius: 99,
          padding: '5px 14px', fontSize: 11, fontWeight: 800,
          textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 18,
        }}>
          ✓ Lesson complete
        </div>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#0F172A', marginBottom: 12, lineHeight: 1.3 }}>
          Well done on finishing!
        </div>
        <div style={{
          background: 'linear-gradient(135deg,#f8f7ff,#fff8f4)', borderRadius: 16,
          padding: '14px 16px', marginBottom: 18, textAlign: 'left',
          display: 'flex', gap: 10, alignItems: 'flex-start',
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 10, flexShrink: 0,
            background: 'linear-gradient(135deg,#6E7CFB,#9B8CFF)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontSize: 12, fontWeight: 800,
          }}>A</div>
          <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.6, margin: 0 }}>
            {teacherMessage}
          </p>
        </div>
        <p style={{ fontSize: 13, color: '#94A3B8', marginBottom: 24, lineHeight: 1.55 }}>
          Your demo lesson is finished. View your results when you&apos;re ready.
        </p>
        <button
          onClick={onViewResults}
          style={{
            width: '100%', padding: '14px 20px', borderRadius: 16, border: 'none',
            background: 'linear-gradient(135deg,#6E7CFB,#9B8CFF)',
            color: 'white', fontSize: 15, fontWeight: 700, cursor: 'pointer',
            boxShadow: '0 8px 28px rgba(110,124,251,0.40)',
            letterSpacing: '-0.2px',
          }}
        >
          View my results →
        </button>
      </div>
    </div>
  )
}

// ── Paid lesson complete modal (Phase 6: shows real lesson stats) ─────────────
function PaidLessonCompleteModal({ durationMin, exerciseScore, vocabularyCount, onContinue }: {
  durationMin:     number
  exerciseScore:   number
  vocabularyCount: number
  onContinue:      () => void
}) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{
        background: 'white', borderRadius: 24, padding: '32px 28px',
        maxWidth: 420, width: '100%',
        boxShadow: '0 32px 64px rgba(15,23,42,0.22)',
        textAlign: 'center',
      }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: '#f0fdf4', color: '#16a34a', borderRadius: 99,
          padding: '5px 14px', fontSize: 11, fontWeight: 800,
          textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 18,
        }}>
          ✓ Lesson complete
        </div>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#0F172A', marginBottom: 16, lineHeight: 1.3 }}>
          Great work!
        </div>

        {/* Real lesson stats */}
        <div style={{
          display: 'flex', gap: 10, marginBottom: 20, justifyContent: 'center',
        }}>
          <div style={{
            flex: 1, background: '#f8f7ff', borderRadius: 14, padding: '12px 8px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#6E7CFB' }}>{durationMin}</div>
            <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600, marginTop: 2 }}>minutes</div>
          </div>
          {exerciseScore > 0 && (
            <div style={{
              flex: 1, background: '#f0fdf4', borderRadius: 14, padding: '12px 8px', textAlign: 'center',
            }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#16a34a' }}>{exerciseScore}</div>
              <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600, marginTop: 2 }}>correct answers</div>
            </div>
          )}
          {vocabularyCount > 0 && (
            <div style={{
              flex: 1, background: '#fff8f0', borderRadius: 14, padding: '12px 8px', textAlign: 'center',
            }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#ea7c1a' }}>{vocabularyCount}</div>
              <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600, marginTop: 2 }}>vocabulary</div>
            </div>
          )}
        </div>

        <div style={{ fontSize: 13, color: '#64748B', marginBottom: 22, lineHeight: 1.6 }}>
          Your progress has been saved. You can continue your course in the next lesson.
        </div>
        <button
          onClick={onContinue}
          style={{
            width: '100%', padding: '14px 20px', borderRadius: 16, border: 'none',
            background: 'linear-gradient(135deg,#7B8CFF,#A18BFF)',
            color: 'white', fontSize: 15, fontWeight: 700, cursor: 'pointer',
            boxShadow: '0 8px 28px rgba(123,140,255,0.40)',
          }}
        >
          Back to lessons →
        </button>
      </div>
    </div>
  )
}

// ── Paid lesson leave guard ───────────────────────────────────────────────────
function PaidLeaveModal({ onStay, onLeave }: { onStay: () => void; onLeave: () => void }) {
  return (
    <div
      onClick={onStay}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'white', borderRadius: 24, padding: '32px 28px',
          maxWidth: 400, width: '100%',
          boxShadow: '0 32px 64px rgba(15,23,42,0.22)',
        }}
      >
        <div style={{ fontSize: 20, fontWeight: 800, color: '#0F172A', marginBottom: 10 }}>
          Leave your lesson?
        </div>
        <div style={{ fontSize: 14, color: '#64748B', lineHeight: 1.65, marginBottom: 24 }}>
          Your progress will be saved. You can resume this lesson next time.
          Minutes used so far will count toward your monthly balance.
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={onStay}
            style={{ flex: 1, padding: '12px 0', borderRadius: 14, border: '1.5px solid #E6EAF2', background: 'white', color: '#0F172A', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
          >
            Stay in lesson
          </button>
          <button
            onClick={onLeave}
            style={{ flex: 1, padding: '12px 0', borderRadius: 14, border: 'none', background: 'linear-gradient(135deg,#7B8CFF,#A18BFF)', color: 'white', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
          >
            Save & exit
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Demo leave guard — only used when isDemoMode ──────────────────────────────
function DemoLeaveModal({ onStay, onLeave }: { onStay: () => void; onLeave: () => void }) {
  return (
    <div
      onClick={onStay}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'white', borderRadius: 24, padding: '32px 28px',
          maxWidth: 420, width: '100%',
          boxShadow: '0 32px 64px rgba(15,23,42,0.22)',
        }}
      >
        <div style={{ fontSize: 28, marginBottom: 12 }}>⚠️</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#0F172A', marginBottom: 10 }}>
          Leave your free demo lesson?
        </div>
        <div style={{ fontSize: 14, color: '#64748B', lineHeight: 1.65, marginBottom: 24 }}>
          Your free demo lesson can only be started <strong>once</strong>. If you leave now, you may lose access to this free attempt.
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={onStay}
            style={{ flex: 1, padding: '12px 0', borderRadius: 14, border: '1.5px solid #E6EAF2', background: 'white', color: '#0F172A', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
          >
            Stay in lesson
          </button>
          <button
            onClick={onLeave}
            style={{ flex: 1, padding: '12px 0', borderRadius: 14, border: 'none', background: 'linear-gradient(135deg,#EF4444,#DC2626)', color: 'white', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
          >
            Leave anyway
          </button>
        </div>
      </div>
    </div>
  )
}
