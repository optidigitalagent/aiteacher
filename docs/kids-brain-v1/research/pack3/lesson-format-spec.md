# Lesson Format Specification
## Mentium Kids — Official Lesson Structure

---

## Core Design Principles

1. **Every micro-cycle ends with child speaking.** No passive segments longer than 45 seconds.
2. **Activities rotate texture.** Never two consecutive activities of the same type.
3. **Difficulty is U-shaped within a session.** Easy open → build → peak challenge → return to easy close.
4. **Recovery is always pre-planned.** Every activity has an adjacent easier activity ready.
5. **The lesson is a story.** Activities are episodes in a narrative, not a list of exercises.

---

## Global Lesson Parameters

| Parameter | Value |
|-----------|-------|
| Total session length | 12–15 minutes |
| Micro-cycle length | 60–120 seconds per activity |
| Target new words per lesson | 4–6 |
| Review words per lesson | 3–4 (from previous unit) |
| Speaking/listening ratio | Target 40% speaking / 60% listening |
| Child speaking turns per lesson | Minimum 15 |
| Teacher monologue max without child response | 30 seconds |
| Minimum reward/praise moments | 1 per minute |
| Open question ratio | Max 20% of all questions (rest = forced choice or yes/no) |

---

## The Mentium Kids Lesson Structure

### PHASE 0: ARRIVAL (30 seconds)
**Purpose:** Emotional warm-up. Signal safety. Re-engage child.

**What happens:**
- Teacher greets with name (if known)
- Callback to last lesson (1 sentence)
- Forward hook for today (1 sentence)
- One easy question the child CAN answer

**Child action:** Say a word, say hello, answer yes/no  
**Activity type:** `warm_greeting`  
**Energy:** Warm, rising  
**Teacher speech:** Max 3 sentences before child responds

**Example:**
```
"[Name]! You're here! Last time you were SO good at colours.
Today we have something new — and I think you're going to love it.
Are you ready? Say: READY!"
```

---

### PHASE 1: STORY HOOK (60–90 seconds)
**Purpose:** Create context. Introduce the lesson "world." Anchor motivation.

**What happens:**
- Teacher tells a short story (3–5 sentences) featuring a character in a situation
- The situation creates a "problem" that the child will help solve
- Target vocabulary appears naturally in the story (no explicit labeling yet)
- Teacher asks child to confirm understanding: one yes/no question

**Child action:** Listen, confirm understanding (yes/no or nod-equivalent)  
**Activity type:** `mini_story_hook`  
**Energy:** Building, curious  
**Visual dependency:** Zero — story works in audio only

**Example:**
```
"Listen! Mia the monkey is at the zoo today!
She can see lots of animals. But she doesn't know their names!
Can you help Mia? [pause] Say: YES!"
```

**Rule:** Target words appear in the story but are not labeled or taught yet. This is pre-input — the child hears them in context first.

---

### PHASE 2: INPUT / MODELING (2–3 minutes)
**Purpose:** Teach the new vocabulary through hearing and gesture.

**What happens:**
- Teacher introduces 4–6 words, one at a time
- Each word: hear × 3, gesture, chunk
- After every 2 words: one recognition check (forced choice or yes/no)
- No production demanded yet — recognition only

**Activity types:** `listen_and_point`, `yes_no_comprehension`, `tpr_action`  
**Energy:** Steady, clear  
**Words per minute:** Slow — each word gets ~25 seconds of input

**Input sequence per word:**
```
1. [Sound effect / context clue]
2. TEACHER says word (natural speed)
3. TEACHER says word (slightly emphasized)
4. TEACHER gives gesture instruction
5. TEACHER says word in a chunk
6. TEACHER: "Say it with me — [word]"
7. Child says word (choral production)
8. TEACHER: [specific praise]
```

**After 2 words: Mini recognition check**
```
"Is this a cat or a dog? [sound A vs sound B]"
→ Child answers forced choice
→ Teacher confirms + moves on
```

**Phase ends:** All 4–6 words introduced and heard in chunks.

---

### PHASE 3: RECOGNITION LOOP (90 seconds)
**Purpose:** Confirm receptive knowledge before asking for production.

**What happens:**
- All target words are cycled through recognition tasks
- Child never has to produce — only identify
- If all 4–6 words pass recognition: advance to production
- If 2+ words fail: return to Phase 2 for those words (recovery loop)

**Activity types:** `listen_and_point`, `forced_choice`, `spotting`, `yes_no_comprehension`  
**Energy:** Active, slightly playful  
**Success signal:** Child answers correctly 4 out of 6 items

