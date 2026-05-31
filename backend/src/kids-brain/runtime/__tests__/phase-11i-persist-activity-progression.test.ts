/**
 * Phase 11I — Persist Activity Progression regression tests.
 *
 * Root cause fixed (turn-processor.ts Step 6):
 *   learningDecision.nextActivityType was computed correctly but never written to
 *   updatedSessionMemory.currentActivityId. The fix adds a one-line assignment.
 *
 * Tests prove:
 *  A. Any turn updates currentActivityId to learningDecision.nextActivityType
 *  B. Equality invariant holds across wrong, correct, and silence turns
 *  C. Activity progression survives a multi-turn chain
 *  D. Activity eventually reaches SENTENCE_PRODUCTION via R20 advance rules
 *  E. R22 becomes eligible when activity is at SENTENCE_PRODUCTION
 *  F. shouldAdvanceItem becomes true when R22 fires
 *  G. nextTargetItemId becomes populated when shouldAdvanceItem is true
 *  H. currentTargetItemId advances from blue → green after R22
 *  I. No regression of Phase 8.11 target persistence (easiest-win path)
 *  J. No regression of Phase 11E readiness handshake
 *  K. No regression of Phase 11G vocabulary guard (no raw placeholders)
 */

import { describe, it, expect } from 'vitest';
import {
  AgeBand,
  ClassificationLabel,
  ActivityType,
  LessonPhase,
  RecoveryState,
  TeacherActionCode,
} from '../../shared/enums.js';
import { AGE_PROFILE_6_7, AGE_PROFILE_8_9 } from '../../shared/types.js';
import { ClassificationPath } from '../../shared/enums.js';
import { startKidsBrainSession, processKidsBrainTurn } from '../index.js';
import type { KidsBrainSessionStartInput, KidsBrainTurnInput } from '../runtime-types.js';
import type { SessionMemory } from '../../contracts/session-memory.js';
import type { TurnRecord } from '../../contracts/turn-record.js';
import type { STTResult } from '../../contracts/stt-result.js';

// ── Constants ──────────────────────────────────────────────────────────────────

const KB1_LESSON_2_WORDS = ['blue', 'green', 'pink', 'purple', 'orange', 'red', 'yellow'];
const PROTO_WORDS = ['cat', 'dog', 'lion', 'monkey', 'elephant', 'tiger'];

// ── STT helpers ────────────────────────────────────────────────────────────────

/**
 * STT that produces CORRECT_CONFIDENT via AgeBand.EIGHT_NINE:
 *   adjustedSttConfidence = 1.0 × 0.85 (length) × 0.90 (8-9 prior) = 0.765 >= 0.75
 *   responseLatencyMs = 1200ms in [600, 2500] and !isHesitant (normalMax for 8-9 = 2500)
 */
function makeConfidentStt(text: string): STTResult {
  return {
    text,
    confidence: 1.0,
    languageCode: 'en-US',
    alternatives: [],
    speechStartMs: 200,
    speechEndMs: 700,
    speechDurationMs: 500,
    audioEnergyLevel: 0.85,
    provider: 'google_chirp_v2',
    providerRequestId: 'phase-11i',
    processingLatencyMs: 50,
  };
}

function makeHesitantStt(text: string): STTResult {
  return {
    text,
    confidence: 0.90,
    languageCode: 'en-US',
    alternatives: [],
    speechStartMs: 100,
    speechEndMs: 1000,
    speechDurationMs: 900,
    audioEnergyLevel: 0.75,
    provider: 'google_chirp_v2',
    providerRequestId: 'phase-11i-h',
    processingLatencyMs: 50,
  };
}

function makeSessionStart6_7(sessionId: string, words = PROTO_WORDS): KidsBrainSessionStartInput {
  return {
    sessionId,
    userId: `user-${sessionId}`,
    childId: `child-${sessionId}`,
    childFirstName: 'Alex',
    ageBand: AgeBand.SIX_SEVEN,
    ageProfile: AGE_PROFILE_6_7,
    lessonTargetWords: [...words],
    unitReviewWords: [],
    characterNames: ['milo'],
    timestamp: new Date().toISOString(),
  };
}

