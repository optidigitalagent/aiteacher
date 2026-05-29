import type { SessionState, ResponseSignal, RecoveryLevel } from './types.js';
import { applyConfidenceDelta, flagItem } from './session-engine.js';
import { log } from './logger.js';

// ─── Scripted script pools with rotation tracking ─────────────────────────────

const EFFORT_PRAISE = [
  'Ooh, good try! Listen — ',
  'I love that you tried! It\'s ',
  'Great thinking! Did you hear? ',
  'Yes, you\'re SO close! It\'s ',
  'Mmm! Good thinking! ',
];

const HESITANT_REINFORCE = [
  'Yes! Say it one more time!',
  'I heard you! Can you say it louder?',
  'Ooh! You know this! Say it again!',
  'Yes! One more time — nice and clear!',
  'I love how you said that! Again?',
];

const SILLY_GUESSES = [
  'Hmm... is it a BANANA? No no! Is it a SHOE? {name}, help me!',
  'Wait — I think it\'s a PIZZA? That can\'t be right! Do YOU know?',
  'Is it a FLYING SOCK? No! {name}, I need your help! What is it?',
];

const TOGETHER_SCRIPTS = [
  "Let's say it together! Ready? {target}! Now YOU!",
  'With me! {target}! Together — {target}! Your turn!',
  'You and me! {target}! Again — {target}! Now just you!',
];

const EASIEST_WIN_SCRIPTS = [
  'That\'s okay! Can you point to the {target}? Show me!',
  'No worries! Look — can you find the {target}?',
  'It\'s okay! Just point to the {target} for me!',
];

const LEVEL4_TRANSITION = [
  "Ooh! Let's do something fun for a minute! Ready?",
  "Hmm! Let's play a different game! Are you ready?",
  "Ooh, I have an idea! Let's try something exciting!",
];

const LEVEL5_ACKNOWLEDGE = [
  "Hey, it's okay! English is hard sometimes.",
  "That's okay! You're doing great.",
  'Milo gets stuck too sometimes!',
];

const lastUsed = new Map<string, number>();

function rotate<T>(pool: T[], key: string): T {
  const last = lastUsed.get(key) ?? -1;
  const next = (last + 1) % pool.length;
  lastUsed.set(key, next);
  return pool[next];
}

// ─── Signal classification ─────────────────────────────────────────────────────

const WAIT_TIME_MS = 4500;
const HARD_CUTOFF_MS = 8000;

const L1_PHRASES = ['не знаю', 'я не знаю', 'що', 'хто', 'яка', 'який'];
const IDK_PHRASES = ["i don't know", "idk", "don't know", "i dont know", "no idea", "dunno"];

export function detectL1(text: string): boolean {
  const lower = text.toLowerCase();
  // Cyrillic characters indicate L1 switch
  if (/[Ѐ-ӿ]/.test(text)) return true;
  return L1_PHRASES.some(p => lower.includes(p));
}

export function detectIdk(text: string): boolean {
  const lower = text.toLowerCase().trim();
  return IDK_PHRASES.some(p => lower.includes(p));
}

export function classifyResponse(
  text: string,
  latencyMs: number,
  targetWord: string,
  state: SessionState
): ResponseSignal {
  const item = state.curriculumState.activeItems.find(
    i => i.itemId === state.curriculumState.currentItemId
  );

  log(state, 'response_latency', { latencyMs });
  log(state, 'child_response_type', { text: text.slice(0, 80), latencyMs });

  if (!text.trim() || latencyMs > HARD_CUTOFF_MS) {
    state.emotionalState.freezeEventsThisSession++;
    return 'NO_RESPONSE';
  }

  if (detectL1(text)) return 'L1_SWITCH';
  if (detectIdk(text)) return 'NO_RESPONSE';

  const lower = text.toLowerCase();
  const isCorrect = targetWord
    .split(' ')
    .some(part => lower.includes(part.toLowerCase()));

  if (!isCorrect) {
    const consec = item?.consecutiveFailures ?? 0;
    if (consec >= 1) return 'REPEATED_FAILURE';
    return 'INCORRECT_ATTEMPT';
  }

  return latencyMs < 3000 ? 'CORRECT_CONFIDENT' : 'CORRECT_HESITANT';
}

// ─── Fast-track reaction selection (fires before LLM) ─────────────────────────

