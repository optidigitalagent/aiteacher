// Section Exercise Manifest — backend-authoritative exercise structure for Focus lessons.
//
// Phase F: AI must NOT infer exercise order, executability, or item content from raw OCR.
// The manifest is the single source of truth for what exercises exist, which are runnable,
// and exactly what items they contain.
//
// JSON overlay: parsed manifests in backend/data/manifests/{sectionId}.json take precedence
// over hardcoded manifests below. Use `npm run parse-textbook` to generate them.

import fs   from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename    = fileURLToPath(import.meta.url)
const __dirname     = path.dirname(__filename)
const MANIFESTS_DIR = path.resolve(__dirname, '../../data/manifests')

export type ManifestRuntimeMode =
  | 'soft_speaking'
  | 'deterministic_sequential'
  | 'text_reading_sequential'
  | 'unsupported'

export type CompletionBehavior = 'single_response' | 'all_items' | 'skip'

export type UnsupportedReason = 'requires_audio' | 'requires_photo' | 'requires_partner'

export interface ManifestItem {
  text: string             // exact item text shown to student (may include blanks ___)
  correctAnswer: string    // expected fill / full answer
}

export interface ManifestTextBlock {
  id: string
  title?: string
  speaker?: string
  text: string
}

export interface ManifestPromptCard {
  id: string
  prompt: string
  helperText?: string
}

export interface ManifestStatement {
  id: string
  text: string
}

export interface ExerciseManifestEntry {
  num: number
  type: string
  executable: boolean
  unsupportedReason?: UnsupportedReason
  runtimeMode: ManifestRuntimeMode
  instruction: string
  allowedPrompt?: string      // discussion: one prompt to ask student
  items?: ManifestItem[]      // deterministic: exact ordered items
  options?: string[]          // visible word box or sentence options (gapped_text, phrase_classification)
  wordBox?: string[]          // alias for options — phrase classification word bank
  dependsOn?: number          // must not start until exercise N is complete
  completionBehavior: CompletionBehavior
  // Items from adjacent exercises that must never appear in this exercise
  contaminationGuard?: string[]
  // Visible payload — content that must be shown on student screen
  readingText?: string             // full reading passage
  textBlocks?: ManifestTextBlock[] // structured article/comment blocks
  promptCards?: ManifestPromptCard[] // discussion/speaking task cards
  statements?: ManifestStatement[] // agree/disagree or opinion statements
}

export interface SectionExerciseManifest {
  section: string
  unit: number
  exercises: ExerciseManifestEntry[]
}

// ── Section 1.2: Present tenses — question forms ──────────────────────────────

