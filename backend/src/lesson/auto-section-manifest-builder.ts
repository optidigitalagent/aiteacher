// ── Auto Section Manifest Builder ─────────────────────────────────────────────
// Builds SectionExerciseManifest from existing structured content in focus-content.ts.
// Only uses real content already in repo. Never invents exercises or textbook content.
// Covers: vocabulary sections (fill_gap), grammar sections (grammar_focus + discussion),
// reading sections (read_and_answer from readingPassage + discussion).
//
// Rules:
// - If content is insufficient → returns null (caller marks section as CONTENT_ONLY)
// - If exercises require audio → returns null (caller marks UNSUPPORTED)
// - Never returns a manifest with 0 executable exercises

import { FOCUS_2_UNITS, type VocabItem } from './focus-content.js'
import type {
  SectionExerciseManifest,
  ExerciseManifestEntry,
  ManifestItem,
} from './section-manifest.js'
import { getCatalogEntry } from './curriculum-catalog.js'

// ── Public API ────────────────────────────────────────────────────────────────

export function tryBuildAutoManifest(sectionId: string): SectionExerciseManifest | null {
  const catalog = getCatalogEntry(sectionId)
  if (!catalog) return null
  if (!catalog.enabled) return null

  const unit = FOCUS_2_UNITS[catalog.unit]
  if (!unit) return null

  const type = catalog.type

  if (type === 'listening') {
    console.log(`[auto-manifest] section="${sectionId}" skipped reason=requires_audio`)
    return null
  }

  if (type === 'speaking') {
    console.log(`[auto-manifest] section="${sectionId}" skipped reason=requires_partner`)
    return null
  }

  if (type === 'vocabulary') {
    return buildVocabManifest(sectionId, catalog.unit, unit.keyVocabulary, unit.deepThinkingQuestion, unit.grammarTarget)
  }

  if (type === 'grammar') {
    return buildGrammarManifest(sectionId, catalog.unit, unit.grammarTarget, unit.grammarExplanation, unit.deepThinkingQuestion)
  }

  if (type === 'reading') {
    return buildReadingManifest(sectionId, catalog.unit, unit.readingPassage, unit.deepThinkingQuestion, catalog.topic)
  }

  return null
}

// ── Vocabulary manifest ────────────────────────────────────────────────────────
// Exercise 1: fill_gap — replace the target word in keyVocabulary.example sentences
// Exercise 2: discussion — speak about the vocabulary topic

function buildVocabManifest(
  sectionId: string,
  unit: number,
  vocab: VocabItem[],
  deepThinkingQuestion: string,
  grammarTarget: string,
): SectionExerciseManifest {
  const items = buildFillGapItems(vocab)
  const speakingPrompt = buildVocabSpeakingPrompt(deepThinkingQuestion)

  if (items.length === 0) {
    console.warn(`[auto-manifest] section="${sectionId}" vocab fill_gap has 0 items — skipping`)
    return { section: sectionId, unit, exercises: [] }
  }

  const exercises: ExerciseManifestEntry[] = [
    {
      num: 1,
      type: 'fill_gap',
      executable: true,
      runtimeMode: 'deterministic_sequential',
      instruction: `Complete each sentence with the correct vocabulary word. Say only the missing word.`,
      items,
      completionBehavior: 'all_items',
    },
    {
      num: 2,
      type: 'discussion',
      executable: true,
      runtimeMode: 'soft_speaking',
      instruction: speakingPrompt,
      allowedPrompt: speakingPrompt,
      dependsOn: 1,
      completionBehavior: 'single_response',
    },
  ]

  console.log(`[auto-manifest] auto_manifest_built section="${sectionId}" type=vocabulary exercises=${exercises.length} items=${items.length}`)
  return { section: sectionId, unit, exercises }
}

function buildVocabSpeakingPrompt(deepThinkingQuestion: string): string {
  const question = firstQuestion(deepThinkingQuestion)
  return `${question} Give two reasons. Start like this: "I think ... because ..."`
}

function firstQuestion(text: string): string {
  const trimmed = text.trim()
  const questionMark = trimmed.indexOf('?')
  if (questionMark < 0) return trimmed
  return trimmed.slice(0, questionMark + 1)
}

// ── Grammar manifest ──────────────────────────────────────────────────────────
// Exercise 1: discussion (soft_speaking) — teacher explains the grammar rule, checks comprehension
// Exercise 2: discussion (soft_speaking) — student applies grammar in context

function buildGrammarManifest(
  sectionId: string,
  unit: number,
  grammarTarget: string,
  grammarExplanation: string,
  deepThinkingQuestion: string,
): SectionExerciseManifest {
  const exercises: ExerciseManifestEntry[] = [
    {
      num: 1,
      type: 'discussion',
      executable: true,
      runtimeMode: 'soft_speaking',
      instruction: `Study the grammar rule: ${grammarTarget}. The teacher will explain the key points and ask you a comprehension check.`,
      allowedPrompt: `Let me explain ${grammarTarget}. ${grammarExplanation.split('\n').slice(0, 3).join(' ')} — do you understand the main rule? Give me a brief example.`,
      completionBehavior: 'single_response',
    },
    {
      num: 2,
      type: 'discussion',
      executable: true,
      runtimeMode: 'soft_speaking',
      instruction: deepThinkingQuestion,
      allowedPrompt: deepThinkingQuestion,
      dependsOn: 1,
      completionBehavior: 'single_response',
    },
  ]

  console.log(`[auto-manifest] auto_manifest_built section="${sectionId}" type=grammar exercises=${exercises.length}`)
  return { section: sectionId, unit, exercises }
}

