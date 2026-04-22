# Pedagogy Sources — What the AI Teacher is Built On

> This document explains the research, frameworks, and resources
> that form the pedagogical foundation of this AI teacher.
> 
> For RAG ingestion: prioritise the PRIMARY SOURCES below.
> Load these into Pinecone under namespace: "pedagogy"

---

## CORE PEDAGOGICAL FRAMEWORKS

### 1. Communicative Language Teaching (CLT)
**What it is:** The gold standard of modern ELT since the 1970s.
Language is learned by USING it in real communication, not by memorising rules.
The teacher is a facilitator, not a lecturer.

**How our AI uses it:**
- Role-play, discussion, opinion sharing — all Phase 6 (DEEP_THINKING)
- Real-world texts (Everest, NASA) instead of invented dialogues
- Grammar taught through context, not in isolation

**Primary source:**
- Diane Larsen-Freeman, *Techniques and Principles in Language Teaching*
  (Oxford University Press, 3rd ed.) — THE foundational textbook
  URL: https://global.oup.com/academic/product/techniques-and-principles-in-language-teaching-9780194422130
- American English State Dept. Teacher Handbook (FREE PDF):
  https://americanenglish.state.gov/files/ae/resource_files/language_teaching_methods_teachers_handbook.pdf

---

### 2. Task-Based Language Teaching (TBLT)
**What it is:** Students complete meaningful real-world tasks using the language.
Language accuracy emerges from task completion, not the reverse.

**How our AI uses it:**
- Exercise Type 4 (Free Production) is always task-based
- "Describe what Hillary did" is a task, not a drill
- Phase 6 discussion questions are real communicative tasks

**Primary source:**
- Rod Ellis, *Task-based Language Learning and Teaching*
  URL: https://global.oup.com/academic/product/task-based-language-learning-and-teaching-9780194259743
- OnTESOL ESL Frameworks explanation (free):
  https://ontesol.com/esl-lesson-planning-frameworks/

---

### 3. Krashen's Input Hypothesis (i+1)
**What it is:** Language is acquired when the learner understands input
that is slightly beyond their current level. Not too easy, not too hard.

**How our AI uses it:**
- Pitches all language at i+1 (one level above student)
- B1 student → AI speaks at B1/B2 boundary
- Comprehensible input is the default mode

**Primary source:**
- Stephen Krashen, *Principles and Practice in Second Language Acquisition* (FREE):
  http://www.sdkrashen.com/content/books/principles_and_practice.pdf

---

### 4. Socratic Method in Language Teaching
**What it is:** Teacher never gives the answer. Asks questions until
the student arrives at the answer themselves. Develops independent thinking.

**How our AI uses it:**
- ENTIRE Phase 3 (RULE_DISCOVERY) is Socratic
- AI is forbidden from stating a rule before the student attempts it
- Leading questions: "What do you notice? What do they have in common?"

**Primary source:**
- Paul Nation & Jonathan Newton, *Teaching ESL/EFL Listening and Speaking*
  URL: https://www.routledge.com/Teaching-ESL-EFL-Listening-and-Speaking/Nation-Newton/p/book/9780415989886

---

### 5. Spaced Repetition (SRS)
**What it is:** Review material at increasing time intervals.
Maximises long-term retention with minimum effort (the 80/20 of vocabulary).

**How our AI uses it:**
- Vocabulary items stored with `next_review` timestamp
- Each lesson opens with a 2-minute review of 3 words from previous lessons
- Mastery score increases → review interval increases

**Primary source:**
- Piotr Wozniak, original SM-2 algorithm (free):
  https://www.supermemo.com/en/blog/application-of-a-computer-to-improve-the-results-of-the-sm-2-algorithm
- Research summary: https://www.gwern.net/Spaced-repetition

---

### 6. PPP Framework (Presentation–Practice–Production)
**What it is:** The most structured CLT framework.
Introduces language → controlled practice → free use.

**How our AI uses it:**
- CONTEXT_INPUT = Presentation
- RULE_DISCOVERY + Type 1&2 exercises = Practice  
- Free Production + DEEP_THINKING = Production

**Primary source:**
- MyEnglishPages.com ESL Frameworks guide (free):
  https://www.myenglishpages.com/esl-lesson-planning-frameworks/
- ESLSpeaking.org methodology overview:
  https://eslspeaking.org/approaches-methods-language-teaching/

---

### 7. Scaffolding (Vygotsky's ZPD)
**What it is:** Zone of Proximal Development. Students can do more
WITH guidance than alone. Teacher provides temporary support (scaffolds)
that is removed as competence grows.

**How our AI uses it:**
- 3-level scaffold system (Hint → Partial → Model)
- Scaffolds removed as student demonstrates mastery
- Difficulty adapts down when errors detected

**Primary source:**
- Vygotsky, *Mind in Society* (foundational)
- Practical guide: https://www.colorincolorado.org/article/supporting-ell-instruction-ai-ideas-educators

---

## TEXTBOOKS FOR RAG INGESTION

These should be chunked and loaded into Pinecone namespace "textbooks":