const SECTION_1_2_MANIFEST: SectionExerciseManifest = {
  section: '1.2',
  unit: 1,
  exercises: [
    {
      num: 1,
      type: 'discussion',
      executable: true,
      runtimeMode: 'soft_speaking',
      instruction: 'In pairs, discuss who your role models are. Think about business people, sports stars, entertainers, and people you know.',
      allowedPrompt: 'Tell me who inspires you and why.',
      completionBehavior: 'single_response',
    },
    {
      num: 2,
      type: 'listening_matching',
      executable: false,
      unsupportedReason: 'requires_audio',
      runtimeMode: 'unsupported',
      instruction: 'Match questions 1–8 with answers a–h. Then listen and check.',
      completionBehavior: 'skip',
      // These 8 questions belong ONLY to Exercise 2 and must never appear in Exercise 3
      contaminationGuard: [
        'Who inspires you?',
        'What does he do?',
        'Why do you admire him?',
        'Does he give any money to charity?',
        'Which charities does he give money to?',
        'Have you ever met him?',
        'What is he doing now?',
        'Are you similar to him in any way?',
      ],
    },
    {
      num: 3,
      type: 'grammar_focus_fill',
      executable: true,
      runtimeMode: 'deterministic_sequential',
      instruction: 'Read the GRAMMAR FOCUS. Then complete the examples. Look at the questions in blue in Exercise 2.',
      items: [
        { text: 'Why ___ you admire him?', correctAnswer: 'do' },
        { text: 'What ___ he doing now?', correctAnswer: 'is' },
        { text: '___ you ever met him?', correctAnswer: 'Have' },
      ],
      completionBehavior: 'all_items',
      // Must not use ANY of Exercise 2's questions as items
      contaminationGuard: [
        'Does he give any money to charity?',
        'Which charities does he give money to?',
        'Who inspires you?',
        'What does he do?',
      ],
    },
    {
      num: 4,
      type: 'listening_gap',
      executable: false,
      unsupportedReason: 'requires_audio',
      runtimeMode: 'unsupported',
      instruction: 'Complete the questions for the interview about Aung San Suu Kyi. Then listen and check.',
      completionBehavior: 'skip',
      // These partial questions belong only to Exercise 4 — must not appear in Exercise 5
      contaminationGuard: [
        'Who ___? The person who inspires me is Aung San Suu Kyi.',
        'Who ___? She\'s the Burmese Nobel Peace laureate.',
        'Why ___? I admire her',
        'What ___? She believes in non-violent action.',
        'Have ___? No, I haven\'t seen her',
        'What ___? She\'s working for peace',
      ],
    },
    {
      num: 5,
      type: 'grammar_drill',
      executable: true,
      runtimeMode: 'deterministic_sequential',
      instruction: 'Complete the questions about the subject (a) and about the object (b) of each sentence.',
      items: [
        { text: '1a: Viv enjoys swimming. Who enjoys swimming?', correctAnswer: 'Who enjoys swimming?' },
        { text: '1b: Viv enjoys swimming. What does Viv enjoy?', correctAnswer: 'What does Viv enjoy?' },
        { text: '2a: Neil has tried Japanese food. Who ___?', correctAnswer: 'Who has tried Japanese food?' },
        { text: '2b: Neil has tried Japanese food. What ___?', correctAnswer: 'What has Neil tried?' },
        { text: '3a: Rosie can speak three languages. Who ___?', correctAnswer: 'Who can speak three languages?' },
        { text: '3b: Rosie can speak three languages. How many languages ___?', correctAnswer: 'How many languages can Rosie speak?' },
        { text: '4a: Dave has visited London. Who ___?', correctAnswer: 'Who has visited London?' },
        { text: '4b: Dave has visited London. Which capital city ___?', correctAnswer: 'Which capital city has Dave visited?' },
        { text: '5a: Tom is thinking about food. Who ___?', correctAnswer: 'Who is thinking about food?' },
        { text: '5b: Tom is thinking about food. What ___?', correctAnswer: 'What is Tom thinking about?' },
      ],
      completionBehavior: 'all_items',
    },
    {
      num: 6,
      type: 'personal_fill',
      executable: true,
      runtimeMode: 'soft_speaking',
      instruction: 'Complete the sentences to make them true for you.',
      items: [
        { text: "I'm reading ___ at the moment.", correctAnswer: '' },
        { text: 'I spend most money on ___.', correctAnswer: '' },
        { text: 'It takes me ___ minutes to get to school.', correctAnswer: '' },
        { text: 'I go shopping for clothes ___ a year.', correctAnswer: '' },
        { text: 'I usually have lunch with ___.', correctAnswer: '' },
        { text: '___ inspires me.', correctAnswer: '' },
      ],
      completionBehavior: 'all_items',
    },
    {
      num: 7,
      type: 'pair_speaking',
      executable: true,
      runtimeMode: 'soft_speaking',
      instruction: 'In pairs, ask and answer questions about the information in Exercise 6. Use different question words.',
      allowedPrompt: 'Ask me questions about what you said in Exercise 6. Use question words like what, where, who.',
      dependsOn: 6,
      completionBehavior: 'single_response',
    },
  ],
}

// ── Section 6.1: Vocabulary — Future Plans ────────────────────────────────────
// Content sourced from focus-content.ts Unit 6 keyVocabulary, collocations, phrasalVerbs.
// Words: prediction, ambition, career, opportunity, generation, artificial intelligence, decade.

