// Phase E: Exercise Executability Gate
// Phase E.1: Hidden Answer Source Detection + Speech/Runtime Consistency
//
// Determines whether a textbook exercise can be solved RIGHT NOW using only
// the currently visible runtime information — without guessing, recalling
// audio, or accessing hidden materials.
//
// The question is NOT "Is this exercise educational?"
// The question IS: "Can the student solve this using only visible data?"
// And critically: "Is the ANSWER SOURCE visible?" (not just the question text)
//
// Called from:
//   1. normalizeExerciseState() — enriches ExerciseRuntimeState.isUnsupported
//   2. buildExecutabilitySection() — injects detailed analysis into AI prompt
//   3. claude-handler.ts — post-parse hidden-answer-source block with speech patching

import type { UnsupportedReason } from './teacher-brain.types.js'

// ── Types ─────────────────────────────────────────────────────────────────────

export type ExecutabilityBlockReason =
  | 'requires_audio'              // exercise depends on audio file / recording
  | 'requires_image'              // exercise depends on visual not in context
  | 'requires_hidden_word_bank'   // instruction references word bank but no options given
  | 'requires_hidden_options'     // instruction requires choice but no options given
  | 'items_from_listening_context' // items are comprehension Qs about hidden audio
  | 'requires_written_composition' // long-form writing (incompatible with voice)
  | 'requires_partner_card'       // pairwork with hidden partner B materials
  | 'type_permanently_blocked'    // type is in the hard-blocked list
  | 'hidden_answer_source'        // Phase E.1: answer source not visible (Q&A matching, audio-dependent)
  | 'orphaned_comprehension_items' // Phase E.1: items are comprehension Qs about hidden content

export type TextbookSemanticClass =
  | 'discussion_intro'              // "In pairs discuss..." — standalone, no audio
  | 'warmup'                        // Pre-lesson warmup, open
  | 'listening_block'               // Core audio-required exercise
  | 'listening_followup'            // Comprehension Qs requiring prior audio recall
  | 'listening_followup_matching'   // Phase E.1: matching Q&A where answers come from hidden audio
  | 'grammar_explanation_block'     // Grammar rule/notes (no items to answer)
  | 'grammar_drill'                 // Deterministic: fill, transform, correct
  | 'speaking_prompt_standalone'    // Open speaking — opinion-based, standalone
  | 'hidden_context_comprehension'  // Qs about unseen text/audio
  | 'hidden_answer_source_generic'  // Phase E.1: general hidden answer source (non-audio)
  | 'standalone_executable'         // Self-contained, all data visible
  | 'unsupported_resource_task'     // External file (image/essay/pairwork) required

// Phase E.1: result of detectHiddenAnswerSource() — returned for post-parse checks in claude-handler
export interface HiddenAnswerSourceDecision {
  detected: boolean
  classification: 'listening_followup_matching' | 'orphaned_comprehension_items' | 'hidden_answer_source_generic' | null
  signals: string[]
}

export interface ExecutabilityInput {
  exerciseType: string
  instruction: string
  items: string[]
  options: string[]
  exerciseNumber?: number
  sectionType?: string   // 'Listening' | 'Grammar' | 'Vocabulary' | 'Reading'
}

export interface ExecutabilityDecision {
  executable: boolean
  reason: ExecutabilityBlockReason | null
  classification: TextbookSemanticClass
  confidence: 'high' | 'medium' | 'low'
  blockedSignals: string[]
}

// ── Detection patterns ────────────────────────────────────────────────────────

// Audio dependency in instruction text
const AUDIO_INSTRUCTION_RE =
  /\b(listen|listening|audio|\btrack\b|mp3|play\s+track|recording|you\s+heard|from\s+the\s+(interview|recording|audio)|after\s+listening|interview\s+with)\b/i

// Image/visual dependency in instruction text
const IMAGE_INSTRUCTION_RE =
  /\b(photo|picture|image|photograph|illustration|look\s+at\s+the|describe\s+what\s+you\s+see|in\s+the\s+photo|in\s+the\s+picture)\b/i

// Word bank reference — instruction says "from the box" but no options provided
const WORD_BANK_INSTRUCTION_RE =
  /\b(from\s+the\s+box|from\s+the\s+word\s+bank|word\s+bank|use\s+the\s+words|from\s+the\s+list|in\s+the\s+box|choose\s+from)\b/i

