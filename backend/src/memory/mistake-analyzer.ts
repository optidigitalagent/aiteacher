// ── Mistake Analyzer — Derives structured mistake types from validation context ──
// Deterministic, no AI calls.

import type { MistakeCategory } from './types.js'

// Phase 3B: Deterministic mistake category derivation from bounded signals.
// No AI calls. Heuristics only — used for logging, not for correctness decisions.
export function deriveMistakeCategory(params: {
  exerciseType: string
  skillTag: string
  retryCount: number
  answerShapeIssue: boolean
  score: number
}): MistakeCategory {
  const { exerciseType, skillTag, retryCount, answerShapeIssue, score } = params

  if (answerShapeIssue) return 'answer_shape'
  if (retryCount >= 3) return 'repeated_failure'

  const SOFT_TYPES = new Set([
    'discussion', 'speaking_prompt', 'pair_speaking', 'roleplay',
    'soft_speaking', 'personal_fill', 'show_interest_agree_disagree',
  ])
  if (SOFT_TYPES.has(exerciseType) && score < 0.3) return 'too_short'

  // Skill-tag heuristics — skillFocus is a short bounded string from ExerciseMeta
  const skill = skillTag.toLowerCase()
  if (/tense|past|present|future|perfect|continuous/.test(skill)) return 'tense'
  if (/auxiliary|modal|do.*does|have.*has/.test(skill)) return 'auxiliary_verb'
  if (/order|structure|inversion/.test(skill)) return 'word_order'
  if (/agreement|subject.*verb/.test(skill)) return 'subject_verb_agreement'
  if (/vocab|colloc|phrasal|idiom/.test(skill)) return 'vocabulary_choice'

  // Exercise type fallback
  switch (exerciseType) {
    case 'sentence_transformation':
    case 'form_transformation':
    case 'rewrite_sentence':
      return 'word_order'
    case 'grammar_focus_fill':
    case 'grammar_drill':
    case 'fill_in_the_gap':
    case 'fill_gap':
    case 'complete_correct_form':
      return 'tense'
    case 'translation':
    case 'vocabulary_fill_gap':
    case 'collocations_fill':
    case 'choose_from_box':
      return 'vocabulary_choice'
    default:
      return 'unknown'
  }
}

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
