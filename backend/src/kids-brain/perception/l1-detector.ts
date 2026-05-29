import { L1Script, L1IntentHint } from '../shared/enums.js';

export interface L1DetectionResult {
  l1Detected: boolean;
  l1ScriptDetected: boolean;
  l1KeywordDetected: boolean;
  l1Script: L1Script | null;
  l1IntentHint: L1IntentHint | null;
  l1Word: string | null;
}

/** Matches any Cyrillic Unicode character (spec §5.4 method 1). */
const CYRILLIC_RE = /[Ѐ-ӿ]/;

/** Extract first Cyrillic word from text. */
const CYRILLIC_WORD_RE = /[Ѐ-ӿ]+/;

interface L1KeywordEntry {
  keyword: string;
  intentHint: L1IntentHint;
}

/**
 * Ordered from longest phrase to shortest to ensure longest match wins.
 * Combines spec §5.4 phrase-to-intent map with Phase 2 required keywords.
 */
export const L1_KEYWORD_MAP: readonly L1KeywordEntry[] = [
  { keyword: 'я не знаю', intentHint: L1IntentHint.I_DONT_KNOW },
  { keyword: 'не знаю', intentHint: L1IntentHint.I_DONT_KNOW },
  { keyword: 'не понимаю', intentHint: L1IntentHint.I_DONT_KNOW },
  { keyword: 'що це', intentHint: L1IntentHint.HELP_REQUEST },
  { keyword: 'як по-англійськи', intentHint: L1IntentHint.HELP_REQUEST },
  { keyword: 'не хочу', intentHint: L1IntentHint.REFUSAL },
  { keyword: 'не буду', intentHint: L1IntentHint.REFUSAL },
  { keyword: 'обезьяна', intentHint: L1IntentHint.UNKNOWN },
  { keyword: 'собака', intentHint: L1IntentHint.UNKNOWN },
  { keyword: 'кошка', intentHint: L1IntentHint.UNKNOWN },
  { keyword: 'мавпа', intentHint: L1IntentHint.UNKNOWN },
  { keyword: 'тигр', intentHint: L1IntentHint.UNKNOWN },
  { keyword: 'слон', intentHint: L1IntentHint.UNKNOWN },
  { keyword: 'лев', intentHint: L1IntentHint.UNKNOWN },
  { keyword: 'что', intentHint: L1IntentHint.UNKNOWN },
  { keyword: 'нет', intentHint: L1IntentHint.UNKNOWN },
  { keyword: 'да', intentHint: L1IntentHint.UNKNOWN },
] as const;

/**
 * Deterministic L1 detection — no LLM involved (spec §5.4, Phase 2 §L1Detection).
 *
 * Method 1: Cyrillic script detection (Unicode analysis).
 * Method 2: Vocabulary list match against known L1 child phrases.
 */
export function detectL1(text: string): L1DetectionResult {
  const lower = text.toLowerCase().trim();

  const l1ScriptDetected = CYRILLIC_RE.test(lower);

  let l1KeywordDetected = false;
  let matchedKeyword: string | null = null;
  let matchedIntent: L1IntentHint | null = null;

  for (const entry of L1_KEYWORD_MAP) {
    if (lower.includes(entry.keyword)) {
      l1KeywordDetected = true;
      matchedKeyword = entry.keyword;
      matchedIntent = entry.intentHint;
      break;
    }
  }

  const l1Detected = l1ScriptDetected || l1KeywordDetected;

  const l1Script = l1ScriptDetected
    ? L1Script.CYRILLIC
    : l1KeywordDetected
    ? L1Script.LATIN_LOANWORD
    : null;

  // If Cyrillic detected but no keyword matched, extract the first Cyrillic word
  let l1Word = matchedKeyword;
  if (l1ScriptDetected && !l1Word) {
    const match = lower.match(CYRILLIC_WORD_RE);
    if (match) l1Word = match[0];
  }

  return {
    l1Detected,
    l1ScriptDetected,
    l1KeywordDetected,
    l1Script,
    l1IntentHint: l1Detected ? (matchedIntent ?? L1IntentHint.UNKNOWN) : null,
    l1Word,
  };
}
