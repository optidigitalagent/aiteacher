# Kid's Box Exercise Design Specification
## AI Teacher — Kids Voice Mode (Kids Brain V1)

**Version:** 2.0 (Corrected — Honest Asset Requirements)
**Source:** Cambridge Kid's Box 1, 2nd Edition, 2014
**Scope:** All 10 textbook activity types across 12 units
**Purpose:** Product design specification — implementation reference for the exercise engine

> **Version 2.0 change notice:** Three exercise types were incorrectly classified as audio-only safe in v1.0. SONG, STORY_LISTEN, and LISTEN_AND_POINT now carry corrected classifications. Every exercise type now has an explicit Implementation Classification table (section X.0) stating what mode is textbook-equivalent, what is AI-native, and what is a degraded fallback that must not ship as the real format.

---

## How to Read This Document

This document reverse-engineers every exercise format that appears in Kid's Box 1 and specifies exactly how each one must work inside AI Teacher. Nothing here is invented pedagogy — every exercise type is derived directly from the textbook.

Each section follows the same structure:
0. Implementation Classification — **new in v2.0** — honest support status and asset requirements
1. Exercise Type — what it is and when it appears
2. Teaching Flow — step-by-step sequence
3. Media Requirements — audio, visual, video per exercise
4. Child Interaction Model — what the child must do
5. Success Criteria — how the engine knows the exercise is done
6. Escalation Ladder — what happens at each failed attempt
7. Recovery Behaviour — how to handle silence, wrong answer, random speech, L1, distraction
8. UI Requirements — what the frontend must render

The Curriculum Mapping table at the end maps every Kid's Box 1 exercise to these types.

---

## Terminology

| Term | Meaning |
|---|---|
| `textbookActivityType` | `KidsTextbookActivityType` enum — what the exercise is in the textbook |
| `studentActionType` | `KidsStudentActionType` enum — what the child must produce |
| `completionRule.type` | `KidsCompletionRuleType` enum — what triggers exercise advance |
| `escalationLadder` | `KidsRetryEscalationType[]` — ordered retry scaffold |
| `requiresVisualUI` | `true` = exercise cannot run without a rendered visual element |
| `allowedWithoutVisualUI` | `true` = audio fallback exists, exercise runs voice-only |
| `assetType: 'tts_prompt'` | Generated at runtime by ElevenLabs — no pre-recorded file needed |
| `assetType: 'recorded'` | Pre-recorded audio file (songs, authentic chants) — must be uploaded to CDN |
| `assetType: 'sfx'` | Sound effect file (bells, applause) — must be uploaded to CDN |

### Implementation Classification Labels (v2.0)

| Label | Definition |
|---|---|
| **Textbook-equivalent** | Mode that matches the Kid's Box textbook activity in all essential respects: correct stimulus type, correct response type, correct media. A child doing this mode is doing the same exercise as a child with the physical textbook. |
| **AI-native adaptation** | Mode that achieves the same learning objective through voice interaction without pretending to be the textbook format. Honest about what it is. Pedagogically valid. Not a compromise — a deliberate reformat for the medium. |
| **Degraded fallback** | Mode that is technically operable but is not the real exercise and does not achieve the same experience. Acceptable as a temporary dev placeholder. Must never be presented to a paying user as the real Kid's Box format. Must be labelled internally and must not be shipped to production as-is. |

---

## Part 1: Exercise Type Definitions

---

### Exercise Type 1: LISTEN AND REPEAT

**`textbookActivityType`:** `LISTEN_AND_REPEAT`
**Textbook label:** "Listen and repeat"
**Appears in:** Every unit, introduction and practice phases
**KB1 examples:** "Listen — blue! Say blue." (PB p.6), number flashcards (PB p.5)

#### 1.0 Implementation Classification

| Question | Answer |
|---|---|
| **Textbook-equivalent mode** | ✅ YES — voice-only is the native format of this exercise |
| **AI-native adaptation available** | ✅ YES — same as textbook-equivalent |
| **Degraded fallback available** | N/A — no degradation possible for a voice exercise |
| **Can we support it today?** | ✅ YES — fully implemented |
| **Can we support it without assets?** | ✅ YES — no visual assets required |
| **Mandatory assets for production** | None. Flashcard image is optional enhancement only. |
| **Acceptable temporary fallback** | N/A |
| **Must NOT ship as textbook-equivalent** | N/A |

#### 1.1 Teaching Flow

```
Step 1 — TEACHER MODELS:
  Teacher says: "Listen — [target word]!"
  TTS plays the target word clearly at normal speed.

Step 2 — TEACHER INVITES:
  Teacher says: "Now you say it!"
  Microphone opens. STT listening begins.

Step 3 — CHILD RESPONDS:
  Child speaks the target word.
  STT captures transcript.

Step 4 — ENGINE EVALUATES:
  Classification engine compares transcript to acceptedAnswers[].
  Labels: CORRECT_CONFIDENT / CORRECT_HESITANT / NEAR_CORRECT /
          PRONUNCIATION_VARIANT / REPEATED_AFTER_MODEL /
          WRONG_ANSWER / SILENCE / L1_DETECTED

Step 5 — TEACHER REACTS:
  If correct: specific praise + model again (recast, not correction).
  If near-correct: implicit recast — "Yes! [word]! Again — [word]!"
  If wrong: no explicit correction — teacher re-models and invites again.
  If silence: encourage and re-invite.

Step 6 — COMPLETION CHECK:
  CORRECT_REPETITIONS rule: requiredCorrectCount = 2.
  Two correct attempts → exercise advances.
  Escalation ladder exhausted → MOVE_ON regardless of correctness.
```

#### 1.2 Media Requirements

| Media | Required | Type | Notes |
|---|---|---|---|
| Audio | **YES** | `tts_prompt` | Teacher model + retry scaffolds generated by ElevenLabs at runtime |
| Image | NO (optional) | `image` — flashcard | Single flashcard showing target word; `available: false` until UI ready |
| Video | NO | — | Not used |

Audio fallback: exercise runs fully without image (voice-only).

#### 1.3 Child Interaction Model

**`studentActionType`:** `REPEAT_WORD`

The child:
- Listens to the teacher's model
- Speaks the target word (single word or short phrase)
- Does NOT need to form a sentence
- Does NOT need to initiate — teacher always models first

#### 1.4 Success Criteria

| Criterion | Value |
|---|---|
| `completionRule.type` | `CORRECT_REPETITIONS` |
| `requiredCorrectCount` | `2` |
| `allowPartialCompletion` | `false` |
| Auto-advance on exhaustion | YES — `MOVE_ON` tier fires when `maxAttempts` reached |

Correct = any classification label in: `CORRECT_CONFIDENT`, `CORRECT_HESITANT`, `NEAR_CORRECT`, `PRONUNCIATION_VARIANT`, `REPEATED_AFTER_MODEL`.

#### 1.5 Escalation Ladder

| Attempt | `escalationLadder[n]` | Teacher says | Notes |
|---|---|---|---|
| 1 | `REPEAT_PROMPT` | "Let's try again! Can you say [word]?" | Normal re-invite |
| 2 | `MODEL_ANSWER` | "Listen carefully! [firstPhoneme]… [word]! Can you say [word]?" | Phoneme scaffold |
| 3 | `ENCOURAGEMENT` | "You can do it! Try one more time — [word]!" | Emotional support |
| 4 | `MOVE_ON` | "Well done for trying! Let's move on." | Auto-advance |

`maxAttempts` = 3 for difficulty-1 words, 4 for difficulty-2 words.
`resetOnCorrect` = `true` (correct answer resets attempt counter).

#### 1.6 Recovery Behaviour

| Scenario | Engine Label | Teacher Behaviour |
|---|---|---|
| Silence (< 1s) | `SILENCE_SHORT` | Wait. Do not interrupt. |
| Silence (1–3s) | `SILENCE_MEDIUM` | "Can you say [word]?" — re-invite gently. |
| Silence (> 3s) | `SILENCE_LONG` | Escalate one tier. Model the word again. |
| Wrong word | `WRONG_ANSWER` | No correction marker. Implicit recast: "Listen — [word]! Your turn." |
| Random speech / noise | `RANDOM_SPEECH` | "Let's try that again! Say [word]." — ignore content. |
| Child speaks L1 | `L1_DETECTED` | Acknowledge warmly + re-model in English. Max 2 L1 words per session. |
| Distracted / off-topic | `DISTRACTED` | Warm re-focus: "Let's keep going! Say [word]." |

#### 1.7 UI Requirements

```
Required UI component: FLASHCARD (optional but improves engagement)
  - Single image card, full-width on mobile
  - Shows target word image (e.g. blue swatch, blue object)
  - Displays target text below image (e.g. "blue")
  - assetType: 'image'
  - Visible during teacher model AND child response window

Audio-only fallback: YES
  - If FLASHCARD not available: exercise runs without visual
  - Teacher speech compensates ("Listen — blue! The colour blue!")
```

---

### Exercise Type 2: LISTEN AND POINT

**`textbookActivityType`:** `LISTEN_AND_POINT`
**Textbook label:** "Listen and point"
**Appears in:** Introduction phase, PB page scenes
**KB1 examples:** "Listen and point" (PB p.4 — point to Star family characters), classroom objects scene (Unit 2)

#### 2.0 Implementation Classification