function makeSessionStart8_9(sessionId: string, words = PROTO_WORDS): KidsBrainSessionStartInput {
  return {
    sessionId,
    userId: `user-${sessionId}`,
    childId: `child-${sessionId}`,
    childFirstName: 'Alex',
    ageBand: AgeBand.EIGHT_NINE,
    ageProfile: AGE_PROFILE_8_9,
    lessonTargetWords: [...words],
    unitReviewWords: [],
    characterNames: ['milo'],
    timestamp: new Date().toISOString(),
  };
}

function makeTurnInput(
  mem: SessionMemory,
  sttResult: STTResult,
  targetWord: string,
  words: string[],
  latencyMs = 800,
): KidsBrainTurnInput {
  return {
    sessionMemory: mem,
    sttResult,
    responseLatencyMs: latencyMs,
    silenceDurationMs: 0,
    attemptCount: mem.currentItemAttemptCount,
    targetWord,
    childFirstName: 'Alex',
    lessonTargetWords: [...words],
    unitReviewWords: [],
    characterNames: ['milo'],
    timestamp: new Date().toISOString(),
  };
}

/** A TurnRecord marking a successful CORRECT_CONFIDENT outcome — for pre-seeding recentTurns. */
function makeConfidentTurnRecord(
  turnNumber: number,
  targetItemId: string,
  activityId: ActivityType,
): TurnRecord {
  return {
    turnNumber,
    sttTextNormalized: targetItemId,
    responseLatencyMs: 1200,
    silenceDurationMs: 0,
    l1Detected: false,
    classificationLabel: ClassificationLabel.CORRECT_CONFIDENT,
    classificationConfidence: 0.95,
    classificationPath: ClassificationPath.FAST_PATH,
    targetItemId,
    activityId,
    lessonPhase: LessonPhase.WARM_UP,
    attemptNumber: 1,
    modelWasGiven: false,
    actionTaken: TeacherActionCode.PRAISE_AND_PROGRESS,
    recoveryOverride: false,
    wasSuccess: true,
    masteryDelta: 0,
    completedAt: new Date().toISOString(),
  };
}

/**
 * Builds a session memory with elevated confidence values and a pre-seeded
 * CORRECT_CONFIDENT turn history.  Used by tests D–H to skip the slow cold-start
 * ramp-up and arrive directly at the scenario under test.
 */
function buildElevatedSession(opts: {
  sessionId: string;
  words: string[];
  activityId: ActivityType;
  productionConfidence: number;    // 0.0–1.0
  comprehensionConfidence: number; // 0.0–1.0
  frustrationRisk: number;         // 0.0–1.0
  preSeedTurns: TurnRecord[];
}): SessionMemory {
  const base = startKidsBrainSession(makeSessionStart8_9(opts.sessionId, opts.words)).sessionMemory;
  return {
    ...base,
    currentActivityId: opts.activityId,
    currentTargetItemId: opts.words[0] ?? null,
    hasStartedFirstExercise: true,
    childState: {
      ...base.childState,
      productionConfidence: opts.productionConfidence,
      comprehensionConfidence: opts.comprehensionConfidence,
      frustrationRisk: opts.frustrationRisk,
    },
    recentTurns: opts.preSeedTurns,
  };
}

// ── A. Core fix: currentActivityId is updated after every turn ─────────────────

