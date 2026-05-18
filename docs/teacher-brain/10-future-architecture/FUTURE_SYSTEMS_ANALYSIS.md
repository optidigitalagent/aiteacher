# Future Systems Analysis

> Evaluation of potential future architectural additions.
> Each system is evaluated for: usefulness, complexity, cost, priority, and architectural fit.
> Do NOT implement until each system passes a feasibility review and production stabilization.

See also: [[FUTURE_ARCHITECTURE_NOTES]] · [[RUNTIME_AUTHORITY_MAP]] · [[AI_TEACHER_DOCTRINE]]

---

## System 1: Lesson Replay Timeline

### Description
A structured replay of a completed lesson showing:
- Timeline of all student answers with timestamps
- Which items triggered correction turns
- Where student state transitioned (confidence, confusion, frustration)
- Total time on each exercise
- Validation results for each item

### Usefulness
**High.** This is the missing teacher visibility layer.
Currently, there is no way for a teacher or admin to review what actually happened in a lesson.
Replay would enable:
- QA debugging of teacher behavior
- Student performance review
- Curriculum pacing analysis

### Complexity
**Medium.**
The Memory System already stores validation events and exercise events.
Replay is essentially a structured read + visualization of existing events.
The hard part is the visualization layer — structured timeline rendering in frontend.

### Cost
Low incremental cost — events already stored.
Frontend timeline component is new work (~1-2 weeks).

### Priority
**Medium-High.** Critical for QA and production monitoring.
Block on: Memory System event completeness (currently partial).

### Architectural Fit
**Good.** Reads from existing Memory System tables.
Does not touch Engine, Validation, or Teacher Brain.
Is purely a read/display layer.

### Next Step
Define the event schema that replay would read.
Ensure all critical events (item_submitted, correction_turn, exercise_complete) are stored.

---

## System 2: Pedagogical Event Debugger

### Description
A developer tool that shows real-time pedagogical events during a lesson:
- Student input → interpretation runtime output
- Slot detection result (which slots found/missing)
- Validation result (allowProgression, issueType)
- Correction turn (A/B/C/D) currently active
- Teacher Brain input context (what AI received)
- Teacher Brain output (what AI said)

### Usefulness
**Very High for development.**
Currently, debugging pedagogical failures requires reconstructing state from logs.
A real-time event view would eliminate hours of debugging per QA session.

### Complexity
**Medium.**
All these events already exist in the runtime — they're just not surfaced to a UI.
The WebSocket already emits some events — extend the dev event channel.

### Cost
Low if implemented as a dev-only sidebar or separate dev dashboard.
Medium if built as a persistent admin view.

### Priority
**High for dev team.** Critical for reducing QA cycle time.

### Architectural Fit
**Very Good.** Purely observational — reads runtime events, emits nothing.
Could be implemented as a WebSocket event tap that a dev dashboard subscribes to.

### Recommendation
Implement as a dev-only tool first (hidden behind `?debug=1` query param or env flag).
Not needed in production — keep it completely separate from student runtime.

---

## System 3: Student Memory Layer (Expanded)

### Description
Currently the Memory System stores:
- Validation events (correct/incorrect per item)
- Exercise events (completion, correction turns)
- Lesson events (start, end, duration)

Proposed expansion:
- **Grammar error patterns**: track which specific structures the student consistently fails
- **Vocabulary gaps**: track words the student asked to define
- **Confidence patterns**: track which exercise types correlate with low-confidence signals
- **Pacing preferences**: track average time-per-item to calibrate pacing
- **Pronunciation patterns**: track which sounds consistently mangle STT

### Usefulness
**High long-term.**
This is what enables truly adaptive teaching — not just session-level adaptation but cross-session learning.

### Complexity
**High.**
The data schema is straightforward.
The hard part is:
1. Reliable signal extraction (not all "wrong answers" indicate grammar gaps)
2. Privacy implications of storing granular learning data
3. How Teacher Brain uses this without creating bias loops

### Cost
High — schema + extraction logic + Teacher Brain prompt engineering + privacy audit.

### Priority
**Low for now.** The current Memory System is the foundation — expand after it stabilizes.

### Architectural Fit
**Careful.** Memory must NEVER influence progression, correctness, or exercise selection.
It may only influence Teacher Brain phrasing, pacing adjustments, and hint framing.
The architecture risk is memory being used to bypass validation or Engine authority.

### Next Step
Define the strict boundary: "Memory affects ONLY these 3 teacher behaviors, nothing else."
Document and implement the boundary before expanding memory scope.

---

## System 4: Pronunciation Tracking

### Description
Track the specific phonological patterns where each student consistently struggles:
- /θ/ and /ð/ (th sounds)
- Final consonant clusters (students drop them: "lef'" for "left")
- Vowel distinctions (/ɪ/ vs /iː/: "ship" vs "sheep")
- Word stress (STU-dent vs stu-DENT)
- Voiced/unvoiced final consonants

Map to the student's L1 background if available (Ukrainian L1 → specific patterns).

### Usefulness
**Medium.**
Pronunciation tracking would make STT interpretation smarter.
It would also enable the teacher to give targeted pronunciation feedback at session end.

