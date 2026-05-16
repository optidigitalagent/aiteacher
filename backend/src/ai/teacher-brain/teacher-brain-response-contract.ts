import type {
  TeacherResponseContract,
  TeacherAction,
  CorrectionTurn,
  TeacherBrainStructuredResponse,
  ParsedTeacherBrainResponse,
} from './teacher-brain.types.js'
import { isAllowedAction } from './teacher-brain-actions.js'

// Strict structured response schema for AI outputs.
// Phase B: defines the contract. Phase C: backend validates against state.

export interface ContractValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

export function validateResponseContract(raw: unknown): ContractValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (!raw || typeof raw !== 'object') {
    return { valid: false, errors: ['Response is not an object'], warnings: [] }
  }

  const obj = raw as Record<string, unknown>

  if (typeof obj['teacher_text'] !== 'string' || obj['teacher_text'].trim() === '') {
    errors.push('teacher_text must be a non-empty string')
  }

  if (typeof obj['action'] !== 'string') {
    errors.push('action must be a string')
  } else if (!isAllowedAction(obj['action'])) {
    errors.push(`action "${obj['action']}" is not in the allowed action list`)
  }

  if (obj['exerciseNum'] !== undefined && typeof obj['exerciseNum'] !== 'number') {
    errors.push('exerciseNum must be a number if provided')
  }

  if (obj['itemIndex'] !== undefined && typeof obj['itemIndex'] !== 'number') {
    errors.push('itemIndex must be a number if provided')
  }

  if (obj['correctionTurn'] !== undefined && obj['correctionTurn'] !== null) {
    const validTurns: CorrectionTurn[] = ['A', 'B', 'C', 'D']
    if (!validTurns.includes(obj['correctionTurn'] as CorrectionTurn)) {
      errors.push('correctionTurn must be A, B, C, D, or null')
    }
  }

  if (obj['confidence'] !== undefined) {
    if (typeof obj['confidence'] !== 'number' || obj['confidence'] < 0 || obj['confidence'] > 1) {
      warnings.push('confidence should be a number between 0 and 1')
    }
  }

  const teacherText = obj['teacher_text'] as string
  if (typeof teacherText === 'string' && teacherText.split(/[.!?]/).length > 5) {
    warnings.push('teacher_text exceeds 4 sentences — consider trimming for voice delivery')
  }

  return { valid: errors.length === 0, errors, warnings }
}

export function parseResponseContract(raw: unknown): TeacherResponseContract | null {
  const result = validateResponseContract(raw)
  if (!result.valid) return null

  const obj = raw as Record<string, unknown>
  return {
    teacher_text: obj['teacher_text'] as string,
    action: obj['action'] as TeacherAction,
    exerciseNum: typeof obj['exerciseNum'] === 'number' ? obj['exerciseNum'] : undefined,
    itemIndex: typeof obj['itemIndex'] === 'number' ? obj['itemIndex'] : undefined,
    correctionTurn: (obj['correctionTurn'] as CorrectionTurn | null) ?? undefined,
    confidence: typeof obj['confidence'] === 'number' ? obj['confidence'] : undefined,
    reasoning: typeof obj['reasoning'] === 'string' ? obj['reasoning'] : undefined,
  }
}

// Describes the contract for injection into AI system prompt (future Phase C)
export const RESPONSE_CONTRACT_SCHEMA = `STRUCTURED RESPONSE CONTRACT (future implementation):
{
  "teacher_text": string,      // what you say to the student
  "action": TeacherAction,     // one of the allowed actions
  "exerciseNum": number?,      // current exercise number (if relevant)
  "itemIndex": number?,        // current item index (if relevant)
  "correctionTurn": A|B|C|D?, // correction turn (if in correction mode)
  "confidence": 0-1?,         // AI confidence in this action
  "reasoning": string?         // brief internal reasoning (not spoken)
}` as const

// Serialize a contract to JSON string for logging/inspection
export function serializeContract(contract: TeacherResponseContract): string {
  return JSON.stringify(contract, null, 2)
}

