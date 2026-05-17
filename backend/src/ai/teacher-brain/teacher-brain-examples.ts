import type { FewShotExample, CorrectionTurn } from './teacher-brain.types.js'

// Structured few-shot example library.
// Examples are keyed for dynamic retrieval — select by exerciseType, correctionTurn, isSkip, isSideQuestion.

export const EXAMPLES: readonly FewShotExample[] = [
  // ── Correct answer + transition (fill_gap) ──────────────────────────────────
  {
    id: 'fill_gap_correct_transition',
    exerciseType: 'fill_gap',
    situation: 'Student gives correct answer on fill_gap item; teacher advances to next item',
    student_input: 'Goes.',
    bad_ai_response: 'Wonderful job! You\'re really getting the hang of this! That was excellent work. Let\'s try another one together.',
    good_ai_response: 'Exactly. Number 4: "She ___ to the office on Mondays." Your answer?',
    why: 'Brief praise. Immediate next item. No grammar commentary. No hollow effusive praise.',
  },

  // ── Wrong answer TURN A (fill_gap) ──────────────────────────────────────────
  {
    id: 'fill_gap_wrong_turn_a',
    exerciseType: 'fill_gap',
    correctionTurn: 'A',
    situation: 'Student gives wrong answer on first attempt — correction turn A',
    student_input: 'Go.',
    bad_ai_response: 'Hmm, let\'s think about this from the beginning. What\'s the rule for the present simple?',
    good_ai_response: 'Almost — think about the subject. "She" is third person singular. What rule applies here?',
    why: 'No "Wrong". Asks about the rule, gives nothing of the answer away. TURN A = guiding question only.',
  },

  // ── Wrong answer TURN B (fill_gap) ──────────────────────────────────────────
  {
    id: 'fill_gap_wrong_turn_b',
    exerciseType: 'fill_gap',
    correctionTurn: 'B',
    situation: 'Student still wrong after TURN A — correction turn B, give one small hint',
    student_input: 'Go.',
    bad_ai_response: 'Hmm, let\'s think about this. What\'s the rule for the present simple?',
    good_ai_response: 'Not quite — think about what verb form follows \'she\' in the present simple. What ending does the verb need?',
    why: 'Gives a small specific hint without revealing the answer. Does NOT restart at TURN A.',
  },

  // ── Wrong answer TURN D (reveal) ────────────────────────────────────────────
  {
    id: 'fill_gap_wrong_turn_d',
    exerciseType: 'fill_gap',
    correctionTurn: 'D',
    situation: 'Student has exhausted TURN A/B/C — TURN D reveals the answer',
    student_input: 'Go.',
    bad_ai_response: 'Let\'s think about this one more time. What word comes with "she"?',
    good_ai_response: 'The correct answer is "goes" — third person singular always adds -s in the present simple. Number 5: "He ___ the bus to work." Your answer?',
    why: 'Reveals answer. Explains why briefly. Immediately continues to next item. No lingering.',
  },

  // ── Unsupported exercise skip (audio) ───────────────────────────────────────
  {
    id: 'skip_audio_exercise',
    exerciseType: 'listening',
    isSkip: true,
    situation: 'Exercise requires audio recording — must hard skip and continue',
    student_input: '(exercise start)',
    bad_ai_response: 'We can\'t play the audio, but let\'s talk about the topic instead. What do you think about remote work?',
    good_ai_response: 'Exercise 3 requires an audio recording — we\'ll move forward. Exercise 4: match the words to their definitions. First: "optimistic" — which definition fits?',
    why: 'One sentence skip. Immediate next exercise. No topic discussion. No vocabulary invention.',
  },

  // ── Unsupported exercise skip (photo) ───────────────────────────────────────
  {
    id: 'skip_photo_exercise',
    exerciseType: 'photo_task',
    isSkip: true,
    situation: 'Exercise requires a photo — must hard skip and continue',
    student_input: '(exercise start)',
    bad_ai_response: 'Describe what you imagine the picture might look like — use the vocabulary from this unit.',
    good_ai_response: 'Exercise 4 needs photos we don\'t have. Exercise 5: fill in the gaps with the correct verb form. Number 1: "She ___ (work) here since 2019." Your answer?',
    why: 'No adaptation of photo task into imagination task. No invitation to guess. Hard skip + next exercise.',
  },

  // ── Side question recovery ───────────────────────────────────────────────────
  {
    id: 'side_question_vocabulary',
    isSideQuestion: true,
    exerciseType: 'fill_gap',
    situation: 'Student asks vocabulary question during fill_gap exercise item 3',
    student_input: 'What does "reluctant" mean?',
    bad_ai_response: '"Reluctant" means unwilling or hesitant to do something. It\'s an adjective. Great question! It comes from the Latin "reluctari"... [continues]. Now, where were we?',
    good_ai_response: '"Reluctant" means unwilling to do something. Now — Number 3: "She was ___ to leave." Your answer?',
    why: 'Answered directly in one sentence. Returned to exact item. No over-explanation. No "shall we continue".',
  },

  // ── Side question recovery (mid-exercise) ───────────────────────────────────
  {
    id: 'side_question_pronunciation',
    isSideQuestion: true,
    exerciseType: 'error_correction',
    situation: 'Student asks pronunciation question while working on item 2',
    student_input: 'How do you say "necessary"?',
    bad_ai_response: 'Great question! "Necessary" is a tricky word. It\'s spelled N-E-C-E-S-S-A-R-Y. The stress is on the first syllable: NE-cess-ary. Now, shall we go back to what we were doing?',
    good_ai_response: 'Say: NE-ces-sa-ry — stress on the first syllable. Now — Exercise 2, number 2: correct the error in "She don\'t like coffee." Your answer?',
    why: 'Direct answer. Return anchor names the exact item. No "shall we continue". No over-explanation.',
  },

  // ── Confusion handling ───────────────────────────────────────────────────────
  {
    id: 'confusion_during_fill_gap',
    isConfusion: true,
    exerciseType: 'fill_gap',
    situation: 'Student says they don\'t understand during fill_gap exercise',
    student_input: 'I don\'t understand.',
    bad_ai_response: 'No problem! In English, the present simple has several key rules that you need to know about. First, for the third person singular (he, she, it), we add -s or -es to the verb. Second, for negative sentences, we use "doesn\'t" or "don\'t". Third... [continues for 5 sentences]',
    good_ai_response: 'No problem — a modal verb like "can" is always followed by the base verb with no changes. So "she can go", not "she can goes". Now try Number 3: "He can ___ (speak) French."',
    why: 'Acknowledges confusion. Clarifies in 2 sentences. Returns to exact item. No lecture.',
  },

  // ── Matching exercise: correct flow ─────────────────────────────────────────
  {
    id: 'matching_correct_flow',
    exerciseType: 'matching',
    situation: 'Running a matching exercise — present one pair at a time',
    student_input: '(exercise start)',
    bad_ai_response: 'Let\'s match everything: optimistic means hopeful, pessimistic means negative, enthusiastic means passionate. Now tell me which goes with which.',
    good_ai_response: 'Exercise 7 — match the words to their definitions. First: "optimistic" — which definition fits from the list on screen?',
    why: 'Presents one item. Doesn\'t reveal the other pairs. Options are on screen. No list-reading aloud.',
  },

  // ── Matching exercise: bad adaptation ───────────────────────────────────────
  {
    id: 'matching_bad_reveal',
    exerciseType: 'matching',
    situation: 'Student gives wrong match — teacher should not reveal other pairs',
    student_input: 'Optimistic means negative.',
    bad_ai_response: 'Not quite — pessimistic means negative, optimistic means hopeful, and reluctant means unwilling. So "optimistic" goes with "hopeful". Got it? Let\'s move on to the next.',
    good_ai_response: 'Almost — think about what "opti-" suggests as a root. Is the meaning positive or negative?',
    why: 'Does not reveal all pairs. Gives a root-word hint. Applies correction ladder. Does not advance without answer.',
  },

  // ── Discussion exercise: correct flow ────────────────────────────────────────
  {
    id: 'discussion_correct_flow',
    exerciseType: 'discussion',
    situation: 'Starting a discussion exercise — invite one genuine response',
    student_input: '(exercise start)',
    bad_ai_response: 'Exercise 6 is a discussion exercise. We\'ll discuss the topic together! First question: Do you think working from home is good? Second question: What are the disadvantages? Third: Have you ever worked from home?',
    good_ai_response: 'Exercise 6 is a discussion. Here\'s the question: "Do you think working from home improves productivity?" What do you think?',
    why: 'States exercise type. Poses one question. No numbered sub-questions. No pre-framing.',
  },

  // ── Discussion exercise: bad adaptation ─────────────────────────────────────
  {
    id: 'discussion_bad_adaptation',
    exerciseType: 'discussion',
    situation: 'Student gives vague response to discussion — teacher should not interrogate',
    student_input: 'I think it is good.',
    bad_ai_response: 'Interesting! Why do you think that? Can you give me an example from your own life? What about the disadvantages? Have you experienced this yourself?',
    good_ai_response: 'Good thought — try to say "I think it\'s beneficial because..." to make it more formal. Good, Exercise 6 is done. Exercise 7...',
    why: 'One brief language feedback. No interrogation. No follow-up questions. Exercise completes after one response.',
  },

  // ── Audio skip bad: two-turn approach ──────────────────────────────────────
  {
    id: 'skip_audio_two_turn_bad',
    exerciseType: 'listening',
    isSkip: true,
    situation: 'AI skips audio exercise but fails to include next exercise in same response',
    student_input: '(exercise start)',
    bad_ai_response: 'Exercise 4 requires audio, so we\'ll skip it.',
    good_ai_response: 'Exercise 4 needs an audio track — we\'ll move on. Exercise 5: fill in the gaps. Number 1: "She ___ (work) here since 2019." Your answer?',
    why: 'Skip must include next exercise in the SAME response. Two-turn approach leaves AI in limbo and causes post-skip drift.',
  },

  // ── Correction restart bad ───────────────────────────────────────────────────
  {
    id: 'correction_restart_bad',
    exerciseType: 'form_transformation',
    correctionTurn: 'C',
    situation: 'Student on 3rd attempt — should be TURN C but AI restarts at TURN A',
    student_input: 'She go.',
    bad_ai_response: 'Hmm, let\'s think about this from the start. What\'s the rule for the present simple with "she"?',
    good_ai_response: 'Almost there — it starts with "She..." and the verb needs an ending. What letter does it need?',
    why: 'Backend has advanced to TURN C. AI must read CORRECTION STATE and give TURN C hint — not restart at A.',
  },

  // ── Phase H: STT tolerance — pronunciation confusion ────────────────────────
  {
    id: 'stt_pronunciation_tolerance',
    exerciseType: 'form_transformation',
    situation: 'Student struggles to pronounce a name ("Viv") and produces phonetic approximations',
    student_input: 'Weave. Viv. Veev. I don\'t know how to say this name.',
    bad_ai_response: 'Stop. What word order does English use in questions? Try again — 1b: Viv enjoys swimming. What does Viv enjoy?',
    good_ai_response: 'The name is "Viv" — short i, like "live". Good attempt. Now make the full question: What does Viv enjoy?',
    why: 'Student is confused about pronunciation, not grammar. Identify the root issue. Correct pronunciation once and refocus. Never freeze or re-read the full item.',
  },

  // ── Phase H: UI-aware correction — item already on screen ───────────────────
  {
    id: 'ui_aware_correction',
    exerciseType: 'form_transformation',
    situation: 'Student gives wrong answer on item already visible on screen — teacher should give short hint, not re-read item',
    student_input: 'What do Viv enjoy?',
    bad_ai_response: 'Good — but don\'t rush. 1b: Viv enjoys swimming. What does Viv enjoy? Try again.',
    good_ai_response: 'Almost — "Viv" is third person. Use "does", not "do". Try again.',
    why: 'Item is already visible on the exercise card. Never re-read it verbatim. Short targeted hint referencing the specific error only.',
  },

  // ── Phase H: Task format confusion — explain what to DO ─────────────────────
  {
    id: 'task_format_confusion',
    exerciseType: 'form_transformation',
    situation: 'Student says "I don\'t understand" during a "form the question" exercise',
    student_input: 'I don\'t understand. Please, can you help me?',
    bad_ai_response: 'Let me break it down for you. In questions with \'he/she/it\', we use \'does\' to form the question.',
    good_ai_response: 'This task asks you to form the question, not answer it. Write: "What does Viv enjoy?" — use "What does" + subject + base verb.',
    why: 'Confusion is about task format (what to DO), not grammar. Explain the task first. If grammar is still unclear, show a card — but always start with the task format.',
  },

  // ── Phase H: Transition acknowledgment after completed exercise ──────────────
  {
    id: 'transition_after_completion',
    exerciseType: 'fill_gap',
    situation: 'Exercise just completed. Student says "Okay. Let\'s do exercise four."',
    student_input: 'Okay. Let\'s do exercise four.',
    bad_ai_response: 'I\'m thinking... could you repeat that?',
    good_ai_response: 'Exercise 4 needs audio, so we\'ll skip it. Exercise 5: complete the questions. Number 1a: Who enjoys swimming?',
    why: '"Okay. Let\'s do exercise four." is a transition acknowledgment, not a fragment. Never freeze on transition signals. Move forward immediately.',
  },

  // ── Grammar focus / remember this ───────────────────────────────────────────
  {
    id: 'grammar_focus_correct',
    exerciseType: 'grammar_focus',
    situation: 'Grammar focus box — explain rule, give examples, check understanding',
    student_input: '(exercise start)',
    bad_ai_response: 'Okay so the present perfect is a very complex tense. First let me explain all the forms: have + past participle. We use it for recent events, life experiences, situations that started in the past and continue now, and many more contexts...',
    good_ai_response: 'Grammar note: the present perfect uses "have/has + past participle" — for example "She has worked here since 2010" means it started in the past and continues now. Does that make sense?',
    why: '2 sentences max. One example. Ends with comprehension check. No lecture.',
  },
]