### Complexity
**Very High.**
Requires STT to provide phoneme-level data (currently only word-level).
Requires a phonological model per L1 background.
Requires connecting pronunciation events to lesson timing.

### Cost
Very high. STT provider changes may be needed for phoneme-level output.

### Priority
**Low.** The core grammar teaching runtime is the priority.
Pronunciation tracking is a nice-to-have at B1 level — students understand each other despite phonological variation.

### Next Step
None for now. Revisit when core runtime is fully stable and Memory System is expanded.

---

## System 5: Adaptive Pacing

### Description
Adjust time-per-item thresholds based on:
- Student's error rate on current exercise type
- Student's confidence signals (hesitation patterns)
- Session time remaining
- Cross-session average completion rate

### Usefulness
**Medium.**
Currently all students follow identical pacing (3 attempts, ABCD ladder, same wait times).
Adaptive pacing would reduce frustration for slow students and time-waste for fast students.

### Complexity
**Medium.**
The pacing variables are already present (attempt count, turn identifiers).
Adaptation would require: memory of past session pacing + per-student threshold overrides.

### Cost
Medium. Primarily a Teacher Brain behavior change guided by memory context.

### Priority
**Medium-Low.**
The current fixed pacing is acceptable for most students.
Adapt after Memory System expansion is complete.

### Architectural Fit
**Good if bounded correctly.**
Pacing adaptation MUST NOT affect:
- Correctness determination
- Correction turn assignment
- Slot requirements

It may affect: wait time before re-prompt, scaffold level offered on retry 1 vs 2.

---

## System 6: Teacher Behavioral Runtime (Formal)

### Description
A formal, executable behavioral specification for Teacher Brain:
- Instead of AI generating responses from a prose prompt, use a structured behavioral graph
- Each node in the graph corresponds to a pedagogical state
- Transitions are deterministic (based on validation result, correction turn, student state)
- AI only generates the verbal content — all pacing/routing is deterministic

This would make Teacher Brain behavior fully auditable and testable.

### Usefulness
**Very High.**
The biggest current risk is AI "drifting" into undocumented behavior under unusual inputs.
A formal behavioral runtime would eliminate drift — the AI can only do what the graph allows.

### Complexity
**Very High.**
Building a formal behavioral graph is significant engineering work.
The payoff is enormous (testable, auditable, non-drifting behavior).
But the transition from prompt-engineering to behavioral graph is a major architectural change.

### Cost
Very high — 4-8 weeks of engineering.

### Priority
**Low for now, High strategically.**
This is the direction the architecture should move toward over 6-12 months.
Build it incrementally: start with one exercise type (grammar fill) on the formal graph,
test it, then expand.

### Next Step
Define the behavioral graph format. Map GRAMMAR_FILL_PROTOCOL to a formal graph.
Use this as the prototype before committing to the full system.

---

## System 7: Structured Lesson Telemetry

### Description
Real-time and post-lesson analytics:
- Items per minute (lesson velocity)
- Correction turn distribution (how often does each student hit TURN D?)
- Exercise type difficulty index (which exercises generate most TURN D?)
- Session completion rate (what % of exercises are completed per lesson?)
- Voice recognition quality score (what % of transcripts require interpretation fix?)

### Usefulness
**Very High for product quality.**
Currently: no visibility into whether lessons are paced correctly.
Telemetry would reveal: are students consistently stuck on exercise 3? Is lesson velocity too slow?

### Complexity
**Medium.**
Data collection: Memory System events are mostly captured already.
Aggregation: needs a reporting layer (SQL queries or analytics DB).
Visualization: needs a dashboard.

### Cost
Medium — primarily the reporting and dashboard layer.

### Priority
**High.** This should be built when the first paying cohort of students is active.
Without telemetry, there is no way to know if the product is working.

### Architectural Fit
**Excellent.** Reads only — no changes to core runtime.

---

## Summary Matrix

| System | Usefulness | Complexity | Cost | Priority | Next Action |
|--------|-----------|-----------|------|----------|------------|
| Lesson Replay Timeline | High | Medium | Low | Medium-High | Define event schema |
| Pedagogical Event Debugger | Very High (dev) | Medium | Low | High | Implement dev-only |
| Student Memory Expansion | High | High | High | Low | Define boundaries first |
| Pronunciation Tracking | Medium | Very High | Very High | Low | None yet |
| Adaptive Pacing | Medium | Medium | Medium | Medium-Low | After Memory expansion |
| Teacher Behavioral Runtime | Very High | Very High | Very High | Strategic | Prototype one exercise type |
| Structured Lesson Telemetry | Very High | Medium | Medium | High | Build with first paying cohort |

---

## What Must NOT Be Built

| System | Reason |
|--------|--------|
| Multi-agent orchestration | Reintroduces GPT control over progression |
| LLM-based correctness | Unpredictable, non-auditable |
| Frontend-driven pacing | Creates Engine desync |
| Autonomous exercise generation | Curriculum integrity depends on textbook structure |
| "Conversational AI" mode | Chatbot model — explicitly rejected |
