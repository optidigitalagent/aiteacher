import { ClassificationLabel } from '../shared/enums.js';
import type { ResponseClassificationResult } from './classification-result.js';
import { buildResult } from './classification-result.js';
import type { ClassificationInput } from './classification-types.js';
import { runDeterministicClassifier } from './deterministic-classifier.js';
import { computeTimeoutFallback } from './timeout-fallback.js';
import type { LLMClassificationInput } from './llm-classifier-contract.js';
import { LLM_CLASSIFICATION_HARD_CAP_MS } from '../shared/constants.js';

/**
 * Classification Engine router (Phase 3).
 *
 * Processing order (spec §6.1, Patch 4):
 * 1. Deterministic fast-path — handles ~70% of cases without LLM.
 * 2. LLM-assisted path — for ambiguous semantic cases only.
 * 3. Timeout fallback — when LLM exceeds 400ms hard cap.
 *
 * Deterministic rules always override LLM when confidence is high.
 * Safety override ALWAYS runs first regardless of any other signal.
 */
export async function classifyResponse(
  input: ClassificationInput,
): Promise<ResponseClassificationResult> {
  const { perception, activityContext, recentTurns, ageProfile, vocabularyContext, llmClassifier } =
    input;

  // Step 1: Deterministic fast-path
  const deterministicResult = runDeterministicClassifier(
    perception,
    activityContext,
    ageProfile,
    vocabularyContext,
  );

  if (deterministicResult !== null) {
    return deterministicResult;
  }

  // Step 2: LLM-assisted path (if classifier is available)
  if (llmClassifier) {
    const recentLabels = recentTurns.slice(-2).map(t => t.classificationLabel);

    const llmInput: LLMClassificationInput = {
      normalizedTranscript: perception.normalizedTranscript ?? '',
      targetItem: activityContext.currentTargetItemId,
      activityType: activityContext.activityId,
      promptType: activityContext.promptType,
      attemptNumber: activityContext.attemptNumber,
      recentLabels,
      ageBand: ageProfile.ageBand,
    };

    const llmResult = await runWithTimeout(
      llmClassifier.classify(llmInput),
      LLM_CLASSIFICATION_HARD_CAP_MS,
    );

    if (llmResult !== 'timeout') {
      // Validate the returned label is in the taxonomy (spec §6.2)
      const validLabels = Object.values(ClassificationLabel) as string[];
      if (validLabels.includes(llmResult.label as string)) {
        return buildResult({
          label: llmResult.label,
          confidence: llmResult.confidence,
          source: 'llm_assisted',
          reasons: [llmResult.reasoning ?? 'llm_classification'],
          perception,
        });
      }
    }

    // LLM timed out or returned invalid label — use fallback
    const recentFailureCount =
      input.recentTurns.filter(t => !t.wasSuccess).length;

    return computeTimeoutFallback(
      perception,
      activityContext.currentTargetItemId,
      recentFailureCount,
    );
  }

  // Step 3: No LLM available — use conservative fallback
  const recentFailureCount = recentTurns.filter(t => !t.wasSuccess).length;
  return computeTimeoutFallback(
    perception,
    activityContext.currentTargetItemId,
    recentFailureCount,
  );
}

// ── Helper ────────────────────────────────────────────────────────────────────

type TimeoutResult<T> = T | 'timeout';

function runWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<TimeoutResult<T>> {
  return Promise.race([
    promise.then(result => result as TimeoutResult<T>),
    new Promise<TimeoutResult<T>>(resolve =>
      setTimeout(() => resolve('timeout'), timeoutMs),
    ),
  ]);
}
