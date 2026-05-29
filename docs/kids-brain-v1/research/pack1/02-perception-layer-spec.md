# Mentium Kids — Perception Layer Specification

## Classification: [A/B] Established signal types + child-specific design inference

---

## 1. Purpose

The perception layer converts raw, noisy child input into a structured **perception bundle** that the response classifier can act on. It does not classify the response — it assembles everything the classifier needs to do so correctly.

The perception layer runs before any LLM call and before classification. It is entirely deterministic.

---

## 2. Input Signal Inventory

### 2.1 Required Inputs

| Signal | Source | Notes |
|--------|--------|-------|
| `stt_text` | STT engine output | Raw text, possibly noisy |
| `stt_confidence` | STT engine | Float 0.0–1.0; often unreliable on children |
| `response_latency_ms` | Server-side timestamp | Time from prompt end to first audio |
| `silence_duration_ms` | Audio analysis | Duration of silence before speech, if any |
| `prompt_type` | Session state | What the teacher just asked (e.g., `name_item`, `repeat_after_me`, `forced_choice`) |
| `target_item` | Session state | The correct answer (e.g., "dog", "red") |
| `activity_type` | Session state | e.g., `flashcard`, `mini_story`, `song`, `forced_choice` |
| `child_age_band` | Child profile | `6-7` or `8-9` |
| `recent_turn_history` | Session memory | Last 3–5 turns: classification + action taken |

### 2.2 Optional Inputs (used if available)

| Signal | Source | Notes |
|--------|--------|-------|
| `stt_alternatives` | STT engine | Alternative transcription candidates |
| `audio_energy_level` | Audio pipeline | Indicator of loudness/whisper |
| `speech_duration_ms` | Audio pipeline | How long the child spoke |
| `attempt_count` | Session state | How many times this item has been attempted this turn |
| `session_elapsed_ms` | Session state | Time into session |
| `recent_success_count` | Session state | Successes in last 5 turns |
| `recent_failure_count` | Session state | Failures in last 5 turns |
| `recovery_state` | State model | Current recovery state label |

### 2.3 Future Inputs (not implemented; reserved for roadmap)

| Signal | Notes |
|--------|-------|
| `prosody_energy_curve` | Would distinguish excited vs flat vs upset speech |
| `voice_quality_flags` | Crying, laughing, whispering |
| `face_engagement_signal` | From camera (strict privacy constraints required) |

These must not be assumed available. Do not design hard dependencies on them.

---

## 3. STT Reliability Model for Children

Child speech is substantially more difficult for STT than adult speech. The system must treat STT output as **unreliable by default**. [A]

Known failure modes:
- Mispronunciation that matches a different word
- Partial word transcribed as wrong word
- Heavy accent flagged as incorrect
- Filler sounds ("um", "uh", "mm") transcribed as words
- Short single-word answers (the majority of young child responses) have higher error rates

**Implication**: `stt_confidence` alone is not sufficient. High STT confidence can still be a wrong transcription.

### 3.1 STT Reliability Adjustment

```
adjusted_stt_confidence = stt_confidence
  * response_length_penalty(stt_text)  # short = lower adjusted confidence
  * child_speech_prior_penalty         # constant ~0.85 for age 6-7
  * (0.7 if speech_duration_ms < 400 else 1.0)  # very short utterances less reliable
```

`response_length_penalty`:
- 1 word: 0.85
- 2 words: 0.92
- 3+ words: 1.0

[B] These multipliers are engineering estimates; empirical calibration against target STT engine is required.

---

## 4. L1 Detection

The perception layer must flag if the response contains L1 (Russian or Ukrainian) before the classifier runs.

### 4.1 L1 Detection Method

1. **Vocabulary list match**: Maintain a list of common child L1 words (animals, colors, numbers, family, greetings — 200–400 words). Match against normalized STT text.
2. **Script detection**: Unicode script analysis (Cyrillic characters → immediate L1 flag).
3. **Common child phrases**: "не знаю", "я не знаю", "что?", "как?", "хочу", "мама", "не хочу" — high signal phrases mapped to specific intent labels.

**Output signals**:
```yaml
l1_detected: true/false
l1_script: cyrillic / latin_loanword / ambiguous
l1_intent_hint: translation / help_request / refusal / unknown
l1_word: "собака"  # if detected
```

Script detection is deterministic. Vocabulary match is probabilistic (may miss) but safe to use as signal.

---

