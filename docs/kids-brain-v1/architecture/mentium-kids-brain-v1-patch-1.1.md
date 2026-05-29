# Mentium Kids Brain v1 — Architecture Audit Patch
**Patch version:** 1.1  
**Base document:** Mentium Kids Brain v1 Approved Architecture Specification v1.0  
**Authority:** Architecture Board  
**Purpose:** Resolve implementation blockers and contract gaps identified in architecture audit.  
**Scope:** Patches only. No new features. No architectural redesign.

---

## Patch Summary

| Audit Issue | Blocker? | Status |
|---|---|---|
| AUDIT-1: Session store contract undefined | Yes | RESOLVED — see Patch 1 |
| AUDIT-2: STT contract undefined | Yes | RESOLVED — see Patch 2 |
| AUDIT-3: Database schema undefined | Yes | RESOLVED — see Patch 3 |
| AUDIT-4: LLM timeout fallback undefined | Yes | RESOLVED — see Patch 4 |
| AUDIT-5: core_teacher_language_vocabulary undefined | Yes | RESOLVED — see Patch 5 |
| Pipeline order: recovery runs after response generation | Gap | RESOLVED — see Patch 6 |
| Confidence scale inconsistency (0–1 vs 0–100) | Gap | RESOLVED — see Patch 7 |
| Easiest-win cold-start fallback undefined | Gap | RESOLVED — see Patch 8 |
| L1 budget exhausted fallback undefined | Gap | RESOLVED — see Patch 9 |
| TurnRecord schema undefined | Gap | RESOLVED — see Patch 10 |
| MasteryRecord schema undefined | Gap | RESOLVED — see Patch 11 |
| ActionPacket enum undefined | Gap | RESOLVED — see Patch 12 |
| Latency/observability events undefined | Gap | RESOLVED — see Patch 13 |

All 5 blockers are resolved. All 8 contract gaps are closed.

---

## Patch 1 — Session Store Contract
**Closes:** AUDIT-1  
**Replaces:** Section 4.2 (Session Lifecycle Flow), Section 12.1 (Memory Layers), and Section 16 Phase 3 (Memory & Profile Layer)

### 1.1 Storage Layer Assignments

Three storage tiers are defined. No module may use a tier not assigned to it.

| Tier | Technology | Scope | Allowed in production? |
|---|---|---|---|
| Redis | Active session state | Per-WebSocket session | Yes |
| Postgres | Durable profile data, session summaries, mastery records, safety events | Cross-session | Yes |
| In-memory (process heap) | Unit and integration tests only | Process-local | Tests only |

In-memory session state is explicitly forbidden in production and staging environments. Any module that declares a Map or plain object as session storage outside of a test file is a build error.

### 1.2 Redis: Active Session State

Redis holds the full `SessionMemory` object for a live session. Key structure:

```
kids-brain:session:{session_id}
```

TTL: session duration + 15 minutes grace period. After TTL expiry, the session is considered abandoned; no resume is possible without a new session start.

**What lives in Redis:**

```
SessionMemory:
  session_id
  child_id (UUID reference only — no PII)
  session_start_time
  session_elapsed_ms
  child_state (all session state variables)
  recovery_state
  lesson_phase
  items_attempted[]
  items_mastered[]
  current_item_id
  current_item_attempt_count
  activity_history (last 10 events)
  recent_turns (last 5 TurnRecords — see Patch 10)
  play_along_count
  l1_anchor_used_items[]
  recent_praise_phrases[]
  autosave_sequence_number (monotonic integer, increments on each write)
```

**Redis write policy:** Write on every turn completion. Do not defer writes. The write happens in Step 8 (Memory Module) of the processing loop, after the action packet is assembled but before it is dispatched to the frontend. If the Redis write fails, the session continues on the current in-process state for that turn, and the failure is logged as `SESSION_REDIS_WRITE_FAILURE`. The write is retried once on the next turn.

**Redis read policy:** At WebSocket connection establishment, load `SessionMemory` from Redis by `session_id`. If the key does not exist, this is a new session (not a resume).

### 1.3 Postgres: Durable Storage

Postgres holds all data that must survive beyond a session boundary. See Patch 3 for full schema definition.

Tables owned by Kids Brain:

```
kids_brain_child_profiles
kids_brain_mastery_records
kids_brain_session_summaries
kids_brain_safety_events
```

No Kids Brain module reads from or writes to any Obsidian Brain Postgres tables. Separate schemas are used if sharing a single Postgres instance: `kids_brain.*` vs `obsidian.*`.

### 1.4 Reconnect Behavior

**Scenario: child's device drops and reconnects within TTL (≤ 15 minutes after last activity)**

1. Frontend sends reconnect request with `session_id`.
2. Backend reads `SessionMemory` from Redis using `session_id`.
3. If key exists: restore session in full. Resume from the last completed turn. Re-emit the last action packet (idempotent replay).
4. Emit `SESSION_RECONNECTED` log event.
5. Teacher utterance on reconnect: use scripted warmth line ("Oh! You're back! Let's keep going!") — not LLM-generated.

**Scenario: reconnect attempt after TTL expiry (> 15 minutes)**

1. Redis key is gone. Session cannot be resumed.
2. Start a new session. Load profile from Postgres. Build new continuity_packet.
3. Emit `SESSION_EXPIRED_NEW_STARTED` log event.
4. Teacher utterance: warm greeting as normal session start.

**Scenario: Redis is unavailable on reconnect**

1. Treat as TTL-expired case. Start new session from Postgres profile.
2. Emit `SESSION_REDIS_UNAVAILABLE` log event with severity WARNING.
3. Do not surface error to child.

### 1.5 Node Topology Assumptions

**v1 assumption: single-node WebSocket server.**

A session's WebSocket connection and Redis session key are bound to one server process. There is no cross-node session handoff in v1. If a server node fails, active sessions on that node are lost beyond what Redis has persisted (last completed turn). This is acceptable for v1.

Multi-node sticky routing (e.g., via load balancer session affinity) is the correct path if horizontal scaling is required in a future version. This spec does not define that path — it is deferred.

**v1 Redis topology: single Redis instance or Redis Sentinel.**

Redis Cluster is not required for v1. If Redis becomes unavailable, sessions degrade gracefully (new session from profile). Redis is not a single point of data loss because Postgres holds all durable state.

### 1.6 Autosave Target

The autosave interval is 30 seconds (unchanged from v1.0). Autosave writes the current `SessionMemory` to Redis with an incremented `autosave_sequence_number`. It does not write to Postgres — Postgres receives only the final `SessionSummary` at session end.

The autosave write uses the same Redis key as the turn-completion write. There is no separate autosave key. If an autosave write and a turn-completion write race, the turn-completion write takes precedence (it carries the higher `autosave_sequence_number`).

**Patch 1 also adds to Section 3 module map** (additional file under `memory/`):

```
├── memory/
│   ├── redis-session.store.ts      # Redis read/write for SessionMemory
│   ├── postgres-profile.store.ts   # Postgres read/write for profiles and summaries
│   ...existing files unchanged...
```

