# Phase 14A — Kids Tutor Production Gap Audit Report

**Date:** 2026-06-01
**Auditor:** Claude Sonnet 4.6 (automated static + runtime audit)
**Scope:** Kids Brain v1 production readiness — can this replace a real online English tutor?

---

## Validation Results

```
TypeScript (npx tsc --noEmit):  0 errors
Tests (npx vitest run src/kids-brain):  686/686 passed  (25 test files)
```

---

## A. Curriculum Completeness

### What is authored

| Layer | Status |
|---|---|
| Course map (12 units metadata) | ✅ authored |
| Unit 1 lesson items (greetings, colours, numbers) | ✅ authored |
| Lesson 2 exercise sequence (Colours, 10 exercises) | ✅ authored |
| Lesson 1 exercise sequence (Greetings) | ❌ missing |
| Lesson 3 exercise sequence (Numbers) | ❌ missing |
| Units 2–12 content | ❌ pending (11/12 units status=`pending`) |

### Coverage

- Units with full content: **1/12 (8.3%)**
- Lessons with exercise sequences: **1/36 (2.8%)**
- Runtime active lesson: `kb1-u01-l02` (Colours) only — hardcoded
- The 20-call prototype cap means at most ~10 teacher turns per session

### Risk: **HIGH**

The system can only run one lesson. A child who completes it has no next step.

---

## B. Teacher Quality

**Score: 6/10**

### Evidence — strengths

| Behaviour | Implementation |
|---|---|
| Never says "wrong" | `assertNoShaming()` verified in 16-scenario QA simulation |
| Praise rotation | `recentPraisePhrases` circular buffer (last 3), template bank |
| Scaffolding | phoneme-first hint (`firstPhoneme` field), retry escalation ladder per exercise |
| Hesitation handling | `CORRECT_HESITANT` classification path, reduced pressure response |
| Recovery handling | `recovery-state-updater.ts`, `recovery-response-builder.ts` |
| Refusal handling | Recovery state machine, not immediate safety close |
| L1 (Cyrillic/Ukrainian) | Detected and redirected — English-first policy |
| Silence | `processKidsBrainSilence()` — warm redirect, no frustration |

### Evidence — gaps

| Gap | Impact |
|---|---|
| Child's name hardcoded to `'friend'` | Impersonal; real tutors use the child's name every turn |
| No dynamic emotional reading beyond text | Cannot detect distress tone, only content |
| Praise templates feel template-driven | A real tutor varies with humour, observation |
| No boredom escalation to different activity type mid-lesson | Child stuck in same pattern |
| Age band hardcoded to `AgeBand.SIX_SEVEN` | No adaptation for older children in Unit 1 range |

---

## C. Pedagogy

**Score: 7/10**

### Supported

- Gradual release: `LISTEN_AND_REPEAT → FORCED_CHOICE_AUDIO → REVIEW_PRODUCTION`
- Modeling: "Listen — {target}! Now you!" scripted structure
- Guided practice: forced choice, retry escalation
- Review: `review_scheduler.ts`, `reviewLinks` in curriculum
- Consolidation: CONSOLIDATION phase in lesson structure
- Lesson close: scripted warm close

### Not yet implemented

| Gap | Impact |
|---|---|
| Phonics activities | `/s/ sound` authored in curriculum, no phonics runtime path |
| Cross-session review | `review_due_at` in mastery records, but not read on session start |
| Free production | `FREE_PRODUCTION` student action type exists, no teacher prompt wired |
| Inter-lesson progression | No mechanism to advance to Lesson 3 after mastering Lesson 2 |

---

## D. Voice Learning Quality

**Score: 5/10**

### Strengths

- STT normalizer: punctuation stripping, Cyrillic detection, case normalization
- Phonetic matcher: levenshtein-based fuzzy matching for child pronunciation variants
- Child phoneme hints: `firstPhoneme` in curriculum (`'b-b-b'`, `'p-p-p'`) — scaffolds correctly
- Accepted answers include child variants: `"perple"→purple`, `"yello"→yellow`, `"free"→three`
- Silence processor: graceful silence handling, warm recovery
- Input quality: `input-quality.ts` scores the voice input

