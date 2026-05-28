import { useState, useEffect, useCallback, useRef } from 'react'
import type { ChatMessage, LessonStep } from '../types'
import { primeHtmlAudio, enqueueTeacherAudio, clearTeacherAudioQueue, playTeacherAudioAndWaitForRealEnd } from '../services/voiceApi'

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
  startLesson:            (audioPrimedPromise?: Promise<boolean>) => void
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
  // Phase 7.10B: true while greeting + first main_prompt are playing (mic/input locked)
  introSequenceActive:    boolean
  // Phase 7.13: count of successfully accepted steps — increments trigger dance
  completedStepCount:     number
  // Phase 7.13B: true only when TTS audio.play() has actually resolved (real playback started)
  characterAudioSpeaking: boolean
}

function uid() { return Math.random().toString(36).slice(2) }
function sleep(ms: number) { return new Promise<void>((r) => setTimeout(r, ms)) }
function hashText(s: string): string {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = (((h << 5) + h) ^ s.charCodeAt(i)) >>> 0
  return h.toString(36)
}

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

  const [voiceMuted,             setVoiceMuted]             = useState(false)
  const [voiceStates,            setVoiceStates]            = useState<Record<string, VoicePlayState>>({})
  const [voiceMessages,          setVoiceMessages]          = useState<Record<string, { type: string; text: string }>>({})
  const [audioUnlockRequired,    setAudioUnlockRequired]    = useState(false)
  // Phase 7.10B: true while greeting + first main_prompt are logically in progress
  const [introSequenceActive,    setIntroSequenceActive]    = useState(false)
  // Phase 7.13B: true only when TTS audio.play() has actually started (real playback signal)
  const [characterAudioSpeaking, setCharacterAudioSpeaking] = useState(false)

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
  const voiceMutedRef      = useRef(false)
  const ttsLimitReachedRef = useRef(false)
  const voiceGenerationRef = useRef(0)
  // Phase 7.8: tracks which AI message index is being voiced (0 = first/greeting)
  const messageIndexRef    = useRef(0)

  // Phase 7.10C: tracks last AI message text to suppress exact-duplicate chat bubbles
  const lastAiMsgTextRef = useRef<string>('')

  // Phase 7.10E: authoritative intro-started guard — survives useCallback recreation
  // (belt-and-suspenders on top of pendingLessonRef to prevent duplicate greeting/main_prompt TTS)
  const introStartedRef = useRef(false)

  // Phase 7.12: tracks job IDs currently in the teacher audio queue (or playing).
  // Stable key: sessionId + messageType + hashText(ttsText).
  // Prevents duplicate queue entries from replay button or callback recreation.
  const enqueuedJobIdsRef = useRef<Set<string>>(new Set())

  // Phase 7.12D: global teacher message chain — ALL showAiMessage calls are serialized.
  // No two teacher messages may render/play concurrently; only mic interrupt can break sequence.
  const teacherMessageChainRef = useRef<Promise<void>>(Promise.resolve())
  const chainGenerationRef     = useRef(0)
  const pendingChainKeysRef    = useRef<Set<string>>(new Set())

  // Phase 7.10: client-side TTS fetch cache — deduplicates pre-warm + on-demand calls for same text
  type TtsCachedResult = {
    audio?:  string
    budget?: { callsUsed: number; charsUsed: number; callsLimit: number; charsLimit: number }
  } | null
  type TtsCacheEntry = {
    promise:  Promise<TtsCachedResult>
    resolved: boolean
    result:   TtsCachedResult
  }
  const ttsFetchCacheRef = useRef<Map<string, TtsCacheEntry>>(new Map())

  useEffect(() => { submittingRef.current  = submitting  }, [submitting])
  useEffect(() => { currentStepRef.current = currentStep }, [currentStep])
  useEffect(() => { sessionIdRef.current   = sessionId   }, [sessionId])
  useEffect(() => { voiceMutedRef.current  = voiceMuted  }, [voiceMuted])

  // ── Core TTS playback ─────────────────────────────────────────────────────────
  // Phase 7.10: checks client-side cache before fetching — pre-warm promise is reused
  // if it is still in-flight (demo_tts_inflight_reused) or already resolved
  // (demo_tts_duplicate_suppressed), preventing a duplicate HTTP request.
  // Generation check after any await discards audio that arrived after the lesson advanced
  // (demo_tts_late_arrival_skipped).
  const handlePlayAudio = useCallback(async (messageId: string, messageType: string, text: string) => {
    const sid = sessionIdRef.current
    if (!sid) return
    const myGeneration = voiceGenerationRef.current
    setVoiceStates(prev => ({ ...prev, [messageId]: 'loading' }))
    try {
      const cacheKey = `${sid}:${messageType}:${text}`
      const cached   = ttsFetchCacheRef.current.get(cacheKey)
      let j: TtsCachedResult

      if (cached) {
        // Reuse pre-warm or in-flight promise — no extra HTTP request
        if (cached.resolved) {
          console.log(`[demo_tts_duplicate_suppressed] id=${messageId} type=${messageType}`)
          j = cached.result
        } else {
          console.log(`[demo_tts_inflight_reused] id=${messageId} type=${messageType}`)
          j = await cached.promise
        }
      } else {
        console.log(`[demo_tts_backend_request_started] id=${messageId} type=${messageType}`)
        const fetchPromise: Promise<TtsCachedResult> = fetch(`${API_BASE}/demo/tts`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body:    JSON.stringify({ sessionId: sid, messageId, messageType, messageText: text }),
        }).then(async (res): Promise<TtsCachedResult> => {
          if (!res.ok) {
            const errBody = await res.json().catch(() => ({}) as Record<string, unknown>) as Record<string, unknown>
            const code = (errBody['code'] as string | undefined) ?? String(res.status)
            console.log(`[demo-voice] error id=${messageId} status=${res.status} code=${code}`)
            if (res.status === 429) {
              const isStepStart = messageType === 'main_prompt' || messageType === 'greeting'
              if (!isStepStart) ttsLimitReachedRef.current = true
            }
            return null
          }
          return res.json() as Promise<TtsCachedResult>
        }).catch((err: unknown): TtsCachedResult => {
          const msg = err instanceof Error ? err.message : 'unknown'
          console.log(`[demo-voice] fetch_error id=${messageId} reason=${msg}`)
          return null
        })

        const entry: TtsCacheEntry = { promise: fetchPromise, resolved: false, result: null }
        ttsFetchCacheRef.current.set(cacheKey, entry)
        j = await fetchPromise
        entry.resolved = true
        entry.result   = j
      }

      // Single generation check after all async waits
      if (voiceGenerationRef.current !== myGeneration) {
        if (j?.audio) console.log(`[demo_tts_late_arrival_skipped] id=${messageId} type=${messageType}`)
        setVoiceStates(prev => ({ ...prev, [messageId]: 'done' }))
        return
      }

      if (!j?.audio) {
        setVoiceStates(prev => ({ ...prev, [messageId]: 'error' }))
        return
      }

      console.log(`[demo_tts_backend_response_received] id=${messageId} type=${messageType}`)

      if (j.budget) {
        const { callsUsed, charsUsed, callsLimit, charsLimit } = j.budget
        console.log(`[demo-tts-budget] callsUsed=${callsUsed} charsUsed=${charsUsed} callsLimit=${callsLimit} charsLimit=${charsLimit} type=${messageType}`)
      }

      // Phase 7.12C: stable job ID prevents duplicate queue entries.
      // Key: sessionId + messageType + textHash (no messageId — same text = same job).
      const isIntroType = messageType === 'greeting' || messageType === 'main_prompt'
      const jobId       = `${sid}:${messageType}:${hashText(text)}`

      if (enqueuedJobIdsRef.current.has(jobId)) {
        console.log(`[demo_audio_queue_duplicate_suppressed] jobId=${jobId} type=${messageType}`)
        setVoiceStates(prev => ({ ...prev, [messageId]: 'done' }))
        return
      }

      setVoiceStates(prev => ({ ...prev, [messageId]: 'playing' }))
      console.log(`[demo_audio_play_started] id=${messageId} type=${messageType}`)
      enqueuedJobIdsRef.current.add(jobId)
      try {
        if (isIntroType) {
          // Phase 7.12C: real HTMLAudio end-gating — intro must not advance until
          // audio.onended / onerror / play() rejection fires. 15 s timeout is last-resort
          // only; it must NOT fire during a normal-length greeting or prompt.
          // Phase 7.13B: onStart fires only when audio.play() resolves (real playback).
          await playTeacherAudioAndWaitForRealEnd(j.audio, {
            jobId,
            maxSafetyMs: 15_000,
            onStart: () => setCharacterAudioSpeaking(true),
          })
        } else {
          // Normal post-answer turns: serial queue with 8 s cap keeps teacher turns
          // from overlapping while preserving the fast text-first UX.
          // Phase 7.13B: onStart fires only when audio.play() resolves (real playback).
          await enqueueTeacherAudio(jobId, j.audio, 8_000, {
            onStart: () => setCharacterAudioSpeaking(true),
          })
        }
      } finally {
        enqueuedJobIdsRef.current.delete(jobId)
        setCharacterAudioSpeaking(false)  // reset once audio ends, errors, or is interrupted
      }
      setVoiceStates(prev => ({ ...prev, [messageId]: 'done' }))
    } catch (err) {
      const jobIdForClean = `${sessionIdRef.current ?? ''}:${messageType}:${hashText(text)}`
      enqueuedJobIdsRef.current.delete(jobIdForClean)
      if (voiceGenerationRef.current !== myGeneration) {
        setVoiceStates(prev => ({ ...prev, [messageId]: 'done' }))
      } else {
        const msg = err instanceof Error ? err.message : 'unknown'
        const isAutoplayBlock = err instanceof Error && (
          msg.includes('audio_resume_failed') ||
          msg.includes('audio_context_still_suspended') ||
          msg.includes('NotAllowedError') ||
          msg.includes('html_audio_play_rejected')
        )
        if (isAutoplayBlock) {
          console.log(`[demo_audio_autoplay_blocked] id=${messageId}`)
          setAudioUnlockRequired(true)
        } else {
          console.log(`[demo_audio_play_failed] id=${messageId} type=${messageType} reason=${msg}`)
        }
        setVoiceStates(prev => ({ ...prev, [messageId]: 'error' }))
      }
    }
  }, [token])

  // ── Show an AI teacher message with typing animation + TTS ────────────────────
  // Text is always revealed immediately. TTS plays if not muted/exhausted.
  // Audio is enhancement only — if blocked or timed out, lesson continues via text.
  //
  // isIntroTurn=true (greeting, main_prompt): Phase 7.12B blocking await — returns
  //   only after audio ends, fails, or the queue's 12s internal cap fires.
  //   This prevents main_prompt text from rendering while greeting audio still plays.
  //
  // isIntroTurn=false (normal feedback/followup turns): fast-path race against 1.5s cap.
  const showAiMessage = useCallback(async (
    text: string,
    ttsType?: string,
    ttsOverride?: string,
    options: { isIntroTurn?: boolean } = {},
  ): Promise<string> => {
    const { isIntroTurn = false } = options
    const msgIndex = messageIndexRef.current
    messageIndexRef.current += 1

    setChatMessages(prev => [...prev.filter(m => !m.isTyping), { id: 'typing', sender: 'ai', isTyping: true }])
    setIsSpeaking(true)
    await sleep(Math.min(300 + text.length * 4, 800))

    const msgId = uid()
    // Dedup: suppress exact-duplicate AI messages (guards against StrictMode / double startLesson)
    if (lastAiMsgTextRef.current === text) {
      console.log(`[demo_duplicate_message_suppressed] type=${ttsType ?? 'none'}`)
      setIsSpeaking(false)
      return msgId
    }
    lastAiMsgTextRef.current = text
    setChatMessages(prev => [...prev.filter(m => !m.isTyping), { id: msgId, sender: 'ai', text }])
    console.log(`[demo_teacher_text_rendered] msgIndex=${msgIndex} id=${msgId} type=${ttsType ?? 'none'} intro=${isIntroTurn}`)
    if (ttsType === 'greeting')    console.log('[demo_greeting_rendered]')
    if (ttsType === 'main_prompt') console.log('[demo_main_prompt_rendered]')

    if (ttsType) {
      const ttsText = stripMarkdownForTts(ttsOverride ?? text).slice(0, 350)
      setVoiceMessages(prev => ({ ...prev, [msgId]: { type: ttsType, text: ttsText } }))

      if (!voiceMutedRef.current && !ttsLimitReachedRef.current) {

        if (isIntroTurn) {
          // Phase 7.12B: blocking intro await — do NOT race against a sleep cap here.
          // showAiMessage must not return until this audio job is truly done so that
          // startLesson() cannot render main_prompt while greeting is still speaking.
          // The queue's own 12s internal cap (maxQueueMs in handlePlayAudio) is the
          // safety net; handlePlayAudio resolves on audio end, queue cap, or any error.
          console.log(`[demo_show_message_blocking_wait_start] id=${msgId} type=${ttsType}`)

          const t0 = Date.now()
          await handlePlayAudio(msgId, ttsType, ttsText)
          const elapsed = Date.now() - t0

          console.log(`[demo_show_message_blocking_wait_done] id=${msgId} type=${ttsType} elapsedMs=${elapsed}`)

        } else {
          // ── Normal turn: blocking await inside the global teacher message chain ─
          // Phase 7.12D: no 1.5 s race — showAiMessage blocks until audio is truly done
          // (or interrupted by mic/generation change). The chain in enqueueTeacherMessage
          // guarantees this fn is never called while another showAiMessage is in progress,
          // so the direct await cannot cause overlap.
          console.log(`[demo_teacher_message_rendered] id=${msgId} type=${ttsType}`)
          const t0 = Date.now()
          await handlePlayAudio(msgId, ttsType, ttsText)
          console.log(`[demo_teacher_message_audio_done] id=${msgId} type=${ttsType} elapsedMs=${Date.now() - t0}`)
        }

      } else {
        // Muted or TTS limit reached — use estimated read time regardless of turn type
        const skipReason = voiceMutedRef.current ? 'muted' : 'limit_reached'
        console.log(`[demo_audio_skip_reason] msgIndex=${msgIndex} id=${msgId} reason=${skipReason}`)
        setVoiceStates(prev => ({ ...prev, [msgId]: 'done' }))
        if (isIntroTurn) {
          console.log(`[demo_turn_start] id=${msgId} type=${ttsType ?? 'none'} reason=${skipReason}`)
          await sleep(Math.min(1200 + text.length * 35, 3500))
          console.log(`[demo_turn_complete] id=${msgId} type=${ttsType ?? 'none'} reason=${skipReason}`)
        } else {
          await sleep(Math.min(1000 + text.length * 30, 4000))
        }
      }
    }

    setIsSpeaking(false)
    return msgId
  }, [handlePlayAudio])

  // ── Global teacher message chain (Phase 7.12D) ────────────────────────────────
  // ALL teacher messages must go through this wrapper.
  // Rule: teacher→teacher waits. Student mic→teacher interrupts.
  //
  // Duplicate suppression: key = sessionId + messageType + hashText(text).
  // If the same key is already in the chain (pending or in-flight), skip insertion.
  //
  // Cancellation: each chain slot captures chainGenerationRef at enqueue time.
  // When mic fires and chainGenerationRef is incremented, queued slots see the
  // mismatch and skip execution (returning '' immediately), draining the chain fast.
  const enqueueTeacherMessage = useCallback((
    messageType: string,
    text: string,
    fn: () => Promise<string>,
  ): Promise<string> => {
    const sid = sessionIdRef.current ?? 'no_session'
    const key = `${sid}:${messageType}:${hashText(text)}`

    if (pendingChainKeysRef.current.has(key)) {
      console.log(`[demo_teacher_chain_duplicate_suppressed] key=${key}`)
      return Promise.resolve('')
    }

    const pendingCount = pendingChainKeysRef.current.size
    if (pendingCount > 0) {
      console.log(`[demo_teacher_next_message_waiting] key=${key} pending=${pendingCount}`)
      console.log('[demo_teacher_overlap_prevented]')
    }

    console.log(`[demo_teacher_chain_enqueue] key=${key} type=${messageType}`)
    pendingChainKeysRef.current.add(key)

    const myGeneration = chainGenerationRef.current

    const resultPromise: Promise<string> = teacherMessageChainRef.current.then(async () => {
      pendingChainKeysRef.current.delete(key)

      if (chainGenerationRef.current !== myGeneration) {
        console.log(`[demo_teacher_chain_cancelled_by_mic] key=${key}`)
        return ''
      }

      console.log(`[demo_teacher_chain_start] key=${key} type=${messageType}`)
      const msgId = await fn()
      console.log(`[demo_teacher_chain_complete] key=${key} type=${messageType}`)
      return msgId
    })

    // Advance chain tail — catch so one failure never blocks subsequent messages
    teacherMessageChainRef.current = resultPromise.then(() => {}, () => {})
    return resultPromise
  }, [])

  // ── Interrupt all audio + cancel any running showAiMessage TTS ────────────────
  const interruptAudio = useCallback(() => {
    voiceGenerationRef.current += 1  // marks all in-flight handlePlayAudio calls as stale
    chainGenerationRef.current += 1  // marks all queued chain slots as cancelled
    pendingChainKeysRef.current.clear()
    console.log('[demo_audio_queue_interrupted_by_mic]')
    console.log('[demo_teacher_chain_cancelled_by_mic]')
    clearTeacherAudioQueue()         // stops current playback + resolves all queued jobs
    setIsSpeaking(false)
    setCharacterAudioSpeaking(false)
  }, [])

  // ── Audio unlock (mobile gesture) ─────────────────────────────────────────────
  // Called from a user tap so the AudioContext can resume under the autoplay policy.
  // Phase 7.8: uses primeAudioContext (plays silent buffer + resume) rather than
  // warmAudioContext so the tap fully unlocks iOS for all subsequent TTS messages.
  const unlockAudio = useCallback(() => {
    console.log('[demo_audio_unlocked]')
    primeHtmlAudio()  // silent HTMLAudio play in this gesture unlocks future async plays on iOS
    setAudioUnlockRequired(false)
  }, [])

  const toggleVoiceMuted = useCallback(() => {
    setVoiceMuted(prev => {
      if (!prev) {
        voiceGenerationRef.current += 1
        chainGenerationRef.current += 1
        pendingChainKeysRef.current.clear()
        clearTeacherAudioQueue()
        setCharacterAudioSpeaking(false)
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

    console.log(`[demo_answer_submit_started] chars=${answerStr.length} step=${step.key}`)
    voiceGenerationRef.current += 1  // marks all in-flight TTS calls as stale
    chainGenerationRef.current += 1  // cancels any queued chain slots from previous turn
    pendingChainKeysRef.current.clear()
    clearTeacherAudioQueue()         // stops current audio + drains queue (mic interrupt)
    setIsSpeaking(false)
    setCharacterAudioSpeaking(false)

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

        // Route error/retry messages through the global chain so they don't overlap
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
          setVoiceMessages(prev => ({ ...prev, [errMsgId]: { type: voiceType, text: ttsText } }))
          if (!voiceMutedRef.current) {
            void enqueueTeacherMessage(voiceType, ttsText, async () => {
              await handlePlayAudio(errMsgId, voiceType, ttsText)
              return errMsgId
            })
          }
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
      await enqueueTeacherMessage(effectiveTtsType, feedbackText, () =>
        showAiMessage(feedbackText, effectiveTtsType, spokenFeedback))

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
            await enqueueTeacherMessage('main_prompt', j.nextStepIntro, () =>
              showAiMessage(j.nextStepIntro!, 'main_prompt'))
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
      console.log('[demo_answer_submit_finished]')
    }
  }, [token, showAiMessage, handlePlayAudio, enqueueTeacherMessage])

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

        // Phase 7.10: pre-warm greeting TTS and store the result promise in the client-side cache.
        // If the user clicks "Begin Lesson" before this resolves, handlePlayAudio reuses the
        // in-flight promise (demo_tts_inflight_reused) instead of launching a duplicate request.
        // If it has already resolved by then, the cached result is used directly
        // (demo_tts_duplicate_suppressed) with no network round-trip.
        if (data.introText && data.id) {
          const prewarmText = stripMarkdownForTts(data.introText).slice(0, 350)
          const cacheKey    = `${data.id}:greeting:${prewarmText}`
          const prewarmPromise: Promise<TtsCachedResult> = fetch(`${API_BASE}/demo/tts`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body:    JSON.stringify({ sessionId: data.id, messageType: 'greeting', messageText: prewarmText }),
          }).then(async (res): Promise<TtsCachedResult> => {
            if (!res.ok) return null
            return res.json() as Promise<TtsCachedResult>
          }).catch((): TtsCachedResult => null)
          const entry: TtsCacheEntry = { promise: prewarmPromise, resolved: false, result: null }
          ttsFetchCacheRef.current.set(cacheKey, entry)
          void prewarmPromise.then(result => { entry.resolved = true; entry.result = result })
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
  // Phase 7.8: accepts the Promise returned by primeAudioContext() so we know before
  // the first TTS fetch whether the AudioContext was successfully unlocked. If priming
  // failed we show the "Tap to enable voice" banner immediately rather than waiting
  // until the first TTS attempt times out (previously up to message 5–6).
  const startLesson = useCallback(async (audioPrimedPromise?: Promise<boolean>) => {
    // Phase 7.10E: introStartedRef is the primary guard — survives useCallback recreation.
    // pendingLessonRef remains as secondary (data availability) guard.
    if (introStartedRef.current) {
      console.log('[demo_intro_duplicate_blocked]')
      return
    }
    introStartedRef.current = true
    console.log('[demo_intro_start]')

    const pending = pendingLessonRef.current
    // Guard: pendingLessonRef is consumed (set to null) on first call.
    // Second call (double-click, React StrictMode double-effect) returns early.
    if (!pending) {
      console.log('[demo_start_ignored_duplicate]')
      return
    }
    pendingLessonRef.current = null

    // Await priming result before starting lesson flow.
    // primeAudioContext() resolves quickly (< 100 ms) — well before the typing animation.
    if (audioPrimedPromise !== undefined) {
      const primed = await audioPrimedPromise
      if (!primed) {
        console.log('[demo_audio_unlock_required] showing_banner_early reason=prime_failed')
        setAudioUnlockRequired(true)
      }
    }

    try {
      console.log('[demo-phase] intro')
      setPhase('intro')
      // Lock mic + input for the entire greeting → main_prompt intro sequence
      setIntroSequenceActive(true)

      // Phase 7.12D: intro messages go through the global chain so any rogue concurrent
      // message (e.g. from handleHelpRequest) is serialized behind greeting + main_prompt.
      // isIntroTurn=true inside showAiMessage uses playTeacherAudioAndWaitForRealEnd
      // (event-gated) rather than the serial queue — the chain provides the outer gate.
      console.log('[demo_intro_greeting_begin]')
      await enqueueTeacherMessage('greeting', pending.introText, () =>
        showAiMessage(pending.introText, 'greeting', undefined, { isIntroTurn: true }))
      console.log('[demo_intro_greeting_complete]')

      setLessonStarted(true)
      console.log('[demo-phase] lesson')
      setPhase('lesson')

      if (pending.currentStep) {
        setCurrentStep(pending.currentStep)
        await sleep(500)
        const stepIntro = pending.currentStepIntro ?? pending.currentStep.prompt ?? ''
        if (stepIntro) {
          console.log('[demo_intro_prompt_begin]')
          await enqueueTeacherMessage('main_prompt', stepIntro, () =>
            showAiMessage(stepIntro, 'main_prompt', undefined, { isIntroTurn: true }))
          console.log('[demo_intro_prompt_complete]')
        }
      }

      // Both intro messages complete — unlock mic and input for student responses
      setIntroSequenceActive(false)
      console.log('[demo_intro_mic_unlocked]')
    } catch {
      setIntroSequenceActive(false)
      setError('Could not start your lesson. Please refresh.')
      console.log('[demo-phase] error')
      setPhase('error')
    }
  }, [showAiMessage, enqueueTeacherMessage])

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
        const helpText = j.message ?? "I couldn't process that help request."
        await enqueueTeacherMessage('key_correction', helpText, () =>
          showAiMessage(helpText, 'key_correction'))
      } catch {
        setIsSpeaking(false)
        setChatMessages(prev => [
          ...prev.filter(m => !m.isTyping),
          { id: uid(), sender: 'ai', text: 'Help request failed. Please try again.' },
        ])
      }
    })()
  }, [token, showAiMessage, enqueueTeacherMessage])

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
    introSequenceActive,
    completedStepCount: completedSteps.length,
    characterAudioSpeaking,
  }
}