const SECTION_6_1_MANIFEST: SectionExerciseManifest = {
  section: '6.1',
  unit: 6,
  exercises: [
    {
      num: 1,
      type: 'vocabulary_fill_gap',
      executable: true,
      runtimeMode: 'deterministic_sequential',
      instruction: 'Complete the sentences with the correct word from the unit vocabulary.',
      items: [
        { text: 'His ___ about electric cars came true.', correctAnswer: 'prediction' },
        { text: 'Her ___ is to become a doctor.', correctAnswer: 'ambition' },
        { text: 'He wants a ___ in technology.', correctAnswer: 'career' },
        { text: 'Study hard and ___ will come.', correctAnswer: 'opportunities' },
        { text: 'Our ___ grew up with smartphones.', correctAnswer: 'generation' },
        { text: '___ is changing medicine.', correctAnswer: 'Artificial intelligence' },
        { text: 'Technology changed dramatically in the last ___.', correctAnswer: 'decade' },
      ],
      completionBehavior: 'all_items',
    },
    {
      num: 2,
      type: 'collocations_fill',
      executable: true,
      runtimeMode: 'deterministic_sequential',
      instruction: 'Complete the sentences with the correct verb or word to form a collocation.',
      items: [
        { text: 'Experts ___ a prediction that robots will replace many jobs.', correctAnswer: 'make' },
        { text: 'She has ___ to study at a top university.', correctAnswer: 'ambitions' },
        { text: 'He decided to ___ a career in artificial intelligence.', correctAnswer: 'pursue' },
        { text: "Don't hesitate — ___ this opportunity now.", correctAnswer: 'seize' },
        { text: 'The ___ generation will grow up with AI everywhere.', correctAnswer: 'next' },
      ],
      completionBehavior: 'all_items',
    },
    {
      num: 3,
      type: 'speaking_prompt',
      executable: true,
      runtimeMode: 'soft_speaking',
      instruction: 'Talk about your future plans, career and ambitions using the vocabulary from this section.',
      allowedPrompt: 'Tell me about your future plans or career ambitions. Try to use words like prediction, ambition, career, opportunity, generation.',
      completionBehavior: 'single_response',
    },
  ],
}

// ── Section 1.4: Reading — Teenage stereotypes (gapped text) ─────────────────
// Content sourced from focus_lessons.json section "1.4" OCR text.
// Exercise 1: phrase classification (phrases in box → Parents say / Teenagers say)
// Exercise 3: gapped text (choose sentences A-F for gaps 1-5)
// Exercise 4: read and write names (who thinks what)
// Exercise 5: matching (match question fragments 1-5 with a-e)
// Exercise 6: find opposites in Sarah's comment
// Exercise 7: complete sentences with adjectives
// Exercise 8: discussion

// Shared reading text blocks — used by exercises 2, 3, 4, and 6
const SECTION_1_4_TEXT_BLOCKS: ManifestTextBlock[] = [
  {
    id: 'survey_intro',
    title: 'Survey Report: What are teenagers really like?',
    text: 'A recent survey shows that there are reasons why teenagers behave badly. The study suggests that teenagers need to sleep more and that is why sixty-five percent of parents say their teenagers are bad-tempered, uncommunicative and lazy.\n\nThe report also shows that most teenagers are obsessed with their phones. They spend more time chatting online or playing computer games than doing homework. Most parents also say that their teenage children are selfish and unhelpful. Only a few of them help with housework at home.',
  },
  {
    id: 'sarah_comment',
    speaker: 'Sarah',
    text: '[1] _____ Most of us are adorable, cheerful, very hard-working, interesting, brave, generous, loyal, helpful and very good cooks. Oh, and very modest!',
  },
  {
    id: 'mel_comment',
    speaker: 'Mel, 15',
    text: "[2] _____ It's my friends. We love each other. We don't argue or fight. We go to the park after school and we sit under a tree, eat ice cream and talk about guys. We like cooking and camping, not just texting and computer games. I don't have time to read much, but I play the guitar and sing. I'm not a bad-tempered monster — I (usually) apologise when I'm wrong and I like spending time with my grandparents.",
  },
  {
    id: 'andrew_comment',
    speaker: 'Andrew, 17',
    text: "[3] _____ I get up at 6.30 a.m. every school day and I work hard all day. I never make plans to meet friends in the evening — that's when I do my homework. I think I need about nine and a half hours sleep a night, but I usually get only seven hours. So I'm sometimes a bit grumpy like my parents!",
  },
  {
    id: 'ryan_comment',
    speaker: 'Ryan, 16',
    text: "[4] _____ Not all teenagers are the same. Some of us are lazy, some of us aren't. Some of us like chatting online or playing computer games, but some of us prefer to play football or go for a run. OK, some of the things people say about teenagers are true. For example, music is really, really important to us, but we like different kinds of music. We are INDIVIDUALS!",
  },
  {
    id: 'fifth_comment',
    speaker: '(unnamed commenter)',
    text: "[5] _____ I care about other people. I'm interested in the world. I want to travel and learn about other cultures. Then I want to get a job in a developing country. Most of my friends are like me! Where did you find your information? It's wrong!",
  },
]