| Question | Answer |
|---|---|
| **Textbook-equivalent mode** | ❌ NO — requires image grid + tap/point interaction. Voice-only cannot be LISTEN_AND_POINT. |
| **AI-native adaptation available** | ✅ YES — LISTEN_AND_CHOOSE (binary audio choice) achieves vocabulary identification without images |
| **Degraded fallback available** | ✅ YES — LISTEN_AND_CHOOSE, but it must be labelled as a different exercise type |
| **Can we support it today?** | ❌ NO — only degraded LISTEN_AND_CHOOSE fallback is available today |
| **Can we support it without assets?** | ❌ NO — without image grid, the exercise type fundamentally changes to LISTEN_AND_CHOOSE |
| **Mandatory assets for production** | Image grid (3–4 items), tap event pipeline from frontend to engine |
| **Acceptable temporary fallback** | LISTEN_AND_CHOOSE (binary audio choice) — clearly labelled as fallback mode |
| **Must NOT ship as textbook-equivalent** | Audio-only "say the word" must NOT be presented or recorded as LISTEN_AND_POINT. When running in audio-only mode, the exercise must be classified and logged as LISTEN_AND_CHOOSE, not LISTEN_AND_POINT. |

> **Correction from v1.0:** The v1.0 spec classified audio fallback as acceptable under the LISTEN_AND_POINT label. This is wrong. When no image grid is available, the exercise type changes. The engine must emit `textbookActivityType: 'LISTEN_AND_CHOOSE'` in session logs, not `'LISTEN_AND_POINT'`.

#### 2.1 Teaching Flow

**TEXTBOOK-EQUIVALENT MODE (requires IMAGE_GRID):**
```
Step 1 — TEACHER NAMES:
  Teacher says: "Point to [target word]!"
  TTS plays. Visual grid of 3–4 items shown on screen.

Step 2 — CHILD ACTS:
  Child taps/clicks the correct item on screen.

Step 3 — ENGINE EVALUATES:
  Tap event on correct assetId → CORRECT
  Tap event on wrong assetId → WRONG

Step 4 — TEACHER REACTS:
  If correct: "Yes! [word]! Great pointing!"
  If wrong: No "wrong" marker. Teacher re-names and re-points:
    "Listen again — [word]! Can you find [word]?"

Step 5 — COMPLETION:
  CORRECT_CHOICE rule: 1 correct tap → advance.
```

**DEGRADED FALLBACK MODE (no IMAGE_GRID — run as LISTEN_AND_CHOOSE):**
```
Engine reclassifies exercise as LISTEN_AND_CHOOSE.
Teacher says: "Is it [choiceA] or [choiceB]?"
Child answers verbally. STT evaluates.
Session log records: textbookActivityType = 'LISTEN_AND_CHOOSE' (not LISTEN_AND_POINT).
```

#### 2.2 Media Requirements

| Media | Required for textbook-equivalent | Required for AI-native | Type | Notes |
|---|---|---|---|---|
| Audio | **YES** | **YES** | `tts_prompt` | Teacher instruction generated at runtime |
| Image grid | **YES** | **NO** | `image` — multiple | 3–4 flashcards displayed simultaneously; tap targets required |
| Video | NO | NO | — | Not used |

**BLOCKING condition:** If `requiresVisualUI: true` and no image grid available → reclassify to `LISTEN_AND_CHOOSE`. Do not run as LISTEN_AND_POINT.

#### 2.3 Child Interaction Model

**`studentActionType`:** `TAP_TARGET` (textbook-equivalent) or `SAY_CHOICE` (AI-native / degraded fallback)

Textbook-equivalent:
- Child taps the matching image
- No speech required

Degraded fallback (LISTEN_AND_CHOOSE):
- Child says one of the two spoken options
- Does NOT need to produce a sentence

#### 2.4 Success Criteria

| Criterion | Value |
|---|---|
| `completionRule.type` | `CORRECT_CHOICE` |
| `requiredCorrectCount` | `1` |
| `allowPartialCompletion` | `false` |

#### 2.5 Escalation Ladder

| Attempt | `escalationLadder[n]` | Teacher says |
|---|---|---|
| 1 | `REPEAT_PROMPT` | "Let's try again! Point to [word]." |
| 2 | `SIMPLIFY_CHOICES` | "Listen carefully — is it [choiceA] or [choiceB]?" (reduces to 2 options) |
| 3 | `MOVE_ON` | "Let me show you — it's [word]! Well done for trying." |

`maxAttempts` = 3.

#### 2.6 Recovery Behaviour

| Scenario | Teacher Behaviour |
|---|---|
| Silence | Re-name the target word. Wait. |
| Wrong tap (visual) | Highlight correct item briefly + re-name. |
| Wrong word (audio fallback) | Re-model + re-invite. No correction marker. |
| Random speech | Re-focus: "Find [word]!" |

#### 2.7 UI Requirements

```
TEXTBOOK-EQUIVALENT: IMAGE_GRID required
  - 3–4 image cards in a grid layout
  - Each card: image + label text below
  - Cards must be tappable — touch/click event sent to backend
  - Correct card highlighted on success (green glow, 500ms)
  - Wrong card: no red — silently stay, re-prompt
  - Cannot ship in production without this component

DEGRADED FALLBACK (no IMAGE_GRID):
  - Reclassify exercise as LISTEN_AND_CHOOSE in session logs
  - Run binary audio choice: "Is it [choiceA] or [choiceB]?"
  - No image required
  - Must NOT label this as LISTEN_AND_POINT in any user-facing context
```

---

### Exercise Type 3: LISTEN AND CHOOSE

**`textbookActivityType`:** `LISTEN_AND_CHOOSE`
**Runtime implementation:** `KidsCurriculumActivityType.FORCED_CHOICE_AUDIO`
**Textbook label:** "Listen and say the colour" / binary choice exercises
**Appears in:** Practice phase, after vocabulary introduction
**KB1 examples:** "Blue or green?" (PB p.7), "Pink or purple?" (PB p.7)

#### 3.0 Implementation Classification

| Question | Answer |
|---|---|
| **Textbook-equivalent mode** | ✅ YES — audio binary choice is the native format |
| **AI-native adaptation available** | ✅ YES — same as textbook-equivalent |
| **Degraded fallback available** | N/A |
| **Can we support it today?** | ✅ YES — fully implemented as FORCED_CHOICE_AUDIO |
| **Can we support it without assets?** | ✅ YES — no visual assets required |
| **Mandatory assets for production** | None |
| **Acceptable temporary fallback** | N/A |
| **Must NOT ship as textbook-equivalent** | N/A |

#### 3.1 Teaching Flow

```
Step 1 — TEACHER PRESENTS CHOICE:
  Teacher says: "[choiceA] or [choiceB]? Which colour is it?"
  Both words spoken clearly in sequence.
  Pause between choiceA and choiceB.

Step 2 — CHILD CHOOSES:
  Child says one of the two words.
  STT captures.

Step 3 — ENGINE EVALUATES:
  Transcript matched against choices[].
  CORRECT = transcript matches expectedAnswers[].
  WRONG = transcript matches the distractor choice.
  UNRECOGNISED = transcript matches neither.

Step 4 — TEACHER REACTS:
  Correct: "Yes! [choiceA]! Great!" + implicit recast.
  Wrong: No "wrong". Re-present choices: "[choiceA] or [choiceB]? Listen again."
  Unrecognised: Re-present choices more slowly.

Step 5 — COMPLETION:
  CORRECT_CHOICE rule: 1 correct answer → advance.
```

#### 3.2 Media Requirements

| Media | Required | Type | Notes |
|---|---|---|---|
| Audio | **YES** | `tts_prompt` | Teacher choice presentation, both options spoken |
| Image | NO (optional) | `image` — dual flashcard | Two flashcards side-by-side; optional enhancement |
| Video | NO | — | Not used |

Audio-only: YES. This exercise is fully audio-safe by design.

#### 3.3 Child Interaction Model

**`studentActionType`:** `SAY_CHOICE`

The child:
- Listens to both options
- Says ONE of the two words
- Does not need to say "It's [word]" — single-word answer accepted

#### 3.4 Success Criteria

| Criterion | Value |
|---|---|
| `completionRule.type` | `CORRECT_CHOICE` |
| `requiredCorrectCount` | `1` |
| `allowPartialCompletion` | `false` |

#### 3.5 Escalation Ladder

| Attempt | `escalationLadder[n]` | Teacher says |
|---|---|---|
| 1 | `REPEAT_PROMPT` | "[choiceA] or [choiceB]? Which one?" — repeat both options |
| 2 | `MODEL_ANSWER` | "Listen — it's [expectedAnswer]! Say [expectedAnswer]!" |
| 3 | `MOVE_ON` | "Well done for trying! It's [expectedAnswer]. Let's go!" |

`maxAttempts` = 3. `resetOnCorrect` = `true`.

#### 3.6 Recovery Behaviour

| Scenario | Teacher Behaviour |
|---|---|
| Silence | Re-present both options at slower pace. |
| Names wrong option | No correction. Repeat both options with equal stress. |
| Names unknown word | Re-present: "[choiceA] or [choiceB]? Just one of these two!" |
| L1 | Acknowledge. Re-present in English. |

#### 3.7 UI Requirements

```
Required UI component: QUESTION_PROMPT (text label only — no images required)
  - Displays: "[choiceA]  OR  [choiceB]?"
  - Large, readable text
  - Both words displayed simultaneously while child is responding
  - Optional: two small flashcard thumbnails

Audio-only fallback: YES — this is the primary mode.
```

---

### Exercise Type 4: ASK AND ANSWER

**`textbookActivityType`:** `ASK_AND_ANSWER`
**Textbook label:** "Ask and answer" / Pair work
**Appears in:** Consolidation and production phases
**KB1 examples:** "What's your name? / I'm [name]" (PB p.4), "How are you?" (PB p.5), "What colour is it?" (PB p.7)

#### 4.0 Implementation Classification

| Question | Answer |
|---|---|
| **Textbook-equivalent mode** | ✅ YES — dialogue is audio-native; pair work adapted to child + AI teacher |
| **AI-native adaptation available** | ✅ YES — AI teacher plays both roles (asks + models), child produces answer |
| **Degraded fallback available** | N/A |
| **Can we support it today?** | ⚠️ PARTIAL — single-phase answer works; two-phase (ask + answer) not yet implemented |
| **Can we support it without assets?** | ✅ YES — no visual assets required |
| **Mandatory assets for production** | None |
| **Acceptable temporary fallback** | Run as answer-only (skip question-production sub-phase) until two-phase engine built |
| **Must NOT ship as textbook-equivalent** | N/A |

