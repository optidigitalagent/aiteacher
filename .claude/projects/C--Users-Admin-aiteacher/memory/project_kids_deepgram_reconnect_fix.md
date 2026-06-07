---
name: project-kids-deepgram-reconnect-fix
description: Root causes and fix for Kids STT Deepgram immediate close after reconnect — conn not nulled, no pre-warming, no Open timeout
metadata:
  type: project
---

Kids STT `no_transcript reason=late_empty` with `chunks=9` was caused by 3 bugs in DeepgramSTT:

1. Close/Error handlers did NOT null `this.conn` → send() queued audio on dead socket indefinitely
2. No pre-warming → new conn created at mic_start cold (200–500ms handshake) inside 800ms stabilization window
3. No Open timeout → if Open never fired, queue grew to MAX_QUEUE=120 with no recovery

**Fix applied 2026-06-05**: stt.ts v2 + lesson-ws.ts createSTT pre-warm callback.

**Why:** `vad_events: true` also added to DEEPGRAM_KIDS_LIVE_OPTIONS per Deepgram API requirement for UtteranceEnd.

**How to apply:** If Kids STT regression appears with `finalChars=0 source=none chunks>0`, check Railway logs for `[stt:lifecycle] status:open` on new connection. If missing, the connection isn't establishing. Also check `[voice:kids] stt_prewarm` logs to confirm pre-warming is firing between turns.

Commit: `fix(kids-stt): fix Deepgram immediate close after reconnect` (4d3109a)
