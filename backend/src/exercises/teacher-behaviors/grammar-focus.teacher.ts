import type { BehaviorSpec } from './teacher-behavior-types.js'

export const grammarFocusBehavior: BehaviorSpec = {
  profile: 'grammar_focus',
  answerRequest: 'After brief explanation (max 2 sentences), ask ONE comprehension check question.',
  correctionGuidance: 'If check fails: re-explain KEY part only (1–2 sentences). Ask the same check again. No full A→D ladder.',
  progressionLine: 'After check passes → announce practice exercise immediately. No delay.',
  offTopicTemplate: 'Answer briefly. Return: "Let me finish explaining this grammar point."',
  maxSentencesPerTurn: 3,
  revealPolicy: 'never',
  forbiddenBehaviors: [
    'Lectures longer than 3 sentences — explanation must be concise',
    'Skipping the comprehension check question',
    'Skipping to practice without completing the check',
  ],
}
