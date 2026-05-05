import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getStoredToken } from '../../lib/auth'
import AuthGate from './AuthGate'

// ── Types ─────────────────────────────────────────────────────────────────────

export type LessonMood         = 'chill_easy' | 'fun_interactive' | 'real_conversation' | 'challenge_me'
export type InterestArea       = 'games' | 'movies_series' | 'travel' | 'school_life'
export type TeacherStyle       = 'friendly_coach' | 'older_friend' | 'real_tutor' | 'challenge_trainer'
export type SpeakingConfidence = 'freezes' | 'can_try' | 'okay' | 'test_me'
export type DemoMission        = 'real_conversation_mission' | 'fix_mistakes' | 'listening_check' | 'find_level'

export interface DemoCalibration {
  lessonMood:          LessonMood
  interestArea:        InterestArea
  teacherStyle:        TeacherStyle
  speakingConfidence:  SpeakingConfidence
  demoMission:         DemoMission
}

type PartialCal = Partial<DemoCalibration>

// ── Config ────────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'demo_calibration_draft'
const API_BASE    = import.meta.env.VITE_API_URL ?? ''

interface StepOption {
  value:        string
  label:        string
  desc:         string
  emoji:        string
  recommended?: true
}
interface StepDef {
  field:    keyof DemoCalibration
  question: string
  options:  StepOption[]
}

const STEPS: StepDef[] = [
  {
    field:    'lessonMood',
    question: 'What kind of English lesson would actually feel good today?',
    options: [
      { value: 'chill_easy',        label: 'Chill & easy',     desc: 'No pressure, help me understand',    emoji: '🌿' },
      { value: 'fun_interactive',   label: 'Fun & interactive', desc: 'Make it feel like a game',           emoji: '🎮' },
      { value: 'real_conversation', label: 'Real conversation', desc: 'I want to speak like with a person', emoji: '💬' },
      { value: 'challenge_me',      label: 'Challenge me',      desc: 'Push me a little',                   emoji: '🔥' },
    ],
  },
  {
    field:    'interestArea',
    question: 'Pick a world for your first AI lesson.',
    options: [
      { value: 'games',         label: 'Games',           desc: 'Gaming culture, esports',    emoji: '🕹️' },
      { value: 'movies_series', label: 'Movies & series', desc: 'Film, TV, pop culture',      emoji: '🎬' },
      { value: 'travel',        label: 'Travel',           desc: 'Places, trips, adventures',  emoji: '✈️' },
      { value: 'school_life',   label: 'School life',      desc: 'Classes, friends, routines', emoji: '📚' },
    ],
  },
  {
    field:    'teacherStyle',
    question: 'How should your AI teacher feel?',
    options: [
      { value: 'friendly_coach',    label: 'Friendly coach',    desc: 'Correct me, but support me',         emoji: '🤝' },
      { value: 'older_friend',      label: 'Older friend',      desc: "Explain simply, don't sound strict",  emoji: '😊' },
      { value: 'real_tutor',        label: 'Real tutor',        desc: 'Clear, focused, professional',        emoji: '📖' },
      { value: 'challenge_trainer', label: 'Challenge trainer', desc: "Don't let me be lazy",                emoji: '💪' },
    ],
  },
  {
    field:    'speakingConfidence',
    question: 'When you need to speak English, you usually feel…',
    options: [
      { value: 'freezes', label: 'I freeze',  desc: "I know some words, but I'm scared to speak", emoji: '😬' },
      { value: 'can_try', label: 'I can try', desc: 'I make mistakes, but I can answer',           emoji: '🙌' },
      { value: 'okay',    label: "I'm okay",  desc: 'I can speak, but want to sound better',       emoji: '😌' },
      { value: 'test_me', label: 'Test me',   desc: 'I want to know my real level',                emoji: '⚡' },
    ],
  },
  {
    field:    'demoMission',
    question: 'Choose your first AI lesson mission.',
    options: [
      { value: 'real_conversation_mission', label: 'Survive a real conversation', desc: 'Talk naturally with AI',         emoji: '🗣️' },
      { value: 'fix_mistakes',              label: 'Fix my common mistakes',      desc: 'Find what I keep getting wrong', emoji: '🛠️' },
      { value: 'listening_check',           label: 'Understand fast English',     desc: 'Train my ear for native speed',  emoji: '👂' },
      { value: 'find_level',                label: 'Find my real level',          desc: 'Smart AI calibration test',      emoji: '🎯', recommended: true },
    ],
  },
]

