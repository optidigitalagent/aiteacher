# Kids Mode Product Vision

## Status

Kids Brain V1 is complete.

Acceptance:
- 28/28 COMPLETE
- Tag: kids-brain-v1-complete

This document defines the next major product goal.

---

# Vision

Kids Mode must become a first-class experience inside Mentium.

A user should not need to know the `/kids` URL.

Kids Mode must be discoverable from the authenticated main platform and provide a complete onboarding experience before the first lesson.

---

# Core User Journey

User Login
→ Main Platform
→ Kids Mode Button
→ Child Onboarding
→ Teacher Selection
→ Interest Selection
→ Child Profile Created
→ Kids Lesson
→ Ongoing Personalized Learning

---

# Authentication Rules

Authentication is mandatory.

Unauthenticated users must NOT:

- access Kids lessons
- create child profiles
- consume STT resources
- consume TTS resources
- start AI sessions
- access paid resources

Kids Mode must follow the same backend authority and security rules as the rest of the platform.

---

# Child Profile

Each child profile belongs to exactly one authenticated account.

Minimum profile fields:

- childName
- age
- teacherPreference
- interests

Optional future fields:

- avatar
- learning goals
- proficiency level
- favorite topics
- mastery summary

---

# Teacher Selection

The user may choose a preferred teacher persona.

Examples:

- Emma
- Ben
- Lily
- Alex

Teacher selection affects:

- voice style
- personality
- encouragement style

Teacher selection does NOT affect:

- curriculum
- correctness
- progression
- lesson structure

---

# Interest Personalization

## Purpose

Interests make lessons feel personal and engaging.

Interests are NOT a curriculum replacement.

Kid's Box remains the authoritative curriculum.

---

## Example Interests

- Roblox
- Minecraft
- Brawl Stars
- Pokemon
- Football
- Animals
- Dinosaurs
- Space
- Cars
- Superheroes
- Princesses
- Drawing

---

# Critical Rule

Curriculum remains authoritative.

Interests are only a personalization layer.

---

## Allowed

Interests may influence:

- warm-up questions
- examples
- encouragement
- recovery prompts
- imagination prompts
- optional contextual references

Example:

Target word: blue

Teacher may say:

"Can you find something blue in Roblox?"

or

"Imagine a blue Minecraft block."

---

## Forbidden

Interests may NOT:

- replace Kid's Box content
- replace exercises
- replace target words
- alter mastery decisions
- alter progression
- skip curriculum
- create separate game lessons
- override exercise correctness

Bad example:

"Today we learn Roblox instead of Kid's Box."

This is forbidden.

---

# Safety Rules

Personalization must remain child-safe.

Forbidden:

- unsafe online interactions
- user-generated content discussions
- game chat roleplay
- violent roleplay
- gambling references
- mature content

Teacher may reference interests only in a safe educational context.

---

# Backend Authority

Backend remains authoritative.

Frontend may collect:

- teacher preference
- interests
- onboarding information

Backend validates:

- ownership
- profile updates
- session access
- personalization payloads

Frontend must never become the source of truth.

---

# Kids Brain Integration

At lesson start:

Kids Brain receives:

- child name
- age
- teacher preference
- interests

Kids Brain may use interests only when generating:

- examples
- encouragement
- contextual references

Kids Brain may not modify:

- target words
- exercise correctness
- curriculum sequencing
- mastery logic

---

# No Regression Rules

The following guarantees from Kids Brain V1 must remain intact:

- authentication
- billing protections
- session ownership
- Redis TTL rules
- curriculum correctness
- escalation ladder
- STT stability
- TTS stability
- deployment safety

---

# Success Criteria

A new user can:

1. Log in
2. Click Kids Mode
3. Create a child profile
4. Select a teacher
5. Select interests
6. Start a lesson

without knowing the `/kids` URL.

The lesson remains Kid's Box-driven.

Interests make lessons feel personal without changing the curriculum.

Adult flows remain unaffected.

No security, billing, ownership, or cost-control regressions occur.