// Hidden context reference in instruction
const CONTEXT_REF_INSTRUCTION_RE =
  /\b(the\s+interview|the\s+text|the\s+article|the\s+recording|the\s+passage|what\s+you\s+heard|what\s+you\s+read|according\s+to|from\s+the\s+reading|from\s+the\s+listening)\b/i

// Written composition indicators
const WRITTEN_COMPOSITION_RE =
  /\b(write\s+(an?\s+)?(essay|email|letter|report|article|blog|paragraph)|compose|draft|write\s+at\s+least\s+\d+\s+words)\b/i

// Pairwork with hidden partner materials
const PAIRWORK_HIDDEN_RE =
  /\b(student\s+a\b|student\s+b\b|partner\s+a\b|partner\s+b\b|file\s+[a-z]\b|swap\s+roles|turn\s+to\s+page)\b/i

// WH-questions about an unspecified 3rd-person subject.
// Signals: items are comprehension questions about a specific person heard in audio.
// "What does he do?" / "What does she study?" / "Where does he live?" etc.
const THIRD_PERSON_WH_RE =
  /^(who|what|when|where|why|how)\s+(does|did|is|was|are|were|has|had)\s+(he|she|they|his|her|the\s+man|the\s+woman|the\s+person)\b/i

// Phase E.1: Matching instruction that signals Q&A from a hidden audio/context source.
// "Match the questions with answers." → answers come from a recording, not visible options.
// This is the critical pattern: visible question text ≠ visible answer source.
const MATCHING_QUESTION_INSTRUCTION_RE =
  /\bmatch\s+(the\s+)?(questions?|interview\s+questions?)\s+(with|to)\s+(answers?|responses?|statements?|what\s+\w+\s+said)\b/i

// Phase E.1: Any WH-question item start (for matching exercise item analysis).
// Used to detect when matching exercise left-side items are questions (implying
// the right-side answers come from a hidden source — audio transcript, etc.).
// Narrower than THIRD_PERSON_WH_RE: catches "Who inspires you?" and "What does she do?"
const QUESTION_ITEM_RE =
  /^(who|what|when|where|why|how|which)\b/i

// Permanently unsupported types (content-agnostic hard block)
const PERMANENTLY_BLOCKED = new Set([
  'listening', 'audio_reconstruction', 'photo_task', 'image_task',
  'hidden_context', 'textbook_reference', 'external_reading',
  'essay_writing', 'email_writing', 'pairwork_hidden', 'hidden_answer_dependent',
])

const SOFT_SPEAKING_TYPES = new Set([
  'speaking_prompt', 'discussion', 'roleplay', 'brainstorm', 'interview',
  'show_interest_agree_disagree', 'show_what_you_know',
  'write_sentences_from_prompts', 'free_production',
])

const DETERMINISTIC_TYPES = new Set([
  'fill_gap', 'error_correction', 'form_transformation',
  'grammar_transform', 'multiple_choice', 'reconstruction',
])

const MATCHING_TYPES = new Set([
  'matching', 'vocabulary_matching', 'collocations', 'find_opposites',
])

const GRAMMAR_TYPES = new Set(['grammar_focus', 'remember_this'])

// Non-executable semantic classifications
const BLOCKED_CLASSES = new Set<TextbookSemanticClass>([
  'listening_block',
  'listening_followup',
  'listening_followup_matching',  // Phase E.1: matching Q&A with hidden audio answers
  'hidden_context_comprehension',
  'hidden_answer_source_generic', // Phase E.1: general hidden answer source
  'unsupported_resource_task',
])

// ── Semantic classification ───────────────────────────────────────────────────

function countThirdPersonComprehensionItems(items: string[]): number {
  return items.filter(item => THIRD_PERSON_WH_RE.test(item.trim())).length
}

function hasContextRefInItems(items: string[]): boolean {
  return items.some(item => CONTEXT_REF_INSTRUCTION_RE.test(item))
}