#### 4.1 Teaching Flow

```
This exercise runs in two sub-phases:

SUB-PHASE A — QUESTION PRACTICE:
  Step 1: Teacher models the question: "Listen — What's your name?"
  Step 2: Teacher invites: "Now you ask! Say: What's your name?"
  Step 3: Child produces the question.
  Step 4: Engine evaluates for question frame match.
  Step 5: Teacher confirms + models answer pattern.

SUB-PHASE B — ANSWER PRACTICE:
  Step 1: Teacher models the answer: "I'm [childName]. Your turn!"
  Step 2: Child produces the answer with their own name/value.
  Step 3: Engine evaluates for sentence frame match
           (normalizedAnswer prefix: "i'm", "it's", "i'm fine").
  Step 4: Teacher confirms with specific praise.

COMPLETION: Both sub-phases complete → exercise advances.

NOTE: Sub-phase A may be teacher-modelled-only in early units
(child watches teacher demonstrate the question).
Child production begins at sub-phase B.
```

#### 4.2 Media Requirements

| Media | Required | Type | Notes |
|---|---|---|---|
| Audio | **YES** | `tts_prompt` | Question model + answer model generated at runtime |
| Image | NO (optional) | `image` — scene card | Contextual scene showing the question context |
| Video | NO | — | Not used |

Audio-only: YES.

#### 4.3 Child Interaction Model

**`studentActionType`:** `ASK_QUESTION` (sub-phase A) then `ANSWER_QUESTION` (sub-phase B)

Sub-phase A:
- Child repeats or produces the question frame
- Accepted answers include sentence frame with any valid slot value

Sub-phase B:
- Child produces the answer with their own name, number, colour
- Engine matches on prefix ("i'm", "it's") not on the slot value

#### 4.4 Success Criteria

| Phase | `completionRule.type` | Trigger |
|---|---|---|
| Question | `CORRECT_REPETITIONS` | `requiredCorrectCount: 1` — question frame recognized |
| Answer | `CORRECT_REPETITIONS` | `requiredCorrectCount: 1` — answer frame recognized |
| Full exercise | Both phases complete |

#### 4.5 Escalation Ladder

**Question ladder:**

| Attempt | Escalation | Teacher says |
|---|---|---|
| 1 | `REPEAT_PROMPT` | "Say it with me — What's your name?" |
| 2 | `MODEL_ANSWER` | "Listen! What's… your… name? Your turn!" |
| 3 | `MOVE_ON` | "Let me ask! What's your name? And you say: I'm [childName]!" |

**Answer ladder:**

| Attempt | Escalation | Teacher says |
|---|---|---|
| 1 | `REPEAT_PROMPT` | "I'm [childName]. You say: I'm [childName]!" |
| 2 | `MODEL_ANSWER` | "Start with I'm… I'm… [childName]! You try!" |
| 3 | `MOVE_ON` | "I'm [childName]! Let's say it together — I'm [childName]!" |

#### 4.6 Recovery Behaviour

| Scenario | Teacher Behaviour |
|---|---|
| Silence on question | Chunked prompt: "Say: What's… your… name?" |
| Silence on answer | Sentence frame cue: "Start with I'm…" |
| Partial answer ("name only, no I'm") | Accept partial as near-correct; praise + recast full frame |
| Wrong slot value | Accept — slot value is free production; only frame matters |
| L1 | Acknowledge; re-model English frame |

#### 4.7 UI Requirements

```
Required UI component: QUESTION_PROMPT
  - Displays the question frame text
  - Fills screen during production window
  - Optional: speech bubble icon indicating "your turn to talk"

Optional: DIALOGUE_SCENE image showing two cartoon characters speaking
  - assetType: 'image'
  - Not required for audio-only operation
```

---

### Exercise Type 5: CHANT

**`textbookActivityType`:** `CHANT`
**Textbook label:** "Say the chant" / "Chant"
**Appears in:** Introduction and consolidation phases
**KB1 examples:** Numbers chant (PB p.5), colours chant (PB p.7), unit chants across all 12 units

#### 5.0 Implementation Classification

| Question | Answer |
|---|---|
| **Textbook-equivalent mode** | ⚠️ PARTIAL — textbook uses pre-recorded chant audio with melody/rhythm. TTS is rhythm approximation only. |
| **AI-native adaptation available** | ✅ YES — TTS rhythmic delivery is a valid AI-native chant format; pedagogically sound |
| **Degraded fallback available** | N/A — TTS delivery is the AI-native mode, not a degraded fallback |
| **Can we support it today?** | ✅ YES — TTS chant delivery implemented |
| **Can we support it without assets?** | ✅ YES — TTS requires no pre-recorded files |
| **Mandatory assets for production** | None required. Pre-recorded chant audio (`assetType: 'recorded'`) would upgrade to textbook-equivalent. |
| **Acceptable temporary fallback** | TTS rhythmic delivery (current implementation) |
| **Must NOT ship as textbook-equivalent** | Nothing — TTS chant is an honest AI-native format, not a lie about what it is |

#### 5.1 Teaching Flow

```
Step 1 — TEACHER LEADS:
  Teacher says: "Let's say the chant! Listen first."
  Teacher speaks the chant rhythm with all target vocabulary.
  TTS delivers with rhythmic pacing and clear stress.

Step 2 — CHANT TOGETHER:
  Teacher says: "Now together! Say it with me."
  TTS leads. Microphone opens — child joins in.
  Child speaks alongside the teacher (chorus mode).

Step 3 — ENGINE MONITORS:
  STT detects any target words from the chant vocabulary.
  Engine does NOT require perfect reproduction.
  Participation threshold: at least 1 target word detected → JOINED_CHANT.

Step 4 — TEACHER CELEBRATES:
  If participated: "Fantastic! You said the chant!"
  If silent: "Let's try again! Join in with me!"

Step 5 — COMPLETION:
  TEACHER_CONTROLLED: 2 full passes → advance.
  (First pass = teacher leads; second pass = child joins.)
```

#### 5.2 Media Requirements

| Media | Required | Type | Notes |
|---|---|---|---|
| Audio | **YES** | `tts_prompt` (default) OR `recorded` (upgrade) | TTS rhythmic delivery is AI-native mode; `recorded` = textbook-equivalent upgrade |
| Image | NO (optional) | `image` — chant panel | Text of chant lines displayed (lyric panel); not required |
| Video | NO | — | Not used |

#### 5.3 Child Interaction Model

**`studentActionType`:** `JOIN_CHANT`

The child:
- Listens to the teacher lead the chant
- Joins in on the second pass
- Does NOT need to recite perfectly — partial participation accepted
- Engine detects any known target words from the chant vocabulary

#### 5.4 Success Criteria

| Criterion | Value |
|---|---|
| `completionRule.type` | `TEACHER_CONTROLLED` |
| `maxAttempts` | `2` (two full passes) |
| `allowPartialCompletion` | `true` |

Minimum participation: at least 1 target vocabulary word detected in STT output.

#### 5.5 Escalation Ladder

| Attempt | Escalation | Teacher says |
|---|---|---|
| 1 | `ENCOURAGEMENT` | "Great effort! Say it one more time with me!" |
| 2 | `MOVE_ON` | "Well done! That was a great chant!" |

#### 5.6 Recovery Behaviour

| Scenario | Teacher Behaviour |
|---|---|
| Complete silence | Re-lead one more time: "Join in! [first word of chant]…" |
| Only partial words | Accept as success — chanting is participatory, not perfect |
| Mumbling / humming | Accept as participation |
| Off-topic speech | Redirect warmly: "Let's do the chant! [start of chant]…" |

#### 5.7 UI Requirements

```
Required UI component: CHANT_PANEL (optional but recommended)
  - Displays chant lines as text, one line per beat
  - Highlights current line as teacher speaks
  - Large, colourful text — suitable for ages 6–9

Audio-only fallback: YES
  - CHANT_PANEL not required for exercise to run
  - Teacher speech carries the full activity
```

---

### Exercise Type 6: SONG

**`textbookActivityType`:** `SONG`
**Textbook label:** "Sing the song"
**Appears in:** Most units, consolidation phase
**KB1 examples:** Rainbow song / "I can sing a rainbow" (Unit 1, PB p.7), birthday song (Unit 12)

#### 6.0 Implementation Classification

| Question | Answer |
|---|---|
| **Textbook-equivalent mode** | ❌ NO — requires licensed/approved song audio with melody. TTS speech is not a song. |
| **AI-native adaptation available** | ⚠️ PARTIAL — AI teacher can lead a vocabulary chant over the song structure (AI-native CHANT mode), but this is not "singing a song" |
| **Degraded fallback available** | ✅ YES — TTS spoken vocabulary with song framing (dev placeholder ONLY) |
| **Can we support it today?** | ❌ NO — no song audio assets exist; only TTS degraded fallback |
| **Can we support it without assets?** | ❌ NO — without music audio, the exercise type must change to CHANT or vocabulary review |
| **Mandatory assets for production** | Licensed or AI-generated music audio file with melody, uploaded to CDN; frontend song player component |
| **Acceptable temporary fallback** | TTS vocabulary chant framed as "let's practice the song words" — honest about what it is |
| **Must NOT ship as textbook-equivalent** | TTS speech must NOT be presented to the child as "our song" or "let's sing". Teacher saying "Now let's sing!" while playing TTS speech is a lie about the format. This must not ship in production. |

> **Correction from v1.0:** The v1.0 spec classified TTS fallback as "Audio-only fallback: YES" under SONG. This was wrong. TTS delivery of song vocabulary is not a song. The exercise type changes when no music asset is available. The Rainbow song exercise in Unit 1 must show `available: false` until a music audio file is procured and uploaded.

