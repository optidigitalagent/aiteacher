# Exercise Render Contract

> Per-exercise-type rendering specifications.
> Defines exactly what the frontend displays and what the teacher can reference.

See also: [[FRONTEND_SYNC_DOCTRINE]] · [[TEACHER_CURSOR_SYNC]] · [[MULTIPLE_CHOICE_PROTOCOL]] · [[GRAMMAR_FILL_PROTOCOL]]

---

## Contract Format

For each exercise type, the contract defines:
- What frontend renders
- What teacher CAN reference
- What teacher CANNOT reference (already visible or not yet visible)
- Teacher intro sentence format
- Teacher hint reference format

---

## Grammar Fill / Gap-Fill

**Frontend renders:**
- Sentence with blank: `"She ___ to school every day."`
- Exercise number
- Item counter (e.g., "3 of 8")

**Teacher CAN reference:**
- The blank: "Fill in the blank in sentence 1."
- The context words: "Look at the words around the blank."
- Subject noun: "What's the subject — 'she' — so what ending does the verb need?"

**Teacher CANNOT reference:**
- The correct answer (before TURN D)
- Other items' blanks
- The exercise title/instructions text (visible on screen)

**Teacher intro format:**
> "[Exercise N] — fill in each blank with one word. First: 'She ___ to school every day.'"

**Teacher hint reference:**
> "Look at the blank — think about the subject."

---

## Multiple Choice

**Frontend renders:**
- Question sentence
- Options A, B, C (and optionally D) as labeled choices

**Teacher CAN reference:**
- "Look at option B."
- "Think about options A and C."
- "The options are on screen."

**Teacher CANNOT reference:**
- The content of options aloud (they are visible)
- A fourth option that doesn't exist
- Correct option before TURN D

**Teacher intro format:**
> "[Exercise N] — choose A, B, or C on screen. Look at question 1."

**Teacher hint reference:**
> "Think about option B — does it match the subject?" (not "option B says 'goes'" — already visible)

---

## Matching

**Frontend renders:**
- Left column: items 1, 2, 3...
- Right column: options A, B, C... or definition text
- Locked (matched) pairs grayed out or highlighted

**Teacher CAN reference:**
- "Match the word in column A..."
- "Look at the remaining unmatched words."
- "[Word] on the left — which definition on the right?"

**Teacher CANNOT reference:**
- Already-locked matched pairs (visible as locked)
- All remaining options (visible on screen)

**Teacher intro format:**
> "[Exercise N] — match each word on the left to its definition on the right. Start with the first word."

**Teacher hint reference:**
> "[Word] — think about its meaning. Not about movement..."

---

## Reading Comprehension

**Frontend renders:**
- Full reading text (always visible)
- Comprehension questions (visible during detail pass)
- Gist question if separate

**Teacher CAN reference:**
- "Look at paragraph [N]."
- "Find the sentence with the word [X]."
- "The text talks about [topic] — what does it say about [specific point]?"

**Teacher CANNOT reference:**
- Summary of text (it's all visible — student reads it directly)
- Specific quotes (student can find them — teacher directing is micromanagement)

**Teacher intro format:**
> "[Exercise N] — read the text and answer: what is the main topic?" (gist pass)
> "Now read again — answer question 1." (detail pass)

---

## Soft Speaking / Discussion

**Frontend renders:**
- Exercise instruction text
- Possibly a prompt or scenario card

**Teacher CAN reference:**
- "Look at the instruction — it asks you to..."
- The instruction topic

**Teacher CANNOT reference:**
- The student's answer before they give it
- Other students' answers

**Teacher intro format:**
> "[Exercise N] — [instruction summary]. For example: [one example answer]. Now you try."

---

## Subject/Object Question Formation

**Frontend renders:**
- Source sentence
- Blank question frame: "Who ___?" or "What ___?"

**Teacher CAN reference:**
- "Look at the sentence below."
- "The question frame starts with [Who/What]."
- "The underlined word in the sentence — that's what the question is asking about."

**Teacher CANNOT reference:**
- The answer question structure
- The distinction between subject/object question before TURN A

**Teacher intro format:**
> "[Exercise N] — form a question from each sentence. Look at what's underlined — that tells you what to ask about."

---

## Dialogue / Role-Play

**Frontend renders:**
- Dialogue script (both sides visible)
- Student's lines highlighted
- Teacher's lines pre-filled

**Teacher CAN reference:**
- "Look at your line — line B."
- "Your line follows mine — I've just said [A1]."
- "The context for your line is [scenario context]."

**Teacher CANNOT reference:**
- Student's line content before student has attempted it (no spoiling)

**Teacher intro format:**
> "[Exercise N] — dialogue. I'm Person A, you're Person B. I'll say my line, you say yours. Ready?"

---

## Render State Verification Rule

Before starting each new exercise, the teacher's context must include:
- Exercise type (from Engine)
- Item count (from Engine)
- First item text (from Engine manifest)

If ANY of these is missing from context: Teacher must not guess.
Use neutral placeholder:
> "Let me see the exercise — one moment." [Wait for backend to provide context]

Do NOT invent exercise content from prior knowledge or text descriptions.
