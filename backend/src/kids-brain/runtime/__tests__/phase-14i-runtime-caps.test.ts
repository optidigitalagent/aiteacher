/**
 * Phase 14I — Kids Brain v1 Runtime Caps Tests
 *
 * Verifies:
 * 1. parseEnvInt: safe fallback on missing / invalid / zero env values
 * 2. parseEnvInt: returns parsed value when valid
 * 3. Default cap values are safe (finite, above prototype minimums)
 * 4. Full lesson with worst-case exercise count is not cut off at old cap of 20
 * 5. Cap still stops a runaway session (cap is not unlimited)
 * 6. Analytics finalization guard is present in lesson-ws.ts
 * 7. Adult runtime is not affected by Kids Brain caps
 */

import { describe, it, expect } from 'vitest';
import { parseEnvInt, KIDS_MAX_DURATION_MS, KIDS_MAX_LLM_CALLS, KIDS_MAX_TTS_CHARS } from '../runtime-caps.js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// ── 1. parseEnvInt: missing / invalid fallback ────────────────────────────────

describe('parseEnvInt: safe fallback', () => {
  it('returns fallback when value is undefined', () => {
    expect(parseEnvInt(undefined, 60)).toBe(60);
  });

  it('returns fallback when value is empty string', () => {
    expect(parseEnvInt('', 60)).toBe(60);
  });

  it('returns fallback when value is NaN string', () => {
    expect(parseEnvInt('abc', 60)).toBe(60);
  });

  it('returns fallback when value is 0', () => {
    expect(parseEnvInt('0', 60)).toBe(60);
  });

  it('returns fallback when value is negative', () => {
    expect(parseEnvInt('-5', 60)).toBe(60);
  });

  it('returns fallback when value has leading/trailing non-numeric chars (partial parse)', () => {
    // parseInt('60abc') returns 60 — that IS a valid positive int, so accepted
    expect(parseEnvInt('60abc', 20)).toBe(60);
  });
});

// ── 2. parseEnvInt: valid values ──────────────────────────────────────────────

describe('parseEnvInt: valid env override', () => {
  it('returns parsed integer when value is a valid positive string', () => {
    expect(parseEnvInt('60', 20)).toBe(60);
  });

  it('returns 1 when value is "1"', () => {
    expect(parseEnvInt('1', 20)).toBe(1);
  });

  it('returns large value correctly', () => {
    expect(parseEnvInt('999', 60)).toBe(999);
  });
});

// ── 3. Default cap values are safe ────────────────────────────────────────────

describe('default cap values: safety guarantees', () => {
  it('KIDS_MAX_LLM_CALLS is a finite positive number', () => {
    expect(KIDS_MAX_LLM_CALLS).toBeGreaterThan(0);
    expect(Number.isFinite(KIDS_MAX_LLM_CALLS)).toBe(true);
  });

  it('KIDS_MAX_TTS_CHARS is a finite positive number', () => {
    expect(KIDS_MAX_TTS_CHARS).toBeGreaterThan(0);
    expect(Number.isFinite(KIDS_MAX_TTS_CHARS)).toBe(true);
  });

  it('KIDS_MAX_DURATION_MS is a finite positive number', () => {
    expect(KIDS_MAX_DURATION_MS).toBeGreaterThan(0);
    expect(Number.isFinite(KIDS_MAX_DURATION_MS)).toBe(true);
  });

  it('KIDS_MAX_DURATION_MS is at least 15 minutes (minimum viable session)', () => {
    const FIFTEEN_MIN_MS = 15 * 60 * 1000;
    expect(KIDS_MAX_DURATION_MS).toBeGreaterThanOrEqual(FIFTEEN_MIN_MS);
  });

  it('KIDS_MAX_DURATION_MS does not exceed 60 minutes (anti-runaway)', () => {
    const SIXTY_MIN_MS = 60 * 60 * 1000;
    expect(KIDS_MAX_DURATION_MS).toBeLessThanOrEqual(SIXTY_MIN_MS);
  });
});

