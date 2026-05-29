/**
 * Template bank for all standard teacher response scenarios (Phase 6 spec).
 *
 * Templates use {word}, {optA}, {optB} as variable markers.
 * These MUST be resolved by renderTemplate() before output.
 * The placeholder guard will block any unresolved { or } characters.
 */

export type TemplateKey =
  | 'greeting'
  | 'correct_answer'
  | 'hesitant_correct'
  | 'near_correct'
  | 'wrong_but_safe'
  | 'repeat_after_me'
  | 'forced_choice'
  | 'supported_production'
  | 'recovery_prompt'
  | 'easiest_win'
  | 'l1_rescue'
  | 'silence_rescue'
  | 'refusal_recovery'
  | 'close_success'
  | 'safety_close';

export interface TemplateVars {
  word?: string;
  optA?: string;
  optB?: string;
}

/** Template bank: each key maps to an array of variant strings. */
const TEMPLATES: Readonly<Record<TemplateKey, readonly string[]>> = {
  greeting: [
    "Hey! I'm SO happy you're here!",
    "Hello! Let's have fun today!",
    "Hi there! Are you ready? Let's go!",
  ],

  correct_answer: [
    '{word}! Yes! You said {word}! Amazing!',
    'Yes! {word}! I love it! Great job!',
    '{word}! Wow! You got it! Brilliant!',
    'Yes, YES! {word}! That was perfect!',
  ],

  hesitant_correct: [
    'Yes! {word}! Say it one more time!',
    'I heard you! {word}! Can you say it louder?',
    'Ooh! {word}! You know this! Say it again!',
    'Yes! {word}! One more time, nice and clear!',
  ],

  near_correct: [
    '{word}! Yes! {word}! Say it with me!',
    'Ooh! Listen — {word}! Can you say {word}?',
    'Almost! Listen — {word}! Try again — {word}!',
    'Good try! It\'s {word}! Say: {word}!',
  ],

  wrong_but_safe: [
    'Good thinking! Listen — {word}! Say: {word}!',
    'Ooh! I love that try! It\'s {word}! {word}!',
    'Great energy! It\'s {word}! Say it with me: {word}!',
  ],

  repeat_after_me: [
    'Listen! {word}! Say: {word}!',
    'Say it with me — {word}! Your turn!',
    'Together — {word}! Now you! {word}!',
    'Ready? {word}! Now say: {word}!',
  ],

  forced_choice: [
    'Is it {optA} or {optB}?',
    'Which one? {optA}... or {optB}?',
    '{optA} or {optB} — which is it?',
    'What do you think? {optA} or {optB}?',
  ],

  supported_production: [
    "What is it? It's a... {word}!",
    'Say it — {word}! Can you say {word}?',
    'I think it\'s a... say it! {word}!',
  ],

  recovery_prompt: [
    "It's okay! Let's try together — {word}!",
    "That's okay! Listen — {word}! Say: {word}!",
    "No problem! Say it with me: {word}!",
  ],

  easiest_win: [
    'Is it {optA}? Yes or no?',
    'Can you point to the {word}?',
    'Say it with me — {word}! Together!',
    'Say: {word}! Just one time!',
  ],

  l1_rescue: [
    'Listen — {word}! Can you say {word}?',
    'In English — {word}! {word}! Say it!',
    '{word}! That\'s it! Say: {word}!',
  ],

  silence_rescue: [
    'Hmm... is it {optA} or {optB}?',
    'Let me help! Is it {word}? Yes or no?',
    "It's okay! Listen — {word}! Say: {word}!",
    'Together! {word}! Your turn!',
  ],

  refusal_recovery: [
    "That's okay! Let's do something fun!",
    "No problem! Let's try a game!",
    "It's okay! We can do this together!",
  ],

  close_success: [
    'Amazing! You did it! I\'m SO proud!',
    'Yes! You are amazing! Great job today!',
    "Wow! You're so good! See you next time!",
  ],

  safety_close: [
    "That's okay. We'll play again soon. Bye-bye!",
    "It's okay. Great job today! Bye-bye!",
    "We'll come back soon! Bye-bye!",
  ],
};

/** Picks a variant that was not recently used. Falls back to any variant. */
export function pickTemplateVariant(
  key: TemplateKey,
  recentPhrases: string[],
): string {
  const variants = TEMPLATES[key];
  const available = variants.filter(v => !recentPhrases.some(r => v.startsWith(r.slice(0, 8))));
  const pool = available.length > 0 ? available : [...variants];
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Renders a template string by replacing all {var} markers with provided values. */
export function renderTemplate(template: string, vars: TemplateVars): string {
  let result = template;
  if (vars.word !== undefined) {
    result = result.replace(/\{word\}/g, vars.word);
  }
  if (vars.optA !== undefined) {
    result = result.replace(/\{optA\}/g, vars.optA);
  }
  if (vars.optB !== undefined) {
    result = result.replace(/\{optB\}/g, vars.optB);
  }
  return result;
}

/**
 * Gets a rendered template for a given key.
 * Returns the rendered text and whether all placeholders were resolved.
 */
export function getRenderedTemplate(
  key: TemplateKey,
  vars: TemplateVars,
  recentPhrases: string[],
): string {
  const template = pickTemplateVariant(key, recentPhrases);
  return renderTemplate(template, vars);
}

/** Returns all templates for a key (for testing). */
export function getAllTemplatesForKey(key: TemplateKey): readonly string[] {
  return TEMPLATES[key];
}