// ── Phase D: structured output block parser ────────────────────────────────────

const TB_BLOCK_RE = /<TEACHER_BRAIN_JSON>([\s\S]*?)<\/TEACHER_BRAIN_JSON>/

// Strip <TEACHER_BRAIN_JSON>...</TEACHER_BRAIN_JSON> from any string (speech / display_text safety)
export function stripTeacherBrainBlock(text: string): string {
  return text.replace(TB_BLOCK_RE, '').trim()
}

// Parse and extract the optional structured Teacher Brain block from raw AI output.
// The block may appear after the main JSON response (or inside speech field).
// Returns visibleText (block stripped), structured (if valid), parseError (if malformed).
export function parseTeacherBrainResponse(rawText: string): ParsedTeacherBrainResponse {
  const match = TB_BLOCK_RE.exec(rawText)
  if (!match) {
    return { visibleText: rawText }
  }

  const visibleText = rawText.replace(TB_BLOCK_RE, '').trim()
  const jsonStr = (match[1] ?? '').trim()

  let parsed: unknown
  try {
    parsed = JSON.parse(jsonStr)
  } catch {
    return {
      visibleText: visibleText || rawText,
      parseError: 'invalid JSON in TEACHER_BRAIN_JSON block',
    }
  }

  if (!parsed || typeof parsed !== 'object') {
    return {
      visibleText: visibleText || rawText,
      parseError: 'TEACHER_BRAIN_JSON block is not an object',
    }
  }

  const obj = parsed as Record<string, unknown>

  if (typeof obj['teacher_text'] !== 'string') {
    return {
      visibleText: visibleText || rawText,
      parseError: 'teacher_text must be a string',
    }
  }

  if (typeof obj['action'] !== 'string' || !isAllowedAction(obj['action'])) {
    return {
      visibleText: visibleText || rawText,
      parseError: `invalid or disallowed action: "${String(obj['action'])}"`,
    }
  }

  const structured: TeacherBrainStructuredResponse = {
    teacher_text: obj['teacher_text'] as string,
    action: obj['action'] as TeacherAction,
    exerciseNum: typeof obj['exerciseNum'] === 'number' ? obj['exerciseNum'] : undefined,
    itemIndex: typeof obj['itemIndex'] === 'number' ? obj['itemIndex'] : undefined,
    confidence: typeof obj['confidence'] === 'number' ? obj['confidence'] : undefined,
    reason: typeof obj['reason'] === 'string' ? obj['reason'] : undefined,
    targetExerciseNum: typeof obj['targetExerciseNum'] === 'number' ? obj['targetExerciseNum'] : undefined,
    targetItemIndex: typeof obj['targetItemIndex'] === 'number' ? obj['targetItemIndex'] : undefined,
    unsupportedReason: typeof obj['unsupportedReason'] === 'string' ? obj['unsupportedReason'] : undefined,
  }

  // If visibleText is empty (block-only response), fall back to teacher_text as visible content
  const finalVisibleText = visibleText || structured.teacher_text

  return { visibleText: finalVisibleText, structured }
}

// Safe parse: try to extract teacher_text from whatever AI returned
// Used during Phase B when AI may not yet return structured output
export function extractTeacherText(raw: unknown): string {
  if (!raw || typeof raw !== 'object') return ''
  const obj = raw as Record<string, unknown>

  if (typeof obj['teacher_text'] === 'string') return obj['teacher_text']
  if (typeof obj['speech'] === 'string') return obj['speech']
  return ''
}

// Log format for observability (Phase C: validation failures will be logged here)
export interface ContractValidationLog {
  lessonId: string
  exerciseNum: number
  itemIndex: number
  proposedAction: string
  validationResult: ContractValidationResult
  timestamp: string
}

export function buildValidationLog(
  lessonId: string,
  exerciseNum: number,
  itemIndex: number,
  proposedAction: string,
  result: ContractValidationResult,
): ContractValidationLog {
  return {
    lessonId,
    exerciseNum,
    itemIndex,
    proposedAction,
    validationResult: result,
    timestamp: new Date().toISOString(),
  }
}