// Exercise 7 sentences reused as statements for Exercise 8 discussion
const SECTION_1_4_EX7_STATEMENTS: ManifestStatement[] = [
  { id: 's1', text: 'Teenagers are arrogant. They think they know everything.' },
  { id: 's2', text: 'Teenagers are grumpy. They never get enough sleep and are always in a bad mood.' },
  { id: 's3', text: 'Teenagers are loyal to their friends. They are always there for their friends.' },
  { id: 's4', text: 'Teenagers are mean. They never give money to charity and always buy cheap presents.' },
  { id: 's5', text: 'Teenagers are interesting. They have lots of things to talk about.' },
  { id: 's6', text: 'Teenagers are cowardly. They avoid dangerous situations and don\'t take risks.' },
]

const SECTION_1_4_MANIFEST: SectionExerciseManifest = {
  section: '1.4',
  unit: 1,
  exercises: [
    {
      num: 1,
      type: 'phrase_classification',
      executable: true,
      runtimeMode: 'text_reading_sequential',
      instruction: 'Look at the phrases in the box. Decide whether each phrase is something parents say about teenagers, or something teenagers say about themselves.',
      options: ['Parents say', 'Teenagers say'],
      items: [
        { text: 'able to get up early',       correctAnswer: 'Teenagers say' },
        { text: 'generous',                   correctAnswer: 'Teenagers say' },
        { text: 'hard-working',               correctAnswer: 'Teenagers say' },
        { text: 'interested in the world',    correctAnswer: 'Teenagers say' },
        { text: 'loyal to their friends',     correctAnswer: 'Teenagers say' },
        { text: 'obsessed with their phones', correctAnswer: 'Parents say' },
        { text: 'passionate about music',     correctAnswer: 'Teenagers say' },
        { text: 'uncommunicative',            correctAnswer: 'Parents say' },
        { text: 'lazy',                       correctAnswer: 'Parents say' },
        { text: 'selfish',                    correctAnswer: 'Parents say' },
        { text: 'unhelpful',                  correctAnswer: 'Parents say' },
      ],
      completionBehavior: 'all_items',
    },
    {
      num: 2,
      type: 'discussion',
      executable: true,
      runtimeMode: 'soft_speaking',
      instruction: 'Read the survey report and the comments from the teenagers. Compare your ideas from Exercise 1 with what you read.',
      allowedPrompt: 'After reading — were your predictions correct? Which ideas matched what the teenagers said?',
      dependsOn: 1,
      completionBehavior: 'single_response',
      textBlocks: SECTION_1_4_TEXT_BLOCKS,
      promptCards: [
        {
          id: 'ex2_prompt',
          prompt: 'After reading — were your predictions correct? Which ideas matched what the teenagers said?',
          helperText: 'Think about the phrases from Exercise 1.',
        },
      ],
    },
    {
      num: 3,
      type: 'gapped_text',
      executable: true,
      runtimeMode: 'text_reading_sequential',
      instruction: 'Read the comments again. Choose from sentences A-F the one which fits each gap (1-5). There is one extra sentence.',
      options: [
        'A: Teenagers are definitely not lazy.',
        "B: We don't have time to tidy our rooms.",
        'C: Why are people so negative about teenagers?',
        "D: I don't think I'm selfish.",
        'E: I hate stereotypes.',
        'F: The most important thing in my life is not my phone.',
      ],
      items: [
        { text: 'Gap 1 — first sentence of Sarah\'s comment', correctAnswer: '' },
        { text: 'Gap 2 — first sentence of Mel\'s comment', correctAnswer: '' },
        { text: 'Gap 3 — first sentence of Andrew\'s comment', correctAnswer: '' },
        { text: 'Gap 4 — first sentence of Ryan\'s comment', correctAnswer: '' },
        { text: 'Gap 5 — first sentence of the fifth comment', correctAnswer: '' },
      ],
      completionBehavior: 'all_items',
      textBlocks: SECTION_1_4_TEXT_BLOCKS,
    },
    {
      num: 4,
      type: 'read_and_write_names',
      executable: true,
      runtimeMode: 'text_reading_sequential',
      instruction: 'Read the comments again and say the name. Who thinks that...',
      items: [
        { text: 'teenagers work really hard?',                              correctAnswer: 'Andrew' },
        { text: 'teenagers have lots of positive personal qualities?',      correctAnswer: 'Sarah' },
        { text: 'teenagers are interested in other people and cultures?',   correctAnswer: '' },
        { text: 'teenagers are all different people?',                      correctAnswer: 'Ryan' },
        { text: 'friends are very important for teenagers?',                correctAnswer: 'Mel' },
      ],
      completionBehavior: 'all_items',
      textBlocks: SECTION_1_4_TEXT_BLOCKS,
    },
    {
      num: 5,
      type: 'matching',
      executable: true,
      runtimeMode: 'deterministic_sequential',
      instruction: 'Match 1-5 with a-e to make complete questions about the teenagers in the text.',
      items: [
        { text: '1: Who likes spending ___ / a: his homework in the evening? / b: football? / c: time with her grandparents? / d: a job in a developing country? / e: time to read much?', correctAnswer: 'c' },
        { text: '2: Who wants to get ___', correctAnswer: 'd' },
        { text: '3: Who doesn\'t have ___', correctAnswer: 'e' },
        { text: '4: Who does ___', correctAnswer: 'a' },
        { text: '5: Who thinks some teenagers play ___', correctAnswer: 'b' },
      ],
      completionBehavior: 'all_items',
    },
    {
      num: 6,
      type: 'find_opposites',
      executable: true,
      runtimeMode: 'deterministic_sequential',
      instruction: 'Find the opposites of these adjectives in Sarah\'s comment in the text.',
      items: [
        { text: 'arrogant →',  correctAnswer: 'modest' },
        { text: 'cowardly →',  correctAnswer: 'brave' },
        { text: 'disloyal →',  correctAnswer: 'loyal' },
        { text: 'dull →',      correctAnswer: 'interesting' },
        { text: 'grumpy →',    correctAnswer: 'cheerful' },
        { text: 'mean →',      correctAnswer: 'generous' },
      ],
      completionBehavior: 'all_items',
      readingText: "Sarah's comment: Most of us are adorable, cheerful, very hard-working, interesting, brave, generous, loyal, helpful and very good cooks. Oh, and very modest!",
    },
    {
      num: 7,
      type: 'choose_from_box',
      executable: true,
      runtimeMode: 'deterministic_sequential',
      instruction: 'Complete the sentences with adjectives from Exercise 6. Use the adjectives: arrogant, grumpy, loyal, mean, interesting, cowardly.',
      options: ['arrogant', 'grumpy', 'loyal', 'mean', 'interesting', 'cowardly'],
      items: [
        { text: 'Teenagers are ___. They think they know everything.',                            correctAnswer: 'arrogant' },
        { text: 'Teenagers are ___. They never get enough sleep and are always in a bad mood.',   correctAnswer: 'grumpy' },
        { text: 'Teenagers are ___ to their friends. They are always there for their friends.',   correctAnswer: 'loyal' },
        { text: 'Teenagers are ___. They never give money to charity and always buy cheap presents.', correctAnswer: 'mean' },
        { text: 'Teenagers are ___. They have lots of things to talk about.',                     correctAnswer: 'interesting' },
        { text: 'Teenagers are ___. They avoid dangerous situations and don\'t take risks.',      correctAnswer: 'cowardly' },
      ],
      completionBehavior: 'all_items',
    },
    {
      num: 8,
      type: 'discussion',
      executable: true,
      runtimeMode: 'soft_speaking',
      instruction: 'Discuss the sentences from Exercise 7. Which ones do you agree or disagree with? Why?',
      allowedPrompt: 'Which of those sentences about teenagers do you agree with? Which do you disagree with? Tell me why.',
      dependsOn: 7,
      completionBehavior: 'single_response',
      statements: SECTION_1_4_EX7_STATEMENTS,
      promptCards: [
        {
          id: 'ex8_prompt',
          prompt: 'Which of these sentences do you agree with? Which do you disagree with? Why?',
          helperText: 'You can use: "I agree that..." / "I don\'t think..." / "I think it depends..."',
        },
      ],
    },
  ],
}

