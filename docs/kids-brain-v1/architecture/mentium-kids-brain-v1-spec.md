# Mentium Kids Brain v1 — Approved Architecture Specification
**Status:** APPROVED — Final  
**Version:** 1.0  
**Authority:** Architecture Board  
**Source Packs:** Teacher/Methodology Pack (Pack 1), Cognitive Architecture Pack (Pack 2), Learning Engine Pack (Pack 3)  
**Classification key:** [A] Strong evidence / established methodology | [B] Expert consensus / strong pedagogical inference | [C] Hypothesis requiring empirical validation before hardening  

---

## Section 1 — Executive Summary

Mentium Kids Brain v1 is a deterministic, backend-authoritative AI teaching system for children aged 6–9 learning English as a second language. It delivers structured spoken lessons through a voice-first interface in 12–15 minute sessions (6–7 year olds) or 20–35 minute sessions (8–9 year olds).

The LLM is a language production tool only. It generates spoken teacher utterances within hard template constraints. All pedagogical decisions — progression, mastery, recovery, session lifecycle, safety — are owned by deterministic backend modules. The LLM cannot see raw transcripts, child state scores, or failure counts.

The system is architecturally isolated from the adult Obsidian brain. No shared modules, no shared state stores, no shared LLM prompting patterns. Kids Brain runs in its own namespace: `backend/src/kids-brain/`.

**Core invariants enforced by architecture:**

1. Backend owns all state. Frontend renders only.
2. LLM cannot own: safety decisions, mastery, progression, recovery state.
3. Every wrong answer has a safe recovery branch. No shame path exists.
4. Lessons always end on a child success event.
5. English-first is the default; L1 is a last-resort scaffold, not a mode.
6. Child confidence is structurally prioritized over speed of progression.
7. Silence is a scaffold trigger, never a failure label.

---

## Section 2 — Final System Architecture

### 2.1 Separation from Adult Obsidian Brain

The Kids Brain is a completely separate subsystem:

```
backend/src/
  obsidian-brain/     ← Adult brain. Kids Brain has zero dependency on this.
  kids-brain/         ← All Kids Brain modules live here exclusively.
    perception/
    classification/
    state/
    decision/
    learning-engine/
    activity-engine/
    teacher-response/
    recovery/
    memory/
    progression/
    safety/
```

No code, module, or data store is shared between `obsidian-brain/` and `kids-brain/`. If a shared utility is needed (e.g., LLM client), it is imported from a common infrastructure layer — it is not sourced from `obsidian-brain/`.

### 2.2 Full Processing Loop

Each child response triggers one complete pass through all layers in order:

```
CHILD SPEECH / SILENCE
       ↓
[1. PERCEPTION MODULE]
  Deterministic. Assembles perception_bundle from STT, timing, L1 detection.
       ↓
[2. CLASSIFICATION MODULE]
  Deterministic fast-path for ~70% of cases.
  LLM-assisted for ambiguous semantic cases only.
  Emits: classification_label + confidence_score
       ↓
[3. CHILD STATE MODULE]
  Applies classification delta to session state model.
  Checks recovery state transitions.
  Emits: updated child_state + recovery_state
       ↓
[4. LEARNING ENGINE]
  Evaluates mastery. Applies progression rules (deterministic).
  Emits: progression_decision (advance/stay/scaffold/lower/review/stop)
       ↓
[5. ACTIVITY ENGINE]
  Maps progression_decision to specific next_activity.
  Checks engagement, fatigue, variety rules.
  Emits: next_activity_id + next_item_id + difficulty_level
       ↓
[6. TEACHER RESPONSE MODULE]
  Selects or generates teacher utterance within hard template constraints.
  Calls LLM only when template variation is required.
  Emits: teacher_text + feedback_tone
       ↓
[7. RECOVERY MODULE]
  Monitors recovery state. May override activity selection.
  Has veto power over curriculum decisions.
       ↓
[8. MEMORY MODULE]
  Writes session state delta. Updates mastery records.
  Schedules next review. Writes logging event.
       ↓
[9. ACTION PACKET → FRONTEND]
  Frontend executes without interpretation.
```

### 2.3 Backend Authority Model

```
BACKEND OWNS (canonical, authoritative):
  - Child state model
  - Recovery state machine
  - Classification labels (LLM may suggest; backend confirms)
  - Activity selection and sequencing
  - Mastery records
  - Progression decisions
  - Session lifecycle (start, pause, end)
  - Safety flags
  - Memory read/write

FRONTEND OWNS (rendering only, no pedagogical logic):
  - Audio I/O
  - Visual rendering
  - Animation triggers (fired by backend events, not frontend logic)
  - Nothing else
```

The backend emits an action packet to the frontend:

```json
{
  "action": "praise_then_next_item",
  "teacher_text": "Dog! Yes! You said DOG! Amazing!",
  "feedback_tone": "celebratory",
  "wait_ms": 2500,
  "next_prompt": "Now — what is this?"
}
```

The frontend executes it without modification.

### 2.4 LLM Role and Limits

The LLM is called only when:
- Response classification is ambiguous (semantic similarity judgment required)
- Teacher utterance requires variety beyond pre-written templates

The LLM is never called for:
- Safety decisions
- Mastery evaluation
- Progression decisions
- Recovery state transitions
- Session lifecycle control
- Generating new vocabulary items
- Generating content outside the active lesson's word list

The LLM receives only a minimal normalized context object per call (see Section 12).

---

## Section 3 — Backend Module Map

All modules live under `backend/src/kids-brain/`.

```
backend/src/kids-brain/
│
├── perception/
│   └── perception.module.ts        # Assembles perception_bundle from raw signals
│
├── classification/
│   ├── classifier.module.ts        # Orchestrates fast-path and LLM-path classification
│   ├── fast-path.classifier.ts     # Deterministic rule-based classifier
│   ├── llm-path.classifier.ts      # LLM-assisted classifier for ambiguous cases
│   ├── l1-detector.ts              # Cyrillic script + vocabulary list L1 detection
│   └── taxonomy.ts                 # Canonical label definitions and safe fallbacks
│
├── state/
│   ├── child-state.module.ts       # Session state model + update logic
│   ├── child-state.schema.ts       # TypeScript types for all state variables
│   └── state-delta.applier.ts      # Applies classification result to state
│
├── decision/
│   ├── decision-engine.ts          # Priority-ordered action resolution
│   └── action-catalog.ts           # All valid teacher actions and their conditions
│
├── learning-engine/
│   ├── learning-engine.module.ts   # Orchestrates the full progression loop
│   ├── progression-rules.ts        # Priority-ordered IF/THEN progression rules
│   └── confidence-updater.ts       # Bounded EMA confidence score updates
│
├── activity-engine/
│   ├── activity-engine.module.ts   # Maps progression decisions to activities
│   ├── activity-demand-ladder.ts   # Ordered activity levels (listen → free production)
│   ├── variety-guard.ts            # Prevents >3 consecutive same-activity events
│   └── easiest-win.protocol.ts     # Guaranteed success fallback
│
├── teacher-response/
│   ├── teacher-response.module.ts  # Selects template or calls LLM for utterance
│   ├── template-library.ts         # Pre-written templates for all common actions
│   ├── llm-context.assembler.ts    # Builds minimal LLM context (no raw data)
│   └── vocabulary-guard.ts         # Blocks any output containing out-of-scope words
│
├── recovery/
│   ├── recovery.module.ts          # Monitors state + applies recovery state machine
│   ├── recovery-state-machine.ts   # State definitions and transition logic
│   └── recovery.types.ts           # Recovery state enum and transition types
│
├── memory/
│   ├── memory.module.ts            # Session and profile memory management
│   ├── session-memory.ts           # Ephemeral session state (WebSocket-scoped)
│   ├── profile-store.ts            # Persistent child profile (database layer)
│   ├── continuity-packet.builder.ts # Builds <100-token session opener packet
│   └── privacy.guard.ts            # Strips PII before any LLM call
│
├── progression/
│   ├── mastery-model.ts            # Mastery level definitions and advancement rules
│   ├── mastery-updater.ts          # Applies mastery deltas post-response
│   ├── review-scheduler.ts         # Spaced review interval calculation
│   └── unit-progression.ts         # Unit unlock logic
│
├── safety/
│   ├── safety.module.ts            # Content safety classifier (deterministic-first)
│   ├── safety-word-list.ts         # Keyword pattern list (not LLM)
│   └── safety-audit-log.ts         # Append-only safety event log (isolated)
│
├── lesson-flow/
│   ├── lesson-flow.module.ts       # Orchestrates lesson phases
│   ├── phase-sequencer.ts          # Phase advancement and completion logic
│   └── session-completion.engine.ts # Stop condition detection and graceful close
│
└── shared/
    ├── age-profile.ts              # Age-band constants (6-7 vs 8-9)
    ├── types.ts                    # Shared TypeScript types
    └── constants.ts                # Hard limits, thresholds, token budgets
```

