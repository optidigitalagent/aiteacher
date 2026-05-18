// Exercise Format Registry — canonical backend authority for exercise teaching behavior.
//
// This registry defines exactly how the teacher should behave for every exercise type:
//   • how to introduce it
//   • how to demonstrate it
//   • what answer format to expect
//   • how to hint at each correction turn
//   • retry escalation strategy
//   • what the frontend displays (constraints on teacher speech)

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TeacherInstructionPolicy {
  openingTemplate:      string  // How to name and introduce the exercise
  answerFormatSpec:     string  // Exactly how the student should answer
  exampleScript:        string  // Full demo structure (uses DIFFERENT item from item 1)
  briefRepeatReminder:  string  // Reminder when student has seen this type before
  forbiddenAtIntro:     string[]
}

export interface DemonstrationPolicy {
  required:         boolean   // Must demonstrate before first student attempt
  maxExamples:      1 | 2     // Never more than this many examples
  exampleRule:      string    // Rule about choosing example item
  whenToSkipDemo:   string    // Conditions under which demo is omitted
  antiPatterns:     string[]
}

export interface ExpectedAnswerPolicy {
  format:           'single_word' | 'full_sentence' | 'letter_choice' | 'word_or_phrase' | 'free_speech' | 'true_false_word'
  answerDescription: string   // Exactly what to ask for
  partialAnswerRule: string   // How to handle partial answers
  voiceAdaptation:  string    // Accommodation for voice input
}

export interface HintPolicy {
  turnA: string  // First wrong attempt: guiding question, zero answer
  turnB: string  // Second wrong attempt: structural guidance or reveal (matching)
  turnC: string  // Third wrong attempt: near-full hint
  turnD: string  // Fourth attempt: full reveal + repeat request
  revealOnTurn:  'B' | 'D'   // When to reveal the answer
}

export interface RetryPolicy {
  maxRetries:           number
  requireRepeatAfterReveal: boolean
  escalationNotes:      string[]  // Behavioral guidance for each turn
}

export interface FrontendRenderPolicy {
  itemsVisible:          boolean  // Exercise items visible to student?
  optionsVisible:        boolean  // Word bank / options visible?
  wordBoxVisible:        boolean  // Word box tracking visible?
  matchingColumnsVisible: boolean  // Both matching columns visible?
  doNotRereadItems:      boolean  // Teacher must NOT re-read items (already visible)
  doNotRereadOptions:    boolean  // Teacher must NOT read all options (already visible)
  referenceByNumber:     boolean  // Teacher should say "item 1" not the full text
  screenAwarenessNote:   string   // What the teacher should know about the screen state
}

export interface ExerciseFormatPolicy {
  exerciseType:       string
  supportStatus:      'supported' | 'postponed' | 'unsupported'
  runtimeMode:        string
  unsupportedReason?: string
  instructionPolicy:  TeacherInstructionPolicy
  demonstrationPolicy: DemonstrationPolicy
  expectedAnswerPolicy: ExpectedAnswerPolicy
  hintPolicy:         HintPolicy
  retryPolicy:        RetryPolicy
  frontendRenderPolicy: FrontendRenderPolicy
}

// ── Shared policy templates ───────────────────────────────────────────────────

const DETERMINISTIC_HINT: HintPolicy = {
  turnA: 'Ask ONE question targeting the exact grammar/vocabulary gap — e.g. "What form does the verb take with this subject?" Give zero part of the answer.',
  turnB: 'Give the pattern or rule — e.g. "With she/he/it, add -s to the verb. What does that give you here?" No direct word yet.',
  turnC: 'Give the start of the answer — first letter, first word, or auxiliary — to guide completion.',
  turnD: 'REVEAL: say the full correct answer + one-sentence rule + ask student to repeat the complete sentence.',
  revealOnTurn: 'D',
}

const MATCHING_HINT: HintPolicy = {
  turnA: 'Narrow the choice: "Which of these options is obviously wrong for [left item]? Eliminate it." Do NOT reveal the correct match yet.',
  turnB: 'REVEAL: "The correct match is [answer]." Confirm and immediately move to the next pair.',
  turnC: 'REVEAL: "The correct match is [answer]." Move on.',
  turnD: 'REVEAL: "The correct match is [answer]." Move on.',
  revealOnTurn: 'B',
}

const SOFT_HINT: HintPolicy = {
  turnA: 'Offer a sentence starter or vocabulary word: "You could start with: \'In my opinion...\'"',
  turnB: 'Give a broader prompt: "Think about [specific aspect]. What comes to mind?"',
  turnC: 'Give a fuller model: "For example, someone might say: [example response]. What about you?"',
  turnD: 'Accept any substantive response. Note one thing to improve. Move on.',
  revealOnTurn: 'D',
}

const DETERMINISTIC_RETRY: RetryPolicy = {
  maxRetries: 4,
  requireRepeatAfterReveal: true,
  escalationNotes: [
    'Turn A: identify the precise knowledge gap — verb form? word order? collocation? Ask about ONLY that.',
    'Turn B: change the framing — new angle, not the same question rephrased.',
    'Turn C: fill in almost everything — leave only the target word.',
    'Turn D: reveal fully — "The answer is [X]." Brief rule. "Now say the full sentence."',
  ],
}

const MATCHING_RETRY: RetryPolicy = {
  maxRetries: 2,
  requireRepeatAfterReveal: false,
  escalationNotes: [
    'Turn A: help eliminate one option by its category/relationship.',
    'Turn B: reveal immediately — do not linger on wrong matching answers.',
  ],
}

const SOFT_RETRY: RetryPolicy = {
  maxRetries: 2,
  requireRepeatAfterReveal: false,
  escalationNotes: [
    'If student gives one-word or filler: ask once for a fuller answer.',
    'If student gives any second response (however short): accept and complete exercise.',
    'Never ask a third time.',
  ],
}

const DETERMINISTIC_FRONTEND: FrontendRenderPolicy = {
  itemsVisible: true,
  optionsVisible: false,
  wordBoxVisible: false,
  matchingColumnsVisible: false,
  doNotRereadItems: true,
  doNotRereadOptions: false,
  referenceByNumber: false,
  screenAwarenessNote: 'Item text is already displayed — do NOT repeat it verbatim after first introduction.',
}

const WORDBOX_FRONTEND: FrontendRenderPolicy = {
  ...DETERMINISTIC_FRONTEND,
  optionsVisible: true,
  wordBoxVisible: true,
  doNotRereadOptions: true,
  screenAwarenessNote: 'Word bank is visible on screen — do NOT read out all words. Reference by saying "use one of the words in the box".',
}

