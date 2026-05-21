Read CLAUDE.md first.

Then read:
docs/PAID_LESSON_RUNTIME_ROADMAP.md

Then read:
the latest PHASE_3 handoff.

Work ONLY on:
Phase 4 — Teacher Intelligence & Agenda Recovery

Do NOT work on future phases.

Do NOT redesign the runtime architecture.

Current system state:
- voice runtime partially stabilized
- lesson state machine exists
- textbook renderer partially deterministic
- exercise progression exists
- realtime reading exists
- lesson structure exists

However:

The teacher still does NOT consistently feel like:
a professional English teacher.

Current major problems:
- AI sometimes talks too much
- explanations sometimes feel GPT-like
- pacing inconsistent
- teacher sometimes loses lesson agenda
- side questions sometimes derail lesson flow
- transitions sometimes awkward
- explanations not always contextual
- teacher personality weak/inconsistent
- interruptions sometimes break progression rhythm
- teacher sometimes over-explains simple things

GOAL OF THIS PHASE

Transform the AI teacher from:
"a GPT assistant with exercises"

into:

"a professional structured English teacher."

The classroom should feel:
guided,
intentional,
controlled,
human,
educational.

--------------------------------------------------
MAIN RESPONSIBILITIES
--------------------------------------------------

1. Build deterministic agenda recovery

The teacher must ALWAYS remember:
- current lesson goal
- current exercise
- current paragraph
- current student weakness
- what the student was doing before interruption

If the student asks:
- side question
- translation question
- grammar clarification
- pronunciation clarification

The teacher must:
1. answer briefly and clearly
2. smoothly return to the active lesson objective

The lesson must NEVER drift permanently.

--------------------------------------------------

2. Implement professional teacher pacing

Teacher responses must become:
- shorter
- clearer
- more teacher-like
- less GPT-like
- more educational
- more guided

Avoid:
- giant paragraphs
- long monologues
- repeated explanations
- over-talking
- motivational fluff
- robotic assistant phrasing

The teacher should sound like:
a real tutor managing lesson flow.

--------------------------------------------------

3. Improve lesson navigation language

The student should ALWAYS understand:
- what we are doing now
- why we are doing it
- what comes next
- what the goal is

Teacher should naturally say things like:
- "Now let's move to Exercise 3."
- "This exercise practices past simple."
- "Let's read the next paragraph."
- "Good. Now let's check pronunciation."
- "Before we continue, let's fix this word."

The lesson should feel:
structured and guided.

--------------------------------------------------

4. Build contextual explanation behavior

The teacher must explain:
ONLY what is relevant right now.

Examples:
- pronunciation issue → pronunciation explanation
- grammar issue → quick grammar explanation
- vocab issue → vocab clarification

Avoid:
massive theoretical explanations.

The teacher should:
teach in-context.

--------------------------------------------------

5. Strengthen Emma/Alex personas

Emma:
- warm
- encouraging
- calm
- patient
- supportive

Alex:
- structured
- focused
- slightly demanding
- concise
- disciplined

BUT:
Both must still follow:
- lesson agenda
- pacing rules
- textbook grounding
- interruption recovery rules

Personality must NEVER break structure.

--------------------------------------------------

6. Improve interruption intelligence

When the student interrupts:
- teacher pauses naturally
- teacher answers naturally
- teacher resumes naturally

The teacher must NOT:
- restart entire explanation
- forget current exercise
- duplicate previous answer
- lose progression state

The interruption system must feel:
human.

--------------------------------------------------

7. Prevent AI rambling

Hard requirement:
The teacher must avoid:
- GPT essays
- repetitive phrasing
- repeated encouragement
- repeated confirmations
- circular explanations

The classroom should feel:
fast,
clean,
focused.

--------------------------------------------------

8. Preserve current architecture

Do NOT:
- redesign billing
- redesign websocket systems
- redesign renderer systems
- redesign runtime ownership
- redesign persistence architecture

Focus ONLY on:
teacher intelligence and lesson interaction quality.

--------------------------------------------------
IMPORTANT EXPERIENCE TARGET
--------------------------------------------------

The lesson should now feel like:

a real professional online English lesson.

NOT:
an AI chatbot pretending to teach.

The student should feel:
- guided
- corrected
- managed
- paced
- supported

without:
- chaos
- rambling
- awkward AI behavior

--------------------------------------------------
REQUIRED RUNTIME TESTS
--------------------------------------------------

You MUST test:
- repeated side questions
- repeated interruptions
- grammar clarification requests
- pronunciation correction interruptions
- translation requests
- reconnect during explanation
- interruption during explanation
- fast back-and-forth interaction
- Emma personality consistency
- Alex personality consistency

--------------------------------------------------
CRITICAL IMPLEMENTATION RULES
--------------------------------------------------

DO:
- extend existing orchestration carefully
- preserve deterministic exercise structure
- preserve current runtime systems
- preserve lesson state machine
- preserve textbook grounding

DO NOT:
- replace the AI system entirely
- rewrite websocket architecture
- rewrite lesson engine
- rewrite billing systems
- create parallel orchestration systems

--------------------------------------------------
LESSON EXPERIENCE TARGET
--------------------------------------------------

The classroom should now feel:

stable,
professional,
interactive,
human,
teacher-led.

The AI should feel:
like a tutor managing a real lesson.

NOT:
a conversational GPT bot.

--------------------------------------------------
OUTPUT REQUIREMENTS
--------------------------------------------------

At the end output FULL PHASE HANDOFF using roadmap format:

1. Summary
2. Goals Completed
3. Changed Files
4. Backend Changes
5. Frontend Changes
6. Database Changes
7. Runtime Behavior Changes
8. WebSocket/Event Changes
9. AI/Prompt Changes
10. Cost Impact
11. Tests Performed
12. Known Remaining Issues
13. What Was Intentionally NOT Changed
14. Risks Introduced
15. Deployment Notes
16. Recommended Next Phase
17. Next Claude Session Instructions