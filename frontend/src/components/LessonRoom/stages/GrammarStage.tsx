import type { SectionCard } from '../../../hooks/useLesson'
import { SectionCardView } from '../cards/SectionCardView'

interface GrammarStageProps {
  sectionCard: SectionCard
}

export function GrammarStage({ sectionCard }: GrammarStageProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 max-w-2xl mx-auto w-full">
      <div className="w-full animate-fade-up">
        <div className="mb-4 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-cls-accent" />
          <span className="text-xs font-semibold text-cls-accent uppercase tracking-widest">
            Grammar Focus
          </span>
        </div>
        <SectionCardView card={sectionCard} />
      </div>
    </div>
  )
}