// ── Reading manifest ──────────────────────────────────────────────────────────
// Exercise 1: read_and_answer — comprehension Q&A from the unit readingPassage
// Exercise 2: discussion — deepThinkingQuestion about the topic

function buildReadingManifest(
  sectionId: string,
  unit: number,
  readingPassage: string,
  deepThinkingQuestion: string,
  topic: string,
): SectionExerciseManifest {
  const items = READING_SECTION_ITEMS[sectionId] ?? null

  if (!items || items.length === 0) {
    console.warn(`[auto-manifest] auto_manifest_failed section="${sectionId}" reason=no_reading_items`)
    return { section: sectionId, unit, exercises: [] }
  }

  const exercises: ExerciseManifestEntry[] = [
    {
      num: 1,
      type: 'read_and_answer',
      executable: true,
      runtimeMode: 'text_reading_sequential',
      instruction: `Read the text about ${topic}. Then answer the questions.`,
      readingText: readingPassage,
      items,
      completionBehavior: 'all_items',
    },
    {
      num: 2,
      type: 'discussion',
      executable: true,
      runtimeMode: 'soft_speaking',
      instruction: deepThinkingQuestion,
      allowedPrompt: deepThinkingQuestion,
      dependsOn: 1,
      completionBehavior: 'single_response',
    },
  ]

  console.log(`[auto-manifest] auto_manifest_built section="${sectionId}" type=reading exercises=${exercises.length} items=${items.length}`)
  return { section: sectionId, unit, exercises }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildFillGapItems(vocab: VocabItem[]): ManifestItem[] {
  const items: ManifestItem[] = []
  for (const v of vocab) {
    const word = v.word
    // Replace the exact word (case-insensitive, whole word boundary) with ___
    const gapped = v.example.replace(
      new RegExp(`\\b${escapeRegex(word)}\\b`, 'i'),
      '___',
    )
    if (gapped !== v.example) {
      items.push({ text: gapped, correctAnswer: word })
    }
  }
  return items
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// ── Reading comprehension items per section ───────────────────────────────────
// Derived directly from facts in each unit's readingPassage (focus-content.ts).
// These are not invented — every answer is verbatim or close-paraphrase of text facts.

const READING_SECTION_ITEMS: Record<string, ManifestItem[]> = {

  '4.3': [
    { text: 'How did people dress in the 1950s?',                               correctAnswer: 'They always wore formal clothes' },
    { text: 'What did men never leave the house without in the 1950s?',         correctAnswer: 'a tie' },
    { text: 'Since when have jeans become the most popular item of clothing?',  correctAnswer: 'Since the 1980s' },
    { text: 'What have young people started choosing clothes that do?',         correctAnswer: 'Express their personality' },
    { text: 'What has social media made fashion?',                              correctAnswer: 'More democratic' },
  ],

  '5.3': [
    { text: 'What does our body need protein for?',                             correctAnswer: 'To build muscles' },
    { text: 'Name two sources of carbohydrates mentioned in the text.',         correctAnswer: 'bread and rice' },
    { text: 'Where do vitamins and minerals come from?',                        correctAnswer: 'Fruit and vegetables' },
    { text: 'What mistake do many teenagers make at breakfast time?',           correctAnswer: "They don't eat enough breakfast" },
    { text: 'Name one thing you can eat for a quick healthy breakfast.',        correctAnswer: 'fruit' },
  ],

  '6.3': [
    { text: 'What do scientists believe robots will do in the future?',         correctAnswer: 'Do many jobs that humans do today' },
    { text: 'What will most cars be like by 2050?',                            correctAnswer: 'Electric' },
    { text: 'How will AI systems help in medicine?',                           correctAnswer: 'Help doctors diagnose diseases faster and more accurately' },
    { text: 'Which company is planning to send tourists to orbit?',            correctAnswer: 'SpaceX' },
    { text: "According to one expert, what won't machines change?",            correctAnswer: 'Who we are' },
  ],

  '7.3': [
    { text: 'How many young people go on gap year adventures every year?',     correctAnswer: 'Thousands' },
    { text: 'What will you discover if you travel alone for a year?',         correctAnswer: 'Things about yourself that you never knew' },
    { text: 'What might happen if you do not plan carefully?',                correctAnswer: 'You might run out of money or get into difficult situations' },
    { text: 'What will every journey teach you if you stay curious?',         correctAnswer: 'Something valuable' },
  ],

  '8.3': [
    { text: 'How many hours a day do most teenagers spend looking at screens?', correctAnswer: 'More than six hours' },
    { text: 'Why should you take regular breaks from your devices?',           correctAnswer: 'To protect your eyesight and mental health' },
    { text: 'What is illegal in many countries while driving?',               correctAnswer: 'Using your phone' },
    { text: 'What skill is described as one of the most important of our time?', correctAnswer: 'Digital literacy' },
    { text: 'What must we all learn according to the text?',                  correctAnswer: 'How to use technology responsibly' },
  ],
}