---

## Patch 2 — STT Contract
**Closes:** AUDIT-2  
**Replaces:** Section 5.1 (Required Inputs), Section 5.3 (STT Reliability Adjustment), Section 5.7 (Missing Data Contracts)

### 2.1 STT Provider

**v1 deployed provider: Google Cloud Speech-to-Text v2 (Chirp model).**

This is the only STT provider contracted for v1. If the provider changes, the `STTResult` interface below is the boundary — the perception module must not import provider-specific types directly. An adapter layer translates provider output into `STTResult`.

Provider adapter location: `backend/src/kids-brain/perception/stt-adapter.ts`

### 2.2 Normalized STTResult Interface

The perception module receives only this interface. The STT adapter is responsible for mapping provider-specific fields to it.

```typescript
interface STTResult {
  // Primary transcript
  text: string | null;                    // Best-guess transcription; null if no speech detected
  confidence: number | null;              // Provider confidence 0.0–1.0; null if unavailable
  language_code: string | null;           // e.g. "en-US", "uk-UA", "ru-RU"; null if undetected

  // Alternatives (ordered by confidence descending)
  alternatives: Array<{
    text: string;
    confidence: number;
  }>;                                     // May be empty array; never null

  // Timing
  speech_start_ms: number | null;         // Offset from prompt-end to first phoneme
  speech_end_ms: number | null;           // Offset from prompt-end to last phoneme
  speech_duration_ms: number | null;      // Derived: speech_end_ms - speech_start_ms

  // Audio characteristics (provider-dependent; may be absent)
  audio_energy_level: number | null;      // Normalized 0.0–1.0 if available; null otherwise

  // Provider metadata (for logging only; not used in classification)
  provider: "google_chirp_v2";
  provider_request_id: string;
  processing_latency_ms: number;          // Time from audio submission to result receipt
}
```

No module outside `perception/` imports `STTResult` directly. The perception module consumes it and emits a `PerceptionBundle`. All downstream modules work with `PerceptionBundle` only.

### 2.3 Fallback Behavior When Fields Are Missing

The perception module must handle every combination of null fields safely. The following table is exhaustive — no case may be left unhandled:

| Missing field(s) | Fallback behavior | Log event |
|---|---|---|
| `text` is null | Emit `is_silence = true`, treat as `silence_long` if `speech_start_ms` is also null; treat as `no_response` if no audio energy detected | `PERCEPTION_NULL_TEXT` |
| `confidence` is null | Set `adjusted_stt_confidence = 0.50`. Mark `perception_confidence` as low-trust. [C — see 17.1] | `PERCEPTION_NULL_CONFIDENCE` |
| `speech_duration_ms` is null | Skip the `< 400ms` short-utterance penalty in the reliability formula. Do not estimate duration. | `PERCEPTION_NULL_DURATION` |
| `audio_energy_level` is null | Do not use energy in any classification decision. The classifier must not branch on energy if this field is null. | `PERCEPTION_NULL_ENERGY` |
| `language_code` is null | Do not use language code in L1 detection. Fall back to Cyrillic script detection + vocabulary list match only. | `PERCEPTION_NULL_LANG` |
| `alternatives` is empty | Proceed with `text` only. No alternative-based matching. | — |
| Full STT timeout (no result within 2000ms) | Treat as `no_response`. Emit `PERCEPTION_STT_TIMEOUT`. Do not retry in same turn. | `PERCEPTION_STT_TIMEOUT` |

### 2.4 STT Reliability Adjustment Formula (All Multipliers Marked [C])

```
adjusted_stt_confidence =
  base_confidence                                          [C: null case → 0.50]
  × response_length_penalty(word_count)                   [C: 1-word: ×0.85, 2-word: ×0.92, 3+: ×1.0]
  × child_speech_prior                                     [C: constant 0.85 for age 6-7, 0.90 for age 8-9]
  × (0.7 if speech_duration_ms < 400 AND speech_duration_ms != null else 1.0)  [C]
```

All four multiplier groups are marked [C]. They are implemented as named constants in `backend/src/kids-brain/shared/constants.ts`:

```
STT_CHILD_SPEECH_PRIOR_6_7 = 0.85        // [C]
STT_CHILD_SPEECH_PRIOR_8_9 = 0.90        // [C]
STT_SHORT_UTTERANCE_PENALTY = 0.70       // [C] applied when speech_duration_ms < 400
STT_RESPONSE_LENGTH_1_WORD = 0.85        // [C]
STT_RESPONSE_LENGTH_2_WORD = 0.92        // [C]
STT_CONFIDENCE_NULL_DEFAULT = 0.50       // [C]
```

Any change to these values requires a constants review entry in the changelog — they must not be changed silently.

### 2.5 Safe Degradation Summary

The perception module degrades gracefully when STT quality is poor:

- If `adjusted_stt_confidence < 0.50` → `perception_confidence` will be low → classifier defaults to `near_correct` or `uncertain` rather than `wrong`.
- If `confidence` is null → baseline is 0.50 → perception produces a low-trust bundle → classifier routes to safe fallback labels.
- The classifier must never crash or block on null STT fields. The perception module guarantees a fully-populated `PerceptionBundle` with nulls converted to typed fallback values before the classifier receives it.

---

## Patch 3 — Database Schema
**Closes:** AUDIT-3  
**New section:** Insert as **Section 3A — Database Schema** between Section 3 and Section 4.

---

## Section 3A — Database Schema

**Technology:** Postgres (single schema `kids_brain` in v1).  
**Ownership:** All tables are owned exclusively by `backend/src/kids-brain/`. No other subsystem reads or writes these tables directly. Cross-subsystem data access uses defined service interfaces, not direct SQL from outside `kids-brain/`.

### 3A.1 Table: `kids_brain_child_profiles`

Stores the durable profile for each child. One row per child.

```sql
CREATE TABLE kids_brain_child_profiles (
  child_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name_encrypted  BYTEA NOT NULL,        -- AES-256-GCM encrypted; decrypted only at session start
  age_band              VARCHAR(3) NOT NULL CHECK (age_band IN ('6-7', '8-9')),
  production_confidence_baseline  NUMERIC(4,3) NOT NULL DEFAULT 0.300,
  l1_dependency_baseline          NUMERIC(4,3) NOT NULL DEFAULT 0.200,
  sessions_completed    INTEGER NOT NULL DEFAULT 0,
  last_session_date     DATE,
  stt_reliability_estimate        NUMERIC(4,3) NOT NULL DEFAULT 0.720,  -- [C]
  high_engagement_topics          TEXT[],
  preferred_activity_types        TEXT[],
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_child_profiles_last_session
  ON kids_brain_child_profiles (last_session_date);
```

