import type { TeachingCard } from '../../../hooks/useLesson'

// FUTURE: replace with live teaching card from backend (student_confused event)
export const MOCK_TEACHING_CARD: TeachingCard = {
  cardType: 'grammar_overview',
  displayText: `**Past Simple — Regular Verbs:** Add -ed to the base form. walk → walked, reach → reached, return → returned.

**Past Simple — Irregular Verbs:** These change completely and must be memorised. go → went, take → took, see → saw, give → gave.

**Key rule:** Use Past Simple for completed actions in the past. Always use it with time expressions like yesterday, last week, in 1953, ago.

**Common mistake:** Do NOT add -ed to irregular verbs. "He goed" and "she taked" are both wrong.`,
}

export const MOCK_TEACHING_CARD_MINI: TeachingCard = {
  cardType: 'mini_explanation',
  displayText: `**Question forms with Past Simple:** Use "did" + base verb for all questions (regular and irregular).

**Formula:** Did + subject + base verb + ?

**Example:** "Did Hillary reach the summit?" — NOT "Did Hillary reached?"

The main verb always stays in base form when "did" is present.`,
}
