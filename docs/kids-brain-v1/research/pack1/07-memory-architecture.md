# Mentium Kids — Memory Architecture

## Classification: [A] Privacy-by-design | [B] Product design inference

---

## 1. Overview

Memory in Mentium Kids serves one purpose: to make the child feel known and safe, while protecting their privacy absolutely.

"The teacher remembers me" is a powerful signal of trust and warmth. It must be achieved without storing anything sensitive, without raw transcripts in AI context, and without creating a creepy surveillance feeling.

The architecture distinguishes four memory layers:

| Layer | Duration | Owner | Privacy Level |
|-------|----------|-------|---------------|
| Turn memory | Current turn | Session | Minimal data |
| Session memory | Current session | Session (ephemeral) | Working data |
| Profile memory | Across sessions | Backend DB | Privacy-sensitive |
| Teacher character memory | Per teacher persona | Backend | Non-personal |

---

## 2. Turn Memory

Exists only during the active classification → decision → response cycle.

**Contains**:
```json
{
  "perception_bundle": { ... },
  "classification_label": "l1_translation",
  "classification_confidence": 0.78,
  "action_selected": "use_l1_anchor",
  "response_generated": "Yes! Собака — in English, it's 'dog'! Dog!",
  "state_delta": { "l1_dependency": "+0.06" }
}
```

**Cleared**: After response is sent and state is updated.
**LLM access**: Only the `perception_bundle.stt_text` (normalized, not raw) and the current prompt context. No history.

---

## 3. Session Memory

Maintained for the duration of one session (WebSocket connection).

### 3.1 What Is Stored

```yaml
session_memory:
  session_id: uuid
  child_id: uuid  # internal only; not sent to LLM
  session_start_time: timestamp
  session_elapsed_ms: integer
  
  # Turn history (last 5 turns only)
  recent_turns:
    - turn_number: integer
      classification: label
      action_taken: label
      target_item: string
      success: boolean
  
  # State snapshot (read by decision engine)
  child_state: { ... }  # full state model
  
  # Item progress
  items_attempted: [item_id, ...]
  items_mastered: [item_id, ...]
  current_item_id: string
  current_item_attempt_count: integer
  
  # Session-level counters
  play_along_count: integer
  l1_anchor_used_items: [item_id, ...]
  total_praise_count: integer
  recent_praise_phrases: [last 3 phrases used]
```

### 3.2 What Is Sent to LLM (if LLM called)

The LLM receives only:

```yaml
llm_context:
  child_first_name: string  # e.g., "Sasha"
  age_band: "6-7"
  current_activity: "flashcard"
  target_item: "dog"
  stt_text_normalized: "sobaka"
  prompt_type: "name_item"
  attempt_number: 2
  recent_classification_labels: ["l1_translation", "l1_translation"]  # last 2 only
  teacher_character: "Luna"
```

The LLM does NOT receive:
- Raw transcript text
- Child's full session history
- Child's home language in detail
- Emotional state scores as numbers (may bias response)
- Failure counts as numbers

### 3.3 Session Memory Persistence

At session end, a **session summary** (not raw turns) is written to the profile:
```yaml
session_summary:
  date: date
  duration_minutes: integer
  items_attempted: count
  items_mastered: [item_ids]
  final_emotional_safety: float  # for trend analysis only
  recovery_events: count  # not details
```

---

## 4. Profile Memory

Persists across sessions. Backend DB only. Never sent raw to LLM.

### 4.1 What May Be Stored

```yaml
child_profile:
  child_id: uuid
  first_name: string          # "Sasha" — used in teacher speech
  age_band: "6-7"
  preferred_character: "Luna"
  
  # Learning profile
  vocabulary_mastery:
    dog: 0.85
    cat: 0.70
    red: 0.45
    # etc.
  
  production_confidence_baseline: 0.42
  l1_dependency_baseline: 0.35
  sessions_completed: 12
  last_session_date: date
  
  # Soft preferences (inferred, not stored as facts)
  high_engagement_topics: ["animals", "food"]  # inferred from activity_fatigue patterns
  preferred_activity_types: ["song", "flashcard"]  # inferred from engagement signals
  
  # Technical profile
  stt_reliability_estimate: 0.72  # per-child STT performance estimate
```

### 4.2 What Must NOT Be Stored