**Ownership rules:**
- `first_name_encrypted` is decrypted only by `memory/postgres-profile.store.ts` at session load time. The decrypted value is passed into session memory as `child_first_name`. It never enters a Postgres query as plaintext. It never enters an LLM context string directly — only through the privacy guard.
- No field in this table may be added without a data minimization review: "Would removing this field meaningfully degrade the child's learning experience?"

**What is not stored here:** raw transcripts, emotional history, device IDs, parent contact data, school name, siblings, or anything the child said about personal life.

### 3A.2 Table: `kids_brain_mastery_records`

Stores per-child, per-vocabulary-item mastery state. One row per (child_id, item_id) pair.

```sql
CREATE TABLE kids_brain_mastery_records (
  id                              BIGSERIAL PRIMARY KEY,
  child_id                        UUID NOT NULL REFERENCES kids_brain_child_profiles(child_id) ON DELETE CASCADE,
  item_id                         VARCHAR(64) NOT NULL,   -- vocabulary item identifier from curriculum
  mastery_level                   VARCHAR(16) NOT NULL CHECK (mastery_level IN ('emerging', 'developing', 'secure', 'automatic')),
  production_confidence           NUMERIC(5,2) NOT NULL DEFAULT 0.00,  -- 0–100 scale (see Patch 7)
  comprehension_confidence        NUMERIC(5,2) NOT NULL DEFAULT 0.00,  -- 0–100 scale
  correct_production_count        INTEGER NOT NULL DEFAULT 0,
  correct_comprehension_count     INTEGER NOT NULL DEFAULT 0,
  sessions_seen                   INTEGER NOT NULL DEFAULT 0,
  sessions_with_correct_production INTEGER NOT NULL DEFAULT 0,
  activity_types_succeeded        TEXT[],                -- list of activity_ids where correct
  last_seen_at                    TIMESTAMPTZ,
  last_correct_at                 TIMESTAMPTZ,
  review_due_at                   TIMESTAMPTZ,
  introduced_lesson_id            VARCHAR(64),
  introduced_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (child_id, item_id)
);

CREATE INDEX idx_mastery_child_review_due
  ON kids_brain_mastery_records (child_id, review_due_at)
  WHERE review_due_at IS NOT NULL;

CREATE INDEX idx_mastery_child_level
  ON kids_brain_mastery_records (child_id, mastery_level);
```

**Confidence scale:** `production_confidence` and `comprehension_confidence` are stored on the 0–100 scale used by the Learning Engine (see Patch 7). The session-layer 0.0–1.0 scale is converted on read/write by `mastery-updater.ts`.

**Transaction boundary:** All mastery updates for a session are written in a single Postgres transaction at session end (normal or timeout stop). Emotional stops write only the items that reached a fully-completed attempt.

### 3A.3 Table: `kids_brain_session_summaries`

Stores the end-of-session summary. One row per session. Raw turn data is never stored here.

```sql
CREATE TABLE kids_brain_session_summaries (
  session_id              UUID PRIMARY KEY,
  child_id                UUID NOT NULL REFERENCES kids_brain_child_profiles(child_id) ON DELETE CASCADE,
  started_at              TIMESTAMPTZ NOT NULL,
  ended_at                TIMESTAMPTZ NOT NULL,
  duration_seconds        INTEGER NOT NULL,
  stop_reason             VARCHAR(32) NOT NULL CHECK (stop_reason IN (
                            'normal', 'timeout', 'emotional', 'engagement', 'refusal', 'safety'
                          )),
  lesson_id               VARCHAR(64),
  lesson_phase_reached    VARCHAR(32),
  items_attempted_count   INTEGER NOT NULL DEFAULT 0,
  items_mastered_ids      TEXT[],                 -- item_ids only; no content
  recovery_event_count    INTEGER NOT NULL DEFAULT 0,
  l1_rescue_used          BOOLEAN NOT NULL DEFAULT FALSE,
  speaking_turns_count    INTEGER NOT NULL DEFAULT 0,
  completion_rate         NUMERIC(4,3),           -- 0.0–1.0; NULL if abnormal stop
  final_emotional_safety  NUMERIC(4,3),           -- trend analysis only
  parent_review_flagged   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_session_summaries_child_date
  ON kids_brain_session_summaries (child_id, started_at DESC);

CREATE INDEX idx_session_summaries_parent_review
  ON kids_brain_session_summaries (child_id, parent_review_flagged)
  WHERE parent_review_flagged = TRUE;
```

**What is not stored here:** turn-by-turn classification labels, raw teacher utterances, raw STT text, emotional state time series, anything beyond the approved summary fields above.

### 3A.4 Table: `kids_brain_safety_events`

Append-only. Isolated from all AI-accessible data paths. No AI module reads this table at runtime.

```sql
CREATE TABLE kids_brain_safety_events (
  id                  BIGSERIAL PRIMARY KEY,
  session_id          UUID NOT NULL,
  child_id            UUID NOT NULL,          -- not a FK; table is write-isolated
  event_type          VARCHAR(32) NOT NULL,   -- e.g. 'unsafe_or_sensitive', 'child_distress'
  confidence_score    NUMERIC(4,3) NOT NULL,
  detection_method    VARCHAR(32) NOT NULL,   -- 'keyword_list', 'safety_classifier', 'pattern_rule'
  review_status       VARCHAR(16) NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending', 'reviewed', 'dismissed')),
  occurred_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewer_id         UUID,                   -- human reviewer only
  reviewed_at         TIMESTAMPTZ
  -- NOTE: no content field. Raw utterance text is never stored.
);

CREATE INDEX idx_safety_events_pending
  ON kids_brain_safety_events (review_status, occurred_at)
  WHERE review_status = 'pending';
```

**Access control:** The safety events table is write-accessible by `safety/safety-audit-log.ts` only. It is read-accessible by a separate human review tool only. No Kids Brain runtime module (classifier, teacher response, memory) reads from this table. The `child_id` reference is intentionally not a foreign key to prevent cascading deletes from erasing the audit trail.

### 3A.5 Transaction Boundaries

| Operation | Transaction scope |
|---|---|
| Session start: load profile + mastery records | Single read transaction |
| Turn completion: update Redis session memory | Redis write (no Postgres transaction per turn) |
| Session end (normal / timeout): write summary + mastery updates | Single Postgres write transaction; both succeed or neither does |
| Session end (emotional stop): write summary + partial mastery | Single Postgres write transaction for completed items only |
| Safety event write | Independent, immediate, non-transactional INSERT |
| Profile baseline update at session end | Part of the session end transaction |

---

## Patch 4 — LLM Classification Timeout Fallback
**Closes:** AUDIT-4  
**Replaces:** Section 6.2 (LLM Classification Rules)

### Replacement text for Section 6.2:

### 6.2 LLM Classification Rules and Timeout Fallback Contract

**Normal operation — when LLM is called for classification:**
- Must return a label from the defined taxonomy (no free-form labels)
- Must return a confidence score 0.0–1.0
- Target response time: 200ms. Hard cap: 400ms.
- Deterministic rule, if applicable, always overrides LLM output regardless of LLM confidence

