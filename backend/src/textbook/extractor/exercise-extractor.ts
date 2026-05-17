// ── Exercise Extractor ─────────────────────────────────────────────────────────
// Converts RawSection → ParsedSection by classifying and extracting each block.

import { classifyExerciseType } from '../classifiers/exercise-type-classifier.js'
import { extractItems } from './item-extractor.js'
import { normalizeInstruction } from '../parsers/normalizer.js'
import type { RawSection, ParsedExercise, ParsedSection } from '../types.js'

const DISCUSSION_TYPES = new Set([
  'discussion',
  'pair_speaking',
  'reading_comprehension',
  'paragraph_reading',
])

export function extractExercises(rawSection: RawSection): ParsedSection {
  const exercises: ParsedExercise[] = []
  const parseErrors: string[] = [...rawSection.parseWarnings]

  for (const block of rawSection.exerciseBlocks) {
    try {
      const instruction   = normalizeInstruction(block.instructionRaw)
      const typeDetection = classifyExerciseType(instruction)
      const items         = extractItems(block.bodyRaw, typeDetection.type)
      const warnings: string[] = buildWarnings(block.exerciseNumber, typeDetection.confidence, instruction)

      const allowedPrompt = DISCUSSION_TYPES.has(typeDetection.type)
        ? buildDiscussionPrompt(instruction, typeDetection.type)
        : undefined

      exercises.push({
        exerciseNumber: block.exerciseNumber,
        typeDetection,
        instruction,
        items,
        allowedPrompt,
        rawBlock: block,
        parseWarnings: warnings,
      })
    } catch (err) {
      parseErrors.push(`Exercise ${block.exerciseNumber}: ${String(err)}`)
    }
  }

  return {
    sectionId:   rawSection.sectionId,
    unitNumber:  rawSection.unitNumber,
    exercises,
    parseErrors,
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildWarnings(
  exerciseNumber: number,
  confidence: string,
  instruction: string,
): string[] {
  const warnings: string[] = []
  if (confidence === 'low') {
    warnings.push(
      `Exercise ${exerciseNumber}: low-confidence type detection — "${instruction.substring(0, 60)}..."`,
    )
  }
  return warnings
}

function buildDiscussionPrompt(instruction: string, type: string): string {
  if (type === 'pair_speaking') {
    return instruction.replace(/^in\s+pairs[,.]\s+/i, '').trim()
  }
  return instruction
}