const MATCHING_FRONTEND: FrontendRenderPolicy = {
  itemsVisible: true,
  optionsVisible: true,
  wordBoxVisible: false,
  matchingColumnsVisible: true,
  doNotRereadItems: true,
  doNotRereadOptions: true,
  referenceByNumber: true,
  screenAwarenessNote: 'Both columns are visible — do NOT read all items or all options. Reference by letter/number only.',
}

const MULTIPLE_CHOICE_FRONTEND: FrontendRenderPolicy = {
  itemsVisible: true,
  optionsVisible: true,
  wordBoxVisible: false,
  matchingColumnsVisible: false,
  doNotRereadItems: true,
  doNotRereadOptions: true,
  referenceByNumber: false,
  screenAwarenessNote: 'Options A/B/C are visible on screen — do NOT read them aloud. Say "look at the options on screen".',
}

const SOFT_FRONTEND: FrontendRenderPolicy = {
  itemsVisible: true,
  optionsVisible: false,
  wordBoxVisible: false,
  matchingColumnsVisible: false,
  doNotRereadItems: false,
  doNotRereadOptions: false,
  referenceByNumber: false,
  screenAwarenessNote: 'Speaking prompt is visible — you may paraphrase it, but do not repeat it word-for-word multiple times.',
}

// ── Registry ──────────────────────────────────────────────────────────────────