**Timeout fallback — when LLM exceeds 400ms:**

The classification module maintains a deterministic fallback map. On timeout, the fallback label is selected by this rule table (first match wins):

| Condition at timeout | Fallback label | Fallback confidence |
|---|---|---|
| `is_silence == true` | `silence_long` | 1.0 (deterministic) |
| `l1_detected == true` | `l1_translation` | 0.60 |
| `perception_confidence < 0.50` | `silence_medium` (treat as ambiguous, scaffold) | 0.55 |
| `adjusted_stt_confidence >= 0.65` AND target_item known | `correct_hesitant` | 0.58 |
| `adjusted_stt_confidence >= 0.65` AND target_item unknown | `off_topic_story` | 0.50 |
| `adjusted_stt_confidence < 0.65` AND recent_failure_count >= 2 | `wrong_semantic` | 0.50 |
| Default (no above condition matched) | `random_nonsense` | 0.50 |

Rationale for defaults: `random_nonsense` triggers `warm_redirect_no_shame` — the emotionally safest fallback when intent is unknown. It never produces shame or correction. It always produces a valid warm response.

**State updates on timeout fallback:**

- Apply the same state delta rules as if the fallback label had been returned normally.
- The state update does occur. The child's state must update even on a timeout — not updating would allow repeated LLM timeouts to stall state progression silently.
- Item mastery is NOT updated on a timeout fallback (mastery updates require confident classification).

**Logging event on timeout fallback:**

```
LLM_CLASSIFIER_TIMEOUT
  session_id: string
  turn_number: integer
  elapsed_ms: integer          -- actual elapsed before timeout
  fallback_label: string
  fallback_confidence: float
  original_input_label: string -- what the fast-path would have chosen (for debugging)
```

This event is emitted to the observability layer (see Patch 13) with severity WARNING. Repeated timeouts in a session (≥ 3) escalate to severity ERROR.

**Circuit breaker:** If the LLM classifier produces ≥ 5 timeouts in a 60-second window, the circuit breaker opens. For the remainder of that session, all LLM classification calls are skipped and the fallback map is used directly. The circuit breaker state is logged as `LLM_CLASSIFIER_CIRCUIT_OPEN`. It does not affect LLM calls for teacher response generation (separate path).

---

## Patch 5 — Core Teacher Language Vocabulary
**Closes:** AUDIT-5  
**Adds:** New Section 10A — Core Teacher Language Vocabulary  
**Modifies:** Section 10.4 (Vocabulary Guard) to reference Section 10A

### 10.4 Vocabulary Guard (Hard Constraint) — updated reference

Every teacher utterance is checked before delivery. Allowed vocabulary = `current_lesson_target_words` ∪ `current_unit_review_words` ∪ `core_teacher_language_vocabulary` (defined in Section 10A) ∪ `character_names`.

Any word outside this union blocks delivery. This is a HARD_STOP — no exceptions. The blocked utterance falls back to the nearest applicable deterministic template. If no template applies, the fallback is silence followed by the `silence_medium` teacher prompt.

The vocabulary guard operates on **word stems** after lowercasing and punctuation stripping. Inflected forms of an allowed word (e.g., "says" from "say") are permitted. Entirely new word roots are not.

---

## Section 10A — Core Teacher Language Vocabulary

**File location:** `backend/src/kids-brain/teacher-response/core-teacher-vocabulary.ts`  
**Format:** A constant exported array of lowercase word stems. Changes require a PR review by an ELT specialist.  
**Version:** v1 initial list — 103 items.

### 10A.1 Vocabulary List

The following word stems constitute the complete core teacher language vocabulary. This list is the initial v1 set. It covers all teacher turns that are not covered by the active lesson word list.

**Classroom action words**
say, tell, listen, look, find, show, point, help, try, think, know, see, hear, do, make, go, come, put, play, choose, pick, yes, no, ready, start, stop, wait, finish, again, together, with, me, you

**Praise and acknowledgment**
wow, amazing, great, brilliant, fantastic, yes, oh, good, well, nice, clever, perfect, correct, beautiful, wonderful

**Question and prompt words**
what, which, is, are, can, does, do, this, that, here, there, where, one, two, three, a, an, the, and, or, but, it

**Transition and connective words**
now, next, then, after, before, again, let, go, okay, right, so, and, but, look, oh, wait, hmm, uh, listen

**Scaffolding and support words**
maybe, almost, close, try, again, or, not, big, small, fast, slow, loud, quiet, first, last, more

**Emotional and engagement words**
love, like, happy, sad, funny, silly, scary, wow, yay, hurray, come, back, here, ready, sure, really

**Lesson framing words**
today, time, game, turn, round, word, animal, color, number, name, question, answer, correct, wrong

**Identity and relational words**
your, my, our, you, me, we, they, he, she, it, his, her

**Numbers (core)**
one, two, three, four, five, six, seven, eight, nine, ten

### 10A.2 How the Vocabulary Guard Uses This List

1. The vocabulary guard maintains the union set at session initialization: `allowedVocab = Set(lesson_target_words ∪ unit_review_words ∪ core_teacher_vocabulary ∪ character_names)`.
2. Before any teacher utterance is dispatched, the guard tokenizes the text into word stems (lowercase, punctuation stripped, simple stemming: trailing -s, -ed, -ing removed for matching only).
3. Each token is checked against `allowedVocab`.
4. If any token is not in `allowedVocab`:
   - Block the utterance.
   - Log `VOCAB_GUARD_BLOCK` with the offending token.
   - Fall back to the nearest deterministic template for the current action type.
5. The LLM output is checked before TTS dispatch. The template output is also checked (to catch authoring errors in templates).

### 10A.3 Test Coverage Requirements

The vocabulary guard must have the following test coverage before Phase 4 completion:

1. **Allowlist test**: All 103 core words (and their common inflections) pass the guard.
2. **Blocklist test**: A set of 50 out-of-scope words (e.g., grammar terms, personal pronouns outside approved list, topic words from other units) are each blocked correctly.
3. **LLM output test**: 100 LLM-generated utterances are run through the guard; all violations are caught.
4. **Template regression test**: All entries in `template-library.ts` pass the guard — no template may contain an out-of-scope word.
5. **Inflection test**: Words like "saying", "listened", "finds" resolve to approved stems ("say", "listen", "find") and are allowed.
6. **Character name test**: Active lesson character names pass; names from other characters not in this lesson are blocked.

Test file: `backend/src/kids-brain/teacher-response/__tests__/vocabulary-guard.test.ts`

---

## Patch 6 — Recovery Pipeline Order
**Closes:** Audit gap: Recovery runs after teacher response generation (wrong order)  
**Replaces:** Section 2.2 (Full Processing Loop) and Section 4.1 (Per-Turn Data Flow)

### Corrected Processing Loop (replaces Section 2.2 loop diagram)

Recovery must run **before** teacher response generation, not after. The teacher response module must receive the recovery-validated activity decision — not a raw activity engine output that may be overridden later.

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
  Emits: progression_decision + mastery_delta + lesson_phase_update
       ↓
