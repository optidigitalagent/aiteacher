// ── Stale Item Guard ──────────────────────────────────────────────────────────
// Validates teacher AI response against canonical exercise cursor before sending.
//
// Problem: LLM can reference old items from conversation history despite ITEM LOCK
// and HISTORY BLACKOUT instructions — e.g. "Number 1: clever" when on item 3.
//
// Solution: detect "Number X" item-announcement patterns and rewrite stale ones
// to the canonical current item before the response is sent to frontend/TTS.
//
// Rules:
//   • Only active in EXERCISES phase with a live engine cursor
//   • Only catches "Number X:" item-announcement patterns (not grammar references)
//   • Does NOT over-block — normal grammar explanations pass through unchanged
//   • Every fire is logged for audit

import type { ExerciseCursor } from '../lesson/types.js'

export interface StaleItemGuardResult {
  safe:         boolean          // true → text was clean; false → rewrite applied
  text:         string           // final text to send (rewritten if safe=false)
  blockedPhrase: string | null   // the stale phrase detected, for logging
}

// ── Pattern: item announcement "Number X:" or "Number X —" or "Number X."
// Matches only numbered item announcements that include a colon/em-dash/period
// directly after the number (standard item-announcement syntax in exercises).
// Deliberately excludes bare "Number" in grammar explanations.
const ITEM_ANNOUNCE_RE = /\bNumber\s+(\d{1,2})\s*[:–—]/gi

// ── Pattern: transitional phrases that precede a stale item announcement
// "let's continue. Number X:" or "Now let's move on. Number X:"
const TRANSITION_THEN_ITEM_RE =
  /\b(?:let'?s\s+continue|let'?s\s+move\s+on|now\s+let'?s\s+continue|continue\.?)\s*\.?\s*Number\s+(\d{1,2})\s*[:–—]/gi

// ── Pattern: "back to Number X" regression reference
const BACK_TO_RE = /\b(?:back\s+to|return\s+to|go\s+back\s+to)\s+Number\s+(\d{1,2})\b/gi

// ── Main guard ────────────────────────────────────────────────────────────────

export function guardTeacherResponse(
  text:   string,
  cursor: ExerciseCursor | null,
  phase:  string,
): StaleItemGuardResult {
  // Only active in EXERCISES phase
  if (phase !== 'EXERCISES') return { safe: true, text, blockedPhrase: null }

  // Must have a canonical current item
  if (!cursor?.currentItem || cursor.itemIndex === undefined) {
    return { safe: true, text, blockedPhrase: null }
  }

  const canonicalNum  = cursor.itemIndex + 1
  const canonicalItem = cursor.currentItem

  let blocked: string | null = null
  let rewritten = text

  // ── Pass 1: "back to Number X" regression ────────────────────────────────
  rewritten = rewritten.replace(BACK_TO_RE, (match, numStr) => {
    const n = parseInt(numStr, 10)
    if (n !== canonicalNum) {
      blocked ??= match
      return `back to Number ${canonicalNum}`
    }
    return match
  })

  // ── Pass 2: transition + stale announcement ───────────────────────────────
  rewritten = rewritten.replace(TRANSITION_THEN_ITEM_RE, (match, numStr) => {
    const n = parseInt(numStr, 10)
    if (n !== canonicalNum) {
      blocked ??= match
      // Replace entire "let's continue. Number 1:" → "Let's stay on Number 3:"
      return `Let's stay on Number ${canonicalNum}: `
    }
    return match
  })

  // ── Pass 3: bare item announcement "Number X:" ────────────────────────────
  // Re-run pattern (guards rewrite may have already fixed Pass 2 cases)
  rewritten = rewritten.replace(ITEM_ANNOUNCE_RE, (match, numStr) => {
    const n = parseInt(numStr, 10)
    if (n !== canonicalNum) {
      blocked ??= match
      return `Number ${canonicalNum}: `
    }
    return match
  })

  // ── If any pass rewrote content, append a canonical anchor ───────────────
  // Anchor ensures the student hears the correct item regardless of whether
  // surrounding text was fully coherent after the rewrite.
  if (blocked !== null) {
    // Check if the rewritten text already contains the canonical item text
    const alreadyAnchored = rewritten.includes(canonicalItem.slice(0, 10))
    if (!alreadyAnchored) {
      rewritten = rewritten.trimEnd()
      // Append canonical item anchor if not naturally present
      if (!rewritten.endsWith(canonicalItem)) {
        rewritten += ` "${canonicalItem}"`
      }
    }

    return { safe: false, text: rewritten.trim(), blockedPhrase: blocked }
  }

  return { safe: true, text, blockedPhrase: null }
}

// ── Section-not-ready guard ───────────────────────────────────────────────────
// Returns a safe fallback teacher message when the manifest/engine queue is empty
// and we are in a paid exercise context. Prevents AI from improvising content.

export function buildSectionNotReadyMessage(sectionId: string): string {
  return (
    `I don't have the structured exercise content loaded for this section (${sectionId}) yet. ` +
    `Let me know when you're ready to continue and I'll guide you through what's available.`
  )
}

// ── Unsafe-fallback guard ─────────────────────────────────────────────────────
// When engine queue is empty (no manifest) and AI response looks like it's
// presenting a made-up exercise, inject a warning block into the input context.

export function buildFallbackGuardContext(sectionId: string): string {
  return [
    `=== SECTION NOT READY ===`,
    `Section "${sectionId}" has no manifest loaded. Engine queue is empty.`,
    `MANDATORY: Do NOT present exercises, items, or numbered tasks.`,
    `MANDATORY: Do NOT say "Exercise 1" or "Number 1" or any item.`,
    `Say: "This section's structured content is not loaded yet. ` +
      `We can continue with what's available or try a different section."`,
    `=== END SECTION NOT READY ===`,
  ].join('\n')
}
