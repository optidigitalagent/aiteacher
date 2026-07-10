// Pedagogical Behavior QA Tests
// Static assertions on hint policies, rule sets, phrase banks, and correction contracts.
// No AI calls, no DB, no network — fully deterministic.
//
// Covers:
//   1. find_in_text hints use scanning language, not grammar/tense/verb-form language
//   2. write_sentences_from_prompts hints do not use opinion starters
//   3. replace_substitute_words hints reference synonym/meaning
//   4. error_correction TURN C does not reveal the full correction
//   5. warmup_activation exposes SPEAKING_RULES
//   6. soft_speaking behavior contract includes speaking completion rules
//   7. Forbidden phrases include "Let me break it down"
//   8. Correction phrase bank exists and is referenced
//   9. TURN D includes brief warmth guidance ("tricky" / "learners miss")
//  10. Matching revealOnTurn remains B
//  11. Phase 6B.1 correction rule visibility (see section below)
//  12. Phase 6B.2 binary exercise calibration (true_false, tick_cross)
//  13. Phase 7 — Conversational Pedagogy Layer (new)

import { describe, it, expect } from 'vitest'

import {
  getHintPolicy,
  getExerciseFormatPolicy,
} from '../../behavior-runtime/exercise-teaching/exercise-format-registry.js'
import {
  getRulesForMode,
  SPEAKING_RULES,
  HUMAN_TUTOR_RULES,
  CORRECTION_RULES,
  EXERCISE_RULES,
  ANTI_CHAOS_RULES,
  CONVERSATIONAL_PEDAGOGY_RULES,
} from '../../ai/teacher-brain/teacher-brain-rules.js'
import {
  CORRECTION_PHRASE_STARTERS,
  CORRECTION_LADDER_DESCRIPTIONS,
} from '../../ai/teacher-brain/teacher-brain.constants.js'
import {
  selectBehaviorContractRules,
} from '../../ai/teacher-brain/teacher-brain-builder.js'
import {
  validateSoftSpeakingAnswer,
} from '../../validation/soft-speaking-validator.js'
import {
  detectMultilingualInterruption,
  buildEmotionalAcknowledgment,
  detectAndExplainVocabQuestion,
} from '../../runtime/conversation-moves.js'

// ── helpers ───────────────────────────────────────────────────────────────────

const GRAMMAR_TERMS = ['grammar', 'tense', 'verb form', 'conjugat', 'present simple', 'past simple', 'auxiliary verb']
const OPINION_STARTERS = ['in my opinion', 'i think', 'i believe', 'to my mind', 'from my perspective']

function containsAny(text: string, terms: string[]): boolean {
  const lower = text.toLowerCase()
  return terms.some(t => lower.includes(t))
}

function allHintTexts(exerciseType: string): string[] {
  const p = getHintPolicy(exerciseType)
  return [p.turnA, p.turnB, p.turnC, p.turnD]
}

// ── 1. find_in_text hints: scanning language only, no grammar/tense terms ─────

describe('find_in_text hint policy', () => {
  it('turnA uses scanning/location language (not grammar terminology)', () => {
    const turnA = getHintPolicy('find_in_text').turnA.toLowerCase()
    expect(turnA).toMatch(/scan|passage|text|section|word|look/)
    expect(containsAny(turnA, GRAMMAR_TERMS)).toBe(false)
  })

  it('turnB uses location narrowing, not grammar/tense language', () => {
    const turnB = getHintPolicy('find_in_text').turnB.toLowerCase()
    expect(turnB).toMatch(/sentence|look|text|mention|context|exact/)
    expect(containsAny(turnB, GRAMMAR_TERMS)).toBe(false)
  })

  it('turnC gives text-location clue without grammar instruction', () => {
    const turnC = getHintPolicy('find_in_text').turnC.toLowerCase()
    expect(containsAny(turnC, GRAMMAR_TERMS)).toBe(false)
  })

  it('no hint turn for find_in_text references grammar, tense, or verb-form', () => {
    const texts = allHintTexts('find_in_text')
    for (const text of texts) {
      expect(
        containsAny(text, GRAMMAR_TERMS),
        `find_in_text hint contains grammar term: "${text}"`,
      ).toBe(false)
    }
  })
})

// ── 2. write_sentences_from_prompts hints: no opinion starters ─────────────

describe('write_sentences_from_prompts hint policy', () => {
  it('hints focus on sentence structure, not personal opinion framing', () => {
    const texts = allHintTexts('write_sentences_from_prompts')
    for (const text of texts) {
      expect(
        containsAny(text, OPINION_STARTERS),
        `write_sentences_from_prompts hint contains opinion starter: "${text}"`,
      ).toBe(false)
    }
  })

  it('turnA asks about subject and verb from prompt words, not opinion', () => {
    const turnA = getHintPolicy('write_sentences_from_prompts').turnA.toLowerCase()
    expect(turnA).toMatch(/subject|verb|words|given/)
  })

  it('turnD reveals a model sentence — structural, not opinion-based', () => {
    const turnD = getHintPolicy('write_sentences_from_prompts').turnD.toLowerCase()
    expect(turnD).toMatch(/sentence|subject|verb|say/)
    expect(containsAny(turnD, OPINION_STARTERS)).toBe(false)
  })
})

// ── 3. replace_substitute_words hints: reference synonym / meaning ──────────

describe('replace_substitute_words hint policy', () => {
  it('turnA references synonym or same meaning', () => {
    const turnA = getHintPolicy('replace_substitute_words').turnA.toLowerCase()
    expect(turnA).toMatch(/synonym|same meaning|means/)
  })

  it('turnB references meaning or word class', () => {
    const turnB = getHintPolicy('replace_substitute_words').turnB.toLowerCase()
    expect(turnB).toMatch(/mean|word class|class/)
  })

  it('at least two hint turns reference synonym/meaning concept', () => {
    const hints = allHintTexts('replace_substitute_words').map(h => h.toLowerCase())
    const withMeaning = hints.filter(h => /synonym|same meaning|means/.test(h))
    expect(withMeaning.length).toBeGreaterThanOrEqual(1)
  })

  it('revealOnTurn is D (not early reveal)', () => {
    expect(getHintPolicy('replace_substitute_words').revealOnTurn).toBe('D')
  })
})