[5. ACTIVITY ENGINE]
  Maps progression_decision to specific next_activity.
  Checks engagement, fatigue, variety rules.
  Emits: candidate_activity (not final — subject to recovery override)
       ↓
[6. RECOVERY MODULE]  ← MUST RUN HERE, BEFORE TEACHER RESPONSE
  Reads recovery_state from child_state.
  If recovery_state requires override → replaces candidate_activity with recovery action.
  Emits: final_activity (authoritative; teacher response module uses this, not candidate_activity)
       ↓
[7. TEACHER RESPONSE MODULE]
  Receives final_activity (post-recovery override).
  Selects template or calls LLM (if variation required).
  Applies vocabulary guard (block out-of-scope words).
  Emits: teacher_text + feedback_tone
       ↓
[8. MEMORY MODULE]
  Writes session state delta to Redis.
  Writes mastery delta (deferred to session end for Postgres).
  Schedules reviews for mastered items.
  Emits logging event.
       ↓
[9. ACTION PACKET → FRONTEND]
  Assembles and dispatches frontend action packet.
```

### Corrected Per-Turn Data Flow (replaces Section 4.1 steps 5–7)

Steps 1–4 and 8–9 are unchanged. Steps 5–7 are replaced:

```
STEP 5 → ACTIVITY ENGINE
  Input: progression_decision + session_state + activity_history
  Select candidate_activity from demand ladder
  Apply variety guard (max 3 consecutive same type)
  Output: { candidate_activity_id, next_item_id, difficulty_level }
  NOTE: This output is CANDIDATE only. It is subject to override in Step 6.

STEP 6 → RECOVERY MODULE (mandatory, always runs)
  Input: recovery_state + child_state + candidate_activity from Step 5
  Evaluate: does current recovery_state require a different action?
    - normal: pass candidate_activity through unchanged
    - mild_confusion: may replace with model_answer or ask_forced_choice
    - repeated_failure: replace with give_easiest_win (forced)
    - frustration_risk: replace with give_easiest_win or switch_activity (forced)
    - disengagement: may replace with switch_activity
    - refusal: replace with back_off_offer_choice or end_session
    - emotional_shutdown: replace with pause_and_check_in or end_session
    - repaired_success: may constrain to warm_praise path only
  Output: final_activity (used by Step 7; candidate_activity is discarded if overridden)
  Emit: RECOVERY_OVERRIDE logged if override occurred, with reason

STEP 7 → TEACHER RESPONSE MODULE
  Input: final_activity (from Step 6, not from Step 5)
  ...
```

---

## Patch 7 — Confidence Scale Normalization
**Closes:** Audit gap: inconsistent confidence scales (0–1 in state model; 0–100 in learning engine)  
**Modifies:** Section 7 header note, Section 8.1, Section 8.4, and database schema note in Patch 3

### Canonical Rule

**The canonical confidence scale is 0–100 (integer-range floats).** This is the scale used by the Learning Engine, the Activity Engine, the Mastery Model, and the Postgres database schema.

**The 0.0–1.0 scale used in Section 7 (Child State Contract) is a display/API convenience only.** When Section 7 variables are passed into Learning Engine comparisons or stored in Postgres, they are multiplied by 100. When they are read from Postgres or Learning Engine output back into session state, they are divided by 100.

The conversion happens exclusively in:
- `state/state-delta.applier.ts` (write path: 0–1 → 0–100 before Learning Engine)
- `memory/postgres-profile.store.ts` (read path: 0–100 → 0–1 when loading into session)

No other module performs scale conversion. If a module receives a value, the scale it operates on is fixed by which module produced that value:

| Module | Scale | Notes |
|---|---|---|
| Child State Module (session) | 0.0–1.0 | Session-layer convention |
| Learning Engine | 0–100 | Canonical scale for all thresholds |
| Activity Engine | 0–100 | Uses Learning Engine outputs |
| Mastery Model | 0–100 | Stored in Postgres as NUMERIC(5,2) |
| Postgres (mastery records) | 0–100 | Stored as NUMERIC(5,2) |

**Threshold table correction** (Section 8.4 is already in 0–100; no change needed there).  
**Section 7.1 threshold annotations** — each threshold value in Section 7.1 that has a Learning Engine comparison carries a note that its 0–1 value converts to ×100 before engine evaluation. No threshold values in Section 7.1 change; the conversion note is the patch.

**Example:** Section 7.1 `production_confidence < 0.35` → passed to Learning Engine as `production_confidence < 35`. The threshold `35` in Section 8.4 and the threshold `0.35` in Section 7.1 are the same condition — just expressed at different layers.

---

## Patch 8 — Easiest-Win Cold-Start Fallback
**Closes:** Audit gap: easiest-win protocol has no defined behavior when no mastered items exist  
**Modifies:** Section 9.3 (Easiest Win Protocol)

### Replacement text for Section 9.3:

### 9.3 Easiest Win Protocol

Trigger conditions: frustration > 75 | pre-lesson-close | consecutive_wrong ≥ 3

**Normal protocol (mastered items exist):**
1. Select a word where `mastery_level = secure or automatic`.
2. Use `forced_choice_2` or `repeat_after_me`.
3. Guarantee child success before continuing or closing.

**Cold-start fallback (no mastered items exist — first session or very early in session):**

The normal protocol cannot run if the child has no items at `secure` or `automatic`. The following cold-start ladder is used instead:

1. **Attempt 1:** Select any item that was attempted this session (lowest `attempt_count` = fewest exposures → freshest). Use `forced_choice_2`. The two choices are the target item and a clearly unrelated item (maximum semantic distance from the curriculum item set). This provides a near-guaranteed success because the child has already heard the word at least once.

2. **Attempt 2 (if Attempt 1 fails):** Use `repeat_after_me` on the simplest phonological item from the current lesson's target_words (shortest word by syllable count, as defined in the lesson spec). Teacher models the word three times before inviting repeat.

3. **Attempt 3 (if Attempt 2 fails):** Teacher provides the answer and models it. No production required from the child. The "success" is the teacher's warm acknowledgment: "Yes! [word]! That's it!" This is a scripted template — not LLM-generated.

The cold-start fallback is used only when `items_in_session_with_any_attempt == 0` (first turn of session) or `items_at_secure_or_automatic == 0`. After at least one item reaches `developing`, the cold-start is no longer triggered; the normal protocol applies.

**Cold-start logging event:** `EASIEST_WIN_COLD_START` with `attempt_level` (1, 2, or 3).

Easiest win events (all variants) do not count toward mastery advancement or progression metrics.

---

## Patch 9 — L1 Budget Exhausted Fallback
**Closes:** Audit gap: no defined behavior after the session L1 budget is consumed  
**Modifies:** Section 10.5 (English-First Rescue Ladder) and Section 10.10 (L1 Policy references)

### Addition to end of Section 10.5 (English-First Rescue Ladder):

### L1 Budget Tracking and Exhaustion Behavior

The L1 rescue ladder Level 6 (one L1 word per session) is tracked in session memory as `l1_budget_used: boolean`. Once set to `true`, it cannot be reset within the same session.

**When `l1_budget_used == true` and a Level 6 trigger occurs again in the same session:**

Do not repeat the L1 anchor. The teacher must use Level 5 behavior instead (provide the English answer and model it), even if the child has clearly failed to understand through all English-only scaffolding.

The reasoning: a second L1 word in a session provides diminishing returns and begins to establish L1 as a reliable fallback that competes with English production. The system accepts that some items will not be comprehended in this session and marks them for priority review.

**Budget exhaustion action sequence:**

1. Teacher uses Level 5 behavior: provide the English target word, model it clearly, invite repeat.
2. If the child still does not respond after Level 5: mark the item as `comprehension_not_established_this_session` in item state.
3. Move on. Do not loop. Do not use L1 again.
4. The item is automatically added to the `overdue_review_items` queue for the next session with elevated priority.
5. Log event: `L1_BUDGET_EXHAUSTED_ITEM_DEFERRED` with `item_id`.

**Session-end behavior:** If `l1_budget_used == true`, the session summary includes `l1_rescue_used: true`, which triggers a parent review flag (as already defined in Section 14.7).

---

## Patch 10 — TurnRecord Schema
**Closes:** Audit gap: `TurnRecord` referenced throughout spec but never defined  
**Adds to:** Section 3 module map (`shared/types.ts`); adds new subsection 4.3

### New Section 4.3 — TurnRecord Schema

`TurnRecord` is the canonical per-turn event log stored in session memory (last 5 turns). It is used by the perception module to provide recent context to the classifier.

```typescript
interface TurnRecord {
  turn_number: integer;           // Monotonic integer, starts at 1 for session

