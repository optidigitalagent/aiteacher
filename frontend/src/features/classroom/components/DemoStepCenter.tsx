import type { CSSProperties } from 'react'
import type { DemoPhase, DemoStepContent } from '../hooks/useDemoSession'

interface Props {
  phase:          DemoPhase
  currentStep:    DemoStepContent | null
  selectedOption: number | null
  onMcqSelect:    (i: number) => void
  submitting:     boolean
  isSpeaking:     boolean
}

const STEP_META: Record<string, { label: string; icon: string; color: string; bg: string; border: string }> = {
  warm_up:       { label: 'Warm-up',  icon: '💬', color: '#6E7CFB', bg: 'linear-gradient(135deg,#ede9ff,#f0f0ff)', border: 'rgba(110,124,251,0.2)' },
  speaking_task: { label: 'Speaking', icon: '🗣',  color: '#16a34a', bg: 'linear-gradient(135deg,#dcfce7,#f0fdf4)', border: 'rgba(34,197,94,0.25)'   },
  writing_task:  { label: 'Writing',  icon: '✏️',  color: '#d97706', bg: 'linear-gradient(135deg,#fff7ed,#fffbeb)', border: 'rgba(217,119,6,0.25)'   },
}

const CARD: CSSProperties = {
  width: '100%',
  background: 'rgba(255,255,255,0.88)',
  borderRadius: 24,
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  padding: '36px 40px',
  boxShadow: '0 2px 0 rgba(255,255,255,1) inset, 0 20px 60px rgba(0,0,0,0.08), 0 40px 80px rgba(110,124,251,0.06)',
  border: '1px solid rgba(255,255,255,0.7)',
  outline: '1px solid rgba(110,124,251,0.06)',
}

const WRAP: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  overflow: 'hidden',
}

