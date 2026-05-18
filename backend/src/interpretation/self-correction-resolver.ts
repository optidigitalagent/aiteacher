// ── Self-Correction Resolver ──────────────────────────────────────────────────
// Detects when a student is correcting themselves mid-answer and extracts
// the intended (final corrected) content for slot analysis.
//
// Examples:
//   "May inspire Oscar. Not may. Me inspire Oscar." → "Me inspire Oscar"
//   "weave. not weave. Viv."                        → "Viv"
//   "ease. not ease. is."                           → "is"
//   "my mum... I mean, my dad inspires me"          → "my dad inspires me"

const I_MEAN_RE = /\bi\s+mean[t]?\s+(.+)$/i

// A correction fragment starts with a negation/apology marker (followed by content or punctuation)
const CORRECTION_FRAGMENT_RE = /^(not\s+\S|sorry\s*$|no\s*,?\s*$)/i

export function hasSelfCorrection(normalized: string): boolean {
  if (/\bi\s+mean[t]?\b/.test(normalized)) return true
  if (/\bnot\s+\w+\b/.test(normalized)) return true
  if (/\bsorry\b/.test(normalized)) return true
  return false
}

export function resolveSelfCorrection(rawTranscript: string, normalized: string): string {
  // "I mean X" explicit correction → extract X
  const iMeanMatch = normalized.match(I_MEAN_RE)
  if (iMeanMatch) return iMeanMatch[1]!.trim()

  // Multi-segment: filter out correction fragments, take last remaining segment
  const segments = rawTranscript
    .trim()
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0)

  if (segments.length >= 2) {
    const nonCorrections = segments.filter(s => !CORRECTION_FRAGMENT_RE.test(s.trim()))
    if (nonCorrections.length > 0) {
      return nonCorrections[nonCorrections.length - 1]!.trim()
    }
  }

  return normalized
}