---

## Section 4 — Runtime Data Flow

### 4.1 Per-Turn Data Flow

```
INPUT:
  stt_text, stt_confidence, response_latency_ms,
  silence_duration_ms, audio_energy_level (optional),
  session_state (from WebSocket session)

STEP 1 → PERCEPTION MODULE
  Output: perception_bundle (structured, typed)

STEP 2 → CLASSIFICATION MODULE
  Input: perception_bundle
  Fast-path: deterministic rule match → label + confidence
  LLM-path (ambiguous only): minimal context → label + confidence
  Output: { label: ClassificationLabel, confidence: float }

STEP 3 → CHILD STATE MODULE
  Input: classification_result + current session_state
  Apply state deltas (confidence scores, counters)
  Check recovery state transition conditions
  Output: updated session_state + recovery_state_change (if any)

STEP 4 → LEARNING ENGINE
  Input: classification_result + session_state + item_mastery_state
  Apply priority-ordered progression rules
  Evaluate mastery advancement conditions
  Output: progression_decision + mastery_delta + lesson_phase_update

STEP 5 → ACTIVITY ENGINE
  Input: progression_decision + session_state + activity_history
  Select next_activity from demand ladder
  Apply variety guard (max 3 consecutive same type)
  Output: { next_activity_id, next_item_id, difficulty_level }

STEP 6 → RECOVERY MODULE (override check)
  Input: recovery_state + progression output
  If recovery_state requires override → replace activity_engine output
  Output: final_activity (may be overridden)

STEP 7 → TEACHER RESPONSE MODULE
  Input: final_activity + session_state + lesson_context
  Select template or call LLM (if variation required)
  Apply vocabulary guard (block out-of-scope words)
  Output: { teacher_text, feedback_tone }

STEP 8 → MEMORY MODULE
  Write session state delta to session memory
  Write mastery delta to profile store
  Schedule reviews for mastered items
  Emit logging event

STEP 9 → ACTION PACKET
  Assemble frontend action packet
  Return to WebSocket connection
```

### 4.2 Session Lifecycle Flow

```
SESSION START
  → Load child profile from DB
  → Build continuity_packet (<100 tokens)
  → Initialize session_state from profile defaults
  → Start session timer
  → Set recovery_state = normal
  → Emit opening action packet (warm greeting + callback)

LESSON PHASES: warm_up → introduction → practice → consolidation → close
  → Phase transitions driven by lesson-flow module
  → Learning engine reports phase advancement
  → Each phase has allowed/forbidden activities

STOP CONDITIONS (checked after every turn):
  → Normal completion: all phases done, last event = success
  → Timeout: elapsed >= max_session_seconds for age band
  → Emotional stop: frustration >= 90, or sustained non-response
  → Stamina: session_stamina < 0.15

BEFORE ANY STOP:
  → If last event was not a success: insert easiest_win
  → Execute abbreviated close phase

SESSION END
  → Write session_summary (not raw turns) to profile
  → Schedule reviews for all introduced items
  → Unlock next lesson if unit progression criteria met
  → Emit session_end event to parent-facing dashboard
```

---

## Section 5 — Perception Contract

**Module:** `backend/src/kids-brain/perception/perception.module.ts`  
**Owner:** Backend only. Entirely deterministic. No LLM.

### 5.1 Required Inputs

| Field | Type | Source |
|---|---|---|
| `stt_text` | string \| null | STT engine |
| `stt_confidence` | float 0.0–1.0 | STT engine |
| `response_latency_ms` | integer | Server-side timestamp |
| `silence_duration_ms` | integer | Audio pipeline |
| `prompt_type` | enum | Session state |
| `target_item` | string \| null | Session state |
| `activity_type` | enum | Session state |
| `child_age_band` | "6-7" \| "8-9" | Child profile |
| `recent_turn_history` | TurnRecord[last 5] | Session memory |

### 5.2 Optional Inputs

| Field | Type | Notes |
|---|---|---|
| `stt_alternatives` | string[] | Alternative transcriptions |
| `audio_energy_level` | float 0.0–1.0 | Do not create hard dependencies |
| `speech_duration_ms` | integer | Used in confidence adjustment |
| `attempt_count` | integer | Attempts on this item this turn |

### 5.3 STT Reliability Adjustment

Child speech STT is unreliable by default. Raw `stt_confidence` is adjusted:

```
adjusted_stt_confidence =
  stt_confidence
  × response_length_penalty(word_count)     # 1-word: ×0.85, 2-word: ×0.92, 3+: ×1.0
  × 0.85                                    # constant child speech prior (age 6-7)
  × (0.7 if speech_duration_ms < 400 else 1.0)
```

[B] Multiplier values require empirical calibration against the deployed STT engine.

### 5.4 L1 Detection (Deterministic)

Two methods run in order:

1. **Cyrillic script detection**: Unicode analysis. If any Cyrillic character is present → `l1_detected = true`, `l1_script = cyrillic`. This is deterministic and reliable.
2. **Vocabulary list match**: Compare normalized text against maintained list of 200–400 common child L1 words (animals, colors, numbers, family, common phrases). Match → `l1_detected = true`, `l1_script = latin_loanword`.

Phrase-to-intent mapping for common L1 phrases:
- `"не знаю"`, `"я не знаю"`, `"dunno"` → `l1_intent_hint = i_dont_know`
- `"що це?"`, `"як по-англійськи?"` → `l1_intent_hint = help_request`
- `"не хочу"`, `"не буду"` → `l1_intent_hint = refusal`

### 5.5 Silence and Latency Classification

| Latency | Signal |
|---|---|
| 0–800ms | Fast response (possible guess flag if forced_choice) |
| 800–2500ms | Normal range |
| 2500–5000ms | Hesitant |
| 5000–8000ms | Approaching silence threshold |
| >8000ms | Silence; trigger scaffolding path |

Age adjustment: 6–7 band shifts all thresholds +500ms.

| Silence duration | Classification |
|---|---|
| < 3000ms | `silence_short` — wait |
| 3000–6000ms | `silence_medium` — offer scaffold |
| 6000–10000ms | `silence_long` — model answer |
| > 10000ms | `no_response` — recovery trigger |

### 5.6 Perception Bundle Output

```typescript
interface PerceptionBundle {
  // Raw
  stt_text: string | null;
  stt_confidence: float;
  adjusted_stt_confidence: float;
  response_latency_ms: integer;
  silence_duration_ms: integer;
  speech_duration_ms: integer;

  // L1 flags
  l1_detected: boolean;
  l1_script: "cyrillic" | "latin_loanword" | "ambiguous" | null;
  l1_intent_hint: "translation" | "help_request" | "refusal" | "i_dont_know" | "unknown" | null;
  l1_word: string | null;

  // Derived flags
  is_silence: boolean;
  is_very_fast: boolean;        // latency < 600ms
  is_hesitant: boolean;         // latency > 2500ms
  has_audio: boolean;
  word_count: integer;

  // Normalized text
  text_normalized: string | null;   // romanized for matching
  text_lowercased: string | null;

  // Context (from session state)
  prompt_context: PromptContext;

  // State snapshot (read-only view for classifier)
  child_state_snapshot: ChildStateSnapshot;

  // Composite confidence for downstream modules
  perception_confidence: float;   // see formula below
}
```

