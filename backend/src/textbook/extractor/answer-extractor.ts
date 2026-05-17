// ── Answer Extractor ───────────────────────────────────────────────────────────
// Parses teacher book text to extract an answer key, then overlays answers
// onto ParsedExercise items. This is the only path through which correctAnswer
// values are set — AI never provides answers.

import { normalizeText, stripLeadingNumber } from '../parsers/normalizer.js'
import type { ParsedExercise, TeacherBookAnswer, TeacherBookAnswerKey } from '../types.js'

// ── Teacher book answer key extraction ───────────────────────────────────────

export function extractAnswerKey(teacherBookText: string, sectionId: string): TeacherBookAnswerKey {
  const normalized = normalizeText(teacherBookText)
  const lines      = normalized.split('\n').map(l => l.trim()).filter(Boolean)
  const answers: TeacherBookAnswer[] = []

  let currentExerciseNumber = 0

  for (const line of lines) {
    const exNum = detectExerciseHeader(line)
    if (exNum !== null) {
      currentExerciseNumber = exNum
      continue
    }

    if (currentExerciseNumber === 0) continue

    const { number, text } = stripLeadingNumber(line)
    if (number === null || !text) continue

    const answer = parseAnswerLine(text)
    if (answer.primary) {
      answers.push({
        exerciseNumber:     currentExerciseNumber,
        itemIndex:          number - 1,  // 0-based
        answer:             answer.primary,
        alternativeAnswers: answer.alternatives,
      })
    }
  }

  return { sectionId, answers }
}

// ── Overlay onto parsed exercises ─────────────────────────────────────────────

export function overlayAnswers(
  exercises: ParsedExercise[],
  answerKey: TeacherBookAnswerKey,
): ParsedExercise[] {
  return exercises.map(exercise => {
    const exerciseAnswers = answerKey.answers.filter(
      a => a.exerciseNumber === exercise.exerciseNumber,
    )
    if (exerciseAnswers.length === 0) return exercise

    const updatedItems = exercise.items.map(item => {
      const answer = exerciseAnswers.find(a => a.itemIndex === item.index)
      return answer ? { ...item, correctAnswer: answer.answer } : item
    })

    return { ...exercise, items: updatedItems }
  })
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function detectExerciseHeader(line: string): number | null {
  // "Exercise 3" / "Ex 3" / "Ex. 3" / "3 Answer" / "3."
  const m = line.match(/^(?:[Ee]x(?:ercise)?\.?\s+)?(\d{1,2})(?:\.\s*$|\s+[Aa]nswer)?$/)
  if (m) {
    const n = parseInt(m[1]!, 10)
    if (n >= 1 && n <= 25) return n
  }
  return null
}

interface AnswerParts {
  primary: string
  alternatives: string[]
}

function parseAnswerLine(text: string): AnswerParts {
  // Handles: "do", "do / did", "do, did", "do | did"
  const parts = text.split(/\s*[/|,]\s*/).map(p => p.trim()).filter(Boolean)
  return {
    primary:      parts[0] ?? '',
    alternatives: parts.slice(1),
  }
}
