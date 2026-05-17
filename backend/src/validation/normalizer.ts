// ── Normalizer ────────────────────────────────────────────────────────────────
// Deterministic text normalization for answer comparison.
// Never over-normalizes grammar meaning.

export interface NormalizerOptions {
  lowercase?: boolean
  stripPunctuation?: boolean
  normalizeApostrophes?: boolean
  normalizeQuotes?: boolean
  normalizeWhitespace?: boolean
}

const DEFAULT_OPTIONS: Required<NormalizerOptions> = {
  lowercase:            true,
  stripPunctuation:     true,
  normalizeApostrophes: true,
  normalizeQuotes:      true,
  normalizeWhitespace:  true,
}

export function normalize(text: string, options: NormalizerOptions = {}): string {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  let s = text

  // Smart/curly quotes → straight quotes
  if (opts.normalizeQuotes) {
    s = s
      .replace(/[“”]/g, '"')
      .replace(/[‘’ʼ]/g, "'")
  }

  // Apostrophe variants → standard apostrophe
  if (opts.normalizeApostrophes) {
    s = s.replace(/[`ʹʻʼ]/g, "'")
  }

  // Strip punctuation (keep apostrophes mid-word for contractions)
  if (opts.stripPunctuation) {
    s = s.replace(/[.,!?;:()\[\]{}\-"]/g, '')
    // Strip leading/trailing apostrophes but not mid-word ones
    s = s.replace(/^'+|'+$/gm, '')
  }

  // Lowercase
  if (opts.lowercase) {
    s = s.toLowerCase()
  }

  // Normalize whitespace and remove trailing period OCR artifact
  if (opts.normalizeWhitespace) {
    s = s.replace(/\s+/g, ' ').trim()
  }

  // Remove trailing period that OCR / STT sometimes adds
  s = s.replace(/\.\s*$/, '').trim()

  return s
}

// Voice-specific normalization — extra tolerance for STT artifacts
export function normalizeForVoice(text: string): string {
  let s = normalize(text)
  // Remove filler words STT often inserts
  s = s.replace(/\b(um|uh|hmm|like|you know|i mean)\b/g, '').replace(/\s+/g, ' ').trim()
  return s
}

// Strict normalization — used for teacher-answer safety checks (no stripping punctuation that affects grammar)
export function normalizeStrict(text: string): string {
  return normalize(text, {
    lowercase:            true,
    stripPunctuation:     false,
    normalizeApostrophes: true,
    normalizeQuotes:      true,
    normalizeWhitespace:  true,
  })
}
