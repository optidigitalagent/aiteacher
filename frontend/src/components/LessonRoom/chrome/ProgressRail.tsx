import type { ExerciseCard } from '../../../hooks/useLesson'
import { MOCK_LESSON_STEPS, MOCK_PROGRESS_PERCENT } from '../mock/mockClassroomData'

const PHASE_TO_STEP_IDX: Record<string, number> = {
  DIAGNOSTIC:     0,
  CONTEXT_INPUT:  1,
  RULE_DISCOVERY: 2,
  EXERCISES:      3,
  VOCABULARY:     6,
  DEEP_THINKING:  7,
  WRAP_UP:        7,
}

interface ProgressRailProps {
  currentPhase:    string
  currentExercise: ExerciseCard | null
  chatOpen:        boolean
  onToggleChat:    () => void
}

// FUTURE: lesson steps come from backend section plan, not mock data
// FUTURE: progress % calculated from real exercise completion tracking
export function ProgressRail({
  currentPhase,
  chatOpen,
  onToggleChat,
}: ProgressRailProps) {
  const activeIdx = PHASE_TO_STEP_IDX[currentPhase] ?? 0

  return (
    <aside className="w-52 flex-none flex flex-col bg-white border-l border-[rgba(0,0,0,0.06)] z-20 overflow-hidden">

      {/* Section header */}
      <div className="px-4 pt-4 pb-3 border-b border-gray-100 flex-none">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-cls-accent-lgt flex items-center justify-center flex-none">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <rect x="1.5" y="1.5" width="9" height="9" rx="1.5" stroke="#3D55C9" strokeWidth="1.3"/>
              <path d="M3.5 4.5h5M3.5 6.5h3" stroke="#3D55C9" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
          </div>
          {/* FUTURE: section id from route/session */}
          <span className="text-xs font-semibold text-gray-700">Section 1.2</span>
        </div>
      </div>

      {/* Steps list */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        <div className="space-y-0.5">
          {MOCK_LESSON_STEPS.map((step, i) => {
            const isDone   = step.done
            const isActive = step.active || i === activeIdx

            return (
              <div
                key={step.id}
                className={`
                  flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-all duration-200
                  ${isActive ? 'bg-cls-accent-lgt' : ''}
                `}
              >
                {/* Step circle */}
                {isDone ? (
                  <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center flex-none shadow-sm">
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                ) : isActive ? (
                  <div className="w-5 h-5 rounded-full bg-cls-accent flex-none shadow-sm shadow-cls-accent/30" />
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-gray-200 flex-none" />
                )}

                <span className={`text-xs font-medium leading-tight ${
                  isActive ? 'text-cls-accent' :
                  isDone   ? 'text-gray-400' :
                             'text-gray-500'
                }`}>
                  {step.label}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Progress */}
      <div className="px-4 py-3 border-t border-gray-100 flex-none">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Your progress</span>
          <span className="text-xs font-bold text-cls-accent">{MOCK_PROGRESS_PERCENT}%</span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-cls-accent to-cls-accent-dim rounded-full transition-all duration-700"
            style={{ width: `${MOCK_PROGRESS_PERCENT}%` }}
          />
        </div>
      </div>

      {/* Chat toggle — only shown when chat is closed */}
      {!chatOpen && (
        <div className="px-4 pb-4 flex-none">
          <button
            onClick={onToggleChat}
            className="w-full py-2 rounded-xl bg-gray-100 text-gray-600 text-xs font-semibold hover:bg-cls-accent-lgt hover:text-cls-accent transition-all"
          >
            Chat
          </button>
        </div>
      )}
    </aside>
  )
}
