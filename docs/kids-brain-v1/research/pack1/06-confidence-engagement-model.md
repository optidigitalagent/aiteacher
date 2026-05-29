# Mentium Kids — Confidence & Engagement Model

## Classification: [A/B] Grounded in child SLA and educational psychology

---

## 1. Core Principle: Confidence ≠ Correctness

This is the most important conceptual distinction in the entire system.

A child can be:
- **Correct but not confident** (hesitant correct answer, whispered, long latency)
- **Incorrect but confident** (fast wrong answer, guessing under pressure)
- **Confident in L1** (answered in Ukrainian/Russian immediately — high comprehension confidence, zero English production confidence)
- **Silent but comprehending** (processing; not confused; not refusing)

The system must track **confidence as a separate dimension from correctness**. Treating them as the same thing causes the worst pedagogical errors: praising fast guesses as mastery, or penalizing slow correct answers as failure.

[A] This distinction is foundational in SLA (Second Language Acquisition) theory.

---

## 2. Engagement ≠ Excitement

A child can be:
- **Highly engaged and quiet** (deeply focused, thinking carefully)
- **Highly excited but disengaged** (overexcited, laughing, off-task)
- **Low-energy but present** (tired but still trying)
- **Apparently active but avoiding** (saying words quickly to get through)

Engagement is best understood as **cognitive and attentional orientation toward the task**, not surface energy level.

Measurable proxies (what we can actually detect):
- Turn-taking latency in normal range (not too fast, not too long)
- Attempts at task-relevant responses
- Absence of avoidance patterns
- Decrease in refusal and L1 use over session

What we cannot reliably detect without video/prosody:
- Genuine understanding vs. performance
- Joy vs. compliance
- Real confusion vs. inattention

[B] Engagement proxies are inferred; they require session-level validation.

---

## 3. Silence Is Not Always Failure

Silence in child language learning can mean:
1. **Processing time** — child is thinking; normal and healthy [A]
2. **Phonological preparation** — preparing to say an unfamiliar word
3. **Comprehension gap** — did not understand the prompt
4. **Microphone issue** — technical failure
5. **External distraction** — parent, sibling, environment
6. **Avoidance** — doesn't want to answer
7. **Emotional withdrawal** — upset or overwhelmed

The system must treat silence as **ambiguous by default**, never as failure. The correct response to silence is scaffolding, not correction.

The only exception: silence following a clear emotional shutdown signal (previous refusal, frustration_risk >= 0.70) shifts toward emotional_shutdown classification — but this requires state evidence, not just the silence itself.

**Implementation rule**: Silence classification is purely time-based. The emotional label (emotional_shutdown) requires convergent evidence from the state model.

[A] Krashen's Input Hypothesis and the "Silent Period" are well-established in language acquisition.

---

## 4. Wrong Answers Can Be Productive

A wrong answer that demonstrates:
- Semantic awareness ("cat" instead of "dog" — same category)
- Phonological attempt ("dag" for "dog")
- Comprehension with production difficulty (L1 translation)
- Creative engagement (silly answer = child is present)

...is more pedagogically valuable than silence, and should be treated as a partial win. The system must not penalize semantically-adjacent wrong answers the same way it treats complete disengagement.

Rule: `wrong_but_related` and `l1_translation` do not decrement emotional_safety. They are signals of engagement, not failure. [A]

---

## 5. Fast Answers Can Be Guesses

On forced-choice tasks, latency < 700ms should reduce classification confidence:
- The child may have pressed a button or said the first option without processing
- Fast response on a new item is a weaker mastery signal than fast response on a practiced item

The system must not treat speed as a positive signal without context. Speed only increases confidence when:
- The item has been seen before (not first exposure)
- The response is unprompted (not after model)
- The child didn't visibly guess (attempt_number == 1, no confusion history)

[B] This is a product hypothesis; empirical validation through session review would confirm.

---

## 6. Praise Can Become Hollow

Children learn quickly when praise is automatic. If every response — correct or not — produces "Amazing!", the word loses meaning and fails to reinforce learning. [A]

