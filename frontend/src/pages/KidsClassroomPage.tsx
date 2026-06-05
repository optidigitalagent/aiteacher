import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getStoredToken } from '../context/AuthContext'
import {
  createClassroomSocket,
  sendMessage,
  type BackendMessage,
  type LessonSummary,
} from '../features/classroom/services/classroomSocket'
import {
  playAudioChunk,
  warmAudioContext,
  primeAudioContext,
  primeHtmlAudio,
  stopAudioPlayback,
  requestMicPreflight,
  getScheduledAudioEndMs,
} from '../features/classroom/services/voiceApi'
import { useKidsMic, type KidsMicState } from '../features/classroom/hooks/useKidsMic'

// ── Types ─────────────────────────────────────────────────────────────────────

type KidsState =
  | 'connecting'  // WS connecting, awaiting lesson_ready
  | 'ready'       // lesson_ready received, waiting for child's first tap
  | 'teaching'    // teacher is speaking (ai_text shown, audio playing)
  | 'listening'   // teacher_turn_end — child's turn to answer
  | 'sending'     // child submitted answer, awaiting next backend message
  | 'complete'    // lesson_end received
  | 'error'       // WS error / disconnected

type ExerciseCtx = {
  exerciseId:     string
  exerciseNumber: number
  instruction:    string
  targetWords:    string[]
  choices:        { choiceId: string; text: string }[]
  totalExercises: number
  completedCount: number
}

// ── Inline sub-components ─────────────────────────────────────────────────────

function KidsTeacherBubble({ text, isTyping }: { text: string | null; isTyping: boolean }) {
  return (
    <div className="ktb-wrap">
      <div className="ktb-avatar">🦁</div>
      <div className="ktb-bubble">
        {isTyping ? (
          <div className="ktb-dots">
            <span /><span /><span />
          </div>
        ) : (
          <p className="ktb-text">{text ?? ' '}</p>
        )}
      </div>
    </div>
  )
}

function KidsAudioIndicator({ state }: { state: KidsState }) {
  if (state === 'teaching') {
    return (
      <div className="kai kai--speaking">
        <span className="kai-dot" /><span className="kai-dot" /><span className="kai-dot" />
        <span className="kai-label">Teacher is speaking…</span>
      </div>
    )
  }
  if (state === 'listening') {
    return (
      <div className="kai kai--turn">
        <span className="kai-label">Your turn! 🎤</span>
      </div>
    )
  }
  if (state === 'sending') {
    return (
      <div className="kai kai--sending">
        <span className="kai-label">Sending…</span>
      </div>
    )
  }
  return null
}

