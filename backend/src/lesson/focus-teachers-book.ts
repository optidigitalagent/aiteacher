// Focus 2 Teacher's Book (Pearson, A2+/B1) — data source for AI teacher
// Pages 4–15: Teaching methodology → TEACHING_METHODOLOGY constant
// Per-unit sections: answer keys, teacher procedure, listening tracks
//
// VIDEO ACTIVITIES (Grammar Animations, speaking videos) are excluded from MVP.
// LISTENING ACTIVITIES are fully supported.
//
// How to add more data:
//   1. Add a new section entry under the unit number
//   2. Set dataAvailable: true
//   3. Fill in teacherNotes and answerKeys from the actual Teacher's Book

// ─── INTERFACES ──────────────────────────────────────────────────────────────

export interface AnswerKey {
  exerciseRef: string                // "Ex 1", "Ex 2a", "Ex 3b"
  exerciseType: 'vocabulary' | 'grammar' | 'listening' | 'reading' | 'use_of_english' | 'writing' | 'speaking'
  isVideoActivity: boolean           // true → SKIP in MVP (Grammar Animations, video tasks)
  isListeningActivity: boolean       // true → needs audio track
  answers: string[]                  // correct answers in order
  alternativeAnswers?: string[]      // accepted variations
  teacherNote?: string               // common mistake or teaching tip from TB
}

export interface TeachersBookSection {
  unit: number
  sectionId: string                  // "1.1", "2.3", etc.
  sectionTitle: string               // "Vocabulary", "Grammar 1", "Listening", etc.
  studentBookPages?: string          // e.g. "pp. 6–7"
  teacherNotes: string               // step-by-step procedure for the teacher
  answerKeys: AnswerKey[]
  audioTrack?: string                // e.g. "Track 1.05"
  listeningScript?: string           // transcript for AI reference
  extraActivity?: string             // extension task for fast finishers
  dataAvailable: boolean             // false = placeholder, needs real TB data
}

export interface TeachersBookLookupResult {
  found: boolean
  section?: TeachersBookSection
  unitSummary?: string               // list of available sections if specific not found
  message?: string
}

// ─── METHODOLOGY (pages 4–15 of Teacher's Book) ───────────────────────────────
// This is injected into the AI system prompt in Focus Mode.
// It tells the AI HOW to teach — not what to teach.

export const TEACHING_METHODOLOGY = `
=== FOCUS 2 TEACHER'S BOOK — TEACHING METHODOLOGY (pp. 4–15) ===

COURSE APPROACH:
Focus 2 uses a Presentation–Practice–Production (PPP) cycle for grammar.
Vocabulary is taught inductively — always in context, never as isolated lists.
Every lesson ties language to a real-world topic to motivate students.
The course targets A2+/B1 learners aged 12–16.

GRAMMAR TEACHING PROCEDURE (follow this order every time):
1. Lead-in: One question that activates background knowledge on the topic.
2. Presentation in context: Students read/listen to a text containing the target grammar. Do NOT explain grammar yet.
3. Guided discovery: Ask observation questions ("What do these verbs have in common?"). Students spot the pattern.
4. Rule formation: Students try to state the rule in their own words. Teacher CONFIRMS and COMPLETES — never states first.
5. Controlled practice: Form-focused exercises (gap-fill, transformation, error correction).
6. Freer practice: Students use the grammar in a meaningful task (their own sentences, role-play, short writing).

VOCABULARY TEACHING PROCEDURE:
1. Pre-teach 3–4 blocking words before a reading/listening text (words without which comprehension fails).
2. Teach vocabulary IN CONTEXT — use the sentence from the text, not a dictionary definition.
3. For each word cover: meaning → form (part of speech, collocations) → pronunciation (mark stress) → activation (student's own sentence).
4. Never ask "Do you know this word?" — use a context gap instead.
5. Collocations are as important as single words. Teach "make a decision", not just "decision".

READING PROCEDURE:
1. Pre-reading: 1–2 questions to activate background knowledge. Predict content from title/pictures.
2. Gist reading: ONE task only ("What is the main idea?" / "Who is this text about?"). Do NOT answer detailed questions on first reading.
3. Detailed reading: Students read again, now answer specific comprehension questions.
4. Post-reading: Connect text to students' own lives. Opinion question or discussion.

LISTENING PROCEDURE:
1. Pre-listening: Show topic vocabulary or pictures. Ask one prediction question.
2. First listening: GIST task only (general topic, speaker's mood, number of speakers).
3. Second listening: Detailed comprehension task.
4. Post-listening: Personalisation or reaction question.
Standard: play audio TWICE. Allow pair comparison after first listening before whole-class check.

ERROR CORRECTION POLICY:
- Fluency tasks (speaking, discussion, free production): DELAYED correction. Note errors silently, address after the activity.
- Accuracy tasks (grammar exercises, controlled practice): Immediate but GENTLE correction.
- NEVER say "Wrong" or "No." Use recasting: repeat the correct form naturally, then ask a follow-up.
- For written work: error codes in margin (G = grammar, V = vocabulary, WO = word order, Sp = spelling).

MIXED ABILITY:
- Fast finishers: Each section has an extra activity. Never give "more of the same."
- Struggling students: Reduce quantity, not quality. Give sentence starters, word banks, or simplify the task.
- If a student cannot state the grammar rule after 3 attempts: give the rule clearly, then practise it heavily.

TIMING:
Each numbered section (1.1, 1.2, etc.) = approx. 45 minutes.
If time runs short: cut the extra activity, never the production stage.
If a student is genuinely stuck: move on, return to the point in the next lesson.

VIDEO ACTIVITIES:
Grammar Animation Videos and Speaking Videos are NOT used in this MVP.
If an exercise references a video, replace it with a text-based equivalent or skip it.

LISTENING ACTIVITIES:
Always use the specified audio track. Do not read the script aloud yourself — let students hear authentic voices.
If audio is unavailable: read the script yourself at a steady pace, then continue as normal.
`.trim()

