import type { DemoSession, FinalResult } from './lesson-engine.js'

// ─── Types ────────────────────────────────────────────────────────────────────

export type InputClass =
  | 'VALID'
  | 'VALID_WEAK_ENGLISH'
  | 'POSSIBLE_MEANING_UNCLEAR'
  | 'CONFUSED'
  | 'VOCAB_HELP'
  | 'SHORT'
  | 'GIBBERISH'
  | 'REPETITION_SPAM'

export interface ClassifyResult {
  cls: InputClass
  reason: string
  message: string
  correction?: string
}

// ─── Voice normalization result ───────────────────────────────────────────────
export interface VoiceNormResult {
  originalText: string
  normalizedText: string
  isVoiceLike: boolean
  confidence: 'high' | 'medium' | 'low'
  removedFiller: boolean
  hasMetaHelpInside: boolean
  reason: string
}

// ─── Answer quality result ────────────────────────────────────────────────────
export type AnswerQuality = 'valid' | 'weak' | 'meta_help' | 'spam'
export interface AnswerQualityResult {
  quality: AnswerQuality
  reason: string
  shouldAdvance: boolean
  suggestedResponse?: string
}

// ─── Lesson vocabulary: canonical name + misspelling aliases ──────────────────

const VOCAB_CANONICAL: Record<string, string> = {
  major: 'major', mager: 'major', majour: 'major',
  spoiler: 'spoiler', spoilers: 'spoiler', spoiller: 'spoiler', spoler: 'spoiler',
  recommend: 'recommend', recomend: 'recommend', reccomend: 'recommend',
  convince: 'convince', convise: 'convince', convice: 'convince',
  convinc: 'convince', convnce: 'convince', convise2: 'convince',
  scene: 'scene', sceen: 'scene',
  acting: 'acting',
  worth: 'worth', worht: 'worth',
  comedy: 'comedy', comedies: 'comedy', comdey: 'comedy', comidy: 'comedy',
  plot: 'plot',
  episode: 'episode',
  sequel: 'sequel',
  mechanic: 'mechanic', mechanics: 'mechanic',
  spoil: 'spoiler',
  // gaming topic words
  competitively: 'competitively', competitive: 'competitively', competitiv: 'competitively',
  mechanic2: 'mechanic',
  // general lesson words
  fluent: 'fluent', fluently: 'fluent',
  challenge: 'challenge', challenging: 'challenge',
  soak: 'soak_it_in',
}

// Multi-word phrase / idiom map (checked before single-word patterns)
const PHRASE_VOCAB_MAP: Record<string, string> = {
  'soak it in':  'soak_it_in',
  'soak it all': 'soak_it_in',
  'soak in':     'soak_it_in',
  'hold onto':   'hold_onto',
  'hold on to':  'hold_onto',
}

const VOCAB_EXPLANATIONS: Record<string, { explanation: string; example: string; taskHint: string }> = {
  major: {
    explanation: "'Major' means very important or big.",
    example: "In this task, 'without major spoilers' means: don't reveal the most important parts of the story.",
    taskHint: "Try again: describe one scene, but don't tell the ending.",
  },
  spoiler: {
    explanation: "A 'spoiler' is information that reveals key plot details before someone has seen the film or show.",
    example: "Example: 'Don't spoil the ending!' means don't tell me what happens.",
    taskHint: "Try again: describe a scene or moment, leaving out the ending.",
  },
  convince: {
    explanation: "'Convince' means to make someone believe something or want to do something.",
    example: "Example: 'This movie will convince you to watch more comedies.'",
    taskHint: "Try: 'You should watch ___ because ___.'"
  },
  recommend: {
    explanation: "'Recommend' means to suggest something you think is good for someone.",
    example: "Example: 'I recommend this film because the story is amazing.'",
    taskHint: "Try: 'I would recommend ___ because ___.'",
  },
  scene: {
    explanation: "A 'scene' is one moment or short sequence of action in a film or show.",
    example: "Example: 'There's a great scene where the hero finally confronts the villain.'",
    taskHint: "Try: 'There's a scene where ___ and it works because ___.'",
  },
  acting: {
    explanation: "'Acting' is the performance of the actors — how well they play their roles.",
    example: "Example: 'The acting in this film is incredible — the lead actor is very convincing.'",
    taskHint: "Try: 'The acting is great because the actor ___.'",
  },
  worth: {
    explanation: "'Worth' means deserving of your time, money, or effort.",
    example: "Example: 'This film is worth watching because the plot is original.'",
    taskHint: "Try: 'It's worth watching because ___.'",
  },
  comedy: {
    explanation: "A 'comedy' is a film or show that is funny and meant to make you laugh.",
    example: "Example: 'I love watching comedies when I want to relax.'",
    taskHint: "Try describing a comedy you've seen or would recommend.",
  },
  plot: {
    explanation: "The 'plot' is the story of a film or show — what happens from beginning to end.",
    example: "Example: 'The plot of this series is very complex — you need to pay attention.'",
    taskHint: "Try describing the plot in 1–2 sentences.",
  },
  episode: {
    explanation: "An 'episode' is one part of a TV series — like one chapter in a book.",
    example: "Example: 'I watched three episodes last night and couldn't stop.'",
    taskHint: "Try using the word in a full sentence.",
  },
  sequel: {
    explanation: "A 'sequel' is a second film or show that continues the story of the first.",
    example: "Example: 'The sequel was even better than the original.'",
    taskHint: "Try using the word in a full sentence.",
  },
  mechanic: {
    explanation: "A 'mechanic' in games means a rule or feature that controls how the game works.",
    example: "Example: 'The crafting mechanic lets you build your own weapons.'",
    taskHint: "Try describing a mechanic you like or want to design.",
  },
  competitively: {
    explanation: "'Competitively' means playing with the aim of winning — working seriously to be better than others.",
    example: "Example: 'I play this game competitively — I study strategies and compete online.'",
    taskHint: "Try answering: would you play it competitively, or is it more of a personal thing for you?",
  },
  fluent: {
    explanation: "Being 'fluent' in a language means you can speak it easily and naturally, without hesitating.",
    example: "Example: 'She speaks French fluently — she lived in Paris for years.'",
    taskHint: "Try using this in a sentence about your own language goals.",
  },
  challenge: {
    explanation: "A 'challenge' is something difficult that requires effort — but it's also an opportunity to improve.",
    example: "Example: 'Learning grammar is a challenge, but it gets easier with practice.'",
    taskHint: "Try describing a challenge you've faced or are facing.",
  },
  soak_it_in: {
    explanation: "'Soak it in' means to stop and fully enjoy a moment — taking it in emotionally, not rushing past it.",
    example: "'I just stood there and soaked it in' means: I stayed in that moment and really felt it completely.",
    taskHint: "So — did you do anything like that to hold onto the feeling?",
  },
  hold_onto: {
    explanation: "'Hold onto' something means to keep it, remember it, or not let it go.",
    example: "'I held onto that memory' means the memory stayed with me — I didn't forget it.",
    taskHint: "Try answering: what did you do to keep that feeling alive?",
  },
}

