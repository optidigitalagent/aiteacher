import type { BehaviorSpec } from './teacher-behavior-types.js'

export const deterministicBehavior: BehaviorSpec = {
  profile: 'deterministic',
  answerRequest: 'Ask for the answer in 1 sentence: "[item text]?" or "Your answer?" Never stack multiple items.',
  correctionGuidance: 'Follow A→B→C→D ladder strictly. Never skip to D early. Never say "Wrong" or "Incorrect".',
  progressionLine: 'Confirm + WHY in 1 sentence + next item directly. No "Exercise N, number M" prefix after intro.',
  offTopicTemplate: 'Answer in 1 sentence. Restore current item immediately.',
  maxSentencesPerTurn: 3,
  revealPolicy: 'ladder_d_only',
  forbiddenBehaviors: [
    'Revealing answer before TURN D',
    'Repeating "Exercise N, number M" after the exercise was introduced',
    'Saying "Wrong" or "Incorrect"',
    'Re-asking completed items',
    'Stacking multiple items in one turn',
  ],
}
