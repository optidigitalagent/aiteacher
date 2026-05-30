# Mentium Kids Brain v1 — Phase 8.7: Real Child Readiness Audit Report

**Date:** 2026-05-30  
**Auditor:** Phase 8.7 Automated Audit  
**Audit scope:** Supervised real-child prototype, animal vocabulary only (cat, dog, lion, monkey, elephant, tiger)  
**Commands run:**
- `cd backend && npx tsc --noEmit` → **0 errors**
- `cd backend && npx vitest run src/kids-brain` → **338 passed, 0 failed** (10 test files)

---

## 1. Executive Summary

The Mentium Kids Brain v1 backend pipeline is architecturally sound and well-tested in isolation. All 338 unit and integration tests pass. TypeScript compiles clean. Phase 8.6 successfully patched the critical B2 classification break, restoring deterministic correct-answer detection.

However, the production WebSocket wiring (`lesson-ws.ts`) has two critical gaps that make the system incapable of actual teaching: `lessonTargetWords` is hard-coded as an empty array `[]`, and `targetWord` is always `null` in per-turn processing. This renders the classification engine's deterministic word-matching path permanently unreachable in production, and leaves the progression engine with no items to work through.

Additionally, the frontend receives adult-lesson message formats (`ai_text`, `phase: DIAGNOSTIC`). There is no children's UI — no image display, no forced-choice visuals, no character animation. A 6–7 year old in a real prototype session would receive audio-only responses within the adult lesson interface.

**The system is behaviorally ready in theory. It is not wired for actual use.**

---

## 2. Readiness Score: 28 / 100

| Dimension | Score | Notes |
|---|---|---|
| Backend pipeline architecture | 90 | Complete, well-structured, spec-compliant |
| Teacher behavior (when vocabulary is provided) | 78 | No shaming, recovery works, vocabulary guard active |
| Recovery logic | 72 | B2 fixed; B4 partial; praise rotation inoperative |
| Safety | 80 | Safety classifier, vocab guard, no LLM escalation |
| Progression stability | 20 | Won't function in production — no target words |
| Session flow / lifecycle | 55 | Session start/end/Redis works; no activity loop |
| Production WS wiring | 12 | lessonTargetWords empty, targetWord null |
| Frontend rendering | 8 | Adult UI only; no visual kids elements |
| STT for children | 40 | Adapter exists, but provider mismatch likely |
| Test coverage | 52 | 338 unit tests pass; vocab-guard test missing; no WS integration test |

**Overall: 28 / 100**

---

## 3. Verdict

> **NOT READY FOR REAL-CHILD PROTOTYPE**

Two production wiring gaps alone make real teaching impossible. Before any child interaction, both must be resolved.

---

## 4. Top 10 Risks

| # | Risk | Severity | Category |
|---|---|---|---|
| R1 | `lessonTargetWords: []` in lesson-ws.ts — classification engine receives no vocabulary; every correct child answer falls to timeout fallback | CRITICAL | Production wiring |
| R2 | `targetWord: null` in every per-turn call — deterministic classifier skips all exact-match rules; correct words classified as RANDOM_NONSENSE | CRITICAL | Production wiring |
| R3 | No children's frontend UI — forced-choice visuals, image display, and character animation are absent; child receives adult text-only diagnostic interface | HIGH | Frontend |
| R4 | `currentTargetItemId` never advances from `null` — progression engine has no item context; activity engine cannot run demand ladder | HIGH | Runtime state |
| R5 | No Postgres profile lookup — every session starts cold with production_confidence_baseline defaults; no mastery continuity across sessions | MEDIUM | Persistence |
| R6 | STT provider: adult pipeline uses Deepgram (not Google Chirp v2 as Kids Brain spec requires); child-speech STT priors calibrated for Chirp may misfire | MEDIUM | STT |
| R7 | `turn-history-updater.ts` FAILURE_LABELS missing `I_DONT_KNOW` — rolling `recentFailureCount` underestimates failure streaks when child repeatedly says "I don't know" | MEDIUM | Recovery |
| R8 | `recentPraisePhrases` never updated in `session-memory-updater.ts` — praise repeat-cooldown is inoperative; short praise rotation possible | LOW | Teacher behavior |
| R9 | `ageBand: AgeBand.SIX_SEVEN` hardcoded for all children — 8–9 year olds receive stricter word limits and STT priors intended for 6–7 year olds | LOW | Profiling |
| R10 | `childFirstName: 'friend'` hardcoded — teacher cannot personalize greetings or address child by name | LOW | Personalization |

---

## 5. Critical Blockers

### Blocker 1 — `lessonTargetWords` empty in production wiring

**File:** `backend/src/ws/lesson-ws.ts`  
**Lines:** 1193 (session start), 1270 (per-turn processing)

```ts
// Line 1193 — session start
lessonTargetWords: [],

// Line 1270 — every turn
lessonTargetWords: [],
```

