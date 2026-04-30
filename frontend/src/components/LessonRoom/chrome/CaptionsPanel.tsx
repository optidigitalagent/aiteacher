import { useEffect, useRef } from 'react'
import type { Message } from '../../../hooks/useLesson'

interface CaptionsPanelProps {
  messages:      Message[]
  onClose:       () => void
  input:         string
  onInputChange: (v: string) => void
  onSend:        () => void
  onKeyDown:     (e: React.KeyboardEvent) => void
}

// FUTURE: messages come from lesson transcript via WebSocket (useLesson hook)
export function CaptionsPanel({
  messages,
  onClose,
  input,
  onInputChange,
  onSend,
  onKeyDown,
}: CaptionsPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  return (
    <div className="w-64 flex-none flex flex-col bg-white border-l border-[rgba(0,0,0,0.07)] z-20 animate-slide-right overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-100 flex-none">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-cls-accent" />
          <span className="text-xs font-semibold text-gray-700">Chat</span>
        </div>
        <button
          onClick={onClose}
          className="w-6 h-6 rounded-md flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          title="Close chat"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-0">
        {messages.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-6 leading-relaxed">
            Conversation will appear here as the lesson progresses.
          </p>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col gap-1 animate-fade-up ${msg.role === 'student' ? 'items-end' : 'items-start'}`}
            >
              {msg.role === 'teacher' && (
                <span className="text-[10px] font-medium text-gray-400 px-1">Sophie</span>
              )}
              <div className={`
                max-w-[90%] rounded-2xl px-3 py-2 text-xs leading-relaxed
                ${msg.role === 'student'
                  ? 'bg-cls-accent text-white rounded-br-sm'
                  : 'bg-gray-100 text-gray-700 rounded-bl-sm'
                }
              `}>
                {msg.displayText ?? msg.text}
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Message input */}
      {/* FUTURE: connect to lesson WebSocket via onSend handler */}
      <div className="px-3 py-3 border-t border-gray-100 flex-none">
        <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2 border border-gray-200 focus-within:border-cls-accent/40 focus-within:bg-white transition-all">
          <input
            type="text"
            value={input}
            onChange={e => onInputChange(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Type a message…"
            className="flex-1 bg-transparent text-xs text-gray-900 focus:outline-none placeholder-gray-400"
          />
          <button
            onClick={onSend}
            disabled={!input.trim()}
            className="w-6 h-6 rounded-lg bg-cls-accent text-white flex items-center justify-center hover:opacity-90 transition-opacity disabled:opacity-30"
            title="Send"
          >
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <path d="M1 5.5h9M6.5 2 10 5.5 6.5 9" stroke="white" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Hide chat button */}
      <div className="px-4 pb-4 flex-none">
        <button
          onClick={onClose}
          className="w-full py-2 rounded-xl bg-gray-100 text-gray-500 text-xs font-medium hover:bg-gray-200 transition-colors"
        >
          Hide chat
        </button>
      </div>
    </div>
  )
}
