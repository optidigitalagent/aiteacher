import { MOCK_ENCOURAGEMENT } from '../mock/mockClassroomData'

export type AvatarState = 'speaking' | 'thinking' | 'waiting'

interface FloatingAvatarProps {
  state: AvatarState
}

// FUTURE: replace SVG with <img src={teacherAvatarUrl} /> from backend teacher profile
// FUTURE: switch to <video> when state === 'speaking' for lip-sync animation
function TeacherPortrait() {
  return (
    <svg viewBox="0 0 200 260" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto block">
      <defs>
        {/* Soft lavender radial bg */}
        <radialGradient id="bgGrad" cx="50%" cy="38%" r="62%">
          <stop offset="0%" stopColor="#EEE8FF"/>
          <stop offset="100%" stopColor="#D8D2F0"/>
        </radialGradient>
        {/* Skin warmth */}
        <radialGradient id="skinGrad" cx="50%" cy="40%" r="55%">
          <stop offset="0%" stopColor="#FCCFA0"/>
          <stop offset="100%" stopColor="#F5C090"/>
        </radialGradient>
      </defs>

      {/* Background */}
      <rect width="200" height="260" fill="url(#bgGrad)"/>

      {/* ── LONG FLOWING HAIR (drawn first so face renders on top) ── */}
      {/* Main hair mass: top + flows down both sides to bottom of frame */}
      <path
        d="M36 100 Q24 60 38 24 Q58 4 100 4 Q142 4 162 24 Q176 60 164 100
           L155 260 Q128 250 100 248 Q72 250 45 260 Z"
        fill="#1C1008"
      />
      {/* Soft inner hairline curve (face is painted on top later) */}
      {/* Hair highlight — center top */}
      <path
        d="M80 8 Q100 5 122 20 Q104 10 100 10 Q96 10 78 20 Q80 8 80 8Z"
        fill="#3A2214" opacity="0.45"
      />

      {/* ── EARS (between hair and face in z-order) ── */}
      <ellipse cx="52" cy="108" rx="6" ry="8" fill="#F0B88A"/>
      <ellipse cx="148" cy="108" rx="6" ry="8" fill="#F0B88A"/>

      {/* ── FACE ── */}
      <ellipse cx="100" cy="100" rx="46" ry="56" fill="url(#skinGrad)"/>

      {/* ── EYEBROWS ── */}
      <path d="M72 73 Q82 69.5 92 71.5" stroke="#1C1008" strokeWidth="2.2" strokeLinecap="round" fill="none"/>
      <path d="M108 71.5 Q118 69.5 128 73" stroke="#1C1008" strokeWidth="2.2" strokeLinecap="round" fill="none"/>

      {/* ── EYES ── */}
      {/* Eye whites */}
      <ellipse cx="84" cy="88" rx="12" ry="9" fill="white"/>
      <ellipse cx="116" cy="88" rx="12" ry="9" fill="white"/>
      {/* Irises — warm dark brown */}
      <circle cx="84" cy="89" r="7.5" fill="#3E2510"/>
      <circle cx="116" cy="89" r="7.5" fill="#3E2510"/>
      {/* Pupils */}
      <circle cx="84" cy="89" r="4.5" fill="#120900"/>
      <circle cx="116" cy="89" r="4.5" fill="#120900"/>
      {/* Upper lash line */}
      <path d="M72 82 Q84 78.5 96 82" stroke="#1C1008" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
      <path d="M104 82 Q116 78.5 128 82" stroke="#1C1008" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
      {/* Eye shine */}
      <circle cx="88" cy="85" r="2.5" fill="white" opacity="0.95"/>
      <circle cx="120" cy="85" r="2.5" fill="white" opacity="0.95"/>
      {/* Small lower lashes */}
      <path d="M73 94 Q84 97 95 94" stroke="#1C1008" strokeWidth="0.7" strokeLinecap="round" fill="none" opacity="0.3"/>
      <path d="M105 94 Q116 97 127 94" stroke="#1C1008" strokeWidth="0.7" strokeLinecap="round" fill="none" opacity="0.3"/>

      {/* ── NOSE ── */}
      <path d="M100 104 L97 114 Q100 116.5 103 114 L100 104Z" fill="#D4906A" opacity="0.3"/>
      <path d="M92 113 Q98 118 100 117 Q102 118 108 113" stroke="#D4906A" strokeWidth="1.2" fill="none" opacity="0.35"/>

      {/* ── MOUTH ── */}
      <path d="M85 132 Q93 140 100 139 Q107 140 115 132" stroke="#C07848" strokeWidth="2.2" fill="none" strokeLinecap="round"/>
      {/* Upper lip line */}
      <path d="M88 132 Q96 128 100 129 Q104 128 112 132" stroke="#C07848" strokeWidth="1" fill="none" strokeLinecap="round" opacity="0.5"/>
      {/* Subtle cheek blush */}
      <ellipse cx="72" cy="122" rx="12" ry="7" fill="#FFB8A0" opacity="0.12"/>
      <ellipse cx="128" cy="122" rx="12" ry="7" fill="#FFB8A0" opacity="0.12"/>

      {/* ── NECK ── */}
      <path d="M82 152 Q100 146 118 152 L116 174 Q100 178 84 174Z" fill="#F2B890"/>

      {/* ── CLOTHING — light professional top ── */}
      <path d="M10 260 Q22 228 60 214 L84 174 Q100 178 116 174 L140 214 Q178 228 190 260Z" fill="#ECEAF8"/>
      {/* V-neck detail */}
      <path d="M84 174 Q100 178 116 174 L110 195 L100 185 L90 195 Z" fill="#E0DEFF"/>
    </svg>
  )
}

