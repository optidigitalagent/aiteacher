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

### P1: TTS Provider Billing / Key Configuration (Railway env action required)

Current diagnosis (from production logs):

```
[tts:fallback] ElevenLabs disabled reason=TTS_UNKNOWN_ERROR — falling through to OpenAI
[tts:fallback] OpenAI TTS TTS_PROVIDER_QUOTA — disabling for process lifetime
[kids:voice_degraded] reason=TTS_PROVIDER_QUOTA
```

Root causes identified and code fixed (commit d3d5128):

1. ElevenLabs: Returns HTTP error (401 invalid key or 422 invalid voice ID).
   Code was misclassifying this as TTS_UNKNOWN_ERROR — now correctly identifies.

2. OpenAI TTS: Returns 429 insufficient_quota — account has no credits.

3. tts.ts was ignoring OPENAI_TTS_MODEL / OPENAI_TTS_VOICE env vars (hardcoded 'tts-1').

4. Process-lifetime disable (never recovered). Now replaced with TTL-based cooldown
   (15 min for quota, 6 hours for auth errors).

Code is fixed. Real TTS resumes as soon as provider credentials/billing are valid.

### Required Railway Environment Variable Actions

After deploying, Railway logs will show:
```
[tts:provider_check] {"selectedProvider":"auto","elevenlabs":{...},"openai":{...}}
```

To restore voice audio, at least ONE of these must be done:

Option A — Fix OpenAI (recommended, fast):
  1. Go to platform.openai.com → Billing → Add credits to the project
  2. OR set OPENAI_TTS_MODEL=gpt-4o-mini-tts in Railway (cheaper model, same quality)
  3. Verify OPENAI_API_KEY in Railway matches the project with credits

Option B — Fix ElevenLabs:
  1. Verify ELEVENLABS_API_KEY in Railway is valid and not expired
  2. Verify ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM exists in the ElevenLabs account
     (default voice Rachel — substitute a voice ID from your account if needed)

Option C — Quick bypass (bypasses ElevenLabs while fixing it):
  Set TTS_PROVIDER=openai in Railway env vars (skips ElevenLabs entirely)

### Production Logs to Verify Voice is Working

After deploy, successful voice output looks like:
```
[tts:provider_check] {"selectedProvider":"auto","elevenlabs":{"keyPresent":true,...},...}
[tts:provider_selected] provider=elevenlabs voiceId=21m00Tcm4TlvDq8ikWAM
```
OR:
```
[tts:provider_selected] provider=openai model=tts-1 voice=nova
```
(no [tts:provider_error] or [kids:voice_degraded] after this)

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