const CHIP_LABELS: Record<string, string> = {
  chill_easy: 'Chill & easy', fun_interactive: 'Fun & interactive', real_conversation: 'Real convo', challenge_me: 'Challenge me',
  music_social: 'Music & TikTok', games: 'Games', movies_series: 'Movies', travel: 'Travel', school_life: 'School life', future_career: 'Future',
  friendly_coach: 'Friendly coach', older_friend: 'Older friend', real_tutor: 'Real tutor', challenge_trainer: 'Trainer',
  freezes: 'I freeze', can_try: 'I can try', okay: "I'm okay", test_me: 'Test me',
  real_conversation_mission: 'Real convo', fix_mistakes: 'Fix mistakes', listening_check: 'Listening', find_level: 'Find level',
}

const CHECKLIST = [
  'Lesson style calibrated',
  'Topic world selected',
  'Teacher tone adjusted',
  'Speaking difficulty estimated',
  'First mission ready',
]

// ── Component ─────────────────────────────────────────────────────────────────

export default function DemoSetup() {
  const navigate = useNavigate()

  const [step, setStep]               = useState(0)
  const [data, setData]               = useState<PartialCal>({})
  const [calibrating, setCalibrating] = useState(false)
  const [selected, setSelected]       = useState<string | null>(null)
  const [showAuth, setShowAuth]       = useState(false)
  const [submitting, setSubmitting]   = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [checkVis, setCheckVis]       = useState(0)

  // Restore from sessionStorage (after OAuth redirect, returns to correct step)
  useEffect(() => {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return
    try {
      const saved = JSON.parse(raw) as PartialCal
      setData(saved)
      const done = STEPS.filter(s => saved[s.field]).length
      setStep(done >= STEPS.length ? 5 : done)
    } catch { /* ignore corrupt draft */ }
  }, [])

  // Persist draft on every data change
  useEffect(() => {
    if (Object.keys(data).length > 0) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }, [data])

  // Stagger checklist items when review screen appears
  useEffect(() => {
    if (step !== 5) return
    setCheckVis(0)
    const timers = CHECKLIST.map((_, i) =>
      setTimeout(() => setCheckVis(v => Math.max(v, i + 1)), 450 + i * 350),
    )
    return () => timers.forEach(clearTimeout)
  }, [step])

  const selectOption = useCallback((value: string) => {
    if (calibrating) return
    setSelected(value)
    setCalibrating(true)
    setTimeout(() => {
      const field = STEPS[step]!.field
      setData(prev => ({ ...prev, [field]: value as never }))
      setSelected(null)
      setCalibrating(false)
      setStep(s => s + 1)
    }, 680)
  }, [calibrating, step])

  const goBack = useCallback(() => {
    if (step === 0 || calibrating) return
    setStep(s => s - 1)
  }, [step, calibrating])

  const handleStart = useCallback(async () => {
    if (!isComplete(data)) return
    const token = getStoredToken()
    if (!token) { setShowAuth(true); return }

    // Soft device signal — never used for blocking, only abuse logging
    let deviceId = localStorage.getItem('demo_device_id')
    if (!deviceId) {
      deviceId = crypto.randomUUID()
      localStorage.setItem('demo_device_id', deviceId)
    }

    setSubmitting(true)
    setError(null)
    try {
      const res  = await fetch(`${API_BASE}/demo/start`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ ...data, deviceId }),
      })
      const json = await res.json() as {
        demoSessionId?: string
        nextRoute?:     string
        code?:          string
        message?:       string
        retryAfterSeconds?: number
      }

      if (!res.ok) {
        if (json.code === 'DEMO_USED')       { sessionStorage.removeItem(STORAGE_KEY); navigate('/pricing?from=demo_used'); return }
        if (json.code === 'UNAUTHENTICATED') { setShowAuth(true); return }
        if (json.code === 'RATE_LIMITED') {
          const mins = json.retryAfterSeconds ? Math.ceil(json.retryAfterSeconds / 60) : null
          setError(mins ? `Too many attempts. Try again in ${mins} minute${mins === 1 ? '' : 's'}.` : 'Too many attempts. Please wait a moment.')
          return
        }
        setError(json.message ?? 'Something went wrong. Please try again.')
        return
      }
      sessionStorage.removeItem(STORAGE_KEY)
      const route = json.nextRoute ?? `/demo/classroom/${json.demoSessionId ?? ''}`
      navigate(route, { state: { calibration: data } })
    } catch {
      setError('Network error. Check your connection and try again.')
    } finally {
      setSubmitting(false)
    }
  }, [data, navigate])

  if (showAuth) return <AuthGate onBack={() => setShowAuth(false)} />

  const currentStepDef = STEPS[step]
  const chips = STEPS.slice(0, step).flatMap(s => { const v = data[s.field]; return v ? [v] : [] })

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F5F5F7] via-[#EEF1FB] to-[#F5F5F7] flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-[600px]">

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">

          {/* Animated gradient top bar */}
          <div className="h-1.5 bg-gradient-to-r from-[#4f6ef7] via-[#818cf8] to-[#a78bfa]" />

          <div className="p-8">

            {/* Header: label + step dots + exit */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-cls-accent-lgt flex items-center justify-center">
                  <svg className="w-3.5 h-3.5 text-cls-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <span className="text-xs font-semibold tracking-widest text-cls-accent uppercase">AI Lesson Scan</span>
              </div>
              <div className="flex items-center gap-2">
                {step < 5 && (
                  <div className="flex items-center gap-1.5">
                    {STEPS.map((_, i) => (
                      <div
                        key={i}
                        className={`h-2 rounded-full transition-all duration-500 ease-out ${
                          i < step  ? 'w-6 bg-cls-accent'
                          : i === step ? 'w-4 bg-cls-accent opacity-50'
                          : 'w-2 bg-gray-200'
                        }`}
                      />
                    ))}
                  </div>
                )}
                <button
                  onClick={() => navigate('/')}
                  className="w-7 h-7 flex items-center justify-center rounded-full text-gray-300 hover:text-gray-500 hover:bg-gray-100 transition-colors"
                  aria-label="Exit demo setup"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Selected-answer chips */}
            {chips.length > 0 && step < 5 && (
              <div className="flex flex-wrap gap-1.5 mb-5">
                {chips.map((v, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-cls-accent-lgt text-cls-accent text-xs font-semibold rounded-full"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-cls-accent flex-shrink-0" />
                    {CHIP_LABELS[v as string] ?? v}
                  </span>
                ))}
              </div>
            )}

            {/* Step question + options */}
            {step < 5 && currentStepDef ? (
              <div key={step} className="animate-fade-up relative">
                <h2 className="text-xl font-bold text-gray-900 mb-6 leading-snug">
                  {currentStepDef.question}
                </h2>

                <div className={`grid gap-3 ${currentStepDef.options.length === 6 ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2'}`}>
                  {currentStepDef.options.map(opt => {
                    const isSel = selected === opt.value
                    return (
                      <button
                        key={opt.value}
                        onClick={() => selectOption(opt.value)}
                        disabled={calibrating}
                        className={`relative text-left p-4 rounded-2xl border-2 transition-all duration-200 focus:outline-none
                          ${isSel
                            ? 'border-cls-accent bg-cls-accent-lgt shadow-md ring-2 ring-cls-accent/20 scale-[0.97]'
                            : 'border-gray-100 bg-white hover:border-cls-accent hover:bg-cls-accent-lgt hover:shadow-sm active:scale-[0.98]'
                          } ${calibrating && !isSel ? 'opacity-40 pointer-events-none' : ''}`}
                      >
                        {opt.recommended && (
                          <span className="absolute -top-2.5 -right-2.5 bg-orange-400 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                            Best pick
                          </span>
                        )}
                        <div className="text-2xl mb-2 select-none">{opt.emoji}</div>
                        <div className="text-sm font-semibold text-gray-900 leading-tight">{opt.label}</div>
                        <div className="text-[11px] text-gray-500 mt-1 leading-snug">{opt.desc}</div>
                      </button>
                    )
                  })}
                </div>

                {/* AI calibration overlay */}
                {calibrating && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 backdrop-blur-sm rounded-2xl animate-fade-in z-10">
                    <div className="flex gap-2 mb-3">
                      {[0, 1, 2].map(i => (
                        <div
                          key={i}
                          className="w-2 h-2 rounded-full bg-cls-accent animate-bounce"
                          style={{ animationDelay: `${i * 0.15}s` }}
                        />
                      ))}
                    </div>
                    <p className="text-sm font-semibold text-cls-accent">Calibrating your lesson…</p>
                  </div>
                )}
              </div>
            ) : step === 5 ? (
              <ReviewScreen
                data={data as DemoCalibration}
                checkVis={checkVis}
                submitting={submitting}
                error={error}
                onStart={handleStart}
                onEdit={() => { setStep(0); setError(null) }}
              />
            ) : null}

          </div>
        </div>

        {/* Back button */}
        {step > 0 && step < 5 && !calibrating && (
          <div className="flex justify-center mt-5">
            <button
              onClick={goBack}
              className="text-sm text-gray-400 hover:text-cls-accent transition-colors flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Go back
            </button>
          </div>
        )}

        {/* Step counter */}
        {step < 5 && (
          <p className="text-center text-xs text-gray-400 mt-3">
            Step {step + 1} of {STEPS.length}
          </p>
        )}
      </div>
    </div>
  )
}