describe('A — any turn updates currentActivityId to learningDecision.nextActivityType', () => {
  it('correct turn: updatedSessionMemory.currentActivityId equals nextActivityType', async () => {
    const { sessionMemory } = startKidsBrainSession(makeSessionStart6_7('11i-A1'));
    const mem = { ...sessionMemory, hasStartedFirstExercise: true };

    const result = await processKidsBrainTurn(
      makeTurnInput(mem, makeHesitantStt('cat'), 'cat', PROTO_WORDS),
    );

    expect(result.updatedSessionMemory.currentActivityId).toBe(result.learningDecision.nextActivityType);
  });

  it('wrong turn: updatedSessionMemory.currentActivityId equals nextActivityType', async () => {
    const { sessionMemory } = startKidsBrainSession(makeSessionStart6_7('11i-A2'));
    const mem = { ...sessionMemory, hasStartedFirstExercise: true };

    const result = await processKidsBrainTurn(
      makeTurnInput(mem, makeHesitantStt('elephant'), 'cat', PROTO_WORDS),
    );

    expect(result.updatedSessionMemory.currentActivityId).toBe(result.learningDecision.nextActivityType);
  });

  it('silence turn: updatedSessionMemory.currentActivityId equals nextActivityType', async () => {
    const { sessionMemory } = startKidsBrainSession(makeSessionStart6_7('11i-A3'));
    const mem = { ...sessionMemory, hasStartedFirstExercise: true };

    const result = await processKidsBrainTurn({
      sessionMemory: mem,
      sttResult: {
        text: null,
        confidence: null,
        languageCode: null,
        alternatives: [],
        speechStartMs: null,
        speechEndMs: null,
        speechDurationMs: null,
        audioEnergyLevel: null,
        provider: 'google_chirp_v2',
        providerRequestId: 'silence',
        processingLatencyMs: 50,
      },
      responseLatencyMs: null,
      silenceDurationMs: 5000,
      attemptCount: 0,
      targetWord: 'cat',
      childFirstName: 'Alex',
      lessonTargetWords: [...PROTO_WORDS],
      unitReviewWords: [],
      characterNames: ['milo'],
      timestamp: new Date().toISOString(),
    });

    expect(result.updatedSessionMemory.currentActivityId).toBe(result.learningDecision.nextActivityType);
  });
});

// ── B. Equality invariant holds across multiple scenarios ──────────────────────

describe('B — equality invariant: currentActivityId === nextActivityType after every turn', () => {
  it('refusal input: invariant holds', async () => {
    const { sessionMemory } = startKidsBrainSession(makeSessionStart6_7('11i-B1'));
    const mem = { ...sessionMemory, hasStartedFirstExercise: true };

    const result = await processKidsBrainTurn(
      makeTurnInput(mem, makeHesitantStt('no'), 'cat', PROTO_WORDS),
    );

    expect(result.updatedSessionMemory.currentActivityId).toBe(result.learningDecision.nextActivityType);
  });

  it('KB1 lesson 2 correct answer: invariant holds', async () => {
    const { sessionMemory } = startKidsBrainSession(makeSessionStart6_7('11i-B2', KB1_LESSON_2_WORDS));
    const mem = { ...sessionMemory, hasStartedFirstExercise: true };

    const result = await processKidsBrainTurn(
      makeTurnInput(mem, makeHesitantStt('blue'), 'blue', KB1_LESSON_2_WORDS),
    );

    expect(result.updatedSessionMemory.currentActivityId).toBe(result.learningDecision.nextActivityType);
  });

  it('KB1 lesson 2 wrong colour: invariant holds', async () => {
    const { sessionMemory } = startKidsBrainSession(makeSessionStart6_7('11i-B3', KB1_LESSON_2_WORDS));
    const mem = { ...sessionMemory, hasStartedFirstExercise: true };

    const result = await processKidsBrainTurn(
      makeTurnInput(mem, makeHesitantStt('green'), 'blue', KB1_LESSON_2_WORDS),
    );

    expect(result.updatedSessionMemory.currentActivityId).toBe(result.learningDecision.nextActivityType);
  });

  it('currentActivityId is never null after any turn', async () => {
    const { sessionMemory } = startKidsBrainSession(makeSessionStart6_7('11i-B4'));
    const mem = { ...sessionMemory, hasStartedFirstExercise: true };

    const result = await processKidsBrainTurn(
      makeTurnInput(mem, makeHesitantStt('cat'), 'cat', PROTO_WORDS),
    );

    expect(result.updatedSessionMemory.currentActivityId).not.toBeNull();
    expect(result.updatedSessionMemory.currentActivityId).not.toBeUndefined();
  });
});

// ── C. Multi-turn chain: activity ID propagates correctly ──────────────────────