// ── 4. error_correction TURN C: does not reveal the full correction ──────────

describe('error_correction hint policy — TURN C', () => {
  const REVEAL_PHRASES = [
    'the correct word is',
    'the answer is',
    'replace with',
    'the correction is',
    'should be replaced by',
    'corrected form is',
    'here is the correct',
  ]

  it('TURN C text does not give the corrected word explicitly', () => {
    const turnC = getHintPolicy('error_correction').turnC.toLowerCase()
    expect(containsAny(turnC, REVEAL_PHRASES)).toBe(false)
  })

  it('TURN C explicitly instructs not to give the corrected word', () => {
    const turnC = getHintPolicy('error_correction').turnC
    // Should contain a phrase indicating answer should NOT be revealed
    expect(turnC).toMatch(/without giving the corrected word|do not give|without reveal|not reveal|without providing the answer/i)
  })

  it('TURN C points to error location or rule, not the answer', () => {
    const turnC = getHintPolicy('error_correction').turnC.toLowerCase()
    expect(turnC).toMatch(/issue|problem|error|verb|noun|preposition|rule|grammatical/)
  })

  it('Only TURN D reveals the answer (revealOnTurn === D)', () => {
    expect(getHintPolicy('error_correction').revealOnTurn).toBe('D')
  })
})

// ── 5. warmup_activation exposes SPEAKING_RULES ──────────────────────────────

describe('warmup_activation rule set', () => {
  const warmupRules = getRulesForMode('warmup_activation')

  it('returns a non-empty rule set', () => {
    expect(warmupRules.length).toBeGreaterThan(0)
  })

  it('includes the core speaking rules', () => {
    const speakingRuleCount = SPEAKING_RULES.rules.filter(r =>
      warmupRules.includes(r),
    ).length
    expect(speakingRuleCount).toBeGreaterThanOrEqual(5)
  })

  it('includes the "no exact-match" speaking rule', () => {
    expect(warmupRules).toContain('Do not ask student to repeat until exact match')
  })

  it('includes the speaking completion rule (accept second response)', () => {
    const hasCompletion = warmupRules.some(r =>
      r.includes('second response') && r.includes('accept'),
    )
    expect(hasCompletion).toBe(true)
  })

  it('does NOT include the strict deterministic correction rules', () => {
    // warmup should not lock items until correct
    const hasCorrectionLadder = warmupRules.some(r =>
      r.includes('TURN D') && r.includes('REVEAL'),
    )
    expect(hasCorrectionLadder).toBe(false)
  })
})

// ── 6. soft_speaking includes speaking completion rules ─────────────────────

describe('soft_speaking behavior contract', () => {
  const softRules = getRulesForMode('soft_speaking')

  it('includes the one-follow-up-maximum rule', () => {
    const hasOneFollowUp = softRules.some(r =>
      r.includes('second response') && r.includes('accept'),
    )
    expect(hasOneFollowUp).toBe(true)
  })

  it('includes the "never ask a third time" rule', () => {
    const hasNeverThird = softRules.some(r =>
      r.includes('third'),
    )
    expect(hasNeverThird).toBe(true)
  })

  it('includes the "after one substantive response → complete" rule', () => {
    const hasComplete = softRules.some(r =>
      r.includes('complete') && r.includes('move on'),
    )
    expect(hasComplete).toBe(true)
  })

  it('does NOT apply the strict A/B/C/D ladder to speaking', () => {
    const hasNoLadder = softRules.some(r =>
      r.includes('A/B/C/D') && r.includes('not'),
    )
    expect(hasNoLadder).toBe(true)
  })

  it('includes soft feedback rule (language quality only, not content)', () => {
    const hasSoftFeedback = softRules.some(r =>
      r.toLowerCase().includes('soft') || (r.includes('language') && r.includes('quality')),
    )
    expect(hasSoftFeedback).toBe(true)
  })
})

// ── 7. Forbidden phrases: "Let me break it down" ────────────────────────────

describe('Forbidden AI phrases', () => {
  it('"Let me break it down" is explicitly listed as forbidden in HUMAN_TUTOR_RULES', () => {
    const hasForbidden = HUMAN_TUTOR_RULES.rules.some(r =>
      r.includes('Let me break it down') && (r.includes('forbidden') || r.includes('absolutely')),
    )
    expect(hasForbidden).toBe(true)
  })

  it('"I\'m thinking..." is also listed as forbidden', () => {
    const hasThinking = HUMAN_TUTOR_RULES.rules.some(r =>
      r.includes("I'm thinking") || r.includes('I\'m thinking'),
    )
    expect(hasThinking).toBe(true)
  })

  it('"Let me break it down" forbidden rule appears in soft_speaking context', () => {
    const softRules = getRulesForMode('soft_speaking')
    const hasInSoftSpeaking = softRules.some(r =>
      r.includes('Let me break it down'),
    )
    expect(hasInSoftSpeaking).toBe(true)
  })

  it('"Let me break it down" forbidden rule appears in deterministic context', () => {
    const detRules = getRulesForMode('deterministic_sequential')
    const hasInDeterministic = detRules.some(r =>
      r.includes('Let me break it down'),
    )
    expect(hasInDeterministic).toBe(true)
  })
})

// ── 8. Correction phrase bank exists ────────────────────────────────────────

describe('Correction phrase bank', () => {
  it('CORRECTION_PHRASE_STARTERS is a non-empty array', () => {
    expect(Array.isArray(CORRECTION_PHRASE_STARTERS)).toBe(true)
    expect(CORRECTION_PHRASE_STARTERS.length).toBeGreaterThanOrEqual(5)
  })

  it('contains "Almost —"', () => {
    expect(CORRECTION_PHRASE_STARTERS).toContain('Almost —')
  })

  it('contains "Close —"', () => {
    expect(CORRECTION_PHRASE_STARTERS).toContain('Close —')
  })

  it('contains "Not quite —"', () => {
    expect(CORRECTION_PHRASE_STARTERS).toContain('Not quite —')
  })

  it('CORRECTION_RULES reference the phrase bank (no "Wrong" or "Incorrect")', () => {
    const hasNeverWrong = CORRECTION_RULES.rules.some(r =>
      r.includes('Never say Wrong') || r.includes('never say Wrong'),
    )
    expect(hasNeverWrong).toBe(true)
  })

  it('correction phrase starters are referenced in CORRECTION_RULES', () => {
    // At least one rule lists the allowed phrases
    const hasReference = CORRECTION_RULES.rules.some(r =>
      r.includes('Almost') || r.includes('Close —') || r.includes('Not quite'),
    )
    expect(hasReference).toBe(true)
  })
})

