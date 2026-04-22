import { useEffect, useRef, useState } from 'react'
import { useLesson } from '../../hooks/useLesson'

const TEST_CONFIG = {
  studentId:     '00000000-0000-0000-0000-000000000001',
  grammarTarget: 'Dynamic and state verbs',
  lessonTopic:   'Social media and identity',
  textbookUnit:  'Focus B1 Unit 1',
}

const PHASE_LABELS: Record<string, string> = {
  DIAGNOSTIC:    'Diagnostic',
  CONTEXT_INPUT: 'Context',
  RULE_DISCOVERY: 'Rule Discovery',
  EXERCISES:     'Exercises',
  VOCABULARY:    'Vocabulary',
  DEEP_THINKING: 'Deep Thinking',
  WRAP_UP:       'Wrap-Up',
}

const STATUS_COLORS: Record<string, string> = {
  disconnected: 'bg-gray-400',
  connecting:   'bg-yellow-400 animate-pulse',
  connected:    'bg-green-400',
  error:        'bg-red-500',
}

export default function LessonRoom() {
  const { messages, connectionState, currentPhase, connect, startLesson, sendText } = useLesson()
  const [input, setInput]       = useState('')
  const [started, setStarted]   = useState(false)
  const bottomRef               = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function handleConnect() {
    connect()
  }

  function handleStart() {
    startLesson(TEST_CONFIG)
    setStarted(true)
  }

  function handleSend() {
    const text = input.trim()
    if (!text) return
    sendText(text)
    setInput('')
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-gray-100">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 bg-gray-900 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-brand-500 text-lg">AI English Teacher</span>
          <span className="text-xs text-gray-500 font-mono">Phase 0 — Foundation</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className={`w-2.5 h-2.5 rounded-full ${STATUS_COLORS[connectionState]}`} />
          <span className="text-gray-400 capitalize">{connectionState}</span>
          {connectionState === 'connected' && (
            <span className="ml-2 text-xs bg-gray-800 text-brand-500 px-2 py-0.5 rounded font-mono">
              {PHASE_LABELS[currentPhase] ?? currentPhase}
            </span>
          )}
        </div>
      </header>

      {/* Message area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-gray-600">
            <div className="text-5xl">📚</div>
            <p className="text-center max-w-sm">
              Connect to the backend, then start a lesson to begin.
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'student' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed
                ${msg.role === 'student'
                  ? 'bg-brand-700 text-white rounded-br-sm'
                  : 'bg-gray-800 text-gray-100 rounded-bl-sm'
                }`}
            >
              {msg.role === 'teacher' && msg.phase && (
                <div className="text-xs text-gray-500 mb-1 font-mono">
                  [{PHASE_LABELS[msg.phase] ?? msg.phase}]
                </div>
              )}
              {msg.text}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Controls */}
      <div className="px-4 py-3 bg-gray-900 border-t border-gray-800 space-y-2">
        {connectionState === 'disconnected' || connectionState === 'error' ? (
          <button
            onClick={handleConnect}
            className="w-full py-2.5 rounded-xl bg-brand-700 hover:bg-brand-500 transition text-sm font-medium"
          >
            Connect to Backend
          </button>
        ) : !started && connectionState === 'connected' ? (
          <button
            onClick={handleStart}
            className="w-full py-2.5 rounded-xl bg-green-700 hover:bg-green-600 transition text-sm font-medium"
          >
            Start Lesson — {TEST_CONFIG.grammarTarget}
          </button>
        ) : (
          <div className="flex gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your answer... (Enter to send)"
              rows={1}
              disabled={connectionState !== 'connected'}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5
                         text-sm resize-none focus:outline-none focus:border-brand-500
                         disabled:opacity-50 placeholder-gray-600"
            />
            <button
              onClick={handleSend}
              disabled={connectionState !== 'connected' || !input.trim()}
              className="px-5 py-2.5 rounded-xl bg-brand-700 hover:bg-brand-500 transition
                         text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Send
            </button>
          </div>
        )}
        <p className="text-center text-xs text-gray-700">
          Voice input arrives in Phase 1 — Deepgram STT integration
        </p>
      </div>
    </div>
  )
}
