import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import TeacherPanel from '../features/classroom/components/TeacherPanel'
import type { LessonStep } from '../features/classroom/types'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

// ── Types ─────────────────────────────────────────────────────────────────────

interface TeacherMessage { text: string; delay: number }

interface StepContent {
  key: string
  index: number
  type: 'text_input' | 'mcq'
  teacherMessages: TeacherMessage[]
  prompt?: string
  placeholder?: string
  minLength: number
  options?: string[]
}

interface IntroContent { messages: TeacherMessage[] }

interface SessionData {
  id: string
  status: string
  stepIndex: number
  totalSteps: number
  isComplete: boolean
  interestArea: string
  demoMission: string
  intro: IntroContent
  currentStep: StepContent | null
  finalResult: FinalResult | null
}

interface FinalResult {
  level: string
  score: number
  strengths: string[]
  areas_to_improve: string[]
  teacher_message: string
}

interface FeedbackData {
  message: string
  correction: string | null
  score: number | null
  correct: boolean | null
}

type DemoChatMsg =
  | { from: 'teacher'; text: string; id: string }
  | { from: 'student'; text: string; id: string }
  | { from: 'feedback'; correct: boolean | null; message: string; correction: string | null; score: number | null; studentText?: string; id: string }

// ── Constants ─────────────────────────────────────────────────────────────────

const STEP_KEYS = ['warm_up', 'grammar_mcq', 'speaking_task', 'writing_task'] as const

const STEP_LABELS: Record<string, string> = {
  warm_up: 'Warm-up',
  grammar_mcq: 'Grammar',
  speaking_task: 'Speaking',
  writing_task: 'Writing',
}

const TOPIC_LABELS: Record<string, string> = {
  music_social: 'music & social life',
  games: 'gaming',
  movies_series: 'movies & series',
  travel: 'travel',
  school_life: 'school & studies',
  future_career: 'future plans',
}

function uid() { return Math.random().toString(36).slice(2) }
function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)) }
function bold(text: string) {
  return text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br/>')
}

// ── Main component ────────────────────────────────────────────────────────────

