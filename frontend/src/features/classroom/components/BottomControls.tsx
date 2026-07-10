import { useRef, useState, useEffect } from 'react'
import { IcMic, IcSend, IcQ } from './icons'

type VoiceLanguage = 'ru' | 'uk'

interface Props {
  isListening:        boolean
  value:              string
  onChange:           (v: string) => void
  onSubmit:           () => void
  onToggleMic:        () => void
  onExplain:          () => void
  inputDisabled?:     boolean
  micDisabled?:       boolean
  showExplain?:       boolean
  isPartialTranscript?: boolean
  // Help input (demo mode)
  showHelpInput?:     boolean
  helpInputValue?:    string
  onHelpChange?:      (v: string) => void
  onHelpSubmit?:      () => void
  onHelpClose?:       () => void
  voiceLanguage?:     VoiceLanguage | null
  onVoiceLanguageChange?: (v: VoiceLanguage | null) => void
}

export default function BottomControls({
  isListening, value, onChange, onSubmit, onToggleMic, onExplain,
  inputDisabled, micDisabled, showExplain = true, isPartialTranscript,
  showHelpInput, helpInputValue, onHelpChange, onHelpSubmit, onHelpClose,
  voiceLanguage, onVoiceLanguageChange,
}: Props) {
  const inputRef          = useRef<HTMLInputElement>(null)
  const helpInputRef      = useRef<HTMLInputElement>(null)
  const [focused, setFocused] = useState(false)
  // iOS Safari: track visual viewport offset so fixed bar stays above keyboard
  const [iosBottomOffset, setIosBottomOffset] = useState(0)

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const update = () => {
      // On iOS, visualViewport.height shrinks when keyboard opens.
      // Offset = how far the bottom of the visual viewport is from the layout bottom.
      const layoutBottom = window.innerHeight
      const vpBottom = Math.round(vv.offsetTop + vv.height)
      const offset = Math.max(0, layoutBottom - vpBottom)
      setIosBottomOffset(offset)
    }
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])

  const handleKey = (e: React.KeyboardEvent) => {
    if (inputDisabled) return
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSubmit() }
  }

  const handleHelpKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); onHelpSubmit?.() }
    if (e.key === 'Escape') onHelpClose?.()
  }

  return (
    <>
      {/* Help input panel — appears above main bar when "I don't understand" is clicked */}
      {showHelpInput && (
        <div style={{
          position: 'fixed',
          bottom: `calc(max(16px, env(safe-area-inset-bottom, 16px)) + 80px + ${iosBottomOffset}px)`,
          left: '50%', transform: 'translateX(-50%)',
          zIndex: 101,
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'rgba(255,255,255,0.97)',
          backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          borderRadius: 16,
          padding: '10px 14px',
          boxShadow: '0 4px 24px rgba(110,124,251,0.18), 0 0 0 1.5px rgba(110,124,251,0.2)',
          width: 'calc(100% - 24px)', maxWidth: 780,
        }}>
          <span style={{ fontSize: 13, color: '#9B8CFF', fontWeight: 700, flexShrink: 0, whiteSpace: 'nowrap' }}>
            ❓ Help:
          </span>
          <input
            ref={helpInputRef}
            autoFocus
            value={helpInputValue ?? ''}
            onChange={e => onHelpChange?.(e.target.value)}
            onKeyDown={handleHelpKey}
            placeholder="Type a word or sentence you don't understand…"
            maxLength={160}
            style={{
              flex: 1, border: 'none', background: 'transparent',
              fontSize: 14, color: '#1a1a2e', outline: 'none',
              fontFamily: "'Plus Jakarta Sans', sans-serif",
            }}
          />
          <button
            onClick={onHelpSubmit}
            disabled={!helpInputValue?.trim()}
            style={{
              padding: '6px 16px', border: 'none', borderRadius: 10,
              background: helpInputValue?.trim() ? 'linear-gradient(135deg,#6E7CFB,#9B8CFF)' : '#e8e8f0',
              color: helpInputValue?.trim() ? 'white' : '#bbb',
              fontSize: 13, fontWeight: 700, cursor: helpInputValue?.trim() ? 'pointer' : 'default',
              transition: 'all 0.2s', flexShrink: 0,
            }}
          >
            Ask
          </button>
          <button
            onClick={onHelpClose}
            style={{
              width: 28, height: 28, border: '1.5px solid rgba(110,124,251,0.2)',
              borderRadius: 8, background: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, color: '#9B8CFF', fontWeight: 700, flexShrink: 0,
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Main bottom bar */}
      <div style={{
        position: 'fixed',
        bottom: `calc(max(16px, env(safe-area-inset-bottom, 16px)) + ${iosBottomOffset}px)`,
        left: '50%', transform: 'translateX(-50%)',
        zIndex: 100,
        display: 'flex', alignItems: 'center', gap: 10,
        background: 'rgba(255,255,255,0.78)',
        backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)',
        borderRadius: 99,
        padding: '10px 14px 10px 12px',
        boxShadow: '0 2px 0 rgba(255,255,255,0.95) inset, 0 4px 6px rgba(0,0,0,0.03), 0 20px 50px rgba(0,0,0,0.1), 0 0 0 1px rgba(255,255,255,0.4)',
        width: 'calc(100% - 24px)', maxWidth: 780,
      }}>
        {/* "I don't understand" button */}
        {showExplain && (
          <button
            onClick={onExplain}
            title="I don't understand"
            style={{
              display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
              background: showHelpInput ? 'rgba(110,124,251,0.12)' : 'none',
              border: showHelpInput ? '1.5px solid rgba(110,124,251,0.35)' : '1.5px solid #e8e8f0',
              borderRadius: 99,
              padding: '10px 14px', cursor: 'pointer',
              color: showHelpInput ? '#6E7CFB' : '#555', fontSize: 13.5, fontWeight: 600,
              transition: 'all 0.2s', whiteSpace: 'nowrap',
            }}
          >
            <IcQ s={14} c={showHelpInput ? '#6E7CFB' : '#888'} />
            <span className="cls-explain-label">I don&apos;t understand</span>
          </button>
        )}

        {onVoiceLanguageChange && (
          <div
            role="group"
            aria-label="Voice language"
            style={{
              display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
              background: '#F5F5F7', border: '1.5px solid rgba(110,124,251,0.15)',
              borderRadius: 99, padding: 4,
            }}
          >
            {(['ru', 'uk'] as const).map(lang => {
              const active = voiceLanguage === lang
              return (
                <button
                  key={lang}
                  type="button"
                  onClick={() => onVoiceLanguageChange(active ? null : lang)}
                  title={lang === 'ru' ? 'I will speak Russian' : 'I will speak Ukrainian'}
                  aria-pressed={active}
                  style={{
                    width: 34, height: 30, borderRadius: 99, border: 'none',
                    background: active ? '#1a1a2e' : 'transparent',
                    color: active ? 'white' : '#64748B',
                    cursor: 'pointer', fontSize: 11, fontWeight: 900,
                    transition: 'background 0.15s, color 0.15s',
                  }}
                >
                  {lang.toUpperCase()}
                </button>
              )
            })}
          </div>
        )}

        {/* Mic button */}
        <div style={{ position: 'relative', width: 72, height: 72, flexShrink: 0 }}>
          {isListening && !micDisabled && (
            <>
              <div className="cls-pulse-ring" />
              <div className="cls-pulse-ring cls-pulse-ring-2" />
              <div className="cls-pulse-ring cls-pulse-ring-3" />
            </>
          )}
          <button
            onClick={micDisabled ? undefined : onToggleMic}
            disabled={micDisabled}
            title={micDisabled ? 'Mic unavailable — wait for your teacher to finish' : undefined}
            style={{
              position: 'absolute', inset: 0, borderRadius: '50%', border: 'none',
              background: micDisabled
                ? 'linear-gradient(145deg, #94A3B8 0%, #CBD5E1 100%)'
                : 'linear-gradient(145deg, #6E7CFB 0%, #9B8CFF 55%, #FFB86B 100%)',
              cursor: micDisabled ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              opacity: micDisabled ? 0.55 : 1,
              boxShadow: (!micDisabled && isListening)
                ? '0 0 0 4px rgba(110,124,251,0.35), 0 0 50px rgba(255,184,107,0.7), 0 10px 36px rgba(110,124,251,0.55)'
                : undefined,
              animation: (!micDisabled && !isListening) ? 'cls-pulse-glow 2.4s ease-in-out infinite' : 'none',
              transition: 'box-shadow 0.2s, opacity 0.2s, background 0.2s',
            }}
          >
            <IcMic s={26} />
          </button>
        </div>

        {/* Text input */}
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
            onChange={e => { if (!inputDisabled) onChange(e.target.value) }}
            onKeyDown={handleKey}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={inputDisabled ? 'Listen to your teacher…' : 'Type your answer…'}
            readOnly={inputDisabled}
            style={{
              flex: 1, border: 'none', background: 'transparent',
              padding: '13px 0', fontSize: 15,
              color: isPartialTranscript ? '#aaa' : inputDisabled ? '#aaa' : '#1a1a2e',
              fontStyle: isPartialTranscript ? 'italic' : 'normal',
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              minWidth: 0,
              cursor: inputDisabled ? 'default' : 'text',
              transition: 'color 0.15s, font-style 0.15s',
            }}
          />
          <button
            onClick={inputDisabled ? undefined : onSubmit}
            disabled={inputDisabled || !value.trim()}
            style={{
              width: 40, height: 40, borderRadius: 99, border: 'none', flexShrink: 0,
              background: (!inputDisabled && value.trim()) ? 'linear-gradient(135deg, #1a1a2e, #2d2d4e)' : '#e8e8f0',
              cursor: (!inputDisabled && value.trim()) ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: (!inputDisabled && value.trim()) ? '0 4px 12px rgba(26,26,46,0.3)' : 'none',
              transition: 'all 0.2s',
              opacity: inputDisabled ? 0.45 : 1,
            }}
          >
            <IcSend s={15} c={(!inputDisabled && value.trim()) ? 'white' : '#bbb'} />
          </button>
        </div>
      </div>
    </>
  )
}