function classifySemanticType(
  exerciseType: string,
  instruction: string,
  items: string[],
  options: string[],
): TextbookSemanticClass {
  if (PERMANENTLY_BLOCKED.has(exerciseType)) {
    const isAudio = exerciseType === 'listening' || exerciseType === 'audio_reconstruction'
    return isAudio ? 'listening_block' : 'unsupported_resource_task'
  }

  if (AUDIO_INSTRUCTION_RE.test(instruction)) return 'listening_block'
  if (IMAGE_INSTRUCTION_RE.test(instruction)) return 'unsupported_resource_task'
  if (WRITTEN_COMPOSITION_RE.test(instruction)) return 'unsupported_resource_task'
  if (PAIRWORK_HIDDEN_RE.test(instruction)) return 'unsupported_resource_task'
  if (CONTEXT_REF_INSTRUCTION_RE.test(instruction)) return 'hidden_context_comprehension'

  if (GRAMMAR_TYPES.has(exerciseType)) return 'grammar_explanation_block'

  // Soft speaking: deeper check on items for hidden audio dependency.
  // A genuine discussion exercise has ONE open prompt with no items[].
  // If items[] exist AND contain WH-questions about unspecified 3rd-person subjects,
  // those items are comprehension questions about a specific person heard in audio.
  // Example production failure: ["Who inspires you?", "What does he do?"]
  //   → "What does he do?" has an unresolved "he" → audio-dependent.
  // Threshold = 1: even one 3rd-person comprehension item in a soft-speaking exercise
  // is a reliable signal of listening context (false negative risk >> false positive risk).
  if (SOFT_SPEAKING_TYPES.has(exerciseType)) {
    if (items.length === 0) return 'speaking_prompt_standalone'

    const thirdPersonCount = countThirdPersonComprehensionItems(items)
    // Any item with unspecified 3rd-person subject in a multi-item soft-speaking exercise → blocked
    if (thirdPersonCount >= 1 && items.length >= 2) return 'listening_followup'
    // All items match 3rd-person comprehension pattern (e.g. short single-item exercise) → blocked
    if (thirdPersonCount >= 1 && items.length === 1) return 'listening_followup'
    // Items exist but no 3rd-person signal → check for explicit context references
    if (hasContextRefInItems(items)) return 'hidden_context_comprehension'

    return 'speaking_prompt_standalone'
  }

  if (DETERMINISTIC_TYPES.has(exerciseType)) return 'grammar_drill'

  // Phase E.1: Matching exercise — check for hidden answer source BEFORE declaring executable.
  // Critical distinction: visible question text ≠ visible answer source.
  // "Match the questions with answers." → the answers come from a hidden audio/context source,
  // not from visible options. Student sees the questions but cannot know the answers.
  if (MATCHING_TYPES.has(exerciseType)) {
    // Signal 1: instruction explicitly describes a Q&A matching task (audio-dependent answers)
    if (MATCHING_QUESTION_INSTRUCTION_RE.test(instruction)) {
      return 'listening_followup_matching'
    }

    // Signal 2: items are WH-questions AND no visible answer options
    // Standalone matching has answer options (right side of the match).
    // Q&A matching from audio has question items but the ANSWERS are from the recording.
    if (items.length > 0 && options.length === 0) {
      const questionItemCount = items.filter(i => QUESTION_ITEM_RE.test(i.trim())).length
      // More than half the items are WH-questions → not a vocabulary/collocation match
      if (questionItemCount > 0 && questionItemCount / items.length >= 0.5) {
        return 'listening_followup_matching'
      }
      // Third-person comprehension items are an even stronger signal
      const thirdPersonCount = countThirdPersonComprehensionItems(items)
      if (thirdPersonCount >= 1) return 'listening_followup_matching'
    }

    return 'standalone_executable'
  }

  return 'standalone_executable'
}

// ── Block reason resolution ───────────────────────────────────────────────────

function resolveBlockReason(
  classification: TextbookSemanticClass,
  instruction: string,
  options: string[],
): ExecutabilityBlockReason | null {
  switch (classification) {
    case 'listening_block':
    case 'listening_followup':
      return 'requires_audio'
    case 'listening_followup_matching':  // Phase E.1
      return 'hidden_answer_source'
    case 'hidden_answer_source_generic': // Phase E.1
      return 'hidden_answer_source'
    case 'unsupported_resource_task':
      if (IMAGE_INSTRUCTION_RE.test(instruction)) return 'requires_image'
      if (WRITTEN_COMPOSITION_RE.test(instruction)) return 'requires_written_composition'
      if (PAIRWORK_HIDDEN_RE.test(instruction)) return 'requires_partner_card'
      return 'type_permanently_blocked'
    case 'hidden_context_comprehension':
      if (WORD_BANK_INSTRUCTION_RE.test(instruction) && options.length === 0) {
        return 'requires_hidden_word_bank'
      }
      return 'items_from_listening_context'
    default:
      return null
  }
}

