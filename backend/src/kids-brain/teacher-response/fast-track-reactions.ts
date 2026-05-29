import { ClassificationLabel, FeedbackTone } from '../shared/enums.js';

/**
 * A fast-track reaction fires immediately (within 0–1000ms) after any child response,
 * independent of LLM. It sets the emotional tone before the main teacher utterance.
 * Spec: teacher-policy.md §6, dialogue-rules.yaml authority_table.always_scripted.
 */
export interface FastTrackReaction {
  text: string;
  tone: FeedbackTone;
}

const CORRECT_REACTIONS: readonly string[] = [
  'Yes!', 'Wow!', 'Amazing!', 'Yes, YES!', 'Brilliant!', 'Ooh!',
];

const EFFORT_REACTIONS: readonly string[] = [
  'Ooh, good try!', 'I love how you tried!', 'Ooh!', 'Hmm!', 'Great try!',
];

const RECOVERY_REACTIONS: readonly string[] = [
  "It's okay!", "That's okay!", 'No worries!', 'Hey, it\'s okay!',
];

const SUCCESS_AFTER_RECOVERY_REACTIONS: readonly string[] = [
  'You did it!', 'Yes! You got it!', 'Amazing!', 'YES! You did it!',
];

const SAFETY_CLOSE_REACTIONS: readonly string[] = [
  "Let's take a break.", "It's okay.",
];

const NEUTRAL_REACTIONS: readonly string[] = [
  'Hmm...', 'Ooh!', 'Let me see...', 'Hmm, I wonder...',
];

/** Picks a variant not recently used; falls back to any variant. */
function pickVariant(
  variants: readonly string[],
  recentPhrases: string[],
): string {
  const available = variants.filter(v => !recentPhrases.includes(v));
  const pool = available.length > 0 ? available : [...variants];
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Returns an instant scripted fast-track reaction for a given classification label.
 * Must be independent of LLM — always returns immediately.
 */
export function getFastTrackReaction(
  label: ClassificationLabel,
  recentPhrases: string[],
): FastTrackReaction {
  switch (label) {
    case ClassificationLabel.CORRECT_CONFIDENT:
      return {
        text: pickVariant(CORRECT_REACTIONS, recentPhrases),
        tone: FeedbackTone.CELEBRATORY,
      };

    case ClassificationLabel.CORRECT_HESITANT:
    case ClassificationLabel.NEAR_CORRECT:
    case ClassificationLabel.PRONUNCIATION_VARIANT:
    case ClassificationLabel.PARTIAL_ANSWER:
    case ClassificationLabel.REPEATED_AFTER_MODEL:
      return {
        text: pickVariant(EFFORT_REACTIONS, recentPhrases),
        tone: FeedbackTone.WARM,
      };

    case ClassificationLabel.EMOTIONAL_SHUTDOWN:
    case ClassificationLabel.REFUSAL:
    case ClassificationLabel.L1_REFUSAL:
      return {
        text: pickVariant(RECOVERY_REACTIONS, recentPhrases),
        tone: FeedbackTone.GENTLE_CORRECTION,
      };

    case ClassificationLabel.UNSAFE_OR_SENSITIVE:
      return {
        text: pickVariant(SAFETY_CLOSE_REACTIONS, recentPhrases),
        tone: FeedbackTone.NEUTRAL,
      };

    // Silence — warm wait, not neutral
    case ClassificationLabel.SILENCE_SHORT:
    case ClassificationLabel.SILENCE_MEDIUM:
    case ClassificationLabel.SILENCE_LONG:
    case ClassificationLabel.NO_RESPONSE:
      return {
        text: pickVariant(NEUTRAL_REACTIONS, recentPhrases),
        tone: FeedbackTone.WARM,
      };

    // L1 — treat as comprehension evidence, warm bridge
    case ClassificationLabel.L1_TRANSLATION:
    case ClassificationLabel.L1_HELP_REQUEST:
    case ClassificationLabel.CODE_SWITCH:
      return {
        text: pickVariant(EFFORT_REACTIONS, recentPhrases),
        tone: FeedbackTone.WARM,
      };

    default:
      return {
        text: pickVariant(NEUTRAL_REACTIONS, recentPhrases),
        tone: FeedbackTone.WARM,
      };
  }
}

/**
 * Gets the fast-track reaction for a successful response after a recovery sequence.
 * Uses celebratory variants — child overcame difficulty.
 */
export function getSuccessAfterRecoveryReaction(
  recentPhrases: string[],
): FastTrackReaction {
  return {
    text: pickVariant(SUCCESS_AFTER_RECOVERY_REACTIONS, recentPhrases),
    tone: FeedbackTone.CELEBRATORY,
  };
}
