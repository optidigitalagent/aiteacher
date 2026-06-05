import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { AgeBand, L1Script, L1IntentHint, PromptType, ActivityType } from '../../shared/enums.js';
import type { STTResult } from '../../contracts/stt-result.js';
import type { PerceptionInput } from '../perception-types.js';
import { InputQuality } from '../perception-types.js';
import { buildPerceptionBundle } from '../perception-builder.js';
import { detectL1 } from '../l1-detector.js';
import { analyzeLatency } from '../latency-analyzer.js';
import { analyzeSilence } from '../silence-analyzer.js';

// ── Factories ─────────────────────────────────────────────────────────────────

function makeStt(overrides: Partial<STTResult> = {}): STTResult {
  return {
    text: 'dog',
    confidence: 0.92,
    languageCode: 'en-US',
    alternatives: [],
    speechStartMs: 100,
    speechEndMs: 600,
    speechDurationMs: 500, // >= 400ms threshold — avoids short-utterance penalty
    audioEnergyLevel: 0.7,
    provider: 'google_chirp_v2',
    providerRequestId: 'req-001',
    processingLatencyMs: 120,
    ...overrides,
  };
}

function makeInput(
  sttOverrides: Partial<STTResult> = {},
  inputOverrides: Partial<PerceptionInput> = {},
): PerceptionInput {
  return {
    stt: makeStt(sttOverrides),
    responseLatencyMs: 1200,
    silenceDurationMs: 0,
    ageBand: AgeBand.EIGHT_NINE,
    attemptCount: 1,
    promptContext: {
      promptType: PromptType.OPEN_PRODUCTION,
      targetItem: 'dog',
      activityType: ActivityType.SUPPORTED_PRODUCTION,
    },
    recentTurns: [],
    childState: null,
    ...inputOverrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('Phase 2 — Perception Layer', () => {

  // Test 1: normal English transcript
  describe('1. normal English transcript', () => {
    it('produces a usable bundle', () => {
      const bundle = buildPerceptionBundle(makeInput());
      expect(bundle.transcriptAvailable).toBe(true);
      expect(bundle.rawTranscript).toBe('dog');
      expect(bundle.textLowercased).toBe('dog');
      expect(bundle.wordCount).toBe(1);
      expect(bundle.l1Detected).toBe(false);
      expect(bundle.inputQuality).toBe(InputQuality.USABLE);
    });

    it('createdAt is an ISO 8601 timestamp', () => {
      const bundle = buildPerceptionBundle(makeInput());
      expect(() => new Date(bundle.createdAt)).not.toThrow();
      expect(new Date(bundle.createdAt).toISOString()).toBe(bundle.createdAt);
    });
  });

  // Test 2: missing STT confidence
  describe('2. missing STT confidence', () => {
    it('sets sttConfidenceMissing=true and falls back to 0.50', () => {
      const bundle = buildPerceptionBundle(makeInput({ confidence: null }));
      expect(bundle.sttConfidenceMissing).toBe(true);
      expect(bundle.sttConfidence).toBe(0.50);
    });

    it('uncertainty reasons include stt_confidence_missing', () => {
      const bundle = buildPerceptionBundle(makeInput({ confidence: null }));
      expect(bundle.uncertaintyReasons).toContain('stt_confidence_missing');
    });
  });

  // Test 3: empty transcript
  describe('3. empty transcript', () => {
    it('empty string: transcriptAvailable=false, inputQuality=EMPTY', () => {
      const bundle = buildPerceptionBundle(makeInput({ text: '' }));
      expect(bundle.transcriptAvailable).toBe(false);
      expect(bundle.inputQuality).toBe(InputQuality.EMPTY);
    });

    it('whitespace-only string: transcriptAvailable=false', () => {
      const bundle = buildPerceptionBundle(makeInput({ text: '   ' }));
      expect(bundle.transcriptAvailable).toBe(false);
    });

    it('null text: transcriptAvailable=false, isNoResponse depends on silenceDurationMs', () => {
      // With silenceDurationMs=0 (default), null transcript does NOT trigger isNoResponse —
      // only very long silence (>10.5s) does. This enables duration-based silence routing.
      const bundle = buildPerceptionBundle(makeInput({ text: null, audioEnergyLevel: null }));
      expect(bundle.transcriptAvailable).toBe(false);
      expect(bundle.isNoResponse).toBe(false); // 0ms < 10500ms threshold
    });
  });

  // Test 4: Cyrillic L1 detection
  describe('4. Cyrillic L1 script detection', () => {
    it('detects Cyrillic script', () => {
      const result = detectL1('собака');
      expect(result.l1Detected).toBe(true);
      expect(result.l1ScriptDetected).toBe(true);
      expect(result.l1Script).toBe(L1Script.CYRILLIC);
    });

    it('sets l1Detected on the PerceptionBundle', () => {
      const bundle = buildPerceptionBundle(makeInput({ text: 'собака', confidence: 0.85 }));
      expect(bundle.l1Detected).toBe(true);
      expect(bundle.l1ScriptDetected).toBe(true);
    });

    it('non-Cyrillic text does NOT trigger l1ScriptDetected', () => {
      const result = detectL1('dog');
      expect(result.l1ScriptDetected).toBe(false);
      expect(result.l1Detected).toBe(false);
    });
  });

  // Test 5: Ukrainian/Russian helper phrase detection
  describe('5. Ukrainian/Russian helper phrase detection', () => {
    it('"не знаю" → i_dont_know intent', () => {
      const result = detectL1('не знаю');
      expect(result.l1Detected).toBe(true);
      expect(result.l1KeywordDetected).toBe(true);
      expect(result.l1IntentHint).toBe(L1IntentHint.I_DONT_KNOW);
    });

    it('"я не знаю" → i_dont_know (longer phrase matched first)', () => {
      const result = detectL1('я не знаю');
      expect(result.l1IntentHint).toBe(L1IntentHint.I_DONT_KNOW);
      expect(result.l1Word).toBe('я не знаю');
    });

    it('"не понимаю" → i_dont_know', () => {
      const result = detectL1('не понимаю');
      expect(result.l1IntentHint).toBe(L1IntentHint.I_DONT_KNOW);
    });

    it('"не хочу" → refusal', () => {
      const result = detectL1('не хочу');
      expect(result.l1IntentHint).toBe(L1IntentHint.REFUSAL);
    });

    it('animal keywords detected as l1 (L1IntentHint.UNKNOWN)', () => {
      for (const word of ['тигр', 'слон', 'мавпа', 'обезьяна']) {
        const result = detectL1(word);
        expect(result.l1Detected).toBe(true);
        expect(result.l1IntentHint).toBe(L1IntentHint.UNKNOWN);
      }
    });
  });

  // Test 6: short silence
  describe('6. short silence', () => {
    it('silence < 3000ms → isShortSilence=true, isLongSilence=false, isNoResponse=false', () => {
      const silence = analyzeSilence(500, AgeBand.EIGHT_NINE, true);
      expect(silence.isShortSilence).toBe(true);
      expect(silence.isLongSilence).toBe(false);
      expect(silence.isNoResponse).toBe(false);
    });

    it('silence < 3500ms for 6-7 band (age adjustment)', () => {
      const silence67 = analyzeSilence(3200, AgeBand.SIX_SEVEN, true);
      expect(silence67.isShortSilence).toBe(true); // 3200 < 3500
      const silence89 = analyzeSilence(3200, AgeBand.EIGHT_NINE, true);
      expect(silence89.isShortSilence).toBe(false); // 3200 >= 3000
    });
  });

  // Test 7: long silence
  describe('7. long silence', () => {
    it('silence >= 3000ms → isLongSilence=true', () => {
      const silence = analyzeSilence(7000, AgeBand.EIGHT_NINE, true);
      expect(silence.isLongSilence).toBe(true);
      expect(silence.isShortSilence).toBe(false);
      expect(silence.isNoResponse).toBe(false);
    });
  });

  // Test 8: no response
  describe('8. no response', () => {
    it('silence > 10000ms → isNoResponse=true', () => {
      const silence = analyzeSilence(12000, AgeBand.EIGHT_NINE, true);
      expect(silence.isNoResponse).toBe(true);
    });

    it('short silence (500ms) with no transcript → isNoResponse=false (duration-based ladder)', () => {
      // After fix: isNoResponse only fires for silenceDurationMs > noResponseThreshold (10500ms for 8-9).
      // Short silence with no transcript → SILENCE_SHORT, not NO_RESPONSE.
      // This allows the teacher to give duration-appropriate scaffolding with the target word.
      const silence = analyzeSilence(500, AgeBand.EIGHT_NINE, false);
      expect(silence.isNoResponse).toBe(false);
    });

    it('null STT text with silenceDurationMs=0 → isNoResponse=false', () => {
      // Absent transcript alone does not trigger isNoResponse; only very long silence does.
      const bundle = buildPerceptionBundle(makeInput({ text: null, audioEnergyLevel: null }));
      expect(bundle.isNoResponse).toBe(false);
    });
  });

  // Test 9: fast answer signal
  describe('9. fast answer signal', () => {
    it('latency < 600ms → isVeryFast=true (signal only, not a failure)', () => {
      const latency = analyzeLatency(400, AgeBand.EIGHT_NINE);
      expect(latency.isVeryFast).toBe(true);
      expect(latency.isFastAnswer).toBe(true);
    });

    it('fast answer does NOT set inputQuality to noisy or low_confidence', () => {
      const bundle = buildPerceptionBundle(makeInput({}, { responseLatencyMs: 300 }));
      expect(bundle.isVeryFast).toBe(true);
      expect(bundle.inputQuality).toBe(InputQuality.USABLE);
    });

    it('isVeryFast signal is emitted without classification penalty in bundle', () => {
      const bundle = buildPerceptionBundle(makeInput({}, { responseLatencyMs: 300 }));
      expect(bundle.isVeryFast).toBe(true);
      // No classification label on the bundle — perception is observation only
      expect((bundle as unknown as Record<string, unknown>).classificationLabel).toBeUndefined();
    });
  });

  // Test 10: low STT confidence creates uncertainty
  describe('10. low STT confidence creates uncertainty', () => {
    it('adjustedSttConfidence < 0.5 → safeForDeterministicClassification=false', () => {
      // confidence=0.40 × 0.85 (1-word) × 0.90 (8-9 prior) × 1.0 = ~0.306
      const bundle = buildPerceptionBundle(makeInput({ confidence: 0.40, speechDurationMs: 600 }));
      expect(bundle.safeForDeterministicClassification).toBe(false);
      expect(bundle.requiresLLMAssistedClassification).toBe(true);
    });

    it('uncertainty reasons include low_stt_confidence', () => {
      const bundle = buildPerceptionBundle(makeInput({ confidence: 0.20 }));
      expect(bundle.uncertaintyReasons).toContain('low_stt_confidence');
    });

    it('low confidence does NOT set inputQuality to USABLE', () => {
      const bundle = buildPerceptionBundle(makeInput({ confidence: 0.30 }));
      expect(bundle.inputQuality).not.toBe(InputQuality.USABLE);
    });
  });

  // Test 11: missing optional STT fields do not crash
  describe('11. missing optional STT fields do not crash', () => {
    it('speechDurationMs=null does not crash', () => {
      expect(() =>
        buildPerceptionBundle(makeInput({ speechDurationMs: null })),
      ).not.toThrow();
    });

    it('audioEnergyLevel=null does not crash', () => {
      expect(() =>
        buildPerceptionBundle(makeInput({ audioEnergyLevel: null })),
      ).not.toThrow();
    });

    it('languageCode=null does not crash', () => {
      expect(() =>
        buildPerceptionBundle(makeInput({ languageCode: null })),
      ).not.toThrow();
    });

    it('alternatives=[] does not crash', () => {
      expect(() =>
        buildPerceptionBundle(makeInput({ alternatives: [] })),
      ).not.toThrow();
    });

    it('all optional fields null simultaneously does not crash', () => {
      expect(() =>
        buildPerceptionBundle(
          makeInput({
            text: null,
            confidence: null,
            speechDurationMs: null,
            audioEnergyLevel: null,
            languageCode: null,
            alternatives: [],
          }),
        ),
      ).not.toThrow();
    });
  });

  // Test 12: no LLM imports
  describe('12. no LLM imports in perception module', () => {
    const LLM_PATTERN = /from ['"].*?(anthropic|openai|llm|claude-sdk|@anthropic)/i;

    it('no perception source file imports an LLM SDK', () => {
      const perceptionDir = resolve(process.cwd(), 'src/kids-brain/perception');
      const violations = findImportViolations(perceptionDir, LLM_PATTERN, {
        excludeTestFiles: true,
      });
      expect(violations).toEqual([]);
    });
  });

  // Test 13: no adult obsidian imports
  describe('13. no adult obsidian imports in perception module', () => {
    const OBSIDIAN_PATTERN = new RegExp("from ['\"].*obsidian" + '[-_ ]brain', 'i');
    const LESSON_PATTERN = /from ['"]\.\.\/\.\.\/lesson\//;

    it('no perception source file imports from obsidian-brain', () => {
      const perceptionDir = resolve(process.cwd(), 'src/kids-brain/perception');
      const violations = findImportViolations(perceptionDir, OBSIDIAN_PATTERN, {
        excludeTestFiles: true,
      });
      expect(violations).toEqual([]);
    });

    it('no perception source file imports from adult lesson runtime', () => {
      const perceptionDir = resolve(process.cwd(), 'src/kids-brain/perception');
      const violations = findImportViolations(perceptionDir, LESSON_PATTERN, {
        excludeTestFiles: true,
      });
      expect(violations).toEqual([]);
    });
  });

  // Test 14: exported from backend/src/kids-brain/index.ts
  describe('14. perception exports available from kids-brain root index', () => {
    it('buildPerceptionBundle is importable from root index', async () => {
      const { buildPerceptionBundle: fn } = await import('../../index.js');
      expect(typeof fn).toBe('function');
    });

    it('InputQuality enum is importable from root index', async () => {
      const { InputQuality: iq } = await import('../../index.js');
      expect(iq.USABLE).toBe('usable');
      expect(iq.MISSING).toBe('missing');
    });

    it('detectL1 is importable from root index', async () => {
      const { detectL1: fn } = await import('../../index.js');
      expect(typeof fn).toBe('function');
    });

    it('buildPerceptionBundle callable from root index produces a valid bundle', async () => {
      const { buildPerceptionBundle: fn, InputQuality: iq } = await import('../../index.js');
      const bundle = fn(makeInput());
      expect(bundle.transcriptAvailable).toBe(true);
      expect(bundle.inputQuality).toBe(iq.USABLE);
    });
  });
});

// ── Utility ───────────────────────────────────────────────────────────────────

function findImportViolations(
  dir: string,
  pattern: RegExp,
  opts: { excludeTestFiles?: boolean } = {},
): string[] {
  const violations: string[] = [];
  try {
    walkDir(dir, (filePath) => {
      if (!filePath.endsWith('.ts') && !filePath.endsWith('.js')) return;
      if (opts.excludeTestFiles && /\.(test|spec)\.(ts|js)$/.test(filePath)) return;
      const content = readFileSync(filePath, 'utf8');
      if (pattern.test(content)) violations.push(filePath);
    });
  } catch {
    // Directory may not exist — not a violation
  }
  return violations;
}

function walkDir(dir: string, fn: (path: string) => void): void {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    let stat;
    try {
      stat = statSync(full);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      walkDir(full, fn);
    } else {
      fn(full);
    }
  }
}
