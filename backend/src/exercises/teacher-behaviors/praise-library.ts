const CORRECT_PHRASES: readonly string[] = [
  'Good.', 'Right.', 'Correct.', 'Exactly.', 'Nice.', "That's it.", 'Well done.', 'Much better.',
]

const AFTER_CORRECTION_PHRASES: readonly string[] = [
  'Better.', "That's right.", 'Good — you got it.', 'Exactly — well done.',
]

export function selectPraise(itemIndex: number): string {
  return CORRECT_PHRASES[itemIndex % CORRECT_PHRASES.length] ?? 'Good.'
}

export function selectCorrectionPraise(itemIndex: number): string {
  return AFTER_CORRECTION_PHRASES[itemIndex % AFTER_CORRECTION_PHRASES.length] ?? 'Better.'
}
