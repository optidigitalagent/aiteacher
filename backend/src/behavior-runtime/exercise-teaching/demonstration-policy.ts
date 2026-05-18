// Demonstration Policy Runtime — determines whether and how to demonstrate an exercise.
//
// Rules (from DEMONSTRATION_PROTOCOL.md doctrine):
//   1. First encounter of a type → full demonstration required
//   2. Repeat encounter of same type → brief reminder only
//   3. Never demonstrate when mid-exercise (itemIndex > 0 or correctionTurn set)
//   4. Demonstration example must be DIFFERENT from item 1
//   5. Maximum one example — never three

import { getDemonstrationPolicy, getTeacherInstructionPolicy } from './exercise-format-registry.js'

export type DemoDecision = 'full_demo' | 'brief_reminder' | 'no_demo'

export interface DemoContext {
  decision:    DemoDecision
  instruction: string  // Context block to inject into prompt
}

export interface DemoInput {
  exerciseType:       string
  itemIndex:          number
  correctionTurn:     string | null
  completedItemCount: number
  isFirstEncounter:   boolean  // Caller determines: has this type been demonstrated before?
  runtimeMode:        string
}

export function determineDemoContext(input: DemoInput): DemoContext {
  const { exerciseType, itemIndex, correctionTurn, completedItemCount, isFirstEncounter } = input

  // Never demo mid-exercise
  if (correctionTurn !== null || itemIndex > 0 || completedItemCount > 0) {
    return { decision: 'no_demo', instruction: '' }
  }

  // Never demo unsupported exercises
  if (input.runtimeMode === 'skipped' || input.runtimeMode === 'future_listening_mode' ||
      input.runtimeMode === 'future_reading_mode' || input.runtimeMode === 'future_writing_mode') {
    return { decision: 'no_demo', instruction: '' }
  }

  const demoPolicy    = getDemonstrationPolicy(exerciseType)
  const instrPolicy   = getTeacherInstructionPolicy(exerciseType)

  // Policy says no demonstration needed for this type
  if (!demoPolicy.required) {
    if (isFirstEncounter) {
      return buildBriefIntroContext(exerciseType, instrPolicy.openingTemplate)
    }
    return { decision: 'no_demo', instruction: '' }
  }

  if (isFirstEncounter) {
    return buildFullDemoContext(exerciseType, instrPolicy)
  }

  return buildBriefReminderContext(exerciseType, instrPolicy.briefRepeatReminder)
}

function buildFullDemoContext(
  exerciseType: string,
  instrPolicy: ReturnType<typeof getTeacherInstructionPolicy>,
): DemoContext {
  const demoPolicy = getDemonstrationPolicy(exerciseType)
  const lines: string[] = [
    '── DEMONSTRATION REQUIRED (first encounter of this exercise type) ──',
    'Structure: [1] Exercise name + instruction | [2] One example (DIFFERENT item) | [3] Return to item 1',
    '',
    `Example script: ${instrPolicy.exampleScript}`,
    `Answer format: ${instrPolicy.answerFormatSpec}`,
    '',
    '⚠ DEMONSTRATION RULES:',
    `• ${demoPolicy.exampleRule}`,
    `• Maximum ${demoPolicy.maxExamples} example — never more.`,
    ...demoPolicy.antiPatterns.map(p => `• FORBIDDEN: ${p}`),
  ]
  return {
    decision: 'full_demo',
    instruction: lines.join('\n'),
  }
}

function buildBriefReminderContext(exerciseType: string, reminder: string): DemoContext {
  return {
    decision: 'brief_reminder',
    instruction: [
      '── BRIEF REMINDER (student has seen this exercise type before) ──',
      `Say: "${reminder}" — then immediately present item 1.`,
      'Do NOT give a full demonstration again.',
    ].join('\n'),
  }
}

function buildBriefIntroContext(exerciseType: string, openingTemplate: string): DemoContext {
  return {
    decision: 'brief_reminder',
    instruction: [
      '── FORMAT INTRO (no full demo needed for this type) ──',
      `Opening: "${openingTemplate}"`,
      'Both columns/options are visible — do not read them aloud.',
    ].join('\n'),
  }
}
