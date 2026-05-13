# POST PHASE RUNTIME RECOVERY

## Current Production State

The AI Teacher platform successfully completed Phases 0–8:
- backend runtime architecture
- websocket orchestration
- lesson persistence
- lesson continuation
- exercise cursor system
- teacher orchestration prompts
- tips infrastructure
- runtime snapshots
- curriculum scaling
- stabilization phase

The system is now beyond prototype stage.

However, major runtime consistency and UX parity problems still exist between:
- FREE lesson runtime
- PAID lesson runtime

The backend orchestration layer is now significantly more advanced than the frontend interaction/runtime layer.

The current goal is NOT architecture expansion.

The current goal is:
- runtime stabilization
- UX parity
- continuation hardening
- exercise rendering recovery
- production reliability

---

# IMPORTANT ENGINEERING CONTEXT

FREE lesson currently provides:
- better voice interaction
- better interrupt behavior
- cleaner transcript lifecycle
- better message rendering
- smoother STT/TTS behavior
- better conversational UX
- better translation UX

PAID lesson currently provides:
- stronger orchestration
- stronger curriculum control
- stronger runtime persistence
- stronger exercise tracking
- stronger lesson structure

BUT:
the PAID interaction runtime feels worse than FREE lesson.

This is now the primary product problem.

The next phases MUST focus on:
- parity
- stabilization
- runtime consistency
- frontend/runtime recovery

NOT:
- rewriting orchestration
- replacing websocket architecture
- replacing lesson FSM
- rebuilding curriculum systems
- redesigning billing

---

# WHAT CURRENTLY WORKS WELL

## Backend Runtime
Stable:
- websocket infrastructure
- lesson runtime ownership
- backend timer ownership
- runtime snapshots
- continuation infrastructure
- interrupt foundation
- teacher agenda prompting
- cursor progression
- tips persistence
- curriculum catalog system

## Free Lesson Runtime
Stable:
- voice interaction
- mic lifecycle
- transcript UX
- translation flow
- conversation flow
- response rendering
- interrupt behavior
- TTS/STT responsiveness

## Production Infrastructure
Stable:
- deployment flow
- billing foundation
- auth
- registration
- payment flow
- Railway deployment
- TypeScript builds
- migrations
- runtime handoffs

---

# CRITICAL PRODUCTION PROBLEMS

## 1. FREE LESSON ACCESS GATING

Problem:
Free lesson sometimes incorrectly requires payment access.

Expected:
- registration required
- payment NOT required
- demo/free lesson must always remain accessible

Risk:
- onboarding collapse
- conversion loss
- broken acquisition funnel

Priority:
CRITICAL

---

# 2. PAID LESSON INTERACTION RUNTIME IS WORSE THAN FREE LESSON

Problem:
The paid runtime interaction layer feels significantly worse than free runtime.

Symptoms:
- user cannot interrupt properly
- user cannot interact during TTS
- transcript lifecycle broken
- message sending inconsistent
- STT/TTS delays
- voice recording UX inconsistent
- auto-send behavior broken
- transcript remains partially in input
- messages appear inconsistently

Expected:
PAID runtime interaction behavior should match FREE runtime behavior almost exactly.

Important:
The AI orchestration logic can remain different.
The interaction/runtime layer must behave similarly.

Priority:
CRITICAL

---

# 3. EXERCISE RENDERER IS BROKEN

Problem:
The exercise UI only shows fragments of exercises.

Symptoms:
- only current question visible
- no instruction visible
- no context visible
- no task explanation visible
- user does not understand what they are solving
- exercise card does not persist correctly
- task switching unclear
- exercise progression unclear

Expected:
The exercise area must always show:
- current task
- instructions
- context
- exercise objective
- active question
- progression state

Even after:
- side questions
- translation requests
- explanations

The exercise anchor must remain visible.

Priority:
CRITICAL

---

# 4. SIDE QUESTION RECOVERY IS PARTIALLY BROKEN

Problem:
AI answers side questions correctly but fails to recover the lesson flow correctly.

Symptoms:
- AI loops on side topic
- user loses orientation
- exercise context disappears
- unclear what to do next

Expected:
After side question:
- exercise remains visible
- AI answers briefly
- AI immediately returns user to current task
- current task remains anchored visually

Priority:
HIGH

---

# 5. CONTINUATION / RUNTIME ACCOUNTING IS UNSAFE

