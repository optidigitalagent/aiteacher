import type { VoiceState, AvatarState } from '../types'
import TeacherAvatar from './TeacherAvatar'
import { IcSpark } from './icons'

interface Props {
  voiceState: VoiceState
  onExplain: () => void
  teacherName?: string
  teacherAvatarUrl?: string
}

const WAVE_HEIGHTS = [7, 11, 16, 9, 14, 8, 18, 12, 7, 15, 10, 17, 8, 12]

export default function TeacherPanel({ voiceState, onExplain, teacherName = 'Alex', teacherAvatarUrl }: Props) {
  const { isSpeaking, isListening } = voiceState

  const state: AvatarState = isListening ? 'listening' : isSpeaking ? 'speaking' : 'thinking'
  const stateLabel = { listening: 'Listening', speaking: 'Speaking', thinking: 'Thinking' }[state]
  const stateColor = { listening: '#22c55e',   speaking: '#6E7CFB',  thinking: '#9B8CFF'  }[state]
  const avatarGrad = teacherName === 'Emma'
    ? 'linear-gradient(135deg,#FF8C5A,#FFB38C)'
    : 'linear-gradient(135deg,#7B8CFF,#A18BFF)'

  return (
    <div style={{
      width: 170, display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '20px 14px 16px', gap: 10,
      background: 'rgba(255,248,240,0.72)',
      backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
      borderRadius: 22,
      boxShadow: '0 2px 0 rgba(255,255,255,0.9) inset, 0 12px 40px rgba(0,0,0,0.07), 0 2px 8px rgba(110,124,251,0.06)',
      border: '1px solid rgba(255,255,255,0.65)',
      height: '100%', minHeight: 0, overflow: 'hidden', maxHeight: '100%',
    }}>
      {/* Teacher avatar — image if avatarUrl available, else animated placeholder */}
      {teacherAvatarUrl ? (
        <div style={{ position: 'relative', width: 80, height: 80, flexShrink: 0 }}>
          <img
            src={teacherAvatarUrl}
            alt={teacherName}
            style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover',
              boxShadow: '0 4px 16px rgba(0,0,0,0.15)' }}
          />
        </div>
      ) : (
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <TeacherAvatar state={state} />
          {/* Initials overlay for future avatar slot */}
          <div style={{
            position: 'absolute', bottom: -2, right: -2,
            width: 24, height: 24, borderRadius: '50%',
            background: avatarGrad,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 9, fontWeight: 800, color: 'white',
            border: '2px solid white', boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
          }}>
            {teacherName[0].toUpperCase()}
          </div>
        </div>
      )}

      <div style={{ textAlign: 'center' }}>
        <div style={{ fontWeight: 800, fontSize: 17, color: '#1a1a2e', letterSpacing: '-0.3px' }}>{teacherName}</div>
        <div style={{ fontSize: 12, color: '#888', marginTop: 2, fontWeight: 500 }}>AI English Teacher</div>
      </div>

      {/* State badge — TODO: driven by WebSocket voice state from backend */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 7,
        background: `${stateColor}18`,
        border: `1px solid ${stateColor}33`,
        borderRadius: 99, padding: '6px 14px',
        transition: 'all 0.4s ease',
      }}>
        <div style={{
          width: 7, height: 7, borderRadius: '50%', background: stateColor,
          boxShadow: `0 0 7px ${stateColor}`,
          animation: 'cls-halo-breathe 1.5s ease-in-out infinite',
        }} />
        <span style={{ fontSize: 12.5, color: stateColor, fontWeight: 700 }}>{stateLabel}</span>
      </div>

      {/* Waveform */}
      <div style={{ display: 'flex', alignItems: 'center', height: 22, gap: 1.5 }}>
        {WAVE_HEIGHTS.map((h, i) => (
          <span key={i} className="cls-wave-bar" style={{
            animationDelay: `${i * 0.065}s`,
            height: h,
            opacity: isSpeaking || isListening ? 1 : 0.18,
            background: state === 'listening' ? '#22c55e' : '#6E7CFB',
            transition: 'opacity 0.4s, background 0.4s',
          }} />
        ))}
      </div>

      {/* Motivational message — TODO: replace with dynamic message from backend */}
      <div style={{
        background: 'white', borderRadius: 12, padding: '10px 14px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.05)',
        width: '100%', border: '1px solid rgba(110,124,251,0.1)',
      }}>
        <div style={{ fontSize: 13, color: '#555', lineHeight: 1.6, textAlign: 'center', fontWeight: 500 }}>
          Great progress today!<br />You're doing really well.
        </div>
      </div>

      {/* Help card */}
      <div style={{
        width: '100%', background: 'white', borderRadius: 16, padding: '16px',
        boxShadow: '0 6px 24px rgba(110,124,251,0.12)',
        border: '1px solid rgba(110,124,251,0.12)',
      }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: '#1a1a2e', marginBottom: 5 }}>Need help?</div>
        <div style={{ fontSize: 12.5, color: '#888', marginBottom: 12, lineHeight: 1.5 }}>
          I can explain this differently.
        </div>
        {/* TODO: on click → POST /api/lesson/explain → backend returns teaching card overlay */}
        <button onClick={onExplain} style={{
          width: '100%', padding: '10px 0', borderRadius: 11, border: 'none',
          background: 'linear-gradient(135deg, #6E7CFB, #9B8CFF)',
          color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
          boxShadow: '0 6px 20px rgba(110,124,251,0.35)',
          transition: 'transform 0.15s, box-shadow 0.15s',
        }}>
          <IcSpark /> Explain this
        </button>
      </div>
    </div>
  )
}
