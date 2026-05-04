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

function isRepetitionSpam(words: string[]): boolean {
  if (words.length < 4) return false
  const counts = new Map<string, number>()
  for (const w of words) {
    const key = w.toLowerCase()
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const maxCount = Math.max(...counts.values())
  // Any word repeated 3+ times in a 4+ word message
  if (maxCount >= 3) return true
  // Very few unique words relative to total (e.g. "big chicken big chicken big chicken")
  if (words.length >= 6 && counts.size / words.length < 0.45) return true
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