| Data | Reason |
|------|--------|
| Raw audio recordings | Privacy; unnecessary |
| Full session transcripts | Privacy; unnecessary |
| Emotional history in detail | Sensitive; unnecessary |
| Parent/guardian information | Not needed by AI |
| School name or location | Not needed |
| Device or IP information | Technical; separate system |
| Sibling or family details | Not needed |
| Anything the child said about personal life | Sensitive |
| Exact text of safety events | Separate secure log, not AI-accessible |

---

## 5. Teacher Character Memory

The AI teacher persona (e.g., "Luna the astronaut cat") has its own memory layer — separate from the child's data.

```yaml
character_memory:
  character_id: "luna"
  name: "Luna"
  personality_traits: ["warm", "curious", "encouraging"]
  catchphrases: ["Let's go!", "You're amazing!", "What is this?"]
  voice_id: string
  known_child_names: []  # loaded at session start from profile
```

This is static or slowly-updated configuration data. It does not contain child data.

---

## 6. The "Teacher Remembers Me" Effect

This must feel warm and personal without being creepy. The key is **selective, positive recall**.

### 6.1 What the Teacher May Reference

| Memory | Example |
|--------|---------|
| Child's first name | "Sasha, do you remember this word?" |
| Previous success | "You learned 'dog' last time!" |
| Preferred character | Teacher IS that character, consistently |
| Recent word | "We just learned 'cat' — now this one..." |
| High-engagement topic | "You love animals! Look at this one!" |

### 6.2 What the Teacher Must NOT Reference

| Forbidden | Reason |
|-----------|--------|
| Previous failure | "Last time you couldn't say this" — shame |
| Emotional events | "You were upset last time" — inappropriate |
| Private things said by child | "You told me your dog's name is Bobik" — creepy if overused |
| Session counts prominently | "This is your 12th session" — irrelevant to child |
| Any personal family data | Privacy |

### 6.3 How Continuity Works

At session start, the backend loads:
```yaml
continuity_packet:
  child_name: "Sasha"
  character: "Luna"
  last_item_mastered: "dog"  # for callback
  recent_mastered_words: ["dog", "cat"]  # up to 3
  high_engagement_topic: "animals"
```

This packet is sent to the LLM session initializer to allow warm, personalized greetings and callbacks.

**Size limit**: The continuity packet must be small (< 100 tokens). This forces specificity over general history.

---

## 7. Safety and Sensitive Data Rules

### 7.1 Safety Event Storage
Safety events (unsafe_or_sensitive classification) must:
- Be logged in a separate, secure, append-only audit log
- NOT be accessible to the AI in future sessions
- NOT be included in child profile summary
- Be accessible only to human reviewers with appropriate access

### 7.2 Data Minimization Principle
The system should store the **minimum data necessary** for learning continuity. Before adding a new data field to the profile, the question must be: "Would removing this field meaningfully degrade the child's learning experience?"

If the answer is no → do not store it.

### 7.3 GDPR / Child Data Regulations
- Children's data requires parental consent [A]
- Data must be deletable on request
- Data retention period must be defined
- No data may be shared with advertising third parties
- LLM API calls must comply with data processing agreements
- Child transcripts (if stored temporarily) must be treated as sensitive personal data

[A] GDPR Article 8, COPPA in the US context.

---

## 8. LLM Data Handling Rules

| Rule | Implementation |
|------|----------------|
| No raw transcripts to LLM | Normalized text only |
| No child ID to LLM | Session-scoped anonymized reference only |
| No emotional scores as numbers | Use qualitative labels in prompt if needed |
| No family or personal data | Strip before LLM context assembly |
| LLM response stored only as action label | Not the raw LLM output text in profile |
| LLM provider data retention policy must be verified | Legal requirement for under-13 data |

---

## 9. Memory Diagram

```
CHILD PROFILE (Backend DB)
    ↓ (load at session start)
CONTINUITY PACKET (< 100 tokens)
    ↓
SESSION MEMORY (ephemeral, WebSocket)
    ↓ (per-turn extraction)
LLM CONTEXT (minimal, normalized)
    ↑
TURN MEMORY (one turn only)

At session end:
SESSION MEMORY → SESSION SUMMARY → PROFILE UPDATE
(delta only; not raw session data)
```
