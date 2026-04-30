import { useState } from 'react'
import { MicButton } from './MicButton'

interface LessonControlsProps {
  isActive:           boolean
  connectionState:    string
  voiceModeActive:    boolean
  isListening:        boolean
  isTeacherSpeaking:  boolean
  micError:           string | null
  voiceStatusHint:    string | null
  onToggleVoice:      () => void
  input:              string
  onInputChange:      (v: string) => void
  onSend:             () => void
  onKeyDown:          (e: React.KeyboardEvent) => void
  onConfused:         () => void
  isConfusionLoading: boolean
}

// "Need help?" card shown above controls when I don't understand is clicked
function HelpCard({
  onExplain,
  onDismiss,
  loading,
}: {
  onExplain: () => void
  onDismiss: () => void
  loading:   boolean
}) {
  return (
    <div className="absolute bottom-full left-0 mb-3 w-64 bg-white rounded-2xl shadow-xl border border-[rgba(0,0,0,0.09)] p-4 animate-fade-up pointer-events-auto">
      {/* Close */}
      <button
        onClick={onDismiss}
        className="absolute top-3 right-3 w-5 h-5 rounded-full flex items-center justify-center text-gray-300 hover:text-gray-500 hover:bg-gray-100 transition-colors text-xs"
      >
        ×
      </button>

      {/* Icon */}
      <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center mb-3">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="6.5" stroke="#D97706" strokeWidth="1.3"/>
          <path d="M6.5 6c0-1 .75-1.75 1.5-1.75S9.5 5 9.5 6c0 .75-.5 1.4-1.2 1.6A1 1 0 008 8.4" stroke="#D97706" strokeWidth="1.3" strokeLinecap="round"/>
          <circle cx="8" cy="10.5" r=".75" fill="#D97706"/>
        </svg>
      </div>

      <p className="text-sm font-semibold text-gray-900 mb-1">Need help?</p>
      <p className="text-xs text-gray-500 mb-3 leading-relaxed">
        I can explain this in a different way.
      </p>

      <button
        onClick={onExplain}
        disabled={loading}
        className="w-full py-2 rounded-xl bg-cls-accent text-white text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {loading ? 'Thinking…' : 'Explain this'}
      </button>
    </div>
  )
}