const REGISTRY: Record<string, ExerciseFormatPolicy> = {

  fill_gap: {
    exerciseType: 'fill_gap',
    supportStatus: 'supported',
    runtimeMode: 'deterministic_sequential',
    instructionPolicy: {
      openingTemplate: 'Exercise {N} — fill in one word per gap. Say just the missing word.',
      answerFormatSpec: 'Say ONLY the missing word — not the full sentence.',
      exampleScript: 'For example, if you see "She ___ to school every day" — the answer is "walks". Now try the first one.',
      briefRepeatReminder: 'Same format — one word per blank.',
      forbiddenAtIntro: [
        'Do not explain the grammar rule before the student attempts.',
        'Do not read the full item text if it is already visible.',
        'Do not ask for multiple items at once.',
      ],
    },
    demonstrationPolicy: {
      required: true,
      maxExamples: 1,
      exampleRule: 'Example MUST be a different sentence from item 1 — never demonstrate with the first live item.',
      whenToSkipDemo: 'Skip full demo if student has already completed this exercise type earlier in this session — give brief reminder only.',
      antiPatterns: [
        'Do not use item 1 as the example — student must attempt it independently.',
        'Do not give three examples — one is enough.',
        'Do not explain grammar before the example.',
        'Do not demo if student is already mid-exercise (itemIndex > 0 or correctionTurn is set).',
      ],
    },
    expectedAnswerPolicy: {
      format: 'single_word',
      answerDescription: 'Say just the missing word (or short phrase).',
      partialAnswerRule: 'Partial answer (e.g. full sentence when word was requested) counts as wrong format — treat as TURN A format correction.',
      voiceAdaptation: 'STT may capture full sentence — extract just the gap word before validating.',
    },
    hintPolicy: DETERMINISTIC_HINT,
    retryPolicy: DETERMINISTIC_RETRY,
    frontendRenderPolicy: DETERMINISTIC_FRONTEND,
  },

  choose_from_box: {
    exerciseType: 'choose_from_box',
    supportStatus: 'supported',
    runtimeMode: 'deterministic_sequential',
    instructionPolicy: {
      openingTemplate: 'Exercise {N} — choose the correct word from the box. The word bank is on screen.',
      answerFormatSpec: 'Say the word from the box that fits the gap.',
      exampleScript: 'For example, if the box has "go / went / going" and the sentence is "She ___ to school yesterday" — the answer is "went". Now look at the box and try the first sentence.',
      briefRepeatReminder: 'Same format — pick from the word bank on screen.',
      forbiddenAtIntro: [
        'Do not read out all words in the box — they are visible.',
        'Do not explain which word is correct before the student attempts.',
      ],
    },
    demonstrationPolicy: {
      required: true,
      maxExamples: 1,
      exampleRule: 'Use a word from the actual word bank in a different context sentence.',
      whenToSkipDemo: 'Skip if same type seen before — brief reminder only.',
      antiPatterns: [
        'Never read out all words in the box before student attempts.',
        'Never pre-select the correct word in your example.',
      ],
    },
    expectedAnswerPolicy: {
      format: 'single_word',
      answerDescription: 'Say the word from the box.',
      partialAnswerRule: 'If student says a word not in the box — correct and redirect.',
      voiceAdaptation: 'STT may capture sentence context — extract the gap word.',
    },
    hintPolicy: {
      ...DETERMINISTIC_HINT,
      turnA: 'Ask about the meaning or grammar: "What kind of word fits here — a verb? a noun? Look at the box — which one matches?" Give zero answer.',
      turnB: 'Narrow the box: "There are only two that could fit grammatically. Which one makes sense in this context?"',
    },
    retryPolicy: DETERMINISTIC_RETRY,
    frontendRenderPolicy: WORDBOX_FRONTEND,
  },

  complete_correct_form: {
    exerciseType: 'complete_correct_form',
    supportStatus: 'supported',
    runtimeMode: 'deterministic_sequential',
    instructionPolicy: {
      openingTemplate: 'Exercise {N} — complete with the correct form of the word in brackets.',
      answerFormatSpec: 'Say just the correct form of the word — not the full sentence.',
      exampleScript: 'For example: "She (walk) to school" → "walks". The base word is given — just use the right form. Try the first one.',
      briefRepeatReminder: 'Same format — correct form of the word in brackets.',
      forbiddenAtIntro: [
        'Do not state the grammar rule before student attempts.',
        'Do not simplify or rephrase the item text.',
      ],
    },
    demonstrationPolicy: {
      required: true,
      maxExamples: 1,
      exampleRule: 'Use a simple verb form example that matches the grammatical target of the section.',
      whenToSkipDemo: 'Skip if student has done this type before — say "same format as before — correct form of the bracketed word".',
      antiPatterns: [
        'Do not explain tense rules before the example.',
        'Do not give multiple examples.',
      ],
    },
    expectedAnswerPolicy: {
      format: 'single_word',
      answerDescription: 'Say just the correct form of the word.',
      partialAnswerRule: 'Full sentence answer: extract the target form before validating.',
      voiceAdaptation: 'STT often captures full sentence — extract inflected form only.',
    },
    hintPolicy: {
      ...DETERMINISTIC_HINT,
      turnA: 'Ask about what makes this form different: "What is the subject of the sentence? What tense are we using? What does that tell you about the verb form?"',
      turnB: 'Give the grammatical category: "For [subject] in [tense], the pattern is [verb + ending]. Apply that to [base word]."',
      turnC: 'Give the first letter(s): "It starts with [letters]... complete the word."',
    },
    retryPolicy: DETERMINISTIC_RETRY,
    frontendRenderPolicy: DETERMINISTIC_FRONTEND,
  },

  form_transformation: {
    exerciseType: 'form_transformation',
    supportStatus: 'supported',
    runtimeMode: 'deterministic_sequential',
    instructionPolicy: {
      openingTemplate: 'Exercise {N} — transform the sentence using the word given.',
      answerFormatSpec: 'Say the COMPLETE transformed sentence — all words.',
      exampleScript: 'For example: "I can swim. (ABLE)" → "I am able to swim." The meaning stays the same, only the structure changes. Try the first one.',
      briefRepeatReminder: 'Same format — complete transformed sentence, keep the meaning.',
      forbiddenAtIntro: [
        'Do not start transforming sentences yourself.',
        'Do not explain which grammar structure to use before the attempt.',
      ],
    },
    demonstrationPolicy: {
      required: true,
      maxExamples: 1,
      exampleRule: 'Example must use a DIFFERENT key word and sentence than item 1.',
      whenToSkipDemo: 'Brief reminder if seen before: "Same format — full transformed sentence."',
      antiPatterns: [
        'Do not demonstrate with item 1.',
        'Do not pre-reveal the transformation structure of item 1.',
      ],
    },
    expectedAnswerPolicy: {
      format: 'full_sentence',
      answerDescription: 'Say the complete transformed sentence.',
      partialAnswerRule: 'Incomplete sentence: treat as wrong — request the full sentence.',
      voiceAdaptation: 'Accept the full spoken sentence — STT should capture all words.',
    },
    hintPolicy: {
      ...DETERMINISTIC_HINT,
      turnA: 'Ask about the structure: "What grammar structure uses the word [KEY_WORD]? Think about what comes before and after it in a sentence."',
      turnB: 'Give the structural template: "The pattern is: [template with blank]. Now fill in the rest."',
      turnC: 'Give the first part of the sentence: "It starts with: [first half]... now complete it."',
    },
    retryPolicy: DETERMINISTIC_RETRY,
    frontendRenderPolicy: DETERMINISTIC_FRONTEND,
  },

  rewrite_sentence: {
    exerciseType: 'rewrite_sentence',
    supportStatus: 'supported',
    runtimeMode: 'deterministic_sequential',
    instructionPolicy: {
      openingTemplate: 'Exercise {N} — rewrite the sentence so it means the same thing, using the structure given.',
      answerFormatSpec: 'Say the complete rewritten sentence.',
      exampleScript: 'For example: "She didn\'t go to school." → rewritten as "She stayed at home." — same meaning, different words. Try the first one.',
      briefRepeatReminder: 'Same format — full sentence, same meaning.',
      forbiddenAtIntro: ['Do not rewrite item 1 yourself.'],
    },
    demonstrationPolicy: {
      required: true,
      maxExamples: 1,
      exampleRule: 'Use a simple sentence unrelated to item 1.',
      whenToSkipDemo: 'Brief reminder if repeat: "Same format — rewrite the sentence."',
      antiPatterns: ['Do not rewrite item 1 as the example.'],
    },
    expectedAnswerPolicy: {
      format: 'full_sentence',
      answerDescription: 'Say the full rewritten sentence.',
      partialAnswerRule: 'Incomplete: ask for the full sentence.',
      voiceAdaptation: 'Accept full spoken sentence.',
    },
    hintPolicy: DETERMINISTIC_HINT,
    retryPolicy: DETERMINISTIC_RETRY,
    frontendRenderPolicy: DETERMINISTIC_FRONTEND,
  },

  write_sentences_from_prompts: {
    exerciseType: 'write_sentences_from_prompts',
    supportStatus: 'supported',
    runtimeMode: 'soft_speaking',
    instructionPolicy: {
      openingTemplate: 'Exercise {N} — make a sentence using the words given. Say a complete sentence.',
      answerFormatSpec: 'Say a grammatically complete sentence using the given words.',
      exampleScript: 'For example: prompt "she / walk / every day" → "She walks to work every day." Try the first one.',
      briefRepeatReminder: 'Same format — one complete sentence.',
      forbiddenAtIntro: ['Do not make the sentence yourself.'],
    },
    demonstrationPolicy: {
      required: true,
      maxExamples: 1,
      exampleRule: 'Use a different word prompt than item 1.',
      whenToSkipDemo: 'Brief reminder if seen: "Same format — full sentence."',
      antiPatterns: ['Do not make the sentence for item 1 as the example.'],
    },
    expectedAnswerPolicy: {
      format: 'full_sentence',
      answerDescription: 'Say a complete sentence.',
      partialAnswerRule: 'Word list without sentence structure: gently ask for a full sentence.',
      voiceAdaptation: 'Accept natural spoken sentences.',
    },
    hintPolicy: SOFT_HINT,
    retryPolicy: SOFT_RETRY,
    frontendRenderPolicy: SOFT_FRONTEND,
  },

  reconstruction: {
    exerciseType: 'reconstruction',
    supportStatus: 'supported',
    runtimeMode: 'deterministic_sequential',
    instructionPolicy: {
      openingTemplate: 'Exercise {N} — put the words in the correct order to make a sentence.',
      answerFormatSpec: 'Say the complete sentence with words in the right order.',
      exampleScript: 'For example: "every / she / school / to / goes / day" → "She goes to school every day." Try the first one.',
      briefRepeatReminder: 'Same format — all words, correct order.',
      forbiddenAtIntro: ['Do not give the correct order for item 1.'],
    },
    demonstrationPolicy: {
      required: true,
      maxExamples: 1,
      exampleRule: 'Use scrambled words from a different sentence than item 1.',
      whenToSkipDemo: 'Brief reminder if seen: "Same format — correct word order."',
      antiPatterns: ['Do not unscramble item 1 as the example.'],
    },
    expectedAnswerPolicy: {
      format: 'full_sentence',
      answerDescription: 'Say all the words in the correct order.',
      partialAnswerRule: 'Missing words: ask student to include all given words.',
      voiceAdaptation: 'STT may mishear word boundaries — accept if meaning is clear.',
    },
    hintPolicy: {
      ...DETERMINISTIC_HINT,
      turnA: 'Ask about the sentence structure: "What comes first in an English sentence — the subject or the verb? Find the subject in these words."',
      turnB: 'Give the beginning: "Start with: [first 2-3 words]... now arrange the rest."',
      turnC: 'Give most of the sentence: "It\'s: [almost full sentence]... what\'s the last word?"',
    },
    retryPolicy: DETERMINISTIC_RETRY,
    frontendRenderPolicy: DETERMINISTIC_FRONTEND,
  },

  write_questions: {
    exerciseType: 'write_questions',
    supportStatus: 'supported',
    runtimeMode: 'deterministic_sequential',
    instructionPolicy: {
      openingTemplate: 'Exercise {N} — form a question from the information given.',
      answerFormatSpec: 'Say the complete question — including the question word and question mark intonation.',
      exampleScript: 'For example: "Someone phoned." → "Who phoned?" — no auxiliary needed for subject questions. Try the first one.',
      briefRepeatReminder: 'Same format — full question form.',
      forbiddenAtIntro: [
        'Do not form the question for item 1.',
        'Do not explain which question word to use before the attempt.',
      ],
    },
    demonstrationPolicy: {
      required: true,
      maxExamples: 1,
      exampleRule: 'Use a sentence clearly different from item 1. Show subject vs object question types if both appear.',
      whenToSkipDemo: 'Brief reminder if seen: "Same format — full question."',
      antiPatterns: ['Do not form item 1 as the example.'],
    },
    expectedAnswerPolicy: {
      format: 'full_sentence',
      answerDescription: 'Say the complete question.',
      partialAnswerRule: 'Statement instead of question: point out the structure difference.',
      voiceAdaptation: 'Accept rising intonation as question marker in STT.',
    },
    hintPolicy: {
      ...DETERMINISTIC_HINT,
      turnA: 'Ask about question structure: "Is this a subject question or an object question? What does that mean for \'do/does\'?"',
      turnB: 'Give the structural template: "For [subject/object] questions the structure is: [template]. Apply it."',
      turnC: 'Give the question word + auxiliary: "Start with: [question word + verb]... what comes next?"',
    },
    retryPolicy: DETERMINISTIC_RETRY,
    frontendRenderPolicy: DETERMINISTIC_FRONTEND,
  },

  error_correction: {
    exerciseType: 'error_correction',
    supportStatus: 'supported',
    runtimeMode: 'deterministic_sequential',
    instructionPolicy: {
      openingTemplate: 'Exercise {N} — find and correct the mistake in each sentence.',
      answerFormatSpec: 'Say the corrected sentence — the full sentence with the error fixed.',
      exampleScript: 'For example: "She don\'t like coffee." → "She doesn\'t like coffee." — third person needs "doesn\'t". Try the first one.',
      briefRepeatReminder: 'Same format — the corrected sentence.',
      forbiddenAtIntro: ['Do not point out where the error is before the student looks.'],
    },
    demonstrationPolicy: {
      required: true,
      maxExamples: 1,
      exampleRule: 'Use a simple example with a clear error, different from item 1.',
      whenToSkipDemo: 'Brief reminder if seen: "Same format — find and say the corrected sentence."',
      antiPatterns: ['Do not reveal the type of error before the student finds it.'],
    },
    expectedAnswerPolicy: {
      format: 'full_sentence',
      answerDescription: 'Say the corrected full sentence.',
      partialAnswerRule: 'Only naming the error without correcting: ask for the full corrected sentence.',
      voiceAdaptation: 'Accept spoken correction; extract the corrected form.',
    },
    hintPolicy: {
      ...DETERMINISTIC_HINT,
      turnA: 'Point to the error category — not the word: "Look at the verb — does it agree with the subject? Or is it the tense that\'s off?"',
      turnB: 'Identify the error location: "The problem is with [verb/noun/preposition]. What should it be?"',
      turnC: 'Give the correct element: "Change [wrong_word] to [correct_word]. Now say the full sentence."',
    },
    retryPolicy: DETERMINISTIC_RETRY,
    frontendRenderPolicy: DETERMINISTIC_FRONTEND,
  },

  matching: {
    exerciseType: 'matching',
    supportStatus: 'supported',
    runtimeMode: 'matching_sequential',
    instructionPolicy: {
      openingTemplate: 'Exercise {N} — match each item on the left with the correct option on the right. Both columns are on screen.',
      answerFormatSpec: 'Say the letter (A, B, C...) or the matching word/phrase.',
      exampleScript: 'The items and options are visible on screen — I\'ll ask one at a time. For example, if you had "1. cat" and options "A. barks / B. meows" — the answer would be B. Let\'s start with number 1.',
      briefRepeatReminder: 'Same format — say the letter or matching option for each one.',
      forbiddenAtIntro: [
        'Do not read all items and all options aloud — they are visible on screen.',
        'Do not ask for all matches at once.',
      ],
    },
    demonstrationPolicy: {
      required: false,
      maxExamples: 1,
      exampleRule: 'No separate demo needed — both columns visible. Just explain the format briefly.',
      whenToSkipDemo: 'Always skip full demo — the screen already shows the matching layout.',
      antiPatterns: [
        'Never read out all items and options.',
        'Never ask for all pairs simultaneously.',
      ],
    },
    expectedAnswerPolicy: {
      format: 'letter_choice',
      answerDescription: 'Say the letter (A, B, C...) or the matching text.',
      partialAnswerRule: 'If student gives multiple matches at once: accept first only, move sequentially.',
      voiceAdaptation: 'Accept letter or full text equivalent.',
    },
    hintPolicy: MATCHING_HINT,
    retryPolicy: MATCHING_RETRY,
    frontendRenderPolicy: MATCHING_FRONTEND,
  },

  vocabulary_matching: {
    exerciseType: 'vocabulary_matching',
    supportStatus: 'supported',
    runtimeMode: 'matching_sequential',
    instructionPolicy: {
      openingTemplate: 'Exercise {N} — match the words with their meanings. Both columns are on screen.',
      answerFormatSpec: 'Say the letter or the matching definition/word.',
      exampleScript: 'Items and options are on screen — one pair at a time. Let\'s start with number 1.',
      briefRepeatReminder: 'Same format — match each word with its meaning.',
      forbiddenAtIntro: ['Do not read all definitions aloud — they are visible.'],
    },
    demonstrationPolicy: {
      required: false,
      maxExamples: 1,
      exampleRule: 'No full demo needed — visible layout. Brief format explanation only.',
      whenToSkipDemo: 'Always skip full demo.',
      antiPatterns: ['Never read all definitions aloud.'],
    },
    expectedAnswerPolicy: {
      format: 'letter_choice',
      answerDescription: 'Say the letter or matching definition.',
      partialAnswerRule: 'Multiple matches at once: accept first only.',
      voiceAdaptation: 'Accept letter or paraphrase of matching text.',
    },
    hintPolicy: MATCHING_HINT,
    retryPolicy: MATCHING_RETRY,
    frontendRenderPolicy: MATCHING_FRONTEND,
  },

  collocations: {
    exerciseType: 'collocations',
    supportStatus: 'supported',
    runtimeMode: 'matching_sequential',
    instructionPolicy: {
      openingTemplate: 'Exercise {N} — find the word that collocates (goes naturally) with each word shown.',
      answerFormatSpec: 'Say the matching word or letter.',
      exampleScript: 'For example: "make ___" — the answer is "a decision" because we say "make a decision", not "do a decision". Options are on screen. Let\'s start.',
      briefRepeatReminder: 'Same format — collocation match.',
      forbiddenAtIntro: ['Do not reveal which words collocate before student tries.'],
    },
    demonstrationPolicy: {
      required: true,
      maxExamples: 1,
      exampleRule: 'Use a clear make/do or other collocation pair as example.',
      whenToSkipDemo: 'Brief reminder if seen: "Same format — matching collocations."',
      antiPatterns: ['Do not pre-explain all possible collocations.'],
    },
    expectedAnswerPolicy: {
      format: 'letter_choice',
      answerDescription: 'Say the collocating word or its letter.',
      partialAnswerRule: 'Accept the target collocation word in any reasonable form.',
      voiceAdaptation: 'Accept spoken collocation words.',
    },
    hintPolicy: {
      ...MATCHING_HINT,
      turnA: 'Ask about collocation rules: "Is it \'make\' + [word] or \'do\' + [word]? Think about fixed phrases."',
    },
    retryPolicy: MATCHING_RETRY,
    frontendRenderPolicy: MATCHING_FRONTEND,
  },

  find_opposites: {
    exerciseType: 'find_opposites',
    supportStatus: 'supported',
    runtimeMode: 'matching_sequential',
    instructionPolicy: {
      openingTemplate: 'Exercise {N} — match each word with its opposite. Options are on screen.',
      answerFormatSpec: 'Say the opposite word or its letter.',
      exampleScript: 'For example: "hot" opposite is "cold". Options are visible. Start with number 1.',
      briefRepeatReminder: 'Same format — opposite word.',
      forbiddenAtIntro: ['Do not give any opposites before student tries.'],
    },
    demonstrationPolicy: {
      required: false,
      maxExamples: 1,
      exampleRule: 'Use a trivially obvious antonym pair for the example.',
      whenToSkipDemo: 'Skip — format is self-evident with visible options.',
      antiPatterns: ['Do not pre-reveal opposites.'],
    },
    expectedAnswerPolicy: {
      format: 'letter_choice',
      answerDescription: 'Say the antonym word or its letter.',
      partialAnswerRule: 'Synonym instead of antonym: redirect clearly.',
      voiceAdaptation: 'Accept the spoken opposite word.',
    },
    hintPolicy: MATCHING_HINT,
    retryPolicy: MATCHING_RETRY,
    frontendRenderPolicy: MATCHING_FRONTEND,
  },

  replace_substitute_words: {
    exerciseType: 'replace_substitute_words',
    supportStatus: 'supported',
    runtimeMode: 'deterministic_sequential',
    instructionPolicy: {
      openingTemplate: 'Exercise {N} — replace the underlined word with a better synonym or the correct word.',
      answerFormatSpec: 'Say just the replacement word.',
      exampleScript: 'For example: "She was very *happy* about the news." → replace "happy" with a stronger word: "delighted". Try the first one.',
      briefRepeatReminder: 'Same format — replacement word only.',
      forbiddenAtIntro: ['Do not suggest the replacement before student tries.'],
    },
    demonstrationPolicy: {
      required: true,
      maxExamples: 1,
      exampleRule: 'Use a synonym substitution clearly different from item 1.',
      whenToSkipDemo: 'Brief reminder if seen: "Same format — replacement word."',
      antiPatterns: ['Do not reveal the correct word in your opening.'],
    },
    expectedAnswerPolicy: {
      format: 'single_word',
      answerDescription: 'Say the replacement word.',
      partialAnswerRule: 'Full sentence response: extract the target word.',
      voiceAdaptation: 'STT may capture sentence — extract the intended replacement.',
    },
    hintPolicy: DETERMINISTIC_HINT,
    retryPolicy: DETERMINISTIC_RETRY,
    frontendRenderPolicy: DETERMINISTIC_FRONTEND,
  },

  tick_cross: {
    exerciseType: 'tick_cross',
    supportStatus: 'supported',
    runtimeMode: 'deterministic_sequential',
    instructionPolicy: {
      openingTemplate: 'Exercise {N} — decide if each sentence is correct (tick) or incorrect (cross).',
      answerFormatSpec: 'Say "tick" (correct) or "cross" (incorrect) for each one.',
      exampleScript: 'For example: "She go to school every day." → cross — because it should be "goes". Try the first one.',
      briefRepeatReminder: 'Same format — tick or cross.',
      forbiddenAtIntro: ['Do not mark any items before student decides.'],
    },
    demonstrationPolicy: {
      required: true,
      maxExamples: 1,
      exampleRule: 'Use a simple example with clear error.',
      whenToSkipDemo: 'Brief reminder if seen: "Same format — tick or cross."',
      antiPatterns: ['Do not reveal answers before student decides.'],
    },
    expectedAnswerPolicy: {
      format: 'true_false_word',
      answerDescription: 'Say "tick" or "cross".',
      partialAnswerRule: 'Student says "correct/incorrect" — accept as tick/cross equivalent.',
      voiceAdaptation: 'Accept "yes/no", "right/wrong", "tick/cross" as valid.',
    },
    hintPolicy: {
      ...DETERMINISTIC_HINT,
      turnA: 'Draw attention to the error type: "Look at the verb — does it agree with the subject? Is the tense right?"',
      turnB: 'Narrow down: "If it\'s a tick, the grammar must be correct. If cross, find what\'s wrong."',
    },
    retryPolicy: DETERMINISTIC_RETRY,
    frontendRenderPolicy: DETERMINISTIC_FRONTEND,
  },

  true_false: {
    exerciseType: 'true_false',
    supportStatus: 'supported',
    runtimeMode: 'deterministic_sequential',
    instructionPolicy: {
      openingTemplate: 'Exercise {N} — decide if each statement is true or false.',
      answerFormatSpec: 'Say "true" or "false" for each statement.',
      exampleScript: 'For example: "The sun rises in the west." → false. Try the first statement.',
      briefRepeatReminder: 'Same format — true or false.',
      forbiddenAtIntro: ['Do not reveal answers.'],
    },
    demonstrationPolicy: {
      required: true,
      maxExamples: 1,
      exampleRule: 'Use an obvious factual statement as example.',
      whenToSkipDemo: 'Brief reminder if seen: "Same — true or false."',
      antiPatterns: ['Do not answer item 1 as example.'],
    },
    expectedAnswerPolicy: {
      format: 'true_false_word',
      answerDescription: 'Say "true" or "false".',
      partialAnswerRule: 'Accept "yes/no" or "correct/incorrect" as equivalent.',
      voiceAdaptation: 'Accept affirmative/negative equivalents.',
    },
    hintPolicy: {
      ...DETERMINISTIC_HINT,
      turnA: 'Ask what would make it true or false: "Think about whether this matches reality. Is there a word that makes the statement incorrect?"',
      turnB: 'Give context clue: "Look at [specific word]. Does that match what you know about [topic]?"',
    },
    retryPolicy: DETERMINISTIC_RETRY,
    frontendRenderPolicy: DETERMINISTIC_FRONTEND,
  },

  multiple_choice: {
    exerciseType: 'multiple_choice',
    supportStatus: 'supported',
    runtimeMode: 'deterministic_sequential',
    instructionPolicy: {
      openingTemplate: 'Exercise {N} — choose the correct answer. Options are on screen.',
      answerFormatSpec: 'Say the letter — A, B, or C (or the full option text).',
      exampleScript: 'For example, if you see "She ___ every day" with options A. go / B. goes / C. going — the answer is B. Options are visible on screen. Choose for number 1.',
      briefRepeatReminder: 'Same format — choose A, B, or C.',
      forbiddenAtIntro: [
        'Do not read all options aloud — they are visible.',
        'Do not explain which option is correct before the student chooses.',
      ],
    },
    demonstrationPolicy: {
      required: true,
      maxExamples: 1,
      exampleRule: 'Use a brief example with fictional options to show the format. Do NOT use item 1\'s actual options.',
      whenToSkipDemo: 'Brief reminder if seen: "Same — choose A, B, or C from the screen."',
      antiPatterns: [
        'Do not read out A/B/C options for item 1 before student chooses.',
        'Do not hint which letter is correct at introduction.',
      ],
    },
    expectedAnswerPolicy: {
      format: 'letter_choice',
      answerDescription: 'Say the letter A, B, or C (or the matching text).',
      partialAnswerRule: 'Multiple letters: treat as first letter only.',
      voiceAdaptation: 'Accept "the first one", "B", or the full option text.',
    },
    hintPolicy: {
      ...DETERMINISTIC_HINT,
      turnA: 'Ask about elimination: "Read the sentence mentally with each option. Which ones are grammatically impossible? Eliminate those."',
      turnB: 'Give grammar rule: "For [grammatical context], the correct form is [rule]. Which option matches?"',
      turnC: 'Narrow to two: "It\'s either A or B. Think about [specific difference]. Which one fits?"',
    },
    retryPolicy: DETERMINISTIC_RETRY,
    frontendRenderPolicy: MULTIPLE_CHOICE_FRONTEND,
  },

  speaking_prompt: {
    exerciseType: 'speaking_prompt',
    supportStatus: 'supported',
    runtimeMode: 'soft_speaking',
    instructionPolicy: {
      openingTemplate: 'Exercise {N} — [task prompt]. Speak freely — a few sentences is fine.',
      answerFormatSpec: 'Speak naturally. There\'s no single correct answer — just talk about the topic.',
      exampleScript: 'For example: if the task is "describe your morning routine" — you might say "I usually wake up at 7, then have breakfast..." Now you try.',
      briefRepeatReminder: 'Same format — speak freely about the topic.',
      forbiddenAtIntro: [
        'Do not demand perfect grammar.',
        'Do not say there is a correct answer.',
        'Do not give your own full answer as example for the live prompt.',
      ],
    },
    demonstrationPolicy: {
      required: false,
      maxExamples: 1,
      exampleRule: 'If demonstrating, use a different topic than the live prompt.',
      whenToSkipDemo: 'Usually skip — just present the prompt and invite student to speak.',
      antiPatterns: [
        'Do not give a long model answer for the exact live prompt.',
        'Do not over-scaffold with follow-up questions before student speaks.',
      ],
    },
    expectedAnswerPolicy: {
      format: 'free_speech',
      answerDescription: 'Any substantive speaking response.',
      partialAnswerRule: 'One-word or filler: ask ONCE for a fuller response. If student speaks more: accept and move on.',
      voiceAdaptation: 'Accept any spoken response that addresses the topic.',
    },
    hintPolicy: SOFT_HINT,
    retryPolicy: SOFT_RETRY,
    frontendRenderPolicy: SOFT_FRONTEND,
  },

  discussion: {
    exerciseType: 'discussion',
    supportStatus: 'supported',
    runtimeMode: 'soft_speaking',
    instructionPolicy: {
      openingTemplate: 'Exercise {N} — let\'s discuss: [topic]. What do you think?',
      answerFormatSpec: 'Share your opinion in a few sentences.',
      exampleScript: 'Just share your thoughts — any view is valid here. What\'s your take?',
      briefRepeatReminder: 'Same format — share your view.',
      forbiddenAtIntro: ['Do not share your own opinion first — invite the student.'],
    },
    demonstrationPolicy: {
      required: false,
      maxExamples: 1,
      exampleRule: 'Do not give your own opinion as a model for the live topic.',
      whenToSkipDemo: 'Almost always skip — just ask the question.',
      antiPatterns: ['Do not lead with your own stance before student speaks.'],
    },
    expectedAnswerPolicy: {
      format: 'free_speech',
      answerDescription: 'Any opinion expressed in a few sentences.',
      partialAnswerRule: 'One-word: ask once for more. Any second response: accept and move on.',
      voiceAdaptation: 'Accept any spoken response.',
    },
    hintPolicy: SOFT_HINT,
    retryPolicy: SOFT_RETRY,
    frontendRenderPolicy: SOFT_FRONTEND,
  },

  roleplay: {
    exerciseType: 'roleplay',
    supportStatus: 'supported',
    runtimeMode: 'soft_speaking',
    instructionPolicy: {
      openingTemplate: 'Exercise {N} — roleplay. You are [student role]. I\'ll play [teacher role]. Let\'s start.',
      answerFormatSpec: 'Speak as your character would. There\'s no script — just react naturally.',
      exampleScript: 'I\'ll set the scene: [context]. You start — what would you say?',
      briefRepeatReminder: 'Same format — stay in character and respond.',
      forbiddenAtIntro: ['Do not script both sides of the roleplay before starting.'],
    },
    demonstrationPolicy: {
      required: false,
      maxExamples: 1,
      exampleRule: 'Set the scene clearly — no separate demo needed.',
      whenToSkipDemo: 'Skip — just assign roles and start.',
      antiPatterns: ['Do not act out both roles before student participates.'],
    },
    expectedAnswerPolicy: {
      format: 'free_speech',
      answerDescription: 'In-character response to the situation.',
      partialAnswerRule: 'One-word: stay in role, react as the teacher character to elicit more.',
      voiceAdaptation: 'Accept any spoken in-character response.',
    },
    hintPolicy: SOFT_HINT,
    retryPolicy: SOFT_RETRY,
    frontendRenderPolicy: SOFT_FRONTEND,
  },

  show_interest_agree_disagree: {
    exerciseType: 'show_interest_agree_disagree',
    supportStatus: 'supported',
    runtimeMode: 'soft_speaking',
    instructionPolicy: {
      openingTemplate: 'Exercise {N} — react to what I say: show interest, agree, or disagree.',
      answerFormatSpec: 'Use natural phrases to show your reaction — "Really?", "I agree because...", "Actually, I think..."',
      exampleScript: 'For example, if I say "I love Mondays" — you might say "Really? I prefer Fridays!" Now I\'ll make a statement:',
      briefRepeatReminder: 'Same format — react naturally.',
      forbiddenAtIntro: ['Do not tell student which reaction to use.'],
    },
    demonstrationPolicy: {
      required: true,
      maxExamples: 1,
      exampleRule: 'Show all three reaction types in one example.',
      whenToSkipDemo: 'Brief reminder if seen: "Same format — show your reaction."',
      antiPatterns: ['Do not tell student to agree or disagree before presenting the statement.'],
    },
    expectedAnswerPolicy: {
      format: 'free_speech',
      answerDescription: 'A natural reaction phrase followed by a reason.',
      partialAnswerRule: 'Single "yes/no": ask for a fuller reaction with a phrase.',
      voiceAdaptation: 'Accept any natural spoken reaction.',
    },
    hintPolicy: SOFT_HINT,
    retryPolicy: SOFT_RETRY,
    frontendRenderPolicy: SOFT_FRONTEND,
  },

  brainstorm_60_second: {
    exerciseType: 'brainstorm_60_second',
    supportStatus: 'supported',
    runtimeMode: 'warmup_activation',
    instructionPolicy: {
      openingTemplate: 'Quick brainstorm — how many [topic] words can you say? Go!',
      answerFormatSpec: 'Say as many words/ideas as you can — speed counts here.',
      exampleScript: 'For example, for "kitchen words" — pot, pan, oven, fridge... Now try [actual topic]:',
      briefRepeatReminder: 'Same — brainstorm quickly.',
      forbiddenAtIntro: ['Do not correct grammar during the brainstorm.'],
    },
    demonstrationPolicy: {
      required: false,
      maxExamples: 1,
      exampleRule: 'Use a different topic category for the example.',
      whenToSkipDemo: 'Usually skip — just launch the brainstorm.',
      antiPatterns: ['Do not slow the brainstorm with corrections.'],
    },
    expectedAnswerPolicy: {
      format: 'free_speech',
      answerDescription: 'Any spoken words or ideas related to the topic.',
      partialAnswerRule: 'Even one word counts — encourage more if time allows.',
      voiceAdaptation: 'Accept rapid-fire spoken words.',
    },
    hintPolicy: SOFT_HINT,
    retryPolicy: SOFT_RETRY,
    frontendRenderPolicy: SOFT_FRONTEND,
  },

  show_what_you_know: {
    exerciseType: 'show_what_you_know',
    supportStatus: 'supported',
    runtimeMode: 'warmup_activation',
    instructionPolicy: {
      openingTemplate: 'Let\'s see what you already know about [topic]. What can you tell me?',
      answerFormatSpec: 'Share anything you know — words, rules, examples.',
      exampleScript: 'There\'s no wrong answer here — it\'s just activation. What comes to mind when you think about [topic]?',
      briefRepeatReminder: 'Same — show what you know.',
      forbiddenAtIntro: ['Do not test the student — just invite sharing.'],
    },
    demonstrationPolicy: {
      required: false,
      maxExamples: 1,
      exampleRule: 'No demo needed — just invite sharing.',
      whenToSkipDemo: 'Always skip — just ask.',
      antiPatterns: ['Do not correct knowledge claims during this activation phase.'],
    },
    expectedAnswerPolicy: {
      format: 'free_speech',
      answerDescription: 'Any shared knowledge about the topic.',
      partialAnswerRule: 'Accept anything — this is activation, not assessment.',
      voiceAdaptation: 'Accept any spoken response.',
    },
    hintPolicy: SOFT_HINT,
    retryPolicy: SOFT_RETRY,
    frontendRenderPolicy: SOFT_FRONTEND,
  },

  grammar_focus: {
    exerciseType: 'grammar_focus',
    supportStatus: 'supported',
    runtimeMode: 'grammar_explanation',
    instructionPolicy: {
      openingTemplate: 'Let\'s look at the grammar. [Grammar point explanation — 2-3 sentences max.] Quick check: [comprehension question]?',
      answerFormatSpec: 'Answer the check question — a word or short phrase is fine.',
      exampleScript: 'For example: for Present Simple, "She works here" → S + V(+s). Now: when do we add -s to the verb?',
      briefRepeatReminder: 'Let\'s check the grammar rule again.',
      forbiddenAtIntro: [
        'Do not lecture more than 3 sentences.',
        'Do not skip the comprehension check question.',
        'Do not proceed without a student response.',
      ],
    },
    demonstrationPolicy: {
      required: false,
      maxExamples: 1,
      exampleRule: 'One clear example showing the rule, then ask the check question.',
      whenToSkipDemo: 'N/A — grammar focus is always an explanation block.',
      antiPatterns: ['Do not turn grammar focus into a lecture without student participation.'],
    },
    expectedAnswerPolicy: {
      format: 'single_word',
      answerDescription: 'Answer the check question briefly.',
      partialAnswerRule: 'Incomplete or wrong: re-explain the key part once, then ask again.',
      voiceAdaptation: 'Accept spoken answer to the check question.',
    },
    hintPolicy: {
      ...DETERMINISTIC_HINT,
      turnA: 'Re-explain the key point that the student missed in one sentence.',
      turnB: 'Give a second example showing the rule.',
    },
    retryPolicy: { maxRetries: 2, requireRepeatAfterReveal: false, escalationNotes: ['Re-explain once, then move to practice exercise.'] },
    frontendRenderPolicy: {
      itemsVisible: true,
      optionsVisible: false,
      wordBoxVisible: false,
      matchingColumnsVisible: false,
      doNotRereadItems: false,
      doNotRereadOptions: false,
      referenceByNumber: false,
      screenAwarenessNote: 'Grammar box is displayed — refer to the structure shown on screen.',
    },
  },

  remember_this: {
    exerciseType: 'remember_this',
    supportStatus: 'supported',
    runtimeMode: 'teacher_explanation',
    instructionPolicy: {
      openingTemplate: 'Here\'s an important note: [content]. Does that make sense?',
      answerFormatSpec: 'Confirm you understand — say "yes" or ask a question.',
      exampleScript: 'Remember this — it comes up often: [rule]. For example: [example]. Clear?',
      briefRepeatReminder: 'Important note to remember:',
      forbiddenAtIntro: ['Do not skip the student acknowledgement.'],
    },
    demonstrationPolicy: {
      required: false,
      maxExamples: 1,
      exampleRule: 'One example illustrating the note.',
      whenToSkipDemo: 'N/A — this is a note block.',
      antiPatterns: ['Do not turn into a long explanation.'],
    },
    expectedAnswerPolicy: {
      format: 'free_speech',
      answerDescription: 'Acknowledgement or question.',
      partialAnswerRule: 'No response: ask "Does that make sense?" once.',
      voiceAdaptation: 'Accept "yes", "ok", or any acknowledgement.',
    },
    hintPolicy: SOFT_HINT,
    retryPolicy: SOFT_RETRY,
    frontendRenderPolicy: SOFT_FRONTEND,
  },
}

