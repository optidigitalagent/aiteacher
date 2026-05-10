# PHASE 0 COMPLETE
# Runtime Audit & System Foundation

---

## 1. Summary

Phase 0 completed on 2026-05-10.

All existing paid lesson runtime was audited: websocket lifecycle, STT/TTS
lifecycle, lesson state storage, billing/runtime relationship, reconnect/resume
flow, and frontend/backend ownership boundaries.

Five empty documentation files were filled with authoritative content derived
from the actual codebase. The WEBSOCKET_EVENT_CONTRACT.md was completed
(it was only partially written before).

Two minimal code changes were made to fix critical foundation issues:
1. A concurrent AI call guard (`aiProcessing` flag) was added to prevent
   Redis lesson state corruption when two transcripts arrive simultaneously.
2. A `lesson_ready` event was added so the backend explicitly signals
   readiness after auth, matching the WS contract documentation.

Both TypeScript checks (backend and frontend) pass with zero errors.
No runtime behavior changed for the user in this phase.
No lesson flow, billing, demo, or AI prompt was touched.

---

## 2. Goals Completed

Completed:
- Runtime architecture documented (all 5 previously empty docs filled)
- WebSocket event contract completed
- STT/TTS lifecycle documented and gaps identified
- Billing/runtime relationship documented
- Resume/reconnect flow documented
- Backend/frontend ownership boundaries clarified
- Dangerous runtime zones identified (concurrent AI calls, STT always-on)
- `aiProcessing` guard added — concurrent AI call race condition eliminated
- `lesson_ready` event added — contract/code mismatch fixed
- TypeScript checks pass on both backend and frontend

NOT completed (by design — Phase 0 is audit-only):
- STT echo risk during TTS (Phase 1 will fix)
- `isSpeaking` stuck-true recovery (Phase 1 will fix)
- Cost counters persistence to DB (future phase)
- Process crash billing finalization handler (future phase)

---

## 3. Changed Files

Backend:
- `backend/src/ws/message-types.ts` — added `OutboundLessonReady` interface and union member
- `backend/src/ws/lesson-ws.ts` — added `aiProcessing` to ClientMeta, guard in processInput(), `lesson_ready` emit on connect

Frontend:
- `frontend/src/features/classroom/services/classroomSocket.ts` — added `lesson_ready` to BackendMessage union
- `frontend/src/features/classroom/components/ClassroomLayout.tsx` — `lesson_ready` handler sets paidLessonReady; WS onopen no longer sets it

Database:
- No database changes.

Docs (new/updated):
- `docs/RUNTIME_GUARDRAILS.md` — filled from empty
- `docs/AI_TEACHER_RUNTIME_RULES.md` — filled from empty
- `docs/LESSON_RUNTIME_STATE_MAP.md` — filled from empty
- `docs/RUNTIME_TEST_MATRIX.md` — filled from empty
- `docs/WEBSOCKET_EVENT_CONTRACT.md` — completed (was partial)
- `docs/PHASE_HANDOFF_TEMPLATE.md` — filled from empty
- `docs/phase/PHASE_0_PROMPT.md` — filled from empty
- `docs/phase/PHASE_0_HANDOFF.md` — this document

---

## 4. Backend Changes

### aiProcessing Guard (lesson-ws.ts)
Added `aiProcessing: boolean` to `ClientMeta` (initialized `false`).

In `processInput()`:
- If `meta.aiProcessing === true` when a new input arrives, the input is
  **silently dropped** with log: `[paid-lesson] ai_turn_skipped reason=concurrent_call`
- Flag is set `true` before `orchestrator.process()` and reset `false` in a
  `finally` block (via `| undefined` + guard) so it always clears even on error

This prevents:
- Two STT transcripts firing UtteranceEnd close together → two parallel Claude calls
- Student text_message + STT transcript arriving simultaneously
- Any scenario where Redis lesson state is read/written concurrently for same lesson

### lesson_ready Event (lesson-ws.ts + message-types.ts)
After WS authentication completes, backend now emits:
```json
{ "type": "lesson_ready", "sessionId": "<session-id or null>" }
```

This event means: "Connection is authenticated and the session is recognized.
It is safe for the frontend to show Begin Lesson."

Previously: frontend relied solely on WS `onopen` callback.
Risk: `onopen` fires before any auth validation on backend. A subscription-expired
user could see "Begin Lesson" and click it, only to get an error.

Now: frontend waits for `lesson_ready` which is emitted after JWT verification.
If auth fails, the connection is closed with code 4001 before `lesson_ready` is sent.

