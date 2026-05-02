import type { DemoFinalResult } from '../hooks/useDemoSession'

const TOPIC_LABELS: Record<string, string> = {
  music_social:   'music & social life',
  games:          'gaming',
  movies_series:  'movies & series',
  travel:         'travel',
  school_life:    'school & studies',
  future_career:  'future plans',
}

interface Props {
  result:       DemoFinalResult
  interestArea: string
  onNavigate:   () => void
}

export default function DemoResultOverlay({ result, interestArea, onNavigate }: Props) {
  const scoreColor = result.score >= 70 ? '#16a34a' : result.score >= 50 ? '#d97706' : '#ea580c'
  const scoreGrad  = result.score >= 70
    ? 'linear-gradient(90deg,#4ade80,#22c55e)'
    : result.score >= 50
      ? 'linear-gradient(90deg,#fbbf24,#f59e0b)'
      : 'linear-gradient(90deg,#fb923c,#ef4444)'
  const topicName = TOPIC_LABELS[interestArea] ?? 'your interests'

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300,
      background: 'linear-gradient(160deg,#f0eeff 0%,#F5F5F7 40%,#fff5ee 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '40px 16px',
      overflowY: 'auto',
    }}>
      <div style={{ width: '100%', maxWidth: 460 }}>
        <div style={{
          background: 'white', borderRadius: 28,
          boxShadow: '0 32px 80px rgba(0,0,0,0.12)', overflow: 'hidden',
        }}>
          {/* Top accent bar */}
          <div style={{ height: 4, background: 'linear-gradient(90deg,#6E7CFB,#9B8CFF,#a78bfa)' }} />

          <div style={{ padding: '32px 28px' }}>
            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: '#f0fdf4', color: '#16a34a', borderRadius: 99,
                padding: '6px 16px', fontSize: 11, fontWeight: 800,
                textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 20,
              }}>
                ✓ Demo lesson complete
              </div>

              {/* Score + Level */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24, marginBottom: 16 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 52, fontWeight: 900, color: scoreColor, lineHeight: 1 }}>{result.score}</div>
                  <p style={{ fontSize: 11, color: '#94a3b8', margin: '4px 0 0' }}>out of 100</p>
                </div>
                <div style={{ height: 48, width: 1, background: '#e2e8f0' }} />
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 36, fontWeight: 900, color: '#6E7CFB', lineHeight: 1 }}>{result.level}</div>
                  <p style={{ fontSize: 11, color: '#94a3b8', margin: '4px 0 0' }}>English level</p>
                </div>
              </div>

              {/* Score bar */}
              <div style={{ height: 8, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 99,
                  background: scoreGrad,
                  width: `${result.score}%`,
                  transition: 'width 1.2s cubic-bezier(0.4,0,0.2,1)',
                }} />
              </div>
            </div>

            {/* Teacher message */}
            <div style={{
              background: 'linear-gradient(135deg,#f8f7ff,#fff8f4)', borderRadius: 18,
              padding: 16, marginBottom: 20, display: 'flex', gap: 12,
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 11, flexShrink: 0,
                background: 'linear-gradient(135deg,#6E7CFB,#9B8CFF)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', fontSize: 13, fontWeight: 800,
              }}>A</div>
              <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.65, margin: 0 }}>
                {result.teacher_message}
              </p>
            </div>

            {/* Strengths + Areas */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
              <div style={{ background: '#f0fdf4', borderRadius: 18, padding: 14 }}>
                <p style={{ fontSize: 9, fontWeight: 800, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px' }}>
                  Your strengths
                </p>
                {result.strengths.map((s, i) => (
                  <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                    <span style={{ color: '#22c55e', flexShrink: 0, marginTop: 1 }}>✓</span>
                    <span style={{ fontSize: 12, color: '#166534', lineHeight: 1.4 }}>{s}</span>
                  </div>
                ))}
              </div>
              <div style={{ background: '#eff6ff', borderRadius: 18, padding: 14 }}>
                <p style={{ fontSize: 9, fontWeight: 800, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px' }}>
                  Next to work on
                </p>
                {result.areas_to_improve.map((a, i) => (
                  <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                    <span style={{ color: '#60a5fa', flexShrink: 0, marginTop: 1 }}>→</span>
                    <span style={{ fontSize: 12, color: '#1e40af', lineHeight: 1.4 }}>{a}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* CTA */}
            <button
              onClick={onNavigate}
              style={{
                width: '100%', padding: 16, borderRadius: 18, border: 'none',
                background: 'linear-gradient(135deg,#6E7CFB,#9B8CFF)',
                color: 'white', fontSize: 15, fontWeight: 800, cursor: 'pointer',
                boxShadow: '0 8px 28px rgba(110,124,251,0.4)', transition: 'all 0.2s', letterSpacing: '-0.2px',
              }}
            >
              Keep improving with {topicName} →
            </button>
            <p style={{ textAlign: 'center', fontSize: 12, color: '#94a3b8', marginTop: 10 }}>
              Your next lesson is already personalised · cancel anytime
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
