import { useState, useCallback } from 'react'
import type { ChatMessage } from '../types'

// send is reserved for future outbound chat commands (currently no REST needed)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useClassroomChat(_opts?: { send?: (p: object) => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([])

  // Show typing indicator (AI is processing)
  const setTyping = useCallback(() => {
    setMessages((prev) => [
      ...prev.filter((m) => !m.isTyping),
      { id: 'typing', sender: 'ai', isTyping: true },
    ])
  }, [])

  // Remove typing indicator
  const clearTyping = useCallback(() => {
    setMessages((prev) => prev.filter((m) => !m.isTyping))
  }, [])

  // Append an AI message (replaces typing bubble if present)
  const pushAI = useCallback((text: string) => {
    const id = `m${Date.now()}`
    setMessages((prev) => [
      ...prev.filter((m) => !m.isTyping),
      { id, sender: 'ai', text },
    ])
  }, [])

  // Append a user message (optimistic, before backend confirms)
  const pushUser = useCallback((text: string) => {
    if (!text.trim()) return
    setMessages((prev) => [
      ...prev.filter((m) => !m.isTyping),
      { id: `m${Date.now()}`, sender: 'user', text },
    ])
  }, [])

  // Restore chat history from transcript events on reconnect/resync.
  // Only restores if current chat is empty (avoids duplicates on partial reconnects).
  // Does not replay audio. Does not trigger AI generation.
  const restoreMessages = useCallback(
    (entries: Array<{ speaker: 'teacher' | 'student'; text: string }>) => {
      setMessages((prev) => {
        if (prev.length > 0) return prev   // already have messages — don't duplicate
        return entries.map((e, i) => ({
          id:     `restored_${i}`,
          sender: e.speaker === 'teacher' ? ('ai' as const) : ('user' as const),
          text:   e.text,
        }))
      })
    },
    [],
  )

  return { messages, pushUser, pushAI, setTyping, clearTyping, restoreMessages }
}
