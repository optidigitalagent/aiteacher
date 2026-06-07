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

> Append new decisions below as autonomous work progresses.
