// Task Boundary Guard — prevents the teacher from solving all items, leaking future answers,
// or skipping student participation.
//
// This guard analyzes the current cursor state and builds a constraint block
// that prevents specific boundary violations.

export interface TaskBoundaryInput {
  exerciseType:       string
  itemIndex:          number
  itemTotal:          number
  completedItems:     number[]
  correctionTurn:     string | null
  currentCorrectAnswer: string   // server-side only — not to be revealed
  revealOnTurn:       'B' | 'D'  // when reveal is allowed
}

export interface TaskBoundaryResult {
  triggered:    boolean
  violations:   string[]
  instruction:  string
}

export function evaluateTaskBoundary(input: TaskBoundaryInput): TaskBoundaryResult {
  const violations: string[] = []
  const {
    exerciseType, itemIndex, itemTotal, completedItems,
    correctionTurn, currentCorrectAnswer, revealOnTurn,
  } = input

  const remainingItems = itemTotal - completedItems.length
  const isLastItem     = itemIndex === itemTotal - 1

  // Boundary 1: Teacher must not solve items ahead of cursor
  if (remainingItems > 1) {
    violations.push(
      `Do NOT mention, hint at, or solve items ${itemIndex + 2}–${itemTotal}. ` +
      `Student is on item ${itemIndex + 1} of ${itemTotal} — only this item is active.`,
    )
  }

  // Boundary 2: Answer cannot be revealed before the permitted turn
  if (correctionTurn !== null && currentCorrectAnswer) {
    const turnMap: Record<string, number> = { A: 1, B: 2, C: 3, D: 4 }
    const currentTurnNum = turnMap[correctionTurn] ?? 0
    const revealTurnNum  = revealOnTurn === 'B' ? 2 : 4

    if (currentTurnNum < revealTurnNum) {
      violations.push(
        `FORBIDDEN: Revealing the answer before TURN ${revealOnTurn}. ` +
        `Current turn is ${correctionTurn}. Give a hint only.`,
      )
    }
  }

  // Boundary 3: Cannot skip to exercise complete while items remain
  if (completedItems.length < itemTotal && correctionTurn === null && itemIndex < itemTotal) {
    const incomplete = Array.from(
      { length: itemTotal },
      (_, i) => i,
    ).filter(i => !completedItems.includes(i) && i !== itemIndex)

    if (incomplete.length > 0) {
      violations.push(
        `Do NOT announce exercise complete while items [${incomplete.map(i => i + 1).join(', ')}] remain unanswered.`,
      )
    }
  }

  // Boundary 4: Student participation required — teacher must not answer for student
  if (!correctionTurn || correctionTurn === 'A') {
    violations.push(
      `Student must attempt item ${itemIndex + 1} independently. ` +
      `Do NOT provide the answer or any direct part of it.`,
    )
  }

  if (violations.length === 0) {
    return { triggered: false, violations: [], instruction: '' }
  }

  const lines: string[] = [
    '── TASK BOUNDARY GUARD ──',
    `Exercise: ${exerciseType} | Item ${itemIndex + 1}/${itemTotal} | Correction: ${correctionTurn ?? 'none'}`,
    '',
    ...violations.map(v => `⚠ ${v}`),
  ]

  return {
    triggered:   true,
    violations,
    instruction: lines.join('\n'),
  }
}
