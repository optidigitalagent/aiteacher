import { useEffect, useRef, useState } from 'react'
import type { ChatMessage } from '../types'
import type { VoicePlayState } from '../hooks/useDemoSession'
import { IcClose } from './icons'
import { formatAIMessage } from '../utils/formatMessage'

interface Props {
  messages:        ChatMessage[]
  onHide:          () => void
  isDemoMode?:     boolean
  teacherName?:    string
  onTranslate?:    (messageId: string, text: string) => Promise<string | null>
  // Voice (demo mode only)
  voiceMuted?:     boolean
  onToggleMute?:   () => void
  voiceStates?:    Record<string, VoicePlayState>
  voiceMessages?:  Record<string, { type: string; text: string }>
  onPlayAudio?:    (messageId: string, messageType: string, text: string) => Promise<void>
}

export default function ChatPanel({
  messages, onHide, isDemoMode, teacherName, onTranslate,
  voiceMuted, onToggleMute, voiceStates, voiceMessages, onPlayAudio,
}: Props) {
  const aiName = teacherName ?? (isDemoMode ? 'Sophie' : 'Teacher')
  const bottomRef = useRef<HTMLDivElement>(null)
  const [translatedMsgs, setTranslatedMsgs] = useState<Record<string, { text: string; showing: boolean }>>({})
  const [translatingId, setTranslatingId] = useState<string | null>(null)

  useEffect(() => {
    if (bottomRef.current) {
      const container = bottomRef.current.parentElement
      if (container) container.scrollTop = container.scrollHeight
    }
  }, [messages])

  const handleTranslateClick = async (msgId: string, text: string) => {
    const existing = translatedMsgs[msgId]
    if (existing) {
      setTranslatedMsgs(prev => ({ ...prev, [msgId]: { ...existing, showing: !existing.showing } }))
      return
    }
    if (!onTranslate) return
    setTranslatingId(msgId)
    const translated = await onTranslate(msgId, text)
    setTranslatingId(null)
    if (translated) {
      setTranslatedMsgs(prev => ({ ...prev, [msgId]: { text: translated, showing: true } }))
    }
  }

  const handlePlayClick = (msgId: string) => {
    const vm = voiceMessages?.[msgId]
    if (!vm || !onPlayAudio) return
    const state = voiceStates?.[msgId]
    if (state === 'loading' || state === 'playing') return
    void onPlayAudio(msgId, vm.type, vm.text)
  }

  return (
    <div className="cls-slide-up" style={{
      display: 'flex', flexDirection: 'column',
      background: 'rgba(255,255,255,0.88)',
      backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
      borderRadius: 20,
      boxShadow: '0 2px 0 rgba(255,255,255,0.9) inset, 0 12px 40px rgba(0,0,0,0.07)',
      border: '1px solid rgba(255,255,255,0.7)',
      height: '100%', minHeight: 0, overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 16px 12px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid rgba(110,124,251,0.08)',
        flexShrink: 0,
      }}>
        <span style={{ fontWeight: 800, fontSize: 15, color: '#1a1a2e', letterSpacing: '-0.2px' }}>Chat</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* Mute toggle — demo mode only */}
          {isDemoMode && onToggleMute && (
            <button
              onClick={onToggleMute}
              title={voiceMuted ? 'Unmute teacher voice' : 'Mute teacher voice'}
              style={{
                width: 28, height: 28,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: voiceMuted ? 'rgba(239,68,68,0.08)' : 'rgba(110,124,251,0.08)',
                border: voiceMuted
                  ? '1.5px solid rgba(239,68,68,0.25)'
                  : '1.5px solid rgba(110,124,251,0.15)',
                borderRadius: 8, cursor: 'pointer',
                fontSize: 13, lineHeight: 1, transition: 'all 0.15s',
              }}
            >
              {voiceMuted ? '🔇' : '🔊'}
            </button>
          )}
          <button
            onClick={onHide}
            title="Close chat"
            style={{
              width: 28, height: 28,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(110,124,251,0.08)',
              border: '1.5px solid rgba(110,124,251,0.15)',
              borderRadius: 8, cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(110,124,251,0.16)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(110,124,251,0.08)' }}
          >
            <IcClose s={13} c="#6E7CFB" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {messages.map(msg => {
          const translated    = translatedMsgs[msg.id]
          const displayText   = translated?.showing ? translated.text : msg.text
          const isTranslating = translatingId === msg.id
          const hasVoice      = isDemoMode && !!voiceMessages?.[msg.id]
          const voiceState    = voiceStates?.[msg.id]
          const isVoiceBusy   = voiceState === 'loading' || voiceState === 'playing'

          return (
            <div key={msg.id} style={{
              display: 'flex', flexDirection: msg.sender === 'user' ? 'row-reverse' : 'row',
              gap: 7, alignItems: 'flex-end', animation: 'cls-msg-in 0.25s ease',
            }}>
              {msg.sender === 'ai' && (
                <div style={{
                  width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                  background: 'linear-gradient(135deg,#ede9ff,#fce7f3)',
                  border: '1.5px solid rgba(110,124,251,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 9, fontWeight: 800, color: '#6E7CFB',
                }}>S</div>
              )}
              <div style={{ maxWidth: '82%' }}>
                <div style={{
                  fontSize: 10.5, fontWeight: 700, color: '#ccc', marginBottom: 3,
                  textAlign: msg.sender === 'user' ? 'right' : 'left',
                  display: 'flex', alignItems: 'center', gap: 4,
                  flexDirection: msg.sender === 'user' ? 'row-reverse' : 'row',
                }}>
                  {msg.sender === 'ai' ? aiName : 'You'}

                  {/* Translate button — only on AI messages in demo mode */}
                  {isDemoMode && msg.sender === 'ai' && !msg.isTyping && msg.text && onTranslate && (
                    <button
                      onClick={() => void handleTranslateClick(msg.id, msg.text ?? '')}
                      title={translated?.showing ? 'Show original' : 'Translate'}
                      style={{
                        background: translated?.showing ? 'rgba(110,124,251,0.12)' : 'none',
                        border: translated?.showing ? '1px solid rgba(110,124,251,0.3)' : '1px solid rgba(200,200,210,0.5)',
                        borderRadius: 5, padding: '1px 5px',
                        fontSize: 10, cursor: 'pointer', color: '#9B8CFF',
                        transition: 'all 0.15s', lineHeight: 1.4,
                        opacity: isTranslating ? 0.5 : 1,
                      }}
                    >
                      {isTranslating ? '…' : translated?.showing ? '🇬🇧' : '🌐'}
                    </button>
                  )}

                  {/* Voice play button — only on voice-eligible AI messages */}
                  {hasVoice && msg.sender === 'ai' && !msg.isTyping && (
                    <button
                      onClick={() => handlePlayClick(msg.id)}
                      title={
                        voiceState === 'loading' ? 'Loading voice…'
                        : voiceState === 'playing' ? 'Playing…'
                        : voiceState === 'done'    ? 'Replay voice'
                        : voiceState === 'error'   ? 'Voice failed — try again'
                        : 'Play voice'
                      }
                      disabled={isVoiceBusy}
                      style={{
                        background: voiceState === 'done'
                          ? 'rgba(110,124,251,0.10)'
                          : voiceState === 'error'
                          ? 'rgba(239,68,68,0.08)'
                          : 'none',
                        border: voiceState === 'error'
                          ? '1px solid rgba(239,68,68,0.3)'
                          : '1px solid rgba(200,200,210,0.5)',
                        borderRadius: 5, padding: '1px 5px',
                        fontSize: 10, lineHeight: 1.4,
                        cursor: isVoiceBusy ? 'default' : 'pointer',
                        color: voiceState === 'error' ? '#EF4444' : '#9B8CFF',
                        opacity: isVoiceBusy ? 0.6 : 1,
                        transition: 'all 0.15s',
                      }}
                    >
                      {voiceState === 'loading' ? '⏳'
                       : voiceState === 'playing' ? '▶'
                       : voiceState === 'done'    ? '↺'
                       : voiceState === 'error'   ? '▶'
                       : '▶'}
                    </button>
                  )}
                </div>
                <div style={{
                  padding: '8px 11px',
                  borderRadius: msg.sender === 'user' ? '13px 13px 4px 13px' : '13px 13px 13px 4px',
                  background: msg.sender === 'user' ? 'linear-gradient(135deg,#6E7CFB,#9B8CFF)' : 'white',
                  color: msg.sender === 'user' ? 'white' : '#1a1a2e',
                  fontSize: 12.5, lineHeight: 1.55, fontWeight: 500,
                  boxShadow: msg.sender === 'ai' ? '0 2px 8px rgba(0,0,0,0.06)' : '0 4px 12px rgba(110,124,251,0.25)',
                  border: msg.sender === 'ai' ? '1px solid #f0eeff' : 'none',
                }}>
                  {msg.isTyping ? (
                    <div style={{ display: 'flex', gap: 3, padding: '2px', alignItems: 'center' }}>
                      <span className="cls-typing-dot" />
                      <span className="cls-typing-dot" />
                      <span className="cls-typing-dot" />
                    </div>
                  ) : msg.sender === 'ai' && displayText
                    ? formatAIMessage(displayText)
                    : displayText}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      <div style={{ padding: '8px 14px 11px', borderTop: '1px solid rgba(110,124,251,0.07)', flexShrink: 0 }}>
        <span style={{ fontSize: 11, color: '#c5c0d8', fontWeight: 500, fontStyle: 'italic' }}>
          Use the main input below to write.
        </span>
      </div>
    </div>
  )
}