function Waveform() {
  return (
    <div className="flex items-center gap-[3px]">
      {[0, 1, 2, 3, 4].map(i => (
        <div
          key={i}
          className="w-[3px] bg-emerald-500 rounded-full animate-pulse-bar origin-bottom"
          style={{ height: '14px', animationDelay: `${i * 0.13}s` }}
        />
      ))}
    </div>
  )
}

// Left sidebar — fixed in layout column, no floating or repositioning
export function FloatingAvatar({ state }: FloatingAvatarProps) {
  const isSpeaking = state === 'speaking'
  const isThinking = state === 'thinking'

  return (
    <aside className="w-52 flex-none flex flex-col bg-white border-r border-[rgba(0,0,0,0.06)] z-20 overflow-hidden">

      {/* Teacher portrait — fills column width, aspect ~4:5 */}
      <div className={`
        relative flex-none overflow-hidden transition-all duration-500
        ${isSpeaking ? 'shadow-[0_0_0_3px_rgba(61,85,201,0.25)_inset]' : ''}
      `}>
        <TeacherPortrait />

        {/* Speaking pulse ring overlay */}
        {isSpeaking && (
          <div className="absolute inset-0 pointer-events-none">
            <span className="absolute inset-0 animate-speak-ring border-2 border-cls-accent/30 rounded-none" />
          </div>
        )}
      </div>

      {/* Teacher info + status — padded section */}
      <div className="flex flex-col gap-2.5 px-4 pt-3 pb-3 flex-1 min-h-0">

        {/* Name + role */}
        <div>
          <p className="text-sm font-semibold text-gray-900 leading-tight">Sophie</p>
          <p className="text-[11px] text-gray-400 mt-0.5">English Teacher</p>
        </div>

        {/* Status pill — only shown when actively speaking or thinking */}
        {isSpeaking && (
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-full px-3 py-1.5 self-start shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse flex-none" />
            <span className="text-[11px] font-medium text-emerald-700">Speaking...</span>
            <Waveform />
          </div>
        )}

        {isThinking && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-full px-3 py-1.5 self-start shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse flex-none" />
            <span className="text-[11px] font-medium text-amber-700">Thinking…</span>
          </div>
        )}

        {/* Encouragement card — pinned to bottom */}
        {/* FUTURE: replace with AI-generated encouragement from backend lesson events */}
        <div className="mt-auto bg-white rounded-xl p-3 border border-gray-100 shadow-sm">
          <p className="text-[11px] font-semibold text-gray-700">{MOCK_ENCOURAGEMENT.message}</p>
          <p className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">{MOCK_ENCOURAGEMENT.sub}</p>
        </div>
      </div>
    </aside>
  )
}