**Impact:** The deterministic classifier's word-match rules (Rules 12–17 in `deterministic-classifier.ts`) require `vocabularyContext.targetWord` to be set. When `lessonTargetWords` is empty, the vocabulary context is `undefined`, all match rules are skipped, and every response routes to the timeout fallback. Correct answers are misclassified as `RANDOM_NONSENSE`, triggering recovery states and wrong-answer responses for every correct child turn.

The QA test suite correctly uses `lessonTargetWords: [...ANIMAL_WORDS]`. Production does not.

**Fix required before prototype:** Populate `lessonTargetWords` with the active lesson's vocabulary (at minimum: the 6 animal words for the prototype session).

---

### Blocker 2 — `targetWord: null` in per-turn processing

**File:** `backend/src/ws/lesson-ws.ts`  
**Line:** 1268

```ts
targetWord: null,
```

**Impact:** Even if `lessonTargetWords` were populated, the per-turn call provides no `targetWord`. The `buildActivityContext` function reads `sessionMemory.currentTargetItemId` (which is also always `null`). Without a target word per turn, the classification path cannot route correct answers and the activity engine cannot select the next prompt.

**Fix required before prototype:** Set `targetWord` to the session's current active item on each turn.

---

### Blocker 3 — No children's frontend UI

**Impact:** The Kids Brain v1 WS emits:
```ts
send(ws, { type: 'ai_text', phase: 'DIAGNOSTIC', text: msg.text })
```
This is the adult lesson message format. The adult UI renders this as a text dialogue bubble in the lesson workspace — not a children's interface. A 6–7 year old would see the adult English lesson view with no images, no visual choices, no animated character, and no forced-choice activity rendering. Core activities like `forced_choice_2`, `listen_and_point`, and `repeat_after_me` have no visual counterpart in the current frontend.

**Fix required before prototype:** At minimum, a dedicated route/view that renders:
- Teacher audio + character visual
- Current target word/image
- Forced-choice buttons (2 or 4 options) when the activity requires it

---

## 6. Non-Blocking Issues

### NB1 — B4 partial: `I_DONT_KNOW` missing from `turn-history-updater.ts` FAILURE_LABELS

**File:** `backend/src/kids-brain/state-engine/turn-history-updater.ts:17`

`I_DONT_KNOW` was added to `recovery-state-updater.ts` (Phase 8.6 Patch 8.6.2) but not to `turn-history-updater.ts`. The recovery state machine uses its own `FAILURE_LABELS` set in recovery-state-updater, so recovery transitions for repeated "I don't know" answers are correctly triggered. However, `recalculateSuccessFailureCounts` in turn-history-updater uses a separate set where `I_DONT_KNOW` is absent, meaning `recentFailureCount` stored in child state underestimates failure streaks from "I don't know" turns. Effect: mild underestimation of failure depth; recovery still triggers but may fire one turn later than spec requires.

### NB2 — Praise rotation (`recentPraisePhrases`) not updated

**File:** `backend/src/kids-brain/state-engine/session-memory-updater.ts`

The `recentPraisePhrases` array is never written after session initialization. The deduplication filter in `teacher-response-engine.ts:147` always sees an empty array and always has all 18 praise variants available. Repeat cooldown (spec §10.8: 3-turn cooldown) is inoperative. With 18 variants and random selection, repeat probability per 4 turns is ~0.017%, so child-facing harm is negligible. Will surface as a broken test after B2 was fixed and praise classification is restored.

### NB3 — No Postgres profile lookup

**File:** `backend/src/ws/lesson-ws.ts:1185`  
**Comment in code:** "Phase 8 — no Postgres profile lookup yet"

All children start with production_confidence_baseline=0.30 and l1_dependency_baseline=0.20. Mastery records are not loaded. Cross-session continuity packet is empty. Each session behaves as a first session. Non-blocking for a first-ever prototype but must be addressed before multi-session testing.

### NB4 — `ageBand` hardcoded as SIX_SEVEN

For a prototype with one known age group this is acceptable. Must be parameterized before supporting 8–9 year olds.

### NB5 — `childFirstName: 'friend'` hardcoded

Teacher addresses child as "friend". Acceptable for anonymous prototype; affects warm personalization quality.

---

## 7. Required Fixes Before Real Child Test

In priority order:

**Fix 1 (CRITICAL) — Populate `lessonTargetWords` in lesson-ws.ts**

```ts
// lesson-ws.ts — both the session start block (~line 1193) and per-turn block (~line 1270)
lessonTargetWords: ['cat', 'dog', 'lion', 'monkey', 'elephant', 'tiger'],
```

This alone restores the full deterministic classification path and allows the learning engine to function.

**Fix 2 (CRITICAL) — Set `targetWord` per turn in lesson-ws.ts**

The session memory `currentTargetItemId` must be set at session start and updated as items advance. The per-turn call must pass the current target item:

```ts
targetWord: sessionMemory.currentTargetItemId ?? 'cat', // or derive from session
```

**Fix 3 (CRITICAL) — Initialize `currentTargetItemId` at session start**

```ts
// In handleKidsBrainV1LessonStart, after startKidsBrainSession()
// Set the first target word from lessonTargetWords:
kidsV1Input.lessonTargetWords[0]  // → 'cat' as starting item
```