// ── Registry ──────────────────────────────────────────────────────────────────

const HARDCODED_MANIFESTS: Record<string, SectionExerciseManifest> = {
  '1.2': SECTION_1_2_MANIFEST,
  '1.4': SECTION_1_4_MANIFEST,
  '6.1': SECTION_6_1_MANIFEST,
}

// JSON overlay: try data/manifests/{sectionId}.json first, fall back to hardcoded.
// Lazy import to avoid circular dep — textbook/ imports section-manifest types only.
export function getManifestForSection(sectionId: string): SectionExerciseManifest | null {
  const normalized   = normalizeSectionId(sectionId)
  const jsonManifest = tryLoadJsonManifest(normalized)
  if (jsonManifest) return jsonManifest
  return HARDCODED_MANIFESTS[normalized] ?? null
}

// Normalize section IDs to the canonical "X.Y" dot format before lookup.
// Supports: "6.1", "unit-6-section-1", "unit6-section1", "6_1", "unit6_section1"
function normalizeSectionId(sectionId: string): string {
  // Already canonical "X.Y"
  if (/^\d+\.\d+$/.test(sectionId)) return sectionId
  // "unit-6-section-1" or "unit6-section1"
  const m1 = sectionId.match(/unit[-_]?(\d+)[-_]section[-_]?(\d+)/i)
  if (m1) return `${m1[1]}.${m1[2]}`
  // "6_1" → "6.1"
  const m2 = sectionId.match(/^(\d+)_(\d+)$/)
  if (m2) return `${m2[1]}.${m2[2]}`
  return sectionId
}

