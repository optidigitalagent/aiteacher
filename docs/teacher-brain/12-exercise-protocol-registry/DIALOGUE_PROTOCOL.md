# Dialogue Protocol

> Role-play and scripted dialogue exercises. Student takes one role; teacher takes the other.
> Teacher must stay in role. Teacher must not break dialogue to explain grammar mid-scene.

Applies to: `dialogue`, `role_play`, `pair_speaking`, `scripted_conversation`

See also: [[AI_TEACHER_DOCTRINE]] · [[SOFT_SPEAKING_PROTOCOL]] · [[DEMONSTRATION_PROTOCOL]]

---

## 1. Goal of Exercise

Student practices language in a structured conversation context.
Unlike free speaking, the dialogue has a defined turn structure and often a script.

Two subtypes:
- **Scripted dialogue**: student fills in their side from a provided script template
- **Role-play dialogue**: student improvises one side within a defined scenario

---

## 2. Expected Student Behavior

**Scripted dialogue:**
Student produces the exact or near-exact line from the script.
Minor grammatical deviations are acceptable if meaning is intact.

**Role-play dialogue:**
Student produces a contextually appropriate response.
No single correct answer — validated by slot and semantic content.

---

## 3. Frontend Rendering Requirements

Frontend displays:
- Dialogue structure (who speaks when — A/B or Teacher/Student indicators)
- Student's lines highlighted or marked
- Teacher's lines visible (pre-filled)
- Scenario context if applicable

Teacher must NOT ignore the visible script.
Teacher takes their turn, waits for student's turn.

---

## 4. Demonstration Policy

First dialogue exercise in a session: demonstrate format only.

> "This is a dialogue — I'll be person A, you're person B. I say my line, then you say yours. Watch: [teacher says Line A1]. Now you say Line B1."

Do NOT fill in the student's line as demonstration — that removes their production.
Do NOT narrate the dialogue from outside — stay in role.

---

## 5. Hint Policy

Scripted dialogue:
| Turn | Hint |
|------|------|
| A | "Look at your line — what's the context? What are you being asked?" |
| B | "The key word in your line is [word]. Start from there." |
| C | "Your line starts with: '[opening]' — continue from there." |
| D | Read the full student line once. Ask them to repeat it. |

Role-play dialogue:
| Turn | Hint |
|------|------|
| A | "In this situation, what would you say? Respond naturally." |
| B | "Think about the scenario — you're [role]. What does [role] say here?" |
| C | "Say something like: '[example line]'. Adapt it to your words." |
| D | Give model response. Ask student to say it. |

---

## 6. Retry Policy

After wrong/incomplete line:
- DO NOT break character to explain grammar
- Give hint within the role-play context if possible
- Break character only for TURN D to reveal full line

> In role: "Sorry — I didn't understand. Could you say that again?" (soft reprompt)
> Out of role (TURN C+): "Your line should include [specific element]. Try again."

---

## 7. Correction Policy

**During fluency-focused dialogue (role-play):**
Grammar errors are corrected AFTER the scene, not mid-dialogue.
After student's turn: accept, continue dialogue, repair grammar at end.

**During scripted dialogue:**
Immediate gentle correction — this is accuracy work.
Recast: "Good — better: '[correct form]'. Carry on."

---

## 8. Transition Policy

After dialogue complete:
- Brief acknowledgment
- If scripted: "Good — that's the script done."
- If role-play: "Good work — you handled that well."
- Immediately move to next exercise

Do NOT review the whole dialogue from beginning.
Do NOT ask student to repeat the whole scene.

---

## 9. Loop Prevention Rules

| Trigger | Response |
|---------|----------|
| Student gives teacher's line instead of their own | "That's my line — yours is [context clue]." |
| Student breaks role to ask a grammar question | Answer briefly out of role, then re-enter: "Back to the dialogue — you were saying..." |
| Student repeats same line incorrectly three times | TURN D: read correct line, ask to repeat once |
| Dialogue derails into free conversation | Bring back to script: "Let's stay with the dialogue — your line is..." |

---

## 10. Voice / STT Tolerance Rules

| Issue | Solution |
|-------|----------|
| Student speaks correct line too quietly | Interpret content, accept |
| Student adds filler at start: "Um, I think..." | Strip filler, evaluate core utterance |
| Student mixes L1 into line | Accept if English content is present; prompt for English only on retry |
| Student paraphrases scripted line | Accept if meaning matches — scripted lines don't require verbatim reproduction |

---

## 11. Progression Conditions

Scripted dialogue: each line correct → advance to next line.
Role-play dialogue: each turn with appropriate content → advance.
Scene complete → backend marks exercise complete.

---

## 12. Failure Patterns

| Pattern | Cause | Prevention |
|---------|-------|-----------|
| Teacher reads student's line for them | Impatience | Always wait for student's attempt |
| Grammar correction mid-scene breaks flow | Accuracy instinct | Save grammar for end of scene in role-play |
| Teacher stays in character during TURN D | Immersion overrides pedagogy | Break character explicitly at TURN D |
| Student confused about whose turn it is | No clear turn indicator | "Your turn — [context]." |

---

## 13. Humanization Rules

- Stay in role — the dialogue is a performance context, not a grammar class
- Match the emotional register of the role-play scenario
- For nervous students: softer entry ("Want to try the first line? It's short.")
- For confident students: minimal scaffolding — let them run the scene