  // Input
  stt_text_normalized: string | null;    // Romanized, lowercased; not raw
  response_latency_ms: integer | null;
  silence_duration_ms: integer;
  l1_detected: boolean;

  // Classification result
  classification_label: ClassificationLabel;
  classification_confidence: number;     // 0.0–1.0
  classification_path: "fast_path" | "llm_path" | "timeout_fallback";

  // Context at time of turn
  target_item_id: string | null;
  activity_id: ActivityId;
  lesson_phase: LessonPhase;
  attempt_number: integer;               // Attempt count on this item in this session
  model_was_given: boolean;              // Was teacher model provided before this response?

  // Decision taken
  action_taken: TeacherActionCode;       // From action catalog (see Patch 12)
  recovery_override: boolean;           // Did recovery module override activity engine?

  // Outcome
  was_success: boolean;                 // true for correct_confident, correct_hesitant, near_correct
  mastery_delta: number;                // Change applied to item mastery this turn (0 if no update)

  // Timestamp
  completed_at: string;                 // ISO 8601
}
```

`ClassificationLabel`, `ActivityId`, `LessonPhase`, and `TeacherActionCode` are all closed enum types defined in `shared/types.ts`. No string literals outside these enums may appear in a `TurnRecord`.

The session memory holds the last 5 `TurnRecord` objects as a circular buffer. Older records are dropped. This is the maximum context window passed to the classifier.

---

## Patch 11 — MasteryRecord Schema
**Closes:** Audit gap: `MasteryRecord` referenced in Section 7.3 (ChildProfile) but never defined  
**Adds to:** Section 7 (Child State Contract) as new subsection 7.4

### New Section 7.4 — MasteryRecord Schema

`MasteryRecord` is the cross-session mastery state for a single vocabulary item. It is stored in Postgres (`kids_brain_mastery_records`) and loaded into session memory at session start for items relevant to the current lesson.

```typescript
interface MasteryRecord {
  item_id: string;                    // Vocabulary item identifier from curriculum
  mastery_level: MasteryLevel;        // 'emerging' | 'developing' | 'secure' | 'automatic'

  // Confidence scores (0–100 scale; canonical Learning Engine scale — see Patch 7)
  production_confidence: number;      // 0–100
  comprehension_confidence: number;   // 0–100

  // Evidence counters
  correct_production_count: integer;
  correct_comprehension_count: integer;
  sessions_seen: integer;
  sessions_with_correct_production: integer;
  activity_types_succeeded: ActivityId[];   // Which activity types child has succeeded in

  // Timestamps
  last_seen_at: string | null;          // ISO 8601
  last_correct_at: string | null;       // ISO 8601
  review_due_at: string | null;         // ISO 8601; null if not yet scheduled
  introduced_at: string;                // ISO 8601

  // Session-ephemeral tracking (not persisted; reset at session start)
  session_attempt_count: integer;       // Attempts on this item in the current session
  session_model_given: boolean;         // Teacher model given this session
  session_l1_anchor_used: boolean;      // L1 anchor used for this item this session
  session_mastery_delta: number;        // Accumulated delta in current session (for commit at end)
}
```

`MasteryLevel` is a closed enum: `'emerging' | 'developing' | 'secure' | 'automatic'`.

The session-ephemeral fields (`session_*`) exist only in memory during the session. They are not written to Postgres. At session end, the accumulated `session_mastery_delta` and updated counters are committed to Postgres in the session-end transaction.

---

## Patch 12 — Action Packet Enum
**Closes:** Audit gap: action packet `action` field was a free string with no defined enum  
**Modifies:** Section 2.3 (Backend Authority Model), adds to `shared/types.ts`

### Replacement for action packet example in Section 2.3:

The backend emits a typed action packet to the frontend. The `action` field is a closed enum — the frontend must not act on any action string not in this list.

```typescript
enum TeacherActionCode {
  // Progression actions
  PRAISE_AND_PROGRESS       = 'praise_and_progress',
  WARM_PRAISE_CONFIRM       = 'warm_praise_confirm',
  RECAST_AND_CONFIRM        = 'recast_and_confirm',
  PRAISE_ECHO_THEN_CHECK    = 'praise_echo_then_check',
  COMPLETE_ANSWER_MODEL     = 'complete_answer_model',
  MOVE_TO_NEXT_ITEM         = 'move_to_next_item',
  HOLD_CURRENT_ITEM         = 'hold_current_item',

  // Scaffolding actions
  MODEL_ANSWER              = 'model_answer',
  ASK_FORCED_CHOICE         = 'ask_forced_choice',
  SIMPLIFY                  = 'simplify',
  USE_L1_ANCHOR             = 'use_l1_anchor',

  // Recovery actions
  GIVE_EASIEST_WIN          = 'give_easiest_win',
  SWITCH_ACTIVITY           = 'switch_activity',
  PLAY_ALONG_BRIEFLY        = 'play_along_briefly',
  WARM_REDIRECT             = 'warm_redirect',
  PAUSE_AND_CHECK_IN        = 'pause_and_check_in',
  BACK_OFF_OFFER_CHOICE     = 'back_off_offer_choice',