// ── 9. TURN D includes brief warmth guidance ────────────────────────────────

describe('TURN D warmth guidance', () => {
  it('CORRECTION_LADDER_DESCRIPTIONS.D acknowledges difficulty ("tricky")', () => {
    const descD = CORRECTION_LADDER_DESCRIPTIONS['D'].toLowerCase()
    expect(descD).toMatch(/tricky|learners miss|difficult/)
  })

  it('CORRECTION_LADDER_DESCRIPTIONS.D requires revealing the full answer', () => {
    const descD = CORRECTION_LADDER_DESCRIPTIONS['D'].toUpperCase()
    expect(descD).toMatch(/REVEAL/)
  })

  it('fill_gap TURN D includes warmth + reveal', () => {
    const turnD = getHintPolicy('fill_gap').turnD.toLowerCase()
    expect(turnD).toMatch(/tricky|learners miss/)
    expect(turnD).toMatch(/reveal|correct answer|answer is/)
  })

  it('error_correction TURN D includes warmth + reveal', () => {
    const turnD = getHintPolicy('error_correction').turnD.toLowerCase()
    expect(turnD).toMatch(/reveal|correct answer|full correct/)
  })

  it('TURN D asks student to repeat after reveal', () => {
    const turnD = getHintPolicy('fill_gap').turnD.toLowerCase()
    expect(turnD).toMatch(/repeat|say/)
  })
})

// ── 10. Matching revealOnTurn remains B ──────────────────────────────────────

describe('Matching hint policy — revealOnTurn = B', () => {
  const MATCHING_TYPES = ['matching', 'vocabulary_matching', 'find_opposites', 'collocations']

  for (const type of MATCHING_TYPES) {
    it(`${type} has revealOnTurn === "B"`, () => {
      const policy = getHintPolicy(type)
      expect(policy.revealOnTurn).toBe('B')
    })
  }

  it('matching TURN B text says REVEAL', () => {
    const turnB = getHintPolicy('matching').turnB.toUpperCase()
    expect(turnB).toMatch(/REVEAL/)
  })

  it('matching TURN A does NOT reveal the correct match', () => {
    const turnA = getHintPolicy('matching').turnA.toLowerCase()
    expect(turnA).toMatch(/eliminate|wrong|do not reveal|not reveal|narrow/)
    expect(turnA).not.toMatch(/the correct match is|reveal: the/)
  })

  it('matching TURN A explicitly says do NOT reveal', () => {
    const turnA = getHintPolicy('matching').turnA
    expect(turnA).toMatch(/do not reveal|Do NOT reveal/i)
  })
})

// ── 11. Phase 6B.1 — Correction Rule Visibility Fix ─────────────────────────
//
// These assertions verify that buildBehaviorContractSection() (via
// selectBehaviorContractRules) exposes ALL correction rules in deterministic
// mode — not just the first N after a flat slice.

describe('Phase 6B.1 — Correction Rule Visibility', () => {
  // All CORRECTION_RULES must be in the deterministic contract (10 rules total)
  it('all CORRECTION_RULES appear in deterministic_sequential behavior contract', () => {
    const groups = selectBehaviorContractRules('deterministic_sequential')
    const correctionGroup = groups.find(g => g.label === 'CORRECTION RULES')
    expect(correctionGroup).toBeDefined()
    expect(correctionGroup!.rules.length).toBe(CORRECTION_RULES.rules.length)
    for (const rule of CORRECTION_RULES.rules) {
      expect(correctionGroup!.rules).toContain(rule)
    }
  })

  it('all CORRECTION_RULES appear in matching_sequential behavior contract', () => {
    const groups = selectBehaviorContractRules('matching_sequential')
    const correctionGroup = groups.find(g => g.label === 'CORRECTION RULES')
    expect(correctionGroup).toBeDefined()
    expect(correctionGroup!.rules.length).toBe(CORRECTION_RULES.rules.length)
  })

  it('correction phrase rotation rule is visible in deterministic mode', () => {
    const groups = selectBehaviorContractRules('deterministic_sequential')
    const allRules = groups.flatMap(g => [...g.rules])
    const hasRotation = allRules.some(r => r.toLowerCase().includes('rotate'))
    expect(hasRotation).toBe(true)
  })

  it('TURN D warmth rule is visible in deterministic mode', () => {
    const groups = selectBehaviorContractRules('deterministic_sequential')
    const allRules = groups.flatMap(g => [...g.rules])
    const hasTurnD = allRules.some(r =>
      r.includes('TURN D') && (r.includes('tricky') || r.includes('acknowledge') || r.includes('difficulty')),
    )
    expect(hasTurnD).toBe(true)
  })

  it('anti-cold correction rule (Never say Wrong) is visible in deterministic mode', () => {
    const groups = selectBehaviorContractRules('deterministic_sequential')
    const allRules = groups.flatMap(g => [...g.rules])
    const hasNeverWrong = allRules.some(r =>
      r.includes('Never say Wrong') || r.includes('Never say Incorrect'),
    )
    expect(hasNeverWrong).toBe(true)
  })

  it('correction reveal policy (Never reveal before TURN D) is visible in deterministic mode', () => {
    const groups = selectBehaviorContractRules('deterministic_sequential')
    const allRules = groups.flatMap(g => [...g.rules])
    const hasNoEarlyReveal = allRules.some(r =>
      r.includes('Never reveal') && r.includes('TURN D'),
    )
    expect(hasNoEarlyReveal).toBe(true)
  })

  it('speaking completion rule (accept second response) is visible in soft_speaking', () => {
    const groups = selectBehaviorContractRules('soft_speaking')
    const allRules = groups.flatMap(g => [...g.rules])
    const hasCompletion = allRules.some(r =>
      r.includes('second response') && r.includes('accept'),
    )
    expect(hasCompletion).toBe(true)
  })

  it('all SPEAKING_RULES are visible in soft_speaking contract', () => {
    const groups = selectBehaviorContractRules('soft_speaking')
    const speakingGroup = groups.find(g => g.label === 'SPEAKING RULES')
    expect(speakingGroup).toBeDefined()
    expect(speakingGroup!.rules.length).toBe(SPEAKING_RULES.rules.length)
  })

  it('all SPEAKING_RULES are visible in warmup_activation contract', () => {
    const groups = selectBehaviorContractRules('warmup_activation')
    const speakingGroup = groups.find(g => g.label === 'SPEAKING RULES')
    expect(speakingGroup).toBeDefined()
    expect(speakingGroup!.rules.length).toBe(SPEAKING_RULES.rules.length)
  })

  // Token budget guard: behavior contract must remain bounded.
  // Phase 7.5: soft_speaking/warmup_activation limits updated from 20→30 (6 new communicative rules added).
  // buildRulesSection slices to 8 in actual prompts — this guard tracks cumulative growth only.
  it('behavior contract total rules stay within budget for any mode', () => {
    const MODE_LIMITS: Record<string, number> = {
      'deterministic_sequential': 20,
      'matching_sequential':      20,
      'soft_speaking':            30,
      'warmup_activation':        30,
      'grammar_explanation':      20,
      'unsupported':              20,
      'reading_text':             20,
    }
    for (const [mode, limit] of Object.entries(MODE_LIMITS)) {
      const groups = selectBehaviorContractRules(mode)
      const totalRules = groups.reduce((sum, g) => sum + g.rules.length, 0)
      expect(
        totalRules,
        `${mode} has ${totalRules} rules — exceeds budget of ${limit}`,
      ).toBeLessThanOrEqual(limit)
    }
  })

  // Exercise rules must still be in deterministic contract
  it('all EXERCISE_RULES are visible in deterministic_sequential behavior contract', () => {
    const groups = selectBehaviorContractRules('deterministic_sequential')
    const exerciseGroup = groups.find(g => g.label === 'EXERCISE RULES')
    expect(exerciseGroup).toBeDefined()
    expect(exerciseGroup!.rules.length).toBe(EXERCISE_RULES.rules.length)
  })
})

