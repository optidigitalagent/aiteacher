Read CLAUDE.md first.

TASK:
Design the foundational architecture specification for the new AI Teacher Brain system used in paid lessons.

This is NOT a quick fix.
This is NOT another prompt patch.
This is a foundational architecture phase.

You are NOT implementing runtime code yet.
You are designing the long-term teacher intelligence system that will replace the growing prompt-chaos approach.

Create:

docs/PAID_LESSON_TEACHER_BRAIN_SPEC.md

This document will become the source of truth for:

* AI lesson behavior,
* exercise execution logic,
* teacher communication rules,
* lesson progression,
* correction behavior,
* transition behavior,
* runtime boundaries,
* backend authority,
* AI limitations,
* structured actions,
* supported/unsupported exercises,
* conversation handling.

==================================================
CORE PRODUCT GOAL
=================

The AI Teacher must behave like a high-quality human English tutor conducting a real paid online lesson.

The AI must:

* stay consistent,
* remember lesson state,
* not contradict itself,
* not repeat completed work,
* not invent exercises,
* not improvise unsupported textbook tasks,
* not lose exercise position,
* not confuse exercises,
* not jump backward,
* not hallucinate hidden textbook content,
* guide the student calmly,
* correct naturally,
* keep lesson flow stable.

The system must support long-term scalable lesson intelligence.

==================================================
CRITICAL ARCHITECTURE RULE
==========================

The backend/runtime is authoritative.

The AI is NOT the lesson state machine.

The AI:

* teaches,
* explains,
* evaluates,
* guides conversation,
* proposes actions.

The backend:

* owns exercise state,
* owns progression,
* owns validation,
* owns transitions,
* owns current exercise,
* owns current item,
* owns completion state,
* owns supported exercise rules.

The AI must NEVER independently mutate lesson state.

==================================================
DOCUMENT REQUIREMENTS
=====================

The spec must contain structured sections.

Required sections:

# 1. System Philosophy

Explain:

* what the AI Teacher is,
* what it is NOT,
* why backend authority matters,
* why deterministic exercise runtime exists,
* why textbook fidelity matters.

# 2. Teacher Personality + Communication Model

Define:

* tone,
* pacing,
* correction style,
* encouragement,
* clarity,
* repetition handling,
* confusion handling,
* side-question handling,
* exercise transition language.

Include:
GOOD vs BAD examples.

# 3. Exercise Taxonomy

Define supported exercise categories:

* matching
* fill_gap
* grammar_transform
* discussion
* speaking_prompt
* roleplay
* reconstruction
* etc.

For each:

* whether deterministic,
* whether validator-based,
* whether cursor-based,
* whether soft-feedback,
* whether re-anchor allowed,
* whether skip-safe.

# 4. Unsupported Exercise Policy

Define unsupported tasks:

* listening/audio,
* photo/image,
* hidden-context,
* textbook references,
* external reading,
* essay writing,
* email writing,
* pairwork requiring unseen partner content,
* exercises depending on previous hidden answers.

Define:

* hard skip rules,
* no adaptation rules,
* no improvisation rules.

VERY IMPORTANT:
The AI must NEVER rewrite unsupported exercises into “personal speaking practice”.

# 5. Exercise Lifecycle

Define:

* initialize exercise,
* present item,
* correction flow,
* retry flow,
* completion,
* transition barrier,
* next exercise,
* skip handling,
* cleanup rules,
* cursor ownership.

Explain:

* what causes state corruption,
* how to avoid re-anchor chaos,
* why completed exercises must hard-close.

# 6. Student Interaction States

Define behavior for:

* student confusion,
* "I don't understand",
* partial answer,
* wrong answer,
* silence,
* repeated mistakes,
* side questions,
* off-topic attempt,
* "we already did this",
* "next exercise",
* contradictory answers.

Include examples.

# 7. Conversation Memory Rules

Define:

* what AI should remember,
* what backend should remember,
* what must never be inferred,
* what must never be hallucinated.

# 8. Structured Action Contract

Design the future structured response schema.

Example:

{
"teacher_text": "...",
"action": "continue_current_item",
"exerciseNum": 3,
"itemIndex": 1,
"confidence": 0.93,
"reason": "student_answer_correct"
}

Define:

* allowed actions,
* forbidden actions,
* backend validation responsibility.

# 9. Runtime Boundaries

Define:

* AI responsibilities,
* backend responsibilities,
* frontend responsibilities.

Explain:

* why frontend must remain display-only,
* why backend must validate AI actions.

# 10. Anti-Chaos Rules

Explicitly define forbidden AI behaviors:

* exercise mixing,
* invented vocabulary tasks,
* hidden listening reconstruction,
* changing textbook meaning,
* backward jumps,
* duplicate exercise reopening,
* fake corrections,
* fake understanding,
* pretending unsupported exercises are solvable.

# 11. Few-Shot Example Strategy

Define:

* good examples,
* bad examples,
* correction examples,
* skip examples,
* transition examples,
* speaking examples,
* matching examples.

Explain how the future Teacher Brain should consume examples.

# 12. Long-Term Architecture Roadmap

Design future architecture:

* teacher-brain module,
* structured actions,
* memory layer,
* exercise policies,
* retrieval/examples,
* multi-agent possibility,
* lesson orchestration layer,
* runtime validator layer.

==================================================
IMPORTANT RULES
===============

1. This is an ARCHITECTURE SPEC, not implementation code.
2. Do NOT rewrite unrelated runtime systems.
3. Do NOT implement frontend redesign.
4. Do NOT implement multi-agent runtime yet.
5. Focus on clarity, boundaries, scalability, and correctness.
6. This document should feel like a senior AI systems architect designed it.
7. Include concrete examples throughout the document.
8. Use explicit anti-hallucination reasoning.
9. Explicitly reference failures discovered during current runtime debugging.
10. Preserve backend-first authority.

==================================================
OUTPUT
======

Create:
docs/PAID_LESSON_TEACHER_BRAIN_SPEC.md

At the end provide:

1. architecture summary,
2. major system principles,
3. future implementation phases,
4. migration strategy from current prompt-builder system.
