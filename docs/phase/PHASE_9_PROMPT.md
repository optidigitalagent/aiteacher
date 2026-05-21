# PHASE 9 — PAID RUNTIME PARITY

Read CLAUDE.md first.

Then read ALL runtime recovery docs:

- docs/POST_PHASE_RUNTIME_RECOVERY.md
- docs/runtime-qa/RUNTIME_QA_NOTES_RAW.md
- docs/runtime-qa/FREE_LESSON_CHAT_TRANSCRIPT.md
- docs/runtime-qa/PAID_LESSON_CHAT_TRANSCRIPT.md
- docs/runtime-qa/FREE_LESSON_CONSOLE_LOGS.md
- docs/runtime-qa/PAID_LESSON_CONSOLE_LOGS.md

Then read core runtime architecture docs:

- docs/RUNTIME_GUARDRAILS.md
- docs/AI_TEACHER_RUNTIME_RULES.md
- docs/LESSON_RUNTIME_STATE_MAP.md
- docs/WEBSOCKET_EVENT_CONTRACT.md

Then read latest stabilization handoffs:

- docs/handoffs/PHASE_6_HANDOFF.md
- docs/handoffs/PHASE_7_HANDOFF.md
- docs/handoffs/PHASE_8_HANDOFF.md

Work ONLY on:
PHASE 9 — PAID RUNTIME PARITY

DO NOT START PHASE 10+.

---

# PHASE GOAL

The FREE lesson interaction runtime currently feels significantly better than the PAID lesson runtime.

The backend orchestration layer in PAID lesson is already stronger.

This phase exists ONLY to make:
- paid interaction UX
- paid voice runtime
- paid transcript behavior
- paid interrupt behavior
- paid chat lifecycle

match FREE lesson quality.

This is a parity/stabilization phase.

NOT an architecture rewrite phase.

---

# PRIMARY OBJECTIVE

Make PAID lesson interaction behavior feel almost identical to FREE lesson interaction behavior.

Focus ONLY on:
- runtime interaction layer
- voice lifecycle
- transcript lifecycle
- message send lifecycle
- interrupt behavior
- mic UX
- TTS/STT responsiveness
- chat responsiveness

DO NOT:
- rewrite orchestration
- rewrite curriculum
- rewrite persistence
- rewrite snapshots
- rewrite websocket architecture

---

# CRITICAL PROBLEMS TO FIX

## 1. INTERRUPT BEHAVIOR

Current:
- interrupt unreliable
- user blocked while AI speaking
- speaking state desync
- transcript corruption after interrupt

Required:
- user can interrupt naturally
- interrupt immediately stops TTS
- mic becomes available immediately
- no stale transcript leakage
- no duplicated AI turns
- no stuck isSpeaking state

Use FREE runtime as reference behavior.

---

# 2. TRANSCRIPT LIFECYCLE

Current:
- transcript partially remains in input
- transcript auto-sends unexpectedly
- transcript lifecycle inconsistent

Required:
- clean start/stop recording
- transcript appears predictably
- transcript clears correctly
- transcript never duplicates
- transcript never partially persists after send
- transcript lifecycle should mirror FREE lesson behavior

---

# 3. MESSAGE SEND LIFECYCLE

Current:
- messages sometimes send unexpectedly
- auto-send timing inconsistent
- chat ordering inconsistent

Required:
- deterministic send lifecycle
- stable message ordering
- no duplicate sends
- no hidden sends
- no race conditions between STT and WS events

---

# 4. TTS/STT RESPONSIVENESS

Current:
- runtime feels delayed
- voice interaction less responsive than FREE lesson

Required:
- immediate interrupt
- fast mic recovery
- no delayed speaking states
- no stale TTS playback
- no overlapping TTS/STT states

---

# 5. CHAT UX PARITY

Current:
- FREE runtime feels smoother
- PAID runtime feels rigid

Required:
PAID runtime should preserve:
- lesson orchestration
- exercises
- curriculum progression

BUT interaction UX should feel:
- conversational
- responsive
- smooth
- low friction

---

# IMPORTANT ARCHITECTURAL RULES

DO NOT:
- rewrite lesson FSM
- rewrite lesson snapshots
- rewrite persistence system
- rewrite backend orchestration
- rewrite billing
- rewrite auth
- rewrite websocket system
- remove cursor system
- remove tips system
- remove continuation system

DO:
- reuse FREE runtime behavior
- reuse FREE runtime lifecycle patterns
- reuse FREE runtime interaction flow

Prefer:
- extracting shared runtime behavior
- aligning lifecycle logic
- removing divergence between FREE and PAID interaction runtime

---

# IMPORTANT ENGINEERING REQUIREMENTS

Before coding:
1. compare FREE runtime interaction flow vs PAID runtime interaction flow
2. identify divergence points
3. identify duplicated logic
4. identify lifecycle desync points
5. identify interrupt race conditions
6. identify transcript ownership issues

Output before coding:
1. files inspected
2. free runtime interaction flow summary
3. paid runtime interaction flow summary
4. major divergence points
5. likely root causes
6. minimal implementation plan
7. expected files to change

---

# IMPLEMENTATION PRIORITIES

Priority order:
1. interrupt reliability
2. transcript lifecycle
3. mic lifecycle
4. message send lifecycle
5. TTS/STT synchronization
6. chat smoothness

NOT:
- new features
- UI redesign
- orchestration changes

---

# TESTING REQUIREMENTS

Must test:
- repeated interrupt spam
- rapid mic toggling
- rapid send/interrupt cycles
- reconnect during TTS
- reconnect during recording
- transcript cancellation
- transcript resend prevention
- duplicate AI prevention

---

# STRICT RULES

Do NOT:
- touch curriculum logic
- touch renderer systems
- touch continuation flow
- touch snapshots
- touch pricing
- touch billing
- touch migrations unless absolutely required

No large refactors.

No giant rewrites.

No architecture replacements.

---

# BUILD REQUIREMENTS

After implementation:
- backend TypeScript check
- frontend TypeScript check
- frontend production build if available

Fix all compile errors before finishing.

---

# REQUIRED HANDOFF

Create:
- docs/handoffs/PHASE_9_HANDOFF.md

The handoff must include:
- exact runtime divergences found
- exact fixes implemented
- interrupt lifecycle changes
- transcript lifecycle changes
- message send lifecycle changes
- websocket/runtime event changes
- race conditions fixed
- known remaining issues
- what was intentionally NOT changed
- Phase 10 starting state