// ── Review screen ─────────────────────────────────────────────────────────────

function ReviewScreen({
  data, checkVis, submitting, error, onStart, onEdit,
}: {
  data:       DemoCalibration
  checkVis:   number
  submitting: boolean
  error:      string | null
  onStart:    () => void
  onEdit:     () => void
}) {
  const summary = [
    { label: 'Vibe',     value: CHIP_LABELS[data.lessonMood]         ?? data.lessonMood,         emoji: '✨' },
    { label: 'World',    value: CHIP_LABELS[data.interestArea]       ?? data.interestArea,       emoji: '🌍' },
    { label: 'Teacher',  value: CHIP_LABELS[data.teacherStyle]       ?? data.teacherStyle,       emoji: '🎓' },
    { label: 'Speaking', value: CHIP_LABELS[data.speakingConfidence] ?? data.speakingConfidence, emoji: '🗣️' },
    { label: 'Mission',  value: CHIP_LABELS[data.demoMission]        ?? data.demoMission,        emoji: '🎯' },
  ]

  return (
    <div className="animate-fade-up">
      <div className="text-center mb-7">
        <div className="text-4xl mb-3">🤖</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-1">Your AI Lesson is Ready</h2>
        <p className="text-sm text-gray-500">Here's what we built for you</p>
      </div>

      {/* Summary grid */}
      <div className="bg-gradient-to-br from-[#EEF1FB] to-[#F5F5F7] rounded-2xl p-4 mb-6 grid grid-cols-2 gap-3">
        {summary.map((item, i) => (
          <div key={i} className="flex items-center gap-2.5">
            <span className="text-xl flex-shrink-0">{item.emoji}</span>
            <div>
              <div className="text-[10px] text-gray-400 uppercase font-bold tracking-wider leading-none mb-0.5">
                {item.label}
              </div>
              <div className="text-xs font-semibold text-gray-800 leading-snug">{item.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Animated checklist */}
      <div className="space-y-2.5 mb-7">
        {CHECKLIST.map((item, i) => (
          <div
            key={i}
            className={`flex items-center gap-3 transition-all duration-500 ${
              checkVis > i ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
            }`}
          >
            <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
              checkVis > i ? 'bg-green-100 scale-100' : 'bg-gray-100 scale-90'
            }`}>
              {checkVis > i && (
                <svg className="w-3 h-3 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <span className={`text-sm font-medium transition-colors duration-300 ${
              checkVis > i ? 'text-gray-700' : 'text-gray-300'
            }`}>
              {item}
            </span>
          </div>
        ))}
      </div>

      {error && (
        <div className="mb-5 p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-600">
          {error}
        </div>
      )}

      <button
        onClick={onStart}
        disabled={submitting || checkVis < CHECKLIST.length}
        className="w-full py-4 bg-gradient-to-r from-[#4f6ef7] to-[#6b82f8] text-white font-bold rounded-2xl shadow-lg hover:shadow-xl hover:from-[#3451d1] hover:to-[#4f6ef7] transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed text-sm tracking-wide"
      >
        {submitting ? 'Starting your lesson…' : '🚀 Start my AI demo lesson'}
      </button>

      <button
        onClick={onEdit}
        className="w-full mt-3 py-2.5 text-sm text-gray-400 hover:text-gray-600 transition-colors"
      >
        Edit choices
      </button>
    </div>
  )
}

function isComplete(data: PartialCal): data is DemoCalibration {
  return !!(data.lessonMood && data.interestArea && data.teacherStyle && data.speakingConfidence && data.demoMission)
}