### Focus Textbook Series (PRIMARY — what students use)
- Focus B1 (Student Book + Workbook)
- Focus B1+ 
- Focus A2+
Publisher: Pearson Education
Note: You will need legitimate PDF copies. Chunk by:
  - Grammar explanation sections
  - Vocabulary lists per unit
  - Reading texts
  - Exercise instructions (for reference only)

### Supplementary Grammar References
- **English Grammar in Use** (Raymond Murphy, Cambridge)
  The single most used grammar reference for B1-B2 learners.
  URL: https://www.cambridge.org/gb/cambridgeenglish/catalog/grammar-vocabulary-and-pronunciation/english-grammar-in-use-5th-edition
  
- **Oxford Guide to English Grammar** (Eastwood)
  More advanced, great for AI to explain edge cases.
  URL: https://elt.oup.com/catalogue/items/global/grammar/oxford_guide_to_english_grammar/

---

## VIDEO RESOURCES (for Listening Comprehension lessons)

The AI uses these as listening input for Phase 2 (CONTEXT_INPUT).
Student watches/listens → AI asks comprehension questions.

### Level B1 — appropriate for 12-17 year olds

**BBC Learning English** (FREE, transcripts available)
- 6-Minute English: https://www.bbc.co.uk/learningenglish/english/features/6-minute-english
- The English We Speak: https://www.bbc.co.uk/learningenglish/english/features/the-english-we-speak
- Best for: natural speech, UK English, real topics

**VOA Learning English** (FREE, transcripts + slow audio)
- https://learningenglish.voanews.com/
- Best for: news, science, history topics that connect to lesson themes

**TED-Ed** (FREE, subtitles, lesson materials)
- https://ed.ted.com/
- Best for: intellectual topics (science, philosophy, history)
- Pre-made questions available — can inspire AI-generated questions

**YouTube Channels for Real-World Context Topics:**
- Kurzgesagt: https://www.youtube.com/@kurzgesagt (science, clear English, B1-B2)
- Real Engineering: https://www.youtube.com/@RealEngineering (B2, great for older teens)
- Oversimplified: https://www.youtube.com/@Oversimplified (history, very engaging)

---

## REAL-WORLD TOPICS LIBRARY

These are the contextual "hooks" for lessons (not entertainment — serious content):

| Grammar Target | Real-World Topic | Source |
|---|---|---|
| Past Simple | Edmund Hillary / Everest 1953 | National Geographic |
| Past Simple | Apollo 11 Moon Landing 1969 | NASA.gov |
| Past Continuous | Titanic sinking, April 1912 | History.com |
| Present Perfect | Climate change since 1900 | BBC Science |
| Future (will/going to) | Mars colonisation plans | SpaceX / NASA |
| Comparatives | Greatest athletes of all time | BBC Sport |
| Modals (should/must) | Medical ethics dilemmas | The Guardian |
| Passive Voice | How smartphones are made | TED-Ed |
| Conditionals | What if Einstein had failed school? | Big Think |
| Reported Speech | Famous historical speeches | History.com |

When AI needs a text for Phase 2 (CONTEXT_INPUT):
1. Query Pinecone for textbook content on this unit
2. Supplement with 2-3 real facts from the topic above
3. Weave them into a 80-120 word paragraph
4. Ensure grammar target appears naturally 4-6 times

---

## RESEARCH ON AI IN LANGUAGE TEACHING

For developers/team — understanding limitations and best practices:

1. Crompton, H. (2024). AI and English language teaching: Affordances and challenges.
   *British Journal of Educational Technology*
   URL: https://bera-journals.onlinelibrary.wiley.com/doi/full/10.1111/bjet.13460

2. Systematic review of AI chatbots in L2 education (2025):
   URL: https://www.sciencedirect.com/science/article/pii/S2215039025000086
   Key finding: Chatbots work best for grammar correction + vocabulary.
   Weakest at: emotional nuance, complex discourse feedback.
   Implication: Our AI must compensate with warm, human-like scaffolding language.

3. TeacherThinkAloud — Top 7 ELT Methods:
   URL: https://www.teacherthinkaloud.com/post/top-7-teaching-methods-for-english-language-teachers
   Great practical overview of CLT, Lexical Approach, PBL.

4. TEFL Institute — ESL Methodologies 2026:
   URL: https://teflinstitute.com/blog/esl-teaching-methodologies-proven-strategies/
   Key principle: Hybrid approaches outperform single-method instruction.

---

## WHAT NOT TO DO (based on research failures)

1. **Don't over-correct** — constant correction kills willingness to speak.
   Research: students who fear mistakes produce less language.
   Solution: recasting (built into our master prompt).

2. **Don't use isolated grammar drills** without communicative context.
   Research: grammar memorised without context is forgotten in weeks.
   Solution: every exercise uses lesson topic vocabulary.

3. **Don't give grades/scores** to young learners after every answer.
   Research: external evaluation reduces intrinsic motivation.
   Solution: feedback on process ("I love how you applied the rule") not scores.

4. **Don't ignore the affective filter** (Krashen).
   Anxious students learn less. If student is frustrated → lower difficulty immediately.
   Solution: difficulty adapter + warm scaffolding language.

5. **Don't let AI go off-topic**.
   Research: unfocused chatbot interactions produce low language gains.
   Source: Colorin Colorado / EdWeek research 2024.
   Solution: hard redirect rule in master prompt.
