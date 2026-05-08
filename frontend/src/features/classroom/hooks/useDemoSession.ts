import { useState, useEffect, useCallback, useRef } from 'react'
import type { ChatMessage, LessonStep } from '../types'
import { playAudioChunk, stopAudioPlayback, playStaticAudioFile, stopStaticAudio } from '../services/voiceApi'
import { STATIC_DEMO_AUDIO_MAP } from '../staticAudioMap'

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

interface TeacherMessage {
  text:       string
  delay:      number
  audioMode?: 'static' | 'tts' | 'none'
  audioKey?:  string
}

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

// True only if the message has a static file actually mapped on disk.
// Messages where the file is missing fall through to TTS.
function hasWorkingStaticAudio(msg: TeacherMessage): boolean {
  return msg.audioMode === 'static' && !!msg.audioKey && !!STATIC_DEMO_AUDIO_MAP[msg.audioKey]
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
  // Voice
  voiceMuted:             boolean
  toggleVoiceMuted:       () => void
  voiceStates:            Record<string, VoicePlayState>
  voiceMessages:          Record<string, { type: string; text: string }>
  handlePlayAudio:        (messageId: string, messageType: string, text: string) => Promise<void>
  isStaticAudioPlaying:   boolean
  // Stops all audio + cancels any running playMessages loop (use on mic click)
  interruptAudio:         () => void
}

function uid() { return Math.random().toString(36).slice(2) }
function sleep(ms: number) { return new Promise<void>((r) => setTimeout(r, ms)) }
function textHash6(s: string): string {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  return Math.abs(h).toString(16).slice(0, 6)
}

