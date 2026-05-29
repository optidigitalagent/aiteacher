/**
 * Canonical confidence scale for the Learning Engine and Mastery Model.
 * All engine thresholds operate on this scale (0–100).
 * Conversion to/from session-layer 0.0–1.0 must only happen in
 * state-delta.applier.ts and postgres-profile.store.ts (Patch 7).
 */
export type EngineScore = number; // 0–100

/**
 * Session-layer scale used by the Child State module (0.0–1.0).
 * Never compare directly against Learning Engine thresholds.
 */
export type SessionScore = number; // 0.0–1.0

export function clampEngineScore(value: number): EngineScore {
  return Math.max(0, Math.min(100, value));
}

export function clampSessionScore(value: number): SessionScore {
  return Math.max(0, Math.min(1, value));
}

export function engineToSessionScore(score: EngineScore): SessionScore {
  return clampSessionScore(score / 100);
}

export function sessionToEngineScore(score: SessionScore): EngineScore {
  return clampEngineScore(score * 100);
}
