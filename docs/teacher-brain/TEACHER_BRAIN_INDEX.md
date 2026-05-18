# Teacher Brain Knowledge Vault — Root Index

This vault externalizes the cognitive architecture of the AI Teacher runtime.
It is NOT a chatbot documentation. It is a pedagogical operating system specification.

---

## Purpose

The Teacher Brain is a **verbal-only** layer inside a **backend-authoritative** educational runtime.
It does not control progression. It does not decide correctness. It verbalizes engine decisions.

This vault captures:
- What the AI Teacher is allowed to do
- How it must behave under each exercise type
- How it must interpret noisy voice input
- How it must retry without looping
- What production failures have occurred and why

---

## Core Doctrine

| Note | Purpose |
|------|---------|
| [[AI_TEACHER_DOCTRINE]] | Root identity, authority hierarchy, pedagogical philosophy |
| [[RUNTIME_AUTHORITY_MAP]] | Who owns what: Engine vs Validation vs Teacher Brain |
| [[VOICE_RUNTIME_ARCHITECTURE]] | Voice pipeline: STT → transcript → validation → TTS |

---

## Exercise Protocols

| Note | Exercise Type |
|------|--------------|
| [[SOFT_SPEAKING_PROTOCOL]] | Discussion, personal_fill, pair_speaking, guided_speaking |
| [[DISCUSSION_PROTOCOL]] | Free discussion exercises — no single correct answer |
| [[GRAMMAR_FILL_PROTOCOL]] | Deterministic fill-in exercises — correction ladder A/B/C/D |

---

## Voice & Pedagogy

| Note | Topic |
|------|-------|
| [[VOICE_PEDAGOGY_DOCTRINE]] | How teacher must handle imperfect voice input pedagogically |
| [[STT_NOISE_PATTERNS]] | Real STT confusion patterns with examples |
| [[SELF_CORRECTION_PATTERNS]] | How to detect and interpret student self-corrections |

---

## Retry & Recovery

| Note | Topic |
|------|-------|
| [[PEDAGOGICAL_RETRY_POLICY]] | Retry philosophy, max attempts, anti-loop safeguards |

---

## Student Psychology

| Note | Topic |
|------|-------|
| [[STUDENT_FRICTION_PATTERNS]] | When students stall, deflect, or give minimal answers |

---

## QA & Failures

| Note | Topic |
|------|-------|
| [[SECTION_1_2_QA_LEARNINGS]] | Bugs discovered in section 1.2 runtime testing |
| [[KNOWN_RUNTIME_FAILURES]] | Failure modes with root causes and prevention rules |

---

## Reading Order for New Contributors

1. [[AI_TEACHER_DOCTRINE]] — understand what Teacher Brain is
2. [[RUNTIME_AUTHORITY_MAP]] — understand what Teacher Brain cannot touch
3. [[SOFT_SPEAKING_PROTOCOL]] — the most complex exercise type
4. [[PEDAGOGICAL_RETRY_POLICY]] — avoid building retry loops
5. [[STT_NOISE_PATTERNS]] — voice input is not clean text
6. [[KNOWN_RUNTIME_FAILURES]] — do not repeat past failures
