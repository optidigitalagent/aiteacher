import { useState, useEffect, useCallback, useRef } from 'react'
import type { ChatMessage, LessonStep } from '../types'
import { playAudioChunk } from '../services/voiceApi'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

const DEMO_STEP_KEYS = ['warm_up', 'grammar_mcq', 'speaking_task', 'writing_task'] as const
type DemoStepKey = (typeof DEMO_STEP_KEYS)[number]

const DEMO_STEP_LABELS: Record<DemoStepKey, string> = {
  warm_up:       'Warm-up',
  grammar_mcq:   'Grammar',
  speaking_task: 'Speaking',
  writing_task:  'Writing',
}

interface TeacherMessage { text: string; delay: number }

export interface DemoStepContent {
  key:             string
  index:           number
  type:            'text_input' | 'mcq'
  teacherMessages: TeacherMessage[]
  prompt?:         string
  placeholder?:    string
  minLength:       number
  options?:        string[]
}

export interface DemoFinalResult {
  level:            string
  score:            number
  strengths:        string[]
  areas_to_improve: string[]
  teacher_message:  string
}

export type DemoPhase = 'loading' | 'intro' | 'lesson' | 'complete' | 'error'

export type VoicePlayState = 'loading' | 'playing' | 'done' | 'error'

export interface UseDemoSessionReturn {
  chatMessages:           ChatMessage[]
  steps:                  LessonStep[]
  progress:               number
  isSpeaking:             boolean
  lessonStarted:          boolean
  phase:                  DemoPhase
  currentStep:            DemoStepContent | null
  finalResult:            DemoFinalResult | null
  interestArea:           string
  submitting:             boolean
  selectedOption:         number | null
  setSelectedOption:      (i: number | null) => void
  handleTextSubmit:       (answer: string) => void
  handleMcqSelect:        (i: number) => void
  handleHelpRequest:      (text: string) => void
  handleTranslateMessage: (messageId: string, text: string, lang: string) => Promise<string | null>
  showLeaveModal:         boolean
  setShowLeaveModal:      (v: boolean) => void
  error:                  string | null
  // Voice
  voiceMuted:             boolean
  toggleVoiceMuted:       () => void
  voiceStates:            Record<string, VoicePlayState>
  voiceMessages:          Record<string, { type: string; text: string }>
  handlePlayAudio:        (messageId: string, messageType: string, text: string) => Promise<void>
}

function uid() { return Math.random().toString(36).slice(2) }
function sleep(ms: number) { return new Promise<void>((r) => setTimeout(r, ms)) }

function buildFeedbackText(
  fb: { message: string; correction: string | null; score: number | null; correct: boolean | null },
  studentText: string,
): string {
  let text = fb.message
  if (fb.correction) {
    text += '\n\n'
    if (studentText) {
      text += `✗ "${studentText}"\n✓ "${fb.correction}"`
    } else {
      text += `Try: "${fb.correction}"`
    }
  }
  if (fb.score != null) text += `\n\nScore: ${fb.score}/10`
  return text
}

