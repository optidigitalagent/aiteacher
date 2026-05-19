// Exercise Teaching Protocol — canonical per-type protocol contract.
//
// This is the single source of truth for:
//   • answerMode (exact, normalized_exact, option_label, etc.)
//   • shortAnswerPolicy (what to do with fragment answers)
//   • studentQuestionPolicy (what to do with mid-exercise side questions)
//   • discussionDepthRule (when a discussion answer is truly complete)
//   • engagementChallengeRule (when to challenge lightly)
//   • forbiddenBehavior (explicit per-type prohibitions)
//   • teacherTone (concise / encouraging / playful / challenging)
//
// buildProtocolTeacherGuidance() produces a prompt block injected into
// the Teacher Brain on every turn, complementing exercise-format-registry.ts.

import { getExerciseFormatPolicy } from './exercise-format-registry.js'

// ── Types ──────────────────────────────────────────────────────────────────────

export type AnswerMode =
  | 'exact'               // must match exactly (fill_gap gap word)
  | 'normalized_exact'    // case/punctuation-insensitive (choose_from_box)
  | 'option_label'        // say letter or visible option text (matching, gapped_text)
  | 'classification_label'// say the category name (phrase_classification)
  | 'short_text'          // any relevant short answer from the text (read_and_answer)
  | 'open_ended'          // any substantive spoken response (discussion)
  | 'multi_sentence'      // requires multiple sentences (writing_prompt)

export interface ExerciseTeachingProtocol {
  exerciseType: string

  // What the student must see on screen before teacher asks the first question
  frontendRequirements: string[]

  // Canonical teacher opening for this type
  teacherOpening: string

  // Expected answer mode
  answerMode: AnswerMode

  // Shape description of an acceptable answer
  acceptedAnswerShape: string

  // What to do when student gives a fragment / one-word answer
  shortAnswerPolicy: string

  // What to do when student asks a vocabulary or grammar question mid-exercise
  studentQuestionPolicy: string

  // Hint direction for first wrong attempt
  firstRetry: string

  // Hint direction for second wrong attempt
  secondRetry: string

  // Reveal behavior at turn D
  finalReveal: string

  // When this exercise is considered complete
  completionRule: string

  // For discussion/speaking types: minimum depth required
  discussionDepthRule?: string

  // Light engagement challenge for weak / uncertain / partially-wrong answers
  engagementChallengeRule: string

  // Explicit per-type prohibitions
  forbiddenBehavior: string[]

  // Teaching tone
  teacherTone: 'concise' | 'encouraging' | 'playful' | 'challenging'
}

export interface ProtocolGuidanceInput {
  exerciseType: string
  teacherAction?: string   // from EngineTurnResult.teacherAction
  correctionTurn: string | null
  studentAnswer?: string
  runtimeMode: string
  isDiscussionComplete?: boolean  // signals engine advanced from a discussion exercise
}

// ── Protocol registry ─────────────────────────────────────────────────────────