function buildFeedbackText(
  fb: { message: string; correction: string | null; score: number | null; correct: boolean | null },
  _studentText: string,
): string {
  let text = fb.message
  if (fb.correction) {
    text += `\n\nA more natural way: "${fb.correction}"`
  }
  // Only show score for genuinely strong responses — low scores discourage in a demo context
  if (fb.score != null && fb.score >= 7) text += `\n\nScore: ${fb.score}/10`
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
  const [voiceMuted,             setVoiceMuted]             = useState(false)
  const [voiceStates,            setVoiceStates]            = useState<Record<string, VoicePlayState>>({})
  const [voiceMessages,          setVoiceMessages]          = useState<Record<string, { type: string; text: string }>>({})
  const [pendingVoicePlay,       setPendingVoicePlay]       = useState<{ id: string; type: string; text: string } | null>(null)
  const [isStaticAudioPlaying,   setIsStaticAudioPlaying]   = useState(false)
  const isStaticAudioPlayingRef  = useRef(false)
  // Stores session data while phase === 'ready', consumed by startLesson()
  const pendingLessonRef = useRef<{
    intro:       { messages: TeacherMessage[] }
    currentStep: DemoStepContent | null
  } | null>(null)

  // Refs keep async callbacks always fresh without re-creating them
  const didInit              = useRef(false)
  const submittingRef        = useRef(false)
  const currentStepRef       = useRef<DemoStepContent | null>(null)
  const sessionIdRef         = useRef<string | null>(null)
  const currentTeacherMsgRef = useRef<string | null>(null)
  const mcqTimerRef          = useRef<ReturnType<typeof setTimeout> | null>(null)
  const voiceMutedRef        = useRef(false)
  // Set to true once TTS session budget is exhausted — stops scheduling further requests
  const ttsLimitReachedRef   = useRef(false)
  // Incremented each time a new voice message is scheduled — lets in-flight fetches detect they're stale
  const voiceGenerationRef   = useRef(0)

  useEffect(() => { submittingRef.current           = submitting           }, [submitting])
  useEffect(() => { currentStepRef.current          = currentStep          }, [currentStep])
  useEffect(() => { sessionIdRef.current            = sessionId            }, [sessionId])
  useEffect(() => { voiceMutedRef.current           = voiceMuted           }, [voiceMuted])
  useEffect(() => { isStaticAudioPlayingRef.current = isStaticAudioPlaying }, [isStaticAudioPlaying])

  const playMessages = useCallback(async (msgs: TeacherMessage[]) => {
    currentTeacherMsgRef.current = null
    voiceGenerationRef.current += 1
    // Capture token — any call to interruptAudio() or a new playMessages() will increment
    // voiceGenerationRef past myGen, causing this run to exit at the next check point.
    const myGen = voiceGenerationRef.current
    stopStaticAudio()
    stopAudioPlayback()
    setIsStaticAudioPlaying(false)
    isStaticAudioPlayingRef.current = false

    for (let i = 0; i < msgs.length; i++) {
      // Cancelled by interruptAudio() or a newer playMessages() call
      if (voiceGenerationRef.current !== myGen) return

      const msg     = msgs[i]!
      const prevMsg = i > 0 ? msgs[i - 1] : null
      const prevHadAudio = prevMsg?.audioMode === 'static' && !!prevMsg.audioKey

      if (i === 0) {
        if (msg.delay > 0) await sleep(Math.min(msg.delay, 1500))
      } else if (prevHadAudio && (msg.audioMode === 'static' && !!msg.audioKey)) {
        await sleep(220)
      } else if (msg.delay > 0) {
        await sleep(Math.min(msg.delay, 2000))
      }
      if (voiceGenerationRef.current !== myGen) return

      const msgId = uid()
      setChatMessages((prev) => [
        ...prev.filter((m) => !m.isTyping),
        { id: 'typing', sender: 'ai', isTyping: true },
      ])
      setIsSpeaking(true)
      const typingMs = prevHadAudio
        ? Math.min(280 + msg.text.length * 5, 900)
        : Math.min(650 + msg.text.length * 12, 2600)
      await sleep(typingMs)

      if (voiceGenerationRef.current !== myGen) {
        // Interrupted during typing — remove the typing bubble cleanly
        setChatMessages(prev => prev.filter(m => !m.isTyping))
        setIsSpeaking(false)
        return
      }
      setIsSpeaking(false)

      currentTeacherMsgRef.current = msgId
      setChatMessages((prev) => [
        ...prev.filter((m) => !m.isTyping),
        { id: msgId, sender: 'ai', text: msg.text },
      ])

      if (msg.audioMode === 'static' && msg.audioKey) {
        const url = STATIC_DEMO_AUDIO_MAP[msg.audioKey]
        // Always register so the replay button appears
        setVoiceMessages(prev => ({ ...prev, [msgId]: { type: 'static', text: msg.audioKey! } }))

        if (voiceMutedRef.current) {
          setVoiceStates(prev => ({ ...prev, [msgId]: 'done' }))
        } else if (!url) {
          console.warn(`[demo-static] no mapping for audioKey: "${msg.audioKey}"`)
          setVoiceStates(prev => ({ ...prev, [msgId]: 'done' }))
        } else {
          // Guard: don't start audio that's already stale (e.g. interruptAudio called between checks)
          if (voiceGenerationRef.current !== myGen) {
            setVoiceStates(prev => ({ ...prev, [msgId]: 'done' }))
            console.log(`[demo-audio] skip-stale audioKey="${msg.audioKey}" reason=generation_mismatch`)
            return
          }
          setVoiceStates(prev => ({ ...prev, [msgId]: 'loading' }))
          setIsStaticAudioPlaying(true)
          isStaticAudioPlayingRef.current = true
          const tHash = textHash6(msg.text)
          try {
            console.log(`[demo-audio] start source=static audioKey="${msg.audioKey}" msgId=${msgId} textHash=${tHash}`)
            await playStaticAudioFile(url)
            // Check after await — stopStaticAudio() resolves the promise without an error,
            // so the catch won't fire; we must check generation here to stop the loop.
            if (voiceGenerationRef.current !== myGen) {
              console.log(`[demo-audio] interrupted audioKey="${msg.audioKey}" reason=generation_mismatch_after_play`)
              setVoiceStates(prev => ({ ...prev, [msgId]: 'done' }))
              setIsStaticAudioPlaying(false)
              isStaticAudioPlayingRef.current = false
              return
            }
            console.log(`[demo-audio] end source=static audioKey="${msg.audioKey}" msgId=${msgId}`)
            setVoiceStates(prev => ({ ...prev, [msgId]: 'done' }))
          } catch (err) {
            const msg_str = err instanceof Error ? err.message : String(err)
            console.log(`[demo-audio] cancel source=static audioKey="${msg.audioKey}" reason=${msg_str.slice(0,60)}`)
            if (!msg_str.includes('audio_resume_failed')) {
              console.warn(`[demo-static] key="${msg.audioKey}": ${msg_str}`)
            }
            setVoiceStates(prev => ({ ...prev, [msgId]: 'error' }))
          } finally {
            setIsStaticAudioPlaying(false)
            isStaticAudioPlayingRef.current = false
          }
        }
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Voice: play static pre-recorded or fetch TTS audio ───────────────────────
  const handlePlayAudio = useCallback(async (messageId: string, messageType: string, text: string) => {
    // text is the audioKey for static messages
    if (messageType === 'static') {
      const url = STATIC_DEMO_AUDIO_MAP[text]
      if (!url) {
        console.warn(`[demo-static] replay: no mapping for audioKey "${text}"`)
        setVoiceStates(prev => ({ ...prev, [messageId]: 'error' }))
        return
      }
      voiceGenerationRef.current += 1
      setVoiceStates(prev => ({ ...prev, [messageId]: 'playing' }))
      setIsStaticAudioPlaying(true)
      isStaticAudioPlayingRef.current = true
      try {
        await playStaticAudioFile(url)
        setVoiceStates(prev => ({ ...prev, [messageId]: 'done' }))
      } catch (err) {
        console.warn(`[demo-static] replay key="${text}":`, err instanceof Error ? err.message : err)
        setVoiceStates(prev => ({ ...prev, [messageId]: 'error' }))
      } finally {
        setIsStaticAudioPlaying(false)
        isStaticAudioPlayingRef.current = false
      }
      return
    }

    const sid = sessionIdRef.current
    if (!sid) return
    // Capture generation so we can detect if this play becomes stale mid-flight
    const myGeneration = voiceGenerationRef.current
    console.log(`[demo-voice] fetching /demo/tts id=${messageId} type=${messageType} gen=${myGeneration}`)
    setVoiceStates(prev => ({ ...prev, [messageId]: 'loading' }))
    try {
      const res = await fetch(`${API_BASE}/demo/tts`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ sessionId: sid, messageId, messageType, messageText: text }),
      })
      // Stale check: a newer voice was scheduled while this fetch was in flight
      if (voiceGenerationRef.current !== myGeneration) {
        console.log(`[demo-voice] stale id=${messageId} — superseded by newer message`)
        setVoiceStates(prev => ({ ...prev, [messageId]: 'done' }))
        return
      }
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}) as Record<string, unknown>) as Record<string, unknown>
        const code = (errBody['code'] as string | undefined) ?? (errBody['reason'] as string | undefined) ?? String(res.status)
        console.log(`[demo-voice] error id=${messageId} status=${res.status} code=${code}`)
        if (res.status === 429) {
          // Only mark the budget globally exhausted when a HIGH-priority feedback message hits 429.
          // Step-start (main_prompt / greeting) 429s should not block subsequent feedback voice.
          const isStepStart = messageType === 'main_prompt' || messageType === 'greeting'
          if (!isStepStart) ttsLimitReachedRef.current = true
          setVoiceStates(prev => ({ ...prev, [messageId]: 'done' }))
        } else {
          setVoiceStates(prev => ({ ...prev, [messageId]: 'error' }))
        }
        return
      }
      const j = (await res.json()) as {
        audio?: string
        budget?: { callsUsed: number; charsUsed: number; callsLimit: number; charsLimit: number }
      }
      if (j.budget) {
        const { callsUsed, charsUsed, callsLimit, charsLimit } = j.budget
        const remaining = callsLimit - callsUsed
        const priority  = messageType === 'final_closing' ? 'P0_final' : 'normal'
        console.log(`[demo-tts-budget] callsUsed=${callsUsed} charsUsed=${charsUsed} callsLimit=${callsLimit} charsLimit=${charsLimit} remaining=${remaining} priority=${priority} type=${messageType} id=${messageId}`)
      }
      if (!j.audio) {
        console.log(`[demo-voice] error id=${messageId} reason=no_audio_in_response`)
        setVoiceStates(prev => ({ ...prev, [messageId]: 'error' }))
        return
      }
      // Final stale check before playback
      if (voiceGenerationRef.current !== myGeneration) {
        console.log(`[demo-voice] stale id=${messageId} — audio ready but superseded`)
        setVoiceStates(prev => ({ ...prev, [messageId]: 'done' }))
        return
      }
      setVoiceStates(prev => ({ ...prev, [messageId]: 'playing' }))
      console.log(`[demo-voice] playing id=${messageId}`)
      await playAudioChunk(j.audio, true)
      setVoiceStates(prev => ({ ...prev, [messageId]: 'done' }))
    } catch (err) {
      // If cancelled mid-play (e.g. stopAudioPlayback called), treat as done not error
      if (voiceGenerationRef.current !== myGeneration) {
        setVoiceStates(prev => ({ ...prev, [messageId]: 'done' }))
      } else {
        console.log(`[demo-voice] error id=${messageId} reason=${err instanceof Error ? err.message : 'unknown'}`)
        setVoiceStates(prev => ({ ...prev, [messageId]: 'error' }))
      }
    }
  }, [token])

  const toggleVoiceMuted = useCallback(() => {
    setVoiceMuted(prev => {
      if (!prev) {
        stopStaticAudio()
        stopAudioPlayback()
        setIsStaticAudioPlaying(false)
        isStaticAudioPlayingRef.current = false
      }
      return !prev
    })
  }, [])

  // Stops all audio and cancels any running playMessages loop.
  // Call this on mic click so the student's recording starts on a clean slate.
  const interruptAudio = useCallback(() => {
    voiceGenerationRef.current += 1   // causes any running playMessages loop to exit at its next check
    stopStaticAudio()
    stopAudioPlayback()
    setPendingVoicePlay(null)
    setIsStaticAudioPlaying(false)
    isStaticAudioPlayingRef.current = false
    setIsSpeaking(false)
  }, [])

  // ── Register a message for voice + schedule auto-play ────────────────────────
  const scheduleVoice = useCallback((id: string, type: string, text: string) => {
    if (ttsLimitReachedRef.current) return
    voiceGenerationRef.current += 1
    stopStaticAudio()                    // stop any static audio before TTS
    stopAudioPlayback()
    setIsStaticAudioPlaying(false)
    isStaticAudioPlayingRef.current = false
    console.log(`[demo-voice] scheduled id=${id} type=${type} gen=${voiceGenerationRef.current}`)
    setVoiceMessages(prev => ({ ...prev, [id]: { type, text } }))
    setPendingVoicePlay({ id, type, text })
  }, [])

  // ── Auto-play effect — fires when pendingVoicePlay is set ───────────────────
  // Step-start messages (main_prompt / greeting) respect ttsLimitReachedRef —
  // if budget is exhausted, skip silently to preserve it for feedback messages.
  useEffect(() => {
    if (!pendingVoicePlay) return
    const { id, type, text } = pendingVoicePlay
    setPendingVoicePlay(null)
    if (!voiceMutedRef.current && !ttsLimitReachedRef.current) {
      void handlePlayAudio(id, type, text)
    }
  }, [pendingVoicePlay, handlePlayAudio])

  // Core submit — reads from refs to avoid stale closures in async callbacks
  const submitAnswer = useCallback(async (answerStr: string, displayAnswer: string) => {
    const step = currentStepRef.current
    const sid  = sessionIdRef.current
    if (!step || !sid || submittingRef.current) {
      const reason = !step ? 'no_step' : !sid ? 'no_session' : 'already_submitting'
      console.log(`[demo-submit] blocked reason=${reason}`)
      return
    }

    // Cancel any in-progress or queued audio before starting new interaction.
    // Incrementing the generation counter also invalidates any in-flight TTS fetch
    // from the previous turn (QUALITY_RETRY voice), so it never plays over the new response.
    voiceGenerationRef.current += 1
    stopStaticAudio()
    stopAudioPlayback()
    setPendingVoicePlay(null)
    setIsStaticAudioPlaying(false)
    isStaticAudioPlayingRef.current = false

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
        const j = (await res.json()) as { message?: string; code?: string; spokenMessage?: string }
        // Teacher responds — not a system error, so show typing indicator first
        setChatMessages(prev => [...prev.filter(m => !m.isTyping), { id: 'typing', sender: 'ai', isTyping: true }])
        setIsSpeaking(true)
        await sleep(900)
        setIsSpeaking(false)
        const errMsgId = uid()
        const errMsgText = j.message ?? (j.code === 'INVALID_ANSWER' ? 'Please try again.' : 'Something went wrong.')
        setChatMessages(prev => [
          ...prev.filter(m => !m.isTyping),
          { id: errMsgId, sender: 'ai', text: errMsgText },
        ])
        // Voice key teacher moments — corrections and moderation feel more personal when spoken
        const spokeCodes = new Set(['MODERATION', 'MEANING_CONFIRMED', 'STUDENT_QUESTION', 'VOCAB_HELP', 'QUALITY_RETRY', 'META_HELP'])
        if (spokeCodes.has(j.code ?? '') && j.message) {
          // Use spokenMessage (short, no correction block) when available; fall back to full message
          const spokenText = j.spokenMessage ?? j.message
          const voiceType = j.code === 'QUALITY_RETRY'
            ? (step.key === 'speaking_task' ? 'speaking_feedback' : step.key === 'writing_task' ? 'writing_feedback' : 'key_correction')
            : 'key_correction'
          const ttsText = stripMarkdownForTts(spokenText).slice(0, 300)
          voiceGenerationRef.current += 1
          stopStaticAudio()
          stopAudioPlayback()
          setIsStaticAudioPlaying(false)
          isStaticAudioPlayingRef.current = false
          setVoiceMessages(prev => ({ ...prev, [errMsgId]: { type: voiceType, text: ttsText } }))
          // High-priority: retry/correction voice always attempts TTS (same as feedback)
          if (!voiceMutedRef.current) {
            void handlePlayAudio(errMsgId, voiceType, ttsText)
          }
        }
        return
      }

      const j = (await res.json()) as {
        feedback:      { message: string; spokenFeedback?: string; correction: string | null; score: number | null; correct: boolean | null }
        nextStep:      DemoStepContent | null
        finalResult:   DemoFinalResult | null
        isComplete:    boolean
        finalAudioKey: string | null
      }

      await sleep(500)
      setChatMessages((prev) => [...prev, { id: 'typing', sender: 'ai', isTyping: true }])
      setIsSpeaking(true)
      await sleep(1200)
      // Do NOT setIsSpeaking(false) here — keep teacher "speaking" indicator alive
      // through message reveal and TTS fetch so the user never sees a fully-silent message.

      // Voice type per step — warm_up / followup steps now also get voiced
      const feedbackMsgType = step.key === 'speaking_task' ? 'speaking_feedback'
        : step.key === 'writing_task' ? 'writing_feedback'
        : step.key === 'grammar_mcq' ? 'key_correction'
        : (step.key === 'warm_up' || step.key === 'warm_up_followup' || step.key === 'speaking_followup')
          ? 'follow_up_question'
        : undefined

      // Final-step voice uses a reserved TTS budget slot so normal retry voices cannot crowd it out.
      const effectiveTtsType = j.isComplete && feedbackMsgType ? 'final_closing' : feedbackMsgType

      const feedbackId   = uid()
      const feedbackText = buildFeedbackText(j.feedback, displayAnswer)

      // Reveal message — typing bubble removed, isSpeaking still true (teacher about to speak)
      setChatMessages((prev) => [
        ...prev.filter((m) => !m.isTyping),
        {
          id:     feedbackId,
          sender: 'ai',
          text:   feedbackText,
          ...(effectiveTtsType ? { messageType: effectiveTtsType } : {}),
        },
      ])

      // Play feedback voice and AWAIT it before transitioning to the next step.
      // isSpeaking is already true from the typing animation above — no gap.
      // Capture generation AFTER the per-turn increment so any interruptAudio()
      // call during playback will push gen past this baseline — detectable below.
      let genBeforeVoice = voiceGenerationRef.current
      if (effectiveTtsType) {
        const ttsText = stripMarkdownForTts(j.feedback.spokenFeedback ?? j.feedback.message).slice(0, 300)
        const isFinal = effectiveTtsType === 'final_closing'
        console.log(`[demo-turn] feedbackId=${feedbackId} stepKey=${step.key} ttsType=${effectiveTtsType} speakable=${!voiceMutedRef.current} isFinal=${isFinal}`)
        voiceGenerationRef.current += 1
        genBeforeVoice = voiceGenerationRef.current  // capture post-increment baseline
        setVoiceMessages(prev => ({ ...prev, [feedbackId]: { type: effectiveTtsType, text: ttsText } }))
        if (!voiceMutedRef.current) {
          // isSpeaking already true — teacher indicator stays live through TTS fetch + playback
          if (isFinal) console.log(`[demo-final] preparing_voice id=${feedbackId}`)
          const ttsStart = Date.now()
          await handlePlayAudio(feedbackId, effectiveTtsType, ttsText)
          const ttsElapsed = Date.now() - ttsStart
          if (isFinal) console.log(`[demo-final] voice_done elapsed=${ttsElapsed}ms id=${feedbackId}`)
          // When TTS returned instantly (≤600ms), audio was silent (429/error) — add read time
          if (ttsElapsed < 600) {
            const readMs = Math.min(1200 + ttsText.length * 40, 3000)
            console.log(`[demo-advance] tts_was_silent elapsed=${ttsElapsed}ms adding_read_delay=${readMs}ms stepKey=${step.key}`)
            await sleep(readMs)
          }
        } else {
          setVoiceStates(prev => ({ ...prev, [feedbackId]: 'done' }))
          if (isFinal) console.log(`[demo-final] voice_skipped reason=muted id=${feedbackId}`)
        }
      }
      // Single point of truth: turn off speaking indicator after voice lifecycle
      setIsSpeaking(false)

      setSelectedOption(null)
      setCompletedSteps((prev) => [...prev, step.key])

      if (j.isComplete && j.finalResult) {
        // Feedback TTS is fully done (playAudioChunk now awaits source.onended).
        // If TTS was silent (429 budget exhausted), extend the pause so the student
        // has time to read the feedback text before the overlay appears.
        const completionDelay = ttsLimitReachedRef.current ? 4500 : 2200
        await sleep(completionDelay)
        setFinalResult(j.finalResult)
        console.log('[demo-final] overlay_shown')
        console.log('[demo-phase] complete')
        setPhase('complete')
        return
      }

      if (j.nextStep) {
        // Detect if the user clicked mic during feedback playback (interrupted).
        // voiceGenerationRef advances past genBeforeVoice only when interruptAudio() fires.
        // When muted there is no voice, so no interrupt is possible.
        const micInterruptedVoice = effectiveTtsType != null &&
                                    !voiceMutedRef.current &&
                                    voiceGenerationRef.current !== genBeforeVoice

        // Always update step ref immediately so any concurrent mic submission uses
        // the correct step key (matching the DB state after the advance).
        setCurrentStep(j.nextStep)
        currentStepRef.current = j.nextStep

        if (micInterruptedVoice) {
          // User clicked mic to speak — delay the next step's audio so we don't
          // blast grammar/speaking transition over their active recording.
          // After 3 s the recording is almost certainly done and audio is safe to play.
          console.log(`[demo-advance] mic_interrupt delay=3000ms nextStep=${j.nextStep.key} fromStep=${step.key}`)
          await sleep(3000)
        } else {
          // Give the student time to absorb the AI feedback before the next step fires.
          // 600ms felt too abrupt; 1400ms lands better after TTS finishes speaking.
          const advanceDelay = Math.max(1400, Math.min(2200, 1000 + feedbackText.length * 8))
          console.log(`[demo-advance] allowed nextStep=${j.nextStep.key} fromStep=${step.key} delay=${advanceDelay}ms`)
          await sleep(advanceDelay)
        }

        // Guard: if the student already submitted at the next step during the delay,
        // currentStepRef will have advanced further — skip redundant audio.
        if (currentStepRef.current?.key === j.nextStep.key) {
          await playMessages(j.nextStep.teacherMessages)
          // Schedule TTS fallback for step messages where static audio file is missing
          const nextAllStatic = j.nextStep.teacherMessages.every(hasWorkingStaticAudio)
          const nextBubbleId = currentTeacherMsgRef.current
          if (!nextAllStatic && nextBubbleId && j.nextStep.teacherMessages.length > 0) {
            // Use only the text of messages that lack a working static file
            const needsTts = j.nextStep.teacherMessages.filter(m => !hasWorkingStaticAudio(m))
            const nextText = stripMarkdownForTts(needsTts.map(m => m.text).join(' ')).slice(0, 300)
            setChatMessages(prev => prev.map(m =>
              m.id === nextBubbleId ? { ...m, messageType: 'main_prompt' } : m,
            ))
            scheduleVoice(nextBubbleId, 'main_prompt', nextText)
          }
        }
      }
    } catch {
      setIsSpeaking(false)
      setChatMessages((prev) => [
        ...prev.filter((m) => !m.isTyping),
        { id: uid(), sender: 'ai', text: 'Something went wrong. Please try again.' },
      ])
    } finally {
      setSubmitting(false)
    }
  }, [token, playMessages, scheduleVoice, handlePlayAudio])

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
          console.log('[demo-phase] complete')
          setPhase('complete')
          return
        }

        // Store session data and wait for user to click Begin Lesson.
        // This guarantees a user gesture before the first audio.play() call,
        // which is required to pass the browser autoplay policy.
        pendingLessonRef.current = { intro: data.intro, currentStep: data.currentStep }
        console.log('[demo-phase] ready')
        setPhase('ready')
      } catch {
        setError('Could not load your lesson. Please refresh.')
        console.log('[demo-phase] error')
        setPhase('error')
      }
    })()
  }, [enabled, demoId, token, onNotFound, playMessages, scheduleVoice]) // eslint-disable-line react-hooks/exhaustive-deps

  // Called when user clicks "Begin Lesson" — their click is the required user gesture
  const startLesson = useCallback(async () => {
    const pending = pendingLessonRef.current
    if (!pending) return
    pendingLessonRef.current = null

    try {
      console.log('[demo-phase] intro')
      setPhase('intro')
      await playMessages(pending.intro.messages)

      // Schedule TTS only for intro messages that lack a working static file
      const introAllStatic = pending.intro.messages.every(hasWorkingStaticAudio)
      const introBubbleId = currentTeacherMsgRef.current
      if (!introAllStatic && introBubbleId && pending.intro.messages.length > 0) {
        const needsTts = pending.intro.messages.filter(m => !hasWorkingStaticAudio(m))
        const introTtsText = stripMarkdownForTts(needsTts.map(m => m.text).join(' ')).slice(0, 400)
        setChatMessages(prev => prev.map(m =>
          m.id === introBubbleId ? { ...m, messageType: 'greeting' } : m,
        ))
        scheduleVoice(introBubbleId, 'greeting', introTtsText)
      }

      setLessonStarted(true)
      console.log('[demo-phase] lesson')
      setPhase('lesson')

      if (pending.currentStep) {
        setCurrentStep(pending.currentStep)
        await playMessages(pending.currentStep.teacherMessages)
        // Schedule TTS fallback for step messages where static audio file is missing
        const stepAllStatic = pending.currentStep.teacherMessages.every(hasWorkingStaticAudio)
        const stepBubbleId = currentTeacherMsgRef.current
        if (!stepAllStatic && stepBubbleId && pending.currentStep.teacherMessages.length > 0) {
          const needsTts = pending.currentStep.teacherMessages.filter(m => !hasWorkingStaticAudio(m))
          const stepText = stripMarkdownForTts(needsTts.map(m => m.text).join(' ')).slice(0, 300)
          setChatMessages(prev => prev.map(m =>
            m.id === stepBubbleId ? { ...m, messageType: 'main_prompt' } : m,
          ))
          scheduleVoice(stepBubbleId, 'main_prompt', stepText)
        }
      }
    } catch {
      setError('Could not start your lesson. Please refresh.')
      console.log('[demo-phase] error')
      setPhase('error')
    }
  }, [playMessages, scheduleVoice]) // eslint-disable-line react-hooks/exhaustive-deps

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
    startLesson,
    handleTextSubmit, handleMcqSelect,
    handleHelpRequest, handleTranslateMessage,
    showLeaveModal, setShowLeaveModal, error,
    voiceMuted, toggleVoiceMuted,
    voiceStates, voiceMessages, handlePlayAudio,
    isStaticAudioPlaying,
    interruptAudio,
  }
}