export function selectFastTrack(signal: ResponseSignal): { text: string; animation: string } {
  switch (signal) {
    case 'CORRECT_CONFIDENT':
      return { text: 'Yes!', animation: 'jump_celebration' };
    case 'CORRECT_HESITANT':
      return { text: 'Ooh!', animation: 'warm_nod' };
    case 'INCORRECT_ATTEMPT':
      return { text: 'Ooh!', animation: 'wide_eyes_curious' };
    case 'NO_RESPONSE':
      return { text: 'Hmm!', animation: 'warm_encouraging_nod' };
    case 'L1_SWITCH':
      return { text: 'Ooh!', animation: 'curious_expression' };
    case 'REPEATED_FAILURE':
      return { text: 'Ooh!', animation: 'gentle_nod' };
    case 'EMOTIONAL_SHUTDOWN':
      return { text: 'Hey!', animation: 'warm_gentle' };
  }
}

// ─── Reward selection ──────────────────────────────────────────────────────────

const MICRO_REWARDS = [
  { id: 'RW001', text: 'Amazing!', animation: 'star_burst' },
  { id: 'RW002', text: 'Yes! You got it!', animation: 'jump_celebration' },
  { id: 'RW003', text: 'Ooh, I love that!', animation: 'heart_float' },
  { id: 'RW004', text: 'Great job saying that!', animation: 'thumbs_up' },
  { id: 'RW005', text: "Wow, you're so good at this!", animation: 'star_shower' },
  { id: 'RW006', text: 'I knew you could do it!', animation: 'proud_nod' },
  { id: 'RW007', text: 'That was perfect!', animation: 'fireworks' },
  { id: 'RW008', text: "You're teaching me!", animation: 'surprised_delight' },
  { id: 'RW009', text: 'I love how you tried!', animation: 'warm_smile' },
  { id: 'RW010', text: 'Brilliant!', animation: 'sparkle' },
];

export function selectReward(
  state: SessionState
): { id: string; text: string; animation: string } {
  const lastId = state.rewardState.lastRewardId;
  const available = MICRO_REWARDS.filter(r => r.id !== lastId);
  const reward = available[Math.floor(Math.random() * available.length)];
  state.rewardState.lastRewardId = reward.id;
  state.rewardState.rewardsDeliveredThisSession++;
  return reward;
}

// ─── Recovery action builders ──────────────────────────────────────────────────

export interface RecoveryAction {
  recoveryLevel: RecoveryLevel;
  scriptedResponse: string;
  animation: string;
  frontendSignal?: { type: string; payload: Record<string, unknown> };
  requiresLlm: boolean;
  llmInstruction?: string;
  winAchieved: boolean;
}