const PROTOCOLS: Record<string, ExerciseTeachingProtocol> = {

  fill_gap: {
    exerciseType: 'fill_gap',
    frontendRequirements: ['Sentence with blank visible on screen.'],
    teacherOpening: 'Say just the missing word — not the full sentence.',
    answerMode: 'normalized_exact',
    acceptedAnswerShape: 'Single word or short phrase that fills the blank.',
    shortAnswerPolicy:
      'If student says full sentence but the gap word is correct inside it — extract and accept. ' +
      'If student gives an unrelated word — say "Almost. Look at the grammar — what form fits here?"',
    studentQuestionPolicy:
      'Answer briefly in one sentence (e.g. "walks means go on foot"). ' +
      'Then return immediately: "Now — back to the gap. [repeat item without the answer]."',
    firstRetry:
      'Ask ONE question targeting the precise gap: verb form? noun? collocate? — never give the word.',
    secondRetry:
      'Give the grammar category or first letter(s). Change the angle — do NOT rephrase turn A.',
    finalReveal:
      'Say "The answer is [word]." + one-sentence reason. Ask student to repeat the full sentence.',
    completionRule: 'Complete after student produces the exact gap word (accept from full sentence).',
    engagementChallengeRule:
      'If student hesitates or says "I think maybe...": "Are you sure? Look at the subject." ' +
      'Deliver only ONE light challenge per item.',
    forbiddenBehavior: [
      'Do NOT accept the full sentence as wrong when the gap word inside it is correct.',
      'Do NOT advance before engine confirms correct.',
      'Do NOT give grammar lecture before first attempt.',
      'Do NOT read the item text verbatim again (it is already visible).',
    ],
    teacherTone: 'encouraging',
  },

  choose_from_box: {
    exerciseType: 'choose_from_box',
    frontendRequirements: ['Word box visible on screen.', 'Sentence with blank visible.'],
    teacherOpening: 'Choose the correct word from the box on screen.',
    answerMode: 'normalized_exact',
    acceptedAnswerShape: 'One word from the visible word box.',
    shortAnswerPolicy:
      'A single word from the box is the correct format — accept it if valid. ' +
      'If student says a word not in the box: "That word is not in the box — look at the options on screen."',
    studentQuestionPolicy:
      'One sentence answer. Then: "Back to the sentence — which word from the box fits?"',
    firstRetry:
      'Ask "What kind of word fits — verb, noun, adjective? Look at the box — which type matches?"',
    secondRetry:
      'Narrow: "There are only two that could fit grammatically. Which makes sense in context?"',
    finalReveal:
      'Say "The answer is [word]." + brief why. Ask student to repeat the sentence with the word.',
    completionRule: 'Complete when student gives correct box word. Do NOT re-read all box words.',
    engagementChallengeRule:
      'If student picks a plausible but wrong word: "Does that really fit the context? Think about the meaning."',
    forbiddenBehavior: [
      'Do NOT read out all words in the box — they are visible.',
      'Do NOT reference any word not present in the visible box.',
      'Do NOT accept correct-sounding words from outside the box.',
    ],
    teacherTone: 'encouraging',
  },

  grammar_focus: {
    exerciseType: 'grammar_focus',
    frontendRequirements: ['Grammar box visible with rule and examples.'],
    teacherOpening: 'Brief rule (max 2 sentences) then immediate comprehension check question.',
    answerMode: 'short_text',
    acceptedAnswerShape: 'Short answer to the comprehension check — word or phrase.',
    shortAnswerPolicy:
      'Short answers to the check question are fine — do NOT demand a full sentence.',
    studentQuestionPolicy:
      'Answer the grammar question directly (1 sentence). Then: "Good — now let\'s apply the rule."',
    firstRetry:
      'Re-explain the KEY part the student missed — one sentence only. Then ask the check again.',
    secondRetry:
      'Give a second example showing the rule. Ask once more. Then move on regardless.',
    finalReveal:
      'Give the answer to the comprehension check. Move to practice exercise immediately.',
    completionRule:
      'Complete after student answers the check question (correct or after 2 retries).',
    engagementChallengeRule:
      'Challenge lightly if student guesses randomly: "Think about it — when do we add -s?"',
    forbiddenBehavior: [
      'Do NOT give more than 2 sentences of explanation before the check question.',
      'Do NOT skip the student comprehension check.',
      'Do NOT continue without a student response to the check.',
      'Do NOT lecture — explain, check, practice.',
    ],
    teacherTone: 'concise',
  },

  phrase_classification: {
    exerciseType: 'phrase_classification',
    frontendRequirements: ['Phrases visible on screen.', 'Category labels visible on screen.'],
    teacherOpening: 'Which category does this phrase belong to? Say the category name.',
    answerMode: 'classification_label',
    acceptedAnswerShape: 'Category name (e.g. "Parents say" / "Teenagers say").',
    shortAnswerPolicy:
      'A single category word is valid (e.g. "parents" without "say"). ' +
      'If completely off — "Think: is this a positive or negative statement about teenagers? Who would say it?"',
    studentQuestionPolicy:
      'One sentence answer. Then: "Back to the phrase — which category fits?"',
    firstRetry:
      'Ask: "Is this phrase positive or negative? Who is more likely to describe teenagers this way?"',
    secondRetry:
      'Give a contrast: "Category A is for [description], Category B is for [description]. Which fits this phrase?"',
    finalReveal:
      'Say "The category is [answer]." Move to the next phrase — do NOT re-read the phrase.',
    completionRule: 'Complete after student correctly classifies ALL visible phrases.',
    engagementChallengeRule:
      'If student seems to guess: "Does that really match the phrase? Read it again quickly."',
    forbiddenBehavior: [
      'Do NOT read all phrases aloud — they are visible.',
      'Do NOT move to the next phrase before the current one is correctly classified.',
      'Do NOT reveal the category before student attempts.',
    ],
    teacherTone: 'challenging',
  },

  matching: {
    exerciseType: 'matching',
    frontendRequirements: ['Both left and right columns visible on screen.'],
    teacherOpening: 'Both columns are on screen. Say the letter or matching option.',
    answerMode: 'option_label',
    acceptedAnswerShape: 'A letter (A, B, C...) or the matching text.',
    shortAnswerPolicy:
      'A single letter (A, B, C) is the perfect format — accept immediately. ' +
      'Multiple matches at once: accept only the first, move sequentially.',
    studentQuestionPolicy:
      'One sentence answer. Then: "Back to number [N] — which option matches?"',
    firstRetry:
      'Narrow by elimination: "Which option is clearly WRONG for [item]? Eliminate it." Give no answer.',
    secondRetry:
      'REVEAL: "The correct match is [answer]." Confirm and move immediately to the next pair.',
    finalReveal:
      'Reveal immediately at turn B. Confirm and move on — do not linger.',
    completionRule: 'Complete when all pairs are matched. Fast pace — matching does not need long hints.',
    engagementChallengeRule:
      'If student gives obviously wrong match: "Does [item] really connect to [option]? Think about the meaning."',
    forbiddenBehavior: [
      'Do NOT read all items and all options aloud — they are visible.',
      'Do NOT ask for all matches at once.',
      'Do NOT invent options not visible on screen.',
      'Do NOT linger on wrong matching answers — reveal at turn B and move on.',
    ],
    teacherTone: 'encouraging',
  },

  vocabulary_matching: {
    exerciseType: 'vocabulary_matching',
    frontendRequirements: ['Word list and definitions both visible on screen.'],
    teacherOpening: 'Match the word with its meaning. Say the letter or definition.',
    answerMode: 'option_label',
    acceptedAnswerShape: 'Letter or paraphrase of the matching definition.',
    shortAnswerPolicy: 'A single letter is fine.',
    studentQuestionPolicy: 'Brief answer. Return: "Back to [word] — which definition matches?"',
    firstRetry: 'Hint by meaning category: "Is it a verb or noun? What kind of action/thing is it?"',
    secondRetry: 'REVEAL: "The match is [answer]." Move immediately.',
    finalReveal: 'Reveal and move on.',
    completionRule: 'Complete when all pairs matched.',
    engagementChallengeRule: 'If wrong: "Are you sure that definition matches the word? Think about the context."',
    forbiddenBehavior: [
      'Do NOT read all definitions aloud.',
      'Do NOT ask for all matches simultaneously.',
    ],
    teacherTone: 'encouraging',
  },

  find_opposites: {
    exerciseType: 'find_opposites',
    frontendRequirements: ['Target words visible.', 'Options visible.'],
    teacherOpening: 'Find the opposite. Say the antonym word or its letter.',
    answerMode: 'option_label',
    acceptedAnswerShape: 'The opposite word or its letter from the options.',
    shortAnswerPolicy:
      'A single word (the antonym) is the correct format. ' +
      'Synonym instead of antonym: "That means the SAME thing — I need the OPPOSITE."',
    studentQuestionPolicy: 'One sentence answer. Return to the target word.',
    firstRetry: 'Ask: "Think about the opposite meaning — if [word] means X, the opposite means...?"',
    secondRetry: 'REVEAL: "The opposite is [answer]." Move on.',
    finalReveal: 'Reveal immediately. If options are visible, point to the letter.',
    completionRule: 'Complete when all opposites found.',
    engagementChallengeRule: 'If student gives a synonym: "That means the same — try for the OPPOSITE."',
    forbiddenBehavior: [
      'Do NOT treat as a generic vocabulary quiz when text and options are already visible.',
      'Do NOT ask about words not in the visible options.',
    ],
    teacherTone: 'encouraging',
  },

  gapped_text: {
    exerciseType: 'gapped_text',
    frontendRequirements: [
      'Sentences A-F (or similar) visible on screen.',
      'Text with numbered gaps visible on screen.',
    ],
    teacherOpening: 'Sentences A-F are on screen. Say the letter that fits each gap.',
    answerMode: 'option_label',
    acceptedAnswerShape: 'A letter from A-F.',
    shortAnswerPolicy:
      'A single letter is the perfect answer. ' +
      'If student says the full sentence instead — accept it and confirm the letter.',
    studentQuestionPolicy:
      'Brief answer. Then: "Back to gap [N] — which sentence on screen fits there?"',
    firstRetry:
      'Ask about meaning: "What kind of idea is missing in gap [N] — positive, negative, cause, result? ' +
      'Look at the sentences on screen — which meaning matches?"',
    secondRetry:
      'Narrow: "Can you rule out any letters that clearly don\'t fit? Which ones remain?"',
    finalReveal:
      'Say "The answer is [letter]." Ask student to confirm. Move immediately to next gap.',
    completionRule: 'Complete when all gaps have correct letters.',
    engagementChallengeRule:
      'If student seems unsure: "Does that sentence make sense in the gap? Read the surrounding text."',
    forbiddenBehavior: [
      'Do NOT read all sentences A-F aloud — they are visible.',
      'Do NOT reference any option not visible on screen.',
      'Do NOT solve any gap before the student attempts.',
    ],
    teacherTone: 'challenging',
  },

  read_and_answer: {
    exerciseType: 'read_and_answer',
    frontendRequirements: [
      'Reading text or textBlocks visible on screen BEFORE asking questions.',
    ],
    teacherOpening: 'Questions are based on the text you can see. Answer from the text.',
    answerMode: 'short_text',
    acceptedAnswerShape: 'Short answer found in or directly supported by the visible text.',
    shortAnswerPolicy:
      'Short phrase answers are fine. If key detail is missing — "What about [key detail]? ' +
      'Look at [paragraph/sentence] — what does it say there?"',
    studentQuestionPolicy:
      'If student asks "Where is it?" — "Look at paragraph [N] / the section mentioning [clue]." ' +
      'Do NOT answer from hidden knowledge. Always point to a visible text location.',
    firstRetry:
      'Point to the text location: "Look at paragraph [N] — what does it say about [topic]?"',
    secondRetry:
      'Give a stronger location clue: "The answer is in the sentence that mentions [clue word]."',
    finalReveal:
      'Say "The answer is [answer]. It\'s in [location in text]." Move to next question.',
    completionRule: 'Complete when all questions answered. Never give answers from memory of hidden text.',
    engagementChallengeRule:
      'If student guesses without reading: "Does that match what the text actually says? ' +
      'Look at [location] — what does it say there?"',
    forbiddenBehavior: [
      'Do NOT reveal answers from the text before the student attempts.',
      'Do NOT reference text content the student cannot see on their screen.',
      'Do NOT answer from teacher knowledge — only from what is visible.',
      'Do NOT point to a hidden paragraph — only to a visible text section.',
    ],
    teacherTone: 'encouraging',
  },

  read_and_write_names: {
    exerciseType: 'read_and_write_names',
    frontendRequirements: ['Text blocks with speaker names/labels visible on screen.'],
    teacherOpening: 'I\'ll describe someone — tell me the name from the text.',
    answerMode: 'short_text',
    acceptedAnswerShape: 'A person\'s name from the visible text.',
    shortAnswerPolicy:
      'A single name is the correct format. Accept approximate pronunciation. ' +
      'If wrong — point to the text: "Look at the person who [key detail]."',
    studentQuestionPolicy:
      'Brief answer. Return: "Back to [description] — whose name is it?"',
    firstRetry:
      'Point to visible text section: "Look at the comment that mentions [clue]. Who wrote that?"',
    secondRetry:
      'Give a stronger hint: "The person who [key detail from text] — what is their name in the text?"',
    finalReveal:
      'Say "The name is [name]. It\'s [person] who [key detail]." Move on.',
    completionRule: 'Complete when all names correctly identified from the visible text.',
    engagementChallengeRule:
      'If student says a wrong name: "Are you sure? Look at who [key detail] in the text."',
    forbiddenBehavior: [
      'Do NOT dump all speaker names before the exercise begins.',
      'Do NOT answer from hidden knowledge — only from visible text.',
    ],
    teacherTone: 'encouraging',
  },

  discussion: {
    exerciseType: 'discussion',
    frontendRequirements: ['Discussion prompt or statements visible on screen.'],
    teacherOpening: 'Share your opinion — a few sentences. What do you think?',
    answerMode: 'open_ended',
    acceptedAnswerShape: 'Any opinion expressed in at least one full sentence with some reasoning.',
    shortAnswerPolicy:
      'If student gives a fragment without explanation (e.g. "Jordan inspire me", "Yes I like") — ' +
      'ask ONE specific follow-up: e.g. "Why does Jordan inspire you — his work ethic, talent, or discipline?" ' +
      'Do NOT say "Correct. Exercise done." — wait for the follow-up answer.',
    studentQuestionPolicy:
      'Answer briefly. Then return: "So what is YOUR take on this? Tell me more."',
    firstRetry:
      'Ask a specific follow-up that narrows the topic: "Why exactly? Can you give one example?"',
    secondRetry:
      'Give a broader prompt: "Think about [specific aspect] — what comes to mind?"',
    finalReveal:
      'Accept the second response regardless of length. Note one thing to improve. Move on.',
    completionRule:
      'Complete ONLY after student gives a substantive response (6+ words with reasoning). ' +
      'A fragment, single word, or vague phrase requires ONE follow-up before completing.',
    discussionDepthRule:
      'DISCUSSION DEPTH RULE: The student must express at least one opinion or reason. ' +
      '"Jordan inspire me" is NOT complete. "Jordan inspires me because of his hard work" IS complete. ' +
      'Ask ONE follow-up for fragment answers. After any second response — complete regardless.',
    engagementChallengeRule:
      'After student answers, optionally probe: "Can you give an example?" or ' +
      '"What specifically makes you say that?" — but only ONCE, never loop.',
    forbiddenBehavior: [
      'Do NOT say "Correct. Exercise done." after a one-fragment or one-word answer.',
      'Do NOT complete the discussion without at least one substantive student response.',
      'Do NOT give your own opinion before the student speaks.',
      'Do NOT ask more than ONE follow-up question per discussion item.',
    ],
    teacherTone: 'playful',
  },

  speaking_prompt: {
    exerciseType: 'speaking_prompt',
    frontendRequirements: ['Speaking prompt card visible on screen.'],
    teacherOpening: 'Speak freely about the topic. A few sentences is fine.',
    answerMode: 'open_ended',
    acceptedAnswerShape: 'Any spoken response addressing the topic.',
    shortAnswerPolicy:
      'One-word or very short filler: "Can you say a bit more? Just a sentence or two." ' +
      'Any second response (however short): accept and move on. Never ask a third time.',
    studentQuestionPolicy:
      'Brief answer. Then: "Good — now back to the topic. Tell me more."',
    firstRetry:
      'Offer a sentence starter: "You could start with: \'In my opinion...\' — go ahead."',
    secondRetry:
      'Give a broader prompt: "Think about [specific aspect] — what comes to mind?"',
    finalReveal:
      'Accept any second response. Note one language point. Move on.',
    completionRule:
      'Complete after one substantive response. If first response is a fragment — ' +
      'ask once for more. After any second response: complete.',
    discussionDepthRule:
      'A one-word or filler answer requires ONE follow-up. Any second answer completes.',
    engagementChallengeRule:
      'If student seems reluctant: "There\'s no right or wrong — just tell me what you think."',
    forbiddenBehavior: [
      'Do NOT demand a specific answer — there is no single correct response.',
      'Do NOT say "wrong" for speaking exercises.',
      'Do NOT ask more than ONE follow-up question.',
      'Do NOT create an interview with multiple successive questions.',
    ],
    teacherTone: 'encouraging',
  },

  grammar_drill: {
    exerciseType: 'grammar_drill',
    frontendRequirements: ['Drill items visible.'],
    teacherOpening: 'Apply the rule. Say the correct form.',
    answerMode: 'normalized_exact',
    acceptedAnswerShape: 'The correctly inflected form.',
    shortAnswerPolicy: 'Single word or short phrase is fine for drills.',
    studentQuestionPolicy: 'Brief rule reminder. Then: "Now apply it — [current item]."',
    firstRetry: 'Ask about the grammatical trigger: "What is the subject? What tense? What does that give you?"',
    secondRetry: 'Give the pattern: "The rule is [pattern]. Apply it to [base form]."',
    finalReveal: 'Reveal + rule + ask repeat.',
    completionRule: 'Complete when all drill items done.',
    engagementChallengeRule: 'If student says wrong form confidently: "Almost — check the subject agreement."',
    forbiddenBehavior: [
      'Do NOT explain rule before every item — explain once, then drill.',
    ],
    teacherTone: 'concise',
  },

}