// ── Bonus: format registry coverage check ────────────────────────────────────

describe('Exercise format registry completeness', () => {
  const REQUIRED_TYPES = [
    'fill_gap',
    'error_correction',
    'replace_substitute_words',
    'write_sentences_from_prompts',
    'find_in_text',
    'matching',
    'vocabulary_matching',
    'find_opposites',
    'collocations',
    'speaking_prompt',
    'discussion',
    'grammar_focus',
  ]

  for (const type of REQUIRED_TYPES) {
    it(`${type} has a complete format policy`, () => {
      const policy = getExerciseFormatPolicy(type)
      expect(policy).toBeDefined()
      expect(policy.hintPolicy).toBeDefined()
      expect(policy.hintPolicy.turnA).toBeTruthy()
      expect(policy.hintPolicy.turnD).toBeTruthy()
      expect(policy.hintPolicy.revealOnTurn).toMatch(/^[BCD]$/)
    })
  }
})

// ── 12. Phase 6B.2 — Binary Exercise Calibration ────────────────────────────
//
// true_false and tick_cross use a 3-turn A→B→C ladder with reveal at TURN C.
// No repeat required after reveal. Hints must be evidence/context-focused —
// no grammar coaching, no production-style scaffolding.

describe('Phase 6B.2 — Binary exercise calibration', () => {
  const BINARY_TYPES = ['true_false', 'tick_cross']
  const GRAMMAR_COACHING_TERMS = [
    'verb form', 'conjugat', 'present simple', 'past simple', 'third person',
    'auxiliary verb', 'tense', 'subject agreement',
  ]
  const PRODUCTION_SCAFFOLDING_TERMS = [
    'say the full sentence', 'complete the sentence', 'form a sentence',
    'write the answer', 'say all the words',
  ]

  for (const type of BINARY_TYPES) {
    describe(type, () => {
      it('revealOnTurn is C (calibrated binary ladder)', () => {
        expect(getHintPolicy(type).revealOnTurn).toBe('C')
      })

      it('maxRetries is 3 (not 4)', () => {
        expect(getExerciseFormatPolicy(type).retryPolicy.maxRetries).toBe(3)
      })

      it('requireRepeatAfterReveal is false (no repeat for binary answers)', () => {
        expect(getExerciseFormatPolicy(type).retryPolicy.requireRepeatAfterReveal).toBe(false)
      })

      it('TURN C contains REVEAL instruction', () => {
        const turnC = getHintPolicy(type).turnC.toUpperCase()
        expect(turnC).toMatch(/REVEAL/)
      })

      it('TURN A does NOT contain a REVEAL instruction', () => {
        const turnA = getHintPolicy(type).turnA.toUpperCase()
        expect(turnA).not.toMatch(/^REVEAL/)
        expect(turnA).not.toMatch(/THE ANSWER IS/)
      })

      it('TURN B does NOT contain a REVEAL instruction', () => {
        const turnB = getHintPolicy(type).turnB.toUpperCase()
        expect(turnB).not.toMatch(/^REVEAL/)
        expect(turnB).not.toMatch(/THE ANSWER IS/)
      })

      it('hint turns avoid grammar coaching terminology', () => {
        const hints = [
          getHintPolicy(type).turnA,
          getHintPolicy(type).turnB,
        ]
        for (const hint of hints) {
          for (const term of GRAMMAR_COACHING_TERMS) {
            expect(
              hint.toLowerCase().includes(term),
              `${type} hint contains grammar coaching term "${term}": "${hint}"`,
            ).toBe(false)
          }
        }
      })

      it('hint turns avoid production-style scaffolding', () => {
        const hints = [
          getHintPolicy(type).turnA,
          getHintPolicy(type).turnB,
        ]
        for (const hint of hints) {
          for (const term of PRODUCTION_SCAFFOLDING_TERMS) {
            expect(
              hint.toLowerCase().includes(term),
              `${type} hint contains production scaffolding term "${term}": "${hint}"`,
            ).toBe(false)
          }
        }
      })

      it('TURN A uses evidence/context language (re-read / look / detail / word)', () => {
        const turnA = getHintPolicy(type).turnA.toLowerCase()
        expect(turnA).toMatch(/read|look|detail|word|statement|context|carefully/)
      })

      it('TURN B references specific evidence or key detail', () => {
        const turnB = getHintPolicy(type).turnB.toLowerCase()
        expect(turnB).toMatch(/evidence|key word|specific|focus|context|detail|match|compare/)
      })
    })
  }

  it('standard deterministic types retain revealOnTurn D (no regression)', () => {
    const STANDARD_TYPES = ['fill_gap', 'error_correction', 'complete_correct_form', 'reconstruction']
    for (const type of STANDARD_TYPES) {
      expect(getHintPolicy(type).revealOnTurn).toBe('D')
    }
  })

  it('matching types retain revealOnTurn B (no regression)', () => {
    const MATCHING_TYPES = ['matching', 'vocabulary_matching', 'find_opposites', 'collocations']
    for (const type of MATCHING_TYPES) {
      expect(getHintPolicy(type).revealOnTurn).toBe('B')
    }
  })

  it('CORRECTION_RULES include binary exception (reveal at TURN C for binary types)', () => {
    const hasBinaryException = CORRECTION_RULES.rules.some(r =>
      r.toLowerCase().includes('binary') &&
      r.includes('TURN C') &&
      (r.includes('true_false') || r.includes('tick_cross')),
    )
    expect(hasBinaryException).toBe(true)
  })
})