### Connection Log Improved
`[ws] client connected` log now includes `session=${wsSessionId}` for traceability.

---

## 5. Frontend Changes

### ClassroomLayout.tsx
- `lesson_ready` message handler added: calls `setPaidLessonReady(true)`
- WS `onopen` callback no longer calls `setPaidLessonReady(true)`

Behavioral difference for the user: None visible in the normal happy path.
The `lesson_ready` event arrives within milliseconds of WS `onopen` (one RTT).
In failure cases (expired subscription, invalid JWT), Begin Lesson panel is now
never shown — the error panel appears instead.

### classroomSocket.ts
- `lesson_ready` added to `BackendMessage` discriminated union
- No behavior change — purely a type definition update

---

## 6. Database Changes

No database changes.

---

## 7. Runtime Behavior Changes

Before:
- Two STT transcripts arriving close together (e.g., echo or rapid speech)
  could trigger two concurrent Claude API calls, both reading/writing the same
  Redis lesson state — corrupting exerciseCount, phase flags, exchange counters.
- Frontend showed "Begin Lesson" the moment WS connected, before backend had
  verified auth. A race existed between UI display and auth error.

After:
- First STT/text input that arrives during an active AI call is dropped cleanly.
  The teacher responds only once per turn.
- "Begin Lesson" panel appears only after backend confirms auth via `lesson_ready`.
  If subscription is expired, error panel appears instead of Begin Lesson.

No other runtime behavior changed.
The classroom looks and feels identical for users with valid subscriptions.

---

## 8. WebSocket/Event Changes

Added:
- `lesson_ready` — `{ type: 'lesson_ready', sessionId: string | null }`
  Sent after JWT authentication. Triggers "Begin Lesson" panel on frontend.

No events removed or modified.

---

## 9. AI/Prompt Changes

No AI or prompt changes.

---

## 10. Cost Impact

No meaningful cost impact.

The `aiProcessing` guard may slightly reduce AI call count in edge cases
(duplicate transcripts) — a minor cost saving with no UX impact.

---

## 11. Tests Performed

Audited (code inspection):
- backend/src/ws/lesson-ws.ts — full read
- backend/src/ws/message-types.ts — full read
- backend/src/lesson/types.ts — full read
- backend/src/lesson/orchestrator.ts — full read
- backend/src/lesson/transitions.ts — full read
- backend/src/ai/claude-handler.ts — full read
- backend/src/ai/prompt-builder.ts — full read
- backend/src/voice/stt.ts — full read
- backend/src/voice/tts.ts — full read
- backend/src/billing/subscription-service.ts — full read
- frontend/src/features/classroom/services/classroomSocket.ts — full read
- frontend/src/features/classroom/hooks/useVoiceSession.ts — full read
- frontend/src/features/classroom/hooks/useLessonSession.ts — full read
- frontend/src/features/classroom/components/ClassroomLayout.tsx — full read
- frontend/src/features/classroom/services/voiceApi.ts — full read

Build checks:
- ✅ backend: `npm run build` (tsc --noEmit) — passed, 0 errors
- ✅ frontend: `tsc --noEmit` — passed, 0 errors
- Both checks run before AND after code changes

Manual product testing: NOT performed (per project workflow — testing after all phases).

---

## 12. Known Remaining Issues

The following were identified in this audit and are NOT fixed in Phase 0:

1. **STT always-on during TTS** (HIGH — Phase 1)
   DeepgramSTT connection stays open while teacher speaks. Only frontend PCM
   capture is stopped. If PCM leaks (echo, bad hardware), STT may transcribe
   teacher audio and trigger unwanted AI turns.

2. **isSpeaking can get stuck true** (MEDIUM — Phase 1)
   If `teacher_turn_end` is lost (TTS abort mid-stream), `isSpeaking` stays true
   indefinitely, blocking the mic. The 8s `scheduleSpeakOff` fallback is the
   only recovery. This is too slow for a natural conversation.

3. **Cost counters not persisted to DB** (LOW — future phase)
   `aiCallCount` and `ttsCharCount` are logged on disconnect but never written
   to any DB table. Lost on process crash. Cannot query historical cost data.

4. **No SIGTERM/uncaughtException handler** (LOW — future phase)
   If Railway kills the process (SIGKILL), `finalizeUsage()` does not run.
   Students may lose usage tracking for the last partial minute. Acceptable for
   now given Railway's graceful shutdown window.

5. **Resume restores only rough state** (HIGH — Phase 6)
   Resume restores phase and exercise number but NOT exact item index, word box
   state, reading paragraph position, or reflection state. Student may have to
   redo items they already completed.