export default function DemoStepCenter({ phase, currentStep, selectedOption, onMcqSelect, submitting, isSpeaking }: Props) {
  // Intro phase or no step loaded yet
  if (phase === 'intro' || (phase === 'lesson' && !currentStep)) {
    return (
      <div style={WRAP}>
        <div style={{ ...CARD, maxWidth: 520, textAlign: 'center' }}>
          <div style={{
            width: 52, height: 52, borderRadius: 16, margin: '0 auto 20px',
            background: 'linear-gradient(135deg,#6E7CFB,#9B8CFF)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontSize: 22, fontWeight: 800,
            boxShadow: '0 8px 24px rgba(110,124,251,0.35)',
          }}>A</div>
          <p style={{ fontSize: 17, fontWeight: 800, color: '#1a1a2e', margin: '0 0 8px', letterSpacing: '-0.3px' }}>
            Alex is preparing your lesson
          </p>
          <p style={{ fontSize: 13, color: '#94a3b8', margin: '0 0 20px', lineHeight: 1.6 }}>
            {isSpeaking ? 'Listen to the introduction…' : 'Your first exercise will appear here shortly.'}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 5 }}>
            {[0, 1, 2].map((i) => (
              <span key={i} style={{
                display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
                background: isSpeaking ? '#6E7CFB' : '#d1d5db',
                animation: isSpeaking ? `pulse 1.2s ease-in-out ${i * 0.2}s infinite` : 'none',
              }} />
            ))}
          </div>
          <style>{`@keyframes pulse { 0%,80%,100%{transform:scale(0.7);opacity:0.4} 40%{transform:scale(1);opacity:1} }`}</style>
        </div>
      </div>
    )
  }

  if (!currentStep) return null

  // Grammar MCQ
  if (currentStep.type === 'mcq' && currentStep.options) {
    return (
      <div style={WRAP}>
        <div style={{ ...CARD, maxWidth: 680 }}>
          <div style={{ marginBottom: 20 }}>
            <span style={{
              background: 'linear-gradient(135deg,#ede9ff,#f0f0ff)',
              color: '#6E7CFB', fontSize: 11, fontWeight: 700,
              padding: '4px 12px', borderRadius: 99,
              border: '1px solid rgba(110,124,251,0.2)',
            }}>
              Grammar
            </span>
          </div>

          <p style={{ fontSize: 13, color: '#aaa', fontWeight: 600, margin: '0 0 18px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Complete the sentence
          </p>

          {currentStep.prompt && (
            <div style={{
              background: 'linear-gradient(135deg,rgba(110,124,251,0.06),rgba(155,140,255,0.04))',
              borderRadius: 16, padding: '18px 22px', marginBottom: 28,
              border: '1px solid rgba(110,124,251,0.12)',
            }}>
              <p style={{ fontSize: 22, fontWeight: 700, color: '#1a1a2e', margin: 0, lineHeight: 1.5, letterSpacing: '-0.2px' }}>
                {currentStep.prompt}
              </p>
            </div>
          )}

          <p style={{ fontSize: 12, color: '#aaa', fontWeight: 600, margin: '0 0 12px' }}>
            Tap the correct option:
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {currentStep.options.map((opt, i) => (
              <button
                key={i}
                onClick={() => onMcqSelect(i)}
                disabled={submitting}
                style={{
                  padding: '14px 18px', borderRadius: 14, textAlign: 'left',
                  fontSize: 15, fontWeight: 600,
                  cursor: submitting ? 'default' : 'pointer',
                  transition: 'all 0.15s',
                  background: selectedOption === i
                    ? 'linear-gradient(135deg,#6E7CFB,#9B8CFF)'
                    : 'rgba(245,245,247,0.9)',
                  color:     selectedOption === i ? 'white' : '#374151',
                  border:    selectedOption === i ? 'none'  : '1px solid #e5e7eb',
                  boxShadow: selectedOption === i
                    ? '0 4px 14px rgba(110,124,251,0.35)'
                    : '0 1px 3px rgba(0,0,0,0.04)',
                  transform:  selectedOption === i ? 'scale(1.02)' : 'scale(1)',
                  display:    'flex', alignItems: 'center', gap: 8,
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 800, opacity: selectedOption === i ? 0.8 : 0.5, flexShrink: 0, minWidth: 16 }}>
                  {String.fromCharCode(65 + i)})
                </span>
                {opt}
              </button>
            ))}
          </div>

          {submitting && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16, color: '#9B8CFF', fontSize: 13, fontWeight: 600 }}>
              <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid #9B8CFF', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
              Checking…
            </div>
          )}
        </div>
      </div>
    )
  }

  // Text input steps: warm_up, speaking_task, writing_task
  const meta = STEP_META[currentStep.key] ?? STEP_META.warm_up!

  return (
    <div style={WRAP}>
      <div style={{ ...CARD, maxWidth: 680 }}>
        <div style={{ marginBottom: 22 }}>
          <span style={{
            background: meta.bg, color: meta.color,
            fontSize: 11, fontWeight: 700,
            padding: '4px 12px', borderRadius: 99,
            border: `1px solid ${meta.border}`,
          }}>
            {meta.icon} {meta.label}
          </span>
        </div>

        {currentStep.prompt ? (
          <h2 style={{ fontSize: 24, fontWeight: 800, color: '#1a1a2e', lineHeight: 1.4, margin: '0 0 28px', letterSpacing: '-0.3px' }}>
            {currentStep.prompt}
          </h2>
        ) : (
          <p style={{ fontSize: 16, color: '#94a3b8', margin: '0 0 24px', fontStyle: 'italic' }}>
            Listen to Alex and respond when ready.
          </p>
        )}

        {submitting && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#6E7CFB', fontSize: 13, fontWeight: 600 }}>
            <span style={{ display: 'inline-block', width: 13, height: 13, border: '2px solid #9B8CFF', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
            Alex is reading your answer…
          </div>
        )}
      </div>
    </div>
  )
}
