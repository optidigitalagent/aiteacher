// ── Item Extractor ─────────────────────────────────────────────────────────────
// Extracts individual exercise items from the body text of an exercise block.
// Routing is deterministic based on exercise type.

import { normalizeBlanks, stripLeadingNumber } from '../parsers/normalizer.js'
import type { ParsedItem, DetectedExerciseType } from '../types.js'

const OPTION_LETTER_RE = /^[a-d]\)\s+\S/i
const MATCH_LETTER_RE  = /^[a-h]\)\s+\S/i

// ── Router ────────────────────────────────────────────────────────────────────

export function extractItems(bodyRaw: string, exerciseType: DetectedExerciseType): ParsedItem[] {
  if (!bodyRaw.trim()) return []

  const lines = bodyRaw.split('\n').map(l => l.trim()).filter(Boolean)

  switch (exerciseType) {
    case 'multiple_choice':
      return extractMultipleChoiceItems(lines)
    case 'matching':
      return extractMatchingItems(lines)
    case 'discussion':
    case 'pair_speaking':
      return []  // single prompt — no items
    case 'audio_based':
    case 'listening_matching':
    case 'listening_gap':
      return []  // unsupported — no items needed
    default:
      return extractNumberedItems(lines)
  }
}

// ── Numbered items (fill, grammar, sentence transformation, translation) ──────

interface NumberedBuilder {
  num: number
  textLines: string[]
}

function extractNumberedItems(lines: string[]): ParsedItem[] {
  const items: ParsedItem[] = []
  let current: NumberedBuilder | null = null
  let itemIndex = 0

  const flush = () => {
    if (!current) return
    const text = normalizeBlanks(current.textLines.join(' ').trim())
    if (text) items.push({ index: itemIndex++, text, correctAnswer: '' })
    current = null
  }

  for (const line of lines) {
    const { number, text } = stripLeadingNumber(line)
    if (number !== null) {
      flush()
      current = { num: number, textLines: [text] }
    } else if (current) {
      // Sub-item continuation (e.g. "1b: ...") or multi-line item
      current.textLines.push(line)
    }
  }

  flush()
  return items
}

// ── Multiple choice items ─────────────────────────────────────────────────────

interface MCBuilder {
  num: number
  question: string
  options: string[]
}

function extractMultipleChoiceItems(lines: string[]): ParsedItem[] {
  const items: ParsedItem[] = []
  let current: MCBuilder | null = null
  let itemIndex = 0

  const flush = () => {
    if (!current) return
    items.push({
      index:         itemIndex++,
      text:          normalizeBlanks(current.question),
      correctAnswer: '',
      options:       current.options.length ? current.options : undefined,
    })
    current = null
  }

  for (const line of lines) {
    if (OPTION_LETTER_RE.test(line) && current) {
      current.options.push(line.replace(/^[a-d]\)\s+/i, '').trim())
      continue
    }
    const { number, text } = stripLeadingNumber(line)
    if (number !== null) {
      flush()
      current = { num: number, question: text, options: [] }
    } else if (current) {
      current.question += ' ' + line
    }
  }

  flush()
  return items
}

// ── Matching items ────────────────────────────────────────────────────────────

function extractMatchingItems(lines: string[]): ParsedItem[] {
  const left: string[]  = []
  const right: string[] = []

  for (const line of lines) {
    if (MATCH_LETTER_RE.test(line)) {
      right.push(line.replace(/^[a-h]\)\s+/i, '').trim())
    } else {
      const { number, text } = stripLeadingNumber(line)
      if (number !== null) left.push(normalizeBlanks(text))
    }
  }

  return left.map((text, i) => ({
    index:         i,
    text,
    correctAnswer: '',  // answer extractor overlays this from teacher book
    options:       right.length ? right : undefined,
  }))
}
