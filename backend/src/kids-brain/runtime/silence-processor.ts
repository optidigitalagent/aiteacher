/**
 * Kids Brain Silence Processor (Phase 7).
 *
 * Handles turns where no child speech was detected.
 * Creates a synthetic STTResult representing silence and delegates
 * to processKidsBrainTurn, which routes through the full pipeline.
 *
 * Spec invariant: "Silence is a scaffold trigger, never a failure label."
 */

import type { STTResult } from '../contracts/stt-result.js';
import type { KidsBrainSilenceInput, KidsBrainTurnInput } from './runtime-types.js';
import type { RuntimeTurnResult } from './runtime-result.js';
import { processKidsBrainTurn } from './turn-processor.js';

/** Creates a synthetic STTResult representing no speech detected. */
function buildSilenceSttResult(): STTResult {
  return {
    text: null,
    confidence: null,
    languageCode: null,
    alternatives: [],
    speechStartMs: null,
    speechEndMs: null,
    speechDurationMs: null,
    audioEnergyLevel: null,
    provider: 'google_chirp_v2',
    providerRequestId: 'silence_synthetic',
    processingLatencyMs: 0,
  };
}

/**
 * Processes a silence turn through the full Kids Brain pipeline.
 *
 * Creates a synthetic STTResult with text=null so the perception layer
 * correctly identifies this as a silence event. The classification engine
 * will route to silence_short, silence_long, or no_response depending on
 * the silenceDurationMs value.
 *
 * The child is never punished for silence — recovery is scaffolding only.
 */
export async function processKidsBrainSilence(
  input: KidsBrainSilenceInput,
): Promise<RuntimeTurnResult> {
  const syntheticStt = buildSilenceSttResult();

  const turnInput: KidsBrainTurnInput = {
    sessionMemory: input.sessionMemory,
    sttResult: syntheticStt,
    responseLatencyMs: null,
    silenceDurationMs: input.silenceDurationMs,
    attemptCount: input.sessionMemory.currentItemAttemptCount,
    targetWord: input.targetWord,
    childFirstName: input.childFirstName,
    lessonTargetWords: input.lessonTargetWords,
    unitReviewWords: input.unitReviewWords,
    characterNames: input.characterNames,
    timestamp: input.timestamp,
  };

  return processKidsBrainTurn(turnInput);
}
