import type { SlideBlock, SectionCard } from '../../../hooks/useLesson'

function GrammarBlock({ block }: { block: SlideBlock }) {
  return (
    <div className="flex flex-col gap-1 py-3 border-b border-gray-100 last:border-0">
      <div className="flex items-baseline gap-3 flex-wrap">
        <span className="text-xs font-semibold text-cls-accent uppercase tracking-wide w-28 shrink-0">
          {block.label}
        </span>
        {block.form && (
          <code className="text-xs bg-gray-50 text-gray-800 border border-gray-200 px-2 py-0.5 rounded-md font-mono">
            {block.form}
          </code>
        )}
      </div>
      {block.example && (
        <p className="text-xs text-gray-500 italic pl-[7.5rem]">
          e.g. &quot;{block.example}&quot;
        </p>
      )}
    </div>
  )
}

export function SectionCardView({ card }: { card: SectionCard }) {
  return (
    <div className="rounded-2xl border border-[rgba(0,0,0,0.07)] bg-white shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
        <h3 className="text-sm font-semibold text-gray-900">{card.title}</h3>
      </div>
      <div className="px-5 py-2">
        {card.blocks.map((b, i) => <GrammarBlock key={i} block={b} />)}
      </div>
      {card.commonMistake && (
        <div className="mx-5 mb-4 text-xs bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-gray-700">
          <span className="text-red-600 font-semibold">Common mistake: </span>
          {card.commonMistake}
        </div>
      )}
    </div>
  )
}
