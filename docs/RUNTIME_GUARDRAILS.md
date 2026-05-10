# RUNTIME_GUARDRAILS.md

# PURPOSE

This document defines the runtime safety rules that every Claude session
must follow when working on the paid lesson system.

These are NOT optional guidelines.
These are non-negotiable constraints derived from the PAID_LESSON_RUNTIME_ROADMAP.md.

Any implementation that violates these guardrails is considered unsafe.

--------------------------------------------------
SECTION 1 — ARCHITECTURE GUARDRAILS
--------------------------------------------------

# GUARDRAIL 1 — Backend Is Always Authoritative

The backend owns:
- lesson state (Redis)
- lesson progression (PostgreSQL)
- billing (paid_lesson_usage + user_lesson_profiles)
- subscription gating (user_lesson_profiles.subscription_status)
- exercise cursor (LessonState.currentExerciseNum)
- session validity (lesson_sessions)

Frontend must NEVER:
- invent lesson state
- decide subscription access
- fake lesson progress
- advance exercises locally
- extend lesson time

# GUARDRAIL 2 — No Concurrent AI Calls

The `processInput()` function in lesson-ws.ts is guarded by `meta.aiProcessing`.

When `aiProcessing === true`:
- new STT transcripts must be dropped
- new text_message inputs must be dropped
- exercise_answer handling is exempt (it calls processInput too, so it follows same guard)

Rationale: Two concurrent `orchestrator.process()` calls on the same lessonId
would race on Redis reads/writes, corrupting lesson state (exchangeCount,
currentExerciseNum, phase flags).

# GUARDRAIL 3 — STT Is Always-On After Lesson Start

Current architecture: DeepgramSTT connection opens on lesson start and stays
open for the entire lesson. It cannot be paused at the protocol level.

Frontend mitigation: PCM capture is stopped when teacher speaks (via `stopRecording()`
called on `ai_text` event) and when `mic_enabled=false` is in effect.

Phase 1 must implement server-side STT disabling during teacher TTS to fully
close this echo risk. Phase 0 does NOT change this behavior.

# GUARDRAIL 4 — isSpeaking Flag Instability

`isSpeaking` on the frontend may get stuck as `true` if `teacher_turn_end`
is lost (e.g., TTS abort due to interrupt).

Current mitigations:
- `scheduleSpeakOff(8000)` fallback timer on `ai_text`
- `onTeacherTurnEnd()` uses precise `getScheduledAudioEndMs()` when available

Phase 1 must implement more reliable mic lifecycle. Phase 0 does NOT change this.

# GUARDRAIL 5 — No Backwards Phase Transitions

`applyAISignal()` in transitions.ts enforces forward-only phase movement.
AI cannot signal a backward transition. Rule-based transitions also only go forward.

Phase 2 replaces the phase model with a new state machine.
Until Phase 2 lands, the current 7-phase model (DIAGNOSTIC → END) remains.

# GUARDRAIL 6 — Billing Finalization on Disconnect

`finalizeUsage()` is called in the WS `close` handler.
It updates `paid_lesson_usage.minutes_used` and `user_lesson_profiles.paid_minutes_used`.
Minutes are capped at `PLAN_LESSON_MINUTES` (50 by default).

Known gap: If the Railway process crashes (SIGKILL), `finalizeUsage()` may not run.
This is acceptable for Phase 0. A shutdown handler can be added in a future phase.

--------------------------------------------------
SECTION 2 — IMPLEMENTATION GUARDRAILS
--------------------------------------------------

# GUARDRAIL 7 — Do Not Touch Demo Runtime

The demo lesson runtime is implemented in:
- backend/src/demo/lesson-engine.ts
- backend/src/api/demo-routes.ts
- frontend/src/features/classroom/hooks/useDemoSession.ts

Demo runtime is NOT the paid runtime. Do NOT modify it during paid runtime phases.

# GUARDRAIL 8 — Do Not Modify Billing Logic

The billing system (LiqPay, subscriptions, usage tracking) is working and deployed.
No phase should modify:
- backend/src/billing/liqpay.ts
- backend/src/billing/billing-routes.ts
- backend/src/billing/subscription-service.ts

Only runtime integration (how lesson-ws.ts calls finalizeUsage) is in scope.

# GUARDRAIL 9 — Do Not Modify Authentication

Auth system is working. Do not touch:
- backend/src/auth/
- backend/src/api/auth-routes.ts
- frontend/src/context/AuthContext.tsx
- frontend/src/lib/auth.ts

# GUARDRAIL 10 — Preserve Existing Redis TTL Pattern

All Redis lesson keys must use LESSON_TTL (4 hours / 14400 seconds).
Never write Redis keys without TTL.
Use MULTI/EXEC pipeline for multi-key atomic writes.

--------------------------------------------------
SECTION 3 — DEPLOYMENT GUARDRAILS
--------------------------------------------------

# GUARDRAIL 11 — No Env Variable Changes Without Railway Update

New env variables require Railway redeploy with the variable added.
Current required variables (check .env.example for full list):
- ANTHROPIC_API_KEY
- OPENAI_API_KEY or ELEVENLABS_API_KEY (TTS)
- DEEPGRAM_API_KEY (STT)
- DATABASE_URL (PostgreSQL)
- REDIS_URL
- JWT_SECRET
- PAID_PLAN_LESSON_MINUTES (default 50)

# GUARDRAIL 12 — Migration Order Is Fixed

Migrations run sequentially by filename.
Never skip a migration number.
Never modify a deployed migration file.
Current highest migration: 010_fix_billing_precision.sql
Next migration must be 011_*.sql.