function collectBlockedSignals(
  exerciseType: string,
  instruction: string,
  items: string[],
  options: string[],
  classification: TextbookSemanticClass,
): string[] {
  const signals: string[] = []

  if (PERMANENTLY_BLOCKED.has(exerciseType)) {
    signals.push(`exercise type "${exerciseType}" is permanently unsupported`)
  }
  const audioMatch = instruction.match(AUDIO_INSTRUCTION_RE)
  if (audioMatch) {
    signals.push(`instruction contains audio keyword: "${audioMatch[0]}"`)
  }
  const imageMatch = instruction.match(IMAGE_INSTRUCTION_RE)
  if (imageMatch) {
    signals.push(`instruction contains image keyword: "${imageMatch[0]}"`)
  }
  if (WORD_BANK_INSTRUCTION_RE.test(instruction) && options.length === 0) {
    signals.push('instruction references word bank but no options are provided')
  }
  if (CONTEXT_REF_INSTRUCTION_RE.test(instruction)) {
    signals.push('instruction references hidden context (interview / recording / text)')
  }
  const thirdPersonCount = countThirdPersonComprehensionItems(items)
  if (thirdPersonCount >= 1 && SOFT_SPEAKING_TYPES.has(exerciseType)) {
    signals.push(
      `${thirdPersonCount} item(s) contain WH-questions about an unspecified 3rd-person subject ` +
      `(e.g. "What does he do?") — these are listening comprehension questions, not standalone discussion prompts`,
    )
  }
  if (classification === 'listening_followup') {
    signals.push('items form a comprehension Q&A that requires prior audio knowledge')
  }
  // Phase E.1: matching-specific signals
  if (MATCHING_QUESTION_INSTRUCTION_RE.test(instruction)) {
    signals.push(
      'instruction says "match questions with answers" — ANSWER SOURCE is a hidden audio recording, ' +
      'not visible options. Visible question text ≠ visible answer source.',
    )
  }
  if (MATCHING_TYPES.has(exerciseType) && items.length > 0 && options.length === 0) {
    const questionItemCount = items.filter(i => QUESTION_ITEM_RE.test(i.trim())).length
    if (questionItemCount > 0 && questionItemCount / items.length >= 0.5) {
      signals.push(
        `${questionItemCount}/${items.length} matching exercise items are WH-questions with no visible ` +
        'answer options — Q&A answers derive from hidden audio context, not from visible data',
      )
    }
  }
  if (classification === 'listening_followup_matching') {
    signals.push(
      'matching exercise is a listening comprehension Q&A — student sees questions but answers require audio recall',
    )
  }
  if (WRITTEN_COMPOSITION_RE.test(instruction)) {
    signals.push('instruction requires written composition (incompatible with voice lesson)')
  }
  if (PAIRWORK_HIDDEN_RE.test(instruction)) {
    signals.push('instruction references hidden partner card or pairwork materials')
  }

  return signals
}

// ── Main gate ─────────────────────────────────────────────────────────────────

export function analyzeExecutability(input: ExecutabilityInput): ExecutabilityDecision {
  const { exerciseType, instruction, items, options } = input

  // Fast path: permanently blocked type — no content analysis needed
  if (PERMANENTLY_BLOCKED.has(exerciseType)) {
    const isAudio = exerciseType === 'listening' || exerciseType === 'audio_reconstruction'
    return {
      executable: false,
      reason: isAudio ? 'requires_audio' : 'type_permanently_blocked',
      classification: isAudio ? 'listening_block' : 'unsupported_resource_task',
      confidence: 'high',
      blockedSignals: [`exercise type "${exerciseType}" is permanently unsupported`],
    }
  }

  const classification = classifySemanticType(exerciseType, instruction, items, options)
  let executable = !BLOCKED_CLASSES.has(classification)

  // Additional content check: word bank referenced but no options provided
  let extraBlockReason: ExecutabilityBlockReason | null = null
  const extraSignals: string[] = []
  if (executable && WORD_BANK_INSTRUCTION_RE.test(instruction) && options.length === 0) {
    executable = false
    extraBlockReason = 'requires_hidden_word_bank'
    extraSignals.push('instruction references word bank but no options are provided')
  }

  const blockedSignals = [
    ...collectBlockedSignals(exerciseType, instruction, items, options, classification),
    ...extraSignals,
  ]

  const reason = executable
    ? null
    : extraBlockReason ?? resolveBlockReason(classification, instruction, options)

  // Confidence: medium when detection relies only on item heuristics (not instruction keywords)
  let confidence: ExecutabilityDecision['confidence'] = 'high'
  if (classification === 'listening_followup' && !AUDIO_INSTRUCTION_RE.test(instruction)) {
    confidence = 'medium'
  }
  if (exerciseType === 'unknown') confidence = 'low'

  return { executable, reason, classification, confidence, blockedSignals }
}

