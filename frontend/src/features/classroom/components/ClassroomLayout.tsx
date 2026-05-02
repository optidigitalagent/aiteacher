import { useState, useEffect, useCallback, useRef } from 'react'
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
import SectionProgressPanel  from './SectionProgressPanel'
import ChatPanel             from './ChatPanel'
import BottomControls        from './BottomControls'
import TeachingOverlay       from './TeachingOverlay'
import DemoStepCenter        from './DemoStepCenter'
import DemoResultOverlay     from './DemoResultOverlay'
import {
  createClassroomSocket,
  sendMessage,
  type BackendMessage,
} from '../services/classroomSocket'
import { useAuth, getStoredToken } from '../../../context/AuthContext'

const LESSON_UNIT = Number(import.meta.env.VITE_LESSON_UNIT ?? 1)
const ENV_SECTION = import.meta.env.VITE_LESSON_SECTION as string | undefined

export type ClassroomMode = 'demo' | 'paid'

export default function ClassroomLayout({ mode }: { mode: ClassroomMode }) {
  const { demoId } = useParams<{ sessionId?: string; demoId?: string }>()
  const location    = useLocation()
  const navigate    = useNavigate()
  const { isAuthenticated, isAuthLoading } = useAuth()
  const sessionMeta = (location.state as LessonSessionMetadata | null) ?? null

  const isDemoMode    = mode === 'demo'
  const resolvedSection = sessionMeta?.sectionNumber ?? ENV_SECTION

  const wsRef = useRef<WebSocket | null>(null)
  const send = useCallback((payload: object) => {
    sendMessage(wsRef.current, payload)
  }, [])

  // ── Production hooks (always called — rules of hooks) ────────────────────
  const {
    question, progress, steps,
    submitAnswer, onExercise, onPhaseChange,
  } = useLessonSession({ send })

  const {
    messages, pushUser, pushAI, setTyping, clearTyping,
  } = useClassroomChat({ send })

  const {
    isListening, isSpeaking, transcript, toggle,
    onAudioChunk, onTranscript, setSpeaking,
  } = useVoiceSession({ send })

  // ── Demo voice — Web Speech API (no WebSocket needed) ────────────────────
  // Minimal local interface so we don't rely on `SpeechRecognition` global type
  type WebSpeechRec = {
    continuous: boolean; interimResults: boolean; lang: string
    onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
    onend: (() => void) | null
    onerror: (() => void) | null
    start(): void; stop(): void
  }
  const [demoListening,  setDemoListening]  = useState(false)
  const demoSpeechRef = useRef<WebSpeechRec | null>(null)

  const toggleDemoMic = useCallback(() => {
    if (demoListening) {
      demoSpeechRef.current?.stop()
      demoSpeechRef.current = null
      setDemoListening(false)
      return
    }
    const w = window as unknown as Record<string, unknown>
    const SpeechRecCtor = (w['SpeechRecognition'] ?? w['webkitSpeechRecognition']) as
      (new () => WebSpeechRec) | undefined
    if (!SpeechRecCtor) {
      console.warn('[demo voice] SpeechRecognition not supported')
      return
    }
    const rec = new SpeechRecCtor()
    rec.continuous     = false
    rec.interimResults = true
    rec.lang           = 'en-US'
    rec.onresult = (e) => {
      let text = ''
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript
      setAnswer(text)
    }
    const cleanup = () => { setDemoListening(false); demoSpeechRef.current = null }
    rec.onend   = cleanup
    rec.onerror = cleanup
    try {
      rec.start()
      setDemoListening(true)
      demoSpeechRef.current = rec
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

  // ── Local UI state ────────────────────────────────────────────────────────
  const [answer,          setAnswer]          = useState('')
  const [feedback,        setFeedback]        = useState<FeedbackState>(null)
  const [showHint,        setShowHint]        = useState(false)
  const [chatOpen,        setChatOpen]        = useState(true)
  const [teachingCard,    setTeachingCard]    = useState<TeachingCardData | null>(null)
  const [confirmedAnswer, setConfirmedAnswer] = useState('')
  const [lessonStarted,   setLessonStarted]   = useState(false)

  const answerRef = useRef('')
  useEffect(() => { answerRef.current = answer }, [answer])

  // ── WS message handler ────────────────────────────────────────────────────
  const onMessageRef = useRef<(msg: BackendMessage) => void>(() => {})
  onMessageRef.current = (msg: BackendMessage) => {
    switch (msg.type) {
      case 'ai_text':
        if (!lessonStarted) setLessonStarted(true)
        setSpeaking(true)
        clearTyping()
        pushAI(msg.text)
        break
      case 'audio_chunk':
        onAudioChunk(msg.data)
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
        if (msg.correct) {
          setConfirmedAnswer(answerRef.current)
          setTimeout(() => setAnswer(''), 1800)
        }
        break
      case 'transcript':
        onTranscript(msg.text)
        break
      case 'teaching_card':
        setTeachingCard({ title: 'Explanation', body: msg.displayText })
        break
      case 'section_card':
        break
      case 'lesson_end':
        break
      case 'error':
        console.error('[Classroom WS] error:', msg.code, msg.message)
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
    if (isAuthLoading) return
    if (!isAuthenticated) {
      navigate('/learning', { replace: true })
      return
    }
    if (isDemoMode) return  // demo uses REST API via useDemoSession

    const token = getStoredToken()
    const ws = createClassroomSocket(
      (msg) => onMessageRef.current(msg),
      () => {
        sendMessage(ws, {
          type:    'focus_lesson_start',
          payload: {
            unit: LESSON_UNIT,
            ...(resolvedSection        ? { section:   resolvedSection }       : {}),
            ...(sessionMeta?.teacherId ? { teacherId: sessionMeta.teacherId } : {}),
            ...(sessionMeta?.voiceId   ? { voiceId:   sessionMeta.voiceId }   : {}),
          },
        })
      },
      () => {},
      token ?? undefined,
    )
    wsRef.current = ws
    return () => { ws.close() }
  }, [isAuthLoading, isAuthenticated, isDemoMode]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Side effects ──────────────────────────────────────────────────────────
  useEffect(() => { if (transcript) setAnswer(transcript) }, [transcript])

  useEffect(() => {
    setAnswer('')
    setFeedback(null)
    setShowHint(false)
    setConfirmedAnswer('')
  }, [question?.id])

  // ── Event handlers ────────────────────────────────────────────────────────
  const handleCheck = useCallback(() => {
    if (!answer.trim() || !question) return
    pushUser(answer)
    setTyping()
    submitAnswer(answer)
  }, [answer, question, pushUser, setTyping, submitAnswer])

  const handleSubmit = useCallback(() => {
    if (isDemoMode) {
      if (!answer.trim()) return
      const a = answer
      setAnswer('')
      demo.handleTextSubmit(a)
      return
    }
    if (!answer.trim()) return
    if (question) {
      handleCheck()
    } else {
      pushUser(answer)
      setTyping()
      send({ type: 'text_message', text: answer })
      setAnswer('')
    }
  }, [isDemoMode, answer, demo.handleTextSubmit, question, handleCheck, pushUser, setTyping, send])

  const handleExplain = useCallback(() => {
    if (isDemoMode) return
    const lastAiText = messages
      .filter((m) => m.sender === 'ai' && !m.isTyping && m.text)
      .slice(-1)[0]?.text
    send({
      type:               'student_confused',
      lastTeacherMessage: lastAiText,
      lastExercise:       question?.sentence,
      studentLastAnswer:  answerRef.current || undefined,
    })
  }, [isDemoMode, send, messages, question])

  const questionForPanel = question
    ? { ...question, answer: confirmedAnswer }
    : null

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
          onExit={isDemoMode ? () => demo.setShowLeaveModal(true) : undefined}
        />

        <div style={{
          flex: 1, minHeight: 0,
          display: 'grid',
          gridTemplateColumns: chatOpen ? '170px 1fr 220px 150px' : '170px 1fr 220px',
          alignItems: 'stretch',
          gap: 14,
          padding: '16px 20px',
          paddingBottom: 110,
          overflow: 'hidden',
          transition: 'grid-template-columns 0.32s cubic-bezier(0.4,0,0.2,1)',
        }}>
          {/* Left — teacher avatar + voice state */}
          <TeacherPanel
            voiceState={{
              isListening: isDemoMode ? demoListening : isListening,
              isSpeaking:  isDemoMode ? demo.isSpeaking : isSpeaking,
              transcript:  isDemoMode ? '' : transcript,
            }}
            onExplain={handleExplain}
            teacherName={sessionMeta?.teacherName}
            teacherAvatarUrl={sessionMeta?.teacherAvatarUrl}
          />

          {/* Center — exercise, demo step, teaching overlay, or waiting state */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', minWidth: 0 }}>
            {isDemoMode ? (
              <DemoStepCenter
                phase={demo.phase}
                currentStep={demo.currentStep}
                selectedOption={demo.selectedOption}
                onMcqSelect={demo.handleMcqSelect}
                submitting={demo.submitting}
                isSpeaking={demo.isSpeaking}
              />
            ) : teachingCard ? (
              <TeachingOverlay card={teachingCard} onDismiss={() => setTeachingCard(null)} />
            ) : questionForPanel ? (
              <ExercisePanel
                question={questionForPanel}
                answer={answer}
                feedback={feedback}
                showHint={showHint}
                onCheck={handleCheck}
                onHintToggle={() => setShowHint((h) => !h)}
              />
            ) : !lessonStarted ? (
              <div style={{ textAlign: 'center', color: '#aaa', fontSize: 15, fontWeight: 500, lineHeight: 1.6 }}>
                Your teacher is preparing the lesson…
              </div>
            ) : null}
          </div>

          {/* Chat panel */}
          {chatOpen && (
            <ChatPanel
              messages={isDemoMode ? demo.chatMessages : messages}
              onHide={() => setChatOpen(false)}
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
          />
        </div>

        {/* Single input bar for all lesson interactions */}
        <BottomControls
          isListening={isDemoMode ? demoListening : isListening}
          value={answer}
          onChange={setAnswer}
          onSubmit={handleSubmit}
          onToggleMic={isDemoMode ? toggleDemoMic : toggle}
          onExplain={handleExplain}
        />
      </div>

      {/* Demo overlays */}
      {isDemoMode && demo.phase === 'complete' && demo.finalResult && (
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