**Recognition task examples:**
```
"Which one is the elephant? A or B?"
"Is it a cat? YES or NO?"
"I see a big animal — is it a dog or a horse?"
```

---

### PHASE 4: CHANT / RHYTHM (30–45 seconds)
**Purpose:** Encode vocabulary in rhythm. Use prosodic memory. Provide physical release.

**What happens:**
- Teacher leads a short chant using all target words
- Chant has a beat (clap, stomp, or call-and-response pattern)
- Child echoes or completes the chant
- Chant is original Mentium-created content, not from textbook

**Activity type:** `chant_repeat`  
**Energy:** Peak — most physically active moment in lesson  
**Duration:** Short — always under 60 seconds

**Chant pattern:**
```
TEACHER: "Dog — dog — it's a dog! [clap clap]"
CHILD: "Dog — dog — it's a dog! [clap clap]"
TEACHER: "Cat — cat — it's a cat! [clap clap]"
CHILD: "Cat — cat — it's a cat! [clap clap]"
```

**Why here:** After recognition, before production — the chant is a bridge. It gets the child speaking in a protected, rhythmic context before free production is asked for.

---

### PHASE 5: SUPPORTED PRODUCTION (2 minutes)
**Purpose:** Child produces target words with scaffolding still present.

**What happens:**
- Teacher provides sentence starters, the child completes
- Or: Teacher asks forced choice, child picks and says the full word
- Or: Teacher starts a sentence, child fills the blank
- Scaffolding: sentence frame always visible/audible

**Activity types:** `repeat_after_me`, `forced_choice`, `say_sentence`  
**Energy:** Confident, building  
**Scaffolding:** High — frames always present

**Production task examples:**
```
"It's a ___! [teacher points/sounds] — say it!"
"Tell Mia what this is! Say: It's a dog!"
"Can you say all the animals? Dog... cat... bird..."
```

**Rule:** If child produces correctly → specific praise + move on  
**Rule:** If child is wrong → recast immediately, re-ask once, move on

---

### PHASE 6: TINY CHALLENGE (60–90 seconds)
**Purpose:** Slight production challenge. Child pushed slightly past comfort zone.

**What happens:**
- Open-ish question (not forced choice)
- Or: produce a chunk without teacher prompting the full frame
- Or: sequence — "what comes next?"
- Or: recall — "what animals did we find today?"

**Activity type:** `say_sentence`, `mini_story_choice`, `review_loop`  
**Energy:** Focused, slightly "harder"  
**Scaffolding:** Reduced — teacher provides less  

**Challenge task examples:**
```
"Which animal do YOU like? Say: I like ___!"
"What did Mia find first? Tell me!"
"Can you name 3 animals? Go!"
```

**Recovery rule:** If child fails twice → immediately drop back to forced choice for the same word. Never extend challenge beyond 2 failed attempts.

---

### PHASE 7: REVIEW LOOP (90 seconds)
**Purpose:** Recycle 3–4 words from the previous unit. Consolidate long-term retention.

**What happens:**
- Teacher briefly revisits 3–4 words from last lesson/unit
- Activity type: spotting game or quick-fire forced choice
- This is NOT new teaching — it is retrieval practice
- Speed: faster pace than Phase 2 (child already knows these)

**Activity type:** `review_loop`, `forced_choice`, `spotting`  
**Energy:** Quick, confident  
**Tone:** "You already know this — let's show Mia how good you are!"

**Why here:** Spaced retrieval after production of new words. The brain is primed after new learning for related retrieval to strengthen. [A]

---

### PHASE 8: REWARD MOMENT (15–30 seconds)
**Purpose:** Emotional peak. Signal completion. Create identity of success.

**What happens:**
- Teacher delivers celebration (not generic — references what child specifically did)
- Simple in-world reward: character thanks the child, "badge" earned (audio)
- Child receives a closing identity statement

**Activity type:** `celebration`  
**Energy:** Peak warmth — most joyful moment

**Pattern:**
```
"Mia says THANK YOU! You helped her find ALL the animals!
[character sound]
You are an amazing animal teacher today.
Dog, cat, bird, elephant — you know them ALL."
```

**What NOT to do:** 
- Generic "Great job!"
- Stars without context
- Abrupt ending

---

### PHASE 9: OPEN LOOP ENDING (30 seconds)
**Purpose:** Create anticipation for next session. End in desire, not closure.

**What happens:**
- Teacher teases something surprising about next lesson
- Does NOT explain or reveal — only hints
- Child is left curious, not satisfied