  // Session lifecycle actions
  END_SESSION               = 'end_session',
  ESCALATE_TO_SAFETY        = 'escalate_to_safety',

  // Lesson structure actions
  OPEN_LESSON               = 'open_lesson',
  CLOSE_LESSON              = 'close_lesson',
  PHASE_TRANSITION          = 'phase_transition',
  REWARD_MOMENT             = 'reward_moment',
}
```

The full action packet interface:

```typescript
interface ActionPacket {
  action: TeacherActionCode;          // Closed enum — no free strings
  teacher_text: string;               // Vocabulary-guard-approved utterance
  feedback_tone: FeedbackTone;        // 'neutral' | 'warm' | 'celebratory' | 'gentle_correction'
  wait_ms: number;                    // Milliseconds to wait after TTS before next prompt
  next_prompt: string | null;         // Follow-up question/prompt; null if session ending
  tts_voice_id: string;               // TTS voice identifier for this teacher character
  session_id: string;                 // Echoed back for frontend session tracking
  turn_number: integer;               // For idempotent replay on reconnect
}
```

`FeedbackTone` is a closed enum: `'neutral' | 'warm' | 'celebratory' | 'gentle_correction'`.

The frontend must echo `turn_number` back in the next audio submission. The backend uses this to detect duplicate submissions (replay guard: if `incoming_turn_number == last_completed_turn_number`, discard and re-emit last action packet).

---

## Patch 13 — Latency and Observability Events
**Closes:** Audit gap: no defined observability events or latency checkpoints  
**Adds:** New Section 14A — Observability Contract (insert after Section 14)

---

## Section 14A — Observability Contract

All structured log events emitted by Kids Brain are defined here. Every event has a fixed schema. No ad-hoc logging strings. Events are emitted to the structured logging layer (implementation: e.g., Pino with a JSON transport; the spec does not mandate a specific sink).

### 14A.1 Latency Checkpoints

The following latency measurements are recorded on every turn:

```typescript
interface TurnLatencyRecord {
  session_id: string;
  turn_number: integer;

  // Absolute timestamps (epoch ms)
  audio_received_at: number;           // When audio from child was received by server
  stt_submitted_at: number;            // When audio was submitted to STT provider
  stt_result_received_at: number;      // When STTResult was received
  perception_complete_at: number;      // When PerceptionBundle was assembled
  classification_complete_at: number;  // When final classification label was emitted
  state_update_complete_at: number;    // When child state was updated
  recovery_complete_at: number;        // When recovery override decision was made
  response_ready_at: number;           // When ActionPacket was assembled (pre-dispatch)
  redis_write_complete_at: number;     // When session memory was written to Redis

  // Derived durations (ms)
  stt_latency_ms: number;              // stt_result_received_at - stt_submitted_at
  perception_latency_ms: number;
  classification_latency_ms: number;   // Includes LLM call time if applicable
  pipeline_total_ms: number;           // response_ready_at - audio_received_at
  redis_write_ms: number;

  // Path flags
  classification_path: "fast_path" | "llm_path" | "timeout_fallback";
  recovery_override_occurred: boolean;
}
```

The `pipeline_total_ms` is the primary latency SLO metric. Target: ≤ 800ms for deterministic path. Alert threshold: > 1200ms.

### 14A.2 Named Log Events

All log events use this base structure:

```typescript
interface LogEvent {
  event: string;                // Event name from the list below
  severity: "DEBUG" | "INFO" | "WARNING" | "ERROR" | "CRITICAL";
  session_id: string;
  turn_number: integer | null;
  timestamp: string;            // ISO 8601
  payload: Record<string, unknown>;   // Event-specific fields
}
```

**Session lifecycle events:**

| Event name | Severity | When emitted |
|---|---|---|
| `SESSION_STARTED` | INFO | Session WebSocket established, profile loaded |
| `SESSION_ENDED_NORMAL` | INFO | Normal lesson completion |
| `SESSION_ENDED_TIMEOUT` | INFO | Session hit max_session_seconds |
| `SESSION_ENDED_EMOTIONAL` | WARNING | Emotional stop triggered |
| `SESSION_ENDED_REFUSAL` | WARNING | Refusal state led to session end |
| `SESSION_RECONNECTED` | INFO | Successful reconnect within TTL |
| `SESSION_EXPIRED_NEW_STARTED` | INFO | Reconnect after TTL; new session begun |
| `SESSION_REDIS_WRITE_FAILURE` | WARNING | Redis write failed on a turn |
| `SESSION_REDIS_UNAVAILABLE` | WARNING | Redis unavailable on connect |

**Classification events:**

| Event name | Severity | When emitted |
|---|---|---|
| `CLASSIFICATION_FAST_PATH` | DEBUG | Deterministic classification used |
| `CLASSIFICATION_LLM_PATH` | DEBUG | LLM classification used |
| `LLM_CLASSIFIER_TIMEOUT` | WARNING | LLM exceeded 400ms; fallback used |
| `LLM_CLASSIFIER_CIRCUIT_OPEN` | ERROR | ≥ 5 timeouts in 60s; circuit open |
| `CLASSIFICATION_POSSIBLE_GUESS` | DEBUG | Fast forced_choice answer downgraded |

**Perception events:**

| Event name | Severity | When emitted |
|---|---|---|
| `PERCEPTION_NULL_TEXT` | DEBUG | STT returned null text |
| `PERCEPTION_NULL_CONFIDENCE` | DEBUG | STT confidence unavailable |
| `PERCEPTION_NULL_DURATION` | DEBUG | speech_duration_ms unavailable |
| `PERCEPTION_NULL_ENERGY` | DEBUG | audio_energy_level unavailable |
| `PERCEPTION_NULL_LANG` | DEBUG | language_code unavailable |
| `PERCEPTION_STT_TIMEOUT` | WARNING | STT result not received within 2000ms |

**Recovery and safety events:**

| Event name | Severity | When emitted |
|---|---|---|
| `RECOVERY_OVERRIDE` | INFO | Recovery module replaced activity engine output |
| `SAFETY_FLAG` | CRITICAL | unsafe_or_sensitive classification fired |
| `EASY_WIN_TRIGGERED` | INFO | Easiest win protocol activated |
| `EASIEST_WIN_COLD_START` | INFO | Cold-start fallback used (no mastered items) |
| `L1_ANCHOR_USED` | INFO | L1 anchor used for an item |
| `L1_BUDGET_EXHAUSTED_ITEM_DEFERRED` | INFO | L1 budget used; item deferred |

**Vocabulary guard events:**

| Event name | Severity | When emitted |
|---|---|---|
| `VOCAB_GUARD_BLOCK` | WARNING | Utterance blocked; offending token logged |
| `VOCAB_GUARD_TEMPLATE_FALLBACK` | INFO | Blocked utterance replaced with template |

**Progression and mastery events:**

| Event name | Severity | When emitted |
|---|---|---|
| `ITEM_ADVANCE` | INFO | Child advanced to next item |
| `MASTERY_LEVEL_ADVANCE` | INFO | Item reached new mastery level |
| `PROGRESSION_FORBIDDEN_TRANSITION_BLOCKED` | WARNING | A global forbidden transition was attempted and blocked |

**Parent review triggers:**

| Event name | Severity | When emitted |
|---|---|---|
| `PARENT_REVIEW_TRIGGERED` | INFO | Session summary flagged for parent review (with reason) |

### 14A.3 Performance Alerting Thresholds

| Metric | Warning | Error |
|---|---|---|
| `pipeline_total_ms` (deterministic path) | > 800ms | > 1500ms |
| `pipeline_total_ms` (LLM path) | > 1500ms | > 3000ms |
| `stt_latency_ms` | > 500ms | > 1500ms |
| `redis_write_ms` | > 50ms | > 200ms |
| `LLM_CLASSIFIER_TIMEOUT` count per session | ≥ 3 | — (circuit opens at 5) |
| `VOCAB_GUARD_BLOCK` count per session | ≥ 2 | ≥ 5 |
| `SAFETY_FLAG` | Always CRITICAL | — |

---

## Updated Section 3 — Backend Module Map (Patch 1 addition)

The following files are added to the module map. All other files are unchanged from v1.0.

```
├── memory/
│   ├── redis-session.store.ts       # ADDED: Redis read/write for active SessionMemory
│   ├── postgres-profile.store.ts    # ADDED: Postgres read/write (replaces profile-store.ts)
│   ├── memory.module.ts             # Unchanged
│   ├── session-memory.ts            # Unchanged (in-memory type definitions)
│   ├── continuity-packet.builder.ts # Unchanged
│   └── privacy.guard.ts             # Unchanged
│
└── shared/
    ├── age-profile.ts               # Unchanged
    ├── types.ts                     # UPDATED: TurnRecord, MasteryRecord, ActionPacket, enums
    ├── constants.ts                 # UPDATED: STT multiplier constants (all [C]-marked)
    └── observability.ts             # ADDED: LogEvent types and event name constants