### Critical gap

**Kids STT is not real.** The WS handler receives `text` (a string from the client), builds a fake `STTResult` from it, and runs it through the pipeline. There is no actual microphone → child voice → STT pipeline for kids mode. The frontend sends whatever text the user typed. A real 5-year-old speaking into a microphone would need:
- Deepgram or AssemblyAI with a child-speech model
- Separate STT language settings for en-US (not en-UA default)
- Confidence threshold tuned for child pronunciation
- No real-time audio streaming path exists for kids

---

## E. Runtime Reliability

**Score: 7/10**

| Component | Status |
|---|---|
| Redis persistence (CAS autosave) | ✅ |
| Map serialization (itemStates) | ✅ custom replacer/reviver |
| Reconnect guard (Phase 11K) | ✅ `reconnectSession()` before cold start |
| State corruption protection | ✅ immutable SessionMemory (copy-on-write) |
| Exercise progression correctness | ✅ 29 dedicated tests |
| Session ownership enforcement | ✅ `userId` check in `reconnectSession()` |

### Gaps

| Gap | Impact |
|---|---|
| Redis TTL = 30 min | Session lost if child takes a snack break; no configurable extension |
| `endKidsBrainSession()` imported but never called | Closing the lesson does not run the orchestrated close path |
| No Postgres mastery write on session close | `saveSessionSummary()` and `saveMasteryRecord()` never called from `lesson-ws.ts` |
| Safety event store not wired | `postgres-safety-event.store.ts` exists but never invoked |

---

## F. QA Maturity

**Score: 7/10**

| Layer | Coverage |
|---|---|
| Unit tests | ✅ perception, classification, state engine, curriculum, adapters, infrastructure |
| Behavioral QA | ✅ 16-scenario simulation (silence, L1, refusal, shutdown, fast guessing, etc.) |
| Phase regression tests | ✅ phases 8–13F each have dedicated test files |
| Integration tests | ⚠️ runtime tested with mock STT/Redis — no real service calls |
| E2E tests | ❌ none (no Playwright for kids flow) |
| Load/stress tests | ❌ none |
| Child audio input tests | ❌ none (no real STT path to test) |
| QA simulation vocabulary | ⚠️ still uses prototype animals (`cat, dog, lion, monkey`), not KB1 curriculum words |

---

## G. Analytics

**Score: 2/10**

### Schema — designed but not wired

| Table | Schema | Written in production |
|---|---|---|
| `kids_brain_child_profiles` | ✅ | ❌ never saved from lesson-ws.ts |
| `kids_brain_mastery_records` | ✅ | ❌ never saved from lesson-ws.ts |
| `kids_brain_session_summaries` | ✅ | ❌ never saved from lesson-ws.ts |
| `kids_sessions` (status) | ✅ | ✅ updated to 'completed' |

### Result

A parent cannot answer any of the audit questions:
- What was learned? Unknown.
- What was mastered? Unknown.
- Where did the child struggle? Unknown.
- Lesson completion rate? Unknown.
- Vocabulary mastery? Unknown.

The `lesson_end` packet sends `vocabularyCount = itemsMastered.length`, but `itemsMastered` is only in-memory Redis state that is deleted after session close.

### No parent dashboard exists

There is no `/kids/report`, `/kids/progress`, or parent-facing page. `KidsPrototypePage.tsx` is the only kids route.

---

## H. Frontend Readiness

**Score: 2/10**

### Current state

The kids session navigates to `/classroom/${sessionId}` with `{ mode: 'mentium_kids' }`. This is the **adult lesson classroom** (`LessonRoom` / paid lesson UI). There is no kids-specific visual layer.

