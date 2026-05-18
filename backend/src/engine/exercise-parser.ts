// ── Exercise Parser ───────────────────────────────────────────────────────────
// Converts ManifestEntry → ExerciseSpec with fully-resolved StepSpec[].
// This is the only place where manifest data enters the engine.
// GPT never touches this path.

import { v4 as uuid } from 'uuid'
import type {
  ExerciseSpec,
  ExerciseType,
  StepSpec,
  ValidationRule,
  ProgressionCondition,
  ExerciseMeta,
  StepDifficulty,
} from './types.js'
import type {
  ExerciseManifestEntry,
  ManifestItem,
} from '../lesson/section-manifest.js'

// ── Type mapping ──────────────────────────────────────────────────────────────

const MANIFEST_TYPE_MAP: Record<string, ExerciseType> = {
  discussion:           'discussion',
  grammar_focus_fill:   'grammar_focus_fill',
  grammar_drill:        'grammar_drill',
  personal_fill:        'personal_fill',
  pair_speaking:        'pair_speaking',
  listening_matching:   'listening_matching',
  listening_gap:        'listening_gap',
  fill_in_the_gap:      'fill_in_the_gap',
  sentence_transformation: 'sentence_transformation',
  translation:          'translation',
  reading_comprehension: 'reading_comprehension',
  paragraph_reading:    'paragraph_reading',
  dialogue_practice:    'dialogue_practice',
  multiple_choice:      'multiple_choice',
  matching:             'matching',
  pronunciation_practice: 'pronunciation_practice',
  audio_based:          'audio_based',
  // Text-based reading types
  gapped_text:          'gapped_text',
  find_in_text:         'find_in_text',
  read_and_answer:      'read_and_answer',
  read_and_write_names: 'read_and_write_names',
  phrase_classification: 'phrase_classification',
  find_opposites:       'find_opposites',
  choose_from_box:      'choose_from_box',
  vocabulary_fill_gap:  'vocabulary_fill_gap',
  collocations_fill:    'collocations_fill',
}

function resolveExerciseType(raw: string): ExerciseType {
  return MANIFEST_TYPE_MAP[raw] ?? 'unknown'
}

// ── Validation rule factory ───────────────────────────────────────────────────

function buildValidationRule(entry: ExerciseManifestEntry, item: ManifestItem): ValidationRule {
  if (!entry.executable) {
    return { mode: 'not_applicable' }
  }

  switch (entry.runtimeMode) {
    case 'deterministic_sequential':
      if (!item.correctAnswer) {
        // No expected answer → soft AI evaluation
        return {
          mode:           'soft_ai',
          scoreThreshold: 0.5,
          maxRetries:     3,
        }
      }
      // Short single-word fills → exact match
      if (item.correctAnswer.split(' ').length <= 2) {
        return {
          mode:             'exact',
          caseSensitive:    false,
          stripPunctuation: true,
          maxRetries:       3,
        }
      }
      // Longer phrases → contains match (student may include surrounding text)
      return {
        mode:             'contains',
        caseSensitive:    false,
        stripPunctuation: true,
        maxRetries:       3,
      }

    case 'soft_speaking':
      if (!item.correctAnswer) {
        return { mode: 'any_response', maxRetries: 1 }
      }
      return {
        mode:           'soft_ai',
        scoreThreshold: 0.4,
        maxRetries:     2,
      }

    case 'text_reading_sequential':
      if (!item.correctAnswer) {
        // No answer known — teacher confirms from textbook
        return { mode: 'soft_ai', scoreThreshold: 0.3, maxRetries: 2 }
      }
      return {
        mode:             'contains',
        caseSensitive:    false,
        stripPunctuation: true,
        maxRetries:       3,
      }

    case 'unsupported':
      return { mode: 'not_applicable' }
  }
}

// ── Progression condition factory ─────────────────────────────────────────────

function buildProgressionCondition(entry: ExerciseManifestEntry, item: ManifestItem): ProgressionCondition {
  if (!entry.executable) return 'auto_skip'

  if (entry.completionBehavior === 'single_response') return 'after_single_response'

  if (entry.runtimeMode === 'soft_speaking') {
    return 'after_any_response'
  }

  if (entry.runtimeMode === 'text_reading_sequential') {
    return item.correctAnswer ? 'after_correct_answer' : 'after_any_response'
  }

  return 'after_correct_answer'
}

// ── Hint builder ──────────────────────────────────────────────────────────────

function buildHints(entry: ExerciseManifestEntry, item: ManifestItem): string[] {
  const hints: string[] = []

  if (entry.runtimeMode === 'deterministic_sequential' && item.correctAnswer) {
    // Progressive hints: first character, then first word, then full answer
    const answer = item.correctAnswer
    hints.push(`The answer starts with "${answer[0]}".`)
    if (answer.includes(' ')) {
      const firstWord = answer.split(' ')[0]
      hints.push(`The first word is "${firstWord}".`)
    }
    hints.push(`The answer is: "${answer}". Try to remember it for next time.`)
  }

  if (entry.runtimeMode === 'soft_speaking') {
    hints.push('Think about what feels true for you personally.')
    hints.push('Use the sentence structure from the instruction as a guide.')
  }

  if (entry.runtimeMode === 'text_reading_sequential' && item.correctAnswer) {
    const answer = item.correctAnswer
    hints.push(`Look carefully at the relevant part of the text or the visible options.`)
    hints.push(`The answer is "${answer}". Try to find where it fits.`)
  }

  return hints
}

