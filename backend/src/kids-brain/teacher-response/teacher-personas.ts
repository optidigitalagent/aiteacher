/**
 * Teacher Persona definitions — Kids Personalization V2.
 *
 * Lucy: high-energy, exclamatory, enthusiastic warmup style.
 * Tom:  calm, steady, warm warmup style.
 * default: maps to Lucy behavior in all template lookups.
 *
 * WHAT PERSONA CONTROLS: greeting text, praise variant, energy prefix on
 * recovery, warmup opener style, closing text.
 *
 * WHAT PERSONA DOES NOT CONTROL: targetWord, escalation ladder,
 * TTS voice, correctness evaluation, exercise selection, mastery rules.
 */

export interface TeacherPersona {
  id: 'lucy' | 'tom' | 'default'
  displayName: string
  energyLevel: 'HIGH' | 'MEDIUM' | 'LOW'
  praiseStyle: 'EXCLAMATORY' | 'WARM_STEADY'
  warmupStyle: 'ENTHUSIASTIC' | 'CALM'
  recoveryStyle: 'ENERGETIC_CHEER' | 'GENTLE_ENCOURAGE'
  openingPhrase: string
  closingPhrase: string
}

export const LUCY_PERSONA: TeacherPersona = {
  id: 'lucy',
  displayName: 'Lucy',
  energyLevel: 'HIGH',
  praiseStyle: 'EXCLAMATORY',
  warmupStyle: 'ENTHUSIASTIC',
  recoveryStyle: 'ENERGETIC_CHEER',
  openingPhrase: "Hi [childName]! I'm Lucy! Let's learn English — are you ready? Let's GO!",
  closingPhrase: "AMAZING work today, [childName]! You did SO well! See you next time!",
}

export const TOM_PERSONA: TeacherPersona = {
  id: 'tom',
  displayName: 'Tom',
  energyLevel: 'MEDIUM',
  praiseStyle: 'WARM_STEADY',
  warmupStyle: 'CALM',
  recoveryStyle: 'GENTLE_ENCOURAGE',
  openingPhrase: "Hello [childName]! I'm Tom. We're going to learn English today. Ready? Let's start.",
  closingPhrase: "Great work today, [childName]. You should be proud. See you next time.",
}

const DEFAULT_PERSONA: TeacherPersona = {
  ...LUCY_PERSONA,
  id: 'default',
}

/**
 * Returns the teacher persona for the given teacherId.
 * Unknown IDs fall back to Lucy (default) behavior.
 */
export function getTeacherPersona(teacherId: string): TeacherPersona {
  switch (teacherId.toLowerCase()) {
    case 'tom':
      return TOM_PERSONA
    case 'lucy':
      return LUCY_PERSONA
    default:
      return DEFAULT_PERSONA
  }
}
