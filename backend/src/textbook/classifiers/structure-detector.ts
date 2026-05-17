// ── Structure Detector ─────────────────────────────────────────────────────────
// Detects exercise block boundaries in normalized textbook text.
// Handles: "1 Instruction", "1. Instruction", "Exercise 3 Instruction", "Ex. 3"

import type { RawExerciseBlock, RawSection } from '../types.js'

export interface StructureDetectorConfig {
  sectionId: string
  unitNumber: number
}

interface BlockBuilder {
  exerciseNumber: number
  instructionLines: string[]
  bodyLines: string[]
  inBody: boolean
  startLine: number
}

// ── Public API ────────────────────────────────────────────────────────────────

export function buildRawSection(rawText: string, config: StructureDetectorConfig): RawSection {
  const exerciseBlocks = detectExerciseBlocks(rawText)
  const parseWarnings = checkSequentialNumbering(exerciseBlocks)

  return {
    sectionId:      config.sectionId,
    unitNumber:     config.unitNumber,
    rawText,
    exerciseBlocks,
    parseWarnings,
  }
}

// ── Block detection ───────────────────────────────────────────────────────────

function detectExerciseBlocks(rawText: string): RawExerciseBlock[] {
  const lines  = rawText.split('\n')
  const blocks: RawExerciseBlock[] = []
  let current: BlockBuilder | null = null
  let blockIndex = 0
  // Track the last confirmed exercise number so we only accept sequential advances
  let lastExerciseNum = 0

  const flush = (endLine: number) => {
    if (!current) return
    blocks.push({
      blockIndex:      blockIndex++,
      exerciseNumber:  current.exerciseNumber,
      instructionRaw:  current.instructionLines.join(' ').trim(),
      bodyRaw:         current.bodyLines.join('\n').trim(),
      rawLines:        [...current.instructionLines, ...current.bodyLines],
      sourceLineStart: current.startLine,
      sourceLineEnd:   endLine,
    })
    current = null
  }

  lines.forEach((line, lineIndex) => {
    const trimmed = line.trim()

    if (!trimmed) {
      if (current) current.bodyLines.push('')
      return
    }

    const exerciseNum = detectExerciseHeader(trimmed)

    // Accept as a new exercise only if:
    //   a) number is strictly greater than last confirmed exercise (sequential)
    //   b) OR no exercise has been seen yet (first in section)
    const isNewExercise =
      exerciseNum !== null &&
      (lastExerciseNum === 0 || exerciseNum === lastExerciseNum + 1)

    if (isNewExercise) {
      flush(lineIndex - 1)
      lastExerciseNum = exerciseNum!
      current = {
        exerciseNumber:   exerciseNum!,
        instructionLines: [trimmed],
        bodyLines:        [],
        inBody:           false,
        startLine:        lineIndex,
      }
      return
    }

    if (!current) return

    if (!current.inBody && isInstructionContinuation(trimmed)) {
      current.instructionLines.push(trimmed)
    } else {
      current.inBody = true
      current.bodyLines.push(trimmed)
    }
  })

  flush(lines.length - 1)
  return blocks
}

// ── Header detection ──────────────────────────────────────────────────────────
// A line is an exercise header only when it looks like an instruction,
// not a short item. Minimum 25 characters ensures "1 She reads" is not matched.

const MIN_INSTRUCTION_LENGTH = 25

function detectExerciseHeader(line: string): number | null {
  // "Exercise 3" or "Ex. 3" or "Ex 3" (explicit label — no length requirement)
  const exMatch = line.match(/^[Ee]x(?:ercise)?\.?\s+(\d{1,2})\b/)
  if (exMatch) return clampExerciseNum(parseInt(exMatch[1]!, 10))

  // Short lines are never exercise headers (they're items inside a body)
  if (line.length < MIN_INSTRUCTION_LENGTH) return null

  // "1. Instruction text" — number + dot + space + capital
  const dotMatch = line.match(/^(\d{1,2})\.\s+[A-ZÀ-ɏ]/)
  if (dotMatch) return clampExerciseNum(parseInt(dotMatch[1]!, 10))

  // "1 Instruction text" — number + space + capital (no dot)
  const noMatch = line.match(/^(\d{1,2})\s+[A-ZÀ-ɏ]/)
  if (noMatch) return clampExerciseNum(parseInt(noMatch[1]!, 10))

  return null
}

function clampExerciseNum(n: number): number | null {
  return n >= 1 && n <= 25 ? n : null
}

// ── Continuation detection ────────────────────────────────────────────────────

function isInstructionContinuation(line: string): boolean {
  // Body items start with numbered items or letter options
  if (/^\d+[a-b]?\.\s/.test(line)) return false
  if (/^[a-h]\)\s/.test(line)) return false
  if (/^[A-Z]\s+[A-Z]/.test(line)) return false   // two capitalized words = body
  // Lowercase start = likely instruction continuation
  if (/^[a-z]/.test(line)) return true
  // Long sentence ending with period = likely instruction continuation
  if (line.length > 60 && line.endsWith('.')) return true
  return false
}

// ── Validation ────────────────────────────────────────────────────────────────

function checkSequentialNumbering(blocks: RawExerciseBlock[]): string[] {
  const warnings: string[] = []
  for (let i = 1; i < blocks.length; i++) {
    const prev = blocks[i - 1]!.exerciseNumber
    const curr = blocks[i]!.exerciseNumber
    if (curr !== prev + 1) {
      warnings.push(`Exercise numbering gap detected: ${prev} → ${curr}`)
    }
  }
  return warnings
}