// ─── Confusion phrases ────────────────────────────────────────────────────────

const CONFUSION_PHRASES = [
  "i don't understand",
  "i dont understand",
  "don't understand",
  "dont understand",
  "i don't know",
  "i dont know",
  "no idea",
  "i'm confused",
  "im confused",
  "what do you mean",
  "i don't get",
  "i dont get",
  "not sure what",
  "can you help",
  "what should i write",
  "what should i say",
  "help me",
]

// ─── Vocabulary help detection ────────────────────────────────────────────────

export function detectVocabWord(text: string): string | null {
  const lower = text.toLowerCase().trim()

  // Multi-word phrase / idiom check — must run before single-word patterns
  const strippedLower = lower.replace(/[?!.,;:]+/g, '').trim()
  for (const [phrase, canonical] of Object.entries(PHRASE_VOCAB_MAP)) {
    if (strippedLower.includes(phrase)) return canonical
  }

  // "translate me X", "translate X", "translation of X", "translate this X"
  const translateMatch = lower.match(/^(?:translate(?:\s+me)?(?:\s+this)?|translation\s+of)\s+(?:a |an |the )?(\w+)/)
  if (translateMatch) {
    const word = translateMatch[1] ?? ''
    const canonical = VOCAB_CANONICAL[word]
    if (canonical) return canonical
    // Unknown word — signal confused so caller can give a generic help response
    return '__confused__'
  }

  // "how to say X", "how do I say X", "how do you say X", "how to use X"
  const howToSay = lower.match(/^how\s+(?:to\s+(?:say|use)|do\s+(?:i|you|we)\s+say)\s+(?:a |an |the )?(\w+)/)
  if (howToSay) {
    const word = howToSay[1] ?? ''
    return VOCAB_CANONICAL[word] ?? null
  }

  // Mixed language / Cyrillic: "Convince что это", "major что значит", "убедить"
  if (/[а-яёА-ЯЁ]/.test(text)) {
    const engToken = lower.match(/\b([a-z]{3,})\b/)
    if (engToken) {
      const canonical = VOCAB_CANONICAL[engToken[1] ?? '']
      if (canonical) return canonical
    }
    // Pure Russian or no known word — treat as confused
    return '__confused__'
  }

  // "what is major", "what is a major", "what's major", "what does major mean"
  const whatIs = lower.match(/^(?:what(?:'s| is| are| does?))\s+(?:a |an |the )?(\w+)/)
  if (whatIs) {
    const word = whatIs[1] ?? ''
    return VOCAB_CANONICAL[word] ?? null
  }

  // "major meaning", "major definition"
  const meaningOf = lower.match(/^(\w+)\s+(?:meaning|means?|definition|defined)/)
  if (meaningOf) {
    const word = meaningOf[1] ?? ''
    return VOCAB_CANONICAL[word] ?? null
  }

  // "I don't understand convince", "I don't understand what major means"
  const dontUnderstand = lower.match(/(?:don'?t|dont)\s+understand\s+(?:what\s+)?(?:a |an |the )?(\w+)/)
  if (dontUnderstand) {
    const word = dontUnderstand[1] ?? ''
    return VOCAB_CANONICAL[word] ?? null
  }

  // Single known vocab word with optional question mark: "convince?" or "major?"
  const singleWord = lower.match(/^([a-z]{3,})\?*$/)
  if (singleWord) {
    const word = singleWord[1] ?? ''
    return VOCAB_CANONICAL[word] ?? null
  }

  return null
}

export { VOCAB_EXPLANATIONS }

function buildVocabMessage(canonical: string): string {
  if (canonical === '__confused__') {
    return "No problem — try writing in English. Even a simple sentence like 'I think...' or 'I like...' works great."
  }
  const entry = VOCAB_EXPLANATIONS[canonical]
  if (!entry) return "Good question! Try a full sentence using that word."
  return `Good question. ${entry.explanation}\n${entry.example}\n${entry.taskHint}`
}

// ─── Student question detection ───────────────────────────────────────────────
// Detects when a student is asking about grammar or the task rather than answering.
// These patterns are unambiguously interrogative — no attempt content follows.
// Must be checked BEFORE classifyInput in speaking/writing steps.

const STUDENT_QUESTION_PATTERNS: RegExp[] = [
  /^why\s+is\s+(the\s+)?correct\s+answer/i,        // "why is the correct answer..."
  /^why\s+is\s+it\s+\w/i,                           // "why is it X"
  /^why\s+(did|is|does|do)\s+(you|the\s+answer)/i,  // "why did you say..."
  /^what\s+does\s+.{1,30}\s+mean/i,                 // "what does X mean"
  /^can\s+you\s+explain\b/i,                         // "can you explain..."
  /^what\s+is\s+(the\s+)?(grammar|rule|formula)\b/i,// "what is the grammar rule"
  /^i\s+don'?t\s+understand\s+why\b/i,              // "i don't understand why"
  /^how\s+(can|do)\s+i\s+(say|write|use|form)\b/i,  // "how can I say..."
]

export function detectStudentQuestion(text: string): boolean {
  const lower = text.toLowerCase().trim()
  return STUDENT_QUESTION_PATTERNS.some(p => p.test(lower))
}

// ─── Yes/no confirmation intent detection ────────────────────────────────────
// Used to interpret student responses during the unclear-meaning confirmation loop.

export function detectConfirmIntent(text: string): 'yes' | 'no' | 'unclear' {
  const lower = text.toLowerCase().trim()
  if (/^(yes|yeah|yep|yup|correct|right|exactly|that'?s\s+(it|right)|sure|of\s+course|absolutely|ок|да)\b/.test(lower)) return 'yes'
  if (/^(no|nope|not\s+really|nah|not\s+exactly|wrong|that'?s\s+not|not\s+that|not\s+quite)\b/.test(lower)) return 'no'
  return 'unclear'
}

// ─── Toxicity / directed-abuse detection ─────────────────────────────────────
// Catches racial slurs and explicit insults aimed at the teacher/system.
// Does NOT count toward abuse_flags — handled separately with a soft moderation reply.
// Caller: check BEFORE classifyInput for all text-input steps.

const TOXICITY_PATTERNS: RegExp[] = [
  // Racial slurs — standalone word check (broad catch)
  /\bnig+[ae]r?\b/i,
  /\b(wetback|spic|chink|gook|kike|cracker|coon)\b/i,
  /\b(faggot|f[a4]g+[o0]t|tranny)\b/i,
  // Directed insults at the teacher/AI/lesson — flexible word order
  /\b(stupid|dumb|fucking|shitty|retarded|idiotic)\s+\w*\s*(question|task|lesson|class|bot|ai|teacher)\b/i,
  /\byour\s+\w*\s*(stupid|dumb|fucking|shitty|retarded)\b/i,
  // Explicit profanity directed outward
  /\bfuck\s+(you|your|off|this)\b/i,
  /\b(go\s+fuck|fuck\s+this|fuck\s+off)\b/i,
  /\bshut\s+(up|the\s+fuck)\b/i,
]

export function detectToxicity(text: string): boolean {
  return TOXICITY_PATTERNS.some(p => p.test(text))
}

// ─── Word-salad pattern detection ─────────────────────────────────────────────
// Fires when the same low-content word appears twice in a row (broken structure,
// not intentional emphasis like "really really"). Real English words, wrong order.

const CONFUSION_REPEAT_WORDS = new Set([
  'some', 'like', 'kind', 'sort', 'thing', 'it', 'what',
  'that', 'a', 'the', 'this', 'ok', 'okay', 'and', 'so', 'but',
])

function hasWordSaladPattern(words: string[]): boolean {
  for (let i = 0; i < words.length - 1; i++) {
    const w1 = words[i]!.toLowerCase()
    const w2 = words[i + 1]!.toLowerCase()
    if (w1.length >= 2 && w1 === w2 && CONFUSION_REPEAT_WORDS.has(w1)) return true
  }
  return false
}

// ─── Repetition spam detection ────────────────────────────────────────────────
// Function words (articles, pronouns, modals, prepositions, conjunctions).
// These are deliberately excluded from spam counting — learner English
// naturally repeats "I would like to... I would like to..." without being spam.

const FUNCTION_WORDS_FOR_SPAM = new Set([
  'i', 'me', 'my', 'we', 'us', 'our', 'you', 'your', 'he', 'she', 'him', 'her',
  'it', 'its', 'they', 'them', 'their',
  'a', 'an', 'the',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'am',
  'to', 'of', 'in', 'on', 'at', 'by', 'for', 'with', 'from', 'into', 'about',
  'and', 'or', 'but', 'so', 'yet', 'nor',
  'that', 'this', 'these', 'those',
  'not', 'no', 'never', 'ever',
  'would', 'will', 'can', 'could', 'should', 'shall', 'may', 'might', 'must',
  'have', 'has', 'had', 'do', 'does', 'did',
  'there', 'here', 'also', 'just', 'very', 'really', 'quite',
])

function isRepetitionSpam(words: string[]): boolean {
  if (words.length < 4) return false

  const lowerWords = words.map(w => w.toLowerCase())
  const contentWords = lowerWords.filter(w => !FUNCTION_WORDS_FOR_SPAM.has(w))

  // If input has 4+ unique content words it carries real meaning — not spam.
  // Covers "I would like go to Bulgaria I would like to stay in hotel..." etc.
  const uniqueContent = new Set(contentWords)
  if (uniqueContent.size >= 4) return false

  // Count content-word repetitions only
  const contentCounts = new Map<string, number>()
  for (const w of contentWords) {
    contentCounts.set(w, (contentCounts.get(w) ?? 0) + 1)
  }

  // A content word repeated 4+ times = real spam ("free free free free chicken")
  if (contentCounts.size > 0 && Math.max(...contentCounts.values()) >= 4) return true

  // Very low vocabulary diversity across the whole message (fallback)
  const allCounts = new Map<string, number>()
  for (const w of lowerWords) allCounts.set(w, (allCounts.get(w) ?? 0) + 1)
  if (words.length >= 8 && allCounts.size / words.length < 0.35) return true

  return false
}

// ─── Double negative detection ────────────────────────────────────────────────

function detectDoubleNegative(text: string): string | null {
  const hasNegation = /\b(don'?t|doesn'?t|didn'?t|can'?t|won'?t|wasn'?t|haven'?t|hasn'?t|not)\b/i.test(text)
  if (!hasNegation) return null

  const hasDoubleNeg = /\b(nothing|nobody|nowhere|no one|never)\b/i.test(text)
  if (!hasDoubleNeg) return null

  let corrected = text
    .replace(/\bnothing\b/gi, 'anything')
    .replace(/\bnobody\b/gi, 'anybody')
    .replace(/\bnowhere\b/gi, 'anywhere')
    .replace(/\bno one\b/gi, 'anyone')

  // "I can't never" → "I can't ever" — only after negation
  if (/\b(don'?t|doesn'?t|didn'?t|can'?t|won'?t|wasn'?t|haven'?t|hasn'?t)\b/i.test(text)) {
    corrected = corrected.replace(/\bnever\b/gi, 'ever')
  }

  return corrected !== text ? corrected.trim() : null
}

// ─── Main classifier (rule-based, zero AI cost) ───────────────────────────────

export function classifyInput(answer: string, minLength: number): ClassifyResult {
  const trimmed = answer.trim()
  const lower = trimmed.toLowerCase()
  const words = trimmed.split(/\s+/).filter(Boolean)

  // 0. Prompt injection — blocked before any other check, no AI call, no abuse flag
  if (
    /ignore\s+(previous|all|above|prior|my|your|the)\s+(instructions?|prompts?|context|system)/i.test(trimmed) ||
    /you\s+are\s+(now\s+)?(a|an)\s+/i.test(trimmed) ||
    /(?:act|pretend|roleplay|behave)\s+(?:as|like)\s+/i.test(trimmed) ||
    /\bsystem\s+prompt\b/i.test(trimmed) ||
    /disregard\s+(all|previous|prior)\s+/i.test(trimmed)
  ) {
    console.log('[demo-ai] blocked reason=prompt_injection')
    return {
      cls: 'GIBBERISH',
      reason: 'prompt_injection',
      message: "I couldn't understand that — try one meaningful sentence.",
    }
  }

  // 1. Vocabulary help (highest priority — catches Cyrillic, "what is X", misspellings)
  const vocabWord = detectVocabWord(trimmed)
  if (vocabWord) {
    return {
      cls: 'VOCAB_HELP',
      reason: 'vocab_question',
      message: buildVocabMessage(vocabWord),
    }
  }

  // 2. Confusion detection (before length — confused messages have alpha)
  // Word-count guard: long messages that contain "I don't know" as a filler are speaking attempts,
  // not genuine confusion — let them fall through to word-salad or VALID.
  if (['?', 'what', 'huh', 'hmm', 'idk'].includes(lower)) {
    return {
      cls: 'CONFUSED',
      reason: 'single_word',
      message: 'No worries! Try a simple sentence — like "I think..." or "In my opinion...".',
    }
  }
  if (words.length <= 10 && CONFUSION_PHRASES.some(p => lower.includes(p))) {
    return {
      cls: 'CONFUSED',
      reason: 'confusion_phrase',
      message: "No problem — answer in your own words. Even a simple sentence is great!",
    }
  }

  // 3. Length
  if (trimmed.length < minLength) {
    const hint =
      words.length === 1
        ? `Give me a full sentence — try: "I really like ${words[0] ?? 'it'} because..."`
        : 'Write a bit more — at least one full sentence!'
    return { cls: 'SHORT', reason: 'below_min_length', message: hint }
  }

  // 4. Repetition spam: same word 3+ times or very low vocabulary diversity
  if (isRepetitionSpam(words)) {
    return {
      cls: 'REPETITION_SPAM',
      reason: 'word_repetition',
      message: "I couldn't understand that — try a real sentence.",
    }
  }

  // 5. Full-string repeated single character: "aaaaaaa"
  if (/^(.)\1{4,}$/.test(trimmed)) {
    return {
      cls: 'GIBBERISH',
      reason: 'repeated_char',
      message: "Looks like a test! Give me a real sentence — even a simple one counts.",
    }
  }

  // 6. Per-word repeated single char: "aaa bbb ccc"
  const repeatedCharWords = words.filter(w => w.length >= 2 && /^(.)\1+$/.test(w))
  if (repeatedCharWords.length >= Math.ceil(words.length * 0.6)) {
    return {
      cls: 'GIBBERISH',
      reason: 'repeated_char_words',
      message: "I can't follow that — write real English words!",
    }
  }

  // 7. All same single word: "ok ok ok ok" → repetition spam
  const uniqueWords = new Set(words.map(w => w.toLowerCase()))
  if (words.length >= 3 && uniqueWords.size === 1) {
    return {
      cls: 'REPETITION_SPAM',
      reason: 'single_word_repeat',
      message: "I couldn't understand that — try a real sentence.",
    }
  }

  // 8. Low alpha ratio — mostly numbers/symbols
  const alphaCount = (trimmed.match(/[a-zA-Z]/g) ?? []).length
  if (trimmed.length > 8 && alphaCount / trimmed.length < 0.25) {
    return {
      cls: 'GIBBERISH',
      reason: 'low_alpha_ratio',
      message: "Please write in English — I can't follow symbols and numbers!",
    }
  }

  // 9. Low vowel ratio — keyboard consonant mash: "asdf ghj klq"
  const vowelCount = (trimmed.match(/[aeiouAEIOU]/g) ?? []).length
  if (alphaCount > 10 && vowelCount / alphaCount < 0.12) {
    return {
      cls: 'GIBBERISH',
      reason: 'low_vowel_ratio',
      message: "That doesn't look like English to me — try a real sentence!",
    }
  }

  // 10. Tiny character alphabet over a long string
  const noSpaceChars = trimmed.replace(/\s+/g, '').toLowerCase()
  const uniqueChars = new Set(noSpaceChars.split(''))
  if (noSpaceChars.length > 15 && uniqueChars.size <= 4) {
    return {
      cls: 'GIBBERISH',
      reason: 'low_char_diversity',
      message: "I can't understand that — write real words please!",
    }
  }

  // 11. Double negative → VALID_WEAK_ENGLISH with correction (retry, not skip)
  const corrected = detectDoubleNegative(trimmed)
  if (corrected) {
    return {
      cls: 'VALID_WEAK_ENGLISH',
      reason: 'double_negative',
      message: `Almost. In English, we avoid double negatives here.\nBetter: "${corrected}"\nTry again — one more sentence about the topic.`,
      correction: corrected,
    }
  }

  // 12. Too few words for tasks requiring substance
  if (words.length <= 2 && minLength >= 10) {
    return {
      cls: 'SHORT',
      reason: 'too_few_words',
      message: "That's a start! Try 2–3 full sentences — I want to hear your actual ideas.",
    }
  }

  // 13. Word-salad pattern — real English words, broken structure (not spam, not short)
  //     Examples: "some some", "like like classmates" — POSSIBLE_MEANING_UNCLEAR, not GIBBERISH
  if (words.length >= 5 && hasWordSaladPattern(words)) {
    return {
      cls: 'POSSIBLE_MEANING_UNCLEAR',
      reason: 'word_salad',
      message: '',
    }
  }

  return { cls: 'VALID', reason: 'ok', message: '' }
}

// ─── Meta / presence-check intent detection ───────────────────────────────────
// Detects messages where the student is checking if the system is active, saying
// they didn't hear / misunderstood, or asking what to do — NOT attempting the task.
// These must NOT be graded or counted as task-attempt failures.
// Check BEFORE classifyInput in every answerable step.

const META_HELP_PATTERNS: RegExp[] = [
  // Presence checks: "are you there?", "hey are you here", "you there?"
  /^\s*(?:hey[\s,]*)?(?:are\s+you\s+(?:there|here)|you\s+there)\s*[?!.]*\s*$/i,
  // Didn't / couldn't hear
  /\bi\s+(?:didn'?t|couldn'?t|can'?t)\s+(?:hear|get|understand)\b/i,
  /\b(?:didn'?t|couldn'?t)\s+hear\s+(?:you|the\s+question|it)\b/i,
  // Asking to repeat
  /\b(?:can\s+you\s+(?:repeat|say\s+that\s+again|ask\s+(?:me\s+)?again)|please\s+repeat|repeat\s+(?:the\s+)?question)\b/i,
  // Misunderstood / student says they were misunderstood
  /\byou\s+(?:mis+under(?:stood|stand)|didn'?t\s+under(?:stand|stood)|didn'?t\s+hear\s+me|don'?t\s+(?:hear|understand)\s+me)\b/i,
  /\bthat(?:'s|\s+is)\s+not\s+what\s+i\s+(?:said|meant)\b/i,
  /\byou\s+(?:a\s+)?little\s+bit\s+don'?t\s+hear\b/i,
  // What is the question / what do I do
  /\bwhat\s+(?:is|was)\s+(?:the\s+)?question\s*\??/i,
  /\bwhat\s+(?:should|do)\s+i\s+(?:answer|write|say|do)\s*\??$/i,
  /\bi\s+(?:didn'?t|couldn'?t)\s+(?:hear|get|understand)\s+(?:the\s+)?(?:question|task|prompt)\b/i,
  // Don't understand the question (standalone — distinguishes from mixed answer+help)
  /\bi\s+don'?t\s+understand\s+(?:the\s+)?(?:question|task)\s*[?!.]*$/i,
  // "I don't understand the question(s)..." — student continues talking after stating confusion
  /^i\s+don'?t\s+understand\s+(?:the\s+)?questions?\b/i,
  // "I don't understand what you mean by..." — explicit confusion about a phrase in the prompt
  /^i\s+don'?t\s+understand\s+what\s+(?:you\s+)?(?:mean|meant)\b/i,
  // "I don't understand how to..." — asking for task clarification
  /^i\s+don'?t\s+understand\s+how\s+to\b/i,
]

export function detectMetaHelpIntent(text: string): boolean {
  const lower = text.toLowerCase().trim()
  // Standalone: "hello", "hi", "hey" with nothing else
  if (/^(?:hello+|hi+|hey+)[?.!,\s]*$/.test(lower)) return true
  return META_HELP_PATTERNS.some(p => p.test(text))
}

// ─── Voice transcript normalization ──────────────────────────────────────────
// Detects thinking-aloud voice input and extracts the student's final intended
// answer. Returns a structured VoiceNormResult with confidence and meta-help flag.

const VOICE_FILLER_SET = new Set([
  'okay', 'ok', 'so', 'um', 'uh', 'hmm', 'hm', 'well', 'like',
  'right', 'alright', 'just', 'yeah', 'yep', 'nah', 'now',
  'something', 'small', 'wait', 'hold', 'let',
])

const FILLER_PREFIX_RE =
  /^(?:okay|ok|so+|um+|uh+|hmm*|hm+|well|right|alright|let\s+me|wait|one\s+second|hold\s+on|yeah|yep|something\s+small|just|now|i\s+want\s+to|i\s+am\s+going|one\s+sec(?:ond)?)\s+/i

const I_VERB_TOKENS = new Set([
  'was','am','were','would','could','have','had','feel','felt',
  'think','thought','saw','see','want','wanted','like','liked',
  'love','loved','enjoy','enjoyed','found','did','do','went','go',
  'can','will','try','tried','made','make',
])

// Help phrases that might appear embedded inside a real answer
const HELP_INSIDE_PATTERNS: RegExp[] = [
  /\bcan\s+you\s+help\s+me\b/i,
  /\bhelp\s+me\b/i,
  /\bi\s+need\s+help\b/i,
  /\bplease\s+help\b/i,
]

// Explicit final-answer markers — checked before voice-like heuristics.
// match.index > 3 required so marker must be preceded by at least a few chars.
const FINAL_ANSWER_MARKERS: Array<{ re: RegExp; reason: string }> = [
  { re: /\bmy\s+answer\s+is\s+/i,            reason: 'marker_my_answer' },
  { re: /\bmy\s+sentence\s+is\s+/i,          reason: 'marker_my_sentence' },
  { re: /\bthe\s+sentence\s+is\s+/i,         reason: 'marker_the_sentence' },
  { re: /\bwhat\s+i\s+mean\s+is\s+/i,        reason: 'marker_what_i_mean' },
  { re: /\bi\s+would\s+say\s+(?:that\s+)?/i, reason: 'marker_i_would_say' },
  { re: /\bi\s+mean\s+/i,                    reason: 'marker_i_mean' },
  { re: /\bactually\s+/i,                    reason: 'marker_actually' },
]

export function normalizeVoiceTranscript(answer: string): VoiceNormResult {
  const originalText = answer.trim()
  const words = originalText.split(/\s+/).filter(Boolean)

  // Help phrase embedded inside a longer answer (not a standalone help request)
  const hasMetaHelpInside =
    words.length > 5 && HELP_INSIDE_PATTERNS.some(p => p.test(originalText))

  if (words.length < 5) {
    return {
      originalText, normalizedText: originalText,
      isVoiceLike: false, confidence: 'high',
      removedFiller: false, hasMetaHelpInside: false,
      reason: 'too_short_to_normalize',
    }
  }

  // 1. Final-answer markers — highest priority, works regardless of isVoiceLike.
  //    Requires content before the marker (index > 3).
  for (const { re, reason } of FINAL_ANSWER_MARKERS) {
    const match = originalText.match(re)
    if (match && match.index !== undefined && match.index > 3) {
      const afterMarker = originalText.slice(match.index + match[0].length).trim()
      if (afterMarker.split(/\s+/).length >= 3) {
        return {
          originalText, normalizedText: afterMarker,
          isVoiceLike: true, confidence: 'high',
          removedFiller: true, hasMetaHelpInside,
          reason,
        }
      }
    }
  }

  // 2. Detect isVoiceLike
  const firstWord = (words[0] ?? '').toLowerCase()
  const startsWithFiller = VOICE_FILLER_SET.has(firstWord)
  const prefixLen = Math.max(3, Math.ceil(words.length * 0.40))
  const prefixWords = words.slice(0, prefixLen)
  const fillerCount = prefixWords.filter(w => VOICE_FILLER_SET.has(w.toLowerCase())).length
  const isVoiceLike = startsWithFiller || fillerCount / prefixLen >= 0.30

  if (!isVoiceLike) {
    return {
      originalText, normalizedText: originalText,
      isVoiceLike: false, confidence: 'high',
      removedFiller: false, hasMetaHelpInside,
      reason: 'not_voice_like',
    }
  }

  // 3. Last "I [personal-verb]" clause — walk backwards, take first that's ≥ 6 words
  const iPositions: number[] = []
  for (let i = 0; i < words.length - 1; i++) {
    if (words[i] === 'I' && I_VERB_TOKENS.has((words[i + 1] ?? '').toLowerCase())) {
      iPositions.push(i)
    }
  }
  for (let k = iPositions.length - 1; k >= 0; k--) {
    const pos = iPositions[k]!
    const segment = words.slice(pos).join(' ')
    if (segment.split(/\s+/).length >= 6) {
      return {
        originalText, normalizedText: segment,
        isVoiceLike: true, confidence: 'medium',
        removedFiller: true, hasMetaHelpInside,
        reason: 'last_i_verb_clause',
      }
    }
  }
  if (iPositions.length > 0) {
    const lastPos = iPositions[iPositions.length - 1]!
    const segment = words.slice(lastPos).join(' ')
    if (segment.split(/\s+/).length >= 4) {
      return {
        originalText, normalizedText: segment,
        isVoiceLike: true, confidence: 'medium',
        removedFiller: true, hasMetaHelpInside,
        reason: 'last_i_verb_clause_short',
      }
    }
  }

  // 4. Strip leading filler tokens iteratively (guard: don't remove > 60% of original)
  let cleaned = originalText
  let changed = true
  while (changed) {
    changed = false
    const m = cleaned.match(FILLER_PREFIX_RE)
    if (m && m[0].length < originalText.length * 0.60) {
      cleaned = cleaned.slice(m[0].length)
      changed = true
    }
  }
  cleaned = cleaned.trim()

  if (cleaned.length >= 10 && cleaned !== originalText) {
    const confidence = cleaned.split(/\s+/).length >= 5 ? 'medium' : 'low'
    return {
      originalText, normalizedText: cleaned,
      isVoiceLike: true, confidence,
      removedFiller: true, hasMetaHelpInside,
      reason: 'filler_prefix_stripped',
    }
  }

  // 5. Could not extract cleanly — low confidence, keep original
  return {
    originalText, normalizedText: originalText,
    isVoiceLike: true, confidence: 'low',
    removedFiller: false, hasMetaHelpInside,
    reason: 'extraction_failed',
  }
}

// ─── Weak-answer quality gate (rule-based, zero AI cost) ─────────────────────
// Runs BEFORE AI evaluation on VALID-classified answers.
// Catches content-free answers that pass classifyInput's length/alphabet checks.

const WEAK_GATE_FILLERS = new Set([
  'okay','ok','so','um','uh','hmm','hm','well','like','right',
  'alright','just','yeah','yep','now','something','wait','hold',
  'maybe','perhaps','kind','sort','type','one','last',
])

const CONTENT_VERBS = new Set([
  'like','love','enjoy','think','feel','want','have','know',
  'see','watch','play','do','go','make','makes','made','work','works','worked',
  'study','learn','practice','try','help','use','find','get','become','start',
  'finish','remember','prefer','recommend','believe','understand',
  'explain','change','improve','teach','write','read','speak',
  'listen','proud','excited','interested','focus',
  'choose','chose','pick','decided','decide','felt',
  'saw','was','were','am','are','had','did','does',
  'seen','shown','given','taken','done','means','makes','keeps',
])

const VAGUE_NOUNS = new Set([
  'topic','subject','thing','stuff','it','this','that','one','something',
  'anything','everything','nothing','way','kind','type','sort',
])

function hasContentVerb(words: string[]): boolean {
  return words.some(w => CONTENT_VERBS.has(w.toLowerCase()))
}

function allVagueContent(words: string[]): boolean {
  const content = words.filter(w => {
    const l = w.toLowerCase()
    return !WEAK_GATE_FILLERS.has(l) && l.length > 2
  })
  if (content.length === 0) return true
  return content.every(w => VAGUE_NOUNS.has(w.toLowerCase()))
}

export function analyzeAnswerQuality(
  answer: string,
  stepKey: string,
): AnswerQualityResult {
  const trimmed = answer.trim()
  const lower = trimmed.toLowerCase()
  const words = trimmed.split(/\s+/).filter(Boolean)

  // META_HELP — already caught upstream but guard here too
  if (detectMetaHelpIntent(trimmed)) {
    return { quality: 'meta_help', reason: 'meta_help_intent', shouldAdvance: false }
  }

  // All words are filler — no real content at all
  if (words.length > 0 && words.every(w => WEAK_GATE_FILLERS.has(w.toLowerCase()))) {
    return {
      quality: 'weak', reason: 'all_fillers', shouldAdvance: false,
      suggestedResponse: `Try saying something real — even one sentence is great. Start with "I…"`,
    }
  }

  // Very short + no content verb
  if (words.length <= 4 && !hasContentVerb(words)) {
    return {
      quality: 'weak', reason: 'too_short_no_verb', shouldAdvance: false,
      suggestedResponse: `Give me a full sentence — what do you actually think? Try: "I think… because…"`,
    }
  }

  // High filler density in short answers (> 50%)
  if (words.length <= 8) {
    const fillerCount = words.filter(w => WEAK_GATE_FILLERS.has(w.toLowerCase())).length
    if (fillerCount / words.length > 0.50) {
      return {
        quality: 'weak', reason: 'high_filler_density', shouldAdvance: false,
        suggestedResponse: `I need a real sentence — not just filler words. What's your actual answer?`,
      }
    }
  }

  // "I don't know" without real follow-on — catches short standalone AND longer voice fillers
  // that end with "I don't know" as a conclusion (e.g. "private like I would describe it like I don't know").
  if (/\bi\s+don'?t\s+know\b/i.test(lower)) {
    // Short form: still clear non-answer
    if (words.length <= 6) {
      return {
        quality: 'weak', reason: 'i_dont_know_no_attempt', shouldAdvance: false,
        suggestedResponse: `Even a guess is great — try "I think…" and give me one idea.`,
      }
    }
    // Longer form: check whether it ends with "I don't know" and has no real content before it
    const endsWithIDontKnow = /\bi\s+don'?t\s+know\s*[.!,]?\s*$/i.test(lower)
    if (endsWithIDontKnow) {
      const beforePhrase = lower.replace(/\bi\s+don'?t\s+know\s*[.!,]?\s*$/, '').trim()
      // Count content words (length > 3, not fillers) — < 4 means the student gave no real answer
      const realWords = beforePhrase.split(/\s+/).filter(
        w => w.length > 3 && !WEAK_GATE_FILLERS.has(w),
      )
      if (realWords.length < 4) {
        return {
          quality: 'weak', reason: 'i_dont_know_conclusion', shouldAdvance: false,
          suggestedResponse: `I hear you're not sure. Try this: "I would describe it as..." — say it in your own words.`,
        }
      }
    }
  }

  // Only vague nouns, no real verb — e.g. "is about yeah topic make self", "last one schedule rules"
  if (allVagueContent(words) && !hasContentVerb(words)) {
    return {
      quality: 'weak', reason: 'vague_content_no_verb', shouldAdvance: false,
      suggestedResponse: `I can see you have an idea — but I need a full sentence. Try: "I think… because…"`,
    }
  }

  // For graded steps: fragment with no subject pronoun + short
  if (stepKey === 'speaking_task' || stepKey === 'writing_task') {
    const hasSubject = /\b(i|me|we|my|us|it|this|they|he|she|you)\b/i.test(trimmed)
    if (!hasSubject && words.length <= 6) {
      return {
        quality: 'weak', reason: 'no_subject_short_fragment', shouldAdvance: false,
        suggestedResponse: `I need a proper sentence — start with "I…" and tell me what you actually think.`,
      }
    }
  }

  return { quality: 'valid', reason: 'ok', shouldAdvance: true }
}

// ─── Early-termination result builder ────────────────────────────────────────

export function buildEarlyResult(session: DemoSession, dueToAbuse: boolean): FinalResult {
  const speakScore =
    typeof session.scores['speaking_task']?.score === 'number'
      ? (session.scores['speaking_task'].score as number)
      : 0
  const writeScore =
    typeof session.scores['writing_task']?.score === 'number'
      ? (session.scores['writing_task'].score as number)
      : 0
  const hasPartial = speakScore > 0 || writeScore > 0
  const rawScore = hasPartial ? Math.round(((speakScore + writeScore) / 2) * 10) : 50

  const teacherMessage = dueToAbuse
    ? "Let's stop here for now. You can come back when you're ready to practise seriously."
    : "You've been putting in real effort today. The full course is where we build on this together — I'll give you personalised practice to level up fast."

  return {
    level: rawScore >= 55 ? 'B1' : 'A2',
    score: Math.max(40, rawScore),
    strengths: [
      'showing up to practise',
      hasPartial ? 'expressing ideas in English' : 'taking the first step',
    ],
    areas_to_improve: ['answer depth', 'grammar accuracy'],
    teacher_message: teacherMessage,
  }
}
