import { useState, useEffect, useCallback, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import type { FeedbackState, TeachingCardData } from '../types'
import type { LessonSessionMetadata } from '../../../types/lessonTypes'
import { useLessonSession }  from '../hooks/useLessonSession'
import { useClassroomChat }  from '../hooks/useClassroomChat'
import { useVoiceSession }   from '../hooks/useVoiceSession'
import ClassroomHeader       from './ClassroomHeader'
import TeacherPanel          from './TeacherPanel'
import ExercisePanel         from './ExercisePanel'
import SectionProgressPanel  from './SectionProgressPanel'
import ChatPanel             from './ChatPanel'
import BottomControls        from './BottomControls'
import TeachingOverlay       from './TeachingOverlay'
import {
  createClassroomSocket,
  sendMessage,
  type BackendMessage,
} from '../services/classroomSocket'
import { useAuth, getStoredToken } from '../../../context/AuthContext'

// Env fallbacks (used when no route state is present, e.g. direct URL access)
const LESSON_UNIT = Number(import.meta.env.VITE_LESSON_UNIT ?? 1)
const ENV_SECTION = import.meta.env.VITE_LESSON_SECTION as string | undefined

export default function ClassroomLayout() {
  const location    = useLocation()
  const navigate    = useNavigate()
  const { isAuthenticated, isAuthLoading } = useAuth()
  const sessionMeta = (location.state as LessonSessionMetadata | null) ?? null

  // Resolve section from route state, falling back to env var
  const resolvedSection = sessionMeta?.sectionNumber ?? ENV_SECTION

  const wsRef = useRef<WebSocket | null>(null)

  // Stable send — reads wsRef at call time, never stale
  const send = useCallback((payload: object) => {
    sendMessage(wsRef.current, payload)
  }, [])

  // ── Hooks ─────────────────────────────────────────────────────────────────
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

  // ── Local UI state ────────────────────────────────────────────────────────
  const [answer,          setAnswer]          = useState('')
  const [feedback,        setFeedback]        = useState<FeedbackState>(null)
  const [showHint,        setShowHint]        = useState(false)
  const [chatOpen,        setChatOpen]        = useState(true)
  const [teachingCard,    setTeachingCard]    = useState<TeachingCardData | null>(null)
  const [confirmedAnswer, setConfirmedAnswer] = useState('')
  // True once the backend has sent the first message — resolves the preparing state
  const [lessonStarted,   setLessonStarted]   = useState(false)

  // Keep a ref so WS handler always reads the latest answer without stale closure
  const answerRef = useRef('')
  useEffect(() => { answerRef.current = answer }, [answer])

  // ── WS message handler (ref pattern — WS created once, handler always fresh) ──
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
        // Reset UI for the new exercise (answer + feedback cleared by useEffect below)
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
        // TODO: integrate with platform router — surface section grammar overview
        break

      case 'lesson_end':
        // TODO: integrate with platform router — redirect to lesson summary page
        break

      case 'error':
        console.error('[Classroom WS] error from backend:', msg.code, msg.message)
        break

      default: {
        const unknown = (msg as { type: string }).type
        console.warn('[Classroom UNKNOWN] unhandled event type:', unknown, msg)
        break
      }
    }
  }

  // ── Connect WS once auth is confirmed ────────────────────────────────────
  useEffect(() => {
    // Wait for auth state to resolve before connecting
    if (isAuthLoading) return

    // Redirect unauthenticated users away from Classroom
    if (!isAuthenticated) {
      navigate('/learning', { replace: true })
      return
    }

    const token = getStoredToken()
    const ws = createClassroomSocket(
      (msg) => onMessageRef.current(msg),
      () => {
        // Start lesson immediately on connect — use session metadata if available
        sendMessage(ws, {
          type:    'focus_lesson_start',
          payload: {
            unit: LESSON_UNIT,
            ...(resolvedSection        ? { section:   resolvedSection }            : {}),
            ...(sessionMeta?.teacherId ? { teacherId: sessionMeta.teacherId }      : {}),
            ...(sessionMeta?.voiceId   ? { voiceId:   sessionMeta.voiceId }        : {}),
          },
        })
      },
      () => {
        // TODO: integrate with platform router — show reconnection UI
      },
      token ?? undefined,
    )
    wsRef.current = ws
    return () => { ws.close() }
  }, [isAuthLoading, isAuthenticated])  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Side effects ──────────────────────────────────────────────────────────

  // Voice transcript auto-fills the text input
  useEffect(() => { if (transcript) setAnswer(transcript) }, [transcript])

  // Reset answer, feedback, hint when a new exercise arrives
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
    // answer cleared by feedback handler on correct, or by exercise change
  }, [answer, question, pushUser, setTyping, submitAnswer])

  const handleSubmit = useCallback(() => {
    if (!answer.trim()) return
    if (question) {
      handleCheck()
    } else {
      // No active exercise — free text message to teacher
      pushUser(answer)
      setTyping()
      send({ type: 'text_message', text: answer })
      setAnswer('')
    }
  }, [answer, question, handleCheck, pushUser, setTyping, send])

  const handleExplain = useCallback(() => {
    const lastAiText = messages
      .filter((m) => m.sender === 'ai' && !m.isTyping && m.text)
      .slice(-1)[0]?.text
    send({
      type:               'student_confused',
      lastTeacherMessage: lastAiText,
      lastExercise:       question?.sentence,
      studentLastAnswer:  answerRef.current || undefined,
    })
  }, [send, messages, question])

  // Expose confirmedAnswer to ExercisePanel via merged question object
  const questionForPanel = question
    ? { ...question, answer: confirmedAnswer }
    : null

  // ── Auth loading / redirect guard ────────────────────────────────────────
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

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{
      height: '100vh', display: 'flex', flexDirection: 'column',
      background: 'linear-gradient(160deg, #f0eeff 0%, #F5F5F7 40%, #fff5ee 100%)',
      overflow: 'hidden',
    }}>
      {/* Light blobs */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -160, left: -160, width: 700, height: 700, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,185,100,0.35) 0%, rgba(255,160,70,0.15) 45%, transparent 70%)', filter: 'blur(60px)' }} />
        <div style={{ position: 'absolute', bottom: -120, right: -120, width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(110,124,251,0.28) 0%, rgba(155,140,255,0.12) 45%, transparent 70%)', filter: 'blur(60px)' }} />
        <div style={{ position: 'absolute', top: '35%', left: '38%', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(155,140,255,0.12) 0%, transparent 70%)', filter: 'blur(80px)' }} />
      </div>

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
        <ClassroomHeader meta={sessionMeta} />

        {/*
          Chat closed: [Teacher 170px] [Center 1fr] [Section 220px]
          Chat open:   [Teacher 170px] [Center 1fr] [Chat 220px] [Section 150px]
        */}
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
            voiceState={{ isListening, isSpeaking, transcript }}
            onExplain={handleExplain}
            teacherName={sessionMeta?.teacherName}
            teacherAvatarUrl={sessionMeta?.teacherAvatarUrl}
          />

          {/* Center — exercise card, teaching overlay, or waiting state */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', minWidth: 0 }}>
            {teachingCard ? (
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
              <div style={{
                textAlign: 'center', color: '#aaa',
                fontSize: 15, fontWeight: 500, lineHeight: 1.6,
              }}>
                Your teacher is preparing the lesson…
              </div>
            ) : null}
          </div>

          {/* Chat panel — appears when open */}
          {chatOpen && (
            <ChatPanel messages={messages} onHide={() => setChatOpen(false)} />
          )}

          {/* Section timeline — always visible */}
          <SectionProgressPanel
            steps={steps}
            progress={progress}
            chatOpen={chatOpen}
            onOpenChat={() => setChatOpen(true)}
            onCloseChat={() => setChatOpen(false)}
            sectionNumber={sessionMeta?.sectionNumber}
            sectionTopic={sessionMeta?.sectionTopic ?? sessionMeta?.sectionTitle}
            exerciseCount={sessionMeta?.exerciseCount}
          />
        </div>

        {/* Bottom — SINGLE INPUT for all lesson interactions */}
        <BottomControls
          isListening={isListening}
          value={answer}
          onChange={setAnswer}
          onSubmit={handleSubmit}
          onToggleMic={toggle}
          onExplain={handleExplain}
        />
      </div>
    </div>
  )
}