Problem:
Lesson continuation and runtime accounting are incomplete.

Symptoms:
- lesson progress partially lost
- paragraph progress not restored
- remaining time resets incorrectly
- user can reopen lessons repeatedly
- possible unlimited API consumption
- continuation flow incomplete

Expected:
Continuation system must:
- restore exact runtime state
- restore lesson time correctly
- restore active paragraph/exercise
- preserve runtime limits
- prevent abuse
- preserve billing integrity

Priority:
CRITICAL

---

# 6. PARAGRAPH / SECTION RENDERING PROBLEMS

Problem:
Learning page section rendering is inconsistent.

Symptoms:
- sections positioned incorrectly
- layout offset issues
- section names missing
- numbering incorrect
- some sections missing entirely

Expected:
- centered section rendering
- correct unit/section mapping
- stable numbering
- all sections visible
- curriculum consistency

Priority:
HIGH

---

# 7. TRANSLATION UX IS INCONSISTENT

Problem:
Translation behavior differs between FREE and PAID runtime.

Expected:
PAID lesson must support:
- inline translation
- message translation button
- quick vocabulary lookup
- translation UX parity with FREE runtime

Additional requirement:
Add dedicated Translate flow:
- popup/panel
- typed input
- spoken input
- quick translation result

Priority:
HIGH

---

# 8. EXPLANATION FLOW NEEDS REWORK

Problem:
Explanation flow currently creates confusion.

Current:
- explanation card
- markdown-heavy output
- poor readability

Required:
- remove Explanation card
- keep only:
  - "I don't understand"
  - "Translate"

Expected:
Explanations must:
- render cleanly
- use paragraphs
- separate examples/rules/questions visually
- avoid markdown dump formatting

Priority:
MEDIUM

---

# 9. TIPS PANEL IS NOT FULLY CONNECTED

Problem:
Tips infrastructure exists but runtime integration is inconsistent.

Expected:
Tips panel must collect:
- vocabulary help
- translations
- corrections
- pronunciation notes
- grammar hints

Tips must persist during lesson.

Priority:
HIGH

---

# 10. TRY AGAIN ENTRY BUG

Problem:
Paid lesson sometimes opens with:
- blocked UI
- Try Again screen

User must manually retry.

Expected:
Lesson should initialize cleanly on first entry.

Priority:
HIGH

---

# IMPORTANT ARCHITECTURAL CONSTRAINTS

DO NOT:
- rewrite orchestration core
- rewrite websocket architecture
- rewrite billing
- rewrite lesson snapshots
- replace runtime persistence
- rebuild lesson FSM from scratch
- remove cursor system
- remove continuation system
- remove tips infrastructure
- remove teacher agenda prompts

The current architecture foundation is already strong.

The problem is:
- runtime consistency
- frontend interaction layer
- renderer stability
- continuation hardening

---

# PRIMARY ENGINEERING GOAL

The next phases should make:
PAID runtime feel as smooth, responsive, and understandable as FREE runtime,
while preserving:
- curriculum orchestration
- lesson persistence
- structured progression
- billing safety
- runtime authority

---

# RECOMMENDED FIX ORDER

## Phase 9
Paid Runtime Parity
- mic lifecycle
- interrupt behavior
- transcript UX
- voice interaction parity
- message send lifecycle

## Phase 10
Exercise Renderer Recovery
- instructions
- task persistence
- exercise anchors
- side-question recovery
- section rendering

## Phase 11
Continuation & Runtime Safety
- exact lesson resume
- runtime accounting
- billing integrity
- anti-abuse fixes
- snapshot hardening

## Phase 12
Production UX Polish
- loading states
- markdown cleanup
- layout calibration
- mobile polish
- edge-case cleanup

---

# REQUIRED REFERENCE FILES

All future runtime recovery phases must read:

- docs/runtime-qa/FREE_LESSON_CHAT_TRANSCRIPT.md
- docs/runtime-qa/PAID_LESSON_CHAT_TRANSCRIPT.md
- docs/runtime-qa/FREE_LESSON_CONSOLE_LOGS.md
- docs/runtime-qa/PAID_LESSON_CONSOLE_LOGS.md
- docs/runtime-qa/RUNTIME_QA_NOTES_RAW.md

before implementation.

These files represent:
- production QA evidence
- runtime behavior references
- expected interaction patterns
- known failures
- real user experience