export default function DemoClassroomPage() {
  const { id }    = useParams<{ id: string }>()
  const navigate  = useNavigate()
  const { token } = useAuth()

  const [phase, setPhase]             = useState<'loading' | 'intro' | 'lesson' | 'complete' | 'error'>('loading')
  const [session, setSession]         = useState<SessionData | null>(null)
  const [messages, setMessages]       = useState<DemoChatMsg[]>([])
  const [currentStep, setCurrentStep] = useState<StepContent | null>(null)
  const [finalResult, setFinalResult] = useState<FinalResult | null>(null)
  const [inputValue, setInputValue]   = useState('')
  const [selectedOption, setSelected] = useState<number | null>(null)
  const [submitting, setSubmitting]   = useState(false)
  const [typing, setTyping]           = useState(false)
  const [isSpeaking, setIsSpeaking]   = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [completedSteps, setCompletedSteps] = useState<string[]>([])
  const [showLeaveModal, setShowLeaveModal] = useState(false)

  const bottomRef          = useRef<HTMLDivElement>(null)
  const didInit            = useRef(false)
  const currentTeacherMsgId = useRef<string | null>(null)

  const scrollToBottom = useCallback(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 80)
  }, [])

  // Append text to the active teacher bubble, or start a new one
  const appendToTeacher = useCallback((text: string) => {
    const existingId = currentTeacherMsgId.current
    if (existingId) {
      setMessages(prev => prev.map(m =>
        m.from === 'teacher' && m.id === existingId
          ? { ...m, text: m.text + ' ' + text }
          : m
      ))
    } else {
      const newId = uid()
      currentTeacherMsgId.current = newId
      setMessages(prev => [...prev, { from: 'teacher', text, id: newId }])
    }
    scrollToBottom()
  }, [scrollToBottom])

  // Play a sequence of messages, merging chunks into ONE teacher bubble
  const playMessages = useCallback(async (msgs: TeacherMessage[]) => {
    currentTeacherMsgId.current = null  // each playMessages call starts a fresh bubble
    for (const msg of msgs) {
      await sleep(msg.delay > 0 ? Math.min(msg.delay, 1600) : 0)
      setTyping(true)
      setIsSpeaking(true)
      scrollToBottom()
      await sleep(Math.min(400 + msg.text.length * 8, 1400))
      setTyping(false)
      setIsSpeaking(false)
      appendToTeacher(msg.text)
    }
  }, [appendToTeacher, scrollToBottom])

  // Load session
  useEffect(() => {
    if (didInit.current || !id || !token) return
    didInit.current = true

    async function init() {
      try {
        const res = await fetch(`${API_BASE}/demo/session/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) {
          const json = await res.json() as { code?: string }
          if (json.code === 'NOT_FOUND') { navigate('/'); return }
          throw new Error('Failed to load session')
        }
        const data = await res.json() as SessionData
        setSession(data)

        if (data.isComplete && data.finalResult) {
          setFinalResult(data.finalResult)
          setPhase('complete')
          return
        }

        setPhase('intro')
        await playMessages(data.intro.messages)
        setPhase('lesson')

        if (data.currentStep) {
          setCurrentStep(data.currentStep)
          await playMessages(data.currentStep.teacherMessages)
        }
      } catch {
        setError('Could not load your lesson. Please refresh.')
        setPhase('error')
      }
    }

    void init()
  }, [id, token, navigate, playMessages])

  async function handleSubmit() {
    if (!session || !currentStep || submitting) return
    if (currentStep.type === 'text_input' && inputValue.trim().length < currentStep.minLength) return
    if (currentStep.type === 'mcq' && selectedOption === null) return

    const answer = currentStep.type === 'mcq' ? String(selectedOption) : inputValue.trim()
    const displayAnswer = currentStep.type === 'mcq' && currentStep.options
      ? (currentStep.options[selectedOption!] ?? answer)
      : answer

    const studentSnapshot = displayAnswer
    currentTeacherMsgId.current = null  // next teacher messages get a fresh bubble

    setMessages(prev => [...prev, { from: 'student', text: displayAnswer, id: uid() }])
    setInputValue('')
    setSelected(null)
    setSubmitting(true)
    scrollToBottom()

    try {
      const res = await fetch(`${API_BASE}/demo/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ sessionId: session.id, stepKey: currentStep.key, answer }),
      })

      if (!res.ok) {
        const json = await res.json() as { message?: string; code?: string }
        if (json.code === 'INVALID_ANSWER') {
          setMessages(prev => [...prev, { from: 'teacher', text: json.message ?? 'Please try again.', id: uid() }])
          setSubmitting(false)
          return
        }
        throw new Error(json.message ?? 'Error')
      }

      const json = await res.json() as {
        feedback: FeedbackData
        nextStep: StepContent | null
        finalResult: FinalResult | null
        isComplete: boolean
      }

      await sleep(350)
      setTyping(true)
      setIsSpeaking(true)
      scrollToBottom()
      await sleep(900)
      setTyping(false)
      setIsSpeaking(false)

      setMessages(prev => [...prev, {
        from: 'feedback',
        correct: json.feedback.correct,
        message: json.feedback.message,
        correction: json.feedback.correction,
        score: json.feedback.score,
        studentText: json.feedback.correction ? studentSnapshot : undefined,
        id: uid(),
      }])
      scrollToBottom()
      setCompletedSteps(prev => [...prev, currentStep.key])

      if (json.isComplete && json.finalResult) {
        await sleep(1400)
        setFinalResult(json.finalResult)
        setPhase('complete')
        return
      }

      if (json.nextStep) {
        setCurrentStep(json.nextStep)
        await playMessages(json.nextStep.teacherMessages)
      }
    } catch {
      setMessages(prev => [...prev, { from: 'teacher', text: 'Something went wrong. Please try again.', id: uid() }])
    } finally {
      setSubmitting(false)
    }
  }

  // ── Derived state ─────────────────────────────────────────────────────────

  const lessonSteps: LessonStep[] = STEP_KEYS.map(key => ({
    id: key,
    label: STEP_LABELS[key]!,
    status: completedSteps.includes(key)
      ? 'done'
      : currentStep?.key === key
        ? 'active'
        : 'upcoming',
  }))

  const progress = Math.round((completedSteps.length / STEP_KEYS.length) * 100)

  // ── Loading / Error / Complete screens ────────────────────────────────────

  if (phase === 'loading') return <LoadingScreen />

  if (phase === 'error') {
    return (
      <div style={{ minHeight: '100vh', background: '#F5F5F7', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div style={{ background: 'white', borderRadius: 24, padding: 32, maxWidth: 360, width: '100%', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.12)' }}>
          <p style={{ color: '#64748B', marginBottom: 16 }}>{error ?? 'Something went wrong.'}</p>
          <button onClick={() => window.location.reload()} style={{ padding: '10px 24px', background: 'linear-gradient(135deg, #6E7CFB, #9B8CFF)', color: 'white', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Try again</button>
        </div>
      </div>
    )
  }

  if (phase === 'complete' && finalResult) {
    return (
      <ResultScreen
        result={finalResult}
        interestArea={session?.interestArea ?? ''}
        onNavigate={() => navigate('/pricing?from=demo_complete')}
      />
    )
  }

  // ── Main classroom render ─────────────────────────────────────────────────

  const activeStepKey = currentStep?.key ?? null

  return (
    <div style={{
      height: '100vh', display: 'flex', flexDirection: 'column',
      background: 'linear-gradient(160deg, #f0eeff 0%, #F5F5F7 40%, #fff5ee 100%)',
      overflow: 'hidden',
    }}>
      {/* Ambient blobs — identical to paid classroom */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -160, left: -160, width: 700, height: 700, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,185,100,0.35) 0%, rgba(255,160,70,0.15) 45%, transparent 70%)', filter: 'blur(60px)' }} />
        <div style={{ position: 'absolute', bottom: -120, right: -120, width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(110,124,251,0.28) 0%, rgba(155,140,255,0.12) 45%, transparent 70%)', filter: 'blur(60px)' }} />
        <div style={{ position: 'absolute', top: '35%', left: '38%', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(155,140,255,0.12) 0%, transparent 70%)', filter: 'blur(80px)' }} />
      </div>

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
        <DemoHeader
          activeStepLabel={activeStepKey ? STEP_LABELS[activeStepKey] : 'Intro'}
          onLeave={() => setShowLeaveModal(true)}
        />

        {/* Mobile step strip */}
        <div className="lg:hidden" style={{ background: 'rgba(255,255,255,0.85)', borderBottom: '1px solid rgba(0,0,0,0.05)', padding: '8px 16px', display: 'flex', gap: 6 }}>
          {STEP_KEYS.map(key => {
            const done   = completedSteps.includes(key)
            const active = currentStep?.key === key && !done
            return (
              <div key={key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ height: 3, width: '100%', borderRadius: 99, background: done ? '#6E7CFB' : active ? 'rgba(110,124,251,0.4)' : '#e8e8f0', transition: 'background 0.4s' }} />
                <span style={{ fontSize: 9, fontWeight: 700, color: done ? '#6E7CFB' : active ? '#888' : '#ccc' }}>
                  {done ? `✓ ${STEP_LABELS[key]}` : STEP_LABELS[key]}
                </span>
              </div>
            )
          })}
        </div>

        {/* Desktop 3-column grid */}
        <div
          className="grid grid-cols-1 lg:grid-cols-[170px_1fr_200px]"
          style={{ flex: 1, minHeight: 0, gap: 14, padding: '14px 20px', overflow: 'hidden' }}
        >
          {/* Left: teacher panel — desktop only */}
          <div className="hidden lg:block" style={{ height: '100%' }}>
            <TeacherPanel
              voiceState={{ isListening: false, isSpeaking, transcript: '' }}
              onExplain={() => {}}
              teacherName="Alex"
            />
          </div>

          {/* Center: chat area */}
          <div style={{
            background: 'rgba(255,255,255,0.75)',
            backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
            borderRadius: 20,
            border: '1px solid rgba(255,255,255,0.7)',
            boxShadow: '0 2px 0 rgba(255,255,255,0.9) inset, 0 10px 30px rgba(0,0,0,0.06)',
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden', minHeight: 0,
          }}>
            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 8px' }}>
              {messages.map(msg => (
                <DemoChatBubble key={msg.id} msg={msg} />
              ))}

              {typing && (
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, marginBottom: 12 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 9, background: 'linear-gradient(135deg, #6E7CFB, #9B8CFF)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 10, fontWeight: 800, flexShrink: 0 }}>A</div>
                  <div style={{ background: 'white', borderRadius: '14px 14px 14px 3px', padding: '10px 14px', border: '1px solid #f0f0f8', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                    <span className="cls-typing-dot" />
                    <span className="cls-typing-dot" />
                    <span className="cls-typing-dot" />
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input area */}
            <div style={{ borderTop: '1px solid rgba(0,0,0,0.05)', padding: '12px 16px', flexShrink: 0 }}>
              {phase === 'lesson' && currentStep && (
                <>
                  {currentStep.type === 'mcq' && currentStep.options ? (
                    <McqInput
                      prompt={currentStep.prompt}
                      options={currentStep.options}
                      selected={selectedOption}
                      onSelect={setSelected}
                      onSubmit={handleSubmit}
                      submitting={submitting}
                    />
                  ) : (
                    <TextInput
                      value={inputValue}
                      onChange={setInputValue}
                      onSubmit={handleSubmit}
                      placeholder={currentStep.placeholder ?? 'Type your answer…'}
                      minLength={currentStep.minLength}
                      submitting={submitting}
                    />
                  )}
                </>
              )}
              {(phase === 'intro' || (phase === 'lesson' && !currentStep)) && (
                <div style={{ textAlign: 'center', color: '#bbb', fontSize: 13, padding: '6px 0' }}>
                  Listening to your teacher…
                </div>
              )}
            </div>
          </div>

          {/* Right: progress panel — desktop only */}
          <div className="hidden lg:block" style={{ height: '100%' }}>
            <DemoProgressPanel
              steps={lessonSteps}
              progress={progress}
            />
          </div>
        </div>
      </div>

      {showLeaveModal && (
        <LeaveModal
          onStay={() => setShowLeaveModal(false)}
          onLeave={() => navigate('/')}
        />
      )}
    </div>
  )
}

// ── DemoHeader ────────────────────────────────────────────────────────────────

function DemoHeader({ activeStepLabel, onLeave }: { activeStepLabel: string; onLeave: () => void }) {
  return (
    <div style={{
      height: 56, flexShrink: 0,
      background: 'rgba(255,255,255,0.72)',
      backdropFilter: 'blur(28px)', WebkitBackdropFilter: 'blur(28px)',
      borderBottom: '1px solid rgba(255,255,255,0.45)',
      boxShadow: '0 1px 0 rgba(0,0,0,0.04)',
      display: 'flex', alignItems: 'center', padding: '0 24px',
      position: 'sticky', top: 0, zIndex: 50,
      gap: 12,
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <div style={{ width: 30, height: 30, borderRadius: 9, background: 'linear-gradient(135deg, #6E7CFB, #9B8CFF)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 11, color: 'white', letterSpacing: '-0.5px', boxShadow: '0 3px 10px rgba(110,124,251,0.4)' }}>Ai</div>
        <span style={{ fontWeight: 800, fontSize: 15, color: '#1a1a2e', letterSpacing: '-0.3px', whiteSpace: 'nowrap' }}>AI Teacher</span>
      </div>

      {/* Center: Live demo badge + current step */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 99, padding: '3px 10px', fontSize: 11, fontWeight: 700, color: '#16a34a' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block', animation: 'cls-halo-breathe 1.5s ease-in-out infinite' }} />
          Live demo
        </span>
        <span style={{ fontSize: 13, color: '#c5c5d5' }}>·</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e' }}>{activeStepLabel}</span>
      </div>

      {/* Teacher chip + exit */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 9, background: '#f5f5f7', border: '1px solid #ebebf0' }}>
          <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'linear-gradient(135deg, #6E7CFB, #9B8CFF)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: 'white' }}>A</div>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#1a1a2e' }}>Alex</span>
        </div>
        <button
          onClick={onLeave}
          style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: '1.5px solid #e8e8f0', borderRadius: 9, padding: '5px 12px', cursor: 'pointer', color: '#888', fontSize: 12, fontWeight: 600 }}
        >
          ← Exit
        </button>
      </div>
    </div>
  )
}

// ── DemoProgressPanel ─────────────────────────────────────────────────────────

const IC_CHECK = (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
    <path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

function DemoProgressPanel({ steps, progress }: { steps: LessonStep[]; progress: number }) {
  const donePct = `${progress}%`

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      background: 'rgba(255,255,255,0.72)',
      backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      borderRadius: 20,
      boxShadow: '0 2px 0 rgba(255,255,255,0.9) inset, 0 10px 30px rgba(0,0,0,0.06)',
      border: '1px solid rgba(255,255,255,0.7)',
      overflow: 'hidden', height: '100%', minHeight: 0,
      padding: '20px 16px',
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#aaa', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 3 }}>Demo Lesson</div>
      <div style={{ fontSize: 14, fontWeight: 800, color: '#1a1a2e', letterSpacing: '-0.3px', marginBottom: 6, lineHeight: 1.25 }}>Free AI Session</div>
      <div style={{ fontSize: 11, color: '#aaa', fontWeight: 600, marginBottom: 14 }}>
        {steps.filter(s => s.status === 'done').length} / {steps.length} steps
      </div>

      {/* Timeline */}
      <div style={{ position: 'relative', flex: 1, overflowY: 'auto' }}>
        <div style={{
          position: 'absolute', left: 11, top: 12, bottom: 12,
          width: 1.5, borderRadius: 99,
          background: `linear-gradient(to bottom, #22c55e ${donePct}, #e8e8f0 ${donePct})`,
          zIndex: 0,
        }} />
        {steps.map((step, i) => {
          const done   = step.status === 'done'
          const active = step.status === 'active'
          return (
            <div key={step.id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '7px 8px 7px 0', position: 'relative', zIndex: 1,
              borderRadius: 9,
              background: active ? 'rgba(110,124,251,0.07)' : 'transparent',
              marginBottom: 2,
            }}>
              <div style={{
                width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: done   ? 'linear-gradient(135deg,#4ade80,#22c55e)' :
                            active ? 'linear-gradient(135deg,#6E7CFB,#9B8CFF)'  : 'white',
                border: !done && !active ? '1.5px solid #e0e0e8' : 'none',
                boxShadow: done   ? '0 2px 8px rgba(34,197,94,0.3)'    :
                           active ? '0 2px 8px rgba(110,124,251,0.35)' : 'none',
              }}>
                {done
                  ? IC_CHECK
                  : <span style={{ fontSize: 9, fontWeight: 700, color: active ? 'white' : '#bbb' }}>{i + 1}</span>
                }
              </div>
              <span style={{
                fontSize: 12.5,
                fontWeight: active ? 700 : done ? 500 : 400,
                color: active ? '#6E7CFB' : done ? '#666' : '#aaa',
                lineHeight: 1.2,
              }}>
                {step.label}
              </span>
              {active && (
                <div style={{ marginLeft: 'auto', width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: '#6E7CFB', boxShadow: '0 0 6px rgba(110,124,251,0.7)', animation: 'cls-halo-breathe 1.5s ease-in-out infinite' }} />
              )}
            </div>
          )
        })}
      </div>

      {/* Progress bar */}
      <div style={{ marginTop: 16, flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 11.5, color: '#888', fontWeight: 600 }}>Progress</span>
          <span style={{ fontSize: 11.5, fontWeight: 800, color: '#1a1a2e' }}>{progress}%</span>
        </div>
        <div style={{ height: 5, background: '#ede9ff', borderRadius: 99, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg,#6E7CFB,#9B8CFF)', borderRadius: 99, boxShadow: '0 2px 6px rgba(110,124,251,0.4)', transition: 'width 0.8s ease' }} />
        </div>
      </div>
    </div>
  )
}

// ── DemoChatBubble ────────────────────────────────────────────────────────────

function DemoChatBubble({ msg }: { msg: DemoChatMsg }) {
  if (msg.from === 'teacher') {
    return (
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, marginBottom: 12 }} className="cls-slide-up">
        <div style={{ width: 30, height: 30, borderRadius: 9, background: 'linear-gradient(135deg, #6E7CFB, #9B8CFF)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 10, fontWeight: 800, flexShrink: 0 }}>A</div>
        <div style={{ background: 'white', borderRadius: '16px 16px 16px 4px', padding: '12px 16px', maxWidth: '78%', border: '1px solid #f0f0f8', boxShadow: '0 2px 10px rgba(0,0,0,0.04)' }}>
          <p style={{ fontSize: 14, color: '#1a1a2e', lineHeight: 1.6, margin: 0 }} dangerouslySetInnerHTML={{ __html: bold(msg.text) }} />
        </div>
      </div>
    )
  }

  if (msg.from === 'student') {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }} className="cls-slide-up">
        <div style={{ background: 'linear-gradient(135deg, #6E7CFB, #7b8cfb)', borderRadius: '16px 16px 4px 16px', padding: '12px 16px', maxWidth: '78%', boxShadow: '0 4px 16px rgba(110,124,251,0.25)' }}>
          <p style={{ fontSize: 14, color: 'white', lineHeight: 1.6, margin: 0 }}>{msg.text}</p>
        </div>
      </div>
    )
  }

  // Feedback bubble
  const isCorrect = msg.correct === true
  const isWrong   = msg.correct === false

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, marginBottom: 12 }} className="cls-slide-up">
      <div style={{ width: 30, height: 30, borderRadius: 9, background: 'linear-gradient(135deg, #6E7CFB, #9B8CFF)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 10, fontWeight: 800, flexShrink: 0 }}>A</div>
      <div style={{
        borderRadius: '16px 16px 16px 4px', padding: '14px 16px', maxWidth: '84%', boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
        background: isCorrect ? '#f0fdf4' : isWrong ? '#fff7ed' : '#eff6ff',
        border: `1px solid ${isCorrect ? '#bbf7d0' : isWrong ? '#fed7aa' : '#bfdbfe'}`,
      }}>
        {msg.correct !== null && (
          <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 6, color: isCorrect ? '#16a34a' : '#d97706' }}>
            {isCorrect ? '✓ Correct!' : "✗ Not quite — here's the fix:"}
          </div>
        )}

        <p style={{ fontSize: 14, color: '#1a1a2e', lineHeight: 1.6, margin: 0 }}>{msg.message}</p>

        {/* Before/After correction card */}
        {msg.correction && msg.studentText && (
          <div style={{ marginTop: 10, borderRadius: 12, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
            <div style={{ padding: '8px 12px', background: '#fef2f2', borderBottom: '1px solid #fecaca' }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: '#f87171', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 2px' }}>You said</p>
              <p style={{ fontSize: 13, color: '#dc2626', textDecoration: 'line-through', margin: 0 }}>{msg.studentText}</p>
            </div>
            <div style={{ padding: '8px 12px', background: '#f0fdf4' }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 2px' }}>Better version</p>
              <p style={{ fontSize: 13, color: '#15803d', fontWeight: 600, margin: 0 }}>{msg.correction}</p>
            </div>
          </div>
        )}
        {msg.correction && !msg.studentText && (
          <div style={{ marginTop: 10, padding: '8px 12px', background: '#f0fdf4', borderRadius: 10, border: '1px solid #bbf7d0' }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 2px' }}>Better version</p>
            <p style={{ fontSize: 13, color: '#15803d', fontWeight: 600, margin: 0 }}>{msg.correction}</p>
          </div>
        )}

        {msg.score !== null && msg.score !== undefined && (
          <div style={{ marginTop: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 11, color: '#64748b' }}>Score</span>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#1a1a2e' }}>{msg.score}/10</span>
            </div>
            <div style={{ height: 5, background: '#e2e8f0', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${((msg.score) / 10) * 100}%`, background: 'linear-gradient(90deg, #6E7CFB, #9B8CFF)', borderRadius: 99, transition: 'width 0.7s ease' }} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── McqInput ──────────────────────────────────────────────────────────────────

function McqInput({
  prompt, options, selected, onSelect, onSubmit, submitting,
}: {
  prompt?: string; options: string[]; selected: number | null
  onSelect: (i: number) => void; onSubmit: () => void; submitting: boolean
}) {
  const autoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleSelect(i: number) {
    if (submitting) return
    onSelect(i)
    if (autoTimer.current) clearTimeout(autoTimer.current)
    autoTimer.current = setTimeout(onSubmit, 650)
  }

  return (
    <div>
      {/* Show the sentence/context so student doesn't need to scroll up */}
      {prompt && (
        <div style={{ background: 'linear-gradient(135deg, rgba(110,124,251,0.06), rgba(155,140,255,0.04))', borderRadius: 12, padding: '10px 14px', marginBottom: 10, border: '1px solid rgba(110,124,251,0.12)' }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#9B8CFF', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 4px' }}>Complete the sentence</p>
          <p style={{ fontSize: 14, fontWeight: 600, color: '#1a1a2e', margin: 0, lineHeight: 1.5 }}>{prompt}</p>
        </div>
      )}
      <p style={{ fontSize: 11, fontWeight: 600, color: '#aaa', marginBottom: 8 }}>Tap the correct option:</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {options.map((opt, i) => (
          <button
            key={i}
            onClick={() => handleSelect(i)}
            disabled={submitting}
            style={{
              padding: '10px 12px', borderRadius: 14, textAlign: 'left',
              fontSize: 13, fontWeight: 600, cursor: submitting ? 'default' : 'pointer',
              transition: 'all 0.15s',
              background: selected === i
                ? 'linear-gradient(135deg, #6E7CFB, #9B8CFF)'
                : 'rgba(245,245,247,0.9)',
              color: selected === i ? 'white' : '#374151',
              border: selected === i ? 'none' : '1px solid #e5e7eb',
              boxShadow: selected === i ? '0 4px 14px rgba(110,124,251,0.35)' : '0 1px 3px rgba(0,0,0,0.04)',
              transform: selected === i ? 'scale(1.02)' : 'scale(1)',
            }}
          >
            {opt}
          </button>
        ))}
      </div>
      {submitting && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 10, color: '#9B8CFF', fontSize: 12, fontWeight: 600 }}>
          <span className="animate-spin" style={{ display: 'inline-block', width: 12, height: 12, border: '2px solid #9B8CFF', borderTopColor: 'transparent', borderRadius: '50%' }} />
          Checking…
        </div>
      )}
    </div>
  )
}

// ── TextInput ─────────────────────────────────────────────────────────────────

function TextInput({
  value, onChange, onSubmit, placeholder, minLength, submitting,
}: {
  value: string; onChange: (v: string) => void; onSubmit: () => void
  placeholder: string; minLength: number; submitting: boolean
}) {
  const canSubmit = value.trim().length >= minLength && !submitting
  const [focused, setFocused] = useState(false)

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
      <div style={{
        flex: 1, display: 'flex', alignItems: 'flex-end',
        background: focused ? 'white' : '#f8f8fa',
        borderRadius: 16,
        border: `1.5px solid ${focused ? 'rgba(110,124,251,0.45)' : 'rgba(110,124,251,0.15)'}`,
        boxShadow: focused ? '0 0 0 3px rgba(110,124,251,0.1)' : 'none',
        transition: 'all 0.2s', padding: '2px 8px 2px 12px',
      }}>
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && canSubmit) { e.preventDefault(); onSubmit() } }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          rows={2}
          disabled={submitting}
          style={{
            flex: 1, resize: 'none', border: 'none', background: 'transparent',
            fontSize: 14, color: '#1a1a2e', lineHeight: 1.5, padding: '8px 0',
            fontFamily: 'inherit', outline: 'none',
          }}
        />
      </div>
      <button
        onClick={onSubmit}
        disabled={!canSubmit}
        style={{
          width: 44, height: 44, borderRadius: 14, border: 'none', flexShrink: 0,
          background: canSubmit
            ? 'linear-gradient(135deg, #6E7CFB, #9B8CFF)'
            : '#e8e8f0',
          cursor: canSubmit ? 'pointer' : 'default',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: canSubmit ? '0 4px 16px rgba(110,124,251,0.4)' : 'none',
          transition: 'all 0.2s', alignSelf: 'flex-end',
        }}
      >
        {submitting ? (
          <span className="animate-spin" style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%' }} />
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={canSubmit ? 'white' : '#bbb'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        )}
      </button>
    </div>
  )
}

// ── LeaveModal ────────────────────────────────────────────────────────────────

function LeaveModal({ onStay, onLeave }: { onStay: () => void; onLeave: () => void }) {
  return (
    <div
      onClick={onStay}
      style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: 'white', borderRadius: 24, padding: '32px 28px', maxWidth: 420, width: '100%', boxShadow: '0 32px 64px rgba(15,23,42,0.22)' }}
      >
        <div style={{ fontSize: 28, marginBottom: 12 }}>⚠️</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#0F172A', marginBottom: 10 }}>
          Leave your free demo lesson?
        </div>
        <div style={{ fontSize: 14, color: '#64748B', lineHeight: 1.65, marginBottom: 24 }}>
          Your free demo lesson can only be started <strong>once</strong>. If you leave now, you may lose access to this free attempt and won't be able to restart it for free.
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
            style={{ flex: 1, padding: '12px 0', borderRadius: 14, border: 'none', background: 'linear-gradient(135deg, #EF4444, #DC2626)', color: 'white', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
          >
            Leave anyway
          </button>
        </div>
      </div>
    </div>
  )
}

// ── LoadingScreen ─────────────────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #f0eeff 0%, #F5F5F7 40%, #fff5ee 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        <div style={{ width: 48, height: 48, borderRadius: 14, background: 'linear-gradient(135deg, #6E7CFB, #9B8CFF)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 20, fontWeight: 900, boxShadow: '0 6px 24px rgba(110,124,251,0.4)' }}>A</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <span className="cls-typing-dot" style={{ animationDelay: '0s' }} />
          <span className="cls-typing-dot" style={{ animationDelay: '0.15s' }} />
          <span className="cls-typing-dot" style={{ animationDelay: '0.3s' }} />
        </div>
        <p style={{ fontSize: 13, color: '#aaa', margin: 0 }}>Setting up your lesson…</p>
      </div>
    </div>
  )
}

// ── ResultScreen ──────────────────────────────────────────────────────────────

function ResultScreen({
  result, interestArea, onNavigate,
}: {
  result: FinalResult; interestArea: string; onNavigate: () => void
}) {
  const scoreColor = result.score >= 70 ? '#16a34a' : result.score >= 50 ? '#d97706' : '#ea580c'
  const scoreGrad  = result.score >= 70 ? 'from-green-400 to-emerald-500' : result.score >= 50 ? 'from-yellow-400 to-amber-500' : 'from-orange-400 to-red-400'
  const topicName  = TOPIC_LABELS[interestArea] ?? 'your interests'

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #f0eeff 0%, #F5F5F7 40%, #fff5ee 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 16px' }}>
      <div style={{ width: '100%', maxWidth: 460 }}>
        <div style={{ background: 'white', borderRadius: 28, boxShadow: '0 32px 80px rgba(0,0,0,0.12)', overflow: 'hidden' }}>
          <div style={{ height: 4, background: 'linear-gradient(90deg, #6E7CFB, #9B8CFF, #a78bfa)' }} />
          <div style={{ padding: '32px 28px' }}>
            {/* Complete badge */}
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#f0fdf4', color: '#16a34a', borderRadius: 99, padding: '6px 16px', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 20 }}>
                ✓ Demo lesson complete
              </div>

              {/* Score + level */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24, marginBottom: 16 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 52, fontWeight: 900, color: scoreColor, lineHeight: 1 }}>{result.score}</div>
                  <p style={{ fontSize: 11, color: '#94a3b8', margin: '4px 0 0' }}>out of 100</p>
                </div>
                <div style={{ height: 48, width: 1, background: '#e2e8f0' }} />
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 36, fontWeight: 900, color: '#6E7CFB', lineHeight: 1 }}>{result.level}</div>
                  <p style={{ fontSize: 11, color: '#94a3b8', margin: '4px 0 0' }}>English level</p>
                </div>
              </div>

              <div className={`h-2 bg-gray-100 rounded-full overflow-hidden`}>
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${scoreGrad}`}
                  style={{ width: `${result.score}%`, transition: 'width 1.2s cubic-bezier(0.4,0,0.2,1)' }}
                />
              </div>
            </div>

            {/* Teacher message */}
            <div style={{ background: 'linear-gradient(135deg, #f8f7ff, #fff8f4)', borderRadius: 18, padding: '16px', marginBottom: 20, display: 'flex', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 11, background: 'linear-gradient(135deg, #6E7CFB, #9B8CFF)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 13, fontWeight: 800, flexShrink: 0 }}>A</div>
              <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.65, margin: 0 }}>{result.teacher_message}</p>
            </div>

            {/* Strengths + areas */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
              <div style={{ background: '#f0fdf4', borderRadius: 18, padding: '14px' }}>
                <p style={{ fontSize: 9, fontWeight: 800, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px' }}>Your strengths</p>
                {result.strengths.map((s, i) => (
                  <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                    <span style={{ color: '#22c55e', flexShrink: 0, marginTop: 1 }}>✓</span>
                    <span style={{ fontSize: 12, color: '#166534', lineHeight: 1.4 }}>{s}</span>
                  </div>
                ))}
              </div>
              <div style={{ background: '#eff6ff', borderRadius: 18, padding: '14px' }}>
                <p style={{ fontSize: 9, fontWeight: 800, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px' }}>Next to work on</p>
                {result.areas_to_improve.map((a, i) => (
                  <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                    <span style={{ color: '#60a5fa', flexShrink: 0, marginTop: 1 }}>→</span>
                    <span style={{ fontSize: 12, color: '#1e40af', lineHeight: 1.4 }}>{a}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* CTA */}
            <button
              onClick={onNavigate}
              style={{ width: '100%', padding: '16px', borderRadius: 18, border: 'none', background: 'linear-gradient(135deg, #6E7CFB, #9B8CFF)', color: 'white', fontSize: 15, fontWeight: 800, cursor: 'pointer', boxShadow: '0 8px 28px rgba(110,124,251,0.4)', transition: 'all 0.2s', letterSpacing: '-0.2px' }}
            >
              Keep improving with {topicName} →
            </button>
            <p style={{ textAlign: 'center', fontSize: 12, color: '#94a3b8', marginTop: 10 }}>Your next lesson is already personalised · cancel anytime</p>
          </div>
        </div>
      </div>
    </div>
  )
}
