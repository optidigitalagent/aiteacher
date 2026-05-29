import type { SessionState, RescueLevel } from './types.js';
import { ANIMALS } from './animals-curriculum.js';
import { log } from './logger.js';

// ─── Wait-time thresholds (ms) ────────────────────────────────────────────────

const WAIT_TIME_MS = 4500;
const HARD_CUTOFF_MS = 8000;
const L1_SESSION_HARD_MAX = 5;

// ─── Scripted rescue scripts per level ────────────────────────────────────────

const LEVEL1_TEMPLATES = [
  (w: string) => `Hmm... what IS this? Look — it's a... ${w[0].toUpperCase()}...!`,
  (w: string) => `Listen! Listen very carefully. ${w}! What is it?`,
  (w: string) => `Look here! Right here! What animal? What IS it?`,
];

const LEVEL2_TEMPLATES = [
  (w: string) => `Look! [points] This! What?`,
  (w: string) => `Right here! [visual] Name it!`,
  (w: string) => `Look at this! What animal?`,
];

const LEVEL3_TEMPLATES = [
  (w: string, sound: string) => `${sound}! A ${w}! What is it?`,
  (w: string, sound: string) => `[mimics animal] ${sound}! ${sound}! What animal?`,
  (w: string, sound: string) => `${sound}! Like in the zoo! What IS it?`,
];

// Sound cues mapped from the curriculum's soundCueId field
const SOUND_SCRIPTS: Record<string, string> = {
  sfx_meow: 'Meow meow',
  sfx_woof: 'Woof woof',
  sfx_roar: 'Roaaaar',
  sfx_trumpet: 'Paaamm',
  sfx_monkey: 'Ooh ooh',
  sfx_lion: 'ROAAAAR',
};

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─── L1 anchor delivery ───────────────────────────────────────────────────────

function buildL1AnchorScript(
  targetWord: string,
  l1Word: string,
  childName: string
): string {
  const forms = [
    `${l1Word}! In English — ${targetWord}! Can you say ${targetWord}?`,
    `In English it's ${targetWord}! Like [${l1Word}]! Say it — ${targetWord}!`,
  ];
  return pick(forms);
}

// ─── Strategic vs genuine distress detection ──────────────────────────────────

function isStrategicAvoidance(state: SessionState, latencyMs: number): boolean {
  // Very fast L1 switch likely strategic
  if (latencyMs < 1000) return true;
  // Child succeeded on a similar item recently
  if (state.emotionalState.consecutiveSuccesses >= 2) return true;
  return false;
}

// ─── Wait time state machine ──────────────────────────────────────────────────

export function startWaitTimer(state: SessionState): void {
  state.immersionState.waitTimeState = 'waiting';
  state.immersionState.waitStartedAtMs = Date.now();
}

export function checkWaitElapsed(state: SessionState): 'none' | 'soft' | 'hard' {
  if (state.immersionState.waitTimeState !== 'waiting') return 'none';
  const elapsed = Date.now() - (state.immersionState.waitStartedAtMs ?? Date.now());
  if (elapsed >= HARD_CUTOFF_MS) return 'hard';
  if (elapsed >= WAIT_TIME_MS) return 'soft';
  return 'none';
}

export function clearWaitTimer(state: SessionState): void {
  state.immersionState.waitTimeState = 'idle';
  state.immersionState.waitStartedAtMs = null;
}

// ─── Main rescue ladder entry point ──────────────────────────────────────────

export interface RescueOutput {
  rescueLevel: RescueLevel;
  text: string;
  animation: string;
  frontendSignal?: { type: string; payload: Record<string, unknown> };
  l1Used: boolean;
}

