import type { SessionState, QuestionType } from './types.js';
import { ANIMALS } from './animals-curriculum.js';
import { log } from './logger.js';
import { recordLlmCall } from './session-engine.js';

// ─── Forbidden phrases — post-processing gate ─────────────────────────────────

const FORBIDDEN_PHRASES = [
  'no,', 'wrong', 'incorrect', "that's not right", 'try again',
  'do you understand', 'present tense', 'grammar', ' verb', ' noun',
  'sentence', 'practice', 'lesson', 'exercise', 'test', 'quiz',
  'score', 'fail', 'mistake',
];

function containsForbidden(text: string): boolean {
  const lower = text.toLowerCase();
  return FORBIDDEN_PHRASES.some(p => lower.includes(p));
}

// ─── Length enforcement ────────────────────────────────────────────────────────

function enforceLength(text: string): string {
  const sentences = text.match(/[^.!?]+[.!?]+/g) ?? [text];
  const trimmed = sentences.slice(0, 2).join(' ').trim();
  // Hard-cap each sentence at ~8 words
  return trimmed
    .split('. ')
    .map(s => {
      const words = s.split(' ');
      return words.length > 10 ? words.slice(0, 10).join(' ') + '...' : s;
    })
    .join('. ');
}

// ─── Scripted question generators (no LLM needed) ─────────────────────────────

export function buildRecognitionQuestion(targetWord: string, childName: string): string {
  const forms = [
    `Look! Can you find the ${targetWord}? Show me!`,
    `${childName}, where is the ${targetWord}? Point to it!`,
    `Is this the ${targetWord}? Show me!`,
  ];
  return forms[Math.floor(Math.random() * forms.length)];
}

export function buildForcedChoiceQuestion(
  targetWord: string,
  distractorWord: string,
  childName: string
): string {
  const forms = [
    `${childName}, is it a ${targetWord} or a ${distractorWord}?`,
    `Which one — ${targetWord} or ${distractorWord}?`,
    `${targetWord} or ${distractorWord}? Which is it?`,
  ];
  return forms[Math.floor(Math.random() * forms.length)];
}

export function buildSupportedProductionQuestion(
  targetWord: string,
  childName: string
): string {
  const firstLetter = targetWord[0].toUpperCase();
  const forms = [
    `What is it? It starts with ${firstLetter}... ${childName}?`,
    `I know! It's a ${firstLetter}... Can you finish it?`,
    `Say it with me — ${targetWord}! Now you say it!`,
  ];
  return forms[Math.floor(Math.random() * forms.length)];
}

export function buildFreeProductionQuestion(childName: string): string {
  const forms = [
    `What is this, ${childName}?`,
    `Tell me — what animal is it?`,
    `What do you see, ${childName}?`,
  ];
  return forms[Math.floor(Math.random() * forms.length)];
}

// ─── Distractor selection ──────────────────────────────────────────────────────

function pickDistractor(targetId: string): string {
  const target = ANIMALS.find(a => a.id === targetId);
  if (!target) return 'dog';
  const cluster = target.semanticCluster;
  const candidates = ANIMALS.filter(
    a => a.id !== targetId && cluster.some(c => a.semanticCluster.includes(c))
  );
  if (candidates.length === 0) {
    const others = ANIMALS.filter(a => a.id !== targetId);
    return others[Math.floor(Math.random() * others.length)]?.word ?? 'dog';
  }
  return candidates[Math.floor(Math.random() * candidates.length)].word;
}

// ─── Scripted question builder (no LLM) ───────────────────────────────────────

export function buildScriptedQuestion(state: SessionState): string {
  const itemId = state.curriculumState.currentItemId;
  const animal = ANIMALS.find(a => a.id === itemId);
  if (!animal) return `What animal do you see, ${state.childName}?`;

  const qType = state.curriculumState.currentQuestionType;
  switch (qType) {
    case 'RECOGNITION':
      return buildRecognitionQuestion(animal.word, state.childName);
    case 'FORCED_CHOICE':
      return buildForcedChoiceQuestion(animal.word, pickDistractor(itemId!), state.childName);
    case 'SUPPORTED_PRODUCTION':
      return buildSupportedProductionQuestion(animal.word, state.childName);
    case 'FREE_PRODUCTION':
      return buildFreeProductionQuestion(state.childName);
  }
}

// ─── LLM prompt builder ───────────────────────────────────────────────────────