// ── Explanation builder ───────────────────────────────────────────────────────

function buildExplanation(entry: ExerciseManifestEntry, item: ManifestItem): string {
  if (item.correctAnswer) {
    return `The correct answer is "${item.correctAnswer}". ${entry.instruction}`
  }
  return entry.instruction
}

// ── Step difficulty mapping ───────────────────────────────────────────────────

function resolveStepDifficulty(entry: ExerciseManifestEntry): StepDifficulty {
  if (entry.runtimeMode === 'unsupported') return 'easy'
  if (entry.runtimeMode === 'soft_speaking') return 'medium'
  if (entry.runtimeMode === 'text_reading_sequential') return 'medium'
  const answerLengths = entry.items?.map(i => i.correctAnswer.split(' ').length) ?? [1]
  const avg = answerLengths.reduce((a, b) => a + b, 0) / (answerLengths.length || 1)
  if (avg <= 1) return 'easy'
  if (avg <= 3) return 'medium'
  return 'hard'
}

// ── Meta builder ──────────────────────────────────────────────────────────────

function buildMeta(entry: ExerciseManifestEntry, sectionId: string, unit: number): ExerciseMeta {
  const difficultyByMode: Record<string, number> = {
    deterministic_sequential:  0.5,
    text_reading_sequential:   0.5,
    soft_speaking:             0.3,
    unsupported:               0.1,
  }
  return {
    lessonSection:     sectionId,
    exerciseNumber:    entry.num,
    unit,
    difficulty:        difficultyByMode[entry.runtimeMode] ?? 0.4,
    skillFocus:        entry.type,
    runtimeMode:       entry.runtimeMode,
    completionBehavior: entry.completionBehavior,
    dependsOn:         entry.dependsOn,
  }
}

// ── Main parser ───────────────────────────────────────────────────────────────

export function parseManifestEntry(
  entry: ExerciseManifestEntry,
  sectionId: string,
  unit: number,
): ExerciseSpec {
  const exerciseId = uuid()
  const exType = resolveExerciseType(entry.type)
  const difficulty = resolveStepDifficulty(entry)

  // Build steps from items array (deterministic) or single synthetic step (speaking/skip)
  let steps: StepSpec[]

  if (!entry.executable) {
    // Unsupported — single auto-skip step
    steps = [{
      stepId:              `${exerciseId}_step_0`,
      stepIndex:           0,
      question:            entry.instruction,
      expectedAnswer:      '',
      validationRule:      { mode: 'not_applicable' },
      hints:               [],
      explanation:         `This exercise requires ${entry.unsupportedReason?.replace('_', ' ')} and will be skipped.`,
      progressionCondition: 'auto_skip',
      difficulty:          'easy',
    }]
  } else if (entry.runtimeMode === 'soft_speaking' && !entry.items?.length) {
    // Single discussion prompt
    const prompt = entry.allowedPrompt ?? entry.instruction
    steps = [{
      stepId:              `${exerciseId}_step_0`,
      stepIndex:           0,
      question:            prompt,
      expectedAnswer:      '',
      validationRule:      { mode: 'any_response', maxRetries: 1 },
      hints:               ['Share your own opinion — there are no wrong answers here.'],
      explanation:         '',
      progressionCondition: 'after_single_response',
      difficulty:          'easy',
    }]
  } else {
    // Deterministic sequential, text_reading_sequential, or soft_speaking with items
    const items = entry.items ?? []
    steps = items.map((item, i): StepSpec => ({
      stepId:              `${exerciseId}_step_${i}`,
      stepIndex:           i,
      question:            item.text,
      expectedAnswer:      item.correctAnswer,
      validationRule:      buildValidationRule(entry, item),
      hints:               buildHints(entry, item),
      explanation:         buildExplanation(entry, item),
      progressionCondition: buildProgressionCondition(entry, item),
      difficulty,
    }))

    // For single-response exercises with items: override to advance after any
    if (entry.completionBehavior === 'single_response') {
      steps = steps.map(s => ({ ...s, progressionCondition: 'after_single_response' as ProgressionCondition }))
    }
  }

  const spec: ExerciseSpec = {
    exerciseId,
    exerciseType: exType,
    instruction:  entry.instruction,
    title:        `Exercise ${entry.num}`,
    description:  `${entry.type.replace(/_/g, ' ')} — ${sectionId}`,
    meta:         buildMeta(entry, sectionId, unit),
    steps,
    lessonReference: `Focus B1 Unit ${unit} Section ${sectionId} Ex ${entry.num}`,
  }

  // Attach visible options (word box, sentence choices) to ExerciseSpec for frontend
  const visibleOptions = entry.options ?? entry.wordBox
  if (visibleOptions && visibleOptions.length > 0) {
    spec.options = visibleOptions
    console.log(
      `[reading_payload_built] section="${sectionId}" exercise=${entry.num} type="${entry.type}" ` +
      `items=${entry.items?.length ?? 0} options=${visibleOptions.length}`,
    )
  } else if (entry.runtimeMode === 'text_reading_sequential') {
    console.log(
      `[reading_payload_missing_content] section="${sectionId}" exercise=${entry.num} type="${entry.type}" ` +
      `reason="no_options_in_manifest"`,
    )
  }

  return spec
}
