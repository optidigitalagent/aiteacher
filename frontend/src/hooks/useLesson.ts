import { useCallback, useEffect, useRef, useState } from 'react'

export type LessonPhase =
  | 'DIAGNOSTIC'
  | 'CONTEXT_INPUT'
  | 'RULE_DISCOVERY'
  | 'EXERCISES'
  | 'VOCABULARY'
  | 'DEEP_THINKING'
  | 'WRAP_UP'

export interface Message {
  id:          string
  role:        'student' | 'teacher'
  text:        string
  displayText?: string
  phase?:      LessonPhase
}

export interface ExerciseCard {
  id:             string
  exerciseType:   string
  question:       string   // current item only
  hint:           string
  difficulty:     number
  exerciseNumber?: number
  instruction?:   string
  skillFocus?:    string
  items?:         string[] // all exercise items for card display
}

export interface SlideBlock {
  label:    string
  form?:    string
  example?: string
}

export interface SectionCard {
  sectionId:      string
  title:          string
  blocks:         SlideBlock[]
  commonMistake?: string
}

export interface TeachingCard {
  cardType:    'mini_explanation' | 'grammar_overview'
  displayText: string
}

type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error'

interface LessonConfig {
  studentId:     string
  grammarTarget: string
  lessonTopic:   string
  textbookUnit:  string
}

interface FocusLessonConfig {
  studentId: string
  unit:      number
  section?:  string
}

interface ConfusedContext {
  sectionId?:          string
  phase?:              string
  currentExerciseNum?: number
  lastTeacherMessage?: string
  lastExercise?:       string
  studentLastAnswer?:  string
}

const WS_URL = 'ws://localhost:4000/lesson'

export function useLesson() {
  const wsRef                                     = useRef<WebSocket | null>(null)
  const [messages, setMessages]                   = useState<Message[]>([])
  const [connectionState, setConnectionState]     = useState<ConnectionState>('disconnected')
  const [currentPhase, setCurrentPhase]           = useState<LessonPhase>('DIAGNOSTIC')
  const [currentExercise, setCurrentExercise]     = useState<ExerciseCard | null>(null)
  const [sectionCard, setSectionCard]             = useState<SectionCard | null>(null)
  const [teachingCard, setTeachingCard]           = useState<TeachingCard | null>(null)
  const [isConfusionLoading, setConfusionLoading] = useState(false)
  const [isTeacherSpeaking, setIsTeacherSpeaking] = useState(false)

  const ttsChunksRef = useRef<string[]>([])
  const ttsTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const ttsSourceRef = useRef<AudioBufferSourceNode | null>(null)
  const audioCtxRef  = useRef<AudioContext | null>(null)

  const flushTTS = useCallback(async () => {
    const chunks = ttsChunksRef.current.splice(0)
    if (!chunks.length) return

    const arrays = chunks.map((b64) => {
      const bin = atob(b64)
      const arr = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
      return arr
    })
    const total  = arrays.reduce((s, a) => s + a.length, 0)
    const merged = new Uint8Array(total)
    let off = 0
    for (const a of arrays) { merged.set(a, off); off += a.length }

    try {
      if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
        audioCtxRef.current = new AudioContext()
      }
      const decoded = await audioCtxRef.current.decodeAudioData(merged.buffer)
      const src     = audioCtxRef.current.createBufferSource()
      src.buffer    = decoded
      src.connect(audioCtxRef.current.destination)
      src.onended   = () => { ttsSourceRef.current = null; setIsTeacherSpeaking(false) }
      try { ttsSourceRef.current?.stop() } catch { /* noop */ }
      ttsSourceRef.current = src
      setIsTeacherSpeaking(true)
      src.start()
    } catch {
      setIsTeacherSpeaking(false)
    }
  }, [])

  const queueTTSChunk = useCallback((b64: string) => {
    ttsChunksRef.current.push(b64)
    if (ttsTimerRef.current !== null) clearTimeout(ttsTimerRef.current)
    ttsTimerRef.current = setTimeout(() => { void flushTTS() }, 400)
  }, [flushTTS])

  const addMessage = useCallback((
    role: Message['role'],
    text: string,
    displayText?: string,
    phase?: LessonPhase,
  ) => {
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role, text, displayText, phase },
    ])
  }, [])

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    setConnectionState('connecting')
    const ws = new WebSocket(WS_URL)
    wsRef.current = ws

    ws.onopen = () => setConnectionState('connected')

    ws.onmessage = (event: MessageEvent<string>) => {
      let msg: Record<string, unknown>
      try { msg = JSON.parse(event.data) as Record<string, unknown> } catch { return }

      switch (msg.type) {
        case 'ai_text':
          addMessage(
            'teacher',
            msg.text as string,
            msg.displayText as string | undefined,
            msg.phase as LessonPhase,
          )
          setCurrentPhase(msg.phase as LessonPhase)
          setConfusionLoading(false)
          break

        case 'phase_change':
          setCurrentPhase(msg.to as LessonPhase)
          break

        case 'exercise':
          setCurrentExercise(msg.exercise as ExerciseCard)
          break

        case 'feedback':
          // Clear exercise after feedback — teacher will present next one via ai_text
          if (msg.correct) setCurrentExercise(null)
          break

        case 'section_card': {
          const c = msg.card as { title: string; blocks: SlideBlock[]; commonMistake?: string }
          setSectionCard({
            sectionId:    msg.sectionId as string,
            title:        c.title,
            blocks:       c.blocks,
            commonMistake: c.commonMistake,
          })
          break
        }

        case 'teaching_card':
          setTeachingCard({
            cardType:    msg.cardType as TeachingCard['cardType'],
            displayText: msg.displayText as string,
          })
          setConfusionLoading(false)
          break

        case 'audio_chunk':
          queueTTSChunk(msg.data as string)
          break

        case 'lesson_end':
          setCurrentExercise(null)
          break

        case 'error':
          console.error('[ws] server error:', msg.code, msg.message)
          setConfusionLoading(false)
          break
      }
    }

    ws.onerror = () => setConnectionState('error')

    ws.onclose = () => {
      setConnectionState('disconnected')
      wsRef.current = null
    }
  }, [addMessage, queueTTSChunk])

  const startLesson = useCallback((config: LessonConfig) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
    wsRef.current.send(JSON.stringify({ type: 'lesson_start', payload: config }))
  }, [])

  const startFocusLesson = useCallback((config: FocusLessonConfig) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
    wsRef.current.send(JSON.stringify({ type: 'focus_lesson_start', payload: config }))
  }, [])

  const sendText = useCallback((text: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
    addMessage('student', text)
    wsRef.current.send(JSON.stringify({ type: 'text_message', text }))
  }, [addMessage])

  const sendConfused = useCallback((ctx: ConfusedContext) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
    setConfusionLoading(true)
    setTeachingCard(null)
    wsRef.current.send(JSON.stringify({ type: 'student_confused', ...ctx }))
  }, [])

  const dismissTeachingCard = useCallback(() => setTeachingCard(null), [])

  useEffect(() => {
    return () => {
      wsRef.current?.close()
      if (ttsTimerRef.current !== null) clearTimeout(ttsTimerRef.current)
      try { ttsSourceRef.current?.stop() } catch { /* noop */ }
    }
  }, [])

  return {
    messages,
    connectionState,
    currentPhase,
    currentExercise,
    sectionCard,
    teachingCard,
    isConfusionLoading,
    isTeacherSpeaking,
    connect,
    startLesson,
    startFocusLesson,
    sendText,
    sendConfused,
    dismissTeachingCard,
  }
}