export function buildRecoveryAction(
  signal: ResponseSignal,
  state: SessionState,
  targetWord: string,
  childName: string
): RecoveryAction {
  const itemId = state.curriculumState.currentItemId ?? '';
  const prevSignal = state.emotionalState.lastResponseSignal;

  // LEVEL 1 — hesitant but correct
  if (signal === 'CORRECT_HESITANT') {
    applyConfidenceDelta(state, itemId, 2);
    state.emotionalState.consecutiveSuccesses++;
    const script = rotate(HESITANT_REINFORCE, 'level1');
    log(state, 'recovery_trigger', { level: 1, signal });
    return {
      recoveryLevel: 1,
      scriptedResponse: script,
      animation: 'warm_amplified_praise',
      requiresLlm: false,
      winAchieved: true,
    };
  }

  // LEVEL 2 — wrong attempt
  if (signal === 'INCORRECT_ATTEMPT') {
    applyConfidenceDelta(state, itemId, -3);
    state.emotionalState.consecutiveSuccesses = 0;
    const praise = rotate(EFFORT_PRAISE, 'level2_praise');
    const together = rotate(TOGETHER_SCRIPTS, 'level2_together').replace('{target}', targetWord);
    log(state, 'recovery_trigger', { level: 2, signal });
    return {
      recoveryLevel: 2,
      scriptedResponse: `${praise}${targetWord}! ${together}`,
      animation: 'gentle_reveal_gesture',
      requiresLlm: false,
      winAchieved: false,
    };
  }

  // LEVEL 4 — repeated failure on same item
  if (signal === 'REPEATED_FAILURE') {
    applyConfidenceDelta(state, itemId, 0);
    state.emotionalState.consecutiveSuccesses = 0;
    flagItem(state, itemId, 'REPEATED_FAILURE');
    const transition = rotate(LEVEL4_TRANSITION, 'level4');
    log(state, 'recovery_trigger', { level: 4, signal });
    log(state, 'session_event', { event: 'activity_reset', reason: 'REPEATED_FAILURE' });
    return {
      recoveryLevel: 4,
      scriptedResponse: `${transition} Let's sing our animal song!`,
      animation: 'excited_transition',
      requiresLlm: false,
      winAchieved: false,
    };
  }

  // LEVEL 5 — emotional shutdown
  if (signal === 'EMOTIONAL_SHUTDOWN') {
    state.emotionalState.emotionalShutdownOccurred = true;
    state.emotionalState.recoveryLevel = 5;
    const ack = rotate(LEVEL5_ACKNOWLEDGE, 'level5');
    log(state, 'recovery_trigger', { level: 5, signal });
    return {
      recoveryLevel: 5,
      scriptedResponse: `${ack} ${childName}, let's sing our song together!`,
      animation: 'warm_gentle',
      requiresLlm: false,
      winAchieved: false,
    };
  }

  // LEVEL 3 — freeze or L1 switch
  if (signal === 'NO_RESPONSE' || signal === 'L1_SWITCH') {
    applyConfidenceDelta(state, itemId, -8);
    state.emotionalState.consecutiveSuccesses = 0;

    if (signal === 'L1_SWITCH') {
      state.immersionState.l1EventsThisSession++;
      if (!state.immersionState.l1Items.includes(itemId)) {
        state.immersionState.l1Items.push(itemId);
      }
      log(state, 'l1_rescue', { itemId, l1Count: state.immersionState.l1EventsThisSession });
      return {
        recoveryLevel: 3,
        scriptedResponse: `Oh! I heard you! In English — ${targetWord}! Say it: ${targetWord}!`,
        animation: 'bridge_gesture',
        requiresLlm: false,
        winAchieved: false,
      };
    }

    // Freeze — pick a recovery pattern, rotating through a/b/c
    const freezeCount = state.emotionalState.freezeEventsThisSession;
    const pattern = freezeCount % 3;

    if (pattern === 0) {
      // Pattern 3a: Silly guess
      const silly = rotate(SILLY_GUESSES, 'level3_silly').replace('{name}', childName);
      log(state, 'recovery_trigger', { level: 3, signal, pattern: 'silly_guess' });
      return {
        recoveryLevel: 3,
        scriptedResponse: silly,
        animation: 'confused_silly_expression',
        requiresLlm: false,
        winAchieved: false,
      };
    } else if (pattern === 1) {
      // Pattern 3b: Together answer
      const together = rotate(TOGETHER_SCRIPTS, 'level3_together').replace('{target}', targetWord);
      log(state, 'recovery_trigger', { level: 3, signal, pattern: 'together_answer' });
      return {
        recoveryLevel: 3,
        scriptedResponse: together,
        animation: 'gesture_together',
        requiresLlm: false,
        winAchieved: false,
      };
    } else {
      // Pattern 3c: Easiest win
      const easiest = rotate(EASIEST_WIN_SCRIPTS, 'level3_easiest').replace(
        '{target}',
        targetWord
      );
      log(state, 'recovery_trigger', { level: 3, signal, pattern: 'easiest_win' });
      return {
        recoveryLevel: 3,
        scriptedResponse: easiest,
        animation: 'gentle_pointing_invitation',
        frontendSignal: {
          type: 'VISUAL_FOCUS_REQUEST',
          payload: { itemId, focusType: 'zoom' },
        },
        requiresLlm: false,
        winAchieved: false,
      };
    }
  }

  // LEVEL 0 — correct confident (default)
  applyConfidenceDelta(state, itemId, 5);
  state.emotionalState.consecutiveSuccesses++;
  log(state, 'recovery_success', { level: 0, signal });
  return {
    recoveryLevel: 0,
    scriptedResponse: '',
    animation: 'star_burst',
    requiresLlm: true,
    llmInstruction: 'Generate warm praise and recast the correct form naturally.',
    winAchieved: true,
  };
}

export function recordRecoveryOutcome(
  state: SessionState,
  level: RecoveryLevel,
  pattern: string,
  resolved: boolean
): void {
  const atMinute = (Date.now() - state.startedAt.getTime()) / 60000;
  state.recoveryHistory.push({
    itemId: state.curriculumState.currentItemId ?? '',
    recoveryLevel: level,
    patternUsed: pattern,
    resolved,
    atMinute,
  });
  log(state, resolved ? 'recovery_success' : 'recovery_failure', {
    level,
    pattern,
    atMinute,
  });
}