// Shared soft-speaking protocol for roleplay and similar types
const SOFT_SPEAKING_PROTOCOL: ExerciseTeachingProtocol = {
  exerciseType: 'soft_speaking',
  frontendRequirements: ['Prompt or scenario visible on screen.'],
  teacherOpening: 'Speak naturally. There\'s no single correct answer.',
  answerMode: 'open_ended',
  acceptedAnswerShape: 'Any substantive spoken response.',
  shortAnswerPolicy:
    'One-word response: ask once for more. Any second response: accept and move on.',
  studentQuestionPolicy: 'Brief answer. Return to the prompt.',
  firstRetry: 'Offer a starter or context prompt.',
  secondRetry: 'Accept whatever the student says. Note one improvement.',
  finalReveal: 'Accept. Note one language point. Move on.',
  completionRule: 'Complete after any substantive response or after one follow-up.',
  engagementChallengeRule: 'If student hesitates: "No right answer here — just go for it."',
  forbiddenBehavior: [
    'Do NOT apply correction ladder to speaking exercises.',
    'Do NOT say wrong/incorrect for speaking.',
    'Do NOT ask more than one follow-up.',
  ],
  teacherTone: 'encouraging',
}

// Fallback protocol for unregistered types
function makeFallbackProtocol(exerciseType: string): ExerciseTeachingProtocol {
  const policy = getExerciseFormatPolicy(exerciseType)
  const isSoftMode = policy.runtimeMode.includes('soft') || policy.runtimeMode.includes('speaking')
  return {
    exerciseType,
    frontendRequirements: [policy.frontendRenderPolicy.screenAwarenessNote],
    teacherOpening: policy.instructionPolicy.openingTemplate,
    answerMode: isSoftMode ? 'open_ended' : 'normalized_exact',
    acceptedAnswerShape: policy.expectedAnswerPolicy.answerDescription,
    shortAnswerPolicy: policy.expectedAnswerPolicy.partialAnswerRule,
    studentQuestionPolicy:
      'Answer briefly (1 sentence). Return immediately to the current exercise item.',
    firstRetry: policy.hintPolicy.turnA,
    secondRetry: policy.hintPolicy.turnB,
    finalReveal: policy.hintPolicy.turnD,
    completionRule: `Complete when all ${policy.runtimeMode} items answered correctly.`,
    engagementChallengeRule:
      'If student seems unsure: "Take your time — look carefully." One challenge only.',
    forbiddenBehavior: policy.instructionPolicy.forbiddenAtIntro,
    teacherTone: isSoftMode ? 'encouraging' : 'concise',
  }
}