#### 6.1 Teaching Flow

**TEXTBOOK-EQUIVALENT MODE (requires recorded audio):**
```
Step 1 — TEACHER INTRODUCES:
  Teacher says: "Now let's sing our song! Listen first."

Step 2 — SONG PLAYS:
  Pre-recorded song audio plays in full.
  Child listens on first pass (LISTEN_ONLY).

Step 3 — SING TOGETHER:
  Teacher says: "Now sing with me!"
  Song audio plays again. Microphone opens.
  Child sings or speaks along.

Step 4 — ENGINE MONITORS:
  STT detects any song vocabulary words.
  Minimum: 2 target vocabulary words detected → JOINED_SONG.

Step 5 — TEACHER CELEBRATES:
  "Wonderful singing! You did it!"

Step 6 — COMPLETION:
  TEACHER_CONTROLLED: 2 passes → advance.
```

**DEGRADED FALLBACK MODE (no audio asset — dev placeholder only):**
```
Engine reclassifies as CHANT or vocabulary REVIEW.
Teacher says: "Let's practice the song words!"
TTS delivers vocabulary in sequence.
Session log records: textbookActivityType = 'CHANT' (not SONG).
Teacher never says "sing" or "song" in this mode.
```

#### 6.2 Media Requirements

| Media | Required for textbook-equivalent | Required for AI-native | Type | Notes |
|---|---|---|---|---|
| Song audio | **YES** | **NO** | `recorded` | Licensed or AI-generated music file with melody; must be uploaded to CDN |
| Song panel / lyrics | NO (optional) | NO | `image` | Illustration matching song theme; optional enhancement |
| Video | NO | NO | — | Not used |

**BLOCKING condition:** If no `recorded` song audio available → reclassify exercise to CHANT. Do not run as SONG with TTS speech.

#### 6.3 Child Interaction Model

**`studentActionType`:** `JOIN_SONG` (textbook-equivalent) or `JOIN_CHANT` (degraded fallback)

Textbook-equivalent:
- Child listens on first pass (no production required)
- Sings or speaks along on second pass
- Melody is not evaluated — only vocabulary word recognition

#### 6.4 Success Criteria

| Criterion | Value |
|---|---|
| `completionRule.type` | `TEACHER_CONTROLLED` |
| `maxAttempts` | `2` |
| `allowPartialCompletion` | `true` |

Minimum participation: 2 vocabulary words detected, OR 3-second speech segment detected.

#### 6.5 Escalation Ladder

| Attempt | Escalation | Teacher says |
|---|---|---|
| 1 | `ENCOURAGEMENT` | "Amazing! Let's sing it one more time!" |
| 2 | `MOVE_ON` | "Beautiful singing! That was our song!" |

#### 6.6 Recovery Behaviour

| Scenario | Teacher Behaviour |
|---|---|
| Complete silence | "Let's try! Just sing the colours — [first lyric]…" |
| Mumbling / approximation | Accept — song participation is about joining, not perfection |
| Asks about the song | Brief answer + redirect to singing |

#### 6.7 UI Requirements

```
TEXTBOOK-EQUIVALENT: SONG_PLAYER required
  - Frontend audio player for pre-recorded song file
  - Displays song title
  - Shows play/pause state (teacher-controlled, not child-controlled)
  - Optional: scrolling lyrics panel synchronized with audio
  - Optional: song illustration (scene card)
  - Cannot ship as SONG without audio file available

DEGRADED FALLBACK (no audio asset):
  - Reclassify exercise as CHANT in session logs and curriculum state
  - No SONG_PLAYER shown
  - TTS delivers vocabulary sequence rhythmically
  - Teacher never uses the word "sing" in this mode
  - Label internally as: song_fallback_mode = true
```

---

### Exercise Type 7: STORY LISTEN

**`textbookActivityType`:** `STORY_LISTEN`
**Textbook label:** "Listen to the story"
**Appears in:** One story sequence per unit (Star family narrative in KB1)
**KB1 examples:** Star family story (PB story pages, every unit), character panels

#### 7.0 Implementation Classification

| Question | Answer |
|---|---|
| **Textbook-equivalent mode** | ❌ NO — requires story panel images (one image per panel). Voice-only is not the textbook format. |
| **AI-native adaptation available** | ✅ YES — voice-only narration with verbal scene description is a valid AI listening activity |
| **Degraded fallback available** | ✅ YES — voice-only narration with comprehension check runs today |
| **Can we support it today?** | ⚠️ PARTIAL — voice-only narration runs, but is not textbook-equivalent |
| **Can we support it without assets?** | ❌ NOT as textbook-equivalent — without images it becomes a voice-only listening activity, not a story |
| **Mandatory assets for production** | Story panel images (one per panel, approximately 5–6 per unit × 12 units = ~65 images total) |
| **Acceptable temporary fallback** | Voice-only narration + comprehension check, labelled as "listening activity" (not "story") internally |
| **Must NOT ship as textbook-equivalent** | Voice-only narration must NOT be presented as the Kid's Box story experience. If images are absent, the activity must be internally classified as LISTEN_AND_ANSWER, not STORY_LISTEN. |

> **Correction from v1.0:** The v1.0 spec classified voice-only narration as an acceptable fallback under STORY_LISTEN. This understated the gap. Without images, a child cannot follow the Star family characters, cannot see the panels, and is having a completely different experience from the textbook. The degraded mode is valid as a temporary measure but must not be called STORY_LISTEN in production.

#### 7.1 Teaching Flow

**TEXTBOOK-EQUIVALENT MODE (requires story panel images):**
```
Story exercises are multi-panel sequences. Each panel = one story beat.

For each panel:

  Step 1 — PANEL SHOWN + TEACHER NARRATES:
    Story panel image appears on screen.
    Teacher speaks the panel narration (NarrationText from KidsStoryPanel).
    TTS plays. Story panel image visible throughout.

  Step 2 — COMPREHENSION CHECK (if defined):
    After narration, teacher asks the comprehension question.
    "What colour is [character]'s [object]?"
    Microphone opens for child response.

  Step 3 — ENGINE EVALUATES:
    Child answer matched against comprehensionKeywords[].
    Keywords are individual words, not full sentences.
    Any keyword detected → COMPREHENSION_CORRECT.

  Step 4 — TEACHER CONFIRMS:
    Correct: "Yes! It's [answer]! Let's see what happens next."
    Incorrect/silent: "Listen again. [re-reads panel narration]."

  Step 5 — ADVANCE:
    Panel marked complete. Next panel begins.

Story completes when all panels processed.
```

**DEGRADED FALLBACK MODE (no images — internally classified as LISTEN_AND_ANSWER):**
```
No image grid shown. Teacher narrates with embedded visual description.
Teacher says: "Listen! [Star character] says: Hello! He has a red ball."
Comprehension check fires as normal.
Session log records: textbookActivityType = 'LISTEN_AND_ANSWER' (not STORY_LISTEN).
This mode is valid for internal dev testing only.
```

#### 7.2 Media Requirements

| Media | Required for textbook-equivalent | Required for AI-native | Type | Notes |
|---|---|---|---|---|
| Audio narration | **YES** | **YES** | `tts_prompt` | Narration TTS per panel; no pre-recorded story audio required |
| Story panel images | **YES** | **NO** | `image` — story panel | One image per story panel; mandatory for textbook-equivalent mode |
| Video | NO | NO | — | Not used |

**BLOCKING condition:** If no story panel images available → reclassify exercise to `LISTEN_AND_ANSWER`. Do not run as STORY_LISTEN.

#### 7.3 Child Interaction Model

**`studentActionType`:** `LISTEN_ONLY` (for narration panels) + `ANSWER_QUESTION` (for comprehension checks)

Per panel:
- Child listens to narration (LISTEN_ONLY) — no production required
- After comprehension question: child answers with keyword(s)
- Not every panel has a comprehension question — teacher decides

#### 7.4 Success Criteria

| Per Panel | Rule |
|---|---|
| Narration panels | `TEACHER_CONTROLLED` — auto-advance after narration completes |
| Comprehension panels | `CORRECT_CHOICE` — 1 correct keyword detected |
| Story completion | `ALL_TARGETS_COMPLETED` — all panels processed |

#### 7.5 Escalation Ladder

For comprehension questions:

| Attempt | Escalation | Teacher says |
|---|---|---|
| 1 | `REPEAT_PROMPT` | "[Re-reads relevant line.] What do you think?" |
| 2 | `MODEL_ANSWER` | "It's [comprehension keyword]! Can you say that?" |
| 3 | `MOVE_ON` | "It's [answer]! Let's continue the story." |

For narration panels (no escalation — teacher-controlled auto-advance):
- Wait 1.5s after TTS completes → auto-advance to next panel.

#### 7.6 Recovery Behaviour

| Scenario | Teacher Behaviour |
|---|---|
| Child asks about characters | Brief answer + "Let's keep listening!" |
| Child retells story unprompted | Celebrate + redirect: "Yes! And what happens next?" |
| Child speaks L1 about story | Acknowledge + re-read panel in English |
| Comprehension guess incorrect | Re-read the relevant sentence. Ask again. |

#### 7.7 UI Requirements

```
TEXTBOOK-EQUIVALENT: STORY_PANEL required
  - Full-screen or large story image for current panel
  - Panel number indicator (e.g. "Panel 2 of 5")
  - Narration text displayed as subtitle (optional — for accessibility)
  - Comprehension question overlay when question fires
  - Auto-advance animation between panels (gentle transition)
  - Cannot ship as STORY_LISTEN without panel images available

DEGRADED FALLBACK (no images):
  - Reclassify exercise as LISTEN_AND_ANSWER in session logs
  - No STORY_PANEL shown
  - Teacher narration includes embedded visual descriptions
  - Label internally: story_fallback_mode = true
  - Must NOT present this to users as "the story"
```

