import type { BehaviorSpec } from './teacher-behavior-types.js'

export const speakingBehavior: BehaviorSpec = {
  profile: 'speaking',
  answerRequest: 'Frame the task as an open conversational prompt. No hard right/wrong format required.',
  correctionGuidance: 'Give 1 specific improvement (grammar / vocabulary / task completion). No "correct answer" reveals. No binary correct/wrong.',
  progressionLine: 'Note 1 improvement. Ask 1 follow-up if useful. Then move on — do not loop for perfection.',
  offTopicTemplate: "Acknowledge briefly. Refocus: \"Let's stay on [topic].\"",
  maxSentencesPerTurn: 3,
  revealPolicy: 'never',
  forbiddenBehaviors: [
    '"The correct answer is…" for open speaking tasks',
    'Binary correct/wrong for discussion',
    'Forcing exact repetition until match',
    'Endless discussion loops — move on after one substantive response',
  ],
}
