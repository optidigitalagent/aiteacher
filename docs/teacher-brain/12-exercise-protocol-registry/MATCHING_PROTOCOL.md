# Matching Protocol

> Matching exercises link two sets: words↔definitions, phrases↔meanings, sentence halves.
> Correctness is deterministic. Progression is item-by-item, not all-at-once.

Applies to: `matching`, `match_words`, `match_definitions`, `sentence_matching`

See also: [[AI_TEACHER_DOCTRINE]] · [[MULTIPLE_CHOICE_PROTOCOL]] · [[FRONTEND_SYNC_DOCTRINE]]

---

## 1. Goal of Exercise

Student connects items from column A to items in column B.

Common matching types:
- Word → Definition (vocabulary exercises)
- Sentence half → Sentence half (grammar exercises)
- Word → Picture label (beginner vocabulary)
- Phrase → Translation concept (vocabulary)

Each pair has exactly ONE correct match.

---

## 2. Expected Student Behavior

Student can answer as:
- "A matches 3" / "1 goes with B"
- "be born means to come into the world"
- "[reads the matched phrase pair]"

In voice mode: student states the match pair verbally.
In text mode: student selects or types the match.

---

## 3. Frontend Rendering Requirements

Frontend displays:
- Left column (items 1, 2, 3...) and right column (items A, B, C... OR full option text)
- Matched pairs highlighted/connected once submitted
- Current unmatched items visible

Teacher must NOT read both columns aloud — they are on screen.
Teacher may reference "the left column" and "the right column" to orient the student.

---

## 4. Demonstration Policy

On first matching exercise encounter: demonstrate the PROCESS, not a specific pair.

> "Exercise 1 — matching. You'll see two columns. Connect each word on the left to its definition on the right. For example — if the word is 'inspire' and the definition is 'make someone feel motivated', you say 'inspire matches motivate'. Now try the first pair."

Do NOT demonstrate by matching actual item 1 — that removes the student's attempt.

---

## 5. Hint Policy

Matching exercises are vocabulary-focused. Hints target meaning, not form.

| Turn | Hint |
|------|------|
| A | Context clue: "Think about where you'd see this word — in a sentence about achievements or failures?" |
| B | Eliminate clearly wrong options: "It's not about movement or time — it's about creation." |
| C | Synonym hint: "Another word for this is 'create from scratch'." |
| D | Reveal: "It's 'invent' — to create something completely new. Find that on the right." |

---

## 6. Retry Policy

Wrong match → one targeted hint.
Do NOT list all remaining unmatched options.
Do NOT explain all wrong options.

Target the MEANING of the item being matched.

If student confuses two similar words (e.g., "discover" vs "invent"):
> "There's a difference: discover = find something that already exists; invent = create something new. Which one fits here?"

---

## 7. Correction Policy

After wrong match:
- State what specifically is wrong about the student's match
- Do NOT reveal correct match until TURN D
- Target semantic distinction specifically

After correct match:
- Brief confirmation
- Move to next unmatched pair

---

## 8. Transition Policy

After all pairs matched:
- Brief completion acknowledgment
- No review of all pairs
- Immediately introduce next exercise

If student asks to review: decline gently.
> "We got them all — good work. Let's move to Exercise 2."

---

## 9. Loop Prevention Rules

| Trigger | Response |
|---------|----------|
| Student cycles through wrong matches | At TURN D: reveal correct match explicitly |
| Student confused about which column to reference | "Look at column A — the words. Column B — the definitions. Match word to definition." |
| Student asks "which ones are left?" | "Look at the unmatched items on screen." — don't enumerate verbally |
| Student guesses randomly | Apply TURN B: eliminate obviously wrong option |

---

## 10. Voice / STT Tolerance Rules

| STT issue | Solution |
|-----------|----------|
| Student reads definition aloud | Match to closest definition text — accept |
| Student says number instead of letter | Map correctly: "3" → item 3 in left column |
| Student says "the one about..." | Extract key semantic word and match |
| Student mispronounces vocabulary word | Detect phonetic proximity — if meaning clear, accept |

---

## 11. Progression Conditions

Item-level progression (within exercise):
- Correct match confirmed → that pair locked, next pair presented

Exercise completion:
- All pairs matched correctly → backend marks exercise complete

---

## 12. Failure Patterns

| Pattern | Cause | Prevention |
|---------|-------|-----------|
| Student tries to match all pairs at once | No item-by-item instruction | "One at a time — start with the first word." |
| Confuses discover/invent type pairs | Similar meanings not distinguished | In hint: always state the CONTRAST, not just the definition |
| Student reads whole definition as answer | Doesn't know which column to match FROM | Clarify direction: "word → definition" |

---

## 13. Humanization Rules

Matching vocabulary is cognitively low-stress for students.
Keep pace brisk — don't slow down for easy pairs.
For harder semantic distinctions (discover/invent, achieve/overcome), acknowledge the difficulty:
> "This one's subtle — 'overcome' and 'achieve' are similar. The key difference is..."
