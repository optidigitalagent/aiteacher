# DECISIONS.md — Architectural Decision Log

> Record every non-obvious architectural or implementation decision made
> during autonomous goal execution. Never delete entries — append only.
> Format: date, decision, reason, alternatives rejected.

---

## Template

```
### [DATE] — <short title>

**Decision:** <what was decided>
**Reason:** <why — constraint, tradeoff, evidence>
**Alternatives rejected:** <what was considered and why not chosen>
**Reversible:** yes / no / with-migration
**Risk:** low / medium / high
```

---

## Active Decisions

### 2026-06-07 — Kids STT utterance_end_ms raised to 1000ms

**Decision:** UTTERANCE_END_MS_KIDS changed from 700 → 1000ms
**Reason:** Deepgram API minimum is 1000ms. 700ms caused HTTP 400 on Kids
  WebSocket upgrade. Adult config (1500ms) was already valid.
**Alternatives rejected:** Removing utterance_end_ms entirely — would lose
  UtteranceEnd events which are required for silence detection.
**Reversible:** Yes (change constant back)
**Risk:** Low

---

### 2026-06-07 — Kids Audio Buffering During waitUntilReady

**Decision:** Buffer up to 200 audio chunks during STT connection wait,
  flush after Open, discard on timeout.
**Reason:** mic_start awaits WebSocket open (~200–500ms). Browser sends
  audio immediately. Without buffering, first chunks are lost → no_transcript.
**Alternatives rejected:** Delaying mic_start on frontend — requires
  frontend change and adds latency. Increasing wait timeout — doesn't
  solve the lost-chunk problem.
**Reversible:** Yes
**Risk:** Low

---

### 2026-06-07 — Kids Brain STT Pre-warm on Connection Death

**Decision:** When Deepgram closes unexpectedly between turns, immediately
  create a fresh connection (pre-warm), not wait for next mic_start.
**Reason:** mic_start has no time budget for a fresh WebSocket handshake.
  Pre-warming during teacher TTS (5–20s window) gives connection time to open.
**Alternatives rejected:** Reconnect on mic_start — handshake latency
  causes lost audio. Persistent connection — Deepgram closes idle connections.
**Reversible:** Yes
**Risk:** Low

---

### 2026-06-07 — Exercise Context WS Message Fields

**Decision:** Added requiresVisualUI, visualAssetUrl, exerciseType to
  OutboundKidsExerciseContext. Frontend shows visual panel when URL present.
**Reason:** Frontend needs to know exercise type to render correct UI
  without parsing teacher text. URL can be null → graceful fallback.
**Alternatives rejected:** Frontend inferring type from teacher text —
  fragile, breaks on prompt edits.
**Reversible:** Yes (fields are additive)
**Risk:** Low

---

### 2026-06-07 — Fix test fixture instead of simplifying SessionMemory

**Decision:** Updated phase-1-exercise-escalation test fixture to use correct
  SessionMemory fields rather than simplifying the SessionMemory type.
**Reason:** SessionMemory is a production contract used by Redis storage and
  multiple agents. Loosening required fields to fix a test would create false
  confidence that partial memory objects are safe.
**Alternatives rejected:** Making SessionMemory fields optional — would weaken
  type safety across all callers. Using `as unknown as SessionMemory` cast —
  would hide real type errors.
**Reversible:** Yes (test-only change)
**Risk:** Low

---

### 2026-06-07 — Map non-existent ClassificationLabel values to nearest semantic equivalents

**Decision:** In test, replaced WRONG_WORD→WRONG_SEMANTIC, L1_DETECTED→L1_TRANSLATION,
  NOISE_ONLY→RANDOM_NONSENSE. These are the closest semantic equivalents.
**Reason:** The test is verifying that MOVE_ON fires for "any non-correct label".
  The exact label doesn't matter for this test — what matters is that it's non-correct.
  Any wrong/L1/noise label serves the same purpose.
**Alternatives rejected:** Adding the removed labels back to the enum — would create
  duplicates and confusion in the classification system.
**Reversible:** Yes (test-only change)
**Risk:** Low

---

> Append new decisions below as autonomous work progresses.

### 2026-06-10 — Micro-dialogue cooldown: count-up from 0 (design doc was internally inconsistent)