// ── UnsupportedReason bridge ──────────────────────────────────────────────────
// Maps ExecutabilityBlockReason → UnsupportedReason for backwards compat with
// the existing isUnsupported / unsupportedReason pipeline in teacher-brain-context.

export function mapBlockReasonToUnsupportedReason(
  reason: ExecutabilityBlockReason,
): UnsupportedReason {
  switch (reason) {
    case 'requires_audio':             return 'requires_audio'
    case 'requires_image':             return 'requires_image'
    case 'requires_written_composition': return 'requires_written_composition'
    case 'requires_partner_card':      return 'requires_partner_card'
    case 'requires_hidden_word_bank':  return 'requires_hidden_context'
    case 'requires_hidden_options':    return 'requires_hidden_context'
    case 'items_from_listening_context': return 'requires_audio'
    case 'type_permanently_blocked':   return 'requires_hidden_context'
    case 'hidden_answer_source':       return 'requires_audio'         // Phase E.1: Q&A answers from audio
    case 'orphaned_comprehension_items': return 'requires_audio'       // Phase E.1: comprehension without source
  }
}

// ── Prompt injection ──────────────────────────────────────────────────────────

export function formatExecutabilityForPrompt(decision: ExecutabilityDecision): string {
  if (decision.executable) {
    return (
      `EXECUTABILITY: ALLOWED\n` +
      `Classification: ${decision.classification} | Confidence: ${decision.confidence}\n` +
      `Student can solve this exercise using only currently visible information.`
    )
  }

  const signals = decision.blockedSignals.length > 0
    ? decision.blockedSignals.map(s => `  • ${s}`).join('\n')
    : '  • hidden resource dependency detected'

  return [
    `EXECUTABILITY: BLOCKED`,
    `Classification: ${decision.classification}`,
    `Block reason: ${decision.reason ?? 'hidden resource dependency'}`,
    `Signals detected:`,
    signals,
    ``,
    `MANDATORY BEHAVIOR:`,
    `✓ Skip in ONE sentence: "Exercise [N] requires [audio/photo/hidden materials] — moving on."`,
    `✓ Present the next supported exercise in THE SAME response.`,
    `✗ NEVER adapt this exercise into a "discuss the topic" speaking session.`,
    `✗ NEVER invent substitute activities, vocabulary drills, or pronunciation work.`,
    `✗ NEVER ask the student to guess what the audio/image/text contained.`,
    `✗ NEVER split the skip announcement and next exercise across two turns.`,
  ].join('\n')
}

// ── Section-level content analysis ───────────────────────────────────────────
// Scans the raw section OCR text for blocking signal patterns.
// Used in prompt-builder to warn the AI about section-level issues before
// it processes individual exercises.

export interface SectionAnalysis {
  hasListeningContent: boolean
  hasImageContent: boolean
  warningBlock: string
}

export function analyzeTextbookSectionContent(
  sectionText: string,
  sectionType: string,
): SectionAnalysis {
  const hasListeningContent = AUDIO_INSTRUCTION_RE.test(sectionText)
  const hasImageContent = IMAGE_INSTRUCTION_RE.test(sectionText)

  if (!hasListeningContent && !hasImageContent && sectionType !== 'Listening') {
    return { hasListeningContent: false, hasImageContent: false, warningBlock: '' }
  }

  const warnings: string[] = []

  if (sectionType === 'Listening' || hasListeningContent) {
    warnings.push(
      'LISTENING CONTENT DETECTED — any exercise requiring audio recall is NOT executable.',
    )
    warnings.push(
      'Items that are WH-questions about a specific person heard in audio: treat as BLOCKED.',
    )
    warnings.push(
      'Discussion exercises whose items are comprehension Qs (not personal opinion): BLOCKED.',
    )
  }
  if (hasImageContent) {
    warnings.push(
      'IMAGE CONTENT DETECTED — any exercise referencing photos/pictures: BLOCKED, hard skip.',
    )
  }

  return {
    hasListeningContent,
    hasImageContent,
    warningBlock: warnings.length > 0
      ? ['── SECTION RESOURCE WARNINGS ──', ...warnings.map(w => `⚠ ${w}`)].join('\n')
      : '',
  }
}