```
perception_confidence =
  adjusted_stt_confidence
  × (0.6 if is_silence else 1.0)
  × (0.8 if attempt_count > 2 else 1.0)
  × (0.9 if word_count == 1 else 1.0)
```

### 5.7 Missing Data Contracts

| Missing signal | Fallback |
|---|---|
| `stt_text` null | Treat as `no_response` |
| `stt_confidence` missing | Use 0.5 |
| `response_latency_ms` missing | Treat as `silence_medium` |
| `audio_energy_level` missing | Do not use energy in classification |
| STT timeout | Treat as `no_response` |

Rule: missing data always resolves to the safer, more scaffolded action.

---

## Section 6 — Classification Contract

**Module:** `backend/src/kids-brain/classification/`  
**Owner:** Backend. Deterministic fast-path for ~70% of cases. LLM-assisted for ambiguous semantic cases only.

### 6.1 Classification Labels (Canonical Taxonomy)

Every child response maps to exactly one primary label. When classifier confidence < 0.6, use the `safe_fallback_label` for that label.

**Correct Group**

| Label | Detection | Default Action | LLM? |
|---|---|---|---|
| `correct_confident` | STT matches target, adj_confidence ≥ 0.75, latency 600–2500ms, no L1 | `praise_and_progress` | No |
| `correct_hesitant` | STT matches target, adj_confidence ≥ 0.65, latency > 2500ms or energy low | `warm_praise_confirm` | No |
| `near_correct` | edit_distance(stt, target) ≤ 2 OR phonetic_similarity ≥ 0.75 | `recast_and_confirm` | No |
| `pronunciation_variant` | phonetic_similarity ≥ 0.65, not L1 | `recast_correctly_and_praise` | No |
| `partial_answer` | target is multi-word; response contains one target word | `complete_the_answer_model` | No |
| `repeated_after_model` | model_was_given == true AND latency < 1500ms AND STT near-matches target | `praise_echo_then_check` | No |

Guard: if `attempt_number == 1 AND prompt_type == forced_choice AND latency < 700ms` → downgrade `correct_confident` to `correct_hesitant` and log `possible_guess`.

**Wrong Group**

| Label | Detection | Default Action | LLM? |
|---|---|---|---|
| `wrong_semantic` | Known English word, semantic_distance to target > 0.6, no L1 | `gentle_reframe_no_wrong_word` | Yes |
| `wrong_but_related` | semantic_similarity 0.35–0.65 OR same semantic category | `acknowledge_connection_then_scaffold` | Yes |

**Nonsense Group**

| Label | Detection | Default Action | LLM? |
|---|---|---|---|
| `random_nonsense` | No semantic match, not L1, not clearly playful | `warm_redirect_no_shame` | Yes |
| `playful_nonsense` | Known playful word OR high engagement + pattern history | `play_along_briefly_then_redirect` | Yes |
| `avoidance_nonsense` | Nonsense + frustration_risk ≥ 0.5 OR recent_failure_count ≥ 2 | `soft_pause_and_change_activity` | Yes |

Safe fallback for ambiguous nonsense: `playful_nonsense` is emotionally safer than `avoidance_nonsense`. Default to `playful_nonsense` when context is unclear.

**Silence Group** (all deterministic, no LLM)

| Label | Detection | Default Action |
|---|---|---|
| `silence_short` | silence < 3000ms | Wait |
| `silence_medium` | silence 3000–6000ms | Offer hint warmly |
| `silence_long` | silence 6000–10000ms | Model answer + invite repeat |
| `no_response` | stt_text null / has_audio false | Check in warmly then repeat |

**L1 Group** (all deterministic, no LLM)

| Label | Detection | Default Action |
|---|---|---|
| `l1_translation` | l1_detected + l1_word is translation of target | `acknowledge_comprehension_bridge_to_english` |
| `l1_help_request` | l1_detected + l1_intent_hint == help_request | `provide_gentle_l1_anchor_then_english` |
| `l1_refusal` | l1_detected + l1_intent_hint == refusal | `acknowledge_feeling_offer_easier_alternative` |
| `code_switch` | both L1 and English words in utterance | `respond_to_english_part_and_expand` |

**Refusal / Disengagement Group**

| Label | Detection | LLM? |
|---|---|---|
| `i_dont_know` | Exact phrase match: "i don't know", "idk", "dunno" | No |
| `refusal` | "no" / "stop" / "i don't want to" + frustration_risk ≥ 0.4 | No |
| `distraction` | Off-task proper names or content directed away from screen | Yes |
| `off_topic_story` | > 10 words, no semantic match to target, narrative structure | Yes |

Guard: "no" as a task answer (yes/no prompt) must not trigger `refusal`. Check `prompt_type` first.

**Safety Group** (hard deterministic override)

| Label | Detection | LLM? |
|---|---|---|
| `unsafe_or_sensitive` | Content safety classifier flag OR keyword list match | No (LLM cannot clear a flag) |

`unsafe_or_sensitive` requires:
- Confidence threshold: 0.30 (err toward false positive; false negatives are not acceptable)
- Pattern rules and safety keyword classifier run first
- LLM may assist characterization after flag is raised but cannot clear it
- Escalation: `human_review_queue`

### 6.2 LLM Classification Rules

When LLM is called for classification:
- Must return a label from the defined taxonomy (no free-form labels)
- Must return a confidence score 0.0–1.0
- Must return within 400ms hard cap (200ms target)
- Deterministic rule, if applicable, always overrides LLM output

---

## Section 7 — Child State Contract

**Module:** `backend/src/kids-brain/state/`  
**Owner:** Backend only. LLM never reads or writes child state directly.

### 7.1 Session State Variables

All variables are floats in [0.0, 1.0] unless noted. All reset at session start to defined initial values.

**comprehension_confidence** — Does the child understand the current task?
- Initial: 0.5
- Update: `correct_confident` +0.15 | `l1_translation` +0.08 | `wrong_semantic` −0.10 | `silence_long` −0.05
- Thresholds: ≥ 0.7 → may reduce scaffold | < 0.4 → force forced_choice | < 0.25 → consider L1 anchor

**production_confidence** — Can the child produce English output?
- Initial: profile baseline (default 0.30)
- Update: `correct_confident` +0.12 | `correct_hesitant` +0.06 | `wrong_semantic` −0.05 | `refusal` −0.08
- Thresholds: ≥ 0.7 → eligible for sentence tasks (8-9 band) | < 0.35 → prefer model or forced_choice | < 0.20 → forced_choice only

**pronunciation_confidence** — Used to adjust STT tolerance only. Not a teaching target.
- Initial: 0.4
- Thresholds: ≥ 0.65 → trust STT more | < 0.40 → widen phonetic match window

**emotional_safety** — How safe does the child feel in this session?
- Initial: 0.75
- Update: `correct_confident` + praise +0.08 | `give_easiest_win` success +0.12 | repeated_failure −0.10 per event | `refusal` −0.08
- Thresholds: ≥ 0.75 normal | 0.50–0.74 no new challenges | 0.35–0.49 enter frustration recovery | < 0.35 override to `pause_and_check_in`

**engagement_level** — Is the child attending to the task?
- Initial: 0.65
- Update: `correct_confident` +0.07 | `switch_activity` +0.10 | `silence_long` −0.07 | same activity type 3× −0.08
- Thresholds: ≥ 0.75 may increase pace | < 0.30 trigger `switch_activity`