The fake_praise_guard (see Decision Engine) prevents:
- Identical praise phrases within 3 turns
- Effusive praise (Amazing! Incredible!) for trivial tasks
- Praise after incorrect-but-acknowledged response (use recast instead)
- Praise that precedes correction (which children detect as dishonest)

**Calibrated praise rules**:
- After unprompted correct answer on new item: high praise ("Yes! Perfect!")
- After correct answer after model: medium praise ("Good! Dog! Well done.")
- After near-correct/hesitant: warm confirmation ("Yes, that's it!")
- After echo repeat: soft acknowledgement + move to comprehension check
- After wrong-but-related: acknowledge connection, no direct praise ("Oh, that's a cat! And this one is a dog.")

[A] Feedback specificity and calibration are established in educational psychology (Hattie & Timperley, 2007).

---

## 7. What Can Be Measured Now

| Signal | What It Tells Us | Reliability |
|--------|-----------------|-------------|
| Response latency | Hesitation, confidence proxy | Medium |
| STT text | Content of response | Low-Medium (child speech) |
| Silence duration | Processing or avoidance | High (timing) |
| Response attempt count | Persistence vs. avoidance | High |
| L1 detection | Comprehension/production gap | High (script), Medium (vocab) |
| Classification history | Pattern of behavior | Medium |
| Turn-to-turn variance | Inconsistent = confusion | Medium |

---

## 8. What Requires Future Signals

| Signal | What It Would Tell Us | Status |
|--------|----------------------|--------|
| Prosody (pitch, tempo) | Emotional state, confidence | Future |
| Audio energy curve | Excitement vs. withdrawal | Future |
| Voice quality | Crying, laughing | Future |
| Facial engagement (camera) | Attention, emotion | Future (strict privacy) |
| Eye gaze | Task attention | Future (requires hardware) |

**These must not be assumed.** Do not design hard dependencies on them.

---

## 9. What Should Never Be Inferred Too Strongly

| Inference | Why Dangerous |
|-----------|--------------|
| "Child is unhappy" from silence | Silence is ambiguous |
| "Child doesn't understand" from wrong answer | Wrong answer may be phonological, not semantic |
| "Child is lying/guessing" from fast correct | May be genuine knowledge |
| "Child is bored" from low energy | May be tired, shy, or focused |
| "Child has a learning problem" from slow progress | May be session conditions, L1 interference |
| "Child is upset" from L1 switch | May be habit, comfort, or help-seeking |

**Overconfident inference is the primary design risk** in this system. When in doubt, the system should:
1. Choose the more generous interpretation
2. Use the safer scaffolding action
3. Log the uncertainty for human review if persistent

---

## 10. Modeling Specific Behavioral States

### 10.1 Confusion
- Signals: wrong_semantic + repeated pattern, silence after new concept, near_correct without progress, l1_translation on multiple consecutive items
- What it is NOT: one wrong answer; silence on first exposure
- Action: scaffold (model, forced choice, simplify)

### 10.2 Avoidance
- Signals: avoidance_nonsense repeated, refusal, l1_refusal, rapid-fire wrong answers without apparent effort
- What it is NOT: one off-topic comment; playful engagement
- Action: reduce stakes, change activity, never increase pressure

### 10.3 Playful Behavior
- Signals: high engagement_level, playful_nonsense with quick return to task, laughter indicators if available
- What it is NOT: repeated failure, low emotional_safety
- Action: brief play-along, redirect warmly
- Risk: misclassifying avoidance as play → play_along when child needed help

### 10.4 Emotional Shutdown
- Signals: convergence of silence_long + recent_failure_count >= 3 + emotional_safety < 0.40
- Must NOT be inferred from silence alone
- Action: immediate warm check-in; no teaching

### 10.5 L1 Dependency
- Signal: l1_translation on 3+ consecutive items, l1_help_request frequency increasing
- What it is NOT: a problem; it's a resource
- Action: bridge from L1 to English; reward English fragments; don't shame L1 use
