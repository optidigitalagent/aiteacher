import { useState, useEffect, useCallback, useRef } from 'react'
import type { ChatMessage, LessonStep } from '../types'

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

export interface UseDemoSessionReturn {
  chatMessages:      ChatMessage[]
  steps:             LessonStep[]
  progress:          number
  isSpeaking:        boolean
  lessonStarted:     boolean
  phase:             DemoPhase
  currentStep:       DemoStepContent | null
  finalResult:       DemoFinalResult | null
  interestArea:      string
  submitting:        boolean
  selectedOption:    number | null
  setSelectedOption: (i: number | null) => void
  handleTextSubmit:  (answer: string) => void
  handleMcqSelect:   (i: number) => void
  showLeaveModal:    boolean
  setShowLeaveModal: (v: boolean) => void
  error:             string | null
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

  // Refs keep async callbacks always fresh without re-creating them
  const didInit              = useRef(false)
  const submittingRef        = useRef(false)
  const currentStepRef       = useRef<DemoStepContent | null>(null)
  const sessionIdRef         = useRef<string | null>(null)
  const currentTeacherMsgRef = useRef<string | null>(null)
  const mcqTimerRef          = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { submittingRef.current  = submitting  }, [submitting])
  useEffect(() => { currentStepRef.current = currentStep }, [currentStep])
  useEffect(() => { sessionIdRef.current   = sessionId   }, [sessionId])

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

      setChatMessages((prev) => [
        ...prev.filter((m) => !m.isTyping),
        { id: uid(), sender: 'ai', text: buildFeedbackText(j.feedback, displayAnswer) },
      ])
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
      }
    } catch {
      setChatMessages((prev) => [
        ...prev.filter((m) => !m.isTyping),
        { id: uid(), sender: 'ai', text: 'Something went wrong. Please try again.' },
      ])
    } finally {
      setSubmitting(false)
    }
  }, [token, playMessages])

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
        setLessonStarted(true)
        setPhase('lesson')

        if (data.currentStep) {
          setCurrentStep(data.currentStep)
          await playMessages(data.currentStep.teacherMessages)
        }
      } catch {
        setError('Could not load your lesson. Please refresh.')
        setPhase('error')
      }
    })()
  }, [enabled, demoId, token, onNotFound, playMessages]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleTextSubmit = useCallback((answer: string) => {
    if (!answer.trim() || currentStepRef.current?.type === 'mcq') return
    void submitAnswer(answer.trim(), answer.trim())
  }, [submitAnswer])

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
    showLeaveModal, setShowLeaveModal, error,
  }
}