**frustration_risk** — Probability approaching frustration.
- Initial: 0.05
- Update: wrong ×2 consecutive +0.15 | `refusal` +0.20 | `correct_confident` −0.15 | `give_easiest_win` success −0.20
- Thresholds: < 0.25 normal | 0.25–0.49 avoid new challenges | ≥ 0.50 enter frustration_risk recovery state | ≥ 0.70 trigger `give_easiest_win`

**session_stamina** — Remaining session capacity.
- Initial: 1.0
- Decay: 0.05 per minute base | ×1.5 if emotional_safety < 0.50 | ×0.8 if engagement_level ≥ 0.75
- Thresholds: < 0.15 trigger `end_session` | < 0.25 no new items

**activity_fatigue** — Fatigue with the current activity type.
- Initial: 0.0
- Update: +0.07 per turn same activity_type | Reset to 0.0 on activity_switch
- Threshold: ≥ 0.70 trigger `switch_activity`

**recent_success_count** / **recent_failure_count** — Rolling window of 5 turns.
- `recent_failure_count` ≥ 3 → trigger `give_easiest_win`
- `recent_failure_count` ≥ 4 → enter repeated_failure recovery state
- `recent_success_count` ≥ 4 → consider harder item (8-9 band only)

**l1_dependency** — Session reliance on L1.
- Initial: 0.20 (assume some reliance for L1-background children)
- Thresholds: ≥ 0.60 → prefer forced_choice over L1 anchor

**recovery_level** — Current recovery state (mirrors recovery state machine).
- Enum: `normal | mild_confusion | repeated_failure | frustration_risk | disengagement | refusal | emotional_shutdown | repaired_success`

### 7.2 Item-Level State (per vocabulary item in session)

```typescript
interface ItemState {
  item_id: string;
  item_mastery: float;        // 0.0–1.0; threshold 0.70 = learned for session
  attempt_count: integer;
  model_given: boolean;
  l1_anchor_used: boolean;
}
```

Mastery update: `correct_confident` unprompted +0.25 | after model +0.10 | `correct_hesitant` +0.12 | `near_correct` +0.06 | `repeated_after_model` only +0.03

Item mastery ≥ 0.70 → eligible for `move_to_next_item`.

### 7.3 Profile State (Persistent, Cross-Session)

```typescript
interface ChildProfile {
  child_id: string;           // UUID; never sent to LLM
  first_name: string;         // Used in teacher speech only
  age_band: "6-7" | "8-9";
  production_confidence_baseline: float;
  l1_dependency_baseline: float;
  vocabulary_mastery: Map<item_id, MasteryRecord>;
  sessions_completed: integer;
  last_session_date: date;
  stt_reliability_estimate: float;  // per-child STT performance
  high_engagement_topics: string[];  // inferred from session history
}
```

---

## Section 8 — Learning Engine Contract

**Module:** `backend/src/kids-brain/learning-engine/`  
**Owner:** Backend. Fully deterministic. Zero LLM involvement.

### 8.1 Confidence Score Updates

Bounded exponential moving average. Learning rate = 1.0 default [C — requires per-child calibration].

```
new_score = clamp(old_score + delta, min=0, max=100)
```

| Classification | production_delta | comprehension_delta |
|---|---|---|
| `correct_confident` | +8 | +5 |
| `correct_hesitant` | +4 | +4 |
| `correct_prompted` | +2 | +3 |
| `partial_correct` | +1 | +2 |
| `wrong_semantic` | −4 | −2 |
| `wrong_random` | −8 | −5 |
| `no_response` | −6 | −3 |
| `imitation_only` | 0 | +1 |

### 8.2 Progression States

| State | Definition | Max consecutive |
|---|---|---|
| `stay` | Continue current activity at same difficulty | 3 (then → scaffold) |
| `repeat` | Repeat same item, same activity | 2 (then → scaffold) |
| `scaffold` | Lower activity demand, same item | 2 (then → lower_difficulty) |
| `advance` | Move to higher demand activity or next item | — |
| `lower_difficulty` | Simpler task version | — |
| `review` | Return to previously seen item | — |

### 8.3 Priority-Ordered Progression Rules (First Match Wins)

**Priority 1 — Safety/Emotional Stop**

| Rule ID | Condition | Action |
|---|---|---|
| R01 | frustration ≥ 90 | `stop_lesson`, `comfort_and_close` |
| R02 | engagement ≤ 10 AND elapsed ≥ 300s | `stop_lesson`, `cheerful_close` |
| R03 | last 3 classifications = `[no_response, no_response, no_response]` | `stop_lesson`, `gentle_close_with_praise` |

**Priority 2 — High Frustration**

| Rule ID | Condition | Action |
|---|---|---|
| R10 | frustration ≥ 75 AND phase in [practice, consolidation] | `lower_difficulty`, `easiest_win` |
| R11 | frustration ≥ 60 | Forbid `advance`; require `scaffold` |

**Priority 3 — Advance**

| Rule ID | Condition | Action |
|---|---|---|
| R20 | last 3 = `[correct_confident ×3]`, prod ≥ 65, comp ≥ 65, frustration < 60 | `advance` |
| R21 | last 2 = `[correct_confident ×2]`, prod ≥ 75, comp ≥ 75, frustration < 50 | `advance` |
| R22 | current = `sentence_production`, last 2 confident, prod ≥ 75, mastery in [developing, secure] | `advance` to next item |

**Priority 4 — Stay/Repeat**

| Rule ID | Condition | Action |
|---|---|---|
| R30 | `correct_hesitant` AND consecutive_correct < 3 | `stay` |
| R31 | `correct_prompted` | `stay` (does not count toward advance criteria) |
| R32 | `partial_correct` in sentence activities | `repeat` |

**Priority 5 — Scaffold**

- `wrong_semantic` → `scaffold`, one level down
- `wrong_random ×2` → `scaffold`, lower difficulty
- `no_response` AND current != `listen_and_point` → `scaffold`

**Global Forbidden Transitions**

- ANY → `advance` if frustration > 70
- ANY → `advance` if consecutive_correct < 2
- ANY → `stay` if consecutive_wrong ≥ 3
- ANY → any production activity if comprehension_confidence < 35

### 8.4 Advance Thresholds by Activity

| From | To | Production min | Comp min | Consecutive correct |
|---|---|---|---|---|
| `repeat_after_me` | `forced_choice_2` | 40 | — | 2 |
| `forced_choice_2` | `supported_production` | 55 | — | 2 |
| `supported_production` | `sentence_frame_production` | 60 | 65 | 2 |
| `sentence_frame_production` | `sentence_production` | 70 | — | 3 |
| `sentence_production` | `review` | 75 | 70 | 2 |

---

## Section 9 — Activity Engine Contract

**Module:** `backend/src/kids-brain/activity-engine/`

### 9.1 Activity Demand Ladder (Ordered, Lowest to Highest)

| Level | Activity ID | Demand Type | Use When |
|---|---|---|---|
| 1 | `listen_and_point` | Reception only | comp < 35 OR first introduction OR frustration > 70 |
| 2 | `repeat_after_me` | Imitation | comp ≥ 30 AND prod < 45 |
| 3 | `forced_choice_2` | Recognition from 2 | comp ≥ 40 |
| 4 | `forced_choice_4` | Recognition from 4 | comp ≥ 55 AND prod < 55 |
| 5 | `supported_production` | Cued production | prod ≥ 45 AND comp ≥ 60 |
| 6 | `sentence_frame_production` | Production in frame | prod ≥ 60 AND comp ≥ 65 |
| 7 | `sentence_production` | Free production | prod ≥ 70 AND comp ≥ 70 |
| 8 | `review_production` | Delayed free production | mastery = secure or automatic |

### 9.2 Activity Variety Guard

Maximum 3 consecutive turns of the same activity type. On fourth turn → switch to adjacent demand level (direction determined by performance). This is a hard rule — no exceptions.

### 9.3 Easiest Win Protocol

Trigger conditions: frustration > 75 | pre-lesson-close | consecutive_wrong ≥ 3

Protocol:
1. Select a word where `mastery_level = secure or automatic`
2. Use `forced_choice_2` or `repeat_after_me`
3. Guarantee child success before continuing or closing

