import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

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

interface Feedback {
  message: string
  correction: string | null
  score: number | null
  correct: boolean | null
}

type ChatMessage =
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function uid(): string {
  return Math.random().toString(36).slice(2)
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function DemoClassroomPage() {
  const { id }    = useParams<{ id: string }>()
  const navigate  = useNavigate()
  const { token } = useAuth()

  const [phase, setPhase]             = useState<'loading' | 'intro' | 'lesson' | 'complete' | 'error'>('loading')
  const [session, setSession]         = useState<SessionData | null>(null)
  const [messages, setMessages]       = useState<ChatMessage[]>([])
  const [currentStep, setCurrentStep] = useState<StepContent | null>(null)
  const [finalResult, setFinalResult] = useState<FinalResult | null>(null)
  const [inputValue, setInputValue]   = useState('')
  const [selectedOption, setSelected] = useState<number | null>(null)
  const [submitting, setSubmitting]   = useState(false)
  const [typing, setTyping]           = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [completedSteps, setCompletedSteps] = useState<string[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)
  const didInit   = useRef(false)

  const scrollToBottom = useCallback(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 80)
  }, [])

  const addTeacherMessage = useCallback((text: string) => {
    setMessages(prev => [...prev, { from: 'teacher', text, id: uid() }])
    scrollToBottom()
  }, [scrollToBottom])

  // Variable typing duration — longer messages feel more deliberate
  const playMessages = useCallback(async (msgs: TeacherMessage[]) => {
    for (const msg of msgs) {
      await sleep(msg.delay > 0 ? Math.min(msg.delay, 1600) : 0)
      setTyping(true)
      scrollToBottom()
      const typingMs = Math.min(450 + msg.text.length * 9, 1500)
      await sleep(typingMs)
      setTyping(false)
      addTeacherMessage(msg.text)
    }
  }, [addTeacherMessage, scrollToBottom])

  // Load session on mount
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

    const answer = currentStep.type === 'mcq'
      ? String(selectedOption)
      : inputValue.trim()

    const displayAnswer = currentStep.type === 'mcq' && currentStep.options
      ? (currentStep.options[selectedOption!] ?? answer)
      : answer

    // Capture student text before clearing state — used for before/after correction card
    const studentTextSnapshot = displayAnswer

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
        feedback: Feedback
        nextStep: StepContent | null
        finalResult: FinalResult | null
        isComplete: boolean
      }

      await sleep(350)
      setTyping(true)
      scrollToBottom()
      await sleep(950)
      setTyping(false)
      setMessages(prev => [...prev, {
        from: 'feedback',
        correct: json.feedback.correct,
        message: json.feedback.message,
        correction: json.feedback.correction,
        score: json.feedback.score,
        // Only pass studentText when there is a correction to show the before/after card
        studentText: json.feedback.correction ? studentTextSnapshot : undefined,
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

  // ── Render ──────────────────────────────────────────────────────────────────

  if (phase === 'loading') {
    return (
      <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#4f6ef7] to-[#818cf8] flex items-center justify-center text-white text-xl font-bold shadow-lg">A</div>
          <div className="flex gap-1.5">
            {[0, 1, 2].map(i => (
              <div key={i} className="w-2 h-2 rounded-full bg-[#4f6ef7] animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
          <p className="text-sm text-gray-400">Setting up your lesson…</p>
        </div>
      </div>
    )
  }

  if (phase === 'error') {
    return (
      <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center px-4">
        <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-xl">
          <p className="text-gray-600 mb-4">{error ?? 'Something went wrong.'}</p>
          <button onClick={() => window.location.reload()} className="px-6 py-2.5 bg-[#4f6ef7] text-white rounded-xl text-sm font-semibold">Try again</button>
        </div>
      </div>
    )
  }

  if (phase === 'complete' && finalResult) {
    return (
      <ResultScreen
        result={finalResult}
        interestArea={session?.interestArea ?? ''}
        onNavigate={() => navigate('/pricing')}
      />
    )
  }

  return (
    <div className="min-h-screen bg-[#F5F5F7] flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 sticky top-0 z-10 shadow-sm">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#4f6ef7] to-[#818cf8] flex items-center justify-center text-white text-sm font-bold shadow">A</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800 truncate">Alex — AI English Teacher</p>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <p className="text-xs text-green-600 font-medium">Live demo lesson</p>
          </div>
        </div>
      </div>

      {/* Step progress strip */}
      <div className="bg-white border-b border-gray-100 px-4 py-2.5 flex gap-1.5">
        {STEP_KEYS.map(key => {
          const done   = completedSteps.includes(key)
          const active = currentStep?.key === key && !done
          return (
            <div key={key} className="flex-1 flex flex-col items-center gap-1">
              <div className={`h-1 w-full rounded-full transition-all duration-500 ${done ? 'bg-[#4f6ef7]' : active ? 'bg-[#4f6ef7]/40' : 'bg-gray-200'}`} />
              <span className={`text-[9px] font-semibold transition-colors ${done ? 'text-[#4f6ef7]' : active ? 'text-gray-500' : 'text-gray-300'}`}>
                {done ? `✓ ${STEP_LABELS[key]}` : STEP_LABELS[key]}
              </span>
            </div>
          )
        })}
      </div>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map(msg => (
          <ChatBubble key={msg.id} msg={msg} />
        ))}

        {typing && (
          <div className="flex items-end gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#4f6ef7] to-[#818cf8] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">A</div>
            <div className="bg-white rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm border border-gray-100">
              <div className="flex gap-1">
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      {phase === 'lesson' && currentStep && (
        <div className="bg-white border-t border-gray-100 px-4 py-3 sticky bottom-0">
          {currentStep.type === 'mcq' && currentStep.options ? (
            <McqInput
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
        </div>
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ChatBubble({ msg }: { msg: ChatMessage }) {
  if (msg.from === 'teacher') {
    return (
      <div className="flex items-end gap-2">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#4f6ef7] to-[#818cf8] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">A</div>
        <div className="bg-white rounded-2xl rounded-bl-sm px-4 py-3 max-w-[78%] shadow-sm border border-gray-100">
          <p className="text-sm text-gray-800 leading-relaxed" dangerouslySetInnerHTML={{ __html: formatText(msg.text) }} />
        </div>
      </div>
    )
  }

  if (msg.from === 'student') {
    return (
      <div className="flex justify-end">
        <div className="bg-gradient-to-br from-[#4f6ef7] to-[#6b82f8] rounded-2xl rounded-br-sm px-4 py-3 max-w-[78%] shadow-sm">
          <p className="text-sm text-white leading-relaxed">{msg.text}</p>
        </div>
      </div>
    )
  }

  // ── Feedback bubble ──────────────────────────────────────────────────────────
  const isCorrect = msg.correct === true
  const isWrong   = msg.correct === false
  const hasScore  = msg.score !== null && msg.score !== undefined

  return (
    <div className="flex items-end gap-2">
      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#4f6ef7] to-[#818cf8] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">A</div>
      <div className={`rounded-2xl rounded-bl-sm px-4 py-3.5 max-w-[84%] shadow-sm border space-y-2.5 ${
        isCorrect ? 'bg-green-50 border-green-100'
        : isWrong  ? 'bg-orange-50 border-orange-100'
        : 'bg-blue-50 border-blue-100'
      }`}>
        {/* Status label */}
        {msg.correct !== null && (
          <div className={`text-xs font-bold ${isCorrect ? 'text-green-600' : 'text-orange-600'}`}>
            {isCorrect
              ? '✓ Correct!'
              : "✗ Not quite — here's the fix:"}
          </div>
        )}

        <p className="text-sm text-gray-800 leading-relaxed">{msg.message}</p>

        {/* Before / After correction card */}
        {msg.correction && msg.studentText && (
          <div className="rounded-xl border border-gray-200 overflow-hidden text-xs bg-white">
            <div className="px-3 py-2 bg-red-50 border-b border-red-100">
              <p className="text-[9px] font-bold text-red-400 uppercase tracking-wider mb-0.5">You said</p>
              <p className="text-red-600 line-through leading-snug">{msg.studentText}</p>
            </div>
            <div className="px-3 py-2 bg-green-50">
              <p className="text-[9px] font-bold text-green-600 uppercase tracking-wider mb-0.5">Better version</p>
              <p className="text-green-700 font-semibold leading-snug">{msg.correction}</p>
            </div>
          </div>
        )}
        {/* Correction without original student text */}
        {msg.correction && !msg.studentText && (
          <div className="rounded-xl border border-green-100 overflow-hidden text-xs">
            <div className="px-3 py-2 bg-green-50">
              <p className="text-[9px] font-bold text-green-600 uppercase tracking-wider mb-0.5">Better version</p>
              <p className="text-green-700 font-semibold leading-snug">{msg.correction}</p>
            </div>
          </div>
        )}

        {/* Score bar */}
        {hasScore && (
          <div>
            <div className="flex items-center justify-between text-[10px] mb-1">
              <span className="text-gray-500">Your score</span>
              <span className="font-bold text-gray-700">{msg.score}/10</span>
            </div>
            <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#4f6ef7] to-[#818cf8] transition-all duration-700"
                style={{ width: `${((msg.score ?? 0) / 10) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function formatText(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br/>')
}

function TextInput({
  value, onChange, onSubmit, placeholder, minLength, submitting,
}: {
  value: string; onChange: (v: string) => void; onSubmit: () => void
  placeholder: string; minLength: number; submitting: boolean
}) {
  const canSubmit = value.trim().length >= minLength && !submitting

  return (
    <div className="flex gap-2">
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && canSubmit) { e.preventDefault(); onSubmit() } }}
        placeholder={placeholder}
        rows={2}
        className="flex-1 resize-none rounded-2xl border border-gray-200 px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#4f6ef7]/30 focus:border-[#4f6ef7] transition-all"
        disabled={submitting}
      />
      <button
        onClick={onSubmit}
        disabled={!canSubmit}
        className="w-11 h-11 self-end rounded-2xl bg-gradient-to-br from-[#4f6ef7] to-[#6b82f8] text-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:from-[#3451d1] hover:to-[#4f6ef7] transition-all shadow-sm flex-shrink-0"
      >
        {submitting ? (
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        )}
      </button>
    </div>
  )
}

function McqInput({
  options, selected, onSelect, onSubmit, submitting,
}: {
  options: string[]; selected: number | null; onSelect: (i: number) => void
  onSubmit: () => void; submitting: boolean
}) {
  const autoSubmitTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleSelect(i: number) {
    if (submitting) return
    onSelect(i)
    if (autoSubmitTimer.current) clearTimeout(autoSubmitTimer.current)
    // Auto-submit 650 ms after selection — feels natural, not rushed
    autoSubmitTimer.current = setTimeout(onSubmit, 650)
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-400 font-medium px-1">Tap the correct option:</p>
      <div className="grid grid-cols-2 gap-2">
        {options.map((opt, i) => (
          <button
            key={i}
            onClick={() => handleSelect(i)}
            disabled={submitting}
            className={`py-3 px-3 rounded-2xl text-sm font-medium text-left transition-all duration-150 border ${
              selected === i
                ? 'bg-gradient-to-r from-[#4f6ef7] to-[#6b82f8] text-white border-transparent shadow-md scale-[1.02]'
                : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100 hover:border-gray-300'
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
      {submitting && (
        <div className="flex items-center justify-center gap-2 py-1">
          <div className="w-3.5 h-3.5 border-2 border-[#4f6ef7] border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-gray-400">Checking your answer…</span>
        </div>
      )}
    </div>
  )
}

function ResultScreen({
  result, interestArea, onNavigate,
}: {
  result: FinalResult; interestArea: string; onNavigate: () => void
}) {
  const scoreColor = result.score >= 70 ? 'text-green-600' : result.score >= 50 ? 'text-yellow-600' : 'text-orange-500'
  const scoreGrad  = result.score >= 70 ? 'from-green-400 to-emerald-500' : result.score >= 50 ? 'from-yellow-400 to-amber-500' : 'from-orange-400 to-red-400'
  const topicName  = TOPIC_LABELS[interestArea] ?? 'your interests'

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#EEF1FB] via-[#F5F5F7] to-[#EEF1FB] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-[440px]">
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-[#4f6ef7] via-[#818cf8] to-[#a78bfa]" />

          <div className="p-7">
            {/* Complete badge */}
            <div className="text-center mb-5">
              <div className="inline-flex items-center gap-1.5 bg-green-100 text-green-700 rounded-full px-4 py-1.5 text-[11px] font-bold uppercase tracking-wide mb-4">
                ✓ Demo lesson complete
              </div>

              {/* Score + level */}
              <div className="flex items-center justify-center gap-5 mb-3">
                <div className="text-center">
                  <div className={`text-5xl font-black leading-none ${scoreColor}`}>{result.score}</div>
                  <p className="text-[10px] text-gray-400 mt-1">out of 100</p>
                </div>
                <div className="h-10 w-px bg-gray-200" />
                <div className="text-center">
                  <div className="text-3xl font-black text-[#4f6ef7] leading-none">{result.level}</div>
                  <p className="text-[10px] text-gray-400 mt-1">English level</p>
                </div>
              </div>

              {/* Score bar */}
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${scoreGrad} transition-all duration-1000`}
                  style={{ width: `${result.score}%` }}
                />
              </div>
            </div>

            {/* Teacher message */}
            <div className="bg-gradient-to-br from-[#F5F5F7] to-[#EEF1FB] rounded-2xl p-4 mb-5 flex gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#4f6ef7] to-[#818cf8] flex items-center justify-center text-white text-sm font-bold flex-shrink-0">A</div>
              <p className="text-sm text-gray-700 leading-relaxed">{result.teacher_message}</p>
            </div>

            {/* Strengths + next focus */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="bg-green-50 rounded-2xl p-3.5">
                <p className="text-[9px] font-bold text-green-700 uppercase tracking-wider mb-2">Your strengths</p>
                <ul className="space-y-1.5">
                  {result.strengths.map((s, i) => (
                    <li key={i} className="text-xs text-green-800 flex items-start gap-1.5">
                      <span className="text-green-500 mt-0.5 flex-shrink-0">✓</span>{s}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-blue-50 rounded-2xl p-3.5">
                <p className="text-[9px] font-bold text-blue-700 uppercase tracking-wider mb-2">Next to work on</p>
                <ul className="space-y-1.5">
                  {result.areas_to_improve.map((a, i) => (
                    <li key={i} className="text-xs text-blue-800 flex items-start gap-1.5">
                      <span className="text-blue-400 mt-0.5 flex-shrink-0">→</span>{a}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* CTA — references the user's own topic */}
            <button
              onClick={onNavigate}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#4f6ef7] to-[#6b82f8] text-white text-sm font-bold shadow-lg hover:from-[#3451d1] hover:to-[#4f6ef7] transition-all duration-200 hover:shadow-xl active:scale-[0.98]"
            >
              Keep improving with {topicName} →
            </button>
            <p className="text-center text-xs text-gray-400 mt-2.5">Your next lesson is already personalised · cancel anytime</p>
          </div>
        </div>
      </div>
    </div>
  )
}