// Condensed methodology for injection into the AI system prompt (under 200 words).
// The full TEACHING_METHODOLOGY above is for developer reference and documentation.
export const TEACHING_METHODOLOGY_PROMPT = `
=== FOCUS 2 TEACHER'S BOOK — METHODOLOGY RULES ===
You are following the Focus 2 Teacher's Book methodology. Apply these rules:

GRAMMAR: Guided discovery first — never state the rule before the student attempts it.
VOCABULARY: Teach meaning → collocations → student's own sentence. Never isolated lists.
LISTENING: Pre-listen (gist only, 1 task) → second listen (detail) → post-listen (personalise).
  Always reference the specified audio track. Do not skip listening activities.
READING: Pre-read (predict) → gist read (1 question) → detail read → post-read (connect to life).
ERRORS: Use recasting. Never say "Wrong". Delayed correction for fluency tasks, immediate for accuracy tasks.
MIXED ABILITY: Fast finishers get an extension task. Struggling students get sentence starters or reduced quantity.

VIDEO ACTIVITIES: Grammar Animation Videos and speaking videos are NOT used. Skip them. Use text equivalents.
ANSWER KEYS: When an answer key is provided below, use it — do not invent or guess answers.
IF DATA MISSING: If Teacher's Book data for a section is not available, say so clearly and proceed using your knowledge of the grammar target.
`.trim()

// ─── UNIT DATA ────────────────────────────────────────────────────────────────

// Helper: stub section for units without real data yet
function stub(unit: number, sectionId: string, title: string): TeachersBookSection {
  return {
    unit,
    sectionId,
    sectionTitle: title,
    teacherNotes: `[Teacher's Book data for section ${sectionId} not yet entered. Add from the actual Teacher's Book, pp. TBD.]`,
    answerKeys: [],
    dataAvailable: false,
  }
}