| Feature | Status |
|---|---|
| Kids-appropriate visual design | ❌ adult UI |
| Colour flashcard display | ❌ not implemented |
| Visual exercise prompts | ❌ not implemented |
| Progress visibility (stars/stickers) | ❌ not implemented |
| Child-friendly completion celebration | ❌ not implemented |
| Reconnect UX for kids | ❌ adult flow only |
| Parent-facing summary after lesson | ❌ not implemented |
| Exercise awareness display | ❌ the child sees only teacher text |

### Page badge

`KidsPrototypePage.tsx` shows `"Experimental · Prototype"` — correct self-labelling, but the UX is not close to production quality for a 5–8 year old learner.

---

## I. Operations

**Score: 4/10**

| Feature | Status |
|---|---|
| Feature flag (`USE_KIDS_BRAIN_V1`) | ✅ |
| Cost cap (KIDS_MAX_LLM_CALLS=20) | ✅ |
| Duration cap (15 min) | ✅ |
| Runtime log events | ✅ structured log events in pipeline |
| Langfuse / OTel tracing for kids | ❌ not wired (Phase 17 is adult only) |
| Kids-specific metrics endpoint | ❌ none |
| Alert on session error | ❌ only `console.error` |
| Abuse detection beyond call cap | ❌ no rate limiting at API layer for kids start |
| Incident playbook for kids | ❌ none |
| Deployment confidence | ⚠️ `USE_KIDS_BRAIN_V1` env flag required; default is old prototype |

---

## J. Production Blockers

### Critical blockers

| # | Blocker | Impact | Effort | Recommended Phase |
|---|---|---|---|---|
| C1 | Analytics not persisted — `saveSessionSummary`, `saveMasteryRecord` never called | Parent cannot track child progress; business cannot demonstrate learning outcomes | 0.5 days | 14B |
| C2 | No kids-specific frontend — adult classroom used | 5-year-old cannot navigate adult lesson UI; no visual learning aids | 5–8 days | 14C |
| C3 | Only 1 lesson runs — all other lessons pending | Child cannot progress beyond Colours lesson | Ongoing curriculum work | 14E |
| C4 | Child's name hardcoded to `'friend'` | Depersonalised experience; key tutor quality missing | 1 day | 14D |
| C5 | No real child STT — kids voice path is text input only | Real child speaking into microphone not supported | 3–5 days + provider integration | 14H |

### High priority blockers

| # | Blocker | Impact | Effort |
|---|---|---|---|
| H1 | `KIDS_MAX_LLM_CALLS=20` prototype cap — too low for real 15-min lesson | Session ends after ~10 exchanges | 0.5 days |
| H2 | No multi-lesson progression | No continuity across sessions | 1–2 days |
| H3 | Phonics exercises not in runtime | Key curriculum component missing | 1–2 days |
| H4 | No parent report or post-session summary page | Parents cannot see what the child learned | 2–3 days |
| H5 | Redis TTL 30 min — too short for kids with breaks | Session lost during snack/bathroom break | 0.5 days |

### Medium blockers

| # | Blocker |
|---|---|
| M1 | Lesson 1 (Greetings) and Lesson 3 (Numbers) have no exercise sequences |
| M2 | QA simulation still uses prototype animals, not KB1 curriculum words |
| M3 | `first_name_encrypted` stored as plaintext UTF-8 (AES-256-GCM TODO never done) |
| M4 | Safety event store exists but never wired in lesson-ws.ts |
| M5 | No loading/reconnect UX for kids specifically |

---

## K. Production Readiness Score

```
Curriculum .......... 3/10   (1 lesson authored; 11/12 units pending)
Teacher Quality ..... 6/10   (solid model; personalization + real emotion gaps)
Pedagogy ............ 7/10   (correct structure; phonics + inter-session review missing)
Voice Learning ...... 5/10   (good data model; no real child STT pipeline)
Reliability ......... 7/10   (Redis solid; mastery not persisted to Postgres)
QA .................. 7/10   (686 tests; no E2E; no real audio tests)
Analytics ........... 2/10   (schema complete; nothing written in production)
Frontend ............ 2/10   (adult classroom; no kids UX)
Operations .......... 4/10   (basic caps; no structured observability)
─────────────────────────────────────────────────────────────────────
Overall ............. 43/100
```

