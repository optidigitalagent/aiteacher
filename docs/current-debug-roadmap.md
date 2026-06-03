# Current Debug Roadmap — Mentium Kids / Kids Brain V1

## Current Production Status

Working:

- Railway backend deploy succeeds.
- PostgreSQL migrations apply, including:
  - 018_kids_sessions.sql
  - 019_kids_child_profiles.sql
  - 020_kids_mastery_records.sql
  - 021_kids_session_summaries.sql
  - 022_kids_safety_events.sql
- Kids session creation works.
- kids_sessions row is created.
- WebSocket connects.
- focus_lesson_start is received.
- kids_sessions lookup succeeds.
- Kids routing works:
  - routing_to_kids_brain_v1 appears in logs.
- Kids Brain V1 starts:
  - [kids-v1] session_started appears.
- Deepgram STT works:
  - frontend receives transcript events.
- Student turns are processed.
- AI text responses are emitted.
- teacher_turn_end is emitted.

## Fixed Issues

### Fixed: 4402 Payment Required for Kids

Previous issue:
Valid Kids sessions fell into adult payment guard and closed with:

4402 Payment Required

Current status:
Fixed.

Evidence:
Production logs now show:

[kids-start-diag] routing_to_kids_brain_v1
[kids-v1] session_started

Do NOT re-investigate adult payment guard as the main Kids start blocker unless new logs show:

[payment-guard-hit]

for a valid Kids session.

### Fixed: Deepgram 400 Bad Request

Previous issue:
Deepgram Live STT failed because detect_language was sent to Live API.

Root cause:
detect_language belongs to prerecorded/batch schema, not live streaming.

Fix:
Removed detect_language.
Set language: "en".
Deepgram now returns transcript events.

Do NOT re-investigate detect_language unless STT 400 returns again.

### Fixed: rawWs.on crash

Previous issue:
Kids runtime startup crashed with:

rawWs.on is not a function

Root cause:
Deepgram SDK internal WebSocket object did not expose .on().
Diagnostic hook assumed Node ws API.

Fix:
Guard rawWs.on before attaching diagnostics.
Runtime no longer crashes.

Do NOT treat this as a Kids WebSocket adapter issue unless new logs prove otherwise.

## Current Active Blocker

### P0: TTS Provider Quota Failure

Current error:

[kids] TTS error: 429 You exceeded your current quota

Meaning:
OpenAI TTS is being called, but provider quota/billing is exhausted.

Current behavior:
- Lesson still runs.
- STT works.
- AI text works.
- Voice output is broken.

Required next fix:
Implement safe Kids TTS fallback.

Expected behavior:
- If TTS provider fails with quota/rate/API error:
  - do not crash
  - do not close WebSocket
  - send ai_text normally
  - emit teacher_turn_end
  - optionally emit voice_unavailable
  - continue lesson in text-only degraded mode
  - apply provider cooldown so OpenAI is not retried every turn

## Next Task

Use this task title:

Fix Kids TTS Quota Failure with Safe Fallback

Scope:
- backend TTS service
- Kids runtime TTS call site
- optional frontend handling for voice_unavailable

Do NOT:
- redesign UI
- change Kids curriculum
- change lesson FSM
- call TTS from frontend
- remove cost caps
- retry TTS indefinitely
- bypass backend authority

## Logs That Confirm Healthy Kids Startup

Healthy path:

[kids-start-diag] kids_session_lookup_result {"rowsLength":1,...}
[kids-start-diag] routing_to_kids_brain_v1 {"USE_KIDS_BRAIN_V1":true}
[kids-v1] session_started

Healthy STT path:

[Classroom IN] transcript
[voice:turn] submitted
[kids-v1-log] event=kids_turn_started
[kids-v1-log] event=perception_completed

Known non-blocking warning:

[stt:diag] rawWs.on is not a function — Deepgram SDK internal structure changed; skipping diagnostic hooks

This is acceptable if STT transcripts are still received.

## Logs That Need Attention

Bad:

[payment-guard-hit]

for a valid Kids session.

Bad:

[kids-runtime-start-error]

Bad:

WebSocket close 4402 for valid Kids session.

Bad but now expected until fixed:

[kids] TTS error: 429 You exceeded your current quota

## Deployment Commands

After any fix:

git add .
git commit -m "<clear fix message>"
git push origin main

Railway auto-deploys from GitHub.

After deploy, verify:

railway logs

## Current Priority Order

1. Fix TTS quota fallback.
2. Verify full Kids lesson can continue without voice.
3. Restore real TTS by fixing provider quota/billing or adding configured provider.
4. Fix duplicate Redis connect warning:
   Redis is already connecting/connected
5. Set NODE_ENV=production in Railway.
6. Remove or disable verbose DEBUG_KIDS_START logs after stability.

## Definition of Done for Current MVP

Kids MVP is working when:

- child opens Kids lesson
- session starts
- teacher greeting appears
- teacher voice works OR safe text-only fallback works
- child speaks
- Deepgram transcript is received
- Kids Brain processes answer
- exercise progresses
- lesson completes
- progress/analytics are saved
- no engineer action required during lesson
