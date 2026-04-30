import type { TeachingCard } from '../../../hooks/useLesson'

interface TeachingOverlayProps {
  card:      TeachingCard
  onDismiss: () => void
}

// FUTURE: backend may return richer explanation card / slide with visuals
export function TeachingOverlay({ card, onDismiss }: TeachingOverlayProps) {
  const lines = card.displayText.split('\n').filter(Boolean)

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 px-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/20 backdrop-blur-sm"
        onClick={onDismiss}
      />

      {/* Card */}
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-[rgba(0,0,0,0.07)] animate-modal-in overflow-hidden">
        {/* Top accent bar */}
        <div className="h-1 bg-gradient-to-r from-amber-400 to-amber-500" />

        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <circle cx="7" cy="5" r="2" fill="#D97706"/>
                  <path d="M3 12c0-2.21 1.79-4 4-4s4 1.79 4 4" stroke="#D97706" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
              </div>
              <span className="text-xs font-semibold text-amber-700 uppercase tracking-wider">
                {card.cardType === 'mini_explanation' ? 'Explanation' : 'Grammar Overview'}
              </span>
            </div>
            <button
              onClick={onDismiss}
              className="w-7 h-7 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 flex items-center justify-center transition-colors text-sm"
            >
              ✕
            </button>
          </div>

          {/* Content */}
          <div className="space-y-2 mb-6">
            {lines.map((line, i) => {
              const isBoldLine = line.startsWith('**') && line.includes(':**')
              if (isBoldLine) {
                const colonIdx = line.indexOf(':**')
                const key  = line.slice(2, colonIdx)
                const rest = line.slice(colonIdx + 3).trim()
                return (
                  <div key={i} className="py-1 border-b border-gray-100 last:border-0">
                    <span className="text-sm font-semibold text-gray-900">{key}: </span>
                    <span className="text-sm text-gray-600">{rest}</span>
                  </div>
                )
              }
              return (
                <p key={i} className="text-sm text-gray-700 leading-relaxed">{line}</p>
              )
            })}
          </div>

          {/* OK button — primary action */}
          <button
            onClick={onDismiss}
            className="w-full py-2.5 rounded-xl bg-cls-accent text-white text-sm font-medium hover:opacity-90 transition-opacity"
          >
            OK, I understand
          </button>
        </div>
      </div>
    </div>
  )
}
