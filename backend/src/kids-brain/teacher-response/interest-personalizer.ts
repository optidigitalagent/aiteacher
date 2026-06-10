/**
 * Light interest personalization for ENCOURAGEMENT and RECOVERY teacher tiers.
 *
 * SAFETY CONTRACT — interests may only affect the optional suffix returned here.
 * They must NEVER influence:
 *   - targetWord / acceptedAnswers / completionRule
 *   - curriculum progression or exercise selection
 *   - escalation ladders or validation logic
 *
 * The returned string is always a short, non-conditional suffix such as:
 *   "Just like in Roblox!"   or   "Space explorers say it loud!"
 * Return null when no relevant interest maps or interests array is empty.
 */

/** Maps each interest tag to a short contextual phrase. */
const INTEREST_CONTEXT_MAP: Readonly<Record<string, string>> = {
  roblox:      'Just like in Roblox!',
  brawl_stars: 'Brawl Stars players say it!',
  minecraft:   'Minecraft builders know this!',
  pokemon:     'Pokemon trainers say it!',
  football:    'Football players know it!',
  animals:     'Animals love this word!',
  cars:        'Race car drivers say it!',
  space:       'Space explorers say it loud!',
  dinosaurs:   'Dinosaurs roar this word!',
  superheroes: 'Superheroes say it!',
  princesses:  'Princesses love this word!',
  drawing:     'Artists draw this!',
}

/**
 * Returns a short personalization suffix based on the child's interests,
 * or null if no suffix applies.
 *
 * Pure function — no side effects, no async, always fast.
 * Called only in ENCOURAGEMENT and RECOVERY tiers; never in exercise logic.
 */
export function buildPersonalizedContext(interests: string[]): string | null {
  if (!interests || interests.length === 0) return null
  for (const tag of interests) {
    const phrase = INTEREST_CONTEXT_MAP[tag]
    if (phrase) return phrase
  }
  return null
}
