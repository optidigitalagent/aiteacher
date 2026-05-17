// ── Mistake Analyzer — Derives structured mistake types from validation context ──
// Deterministic, no AI calls.

export function deriveMistakeTypes(
  exerciseType: string,
  isCorrect: boolean,
  retryCount: number,
): string[] {
  if (isCorrect) return []

  const types: string[] = []

  if (retryCount >= 3) types.push('repeated_failure')

  switch (exerciseType) {
    case 'grammar_focus_fill':
    case 'fill_in_the_gap':
      types.push('grammar_gap_fill')
      break
    case 'grammar_drill':
    case 'sentence_transformation':
      types.push('grammar_structure')
      break
    case 'matching':
      types.push('matching_error')
      break
    case 'multiple_choice':
      types.push('multiple_choice_error')
      break
    case 'translation':
      types.push('translation_error')
      break
    case 'discussion':
    case 'pair_speaking':
    case 'personal_fill':
      // soft types — no hard mistake classification
      break
    default:
      types.push('general_error')
  }

  return types
}

export function deriveGrammarWeakness(exerciseType: string, topic?: string): string | null {
  if (topic) return topic

  switch (exerciseType) {
    case 'grammar_focus_fill':     return 'grammar_focus'
    case 'grammar_drill':          return 'grammar_drill'
    case 'sentence_transformation':return 'sentence_structure'
    case 'fill_in_the_gap':        return 'gap_fill'
    default:                       return null
  }
}

// Aggregate mistake counts from events and return top N weaknesses
export function aggregateWeakTopics(
  events: Array<{ exerciseType: string; topic?: string | null; mistakeTypes: string[] }>,
  topN = 5,
): string[] {
  const counts: Record<string, number> = {}

  for (const ev of events) {
    if (ev.mistakeTypes.length === 0) continue
    const key = ev.topic ?? ev.exerciseType
    counts[key] = (counts[key] ?? 0) + 1
  }

  return Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, topN)
    .map(([k]) => k)
}