export function buildLlmSystemPrompt(state: SessionState): string {
  const itemId = state.curriculumState.currentItemId;
  const animal = ANIMALS.find(a => a.id === itemId);
  const activeWords = state.curriculumState.activeItems
    .map(i => ANIMALS.find(a => a.id === i.itemId)?.word)
    .filter(Boolean)
    .join(', ');

  return `You are Milo, an enthusiastic and warm English teacher for ${state.childName}, who is ${state.childAge} years old.
You are teaching English as a second language. The child's first language is ${state.childL1 === 'uk' ? 'Ukrainian' : 'Russian'}.

YOUR PERSONALITY:
- Warm, energetic, playful — like an enthusiastic friend, not a teacher
- Celebrate every attempt, correct or not
- Use the child's name exactly once per response
- Never disappointed, never impatient

TODAY'S SESSION:
- Active vocabulary: ${activeWords}
- Current target word: ${animal?.word ?? 'unknown'}
- Question type: ${state.curriculumState.currentQuestionType}
- Recovery level: ${state.emotionalState.recoveryLevel}
- Child's confidence: ${state.curriculumState.activeItems.find(i => i.itemId === itemId)?.confidenceScore ?? 0}/100

OUTPUT RULES — FOLLOW EXACTLY:
1. Maximum 2 sentences total
2. Maximum 8 words per sentence
3. Use ${state.childName} exactly once
4. If recovery_level >= 2: praise the attempt BEFORE any correction
5. Use RECAST for wrong answers — include correct form naturally without flagging error
6. NEVER use: "No", "Wrong", "Incorrect", "That's not right", "Try again" alone
7. NEVER explain grammar
8. End with a question or prompt that invites the child's response

RESPOND WITH ONLY THE TEACHER'S DIALOGUE.`;
}

export function buildLlmUserPrompt(childResponseText: string): string {
  return `Child's response: "${childResponseText}"\nGenerate Milo's next response.`;
}

// ─── LLM call (production: replace with real Claude SDK call) ─────────────────

export async function callLlm(
  systemPrompt: string,
  userPrompt: string,
  state: SessionState
): Promise<string> {
  // Guard: cost cap
  if (state.costState.costCapReached) {
    return buildScriptedQuestion(state);
  }

  try {
    // In production this is a real streaming Claude call.
    // For the prototype we use a scripted stub so the runtime is testable without keys.
    const stubResponse = buildScriptedQuestion(state);
    recordLlmCall(state, stubResponse.length);
    log(state, 'llm_call', { stubbed: true, prompt: userPrompt.slice(0, 60) });
    return stubResponse;
  } catch (err) {
    log(state, 'llm_call', { error: String(err) });
    return buildScriptedQuestion(state);
  }
}

// ─── Post-processing pipeline ─────────────────────────────────────────────────

export interface ProcessedResponse {
  text: string;
  wasModified: boolean;
  fallbackUsed: boolean;
}

export function postProcess(
  raw: string,
  fallback: string,
  state: SessionState
): ProcessedResponse {
  let text = enforceLength(raw.trim());
  let wasModified = text !== raw.trim();
  let fallbackUsed = false;

  if (containsForbidden(text)) {
    log(state, 'session_event', {
      event: 'forbidden_phrase_blocked',
      raw: raw.slice(0, 80),
    });
    text = fallback;
    fallbackUsed = true;
    wasModified = true;
  }

  return { text, wasModified, fallbackUsed };
}

// ─── Session greeting ─────────────────────────────────────────────────────────

export function buildGreeting(state: SessionState): string {
  const name = state.childName;
  if (state.sessionNumber === 1) {
    return `Hi ${name}! I'm Milo! Today we're going to the zoo! Are you ready?`;
  }
  return `${name}! You're back! I missed you! Let's go to the zoo! Ready?`;
}

// ─── Session close ────────────────────────────────────────────────────────────

export function buildClosing(state: SessionState): string {
  const mastered = state.curriculumState.completedItems.length;
  const name = state.childName;
  if (mastered > 0) {
    const words = state.curriculumState.completedItems
      .map(id => ANIMALS.find(a => a.id === id)?.word)
      .filter(Boolean)
      .slice(0, 2)
      .join(' and ');
    return `${name}, you learned ${words} today! Amazing! See you next time!`;
  }
  return `Great job today, ${name}! You're so brave! See you next time!`;
}