const FOCUS_2_TEACHERS_BOOK: Record<number, Record<string, TeachersBookSection>> = {

  // ─── UNIT 1 — Free Time ───────────────────────────────────────────────────
  1: {
    '1.1': {
      unit: 1,
      sectionId: '1.1',
      sectionTitle: 'Vocabulary — Free-time activities',
      studentBookPages: 'pp. 6–7',
      dataAvailable: true,
      teacherNotes: `
LEAD-IN: Ask "What do you do after school?" Give students 1 minute to think, then share in pairs.
Write 3–4 answers on the board.

EX 1 — Match words to pictures (free-time activities):
Students work individually, then check in pairs.
Answer key: see answerKeys below.
Draw attention to the verb patterns: go + -ing (go swimming), play + noun (play football), do + noun (do yoga).

EX 2 — Complete the sentences with the correct verb (go/play/do):
Highlight the three patterns: GO + activity ending in -ing, PLAY + team sports/instruments, DO + individual activities.
Common mistake: "do swimming" / "play yoga" — these are wrong. Correct using examples.

EXTRA ACTIVITY (fast finishers): Ask students to write 3 sentences about their own free time using go/play/do.
      `.trim(),
      answerKeys: [
        {
          exerciseRef: 'Ex 1',
          exerciseType: 'vocabulary',
          isVideoActivity: false,
          isListeningActivity: false,
          answers: [
            'go skateboarding', 'play tennis', 'do yoga', 'go swimming',
            'play chess', 'do martial arts', 'go hiking', 'play the guitar',
          ],
          teacherNote: 'Focus on the three verb patterns: go+-ing, play+sport/instrument, do+activity',
        },
        {
          exerciseRef: 'Ex 2',
          exerciseType: 'grammar',
          isVideoActivity: false,
          isListeningActivity: false,
          answers: ['go', 'play', 'do', 'go', 'play', 'do'],
          teacherNote: 'Common error: "do swimming" — address immediately with the go+-ing rule.',
        },
      ],
    },

    '1.2': {
      unit: 1,
      sectionId: '1.2',
      sectionTitle: 'Grammar 1 — Present Simple',
      studentBookPages: 'pp. 8–9',
      dataAvailable: true,
      teacherNotes: `
PRESENTATION:
Ask students to read the short text (about Jake's free time).
Ask: "What does Jake do every week?" (gist — they'll use Present Simple to answer).
Do NOT explain Present Simple yet.

GUIDED DISCOVERY:
Point to the highlighted verbs: goes, prefers, reads, plays.
Ask: "What do you notice about the verb after he/she?" → Students should notice the -s ending.
Ask: "What about 'I', 'you', 'we', 'they'?" → No -s ending.
Ask: "How do we make a negative?" → doesn't / don't + base verb.

RULE CONFIRMATION:
Only AFTER students attempt the rule — write it on the board and complete it:
  I/you/we/they + base verb | he/she/it + verb+s (or +es)

CONTROLLED PRACTICE:
EX 3 — Fill in the correct form of the verb.
Students work individually, then compare. Full class check.

FREER PRACTICE:
Ask students to write 3 sentences about a friend/family member using Present Simple.
      `.trim(),
      answerKeys: [
        {
          exerciseRef: 'Ex 3',
          exerciseType: 'grammar',
          isVideoActivity: false,
          isListeningActivity: false,
          answers: [
            '1. studies', '2. go', '3. watches', '4. don\'t like', '5. plays', '6. doesn\'t do',
          ],
          teacherNote: 'Watch for "studys" → correct spelling: consonant + y → -ies',
        },
        {
          exerciseRef: 'Ex 4 (Grammar Animation)',
          exerciseType: 'grammar',
          isVideoActivity: true,      // SKIP IN MVP
          isListeningActivity: false,
          answers: [],
          teacherNote: 'VIDEO ACTIVITY — skip in MVP. Replace with: ask students to write 2 sentences about their own routine.',
        },
        {
          exerciseRef: 'Practice Ex A',
          exerciseType: 'grammar',
          isVideoActivity: false,
          isListeningActivity: false,
          answers: [
            '1. She studies English every day.',
            '2. He is studying right now.',
            '3. I am playing tennis at the moment. (not: I play — "at the moment" signals continuous)',
            '4. He knows the answer. (state verb — no -ing)',
          ],
          teacherNote: 'Exercise adapted from Student\'s Book exercise ideas. State verb "know" cannot take -ing form.',
        },
      ],
    },

    '1.3': {
      unit: 1,
      sectionId: '1.3',
      sectionTitle: 'Listening — Talking about hobbies',
      studentBookPages: 'pp. 10–11',
      dataAvailable: true,
      audioTrack: 'Track 1.05',
      teacherNotes: `
PRE-LISTENING:
Show pictures of different hobbies. Ask: "Which of these do you do? Would you like to try any?"
Pre-teach: competitive, challenge, improve, achieve.

FIRST LISTENING (gist):
Play Track 1.05 once.
Task: "How many speakers are there? What is the general topic?"
Let students compare answers in pairs before class check.

SECOND LISTENING (detail):
Play Track 1.05 again.
Task: Complete the table — speaker name, hobby, how long, why they enjoy it.
Students write answers, compare, then class check.

POST-LISTENING:
Ask: "Do you have a hobby that you do for a long time? What makes it special?"
Students discuss in pairs (2 minutes), then share with class.
      `.trim(),
      answerKeys: [
        {
          exerciseRef: 'Ex 1 (Listening gist)',
          exerciseType: 'listening',
          isVideoActivity: false,
          isListeningActivity: true,
          answers: ['3 speakers', 'hobbies and free-time activities'],
          teacherNote: 'Students often write only 1 speaker if they miss the changes in voice. Play again if needed.',
        },
        {
          exerciseRef: 'Ex 2 (Listening detail)',
          exerciseType: 'listening',
          isVideoActivity: false,
          isListeningActivity: true,
          answers: [
            'Speaker 1: [fill from actual TB — audio track 1.05 answer key]',
            'Speaker 2: [fill from actual TB]',
            'Speaker 3: [fill from actual TB]',
          ],
          teacherNote: 'Actual answers require audio Track 1.05. Add from Teacher\'s Book p. T10.',
        },
      ],
      listeningScript: '[Add full transcript from Teacher\'s Book page T10 when available]',
    },

    '1.4': {
      unit: 1,
      sectionId: '1.4',
      sectionTitle: 'Reading — Magazine article about hobbies',
      studentBookPages: 'pp. 12–13',
      dataAvailable: true,
      teacherNotes: `
PRE-READING:
Ask: "Do you read any magazines? What kind?" (1 minute pair discussion)
Pre-teach: passion, dedicated, challenge, commitment.
Ask students to look at the title and photos: "What do you predict the article is about?"

GIST READING:
Students skim the text in 2 minutes.
Task: "What is the writer's main point about hobbies?"
One word/phrase answer expected. Class check.

DETAILED READING:
Students read again carefully.
Task: Answer the comprehension questions (Ex 2).
Students work individually, compare with partner, class check.

POST-READING:
"The writer says hobbies teach you who you are. Do you agree? Talk to your partner."
3-minute discussion, then 2-3 students share with class.
      `.trim(),
      answerKeys: [
        {
          exerciseRef: 'Ex 2 (Reading comprehension)',
          exerciseType: 'reading',
          isVideoActivity: false,
          isListeningActivity: false,
          answers: [
            '[Fill from actual Teacher\'s Book p. T12 — Reading comprehension answer key]',
          ],
          teacherNote: 'Add real answers from TB. The post-reading discussion is open-ended — accept any reasonable opinion with a reason.',
        },
      ],
    },

    '1.5': {
      unit: 1,
      sectionId: '1.5',
      sectionTitle: 'Grammar 2 — Present Continuous and state verbs',
      studentBookPages: 'pp. 14–15',
      dataAvailable: true,
      teacherNotes: `
PRESENTATION:
Return to the reading text from 1.4.
Ask: "Find a sentence that describes something happening RIGHT NOW."
Students should find a Present Continuous sentence.

GUIDED DISCOVERY:
Write two sentences on the board:
  "She reads every evening." (Present Simple)
  "She is reading right now." (Present Continuous)
Ask: "What is the difference?" → habit vs. now
Ask: "What changes in the verb?" → am/is/are + -ing

STATE VERBS:
Write: "I am knowing the answer."
Ask: "Does this sound correct?" → No.
Explain: Some verbs describe STATES (not actions) — they don't use -ing.
List: know, like, love, hate, want, need, prefer, believe, understand, remember.

CONTROLLED PRACTICE:
EX 5 — choose Present Simple or Present Continuous.
EX 6 — find and correct the mistakes (state verbs used incorrectly).

FREER PRACTICE:
"Tell me 3 things you usually do (Present Simple) and 1 thing you are doing this week (Present Continuous)."
      `.trim(),
      answerKeys: [
        {
          exerciseRef: 'Ex 5',
          exerciseType: 'grammar',
          isVideoActivity: false,
          isListeningActivity: false,
          answers: [
            '1. is reading (right now)',
            '2. plays (every weekend)',
            '3. are doing (at the moment)',
            '4. don\'t go (habit + never)',
            '5. is studying (this week)',
            '6. works (every day)',
          ],
          teacherNote: 'Key contrast: time expressions signal which tense. Write them on board.',
        },
        {
          exerciseRef: 'Ex 6 (Error correction)',
          exerciseType: 'grammar',
          isVideoActivity: false,
          isListeningActivity: false,
          answers: [
            '1. He knows → He knows (not: He is knowing) — state verb',
            '2. I am loving → I love — state verb',
            '3. She is understanding → She understands — state verb',
          ],
          teacherNote: 'After correction, ask WHY. Students should identify "state verb" as the reason.',
        },
      ],
      extraActivity: 'Fast finishers: Write a paragraph about their best friend\'s habits and current activities. At least 4 sentences using both tenses.',
    },

    '1.6': stub(1, '1.6', 'Use of English'),
    '1.7': stub(1, '1.7', 'Writing — Informal email'),
    '1.8': stub(1, '1.8', 'Speaking and Communication'),
    '1.9': stub(1, '1.9', 'Exam Speaking'),
  },

  // ─── UNIT 2 — People and the Past ────────────────────────────────────────
  2: {
    '2.1': {
      unit: 2,
      sectionId: '2.1',
      sectionTitle: 'Vocabulary — Biographical language',
      studentBookPages: 'pp. 20–21',
      dataAvailable: true,
      teacherNotes: `
LEAD-IN:
Show a famous person's photo (e.g. Marie Curie, Einstein, Malala).
Ask: "What do you know about this person? Where were they born? What did they achieve?"
Write students' answers on the board — this activates biographical vocabulary naturally.

EX 1 — Match biographical words/phrases to definitions:
Words typically include: be born, grow up, study, graduate, discover, invent, achieve, overcome, inspire.
Students match individually, check in pairs, class check.

EX 2 — Complete sentences about a famous person using the biographical words:
Students fill in the biographical verbs in Past Simple form.
This is also implicit Present → Past Simple review.

LANGUAGE NOTE:
"Born" — "She was born in Warsaw." NOT "She borned in Warsaw" or "She is born."
"Grow up" → "grew up" (irregular).
      `.trim(),
      answerKeys: [
        {
          exerciseRef: 'Ex 1 (Vocabulary matching)',
          exerciseType: 'vocabulary',
          isVideoActivity: false,
          isListeningActivity: false,
          answers: [
            'be born → to come into the world',
            'grow up → to develop from a child to an adult',
            'achieve → to succeed in reaching a goal',
            'overcome → to succeed despite a difficulty',
            'discover → to find something for the first time',
            'invent → to create something completely new',
            'inspire → to make someone feel motivated',
          ],
          teacherNote: 'Distinguish discover vs. invent: discover = find something that exists, invent = create something new.',
        },
        {
          exerciseRef: 'Ex 2 (Biographical sentences)',
          exerciseType: 'grammar',
          isVideoActivity: false,
          isListeningActivity: false,
          answers: [
            '1. was born', '2. grew up', '3. studied', '4. discovered / invented',
            '5. achieved', '6. overcame', '7. inspired',
          ],
          teacherNote: 'Check Past Simple forms: grow → grew (irregular), overcome → overcame (irregular).',
        },
      ],
    },

    '2.2': {
      unit: 2,
      sectionId: '2.2',
      sectionTitle: 'Grammar 1 — Past Simple (regular verbs)',
      studentBookPages: 'pp. 22–23',
      dataAvailable: true,
      teacherNotes: `
PRESENTATION:
Students read the short text about Marie Curie (or similar biography in their book).
Ask: "What did Marie Curie do?" — students answer, naturally using Past Simple verbs.
Do NOT explain Past Simple yet.

GUIDED DISCOVERY:
Write on board (from the text): walked, studied, discovered, moved, worked.
Ask: "What do you notice about these verbs? What ending do they have?" → -ed / -d
Ask: "What is the base form of each?" → walk, study, discover, move, work
Ask: "What happens when a verb ends in -y?" → study → studied (drop y, add -ied)
Ask: "What about 'move'? Does it add -ed or -d?" → just -d

RULE CONFIRMATION (only after students attempt it):
Regular verbs → add -ed (or -d if verb ends in -e).
Special spelling: consonant + y → -ied. Short CVC → double consonant + -ed (stop→stopped).

NEGATIVE AND QUESTION FORMS:
Write: "She didn't study physics." / "Did she study physics?"
Ask: "What is the base form of the verb after 'didn't' and 'did'?" → base form (not -ed).
Common error: "She didn't studied." → Correct: "She didn't study."

CONTROLLED PRACTICE:
EX 3 — Fill in Past Simple form of regular verbs.
EX 4 — Make negative sentences.
EX 5 — Write questions in Past Simple.
      `.trim(),
      answerKeys: [
        {
          exerciseRef: 'Ex 3 (Fill in Past Simple)',
          exerciseType: 'grammar',
          isVideoActivity: false,
          isListeningActivity: false,
          answers: [
            '1. discovered', '2. moved', '3. studied', '4. worked',
            '5. arrived', '6. stopped', '7. carried', '8. walked',
          ],
          teacherNote: 'Watch: "studyed" (wrong) → "studied". "stoped" (wrong) → "stopped" (double consonant).',
        },
        {
          exerciseRef: 'Ex 4 (Negatives)',
          exerciseType: 'grammar',
          isVideoActivity: false,
          isListeningActivity: false,
          answers: [
            '1. She didn\'t study in Warsaw.',
            '2. He didn\'t work at the university.',
            '3. They didn\'t arrive on time.',
            '4. I didn\'t watch the film.',
          ],
          teacherNote: 'Most common error: "She didn\'t studied" — the verb after didn\'t is ALWAYS base form.',
        },
        {
          exerciseRef: 'Ex 5 (Questions)',
          exerciseType: 'grammar',
          isVideoActivity: false,
          isListeningActivity: false,
          answers: [
            '1. Did she study physics?',
            '2. Did they move to Paris?',
            '3. Did you watch the film?',
            '4. Where did she study?',
            '5. When did they arrive?',
          ],
          teacherNote: 'Wh- questions: Wh-word + did + subject + base verb. A very common word order error.',
        },
        {
          exerciseRef: 'Practice (custom)',
          exerciseType: 'grammar',
          isVideoActivity: false,
          isListeningActivity: false,
          answers: [
            'Marie Curie discovered polonium and radium. (not: "discoveried")',
            'She moved to Paris. (not: "She didn\'t moved")',
            'Did she win a Nobel Prize? Yes, she did. (not: "Yes, she won.")',
          ],
          teacherNote: 'These exercises use the Marie Curie reading passage from focus-content. Accept any correct Past Simple sentence.',
        },
      ],
    },

    '2.3': {
      unit: 2,
      sectionId: '2.3',
      sectionTitle: 'Listening — A biography',
      studentBookPages: 'pp. 24–25',
      dataAvailable: true,
      audioTrack: 'Track 2.03',
      teacherNotes: `
PRE-LISTENING:
Show a picture or ask: "Have you heard of [person]? What do you know?"
Pre-teach 3–4 words that block comprehension: [fill from actual TB when available].

FIRST LISTENING:
Play Track 2.03 once. Gist task: "Who is the person? What is the text about?"
Pair comparison, class check.

SECOND LISTENING:
Play Track 2.03 again. Detail task: Put events in chronological order, or fill in dates.
Students compare answers, then class check.

POST-LISTENING:
"Does this person inspire you? Why or why not?" — pair discussion, 2 minutes.
      `.trim(),
      answerKeys: [
        {
          exerciseRef: 'Ex 1 (Listening)',
          exerciseType: 'listening',
          isVideoActivity: false,
          isListeningActivity: true,
          answers: ['[Fill from actual Teacher\'s Book p. T24 — Track 2.03 answers]'],
          teacherNote: 'Track 2.03 answer key needed from actual TB.',
        },
      ],
      listeningScript: '[Add full transcript from Teacher\'s Book p. T24 when available]',
    },

    '2.4': {
      unit: 2,
      sectionId: '2.4',
      sectionTitle: 'Reading — Historical figure',
      studentBookPages: 'pp. 26–27',
      dataAvailable: true,
      teacherNotes: `
PRE-READING:
Title/photo preview: "What do you know about this person? What challenges might they have faced?"
2-minute pair discussion.

GIST READING (2 minutes):
Task: "What is the main achievement described in the text?"

DETAILED READING:
Task: True/False/Not Mentioned, or matching headings to paragraphs (check actual TB).
Students work individually, pair compare, class check.

POST-READING:
"Which sentence in the text do you find most inspiring? Read it aloud and explain why."
Open discussion — accept any justified answer.
      `.trim(),
      answerKeys: [
        {
          exerciseRef: 'Ex 2 (Reading)',
          exerciseType: 'reading',
          isVideoActivity: false,
          isListeningActivity: false,
          answers: ['[Fill from actual Teacher\'s Book p. T26]'],
          teacherNote: 'Add real answer key from TB. Post-reading is open-ended.',
        },
      ],
    },

    '2.5': {
      unit: 2,
      sectionId: '2.5',
      sectionTitle: 'Grammar 2 — Past Simple (irregular verbs)',
      studentBookPages: 'pp. 28–29',
      dataAvailable: true,
      teacherNotes: `
PRESENTATION:
Return to the reading text. Ask: "Find all the past tense verbs."
Students list them. Write on board. Circle those that DON'T end in -ed.
Ask: "Why don't these follow the regular rule?" → irregular verbs.

GROUP DISCOVERY:
Give students the list: go/went, come/came, see/saw, have/had, make/made, take/took,
give/gave, know/knew, win/won, find/found, leave/left, buy/bought.
Ask: "Can you see any patterns?" → Some change vowels (go→went), some change completely.

MEMORY STRATEGY:
Teach in semantic groups: movement verbs, thinking verbs, giving verbs.
Mnemonics help: "I know, I knew. Think of a 'k' in both."

CONTROLLED PRACTICE:
EX 6 — Fill in the irregular Past Simple.
EX 7 — Find the mistake (students use -ed with irregular verbs — overgeneralisation).

ERROR RECOVERY:
When students say "goed" or "taked": do NOT say "Wrong."
Use recasting: "He went — interesting! And 'take' in the past?" → Let them self-correct.
      `.trim(),
      answerKeys: [
        {
          exerciseRef: 'Ex 6 (Irregular verbs)',
          exerciseType: 'grammar',
          isVideoActivity: false,
          isListeningActivity: false,
          answers: [
            '1. went', '2. came', '3. saw', '4. had', '5. made',
            '6. took', '7. gave', '8. knew', '9. won', '10. found',
            '11. left', '12. bought',
          ],
          teacherNote: 'These 12 irregular verbs are the highest-frequency ones at B1. Students must memorise them.',
        },
        {
          exerciseRef: 'Ex 7 (Error correction)',
          exerciseType: 'grammar',
          isVideoActivity: false,
          isListeningActivity: false,
          answers: [
            '1. She finded → She found',
            '2. They goed → They went',
            '3. He taked → He took',
            '4. We buyed → We bought',
            '5. I leaved → I left',
          ],
          teacherNote: 'Overgeneralisation of -ed to irregular verbs is the most common Past Simple error at this level.',
        },
        {
          exerciseRef: 'Reconstruction (custom)',
          exerciseType: 'grammar',
          isVideoActivity: false,
          isListeningActivity: false,
          answers: [
            '[to / she / Paris / moved / later] → She moved to Paris later. / Later, she moved to Paris.',
            '[won / Nobel / she / Prize / a] → She won a Nobel Prize.',
          ],
          teacherNote: 'Accept both word orders for sentence 1 — both are grammatically correct.',
        },
      ],
      extraActivity: 'Fast finishers: Write 5 sentences about what a famous person did using irregular verbs.',
    },

    '2.6': stub(2, '2.6', 'Use of English'),
    '2.7': stub(2, '2.7', 'Writing — Biography'),
    '2.8': stub(2, '2.8', 'Speaking and Communication'),
    '2.9': stub(2, '2.9', 'Exam Speaking'),
  },

  // ─── UNITS 3–8 — Stubs (fill from actual Teacher's Book) ─────────────────
  3: {
    '3.1': stub(3, '3.1', 'Vocabulary — Adjectives to describe people'),
    '3.2': stub(3, '3.2', 'Grammar 1 — Comparative adjectives'),
    '3.3': stub(3, '3.3', 'Listening'),
    '3.4': stub(3, '3.4', 'Reading'),
    '3.5': stub(3, '3.5', 'Grammar 2 — Superlative adjectives'),
    '3.6': stub(3, '3.6', 'Use of English'),
    '3.7': stub(3, '3.7', 'Writing'),
    '3.8': stub(3, '3.8', 'Speaking'),
  },
  4: {
    '4.1': stub(4, '4.1', 'Vocabulary — Places in a city'),
    '4.2': stub(4, '4.2', 'Grammar 1 — There is / There are / some / any'),
    '4.3': stub(4, '4.3', 'Listening'),
    '4.4': stub(4, '4.4', 'Reading'),
    '4.5': stub(4, '4.5', 'Grammar 2 — Much / many / a lot of'),
    '4.6': stub(4, '4.6', 'Use of English'),
    '4.7': stub(4, '4.7', 'Writing'),
    '4.8': stub(4, '4.8', 'Speaking'),
  },
  5: {
    '5.1': stub(5, '5.1', 'Vocabulary — Travel and transport'),
    '5.2': stub(5, '5.2', 'Grammar 1 — Past Continuous'),
    '5.3': stub(5, '5.3', 'Listening'),
    '5.4': stub(5, '5.4', 'Reading'),
    '5.5': stub(5, '5.5', 'Grammar 2 — Past Simple vs. Past Continuous'),
    '5.6': stub(5, '5.6', 'Use of English'),
    '5.7': stub(5, '5.7', 'Writing'),
    '5.8': stub(5, '5.8', 'Speaking'),
  },
  6: {
    '6.1': stub(6, '6.1', 'Vocabulary — Food and cooking'),
    '6.2': stub(6, '6.2', 'Grammar 1 — Countable and uncountable nouns'),
    '6.3': stub(6, '6.3', 'Listening'),
    '6.4': stub(6, '6.4', 'Reading'),
    '6.5': stub(6, '6.5', 'Grammar 2 — Quantifiers'),
    '6.6': stub(6, '6.6', 'Use of English'),
    '6.7': stub(6, '6.7', 'Writing'),
    '6.8': stub(6, '6.8', 'Speaking'),
  },
  7: {
    '7.1': stub(7, '7.1', 'Vocabulary — Technology and gadgets'),
    '7.2': stub(7, '7.2', 'Grammar 1 — Present Perfect'),
    '7.3': stub(7, '7.3', 'Listening'),
    '7.4': stub(7, '7.4', 'Reading'),
    '7.5': stub(7, '7.5', 'Grammar 2 — Present Perfect vs. Past Simple'),
    '7.6': stub(7, '7.6', 'Use of English'),
    '7.7': stub(7, '7.7', 'Writing'),
    '7.8': stub(7, '7.8', 'Speaking'),
  },
  8: {
    '8.1': stub(8, '8.1', 'Vocabulary — People and society'),
    '8.2': stub(8, '8.2', 'Grammar 1 — Future forms (will / going to)'),
    '8.3': stub(8, '8.3', 'Listening'),
    '8.4': stub(8, '8.4', 'Reading'),
    '8.5': stub(8, '8.5', 'Grammar 2 — First Conditional'),
    '8.6': stub(8, '8.6', 'Use of English'),
    '8.7': stub(8, '8.7', 'Writing'),
    '8.8': stub(8, '8.8', 'Speaking'),
  },
}