The session memory constructor must set `currentTargetItemId` to the first word. Currently `session-bootstrap.ts` leaves it `null`.

**Fix 4 (HIGH) — Minimal kids frontend view**

At minimum for a supervised prototype:
- Dedicated `/kids` route (already exists per MEMORY.md) must render audio + current word/image display
- WS messages must use a dedicated format (not `{ type: 'ai_text', phase: 'DIAGNOSTIC' }`)
- Forced-choice rendering for 2-option activities

**Fix 5 (MEDIUM) — Add `I_DONT_KNOW` to `turn-history-updater.ts` FAILURE_LABELS**

```ts
// turn-history-updater.ts line 17-26
const FAILURE_LABELS = new Set<ClassificationLabel>([
  ...
  ClassificationLabel.I_DONT_KNOW,  // add this
]);
```

---

## 8. Recommended Fixes After First Prototype

In approximate order:

1. **Postgres profile lookup** — load child profile at session start; persist mastery at session end
2. **Praise rotation wiring** — update `recentPraisePhrases` in `session-memory-updater.ts` after each teacher turn
3. **STT provider alignment** — confirm Google Chirp v2 is the STT used in the kids audio path; if not, recalibrate child-speech priors for the actual provider
4. **Age-band parameterization** — derive `ageBand` from child profile rather than hardcoding SIX_SEVEN
5. **`childFirstName` from profile** — pass real first name at session start
6. **Vocabulary guard test suite** — implement `vocabulary-guard.test.ts` with all 6 test categories from spec §10A.3
7. **Full session integration test with WS adapter** — test the full flow from `lesson_ready` through multiple turns with real animal vocabulary via the WS adapter layer
8. **Session completion / easiest-win on close** — verify that the lesson-ws.ts close path triggers easiest-win before ending (currently ends on `shouldCloseSession` without guaranteed success turn)
9. **Per-child age profile API** — add a mechanism to set age band at `/lesson/kids/start`

---

## 9. Missing Tests

| Test | Reason needed | Priority |
|---|---|---|
| `vocabulary-guard.test.ts` with 6 categories from spec §10A.3 | Spec mandates this before Phase 4 completion; currently absent | HIGH |
| WS integration test: full session with animal vocabulary via `lesson-ws.ts` | Verifies production wiring path, not just isolated pipeline | HIGH |
| `turn-history-updater` test: `I_DONT_KNOW` counted in failure window | B4 partial not covered | MEDIUM |
| Praise rotation test: after B2 fix, confirm cooldown mechanism works | P1 — will fail once praise is correctly routed | MEDIUM |
| Cold-start easiest-win test with empty mastery | Confirms cold-start ladder fires when no mastered items | MEDIUM |
| Session close: verify easiest-win fires before every stop | Spec invariant: lesson always ends on success | HIGH |
| `session-memory-updater` test: `recentPraisePhrases` accumulates across turns | Confirms praise deduplication state is maintained | LOW |
| Reconnect within TTL: Redis session restores, last packet replayed | Infrastructure contract test | MEDIUM |

---

## 10. Final Recommendation

### What is working

The backend pipeline is a genuine, complete implementation of the spec. Classification, state engine, learning engine, teacher response, recovery, vocabulary guard, and Redis persistence all function correctly. The Phase 8.6 patches resolved the critical B2 misclassification that broke every correct-answer turn. All 338 tests pass. TypeScript is clean.

### What blocks a real child

Two wiring gaps prevent any real teaching from occurring:

1. `lessonTargetWords` is empty — the entire deterministic classification path is unreachable
2. `targetWord` is null per-turn — progression engine cannot advance items

A supervised prototype with a real child in current state would produce: teacher greets child warmly, child says "cat", teacher responds with a fallback redirect ("Hmm, let's try something!"), child says "dog", teacher responds with recovery script ("Let's play a different game!"). The child is never praised, never advanced, never taught.

### Fix scope

Fixes 1–3 above are small (10–20 lines in lesson-ws.ts and session-bootstrap.ts). Fix 4 (minimal kids UI) is larger but a `/kids` frontend route reportedly exists. These four fixes together would make a supervised prototype technically possible.

### Minimum viable prototype path

1. Apply Fixes 1–3 (vocabulary wiring): ~15 lines, 1 file
2. Verify `/kids` frontend route renders audio + word display (existing)
3. Manually supply a 6-word animal session payload
4. Conduct a 5–10 minute supervised session with adult present
5. Collect behavioral observations; do not rely on mastery data (Postgres lookup not yet wired)

---

## Verdict

> **NOT READY FOR REAL-CHILD PROTOTYPE**
>
> Two critical production wiring gaps prevent teaching from occurring.
> After Fixes 1–3 are applied (approximately 15 lines of code in lesson-ws.ts + session-bootstrap.ts)
> and a minimal frontend rendering is confirmed, re-evaluate.
> The architecture and backend pipeline are prototype-ready; the wiring is not.
