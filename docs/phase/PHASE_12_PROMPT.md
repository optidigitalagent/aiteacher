# PHASE 12 — PRODUCTION UX POLISH & FINAL STABILIZATION

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
- docs/handoffs/PHASE_8_HANDOFF.md
- docs/handoffs/PHASE_9_HANDOFF.md
- docs/handoffs/PHASE_10_HANDOFF.md
- docs/handoffs/PHASE_11_HANDOFF.md

Work ONLY on:
PHASE 12 — PRODUCTION UX POLISH & FINAL STABILIZATION

This is the final major stabilization phase before long-term production maintenance.

DO NOT START NEW FEATURE PHASES.

---

# PHASE GOAL

The architecture foundation already exists.

The runtime systems already exist.

The continuation systems already exist.

This phase exists to:
- polish runtime UX
- eliminate remaining production friction
- improve readability
- improve interaction smoothness
- stabilize edge-case behavior
- improve user trust
- improve lesson clarity

WITHOUT:
- major rewrites
- architecture replacements
- redesigning the product

---

# PRIMARY OBJECTIVE

Make the platform feel:
- smooth
- trustworthy
- understandable
- polished
- responsive
- production-ready

This phase should eliminate:
- friction
- confusing states
- ugly formatting
- unstable transitions
- visual inconsistencies
- runtime rough edges

---

# CRITICAL UX PROBLEMS TO FIX

## 1. TRY AGAIN ENTRY FLOW

Current:
sometimes lesson opens into:
- blocked state
- loading dead-end
- retry screen

Expected:
lesson should initialize cleanly on first load.

Requirements:
- deterministic initialization
- stable loading flow
- graceful recovery states
- no confusing retry loops

---

# 2. MARKDOWN / RESPONSE READABILITY

Current:
AI explanations sometimes render as:
- markdown dumps
- dense walls of text
- visually messy responses

Required:
responses should:
- use paragraphs
- separate examples
- separate rules
- separate exercises/questions
- remain readable on mobile
- avoid giant text blocks

DO NOT:
introduce complex markdown renderers.

Keep rendering simple and readable.

---

# 3. EXPLANATION UX CLEANUP

Current:
Explanation flow feels cluttered.

Required:
- remove confusing explanation panel/card behavior
- preserve:
  - "I don't understand"
  - "Translate"

The lesson should feel:
- conversational
- guided
- lightweight

NOT:
- overloaded with panels

---

# 4. TIPS UX POLISH

Current:
tips infrastructure exists,
but UX still rough.

Required:
- smooth drawer behavior
- clean grouping
- easy readability
- better persistence visibility
- clean empty states
- smooth lesson integration

---

# 5. LOADING / TRANSITION STATES

Current:
some transitions feel abrupt or unstable.

Required:
stabilize:
- lesson loading
- reconnect loading
- exercise transitions
- translation states
- TTS/STT transitions
- lesson completion states

The user should always understand:
- what is happening
- what is loading
- what state the lesson is in

---

# 6. MOBILE / RESPONSIVE POLISH

Current:
some layouts still inconsistent on smaller screens.

Required:
verify:
- exercise rendering
- transcript rendering
- buttons
- drawers
- progression UI
- loading states
- translation UI
- tips drawer

Focus:
- readability
- spacing
- touch interaction
- visual stability

---

# 7. VISUAL CONSISTENCY

Current:
some parts of the classroom feel disconnected visually.

Required:
improve consistency between:
- chat
- exercise renderer
- tips drawer
- translation flow
- progression UI
- runtime states

WITHOUT redesigning the product.

---

# 8. FINAL RUNTIME EDGE CASES

Fix remaining:
- duplicate loaders
- stale buttons
- disabled-state bugs
- stuck transitions
- stale speaking states
- stale transcript states
- reconnect visual glitches
- completion state inconsistencies

---

# IMPORTANT ARCHITECTURAL RULES

DO NOT:
- rewrite orchestration
- rewrite websocket architecture
- rewrite snapshots
- rewrite continuation systems
- redesign the classroom
- redesign billing
- redesign lesson systems

DO:
- polish
- stabilize
- simplify UX friction
- improve runtime clarity
- improve consistency

This is:
- stabilization
- polish
- cleanup

NOT:
- architecture work

---

# IMPORTANT ENGINEERING REQUIREMENTS

Before coding:
1. inspect current classroom UX flow
2. inspect remaining rough runtime states
3. inspect mobile behavior
4. inspect explanation rendering
5. inspect transition/loading behavior
6. inspect lesson entry flow

Output before coding:
1. files inspected
2. remaining UX inconsistencies
3. remaining runtime rough edges
4. remaining mobile/layout problems
5. minimal implementation plan
6. expected files to change

---

# IMPLEMENTATION PRIORITIES

Priority order:
1. entry/loading stability
2. readability
3. explanation cleanup
4. transition polish
5. mobile polish
6. visual consistency
7. remaining runtime edge cases

---

# STRICT RULES

Do NOT:
- redesign the UI system
- create new architecture layers
- add giant animation systems
- introduce heavy frontend complexity

Prefer:
- lightweight improvements
- runtime clarity
- readability
- stability
- polish

---

# TESTING REQUIREMENTS

Must test:
- mobile layouts
- reconnect UX
- lesson entry flow
- lesson completion flow
- translation flow
- tips drawer
- long AI responses
- interrupt during loading
- reconnect during loading
- repeated lesson entry

Verify:
- no confusing dead-end states
- no unreadable responses
- no visual instability
- no stuck transitions
- no stale loaders/buttons

---

# BUILD REQUIREMENTS

After implementation:
- backend TypeScript check
- frontend TypeScript check
- frontend production build if available

Fix all compile/runtime issues before finishing.

---

# REQUIRED HANDOFF

Create:
- docs/handoffs/PHASE_12_HANDOFF.md

The handoff must include:
- UX polish changes
- runtime stabilization changes
- loading/transition fixes
- explanation cleanup changes
- mobile/responsive fixes
- remaining edge cases fixed
- known remaining issues
- what was intentionally NOT changed
- final production readiness state