// ── Unsupported policy template ───────────────────────────────────────────────

function makeUnsupportedPolicy(exerciseType: string, reason: string): ExerciseFormatPolicy {
  return {
    exerciseType,
    supportStatus: 'postponed',
    runtimeMode: 'skipped',
    unsupportedReason: reason,
    instructionPolicy: {
      openingTemplate: 'This exercise requires unavailable resources.',
      answerFormatSpec: 'N/A',
      exampleScript: 'N/A',
      briefRepeatReminder: 'N/A',
      forbiddenAtIntro: [
        'Do not attempt or adapt this exercise.',
        'Do not describe what audio or image content would say.',
        'Do not invent vocabulary from skipped exercises.',
      ],
    },
    demonstrationPolicy: {
      required: false,
      maxExamples: 1,
      exampleRule: 'N/A',
      whenToSkipDemo: 'Always skip.',
      antiPatterns: ['Do not attempt this exercise in any adapted form.'],
    },
    expectedAnswerPolicy: {
      format: 'free_speech',
      answerDescription: 'N/A',
      partialAnswerRule: 'N/A',
      voiceAdaptation: 'N/A',
    },
    hintPolicy: { turnA: 'N/A', turnB: 'N/A', turnC: 'N/A', turnD: 'N/A', revealOnTurn: 'D' },
    retryPolicy: { maxRetries: 0, requireRepeatAfterReveal: false, escalationNotes: [] },
    frontendRenderPolicy: {
      itemsVisible: false, optionsVisible: false, wordBoxVisible: false,
      matchingColumnsVisible: false, doNotRereadItems: false, doNotRereadOptions: false,
      referenceByNumber: false, screenAwarenessNote: 'Exercise not rendered.',
    },
  }
}

