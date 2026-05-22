import { useState, useEffect, useCallback, useRef } from 'react'
import type { ChatMessage, LessonStep } from '../types'
import { playAudioChunk, stopAudioPlayback, warmAudioContext } from '../services/voiceApi'

function stripMarkdownForTts(text: string): string {
  return text.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1').trim()
}

const API_BASE = import.meta.env.VITE_API_URL ?? ''

const DEMO_STEP_KEYS = ['warm_up', 'grammar_mcq', 'speaking_task', 'writing_task'] as const
type DemoStepKey = (typeof DEMO_STEP_KEYS)[number]

const DEMO_STEP_LABELS: Record<DemoStepKey, string> = {
  warm_up:       'Warm-up',
  grammar_mcq:   'Grammar',
  speaking_task: 'Speaking',
  writing_task:  'Writing',
}

export interface DemoStepContent {
  key:          string
  index:        number
  type:         'text_input' | 'mcq'
  prompt?:      string
  placeholder?: string
  minLength:    number
  options?:     string[]
}

export interface DemoFinalResult {
  level:            string
  score:            number
  strengths:        string[]
  areas_to_improve: string[]
  teacher_message:  string
}

export type DemoPhase = 'loading' | 'ready' | 'intro' | 'lesson' | 'complete' | 'error'
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
  startLesson:            () => void
  handleTranslateMessage: (messageId: string, text: string, lang: string) => Promise<string | null>
  showLeaveModal:         boolean
  setShowLeaveModal:      (v: boolean) => void
  error:                  string | null
  voiceMuted:             boolean
  toggleVoiceMuted:       () => void
  voiceStates:            Record<string, VoicePlayState>
  voiceMessages:          Record<string, { type: string; text: string }>
  handlePlayAudio:        (messageId: string, messageType: string, text: string) => Promise<void>
  isStaticAudioPlaying:   boolean  // always false — kept for API compatibility
  interruptAudio:         () => void
  audioUnlockRequired:    boolean
  unlockAudio:            () => void
}

function uid() { return Math.random().toString(36).slice(2) }
function sleep(ms: number) { return new Promise<void>((r) => setTimeout(r, ms)) }