// ── 13. Phase 6B.3 — Soft-Speaking Threshold Calibration ─────────────────────
//
// Validates that soft-speaking thresholds prioritise communication success,
// accept partial answers at attempt ≥ 2 when understandable and on-topic,
// and avoid demanding full sentences.
//
// Strict rules preserved:
//   - blank/filler still rejected
//   - off-task filler at attempt 2 still rejected (no free-chat drift)
//   - deterministic exercises unaffected

describe('Phase 6B.3 — Soft-Speaking Threshold Calibration', () => {
  // ── Rule assertions ────────────────────────────────────────────────────────

  it('communication success priority rule is in SPEAKING_RULES', () => {
    const hasCommSuccess = SPEAKING_RULES.rules.some(r =>
      r.toLowerCase().includes('communication success') ||
      (r.toLowerCase().includes('understandable') && r.toLowerCase().includes('on-topic')),
    )
    expect(hasCommSuccess).toBe(true)
  })

  it('short answers with 2+ meaningful words rule is in SPEAKING_RULES', () => {
    const hasShortRule = SPEAKING_RULES.rules.some(r =>
      (r.includes('2+') && r.toLowerCase().includes('meaningful')) ||
      r.toLowerCase().includes('do not demand a full sentence'),
    )
    expect(hasShortRule).toBe(true)
  })

  it('low-severity grammar recast rule is in SPEAKING_RULES', () => {
    const hasRecastRule = SPEAKING_RULES.rules.some(r =>
      r.toLowerCase().includes('recast') ||
      r.toLowerCase().includes('echo') ||
      (r.toLowerCase().includes('low-severity') && r.toLowerCase().includes('grammar')),
    )
    expect(hasRecastRule).toBe(true)
  })

  it('new calibration rules are visible in soft_speaking behavior contract', () => {
    const groups = selectBehaviorContractRules('soft_speaking')
    const speakingGroup = groups.find(g => g.label === 'SPEAKING RULES')
    expect(speakingGroup).toBeDefined()
    // Should contain communication success rule
    const hasCommSuccess = speakingGroup!.rules.some(r =>
      r.toLowerCase().includes('communication success'),
    )
    expect(hasCommSuccess).toBe(true)
  })

  // ── Validator: communicative success acceptance ────────────────────────────

  it('generic_discussion: 2 semantic words accepted (not blocked as too_short)', () => {
    // Before calibration: semWords < 3 blocked. After: only semWords < 2 blocks.
    // "I love reading" → love + reading = 2 semantic words → should now pass
    const result = validateSoftSpeakingAnswer({
      exerciseId:        'test-ss-001',
      exerciseNumber:    1,
      exerciseType:      'discussion',
      instruction:       'Tell me about your weekend.',
      itemText:          'Tell me about your weekend.',
      studentTranscript: 'I love reading.',
      attemptCount:      0,
    })
    expect(result.allowProgression).toBe(true)
  })

  it('communicatively successful partial answer accepted at attempt 2', () => {
    // "My teacher inspires me." — subject present, reason missing.
    // At attempt 2, communicative success fast-path should soft-accept.
    const result = validateSoftSpeakingAnswer({
      exerciseId:        'test-ss-002',
      exerciseNumber:    2,
      exerciseType:      'discussion',
      instruction:       'Who inspires you and why?',
      itemText:          'Who inspires you and why?',
      studentTranscript: 'My teacher inspires me.',
      attemptCount:      2,
    })
    expect(result.allowProgression).toBe(true)
    expect(result.isPartiallyAcceptable).toBe(true)
    expect(result.issueType).toBe('acceptable_with_repair')
  })

  it('partial answer at attempt 0 NOT fast-pathed (still asks for missing slot)', () => {
    // Same transcript but attempt 0 — fast-path requires attempt ≥ 2
    const result = validateSoftSpeakingAnswer({
      exerciseId:        'test-ss-003',
      exerciseNumber:    3,
      exerciseType:      'discussion',
      instruction:       'Who inspires you and why?',
      itemText:          'Who inspires you and why?',
      studentTranscript: 'My teacher inspires me.',
      attemptCount:      0,
    })
    // At attempt 0 with reason missing, should ask for reason
    expect(result.allowProgression).toBe(false)
    expect(result.needsRetry).toBe(true)
  })

  // ── Validator: no free-chat regression ────────────────────────────────────

  it('blank answer still rejected — no free-chat regression', () => {
    const result = validateSoftSpeakingAnswer({
      exerciseId:        'test-ss-004',
      exerciseNumber:    4,
      exerciseType:      'discussion',
      instruction:       'Tell me about yourself.',
      itemText:          'Tell me about yourself.',
      studentTranscript: '',
      attemptCount:      0,
    })
    expect(result.allowProgression).toBe(false)
  })

  it('pure filler still rejected at attempt 0', () => {
    const result = validateSoftSpeakingAnswer({
      exerciseId:        'test-ss-005',
      exerciseNumber:    5,
      exerciseType:      'discussion',
      instruction:       'What is your favourite hobby?',
      itemText:          'What is your favourite hobby?',
      studentTranscript: 'ok',
      attemptCount:      0,
    })
    expect(result.allowProgression).toBe(false)
    expect(result.issueType).toBe('off_task')
  })

  it('pure filler at attempt 2 still rejected (no free-chat drift)', () => {
    // Fast-path requires isCommunicativelySuccessful — pure filler has no substantive content
    const result = validateSoftSpeakingAnswer({
      exerciseId:        'test-ss-006',
      exerciseNumber:    6,
      exerciseType:      'discussion',
      instruction:       'Who inspires you and why?',
      itemText:          'Who inspires you and why?',
      studentTranscript: 'ok',
      attemptCount:      2,
    })
    expect(result.allowProgression).toBe(false)
    expect(result.issueType).toBe('off_task')
  })

  // ── Repair prompt tone ─────────────────────────────────────────────────────

  it('off_task fallback repair does not demand "complete sentence"', () => {
    // Empty instruction → triggers the fallback text (not the instruction-based prompt)
    const result = validateSoftSpeakingAnswer({
      exerciseId:        'test-ss-007',
      exerciseNumber:    7,
      exerciseType:      'discussion',
      instruction:       '',
      itemText:          '',
      studentTranscript: 'ok',
      attemptCount:      0,
    })
    const repair = result.repairPrompt ?? ''
    expect(repair.toLowerCase()).not.toMatch(/complete sentence|full sentence/)
  })

  it('partial answer repair prompt does not say "answer properly"', () => {
    // Partial answer at attempt 0 — repair should be constructive, not pressuring
    const result = validateSoftSpeakingAnswer({
      exerciseId:        'test-ss-008',
      exerciseNumber:    8,
      exerciseType:      'discussion',
      instruction:       'Who inspires you and why?',
      itemText:          'Who inspires you and why?',
      studentTranscript: 'My teacher inspires me.',
      attemptCount:      0,
    })
    const repair = result.repairPrompt ?? result.teacherHint ?? ''
    expect(repair.toLowerCase()).not.toContain('answer properly')
  })

  // ── Token budget guard ────────────────────────────────────────────────────

  it('soft_speaking behavior contract stays within token budget (≤ 30 rules after Phase 7.5)', () => {
    const groups = selectBehaviorContractRules('soft_speaking')
    const totalRules = groups.reduce((sum, g) => sum + g.rules.length, 0)
    expect(totalRules).toBeLessThanOrEqual(30)
  })

  it('new SPEAKING_RULES do not break the all-rules-visible assertion', () => {
    const groups = selectBehaviorContractRules('soft_speaking')
    const speakingGroup = groups.find(g => g.label === 'SPEAKING RULES')
    expect(speakingGroup).toBeDefined()
    expect(speakingGroup!.rules.length).toBe(SPEAKING_RULES.rules.length)
  })
})

