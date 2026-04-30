// Inline avatar used inside stage components (not the floating one)
// For the positioned floating avatar, see FloatingAvatar.tsx

type AvatarState = 'speaking' | 'thinking' | 'waiting'

interface AvatarPresenceProps {
  state: AvatarState
  size?: 'sm' | 'md'
}

export function AvatarPresence({ state, size = 'md' }: AvatarPresenceProps) {
  const dim = size === 'sm' ? 'w-8 h-8 text-xs' : 'w-12 h-12 text-sm'

  return (
    <div className={`relative flex-none ${dim}`}>
      {state === 'speaking' && (
        <span className="absolute inset-0 rounded-full border border-cls-accent/40 animate-speak-ring pointer-events-none" />
      )}
      <div className={`
        w-full h-full rounded-full flex items-center justify-center font-semibold
        transition-all duration-300 border
        ${state === 'speaking'
          ? 'bg-cls-accent text-white border-transparent shadow-sm shadow-cls-accent/30'
          : state === 'thinking'
            ? 'bg-amber-50 text-amber-600 border-amber-200'
            : 'bg-gray-100 text-gray-500 border-gray-200'
        }
      `}>
        {state === 'thinking' ? '…' : 'A'}
      </div>
    </div>
  )
}