describe('C — activity progression survives a multi-turn chain', () => {
  it('each turn feeds the updated currentActivityId to the next turn', async () => {
    let mem = startKidsBrainSession(makeSessionStart6_7('11i-C1')).sessionMemory;
    mem = { ...mem, hasStartedFirstExercise: true };

    const target = mem.currentTargetItemId ?? PROTO_WORDS[0]!;
    let prevNextActivity: ActivityType | null = null;

    for (let i = 0; i < 4; i++) {
      const result = await processKidsBrainTurn(
        makeTurnInput(mem, makeHesitantStt(target), target, PROTO_WORDS),
      );

      // Core invariant each turn
      expect(result.updatedSessionMemory.currentActivityId).toBe(result.learningDecision.nextActivityType);

      // The activity fed into turn N+1 is the activity produced by turn N
      if (prevNextActivity !== null) {
        // The session memory we passed in had the previousTurn's nextActivityType
        expect(mem.currentActivityId).toBe(prevNextActivity);
      }

      prevNextActivity = result.learningDecision.nextActivityType;
      mem = result.updatedSessionMemory;
    }
  });

  it('turnNumber increments correctly through each activity-persisting turn', async () => {
    let mem = startKidsBrainSession(makeSessionStart6_7('11i-C2')).sessionMemory;
    mem = { ...mem, hasStartedFirstExercise: true };
    expect(mem.turnNumber).toBe(0);

    const target = mem.currentTargetItemId ?? PROTO_WORDS[0]!;

    for (let i = 0; i < 5; i++) {
      const result = await processKidsBrainTurn(
        makeTurnInput(mem, makeHesitantStt(target), target, PROTO_WORDS),
      );
      expect(result.updatedSessionMemory.turnNumber).toBe(i + 1);
      mem = result.updatedSessionMemory;
    }
  });
});

// ── D. Activity advances to SENTENCE_PRODUCTION via R20 ───────────────────────

describe('D — activity eventually reaches SENTENCE_PRODUCTION', () => {
  it('R20 advances from SENTENCE_FRAME_PRODUCTION to SENTENCE_PRODUCTION after 3 confident turns', async () => {
    // Craft session at SENTENCE_FRAME_PRODUCTION (level 6) with elevated confidence
    // and 2 pre-seeded CORRECT_CONFIDENT turns so the 3rd live CC turn triggers R20.
    const mem = buildElevatedSession({
      sessionId: '11i-D1',
      words: KB1_LESSON_2_WORDS,
      activityId: ActivityType.SENTENCE_FRAME_PRODUCTION,
      productionConfidence: 0.70,   // engine scale 70 >= R20 threshold 65
      comprehensionConfidence: 0.70, // engine scale 70 >= R20 threshold 65
      frustrationRisk: 0.05,
      preSeedTurns: [
        makeConfidentTurnRecord(1, 'blue', ActivityType.SENTENCE_FRAME_PRODUCTION),
        makeConfidentTurnRecord(2, 'blue', ActivityType.SENTENCE_FRAME_PRODUCTION),
      ],
    });

    // 3rd CORRECT_CONFIDENT turn (requires EIGHT_NINE + high STT confidence)
    const result = await processKidsBrainTurn(
      makeTurnInput(mem, makeConfidentStt('blue'), 'blue', KB1_LESSON_2_WORDS, 1200),
    );

    // Verify 3rd turn classified as CORRECT_CONFIDENT
    expect(result.classificationResult.label).toBe(ClassificationLabel.CORRECT_CONFIDENT);

    // R20 should advance the activity
    expect(result.learningDecision.nextActivityType).toBe(ActivityType.SENTENCE_PRODUCTION);

    // After fix: currentActivityId must reflect this advance
    expect(result.updatedSessionMemory.currentActivityId).toBe(ActivityType.SENTENCE_PRODUCTION);
  });

  it('activity at SENTENCE_PRODUCTION propagates into the following turn', async () => {
    const mem0 = buildElevatedSession({
      sessionId: '11i-D2',
      words: KB1_LESSON_2_WORDS,
      activityId: ActivityType.SENTENCE_FRAME_PRODUCTION,
      productionConfidence: 0.70,
      comprehensionConfidence: 0.70,
      frustrationRisk: 0.05,
      preSeedTurns: [
        makeConfidentTurnRecord(1, 'blue', ActivityType.SENTENCE_FRAME_PRODUCTION),
        makeConfidentTurnRecord(2, 'blue', ActivityType.SENTENCE_FRAME_PRODUCTION),
      ],
    });

    const r1 = await processKidsBrainTurn(
      makeTurnInput(mem0, makeConfidentStt('blue'), 'blue', KB1_LESSON_2_WORDS, 1200),
    );

    const advancedMem = r1.updatedSessionMemory;
    expect(advancedMem.currentActivityId).toBe(ActivityType.SENTENCE_PRODUCTION);

    // Next turn sees SENTENCE_PRODUCTION
    const r2 = await processKidsBrainTurn(
      makeTurnInput(advancedMem, makeHesitantStt('blue'), 'blue', KB1_LESSON_2_WORDS),
    );

    expect(r2.updatedSessionMemory.turnNumber).toBe(advancedMem.turnNumber + 1);
    expect(r2.safeToContinue).toBe(true);
  });
});

