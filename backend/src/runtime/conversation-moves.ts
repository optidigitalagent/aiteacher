// Conversational Teacher Moves — Phase 2D
//
// Deterministic phrase selection for human, curious, emotionally-aware teacher responses.
// Zero AI calls. Zero DB/Redis ops. In-process only.
//
// Design:
//   • Zero extra AI calls
//   • Zero DB/Redis ops
//   • No raw student text stored — phrases selected by index only
//   • Best-effort — never throws into lesson runtime

import { recordTraceEvent } from './trace-recorder.js'
import type { ConversationContinuityState } from './conversation-continuity.js'

// ── Topic-aware reactions ─────────────────────────────────────────────────────
// Short one-liners showing the teacher registered the student's topic.

const TOPIC_REACTIONS: Record<string, string[]> = {
  youtube: [
    "YouTube is a solid context — there's a lot of real English there.",
    "YouTube covers everything now — good frame for today.",
    "Good — YouTube has a wide range of English styles to draw from.",
  ],
  gaming: [
    "Games are a real communicative context — good to work with.",
    "Gaming has its own vocabulary worth knowing — useful here.",
    "Good choice. Games create real situational language.",
  ],
  films: [
    "Films are great for this — emotional language, natural scenes.",
    "Good. Cinema gives you authentic language and real situations.",
    "Movies are a solid frame — a lot of natural English to draw from.",
  ],
  music: [
    "Music is a strong choice — lyrics carry a lot of natural English.",
    "Good — music gives you rhythm and vocabulary at once.",
  ],
  sports: [
    "Sports give you competitive and descriptive language — useful.",
    "Good. Sports coverage is full of natural spoken English.",
  ],
  technology: [
    "Tech is a useful context — fast-moving, real communication needs.",
    "Good. The tech world has its own register worth knowing.",
  ],
  history: [
    "History gives you strong narrative language — cause, effect, sequence.",
    "Good context. History requires precise descriptive English.",
  ],
  maths: [
    "Maths is useful here — you already think in patterns and logic.",
    "Good. That kind of analytical thinking transfers to language.",
  ],
  physics: [
    "Physics is a great frame — cause, effect, explanation.",
    "Good context. Physics demands clear, precise English.",
  ],
  biology: [
    "Biology gives you good descriptive and process language.",
    "Good. Science topics build precise vocabulary naturally.",
  ],
  chemistry: [
    "Chemistry is interesting — cause and effect in everything.",
    "Good. Scientific contexts build careful, specific language.",
  ],
}

// ── Topic-aware curiosity followups ──────────────────────────────────────────
// Specific questions showing genuine interest. Never pretend deep memory.

const TOPIC_CURIOUS_FOLLOWUPS: Record<string, string[]> = {
  youtube: [
    "What kind of content takes up most of your YouTube time?",
    "Is it mainly background watching, or do you actually sit down and focus?",
    "What does YouTube give you that you couldn't get anywhere else?",
  ],
  gaming: [
    "Is it more of a solo thing, or do you play with others?",
    "How much of the appeal is the challenge of getting better vs just playing?",
    "Would you ever play it competitively, or is it purely personal?",
  ],
  films: [
    "Do you usually watch alone or with someone — does it change the experience?",
    "What's the last film that actually made you think about it afterward?",
    "Is it something you watch properly or more as background?",
  ],
  music: [
    "Is music something you sit with properly, or more of a background thing?",
    "What's the last song that genuinely stuck with you?",
    "Is there a genre you always go back to when nothing else works?",
  ],
  sports: [
    "Is it something you actively play or mostly watch?",
    "What does sport give you emotionally that other entertainment doesn't?",
    "Would you say it's more about the result or the experience of watching it live?",
  ],
  technology: [
    "Is it more professional interest or personal curiosity?",
    "What part of tech actually interests you — building it, understanding it, or just using it?",
    "Is there a specific area of tech you follow closely?",
  ],
  history: [
    "Is there a particular period or region of history that draws you in?",
    "Is it more about the events themselves, or trying to understand why they happened?",
  ],
  maths: [
    "Is there a specific area of maths that you actually enjoy, or does it depend on the topic?",
    "What's the part that feels satisfying when it clicks?",
  ],
}

// Generic curious followups — used when topic is unknown or generic
const GENERIC_CURIOUS_FOLLOWUPS: string[] = [
  "What's the specific part of that you enjoy most?",
  "What keeps you coming back to it?",
  "What would you say makes it interesting to you personally?",
  "Is it something you'd actually recommend to someone else?",
  "How long have you been into that?",
]

// ── Expansion softeners ───────────────────────────────────────────────────────
// Replaces "Tell me more" / "I need 2–3 sentences" with specific, human prompts.

const EXPANSION_SOFTENERS: string[] = [
  "Give me one real detail — something specific you actually remember.",
  "What happened after that?",
  "What's the part that actually stuck with you?",
  "Walk me through that a bit more.",
  "Why did that part stand out to you?",
  "What made it worth remembering?",
  "What's the most specific thing you can say about it?",
  "Give me one concrete reason behind that.",
]

// ── Short-answer reaction prompts ─────────────────────────────────────────────
// Replaces "Tell me a bit more — give me a full sentence with your actual reasoning."

const SHORT_ANSWER_REACTIONS: string[] = [
  "What's your reason for that — can you put it into a full sentence?",
  "Connect that into a sentence for me — what's behind it?",
  "Give me one more detail — why specifically?",
  "Tell me the reason — even one sentence works.",
]