---

### Exercise Type 8: REVIEW

**`textbookActivityType`:** `REVIEW`
**Textbook label:** "Look and say" / "Say the [vocabulary set]" / Bingo / Consolidation
**Appears in:** Consolidation phase + end-of-unit review blocks
**KB1 examples:** "Say all the colours" (PB p.7 end of lesson), unit review games

#### 8.0 Implementation Classification

| Question | Answer |
|---|---|
| **Textbook-equivalent mode** | ✅ YES — free production is audio-native; visual grid is enhancement only |
| **AI-native adaptation available** | ✅ YES — same as textbook-equivalent |
| **Degraded fallback available** | N/A |
| **Can we support it today?** | ✅ YES — fully implemented (readiness opener, free production, lesson close) |
| **Can we support it without assets?** | ✅ YES — no visual assets required |
| **Mandatory assets for production** | None |
| **Acceptable temporary fallback** | N/A |
| **Must NOT ship as textbook-equivalent** | N/A |

#### 8.1 Teaching Flow

Review exercises have three sub-types:

**8.1A — FREE PRODUCTION REVIEW (primary)**
```
Step 1: Teacher cycles through all target items, inviting free production.
  "Let's say all the colours! Blue — now you!"
  Child says each colour.
  Engine evaluates each response independently.

Step 2: Teacher celebrates partial success.
  "Amazing! You said [n] colours today!"

Step 3: TEACHER_CONTROLLED completion after all items attempted.
```

**8.1B — READINESS EXERCISE (lesson opener)**
```
Step 1: Teacher greets and sets up: "Are you ready? Let's learn colours!"
Step 2: Child responds (any utterance, even "yes" in L1 accepted).
Step 3: TEACHER_CONTROLLED completion after 1 turn.
  → Sets hasStartedFirstExercise = true.
  → Advances to first teaching exercise.
```

**8.1C — LESSON CLOSE EXERCISE**
```
Step 1: Teacher celebrates: "Well done! We finished colours today!"
Step 2: LISTEN_ONLY — no child production required.
Step 3: TEACHER_CONTROLLED completion after 1 turn.
  → Lesson marked complete.
```

#### 8.2 Media Requirements

| Media | Required | Type | Notes |
|---|---|---|---|
| Audio | **YES** | `tts_prompt` | Teacher praise + vocabulary cycle generated at runtime |
| Image | NO (optional) | `image` — flashcard grid | All vocabulary flashcards shown simultaneously in review grid |
| Video | NO | — | Not used |

#### 8.3 Child Interaction Model

| Sub-type | `studentActionType` |
|---|---|
| Free production review | `FREE_PRODUCTION` |
| Readiness opener | `LISTEN_ONLY` (any response accepted) |
| Lesson close | `LISTEN_ONLY` |

#### 8.4 Success Criteria

| Sub-type | `completionRule.type` | Trigger |
|---|---|---|
| Free production | `TEACHER_CONTROLLED` | All items attempted OR `maxAttempts` reached |
| Readiness | `TEACHER_CONTROLLED` | Any response (or silence after 2s timeout) |
| Lesson close | `TEACHER_CONTROLLED` | After TTS completes |

`allowPartialCompletion: true` for free production and lesson close.

#### 8.5 Escalation Ladder

Free production:

| Attempt | Escalation | Teacher says |
|---|---|---|
| 1 | `ENCOURAGEMENT` | "Try one more! Which colour?" |
| 2 | `MOVE_ON` | "Well done! You remembered so many colours!" |

Readiness/Close: no escalation — `MOVE_ON` directly.

#### 8.6 Recovery Behaviour

| Scenario | Teacher Behaviour |
|---|---|
| Silent on free production | Cue one item: "[word]? Can you say [word]?" |
| Names wrong item | Accept + continue cycling: "Yes! And [next word]?" |
| Names same word twice | Accept + gently cycle: "Good! Now [different word]?" |

#### 8.7 UI Requirements

```
Free production:
  Required UI component: FLASHCARD_GRID (optional)
    - All vocabulary flashcards shown at once
    - Small cards, grid layout, 2–3 columns
    - No tap interaction needed — display only

Readiness/Close:
  No UI component required.
  Teacher speech carries the exercise.
```

---

### Exercise Type 9: PHONICS

**`textbookActivityType`:** `PHONICS`
**Textbook label:** "Listen and say the sound" / phonics tongue twister
**Appears in:** One per unit, introduction or consolidation phase
**KB1 examples:** /s/ sound — "Six stars" tongue twister (PB p.8, TB p.20), /æ/ "bag" (Unit 2)

#### 9.0 Implementation Classification

| Question | Answer |
|---|---|
| **Textbook-equivalent mode** | ✅ YES — phoneme isolation is audio-native in the textbook |
| **AI-native adaptation available** | ✅ YES — same as textbook-equivalent |
| **Degraded fallback available** | N/A |
| **Can we support it today?** | ⚠️ PARTIAL — word repetition works; word-initial phoneme matching not yet built |
| **Can we support it without assets?** | ✅ YES — no visual assets required |
| **Mandatory assets for production** | None. Flashcard with highlighted letter is optional enhancement. |
| **Acceptable temporary fallback** | Accept full-word repetition as proxy for phoneme success (word contains phoneme) |
| **Must NOT ship as textbook-equivalent** | N/A |

#### 9.1 Teaching Flow

```
Step 1 — INTRODUCE PHONEME:
  Teacher says: "Listen to this sound — [firstPhoneme]. [firstPhoneme]…"
  Teacher isolates the phoneme: "s-s-s!"

Step 2 — CONNECT TO WORD:
  Teacher says: "Now listen — [target word]! It starts with [phoneme]."
  TTS plays: "[phoneme]… [phoneme]… [word]!"

Step 3 — CHILD IMITATES PHONEME:
  Teacher says: "Say it with me — [phoneme]… [word]!"
  Child repeats phoneme + word.

Step 4 — TONGUE TWISTER / PHRASE (if defined):
  Teacher says: "Now try this — [tongue twister text]!"
  Child attempts the phrase.

Step 5 — ENGINE EVALUATES:
  Phoneme presence detected in STT transcript.
  Word-initial phoneme match: checks first phoneme of produced word.
  Success if target word produced with correct initial phoneme.

Step 6 — COMPLETION:
  CORRECT_REPETITIONS: requiredCorrectCount = 2.
```

#### 9.2 Media Requirements

| Media | Required | Type | Notes |
|---|---|---|---|
| Audio | **YES** | `tts_prompt` | Phoneme isolation + word model + tongue twister generated at runtime |
| Image | NO (optional) | `image` — flashcard | Target word flashcard with first letter highlighted |
| Video | NO | — | Not used |

#### 9.3 Child Interaction Model

**`studentActionType`:** `REPEAT_WORD` (phoneme focus)

#### 9.4 Success Criteria

| Phase | `completionRule.type` | Trigger |
|---|---|---|
| Phoneme isolation | `CORRECT_REPETITIONS` | 1 correct — phoneme detected |
| Target word | `CORRECT_REPETITIONS` | `requiredCorrectCount: 2` |
| Tongue twister | `TEACHER_CONTROLLED` | Any attempt accepted |

#### 9.5 Escalation Ladder

| Attempt | Escalation | Teacher says |
|---|---|---|
| 1 | `REPEAT_PROMPT` | "[phoneme]… [phoneme]… Try again! [word]!" |
| 2 | `MODEL_ANSWER` | "Put your [teeth/lips/tongue] like this — [phoneme]! [word]!" |
| 3 | `ENCOURAGEMENT` | "Almost! [phoneme]… You try! [word]!" |
| 4 | `MOVE_ON` | "Well done for trying! [word] starts with [phoneme]!" |

#### 9.6 Recovery Behaviour

| Scenario | Teacher Behaviour |
|---|---|
| Child says word without phoneme | Implicit recast: "[phoneme]… [word]! Try the beginning first." |
| Child says correct phoneme but wrong word | Accept phoneme success; redirect to target word |
| Silent | Model phoneme isolation again slowly |

#### 9.7 UI Requirements

```
Required UI component: FLASHCARD (optional — phoneme highlighted)
  - Target word flashcard
  - First letter displayed in larger size or different colour
  - Phoneme symbol displayed (e.g. "/s/")

Audio-only fallback: YES
  - All phoneme teaching works via voice alone
```

---

### Exercise Type 10: VALUES DISCUSSION

**`textbookActivityType`:** `VALUES_DISCUSSION`
**Textbook label:** "Trevor's values" / CLIL values discussion
**Appears in:** CLIL sections (after Units 2, 6, 10, 12)
**KB1 examples:** Sharing (after Unit 2), Being kind (after Unit 6)

#### 10.0 Implementation Classification

| Question | Answer |
|---|---|
| **Textbook-equivalent mode** | ⚠️ PARTIAL — textbook has values illustration; audio discussion is the primary activity |
| **AI-native adaptation available** | ✅ YES — guided yes/no dialogue is fully achievable in voice-only |
| **Degraded fallback available** | N/A |
| **Can we support it today?** | ⚠️ PARTIAL — any-response evaluator exists (TEACHER_CONTROLLED); open-ended evaluator not yet built |
| **Can we support it without assets?** | ✅ YES — discussion is audio-native |
| **Mandatory assets for production** | None. Values illustration is optional enhancement only. |
| **Acceptable temporary fallback** | TEACHER_CONTROLLED after 2 exchanges (current behaviour) |
| **Must NOT ship as textbook-equivalent** | N/A |

#### 10.1 Teaching Flow

