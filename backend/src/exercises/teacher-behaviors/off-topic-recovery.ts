import type { BehaviorProfile } from './teacher-behavior-types.js'

export function buildOffTopicPhrase(
  profile: BehaviorProfile,
  currentItem: string,
  itemIndex: number,
): string {
  const itemNum = itemIndex + 1
  const snippet = currentItem.length > 0
    ? `"${currentItem.slice(0, 45)}"`
    : `number ${itemNum}`

  switch (profile) {
    case 'deterministic':
      return `Answer in 1 sentence. Then: "Now — ${snippet}. Your answer?"`
    case 'matching':
      return `Answer briefly. Then: "Which option matches number ${itemNum}?"`
    case 'speaking':
      return `Acknowledge briefly. Refocus: "Let's stay on the speaking task."`
    case 'grammar_focus':
      return `Answer briefly. Return: "Let me finish explaining this grammar point."`
    case 'unsupported':
      return ''
  }
}
