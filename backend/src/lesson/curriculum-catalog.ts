// Focus 2 Curriculum Catalog — Phase 7
// Single source of truth for all Focus 2 sections.
// Used by: curriculum-validator, focus-student-book (fallback), lesson-ws, LearningPage.

export type SectionDataQuality =
  | 'ocr'        // Real OCR exercise text in focus_lessons.json (sections 1.1–1.4)
  | 'structured' // Unit-level content from focus-content.ts (units 2–8)
  | 'unavailable' // No usable content (speaking/listening without audio)

export type SectionType =
  | 'vocabulary'
  | 'grammar'
  | 'listening'
  | 'reading'
  | 'speaking'
  | 'use_of_english'

export interface SectionCatalogEntry {
  unit:                 number
  sectionId:            string            // e.g. "1.1", "2.3"
  sectionTitle:         string            // e.g. "Vocabulary", "Grammar"
  topic:                string            // human-readable topic
  type:                 SectionType
  grammarFocus?:        string            // grammar focus if type === 'grammar'
  vocabularyFocus?:     string            // vocabulary theme if type === 'vocabulary'
  estimatedMinutes:     number
  exerciseCountEstimate: number
  dataQuality:          SectionDataQuality
  enabled:              boolean           // false = disabled in UI
}

// Unit titles (mirrors Focus 2 Student Book)
export const UNIT_TITLES: Record<number, string> = {
  1: 'Free Time',
  2: 'People and the Past',
  3: 'Our World',
  4: 'Looking Good',
  5: 'Food and Health',
  6: 'Future Plans',
  7: 'Journey and Adventure',
  8: 'Technology Today',
}

