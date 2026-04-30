export const PHASE_ORDER = [
  'DIAGNOSTIC',
  'CONTEXT_INPUT',
  'RULE_DISCOVERY',
  'EXERCISES',
  'VOCABULARY',
  'DEEP_THINKING',
  'WRAP_UP',
] as const

const PHASE_LABELS: Record<string, string> = {
  DIAGNOSTIC:     'Diagnostic',
  CONTEXT_INPUT:  'Context',
  RULE_DISCOVERY: 'Discovery',
  EXERCISES:      'Exercises',
  VOCABULARY:     'Vocab',
  DEEP_THINKING:  'Thinking',
  WRAP_UP:        'Wrap Up',
}

interface PhaseProgressProps {
  currentPhase: string
}

export function PhaseProgress({ currentPhase }: PhaseProgressProps) {
  const currentIdx = PHASE_ORDER.indexOf(currentPhase as (typeof PHASE_ORDER)[number])

  return (
    <div className="flex items-center gap-1">
      {PHASE_ORDER.map((phase, i) => {
        const isDone   = i < currentIdx
        const isActive = i === currentIdx
        return (
          <div key={phase} className="flex items-center gap-1">
            <div
              title={PHASE_LABELS[phase]}
              className={`rounded-full transition-all duration-300 ${
                isDone   ? 'w-1.5 h-1.5 bg-cls-accent' :
                isActive ? 'w-2 h-2 bg-cls-accent ring-2 ring-cls-accent/25' :
                           'w-1.5 h-1.5 bg-gray-300'
              }`}
            />
            {i < PHASE_ORDER.length - 1 && (
              <div className={`w-2.5 h-px ${isDone ? 'bg-cls-accent/40' : 'bg-gray-200'}`} />
            )}
          </div>
        )
      })}
      <span className="ml-1.5 text-[11px] text-gray-400 font-medium">
        {PHASE_LABELS[currentPhase] ?? currentPhase}
      </span>
    </div>
  )
}
