export type BehaviorProfile = 'deterministic' | 'matching' | 'speaking' | 'grammar_focus' | 'unsupported'

export type RevealPolicy = 'ladder_d_only' | 'second_fail' | 'never'

export interface BehaviorSpec {
  readonly profile: BehaviorProfile
  readonly answerRequest: string
  readonly correctionGuidance: string
  readonly progressionLine: string
  readonly offTopicTemplate: string
  readonly maxSentencesPerTurn: number
  readonly revealPolicy: RevealPolicy
  readonly forbiddenBehaviors: readonly string[]
}