6. **section_card event has no frontend handler** (LOW — Phase 3)
   `section_card` arrives from backend but is ignored in ClassroomLayout
   (case falls through to no-op). The grammar overview card data is computed
   and sent but never displayed as a reference card.

---

## 13. What Was Intentionally NOT Changed

- **Demo lesson runtime** — not touched (useDemoSession.ts, demo-routes.ts, lesson-engine.ts)
- **Billing logic** — not touched (liqpay.ts, billing-routes.ts, subscription-service.ts)
- **Authentication** — not touched (auth/*, auth-routes.ts, AuthContext.tsx)
- **AI prompts** — not touched (prompt-builder.ts, claude-handler.ts)
- **STT provider** — Deepgram config unchanged
- **TTS provider** — ElevenLabs/OpenAI config unchanged
- **Database schema** — no migrations added
- **Redis key structure** — unchanged
- **Exercise engine** — not touched (exercise-store.ts, validator.ts, generator.ts)
- **LiqPay integration** — not touched
- **Subscription pricing** — not touched
- **Frontend UI design** — not touched
- **Classroom layout** — not touched (only lesson_ready handler added)

---

## 14. Risks Introduced

1. **lesson_ready timing dependency**
   Frontend now requires `lesson_ready` from backend before showing Begin Lesson.
   If a network hiccup delays the event, the user sees "Connecting to your teacher…"
   longer than before. Risk: very low (event is sent in same WS open handler,
   arrives within one RTT ≈ 10-100ms).

2. **aiProcessing drops transcripts silently**
   If a student speaks while AI is processing, their input is dropped without
   any user feedback. They may speak again and the second attempt will succeed.
   Risk: low — AI calls typically complete in 1-3 seconds, well within natural
   conversational pause time.

---

## 15. Deployment Notes

No Railway redeploy required — these are code-only changes with no new env
variables and no database migrations.

However, when the next code push deploys to Railway, these changes will take
effect automatically. No manual steps needed.

---

## 16. Recommended Next Phase

Recommended next phase:
**Phase 1 — Voice Runtime & Conversational Stability**

Rationale: The most visible user-facing problem is voice chaos (echo loops,
overlapping speech, stuck mic, fragmented audio). Phase 1 fixes these without
touching lesson content or billing. It is the highest-impact change that makes
the classroom feel usable as a voice product.

Phase 1 should NOT begin until the Phase 0 audit findings are reviewed and
the team agrees on the Phase 1 scope.

---

## 17. Next Claude Session Instructions

Next Claude session should:

1. **Read first** (in order):
   - `docs/PAID_LESSON_RUNTIME_ROADMAP.md` — non-negotiable rules
   - `docs/phase/PHASE_0_HANDOFF.md` (this document) — what was done
   - `docs/RUNTIME_GUARDRAILS.md` — what must be preserved
   - `docs/WEBSOCKET_EVENT_CONTRACT.md` — event contract
   - `docs/RUNTIME_TEST_MATRIX.md` — test scenarios for Phase 1

2. **Inspect before coding**:
   - `backend/src/ws/lesson-ws.ts` — current WS handler (including aiProcessing guard)
   - `backend/src/voice/stt.ts` — STT lifecycle (always-on — needs Phase 1 fix)
   - `backend/src/voice/tts.ts` — TTS lifecycle (abort chain is clean)
   - `frontend/src/features/classroom/hooks/useVoiceSession.ts` — voice state (isSpeaking gap)
   - `frontend/src/features/classroom/services/voiceApi.ts` — PCM capture and audio playback

3. **Preserve these**:
   - `meta.aiProcessing` flag — do NOT remove or bypass it
   - `lesson_ready` event — do NOT remove it; frontend depends on it
   - Demo lesson runtime — do NOT touch it
   - Billing system — do NOT touch it

4. **Phase 1 target zones**:
   - Implement server-side STT disable during TTS (not just frontend PCM stop)
   - Fix `isSpeaking` stuck-true — add reliable recovery on interrupt
   - Verify `teacher_turn_end` is reliable — no mic should open before last word
   - Add `speaking_owner: 'teacher' | 'student' | 'idle'` concept to runtime

5. **Continue from Phase 1 ONLY** — do not implement Phase 2+ features

DO NOT:
- Rewrite the websocket architecture
- Change the AI prompts
- Touch the demo lesson
- Touch billing or subscriptions
- Add new database tables without a proper migration
- Remove the `aiProcessing` guard
- Remove the `lesson_ready` event