// ── Greeting guidance ─────────────────────────────────────────────────────────
// Returns the concise greeting behavioral contract to inject into the AI prompt.
// Prevents repetitive, multi-sentence lesson openings.

export function buildGreetingGuidance(teacherName: string, lessonTopic: string): string {
  return [
    '── GREETING GUIDANCE (Phase H — HARD LIMIT) ──',
    'MAXIMUM 2 SHORT SENTENCES total. One intro line + one readiness invitation. Nothing else.',
    `  GOOD: "Hi! Today: ${lessonTopic.split('—')[0]?.trim() ?? lessonTopic}. Ready when you are."`,
    `  GOOD: "Hi, I'm ${teacherName}. Today we'll work on question forms. Let me know when you're ready."`,
    'ABSOLUTELY FORBIDDEN:',
    '  ✗ Listing section sub-topics ("Section 1.2 covers Present Simple, Present Continuous, Present Perfect...")',
    '  ✗ Saying "Today\'s topic is X" AND "We\'ll practise X" in the same greeting (duplicate = failure)',
    '  ✗ Any sentence starting "We\'ll work through the exercises together and..."',
    '  ✗ Any sentence starting "I\'ll help at every step" — it\'s implied',
    '  ✗ Repeating the grammar focus list from the Teacher\'s Book in the greeting',
    '  ✗ A greeting longer than 15 words per sentence',
    'Use ONLY the short topic name — never the full section title or sub-topic list.',
    'After readiness signal: jump DIRECTLY to Exercise 1. Never describe the topic again.',
    'Exercise intro: number + instruction + first item only. No "let me show you what it asks."',
  ].join('\n')
}

// ── Phase E.1: Hidden answer source detection ─────────────────────────────────
//
// Called from claude-handler.ts as a post-parse check on the ACTUAL exercise
// the AI returned (not the current state). This catches exercises that:
//   • Passed the type-level check (e.g. type=matching is technically allowed)
//   • Passed the instruction-level check (no "listen" keyword in instruction)
//   • But have items that are comprehension Q&A whose answers come from hidden audio
//
// KEY PRINCIPLE: "Who inspires you?" looks like a standalone question.
// But in the context "Match the questions with answers" without visible options,
// the answer comes from the recording — the student has no way to answer.
// Visible question text ≠ visible answer source.
//
// This function operates on the RETURNED exercise data, not state, so it catches
// problems the prompt-side gate missed (gate runs on state, not on AI output).

export function detectHiddenAnswerSource(input: ExecutabilityInput): HiddenAnswerSourceDecision {
  const { exerciseType, instruction, items, options } = input

  // Fast path: permanently blocked types are already handled upstream
  if (PERMANENTLY_BLOCKED.has(exerciseType)) {
    return { detected: false, classification: null, signals: [] }
  }

  const signals: string[] = []

  // ── Matching exercises: hidden Q&A answer source ────────────────────────────
  if (MATCHING_TYPES.has(exerciseType)) {
    // Signal A: instruction explicitly describes Q&A matching ("match questions with answers")
    if (MATCHING_QUESTION_INSTRUCTION_RE.test(instruction)) {
      signals.push(
        'instruction says "match questions with answers" — answer source is hidden audio/context, ' +
        'not visible options; visible question text ≠ visible answer source',
      )
      return { detected: true, classification: 'listening_followup_matching', signals }
    }

    // Signal B: items are WH-questions AND no visible answer options provided
    // A legitimate matching exercise always provides the right-side options for the student to match to.
    // When options are absent and items are questions, the answers must come from somewhere hidden.
    if (items.length > 0 && options.length === 0) {
      const questionItems = items.filter(i => QUESTION_ITEM_RE.test(i.trim()))
      if (questionItems.length > 0 && questionItems.length / items.length >= 0.5) {
        signals.push(
          `${questionItems.length}/${items.length} items are WH-questions with no visible answer options ` +
          '— Q&A answer source is hidden (audio recording or prior unseen context)',
        )
        return { detected: true, classification: 'listening_followup_matching', signals }
      }

      // Signal C: third-person comprehension items are an even stronger signal in matching
      const thirdPersonCount = countThirdPersonComprehensionItems(items)
      if (thirdPersonCount >= 1) {
        signals.push(
          `${thirdPersonCount} item(s) are WH-questions about an unspecified 3rd-person subject ` +
          'in a matching exercise with no visible options — answer source requires audio recall',
        )
        return { detected: true, classification: 'listening_followup_matching', signals }
      }
    }
  }

  // ── Non-soft-speaking, non-matching: 3rd-person comprehension items ──────────
  // These types are not expected to have comprehension Q&A items about a person heard in audio.
  // If they do, the items were likely imported from a listening section without the audio.
  if (!SOFT_SPEAKING_TYPES.has(exerciseType) && !MATCHING_TYPES.has(exerciseType)) {
    const thirdPersonCount = countThirdPersonComprehensionItems(items)
    if (thirdPersonCount >= 1 && items.length >= 2) {
      signals.push(
        `${thirdPersonCount} item(s) are WH-questions about an unspecified 3rd-person subject ` +
        'in a non-speaking exercise — orphaned comprehension items that require hidden audio context',
      )
      return { detected: true, classification: 'orphaned_comprehension_items', signals }
    }
  }

  // ── Any exercise type: explicit context references in items ──────────────────
  // Items that reference "the interview", "the recording", etc. have a hidden source.
  // Soft speaking types are excluded — they may legitimately discuss a topic from context.
  if (!SOFT_SPEAKING_TYPES.has(exerciseType) && hasContextRefInItems(items)) {
    signals.push(
      'items reference hidden context (recording / interview / text) — answer source not visible',
    )
    return { detected: true, classification: 'hidden_answer_source_generic', signals }
  }

  return { detected: false, classification: null, signals: [] }
}

