# Phase 13D.1 — Readiness Phrase Normalization Fix Report

## Files Modified

| File | Change |
|---|---|
| `backend/src/kids-brain/runtime/turn-processor.ts` | Added `normalizeReadinessPhrase()` helper; updated `isReadinessPhrase()` |
| `backend/src/kids-brain/runtime/__tests__/phase-13d1-readiness-normalization.test.ts` | New test file — 21 tests |

---

## Exact Normalization Fix

**Before:**
```typescript
function isReadinessPhrase(text: string): boolean {
  return READINESS_PHRASES.has(text.trim().toLowerCase());
}
```

**After:**
```typescript
function normalizeReadinessPhrase(text: string): string {
  return text
    .toLowerCase()
    .replace(/[.!?,]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isReadinessPhrase(text: string): boolean {
  return READINESS_PHRASES.has(normalizeReadinessPhrase(text));
}
```

The normalizer:
1. Lowercases the input
2. Strips all `.`, `!`, `?`, `,` characters (sentence punctuation)
3. Collapses runs of whitespace to a single space
4. Trims leading/trailing whitespace

Apostrophes are NOT removed — `"let's go!"` → `"let's go"` which matches the `"let's go"` entry in `READINESS_PHRASES`.

---

## Examples Now Supported

| Input | Normalized | Matches? |
|---|---|---|
| `"I'm ready"` | `"i'm ready"` | ✓ |
| `"I'm ready."` | `"i'm ready"` | ✓ |
| `"I'm ready!"` | `"i'm ready"` | ✓ |
| `"Im ready!"` | `"im ready"` | ✓ |
| `"ready."` | `"ready"` | ✓ |
| `"start!"` | `"start"` | ✓ |
| `"okay,"` | `"okay"` | ✓ |
| `"ok."` | `"ok"` | ✓ |
| `"let's go!"` | `"let's go"` | ✓ |
| `"hello"` | `"hello"` | ✗ (not in set) |
| `"I want to play outside today."` | `"i want to play outside today"` | ✗ (not in set) |

---

## Tests Added

File: `backend/src/kids-brain/runtime/__tests__/phase-13d1-readiness-normalization.test.ts`

21 tests across 4 describe blocks:

1. **Punctuated variants are intercepted** (9 tests)
   - Each of the 9 supported punctuated variants confirms `wasReadinessIntercepted=true` and `hasStartedFirstExercise=true`

2. **Non-readiness phrases are NOT intercepted** (2 tests)
   - `"hello"` — confirms no interception
   - `"I want to play outside today."` — long sentence confirms no interception

3. **Integration — emits correct first exercise prompt** (6 tests)
   - `"I'm ready."` emits text containing "Listen" and "blue"
   - No "try again" / "wrong" in response
   - TEACHER_TEXT and START_LISTENING packets present
   - `hasStartedFirstExercise` set to true
   - `currentExerciseId` advances from `ex-01-readiness` to `ex-02-blue` (for both `"I'm ready."` and `"start!"`)

4. **No mastery penalty or recovery** (4 tests)
   - `eligibleForMasteryUpdate=false`, `eligibleForProgression=false`
   - `requiresRecovery=false`
   - `recoveryState` stays `NORMAL`
   - `triggeredRecoveryChange=false`

---

## Commands Run

```
cd backend
npx tsc --noEmit
npx vitest run src/kids-brain
```

---

## Test Results

```
Test Files  24 passed (24)
      Tests 664 passed (664)
   Duration 8.23s
```

Previous count: 643. Net new: 21 tests.

TypeScript errors: 0

---

## Remaining Risks

- **Question mark**: `?` is stripped, so `"ready?"` → `"ready"` matches. This is acceptable (child echoing the teacher's question "Are you ready?").
- **Multi-word noise**: `"ok let's go!"` → `"ok let's go"` — not in `READINESS_PHRASES`, so correctly falls through to normal classification.
- **STT mid-word punctuation**: rare but e.g. `"I'm.ready"` → `"i'mready"` — does not match. Not a realistic STT output.

---

## Next Recommended Phase

**Phase 13D.2 — Silence-during-readiness handling**

Currently, if the child is silent during the readiness phase (STT returns `null`), the turn falls through to the normal pipeline which may emit a curriculum-classification-based prompt. A dedicated silence handler for the pre-readiness phase should emit a gentle re-prompt ("Are you ready? Say yes!") instead of the default silence recovery path.