```
Step 1 — TEACHER PRESENTS VALUE:
  Teacher says: "Today we talk about [value]."
  Scene description or story context given in English.
  Simple vocabulary only (pre-A1 level).

Step 2 — GUIDED QUESTION:
  Teacher asks a simple question about the value.
  Example: "Is it nice to share? Yes or no?"

Step 3 — CHILD RESPONDS:
  Child says yes, no, or a single word.
  Any meaningful response accepted.

Step 4 — TEACHER EXTENDS:
  Teacher responds warmly, restates value in simple English.
  "Yes! Sharing is nice! It's good to share."

Step 5 — COMPLETION:
  TEACHER_CONTROLLED: 2 exchanges → advance.
```

#### 10.2 Media Requirements

| Media | Required | Type | Notes |
|---|---|---|---|
| Audio | **YES** | `tts_prompt` | Teacher discussion prompts generated at runtime |
| Image | NO (optional) | `image` — values scene | Illustration of the value in action |
| Video | NO | — | Not used |

#### 10.3 Child Interaction Model

**`studentActionType`:** `FREE_PRODUCTION`

#### 10.4 Success Criteria

| Criterion | Value |
|---|---|
| `completionRule.type` | `TEACHER_CONTROLLED` |
| `maxAttempts` | `2` |
| `allowPartialCompletion` | `true` |

#### 10.5 Escalation Ladder

| Attempt | Escalation | Teacher says |
|---|---|---|
| 1 | `REPEAT_PROMPT` | "What do you think? Is it good or not good?" |
| 2 | `MOVE_ON` | "I think it's [value positive]! It's very nice. Let's go!" |

#### 10.6 Recovery Behaviour

| Scenario | Teacher Behaviour |
|---|---|
| Silence | Simplify to yes/no: "Is it good? Yes or no?" |
| L1 response | Accept + restate in English: "Yes! In English we say: [value]!" |
| Off-topic | Redirect gently back to the value topic |

#### 10.7 UI Requirements

```
Required UI component: QUESTION_PROMPT
  - Simple question text displayed
  - Optional: values illustration scene card

Audio-only fallback: YES
```

---

## Part 1B: Excluded Exercise Types — Textbook-Only Formats

The following Kid's Box activity types appear in the Activity Book (AB) and cannot be implemented voice-only without significant visual UI investment. They are **not in scope for the current audio-first phase**. They are listed here so that future UI phases have an honest starting point.

### LISTEN_AND_COLOUR

**What it is:** Teacher names a colour; child colours a specific object in their Activity Book worksheet.
**Why it cannot be audio-only:** The core mechanic is a child marking a physical or on-screen drawing. There is no audio-only equivalent — colouring IS the exercise.
**AI-native adaptation:** Teacher describes what colour something should be; child responds with vocabulary. This is essentially LISTEN_AND_CHOOSE and must be labelled as such.
**Mandatory assets for production:** On-screen colouring canvas per exercise, coloured-object images, colour tool UI.
**Must NOT ship as textbook-equivalent without:** Interactive colouring canvas.

### LISTEN_AND_MATCH / MATCH

**What it is:** Child draws lines between matching words, images, or sentences.
**Why it cannot be audio-only:** The matching action requires seeing two sets of items simultaneously.
**AI-native adaptation:** Teacher reads one item; child verbally identifies the match from two options. This is LISTEN_AND_CHOOSE.
**Mandatory assets for production:** Two-column match layout with tap-to-link interaction.
**Must NOT ship as textbook-equivalent without:** Visual match UI.

### LISTEN_AND_NUMBER / NUMBER

**What it is:** Child numbers images in the order they hear them.
**Why it cannot be audio-only:** Sequencing a set requires seeing the full set simultaneously.
**AI-native adaptation:** Teacher describes a sequence; child says "first", "second", etc. This is a spoken sequencing exercise (new engine type needed).
**Mandatory assets for production:** Image set with number-input overlay.
**Must NOT ship as textbook-equivalent without:** Visual ordering UI.

### FIND / LISTEN_AND_FIND / LISTEN_AND_CIRCLE

**What it is:** Child finds and circles a target item in a picture or word search.
**Why it cannot be audio-only:** Finding requires scanning a visual field.
**AI-native adaptation:** Teacher describes an item; child says the word. This is LISTEN_AND_REPEAT or LISTEN_AND_CHOOSE.
**Mandatory assets for production:** Full scene image with tappable hotspots.
**Must NOT ship as textbook-equivalent without:** Hotspot scene UI.

---

## Part 2: Exercise Progression and State Contract

### Lesson Structure

Every lesson follows a fixed 5-phase structure:

| Phase | `LessonPhase` | Duration | Allowed Activities | Exit Criteria |
|---|---|---|---|---|
| 1 | `WARM_UP` | 60s | `LISTEN_AND_REPEAT` | Child settled and responding |
| 2 | `INTRODUCTION` | 180s | `LISTEN_AND_REPEAT`, `CHANT` | All target items introduced once |
| 3 | `PRACTICE` | 240s | `LISTEN_AND_REPEAT`, `FORCED_CHOICE_AUDIO` | Each item attempted ≥ 2 times |
| 4 | `CONSOLIDATION` | 120s | `FORCED_CHOICE_AUDIO`, `REVIEW_PRODUCTION` | Production with minimal scaffolding |
| 5 | `CLOSE` | 60s | `REVIEW_PRODUCTION` | Warm lesson end |

### Session State Fields (SessionMemory)

| Field | Type | Description |
|---|---|---|
| `currentExerciseId` | `string \| null` | ID of the active exercise |
| `currentExerciseOrder` | `number \| null` | 1-based position in lesson |
| `currentTargetItemId` | `string \| null` | Current vocabulary item being taught |
| `exerciseAttemptCount` | `number` | Attempts on current exercise (resets on advance) |
| `exerciseCorrectCount` | `number` | Correct responses on current exercise |
| `completedExerciseIds` | `string[]` | All exercises completed in this session |
| `hasStartedFirstExercise` | `boolean` | True after child confirms readiness |
| `exerciseFallbackMode` | `boolean` | True when running degraded fallback (not textbook-equivalent) |
| `effectiveActivityType` | `KidsTextbookActivityType` | Actual type logged — may differ from `textbookActivityType` when degraded |

### Exercise Advance Rules

An exercise advances when ANY of these fire:
1. `CORRECT_REPETITIONS`: `exerciseCorrectCount + 1 >= requiredCorrectCount`
2. `CORRECT_CHOICE`: 1 correct choice made
3. `TEACHER_CONTROLLED`: `exerciseAttemptCount + 1 >= maxAttempts`
4. `MOVE_ON` tier reached in escalation ladder

On advance:
- `completedExerciseIds` += current exercise ID
- `currentExerciseId` = `nextExerciseId`
- `exerciseAttemptCount` = 0
- `exerciseCorrectCount` = 0
- `currentTargetItemId` = first target of next exercise (if exists)

---

## Part 3: Recovery Behaviour Master Table

| Child Signal | STT/Classification Label | Universal Response Rule | Exercise-Specific Override |
|---|---|---|---|
| Complete silence (< 1s) | `SILENCE_SHORT` | Wait silently. Do not interrupt. | None |
| Silence (1–3s) | `SILENCE_MEDIUM` | Re-invite with target: "Can you say [word]?" | STORY panels: auto-advance after narration |
| Silence (> 3s) | `SILENCE_LONG` | Escalate one tier in ladder | CHANT/SONG: one more invitation, then accept partial |
| Correct answer | `CORRECT_CONFIDENT` | Specific praise + implicit recast | — |
| Hesitant correct | `CORRECT_HESITANT` | Warm praise: "Yes! [word]!" + recast | — |
| Near-correct | `NEAR_CORRECT` | Implicit recast only: "[word]! Good!" | — |
| Pronunciation variant | `PRONUNCIATION_VARIANT` | Accept + recast: "Yes! [target]!" | — |
| Wrong answer | `WRONG_ANSWER` | No "wrong" marker. Re-model + re-invite | — |
| Random speech | `RANDOM_SPEECH` | Ignore content. Re-focus: "Say [word]!" | CHANT: accept if any target word detected |
| L1 detected | `L1_DETECTED` | Max 2 L1 words per session. Acknowledge + re-model in English | Values: partial accept if comprehension clear |
| Off-topic / distracted | `DISTRACTED` | Warm re-focus: "Let's keep going! [word]!" | Story: "Let's listen to the story!" |
| Clarification request | `CLARIFICATION_REQUEST` | Answer briefly in English + re-invite | — |
| Background noise | `BACKGROUND_NOISE` | Ignore. Re-invite. | — |

**Hard rules (never override):**
- NEVER say "Wrong" or "That's wrong" or "No, it's..."
- NEVER give explicit grammar labels to a child ("This is the verb…")
- NEVER allow teacher turn > 30 words before next child response

---

## Part 4: Curriculum Mapping Table

### Unit 1: Hello! (PB pp. 4–9, TB pp. 13–22)

The `Audio-Only Safe` column now uses three labels:
- ✅ **Textbook-equivalent** — runs in production without assets
- ⚠️ **AI-native adaptation** — different from textbook format, but honest and pedagogically valid
- ❌ **Degraded fallback only** — must not ship as textbook-equivalent; asset required for production

