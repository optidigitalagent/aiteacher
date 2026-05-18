# Golden Lesson Walkthrough — Pronunciation Struggle

> Student knows the grammar and content but struggles with specific phonological production.
> Teacher accepts content, isolates pronunciation separately, never marks correct grammar as wrong.

Student: Vlad, age 16. Exercise: Soft Speaking — Section 1.2, "Who inspires you and why?"

See also: [[PRONUNCIATION_STRUGGLE_STATE]] · [[SOFT_SPEAKING_PROTOCOL]] · [[STT_NOISE_PATTERNS]] · [[VOICE_PEDAGOGY_DOCTRINE]]

---

## Context Setup

**[BACKEND]**
```
exerciseType: "soft_speaking"
instruction: "Tell me about someone who inspires you. Say who they are and why they inspire you."
requiredSlots: ["subject", "reason"]
taskKind: "reason_required"
```

**[FRONTEND]**
```
"Exercise 6 — Speaking"
Instruction: "Tell me about someone who inspires you and why."
Mic button: active
```

---

## Attempt 1 — Correct Content, Pronunciation Issue

**[TEACHER]**
> "Exercise 6 — tell me about someone who inspires you and why. For example: 'My father inspires me because he works very hard.' Now your turn — who inspires you?"

**[STUDENT]** (speaks with heavy accent, struggles with "inspires")

Voice: "My brader ins-PEER me because he studying medicine."

**[STT]** `"my brader inspeer me because he studying medicine"`

**[INTERP]**
```
subject_detected: "my brother" (phonetic match: "brader" → "brother")
reason_detected: true ("because he studying medicine" — causal connector present)
broken_grammar: ["studying" should be "studies" — state verb / habit context]
slots_found: ["subject", "reason"]
missingSlots: []
```

**[VALIDATION]**
```
issueType: "acceptable_with_repair"
allowProgression: true
grammarNote: "He studies — not he studying (Present Simple for habit)"
```

**[BACKEND]**
```
event: item_submitted
allowProgression: true
exerciseCursor: advances to post-exercise (single-item speaking)
```

**[TEACHER]** (accepts content first, then repairs grammar, then pronunciation)
> "Good — your brother inspires you because he's studying medicine. Better grammar: 'He studies medicine' — Present Simple for habits. And the word: 'in-SPIRES' — say it: 'inspires'."

**[STUDENT]**
> "Inspires... in-spires."

**[TEACHER]**
> "There it is. Good. You've answered Exercise 6."

**[STATE]** → PRONUNCIATION_STRUGGLE → resolved for this item

---

## Extended Scenario — When STT Cannot Decode

Now: different item. Student tries to say "dedicated" (vocabulary word).

**[BACKEND]**
```
exercise: ex1_vocabulary
item: { word: "dedicated", instruction: "Use this word in a sentence about your brother." }
```

**[STUDENT]**
Voice: "My brader is very deddik... deddikay... uh..."

**[STT]** `"my brader is very deddik deddikay uh"`

**[INTERP]**
```
phonetic_attempt_detected: "deddikay" → proximity match: "dedicated"
confidence: LOW (no clean match)
extraction: "dedicated" (closest match)
```

**[TEACHER]**
> "I caught 'dedicated' — good try. The stress is: ded-i-CA-ted. Say it: 'dedicated'."

**[STUDENT]**
> "Ded-i-CA-ted. Dedicated."

**[TEACHER]**
> "Right. Now the full sentence — 'My brother is dedicated.'"

**[STUDENT]**
> "My brother is dedicated."

**[VALIDATION]** → CORRECT (vocabulary used correctly in sentence)

---

## Scenario — STT Completely Fails

Student tries to say "influenced" — STT captures nothing usable.

**[STUDENT]**
Voice: [unintelligible to STT]

**[STT]** `""`  (empty)

**[TEACHER]**
> "Sorry — the microphone didn't pick that up. What was the word you used?"

**[STUDENT]**
> "Influenced."

**[STT]** `"influenced"`

**[TEACHER]**
> "Got it — 'influenced'. Good word. 'My brother influenced me to study hard.' Try the full sentence."

**[STUDENT]**
> "My brother influenced me to study hard."

**[VALIDATION]** → CORRECT (vocabulary used in sentence context)

---

## Scenario — Pronunciation Is the Exercise Goal

Now: dedicated pronunciation exercise. Student must produce /θ/ sound in "three" and "think".

**[BACKEND]**
```
exerciseType: "pronunciation_practice"
target: "/θ/ in initial position"
items: ["think", "three", "thank", "thought"]
```

**[TEACHER]**
> "Exercise 7 — pronunciation. The sound is /θ/ — like in 'think'. Tip: tongue just behind upper teeth. Say: 'think'."

**[STUDENT]**
> "tink"

**[TEACHER]** (pronunciation IS the goal here — correct it)
> "Almost — tongue needs to touch teeth. Not 'tink' — 'th-ink'. Watch: [th, th, think]. Say it slowly."

**[STUDENT]**
> "Th... think."

**[TEACHER]**
> "Better — 'think'. Next: 'three'."

Note: In this exercise, the teacher DOES correct pronunciation directly — because phonological production IS the goal.
This is the ONLY exercise type where pronunciation is corrected mid-item.

---

## Analysis — What the Teacher Did Right

1. **Content accepted before pronunciation** — "Good — your brother inspires you... Better grammar: '...studies'... And the word: 'inspires'."
   Order: content → grammar → pronunciation (not reversed)

2. **STT phonetic match used** — "brader" → "brother" → teacher accepted, used correct word in response
   Teacher did NOT say "what? I didn't understand" — interpretation runtime handled the mapping

3. **Pronunciation addressed AFTER grammar** — never before, never instead of content feedback

4. **When STT fails completely** — teacher asked ONCE for the word, not "try saying the whole sentence again"

5. **Pronunciation exercise vs. grammar exercise** — correctly identified when phonological production IS the goal

6. **No accent shaming** — teacher referenced the sound pattern ("tongue behind teeth"), not the accent

---

## What BAD Teacher Behavior Looks Like

**BAD:**
> Student: "My brader ins-PEER me because he studying medicine."
> Teacher: "I'm sorry, I couldn't understand. Could you say that more clearly?"

(Penalizes pronunciation. Student said something perfectly comprehensible. STT decoded it. Teacher rejected it.)

**BAD:**
> Student: "My brader ins-PEER me..."
> Teacher: "The word is 'INSpires' — say it before continuing."
> [Student says "inspires"]
> Teacher: "Good — now the sentence from the beginning."

(Interrupted the sentence mid-production to demand pronunciation correction. Breaks flow. Treats pronunciation as blocker for content.)

**BAD:**
> Teacher (when STT empty): "Try again — say the whole sentence."

(Forces a full re-attempt when the specific question is "what was that word?" — wastes time.)

**BAD (worst):**
> Teacher marks answer incorrect because student said "brader" for "brother".

(Accent is not an error. STT resolved it. Validation should confirm content.)
