# AI_TEACHER_RUNTIME_RULES.md

# PURPOSE

This document defines how the AI teacher (Claude) is constrained within the
paid lesson runtime. These rules are enforced through the system prompt in
backend/src/ai/prompt-builder.ts and the orchestrator in
backend/src/lesson/orchestrator.ts.

Read this before modifying any AI prompts or orchestration logic.

--------------------------------------------------
SECTION 1 — RESPONSE FORMAT CONTRACT
--------------------------------------------------

# RULE 1 — AI Must Return Strict JSON

Every Claude response must be valid JSON with this exact shape:

```json
{
  "speech": "what you say aloud (short, max 2-3 sentences per turn)",
  "display_text": "formatted for screen — may use **bold**, rule cards, exercise items",
  "next_action": "continue_phase | transition_to:PHASE | student_confirmed_reading | rule_stated_correctly | summary_delivered | overview_shown | end_lesson",
  "exercise": null | { ... exercise object ... },
  "internal_note": "teaching log (not spoken)"
}
```

If Claude returns malformed JSON, `parseSafe()` in claude-handler.ts returns null
and the `fallback()` response is used: "I'm thinking... could you repeat that?"

# RULE 2 — speech vs display_text Are Different

- `speech` = what TTS reads aloud — keep SHORT (1-3 sentences, one exercise item only)
- `display_text` = what appears in chat and exercise cards — may be longer, formatted

The AI must NEVER read a full exercise list aloud.
It says the instruction and first item in speech.
The full exercise appears in display_text.

# RULE 3 — Max Tokens = 400 Per Turn

Claude API is called with `max_tokens: 400`.
This is a hard limit defined in backend/src/ai/claude-handler.ts.
Do NOT increase this. It controls cost AND prevents rambling.

--------------------------------------------------
SECTION 2 — PHASE BEHAVIOR RULES
--------------------------------------------------

# RULE 4 — Phase Transitions Are Forward-Only

The AI can signal a phase transition using `next_action: "transition_to:PHASE"`.
The `applyAISignal()` function in transitions.ts blocks backward transitions.

Current phase order:
DIAGNOSTIC → CONTEXT_INPUT → RULE_DISCOVERY → EXERCISES → VOCABULARY → DEEP_THINKING → WRAP_UP → END

Phase 2 will replace this with a structured state machine.
Until then, this order is fixed.

# RULE 5 — DIAGNOSTIC Phase Rules

- Ask 2 warm-up questions about the section topic
- Do NOT teach grammar yet
- After the student responds once → signal `transition_to:CONTEXT_INPUT`
- Rule-based fallback: after 2 exchanges, transition is forced

# RULE 6 — CONTEXT_INPUT Phase Rules (Focus Mode)

For Grammar sections:
1. Show the grammar overview card ONCE (`display_text` only, not speech)
2. Signal `overview_shown`
3. On next student message — detect readiness vs confusion
4. If ready → "Good. Exercise 1." + first exercise item + `transition_to:EXERCISES`
5. Never re-show the card

For Vocabulary/Listening/Reading sections:
- Skip rule discovery entirely
- `transition_to:EXERCISES` immediately after section intro

# RULE 7 — EXERCISES Phase Rules

- Present exercises from Student Book OCR text — never invent
- ONE item per turn — never stack questions
- Use CORRECTION LADDER (A → B → C → D) for wrong answers
- Never jump to TURN D without completing A, B, C
- MANDATORY COMPLETION ANNOUNCEMENT when exercise ends
- After 6+ exercises → `transition_to:VOCABULARY`
- `currentExerciseNum` in LessonState tracks which exercise is active

# RULE 8 — Anti-Rambling Rules

The AI must NEVER:
- Send more than 3 sentences in `speech`
- Repeat itself across turns
- Re-show an overview card that was already shown
- Give unsolicited hints before the student attempts
- Ask "Are you ready?" more than once per exercise

If same explanation fails twice → change approach entirely.

# RULE 9 — Teacher Personas

Alex: warm but demanding, Socratic, pushes for reasoning
Emma: warm and encouraging, patient, celebrates effort while maintaining rigor

Both teachers:
- Follow the same teaching protocol (ALEX_TEACHING_PROTOCOL applies to both)
- Use the same phase sequence
- Are grounded in the same textbook content
- Cannot override exercise or phase behavior

Teacher is set in `LessonState.teacherId` ('alex' | 'emma').
Teacher name is passed to Claude via `buildSystemPrompt()` context.

--------------------------------------------------
SECTION 3 — CONTENT RULES
--------------------------------------------------

# RULE 10 — No Invented Textbook Content

In Focus mode, all exercises must come from the Student Book OCR text.
If an exercise cannot be found: "I can't locate Exercise N in the text. Let's skip to the next."

The AI must NOT invent exercises pretending to be from Focus 2.

# RULE 11 — Absolute Content Lock

In Focus mode, the AI is constrained to the section topic only.
The system prompt includes an ABSOLUTE CONTENT LOCK block that forbids:
- Everest/Hillary content (unless section is about it)
- Past Simple (unless it IS the grammar focus)
- Any topic not in the Student Book OCR for this section

# RULE 12 — Translate Mode

When student asks for translation (any language):
- Give: word + Russian translation
- Pronounce: phonetic with stressed syllable in CAPS
- Example: one sentence from today's section topic
- Return to the SAME exercise item (do NOT restart from beginning)

# RULE 13 — Confusion Protocol (STUDENT_CONFUSED)

When frontend sends `student_confused` event (student clicks "I don't understand"):
- AI presents a MINI TEACHING CARD in `display_text`
- Card format: Rule / Form / Example 1 / Example 2 / Common mistake / Try this
- Set `exercise: null` during confusion response
- After student fills the Try this gap → return to the exercise

--------------------------------------------------
SECTION 4 — HISTORY AND CONTEXT RULES
--------------------------------------------------

# RULE 14 — Rolling Conversation History

Claude receives the last 8 exchanges (16 messages) via Redis lesson context key.
`trimHistory()` in prompt-builder.ts enforces this.
History is stored per lesson, not per session (survives reconnects within same lesson).

# RULE 15 — RAG Context Injection

`queryRAG()` fetches top-3 Pinecone chunks for the grammar target + lesson topic.
RAG context is injected into the system prompt.
RAG context max: 800 tokens (enforced by Pinecone query limit, not code limit).

In Focus mode, RAG is used alongside Student Book OCR.
Student Book OCR takes precedence over RAG for exercise content.
