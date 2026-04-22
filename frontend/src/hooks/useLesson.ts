import { useCallback, useEffect, useRef, useState } from 'react'

type LessonPhase =
  | 'DIAGNOSTIC'
  | 'CONTEXT_INPUT'
  | 'RULE_DISCOVERY'
  | 'EXERCISES'
  | 'VOCABULARY'
  | 'DEEP_THINKING'
  | 'WRAP_UP'

export interface Message {
  id:     string
  role:   'student' | 'teacher'
  text:   string
  phase?: LessonPhase
}

type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error'

interface LessonConfig {
  studentId:     string
  grammarTarget: string
  lessonTopic:   string
  textbookUnit:  string
}

const WS_URL = 'ws://localhost:4000/lesson'

export function useLesson() {
  const wsRef                               = useRef<WebSocket | null>(null)
  const [messages, setMessages]             = useState<Message[]>([])
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected')
  const [currentPhase, setCurrentPhase]     = useState<LessonPhase>('DIAGNOSTIC')

  const addMessage = useCallback((role: Message['role'], text: string, phase?: LessonPhase) => {
    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role, text, phase }])
  }, [])

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    setConnectionState('connecting')
    const ws = new WebSocket(WS_URL)
    wsRef.current = ws

    ws.onopen = () => {
      setConnectionState('connected')
    }

    ws.onmessage = (event: MessageEvent<string>) => {
      let msg: Record<string, unknown>
      try {
        msg = JSON.parse(event.data) as Record<string, unknown>
      } catch {
        return
      }

      switch (msg.type) {
        case 'ai_text':
          addMessage('teacher', msg.text as string, msg.phase as LessonPhase)
          setCurrentPhase(msg.phase as LessonPhase)
          break
        case 'phase_change':
          setCurrentPhase(msg.to as LessonPhase)
          break
        case 'error':
          console.error('[ws] server error:', msg.code, msg.message)
          break
      }
    }

    ws.onerror = () => {
      setConnectionState('error')
    }

    ws.onclose = () => {
      setConnectionState('disconnected')
      wsRef.current = null
    }
  }, [addMessage])

  const startLesson = useCallback((config: LessonConfig) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
    wsRef.current.send(JSON.stringify({ type: 'lesson_start', payload: config }))
  }, [])

  const sendText = useCallback((text: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
    addMessage('student', text)
    wsRef.current.send(JSON.stringify({ type: 'text_message', text }))
  }, [addMessage])

  useEffect(() => {
    return () => {
      wsRef.current?.close()
    }
  }, [])

  return {
    messages,
    connectionState,
    currentPhase,
    connect,
    startLesson,
    sendText,
  }
}