// Alias mappings for engine-side exercise type names
const TYPE_ALIASES: Record<string, string> = {
  fill_in_the_gap:       'fill_gap',
  grammar_fill:          'fill_gap',
  grammar_focus_fill:    'fill_gap',
  vocabulary_fill_gap:   'fill_gap',
  collocations_fill:     'matching',
  sentence_transformation: 'fill_gap',
  pair_speaking:         'speaking_prompt',
  soft_speaking:         'speaking_prompt',
  grammar_drill:         'grammar_drill',
  grammar_explanation:   'grammar_focus',
  find_in_text:          'read_and_answer',
  reading_comprehension: 'read_and_answer',
  paragraph_reading:     'read_and_answer',
}

// ── Public API ─────────────────────────────────────────────────────────────────

export function getExerciseTeachingProtocol(exerciseType: string): ExerciseTeachingProtocol {
  const resolved = TYPE_ALIASES[exerciseType] ?? exerciseType
  const protocol = PROTOCOLS[resolved]
  if (protocol) {
    console.log(`[teaching-protocol] selected type=${resolved}`)
    return protocol
  }

  // Try soft-speaking catch-all
  const policy = getExerciseFormatPolicy(exerciseType)
  if (policy.runtimeMode === 'soft_speaking' || policy.runtimeMode === 'warmup_activation') {
    console.log(`[teaching-protocol] selected type=soft_speaking (alias for ${exerciseType})`)
    return { ...SOFT_SPEAKING_PROTOCOL, exerciseType }
  }

  console.log(`[teaching-protocol] missing type=${exerciseType} — using fallback`)
  return makeFallbackProtocol(exerciseType)
}

