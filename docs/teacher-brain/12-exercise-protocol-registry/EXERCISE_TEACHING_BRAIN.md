# Exercise Teaching Brain

> Formal runtime specification for exercise teaching behavior.
> Backend implementation: `backend/src/behavior-runtime/exercise-teaching/`

See also: [[DEMONSTRATION_PROTOCOL]] · [[EXERCISE_TEACHING_GOLDENS]] · [[FRONTEND_SYNC_DOCTRINE]] · [[RETRY_ESCALATION_POLICY]]

---

## Architecture Overview

```
Student answer
  → Interpretation
  → Validation (Exercise Engine)
  → buildExerciseTeachingContext()        ← NEW
      → detectTeachingMode()
      → determineDemoContext()
      → buildRetryEscalation()
      → evaluateTaskBoundary()
      → buildFrontendSyncGuard()
  → Teacher Brain prompt (with injected context)
  → AI verbal response (verbal only)
```

---

## Module Location

```
backend/src/behavior-runtime/exercise-teaching/
├── index.ts                       Public API
├── exercise-format-registry.ts    Canonical per-type policies
├── teaching-mode-runtime.ts       TeachingMode enum + detector
├── demonstration-policy.ts        Demo decision + context builder
├── task-boundary-guard.ts         Prevents leaking answers/solving ahead
├── frontend-sync-guard.ts         Screen-aware constraint builder
├── retry-escalation.ts            Varied hint content per type + turn
└── exercise-teaching-tracer.ts    Langfuse behavioral spans
```

---

## Supported Exercise Types

### Deterministic Sequential (exact/ai-semantic validation)

| Type | Answer Format | Demo Required | Reveal Turn |
|------|-------------|---------------|-------------|
| fill_gap | single_word | Yes | D |
| choose_from_box | single_word | Yes | D |
| complete_correct_form | single_word | Yes | D |
| form_transformation | full_sentence | Yes | D |
| rewrite_sentence | full_sentence | Yes | D |
| write_sentences_from_prompts | full_sentence | Yes | D |
| reconstruction | full_sentence | Yes | D |
| write_questions | full_sentence | Yes | D |
| error_correction | full_sentence | Yes | D |
| replace_substitute_words | single_word | Yes | D |
| tick_cross | true_false_word | Yes | D |
| true_false | true_false_word | Yes | D |

### Matching Sequential (reveal on B)

| Type | Answer Format | Demo Required | Reveal Turn |
|------|-------------|---------------|-------------|
| matching | letter_choice | No | B |
| vocabulary_matching | letter_choice | No | B |
| collocations | letter_choice | Yes | B |
| find_opposites | letter_choice | No | B |
| multiple_choice | letter_choice | Yes | D |

### Soft Speaking (no correction ladder)

| Type | Answer Format | Demo Required | Policy |
|------|-------------|---------------|--------|
| speaking_prompt | free_speech | No | accept after 1 substantive response |
| discussion | free_speech | No | accept after 1 substantive response |
| roleplay | free_speech | No | accept any in-character response |
| show_interest_agree_disagree | free_speech | Yes | accept after 1 response |
| brainstorm_60_second | free_speech | No | accept any words |
| show_what_you_know | free_speech | No | accept any sharing |
| write_sentences_from_prompts | full_sentence | Yes | soft accept |

### Explanation Blocks

| Type | Answer Format | Demo Required | Policy |
|------|-------------|---------------|--------|
| grammar_focus | single_word | No | explanation + comprehension check |
| remember_this | free_speech | No | note + acknowledgement |

---

## Teaching Mode State Machine

```
                    ┌──────────────┐
            ┌──────▶│ INSTRUCTION  │ (item 0, no correction, first item)
            │       └──────┬───────┘
            │              │ item presented
            │              ▼
            │       ┌──────────────┐
            │       │STUDENT_TASK  │ (student must answer)
            │       └──────┬───────┘
            │              │ wrong answer
            │              ▼
            │       ┌──────────────┐
            │       │ CORRECTION   │ (TURN A)
            │       └──────┬───────┘
            │              │ still wrong
            │              ▼
            │       ┌──────────────┐
            │       │    HINT      │ (TURN B, C)
            │       └──────┬───────┘
            │              │ still wrong
            │              ▼
            │       ┌──────────────┐
            │       │    RETRY     │ (TURN D — reveal)
            │       └──────┬───────┘
            │              │ correct or after repeat
            │              ▼
            └───────┌──────────────┐
                    │  TRANSITION  │ (move to next item/exercise)
                    └─────────────┘
```

---

## Task Boundary Guard

The guard fires when:
- Items ahead of the cursor might be accidentally solved
- The answer is about to be revealed before the allowed turn
- The exercise is being marked complete while items remain

**Result:** Constraint block injected into prompt, tracing span emitted.

---

## Frontend Sync Guard

The guard fires when:
- Current item is visible on screen (suppress re-reading)
- Word bank / options are visible (suppress reading aloud)
- Matching columns are visible (reference by letter/number only)
- Completed items must not be re-asked
- Pending transition state must be verbalized

**Result:** Sync constraint block injected into prompt, tracing span emitted.

---

## Retry Escalation Quality Contract

Each correction turn MUST introduce NEW content:

| Turn | Type | Content |
|------|------|---------|
| A | Knowledge gap question | Identify the specific rule/error — ask, don't tell |
| B | Structural guidance | Pattern or category — not the answer |
| C | Near-reveal | First letter, first word, or almost-full hint |
| D | Full reveal | Answer + brief rule + ask to repeat |

**Anti-repetition rule:** Turn B must be a different angle from Turn A.

---

## Langfuse Behavioral Traces

New spans emitted by this module:

| Span name | When emitted | Key data |
|-----------|-------------|----------|
| `exercise_type_selected` | Every teacher turn | type, supported, exerciseNum |
| `teaching_mode_changed` | Mode detection | mode, correctionTurn, reason |
| `demonstration_policy_selected` | Item 0 only | decision, isFirstEncounter |
| `frontend_sync_guard_triggered` | Guard fires | ruleCount, exerciseType |
| `task_boundary_guard_triggered` | Boundary detected | violations, itemIndex |
| `hint_strategy_selected` | Correction turns | turn, hintType |
| `retry_strategy_selected` | A/B/C/D turns | shouldReveal, reason |

---

## Integration Points

The context block is assembled in:
```
backend/src/ai/teacher-brain/teacher-brain-builder.ts
→ buildExerciseTeachingBrainSection()
→ injected between buildBehaviorContractSection() and buildHumanTutorSection()
```

The legacy `buildBehaviorContext()` in `behavior-runner.ts` is also enriched with:
- Type-specific answer format spec
- Partial answer handling rule
- Screen awareness note

---

## Unsupported Types

All `postponed` and `unsupported` exercise types receive:
```
⚠ UNSUPPORTED — [reason]
REQUIRED: One-sentence skip + present next exercise in SAME response.
FORBIDDEN: Adapting, converting, or improvising.
```

Types unsupported for now:
- All listening types (requires audio runtime)
- All reading types (requires paragraph mode)
- All writing types (requires writing mode)
- complete_table, complete_cartoon_captions (require image rendering)
- exam_focus_unsupported (not a structured exercise)
