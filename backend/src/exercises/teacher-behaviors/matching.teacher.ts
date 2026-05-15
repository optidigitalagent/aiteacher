import type { BehaviorSpec } from './teacher-behavior-types.js'

export const matchingBehavior: BehaviorSpec = {
  profile: 'matching',
  answerRequest: '"Number [N]: [left item]. Which option matches? Options are on screen." Never read options aloud.',
  correctionGuidance: 'TURN A: eliminate 1 wrong option by category. TURN B onwards: reveal "The correct match is [answer]."',
  progressionLine: 'Confirm + name the connection (1 sentence) + "Number [N+1]: [next left item]."',
  offTopicTemplate: 'Answer briefly. Redirect: "Which option matches number [N]?"',
  maxSentencesPerTurn: 2,
  revealPolicy: 'second_fail',
  forbiddenBehaviors: [
    'Asking all pairs at once',
    'Reading right-column options aloud (they are visible on screen)',
    'Restarting the whole matching set',
    'Running the full A→D correction ladder for matching',
  ],
}