| KB1 Textbook Exercise | Lesson | Page | `textbookActivityType` | `effectiveActivityType` (fallback) | `studentActionType` | Media Needed | `completionRule.type` | Audio-Only Classification |
|---|---|---|---|---|---|---|---|---|
| Listen and point — characters | L1 | PB p.4 | `LISTEN_AND_POINT` | `LISTEN_AND_CHOOSE` | `SAY_CHOICE` (fallback) | image-grid: 4 characters | `CORRECT_CHOICE` | ❌ Degraded fallback (image grid required) |
| Listen and repeat — Hello, Goodbye | L1 | PB p.4 | `LISTEN_AND_REPEAT` | — | `REPEAT_WORD` | flashcard (optional) | `CORRECT_REPETITIONS` (2) | ✅ Textbook-equivalent |
| Listen and repeat — What's your name? I'm... | L1 | PB p.4 | `LISTEN_AND_REPEAT` | — | `REPEAT_WORD` | none | `CORRECT_REPETITIONS` (2) | ✅ Textbook-equivalent |
| Ask and answer — What's your name? | L1 | PB p.4–5 | `ASK_AND_ANSWER` | — | `ASK_QUESTION` + `ANSWER_QUESTION` | none | `CORRECT_REPETITIONS` (1 per phase) | ✅ Textbook-equivalent |
| Listen and repeat — How are you? | L1 | PB p.5 | `LISTEN_AND_REPEAT` | — | `REPEAT_WORD` | none | `CORRECT_REPETITIONS` (2) | ✅ Textbook-equivalent |
| Numbers chant (1–10) | L1/L3 | PB p.5 | `CHANT` | — | `JOIN_CHANT` | chant-panel (optional) | `TEACHER_CONTROLLED` | ⚠️ AI-native (TTS rhythmic; recorded audio = textbook-equivalent) |
| Readiness opener | L2 | PB p.6 | `REVIEW` | — | `LISTEN_ONLY` | none | `TEACHER_CONTROLLED` | ✅ Textbook-equivalent |
| Listen and repeat — blue | L2 | PB p.6 | `LISTEN_AND_REPEAT` | — | `REPEAT_WORD` | flashcard (optional) | `CORRECT_REPETITIONS` (2) | ✅ Textbook-equivalent |
| Listen and repeat — green | L2 | PB p.6 | `LISTEN_AND_REPEAT` | — | `REPEAT_WORD` | flashcard (optional) | `CORRECT_REPETITIONS` (2) | ✅ Textbook-equivalent |
| Listen and repeat — red | L2 | PB p.6 | `LISTEN_AND_REPEAT` | — | `REPEAT_WORD` | flashcard (optional) | `CORRECT_REPETITIONS` (2) | ✅ Textbook-equivalent |
| Listen and repeat — yellow | L2 | PB p.6 | `LISTEN_AND_REPEAT` | — | `REPEAT_WORD` | flashcard (optional) | `CORRECT_REPETITIONS` (2) | ✅ Textbook-equivalent |
| Listen and repeat — pink | L2 | PB p.6 | `LISTEN_AND_REPEAT` | — | `REPEAT_WORD` | flashcard (optional) | `CORRECT_REPETITIONS` (2) | ✅ Textbook-equivalent |
| Listen and repeat — purple | L2 | PB p.6 | `LISTEN_AND_REPEAT` | — | `REPEAT_WORD` | flashcard (optional) | `CORRECT_REPETITIONS` (2) | ✅ Textbook-equivalent |
| Listen and repeat — orange | L2 | PB p.6 | `LISTEN_AND_REPEAT` | — | `REPEAT_WORD` | flashcard (optional) | `CORRECT_REPETITIONS` (2) | ✅ Textbook-equivalent |
| Listen and choose — blue or green? | L2 | PB p.7 | `LISTEN_AND_CHOOSE` | — | `SAY_CHOICE` | none | `CORRECT_CHOICE` (1) | ✅ Textbook-equivalent |
| Listen and choose — pink or purple? | L2 | PB p.7 | `LISTEN_AND_CHOOSE` | — | `SAY_CHOICE` | none | `CORRECT_CHOICE` (1) | ✅ Textbook-equivalent |
| Listen and choose — red or orange? | L2 | PB p.7 | `LISTEN_AND_CHOOSE` | — | `SAY_CHOICE` | none | `CORRECT_CHOICE` (1) | ✅ Textbook-equivalent |
| Say all colours (review) | L2 | PB p.7 | `REVIEW` | — | `FREE_PRODUCTION` | flashcard-grid (optional) | `TEACHER_CONTROLLED` | ✅ Textbook-equivalent |
| Rainbow colours chant | L2 | PB p.7 | `CHANT` | — | `JOIN_CHANT` | chant-panel (optional) | `TEACHER_CONTROLLED` | ⚠️ AI-native (TTS rhythmic delivery) |
| Lesson close | L2 | PB p.7 | `REVIEW` | — | `LISTEN_ONLY` | none | `TEACHER_CONTROLLED` | ✅ Textbook-equivalent |
| Rainbow song (sing-a-rainbow) | L2 | TB p.17 | `SONG` | `CHANT` | `JOIN_CHANT` (fallback) | **recorded audio required** | `TEACHER_CONTROLLED` | ❌ Degraded fallback (music audio required for production) |
| Listen and repeat — one through ten | L3 | PB p.5 | `LISTEN_AND_REPEAT` | — | `REPEAT_WORD` | flashcard (optional) | `CORRECT_REPETITIONS` (2) | ✅ Textbook-equivalent |
| Count on fingers (TPR) | L3 | TB p.15 | `LISTEN_AND_REPEAT` | — | `REPEAT_WORD` | none | `CORRECT_REPETITIONS` (1) | ✅ Textbook-equivalent |
| Ask and answer — How old are you? | L3 | TB p.20 | `ASK_AND_ANSWER` | — | `ANSWER_QUESTION` | none | `CORRECT_REPETITIONS` (1) | ✅ Textbook-equivalent |
| Phonics — /s/ "Six stars" | L3 | PB p.8 | `PHONICS` | — | `REPEAT_WORD` | flashcard /s/ (optional) | `CORRECT_REPETITIONS` (2) | ⚠️ AI-native (phoneme matching engine partial) |

### Pending Units — Exercise Type Map

| Unit | Title | Expected Exercise Types |
|---|---|---|
| 2 | My school | LISTEN_AND_POINT (scene), LISTEN_AND_REPEAT, LISTEN_AND_CHOOSE, PHONICS /æ/, CHANT, STORY_LISTEN |
| 3 | Favourite toys | LISTEN_AND_REPEAT, ASK_AND_ANSWER, CHANT, SONG, STORY_LISTEN, PHONICS /b/ |
| 4 | My family | LISTEN_AND_REPEAT, ASK_AND_ANSWER, LISTEN_AND_CHOOSE, CHANT, STORY_LISTEN, PHONICS /d/ |
| 5 | Our pets | LISTEN_AND_REPEAT, LISTEN_AND_POINT, ASK_AND_ANSWER, CHANT, STORY_LISTEN, PHONICS /k/ |
| 6 | My face | LISTEN_AND_REPEAT, LISTEN_AND_POINT (body parts), ASK_AND_ANSWER, CHANT, STORY_LISTEN, PHONICS /h/ |
| 7 | Wild animals | LISTEN_AND_REPEAT, LISTEN_AND_CHOOSE, ASK_AND_ANSWER, CHANT, SONG, STORY_LISTEN, PHONICS /l/ |
| 8 | My clothes | LISTEN_AND_REPEAT, LISTEN_AND_POINT, ASK_AND_ANSWER, CHANT, STORY_LISTEN, PHONICS /ʃ/ |
| 9 | Fun time! | LISTEN_AND_REPEAT, ASK_AND_ANSWER, CHANT, SONG, STORY_LISTEN, PHONICS /ɪ/ |
| 10 | At the funfair | LISTEN_AND_REPEAT, ASK_AND_ANSWER, LISTEN_AND_CHOOSE, CHANT, STORY_LISTEN, PHONICS /ɑː/ |
| 11 | Our house | LISTEN_AND_POINT (room scene), ASK_AND_ANSWER, LISTEN_AND_CHOOSE, CHANT, STORY_LISTEN, PHONICS /ɪ/ |
| 12 | Party time! | LISTEN_AND_REPEAT, ASK_AND_ANSWER, CHANT, SONG, STORY_LISTEN, PHONICS /tʃ/ |

---

## Part 5: Visual Asset Specification

### Asset Readiness Status (v2.0 — Corrected)

| Asset Type | `requiresVisualUI` | `allowedWithoutVisualUI` | Fallback mode label | Fallback ships as textbook-equivalent? |
|---|---|---|---|---|
| Flashcard (single word) | `false` | `true` | Same exercise, no visual | ✅ YES |
| Flashcard grid (review) | `false` | `true` | Same exercise, no visual | ✅ YES |
| Image grid (listen and point) | `true` | `false` (reclassify) | `LISTEN_AND_CHOOSE` | ❌ NO — changes exercise type |
| Story panel | `true` | `false` (reclassify) | `LISTEN_AND_ANSWER` | ❌ NO — changes exercise type |
| Song audio file | `false` | `false` (reclassify) | `CHANT` | ❌ NO — changes exercise type |
| Song panel (lyrics) | `false` | `true` | Song without lyric display | ✅ YES (if song audio present) |
| Chant panel (text) | `false` | `true` | Audio-only chant | ✅ YES |
| Dual flashcards (choose) | `false` | `true` | Audio-only binary choice | ✅ YES |
| Values scene | `false` | `true` | Audio-only discussion | ✅ YES |

### Fallback Reclassification Rules

When assets are missing and the exercise must reclassify:

1. `LISTEN_AND_POINT` without image grid → emit `effectiveActivityType: 'LISTEN_AND_CHOOSE'`
2. `STORY_LISTEN` without panel images → emit `effectiveActivityType: 'LISTEN_AND_ANSWER'`
3. `SONG` without recorded audio → emit `effectiveActivityType: 'CHANT'`; teacher never says "sing"

The engine must log `exerciseFallbackMode: true` and `effectiveActivityType` on every exercise where these reclassifications occur, for analytics and quality monitoring.

---

## Part 6: Audio Asset Specification

### TTS (Generated at Runtime)

All teacher speech uses `assetType: 'tts_prompt'` via ElevenLabs:
- Vocabulary model utterances
- Escalation scaffolds
- Praise responses
- Story narration (narration text from KidsStoryPanel)
- Chant delivery (rhythmic TTS — AI-native mode)

