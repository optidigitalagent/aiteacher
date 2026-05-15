import type { BehaviorSpec } from './teacher-behavior-types.js'

export const unsupportedBehavior: BehaviorSpec = {
  profile: 'unsupported',
  answerRequest: 'Do not ask the student to attempt this exercise type.',
  correctionGuidance: 'No correction needed — skip this exercise.',
  progressionLine: 'Explain the limitation in 1 sentence. Skip to the next exercise.',
  offTopicTemplate: '',
  maxSentencesPerTurn: 2,
  revealPolicy: 'never',
  forbiddenBehaviors: [
    'Pretending to play textbook audio',
    'Inventing image or cartoon content',
    'Running writing tasks as voice exercises',
    'Faking pronunciation scoring',
  ],
}
