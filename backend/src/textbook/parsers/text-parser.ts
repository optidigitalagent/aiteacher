// ── Text Parser ────────────────────────────────────────────────────────────────
// Parses plain text or OCR-extracted textbook content into a RawSection.

import { normalizeText } from './normalizer.js'
import { buildRawSection } from '../classifiers/structure-detector.js'
import type { RawSection } from '../types.js'

export interface TextParserConfig {
  sectionId: string
  unitNumber: number
}

export function parseTextbookText(rawText: string, config: TextParserConfig): RawSection {
  const normalized = normalizeText(rawText)
  return buildRawSection(normalized, {
    sectionId:  config.sectionId,
    unitNumber: config.unitNumber,
  })
}