// ─── LOOKUP FUNCTIONS ─────────────────────────────────────────────────────────

/**
 * Get all sections for a unit, excluding video activities.
 * Returns a summary suitable for injection into the AI prompt.
 */
export function getTeachersBookUnit(unit: number): TeachersBookSection[] {
  const unitData = FOCUS_2_TEACHERS_BOOK[unit]
  if (!unitData) return []
  return Object.values(unitData)
}

/**
 * Get a specific section by unit and sectionId (e.g. unit=1, sectionId="1.2").
 */
export function getTeachersBookSection(
  unit: number,
  sectionId: string,
): TeachersBookLookupResult {
  const unitData = FOCUS_2_TEACHERS_BOOK[unit]
  if (!unitData) {
    return {
      found: false,
      message: `Unit ${unit} is not available in the Teacher's Book database. Available units: ${Object.keys(FOCUS_2_TEACHERS_BOOK).join(', ')}.`,
    }
  }
  const section = unitData[sectionId]
  if (!section) {
    const available = Object.keys(unitData).join(', ')
    return {
      found: false,
      unitSummary: available,
      message: `Section ${sectionId} not found in Unit ${unit}. Available sections: ${available}.`,
    }
  }
  return { found: true, section }
}

/**
 * Build a compact Teacher's Book context string for the AI prompt.
 * In Focus Mode: injects teacher procedure + answer keys for the current lesson.
 * Excludes video activities automatically.
 */
