import type { BehaviorSpec } from './teacher-behavior-types.js'

export const speakingBehavior: BehaviorSpec = {
  profile: 'speaking',
  answerRequest: 'Frame the task as ONE open prompt (max 1 sentence). No items[] to read out. No follow-up questions.',
  correctionGuidance: 'After the student responds: give ONE brief correction note (grammar or vocabulary — max 1 sentence). Then immediately announce exercise complete.',
  progressionLine: 'ONE prompt → ONE student response → ONE brief feedback note → exercise complete. No follow-up questions. No repeating the prompt. No loops.',
  offTopicTemplate: "Acknowledge briefly. Refocus: \"Let's stay on [topic].\"",
  maxSentencesPerTurn: 2,
  revealPolicy: 'never',
  forbiddenBehaviors: [
    '"The correct answer is…" for open speaking tasks',
    'Follow-up questions after the student has responded ("What does he do?", "Why?", "Tell me more")',
    'Applying the A/B/C/D correction ladder — speaking exercises have no single correct answer',
    'Asking the student to repeat or rephrase until exact match',
    'Creating interview flows or asking multiple successive questions on the same topic',
  ],
}
