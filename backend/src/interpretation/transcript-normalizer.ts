// ── Transcript Normalizer ─────────────────────────────────────────────────────
// Prepares raw STT output for clause/slot analysis.
// Preserves raw transcript — returns a separate normalized form.
// Does NOT modify the raw transcript itself.

export function normalizeTranscript(raw: string): string {
  let s = raw

  // Smart/curly quotes → straight
  s = s.replace(/[""]/g, '"').replace(/[''ʼ]/g, "'")
  // Apostrophe variants → standard
  s = s.replace(/[`ʹʻʼ]/g, "'")

  // Lowercase for comparison
  s = s.toLowerCase()

  // Deduplicate consecutive repeated words (stutter artifacts: "my my dad" → "my dad")
  s = s.replace(/\b(\w+)\s+\1\b/g, '$1')

  // Remove punctuation artifacts that do not bound sentences
  s = s.replace(/[,;:()\[\]{}"]/g, ' ')

  // Normalize whitespace
  s = s.replace(/\s+/g, ' ').trim()

  // Strip trailing period STT artifact (but not sentence-boundary periods)
  s = s.replace(/\.\s*$/, '').trim()

  return s
}

// For single-token comparison: strip all punctuation including apostrophes
export function normalizeToken(token: string): string {
  return token
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim()
}
