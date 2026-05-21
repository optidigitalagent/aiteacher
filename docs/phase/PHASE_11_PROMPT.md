# PHASE 11 — CONTINUATION & RUNTIME SAFETY

Read CLAUDE.md first.

Then read ALL runtime recovery docs:

- docs/POST_PHASE_RUNTIME_RECOVERY.md
- docs/runtime-qa/RUNTIME_QA_NOTES_RAW.md
- docs/runtime-qa/FREE_LESSON_CHAT_TRANSCRIPT.md
- docs/runtime-qa/PAID_LESSON_CHAT_TRANSCRIPT.md
- docs/runtime-qa/FREE_LESSON_CONSOLE_LOGS.md
- docs/runtime-qa/PAID_LESSON_CONSOLE_LOGS.md

Then read runtime architecture docs:

- docs/RUNTIME_GUARDRAILS.md
- docs/AI_TEACHER_RUNTIME_RULES.md
- docs/LESSON_RUNTIME_STATE_MAP.md
- docs/WEBSOCKET_EVENT_CONTRACT.md

Then read:
- docs/handoffs/PHASE_6_HANDOFF.md
- docs/handoffs/PHASE_7_HANDOFF.md
- docs/handoffs/PHASE_8_HANDOFF.md
- docs/handoffs/PHASE_9_HANDOFF.md
- docs/handoffs/PHASE_10_HANDOFF.md

Work ONLY on:
PHASE 11 — CONTINUATION & RUNTIME SAFETY

DO NOT START PHASE 12.

---

# PHASE GOAL

The runtime continuation system currently exists,
but it is not fully safe or fully deterministic.

The platform now needs:
- exact lesson continuation
- safe runtime accounting
- anti-abuse protection
- deterministic lesson recovery
- billing/runtime integrity

This phase is primarily:
- backend runtime hardening
- persistence correctness
- continuation stabilization
- runtime safety

NOT:
- frontend redesign
- orchestration rewrite
- curriculum rewrite

---

# PRIMARY OBJECTIVE

A student must NEVER be able to:
- reset lesson runtime accidentally
- duplicate runtime sessions
- bypass lesson limits
- reopen unlimited lesson time
- corrupt lesson continuation state

The system must:
- restore exact lesson runtime
- preserve billing integrity
- preserve lesson progression
- preserve exercise state
- preserve active paragraph/task
- preserve runtime limits

---

# CRITICAL PROBLEMS TO FIX

## 1. LESSON TIME RESTORE INCONSISTENCY

Current:
remaining lesson time may restore incorrectly.

Symptoms:
- lesson reopens with incorrect remaining time
- timeout inconsistencies
- runtime may effectively reset

Required:
- backend authoritative runtime restoration
- exact remaining time restoration
- exact timeout restoration
- frontend reflects backend only

---

# 2. LESSON CONTINUATION INCOMPLETE

Current:
continuation restores only partial lesson state.

Symptoms:
- paragraph lost
- active task lost
- progression partially lost
- lesson context partially lost

Required:
continuation restores:
- exact section
- exact paragraph
- exact exercise
- exact cursor position
- exact lesson runtime state
- exact progression state

---

# 3. DUPLICATE LESSON RISK

Current:
multiple reconnect/open flows may create duplicated active lesson states.

Required:
- single authoritative active runtime
- reconnect-safe restoration
- no duplicated runtime containers
- no duplicated active timers
- no duplicated websocket lesson ownership

---

# 4. BILLING / RUNTIME ACCOUNTING SAFETY

Current:
runtime accounting still has potential abuse vectors.

Potential risks:
- reopening lesson repeatedly
- consuming additional AI time
- timer desync
- snapshot/runtime mismatch

Required:
- deterministic runtime accounting
- strict lesson ownership
- strict runtime restoration
- strict timeout enforcement
- safe finalize behavior

---

# 5. SNAPSHOT CONSISTENCY

Current:
snapshot infrastructure exists,
but consistency guarantees may be incomplete.

Required:
snapshots must safely preserve:
- runtime timer
- progression
- exercise cursor
- paragraph state
- tips
- lesson agenda state
- active section
- active activity

---

# 6. RECONNECT HARDENING

Current:
reconnect behavior may still have edge-case inconsistencies.

Required:
safe reconnect during:
- TTS
- STT
- active exercise
- reading activity
- timeout edge
- lesson finalization

Reconnect must NEVER:
- duplicate AI turns
- duplicate timers
- duplicate lesson state
- reset runtime
- corrupt progression

---

# IMPORTANT ARCHITECTURAL RULES

DO NOT:
- rewrite billing architecture
- rewrite websocket architecture
- rewrite orchestration core
- rewrite snapshots from scratch
- rewrite continuation system from scratch
- rewrite curriculum systems

DO:
- extend existing continuation infrastructure
- harden existing runtime ownership
- harden existing snapshot behavior
- harden existing lesson lifecycle

This is a stabilization phase,
NOT a redesign phase.

---

# IMPORTANT ENGINEERING REQUIREMENTS

Before coding:
1. inspect continuation flow
2. inspect snapshot restore flow
3. inspect reconnect flow
4. inspect timeout/finalization flow
5. inspect lesson ownership logic
6. inspect active runtime container logic
7. identify abuse vectors
8. identify timer desync risks

Output before coding:
1. files inspected
2. current continuation architecture
3. current snapshot lifecycle
4. reconnect/runtime ownership flow
5. abuse vectors found
6. runtime desync risks found
7. minimal implementation plan
8. expected files to change

---

# IMPLEMENTATION PRIORITIES

Priority order:
1. runtime ownership safety
2. timeout correctness
3. exact continuation restoration
4. reconnect hardening
5. snapshot consistency
6. billing/runtime integrity

---

# STRICT RULES

Do NOT:
- redesign frontend
- redesign classroom UX
- redesign exercises
- redesign orchestration prompts

No large rewrites.

Prefer:
- guards
- runtime validation
- deterministic ownership
- state reconciliation
- lifecycle hardening

---

# TESTING REQUIREMENTS

Must test:
- reconnect spam
- browser refresh during lesson
- reconnect during TTS
- reconnect during recording
- reconnect during timeout edge
- reconnect after timeout
- reconnect after lesson completion
- multiple tabs
- rapid reconnect cycles
- lesson continuation after disconnect
- timeout after reconnect

Verify:
- lesson time never resets incorrectly
- lesson state never duplicates
- timers never duplicate
- lesson ownership remains authoritative
- progression remains stable

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
- docs/handoffs/PHASE_11_HANDOFF.md

The handoff must include:
- continuation architecture changes
- reconnect/runtime ownership changes
- timeout/finalization changes
- snapshot consistency changes
- billing/runtime safety changes
- abuse vectors fixed
- runtime edge cases fixed
- known remaining risks
- what was intentionally NOT changed
- Phase 12 starting state