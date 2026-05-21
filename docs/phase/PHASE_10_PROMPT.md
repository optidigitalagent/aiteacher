# PHASE 10 — EXERCISE RENDERER RECOVERY

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
- docs/handoffs/PHASE_7_HANDOFF.md
- docs/handoffs/PHASE_8_HANDOFF.md
- docs/handoffs/PHASE_9_HANDOFF.md

Work ONLY on:
PHASE 10 — EXERCISE RENDERER RECOVERY

DO NOT START PHASE 11+.

---

# PHASE GOAL

The backend orchestration system already tracks:
- lesson progression
- exercise progression
- cursor state
- current activity
- lesson agenda

BUT:
the frontend exercise renderer does not expose enough context to the student.

Current result:
students lose orientation during lessons.

This phase exists to:
- recover exercise clarity
- stabilize lesson context visibility
- improve progression rendering
- preserve task anchors during interruptions

WITHOUT rewriting orchestration.

---

# PRIMARY OBJECTIVE

The student should ALWAYS understand:
- what task they are doing
- what exercise they are in
- what the objective is
- what question/item is active
- what happens next

Even after:
- side questions
- translations
- interruptions
- reconnects
- corrections

The exercise context must remain visually anchored.

---

# CRITICAL PROBLEMS TO FIX

## 1. MISSING EXERCISE CONTEXT

Current:
- only current question fragment visible
- instructions missing
- exercise objective missing
- exercise explanation missing

Result:
student does not understand the task.

Required:
exercise panel must always display:
- exercise title
- instructions
- current objective
- current item/question
- progression state
- exercise type
- optional context/examples if available

---

# 2. EXERCISE ANCHOR LOSS

Current:
after:
- side questions
- translations
- explanations

the active task visually disappears.

Required:
the active exercise card must remain persistent.

The user should never lose:
- current task
- current item
- progression position

---

# 3. SIDE QUESTION RECOVERY UX

Current:
AI answers side questions,
but visually the lesson loses structure.

Required:
after side question:
- active exercise remains visible
- return target visible
- exercise state preserved
- progression preserved

The renderer should reinforce:
"we are still on this task."

---

# 4. EXERCISE PROGRESSION VISIBILITY

Current:
exercise transitions unclear.

Problems:
- unclear current item
- unclear completed items
- unclear remaining items
- unclear section progression

Required:
clear visual progression state:
- current item
- completed items
- remaining items
- section progression
- lesson progression where possible

WITHOUT overcomplicating UI.

---

# 5. READING / PARAGRAPH RENDERING

Current:
reading sections are unstable and visually unclear.

Required:
- stable paragraph rendering
- visible reading objective
- paragraph persistence
- current paragraph visibility
- reading progression clarity

The student should understand:
- what paragraph is active
- whether they should read/listen/respond

---

# 6. CURRICULUM / SECTION CONSISTENCY

Current:
- numbering inconsistencies
- section naming inconsistencies
- layout spacing issues
- some sections visually confusing

Required:
- stable section rendering
- proper naming
- proper numbering
- stable curriculum mapping visibility

DO NOT rewrite curriculum systems.

Fix renderer consistency only.

---

# IMPORTANT ARCHITECTURAL RULES

DO NOT:
- rewrite orchestration
- rewrite lesson FSM
- rewrite persistence
- rewrite websocket architecture
- rewrite snapshots
- rewrite billing
- rewrite curriculum backend

DO:
- leverage existing cursor system
- leverage existing progression state
- leverage existing teacher agenda context
- leverage existing runtime state

This is primarily:
- frontend rendering stabilization
- UX clarity
- exercise persistence

NOT:
backend architecture work.

---

# IMPORTANT ENGINEERING REQUIREMENTS

Before coding:
1. inspect current exercise rendering flow
2. inspect current cursor rendering
3. inspect side-question behavior
4. inspect reading rendering flow
5. identify renderer/context gaps
6. identify duplicated rendering logic

Output before coding:
1. files inspected
2. current renderer architecture
3. current progression flow
4. current exercise anchor behavior
5. renderer gaps found
6. minimal implementation plan
7. expected files to change

---

# IMPLEMENTATION PRIORITIES

Priority order:
1. persistent exercise context
2. instructions visibility
3. progression visibility
4. side-question anchor preservation
5. reading rendering clarity
6. curriculum consistency polish

---

# UX REQUIREMENTS

The renderer should feel:
- stable
- understandable
- anchored
- low confusion
- visually persistent

Avoid:
- giant cards
- clutter
- complex dashboards
- excessive animations

The lesson should feel:
- guided
- structured
- easy to follow

---

# STRICT RULES

Do NOT:
- redesign the entire classroom UI
- replace the lesson structure
- replace exercise systems
- rebuild progression architecture

No giant frontend rewrites.

Prefer:
- targeted rendering improvements
- state reuse
- progression clarity
- anchor persistence

---

# TESTING REQUIREMENTS

Must test:
- side question during exercise
- translation during exercise
- reconnect during exercise
- reading section transitions
- progression updates
- rapid exercise switching
- lesson resume during active task

Verify:
- exercise never disappears unexpectedly
- current task always visible
- progression always understandable

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
- docs/handoffs/PHASE_10_HANDOFF.md

The handoff must include:
- renderer architecture changes
- progression rendering changes
- exercise anchor fixes
- side-question recovery rendering fixes
- reading rendering fixes
- curriculum consistency fixes
- websocket/runtime state changes if any
- known remaining UX issues
- what was intentionally NOT changed
- Phase 11 starting state