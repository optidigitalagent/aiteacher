import type { DemoSession, FinalResult } from './lesson-engine.js'

// ─── Types ────────────────────────────────────────────────────────────────────

export type InputClass = 'VALID' | 'CONFUSED' | 'SHORT' | 'GIBBERISH'

export interface ClassifyResult {
  cls: InputClass
  reason: string
  message: string
}

// ─── Confusion phrase dictionary ──────────────────────────────────────────────

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

// ─── Input classifier (rule-based, zero AI cost) ──────────────────────────────

export function classifyInput(answer: string, minLength: number): ClassifyResult {
  const trimmed = answer.trim()
  const lower = trimmed.toLowerCase()
  const words = trimmed.split(/\s+/).filter(Boolean)

  // 1. Length
  if (trimmed.length < minLength) {
    const hint =
      words.length === 1
        ? `Give me a full sentence — try: "I really like ${words[0] ?? 'it'} because..."`
        : 'Write a bit more — at least one full sentence!'
    return { cls: 'SHORT', reason: 'below_min_length', message: hint }
  }

  // 2. Confusion detection (check before gibberish — confused messages have alpha)
  if (['?', 'what', 'huh', 'hmm', 'idk'].includes(lower)) {
    return {
      cls: 'CONFUSED',
      reason: 'single_word',
      message: 'No worries! Try a simple sentence — like "I think..." or "In my opinion...".',
    }
  }
  if (CONFUSION_PHRASES.some(p => lower.includes(p))) {
    return {
      cls: 'CONFUSED',
      reason: 'confusion_phrase',
      message: "No problem — answer in your own words. Even a simple sentence is great!",
    }
  }

  // 3. Full-string repeated single char: "aaaaaaa", "......."
  if (/^(.)\1{4,}$/.test(trimmed)) {
    return {
      cls: 'GIBBERISH',
      reason: 'repeated_char',
      message: "Looks like a test! Give me a real sentence — even a simple one counts.",
    }
  }

  // 4. Per-word repeated single char: "aaa bbb ccc"
  const repeatedCharWords = words.filter(w => w.length >= 2 && /^(.)\1+$/.test(w))
  if (repeatedCharWords.length >= Math.ceil(words.length * 0.6)) {
    return {
      cls: 'GIBBERISH',
      reason: 'repeated_char_words',
      message: "I can't follow that — write real English words!",
    }
  }

  // 5. All same word repeated: "ok ok ok ok"
  const uniqueWords = new Set(words.map(w => w.toLowerCase()))
  if (words.length >= 3 && uniqueWords.size === 1) {
    return {
      cls: 'SHORT',
      reason: 'single_word_repeat',
      message: "Try a full sentence — what do you actually think?",
    }
  }

  // 6. Low alpha ratio — mostly numbers/symbols
  const alphaCount = (trimmed.match(/[a-zA-Z]/g) ?? []).length
  if (trimmed.length > 8 && alphaCount / trimmed.length < 0.25) {
    return {
      cls: 'GIBBERISH',
      reason: 'low_alpha_ratio',
      message: "Please write in English — I can't follow symbols and numbers!",
    }
  }

  // 7. Low vowel ratio — keyboard consonant mash: "asdf ghj klq wer"
  const vowelCount = (trimmed.match(/[aeiouAEIOU]/g) ?? []).length
  if (alphaCount > 10 && vowelCount / alphaCount < 0.12) {
    return {
      cls: 'GIBBERISH',
      reason: 'low_vowel_ratio',
      message: "That doesn't look like English to me — try a real sentence!",
    }
  }

  // 8. Tiny character alphabet stretched over a long string
  const noSpaceChars = trimmed.replace(/\s+/g, '').toLowerCase()
  const uniqueChars = new Set(noSpaceChars.split(''))
  if (noSpaceChars.length > 15 && uniqueChars.size <= 4) {
    return {
      cls: 'GIBBERISH',
      reason: 'low_char_diversity',
      message: "I can't understand that — write real words please!",
    }
  }

  // 9. Too few words for tasks that require substance
  if (words.length <= 2 && minLength >= 10) {
    return {
      cls: 'SHORT',
      reason: 'too_few_words',
      message: "That's a start! Try 2–3 full sentences — I want to hear your actual ideas.",
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
    ? "I can see you're still finding your footing — that's completely normal! The full course starts exactly where you are and builds step by step, at your own pace."
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