Easiest win events do not count toward mastery advancement or progression metrics.

### 9.4 Phase-Activity Constraints

| Phase | Allowed Activities | Forbidden Activities |
|---|---|---|
| `warm_up` | listen_and_point, forced_choice_4, repeat_after_me | sentence_production (no cold start) |
| `introduction` | listen_and_point, repeat_after_me, forced_choice_2/4 | sentence_production, review_production |
| `practice` | repeat_after_me through sentence_production | listen_and_point, review_production |
| `consolidation` | forced_choice_4 through sentence_production | listen_and_point, repeat_after_me |
| `close` | easiest_win, celebration | Any new item, any high-demand production |

---

## Section 10 — Teacher Response Contract

**Module:** `backend/src/kids-brain/teacher-response/`

### 10.1 Response Generation Hierarchy

1. **Deterministic template** (fast, no LLM) — used for all safety actions, silence responses, L1 responses, simple praise, and standard scaffolding.
2. **LLM-generated phrasing** (constrained) — used when variety is required in praise, recast, or redirect responses. Always within hard template structure.
3. **Pre-written scripted content** (non-negotiable) — lesson opening, story hook, chants, open-loop ending, character names, reward text.

### 10.2 What Is Scripted (Never LLM-Generated at Runtime)

- `lesson_opening_greeting`
- `story_hook_narrative`
- `chant_text`
- `open_loop_ending`
- `character_names_and_voices`
- `reward_celebration_text`

### 10.3 Token and Length Limits

| Limit | Value |
|---|---|
| Default teacher turn max | 40 tokens (~30 spoken words) |
| Extended turn max (story hook, open loop only) | 60 tokens |
| Absolute hard limit | 80 tokens |
| Session total token budget | 1200 tokens generated (~12 min) |
| Warning threshold | 1000 tokens (begin lesson close sequence) |

Child response expectations by age:

| Age | Min expected | Target | Max demanded |
|---|---|---|---|
| 6 | 1 word | 1–3 words | 3 words |
| 7 | 1 word | 2–5 words | short phrase |
| 8 | 1–2 words | short sentence | 1 complete sentence |

### 10.4 Vocabulary Guard (Hard Constraint)

Every teacher utterance is checked before delivery. Allowed vocabulary = current_lesson_target_words ∪ current_unit_review_words ∪ core_teacher_language_vocabulary (~100 pre-approved classroom words) ∪ character_names.

Any word outside this union blocks delivery. This is a HARD_STOP — no exceptions.

### 10.5 Teacher Speech Rules (All Hard Constraints)

**Sentence complexity limits:**

| Age | Max words/sentence | Max clauses | Allowed tenses |
|---|---|---|---|
| 6 | 10 | 1 | present simple, present continuous |
| 7 | 12 | 2 | present simple/continuous, going to (simple) |
| 8 | 15 | 2 | add simple past (known irregular), going to |

**Always allowed:**
- "Say it with me — [word]!"
- "Can you say [word]?"
- "What's this? [A] or [B]?"
- "Is it a [word]? Yes or no?"
- Exclamations: Wow! Yes! Oh! Amazing! Great! Brilliant! Let's go! Hmm... Uh oh!

**Silence thresholds (teacher must act before this):**

| Age | Max silence before teacher acts |
|---|---|
| 6 | 3 seconds |
| 7 | 4 seconds |
| 8 | 5 seconds |

Teacher silence between turns: never > 1 second. Teacher always fills dead air.

### 10.6 Correction Policy (Hard Constraint)

Method: **implicit recast only**. Explicit correction is forbidden.

Recast procedure:
1. Accept child's turn without pause or error signal
2. Embed correct form in teacher's next utterance at natural stress position
3. Re-invite production of correct form naturally
4. Move on — never dwell

Maximum recast attempts before moving on: 2.

Phonological tolerance:
- Consonant cluster simplification: ACCEPT
- Vowel approximation: ACCEPT
- Stress pattern error: ACCEPT and model correctly
- Word entirely wrong: recast and recheck

Production failure protocol (5 steps before marking `needs_review` and moving on):
1. Repeat activity at same difficulty
2. Drop to forced_choice for same word
3. Drop to yes/no comprehension
4. Use `give_easiest_win` activity
5. Provide answer, model it, move on

### 10.7 Forbidden Teacher Behaviors (Hard Stops)

The following must never appear in any teacher output:

- Grammar labels or terms (verb, noun, tense, subject)
- Metalinguistic commentary ("In English we say...", "The word order is...")
- Translation requests ("How do you say this in Russian?")
- Explicit negative correction ("No.", "That's wrong.", "Try again.")
- Shaming child's English ability
- Repeating the child's incorrect production back to them
- Demanding explanation ("Why did you say that?")
- Unstructured open conversation without active activity frame
- Emotional punishment ("Come on, you know this.")
- Test framing ("Now I'll test you.", "Let's see if you remember.")
- L1 demand ("Please say it in English.", "In English, please.")
- Generic praise without naming the specific success ("Good job.", "Well done.", "Nice.")

### 10.8 Praise Policy

- Minimum frequency: 1 praised event per 60 seconds
- Quality: Specific — must name the behavior or word praised
- Timing: Immediate — within 1 second of correct response
- Praise variety: Rotate through 15+ variants; do not repeat the same phrase within 3 turns

**Fake Praise Guard:** If `recent_success_count ≥ 6` and all items were trivial, use neutral acknowledgment instead of effusive praise. After model-prompted correct, use weaker praise than for unprompted correct.

### 10.9 Praise Templates by Response Type

| Response type | Praise level | Pattern |
|---|---|---|
| Unprompted `correct_confident` on new item | High | "[word]! [exclamation]! You said [word]! [short identity statement]!" |
| `correct_confident` after model | Medium | "Good! [word]! Well done." |
| `correct_hesitant` or `near_correct` | Warm confirmation | "Yes! [recast correct form]. That's it!" |
| `repeated_after_model` | Soft acknowledgment | "[word]! Yes! Now — [comprehension check]" |
| `wrong_but_related` | Acknowledge + no direct praise | "Oh! That's a cat! And this one — it's a dog!" |

### 10.10 English-First Rescue Ladder (L1 Policy)

Escalate through levels in order. Never skip. L1 is the last resort.

| Level | Trigger | Action |
|---|---|---|
| 1 | Silence or confusion after first question | Slow down + repeat at 80% speed |
| 2 | Still no response | Add gesture instruction |
| 3 | Still no response | Reduce to forced_choice |
| 4 | Still no response | Reduce to yes/no only |
| 5 | Still no response | Provide answer, model, re-invite |
| 6 | Comprehension failure confirmed | One L1 word + English pair, then continue |

Level 6 constraints:
- Max 1 L1 word per session (not per item)
- L1 allowed only for comprehension failure, not production failure
- Must immediately follow with English word
- Do not elaborate in L1
- L1 never for: praise, grammar explanation, instructions, production failure

When child responds in L1: treat as evidence of comprehension. Bridge to English. Never shame the L1 use.

---

## Section 11 — Recovery Contract

**Module:** `backend/src/kids-brain/recovery/`  
**Owner:** Backend. Fully deterministic. Has veto power over curriculum decisions. No LLM.

### 11.1 Recovery States (Ordered by Severity)

**`normal`**
- Entry: session start | repaired_success sustained ≥ 2 turns | easiest_win succeeded AND emotional_safety ≥ 0.70
- Exit: recent_failure_count ≥ 2 → `mild_confusion` | frustration_risk ≥ 0.50 → `frustration_risk` | refusal → `refusal` | emotional_safety < 0.35 → `emotional_shutdown`
- All teacher actions allowed

