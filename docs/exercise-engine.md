# Exercise Engine

## Overview

The ExerciseGenerator creates exercises dynamically during a lesson.
It does NOT use pre-written exercises from a bank.
It generates them on-the-fly using the AI, anchored to:
- The grammar target (e.g. Past Simple)
- The lesson topic vocabulary (e.g. Everest, summit, expedition)
- The student's current difficulty level
- The student's specific error patterns

## The 4 Exercise Types

### Type 1 — Form Transformation
**Purpose:** Tests if student can apply the grammar rule mechanically.
**Difficulty:** Low → Medium
**Format:** Fill-in-the-blank

```
Prompt to AI for generation:
"Generate a Form Transformation exercise.
Grammar: {{GRAMMAR_TARGET}}
Topic vocabulary: {{LESSON_VOCAB}}
Difficulty: {{DIFFICULTY}} (0=easy, 1=hard)
Student weak points: {{ERROR_PATTERNS}}

Return JSON: {
  question: 'In 1953, Hillary _____ (reach) the summit.',
  correct_answer: 'reached',
  common_errors: ['reach', 'reaches', 'reacched'],
  hint: 'This is a regular verb. What ending do regular verbs get in Past Simple?'
}"
```

**Validation logic:**
- Exact match → correct
- Correct but different spacing/capitalisation → correct (normalise first)
- Common error detected → trigger specific feedback
- Unexpected answer → ask AI to evaluate semantically

---

### Type 2 — Error Correction
**Purpose:** Tests if student can IDENTIFY and fix mistakes (deeper understanding).
**Difficulty:** Medium → High
**Format:** Correct the sentence

```
Example:
"Find and fix the mistake:
'They rised early and leaved the camp before sunrise.'"

Expected: "They rose early and left the camp before sunrise."
Teaching moment: discuss WHY these are irregular verbs.
```

**Generation rule:**
- Always use 1–2 real errors from {{ERROR_PATTERNS}} if available
- Otherwise use the most common errors for this grammar point
- Errors must be realistic (things students actually write)
- Mix: 1 error per sentence at low difficulty, 2 errors at high difficulty

---

### Type 3 — Sentence Reconstruction
**Purpose:** Tests word order and syntactic awareness.
**Difficulty:** Medium
**Format:** Reorder scrambled words

```
Example:
"Make a correct sentence:
[slowly / climbers / the / walked / mountain / up / the]"

Expected: "The climbers slowly walked up the mountain."
Also accept: "The climbers walked slowly up the mountain." (both correct)
```

**Validation:**
- Must check ALL grammatically correct orderings, not just one
- Use AI to validate: "Is this a correct English sentence?" for edge cases

---

### Type 4 — Free Production
**Purpose:** Tests ability to use grammar in creative, unrestricted output.
**Difficulty:** High (this is the production stage)
**Format:** Open-ended speaking or writing prompt

```
Examples:
"Tell me 3 things Edmund Hillary did during the climb.
Use Past Simple. Include at least one irregular verb."

"Describe your last school day using 5 Past Simple verbs."

"What did you do last weekend? Tell me in 4–5 sentences."
```

**Validation:**
- AI evaluates response semantically
- Check: correct Past Simple usage (not Present Simple or Present Perfect)
- Check: irregular verb forms if required
- Accept any correct content — this is free expression
- Score: 0.0–1.0 based on grammar accuracy + task completion

---

## Difficulty Adaptation Algorithm

```typescript
function adaptDifficulty(state: LessonState): number {
  const { consecutiveCorrect, consecutiveErrors, currentDifficulty } = state;
  
  if (consecutiveErrors >= 2) {
    // Student struggling → drop difficulty
    return Math.max(0.1, currentDifficulty - 0.2);
  }
  
  if (consecutiveCorrect >= 3) {
    // Student excelling → raise difficulty
    return Math.min(1.0, currentDifficulty + 0.15);
  }
  
  return currentDifficulty;  // no change
}
```

**Difficulty levels map to:**
```
0.0–0.3:  Regular verbs only, positive sentences, simple vocabulary
0.3–0.5:  Add negatives, mix regular/irregular, compound sentences
0.5–0.7:  Questions, all irregular verbs, time expressions
0.7–1.0:  Complex sentences, mixed tenses context, abstract topics
```

---

## Answer Validation

**Do NOT use simple string matching.** Use semantic validation:

```typescript
async function validateAnswer(
  studentAnswer: string,
  correctAnswer: string,
  exerciseType: ExerciseType
): Promise<{ correct: boolean; score: number; feedback: string }> {
  
  // Step 1: normalise (trim, lowercase, remove double spaces)
  const normalised = normalise(studentAnswer);
  
  // Step 2: exact match after normalisation
  if (normalised === normalise(correctAnswer)) {
    return { correct: true, score: 1.0, feedback: 'perfect' };
  }
  
  // Step 3: for Free Production — always use AI evaluation
  // Step 4: for others — check common errors list first
  // Step 5: if still unclear — use AI semantic check
  
  const aiResult = await evaluateWithAI(studentAnswer, correctAnswer, exerciseType);
  return aiResult;
}
```

---

## Exercise Sequence Rules

```
Minimum exercises per lesson: 6
Maximum exercises per lesson: 12 (stop if time > 15 min)

Required sequence:
- Start with Type 1 (always, to warm up)
- At least 1 Type 2 per lesson
- At least 1 Type 4 per lesson (free production)
- Type 3 is optional (use if student struggles with word order)

After Phase EXERCISES → ALWAYS do VOCABULARY before DEEP_THINKING
```