function tryLoadJsonManifest(sectionId: string): SectionExerciseManifest | null {
  try {
    const normalized = normalizeSectionId(sectionId)
    const filename   = normalized.replace(/\./g, '_') + '.json'
    const filepath   = path.join(MANIFESTS_DIR, filename)
    if (!fs.existsSync(filepath)) return null
    const raw = fs.readFileSync(filepath, 'utf-8')
    console.log(`[engine:loader] manifest_lookup_resolved section="${sectionId}" source=json path=${filepath}`)
    return JSON.parse(raw) as SectionExerciseManifest
  } catch {
    return null
  }
}

// Phase G.1: look up a single exercise entry by exercise number.
export function getManifestExerciseEntry(sectionId: string, exerciseNum: number): ExerciseManifestEntry | null {
  const manifest = getManifestForSection(sectionId)
  if (!manifest) return null
  return manifest.exercises.find(e => e.num === exerciseNum) ?? null
}

// ── Prompt block builder ──────────────────────────────────────────────────────
// Produces the authoritative exercise manifest block injected into the system prompt.

export function buildManifestPromptBlock(manifest: SectionExerciseManifest): string {
  const exerciseLines = manifest.exercises.map(ex => formatExerciseEntry(ex))

  return [
    `=== SECTION ${manifest.section} — EXERCISE MANIFEST (backend-authoritative) ===`,
    `This manifest is the SINGLE SOURCE OF TRUTH for exercise structure.`,
    `OVERRIDE: Do NOT infer exercise boundaries, items, or executability from the raw OCR text above.`,
    `RULE 1: AI cannot start an exercise unless it appears in this manifest.`,
    `RULE 2: AI cannot run exercises marked [SKIP].`,
    `RULE 3: AI cannot mix items across exercise boundaries.`,
    `RULE 4: On skip, announce skip + move to next executable exercise in the SAME response.`,
    `RULE 5: After skip, stale current-item anchor is void — do NOT re-anchor to skipped exercise items.`,
    `RULE 6: After ANY exercise is complete (all items done or announced as done), do NOT return to any item from that exercise. Exercise complete = closed forever.`,
    `RULE 7: When student says "next", "let's next", "next exercise", "we have done this" after exercise completion — immediately move to the next exercise. FORBIDDEN: "I'm thinking..." or any item from the completed exercise.`,
    ``,
    ...exerciseLines,
    `=== END MANIFEST ===`,
  ].join('\n')
}

