# Teacher Brain Knowledge Vault — Root Index

This vault externalizes the cognitive architecture of the AI Teacher runtime.
It is NOT chatbot documentation. It is a pedagogical operating system specification.

---

## Purpose

The Teacher Brain is a **verbal-only** layer inside a **backend-authoritative** educational runtime.
It does not control progression. It does not decide correctness. It verbalizes engine decisions.

This vault captures:
- What the AI Teacher is allowed to do
- How it must behave under each exercise type
- How it must interpret noisy voice input
- How it must retry without looping
- How it must synchronize with the frontend
- What a great lesson looks like in practice
- What production failures have occurred and why

---

## Core Doctrine

| Note | Purpose |
|------|---------|
| [[AI_TEACHER_DOCTRINE]] | Root identity, authority hierarchy, pedagogical philosophy |
| [[RUNTIME_AUTHORITY_MAP]] | Who owns what: Engine vs Validation vs Teacher Brain |
| [[VOICE_RUNTIME_ARCHITECTURE]] | Voice pipeline: STT → transcript → validation → TTS |

---

## Teacher Book Pedagogy

| Note | Purpose |
|------|---------|
| [[TEACHER_BOOK_PEDAGOGICAL_ANALYSIS]] | 15 formal patterns extracted from Focus 2 Teacher's Book |

---

## Exercise Protocols (Core)

| Note | Exercise Type |
|------|--------------|
| [[SOFT_SPEAKING_PROTOCOL]] | Discussion, personal_fill, pair_speaking, guided_speaking |
| [[DISCUSSION_PROTOCOL]] | Free discussion exercises — no single correct answer |
| [[GRAMMAR_FILL_PROTOCOL]] | Deterministic fill-in exercises — correction ladder A/B/C/D |

---

## Exercise Protocol Registry (Extended)

| Note | Exercise Type |
|------|--------------|
| [[MULTIPLE_CHOICE_PROTOCOL]] | Options A/B/C/D — frontend renders choices, teacher references by letter |
| [[MATCHING_PROTOCOL]] | Word↔definition, sentence halves — item-by-item matching |
| [[READING_PROTOCOL]] | Two-pass reading: gist → detail → personalisation |
| [[SUBJECT_OBJECT_QUESTION_PROTOCOL]] | WH-question formation — most misunderstood exercise type |
| [[DIALOGUE_PROTOCOL]] | Role-play and scripted conversation — teacher takes one role |
| [[DEMONSTRATION_PROTOCOL]] | Doctrine for how ALL exercises must be demonstrated before student production |

---

## Voice & Pedagogy

| Note | Topic |
|------|-------|
| [[VOICE_PEDAGOGY_DOCTRINE]] | How teacher must handle imperfect voice input pedagogically |
| [[STT_NOISE_PATTERNS]] | Real STT confusion patterns with examples |
| [[SELF_CORRECTION_PATTERNS]] | How to detect and interpret student self-corrections |

---

## Grammar Teaching

| Note | Topic |
|------|-------|
| [[GRAMMAR_TEACHING_OVERVIEW]] | Grammar teaching methodology — guided discovery, not direct instruction |

---

## Retry & Recovery

| Note | Topic |
|------|-------|
| [[PEDAGOGICAL_RETRY_POLICY]] | Retry philosophy, max attempts, anti-loop safeguards |

---

## Student State System

| Note | State |
|------|-------|
| [[STUDENT_STATE_OVERVIEW]] | State machine overview — all states, detection signals, pacing guide |
| [[CONFUSION_STATE]] | Format or concept confusion — simplify, one example, one concept |
| [[IMPATIENT_STATE]] | Student wants speed — compress speech, keep rigor |
| [[SELF_CORRECTION_STATE]] | Student fixes their own error — reward, extract final form |
| [[PRONUNCIATION_STRUGGLE_STATE]] | Correct grammar, wrong phonology — accept content, isolate pronunciation |
| [[FRUSTRATION_STATE]] | Multiple failures, withdrawal — reduce pressure, scaffold, TURN D early |
| [[HIGH_CONFIDENCE_STATE]] | Fast correct answers — brisk pace, minimal affirmation |
| [[LOW_CONFIDENCE_STATE]] | Hesitation, self-deprecation — warm scaffolding, celebrate small wins |

