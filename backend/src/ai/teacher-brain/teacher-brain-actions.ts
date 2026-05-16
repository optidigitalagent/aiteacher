import type { TeacherAction, ForbiddenAction, ActionDefinition } from './teacher-brain.types.js'

export const ALLOWED_ACTIONS: readonly ActionDefinition[] = [
  {
    action: 'present_item',
    description: 'AI is presenting a new exercise item to the student',
    backendEffect: 'Validate that itemIndex matches backend state',
  },
  {
    action: 'continue_current_item',
    description: 'AI is giving a hint or re-inviting response on the current item',
    backendEffect: 'No cursor change',
  },
  {
    action: 'confirm_correct',
    description: 'AI confirmed a correct answer from the student',
    backendEffect: 'Backend advances cursor if validator approved (not on AI say-so alone)',
  },
  {
    action: 'transition_next_exercise',
    description: 'AI announcing move to next exercise',
    backendEffect: 'Backend validates that current exercise is fully complete',
  },
  {
    action: 'skip_exercise',
    description: 'AI acknowledging an unsupported exercise and moving forward',
    backendEffect: 'Backend must have already classified as unsupported; cursor advances',
  },
  {
    action: 'complete_lesson',
    description: 'AI closing the lesson at the end',
    backendEffect: 'Backend validates all exercises processed; triggers billing finalization',
  },
  {
    action: 'clarify_item',
    description: 'AI re-explaining the current item without giving a hint',
    backendEffect: 'No cursor change',
  },
  {
    action: 'side_question_answered',
    description: 'AI answered a side question and is returning to the current item',
    backendEffect: 'No cursor change; triggers continuity re-anchor to current item',
  },
  {
    action: 'request_retry',
    description: 'AI asking student to try the current item again after a hint',
    backendEffect: 'No cursor change',
  },
  {
    action: 'complete_item',
    description: 'AI confirming a single item within an exercise is complete',
    backendEffect: 'Backend marks item as completed in completedItems array',
  },
  {
    action: 'complete_exercise',
    description: 'AI announcing that all items in the exercise are done',
    backendEffect: 'Backend validates itemIndex reached exerciseItems.length',
  },
  {
    action: 'ask_clarification',
    description: 'AI asking student to clarify an ambiguous or unclear response',
    backendEffect: 'No cursor change',
  },
  {
    action: 'answer_side_question',
    description: 'AI is answering a side question (alias for side_question_answered)',
    backendEffect: 'No cursor change',
  },
  {
    action: 'resume_current_item',
    description: 'AI resuming the current item after confusion or side question',
    backendEffect: 'No cursor change; re-presents current item from state',
  },
]

export const FORBIDDEN_ACTIONS: readonly { action: ForbiddenAction; reason: string }[] = [
  {
    action: 'go_back_to_item',
    reason: 'Exercise cursor is unidirectional — backward navigation corrupts state',
  },
  {
    action: 'repeat_completed_exercise',
    reason: 'Completed exercises are hard-closed and cannot be re-entered',
  },
  {
    action: 'invent_exercise',
    reason: 'Only textbook exercises from backend context are valid — no invented content',
  },
  {
    action: 'skip_supported_exercise',
    reason: 'Only the backend can initiate a skip via unsupported classification',
  },
  {
    action: 'change_lesson_section',
    reason: 'Section navigation is backend-controlled and student cannot redirect it',
  },
  {
    action: 'reopen_completed_exercise',
    reason: 'Completed exercises are permanently closed — hard-close enforced by backend',
  },
  {
    action: 'invent_new_exercise',
    reason: 'No invented content — only textbook exercises from backend state',
  },
  {
    action: 'change_exercise_type',
    reason: 'Exercise type is set by textbook — AI cannot reclassify or adapt it',
  },
  {
    action: 'hallucinate_hidden_content',
    reason: 'If content is not in AI context, it does not exist — must skip or ask for data',
  },
]

const ALLOWED_ACTION_SET = new Set<string>(ALLOWED_ACTIONS.map(a => a.action))

export function isAllowedAction(action: string): action is TeacherAction {
  return ALLOWED_ACTION_SET.has(action)
}

export function isForbiddenAction(action: string): action is ForbiddenAction {
  return FORBIDDEN_ACTIONS.some(f => f.action === action)
}

export function getActionDefinition(action: TeacherAction): ActionDefinition | undefined {
  return ALLOWED_ACTIONS.find(a => a.action === action)
}

export function getForbiddenReason(action: string): string | undefined {
  return FORBIDDEN_ACTIONS.find(f => f.action === action)?.reason
}

// Future Phase C: validate AI's proposed action against current backend state
export interface ActionValidationResult {
  valid: boolean
  reason?: string
}

export function validateActionIntegrity(
  action: string,
  proposedExerciseNum?: number,
  stateExerciseNum?: number,
  proposedItemIndex?: number,
  stateItemIndex?: number,
): ActionValidationResult {
  if (!isAllowedAction(action)) {
    return { valid: false, reason: `Action "${action}" is not in the allowed action list` }
  }

  if (proposedExerciseNum !== undefined && stateExerciseNum !== undefined) {
    if (proposedExerciseNum !== stateExerciseNum) {
      return {
        valid: false,
        reason: `Action references exercise ${proposedExerciseNum} but backend state is on exercise ${stateExerciseNum}`,
      }
    }
  }

  if (proposedItemIndex !== undefined && stateItemIndex !== undefined) {
    if (action === 'present_item' && proposedItemIndex !== stateItemIndex) {
      return {
        valid: false,
        reason: `present_item references item ${proposedItemIndex} but backend cursor is at ${stateItemIndex}`,
      }
    }
  }

  return { valid: true }
}