function buildFeedbackText(
  fb: { message: string; correction: string | null; score: number | null; correct: boolean | null },
  _studentText: string,
  showCorrection = true,
): string {
  let text = fb.message
  if (showCorrection && fb.correction) text += `\n\nA more natural way: "${fb.correction}"`
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

  const [voiceMuted,           setVoiceMuted]           = useState(false)
  const [voiceStates,          setVoiceStates]          = useState<Record<string, VoicePlayState>>({})
  const [voiceMessages,        setVoiceMessages]        = useState<Record<string, { type: string; text: string }>>({})
  const [audioUnlockRequired,  setAudioUnlockRequired]  = useState(false)

  const pendingLessonRef = useRef<{
    introText:        string
    currentStepIntro: string | null
    currentStep:      DemoStepContent | null
  } | null>(null)

  const didInit          = useRef(false)
  const submittingRef    = useRef(false)
  const currentStepRef   = useRef<DemoStepContent | null>(null)
  const sessionIdRef     = useRef<string | null>(null)
  const mcqTimerRef      = useRef<ReturnType<typeof setTimeout> | null>(null)
  const voiceMutedRef    = useRef(false)
  const ttsLimitReachedRef = useRef(false)
  const voiceGenerationRef = useRef(0)

  useEffect(() => { submittingRef.current  = submitting  }, [submitting])
  useEffect(() => { currentStepRef.current = currentStep }, [currentStep])
  useEffect(() => { sessionIdRef.current   = sessionId   }, [sessionId])
  useEffect(() => { voiceMutedRef.current  = voiceMuted  }, [voiceMuted])

  // ── Core TTS playback ─────────────────────────────────────────────────────────
  const handlePlayAudio = useCallback(async (messageId: string, messageType: string, text: string) => {
    const sid = sessionIdRef.current
    if (!sid) return
    const myGeneration = voiceGenerationRef.current
    setVoiceStates(prev => ({ ...prev, [messageId]: 'loading' }))
    try {
      const res = await fetch(`${API_BASE}/demo/tts`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ sessionId: sid, messageId, messageType, messageText: text }),
      })
      if (voiceGenerationRef.current !== myGeneration) {
        setVoiceStates(prev => ({ ...prev, [messageId]: 'done' }))
        return
      }
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}) as Record<string, unknown>) as Record<string, unknown>
        const code = (errBody['code'] as string | undefined) ?? String(res.status)
        console.log(`[demo-voice] error id=${messageId} status=${res.status} code=${code}`)
        if (res.status === 429) {
          const isStepStart = messageType === 'main_prompt' || messageType === 'greeting'
          if (!isStepStart) ttsLimitReachedRef.current = true
        }
        setVoiceStates(prev => ({ ...prev, [messageId]: 'done' }))
        return
      }
      const j = (await res.json()) as {
        audio?: string
        budget?: { callsUsed: number; charsUsed: number; callsLimit: number; charsLimit: number }
      }
      if (j.budget) {
        const { callsUsed, charsUsed, callsLimit, charsLimit } = j.budget
        console.log(`[demo-tts-budget] callsUsed=${callsUsed} charsUsed=${charsUsed} callsLimit=${callsLimit} charsLimit=${charsLimit} type=${messageType}`)
      }
      if (!j.audio) {
        setVoiceStates(prev => ({ ...prev, [messageId]: 'error' }))
        return
      }
      if (voiceGenerationRef.current !== myGeneration) {
        setVoiceStates(prev => ({ ...prev, [messageId]: 'done' }))
        return
      }
      setVoiceStates(prev => ({ ...prev, [messageId]: 'playing' }))
      await playAudioChunk(j.audio, true)
      setVoiceStates(prev => ({ ...prev, [messageId]: 'done' }))
    } catch (err) {
      if (voiceGenerationRef.current !== myGeneration) {
        setVoiceStates(prev => ({ ...prev, [messageId]: 'done' }))
      } else {
        const msg = err instanceof Error ? err.message : 'unknown'
        const isAutoplayBlock = err instanceof Error && (
          msg.includes('audio_resume_failed') ||
          msg.includes('audio_context_still_suspended') ||
          msg.includes('NotAllowedError')
        )
        if (isAutoplayBlock) {
          console.log(`[demo_audio_autoplay_blocked] id=${messageId}`)
          setAudioUnlockRequired(true)
        } else {
          console.log(`[demo-voice] error id=${messageId} reason=${msg}`)
        }
        setVoiceStates(prev => ({ ...prev, [messageId]: 'error' }))
      }
    }
  }, [token])

  // Maximum time to wait for TTS to complete before unblocking the lesson.
  // Covers: network fetch + decode + full playback. Safety net for mobile autoplay hangs.
  const TTS_MAX_WAIT_MS = 10_000

  // ── Show an AI teacher message with typing animation + TTS ────────────────────
  // Text is always revealed immediately. TTS plays if not muted/exhausted.
  // Audio is enhancement only — if blocked or timed out, lesson continues via text.
  const showAiMessage = useCallback(async (text: string, ttsType?: string, ttsOverride?: string): Promise<string> => {
    setChatMessages(prev => [...prev.filter(m => !m.isTyping), { id: 'typing', sender: 'ai', isTyping: true }])
    setIsSpeaking(true)
    await sleep(Math.min(500 + text.length * 6, 1200))

    const msgId = uid()
    setChatMessages(prev => [...prev.filter(m => !m.isTyping), { id: msgId, sender: 'ai', text }])

    if (ttsType) {
      const ttsText = stripMarkdownForTts(ttsOverride ?? text).slice(0, 350)
      setVoiceMessages(prev => ({ ...prev, [msgId]: { type: ttsType, text: ttsText } }))

      if (!voiceMutedRef.current && !ttsLimitReachedRef.current) {
        voiceGenerationRef.current += 1
        const t0 = Date.now()
        let timedOut = false

        // Race TTS against a hard ceiling — prevents mobile autoplay hang from blocking the lesson.
        // If TTS wins: normal path, read-time sleep added if it returned instantly (error/cached).
        // If timeout wins: log and unblock with a short read-time only.
        await Promise.race([
          handlePlayAudio(msgId, ttsType, ttsText),
          new Promise<void>((resolve) => setTimeout(() => {
            timedOut = true
            resolve()
          }, TTS_MAX_WAIT_MS)),
        ])

        const elapsed = Date.now() - t0
        if (timedOut) {
          console.log(`[demo_audio_playback_timeout] id=${msgId} elapsedMs=${elapsed}`)
          console.log('[demo_mic_unblocked_after_audio_skip]')
          await sleep(1200)
        } else if (elapsed < 600) {
          // TTS returned instantly (blocked, error, or limit) — give student time to read
          console.log('[demo_mic_unblocked_after_audio_skip]')
          await sleep(Math.min(1200 + ttsText.length * 40, 3500))
        }
      } else {
        setVoiceStates(prev => ({ ...prev, [msgId]: 'done' }))
        await sleep(Math.min(1000 + text.length * 30, 4000))
      }
    }

    setIsSpeaking(false)
    return msgId
  }, [handlePlayAudio])

  // ── Interrupt all audio + cancel any running showAiMessage TTS ────────────────
  const interruptAudio = useCallback(() => {
    voiceGenerationRef.current += 1
    stopAudioPlayback()
    setIsSpeaking(false)
  }, [])

  // ── Audio unlock (mobile gesture) ─────────────────────────────────────────────
  // Called from a user tap so the AudioContext can resume under the autoplay policy.
  const unlockAudio = useCallback(() => {
    console.log('[demo_audio_unlocked]')
    warmAudioContext()
    setAudioUnlockRequired(false)
  }, [])

  const toggleVoiceMuted = useCallback(() => {
    setVoiceMuted(prev => {
      if (!prev) {
        stopAudioPlayback()
        voiceGenerationRef.current += 1
      }
      return !prev
    })
  }, [])

  // ── Core answer submission ────────────────────────────────────────────────────
  const submitAnswer = useCallback(async (answerStr: string, displayAnswer: string) => {
    const step = currentStepRef.current
    const sid  = sessionIdRef.current
    if (!step || !sid || submittingRef.current) {
      console.log(`[demo-submit] blocked reason=${!step ? 'no_step' : !sid ? 'no_session' : 'already_submitting'}`)
      return
    }

    voiceGenerationRef.current += 1
    stopAudioPlayback()
    setIsSpeaking(false)

    setChatMessages(prev => [
      ...prev.filter(m => !m.isTyping),
      { id: uid(), sender: 'user', text: displayAnswer },
    ])
    setSubmitting(true)

    try {
      const res = await fetch(`${API_BASE}/demo/answer`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ sessionId: sid, stepKey: step.key, answer: answerStr }),
      })

      // ── 422: AI teacher retry / clarification ──────────────────────────────
      if (!res.ok) {
        const j = (await res.json()) as {
          message?: string
          code?: string
          spokenMessage?: string
          conversationState?: { mode?: string; reason: string }
        }
        console.log(`[demo-conversation] mode=${j.conversationState?.mode ?? 'retry'} stepKey=${step.key} code=${j.code ?? 'error'} reason=${j.conversationState?.reason ?? 'blocked'}`)

        const errMsgText = j.message ?? 'Please try again.'
        const errMsgId = uid()

        setChatMessages(prev => [...prev.filter(m => !m.isTyping), { id: 'typing', sender: 'ai', isTyping: true }])
        setIsSpeaking(true)
        await sleep(900)
        setIsSpeaking(false)
        setChatMessages(prev => [...prev.filter(m => !m.isTyping), { id: errMsgId, sender: 'ai', text: errMsgText }])

        // Voice all meaningful teacher responses — retries, corrections, clarifications, multilingual rescue
        // STT_UNCERTAIN: "I may have misheard that" must be voiced so the student knows to retry aloud
        const spokeCodes = new Set(['MODERATION', 'MEANING_CONFIRMED', 'STUDENT_QUESTION', 'VOCAB_HELP', 'QUALITY_RETRY', 'META_HELP', 'INVALID_ANSWER', 'ACKNOWLEDGMENT', 'MULTILINGUAL_RESCUE', 'STT_UNCERTAIN'])
        if (spokeCodes.has(j.code ?? '') && j.message) {
          const spokenText = j.spokenMessage ?? j.message
          const voiceType = j.code === 'QUALITY_RETRY'
            ? (step.key === 'speaking_task' ? 'speaking_feedback' : step.key === 'writing_task' ? 'writing_feedback' : 'key_correction')
            : 'key_correction'
          const ttsText = stripMarkdownForTts(spokenText).slice(0, 300)
          voiceGenerationRef.current += 1
          setVoiceMessages(prev => ({ ...prev, [errMsgId]: { type: voiceType, text: ttsText } }))
          if (!voiceMutedRef.current) void handlePlayAudio(errMsgId, voiceType, ttsText)
        }
        return
      }

      // ── 200: Step accepted ─────────────────────────────────────────────────
      const j = (await res.json()) as {
        feedback:          { message: string; spokenFeedback?: string; correction: string | null; score: number | null; correct: boolean | null }
        nextStep:          DemoStepContent | null
        nextStepIntro:     string | null
        finalResult:       DemoFinalResult | null
        isComplete:        boolean
        conversationState?: { mode?: 'awaiting_reply' | 'clarification' | 'retry' | 'reflective_followup' | 'transition_ready' | 'closing'; expectsStudentReply: boolean; mayAdvance: boolean; reason: string }
      }

      const convMode = j.conversationState?.mode ?? 'transition_ready'
      console.log(`[demo-conversation] mode=${convMode} stepKey=${step.key} reason=${j.conversationState?.reason ?? 'step_accepted'}`)

      const feedbackMsgType = step.key === 'speaking_task' ? 'speaking_feedback'
        : step.key === 'writing_task'   ? 'writing_feedback'
        : step.key === 'grammar_mcq'    ? 'key_correction'
        : 'follow_up_question'

      const effectiveTtsType = j.isComplete ? 'final_closing' : feedbackMsgType
      // In reflective_followup the teacher is mid-conversation with a follow-up question —
      // hide the correction block so student isn't presented with "fix this" AND "tell me more"
      const showCorrection = convMode !== 'reflective_followup'
      const feedbackText = buildFeedbackText(j.feedback, displayAnswer, showCorrection)
      const spokenFeedback = j.feedback.spokenFeedback ?? undefined

      await sleep(400)
      await showAiMessage(feedbackText, effectiveTtsType, spokenFeedback)

      setSelectedOption(null)
      setCompletedSteps(prev => [...prev, step.key])

      // ── Final step: show results overlay ──────────────────────────────────
      if (j.isComplete && j.finalResult) {
        const completionDelay = ttsLimitReachedRef.current ? 4500 : 2200
        await sleep(completionDelay)
        setFinalResult(j.finalResult)
        console.log('[demo-final] overlay_shown')
        console.log('[demo-phase] complete')
        setPhase('complete')
        return
      }

      // ── Advance to next step ───────────────────────────────────────────────
      if (j.nextStep) {
        // Always update routing ref — controls which step key is sent to the backend
        currentStepRef.current = j.nextStep

        const canShowIntro = convMode === 'transition_ready' || convMode === 'closing'

        if (canShowIntro) {
          // Update exercise card only when teacher introduces the next step.
          // This prevents silent card switches — card and teacher voice stay in sync.
          setCurrentStep(j.nextStep)
          if (j.nextStepIntro) {
            console.log(`[demo-advance] nextStep=${j.nextStep.key} mode=${convMode}`)
            await sleep(500)
            await showAiMessage(j.nextStepIntro, 'main_prompt')
          } else {
            console.log(`[demo-advance] nextStep=${j.nextStep.key} mode=${convMode}`)
          }
        } else {
          // Teacher still owns conversation — hold exercise card until teacher introduces next step.
          // currentStepRef is already updated so submissions route correctly.
          console.log(`[demo-advance] blocked_intro nextStep=${j.nextStep.key} mode=${convMode} reason=${j.conversationState?.reason ?? 'unknown'}`)
        }
      }

    } catch {
      setIsSpeaking(false)
      setChatMessages(prev => [
        ...prev.filter(m => !m.isTyping),
        { id: uid(), sender: 'ai', text: 'Something went wrong. Please try again.' },
      ])
    } finally {
      setSubmitting(false)
    }
  }, [token, showAiMessage, handlePlayAudio])

  // ── Session initialisation ────────────────────────────────────────────────────
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
          id:               string
          isComplete:       boolean
          interestArea:     string
          introText:        string
          currentStepIntro: string | null
          currentStep:      DemoStepContent | null
          finalResult:      DemoFinalResult | null
        }

        setSessionId(data.id)
        setInterestArea(data.interestArea)

        if (data.isComplete && data.finalResult) {
          setFinalResult(data.finalResult)
          console.log('[demo-phase] complete')
          setPhase('complete')
          return
        }

        pendingLessonRef.current = {
          introText:        data.introText,
          currentStepIntro: data.currentStepIntro,
          currentStep:      data.currentStep,
        }

        // Pre-warm greeting TTS in background so audio starts immediately on "Begin Lesson"
        // Fire-and-forget — errors are silently ignored; on-demand fetch is the fallback
        if (data.introText && data.id) {
          const prewarmText = stripMarkdownForTts(data.introText).slice(0, 350)
          void fetch(`${API_BASE}/demo/tts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ sessionId: data.id, messageType: 'greeting', messageText: prewarmText }),
          }).catch(() => {})
        }

        console.log('[demo-phase] ready')
        setPhase('ready')
      } catch {
        setError('Could not load your lesson. Please refresh.')
        console.log('[demo-phase] error')
        setPhase('error')
      }
    })()
  }, [enabled, demoId, token, onNotFound]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Start lesson (requires user gesture for audio) ────────────────────────────
  const startLesson = useCallback(async () => {
    const pending = pendingLessonRef.current
    if (!pending) return
    pendingLessonRef.current = null

    try {
      console.log('[demo-phase] intro')
      setPhase('intro')

      // AI teacher greeting
      await showAiMessage(pending.introText, 'greeting')

      setLessonStarted(true)
      console.log('[demo-phase] lesson')
      setPhase('lesson')

      if (pending.currentStep) {
        setCurrentStep(pending.currentStep)
        await sleep(500)
        // AI teacher poses the first exercise
        const stepIntro = pending.currentStepIntro ?? pending.currentStep.prompt ?? ''
        if (stepIntro) {
          await showAiMessage(stepIntro, 'main_prompt')
        }
      }
    } catch {
      setError('Could not start your lesson. Please refresh.')
      console.log('[demo-phase] error')
      setPhase('error')
    }
  }, [showAiMessage])

  // ── Input handlers ────────────────────────────────────────────────────────────
  const handleTextSubmit = useCallback((answer: string) => {
    if (!answer.trim() || currentStepRef.current?.type === 'mcq') return
    void submitAnswer(answer.trim(), answer.trim())
  }, [submitAnswer])

  const handleHelpRequest = useCallback((text: string) => {
    const sid = sessionIdRef.current
    if (!sid) return
    const trimmed = text.trim().slice(0, 160)
    if (!trimmed) return

    setChatMessages(prev => [
      ...prev.filter(m => !m.isTyping),
      { id: uid(), sender: 'user', text: `❓ ${trimmed}` },
    ])

    void (async () => {
      try {
        const res = await fetch(`${API_BASE}/demo/help`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body:    JSON.stringify({ sessionId: sid, text: trimmed }),
        })
        const j = (await res.json()) as { message?: string }
        await showAiMessage(j.message ?? "I couldn't process that help request.", 'key_correction')
      } catch {
        setIsSpeaking(false)
        setChatMessages(prev => [
          ...prev.filter(m => !m.isTyping),
          { id: uid(), sender: 'ai', text: 'Help request failed. Please try again.' },
        ])
      }
    })()
  }, [token, showAiMessage])

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
    startLesson,
    handleTextSubmit, handleMcqSelect,
    handleHelpRequest, handleTranslateMessage,
    showLeaveModal, setShowLeaveModal, error,
    voiceMuted, toggleVoiceMuted,
    voiceStates, voiceMessages, handlePlayAudio,
    isStaticAudioPlaying: false,
    interruptAudio,
    audioUnlockRequired,
    unlockAudio,
  }
}