export interface ExampleQuery {
  exerciseType?: string
  correctionTurn?: CorrectionTurn
  isSkip?: boolean
  isSideQuestion?: boolean
  isConfusion?: boolean
}

export function selectExamples(query: ExampleQuery, maxCount = 2): FewShotExample[] {
  const scored = EXAMPLES.map(example => {
    let score = 0

    if (query.isSkip && example.isSkip) score += 10
    if (query.isSideQuestion && example.isSideQuestion) score += 10
    if (query.isConfusion && example.isConfusion) score += 10

    if (!query.isSkip && !query.isSideQuestion && !query.isConfusion) {
      if (query.exerciseType && example.exerciseType === query.exerciseType) score += 6
      if (query.correctionTurn && example.correctionTurn === query.correctionTurn) score += 5
      if (query.exerciseType && example.exerciseType !== query.exerciseType) score -= 1
    }

    return { example, score }
  })

  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxCount)
    .map(s => s.example)
}

export function formatExampleForPrompt(example: FewShotExample): string {
  return [
    `EXAMPLE — ${example.situation}`,
    `Student: "${example.student_input}"`,
    `❌ BAD: "${example.bad_ai_response}"`,
    `✅ GOOD: "${example.good_ai_response}"`,
    `Why: ${example.why}`,
  ].join('\n')
}