export function useDemoSession({
  demoId,
  token,
  enabled,
  onNotFound,
}: {
  demoId:     string
  token:      string
  enabled:    boolean
  onNotFound: () => void
}): UseDemoSessionReturn {
  const [phase,          setPhase]          = useState<DemoPhase>('loading')
  const [chatMessages,   setChatMessages]   = useState<ChatMessage[]>([])
  const [currentStep,    setCurrentStep]    = useState<DemoStepContent | null>(null)
  const [finalResult,    setFinalResult]    = useState<DemoFinalResult | null>(null)
  const [interestArea,   setInterestArea]   = useState('')
  const [completedSteps, setCompletedSteps] = useState<string[]>([])
  const [isSpeaking,     setIsSpeaking]     = useState(false)
  const [submitting,     setSubmitting]     = useState(false)
  const [selectedOption, setSelectedOption] = useState<number | null>(null)
  const [showLeaveModal, setShowLeaveModal] = useState(false)
  const [error,          setError]          = useState<string | null>(null)
  const [lessonStarted,  setLessonStarted]  = useState(false)
  const [sessionId,      setSessionId]      = useState<string | null>(null)

  // Voice state
  const [voiceMuted,        setVoiceMuted]        = useState(false)
  const [voiceStates,       setVoiceStates]       = useState<Record<string, VoicePlayState>>({})
  const [voiceMessages,     setVoiceMessages]     = useState<Record<string, { type: string; text: string }>>({})
  const [pendingVoicePlay,  setPendingVoicePlay]  = useState<{ id: string; type: string; text: string } | null>(null)

  // Refs keep async callbacks always fresh without re-creating them
  const didInit              = useRef(false)
  const submittingRef        = useRef(false)
  const currentStepRef       = useRef<DemoStepContent | null>(null)
  const sessionIdRef         = useRef<string | null>(null)
  const currentTeacherMsgRef = useRef<string | null>(null)
  const mcqTimerRef          = useRef<ReturnType<typeof setTimeout> | null>(null)
  const voiceMutedRef        = useRef(false)

  useEffect(() => { submittingRef.current  = submitting  }, [submitting])
  useEffect(() => { currentStepRef.current = currentStep }, [currentStep])
  useEffect(() => { sessionIdRef.current   = sessionId   }, [sessionId])
  useEffect(() => { voiceMutedRef.current  = voiceMuted  }, [voiceMuted])

  const pushTeacher = useCallback((text: string) => {
    const existing = currentTeacherMsgRef.current
    if (existing) {
      setChatMessages((prev) =>
        prev.map((m) => (m.id === existing ? { ...m, text: (m.text ?? '') + ' ' + text } : m)),
      )
    } else {
      const id = uid()
      currentTeacherMsgRef.current = id
      setChatMessages((prev) => [
        ...prev.filter((m) => !m.isTyping),
        { id, sender: 'ai', text },
      ])
    }
  }, [])

  const playMessages = useCallback(async (msgs: TeacherMessage[]) => {
    currentTeacherMsgRef.current = null
    for (const msg of msgs) {
      if (msg.delay > 0) await sleep(Math.min(msg.delay, 2600))
      setChatMessages((prev) => [
        ...prev.filter((m) => !m.isTyping),
        { id: 'typing', sender: 'ai', isTyping: true },
      ])
      setIsSpeaking(true)
      await sleep(Math.min(800 + msg.text.length * 16, 3200))
      setIsSpeaking(false)
      pushTeacher(msg.text)
    }
  }, [pushTeacher])

  // ── Voice: fetch and play TTS audio for a teacher message ────────────────────
  const handlePlayAudio = useCallback(async (messageId: string, messageType: string, text: string) => {
    const sid = sessionIdRef.current
    if (!sid) return
    setVoiceStates(prev => ({ ...prev, [messageId]: 'loading' }))
    try {
      const res = await fetch(`${API_BASE}/demo/tts`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ sessionId: sid, messageId, messageType, messageText: text }),
      })
      if (!res.ok) {
        setVoiceStates(prev => ({ ...prev, [messageId]: 'error' }))
        return
      }
      const j = (await res.json()) as { audio?: string }
      if (!j.audio) {
        setVoiceStates(prev => ({ ...prev, [messageId]: 'error' }))
        return
      }
      setVoiceStates(prev => ({ ...prev, [messageId]: 'playing' }))
      await playAudioChunk(j.audio)
      setVoiceStates(prev => ({ ...prev, [messageId]: 'done' }))
    } catch {
      setVoiceStates(prev => ({ ...prev, [messageId]: 'error' }))
    }
  }, [token])

  const toggleVoiceMuted = useCallback(() => setVoiceMuted(prev => !prev), [])

  // ── Register a message for voice + schedule auto-play ────────────────────────
  const scheduleVoice = useCallback((id: string, type: string, text: string) => {
    setVoiceMessages(prev => ({ ...prev, [id]: { type, text } }))
    setPendingVoicePlay({ id, type, text })
  }, [])

  // ── Auto-play effect — fires when pendingVoicePlay is set ───────────────────
  useEffect(() => {
    if (!pendingVoicePlay) return
    const { id, type, text } = pendingVoicePlay
    setPendingVoicePlay(null)
    if (!voiceMutedRef.current) {
      void handlePlayAudio(id, type, text)
    }
  }, [pendingVoicePlay, handlePlayAudio])

  // Core submit — reads from refs to avoid stale closures in async callbacks
  const submitAnswer = useCallback(async (answerStr: string, displayAnswer: string) => {
    const step = currentStepRef.current
    const sid  = sessionIdRef.current
    if (!step || !sid || submittingRef.current) return

    currentTeacherMsgRef.current = null
    setChatMessages((prev) => [
      ...prev.filter((m) => !m.isTyping),
      { id: uid(), sender: 'user', text: displayAnswer },
    ])
    setSubmitting(true)

    try {
      const res = await fetch(`${API_BASE}/demo/answer`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ sessionId: sid, stepKey: step.key, answer: answerStr }),
      })

      if (!res.ok) {
        const j = (await res.json()) as { message?: string; code?: string }
        setChatMessages((prev) => [
          ...prev.filter((m) => !m.isTyping),
          {
            id:     uid(),
            sender: 'ai',
            text:   j.message ?? (j.code === 'INVALID_ANSWER' ? 'Please try again.' : 'Something went wrong.'),
          },
        ])
        return
      }

      const j = (await res.json()) as {
        feedback:    { message: string; correction: string | null; score: number | null; correct: boolean | null }
        nextStep:    DemoStepContent | null
        finalResult: DemoFinalResult | null
        isComplete:  boolean
      }

      await sleep(500)
      setChatMessages((prev) => [...prev, { id: 'typing', sender: 'ai', isTyping: true }])
      setIsSpeaking(true)
      await sleep(1200)
      setIsSpeaking(false)

      // Feedback voice type — specific per step so TTS budget can track separately
      const feedbackMsgType = step.key === 'speaking_task' ? 'speaking_feedback'
        : step.key === 'writing_task' ? 'writing_feedback'
        : undefined

      const feedbackId   = uid()
      const feedbackText = buildFeedbackText(j.feedback, displayAnswer)

      setChatMessages((prev) => [
        ...prev.filter((m) => !m.isTyping),
        {
          id:     feedbackId,
          sender: 'ai',
          text:   feedbackText,
          ...(feedbackMsgType ? { messageType: feedbackMsgType } : {}),
        },
      ])

      if (feedbackMsgType) {
        // Use raw message (not the formatted text with ✗/✓ symbols) for TTS
        scheduleVoice(feedbackId, feedbackMsgType, j.feedback.message.slice(0, 400))
      }

      setSelectedOption(null)
      setCompletedSteps((prev) => [...prev, step.key])

      if (j.isComplete && j.finalResult) {
        await sleep(2000)
        setFinalResult(j.finalResult)
        setPhase('complete')
        return
      }

      if (j.nextStep) {
        await sleep(2000)
        setCurrentStep(j.nextStep)
        await playMessages(j.nextStep.teacherMessages)
        // Tag next-step prompt for voice (follow-up question / main task instruction)
        const nextBubbleId = currentTeacherMsgRef.current
        if (nextBubbleId && j.nextStep.teacherMessages.length > 0) {
          const nextText = j.nextStep.teacherMessages.map(m => m.text).join(' ').slice(0, 300)
          setChatMessages(prev => prev.map(m =>
            m.id === nextBubbleId ? { ...m, messageType: 'follow_up_question' } : m,
          ))
          scheduleVoice(nextBubbleId, 'follow_up_question', nextText)
        }
      }
    } catch {
      setChatMessages((prev) => [
        ...prev.filter((m) => !m.isTyping),
        { id: uid(), sender: 'ai', text: 'Something went wrong. Please try again.' },
      ])
    } finally {
      setSubmitting(false)
    }
  }, [token, playMessages, scheduleVoice])

  // Session init — runs once after enabled + auth
  useEffect(() => {
    if (!enabled || didInit.current || !demoId || !token) return
    didInit.current = true

    void (async () => {
      try {
        const res = await fetch(`${API_BASE}/demo/session/${demoId}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) {
          const j = (await res.json()) as { code?: string }
          if (j.code === 'NOT_FOUND') { onNotFound(); return }
          throw new Error('load failed')
        }
        const data = (await res.json()) as {
          id:          string
          isComplete:  boolean
          interestArea: string
          intro:       { messages: TeacherMessage[] }
          currentStep: DemoStepContent | null
          finalResult: DemoFinalResult | null
        }

        setSessionId(data.id)
        setInterestArea(data.interestArea)

        if (data.isComplete && data.finalResult) {
          setFinalResult(data.finalResult)
          setPhase('complete')
          return
        }

        setPhase('intro')
        await playMessages(data.intro.messages)

        // Tag intro bubble for greeting voice
        const introBubbleId = currentTeacherMsgRef.current
        if (introBubbleId && data.intro.messages.length > 0) {
          const introTtsText = data.intro.messages.map(m => m.text).join(' ').slice(0, 400)
          setChatMessages(prev => prev.map(m =>
            m.id === introBubbleId ? { ...m, messageType: 'greeting' } : m,
          ))
          scheduleVoice(introBubbleId, 'greeting', introTtsText)
        }

        setLessonStarted(true)
        setPhase('lesson')

        if (data.currentStep) {
          setCurrentStep(data.currentStep)
          await playMessages(data.currentStep.teacherMessages)
          // Tag initial step instruction for voice
          const stepBubbleId = currentTeacherMsgRef.current
          if (stepBubbleId && data.currentStep.teacherMessages.length > 0) {
            const stepText = data.currentStep.teacherMessages.map(m => m.text).join(' ').slice(0, 300)
            setChatMessages(prev => prev.map(m =>
              m.id === stepBubbleId ? { ...m, messageType: 'main_prompt' } : m,
            ))
            scheduleVoice(stepBubbleId, 'main_prompt', stepText)
          }
        }
      } catch {
        setError('Could not load your lesson. Please refresh.')
        setPhase('error')
      }
    })()
  }, [enabled, demoId, token, onNotFound, playMessages, scheduleVoice]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleTextSubmit = useCallback((answer: string) => {
    if (!answer.trim() || currentStepRef.current?.type === 'mcq') return
    void submitAnswer(answer.trim(), answer.trim())
  }, [submitAnswer])

  const handleHelpRequest = useCallback((text: string) => {
    const sid = sessionIdRef.current
    if (!sid) return
    const trimmed = text.trim().slice(0, 160)
    if (!trimmed) return

    currentTeacherMsgRef.current = null
    setChatMessages((prev) => [
      ...prev.filter((m) => !m.isTyping),
      { id: uid(), sender: 'user', text: `❓ ${trimmed}` },
    ])

    void (async () => {
      try {
        setChatMessages((prev) => [...prev, { id: 'typing', sender: 'ai', isTyping: true }])
        setIsSpeaking(true)
        const res = await fetch(`${API_BASE}/demo/help`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body:    JSON.stringify({ sessionId: sid, text: trimmed }),
        })
        await sleep(800)
        setIsSpeaking(false)
        const j = (await res.json()) as { message?: string }
        setChatMessages((prev) => [
          ...prev.filter((m) => !m.isTyping),
          { id: uid(), sender: 'ai', text: j.message ?? "I couldn't process that help request." },
        ])
      } catch {
        setIsSpeaking(false)
        setChatMessages((prev) => [
          ...prev.filter((m) => !m.isTyping),
          { id: uid(), sender: 'ai', text: "Help request failed. Please try again." },
        ])
      }
    })()
  }, [token])

  const handleTranslateMessage = useCallback(async (
    _messageId: string,
    text: string,
    lang: string,
  ): Promise<string | null> => {
    const sid = sessionIdRef.current
    if (!sid) return null
    try {
      const res = await fetch(`${API_BASE}/demo/translate`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ sessionId: sid, text: text.slice(0, 500), targetLanguage: lang }),
      })
      if (!res.ok) return null
      const j = (await res.json()) as { translation?: string }
      return j.translation ?? null
    } catch {
      return null
    }
  }, [token])

  const handleMcqSelect = useCallback((i: number) => {
    if (submittingRef.current) return
    setSelectedOption(i)
    if (mcqTimerRef.current) clearTimeout(mcqTimerRef.current)
    mcqTimerRef.current = setTimeout(() => {
      const step = currentStepRef.current
      if (!step?.options) return
      const display = step.options[i] ?? String(i)
      void submitAnswer(String(i), display)
    }, 650)
  }, [submitAnswer])

  const steps: LessonStep[] = DEMO_STEP_KEYS.map((key) => ({
    id:     key,
    label:  DEMO_STEP_LABELS[key],
    status: completedSteps.includes(key) ? 'done'
          : currentStep?.key === key      ? 'active'
          :                                 'upcoming',
  }))

  const mainStepsCompleted = completedSteps.filter(k => (DEMO_STEP_KEYS as readonly string[]).includes(k)).length
  const progress = Math.round((mainStepsCompleted / DEMO_STEP_KEYS.length) * 100)

  return {
    chatMessages, steps, progress, isSpeaking, lessonStarted,
    phase, currentStep, finalResult, interestArea,
    submitting, selectedOption, setSelectedOption,
    handleTextSubmit, handleMcqSelect,
    handleHelpRequest, handleTranslateMessage,
    showLeaveModal, setShowLeaveModal, error,
    voiceMuted, toggleVoiceMuted,
    voiceStates, voiceMessages, handlePlayAudio,
  }
}