// ── Correction bridges ────────────────────────────────────────────────────────
// Used before delivering a correction to soften the transition.

const CORRECTION_BRIDGES: string[] = [
  "I can see what you mean —",
  "Yeah, the idea is clear —",
  "The meaning comes through —",
  "Good instinct —",
  "That reads naturally —",
]

// ── Reflective transitions ────────────────────────────────────────────────────
// Used when moving to the next step cleanly.

const REFLECTIVE_TRANSITIONS: string[] = [
  "Right — I've got a clear sense of that now.",
  "Yeah — that gives me what I need.",
  "Good — that's enough context to work with.",
  "Fair enough — let's move forward.",
  "I can work with that — let's keep going.",
]

// ── Inline vocabulary explanations ───────────────────────────────────────────
// For phrase questions that detectVocabWord might miss.
// Keys: lowercase normalized phrase exactly as a student might ask about it.

const INLINE_VOCAB_RESPONSES: Record<string, string> = {
  'worth my time':
    "'Worth my time' means good or interesting enough to deserve your attention — so: why should I watch it instead of something else?",
  'worth your time':
    "'Worth your time' means something valuable enough to be worth spending time on — interesting or useful enough to justify it.",
  'worth it':
    "'Worth it' means the result or experience justifies the effort — yes, it was good enough.",
  'worth watching':
    "'Worth watching' means the film or show is good enough to spend time on — not a waste.",
  'convince me':
    "'Convince me' means: give me strong enough reasons to believe it's worth doing. What's your best argument?",
  'pitch me':
    "'Pitch me' means: try to sell me on the idea — give me your best reasons why it's worth watching.",
  'without major spoilers':
    "'Without major spoilers' means: describe it without revealing the ending, the big twist, or the key surprises.",
  'pitch':
    "'Pitch' here means: try to persuade me — convince me it's worth watching. Give me your strongest reasons.",
  'convince':
    "'Convince' means to make someone believe something or want to do something. Try: 'You should watch ___ because ___.'",
}

// Patterns to extract vocabulary questions (catches "what means X", "what's mean X", etc.)
const VOCAB_QUESTION_PATTERNS: Array<RegExp> = [
  /\bwhat\s+means?\s+['"]?([a-z][\w\s']{1,35}?)['"]?\s*[?!.,]?$/i,
  /\bwhat(?:'s|\s+is|\s+does|\s+do)\s+['"]?([a-z][\w\s']{1,35}?)['"]?\s+mean/i,
  /\bmeaning\s+of\s+['"]?([a-z][\w\s']{1,35}?)['"]?/i,
  /\bi\s+don'?t\s+(?:know|understand)\s+(?:what\s+)?['"]?([a-z][\w\s']{1,35}?)['"]?\s+mean/i,
  // "what's mean X" / "whats mean X" — bad-English phrasing of "what does X mean"
  /\bwhat'?s\s+mean\s+['"]?([a-z][\w\s']{1,35}?)['"]?\s*[?!.,]?$/i,
]

