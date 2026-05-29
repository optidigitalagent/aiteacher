# Mentium Kids — Learning Engine Overview

## Position in the Stack

```
Layer 5: Response Classification
         ↓
Layer 6: LEARNING ENGINE  ← this document
         ↓
Layer 7: Teacher Activity Layer
```

The Learning Engine is a **deterministic decision system**. It receives structured inputs and emits structured outputs. No LLM inference is involved in progression decisions. The LLM is a tool for generating language — not for deciding what a child should do next.

---

## Inputs

### 1. Classification Signal
Produced by Layer 5. One of a closed set of response types:

| Code | Meaning |
|------|---------|
| `correct_confident` | Accurate, fluent, no hesitation |
| `correct_hesitant` | Accurate, slow or disfluent |
| `correct_prompted` | Accurate only after scaffolding |
| `partial_correct` | Partially correct (e.g. wrong article, right word) |
| `wrong_semantic` | Wrong but semantically close (e.g. "dog" for "cat") |
| `wrong_random` | No apparent connection to target |
| `no_response` | Silence or refusal |
| `off_task` | Response unrelated to lesson |
| `imitation_only` | Repeated teacher without processing |

### 2. Child State Vector
A set of real-valued scores maintained by Layer 7 (Memory Architecture):

```yaml
production_confidence: 0–100   # ability to produce the form
comprehension_confidence: 0–100 # ability to understand the form
engagement: 0–100
fatigue: 0–100
frustration: 0–100
session_time_elapsed: seconds
items_attempted_this_session: int
consecutive_correct: int
consecutive_wrong: int
```

### 3. Memory State (per lexical item)
```yaml
word_id: string
mastery_level: emerging | developing | secure | automatic
production_attempts: int
comprehension_attempts: int
correct_production_count: int
correct_comprehension_count: int
last_seen: ISO timestamp
review_due: ISO timestamp
introduced_in_lesson: int
```

### 4. Curriculum State
```yaml
current_unit: int
current_lesson: int
current_item_index: int
target_words_this_lesson: [word_id]
words_completed_this_lesson: [word_id]
lesson_phase: warm_up | introduction | practice | consolidation | review | close
```

### 5. Activity History (session-scoped)
```yaml
activity_sequence: [activity_id]   # ordered list this session
current_activity: activity_id
current_activity_attempts: int
current_activity_duration_seconds: int
activity_result_sequence: [classification_code]   # last N results
```

---

## Outputs

The Learning Engine emits a **Decision Packet** after every response event:

```yaml
decision:
  next_activity: activity_id
  next_difficulty: int (1–5)
  next_item: word_id | null          # null = stay on current item
  teacher_action: action_code
  review_schedule_update:
    word_id: string
    next_review: ISO timestamp
    mastery_delta: float
  lesson_phase_advance: bool
  lesson_complete: bool
  session_stop_reason: null | string
  reward_trigger: bool
  feedback_tone: neutral | warm | celebratory | gentle_correction
```

---

## The Progression Loop

Every child response triggers one full pass through the loop:

```
1. CLASSIFY
   Response Classification Layer emits classification_code

2. UPDATE STATE
   Learning Engine updates child state vector:
   - Adjust production_confidence / comprehension_confidence
   - Increment consecutive_correct or reset to 0
   - Update fatigue and frustration signals
   - Record to activity_result_sequence

3. EVALUATE MASTERY
   Mastery Model checks if word qualifies for level advance
   (see mastery-model.yaml)

4. APPLY PROGRESSION RULES
   Progression Rules Engine checks rule conditions in priority order
   (see progression-rules.yaml)
   Emits: stay | repeat | scaffold | advance | review | lower_difficulty

5. SELECT ACTIVITY
   Activity Selection Engine maps progression decision
   to specific next_activity
   (see activity-selection-engine.yaml)

6. CHECK ENGAGEMENT
   Engagement Adaptation Engine checks engagement vector
   May override activity selection with novelty or easiest_win
   (see engagement-adaptation-engine.yaml)

7. CHECK SESSION STATE
   Session Completion Engine checks whether lesson should continue,
   extend, or close
   (see session-completion-engine.yaml)

8. EMIT DECISION PACKET
   Structured output sent to Teacher Activity Layer
```

---

## Key Design Constraints

**[A] Determinism.** Given identical inputs, the Learning Engine must produce identical outputs. No randomness unless explicitly modeled with a seeded generator.

**[A] Backend authority.** All state lives in the backend. The Teacher Activity Layer is stateless from a progression perspective.

**[B] Confidence over speed.** The engine must not advance a child who is fast but unstable. Confidence scores must stabilize before advancement.

**[B] Mandatory review.** No item graduates from a lesson without at least one review event after its introduction.

**[A] Success endings.** The lesson close phase must always begin from a succeeded state. The engine must insert an easiest_win if necessary before triggering lesson close.

**[C] Fatigue modeling.** Fatigue is estimated from session time + error rate + response latency patterns. This requires calibration with real user data.

---

## Confidence Score Update Model

After each response, confidence scores update using a **bounded exponential moving average**:

```
new_score = clamp(
  old_score + (delta * learning_rate),
  min=0, max=100
)
```

| Classification | production_delta | comprehension_delta |
|----------------|-----------------|---------------------|
| correct_confident | +8 | +5 |
| correct_hesitant | +4 | +4 |
| correct_prompted | +2 | +3 |
| partial_correct | +1 | +2 |
| wrong_semantic | -4 | -2 |
| wrong_random | -8 | -5 |
| no_response | -6 | -3 |
| imitation_only | 0 | +1 |

Learning rate = 1.0 by default. Adjust per child based on historical variance. **[C]**

---

## Frustration & Fatigue Model

```
frustration += 10 per wrong_random or no_response
frustration += 5  per wrong_semantic
frustration -= 8  per correct_confident
frustration -= 4  per correct_hesitant
frustration = clamp(frustration, 0, 100)

fatigue = f(session_time_elapsed, items_attempted, error_rate_last_10)
```

Frustration > 60 → trigger scaffold or easiest_win before any advance.
Frustration > 80 → trigger lesson emotional stop consideration.
Fatigue > 70 → trigger session_completion check regardless of phase. **[B]**
