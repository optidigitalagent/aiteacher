// Frontend Sync Guard — ensures teacher speech is synchronized with what the student can see.
//
// The teacher must NEVER reference:
//   • Items not yet displayed (future items)
//   • Options/answers that are not visible on screen
//   • A completed exercise's content as if it's still active
//   • The next exercise's items before the cursor has advanced
//
// This guard builds a context block that constrains teacher speech to visible content.

import { getFrontendRenderPolicy } from './exercise-format-registry.js'

export interface FrontendSyncInput {
  exerciseType:      string
  exerciseNumber:    number
  itemIndex:         number
  itemTotal:         number
  currentItem:       string
  items?:            string[]    // All items if available
  options?:          string[]    // Word bank / options if available
  completedItems:    number[]
  completionState?:  string      // 'complete' | 'skipped' | undefined
  pendingTransition?: boolean
}

export interface FrontendSyncResult {
  triggered:   boolean
  instruction: string
}

export function buildFrontendSyncGuard(input: FrontendSyncInput): FrontendSyncResult {
  const {
    exerciseType, exerciseNumber, itemIndex, itemTotal,
    currentItem, items, options, completedItems,
    completionState, pendingTransition,
  } = input

  const renderPolicy = getFrontendRenderPolicy(exerciseType)
  const lines: string[] = []

  // Sync rule 1: Exercise completion state
  if (completionState === 'complete' || completionState === 'skipped') {
    lines.push(
      `SYNC: Exercise ${exerciseNumber} is ${completionState.toUpperCase()} on the frontend.`,
      'Do NOT reference this exercise\'s items or ask new answers for it.',
      'Announce completion briefly, then present the NEXT exercise.',
    )
  } else if (pendingTransition) {
    lines.push(
      `SYNC: Transition pending — frontend is moving to next exercise.`,
      'Match your speech to the transition: announce the move, then introduce the next exercise.',
    )
  }

  // Sync rule 2: Screen-aware item reference
  if (renderPolicy.doNotRereadItems && currentItem) {
    lines.push(
      `SYNC: Item ${itemIndex + 1} is visible on screen: "${currentItem}"`,
      'Do NOT repeat this text verbatim in speech after the first introduction.',
      'Say "number ' + (itemIndex + 1) + '" or "this one" — not the full text again.',
    )
  }

  // Sync rule 3: Options / word bank visibility
  if (renderPolicy.doNotRereadOptions && options && options.length > 0) {
    lines.push(
      `SYNC: ${renderPolicy.matchingColumnsVisible ? 'Both matching columns' : 'The word bank / options'} are visible on screen.`,
      'Do NOT read all options aloud. Say "look at the options on screen" or reference by letter only.',
    )
  }

  // Sync rule 4: Future items must stay hidden
  const visibleItemCount = renderPolicy.itemsVisible ? Math.min(items?.length ?? itemTotal, itemTotal) : 1
  if (itemIndex < itemTotal - 1 && visibleItemCount > 1 && items && items.length > itemIndex + 1) {
    const nextItem = items[itemIndex + 1]
    if (nextItem) {
      lines.push(
        `SYNC: Item ${itemIndex + 2} is visible on screen but NOT active yet.`,
        `Do NOT ask about or hint toward: "${nextItem.slice(0, 60)}${nextItem.length > 60 ? '...' : ''}"`,
        `Current active item is item ${itemIndex + 1} only.`,
      )
    }
  }

  // Sync rule 5: Completed items must not be re-asked
  if (completedItems.length > 0) {
    lines.push(
      `SYNC: Completed items [${completedItems.map(i => i + 1).join(', ')}] — do NOT re-ask or reference for re-answering.`,
    )
  }

  // Sync rule 6: Matching columns both visible
  if (renderPolicy.matchingColumnsVisible) {
    lines.push(
      `SYNC: Both columns visible (items and options). Reference items by number and options by letter — do NOT read the full lists.`,
    )
  }

  if (lines.length === 0) {
    return { triggered: false, instruction: '' }
  }

  return {
    triggered:   true,
    instruction: ['── FRONTEND SYNC GUARD ──', ...lines].join('\n'),
  }
}
