// ── Text Normalizer ────────────────────────────────────────────────────────────
// Normalizes raw textbook text before parsing.
// Handles OCR artifacts, encoding inconsistencies, whitespace, blanks.

// Character-level OCR corrections (order matters)
const CHAR_CORRECTIONS: Array<[RegExp, string]> = [
  [/\r\n/g,          '\n'],    // CRLF → LF
  [/\r/g,            '\n'],    // lone CR → LF
  [/\t/g,            ' '],     // tab → space
  [/ /g,        ' '],     // non-breaking space
  [/–/g,        '-'],     // en dash
  [/—/g,        '-'],     // em dash
  [/‘|’/g, "'"],     // smart single quotes
  [/“|”/g, '"'],     // smart double quotes
  [/…/g,        '...'],   // ellipsis character
  [/ {3,}/g,         '  '],    // 3+ spaces → 2
]

// Blank normalization — standardize all gap markers to ___
const BLANK_PATTERNS: Array<[RegExp, string]> = [
  [/_{4,}/g,            '___'],   // 4+ underscores → 3
  [/\.{3,}/g,           '___'],   // 3+ dots → ___
  [/\([ ]{2,}\)/g,      '___'],   // (   ) → ___
  [/\[[ ]{2,}\]/g,      '___'],   // [   ] → ___
  [/\( *\? *\)/g,       '___'],   // (?) → ___
]

export function normalizeText(raw: string): string {
  let text = raw

  for (const [pattern, replacement] of CHAR_CORRECTIONS) {
    text = text.replace(pattern, replacement)
  }

  // Remove isolated page numbers (line = only digits)
  text = text.replace(/^\s*\d{1,3}\s*$/gm, '')

  // Remove textbook header/footer noise
  text = text.replace(/^FOCUS\s+\S+.*$/gim, '')
  text = text.replace(/^Unit\s+\d+\s*$/gim, '')

  // Collapse 3+ blank lines to 2
  text = text.replace(/\n{3,}/g, '\n\n')

  return text.trim()
}

export function normalizeBlanks(text: string): string {
  let result = text
  for (const [pattern, replacement] of BLANK_PATTERNS) {
    result = result.replace(pattern, replacement)
  }
  return result
}

export function normalizeInstruction(raw: string): string {
  // Strip leading exercise number prefix
  let clean = raw.replace(/^(\d{1,2}[a-b]?\.?\s+)/, '').trim()
  // Strip "Exercise N" / "Ex. N" prefix
  clean = clean.replace(/^[Ee]x(?:ercise)?\.?\s+\d+\.?\s*/, '').trim()
  // Ensure terminal punctuation
  if (clean && !/[.?!]$/.test(clean)) clean += '.'
  return clean
}

export function stripLeadingNumber(text: string): { number: number | null; text: string } {
  // Handles: "1.", "1 ", "1a.", "1b:", "2a: ..."
  const m = text.match(/^(\d{1,2})[a-b]?[.:\s]\s*(.*)$/)
  if (m) {
    const n = parseInt(m[1]!, 10)
    if (n >= 1 && n <= 50) return { number: n, text: m[2]!.trim() }
  }
  return { number: null, text: text.trim() }
}