**`mild_confusion`**
- Entry: recent_failure_count ≥ 2 | wrong_semantic same item ×2 | silence_medium on new item
- Allowed: model_answer, ask_forced_choice, recast_and_confirm, warm_praise_confirm, hold_current_item, use_l1_anchor (if l1_dependency < 0.60)
- Forbidden: move_to_next_item, switch_activity, increase_difficulty
- Max 3 turns without success → auto-escalate to `repeated_failure`

**`repeated_failure`**
- Entry: recent_failure_count ≥ 3 on same item | mild_confusion persisted 3 turns | frustration_risk ≥ 0.50 AND recent_failure_count ≥ 2
- Auto-action on entry: immediately trigger `give_easiest_win` on previously mastered item
- Forbidden: any new item, any question with wrong-answer risk, hold_current_item, increased cognitive load
- Max 4 turns

**`frustration_risk`**
- Entry: frustration_risk ≥ 0.50 | l1_refusal + recent_failure_count ≥ 2 | avoidance_nonsense ×3 in session
- Auto-action on entry: suppress ALL curriculum progression; execute give_easiest_win or switch_activity within 1 turn
- Forbidden: any correction framing, any new item, repeat failing item, play_along_briefly
- Max 3 turns before forced switch_activity or check_in

**`disengagement`**
- Entry: engagement_level < 0.30 | activity_fatigue ≥ 0.80 AND emotional_safety < 0.50 | 3+ consecutive silence events | distraction ×3
- Allowed: switch_activity, give_easiest_win, short_engaging_prompt
- Forbidden: continue current activity, increase difficulty, open production questions, long teacher turns
- After 3 turns without engagement signal → offer session end warmly

**`refusal`**
- Entry: refusal classification | l1_refusal + frustration_risk ≥ 0.50 | "no/stop/I don't want to" ×3 in session
- Allowed: back_off_offer_choice, pivot_to_low_stakes_win, switch_activity, offer_break, end_session
- Forbidden: repeat refused task, increase pressure, direct questions
- After 2 turns without recovery → offer session end gracefully
- The relationship matters more than the lesson.

**`emotional_shutdown`**
- Entry: emotional_safety < 0.35 AND (silence_long OR no_response OR refusal) AND recent_failure_count ≥ 3
- CRITICAL: Silence alone does NOT trigger this state. State model conditions are required.
- Allowed: pause_and_check_in, offer_break, end_session_warmly
- Forbidden: ALL curriculum actions, any task question, praise, long speech
- After 2 turns without response → end session: "That's okay. We'll play again soon. Bye-bye!"

**`repaired_success`**
- Entry: give_easiest_win succeeded following non-normal state | correct_confident after repeated_failure or frustration_risk
- Forbidden: immediately introduce difficult new item, switch activity
- Exit: 2 consecutive successes → normal

### 11.2 Core Invariant

There is no state in the recovery machine that produces silence, shame, or abandonment. Every state has a valid, warm teacher response. This is enforced structurally, not by LLM instruction.

### 11.3 Special Input Handling

**Child testing the AI** ("Are you a robot?"): Respond in character warmly for 1 turn maximum. Redirect with energy. Never break character. Never lecture about AI.

**Overexcitement**: Match energy briefly (1 turn), then channel into task. Never suppress excitement; redirect it. Do not enter disengagement state from overexcitement.

**Child asks why / translation**: Treat as high engagement, not distraction. Brief answer, return to task.

---

## Section 12 — Memory Contract

**Module:** `backend/src/kids-brain/memory/`

### 12.1 Memory Layers

| Layer | Duration | Owner | Privacy |
|---|---|---|---|
| Turn memory | One turn only | Session | Minimal |
| Session memory | WebSocket lifetime | Session (ephemeral) | Working data |
| Profile memory | Cross-session | Backend DB | Privacy-sensitive |

### 12.2 What the LLM Receives (Maximum, Never Exceeded)

```yaml
llm_context:                          # All fields, maximum
  child_first_name: string            # "Sasha"
  age_band: "6-7"
  current_activity: string
  target_item: string
  stt_text_normalized: string         # Normalized only; never raw
  prompt_type: string
  attempt_number: integer
  recent_classification_labels: [string]  # Last 2 only
  teacher_character: string
```

The LLM does NOT receive:
- Raw transcript text
- Child's full session history
- Emotional state scores as numbers
- Failure counts as numbers
- Child ID
- L1 vocabulary details
- Any family or personal data

### 12.3 Session Memory (Ephemeral)

```typescript
interface SessionMemory {
  session_id: string;
  child_id: string;             // Internal only; never to LLM
  session_start_time: timestamp;
  session_elapsed_ms: integer;
  recent_turns: TurnRecord[];   // Last 5 turns only
  child_state: ChildSessionState;
  items_attempted: string[];
  items_mastered: string[];
  current_item_id: string;
  current_item_attempt_count: integer;
  play_along_count: integer;
  l1_anchor_used_items: string[];
  recent_praise_phrases: string[];  // Last 3 used
}
```

### 12.4 Profile Memory (Persistent)

What may be stored:

```typescript
interface ChildProfile {
  child_id: string;
  first_name: string;
  age_band: string;
  vocabulary_mastery: Map<item_id, MasteryRecord>;
  production_confidence_baseline: float;
  l1_dependency_baseline: float;
  sessions_completed: integer;
  last_session_date: date;
  high_engagement_topics: string[];   // Inferred, not stated
  preferred_activity_types: string[]; // Inferred from engagement
  stt_reliability_estimate: float;
}
```

What must NOT be stored: raw audio, full transcripts, emotional history in detail, parent/guardian info, device/IP data, school or location, sibling/family details, anything the child said about personal life, exact text of safety events.

### 12.5 Continuity Packet (< 100 Tokens)

Loaded at session start to enable warm personalized greeting:

```yaml
continuity_packet:
  child_name: "Sasha"
  character: "Luna"
  last_item_mastered: "dog"
  recent_mastered_words: ["dog", "cat"]  # up to 3 words
  high_engagement_topic: "animals"
```

What the teacher may reference: child's first name, previous success, recent learned word, high-engagement topic.
What the teacher must NOT reference: previous failures, emotional events, session counts, private family data.

### 12.6 Session Summary (Written at Session End)

```yaml
session_summary:
  date: date
  duration_minutes: integer
  items_attempted: count
  items_mastered: [item_ids]
  final_emotional_safety: float    # For trend analysis only
  recovery_events: count           # Count only, no details
  stop_reason: normal | timeout | emotional | engagement
```

### 12.7 Safety Event Storage

Safety events are stored in a separate, isolated, append-only audit log. This log is not accessible to the AI in any session. Accessible only to human reviewers with appropriate access controls.

### 12.8 Data Compliance

- Children's data requires parental consent [A — GDPR Article 8, COPPA]
- All data must be deletable on parental request
- Data retention period must be defined before launch
- No data shared with advertising third parties
- LLM API provider data retention policy must be verified and compliant for under-13 data
- Child name stored encrypted at rest; never passed in plain text in LLM prompt

---

## Section 13 — Progression & Mastery Contract

**Module:** `backend/src/kids-brain/progression/`  
**Owner:** Backend. Fully deterministic. LLM has no role in mastery or progression.

### 13.1 Mastery Levels

**`emerging`** — Item introduced; may recognize in forced_choice. No reliable retrieval.
- Advance to `developing`: correct_comprehension ≥ 2 (same session), any activity type, consecutive_correct ≥ 1

**`developing`** — Can comprehend and sometimes produce with support. Unstable recall.
- Advance to `secure`: correct_production ≥ 3 across ≥ 2 sessions, correct_comprehension ≥ 5, activity diversity ≥ 2 types, consecutive_correct_final ≥ 2
- Cannot be achieved in a single session.

**`secure`** — Reliable production and comprehension with minimal hesitation.
- Advance to `automatic`: correct_production ≥ 10, correct_comprehension ≥ 12, ≥ 5 sessions, ≥ 2 weeks since introduction, hesitation rate last 10 ≤ 20%, production_confidence ≥ 85
- Cannot be rushed. Time-in-learning is a required dimension [A].

