import type { L1Script, L1IntentHint } from '../shared/enums.js';
import type { InputQuality, PromptContext, ChildStateSnapshot, UncertaintyReason } from './perception-types.js';

/**
 * Fully normalized perception bundle consumed by the classification module.
 * All null/missing STT fields are resolved to typed fallback values.
 *
 * This is OBSERVATION ONLY — no classification labels, no progression decisions.
 * (spec §5.6, Phase 2 §PerceptionBundle)
 */
export interface PerceptionBundle {
  // ── Transcript ─────────────────────────────────────────────────────────────
  rawTranscript: string | null;
  normalizedTranscript: string | null;
  textLowercased: string | null;
  transcriptAvailable: boolean;
  wordCount: number;

  // ── STT confidence ─────────────────────────────────────────────────────────
  sttConfidence: number;
  adjustedSttConfidence: number;
  sttConfidenceMissing: boolean;
  perceptionConfidence: number;

  // ── Alternatives and language hints ────────────────────────────────────────
  alternatives: Array<{ text: string; confidence: number }>;
  detectedLanguageHints: string[];

  // ── L1 detection (deterministic only — no LLM) ─────────────────────────────
  l1Detected: boolean;
  l1ScriptDetected: boolean;
  l1KeywordDetected: boolean;
  l1Script: L1Script | null;
  l1IntentHint: L1IntentHint | null;
  l1Word: string | null;

  // ── Timing ─────────────────────────────────────────────────────────────────
  responseLatencyMs: number | null;
  silenceDurationMs: number;
  speechDurationMs: number | null;

  // ── Latency signals (signal only — fast answer is NOT automatically a guess) ─
  isVeryFast: boolean;     // latency < 600ms (spec §5.6)
  isHesitant: boolean;     // latency > 2500ms (age-adjusted)
  isFastAnswer: boolean;   // latency in 0–800ms range (age-adjusted)
  isNormalAnswer: boolean; // latency in 800–2500ms range (age-adjusted)
  isSlowAnswer: boolean;   // latency > 2500ms (age-adjusted)
  isMissingLatency: boolean;
  hasAudio: boolean;

  // ── Silence signals ────────────────────────────────────────────────────────
  isSilence: boolean;
  isShortSilence: boolean;  // silence < 3000ms (age-adjusted)
  isLongSilence: boolean;   // silence ≥ 3000ms (age-adjusted)
  isNoResponse: boolean;    // silence > 10000ms OR no transcript

  // ── Input quality ──────────────────────────────────────────────────────────
  inputQuality: InputQuality;

  // ── Uncertainty routing ────────────────────────────────────────────────────
  uncertaintyReasons: UncertaintyReason[];
  safeForDeterministicClassification: boolean;
  requiresLLMAssistedClassification: boolean;

  // ── Context pass-through (read-only) ───────────────────────────────────────
  promptContext: PromptContext;
  childStateSnapshot: ChildStateSnapshot | null;

  // ── Timestamp ──────────────────────────────────────────────────────────────
  createdAt: string; // ISO 8601
}
