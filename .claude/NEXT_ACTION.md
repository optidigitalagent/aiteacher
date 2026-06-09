# NEXT_ACTION.md

> This file always contains EXACTLY ONE next task.
> Goal Executor reads this before picking what to do.
> Update immediately when the task is picked up or completed.

---

## CURRENT NEXT ACTION

**Task:** GOAL COMPLETE — AUDITOR VERIFIED
**Description:** All 28 acceptance criteria verified with evidence. See REVIEW_REPORT.md Run 5.
  V1 COMPLETE: production voice session, no fail conditions, deterministic architecture.
  V3 COMPLETE: [tts:provider_selected] provider=elevenlabs confirmed, ≥2 audio_chunk/turn.
  28/28 COMPLETE. Goal: Build Mentium Kids into a release-ready AI English teacher. DONE.

---

## EXACT TEST PLAN

### Pre-conditions
- Browser: Chrome or Edge (DevTools required)
- Terminal: `railway` CLI authenticated to aiteacher project
- Account: any valid registered user on production

### Step 1 — Open Railway log stream in terminal
```
railway logs --service aiteacher -n 50 --follow 2>&1 | grep -E "kids-v1|tts:provider|stt:lifecycle|stt:config|tts:fallback|kids:voice"
```
Keep this terminal visible — it must be running during the session.

### Step 2 — Open browser DevTools before navigating
1. Open Chrome / Edge
2. Press F12 → go to **Network** tab → filter by **WS**
3. **Do NOT clear logs after this point**

### Step 3 — Run the Kids voice session
1. Navigate to: `https://aiteacher-production-cae8.up.railway.app/kids`
   _(or your production kids URL)_
2. Sign in with a real account
3. Complete **exactly 3 voice turns**:
   - Turn 1: Say a short word or phrase when prompted (e.g. "blue")
   - Turn 2: Say another word when prompted (e.g. "red")
   - Turn 3: Stay silent for 3 seconds (to trigger silence detection)
4. After the 3rd teacher response, stop the session

### Step 4 — Capture Railway logs
After the 3 turns are complete, run:
```
railway logs --service aiteacher -n 100 2>&1 | grep -E "kids-v1|tts:provider|stt:lifecycle|stt:config|tts:fallback|voice_degraded"
```
Save the full output. **Paste it verbatim to goal-executor.**

### Step 5 — Capture browser evidence
In the **Network → WS** tab:
1. Click the WebSocket connection to the lesson endpoint
2. Go to **Messages** subtab
3. Screenshot or copy the message list showing `audio_chunk` messages

In the **Console** tab:
- Screenshot any timing logs if present
- Note: no custom timing code is in the frontend — only WS message arrival times matter

---

## EXACT LOG LINES REQUIRED

### For V1 (STT latency < 2.5s)

**Railway must show ALL of these lines during the session:**
```
[kids-v1] turn_start session=<id> target=<word> exerciseCorrectCount=<n>
[tts:provider_selected] provider=elevenlabs voiceId=<id>
[kids-v1] turn_complete session=<id> target=<word> exerciseCorrectCount=<n>
```

**Timestamp rule:** The Railway timestamp on `[kids-v1] turn_start` and the
timestamp on `[tts:provider_selected] provider=elevenlabs` must differ by ≤ 2 seconds.
Railway log timestamps are UTC seconds — compare the seconds field directly.

**Alternative (higher precision):** In browser DevTools Network WS tab, measure:
- Time of incoming `teacher_turn_end` message (end of previous turn)
- Time of first incoming `audio_chunk` message (start of new teacher response)
- Delta must be < 2500ms

### For V3 (TTS streams correctly)

**Railway must show:**
```
[tts:provider_selected] provider=elevenlabs voiceId=<id>
```
(once per teacher turn — appears in tts.ts:207 before the stream loop starts)

**Railway must NOT show:**
```
[tts:fallback] elevenlabs_failed
[tts:fallback] no_provider_available
[kids:voice_degraded]
```

**Browser DevTools WS must show:**
- ≥ 2 `audio_chunk` messages per teacher turn (proves streaming loop fired multiple
  times, not single buffered chunk)
- `teacher_turn_end` message after the audio_chunk sequence

---

## PASS / FAIL THRESHOLDS

### V1 — STT latency < 2.5s

| Evidence | PASS | FAIL |
|----------|------|------|
| Railway: `turn_start` → `tts:provider_selected` | ≤ 2s apart | > 2s apart |
| Browser: `teacher_turn_end` → first `audio_chunk` (next turn) | < 2500ms | ≥ 2500ms |
| Railway: No STT error lines | `[stt:lifecycle] status:"open"` present | `[stt:diag]` errors OR `[stt:lifecycle] status:"error"` |
| Kids Brain v1 is deterministic | Proof: no LLM call in kids-v1 path | N/A |

**Decision rule:** If Railway timestamps show ≤ 2s gap AND no error lines → V1 PASS.
If Railway timestamps are same second → V1 PASS (unambiguously < 1s processing).

### V3 — TTS streams correctly

| Evidence | PASS | FAIL |
|----------|------|------|
| Railway: `[tts:provider_selected] provider=elevenlabs` | Present ≥ 1× | Absent or `provider=openai` only |
| Railway: `[tts:fallback]` | Absent | Present |
| Browser WS: `audio_chunk` count per turn | ≥ 2 per turn | 0 or 1 per turn |
| Browser WS: `teacher_turn_end` after chunks | Present | Absent |

**Decision rule:** If `[tts:provider_selected] provider=elevenlabs` present AND
≥ 2 `audio_chunk` WS messages per turn AND no fallback errors → V3 PASS.

---

## STARTUP LOG CHECK (collect once at session start)

The following lines appear at server boot and confirm baseline config.
These are already in Railway from the current deployment but confirm the right
code is running:

```
[tts:provider_check] {"selectedProvider":"elevenlabs",...}
{"event":"[stt:config]","provider":"deepgram","utterance_end_ms":1000,"vad_events":true,...}
```

If `[tts:provider_check]` shows `selectedProvider: "openai"` → V3 evidence will
show OpenAI (buffered MP3) not ElevenLabs — require ElevenLabs key check before proceeding.

---

## INSTRUCTIONS FOR GOAL EXECUTOR

After collecting logs:
1. Check all PASS thresholds above for V1 and V3
2. If both pass → update GOAL_PROGRESS.md: V1 COMPLETE, V3 COMPLETE
3. If both complete → run acceptance-auditor → GOAL COMPLETE
4. If V1 fails due to >2s gap → investigate [stt:lifecycle] for open_timeout or errors
5. If V3 fails → check [tts:provider_check] selectedProvider, ElevenLabs key present

---

## FOLLOW-ON after this task
- goal-executor evaluates logs against V1/V3 thresholds
- If both pass → run acceptance-auditor for final Run 5 verdict
- Expected: GOAL COMPLETE (28/28 criteria including BA3 which is already COMPLETE)

---

## TEMPLATE FOR NEXT TASK ENTRY

```
## CURRENT NEXT ACTION

**Task:** <short name>
**Type:** CODE | TEST | REVIEW | DEPLOY | RESEARCH | PLAN | USER ACTION
**Agent:** goal-executor | planner | implementer | backend-reviewer |
           frontend-reviewer | curriculum-reviewer | qa-tester |
           production-log-analyzer | deploy-railway
**Description:**
  <what exactly to do — concrete, not vague>

**Inputs:**
  - <files to read>

**Success criterion:**
  <how to verify the task is done — testable, not vague>

**Blocker:**
  <what could block this, or "None expected">
```