export function buildRescueResponse(
  state: SessionState,
  latencyMs: number,
  wasL1Switch: boolean
): RescueOutput {
  const itemId = state.curriculumState.currentItemId ?? '';
  const animal = ANIMALS.find(a => a.id === itemId);
  const targetWord = animal?.word ?? 'animal';
  const soundCueId = animal?.soundCueId ?? '';
  const soundScript = SOUND_SCRIPTS[soundCueId] ?? 'Roaaaar';
  const l1Word =
    state.childL1 === 'uk'
      ? (animal?.l1Translations.uk ?? targetWord)
      : (animal?.l1Translations.ru ?? targetWord);

  const currentRescue = state.immersionState.rescueLevel;

  // L1 switch — check if genuine before escalating
  if (wasL1Switch) {
    if (isStrategicAvoidance(state, latencyMs)) {
      // Don't reward — use Level 3 (sound/mime) instead
      log(state, 'session_event', { event: 'strategic_l1_detected', itemId });
      return buildLevel3(state, targetWord, soundScript, itemId);
    }
    // Genuine — use L1 anchor if we haven't exceeded the cap
    if (state.immersionState.l1EventsThisSession < L1_SESSION_HARD_MAX) {
      return buildLevel4(state, targetWord, l1Word, state.childName, itemId);
    }
  }

  // Escalate rescue ladder
  const nextLevel = Math.min((currentRescue + 1) as RescueLevel, 5 as RescueLevel);

  switch (nextLevel) {
    case 1:
      return buildLevel1(state, targetWord, itemId);
    case 2:
      return buildLevel2(state, targetWord, itemId);
    case 3:
      return buildLevel3(state, targetWord, soundScript, itemId);
    case 4:
      return buildLevel4(state, targetWord, l1Word, state.childName, itemId);
    case 5:
      return buildLevel5(state, targetWord, l1Word, itemId);
    default:
      return buildLevel1(state, targetWord, itemId);
  }
}

// ─── Level builders ───────────────────────────────────────────────────────────

function setRescueLevel(state: SessionState, level: RescueLevel): void {
  state.immersionState.rescueLevel = level;
  log(state, 'session_event', {
    event: 'rescue_level_set',
    level,
    l1Events: state.immersionState.l1EventsThisSession,
  });
}

function buildLevel1(state: SessionState, targetWord: string, itemId: string): RescueOutput {
  setRescueLevel(state, 1);
  const template = pick(LEVEL1_TEMPLATES);
  return {
    rescueLevel: 1,
    text: template(targetWord),
    animation: 'slow_emphatic_point',
    l1Used: false,
  };
}

function buildLevel2(state: SessionState, targetWord: string, itemId: string): RescueOutput {
  setRescueLevel(state, 2);
  const template = pick(LEVEL2_TEMPLATES);
  return {
    rescueLevel: 2,
    text: template(targetWord),
    animation: 'zoom_visual_gesture',
    frontendSignal: {
      type: 'VISUAL_FOCUS_REQUEST',
      payload: { itemId, focusType: 'zoom' },
    },
    l1Used: false,
  };
}

function buildLevel3(
  state: SessionState,
  targetWord: string,
  soundScript: string,
  itemId: string
): RescueOutput {
  setRescueLevel(state, 3);
  const template = pick(LEVEL3_TEMPLATES);
  return {
    rescueLevel: 3,
    text: template(targetWord, soundScript),
    animation: 'mime_animal',
    frontendSignal: {
      type: 'PLAY_SOUND_CUE',
      payload: {
        itemId,
        soundCueId: ANIMALS.find(a => a.id === itemId)?.soundCueId ?? '',
      },
    },
    l1Used: false,
  };
}

function buildLevel4(
  state: SessionState,
  targetWord: string,
  l1Word: string,
  childName: string,
  itemId: string
): RescueOutput {
  setRescueLevel(state, 4);
  state.immersionState.l1EventsThisSession++;
  if (!state.immersionState.l1Items.includes(itemId)) {
    state.immersionState.l1Items.push(itemId);
  }
  log(state, 'l1_rescue', {
    level: 4,
    itemId,
    l1Word,
    totalL1Events: state.immersionState.l1EventsThisSession,
  });
  return {
    rescueLevel: 4,
    text: buildL1AnchorScript(targetWord, l1Word, childName),
    animation: 'l1_bridge_gesture',
    l1Used: true,
  };
}

function buildLevel5(
  state: SessionState,
  targetWord: string,
  l1Word: string,
  itemId: string
): RescueOutput {
  setRescueLevel(state, 5);
  state.immersionState.l1EventsThisSession++;
  log(state, 'l1_rescue', {
    level: 5,
    itemId,
    emergency: true,
    totalL1Events: state.immersionState.l1EventsThisSession,
  });
  return {
    rescueLevel: 5,
    text: `That's okay! It's ${l1Word} — ${targetWord}! You're doing amazing!`,
    animation: 'warm_gentle_embrace',
    l1Used: true,
  };
}

// ─── Reset rescue level after a success ───────────────────────────────────────

export function resetRescueLevelOnSuccess(state: SessionState): void {
  if (state.immersionState.rescueLevel > 0) {
    log(state, 'session_event', {
      event: 'rescue_reset',
      prevLevel: state.immersionState.rescueLevel,
    });
    state.immersionState.rescueLevel = 0;
  }
}