## 5. Silence and Latency Thresholds

### 5.1 Response Latency Classification

| Latency | Signal |
|---------|--------|
| 0–800ms | Fast response (may be guessing or repeating) |
| 800ms–2500ms | Normal response range for 6–9 year olds |
| 2500ms–5000ms | Hesitant; possible confusion |
| 5000ms–8000ms | Silence threshold approaching |
| >8000ms | Silence; trigger scaffolding path |

[B] These thresholds are educated estimates from child SLA research. Age-specific values should be tuned empirically.

Age adjustment:
- 6–7: thresholds shift ~500ms longer (lower processing speed)
- 8–9: use base values

### 5.2 Silence Duration Classification

```yaml
silence_short: < 3000ms   # thinking; do nothing yet
silence_medium: 3000–6000ms  # offer hint or repeat prompt
silence_long: 6000–10000ms   # scaffold; offer model or choice
silence_extended: > 10000ms  # recovery state trigger
```

Silence must never be labeled "failure." It is a scaffold trigger.

---

## 6. Prompt Context Normalization

The perception layer records what the teacher just asked to give the classifier context.

```yaml
prompt_context:
  prompt_type: "name_item"          # what kind of task
  prompt_text: "What is this?"      # what teacher said
  target_item: "dog"                # expected correct answer
  modality: "visual"                # flashcard shown
  model_was_given: false            # did teacher model the answer first?
  choice_options: []                # if forced choice, the options presented
  attempt_number: 1                 # how many times attempted on this item
```

---

## 7. Perception Bundle Output

The perception layer produces a single structured bundle passed to the classifier:

```yaml
perception_bundle:
  # Raw signal
  stt_text: "собака"
  stt_confidence: 0.91
  adjusted_stt_confidence: 0.77
  response_latency_ms: 1400
  silence_duration_ms: 0
  speech_duration_ms: 600
  
  # Derived flags
  l1_detected: true
  l1_script: cyrillic
  l1_intent_hint: translation
  l1_word: "собака"
  
  is_silence: false
  is_very_fast: false
  is_hesitant: false
  has_audio: true
  
  # Normalized text
  text_normalized: "sobaka"        # romanized for comparison
  text_lowercased: "собака"
  word_count: 1
  
  # Context
  prompt_context:
    prompt_type: "name_item"
    target_item: "dog"
    model_was_given: false
    attempt_number: 1
  
  # Child state snapshot
  child_state_snapshot:
    age_band: "6-7"
    recovery_state: "normal"
    recent_success_count: 3
    recent_failure_count: 0
    emotional_safety: 0.85
    frustration_risk: 0.12
```

---

## 8. Missing Data Behavior

| Missing Signal | Fallback Behavior |
|----------------|-------------------|
| `stt_text` null | Treat as `no_response`; do not attempt classification |
| `stt_confidence` missing | Use 0.5 as default; apply conservative classification |
| `response_latency_ms` missing | Treat as `silence_medium`; safe scaffold |
| `audio_energy_level` missing | Do not use energy signals in classification |
| `child_state_snapshot` missing | Use profile defaults for age band |
| `target_item` missing (open task) | Disable exact-match path; use semantic/LLM path |
| STT timeout | Treat as `no_response` |

**Rule**: Missing data always resolves to the safer, more scaffolded action. Never assume missing signal = problem. [A]

---

## 9. Confidence Scoring at Perception Layer

The perception layer emits a `perception_confidence` score that the classifier uses to decide how much to trust the bundle.

```
perception_confidence = 
  adjusted_stt_confidence
  * (0.6 if is_silence else 1.0)
  * (0.8 if attempt_count > 2 else 1.0)
  * (0.9 if word_count == 1 else 1.0)
```

Low `perception_confidence` (< 0.5) → classifier defaults to `near_correct` or `uncertain` rather than `wrong`.

---

## 10. Reliability Classification of Each Signal

| Signal | Reliability | Reason |
|--------|-------------|--------|
| Silence duration | High | Time-based; not interpretable |
| Response latency | High | Time-based |
| L1 script detection | High | Deterministic Unicode |
| L1 vocabulary match | Medium | May miss paraphrases or romanized L1 |
| STT text | Low–Medium | Child speech STT is noisy |
| STT confidence | Low | Overconfident on familiar words |
| Audio energy | Medium | Microphone variance; do not over-rely |
| Prosody (future) | Unknown | Not available; reserve |