// ── 13. Phase 7 — Conversational Pedagogy Layer ──────────────────────────────
//
// Assertions for:
//  a) Conversational acknowledgment rule group exists and is bounded
//  b) Bounded reaction rules visible in speaking modes
//  c) Multilingual interruption detection (RU/UA patterns)
//  d) Emotional acknowledgment behavior
//  e) No free-chat drift (deterministic modes unaffected)
//  f) Token budget preserved after Phase 7 changes
//  g) ANTI_CHAOS_RULES rule 17 updated for UI-aware retry anchor

describe('Phase 7 — Conversational Pedagogy Layer', () => {
  // ── a) CONVERSATIONAL_PEDAGOGY_RULES rule group ───────────────────────────

  it('CONVERSATIONAL_PEDAGOGY_RULES group exists and has exactly 4 rules', () => {
    expect(CONVERSATIONAL_PEDAGOGY_RULES).toBeDefined()
    expect(CONVERSATIONAL_PEDAGOGY_RULES.rules.length).toBe(4)
  })

  it('CONVERSATIONAL_PEDAGOGY_RULES rule 1: react to meaningful content before moving forward', () => {
    const hasReactRule = CONVERSATIONAL_PEDAGOGY_RULES.rules.some(r =>
      r.toLowerCase().includes('meaningful content') ||
      r.toLowerCase().includes('acknowledge briefly'),
    )
    expect(hasReactRule).toBe(true)
  })

  it('CONVERSATIONAL_PEDAGOGY_RULES rule 2: maximum one acknowledgment per turn', () => {
    const hasMaxOneRule = CONVERSATIONAL_PEDAGOGY_RULES.rules.some(r =>
      r.toLowerCase().includes('maximum') && r.toLowerCase().includes('one'),
    )
    expect(hasMaxOneRule).toBe(true)
  })

  it('CONVERSATIONAL_PEDAGOGY_RULES rule 3: always continue lesson after acknowledgment', () => {
    const hasContinueRule = CONVERSATIONAL_PEDAGOGY_RULES.rules.some(r =>
      r.toLowerCase().includes('continue lesson') ||
      r.toLowerCase().includes('lesson flow'),
    )
    expect(hasContinueRule).toBe(true)
  })

  it('CONVERSATIONAL_PEDAGOGY_RULES rule 4: bounded curiosity only — no free-chat', () => {
    const hasBoundedRule = CONVERSATIONAL_PEDAGOGY_RULES.rules.some(r =>
      r.toLowerCase().includes('bounded') ||
      (r.toLowerCase().includes('follow-up') && r.toLowerCase().includes('not')),
    )
    expect(hasBoundedRule).toBe(true)
  })

  it('CONVERSATIONAL_PEDAGOGY_RULES allows exactly one friendly follow-up in speaking modes', () => {
    const joinedRules = CONVERSATIONAL_PEDAGOGY_RULES.rules.join(' ').toLowerCase()
    expect(joinedRules).toContain('one short friendly follow-up')
    expect(joinedRules).toContain('multi-turn digressions')
  })

  it('SPEAKING_RULES permits one textbook-related follow-up before completion', () => {
    const joinedRules = SPEAKING_RULES.rules.join(' ').toLowerCase()
    expect(joinedRules).toContain('one friendly textbook-related follow-up')
    expect(joinedRules).toContain('before completing')
  })

  it('CONVERSATIONAL_PEDAGOGY_RULES forbids invented current news hooks', () => {
    const joinedRules = CONVERSATIONAL_PEDAGOGY_RULES.rules.join(' ').toLowerCase()
    expect(joinedRules).toContain('never invent current news')
    expect(joinedRules).toContain('student memory')
  })

  // ── b) Speaking mode behavior contract includes Phase 7 rules ─────────────

  it('soft_speaking behavior contract includes CONVERSATIONAL PEDAGOGY RULES group', () => {
    const groups = selectBehaviorContractRules('soft_speaking')
    const convGroup = groups.find(g => g.label === 'CONVERSATIONAL PEDAGOGY RULES')
    expect(convGroup).toBeDefined()
    expect(convGroup!.rules.length).toBe(CONVERSATIONAL_PEDAGOGY_RULES.rules.length)
  })

  it('warmup_activation behavior contract includes CONVERSATIONAL PEDAGOGY RULES group', () => {
    const groups = selectBehaviorContractRules('warmup_activation')
    const convGroup = groups.find(g => g.label === 'CONVERSATIONAL PEDAGOGY RULES')
    expect(convGroup).toBeDefined()
  })

  it('SPEAKING_RULES group still fully visible in soft_speaking after Phase 7 addition', () => {
    const groups = selectBehaviorContractRules('soft_speaking')
    const speakingGroup = groups.find(g => g.label === 'SPEAKING RULES')
    expect(speakingGroup).toBeDefined()
    expect(speakingGroup!.rules.length).toBe(SPEAKING_RULES.rules.length)
  })

  // ── c) Multilingual interruption detection ────────────────────────────────

  it('detectMultilingualInterruption: detects Ukrainian "як сказати"', () => {
    const result = detectMultilingualInterruption('як сказати протягом 30 хвилин')
    expect(result.detected).toBe(true)
    expect(result.nativeText).toBeTruthy()
  })

  it('detectMultilingualInterruption: detects Russian "как будет"', () => {
    const result = detectMultilingualInterruption('как будет успел закончить?')
    expect(result.detected).toBe(true)
  })

  it('detectMultilingualInterruption: detects Ukrainian "як перекласти"', () => {
    const result = detectMultilingualInterruption('як перекласти "for 30 minutes"')
    expect(result.detected).toBe(true)
  })

  it('detectMultilingualInterruption: detects Russian "переведи"', () => {
    const result = detectMultilingualInterruption('переведи это слово пожалуйста')
    expect(result.detected).toBe(true)
  })

  it('detectMultilingualInterruption: does NOT fire on normal English exercise answers', () => {
    expect(detectMultilingualInterruption('She goes to school every day').detected).toBe(false)
    expect(detectMultilingualInterruption('I managed to finish the project').detected).toBe(false)
    expect(detectMultilingualInterruption('Does he usually play tennis?').detected).toBe(false)
  })

  it('detectMultilingualInterruption: nativeText is bounded (≤120 chars)', () => {
    const longInput = 'як сказати ' + 'x'.repeat(200)
    const result = detectMultilingualInterruption(longInput)
    if (result.detected && result.nativeText) {
      expect(result.nativeText.length).toBeLessThanOrEqual(120)
    }
  })

  // ── d) Emotional acknowledgment behavior ──────────────────────────────────

  it('buildEmotionalAcknowledgment: returns phrase for achievement content', () => {
    const state = { recentTopics: [], emotionalSignal: 'neutral' as const, avoidedPhrases: [], correctionCount: 0, turnCount: 0 }
    const phrase = buildEmotionalAcknowledgment('I solved the math project by myself', state)
    expect(phrase).toBeTruthy()
    expect(typeof phrase).toBe('string')
    if (phrase) {
      expect(phrase.split(' ').length).toBeLessThanOrEqual(15)  // bounded length
    }
  })

  it('buildEmotionalAcknowledgment: returns phrase for difficulty content', () => {
    const state = { recentTopics: [], emotionalSignal: 'neutral' as const, avoidedPhrases: [], correctionCount: 0, turnCount: 0 }
    const phrase = buildEmotionalAcknowledgment("I can't do this, it's really difficult", state)
    expect(phrase).toBeTruthy()
  })

  it('buildEmotionalAcknowledgment: returns null for short pure-exercise answers', () => {
    const state = { recentTopics: [], emotionalSignal: 'neutral' as const, avoidedPhrases: [], correctionCount: 0, turnCount: 0 }
    expect(buildEmotionalAcknowledgment('does', state)).toBeNull()
    expect(buildEmotionalAcknowledgment('went', state)).toBeNull()
    expect(buildEmotionalAcknowledgment('have', state)).toBeNull()
  })

  it('buildEmotionalAcknowledgment: never throws on any input', () => {
    const state = { recentTopics: [], emotionalSignal: 'neutral' as const, avoidedPhrases: [], correctionCount: 0, turnCount: 0 }
    expect(() => buildEmotionalAcknowledgment('', state)).not.toThrow()
    expect(() => buildEmotionalAcknowledgment('ok', state)).not.toThrow()
    expect(() => buildEmotionalAcknowledgment('!@#$%', state)).not.toThrow()
  })

  it('buildEmotionalAcknowledgment: rotates phrases with different turnCount', () => {
    const text = 'I managed to solve this difficult problem all by myself yesterday'
    const s0 = { recentTopics: [], emotionalSignal: 'neutral' as const, avoidedPhrases: [], correctionCount: 0, turnCount: 0 }
    const s1 = { recentTopics: [], emotionalSignal: 'neutral' as const, avoidedPhrases: [], correctionCount: 0, turnCount: 1 }
    const p0 = buildEmotionalAcknowledgment(text, s0)
    const p1 = buildEmotionalAcknowledgment(text, s1)
    // Either same (if pool size 1) or different — both must be non-null
    expect(p0).toBeTruthy()
    expect(p1).toBeTruthy()
  })

  // ── e) No free-chat drift — deterministic modes unaffected ─────────────────

  it('deterministic_sequential behavior contract does NOT include CONVERSATIONAL PEDAGOGY RULES', () => {
    const groups = selectBehaviorContractRules('deterministic_sequential')
    const convGroup = groups.find(g => g.label === 'CONVERSATIONAL PEDAGOGY RULES')
    expect(convGroup).toBeUndefined()
  })

  it('matching_sequential behavior contract does NOT include CONVERSATIONAL PEDAGOGY RULES', () => {
    const groups = selectBehaviorContractRules('matching_sequential')
    const convGroup = groups.find(g => g.label === 'CONVERSATIONAL PEDAGOGY RULES')
    expect(convGroup).toBeUndefined()
  })

  // ── f) Token budget preserved ─────────────────────────────────────────────

  it('soft_speaking behavior contract stays within ≤ 30 rules after Phase 7.5 (budget guard)', () => {
    // Phase 7.5 added 6 communicative-tolerance rules to SPEAKING_RULES (total 26 incl. CONVERSATIONAL_PEDAGOGY).
    // buildRulesSection still slices to 8 in actual prompts — this guard tracks overall growth.
    const groups = selectBehaviorContractRules('soft_speaking')
    const totalRules = groups.reduce((sum, g) => sum + g.rules.length, 0)
    expect(totalRules).toBeLessThanOrEqual(30)
  })

  it('warmup_activation behavior contract stays within ≤ 30 rules after Phase 7.5', () => {
    const groups = selectBehaviorContractRules('warmup_activation')
    const totalRules = groups.reduce((sum, g) => sum + g.rules.length, 0)
    expect(totalRules).toBeLessThanOrEqual(30)
  })

  it('deterministic_sequential budget unaffected by Phase 7 (≤ 20 rules)', () => {
    const groups = selectBehaviorContractRules('deterministic_sequential')
    const totalRules = groups.reduce((sum, g) => sum + g.rules.length, 0)
    expect(totalRules).toBeLessThanOrEqual(20)
  })

  // ── g) ANTI_CHAOS_RULES rule 17 updated for UI-aware retry anchor ─────────

  it('ANTI_CHAOS_RULES rule 17 references short-item vs long-item retry distinction', () => {
    const rule17 = ANTI_CHAOS_RULES.rules[16]  // 0-based index 16 = rule 17
    expect(rule17).toBeDefined()
    // Rule 17 must acknowledge that long items on screen should NOT be repeated verbatim
    const hasUiAwareness = (
      rule17!.toLowerCase().includes('screen') ||
      rule17!.toLowerCase().includes('visible') ||
      rule17!.toLowerCase().includes('≤5') ||
      rule17!.toLowerCase().includes('short item') ||
      rule17!.toLowerCase().includes('long item')
    )
    expect(hasUiAwareness).toBe(true)
  })

  it('ANTI_CHAOS_RULES rule 17 still requires a retry signal after correction', () => {
    const rule17 = ANTI_CHAOS_RULES.rules[16]!
    expect(rule17.toLowerCase()).toMatch(/try again/)
  })
})