**Activity type:** `open_loop`  
**Energy:** Warm, slightly mysterious

**Pattern:**
```
"Next time... Mia is going to meet a VERY big animal.
Much bigger than an elephant! [pause]
I wonder what it is...
Come back and find out! Bye for now, [name]!"
```

---

## Complete Session Timeline

```
PHASE 0   [0:00–0:30]   Arrival / Warm Greeting         30 sec
PHASE 1   [0:30–2:00]   Story Hook                       90 sec
PHASE 2   [2:00–5:00]   Input / Modeling                 3 min
PHASE 3   [5:00–6:30]   Recognition Loop                 90 sec
PHASE 4   [6:30–7:15]   Chant / Rhythm                   45 sec
PHASE 5   [7:15–9:15]   Supported Production             2 min
PHASE 6   [9:15–10:45]  Tiny Challenge                   90 sec
PHASE 7   [10:45–12:15] Review Loop                      90 sec
PHASE 8   [12:15–12:45] Reward Moment                    30 sec
PHASE 9   [12:45–13:15] Open Loop Ending                 30 sec
─────────────────────────────────────────────────────────────
TOTAL                                                    ~13 min
```

---

## Age Differentiation

### Age 6 Adjustments
| Parameter | Standard | Age 6 |
|-----------|----------|-------|
| New words per lesson | 4–6 | 4 max |
| Micro-cycle max | 120 sec | 75 sec |
| Forced choice % | 60% | 80% |
| Open question % | 20% | 5% |
| Chant duration | 45 sec | 60 sec |
| Review words | 4 | 2–3 |
| Silence tolerance | 4 sec | 3 sec |
| TPR actions | Yes | Always |
| Story complexity | Moderate | Minimal — 2–3 sentences |
| Challenge phase | 90 sec | 60 sec (or skip if struggling) |

### Age 7 Adjustments
| Parameter | Standard | Age 7 |
|-----------|----------|-------|
| New words per lesson | 4–6 | 5–6 |
| Forced choice % | 60% | 60% |
| Open questions | 20% | 15% |
| Challenge phase | 90 sec | 90 sec |
| Sentence production | Chunks | Short sentences |

### Age 8 Adjustments
| Parameter | Standard | Age 8 |
|-----------|----------|-------|
| New words per lesson | 4–6 | 6 |
| Open questions | 20% | 25% |
| Sentence production | Short sentences | 2–3 word sentences |
| Challenge phase | 90 sec | 2 min |
| Review speed | Slow | Fast |
| Tiny challenge | Scaffolded | Lower scaffold |
| Story complexity | Moderate | 4–5 sentences |

---

## Recovery Architecture

### When to trigger recovery:
- Child silent for age-appropriate window (see methodology playbook)
- Child wrong twice in same activity
- Child says "I don't know" or L1 response twice in a row
- Child appears confused (random nonsense, laughing, ignoring)

### Recovery path:
```
Current activity fails
    ↓
Drop to next-easier activity type
(e.g., say_sentence → forced_choice → yes_no → teacher provides answer)
    ↓
Deliver one guaranteed success
    ↓
Specific praise for that success
    ↓
Return to main track at lower difficulty
```

### Recovery is NEVER announced:
- Not: "Let's try an easier question."
- Yes: [Just naturally ask the easier question as if that was always the plan]

---

## Lesson Variations (same structure, different flavors)

### Lesson Type A: New Unit Opener
- Phase 2 expanded (new vocabulary only)
- Phase 6 easier (forced choice instead of open)
- Review words: previous unit's final 3 words only

### Lesson Type B: Mid-Unit Consolidation  
- Phase 2 shorter (words already introduced)
- Phase 5 + 6 expanded (more production)
- Review words: 2 from current unit + 2 from last

### Lesson Type C: Review / Pre-Test Lesson
- No new vocabulary
- Phase 2 replaced by quick recall game
- Full focus on Phase 5 + 6 + 7
- Expanded challenge
- Used every 3 units (maps to Kid's Box review structure)

---

## What This Format Is NOT

| Forbidden | Why |
|-----------|-----|
| Grammar explanation | Children acquire grammar through exposure, not explanation [A] |
| Translation activity | Delays English-only association [B] |
| Writing task | Voice-first; writing is out of scope |
| Long passive story | No silent listening >45 seconds [A] |
| Open chatbot conversation | Structure needed to prevent confusion and incoherence |
| Worksheet-style Q&A | Sequential question lists feel like tests |
| Multiple correct answer paths without scaffold | Creates cognitive overload at this age [A] |
