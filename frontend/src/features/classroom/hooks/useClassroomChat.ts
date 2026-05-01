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

  return { messages, pushUser, pushAI, setTyping, clearTyping }
}