**`automatic`** — Effortless, consistent production and comprehension.
- Maintained via spaced review.

### 13.2 False Mastery Guards (All Hard Rules)

- A word cannot reach `secure` or `automatic` within a single session regardless of performance.
- Fast correct answers do not accelerate mastery advancement. Speed is not a positive mastery signal without context.
- `correct_prompted` results do not count toward production advancement criteria.
- One correct answer never warrants advancement to next item.

### 13.3 Mastery Decay Schedule

| Level | No-review days before decay | Decay action |
|---|---|---|
| `emerging` | 7 days | Reset to introduced (retains emerging, resets signals) |
| `developing` | 14 days | Drop to emerging |
| `secure` | 21 days | Drop to developing |
| `automatic` | 30 days | Drop to secure |

### 13.4 Unit Mastery (Unlocks Next Unit)

Requirements:
- All target words at minimum `developing`
- ≥ 70% of target words at `secure` or above
- Unit review session completed
- ≥ 7 days since unit introduction [B]

Unit progression is backend-controlled. LLM cannot signal or trigger unit advancement.

### 13.5 Spaced Review Schedule

Review is mandatory — not optional.

| Review type | Timing | Mandatory? |
|---|---|---|
| Same-session review | Consolidation phase, ≥ 10 min after introduction | Yes |
| Next-lesson review | Warm-up of immediately following lesson | Yes |
| Weekly review | Every 5 lessons or 7 days (whichever first) | Yes |
| Spaced long review | At mastery-model-defined intervals (secure: 7/14/30 days; automatic: 14/30/60 days) | No (mastery-triggered) |

Review intervals are adapted from child L2 vocabulary research. Adult SRS intervals (weeks/months) are inappropriate for this age [B]. Specific day values are provisional [C — require empirical calibration].

Review item selection priority: overdue items first → recent errors → newly secured → scheduled spaced.

Review format must match mastery level:
- `emerging`: forced_choice_2 or forced_choice_4
- `developing`: forced_choice_4 or supported_production
- `secure`: sentence_frame_production or sentence_production
- `automatic`: sentence_production or review_production

---

## Section 14 — Safety & Cost Constraints

### 14.1 Content Safety (Hard Constraints)

- `child_age_filter`: ALWAYS ON
- `profanity_filter`: ALWAYS ON
- `pii_protection`: ALWAYS ON
- Safety classification: deterministic pattern match + keyword list run first; LLM may not be the sole safety arbiter; LLM may assist characterization only after flag is raised

Child distress escalation triggers:
- Child says "I don't want to" ≥ 3 times in session
- Crying or distress sounds detected
- Child says they are scared

Action: End lesson immediately with warm close. Flag session for parent review.

### 14.2 Backend Authority (Non-Negotiable)

| Decision | Owner | LLM role |
|---|---|---|
| Lesson plan content | Backend only | None |
| Word list for session | Backend only | None |
| Difficulty adjustment | Backend rule engine | None |
| Session length | Backend timer | None |
| Safety flags | Backend classifier | May assist characterization only |
| Mastery | Backend mastery model | None |
| Progression | Backend progression rules | None |
| Recovery state | Backend state machine | None |

### 14.3 Token Budget

| Limit | Value |
|---|---|
| Total tokens generated per session | 1200 max |
| Warning threshold | 1000 (begin close sequence) |
| Per-turn max | 80 tokens (absolute hard limit) |

### 14.4 Latency Requirement

Maximum teacher response latency after detected utterance end: 800ms. Latency > 1500ms breaks conversational flow for young learners [B].

The deterministic fast-path must handle ≥ 70% of turns without LLM calls to meet this target.

### 14.5 Session Length Hard Limits

| Age band | Max session seconds |
|---|---|
| 6–7 | 1500 (25 minutes) |
| 8–9 | 2100 (35 minutes) |

These are absolute ceilings. The session timer is backend-controlled. The LLM cannot extend a session.

### 14.6 Daily Limit Guidance

| Age band | Max daily minutes |
|---|---|
| 6–7 | 25 |
| 8–9 | 35 |

Over limit: display "Come back tomorrow" after normal completion. Do not start a new lesson. Hard enforcement is a parental/product decision [B].

### 14.7 Parent-Facing Review Triggers

Generate parent-facing session summary and flag for attention when:
- session_completion_rate < 50%
- child_speaking_turns < 8
- recovery_activities_triggered > 5
- l1_rescue_used == true

### 14.8 Autosave

Session state autosaves every 30 seconds. Autosaved state is resume-ready. Protects against crashes and connection drops.

---

## Section 15 — Test Strategy

### 15.1 Unit Test Requirements

All deterministic modules must have 100% branch coverage before Phase 2 begins:

| Module | Critical test paths |
|---|---|
| Perception | STT null → no_response; missing latency → silence_medium; Cyrillic input → l1_detected; very short utterance → confidence penalty |
| Fast-path classifier | All 30+ label paths; safe_fallback_label invoked when confidence < 0.6; guard for "no" as task answer vs. refusal |
| Recovery state machine | All state transitions; max_time_in_state auto-escalations; emotional_shutdown requires state evidence, not silence alone |
| Progression rules | All priority levels; global forbidden transitions respected; advance never fires with consecutive_correct < 2 |
| Activity engine | Variety guard fires on 4th consecutive same activity; easiest_win always selects mastered item; no advance during frustration |
| Vocabulary guard | Out-of-scope words blocked; correct word list enforced per session |
| Session completion | Easiest_win inserted before every stop; never ends on failure event |

### 15.2 Integration Test Scenarios

Each scenario defines an input sequence and asserts the full output path:

| Scenario | Expected outcome |
|---|---|
| Child silent for 4 seconds | silence_medium → offer_hint_warmly; no shame; no recovery state change on first event |
| Child gives L1 correct translation | l1_translation → acknowledge_comprehension_bridge_to_english; emotional_safety unaffected |
| 3 consecutive wrong answers on same item | mild_confusion after 2 → repeated_failure after 3; give_easiest_win triggered immediately on entry |
| Child says "I don't want to" ×3 | refusal state; end_session offered; no task continuation |
| Fast answer on forced_choice (< 700ms) | correct_confident downgraded to correct_hesitant; possible_guess logged |
| Session token budget at 1000 | Close sequence begins; no new items introduced |
| emotional_safety drops below 0.35 | pause_and_check_in overrides curriculum immediately |
| Consecutive correct ×6 on trivial items | Fake praise guard fires; neutral acknowledgment used |
| Session timeout mid-practice | Easiest_win inserted; abbreviated close; mastery saved up to timeout |
| unsafe_or_sensitive label fired | Immediate escalation; no LLM used to clear; human_review_queue logged |

### 15.3 LLM Output Testing

For every LLM call path:
- Vocabulary guard post-processing is tested independently of LLM output
- Token length enforcement tested against 80-token hard limit
- Template constraint verified: LLM output must match required template structure
- Timeout behavior verified: if LLM exceeds 400ms, fallback to deterministic template

### 15.4 Regression Tests

Before each phase release, run the full scenario suite. A regression in any HARD_STOP behavior (vocabulary guard, safety escalation, no advance on consecutive_correct < 2) is a release blocker.

---

## Section 16 — Implementation Phases for Claude Code

Each phase is a discrete, deliverable increment. Later phases depend on earlier ones. Do not start a phase until the previous phase passes its acceptance criteria.

---

### Phase 1 — Core Infrastructure (No LLM)

**Goal:** Backend skeleton, state model, deterministic classifier, recovery machine running.

**Deliverables:**
1. `backend/src/kids-brain/` directory structure created per Section 3
2. `perception.module.ts` — Assembles perception_bundle from all required inputs; handles all missing-data fallbacks
3. `child-state.schema.ts` — All session state variable types defined
4. `child-state.module.ts` — State delta application for all 30+ classification labels
5. `taxonomy.ts` — All classification labels with safe_fallback_labels
6. `fast-path.classifier.ts` — Deterministic classification for all silence, L1, refusal, and exact-match labels
7. `recovery-state-machine.ts` — All 8 recovery states with transition rules and max_time_in_state auto-escalations
8. `safety.module.ts` — Content safety classifier (pattern match + keyword list); safety audit log