function extractVocabPhrase(text: string): string | null {
  const lower = text.toLowerCase().trim().replace(/[?!.,]+$/, '').trim()
  for (const re of VOCAB_QUESTION_PATTERNS) {
    const m = lower.match(re)
    if (m) {
      const phrase = (m[1] ?? '').trim().replace(/[?!.,'"+]+/g, '').trim()
      if (phrase.length >= 2 && phrase.length <= 40) return phrase
    }
  }
  return null
}

// ── Phase 7: Multilingual interruption detection ──────────────────────────────
// Detects brief RU/UA translation requests mid-lesson (e.g. "як сказати X", "как будет X").
// Zero AI calls. Returns the native query text for caller to handle.

// Note: \b is not used — JavaScript word boundaries don't match Cyrillic characters
const MULTILINGUAL_REQUEST_RE =
  /(як\s+сказати|як\s+перекласти|як\s+буде|як\s+по.?англ|як\s+правильно|що\s+означає|як\s+звучить|як\s+це\s+сказати|як\s+то\s+сказати|как\s+сказать|как\s+будет|как\s+перевести|как\s+по.?англ|что\s+значит|переведи|как\s+правильно|как\s+(?:это|то)\s+сказать)/i

// ── Phase 7.3: Deterministic Cyrillic phrase map ──────────────────────────────
// Maps common UA/RU phrases students ask about to English equivalents.
// Longer keys listed before shorter prefixes so the first match is the most specific.

const CYRILLIC_PHRASE_MAP: Array<readonly [string, string]> = [
  // Ukrainian — film/media
  ['смішний фільм',       'funny movie'],
  ['смішне кіно',         'funny film'],
  ['цікавий фільм',       'interesting movie'],
  ['нудний фільм',        'boring movie'],
  ['класний фільм',       'great movie'],
  ['смішний',             'funny'],
  ['цікавий',             'interesting'],
  ['нудний',              'boring'],
  ['серіал',              'series'],
  ['фільм',               'film'],
  // Ukrainian — school subjects
  ['географія',           'geography'],
  ['біологія',            'biology'],
  ['математика',          'maths'],
  ['хімія',               'chemistry'],
  ['фізика',              'physics'],
  ['історія',             'history'],
  ['англійська',          'English'],
  ['українська',          'Ukrainian'],
  ['природознавство',     'science'],
  // Ukrainian — feelings/actions
  ['подобається',         'like'],
  ['дуже подобається',    'really like'],
  ['цікавить',            'interests me'],
  ['нравиться',           'like'],
  // Ukrainian — time
  ['вільний час',          'free time'],
  ['вільний',              'free'],
  ['протягом 30 хвилин',  'for 30 minutes'],
  ['протягом',            'for (a period of time)'],
  // Ukrainian — health / exercise
  ['стає сильнішим',       'get fit'],
  ['стати сильнішим',      'get fit'],
  ['стає здоровішим',      'get fit'],
  ['стати здоровішим',     'get fit'],
  ['качатися',             'work out'],
  ['качається',            'works out'],
  ['качатись',             'work out'],
  // Ukrainian — achievement
  ['встиг закінчити',     'managed to finish'],
  ['встигти закінчити',   'managed to finish'],
  ['встиг зробити',       'managed to do'],
  ['встиг',               'managed to (do something in time)'],
  // Russian — film/media
  ['смешный фильм',       'funny movie'],
  ['смешной фильм',       'funny movie'],
  ['смешное кино',        'funny film'],
  ['интересный фильм',    'interesting movie'],
  ['скучный фильм',       'boring movie'],
  ['смешной',             'funny'],
  ['интересный',          'interesting'],
  ['скучный',             'boring'],
  ['сериал',              'series'],
  ['фильм',               'film'],
  // Russian — school subjects
  ['география',           'geography'],
  ['биология',            'biology'],
  ['математика',          'maths'],
  ['химия',               'chemistry'],
  ['физика',              'physics'],
  ['история',             'history'],
  ['английский',          'English'],
  ['природоведение',      'science'],
  // Russian — feelings/actions
  ['нравится',            'like'],
  ['очень нравится',      'really like'],
  ['интересует',          'interests me'],
  // Russian — time
  ['свободное время',      'free time'],
  ['свободное',            'free'],
  ['в течение 30 минут',  'for 30 minutes'],
  ['в течение',           'for (a period of time)'],
  // Russian — health / exercise
  ['становится сильнее',   'get fit'],
  ['стать сильнее',        'get fit'],
  ['становится здоровее',  'get fit'],
  ['стать здоровее',       'get fit'],
  ['качаться',             'work out'],
  ['качается',             'works out'],
  // Russian — achievement
  ['успел закончить',     'managed to finish'],
  ['успеть закончить',    'managed to finish'],
  ['успел сделать',       'managed to do'],
  ['успел',               'managed to (do something in time)'],
]

// ── Phase 7.3: English idiom/phrase map ──────────────────────────────────────
// Deterministic answers for English phrases students ask about during the demo.
// Longer / more specific keys come first so the first match is the most specific.

const ENGLISH_PHRASE_MAP: Array<readonly [string, string]> = [
  ['keep pulling you back in',  'something keeps making you want to return to it or continue doing it'],
  ['pull you back in',          'draw you back in — make you want to return or keep doing something'],
  ['take part in',              'participate in; join an activity or event'],
  ['come up with',              'think of or produce — an idea, plan, or answer'],
  ['figure out',                'understand or solve something after thinking about it'],
  ['work out',                  'exercise; or find a solution to a problem'],
  ['break down',                'explain step by step; or stop working (for machines)'],
  ['catch up',                  'reach the same level as others after being behind'],
  ['keep up',                   'maintain the same pace or level as others'],
  ['stand out',                 'be clearly better or more noticeable than others'],
  ['give up',                   'stop trying; quit'],
  ['make sense',                'be understandable or logical'],
  ['make progress',             'move forward; improve over time'],
  ['take notes',                'write down important information while listening'],
  ['challenge',                 'something difficult that tests your skills or determination'],
  ['competitive',               'wanting to win or be better than others'],
  ['elaborate',                 'explain something in more detail'],
  ['regardless',                'without being affected by other factors — no matter what'],
]

// Look up a phrase in the English idiom map. Case-insensitive substring match.
function lookupEnglishPhrase(phrase: string): string | null {
  const lower = phrase.toLowerCase().trim()
  for (const [key, value] of ENGLISH_PHRASE_MAP) {
    if (lower.includes(key.toLowerCase())) return value
  }
  return null
}

// Patterns to extract the requested phrase from a multilingual or ESL clarification question.
// Works for UA/RU native-language patterns, English "how to say [Cyrillic]", and broken-ESL English.
const PHRASE_EXTRACT_RE: RegExp[] = [
  // UA: "як сказати X", "що означає X", "як перекласти X", etc.
  /(?:як\s+сказати|як\s+перекласти|як\s+буде|що\s+означає|як\s+звучить|як\s+по.?англ\w*|як\s+правильно\s*(?:сказати)?)\s*[,:"']?\s+(.+?)(?:\s+(?:по\s+англ\w+|на\s+англ\w+(?:\s+мові)?|англійською|in\s+english))?\s*$/i,
  // RU: "как сказать X", "что значит X", "переведи X", etc.
  /(?:как\s+сказать|как\s+будет|как\s+перевести|что\s+значит|как\s+по.?англ\w*|как\s+правильно\s*(?:сказать)?|переведи)\s*[,:"']?\s+(.+?)(?:\s+(?:на\s+английском(?:\s+языке)?|in\s+english))?\s*$/i,
  // English "what does [phrase] mean" / "what do [phrase] mean"
  /^what\s+(?:does|do)\s+(.+?)\s+mean\s*[?!.]?\s*$/i,
  // English broken-ESL: "what's mean X" / "whats mean X" / "what mean X" / "what means X"
  /^what(?:'?s|\s+is)?\s+mean\s+(.+)/i,
  /^what\s+means?\s+(.+)/i,
  // English "how to say [phrase]", "how say [phrase]" — works for Cyrillic OR English phrases
  /^(?:[\p{L}\s,]+?\s+)?how\s+(?:to\s+)?say\s+(.+)$/iu,
]

// Extract the requested phrase from a multilingual or clarification question.
function extractRequestedPhrase(text: string): string | null {
  for (const re of PHRASE_EXTRACT_RE) {
    const m = text.match(re)
    if (m?.[1]) {
      const candidate = m[1].trim().replace(/[?!.,]+$/, '').trim().slice(0, 60)
      if (candidate.length >= 2) return candidate
    }
  }
  return null
}

// Look up a Cyrillic phrase in the deterministic map. Returns English translation or null.
function lookupCyrillicPhrase(phrase: string): string | null {
  const lower = phrase.toLowerCase().trim()
  for (const [key, value] of CYRILLIC_PHRASE_MAP) {
    if (lower.includes(key.toLowerCase())) return value
  }
  return null
}

// Returns true when the text is an English "how to say X" query where X contains Cyrillic.
function isHowToSayCyrillicQuery(text: string): boolean {
  if (!/\p{Script=Cyrillic}/u.test(text)) return false
  return /(?:^|\s)how\s+(?:to\s+)?say\s+/i.test(text.trim())
}

export interface MultilingualInterruption {
  detected: boolean
  nativeText: string | null  // raw native-language fragment (short, safe to relay)
}

// Detects if the student is briefly asking in a native language how to say something in English,
// OR using an English "how to say [Cyrillic phrase]" pattern.
// Returns detected=true when the pattern matches. nativeText is the full utterance (caller truncates).
// Safe to call on every turn — never throws.
export function detectMultilingualInterruption(text: string): MultilingualInterruption {
  try {
    if (MULTILINGUAL_REQUEST_RE.test(text)) {
      return { detected: true, nativeText: text.slice(0, 120) }
    }
    // Phase 7.3: also detect "how to say [Cyrillic content]" (English query about Cyrillic phrase)
    if (isHowToSayCyrillicQuery(text)) {
      return { detected: true, nativeText: text.slice(0, 120) }
    }
    return { detected: false, nativeText: null }
  } catch {
    return { detected: false, nativeText: null }
  }
}

// ── Phase 7.3: Multilingual phrase answer ─────────────────────────────────────
// Extracts the requested phrase, looks it up in the deterministic map, and returns
// a properly anchored response. Falls back safely if phrase is not recognized.
// Returns a complete message — caller must NOT wrap in ensureTeacherContinues.

export function buildMultilingualPhraseAnswer(
  text: string,
  stepPrompt: string,
  sessionId?: string,
): string {
  try {
    const requested = extractRequestedPhrase(text)
    if (requested) {
      // Try Cyrillic map first, then English idiom map
      const cyrillicHit = lookupCyrillicPhrase(requested)
      const englishHit  = cyrillicHit ? null : lookupEnglishPhrase(requested)
      const explanation = cyrillicHit ?? englishHit

      if (explanation) {
        const mapType = cyrillicHit ? 'cyrillic' : 'english'
        emitMoveTrace(sessionId, `phrase_answered map=${mapType} phrase="${requested.slice(0, 30)}"`)
        console.log(`[demo_clarification_answer_built] requested_phrase="${requested.slice(0, 30)}" matched_phrase_key=found map=${mapType} fallback_used=false current_step_preserved=true`)
        const anchor = stepPrompt
          ? `Now let's return to the question: ${stepPrompt}`
          : "Now let's continue."
        if (cyrillicHit) {
          // Cyrillic translation: show original → English
          return `"${requested}" in English is "${explanation}".\n\n${anchor}`
        }
        // English idiom: explain meaning
        return `"${requested.charAt(0).toUpperCase() + requested.slice(1)}" means: ${explanation}.\n\n${anchor}`
      }
      // Pattern matched but phrase not in either map — safe fallback, no grammar text
      console.log(`[demo_clarification_answer_built] requested_phrase="${requested.slice(0, 30)}" matched_phrase_key=none fallback_used=true current_step_preserved=true`)
      const hasCyrillic = /\p{Script=Cyrillic}/u.test(requested)
      if (hasCyrillic) {
        const anchor = stepPrompt ? `Now let's return to the question: ${stepPrompt}` : "Let's continue."
        return `I'm not sure about that exact word, but you can describe it simply in English. ${anchor}`
      }
      return `Good question! "${requested}" is a bit context-dependent — the key idea is the phrase you'll use in the exercise. Now let's return to the question: ${stepPrompt}`
    }
    // No phrase extracted — general multilingual rescue
    console.log(`[demo_clarification_answer_built] requested_phrase=none fallback_used=true current_step_preserved=true`)
    const anchor = stepPrompt ? `\n\n${stepPrompt}` : ''
    const hasCyrillicText = /\p{Script=Cyrillic}/u.test(text)
    if (hasCyrillicText) {
      return `I can see you're writing in Ukrainian or Russian — the lesson is in English. Try your answer in English, even a simple sentence works.${anchor}`
    }
    return `I didn't catch what you meant. Let me know what word or phrase you need help with. Now let's return to the question:${anchor}`
  } catch {
    return `Try your answer in English — even a simple sentence is fine.\n\n${stepPrompt}`
  }
}

// Returns true when the student input is a phrase/vocab lookup question rather than an exercise answer.
// Used by demo-routes.ts to route STUDENT_QUESTION cases to phrase lookup instead of grammar text.
export function detectPhraseQuestion(text: string): boolean {
  try {
    const lower = text.toLowerCase().trim()
    // Cyrillic-language requests
    if (MULTILINGUAL_REQUEST_RE.test(text)) return true
    // English "how to say [Cyrillic]"
    if (isHowToSayCyrillicQuery(text)) return true
    // English "what does X mean", "what means X", "what's mean X"
    if (/^what\s+(?:does|do)\s+.+\s+mean\s*[?!.]?\s*$/.test(lower)) return true
    if (/^what(?:'?s|\s+is)?\s+mean\s+\S/.test(lower)) return true
    if (/^what\s+means?\s+\S/.test(lower)) return true
    // English "how to say X", "how say X" (pure English, no Cyrillic)
    if (/^how\s+(?:to\s+)?say\s+\S/.test(lower)) return true
    return false
  } catch {
    return false
  }
}

// Exported wrapper around the private extractVocabPhrase — used by demo-routes.ts
// when handling student questions to extract the phrase a student is asking about.
export function extractVocabPhraseForLookup(text: string): string | null {
  return extractVocabPhrase(text)
}

// ── Phase 7.4: Meaning-first demo input classifier ────────────────────────────
// Classifies each student input before routing, so mixed messages (answer +
// translation request) are handled as meaning-first rather than pure interruptions.

export type DemoInputClass =
  | 'ANSWER_ONLY'
  | 'CLARIFICATION_ONLY'
  | 'ANSWER_WITH_CLARIFICATION'
  | 'MULTILINGUAL_RESCUE_ONLY'
  | 'ANSWER_WITH_MULTILINGUAL_RESCUE'
  | 'OFF_TASK'
  | 'LOW_SIGNAL'

export interface DemoInputClassification {
  cls: DemoInputClass
  hasAnswerContent: boolean
  hasClarification: boolean
  clarificationPhrase: string | null
  answerFragment: string | null
}

// Strips Cyrillic, multilingual request phrases, and "how to say X" patterns from
// text, leaving only the English answer content. Returns null if too little remains.
function extractAnswerFragment(text: string): string | null {
  // Remove all Cyrillic character blocks
  let stripped = text.replace(/[\p{Script=Cyrillic}]+/gu, ' ')
  // Remove "how to say [remaining word]" / "how say [word]"
  stripped = stripped.replace(/\bhow\s+(?:to\s+)?say\s+\w*/gi, ' ')
  // Remove any residual "in english" suffix left by Cyrillic removal
  stripped = stripped.replace(/\bin\s+english\b/gi, ' ')
  stripped = stripped.replace(/\s{2,}/g, ' ').trim()

  const words = stripped.split(/\s+/).filter(Boolean)
  // Skip pure function words; "I" (length 1) is a content word — do NOT filter by length >= 2
  const SKIP = new Set(['a','an','the','to','of','in','on','at','by','for','with','how','say','it','is','and','or','but','so'])
  const meaningful = words.filter(w => w.length >= 1 && !SKIP.has(w.toLowerCase()))
  if (meaningful.length < 2) return null
  return stripped
}

// Scans all Cyrillic blocks in `text` and returns the first map hit found.
function extractAndLookupCyrillicFromText(text: string): string | null {
  const blocks = text.match(/[\p{Script=Cyrillic}][\p{Script=Cyrillic}\s]*/gu) ?? []
  for (const block of blocks) {
    const hit = lookupCyrillicPhrase(block.trim())
    if (hit) return hit
  }
  return null
}

export function classifyDemoInput(text: string): DemoInputClassification {
  try {
    const hasMultilingualRequest =
      MULTILINGUAL_REQUEST_RE.test(text) || isHowToSayCyrillicQuery(text)

    const answerFragment = extractAnswerFragment(text)
    const hasAnswerContent = answerFragment !== null

    if (!hasMultilingualRequest) {
      return {
        cls: 'ANSWER_ONLY',
        hasAnswerContent: true,
        hasClarification: false,
        clarificationPhrase: null,
        answerFragment: text,
      }
    }

    const clarificationPhrase = extractRequestedPhrase(text)

    if (hasAnswerContent) {
      return {
        cls: 'ANSWER_WITH_MULTILINGUAL_RESCUE',
        hasAnswerContent: true,
        hasClarification: true,
        clarificationPhrase,
        answerFragment,
      }
    }

    return {
      cls: 'MULTILINGUAL_RESCUE_ONLY',
      hasAnswerContent: false,
      hasClarification: true,
      clarificationPhrase,
      answerFragment: null,
    }
  } catch {
    return {
      cls: 'ANSWER_ONLY',
      hasAnswerContent: true,
      hasClarification: false,
      clarificationPhrase: null,
      answerFragment: text,
    }
  }
}

// Sentiment patterns used to acknowledge the student's meaning in mixed messages.
const ANSWER_SENTIMENT_PATTERNS: Array<{ re: RegExp; buildMsg: (word: string) => string }> = [
  { re: /\bi\s+(?:really\s+)?like\b/i,                  buildMsg: (w) => w ? `Nice — you like ${w}.`                         : 'Nice — I can see what you mean.' },
  { re: /\bi\s+(?:really\s+)?love\b/i,                  buildMsg: (w) => w ? `Great — you love ${w}.`                        : 'Great — I can see what you mean.' },
  { re: /\bi'?m\s+watching|\bi\s+am\s+watching/i,       buildMsg: (w) => w ? `Nice — you're watching a ${w}.`               : 'Nice — I can see what you mean.' },
  { re: /\bi\s+find\b.{0,20}\binteresting\b/i,          buildMsg: (w) => w ? `You find ${w} interesting — good.`             : 'Good — I can see what you mean.' },
  { re: /\binteresting\b.{0,30}\bi\s+(?:like|love)\b/i, buildMsg: (w) => w ? `You find ${w} interesting — good.`             : 'Good — I can see what you mean.' },
  { re: /\bi\s+(?:am\s+|'?m\s+)?interested\b/i,        buildMsg: (w) => w ? `You're interested in ${w} — nice.`             : 'I can see what you mean.' },
  { re: /\bi\s+enjoy\b/i,                                buildMsg: (w) => w ? `You enjoy ${w} — good context.`               : 'I can see what you mean.' },
  { re: /\bi\s+(?:am\s+|'?m\s+)?studying\b/i,           buildMsg: (w) => w ? `You're studying ${w} — good.`                  : 'Good — I can see what you mean.' },
  { re: /\bi\s+(?:am\s+|'?m\s+)?learning\b/i,           buildMsg: (w) => w ? `You're learning ${w} — good.`                  : 'Good — I can see what you mean.' },
]

function detectAnswerSentiment(fragment: string, translation: string): string {
  const lower = fragment.toLowerCase()
  for (const { re, buildMsg } of ANSWER_SENTIMENT_PATTERNS) {
    if (re.test(lower)) return buildMsg(translation)
  }
  return translation ? `Good — ${translation}.` : 'Good — I can see what you mean.'
}

// Subject-aware follow-up questions used after answering an inline translation.
const SUBJECT_FOLLOWUPS: Record<string, string> = {
  geography:   'What makes it interesting for you?',
  biology:     'What part of biology do you enjoy most?',
  maths:       'Is it something you enjoy or more of a challenge?',
  chemistry:   'What kind of chemistry topics do you find interesting?',
  physics:     'What draws you to physics?',
  history:     'Which period of history interests you most?',
  english:     'What helps you learn English best?',
  'funny movie': 'Would you recommend it to a friend?',
  'funny film':  'Would you recommend it to a friend?',
  series:        'How many episodes in — would you recommend it?',
  film:          'What did you think of it?',
}

function chooseSubjectFollowup(translation: string, stepPrompt: string): string {
  const key = translation.toLowerCase()
  const followup = SUBJECT_FOLLOWUPS[key]
  if (followup) return followup
  // Generic: return to the step prompt
  return stepPrompt ? `Now, ${stepPrompt.charAt(0).toLowerCase() + stepPrompt.slice(1)}` : "Let's continue."
}

// ── Phase 7.4: Meaning-first response for mixed answer + translation ──────────
// Called when classifyDemoInput returns ANSWER_WITH_MULTILINGUAL_RESCUE.
// Answers the translation, acknowledges the student's meaning, asks a follow-up.
// Never says "try typing it in English". Never marks the answer as invalid.

export function buildMeaningFirstResponse(
  text: string,
  answerFragment: string,
  stepPrompt: string,
  sessionId?: string,
): string {
  try {
    const requested = extractRequestedPhrase(text)
    let translationLine = ''
    let translation = ''

    if (requested) {
      const cyrillicHit = lookupCyrillicPhrase(requested)
      if (cyrillicHit) {
        translation = cyrillicHit
        translationLine = `You can say "${cyrillicHit}."`
      } else {
        // Phrase extracted but not in map — try direct Cyrillic block scan as fallback.
        // Handles "how to say it" where 'it' refers back to a Cyrillic word in the message.
        const directHit = extractAndLookupCyrillicFromText(text)
        if (directHit) {
          translation = directHit
          translationLine = `You can say "${directHit}."`
        } else {
          translationLine = `I'm not sure about that exact word, but no problem.`
        }
      }
    } else {
      // extractRequestedPhrase failed (e.g. "как это сказать" where phrase precedes the request).
      // Scan Cyrillic blocks directly.
      const directHit = extractAndLookupCyrillicFromText(text)
      if (directHit) {
        translation = directHit
        translationLine = `You can say "${directHit}."`
      }
    }

    const sentimentAck  = detectAnswerSentiment(answerFragment, translation)
    const followup      = chooseSubjectFollowup(translation, stepPrompt)

    const parts = [translationLine, sentimentAck, followup].filter(Boolean)
    const result = parts.join(' ')
    emitMoveTrace(sessionId, `meaning_first_response translation="${translation.slice(0, 20)}"`)
    console.log(`[demo_meaning_first] fragment="${answerFragment.slice(0, 40)}" translation="${translation}" followup="${followup.slice(0, 40)}"`)
    return result
  } catch {
    return buildMultilingualPhraseAnswer(text, stepPrompt, sessionId)
  }
}

// ── Phase 7: Emotional acknowledgment phrases ─────────────────────────────────
// Brief, bounded reactions to meaningful student content (achievements, difficulty, emotions).
// Rotated by turnCount to avoid repetition. Never more than one per turn.

const EMOTIONAL_ACKNOWLEDGMENTS_NEUTRAL: string[] = [
  "That actually makes sense.",
  "Fair enough — that's a real situation.",
  "Interesting — good context for today.",
  "That gives me a clearer picture.",
]

const EMOTIONAL_ACKNOWLEDGMENTS_EFFORT: string[] = [
  "That sounds like it took real effort.",
  "So you worked through it yourself — good.",
  "That kind of practice is exactly what builds it.",
  "Real work — that's the kind of thing that sticks.",
]

const EMOTIONAL_ACKNOWLEDGMENTS_DIFFICULTY: string[] = [
  "That sounds difficult.",
  "That's a hard one — understandably so.",
  "Yeah, that can be genuinely tough.",
  "Difficult situation — makes sense you'd notice that.",
]

const EMOTIONAL_ACKNOWLEDGMENTS_ACHIEVEMENT: string[] = [
  "So you figured it out alone — impressive.",
  "Wow — you solved that by yourself?",
  "That's a real achievement, actually.",
  "Doing that solo takes focus.",
]

// Detects emotional signal type from student text for selecting acknowledgment category.
// Returns: 'achievement' | 'difficulty' | 'effort' | 'neutral'
function detectAcknowledgmentCategory(text: string): 'achievement' | 'difficulty' | 'effort' | 'neutral' {
  const lower = text.toLowerCase()
  if (/\b(alone|myself|by myself|solved|finished|completed|managed|figured out|did it|on my own)\b/.test(lower)) {
    return 'achievement'
  }
  if (/\b(hard|difficult|tough|struggle|couldn't|can't|stuck|confused|impossible|failed|gave up)\b/.test(lower)) {
    return 'difficulty'
  }
  if (/\b(practised|practiced|worked|studied|tried|spent|hours|effort|every day|kept going)\b/.test(lower)) {
    return 'effort'
  }
  return 'neutral'
}

// Returns a brief emotional acknowledgment phrase for meaningful student content.
// Returns null when text is a simple exercise answer or filler (no meaningful content detected).
// Zero AI calls. Rotates by turnCount.
export function buildEmotionalAcknowledgment(
  text: string,
  state: ConversationContinuityState,
  sessionId?: string,
): string | null {
  try {
    // Only acknowledge when the text has enough content to be meaningful (>4 words, not pure exercise)
    const wordCount = text.trim().split(/\s+/).filter(Boolean).length
    if (wordCount <= 4) return null

    const category = detectAcknowledgmentCategory(text)
    let pool: string[]
    switch (category) {
      case 'achievement': pool = EMOTIONAL_ACKNOWLEDGMENTS_ACHIEVEMENT; break
      case 'difficulty':  pool = EMOTIONAL_ACKNOWLEDGMENTS_DIFFICULTY;  break
      case 'effort':      pool = EMOTIONAL_ACKNOWLEDGMENTS_EFFORT;       break
      default:            return null  // 'neutral' — no forced acknowledgment
    }

    const phrase = pool[state.turnCount % pool.length]!
    emitMoveTrace(sessionId, `emotional_acknowledgment category=${category}`)
    return phrase
  } catch {
    return null
  }
}

// ── Phase 7.5: Communicative recast builder ───────────────────────────────────
// Natural echo of corrected English without punishment — used after LOW severity grammar.
// Returns a complete response or null if no pattern matches.
// Zero AI calls. Best-effort — never throws.

const RECAST_FOLLOWUPS: string[] = [
  "What makes that interesting for you?",
  "Would you tell me more about that?",
  "Why do you enjoy it?",
  "Is that something you'd recommend?",
  "How long have you been into that?",
]

export function buildCommunicativeRecast(
  studentText: string,
  stepPrompt: string,
  turnCount: number,
  sessionId?: string,
): string | null {
  try {
    const lower = studentText.toLowerCase().trim()
    const followup = stepPrompt || RECAST_FOLLOWUPS[turnCount % RECAST_FOLLOWUPS.length]!

    // "I watching X" → "Nice — you're watching X."
    const watchingMatch = lower.match(/\bi\s+watching\s+(?:a\s+|an\s+|the\s+)?(.+?)(?:\s+and\s+|\s*$)/)
    if (watchingMatch) {
      const obj = (watchingMatch[1] ?? '').trim().replace(/[.!?]+$/, '')
      emitMoveTrace(sessionId, 'communicative_recast type=watching')
      return `Nice — you're watching ${obj}. ${followup}`
    }

    // "I go/went/going [to] X" → "So you went to X."
    const goMatch = lower.match(/\bi\s+(?:go|went|going)\s+(?:to\s+)?(.+?)(?:\s+and\s+|\s*$)/)
    if (goMatch) {
      const dest = (goMatch[1] ?? '').trim().replace(/[.!?]+$/, '')
      emitMoveTrace(sessionId, 'communicative_recast type=go')
      return `So you went to ${dest}. ${followup}`
    }

    // "My teacher/X inspire me" → "Nice — your X inspires you."
    const inspireMatch = lower.match(/\bmy\s+(\w+)\s+inspire\s+(?:me|us)\b/)
    if (inspireMatch) {
      const who = inspireMatch[1] ?? 'teacher'
      emitMoveTrace(sessionId, 'communicative_recast type=inspire')
      return `Nice — your ${who} inspires you. ${followup}`
    }

    // "I like/love X because Y" (Y is not a full clause) → acknowledge + continue
    const becauseMatch = lower.match(/\bi\s+(?:like|love|enjoy)\s+(.+?)\s+because\b/)
    if (becauseMatch) {
      const what = (becauseMatch[1] ?? '').trim().replace(/[.!?]+$/, '')
      emitMoveTrace(sessionId, 'communicative_recast type=like_because')
      return `Nice — you like ${what}. ${followup}`
    }

    // "I want communication/X with Y" → rephrase naturally
    const wantMatch = lower.match(/\bi\s+want\s+(.+?)\s+with\s+(.+?)(?:\s*$)/)
    if (wantMatch) {
      const goal = (wantMatch[1] ?? '').trim().replace(/[.!?]+$/, '')
      const who  = (wantMatch[2] ?? '').trim().replace(/[.!?]+$/, '')
      emitMoveTrace(sessionId, 'communicative_recast type=want_with')
      return `So you want to connect with ${who}. ${followup}`
    }

    return null
  } catch {
    return null
  }
}

// ── Public exports ────────────────────────────────────────────────────────────

// Detects if the student is asking what a phrase means and returns an inline explanation.
// Returns null if the phrase is not recognized or no vocab question detected.
// Zero AI calls. Zero DB/Redis ops.
export function detectAndExplainVocabQuestion(
  text: string,
  sessionId?: string,
): string | null {
  try {
    const phrase = extractVocabPhrase(text)
    if (!phrase) return null
    const response = INLINE_VOCAB_RESPONSES[phrase]
    if (!response) return null
    emitMoveTrace(sessionId, `vocabulary_clarification_used phrase="${phrase.slice(0, 40)}"`)
    return response
  } catch {
    return null
  }
}

// Returns a short topic-aware reaction (e.g. "YouTube is a solid context — a lot of real English there.")
// Returns null if no topic detected or topic not in map.
export function chooseHumanReaction(
  state: ConversationContinuityState,
  sessionId?: string,
): string | null {
  try {
    const topic = state.recentTopics[0]
    if (!topic) return null
    const pool = TOPIC_REACTIONS[topic]
    if (!pool || pool.length === 0) return null
    const phrase = pool[state.turnCount % pool.length]!
    emitMoveTrace(sessionId, `human_reaction topic=${topic}`)
    return phrase
  } catch {
    return null
  }
}

// Returns a topic-aware curiosity followup question.
// Falls back to generic followups when topic is unknown.
export function chooseCuriousFollowup(
  state: ConversationContinuityState,
  sessionId?: string,
): string {
  try {
    const topic = state.recentTopics[0]
    if (topic) {
      const pool = TOPIC_CURIOUS_FOLLOWUPS[topic]
      if (pool && pool.length > 0) {
        const phrase = pool[state.turnCount % pool.length]!
        emitMoveTrace(sessionId, `curious_followup topic=${topic}`)
        return phrase
      }
    }
    const phrase = GENERIC_CURIOUS_FOLLOWUPS[state.turnCount % GENERIC_CURIOUS_FOLLOWUPS.length]!
    emitMoveTrace(sessionId, `curious_followup topic=generic`)
    return phrase
  } catch {
    return "What else can you tell me about that?"
  }
}

// Returns a guided expansion prompt (replaces "Tell me more" / "I need 2–3 sentences").
export function softenExpansionRequest(
  state: ConversationContinuityState,
  sessionId?: string,
): string {
  try {
    const phrase = EXPANSION_SOFTENERS[state.turnCount % EXPANSION_SOFTENERS.length]!
    emitMoveTrace(sessionId, 'guided_expansion')
    return phrase
  } catch {
    return "Give me a bit more context."
  }
}

// Returns a short-answer prompt (replaces "Tell me a bit more — give me a full sentence with your actual reasoning.").
export function chooseShortAnswerReaction(
  state: ConversationContinuityState,
  sessionId?: string,
): string {
  try {
    const phrase = SHORT_ANSWER_REACTIONS[state.turnCount % SHORT_ANSWER_REACTIONS.length]!
    emitMoveTrace(sessionId, 'short_answer_reaction')
    return phrase
  } catch {
    return "Give me a full sentence with a reason."
  }
}

// Returns a correction bridge phrase (softens correction delivery).
export function chooseCorrectionBridge(
  state: ConversationContinuityState,
  sessionId?: string,
): string {
  try {
    const phrase = CORRECTION_BRIDGES[state.turnCount % CORRECTION_BRIDGES.length]!
    emitMoveTrace(sessionId, 'correction_bridge')
    return phrase
  } catch {
    return "I can see what you mean —"
  }
}

// Returns a reflective transition phrase (clean step handoff).
export function chooseReflectiveTransition(
  state: ConversationContinuityState,
  sessionId?: string,
): string {
  try {
    const phrase = REFLECTIVE_TRANSITIONS[state.turnCount % REFLECTIVE_TRANSITIONS.length]!
    emitMoveTrace(sessionId, 'reflective_transition')
    return phrase
  } catch {
    return "Good — let's keep going."
  }
}

// ── Private helpers ───────────────────────────────────────────────────────────

function emitMoveTrace(sessionId: string | undefined, moveType: string): void {
  if (process.env.ENABLE_RUNTIME_TRACE !== '1' || !sessionId) return
  try {
    recordTraceEvent({
      sessionId,
      eventType:      'conversation_phrase_rotated',
      payloadSummary: `conversational_move_selected type=${moveType}`,
      severity:       'debug',
    })
  } catch {
    // never propagate into lesson runtime
  }
}
