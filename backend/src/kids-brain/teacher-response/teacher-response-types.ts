import type {
  AgeBand,
  RecoveryState,
  ClassificationLabel,
  ActivityType,
} from '../shared/enums.js';
import type { SessionMemory } from '../contracts/session-memory.js';
import type { LearningDecision } from '../learning-engine/learning-decision.js';
import type { StateEngineOutput } from '../state-engine/state-update-result.js';
import type { ResponseClassificationResult } from '../classification/classification-result.js';
import type { PerceptionBundle } from '../perception/perception-bundle.js';
import type { ActivityContext } from '../classification/classification-types.js';

/**
 * Response mode — records how the teacher text was generated.
 * Used for observability and test assertions.
 */
export type ResponseMode =
  | 'scripted'        // Pre-written script, no variable resolution
  | 'template'        // Template bank entry with resolved variables
  | 'llm_assisted'    // Template sent to LLM for variation (requiresLLM=true)
  | 'recovery_script' // Deterministic recovery response
  | 'safety_close'    // Hard safety close — no LLM, no open questions
  | 'fallback_safe';  // Universal fallback when all other paths produce invalid output

/**
 * Activity/item context passed to the Teacher Response Engine per turn.
 * Contains everything needed to build a contextually correct teacher utterance.
 */
export interface TeacherResponseContext {
  /** Target word the child should produce this turn (e.g. "dog"). null if no active item. */
  targetWord: string | null;
  /** Child's display first name — never LLM-generated. */
  childFirstName: string;
  ageBand: AgeBand;
  activityContext: ActivityContext;
  /** Session target vocabulary words (lesson scope). */
  lessonTargetWords: string[];
  /** Review words from the current unit. */
  unitReviewWords: string[];
  /** Character names active in this lesson. */
  characterNames: string[];
  /** Option A for forced-choice prompts. */
  forcedChoiceOptionA?: string;
  /** Option B for forced-choice prompts. */
  forcedChoiceOptionB?: string;
  /** Whether the session L1 budget has been exhausted. */
  l1BudgetUsed: boolean;
  /**
   * Current scaffold level to apply (1–6).
   * 1 = repeat slower, 6 = L1 anchor (only if budget allows).
   */
  scaffoldLevel: 1 | 2 | 3 | 4 | 5 | 6;
  recoveryState: RecoveryState;
  /** Classification label from the current turn (for context routing). */
  classificationLabel: ClassificationLabel;
  /** Current activity type — used by activity prompt builder. */
  currentActivityType: ActivityType;
}

/** Full input contract for the Teacher Response Engine (Phase 6). */
export interface TeacherResponseInput {
  sessionMemory: SessionMemory;
  learningDecision: LearningDecision;
  stateEngineOutput: StateEngineOutput;
  classificationResult: ResponseClassificationResult;
  perceptionBundle: PerceptionBundle;
  responseContext: TeacherResponseContext;
  /** ISO 8601 timestamp for this turn. */
  timestamp: string;
}
