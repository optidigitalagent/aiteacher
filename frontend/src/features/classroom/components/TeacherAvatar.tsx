import type { AvatarState } from '../types'

interface Props { state: AvatarState }

// TODO: when teacher is speaking → render <video src={teacher.speakingVideoUrl} autoPlay loop muted />
// TODO: when teacher is silent  → render <img src={teacher.avatarImageUrl} />
// TODO: teacher shape: { id, name, avatarImageUrl, speakingVideoUrl, voiceId }
// For now: SVG placeholder in all states.

export default function TeacherAvatar({ state }: Props) {
  const glow =
    state === 'listening' ? 'rgba(34,197,94,0.35)'  :
    state === 'speaking'  ? 'rgba(110,124,251,0.4)' :
                            'rgba(155,140,255,0.25)'

  return (
    <div style={{ position: 'relative', width: 80, height: 80, flexShrink: 0 }}>
      {/* Outer glow */}
      <div style={{
        position: 'absolute', inset: -14, borderRadius: '50%',
        background: `radial-gradient(circle, ${glow} 0%, transparent 70%)`,
        animation: 'cls-halo-breathe 3s ease-in-out infinite',
        filter: 'blur(6px)',
      }} />
      {/* Orbit ring */}
      <div style={{
        position: 'absolute', inset: -8, borderRadius: '50%',
        border: '1px dashed rgba(110,124,251,0.2)',
        animation: 'cls-aura-spin 14s linear infinite',
      }} />
      {/* Inner ring */}
      <div style={{
        position: 'absolute', inset: -3, borderRadius: '50%',
        border: '1.5px solid rgba(110,124,251,0.25)',
        animation: 'cls-halo-breathe 3s ease-in-out infinite',
        animationDelay: '0.4s',
      }} />
      {/* Circle + face */}
      <div style={{
        width: 80, height: 80, borderRadius: '50%', overflow: 'hidden',
        background: 'linear-gradient(160deg, #e8e0ff 0%, #f5eeff 50%, #fce7f3 100%)',
        border: '2px solid rgba(255,255,255,0.9)',
        boxShadow: '0 0 0 1px rgba(110,124,251,0.2), 0 12px 32px rgba(110,124,251,0.2)',
        position: 'relative', display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}>
        <svg width="82" height="96" viewBox="0 0 82 96" fill="none" style={{ position: 'absolute', bottom: 0 }}>
          <ellipse cx="41" cy="34" rx="20" ry="23" fill="#f3d9c4" />
          <path d="M21 29 Q23 11 41 10 Q59 11 61 29 Q57 19 41 18 Q25 19 21 29z" fill="#2d1b0e" />
          <path d="M61 29 Q64 37 63 44 Q60 38 58 33z" fill="#2d1b0e" />
          <path d="M21 29 Q18 37 19 44 Q22 38 24 33z" fill="#2d1b0e" />
          <rect x="35" y="55" width="12" height="10" rx="3" fill="#f3d9c4" />
          <path d="M10 96 Q12 68 24 64 Q34 61 41 62 Q48 61 58 64 Q70 68 72 96z" fill="#f8f8ff" />
          <path d="M34 62 Q41 72 48 62" stroke="#e8e4f0" strokeWidth="1.5" fill="none" />
        </svg>
      </div>
    </div>
  )
}