---

## L. Roadmap

Ordered by business value. The question is: "Can this replace a real tutor?"

---

### Phase 14B — Analytics Persistence (1 day)

**Business value:** Without this, the system cannot prove it teaches anything.

Wire `endKidsBrainSession()` into the normal WS close path. Call `saveSessionSummary()` with real mastery data from `result.updatedSessionMemory`. Call `saveMasteryRecord()` for each word in `itemsMastered`. Do not delete Redis until Postgres write succeeds.

---

### Phase 14C — Kids Classroom Frontend MVP (5–8 days)

**Business value:** Parents will not pay for their child to use an adult lesson UI.

New route: `/kids/lesson/:sessionId`. Colour flashcard display sized for children. Large text. Star/sticker celebration on completion. No adult chrome (no billing timer, no section progress). Mobile-first, portrait orientation.

---

### Phase 14D — Child Profile Onboarding (1–2 days)

**Business value:** A real tutor uses the child's name. This is table stakes for trust.

Pre-lesson setup: collect child's first name and age. Store in `kids_brain_child_profiles`. Pass `childFirstName` into `KidsBrainSessionStartInput`. Replace `'friend'` with the real name in all teacher responses.

---

### Phase 14E — Exercise Content Expansion (ongoing, 2 days per lesson)

**Business value:** The product only runs one lesson. A real tutor teaches all of Unit 1 before beta.

Author exercise sequences for:
1. Lesson 1 (Greetings) — 8 exercises
2. Lesson 3 (Numbers 1–10) — 12 exercises
3. Unit 2 (My school) — classroom objects vocabulary

---

### Phase 14F — Multi-Lesson Progression (1–2 days)

**Business value:** A child who comes back tomorrow should continue, not start over.

Read `sessionsCompleted` and `items_mastered_ids` from Postgres on session start. Auto-select the next unmastered lesson. Store current lesson progression in `kids_brain_child_profiles`.

---

### Phase 14G — Parent Report (2–3 days)

**Business value:** Parents decide whether to subscribe based on what they see after lesson 1.

Post-session page: vocabulary list with mastery stars. Session duration. Words to practise. Next lesson preview. Email summary optional.

---

### Phase 14H — Real Child STT (3–5 days + provider integration)

**Business value:** The voice UX does not work for a real child without real STT.

Deepgram (or AssemblyAI) integration in kids mode. Child-specific settings: `en-US`, lower confidence threshold, phonetic tolerance. Real-time audio streaming from browser microphone through the kids WS path.

---

### Phase 14I — Raise Prototype Caps (0.5 days)

Remove or raise `KIDS_MAX_LLM_CALLS=20`. Set `KIDS_MAX_DURATION_MS` to 20 minutes. Extend Redis TTL to 2 hours for kids sessions. These are prototype settings that block real usage.

---

## Final Verdict

**The Kids Brain v1 runtime is a technically solid foundation, not a production product.**

The internal pipeline — Perception → Classification → State Engine → Learning Engine → Teacher Response — is well-designed, well-tested (686/686 passing), and correctly implements the pedagogical model. The exercise bridge works. Reconnect works. The curriculum schema is clean.

What is missing is everything a parent, a child, and a real-world deployment actually require:

1. A child-facing visual UI (they see an adult lesson UI today)
2. Vocabulary mastery tracked to Postgres (schema is there; writes are not)
3. More than one lesson (1 of 36 lessons has exercises)
4. The child's real name (hardcoded to 'friend')
5. Real child voice input (text-only STT pipeline)

**Estimated time to minimum viable production (one full unit, real STT, kids UI, analytics, parent report):**

~4–6 weeks of focused engineering.

**Recommended next phase:** Phase 14B (Analytics Persistence) — 1 day, highest business value per effort.

---

*Audit performed on codebase state as of 2026-06-01. No code was modified.*