---

## Student Psychology

| Note | Topic |
|------|-------|
| [[STUDENT_FRICTION_PATTERNS]] | When students stall, deflect, or give minimal answers |

---

## Frontend Synchronization

| Note | Topic |
|------|-------|
| [[FRONTEND_SYNC_DOCTRINE]] | Teacher must know what frontend displays — core sync rules |
| [[EXERCISE_RENDER_CONTRACT]] | Per-exercise-type rendering specs and teacher speech rules |
| [[TEACHER_CURSOR_SYNC]] | How teacher cursor stays in sync with Exercise Engine |

---

## Loop Prevention & Transitions

| Note | Topic |
|------|-------|
| [[LOOP_PREVENTION_DOCTRINE]] | What loops are, how to detect them, how to exit them |
| [[RETRY_ESCALATION_POLICY]] | Every retry turn must contain NEW information — escalation rules |
| [[TRANSITION_PACING_POLICY]] | Item, exercise, section, lesson transitions — pacing rules |

---

## QA & Failures

| Note | Topic |
|------|-------|
| [[SECTION_1_2_QA_LEARNINGS]] | Bugs discovered in section 1.2 runtime testing |
| [[KNOWN_RUNTIME_FAILURES]] | Failure modes with root causes and prevention rules |

---

## Future Architecture

| Note | Topic |
|------|-------|
| [[FUTURE_ARCHITECTURE_NOTES]] | Current state, what should evolve, what must NOT change |
| [[FUTURE_SYSTEMS_ANALYSIS]] | 7 future systems evaluated: usefulness, complexity, cost, priority |
| [[FORMAL_SPOKEN_INTERPRETATION_RUNTIME]] | Phase B: raw transcript → formal interpretation pipeline |

---

## Project Maintenance

| Note | Topic |
|------|-------|
| [[PROJECT_CLEANUP_RECOMMENDATIONS]] | Obsolete files, duplicates, stale docs — recommendations only, no auto-delete |

---

## Golden Lesson Walkthroughs

> Behavioral ground truth for future runtime design. Realistic examples, not marketing dialogue.

| Note | Scenario |
|------|---------|
| [[LESSON_WALKTHROUGH_BEGINNER]] | Beginner student — Present Simple, low confidence, self-correction |
| [[LESSON_WALKTHROUGH_MID_CONFUSION]] | Subject/object question confusion — format vs. content errors |
| [[LESSON_WALKTHROUGH_PRONUNCIATION_STRUGGLE]] | Correct grammar, pronunciation issues — accept content first |
| [[LESSON_WALKTHROUGH_FAST_STUDENT]] | Impatient high-confidence student — compressed pace, state verb trap |
| [[LESSON_WALKTHROUGH_FRONTEND_SYNC]] | Multiple choice — exact frontend state at every moment |

---

## Reading Order for New Contributors

1. [[AI_TEACHER_DOCTRINE]] — understand what Teacher Brain is
2. [[RUNTIME_AUTHORITY_MAP]] — understand what Teacher Brain cannot touch
3. [[TEACHER_BOOK_PEDAGOGICAL_ANALYSIS]] — understand the pedagogical foundation
4. [[DEMONSTRATION_PROTOCOL]] — how exercises must be demonstrated
5. [[STUDENT_STATE_OVERVIEW]] — how teacher adapts to student state
6. [[FRONTEND_SYNC_DOCTRINE]] — how teacher stays in sync with screen
7. [[LOOP_PREVENTION_DOCTRINE]] — how to prevent the most common failure
8. [[LESSON_WALKTHROUGH_BEGINNER]] — see everything in action
9. [[SOFT_SPEAKING_PROTOCOL]] — the most complex exercise type
10. [[FORMAL_SPOKEN_INTERPRETATION_RUNTIME]] — how voice answers are interpreted
11. [[PEDAGOGICAL_RETRY_POLICY]] — avoid building retry loops
12. [[STT_NOISE_PATTERNS]] — voice input is not clean text
13. [[KNOWN_RUNTIME_FAILURES]] — do not repeat past failures