// ── Fallback policy ───────────────────────────────────────────────────────────

const FALLBACK_POLICY = makeUnsupportedPolicy('unknown', 'Exercise type not recognized')

// ── Public API ────────────────────────────────────────────────────────────────

export function getExerciseFormatPolicy(exerciseType: string): ExerciseFormatPolicy {
  return REGISTRY[exerciseType] ?? FALLBACK_POLICY
}

export function isExerciseTypeSupported(exerciseType: string): boolean {
  const policy = REGISTRY[exerciseType]
  return policy?.supportStatus === 'supported'
}

export function getUnsupportedReason(exerciseType: string): string | null {
  const policy = REGISTRY[exerciseType]
  if (!policy || policy.supportStatus === 'supported') return null
  return policy.unsupportedReason ?? 'Exercise requires unavailable resources (audio/image/reading/writing).'
}

export function getTeacherInstructionPolicy(exerciseType: string): TeacherInstructionPolicy {
  return getExerciseFormatPolicy(exerciseType).instructionPolicy
}

export function getDemonstrationPolicy(exerciseType: string): DemonstrationPolicy {
  return getExerciseFormatPolicy(exerciseType).demonstrationPolicy
}

export function getExpectedAnswerPolicy(exerciseType: string): ExpectedAnswerPolicy {
  return getExerciseFormatPolicy(exerciseType).expectedAnswerPolicy
}

export function getHintPolicy(exerciseType: string): HintPolicy {
  return getExerciseFormatPolicy(exerciseType).hintPolicy
}

export function getRetryPolicy(exerciseType: string): RetryPolicy {
  return getExerciseFormatPolicy(exerciseType).retryPolicy
}

export function getFrontendRenderPolicy(exerciseType: string): FrontendRenderPolicy {
  return getExerciseFormatPolicy(exerciseType).frontendRenderPolicy
}
