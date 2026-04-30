import { useEffect, useRef, useState } from 'react'
import { useLesson, type ExerciseCard } from '../../hooks/useLesson'
import { LessonStage, deriveStage }     from './LessonStage'
import { LessonControls }               from './controls/LessonControls'
import { ClassroomHeader }              from './chrome/ClassroomHeader'
import { ProgressRail }                 from './chrome/ProgressRail'
import { FloatingAvatar }               from './chrome/FloatingAvatar'
import { CaptionsPanel }                from './chrome/CaptionsPanel'
import { TeachingOverlay }              from './overlays/TeachingOverlay'
import { ExitModal }                    from './overlays/ExitModal'

// FUTURE: sectionId, bookId, teacherId, voiceId will come from route/session params
const LESSON_CONFIG = {
  studentId: '00000000-0000-0000-0000-000000000001',
  unit:      1,
  section:   '1.2',
}

export default function LessonRoom() {
  const {
    messages,
    connectionState,
    currentPhase,
    currentExercise,
    sectionCard,
    teachingCard,
    isConfusionLoading,
    isTeacherSpeaking,
    connect,
    startFocusLesson,
    sendText,
    sendConfused,
    dismissTeachingCard,
  } = useLesson()

  const [input, setInput]         = useState('')
  const [chatInput, setChatInput] = useState('')
  const [started, setStarted]     = useState(false)
  const [voiceModeActive, setVoiceModeActive] = useState(false)
  const [isListening, setIsListening]         = useState(false)
  const [micError, setMicError]               = useState<string | null>(null)
  const [voiceStatusHint, setVoiceStatusHint] = useState<string | null>(null)

  // Classroom UI state — chat open by default to match reference
  const [chatOpen, setChatOpen]         = useState(true)
  const [exitModalOpen, setExitModalOpen] = useState(false)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef      = useRef<any>(null)
  const voiceModeRef        = useRef(false)
  const isRestartingRef     = useRef(false)
  const restartTimeoutRef   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isTTSSpeakingRef    = useRef(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const startRecognitionRef = useRef<() => void>(() => {})
  const voiceBufferRef      = useRef<string>('')
  const voiceFlushTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const currentExerciseRef  = useRef<ExerciseCard | null>(null)

  // Auto-connect on mount
  useEffect(() => { connect() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-start once connected (only once)
  useEffect(() => {
    if (connectionState === 'connected' && !started) {
      startFocusLesson(LESSON_CONFIG)
      setStarted(true)
    }
  }, [connectionState, started, startFocusLesson])

  function clearRestartTimer() {
    if (restartTimeoutRef.current !== null) { clearTimeout(restartTimeoutRef.current); restartTimeoutRef.current = null }
  }
  function clearVoiceFlushTimer() {
    if (voiceFlushTimerRef.current !== null) { clearTimeout(voiceFlushTimerRef.current); voiceFlushTimerRef.current = null }
  }
  function showVoiceHint(msg: string, durationMs = 3000) {
    setVoiceStatusHint(msg); setTimeout(() => setVoiceStatusHint(null), durationMs)
  }
  function flushVoiceBuffer() {
    clearVoiceFlushTimer()
    const text = voiceBufferRef.current.trim(); voiceBufferRef.current = ''
    if (text) { setVoiceStatusHint(null); sendText(text) }
  }
  function handleVoiceTranscript(transcript: string) {
    const t = transcript.trim(); if (!t) return
    const ex = currentExerciseRef.current
    if (/^(uh+|um+|hmm+|ah+|er+|mm+|yeah|yep)\s*[.,]?\s*$/i.test(t)) return
    if (/^(next|skip|move on)\s*[.,]?\s*$/i.test(t) && ex) {
      voiceBufferRef.current = ''; clearVoiceFlushTimer(); showVoiceHint('Finish this one first.'); return
    }
    if (/\b(and|but|because|so|or|if|when|that)\s*[.,]?\s*$/i.test(t)) {
      voiceBufferRef.current = voiceBufferRef.current ? voiceBufferRef.current + ' ' + t : t
      clearVoiceFlushTimer(); voiceFlushTimerRef.current = setTimeout(flushVoiceBuffer, 2500); return
    }
    voiceBufferRef.current = voiceBufferRef.current ? voiceBufferRef.current + ' ' + t : t
    clearVoiceFlushTimer(); voiceFlushTimerRef.current = setTimeout(flushVoiceBuffer, 900)
  }

  function startRecognition() {
    if (isRestartingRef.current) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) { setMicError('Voice input requires Chrome browser.'); voiceModeRef.current = false; setVoiceModeActive(false); return }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rec: any = new SR()
    rec.lang = 'en-US'; rec.continuous = true; rec.interimResults = false; rec.maxAlternatives = 1
    rec.onstart  = () => { setIsListening(true); isRestartingRef.current = false }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (event: any) => {
      if (isTTSSpeakingRef.current) return
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) { const tr: string = event.results[i][0].transcript.trim(); if (tr) handleVoiceTranscript(tr) }
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onerror = (event: any) => {
      isRestartingRef.current = false
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        voiceModeRef.current = false; setVoiceModeActive(false); setIsListening(false)
        setMicError('Microphone permission denied. Allow access in browser settings.')
      }
    }
    rec.onend = () => {
      setIsListening(false); isRestartingRef.current = false
      if (voiceModeRef.current && !isTTSSpeakingRef.current) {
        clearRestartTimer(); restartTimeoutRef.current = setTimeout(() => {
          if (voiceModeRef.current && !isTTSSpeakingRef.current) startRecognition()
        }, 200)
      }
    }
    recognitionRef.current = rec; isRestartingRef.current = true
    try { rec.start() } catch { isRestartingRef.current = false }
  }

  function stopRecognition() {
    clearRestartTimer(); voiceModeRef.current = false; isRestartingRef.current = false
    setVoiceModeActive(false); setIsListening(false); recognitionRef.current?.stop(); recognitionRef.current = null
  }

  startRecognitionRef.current = startRecognition

  function toggleVoiceMode() {
    if (voiceModeActive) { stopRecognition() }
    else { setMicError(null); voiceModeRef.current = true; setVoiceModeActive(true); startRecognition() }
  }

  useEffect(() => { currentExerciseRef.current = currentExercise }, [currentExercise])

  useEffect(() => {
    isTTSSpeakingRef.current = isTeacherSpeaking
    if (isTeacherSpeaking) {
      clearVoiceFlushTimer(); voiceBufferRef.current = ''; clearRestartTimer()
      isRestartingRef.current = false; recognitionRef.current?.stop(); recognitionRef.current = null; setIsListening(false)
    } else if (voiceModeRef.current) { startRecognitionRef.current() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTeacherSpeaking])

  useEffect(() => () => {
    clearRestartTimer(); clearVoiceFlushTimer(); recognitionRef.current?.stop()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleSend() {
    const text = input.trim(); if (!text) return; sendText(text); setInput('')
  }
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }
  function handleChatSend() {
    const text = chatInput.trim(); if (!text) return; sendText(text); setChatInput('')
  }
  function handleChatKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleChatSend() }
  }
  function handleConfused() {
    const lastTeacher = [...messages].reverse().find(m => m.role === 'teacher')
    sendConfused({
      phase:              currentPhase,
      lastTeacherMessage: lastTeacher?.text?.slice(0, 400),
      lastExercise:       currentExercise?.question?.slice(0, 400),
    })
  }

  const lastTeacherMessage = [...messages].reverse().find(m => m.role === 'teacher') ?? null
  const stageType          = deriveStage({ started, connectionState, currentExercise, sectionCard, currentPhase })
  const avatarState        = isTeacherSpeaking ? 'speaking' : isConfusionLoading ? 'thinking' : 'waiting'
  const isActive           = started && connectionState === 'connected'

  return (
    <div className="h-screen bg-[#F5F5F7] text-gray-900 flex flex-col overflow-hidden">

      {/* ── Header ── */}
      <ClassroomHeader
        currentPhase={currentPhase}
        started={started}
        connectionState={connectionState}
        onRequestExit={() => setExitModalOpen(true)}
      />

      {/* ── Body: 3-column layout ── */}
      <div className="flex flex-1 overflow-hidden min-h-0">

        {/* Left: Teacher sidebar */}
        <FloatingAvatar state={avatarState} />

        {/* Center: lesson content */}
        <main className="flex-1 min-w-0 overflow-y-auto flex flex-col">
          <LessonStage
            stageType={stageType}
            currentExercise={currentExercise}
            sectionCard={sectionCard}
            lastTeacherMessage={lastTeacherMessage}
            isTeacherSpeaking={isTeacherSpeaking}
            isConfusionLoading={isConfusionLoading}
            connectionState={connectionState}
            started={started}
            onSubmitAnswer={sendText}
          />
        </main>

        {/* Right: Progress panel */}
        <ProgressRail
          currentPhase={currentPhase}
          currentExercise={currentExercise}
          chatOpen={chatOpen}
          onToggleChat={() => setChatOpen(v => !v)}
        />

        {/* Right: Chat panel — slides in when open */}
        {chatOpen && (
          <CaptionsPanel
            messages={messages}
            onClose={() => setChatOpen(false)}
            input={chatInput}
            onInputChange={setChatInput}
            onSend={handleChatSend}
            onKeyDown={handleChatKeyDown}
          />
        )}
      </div>

      {/* ── Bottom floating controls ── */}
      <LessonControls
        isActive={isActive}
        connectionState={connectionState}
        voiceModeActive={voiceModeActive}
        isListening={isListening}
        isTeacherSpeaking={isTeacherSpeaking}
        micError={micError}
        voiceStatusHint={voiceStatusHint}
        onToggleVoice={toggleVoiceMode}
        input={input}
        onInputChange={setInput}
        onSend={handleSend}
        onKeyDown={handleKeyDown}
        onConfused={handleConfused}
        isConfusionLoading={isConfusionLoading}
      />

      {/* ── Overlays ── */}
      {teachingCard && (
        <TeachingOverlay card={teachingCard} onDismiss={dismissTeachingCard} />
      )}
      {exitModalOpen && (
        <ExitModal
          onStay={() => setExitModalOpen(false)}
          onLeave={() => {
            // FUTURE: call backend to save/pause lesson before leaving
            setExitModalOpen(false)
            window.location.href = '/'
          }}
        />
      )}
    </div>
  )
}