### Recorded Audio (Pre-uploaded — Required for Textbook-Equivalent)

| Asset | `assetType` | Status | Blocks textbook-equivalent? |
|---|---|---|---|
| Songs (Rainbow song, Birthday song, etc.) | `recorded` | ❌ Not available | ✅ YES — no song file = no SONG exercise |
| Authentic chant audio | `recorded` | ❌ Not available | ❌ NO — TTS chant is valid AI-native mode |
| Sound effects (success bell, applause) | `sfx` | ❌ Not available | ❌ NO — optional enhancement |

### TTS Delivery Constraints

- Latency budget: < 2.5s from child response end to first audio byte
- Teacher turn maximum: 30 words per turn
- Phonics delivery: slow, deliberate pace; add pauses between phoneme iterations
- Chant delivery: rhythmic, 4/4 beat; consistent stress pattern
- Song fallback (CHANT mode): rhythmic delivery; never use "sing" or "song" phrasing

---

## Part 7: Implementation Checklist

### Already Implemented (as of Phase 13)

- [x] `LISTEN_AND_REPEAT` — full runtime (Unit 1 Colours, 14 exercises)
- [x] `LISTEN_AND_CHOOSE` (as `FORCED_CHOICE_AUDIO`) — full runtime
- [x] `CHANT` — exercise definition + TEACHER_CONTROLLED completion
- [x] `REVIEW` — readiness opener + lesson close + free production
- [x] Exercise escalation ladder — all 5 tiers
- [x] Exercise completion rules — all 5 types
- [x] Session memory fields — all exercise state fields

### Required for Full Kid's Box Coverage (Prioritized)

**Priority 1 — Correctness fixes (no assets needed, engine changes only):**
- [ ] Add `exerciseFallbackMode` and `effectiveActivityType` to session state
- [ ] Engine: reclassify LISTEN_AND_POINT → LISTEN_AND_CHOOSE when no image grid
- [ ] Engine: reclassify STORY_LISTEN → LISTEN_AND_ANSWER when no panel images
- [ ] Engine: reclassify SONG → CHANT when no recorded audio; suppress "sing" phrasing
- [ ] Curriculum data: flag Rainbow song exercise as `available: false` until audio procured

**Priority 2 — Complete audio-native exercise types (no assets needed):**
- [ ] `ASK_AND_ANSWER` — two-phase dialogue exercise (sub-phase sequencer)
- [ ] `VALUES_DISCUSSION` — open-ended evaluator (subset of REVIEW; low effort)
- [ ] `PHONICS` — word-initial phoneme matching in classification engine

**Priority 3 — STORY_LISTEN with images (requires asset production):**
- [ ] Commission/generate story panel images (~65 images across 12 units)
- [ ] Frontend: `STORY_PANEL` component (full-screen image + subtitle overlay + auto-advance)
- [ ] Engine: panel sequencer with comprehension question evaluator
- [ ] Engine: `KidsStoryPanel[]` type already defined — wire up to exercise runner

**Priority 4 — SONG with recorded audio (requires asset production):**
- [ ] Procure or generate licensed music audio for each song (~8 songs across 12 units)
- [ ] Upload to CDN; set `available: true` per song exercise
- [ ] Frontend: `SONG_PLAYER` component (teacher-controlled play, lyric display optional)
- [ ] Engine: distinguish `JOIN_SONG` vs `JOIN_CHANT` completion handling

**Priority 5 — LISTEN_AND_POINT visual mode (requires frontend + assets):**
- [ ] Frontend: `IMAGE_GRID` component with tap event (3–4 items, touch targets)
- [ ] Engine: tap event → answer submission pipeline (WebSocket event type)
- [ ] Asset: image grid sets per exercise (~20–25 exercises across 12 units)

**Priority 6 — Activity Book exercise types (full visual UI — future phase):**
- [ ] LISTEN_AND_COLOUR — on-screen colouring canvas
- [ ] LISTEN_AND_MATCH / MATCH — two-column tap-to-link UI
- [ ] LISTEN_AND_NUMBER / NUMBER — image sequence ordering UI
- [ ] LISTEN_AND_FIND / LISTEN_AND_CIRCLE — hotspot scene image UI

### Exercise Data Still Needed

| Exercise Type | Units Without Data |
|---|---|
| All types | Units 2–12 (pending extraction) |
| `STORY_LISTEN` | All units — story panels not yet authored |
| `SONG` | All units — no recorded audio files |
| `PHONICS` | Units 1–12 — tongue twister texts needed per unit |

---

## Part 8: Prioritized Implementation Roadmap

### Phase A — Honesty fixes (1–2 days, no new features)

Stop misrepresenting degraded modes as textbook-equivalent.

| Task | What changes | Effort |
|---|---|---|
| Add `exerciseFallbackMode: boolean` to SessionMemory | Schema + Redis write | 1h |
| Add `effectiveActivityType` to exercise session log | Engine + analytics | 1h |
| Reclassify LISTEN_AND_POINT in audio-only runtime | Engine check + log | 2h |
| Reclassify SONG → CHANT when no audio asset | Engine check + log | 2h |
| Suppress "sing"/"song" language in CHANT fallback | Prompt template edit | 1h |
| Reclassify STORY_LISTEN → LISTEN_AND_ANSWER when no images | Engine check + log | 2h |
| Flag Rainbow song as `available: false` in curriculum data | Data edit | 30m |

**Outcome:** System is honest about what it is shipping. Analytics show real exercise mix.

### Phase B — Complete audio-native exercises (1 week, no assets)

Unlock the 3 exercise types that need engine work but no visual assets.

| Task | What changes | Effort |
|---|---|---|
| ASK_AND_ANSWER sub-phase sequencer | New engine sub-FSM | 3 days |
| VALUES_DISCUSSION open evaluator | Extend TEACHER_CONTROLLED logic | 0.5 days |
| PHONICS phoneme matching | New classifier rule in classification engine | 2 days |

**Outcome:** 7 of 10 exercise types are fully runnable in production (excluding SONG, STORY_LISTEN, LISTEN_AND_POINT visual).

### Phase C — STORY_LISTEN production (2–4 weeks, requires images)

The story is the emotional core of Kid's Box. Children connect to Star family characters.

| Task | What changes | Effort |
|---|---|---|
| Commission/generate story panel images (Unit 1 first, ~5–6 panels) | Asset production | External |
| Frontend STORY_PANEL component | New React component | 3 days |
| Engine panel sequencer + auto-advance | New exercise runner module | 2 days |
| Comprehension keyword evaluator | Engine + curriculum data | 1 day |
| Unit 1 story data (KidsStoryPanel[] for all panels) | Curriculum data authoring | 1 day |

**Outcome:** First textbook-equivalent STORY_LISTEN in production for Unit 1.

### Phase D — SONG production (1–3 weeks, requires music)

Songs are the highest-engagement moment in a lesson. TTS cannot substitute.

| Task | What changes | Effort |
|---|---|---|
| Generate or license AI music for Unit 1 Rainbow song | Asset production (Suno/Udio/licensed) | External |
| Upload to CDN, set `available: true` | Infra | 2h |
| Frontend SONG_PLAYER component | New React component | 2 days |
| Engine JOIN_SONG completion with audio sync | Engine | 1 day |

**Outcome:** First real song in production. Children can actually sing along.

### Phase E — LISTEN_AND_POINT visual mode (2–3 weeks)

Required for classroom scene exercises in Units 2, 5, 6, 8, 11.

| Task | What changes | Effort |
|---|---|---|
| Commission/generate image grid assets (Unit 2 classroom scene first) | Asset production | External |
| Frontend IMAGE_GRID component with tap events | New React component | 3 days |
| WebSocket tap event → engine answer submission | Protocol + engine | 1 day |
| Engine: switch LISTEN_AND_POINT from LISTEN_AND_CHOOSE when grid available | Engine | 0.5 days |

**Outcome:** True LISTEN_AND_POINT operational for Unit 2+.

### Phase F — Activity Book visual exercises (future — no timeline set)

These require a full visual interaction layer (canvas, drag-drop, coloring tools). Not scheduled for current product phase. Design separately when visual UI investment is committed.

---

## Appendix: Exercise Type Support Matrix

| Exercise Type | Textbook-equivalent today? | AI-native today? | Degraded fallback today? | Blocks launch? |
|---|---|---|---|---|
| LISTEN_AND_REPEAT | ✅ YES | ✅ YES | N/A | No |
| LISTEN_AND_CHOOSE | ✅ YES | ✅ YES | N/A | No |
| CHANT | ⚠️ PARTIAL (TTS) | ✅ YES | N/A | No |
| REVIEW | ✅ YES | ✅ YES | N/A | No |
| ASK_AND_ANSWER | ✅ YES (answer only) | ✅ YES | N/A | No — partial impl acceptable |
| PHONICS | ⚠️ PARTIAL (word-level) | ✅ YES | N/A | No — word-level proxy acceptable |
| VALUES_DISCUSSION | ✅ YES | ✅ YES | N/A | No |
| LISTEN_AND_POINT | ❌ NO | ✅ YES (as LISTEN_AND_CHOOSE) | ✅ YES | No — reclassify in logs |
| STORY_LISTEN | ❌ NO | ✅ YES (voice narration) | ✅ YES | No — reclassify in logs |
| SONG | ❌ NO | ⚠️ PARTIAL (CHANT mode) | ✅ YES | No — reclassify in logs |
| LISTEN_AND_COLOUR | ❌ NO | ❌ NO | ❌ NO | N/A — not in scope |
| LISTEN_AND_MATCH | ❌ NO | ❌ NO | ❌ NO | N/A — not in scope |
| LISTEN_AND_NUMBER | ❌ NO | ❌ NO | ❌ NO | N/A — not in scope |
| LISTEN_AND_FIND | ❌ NO | ❌ NO | ❌ NO | N/A — not in scope |