function formatExerciseEntry(ex: ExerciseManifestEntry): string {
  const lines: string[] = []

  if (ex.executable) {
    lines.push(`EXERCISE ${ex.num} [EXECUTABLE — ${ex.type}/${ex.runtimeMode}]`)
    lines.push(`Instruction: "${ex.instruction}"`)

    if (ex.runtimeMode === 'soft_speaking') {
      if (ex.allowedPrompt) {
        lines.push(`Run as ONE prompt: "${ex.allowedPrompt}"`)
        lines.push(`Complete after ONE student response. Do NOT ask follow-up questions.`)
      }
      if (ex.dependsOn !== undefined) {
        lines.push(`DEPENDENCY: Only run after Exercise ${ex.dependsOn} is completed.`)
      }
      if (ex.items && ex.items.length > 0) {
        lines.push(`Items (run in order, one per turn):`)
        ex.items.forEach((item, i) => {
          lines.push(`  ${i + 1}. "${item.text}"`)
        })
      }
    } else if (ex.runtimeMode === 'deterministic_sequential') {
      if (ex.options && ex.options.length > 0) {
        lines.push(`Visible word box / options (shown on student screen — do NOT read all aloud):`)
        ex.options.forEach(opt => lines.push(`  • ${opt}`))
      }
      lines.push(`Items (EXACT — use ONLY these, in this order, one per turn):`)
      if (ex.items) {
        ex.items.forEach((item, i) => {
          const answerNote = item.correctAnswer ? ` → answer: "${item.correctAnswer}"` : ''
          lines.push(`  ${i + 1}. "${item.text}"${answerNote}`)
        })
      }
    } else if (ex.runtimeMode === 'text_reading_sequential') {
      if (ex.options && ex.options.length > 0) {
        lines.push(`VISIBLE OPTIONS (shown on student screen — DO NOT read all aloud, student sees them):`)
        ex.options.forEach(opt => lines.push(`  • ${opt}`))
        lines.push(`RULE: Reference only options visible on screen. NEVER invent additional options.`)
      }
      if (ex.dependsOn !== undefined) {
        lines.push(`DEPENDENCY: Only run after Exercise ${ex.dependsOn} is completed.`)
      }
      lines.push(`Items (one per turn — student reads from their textbook for context):`)
      if (ex.items) {
        ex.items.forEach((item, i) => {
          const answerNote = item.correctAnswer
            ? ` → expected: "${item.correctAnswer}"`
            : ' → teacher confirms answer from textbook'
          lines.push(`  ${i + 1}. "${item.text}"${answerNote}`)
        })
      }
      lines.push(`READING RULE: If student says they cannot see the text or options, say: "This reading exercise is not fully loaded on screen yet, so we cannot do this item safely." Do NOT improvise content.`)
    }

    if (ex.contaminationGuard && ex.contaminationGuard.length > 0) {
      lines.push(`FORBIDDEN items (must NEVER appear in this exercise):`)
      ex.contaminationGuard.slice(0, 4).forEach(item => {
        lines.push(`  ✗ "${item}"`)
      })
    }
  } else {
    lines.push(`EXERCISE ${ex.num} [SKIP — ${ex.unsupportedReason}]`)
    lines.push(`Instruction: "${ex.instruction}"`)
    lines.push(`REQUIRED: Skip before presenting any items.`)
    lines.push(`Announce: "Exercise ${ex.num} needs audio, so we'll skip it."`)
    lines.push(`Then immediately in the SAME response: move to Exercise ${ex.num + 1}.`)
    lines.push(`FORBIDDEN: saying "Number 1: ..." or any item from this exercise.`)
    if (ex.contaminationGuard && ex.contaminationGuard.length > 0) {
      lines.push(`CONTAMINATION GUARD — these items belong here and must NOT appear elsewhere:`)
      ex.contaminationGuard.slice(0, 4).forEach(item => {
        lines.push(`  ✗ "${item}"`)
      })
    }
  }

  return lines.join('\n')
}