**Acceptance criteria:**
- All unit tests for above modules pass with 100% branch coverage
- Recovery state machine passes all integration scenarios
- Safety module: unsafe_or_sensitive fires on test phrases; cannot be cleared by any non-human action
- No LLM calls in this phase

---

### Phase 2 — Learning Engine & Progression

**Goal:** Full deterministic progression loop running without LLM.

**Deliverables:**
1. `progression-rules.ts` — All priority-ordered rules (R01–R50+)
2. `mastery-model.ts` — All 4 mastery levels with advancement and decay rules
3. `mastery-updater.ts` — Mastery delta application per response event
4. `confidence-updater.ts` — Bounded EMA confidence score updates
5. `activity-demand-ladder.ts` — All 8 levels with use-when conditions
6. `activity-engine.module.ts` — Activity selection from progression decision
7. `variety-guard.ts` — Maximum 3 consecutive same-activity enforcement
8. `easiest-win.protocol.ts` — Guaranteed success fallback
9. `lesson-flow.module.ts` — Phase sequencer: warm_up → introduction → practice → consolidation → close
10. `session-completion.engine.ts` — All stop conditions; always-insert-easiest-win-before-stop

**Acceptance criteria:**
- All progression rule priorities verified in order (first match wins)
- All global forbidden transitions enforced
- No word can reach `secure` mastery in a single session
- Easiest win always fires before any session stop event
- Lesson always ends on a success event (verified across 20 test scenarios)
- Phase advancement only when phase success criteria met

---

### Phase 3 — Memory & Profile Layer

**Goal:** Persistent profile, session memory, continuity packet, privacy guard.

**Deliverables:**
1. `session-memory.ts` — Ephemeral WebSocket-scoped session state
2. `profile-store.ts` — Persistent child profile DB layer (encrypted at rest)
3. `continuity-packet.builder.ts` — Builds < 100 token session opener
4. `privacy.guard.ts` — Strips all PII and forbidden fields before any LLM context assembly
5. `review-scheduler.ts` — All 4 review types with interval calculation
6. `session-completion.engine.ts` — Session summary write; mastery persistence

**Acceptance criteria:**
- Privacy guard: LLM context assembly tested against all forbidden fields (child_id, raw transcript, emotional scores as numbers, family data) — none may pass through
- Continuity packet: verified < 100 tokens
- Profile write/read round-trip tested
- Review scheduling: all mastery levels produce correct next_review timestamps
- Safety event log: isolated from AI-accessible profile; verified not readable in session context

---

### Phase 4 — Teacher Response & LLM Integration

**Goal:** Teacher utterance generation; LLM classification for ambiguous cases; vocabulary guard.

**Deliverables:**
1. `template-library.ts` — All pre-written templates for deterministic paths
2. `vocabulary-guard.ts` — Post-generation word list enforcement
3. `llm-context.assembler.ts` — Minimal LLM context assembly (strictly within schema)
4. `llm-path.classifier.ts` — LLM-assisted classification for ambiguous semantic labels
5. `teacher-response.module.ts` — Orchestrates template-first, LLM-second generation
6. `l1-detector.ts` — L1 vocabulary list + Cyrillic script detection

**Acceptance criteria:**
- Vocabulary guard: blocks any out-of-scope word regardless of LLM output
- LLM context: verified against schema — no forbidden fields passable
- LLM classification: always returns a taxonomy label (never free-form); timeout fallback to deterministic template within 400ms
- Teacher turn token limit: 80 tokens hard limit enforced after generation
- All HARD_STOP forbidden behaviors verified absent across 50 generated teacher utterances (grammar labels, explicit correction, negative correction markers, generic praise)
- Fast-path handles ≥ 70% of turns in benchmark test set without LLM call

---

### Phase 5 — Full Session Integration & E2E Testing

**Goal:** End-to-end session test; parent dashboard data; production hardening.

**Deliverables:**
1. End-to-end session runner (simulated child input → full response pipeline)
2. Parent-facing session summary generation
3. Autosave implementation (30-second interval)
4. Session resume from autosave state
5. All 20 integration test scenarios passing (see Section 15.2)
6. Performance: full pipeline latency ≤ 800ms for deterministic path; ≤ 1500ms for LLM path
7. Session lifecycle tests: all stop conditions; all phase transitions; full lesson arc

**Acceptance criteria:**
- Full lesson from warm_up to close with simulated child inputs
- Lesson always ends on success (100% of test sessions)
- No unsafe content passes through vocabulary guard in 1000-utterance stress test
- No shame path triggered in any test scenario
- Recovery state machine: all 8 states reachable and all exits reachable
- Parent review triggers fire correctly
- Autosave and resume: session state survives simulated connection drop

---

## Section 17 — Open Questions Requiring Validation [C]

These items are marked [C] in the source packs. They represent product hypotheses that must not be treated as settled. Do not hardcode final values for these before empirical validation.

**17.1 STT Confidence Multipliers**
The adjusted_stt_confidence multipliers (response_length_penalty values, child speech prior of 0.85) are engineering estimates. These must be calibrated against the actual deployed STT engine using real child speech samples from the target age band and L1 background. Current values should be implemented as configurable constants, not hardcoded.

**17.2 Confidence Score Learning Rates**
The confidence delta values in Section 8.1 assume a learning_rate of 1.0. Per-child adjustment of learning rate based on historical variance is hypothetical. Implement with a configurable rate; calibrate from session data before tuning per-child.

**17.3 Spaced Review Intervals**
Review intervals (e.g., `developing` → 24h, `secure` → 7 days, `automatic` → 14 days) are adapted from adult L2 vocabulary research and expert inference for children. Specific day and hour values require empirical calibration with the target age group in real sessions. Implement as configurable constants.

**17.4 Mastery Partial Decay**
Partial decay (confidence reduction without level drop at 50% of the full decay threshold) is noted as provisional. Do not implement until the full decay model is empirically validated first.

**17.5 Fatigue Modeling**
Fatigue is estimated from session time + error rate + response latency patterns. The formula and thresholds are engineering inference. Real session data is required before the fatigue model should drive curriculum decisions beyond the session_stamina variable already defined.

**17.6 Engagement Score Formula**
The engagement score update formula uses smoothing factor 0.5 and signal weights derived from behavioral proxies. These weights require validation against expert annotation of child session videos. Until validated, engagement signals should inform but not solely drive activity switching decisions.

**17.7 Bonus Item in Lesson Extension**
Introducing a bonus item when all items are mastered early and engagement ≥ 60 is a product hypothesis. This feature should not be included in Phase 1–4 and should only be evaluated after baseline session data is available.

**17.8 Per-Session Token Budget**
The 1200-token session budget assumes approximately 100 generated tokens per minute over 12 minutes. Real session complexity may require adjustment. Monitor token usage in Phase 5 staging before setting final production limits.

**17.9 Daily Limit Hard Enforcement**
Whether the daily limit (25 min for 6–7, 35 min for 8–9) should be a soft recommendation or a hard stop is a product and parental policy decision. The architecture implements it as a soft recommendation. Hard enforcement must be a deliberate product choice after stakeholder input.

**17.10 Teacher Energy Calibration**
The rule that teacher energy must always be slightly more energetic than the child is a well-grounded pedagogical principle [A]. However, the specific prompting and template adjustments that produce this effect in LLM-generated utterances require iterative content review with qualified English language teaching (ELT) experts before production deployment.

---

*End of Mentium Kids Brain v1 Approved Specification.*  
*This document is the single source of truth for implementing `backend/src/kids-brain/`.*  
*No feature additions, scope expansion, or UI/animation/rewards economy definitions are included.*  
*Adult Obsidian Brain remains completely separate.*