// ── E. R22 becomes eligible when at SENTENCE_PRODUCTION ───────────────────────
//
// Confidence calibration for R22 without triggering R21:
//
// The state engine adds deltas DURING the current turn before the learning engine
// evaluates.  For CORRECT_CONFIDENT:
//   comprehension += +0.15  →  post-update compConf engine = (pre + 0.15) × 100
//   production    += +0.12  →  post-update prodConf  engine = (pre + 0.12) × 100
//
// R21 requires compConf >= 75. To block R21: pre-compConf must be < 0.60 so that
//   post-update compConf = (0.59 + 0.15) × 100 = 74 < 75.
// R22 requires prodConf >= 75. To meet R22: pre-prodConf >= 0.63 so that
//   post-update prodConf = (0.65 + 0.12) × 100 = 77 >= 75.

/** Shared elevated session for E/F/G/H tests — pre-calibrated to fire R22 but not R21. */
function buildR22Session(sessionId: string): SessionMemory {
  return buildElevatedSession({
    sessionId,
    words: KB1_LESSON_2_WORDS,
    activityId: ActivityType.SENTENCE_PRODUCTION,
    productionConfidence: 0.65,    // post-update → 0.77 engine (>= 75 for R22) ✓
    comprehensionConfidence: 0.59, // post-update → 0.74 engine (< 75 blocks R21) ✓
    frustrationRisk: 0.05,
    preSeedTurns: [
      makeConfidentTurnRecord(1, 'blue', ActivityType.SENTENCE_PRODUCTION),
    ],
  });
}

describe('E — R22 becomes eligible at SENTENCE_PRODUCTION', () => {
  it('R22 fires when activity is SENTENCE_PRODUCTION + 2 consecutive CORRECT_CONFIDENT', async () => {
    const mem = buildR22Session('11i-E1');

    const result = await processKidsBrainTurn(
      makeTurnInput(mem, makeConfidentStt('blue'), 'blue', KB1_LESSON_2_WORDS, 1200),
    );

    expect(result.classificationResult.label).toBe(ClassificationLabel.CORRECT_CONFIDENT);
    expect(result.learningDecision.priorityRuleFired).toBe('R22_advance_to_next_item_sentence_production');
  });
});

// ── F. shouldAdvanceItem becomes true ─────────────────────────────────────────

describe('F — shouldAdvanceItem becomes true when R22 fires', () => {
  it('shouldAdvanceItem is true after R22 fires', async () => {
    const mem = buildR22Session('11i-F1');

    const result = await processKidsBrainTurn(
      makeTurnInput(mem, makeConfidentStt('blue'), 'blue', KB1_LESSON_2_WORDS, 1200),
    );

    expect(result.learningDecision.shouldAdvanceItem).toBe(true);
  });
});

// ── G. nextTargetItemId becomes populated ─────────────────────────────────────

describe('G — nextTargetItemId is populated when shouldAdvanceItem is true', () => {
  it('nextTargetItemId is defined after R22 fires', async () => {
    const mem = buildR22Session('11i-G1');

    const result = await processKidsBrainTurn(
      makeTurnInput(mem, makeConfidentStt('blue'), 'blue', KB1_LESSON_2_WORDS, 1200),
    );

    expect(result.learningDecision.shouldAdvanceItem).toBe(true);
    expect(result.learningDecision.nextTargetItemId).toBeDefined();
    expect(KB1_LESSON_2_WORDS).toContain(result.learningDecision.nextTargetItemId);
  });
});