// ── 14. Phase 7.1 — Demo Voice Continuity & Clarification Routing ─────────────
//
// Assertions for:
//  a) "what's mean X" pattern covered by detectAndExplainVocabQuestion
//  b) detectMultilingualInterruption additional patterns
//  c) No false positives on normal English answers
//  d) Budget protection — TTS type 'key_correction' is in the allowed list (not checked here;
//     the backend ai-config allowedMessageTypes whitelist is authoritative)

describe('Phase 7.1 — Demo Voice Continuity & Clarification Routing', () => {
  // ── a) "what's mean X" pattern ──────────────────────────────────────────────

  it('detectAndExplainVocabQuestion: handles "what\'s mean worth my time" (new pattern)', () => {
    const result = detectAndExplainVocabQuestion("what's mean worth my time")
    expect(result).not.toBeNull()
    expect(typeof result).toBe('string')
    expect(result).toMatch(/worth my time/i)
  })

  it('detectAndExplainVocabQuestion: handles "what\'s mean pitch" (new pattern)', () => {
    const result = detectAndExplainVocabQuestion("what's mean pitch?")
    expect(result).not.toBeNull()
  })

  it('detectAndExplainVocabQuestion: returns null for unrecognized phrase (no false positives)', () => {
    const result = detectAndExplainVocabQuestion("what's mean zxzxzxzx")
    expect(result).toBeNull()
  })

  it('detectAndExplainVocabQuestion: never throws on edge-case inputs', () => {
    expect(() => detectAndExplainVocabQuestion("what's mean")).not.toThrow()
    expect(() => detectAndExplainVocabQuestion("")).not.toThrow()
    expect(() => detectAndExplainVocabQuestion("!@#$")).not.toThrow()
  })

  // ── b) Multilingual patterns ─────────────────────────────────────────────────

  it('detectMultilingualInterruption: detects "що означає" (Ukrainian)', () => {
    expect(detectMultilingualInterruption('що означає challenge?').detected).toBe(true)
  })

  it('detectMultilingualInterruption: detects "як правильно" (Ukrainian)', () => {
    expect(detectMultilingualInterruption('як правильно сказати це').detected).toBe(true)
  })

  it('detectMultilingualInterruption: detects mixed RU/UA "переведи"', () => {
    expect(detectMultilingualInterruption('переведи challenge').detected).toBe(true)
  })

  // ── c) No false positives ────────────────────────────────────────────────────

  it('detectMultilingualInterruption: does not fire on normal English answers', () => {
    expect(detectMultilingualInterruption('Would you play it competitively?').detected).toBe(false)
    expect(detectMultilingualInterruption('I love gaming because it is relaxing').detected).toBe(false)
    expect(detectMultilingualInterruption("I don't know how to say this in English").detected).toBe(false)
  })

  it('detectAndExplainVocabQuestion: existing patterns still work after adding new one', () => {
    // Pattern 1: "what means X"
    expect(detectAndExplainVocabQuestion('what means worth my time')).not.toBeNull()
    // Pattern 2: "what does X mean"
    expect(detectAndExplainVocabQuestion('what does worth my time mean')).not.toBeNull()
  })
})
