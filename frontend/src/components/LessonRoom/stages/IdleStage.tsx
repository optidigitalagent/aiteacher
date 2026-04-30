import { ExerciseStage } from './ExerciseStage'
import { MOCK_EXERCISE_SIMPLE } from '../mock/mockExercise'

interface IdleStageProps {
  connectionState: string
  started:         boolean
}

export function IdleStage({ connectionState, started }: IdleStageProps) {
  const isConnecting = connectionState === 'connecting' || (!started && connectionState === 'connected')
  const isError      = connectionState === 'error'

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
        <div className="w-12 h-12 rounded-full bg-red-50 border border-red-200 flex items-center justify-center">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <path d="M11 4L19.5 18H2.5L11 4Z" stroke="#DC2626" strokeWidth="1.5" strokeLinejoin="round"/>
            <path d="M11 10V13" stroke="#DC2626" strokeWidth="1.5" strokeLinecap="round"/>
            <circle cx="11" cy="15.5" r="0.8" fill="#DC2626"/>
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-800 mb-1">Connection failed</p>
          <p className="text-xs text-gray-400 max-w-[200px] leading-relaxed">
            Could not connect to the lesson server. Please refresh to try again.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative flex-1 flex flex-col">
      {/* Mock exercise card — always visible for usability without backend */}
      {/* FUTURE: replace with real exercise from backend once connected */}
      <ExerciseStage
        exercise={MOCK_EXERCISE_SIMPLE}
        isTeacherSpeaking={false}
      />

      {/* Connecting overlay — subtle, non-blocking */}
      {isConnecting && (
        <div className="absolute inset-0 flex items-start justify-center pt-6 pointer-events-none">
          <div className="flex items-center gap-2 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-full px-4 py-2 shadow-sm">
            <div className="w-3.5 h-3.5 rounded-full border-2 border-cls-accent border-t-transparent animate-spin" />
            <span className="text-xs text-gray-500 font-medium">Starting lesson…</span>
          </div>
        </div>
      )}
    </div>
  )
}
