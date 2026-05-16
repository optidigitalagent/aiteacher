// Snapshot Validation
// Shape checks for exercise snapshots. Returns diagnostics only — no side effects.

import type { SnapshotValidationResult } from './exercise-protocols.js'
import { normalizeExerciseType } from './exercise-type-classifier.js'

type Snapshot = Record<string, unknown>

function hasNonEmptyString(obj: Snapshot, ...keys: string[]): boolean {
  return keys.some(k => typeof obj[k] === 'string' && (obj[k] as string).trim() !== '')
}

function hasNonEmptyArray(obj: Snapshot, ...keys: string[]): boolean {
  return keys.some(k => Array.isArray(obj[k]) && (obj[k] as unknown[]).length > 0)
}

// ── Per-category validators ───────────────────────────────────────────────────

function validateMatchingSnapshot(type: string, snap: Snapshot): SnapshotValidationResult {
  if (!hasNonEmptyArray(snap, 'items')) {
    return { ok: false, reason: `${type}: must have items array.` }
  }
  if (!hasNonEmptyArray(snap, 'options')) {
    return { ok: false, reason: `${type}: must have options array — matching cannot run without visible options.` }
  }
  if (!hasNonEmptyString(snap, 'correct_answer', 'correctAnswer') && !hasNonEmptyArray(snap, 'answers', 'mapping')) {
    return { ok: false, reason: `${type}: must have correct_answer or answers mapping.` }
  }
  return { ok: true }
}

function validateFillGapSnapshot(type: string, snap: Snapshot): SnapshotValidationResult {
  if (!hasNonEmptyString(snap, 'question', 'item')) {
    return { ok: false, reason: `${type}: must have a question or item.` }
  }
  if (!hasNonEmptyString(snap, 'correct_answer', 'correctAnswer')) {
    return { ok: false, reason: `${type}: must have correct_answer.` }
  }
  return { ok: true }
}

function validateDeterministicSnapshot(type: string, snap: Snapshot): SnapshotValidationResult {
  if (!hasNonEmptyString(snap, 'question', 'item')) {
    return { ok: false, reason: `${type}: must have a question or item.` }
  }
  if (!hasNonEmptyString(snap, 'correct_answer', 'correctAnswer')) {
    return { ok: false, reason: `${type}: must have correct_answer.` }
  }
  return { ok: true }
}

function validateSpeakingSnapshot(type: string, snap: Snapshot): SnapshotValidationResult {
  // Speaking/discussion exercises must be a single open prompt — never a structured item list.
  // items.length > 1 means the AI merged a discussion intro with listening comprehension questions,
  // producing an invalid shape that creates item-cursor progression (e.g. item=0/8).
  const items = snap['items']
  if (Array.isArray(items) && items.length > 1) {
    return { ok: false, reason: `speaking_structured_items_invalid` }
  }
  if (!hasNonEmptyString(snap, 'question', 'item', 'prompt', 'instruction')) {
    return { ok: false, reason: `${type}: must have a prompt or question.` }
  }
  return { ok: true }
}

// ── Routing ───────────────────────────────────────────────────────────────────

const MATCHING_TYPES = new Set(['matching', 'vocabulary_matching', 'collocations', 'find_opposites', 'multiple_choice'])
const FILL_GAP_TYPES = new Set(['fill_gap', 'choose_from_box'])
const DETERMINISTIC_TYPES = new Set([
  'complete_correct_form', 'form_transformation', 'rewrite_sentence',
  'write_sentences_from_prompts', 'reconstruction', 'write_questions',
  'error_correction', 'replace_substitute_words', 'tick_cross', 'true_false',
])
const SPEAKING_TYPES = new Set([
  'speaking_prompt', 'discussion', 'roleplay', 'free_production',
  'show_interest_agree_disagree', 'brainstorm_60_second', 'show_what_you_know',
  'grammar_focus', 'remember_this',
])
const POSTPONED_TYPES = new Set([
  'listening', 'gap_fill_from_audio', 'listen_check_repeat', 'pronunciation_focus',
  'reading_long_text', 'read_and_answer', 'gapped_text', 'find_in_text',
  'read_and_write_names', 'writing_task', 'writing_focus_analyse_model',
  'writing_order_paragraphs', 'writing_self_check', 'complete_table',
  'complete_cartoon_captions', 'exam_focus_unsupported',
])

export function validateSnapshotShape(
  rawType: string,
  snapshot: Snapshot,
): SnapshotValidationResult {
  const type = normalizeExerciseType(rawType)

  if (POSTPONED_TYPES.has(type) || type === 'unknown') {
    return { ok: false, reason: `${type}: invalid for structured runtime — type is postponed or unsupported.` }
  }

  if (MATCHING_TYPES.has(type)) return validateMatchingSnapshot(type, snapshot)
  if (FILL_GAP_TYPES.has(type))  return validateFillGapSnapshot(type, snapshot)
  if (DETERMINISTIC_TYPES.has(type)) return validateDeterministicSnapshot(type, snapshot)
  if (SPEAKING_TYPES.has(type))  return validateSpeakingSnapshot(type, snapshot)

  return { ok: false, reason: `${type}: unknown shape validation category.` }
}

// Batch validation — returns all diagnostics without short-circuiting
export function validateSnapshotShapeBatch(
  rawType: string,
  snapshots: Snapshot[],
): SnapshotValidationResult[] {
  return snapshots.map(snap => validateSnapshotShape(rawType, snap))
}