export const FOCUS2_CATALOG: readonly SectionCatalogEntry[] = [

  // ── Unit 1: Free Time ──────────────────────────────────────────────────────
  // Sections 1.1–1.4 have real OCR exercise text in focus_lessons.json
  {
    unit: 1, sectionId: '1.1', sectionTitle: 'Vocabulary',
    topic: 'Free-time activities & hobbies',
    type: 'vocabulary',
    vocabularyFocus: 'Free-time activities; go/play/do patterns; hobby vocabulary',
    estimatedMinutes: 25, exerciseCountEstimate: 6,
    dataQuality: 'ocr', enabled: true,
  },
  {
    unit: 1, sectionId: '1.2', sectionTitle: 'Grammar',
    topic: 'Present tenses — question forms',
    type: 'grammar',
    grammarFocus: 'Present Simple & Continuous question forms; subject/object questions; wh- questions with prepositions',
    estimatedMinutes: 30, exerciseCountEstimate: 8,
    dataQuality: 'ocr', enabled: true,
  },
  {
    unit: 1, sectionId: '1.3', sectionTitle: 'Listening',
    topic: 'Voluntary work — listening comprehension',
    type: 'listening',
    vocabularyFocus: 'Personality adjectives in context; word stress',
    estimatedMinutes: 25, exerciseCountEstimate: 6,
    dataQuality: 'ocr', enabled: true,
  },
  {
    unit: 1, sectionId: '1.4', sectionTitle: 'Reading',
    topic: 'Teenage stereotypes — gapped text',
    type: 'reading',
    estimatedMinutes: 25, exerciseCountEstimate: 5,
    dataQuality: 'ocr', enabled: true,
  },

  // ── Unit 2: People and the Past ────────────────────────────────────────────
  {
    unit: 2, sectionId: '2.1', sectionTitle: 'Vocabulary',
    topic: 'Achievements & historical figures',
    type: 'vocabulary',
    vocabularyFocus: 'Achievement words: discover, invent, overcome, inspire, brilliant',
    estimatedMinutes: 25, exerciseCountEstimate: 6,
    dataQuality: 'structured', enabled: true,
  },
  {
    unit: 2, sectionId: '2.2', sectionTitle: 'Grammar',
    topic: 'Past Simple — regular & irregular verbs',
    type: 'grammar',
    grammarFocus: 'Past Simple: regular -ed forms, irregular verbs (went/came/saw), negatives (didn\'t), questions (Did...?)',
    estimatedMinutes: 35, exerciseCountEstimate: 9,
    dataQuality: 'structured', enabled: true,
  },
  {
    unit: 2, sectionId: '2.3', sectionTitle: 'Reading',
    topic: 'Biography — Marie Curie',
    type: 'reading',
    estimatedMinutes: 25, exerciseCountEstimate: 5,
    dataQuality: 'structured', enabled: true,
  },

  // ── Unit 3: Our World ──────────────────────────────────────────────────────
  {
    unit: 3, sectionId: '3.1', sectionTitle: 'Vocabulary',
    topic: 'Geography & natural wonders',
    type: 'vocabulary',
    vocabularyFocus: 'Geography words: enormous, ancient, remote, landscape, depth, wonder, border',
    estimatedMinutes: 25, exerciseCountEstimate: 6,
    dataQuality: 'structured', enabled: true,
  },
  {
    unit: 3, sectionId: '3.2', sectionTitle: 'Grammar',
    topic: 'Comparatives & Superlatives',
    type: 'grammar',
    grammarFocus: 'Comparatives: -er/more + than; Superlatives: the -est/most; as...as; irregular (good/better/best)',
    estimatedMinutes: 35, exerciseCountEstimate: 9,
    dataQuality: 'structured', enabled: true,
  },
  {
    unit: 3, sectionId: '3.3', sectionTitle: 'Speaking',
    topic: 'Conversation & discussion about places',
    type: 'speaking',
    estimatedMinutes: 30, exerciseCountEstimate: 4,
    dataQuality: 'unavailable', enabled: false,
  },

  // ── Unit 4: Looking Good ───────────────────────────────────────────────────
  {
    unit: 4, sectionId: '4.1', sectionTitle: 'Vocabulary',
    topic: 'Fashion & personal appearance',
    type: 'vocabulary',
    vocabularyFocus: 'Fashion words: trend, style, outfit, fashionable, brand, individual, accessory',
    estimatedMinutes: 25, exerciseCountEstimate: 6,
    dataQuality: 'structured', enabled: true,
  },
  {
    unit: 4, sectionId: '4.2', sectionTitle: 'Grammar',
    topic: 'Present Perfect — experience, news & duration',
    type: 'grammar',
    grammarFocus: 'Present Perfect: have/has + past participle; ever/never; just/already/yet; for/since; contrast with Past Simple',
    estimatedMinutes: 35, exerciseCountEstimate: 9,
    dataQuality: 'structured', enabled: true,
  },
  {
    unit: 4, sectionId: '4.3', sectionTitle: 'Reading',
    topic: 'Fashion history — how clothing changed',
    type: 'reading',
    estimatedMinutes: 25, exerciseCountEstimate: 5,
    dataQuality: 'structured', enabled: true,
  },

  // ── Unit 5: Food and Health ────────────────────────────────────────────────
  {
    unit: 5, sectionId: '5.1', sectionTitle: 'Vocabulary',
    topic: 'Food, nutrition & healthy eating',
    type: 'vocabulary',
    vocabularyFocus: 'Food words: nutrition, ingredient, balanced diet, protein, calorie, fibre, portion',
    estimatedMinutes: 25, exerciseCountEstimate: 6,
    dataQuality: 'structured', enabled: true,
  },
  {
    unit: 5, sectionId: '5.2', sectionTitle: 'Grammar',
    topic: 'Quantifiers — much, many, a lot of',
    type: 'grammar',
    grammarFocus: 'Countable vs uncountable nouns; quantifiers: many/much, a lot of, some/any, a few/a little, no',
    estimatedMinutes: 35, exerciseCountEstimate: 8,
    dataQuality: 'structured', enabled: true,
  },
  {
    unit: 5, sectionId: '5.3', sectionTitle: 'Reading',
    topic: 'Healthy eating — what makes a good meal',
    type: 'reading',
    estimatedMinutes: 25, exerciseCountEstimate: 5,
    dataQuality: 'structured', enabled: true,
  },

  // ── Unit 6: Future Plans ───────────────────────────────────────────────────
  {
    unit: 6, sectionId: '6.1', sectionTitle: 'Vocabulary',
    topic: 'Plans, careers & technology',
    type: 'vocabulary',
    vocabularyFocus: 'Future words: prediction, ambition, career, opportunity, generation, artificial intelligence, decade',
    estimatedMinutes: 25, exerciseCountEstimate: 6,
    dataQuality: 'structured', enabled: true,
  },
  {
    unit: 6, sectionId: '6.2', sectionTitle: 'Grammar',
    topic: 'Future forms — will, going to, arrangement',
    type: 'grammar',
    grammarFocus: 'Future: will (prediction/spontaneous), going to (plan/evidence), Present Continuous (fixed arrangement)',
    estimatedMinutes: 35, exerciseCountEstimate: 9,
    dataQuality: 'structured', enabled: true,
  },
  {
    unit: 6, sectionId: '6.3', sectionTitle: 'Reading',
    topic: 'Future technology predictions',
    type: 'reading',
    estimatedMinutes: 25, exerciseCountEstimate: 5,
    dataQuality: 'structured', enabled: true,
  },

  // ── Unit 7: Journey and Adventure ─────────────────────────────────────────
  {
    unit: 7, sectionId: '7.1', sectionTitle: 'Vocabulary',
    topic: 'Travel & adventure vocabulary',
    type: 'vocabulary',
    vocabularyFocus: 'Travel words: destination, itinerary, adventure, risk, consequence, opportunity, solo',
    estimatedMinutes: 25, exerciseCountEstimate: 6,
    dataQuality: 'structured', enabled: true,
  },
  {
    unit: 7, sectionId: '7.2', sectionTitle: 'Grammar',
    topic: 'First Conditional — real & possible situations',
    type: 'grammar',
    grammarFocus: 'First Conditional: if + Present Simple + will/might/can; no "will" in if-clause; if vs when',
    estimatedMinutes: 35, exerciseCountEstimate: 9,
    dataQuality: 'structured', enabled: true,
  },
  {
    unit: 7, sectionId: '7.3', sectionTitle: 'Reading',
    topic: 'Gap year adventures around the world',
    type: 'reading',
    estimatedMinutes: 25, exerciseCountEstimate: 5,
    dataQuality: 'structured', enabled: true,
  },

  // ── Unit 8: Technology Today ───────────────────────────────────────────────
  {
    unit: 8, sectionId: '8.1', sectionTitle: 'Vocabulary',
    topic: 'Technology & social media vocabulary',
    type: 'vocabulary',
    vocabularyFocus: 'Tech words: privacy, digital, screen time, cyberbullying, device, update, responsible',
    estimatedMinutes: 25, exerciseCountEstimate: 6,
    dataQuality: 'structured', enabled: true,
  },
  {
    unit: 8, sectionId: '8.2', sectionTitle: 'Grammar',
    topic: 'Modal verbs — obligation, advice, prohibition',
    type: 'grammar',
    grammarFocus: 'Modals: should/shouldn\'t (advice); must/mustn\'t (obligation/prohibition); have to/don\'t have to (external obligation)',
    estimatedMinutes: 35, exerciseCountEstimate: 9,
    dataQuality: 'structured', enabled: true,
  },
  {
    unit: 8, sectionId: '8.3', sectionTitle: 'Reading',
    topic: 'Digital responsibility — using technology wisely',
    type: 'reading',
    estimatedMinutes: 25, exerciseCountEstimate: 5,
    dataQuality: 'structured', enabled: true,
  },
]

// ── Lookup helpers ─────────────────────────────────────────────────────────────

export function getCatalogEntry(sectionId: string): SectionCatalogEntry | null {
  return FOCUS2_CATALOG.find(s => s.sectionId === sectionId) ?? null
}

export function getSectionsByUnit(unit: number): SectionCatalogEntry[] {
  return FOCUS2_CATALOG.filter(s => s.unit === unit)
}

export function getAllEnabledSections(): SectionCatalogEntry[] {
  return FOCUS2_CATALOG.filter(s => s.enabled)
}

export function getNextSection(sectionId: string): SectionCatalogEntry | null {
  const idx = FOCUS2_CATALOG.findIndex(s => s.sectionId === sectionId)
  if (idx === -1) return null
  for (let i = idx + 1; i < FOCUS2_CATALOG.length; i++) {
    const entry = FOCUS2_CATALOG[i]
    if (entry && entry.enabled) return entry
  }
  return null
}

export function getSectionDataQuality(sectionId: string): SectionDataQuality {
  return getCatalogEntry(sectionId)?.dataQuality ?? 'unavailable'
}

export function getUnitTitle(unit: number): string {
  return UNIT_TITLES[unit] ?? `Unit ${unit}`
}