export function buildTeachersBookContext(
  unit: number,
  sectionId: string | undefined,
): string {
  if (sectionId) {
    const result = getTeachersBookSection(unit, sectionId)
    if (!result.found || !result.section) {
      return `=== TEACHER'S BOOK ===\n${result.message ?? 'Section not found.'}`
    }
    return formatSection(result.section)
  }

  // No specific section — list available sections for this unit
  const sections = getTeachersBookUnit(unit)
  if (sections.length === 0) {
    return `=== TEACHER'S BOOK ===\nNo Teacher's Book data available for Unit ${unit} yet.`
  }

  const available = sections
    .map(s => `  ${s.sectionId}: ${s.sectionTitle}${s.dataAvailable ? '' : ' [data pending]'}`)
    .join('\n')

  const populated = sections.filter(s => s.dataAvailable)
  if (populated.length === 0) {
    return `=== TEACHER'S BOOK ===\nUnit ${unit} sections are listed but data is not yet entered:\n${available}`
  }

  // Return the first populated section as default
  return `=== TEACHER'S BOOK ===\nAvailable sections for Unit ${unit}:\n${available}\n\n` +
    `Showing default section (${populated[0].sectionId}):\n` +
    formatSection(populated[0])
}

function formatSection(section: TeachersBookSection): string {
  const parts: string[] = []

  parts.push(
    `=== TEACHER'S BOOK — Unit ${section.unit}, Section ${section.sectionId}: ${section.sectionTitle} ===`,
  )
  if (section.studentBookPages) {
    parts.push(`Student's Book pages: ${section.studentBookPages}`)
  }
  if (!section.dataAvailable) {
    parts.push(`⚠ Teacher's Book data for this section has not been entered yet.`)
    parts.push(`Teacher notes: ${section.teacherNotes}`)
    return parts.join('\n')
  }

  parts.push(`\nTEACHER PROCEDURE:\n${section.teacherNotes}`)

  if (section.audioTrack) {
    parts.push(`\nAUDIO: ${section.audioTrack}`)
    if (section.listeningScript && !section.listeningScript.startsWith('[Add')) {
      parts.push(`LISTENING SCRIPT:\n${section.listeningScript}`)
    }
  }

  const mvpAnswerKeys = section.answerKeys.filter(k => !k.isVideoActivity)
  if (mvpAnswerKeys.length > 0) {
    parts.push('\nANSWER KEY (use these — do not invent):')
    for (const key of mvpAnswerKeys) {
      const tag = key.isListeningActivity ? ' [LISTENING]' : ''
      parts.push(`  ${key.exerciseRef}${tag}:`)
      key.answers.forEach(a => parts.push(`    • ${a}`))
      if (key.alternativeAnswers?.length) {
        parts.push(`    Also accepted: ${key.alternativeAnswers.join(', ')}`)
      }
      if (key.teacherNote) {
        parts.push(`    Note: ${key.teacherNote}`)
      }
    }
  }

  if (section.extraActivity) {
    parts.push(`\nEXTRA ACTIVITY (fast finishers): ${section.extraActivity}`)
  }

  return parts.join('\n')
}

/**
 * Parse a natural language reference like "Unit 3, lesson 3.2" or "3.4" or "section 2.1"
 * Returns { unit, sectionId } or null if not parseable.
 */
export function parseTeachersBookRef(query: string): { unit: number; sectionId: string } | null {
  // Match "X.Y" pattern (e.g. "3.2", "1.4")
  const dotPattern = /\b(\d+)\.(\d+)\b/
  const dotMatch = query.match(dotPattern)
  if (dotMatch) {
    const unit    = parseInt(dotMatch[1], 10)
    const section = dotMatch[0]
    return { unit, sectionId: section }
  }

  // Match "unit X" alone — return unit with no specific section
  const unitPattern = /unit\s*(\d+)/i
  const unitMatch = query.match(unitPattern)
  if (unitMatch) {
    return { unit: parseInt(unitMatch[1], 10), sectionId: '' }
  }

  return null
}
