import type { TeachingCard } from '../../../hooks/useLesson'

export function TeachingCardView({ card, onDismiss }: { card: TeachingCard; onDismiss: () => void }) {
  const lines = card.displayText.split('\n').filter(Boolean)

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-amber-200">
        <span className="text-xs font-semibold text-amber-700 uppercase tracking-wider">
          {card.cardType === 'mini_explanation' ? 'Explanation' : 'Grammar Overview'}
        </span>
        <button
          onClick={onDismiss}
          className="text-xs text-amber-500 hover:text-amber-700 transition font-medium"
        >
          OK, I understand
        </button>
      </div>
      <div className="px-4 py-3 space-y-1.5">
        {lines.map((line, i) => {
          const isBoldLine = line.startsWith('**') && line.includes(':**')
          if (isBoldLine) {
            const colonIdx = line.indexOf(':**')
            const key  = line.slice(2, colonIdx)
            const rest = line.slice(colonIdx + 3).trim()
            return (
              <div key={i} className="py-0.5">
                <span className="text-xs font-bold text-gray-900">{key}: </span>
                <span className="text-xs text-gray-700">{rest}</span>
              </div>
            )
          }
          return (
            <p key={i} className="text-xs text-gray-700 leading-relaxed">{line}</p>
          )
        })}
      </div>
    </div>
  )
}
