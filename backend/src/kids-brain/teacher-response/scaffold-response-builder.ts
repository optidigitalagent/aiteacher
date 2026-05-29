import { UNIVERSAL_FALLBACK_TEXT, L1_BUDGET_EXHAUSTED_FALLBACK } from './teacher-response-constants.js';

/**
 * Parameters for building a scaffold-level response.
 * Scaffold levels 1–6 follow the English-first rescue ladder (spec §10.10 / kids-brain-rules.yaml §6).
 */
export interface ScaffoldParams {
  targetWord: string | null;
  forcedChoiceOptionA?: string;
  forcedChoiceOptionB?: string;
  /** True when the session L1 budget has been exhausted (max 1 L1 word per session). */
  l1BudgetUsed: boolean;
  /** The L1 translation of the target word (used only at Level 6). */
  l1AnchorWord?: string;
}

/**
 * Builds a scaffold response for the given level.
 *
 * Levels (spec §10.10, teacher-methodology-playbook §6.1):
 *  1 — repeat slower
 *  2 — simplify (add gesture instruction, reduce demand)
 *  3 — forced choice
 *  4 — model answer + invite repeat
 *  5 — ask child to repeat (provide answer first)
 *  6 — one-word L1 anchor (only if budget allows; uses L1 budget)
 *
 * L1 is NEVER used by default. Level 6 only fires when explicitly allowed.
 */
export function buildScaffoldResponse(
  level: 1 | 2 | 3 | 4 | 5 | 6,
  params: ScaffoldParams,
): string {
  const word = params.targetWord ?? '';
  const optA = params.forcedChoiceOptionA ?? word;
  const optB = params.forcedChoiceOptionB ?? 'or this?';

  switch (level) {
    case 1:
      // Repeat slower — same question at reduced pace, emphasis on key word
      return word
        ? `Listen... ${word}... say it! ${word}!`
        : UNIVERSAL_FALLBACK_TEXT;

    case 2:
      // Simplify — reduce to 2–3 words, add gesture instruction
      return word
        ? `${word}! Hands up! ${word}! Say: ${word}!`
        : UNIVERSAL_FALLBACK_TEXT;

    case 3:
      // Forced choice — prevents total failure
      return optA && optB !== 'or this?'
        ? `Is it ${optA} or ${optB}?`
        : word
        ? `Is it a ${word}? Yes or no?`
        : UNIVERSAL_FALLBACK_TEXT;

    case 4:
      // Model answer + invite (teacher gives answer, asks child to echo)
      return word
        ? `It's a ${word}! ${word}! Say: ${word}!`
        : UNIVERSAL_FALLBACK_TEXT;

    case 5:
      // Ask child to repeat — answer already given, minimal demand
      return word
        ? `Say it with me — ${word}! Together: ${word}! Your turn!`
        : UNIVERSAL_FALLBACK_TEXT;

    case 6:
      // L1 anchor — only if budget allows; last resort for comprehension failure only
      if (params.l1BudgetUsed) {
        // Budget exhausted: fall back to Level 5 behavior (spec Patch 9)
        return word
          ? `Listen — ${word}! Say: ${word}!`
          : L1_BUDGET_EXHAUSTED_FALLBACK;
      }
      // L1 budget available: use one L1 word + English pair
      if (params.l1AnchorWord && word) {
        return `${params.l1AnchorWord} — ${word}! ${word}! Say: ${word}!`;
      }
      // No L1 word available — fall back to Level 5
      return word
        ? `Say it with me — ${word}! Together: ${word}!`
        : UNIVERSAL_FALLBACK_TEXT;
  }
}
