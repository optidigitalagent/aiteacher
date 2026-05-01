import { useEffect, useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import type { DemoCalibration } from '../components/demo/DemoSetup'

const CHIP_LABELS: Record<string, string> = {
  chill_easy: 'Chill & easy', fun_interactive: 'Fun & interactive',
  real_conversation: 'Real convo', challenge_me: 'Challenge me',
  music_social: 'Music & TikTok', games: 'Games', movies_series: 'Movies & series',
  travel: 'Travel', school_life: 'School life', future_career: 'Future / career',
  friendly_coach: 'Friendly coach', older_friend: 'Older friend',
  real_tutor: 'Real tutor', challenge_trainer: 'Challenge trainer',
  freezes: 'I freeze', can_try: 'I can try', okay: "I'm okay", test_me: 'Test me',
  real_conversation_mission: 'Real conversation', fix_mistakes: 'Fix mistakes',
  listening_check: 'Fast English', find_level: 'Find my level',
}

const PREP_STEPS = [
  { label: 'Teacher profile matched',   delay: 700  },
  { label: 'Lesson world configured',   delay: 1400 },
  { label: 'Speaking level calibrated', delay: 2100 },
  { label: 'First mission loaded',      delay: 2800 },
  { label: 'AI demo lesson ready',      delay: 3500 },
]

interface LocationState {
  calibration?: DemoCalibration
}

export default function DemoClassroomPage() {
  const { id }    = useParams<{ id: string }>()
  const navigate  = useNavigate()
  const location  = useLocation()
  const cal       = (location.state as LocationState | null)?.calibration
  const [visible, setVisible] = useState(0)

  useEffect(() => {
    const timers = PREP_STEPS.map((s, i) =>
      setTimeout(() => setVisible(v => Math.max(v, i + 1)), s.delay),
    )
    return () => timers.forEach(clearTimeout)
  }, [])

  const summary = cal
    ? [
        { emoji: '✨', label: 'Vibe',     value: CHIP_LABELS[cal.lessonMood]         ?? cal.lessonMood },
        { emoji: '🌍', label: 'World',    value: CHIP_LABELS[cal.interestArea]       ?? cal.interestArea },
        { emoji: '🎓', label: 'Teacher',  value: CHIP_LABELS[cal.teacherStyle]       ?? cal.teacherStyle },
        { emoji: '🗣️', label: 'Speaking', value: CHIP_LABELS[cal.speakingConfidence] ?? cal.speakingConfidence },
        { emoji: '🎯', label: 'Mission',  value: CHIP_LABELS[cal.demoMission]        ?? cal.demoMission },
      ]
    : []

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F5F5F7] via-[#EEF1FB] to-[#F5F5F7] flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-[500px]">

        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
          {/* Animated gradient bar */}
          <div className="h-1.5 bg-gradient-to-r from-[#4f6ef7] via-[#818cf8] to-[#a78bfa]" />

          <div className="p-8">

            {/* Header */}
            <div className="text-center mb-7">
              <div className="w-16 h-16 bg-cls-accent-lgt rounded-2xl flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">🤖</span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-1.5">Preparing Your AI Lesson</h1>
              <p className="text-sm text-gray-500">Your personalised demo session is configured</p>
            </div>

            {/* Calibration summary */}
            {summary.length > 0 && (
              <div className="bg-gradient-to-br from-[#EEF1FB] to-[#F5F5F7] rounded-2xl p-4 mb-6 grid grid-cols-2 gap-3">
                {summary.map(item => (
                  <div key={item.label} className="flex items-center gap-2.5">
                    <span className="text-lg flex-shrink-0">{item.emoji}</span>
                    <div>
                      <div className="text-[10px] text-gray-400 uppercase font-bold tracking-wider leading-none mb-0.5">
                        {item.label}
                      </div>
                      <div className="text-xs font-semibold text-gray-700 leading-snug">{item.value}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Prep steps */}
            <div className="space-y-3 mb-7">
              {PREP_STEPS.map((step, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-3 transition-all duration-500 ${
                    visible > i ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
                    visible > i ? 'bg-green-100 scale-100' : 'bg-gray-100 scale-90'
                  }`}>
                    {visible > i ? (
                      <svg className="w-3 h-3 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <div className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                    )}
                  </div>
                  <span className={`text-sm font-medium transition-colors duration-300 ${
                    visible > i ? 'text-gray-700' : 'text-gray-300'
                  }`}>
                    {step.label}
                  </span>
                  {visible === i + 1 && visible < PREP_STEPS.length && (
                    <div className="ml-auto flex gap-1">
                      {[0, 1, 2].map(j => (
                        <div
                          key={j}
                          className="w-1.5 h-1.5 rounded-full bg-cls-accent animate-bounce"
                          style={{ animationDelay: `${j * 0.15}s` }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Coming-soon notice */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-100 mb-6">
              <div className="flex items-start gap-3">
                <span className="text-lg flex-shrink-0 mt-0.5">🎙️</span>
                <div>
                  <p className="text-sm font-semibold text-amber-800 mb-0.5">
                    Voice AI lesson engine — coming next
                  </p>
                  <p className="text-xs text-amber-600 leading-relaxed">
                    Your lesson profile is saved. The full voice demo with live AI conversation launches very soon.
                  </p>
                </div>
              </div>
            </div>

            {/* CTAs */}
            <button
              onClick={() => navigate('/')}
              className="w-full py-3.5 px-6 bg-gradient-to-r from-[#4f6ef7] to-[#6b82f8] text-white rounded-2xl text-sm font-semibold hover:from-[#3451d1] hover:to-[#4f6ef7] transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              Back to Home
            </button>

          </div>
        </div>

        <p className="text-center text-[11px] text-gray-300 mt-4 font-mono">Session {id}</p>

      </div>
    </div>
  )
}