// ── Phase E.1: Speech/runtime consistency rule ────────────────────────────────
//
// Injected into the AI prompt to prevent the SECOND class of production failure:
// AI verbally presents "Exercise 2..." while backend shows exercise=0 because the
// exercise JSON was blocked/rejected. The AI generates speech and JSON together;
// when the JSON is rejected, speech remains and creates a desync the student feels.
//
// This rule tells the AI: if you can't include valid executable exercise JSON,
// do NOT verbally present the exercise as a numbered structured exercise.

export function buildSpeechRuntimeConsistencyRule(currentExerciseNum: number): string {
  const cursorInfo = currentExerciseNum === 0
    ? 'Backend cursor: no exercise accepted yet (exercise=0)'
    : `Backend cursor: Exercise #${currentExerciseNum} currently active`

  return [
    '── SPEECH/RUNTIME SYNC RULE (Phase E.1 — CRITICAL) ──',
    cursorInfo,
    '',
    'Your speech output and exercise JSON MUST be synchronized at all times.',
    'The backend only creates a runtime cursor when it ACCEPTS your exercise JSON.',
    'If your JSON is blocked/missing while your speech says "Exercise N...",',
    'the student hears an exercise but has no way to submit an answer.',
    '',
    'REQUIRED CONTRACT:',
    '• Say "Exercise N: [instruction]..." → MUST include exerciseNumber=N in JSON',
    '• EXECUTABILITY GATE says BLOCKED → skip in ONE sentence + present next exercise with JSON',
    '• Cannot produce valid executable JSON → do NOT verbally present as a numbered exercise',
    '',
    'FORBIDDEN (creates speech/runtime desync — breaks lesson):',
    '✗ Verbally say "Exercise N, match the questions..." without exerciseNumber=N in JSON',
    '✗ Include JSON for an exercise that EXECUTABILITY GATE blocked',
    '✗ Present a numbered exercise verbally when cursor is exercise=0',
    '✗ Name an exercise number in speech different from exerciseNumber in your JSON',
    '',
    'ALLOWED speech when exercise is blocked:',
    '✓ "Exercise [N] requires a recording — moving on."',
    '✓ Immediately follow with the next executable exercise + its JSON',
  ].join('\n')
}

// ── Exercise intro cleanup guidance ──────────────────────────────────────────

export const EXERCISE_INTRO_RULES = [
  'State the exercise number + instruction + first item only — nothing more.',
  'Never over-explain what an exercise is about before the student attempts it.',
  'Never repeat the exercise name or instruction after it has been introduced once.',
  'Never announce "Now we will practise X" — just start it.',
  'Backend decides the current exercise — AI reads and presents it. AI does not reinterpret.',
  'Backend decides progression — AI cannot reopen completed exercises or reorder the curriculum.',
] as const