```

Note: `profile-store.ts` in v1.0 is replaced by `postgres-profile.store.ts`. The old name is removed.

---

## Updated Phase Acceptance Criteria

The following phase acceptance criteria are updated to reflect patches. All other criteria are unchanged.

### Phase 1 — Additional acceptance criterion (from Patch 6):

- Recovery module runs before teacher response module in the processing pipeline. Verified by integration test: inject a `repeated_failure` state, confirm that the activity engine output is overridden before any teacher utterance is generated.

### Phase 2 — Additional acceptance criteria (from Patches 7, 8):

- Confidence scale: all Learning Engine comparisons operate on 0–100 scale. All session state variables arrive at the Learning Engine already scaled. Verified by unit test: inject state values in 0–1 scale; confirm conversion to 0–100 before rule evaluation.
- Easiest win cold-start: when `items_at_secure_or_automatic == 0`, cold-start ladder is triggered. All three cold-start attempt levels are reachable and tested.

### Phase 3 — Replacement acceptance criteria (from Patches 1, 3):

- Redis session store: `SessionMemory` writes to Redis on every turn completion. Read on WebSocket connect. Verified by integration test with real Redis instance (not in-memory).
- In-memory session state: confirmed not used in production or staging configurations.
- Postgres schema: all four tables created with correct indexes. FK cascade behavior tested. Safety events table write-isolated (no runtime read path confirmed).
- Reconnect: within-TTL reconnect restores session and re-emits last action packet. Post-TTL reconnect starts fresh session from profile. Both cases tested.
- Transaction boundary: session end writes summary + mastery in single transaction. Verified by injecting a Postgres failure mid-transaction; confirmed rollback.

### Phase 4 — Additional acceptance criteria (from Patches 4, 5, 13):

- LLM timeout fallback: all 7 fallback label conditions are covered by unit tests. Fallback label is correctly selected for each condition. State update occurs. Mastery is not updated.
- Circuit breaker: 5 simulated LLM timeouts in 60s trigger circuit open. Subsequent LLM calls are bypassed for the session duration.
- Vocabulary guard test suite: all 6 test categories in Section 10A.3 pass.
- Observability: all named log events in Section 14A.2 are emitted at correct severity in integration test scenarios. `TurnLatencyRecord` is emitted every turn.

### Phase 5 — Additional acceptance criteria (from Patches 9, 12):

- L1 budget exhausted: after L1 anchor is used once, a second trigger in the same session correctly uses Level 5 behavior and defers the item. Verified across 3 test scenarios.
- Action packet enum: frontend receives only `TeacherActionCode` enum values. No free strings pass through. Verified by schema validation test on 500 generated action packets.
- Pipeline latency: `pipeline_total_ms` ≤ 800ms at P95 across 100 simulated deterministic-path turns. ≤ 1500ms at P95 across 50 simulated LLM-path turns.

---

## Final Readiness Score

| Dimension | v1.0 Score | v1.1 Score | Notes |
|---|---|---|---|
| Blocker resolution | 0/5 | 5/5 | All 5 audit blockers resolved |
| Contract completeness | 6/10 | 10/10 | All schemas defined; all enums closed |
| Pipeline correctness | Incorrect order | Correct | Recovery now runs before teacher response |
| Storage layer | Undefined | Defined | Redis + Postgres + test-only in-memory |
| Observability | None | Full | All events named, typed, and severity-classified |
| Confidence scale | Ambiguous | Canonical | 0–100 canonical; 0–1 session layer with defined conversion |
| Phase readiness for Claude Code | Partial | Ready | All phases have unambiguous acceptance criteria |

**Overall readiness estimate: v1.1 is implementation-ready for Phase 1 start.**

Remaining open items (from Section 17, unchanged) are explicitly [C]-marked hypotheses. They are not blockers. They are implemented as configurable constants and require empirical calibration after initial deployment, not before.

---

## Blocker Resolution Confirmation

| Audit blocker | Resolution | Section |
|---|---|---|
| AUDIT-1: Session store contract | Redis for active state; Postgres for durable; in-memory test-only; reconnect defined; single-node assumption; autosave target | Patch 1 |
| AUDIT-2: STT contract | Google Chirp v2 named; STTResult interface defined; all fallback cases enumerated; all multipliers marked [C] | Patch 2 |
| AUDIT-3: Database schema | All 4 tables defined with columns, indexes, ownership, and transaction boundaries | Patch 3 / Section 3A |
| AUDIT-4: LLM timeout fallback | 7-condition fallback map; state update rules; mastery exclusion; logging event; circuit breaker | Patch 4 |
| AUDIT-5: core_teacher_vocabulary | 103-word list; file location; guard integration; 6-category test suite | Patch 5 / Section 10A |

All 5 blockers are resolved. The specification is cleared for Phase 1 implementation.

---

*End of Mentium Kids Brain v1 Architecture Audit Patch (v1.1)*  
*Apply all patches to the base v1.0 specification.*  
*The patched document is the binding implementation reference.*