// FUTURE: voice ID / selected voice will be connected from session/profile
// FUTURE: connect mic to real speech recognition (Deepgram)
// FUTURE: connect send to lesson WebSocket
export function LessonControls({
  isActive,
  connectionState,
  voiceModeActive,
  isListening,
  isTeacherSpeaking,
  micError,
  voiceStatusHint,
  onToggleVoice,
  input,
  onInputChange,
  onSend,
  onKeyDown,
  onConfused,
  isConfusionLoading,
}: LessonControlsProps) {
  const [helpCardOpen, setHelpCardOpen] = useState(false)
  const isConnected = connectionState === 'connected'

  function handleConfusedClick() {
    if (!isActive || !isConnected || isConfusionLoading) return
    setHelpCardOpen(v => !v)
  }

  function handleExplain() {
    setHelpCardOpen(false)
    onConfused()
  }

  const micLabel =
    isTeacherSpeaking        ? '↑ Alex is speaking' :
    voiceModeActive && isListening ? '↑ Listening…' :
    voiceModeActive               ? '↑ Voice active' :
                                    '↑ Tap to speak'

  return (
    /* Outer wrapper: full width, bottom padding, pointer-events-none so transparent area is click-through */
    <div className="flex-none px-6 pb-5 pt-2 pointer-events-none relative z-40">

      {/* Help card — positioned above the left side of the controls */}
      {helpCardOpen && (
        <div className="absolute bottom-full left-6 mb-0 pointer-events-auto">
          <HelpCard
            onExplain={handleExplain}
            onDismiss={() => setHelpCardOpen(false)}
            loading={isConfusionLoading}
          />
        </div>
      )}

      {/* Status hints strip (mic error / speaking) */}
      {(micError || voiceStatusHint || (isTeacherSpeaking && voiceModeActive)) && (
        <div className="text-center mb-2 pointer-events-none">
          {micError && (
            <p className="text-xs text-red-500 bg-red-50 inline-block px-3 py-1 rounded-full border border-red-100">{micError}</p>
          )}
          {!micError && voiceStatusHint && (
            <p className="text-xs text-amber-600 bg-amber-50 inline-block px-3 py-1 rounded-full border border-amber-100">{voiceStatusHint}</p>
          )}
          {!micError && !voiceStatusHint && isTeacherSpeaking && voiceModeActive && (
            <p className="text-xs text-cls-accent bg-cls-accent-lgt inline-block px-3 py-1 rounded-full border border-cls-accent/20 animate-pulse">
              Alex is speaking — mic paused
            </p>
          )}
        </div>
      )}

      {/* Floating control pill */}
      <div className="
        pointer-events-auto max-w-2xl mx-auto
        bg-white/98 backdrop-blur-md
        rounded-2xl
        shadow-[0_8px_32px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.06)]
        border border-[rgba(0,0,0,0.07)]
        px-5 py-3.5
        flex items-center gap-4
      ">

        {/* I don't understand */}
        <button
          onClick={handleConfusedClick}
          disabled={!isActive || !isConnected}
          className={`
            flex-none flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium
            border transition-all duration-150 whitespace-nowrap
            ${helpCardOpen
              ? 'border-amber-300 text-amber-600 bg-amber-50'
              : 'border-gray-200 text-gray-500 bg-white hover:border-amber-200 hover:text-amber-600 hover:bg-amber-50'
            }
            disabled:opacity-30 disabled:cursor-not-allowed
          `}
          title="Ask for an explanation"
        >
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <circle cx="6.5" cy="6.5" r="5.5" stroke="currentColor" strokeWidth="1.2"/>
            <path d="M5 5c0-.83.67-1.5 1.5-1.5S8 4.17 8 5c0 .69-.47 1.28-1.1 1.43A.9.9 0 006.5 7.3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            <circle cx="6.5" cy="9" r=".65" fill="currentColor"/>
          </svg>
          <span className="hidden sm:inline">
            {isConfusionLoading ? 'Thinking…' : "I don't understand"}
          </span>
        </button>

        {/* Mic — primary center action */}
        <div className="flex flex-col items-center gap-1 flex-none">
          <MicButton
            voiceModeActive={voiceModeActive}
            isListening={isListening}
            isTeacherSpeaking={isTeacherSpeaking}
            onToggle={onToggleVoice}
            disabled={!isActive || !isConnected}
          />
          <span className={`text-[10px] font-medium leading-none transition-colors ${
            voiceModeActive && isListening ? 'text-red-400' :
            voiceModeActive               ? 'text-cls-accent' :
                                            'text-gray-400'
          }`}>
            {micLabel}
          </span>
        </div>

        {/* Text input + send */}
        <div className="flex-1 flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2.5 border border-gray-200 focus-within:border-cls-accent/40 focus-within:bg-white transition-all">
          <input
            type="text"
            value={input}
            onChange={e => onInputChange(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={
              !isActive                      ? 'Connecting…' :
              voiceModeActive && isListening ? 'Listening…' :
              isTeacherSpeaking              ? 'Alex is speaking…' :
                                               'Type your answer…'
            }
            disabled={!isActive || !isConnected}
            className="
              flex-1 bg-transparent text-sm text-gray-900 focus:outline-none
              placeholder-gray-400 disabled:opacity-40 min-w-0
            "
          />
          <button
            onClick={onSend}
            disabled={!isActive || !isConnected || !input.trim()}
            className="
              flex-none w-7 h-7 rounded-lg bg-cls-accent text-white
              flex items-center justify-center
              hover:opacity-90 transition-opacity
              disabled:opacity-30 disabled:cursor-not-allowed
            "
            title="Send (Enter)"
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M1 6.5h11M7.5 2 12 6.5 7.5 11" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