// ── H. currentTargetItemId advances from blue → green ─────────────────────────

describe('H — currentTargetItemId advances from blue to green after R22', () => {
  it('currentTargetItemId changes from blue to green', async () => {
    const mem = buildR22Session('11i-H1');
    expect(mem.currentTargetItemId).toBe('blue');

    const result = await processKidsBrainTurn(
      makeTurnInput(mem, makeConfidentStt('blue'), 'blue', KB1_LESSON_2_WORDS, 1200),
    );

    // R22 advances to next item in list (blue → green)
    expect(result.updatedSessionMemory.currentTargetItemId).toBe('green');
  });

  it('updatedSessionMemory that would be written to Redis has green as target', async () => {
    const mem = buildR22Session('11i-H2');

    const result = await processKidsBrainTurn(
      makeTurnInput(mem, makeConfidentStt('blue'), 'blue', KB1_LESSON_2_WORDS, 1200),
    );

    // The Redis-bound session memory has advanced to green
    expect(result.updatedSessionMemory.currentTargetItemId).toBe('green');
    // The nextActivityType is also persisted
    expect(result.updatedSessionMemory.currentActivityId).toBe(result.learningDecision.nextActivityType);
  });
});

// ── I. No regression of Phase 8.11 target persistence (easiest-win path) ──────

describe('I — no regression of Phase 8.11 target persistence', () => {
  it('refusal easiest-win: nextTargetItemId is still persisted to currentTargetItemId', async () => {
    const { sessionMemory } = startKidsBrainSession(makeSessionStart6_7('11i-I1'));
    const mem = { ...sessionMemory, hasStartedFirstExercise: true };

    const result = await processKidsBrainTurn(
      makeTurnInput(mem, makeHesitantStt('no'), 'cat', PROTO_WORDS),
    );

    const nextId = result.learningDecision.nextTargetItemId;
    expect(nextId).toBeDefined();
    expect(result.updatedSessionMemory.currentTargetItemId).toBe(nextId);
  });

  it('easiest-win: currentActivityId also updated alongside target persistence', async () => {
    const { sessionMemory } = startKidsBrainSession(makeSessionStart6_7('11i-I2'));
    const mem = { ...sessionMemory, hasStartedFirstExercise: true };

    const result = await processKidsBrainTurn(
      makeTurnInput(mem, makeHesitantStt('no'), 'cat', PROTO_WORDS),
    );

    // Both fields must be persisted in the same turn result
    expect(result.updatedSessionMemory.currentTargetItemId).toBe(result.learningDecision.nextTargetItemId);
    expect(result.updatedSessionMemory.currentActivityId).toBe(result.learningDecision.nextActivityType);
  });

  it('WRONG_BUT_RELATED ×3 easiest-win: target and activity both persisted', async () => {
    let mem = startKidsBrainSession(makeSessionStart6_7('11i-I3')).sessionMemory;
    mem = { ...mem, hasStartedFirstExercise: true };

    let last;
    for (let i = 0; i < 3; i++) {
      last = await processKidsBrainTurn(
        makeTurnInput(mem, makeHesitantStt('dog'), 'cat', PROTO_WORDS),
      );
      mem = last.updatedSessionMemory;
    }

    expect(last!.learningDecision.nextTargetItemId).toBeDefined();
    expect(last!.updatedSessionMemory.currentTargetItemId).toBe(last!.learningDecision.nextTargetItemId);
    expect(last!.updatedSessionMemory.currentActivityId).toBe(last!.learningDecision.nextActivityType);
  });
});

// ── J. No regression of Phase 11E readiness handshake ─────────────────────────

