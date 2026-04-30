interface MicButtonProps {
  voiceModeActive:   boolean
  isListening:       boolean
  isTeacherSpeaking: boolean
  onToggle:          () => void
  disabled:          boolean
}

export function MicButton({
  voiceModeActive,
  isListening,
  isTeacherSpeaking,
  onToggle,
  disabled,
}: MicButtonProps) {
  const isActive = voiceModeActive && isListening
  const isPaused = voiceModeActive && isTeacherSpeaking

  const label =
    isPaused        ? 'Mic paused — teacher is speaking' :
    isActive        ? 'Listening — click to stop' :
    voiceModeActive ? 'Voice active — waiting' :
                      'Click to enable voice'

  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`
        relative flex-none w-14 h-14 rounded-full flex items-center justify-center
        transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed
        ${isActive
          ? 'bg-red-500 shadow-lg shadow-red-300 scale-105'
          : isPaused
            ? 'bg-gray-300 shadow-sm'
            : /* default — always styled as prominent blue */
              'bg-gradient-to-br from-[#5B73E8] to-[#3D55C9] shadow-lg shadow-cls-accent/35 hover:shadow-cls-accent/50 hover:scale-105'
        }
      `}
    >
      {/* Active listening ping ring */}
      {isActive && (
        <span className="absolute inset-0 rounded-full bg-red-400/30 animate-ping" />
      )}

      {/* Mic icon */}
      {isPaused ? (
        /* Pause bars */
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="text-white/60">
          <rect x="3" y="3" width="5" height="12" rx="1" fill="currentColor"/>
          <rect x="10" y="3" width="5" height="12" rx="1" fill="currentColor"/>
        </svg>
      ) : (
        /* Mic icon — white regardless of state */
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <rect x="7" y="2" width="6" height="10" rx="3" fill="white"/>
          <path d="M3.5 10.5A6.5 6.5 0 0016.5 10.5M10 17V20" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
          {/* Subtle shine on mic body */}
          <rect x="7.8" y="2.8" width="1.5" height="4" rx="0.75" fill="white" opacity="0.4"/>
        </svg>
      )}
    </button>
  )
}
