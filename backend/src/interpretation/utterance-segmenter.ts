// ── Utterance Segmenter ───────────────────────────────────────────────────────
// Splits a raw transcript into meaningful sentence-level chunks.
// Uses sentence boundaries (.!?) to detect segment edges.
// Returns the raw (pre-normalization) text of each segment.

export function segmentUtterance(rawTranscript: string): string[] {
  const parts = rawTranscript
    .trim()
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 1)

  return parts.length > 0 ? parts : [rawTranscript.trim()]
}
