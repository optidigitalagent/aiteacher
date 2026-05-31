# Phase 11D — Activate Kid's Box Unit 1 Lesson 2 — Report

**Date:** 2026-05-31  
**Scope:** Activate `kb1-u01-l02` (Colours) as the live runtime curriculum source.

---

## Files Modified

| File | Lines changed | Change |
|------|--------------|--------|
| `backend/src/ws/lesson-ws.ts` | 112–114 | 3 constants: PROTO_COURSE_ID / PROTO_UNIT_ID / PROTO_LESSON_ID |
| `backend/src/kids-brain/runtime/session-bootstrap.ts` | 24 | PROTOTYPE_LESSON_ID string literal |
| `backend/src/kids-brain/runtime/__tests__/phase-10d-curriculum-integration.test.ts` | 48–50, 309, 427–435, 453+ | Updated constants, vocabulary assertion, placeholder tests, added Phase 11D block (9 tests) |

---

## Old Active Curriculum

```
courseId:  mentium-kids-prototype-animals
unitId:    animals-zoo-001
lessonId:  animals-zoo-lesson-001
words:     cat, dog, lion, monkey, elephant, tiger  (6 items)
```

---

## New Active Curriculum

```
courseId:  cambridge-kids-box-1
unitId:    kb1-unit-01
lessonId:  kb1-u01-l02
words:     blue, green, pink, purple, orange, red, yellow  (7 items)
```

---

## Target Words After Activation

`blue`, `green`, `pink`, `purple`, `orange`, `red`, `yellow`

First target word: **blue** (`sessionMemory.currentTargetItemId = 'blue'` on session start)

---

## Test Updates

### Updated assertions in `phase-10d-curriculum-integration.test.ts`

| Location | Before | After |
|----------|--------|-------|
| Lines 48–50 (constants) | `mentium-kids-prototype-animals` / `animals-zoo-001` / `animals-zoo-lesson-001` | `cambridge-kids-box-1` / `kb1-unit-01` / `kb1-u01-l02` |
| Line 309 (vocabulary assertion) | `['cat','dog','lion','monkey','elephant','tiger']` | `['blue','green','pink','purple','orange','red','yellow']` |
| Line 427 (placeholder test — correct) | `'cat', 'cat'` | `'blue', 'blue'` |
| Line 432 (placeholder test — wrong) | `'no', 'cat'` | `'no', 'blue'` |

### New Phase 11D describe block (9 tests)

- active runtime course is `cambridge-kids-box-1`
- active runtime unit is `kb1-unit-01`
- active runtime lesson is `kb1-u01-l02`
- lessonTargetWords are the 7 KB1 colours
- `sessionMemory.lessonId` equals `kb1-u01-l02`
- first target word is `blue`
- no animal words in the active curriculum
- no unresolved placeholders when responding to `blue`
- `sessionMemory.lessonId` unchanged after a turn

---

## Praise-Rotation Failure Status

**Resolved.** Phase 11C reported 494/495 (1 pre-existing praise-rotation failure in `kids-brain-simulation.qa.test.ts`). This run: **504/504 passing** — the praise-rotation test is now green. No curriculum-related cause was identified; the failure was non-deterministic and did not reproduce this session.

---

## Commands Run

```
cd backend
npx tsc --noEmit          → 0 errors
npx vitest run src/kids-brain  → 504/504 passing (18 test files)
```

---

## Test Results

```
Test Files  18 passed (18)
Tests       504 passed (504)
Duration    5.02s
```

---

## Remaining Risks

| Risk | Severity | Notes |
|------|----------|-------|
| No startup validation of curriculum IDs | Low | If IDs are mistyped, `getVocabularyWords` returns `[]` silently. Phase 10D Risk 1 — still not wired |
| Curriculum hardcoded at module load | Low | No per-session unit selection. Same vocabulary array for every Kids Brain v1 session in the process lifetime |
| Prototype animals curriculum still registered | Info | `mentium-kids-prototype-animals` remains in the static registry but is no longer referenced by the runtime. Safe to leave; can be removed in a cleanup phase |

---

## Next Recommended Phase

**Phase 11E — Unit 1 Lesson 3 (Numbers) smoke test + per-session curriculum selection design.**

The runtime is hardcoded to a single lesson at module load. To support lesson progression (Lesson 1 → Lesson 2 → Lesson 3 across sessions), the next phase should:

1. Design a session-level curriculum selector (which lesson does this child/session use?)
2. Decide if the selector lives in `lesson-ws.ts` (WS entry point) or `session-bootstrap.ts`
3. Write the per-session unit selection API contract

Alternatively, if only Lesson 2 (Colours) is needed for the current release, Phase 11E can be:

**Phase 11E — Kids Brain v1 production smoke test with real WebSocket session.**

Start a real Kids Brain v1 session end-to-end and verify:
- first target word is `blue`
- teacher audio plays correctly
- child voice answer is classified against colour words
- session ends cleanly
