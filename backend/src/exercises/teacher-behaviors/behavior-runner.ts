import { getExercisePolicy } from '../protocols/index.js'
import type { BehaviorProfile, BehaviorSpec } from './teacher-behavior-types.js'
import { deterministicBehavior } from './deterministic.teacher.js'
import { matchingBehavior } from './matching.teacher.js'
import { speakingBehavior } from './speaking.teacher.js'
import { grammarFocusBehavior } from './grammar-focus.teacher.js'
import { unsupportedBehavior } from './unsupported.teacher.js'
import { selectPraise, selectCorrectionPraise } from './praise-library.js'
import { buildHintGuide } from './hint-library.js'
import { buildOffTopicPhrase } from './off-topic-recovery.js'
import type { CorrectionTurn } from '../../lesson/types.js'

export function selectBehaviorProfile(exerciseType: string): BehaviorProfile {
  const policy = getExercisePolicy(exerciseType)
  switch (policy.runtimeMode) {
    case 'deterministic_sequential': return 'deterministic'
    case 'matching_sequential':      return 'matching'
    case 'soft_speaking':
    case 'warmup_activation':        return 'speaking'
    case 'grammar_explanation':
    case 'teacher_explanation':      return 'grammar_focus'
    default:                         return 'unsupported'
  }
}

function getBehaviorSpec(profile: BehaviorProfile): BehaviorSpec {
  switch (profile) {
    case 'deterministic': return deterministicBehavior
    case 'matching':      return matchingBehavior
    case 'speaking':      return speakingBehavior
    case 'grammar_focus': return grammarFocusBehavior
    case 'unsupported':   return unsupportedBehavior
  }
}

function formatBehaviorBlock(
  exerciseType: string,
  spec: BehaviorSpec,
  praise: string,
  corrPraise: string,
  hintGuide: string,
  offTopic: string,
): string {
  const lines: string[] = [
    `BEHAVIOR [${exerciseType}|${spec.profile}]: praise="${praise}" after-correction="${corrPraise}"`,
    `Correction: ${spec.correctionGuidance}`,
    `Progression: ${spec.progressionLine}`,
  ]
  if (hintGuide) lines.push(hintGuide)
  if (offTopic) lines.push(`Off-topic: ${offTopic}`)
  const forbidden = spec.forbiddenBehaviors.slice(0, 4).join(' | ')
  if (forbidden) lines.push(`Forbidden: ${forbidden}`)
  return lines.join('\n')
}

export function buildBehaviorContext(
  exerciseType: string,
  itemIndex: number,
  correctionTurn: CorrectionTurn | null,
  currentItem: string,
): string {
  const profile = selectBehaviorProfile(exerciseType)
  const spec = getBehaviorSpec(profile)
  const hintGuide = buildHintGuide(profile, correctionTurn)
  const result = formatBehaviorBlock(
    exerciseType, spec,
    selectPraise(itemIndex),
    selectCorrectionPraise(itemIndex),
    hintGuide,
    buildOffTopicPhrase(profile, currentItem, itemIndex),
  )
  console.log(`[teacher] type=${exerciseType} behavior=${profile}`)
  if (hintGuide && correctionTurn) {
    console.log(`[hint] type=${exerciseType} turn=${correctionTurn}`)
  }
  return result
}