**Decision:** `createInitialPersonalizationState().microDialogueCooldown` changed 3 → 0.
  Semantics: counts exercises completed since the last micro-dialogue (count-up);
  engine eligibility requires `>= MICRO_DIALOGUE_COOLDOWN_EXERCISES (3)`;
  lesson-ws increments on each exercise advance and resets to 0 on fire.
**Reason:** docs/kids-personalization-v2.md was internally inconsistent: it specified
  initial value 3 with the comment "so first dialogue can fire after 3 exercises",
  but also M1 ("fires after ≥3 exercises", unit test "cooldown < 3 → no dialogue"),
  "cooldown++ after each exercise advance", and "on fire: cooldown = 0" — which is
  count-up arithmetic. Initial value 3 under count-up would make the first dialogue
  eligible after exercise 1, violating M1. GLOBAL_GOAL acceptance criterion M1 is
  authoritative → initial 0.
**Alternatives rejected:** keep initial 3 (violates M1 for the first dialogue);
  countdown semantics (contradicts M1's unit-test wording and the design's
  "cooldown++" / "reset to 0" rules).
**Reversible:** Yes (single constant in createInitialPersonalizationState)
**Risk:** Low — flag default-off; only affects when the FIRST dialogue may fire.

### 2026-06-10 — Phase 5 logic extracted to helpers to respect wiring-test regex window

**Decision:** Micro-dialogue interception/fire logic lives in helpers
  (handleKidsMicroDialogueReply, maybeFireKidsMicroDialogue,
  buildKidsTurnPersonalization) outside processKidsBrainV1Turn.
**Reason:** session-analytics.test.ts and phase-16b-runtime-safety.test.ts extract
  processKidsBrainV1Turn with regex window [\s\S]{1,12000} — inlining Phase 5 code
  pushed the function to 12,255 chars and broke both guard tests. Extracting helpers
  (now 11,520 chars) fixes the tests without weakening them, and matches the
  30-line-function rule in .claude/rules/backend.md.
**Alternatives rejected:** widening the regex in the guard tests (weakens
  pre-existing safety tests to accommodate new code).
**Reversible:** Yes
**Risk:** Low — future growth of processKidsBrainV1Turn will re-break the window
  (logged as RISK-016).

### 2026-06-12 — substituteChildName: function replacer (safety fix)

**Decision:** `substituteChildName` uses a function replacer
`template.replace(/\[childName\]/g, () => name)` instead of a string
replacement.
**Why:** JavaScript `String.replace` interprets `$`-sequences (`$&`, `$'`,
`` $` ``, `$$`) in STRING replacements. The kids-safety-monitor demonstrated by
execution that profile names containing `$` produced garbled spoken greetings
(template fragments duplicated, placeholder leaking into TTS). A function
replacer returns the name verbatim — the profile name is never interpreted.
**Pinned by:** 2 regression tests in personalization-engine.test.ts (T3 block):
$-sequence names render literally; a name that is literally "[childName]" is
spoken verbatim exactly once (no re-expansion).
**Reversible:** Yes (but do not — this is a safety contract).
**Risk:** None known; blast radius of the original bug was bounded to fragments
of the approved template (API caps names at 1–100 chars).

### 2026-06-12 — Persona greeting/closing exempt from the 15-word truncator

**Decision:** buildPersonaGreeting/buildPersonaClosing do NOT pass through
truncateAtWordBudget. Their bound is: template text pinned ≤20 words by test
+ childName capped at 100 chars (MAX_CHILD_NAME_CHARS).
**Why:** Design Section 4.1 scopes the 15-word budget to INTEREST sentences;
the greeting constraint is "template-based only". Truncating the greeting
could cut the readiness cue ("are you ready?") that the curriculum handshake
relies on.
**Recorded at:** Phase 7 review (QA W-027 asked for an explicit decision).
**Reversible:** Yes.
**Risk:** A many-word 100-char name yields a ~29-word greeting worst-case —
bounded and TTS-safe.

### 2026-06-12 — buildWarmupReturnPhrase intentionally has no flag gate

**Decision:** buildWarmupReturnPhrase stays ungated by feature flags.
**Why:** It is a close-out path: a warmup already in progress must always be
closeable, even if flags are flipped off mid-session (same rationale as
isMicroDialogueInProgress not being flag-gated, Phase 5). A null here would
strand the child in warmup state.
**Recorded at:** Phase 7 review (QA W-027 flagged the asymmetry).
**Reversible:** Yes (but do not without handling the mid-session flag flip).
**Risk:** None — it only fires when lesson-ws is already draining a warmup.