describe('J — no regression of Phase 11E readiness handshake', () => {
  it('readiness turn still sets hasStartedFirstExercise = true', async () => {
    const { sessionMemory } = startKidsBrainSession(makeSessionStart6_7('11i-J1', KB1_LESSON_2_WORDS));

    const result = await processKidsBrainTurn(
      makeTurnInput(sessionMemory, makeHesitantStt("I'm ready"), 'blue', KB1_LESSON_2_WORDS),
    );

    expect(result.updatedSessionMemory.hasStartedFirstExercise).toBe(true);
  });

  it('readiness turn does NOT advance currentTargetItemId', async () => {
    const { sessionMemory } = startKidsBrainSession(makeSessionStart6_7('11i-J2', KB1_LESSON_2_WORDS));
    expect(sessionMemory.currentTargetItemId).toBe('blue');

    const result = await processKidsBrainTurn(
      makeTurnInput(sessionMemory, makeHesitantStt('start'), 'blue', KB1_LESSON_2_WORDS),
    );

    expect(result.updatedSessionMemory.currentTargetItemId).toBe('blue');
  });

  it('curriculum classification resumes after readiness (correct blue → not failure)', async () => {
    const { sessionMemory } = startKidsBrainSession(makeSessionStart6_7('11i-J3', KB1_LESSON_2_WORDS));

    const readinessResult = await processKidsBrainTurn(
      makeTurnInput(sessionMemory, makeHesitantStt("I'm ready"), 'blue', KB1_LESSON_2_WORDS),
    );

    const postReadyMem = readinessResult.updatedSessionMemory;
    const target = postReadyMem.currentTargetItemId ?? 'blue';

    const answerResult = await processKidsBrainTurn(
      makeTurnInput(postReadyMem, makeHesitantStt(target), target, KB1_LESSON_2_WORDS),
    );

    const correctLabels = [
      ClassificationLabel.CORRECT_CONFIDENT,
      ClassificationLabel.CORRECT_HESITANT,
      ClassificationLabel.NEAR_CORRECT,
    ];
    expect(correctLabels).toContain(answerResult.classificationResult.label);
    // Invariant still holds after readiness path
    expect(answerResult.updatedSessionMemory.currentActivityId).toBe(
      answerResult.learningDecision.nextActivityType,
    );
  });
});

// ── K. No regression of Phase 11G vocabulary guard ────────────────────────────

describe('K — no regression of Phase 11G vocabulary guard', () => {
  it('teacher text for KB1 colours has no raw {target} placeholders', async () => {
    const { sessionMemory } = startKidsBrainSession(makeSessionStart6_7('11i-K1', KB1_LESSON_2_WORDS));
    const mem = { ...sessionMemory, hasStartedFirstExercise: true };

    const result = await processKidsBrainTurn(
      makeTurnInput(mem, makeHesitantStt('blue'), 'blue', KB1_LESSON_2_WORDS),
    );

    const text = result.teacherResponsePlan.mainText;
    expect(text).not.toMatch(/\{target\}/);
    expect(text).not.toMatch(/\{item\}/);
    expect(text).not.toMatch(/\bundefined\b/i);
    expect(text).not.toContain('[object Object]');
    expect(text.trim().length).toBeGreaterThan(0);
  });

  it('teacher text for wrong colour has no raw placeholders', async () => {
    const { sessionMemory } = startKidsBrainSession(makeSessionStart6_7('11i-K2', KB1_LESSON_2_WORDS));
    const mem = { ...sessionMemory, hasStartedFirstExercise: true };

    const result = await processKidsBrainTurn(
      makeTurnInput(mem, makeHesitantStt('green'), 'blue', KB1_LESSON_2_WORDS),
    );

    const text = result.teacherResponsePlan.mainText;
    expect(text).not.toMatch(/\{target\}/);
    expect(text).not.toMatch(/\{item\}/);
    expect(text).not.toMatch(/\bundefined\b/i);
    expect(text.trim().length).toBeGreaterThan(0);
  });

  it('teacher text after activity advance has no placeholders', async () => {
    const mem = buildR22Session('11i-K3');

    const result = await processKidsBrainTurn(
      makeTurnInput(mem, makeConfidentStt('blue'), 'blue', KB1_LESSON_2_WORDS, 1200),
    );

    const text = result.teacherResponsePlan.mainText;
    expect(text).not.toMatch(/\{target\}/);
    expect(text).not.toMatch(/\{item\}/);
    expect(text).not.toMatch(/\bundefined\b/i);
    expect(text.trim().length).toBeGreaterThan(0);
  });
});
