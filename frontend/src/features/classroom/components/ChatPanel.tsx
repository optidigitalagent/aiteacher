import { useEffect, useRef } from 'react'
import type { ChatMessage } from '../types'
import { IcClose } from './icons'

interface Props {
  messages: ChatMessage[]
  onHide:   () => void
}

// ChatPanel is READ-ONLY.
// The only input in the classroom is BottomControls.
// TODO: messages fed via WebSocket: { type: 'ai_text', text: string } → pushed here

export default function ChatPanel({ messages, onHide }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (bottomRef.current) {
      const container = bottomRef.current.parentElement
      if (container) container.scrollTop = container.scrollHeight
    }
  }, [messages])

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

      {/* Messages — no input here; BottomControls is the only input */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {messages.map(msg => (
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
              <div style={{ fontSize: 10.5, fontWeight: 700, color: '#ccc', marginBottom: 3, textAlign: msg.sender === 'user' ? 'right' : 'left' }}>
                {msg.sender === 'ai' ? 'Sophie' : 'You'}
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
                ) : msg.text}
              </div>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Footer hint — reminds user that input is at the bottom */}
      <div style={{ padding: '8px 14px 11px', borderTop: '1px solid rgba(110,124,251,0.07)', flexShrink: 0 }}>
        <span style={{ fontSize: 11, color: '#c5c0d8', fontWeight: 500, fontStyle: 'italic' }}>
          Use the main input below to write.
        </span>
      </div>
    </div>
  )
}