function KidsProgressDots({ count, total = 10 }: { count: number; total?: number }) {
  return (
    <div className="kpd-row" aria-label={`Lesson progress: ${count} of ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`kpd-dot${i < count ? ' kpd-dot--filled' : ''}${i === count ? ' kpd-dot--current' : ''}`}
        />
      ))}
    </div>
  )
}

function KidsLessonComplete({ summary, onDone }: { summary: LessonSummary | null; onDone: () => void }) {
  return (
    <div className="klc-wrap">
      <div className="klc-stars">🌟🌟🌟</div>
      <h1 className="klc-title">Fantastic job!</h1>
      <p className="klc-sub">You did amazing today. I&apos;m so proud of you!</p>
      {summary && (
        <div className="klc-chips">
          <span className="klc-chip">⏱ {summary.durationMin} min</span>
          {summary.vocabularyCount > 0 && (
            <span className="klc-chip">📚 {summary.vocabularyCount} words</span>
          )}
        </div>
      )}
      <button className="kc-btn kc-btn--done" onClick={onDone}>
        Done 🏠
      </button>
    </div>
  )
}

function KidsMicButton({
  micState,
  kidsState,
  onStart,
  onStop,
}: {
  micState: KidsMicState
  kidsState: KidsState
  onStart: () => void
  onStop: () => void
}) {
  const isListening = kidsState === 'listening'
  const isTeaching  = kidsState === 'teaching' || kidsState === 'sending'

  if (micState === 'unavailable') return null

  if (micState === 'blocked') {
    return (
      <div className="kmb-blocked">
        <span className="kmb-blocked-icon">🎤</span>
        <p className="kmb-blocked-text">Microphone blocked. Please allow microphone access in your browser.</p>
      </div>
    )
  }

  if (micState === 'recording') {
    return (
      <button
        className="kmb-btn kmb-btn--recording"
        onClick={onStop}
        aria-label="Stop speaking"
        type="button"
      >
        <span className="kmb-pulse" />
        <span className="kmb-icon">🎤</span>
        <span className="kmb-label">Listening…</span>
      </button>
    )
  }

  if (micState === 'requesting') {
    return (
      <button className="kmb-btn kmb-btn--requesting" disabled aria-label="Requesting microphone" type="button">
        <span className="kmb-icon">🎤</span>
        <span className="kmb-label">Getting mic…</span>
      </button>
    )
  }

  // idle — label reflects current lesson turn
  const idleLabel =
    kidsState === 'teaching' ? 'Listen' :
    kidsState === 'sending'  ? 'Sending…' :
    'Tap to speak'

  return (
    <button
      className={`kmb-btn kmb-btn--idle${!isListening || isTeaching ? ' kmb-btn--disabled' : ''}`}
      onClick={onStart}
      disabled={!isListening || isTeaching}
      aria-label={isListening ? 'Tap to speak' : idleLabel}
      type="button"
    >
      <span className="kmb-icon">🎤</span>
      <span className="kmb-label">{idleLabel}</span>
    </button>
  )
}

function KidsExitGuard({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="keg-overlay">
      <div className="keg-card">
        <p className="keg-emoji">🤔</p>
        <p className="keg-text">Do you want to stop the lesson?</p>
        <div className="keg-btns">
          <button className="keg-btn keg-btn--cancel" onClick={onCancel}>
            Keep going!
          </button>
          <button className="keg-btn keg-btn--confirm" onClick={onConfirm}>
            Stop lesson
          </button>
        </div>
      </div>
    </div>
  )
}

// ── CSS ───────────────────────────────────────────────────────────────────────

const CSS = `
  /* ── Page shell ── */
  .kc-page {
    min-height: 100vh;
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    background: linear-gradient(160deg, #FFF9F3 0%, #F0F4FF 55%, #FFF4EE 100%);
    overflow: hidden;
    position: relative;
  }

  /* ── Top bar ── */
  .kc-topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 20px;
    flex-shrink: 0;
  }
  .kc-topbar-brand {
    font-family: 'Sora', sans-serif;
    font-size: 15px;
    font-weight: 800;
    color: #7B8CFF;
    letter-spacing: -0.3px;
  }
  .kc-topbar-exit {
    background: rgba(255,255,255,0.7);
    border: 1px solid rgba(0,0,0,0.08);
    border-radius: 20px;
    padding: 6px 14px;
    font-size: 13px;
    font-weight: 600;
    color: #64748B;
    cursor: pointer;
    backdrop-filter: blur(8px);
  }
  .kc-topbar-exit:hover { background: rgba(255,255,255,0.9); }

  /* ── Main content ── */
  .kc-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 16px 20px;
    gap: 24px;
  }

  /* ── Teacher bubble ── */
  .ktb-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    width: 100%;
    max-width: 520px;
  }
  .ktb-avatar {
    font-size: 52px;
    animation: kc-bounce 2.4s ease-in-out infinite;
    line-height: 1;
  }
  @keyframes kc-bounce {
    0%,100% { transform: translateY(0); }
    50%      { transform: translateY(-8px); }
  }
  .ktb-bubble {
    background: #fff;
    border-radius: 24px 24px 24px 4px;
    padding: 20px 28px;
    box-shadow: 0 8px 32px rgba(15,23,42,0.10), 0 0 0 1px rgba(230,234,242,0.8);
    min-height: 72px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
  }
  .ktb-text {
    font-family: 'Sora', sans-serif;
    font-size: clamp(18px, 4vw, 26px);
    font-weight: 700;
    color: #0F172A;
    line-height: 1.5;
    margin: 0;
    text-align: center;
  }
  .ktb-dots {
    display: flex;
    gap: 8px;
    align-items: center;
    justify-content: center;
  }
  .ktb-dots span {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #7B8CFF;
    animation: kc-dot-pulse 1.2s ease-in-out infinite;
  }
  .ktb-dots span:nth-child(2) { animation-delay: 0.2s; }
  .ktb-dots span:nth-child(3) { animation-delay: 0.4s; }
  @keyframes kc-dot-pulse {
    0%,80%,100% { transform: scale(0.7); opacity: 0.4; }
    40%          { transform: scale(1.1); opacity: 1; }
  }

  /* ── Progress dots ── */
  .kpd-row {
    display: flex;
    gap: 10px;
    align-items: center;
    justify-content: center;
    flex-wrap: wrap;
  }
  .kpd-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #D1D8F0;
    transition: background 400ms, transform 300ms;
  }
  .kpd-dot--filled {
    background: linear-gradient(135deg, #7B8CFF, #A18BFF);
    transform: scale(1.1);
  }
  .kpd-dot--current {
    background: #FFB38C;
    transform: scale(1.2);
    animation: kc-dot-pulse 1.5s ease-in-out infinite;
  }

  /* ── Audio indicator ── */
  .kai {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 16px;
    border-radius: 20px;
    min-height: 32px;
  }
  .kai--speaking {
    background: rgba(123,140,255,0.08);
    border: 1px solid rgba(123,140,255,0.15);
  }
  .kai--turn {
    background: rgba(255,179,140,0.12);
    border: 1px solid rgba(255,179,140,0.25);
  }
  .kai--sending {
    background: rgba(100,116,139,0.08);
    border: 1px solid rgba(100,116,139,0.15);
  }
  .kai-label {
    font-size: 13px;
    font-weight: 600;
    color: #475569;
  }
  .kai-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #7B8CFF;
    animation: kc-dot-pulse 1s ease-in-out infinite;
  }
  .kai-dot:nth-child(2) { animation-delay: 0.15s; }
  .kai-dot:nth-child(3) { animation-delay: 0.3s; }

  /* ── Bottom input area ── */
  .kc-bottom {
    flex-shrink: 0;
    padding: 12px 20px 24px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    width: 100%;
    max-width: 560px;
    margin: 0 auto;
  }
  .kc-input-row {
    display: flex;
    gap: 10px;
    width: 100%;
    align-items: center;
  }
  .kc-input {
    flex: 1;
    padding: 14px 18px;
    font-family: 'Sora', sans-serif;
    font-size: 16px;
    font-weight: 600;
    color: #0F172A;
    background: #fff;
    border: 2px solid #E2E8F0;
    border-radius: 16px;
    outline: none;
    transition: border-color 180ms;
    min-height: 52px;
  }
  .kc-input:focus {
    border-color: #7B8CFF;
    box-shadow: 0 0 0 3px rgba(123,140,255,0.15);
  }
  .kc-input:disabled { background: #F8FAFC; color: #94A3B8; cursor: not-allowed; }
  .kc-input::placeholder { color: #94A3B8; font-weight: 500; }

  /* ── Buttons ── */
  .kc-btn {
    font-family: 'Sora', sans-serif;
    font-size: 16px;
    font-weight: 700;
    border: none;
    border-radius: 16px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    transition: transform 180ms cubic-bezier(0.22,1,0.36,1), box-shadow 180ms;
    -webkit-tap-highlight-color: transparent;
    user-select: none;
  }
  .kc-btn:hover:not(:disabled) { transform: scale(1.03); }
  .kc-btn:active:not(:disabled) { transform: scale(0.97); }
  .kc-btn:disabled { cursor: not-allowed; opacity: 0.5; }

  .kc-btn--send {
    min-width: 52px;
    min-height: 52px;
    padding: 14px 20px;
    background: linear-gradient(135deg, #7B8CFF 0%, #A18BFF 100%);
    color: #fff;
    border-radius: 16px;
    box-shadow: 0 6px 18px rgba(123,140,255,0.35);
    font-size: 18px;
  }
  .kc-btn--send:hover:not(:disabled) { box-shadow: 0 10px 24px rgba(123,140,255,0.45); }

  .kc-btn--start {
    width: 100%;
    max-width: 320px;
    padding: 18px 32px;
    font-size: 18px;
    background: linear-gradient(135deg, #7B8CFF 0%, #A18BFF 60%, #FFB38C 100%);
    color: #fff;
    border-radius: 20px;
    box-shadow: 0 10px 28px rgba(123,140,255,0.38);
    animation: kc-pulse-glow 2s ease-in-out infinite;
  }
  @keyframes kc-pulse-glow {
    0%,100% { box-shadow: 0 10px 28px rgba(123,140,255,0.38); }
    50%      { box-shadow: 0 14px 36px rgba(123,140,255,0.55); }
  }

  .kc-btn--done {
    width: 100%;
    max-width: 280px;
    padding: 18px 32px;
    font-size: 18px;
    background: linear-gradient(135deg, #10B981 0%, #34D399 100%);
    color: #fff;
    border-radius: 20px;
    box-shadow: 0 10px 28px rgba(16,185,129,0.35);
    margin-top: 8px;
  }

  /* ── Connecting / error states ── */
  .kc-center {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 20px;
    padding: 32px;
    text-align: center;
  }
  .kc-spinner {
    width: 40px;
    height: 40px;
    border: 4px solid rgba(123,140,255,0.2);
    border-top-color: #7B8CFF;
    border-radius: 50%;
    animation: kc-spin 0.8s linear infinite;
  }
  @keyframes kc-spin { to { transform: rotate(360deg); } }
  .kc-conn-label {
    font-family: 'Sora', sans-serif;
    font-size: 16px;
    font-weight: 600;
    color: #64748B;
  }
  .kc-error-emoji { font-size: 48px; }
  .kc-error-label {
    font-family: 'Sora', sans-serif;
    font-size: 16px;
    font-weight: 600;
    color: #DC2626;
  }
  .kc-error-sub { font-size: 13px; color: #94A3B8; }
  .kc-btn--retry {
    padding: 14px 28px;
    background: #7B8CFF;
    color: #fff;
    border-radius: 16px;
    box-shadow: 0 6px 18px rgba(123,140,255,0.3);
  }

  /* ── Lesson complete ── */
  .klc-wrap {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 32px 24px;
    text-align: center;
  }
  .klc-stars { font-size: 48px; animation: kc-bounce 1.8s ease-in-out infinite; }
  .klc-title {
    font-family: 'Sora', sans-serif;
    font-size: clamp(26px, 6vw, 36px);
    font-weight: 800;
    color: #0F172A;
    letter-spacing: -0.8px;
  }
  .klc-sub { font-size: 16px; color: #475569; line-height: 1.6; max-width: 300px; }
  .klc-chips { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; margin-top: 4px; }
  .klc-chip {
    font-size: 13px; font-weight: 600; color: #475569;
    background: rgba(123,140,255,0.1); border: 1px solid rgba(123,140,255,0.2);
    border-radius: 20px; padding: 4px 14px;
  }

  /* ── Exit guard ── */
  .keg-overlay {
    position: fixed; inset: 0;
    background: rgba(15,23,42,0.4);
    backdrop-filter: blur(6px);
    display: flex; align-items: center; justify-content: center;
    padding: 24px; z-index: 100;
  }
  .keg-card {
    background: #fff; border-radius: 24px;
    padding: 32px 28px; max-width: 340px; width: 100%;
    text-align: center;
    box-shadow: 0 24px 64px rgba(15,23,42,0.2);
  }
  .keg-emoji { font-size: 40px; margin-bottom: 12px; }
  .keg-text {
    font-family: 'Sora', sans-serif;
    font-size: 18px; font-weight: 700; color: #0F172A;
    margin-bottom: 24px;
  }
  .keg-btns { display: flex; gap: 10px; }
  .keg-btn {
    flex: 1; padding: 14px 12px; border: none; border-radius: 14px;
    font-family: 'Sora', sans-serif; font-size: 15px; font-weight: 700;
    cursor: pointer; transition: transform 150ms;
  }
  .keg-btn:active { transform: scale(0.97); }
  .keg-btn--cancel { background: #F1F5F9; color: #0F172A; }
  .keg-btn--confirm { background: #FEE2E2; color: #DC2626; }

  /* ── Ready splash ── */
  .kc-ready-wrap {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 24px;
    padding: 32px 24px;
    text-align: center;
  }
  .kc-ready-avatar { font-size: 64px; animation: kc-bounce 2s ease-in-out infinite; }
  .kc-ready-title {
    font-family: 'Sora', sans-serif;
    font-size: clamp(22px, 5vw, 30px);
    font-weight: 800;
    color: #0F172A;
    letter-spacing: -0.6px;
  }
  .kc-ready-sub { font-size: 15px; color: #64748B; max-width: 280px; }

  /* ── Mic button ── */
  .kmb-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    width: 100%;
    max-width: 320px;
    padding: 18px 24px;
    border: none;
    border-radius: 20px;
    font-family: 'Sora', sans-serif;
    font-size: 16px;
    font-weight: 700;
    cursor: pointer;
    transition: transform 180ms cubic-bezier(0.22,1,0.36,1), box-shadow 180ms;
    -webkit-tap-highlight-color: transparent;
    user-select: none;
    position: relative;
    overflow: hidden;
  }
  .kmb-btn:active:not(:disabled) { transform: scale(0.97); }

  .kmb-btn--idle {
    background: linear-gradient(135deg, #A18BFF 0%, #7B8CFF 100%);
    color: #fff;
    box-shadow: 0 8px 24px rgba(123,140,255,0.38);
  }
  .kmb-btn--idle:hover:not(:disabled) {
    box-shadow: 0 12px 32px rgba(123,140,255,0.50);
    transform: scale(1.03);
  }

  .kmb-btn--disabled,
  .kmb-btn--idle:disabled {
    background: #E2E8F0;
    color: #94A3B8;
    box-shadow: none;
    cursor: not-allowed;
  }

  .kmb-btn--recording {
    background: linear-gradient(135deg, #FF6B8A 0%, #FF8C6B 100%);
    color: #fff;
    box-shadow: 0 8px 24px rgba(255,107,138,0.40);
    animation: kmb-glow 1.5s ease-in-out infinite;
  }
  @keyframes kmb-glow {
    0%,100% { box-shadow: 0 8px 24px rgba(255,107,138,0.40); }
    50%      { box-shadow: 0 12px 32px rgba(255,107,138,0.65); }
  }

  .kmb-btn--requesting {
    background: #E2E8F0;
    color: #64748B;
    box-shadow: none;
    cursor: wait;
  }

  .kmb-icon { font-size: 22px; line-height: 1; }
  .kmb-label { font-size: 16px; font-weight: 700; }

  /* Pulsing ring for active recording */
  .kmb-pulse {
    position: absolute;
    inset: 0;
    border-radius: 20px;
    border: 3px solid rgba(255,255,255,0.5);
    animation: kmb-ring 1.2s ease-out infinite;
    pointer-events: none;
  }
  @keyframes kmb-ring {
    0%   { transform: scale(1);    opacity: 0.7; }
    100% { transform: scale(1.08); opacity: 0; }
  }

  /* Mic blocked notice */
  .kmb-blocked {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px 18px;
    background: rgba(239,68,68,0.06);
    border: 1px solid rgba(239,68,68,0.18);
    border-radius: 16px;
    max-width: 320px;
    width: 100%;
  }
  .kmb-blocked-icon { font-size: 20px; }
  .kmb-blocked-text {
    font-family: 'Sora', sans-serif;
    font-size: 13px;
    font-weight: 600;
    color: #DC2626;
    line-height: 1.4;
  }

  /* ── Input / mic row layout ── */
  .kc-voice-row {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    width: 100%;
  }
  .kc-divider {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    max-width: 320px;
    color: #94A3B8;
    font-size: 12px;
    font-weight: 600;
  }
  .kc-divider::before,
  .kc-divider::after {
    content: '';
    flex: 1;
    height: 1px;
    background: #E2E8F0;
  }

  /* ── Exercise context card ── */
  .kec-card {
    width: 100%;
    max-width: 520px;
    background: linear-gradient(135deg, rgba(123,140,255,0.08) 0%, rgba(161,139,255,0.06) 100%);
    border: 1.5px solid rgba(123,140,255,0.18);
    border-radius: 20px;
    padding: 14px 20px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .kec-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .kec-num {
    font-family: 'Sora', sans-serif;
    font-size: 13px;
    font-weight: 800;
    color: #7B8CFF;
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }
  .kec-progress {
    font-family: 'Sora', sans-serif;
    font-size: 12px;
    font-weight: 700;
    color: #94A3B8;
    background: rgba(148,163,184,0.1);
    border-radius: 20px;
    padding: 2px 10px;
  }
  .kec-instruction {
    font-family: 'Sora', sans-serif;
    font-size: 14px;
    font-weight: 600;
    color: #334155;
    margin: 0;
    line-height: 1.4;
  }
  .kec-words {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 2px;
  }
  .kec-word {
    font-family: 'Sora', sans-serif;
    font-size: 15px;
    font-weight: 800;
    color: #fff;
    background: linear-gradient(135deg, #7B8CFF 0%, #A18BFF 100%);
    border-radius: 12px;
    padding: 4px 14px;
    letter-spacing: 0.3px;
  }
  .kec-choices {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 2px;
  }
  .kec-choice {
    font-family: 'Sora', sans-serif;
    font-size: 15px;
    font-weight: 700;
    color: #475569;
    background: rgba(123,140,255,0.1);
    border: 1.5px solid rgba(123,140,255,0.2);
    border-radius: 12px;
    padding: 4px 14px;
  }

  /* ── Mobile ── */
  @media (max-width: 480px) {
    .ktb-bubble { padding: 16px 20px; }
    .kc-bottom { padding: 10px 16px 20px; }
    .kec-card { padding: 12px 16px; }
  }
`

// ── Main page component ───────────────────────────────────────────────────────

export default function KidsClassroomPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()

  const [kidsState, setKidsState] = useState<KidsState>('connecting')
  const [teacherText, setTeacherText] = useState<string | null>(null)
  const [inputValue, setInputValue] = useState('')
  const [showExitModal, setShowExitModal] = useState(false)
  const [summary, setSummary] = useState<LessonSummary | null>(null)
  const [progressCount, setProgressCount] = useState(0)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [micPreflightDone, setMicPreflightDone] = useState(false)
  const [voiceUnavailable, setVoiceUnavailable] = useState(false)
  const [exerciseCtx, setExerciseCtx] = useState<ExerciseCtx | null>(null)

  // Refs for buffering before user taps "Let's Go"
  const wsRef            = useRef<WebSocket | null>(null)
  const audioStartedRef  = useRef(false)   // true after user taps and audio primed
  const pendingTextRef   = useRef<string | null>(null)
  const pendingAudioRef  = useRef<string[]>([])
  const pendingTurnEnd   = useRef(false)

  // Voice input: only enabled when it is genuinely the child's turn and audio is primed.
  // Teaching/sending/connecting states all disable mic (teacher is speaking or processing).
  const micEnabled = kidsState === 'listening' && micPreflightDone
  const { micState, startRecording, stopRecording, available: micAvailable } = useKidsMic({
    wsRef,
    enabled: micEnabled,
  })

  const handleMessage = useCallback((msg: BackendMessage) => {
    switch (msg.type) {
      case 'lesson_ready':
        setKidsState(prev => prev === 'connecting' ? 'ready' : prev)
        break

      case 'ai_text': {
        const text = msg.text
        if (!audioStartedRef.current) {
          // Buffer until user taps
          pendingTextRef.current = text
        } else {
          setTeacherText(text)
          setKidsState('teaching')
        }
        break
      }

      case 'audio_chunk': {
        if (!audioStartedRef.current) {
          // Buffer audio chunks until gesture primes the AudioContext
          pendingAudioRef.current.push(msg.data)
        } else {
          void playAudioChunk(msg.data)
        }
        break
      }

      case 'teacher_turn_end': {
        setProgressCount(prev => Math.min(prev + 1, 10))
        if (!audioStartedRef.current) {
          pendingTurnEnd.current = true
        } else {
          // Wait for scheduled audio to finish before enabling mic.
          // teacher_turn_end arrives while Web Audio may still have buffered chunks
          // playing in the speaker — opening the mic immediately causes echo of the
          // teacher's voice (e.g., "Hello!") to be captured and misrecognised.
          // POST_TTS_GUARD_MS adds extra silence for acoustic echo decay.
          const POST_TTS_GUARD_MS = 400
          const remainingMs = getScheduledAudioEndMs()
          const delayMs = remainingMs + POST_TTS_GUARD_MS
          if (delayMs > POST_TTS_GUARD_MS) {
            setTimeout(() => setKidsState('listening'), delayMs)
          } else {
            setTimeout(() => setKidsState('listening'), POST_TTS_GUARD_MS)
          }
        }
        break
      }

      case 'lesson_end': {
        stopAudioPlayback()
        setSummary(msg.summary)
        setKidsState('complete')
        break
      }

      case 'voice_unavailable': {
        setVoiceUnavailable(true)
        break
      }

      case 'kids_exercise_context': {
        setExerciseCtx({
          exerciseId:     msg.exerciseId,
          exerciseNumber: msg.exerciseNumber,
          instruction:    msg.instruction,
          targetWords:    msg.targetWords,
          choices:        msg.choices,
          totalExercises: msg.totalExercises,
          completedCount: msg.completedCount,
        })
        break
      }

      case 'error':
      case 'runtime_error': {
        setErrorMsg(msg.message)
        setKidsState('error')
        break
      }

      default:
        break
    }
  }, [])

  // Connect WS on mount
  useEffect(() => {
    let stale = false

    const token = getStoredToken() ?? undefined
    const ws = createClassroomSocket(
      handleMessage,
      undefined,
      (code) => {
        if (stale) return
        // Functional setter avoids stale closure: if lesson already completed,
        // don't replace the success screen with an error screen.
        setKidsState(prev => {
          if (prev !== 'complete') {
            // code is intentionally unused in the message — raw close codes
            // are not meaningful to children.
            void code
            setErrorMsg('One moment, we\'re reconnecting.')
            stopRecording('disconnect')
            return 'error'
          }
          return prev
        })
      },
      token,
      sessionId,
    )
    wsRef.current = ws

    return () => {
      stale = true
      stopAudioPlayback()
      ws.close(1000, 'page_unmount')
      wsRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  // Prime audio + flush buffers when user taps "Let's Go"
  const handleStartLesson = useCallback(async () => {
    // Must be synchronous first for iOS gesture context
    primeHtmlAudio()
    warmAudioContext()

    // Mic preflight: request permission silently within the same user gesture.
    // Stops tracks immediately — just ensures the browser prompt fires now
    // so the child does not need a second interaction to unlock the mic.
    void requestMicPreflight().then((granted) => {
      if (granted) setMicPreflightDone(true)
    })

    // Async part: wait for AudioContext to be truly running
    await primeAudioContext()
    audioStartedRef.current = true

    // Signal backend to begin the lesson (triggers handleKidsBrainV1LessonStart)
    sendMessage(wsRef.current, { type: 'focus_lesson_start', payload: { unit: 1 } })

    // Flush buffered text
    if (pendingTextRef.current) {
      setTeacherText(pendingTextRef.current)
      pendingTextRef.current = null
    }

    // Flush buffered audio
    const chunks = pendingAudioRef.current.splice(0)
    for (const chunk of chunks) {
      void playAudioChunk(chunk)
    }

    // Advance state
    if (pendingTurnEnd.current) {
      pendingTurnEnd.current = false
      setKidsState('listening')
    } else {
      // Teacher text may or may not have arrived yet — show teaching or wait
      setKidsState(teacherText || pendingTextRef.current ? 'teaching' : 'teaching')
    }
  }, [teacherText])

  // Submit text answer
  const handleSubmit = useCallback(() => {
    const text = inputValue.trim()
    if (!text || kidsState !== 'listening') return
    sendMessage(wsRef.current, { type: 'text_message', text })
    setInputValue('')
    setKidsState('sending')
  }, [inputValue, kidsState])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') handleSubmit()
    },
    [handleSubmit],
  )

  // Mic stop: send mic_stop to backend and enter sending state so the
  // button stays disabled until the next teacher_turn_end arrives.
  const handleMicStop = useCallback(() => {
    stopRecording('child_tap')
    setKidsState('sending')
  }, [stopRecording])

  const handleExit = useCallback(() => {
    stopAudioPlayback()
    wsRef.current?.close(1000, 'user_exit')
    navigate('/kids')
  }, [navigate])

  // ── Render ──────────────────────────────────────────────────────────────────

  const isInputEnabled = kidsState === 'listening'

  return (
    <>
      <style>{CSS}</style>
      <div className="kc-page">

        {/* Top bar */}
        <div className="kc-topbar">
          <span className="kc-topbar-brand">🌟 Mentium Kids</span>
          <button
            className="kc-topbar-exit"
            onClick={() => setShowExitModal(true)}
            aria-label="Exit lesson"
          >
            Exit
          </button>
        </div>

        {/* Exit guard */}
        {showExitModal && (
          <KidsExitGuard
            onConfirm={handleExit}
            onCancel={() => setShowExitModal(false)}
          />
        )}

        {/* Connecting */}
        {(kidsState === 'connecting') && (
          <div className="kc-center">
            <div className="kc-spinner" />
            <p className="kc-conn-label">Getting your lesson ready…</p>
          </div>
        )}

        {/* Ready — waiting for user gesture to prime audio */}
        {kidsState === 'ready' && (
          <div className="kc-ready-wrap">
            <div className="kc-ready-avatar">🦁</div>
            <h1 className="kc-ready-title">Your teacher is here!</h1>
            <p className="kc-ready-sub">Tap the button below to start your English lesson.</p>
            <button className="kc-btn kc-btn--start" onClick={() => { void handleStartLesson() }}>
              Let&apos;s Go! 🚀
            </button>
          </div>
        )}

        {/* Active lesson */}
        {(kidsState === 'teaching' || kidsState === 'listening' || kidsState === 'sending') && (
          <>
            <div className="kc-main">
              {/* Exercise context card — shown once exercise starts */}
              {exerciseCtx && (
                <div className="kec-card">
                  <div className="kec-header">
                    <span className="kec-num">Exercise {exerciseCtx.exerciseNumber}</span>
                    <span className="kec-progress">
                      {exerciseCtx.completedCount}/{exerciseCtx.totalExercises}
                    </span>
                  </div>
                  <p className="kec-instruction">{exerciseCtx.instruction}</p>
                  {exerciseCtx.choices.length > 0 ? (
                    <div className="kec-choices">
                      {exerciseCtx.choices.map(c => (
                        <span key={c.choiceId} className="kec-choice">{c.text}</span>
                      ))}
                    </div>
                  ) : exerciseCtx.targetWords.length > 0 ? (
                    <div className="kec-words">
                      {exerciseCtx.targetWords.map(w => (
                        <span key={w} className="kec-word">{w}</span>
                      ))}
                    </div>
                  ) : null}
                </div>
              )}

              <KidsTeacherBubble
                text={teacherText}
                isTyping={kidsState === 'sending'}
              />

              <KidsProgressDots count={progressCount} />

              {voiceUnavailable && (
                <p style={{ fontSize: 12, color: '#94A3B8', margin: 0, textAlign: 'center' }}>
                  Voice is temporarily unavailable. You can continue.
                </p>
              )}

              <KidsAudioIndicator state={kidsState} />
            </div>

            <div className="kc-bottom">
              <div className="kc-voice-row">
                {/* Big mic button — primary answer method for kids */}
                <KidsMicButton
                  micState={micState}
                  kidsState={kidsState}
                  onStart={() => { void startRecording() }}
                  onStop={handleMicStop}
                />

                {/* Divider shown only when text fallback is available */}
                {micAvailable && (
                  <div className="kc-divider">or type</div>
                )}

                {/* Text input — always available as fallback */}
                <div className="kc-input-row">
                  <input
                    className="kc-input"
                    type="text"
                    placeholder={isInputEnabled ? 'Type your answer…' : ''}
                    value={inputValue}
                    onChange={e => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={!isInputEnabled}
                    autoComplete="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    aria-label="Your answer"
                  />
                  <button
                    className="kc-btn kc-btn--send"
                    onClick={handleSubmit}
                    disabled={!isInputEnabled || !inputValue.trim()}
                    aria-label="Send answer"
                  >
                    →
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Lesson complete */}
        {kidsState === 'complete' && (
          <KidsLessonComplete
            summary={summary}
            onDone={() => navigate('/kids')}
          />
        )}

        {/* Error */}
        {kidsState === 'error' && (
          <div className="kc-center">
            <p className="kc-error-emoji">😕</p>
            <p className="kc-error-label">Oops! Something went wrong.</p>
            <p className="kc-error-sub">{errorMsg ?? 'One moment, we\'re reconnecting.'}</p>
            <button
              className="kc-btn kc-btn--retry"
              onClick={() => navigate('/kids')}
            >
              Try again
            </button>
          </div>
        )}

      </div>
    </>
  )
}
