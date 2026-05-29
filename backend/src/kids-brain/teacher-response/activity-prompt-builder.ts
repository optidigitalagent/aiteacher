import { ActivityType, LearningActivityType } from '../shared/enums.js';
import { getRenderedTemplate } from './response-template-bank.js';
import { UNIVERSAL_FALLBACK_TEXT } from './teacher-response-constants.js';

/**
 * Parameters for building an activity-specific teacher prompt.
 * No prompt should require visual UI without a non-visual fallback (spec Phase 6).
 */
export interface ActivityPromptParams {
  targetWord: string | null;
  forcedChoiceOptionA?: string;
  forcedChoiceOptionB?: string;
  recentPhrases: string[];
}

type AllActivityType = ActivityType | LearningActivityType | string;

/**
 * Builds a teacher prompt appropriate for the given activity type.
 *
 * Design rule: every prompt must work without visual UI.
 * Bad: "Look at the picture. What is it?" — requires visual
 * Good: "Listen! Cat. Say: cat." — audio-first
 */
export function buildActivityPrompt(
  activityType: AllActivityType,
  params: ActivityPromptParams,
): string {
  const word = params.targetWord ?? '';
  const optA = params.forcedChoiceOptionA ?? 'option one';
  const optB = params.forcedChoiceOptionB ?? 'option two';
  const vars = { word, optA, optB };
  const recent = params.recentPhrases;

  switch (activityType) {
    case ActivityType.LISTEN_AND_POINT:
      // Reception only — no speech required. Non-visual fallback: "Show me!"
      return getRenderedTemplate('repeat_after_me', vars, recent);

    case ActivityType.REPEAT_AFTER_ME:
      return getRenderedTemplate('repeat_after_me', vars, recent);

    case ActivityType.FORCED_CHOICE_2:
    case ActivityType.FORCED_CHOICE_4:
      return getRenderedTemplate('forced_choice', vars, recent);

    case ActivityType.SUPPORTED_PRODUCTION:
      return getRenderedTemplate('supported_production', vars, recent);

    case ActivityType.SENTENCE_FRAME_PRODUCTION:
      return word
        ? `Say it: I see a ${word}!`
        : UNIVERSAL_FALLBACK_TEXT;

    case ActivityType.SENTENCE_PRODUCTION:
      return word
        ? `What is the ${word}? Tell me!`
        : `What do you see? Tell me!`;

    case ActivityType.REVIEW_PRODUCTION:
      return word
        ? `Do you remember? What is this? It's a ${word}!`
        : `What do you remember? Tell me!`;

    case LearningActivityType.YES_NO_COMPREHENSION:
      return word
        ? `Is it a ${word}? Yes or no?`
        : `Do you know? Yes or no?`;

    case LearningActivityType.TPR_ACTION:
      // Total Physical Response — instruction only, no visual needed
      return word
        ? `Listen and do it — ${word}! Can you show me ${word}?`
        : `Listen and do it with me! Ready?`;

    case LearningActivityType.REVIEW_LOOP:
      return word
        ? `Let's practice! Say: ${word}! One more time — ${word}!`
        : `Let's review! Are you ready?`;

    case LearningActivityType.EASIEST_WIN:
      return getRenderedTemplate('easiest_win', vars, recent);

    case LearningActivityType.RECOVERY_PROMPT:
      return getRenderedTemplate('recovery_prompt', vars, recent);

    default:
      // close_success or unknown activity
      return getRenderedTemplate('close_success', vars, recent);
  }
}
