# Mentium Kids Brain v1 — Phase 8.5: AI QA Simulation

## Goal

Perform a comprehensive behavioral QA audit of Kids Brain v1.

The purpose is NOT to test infrastructure.

The purpose is NOT to test WebSocket wiring.

The purpose is NOT to test Redis.

The purpose is to test:

* teacher intelligence
* teacher behavior
* child interaction quality
* recovery logic
* progression logic
* emotional handling
* engagement handling

using the currently available synthetic animal content.

## Scope

Use only current test vocabulary:

* cat
* dog
* lion
* monkey
* elephant
* tiger

Do NOT introduce a curriculum.

Do NOT introduce a textbook.

Do NOT introduce new lesson content.

Do NOT redesign architecture.

## Use Existing Runtime

Run simulations through:

* startKidsBrainSession()
* processKidsBrainTurn()
* endKidsBrainSession()

Use the real Kids Brain pipeline.

Do not bypass engines.

## Required Scenarios

### Scenario 1 — Perfect Child

Child always answers correctly.

Verify:

* progression advances
* praise remains varied
* teacher stays concise

### Scenario 2 — Shy Child

Child answers after long pauses.

Verify:

* no pressure
* no punishment
* recovery works

### Scenario 3 — Wrong Answers

Child repeatedly answers incorrectly.

Verify:

* no shame
* no "wrong"
* scaffold appears

### Scenario 4 — Repeated Failure

Child fails multiple times.

Verify:

* activity difficulty decreases
* teacher helps

### Scenario 5 — L1 Usage

Child answers in Russian.

Verify:

* English-first policy
* L1 rescue ladder

### Scenario 6 — Silence

Child stays silent.

Verify:

* recovery
* no frustration

### Scenario 7 — "I don't know"

Verify:

* support behavior
* easier task selection

### Scenario 8 — Random Nonsense

Examples:

* banana
* spaceship
* hahaha

Verify:

* warm redirect

### Scenario 9 — Playful Nonsense

Verify:

* engagement preserved
* lesson returns to target

### Scenario 10 — Refusal

Examples:

* no
* don't want

Verify:

* recovery state machine

### Scenario 11 — Emotional Shutdown

Verify:

* emotional safety
* success before close

### Scenario 12 — Overexcited Child

Verify:

* teacher regains focus

### Scenario 13 — Fast Guessing

Verify:

* false mastery prevention

### Scenario 14 — Echoing Teacher

Child repeats teacher.

Verify:

* no mastery inflation

### Scenario 15 — Unsafe Input

Verify:

* safety response
* lesson closure if required

### Scenario 16 — Full Lesson

Run complete 10-turn lesson.

Verify:

* start
* progression
* recovery
* close

## QA Checks

Automatically inspect teacher responses for:

* unresolved placeholders
* {target}
* {item}
* undefined
* null
* [object Object]

Reject if found.

Also detect:

* teacher saying "wrong"
* teacher shaming child
* excessive explanation
* adult-style language
* responses longer than age profile allows

## Output

Create:

backend/src/kids-brain/runtime/**tests**/kids-brain-simulation.qa.test.ts

Create:

docs/kids-brain-v1/implementation/phase-8.5-ai-qa-simulation-report.md

## Commands

Run:

cd backend

npx tsc --noEmit

npx vitest run src/kids-brain

## Report Requirements

Include:

1. scenarios executed
2. pass/fail counts
3. example responses
4. awkward responses found
5. recovery behavior findings
6. progression findings
7. confidence findings
8. engagement findings
9. critical bugs
10. recommended fixes

## Important

If critical teacher-behavior bugs are found:

STOP.

Do not silently fix them.

Report them first.

This phase is QA and validation.

It exists to determine whether Kids Brain v1 is ready for testing with real children.