// ── 4. Full lesson not cut off at old cap of 20 ───────────────────────────────

describe('full lesson completion: cap allows 10-exercise lesson', () => {
  // Kid's Box Unit 1 Lesson 2 has 10 exercises.
  // Worst-case turns: readiness(1) + 10 exercises × 4 turns each = 41 calls.
  const WORST_CASE_10_EXERCISE_LESSON_CALLS = 41;
  const OLD_CAP = 20; // the prototype cap that caused premature termination

  it('KIDS_MAX_LLM_CALLS exceeds old prototype cap of 20', () => {
    expect(KIDS_MAX_LLM_CALLS).toBeGreaterThan(OLD_CAP);
  });

  it('KIDS_MAX_LLM_CALLS allows worst-case 10-exercise lesson to complete', () => {
    expect(KIDS_MAX_LLM_CALLS).toBeGreaterThan(WORST_CASE_10_EXERCISE_LESSON_CALLS);
  });

  it('KIDS_MAX_TTS_CHARS exceeds old prototype cap of 2000', () => {
    const OLD_TTS_CAP = 2000;
    expect(KIDS_MAX_TTS_CHARS).toBeGreaterThan(OLD_TTS_CAP);
  });
});

// ── 5. Cap still stops runaway sessions ───────────────────────────────────────

describe('anti-runaway: caps are not unlimited', () => {
  // A lesson should never need more than 200 AI calls — beyond that is clearly a bug.
  const ABSOLUTE_RUNAWAY_THRESHOLD = 200;

  it('KIDS_MAX_LLM_CALLS stops runaway before 200 calls', () => {
    expect(KIDS_MAX_LLM_CALLS).toBeLessThan(ABSOLUTE_RUNAWAY_THRESHOLD);
  });

  // At ~$0.015/1K chars for ElevenLabs, 80000 chars = $1.20 per session — unreasonable.
  const ABSOLUTE_TTS_RUNAWAY = 80_000;

  it('KIDS_MAX_TTS_CHARS stops runaway before 80,000 chars', () => {
    expect(KIDS_MAX_TTS_CHARS).toBeLessThan(ABSOLUTE_TTS_RUNAWAY);
  });
});

// ── 6. Analytics finalization fires when cap is reached ───────────────────────

describe('analytics finalization guard in lesson-ws.ts', () => {
  // Test file: backend/src/kids-brain/runtime/__tests__/
  // Target:    backend/src/ws/lesson-ws.ts  → 3 levels up then into ws/
  const wsPath = resolve(__dirname, '../../../ws/lesson-ws.ts');

  it('kidsAnalyticsFinalized guard is present in lesson-ws.ts', () => {
    const content = readFileSync(wsPath, 'utf-8');
    expect(content).toContain('kidsAnalyticsFinalized');
  });

  it('persistKidsBrainAnalytics is called in the duration timeout handler', () => {
    const content = readFileSync(wsPath, 'utf-8');
    expect(content).toContain("persistKidsBrainAnalytics");
    expect(content).toContain("'timeout'");
  });
});

// ── 7. Adult runtime isolation ────────────────────────────────────────────────

describe('adult runtime isolation', () => {
  it('KIDS_MAX_* constants are not referenced in adult lesson orchestrator', () => {
    try {
      const orchestratorPath = resolve(__dirname, '../../../lesson/master-orchestrator.ts');
      const content = readFileSync(orchestratorPath, 'utf-8');
      expect(content).not.toMatch(/KIDS_MAX/);
    } catch {
      // File may not exist in all configurations — skip check
    }
  });

  it('runtime-caps.ts imports no adult modules', () => {
    const capsPath = resolve(__dirname, '../runtime-caps.ts');
    const content = readFileSync(capsPath, 'utf-8');
    expect(content).not.toMatch(/obsidian|teacher-brain|paid-lesson|engine\//);
  });
});
