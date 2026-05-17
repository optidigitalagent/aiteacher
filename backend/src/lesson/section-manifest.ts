// Section Exercise Manifest — backend-authoritative exercise structure for Focus lessons.
//
// Phase F: AI must NOT infer exercise order, executability, or item content from raw OCR.
// The manifest is the single source of truth for what exercises exist, which are runnable,
// and exactly what items they contain.

export type ManifestRuntimeMode =
  | 'soft_speaking'
  | 'deterministic_sequential'
  | 'unsupported'

export type CompletionBehavior = 'single_response' | 'all_items' | 'skip'

export type UnsupportedReason = 'requires_audio' | 'requires_photo' | 'requires_partner'

export interface ManifestItem {
  text: string             // exact item text shown to student (may include blanks ___)
  correctAnswer: string    // expected fill / full answer
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
  dependsOn?: number          // must not start until exercise N is complete
  completionBehavior: CompletionBehavior
  // Items from adjacent exercises that must never appear in this exercise
  contaminationGuard?: string[]
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

// ── Registry ──────────────────────────────────────────────────────────────────

const MANIFESTS: Record<string, SectionExerciseManifest> = {
  '1.2': SECTION_1_2_MANIFEST,
}

export function getManifestForSection(sectionId: string): SectionExerciseManifest | null {
  return MANIFESTS[sectionId] ?? null
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
      lines.push(`Items (EXACT — use ONLY these, in this order, one per turn):`)
      if (ex.items) {
        ex.items.forEach((item, i) => {
          const answerNote = item.correctAnswer ? ` → fill: "${item.correctAnswer}"` : ''
          lines.push(`  ${i + 1}. "${item.text}"${answerNote}`)
        })
      }
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
