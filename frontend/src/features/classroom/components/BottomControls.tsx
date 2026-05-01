import { useRef, useState } from 'react'
import { IcMic, IcSend, IcQ } from './icons'

interface Props {
  isListening:   boolean
  value:         string
  onChange:      (v: string) => void
  onSubmit:      () => void
  onToggleMic:   () => void
  onExplain:     () => void
}

// This is the ONLY input in the classroom.
// It handles: exercise answers, chat messages, voice transcript display.
// TODO: onSubmit → POST /api/lesson/input { text, lessonStateId, exerciseId }
//       Backend decides message type from lessonState (exercise_answer | chat_message | lesson_command)

export default function BottomControls({ isListening, value, onChange, onSubmit, onToggleMic, onExplain }: Props) {
  const inputRef          = useRef<HTMLInputElement>(null)
  const [focused, setFocused] = useState(false)

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSubmit() }
  }

  return (
    <div style={{
      position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
      zIndex: 100,
      display: 'flex', alignItems: 'center', gap: 14,
      background: 'rgba(255,255,255,0.78)',
      backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)',
      borderRadius: 99,
      padding: '12px 20px 12px 16px',
      boxShadow: '0 2px 0 rgba(255,255,255,0.95) inset, 0 4px 6px rgba(0,0,0,0.03), 0 20px 50px rgba(0,0,0,0.1), 0 0 0 1px rgba(255,255,255,0.4)',
      width: 'auto', maxWidth: 780, minWidth: 680,
    }}>
      {/* "I don't understand" — TODO: triggers teaching card from backend */}
      <button onClick={onExplain} style={{
        display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0,
        background: 'none', border: '1.5px solid #e8e8f0', borderRadius: 99,
        padding: '10px 18px', cursor: 'pointer',
        color: '#555', fontSize: 13.5, fontWeight: 600,
        transition: 'all 0.2s', whiteSpace: 'nowrap',
      }}>
        <IcQ s={14} c="#888" />
        I don&apos;t understand
      </button>

      {/* Mic button — TODO: connect to real mic via voiceApi.ts */}
      <div style={{ position: 'relative', width: 72, height: 72, flexShrink: 0 }}>
        {isListening && (
          <>
            <div className="cls-pulse-ring" />
            <div className="cls-pulse-ring cls-pulse-ring-2" />
            <div className="cls-pulse-ring cls-pulse-ring-3" />
          </>
        )}
        <button onClick={onToggleMic} style={{
          position: 'absolute', inset: 0, borderRadius: '50%', border: 'none',
          background: 'linear-gradient(145deg, #6E7CFB 0%, #9B8CFF 55%, #FFB86B 100%)',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: isListening
            ? '0 0 0 4px rgba(110,124,251,0.35), 0 0 50px rgba(255,184,107,0.7), 0 10px 36px rgba(110,124,251,0.55)'
            : undefined,
          animation: isListening ? 'none' : 'cls-pulse-glow 2.4s ease-in-out infinite',
          transition: 'box-shadow 0.2s',
        }}>
          <IcMic s={26} />
        </button>
      </div>

      {/* Text input — ONLY text input in the classroom */}
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center',
        background: '#F5F5F7', borderRadius: 99, padding: '0 8px 0 18px',
        border: focused ? '1.5px solid rgba(110,124,251,0.45)' : '1.5px solid rgba(110,124,251,0.15)',
        boxShadow: focused ? '0 0 0 3px rgba(110,124,251,0.12)' : 'none',
        transition: 'border-color 0.2s, box-shadow 0.2s',
        minWidth: 0,
      }}>
        <input
          ref={inputRef}
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={handleKey}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Type your answer…"
          style={{
            flex: 1, border: 'none', background: 'transparent',
            padding: '13px 0', fontSize: 15, color: '#1a1a2e',
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            minWidth: 0,
          }}
        />
        <button onClick={onSubmit} style={{
          width: 40, height: 40, borderRadius: 99, border: 'none', flexShrink: 0,
          background: value.trim() ? 'linear-gradient(135deg, #1a1a2e, #2d2d4e)' : '#e8e8f0',
          cursor: value.trim() ? 'pointer' : 'default',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: value.trim() ? '0 4px 12px rgba(26,26,46,0.3)' : 'none',
          transition: 'all 0.2s',
        }}>
          <IcSend s={15} c={value.trim() ? 'white' : '#bbb'} />
        </button>
      </div>
    </div>
  )
}
