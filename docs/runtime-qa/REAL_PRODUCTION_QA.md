# REAL PRODUCTION QA

## Goal

The architecture and stabilization phases are complete.

The current goal is no longer:
- building systems
- expanding architecture
- rewriting runtime

The current goal is:
- validating real production behavior
- finding runtime inconsistencies
- identifying UX friction
- identifying edge-case failures
- hardening stability

---

# QA PRIORITIES

## 1. FREE LESSON QA

Verify:
- registration flow
- lesson access
- mic lifecycle
- interrupt behavior
- transcript lifecycle
- translation flow
- reconnect behavior
- response rendering
- mobile behavior

Goal:
FREE runtime remains the reference interaction model.

---

# 2. PAID LESSON QA

Verify:
- lesson initialization
- lesson continuation
- reconnect behavior
- interrupt behavior
- exercise rendering
- reading flow
- side-question recovery
- progression visibility
- tips drawer
- translation flow
- timeout handling
- lesson completion
- mobile behavior

Goal:
PAID runtime should feel:
- stable
- responsive
- understandable
- production-ready

---

# 3. CONTINUATION QA

Verify:
- reconnect during lesson
- browser refresh during lesson
- reconnect during TTS
- reconnect during recording
- reconnect during exercise
- reconnect during timeout edge
- lesson resume correctness

Confirm:
- lesson time restores correctly
- exercise restores correctly
- progression restores correctly
- no duplicated sessions
- no duplicated billing/runtime

---

# 4. RUNTIME SAFETY QA

Stress test:
- interrupt spam
- rapid mic toggle
- repeated reconnects
- multiple tabs
- rapid send cycles
- translation spam
- side-question loops

Goal:
No:
- crashes
- duplicated AI turns
- stuck loaders
- stuck speaking states
- transcript corruption
- broken progression

---

# 5. MOBILE QA

Verify:
- exercise readability
- transcript readability
- buttons
- overlays
- tips drawer
- progression rendering
- layout spacing
- no horizontal overflow

---

# REQUIRED QA EVIDENCE

Collect:
- screenshots
- browser console logs
- Railway logs
- reproduction steps
- videos if possible

Store new findings inside:
- docs/runtime-qa/*
- new QA notes if needed

---

# FIX STRATEGY

After QA:
- use small targeted patches
- avoid giant rewrites
- avoid architecture expansion

Prefer:
- hotfixes
- runtime guards
- UX stabilization
- lifecycle fixes

---

# IMPORTANT RULE

The platform is now in:
PRODUCTION STABILIZATION MODE.

Do NOT restart architecture work unless a critical flaw is discovered.