export function buildProtocolTeacherGuidance(
  protocol: ExerciseTeachingProtocol,
  input: ProtocolGuidanceInput,
): string {
  const lines: string[] = []
  lines.push('=== EXERCISE TEACHING PROTOCOL ===')
  lines.push(
    `Type: ${protocol.exerciseType} | Answer mode: ${protocol.answerMode} | Tone: ${protocol.teacherTone}`,
  )

  if (input.teacherAction) {
    lines.push(`Teacher action: ${input.teacherAction}`)
  }

  // Retry guidance based on current correction turn
  if (input.correctionTurn) {
    const retryMap: Record<string, string> = {
      A: protocol.firstRetry,
      B: protocol.secondRetry,
      C: protocol.secondRetry,
      D: protocol.finalReveal,
    }
    const retryGuidance = retryMap[input.correctionTurn] ?? protocol.firstRetry
    lines.push(`\nRetry Turn ${input.correctionTurn}: ${retryGuidance}`)
  }

  // Short answer handling
  lines.push(`\nShort/fragment answer: ${protocol.shortAnswerPolicy}`)

  // Side question handling
  lines.push(`Side question (vocab/grammar): ${protocol.studentQuestionPolicy}`)

  // Engagement challenge
  lines.push(`Light engagement: ${protocol.engagementChallengeRule}`)

  // Discussion depth rule (only for discussion/speaking types)
  if (protocol.discussionDepthRule) {
    lines.push(`\n⚠ DISCUSSION DEPTH: ${protocol.discussionDepthRule}`)

    if (input.isDiscussionComplete) {
      console.log(`[teaching-protocol] discussion_followup_required type=${protocol.exerciseType}`)
    }
  }

  // Completion rule
  lines.push(`\nCompletion: ${protocol.completionRule}`)

  // Forbidden behavior
  if (protocol.forbiddenBehavior.length > 0) {
    lines.push('\nFORBIDDEN:')
    for (const rule of protocol.forbiddenBehavior) {
      lines.push(`  ✗ ${rule}`)
    }

    console.log(
      `[teaching-protocol] guidance_built action=${input.teacherAction ?? 'unknown'} ` +
      `type=${protocol.exerciseType} turn=${input.correctionTurn ?? 'none'}`,
    )
  }

  // Frontend requirements
  if (protocol.frontendRequirements.length > 0) {
    lines.push('\nFrontend must show:')
    for (const req of protocol.frontendRequirements) {
      lines.push(`  • ${req}`)
    }
  }

  lines.push('===================================')
  return lines.join('\n')
}
