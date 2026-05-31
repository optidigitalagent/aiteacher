# Phase 11G — Vocabulary Guard Compatibility Fix Report

## Results

```
TypeScript: 0 errors
Tests:      528/528 passing (19 test files, 7 new tests added)
```

---

## Files Modified

| File | Change |
|---|---|
| `backend/src/kids-brain/teacher-response/response-template-bank.ts` | Fixed 8 template strings across `hesitant_correct`, `correct_answer`, `close_success` |
| `backend/src/kids-brain/teacher-response/teacher-response-engine.ts` | Replaced inline CORRECT_CONFIDENT builder with template bank call |
| `backend/src/kids-brain/teacher-response/__tests__/teacher-response-engine.test.ts` | Added 7 regression tests (C1–C7) |

---

## Vocabulary Violations Found

### Primary — `hesitant_correct` (RC-A main target)

| Variant | Blocked token | Block rate |
|---|---|---|
| `'I heard you! {word}! Can you say it louder?'` | `louder` (no stem rule applies) | 25% |
| `'Yes! {word}! One more time, nice and clear!'` | `clear` (no stem rule applies) | 25% |

**Combined effect:** ~50% of CORRECT_HESITANT turns produced `"Let's try again!"`.

---

### Secondary — `correct_answer` template bank (all 4 variants blocked)

| Variant | Blocked token(s) |
|---|---|
| `'{word}! Yes! You said {word}! Amazing!'` | `said` (length 4, not > 4, no `ed`-stem rule fires) |
| `'Yes! {word}! I love it! Great job!'` | `job` |
| `'{word}! Wow! You got it! Brilliant!'` | `got` |
| `'Yes, YES! {word}! That was perfect!'` | `was` |

**Root issue:** The inline builder in `teacher-response-engine.ts` for CORRECT_CONFIDENT used `PRAISE_VARIANTS` directly in `mainText`. Of the 18 PRAISE_VARIANTS, 11 contain blocked tokens (`got`, `job`, `was`, `knew`, `could`, `at`, `how`, `teaching`, `super`, `favorite`, `give`). This caused ~61% of CORRECT_CONFIDENT turns to be blocked — on top of all 4 template bank variants also being blocked (unused dead code path, but still incorrect).

---

### Additional live-path — `close_success` (via `buildActivityPrompt` default branch)

| Variant | Blocked token(s) |
|---|---|
| `'Amazing! You did it! I\'m SO proud!'` | `did`, `proud` |
| `'Yes! You are amazing! Great job today!'` | `job` |

**Third variant** `"Wow! You're so good! See you next time!"` — passes ✓.

---

### Audit: `near_correct` (no violation — audit report RC-A claim was incorrect)

Phase 11F audit claimed `'Almost! Listen — {word}! Try again — {word}!'` was blocked.
Verification: `almost` IS present in `CORE_TEACHER_VOCABULARY` (line 27). All 4 `near_correct` variants pass the guard. No fix required.

---

### Documented but out of scope (not fixed in Phase 11G)

| File | Variant | Blocked |
|---|---|---|
| `response-template-bank.ts` | `wrong_but_safe` v3: `'Great energy! It\'s {word}! ...'` | `energy` |
| `recovery-response-builder.ts` | `REFUSAL_VARIANTS` all 3 | `something`, `fun`, `problem`, `different`, `take` |
| `teacher-response-constants.ts` | `PRAISE_VARIANTS` 11/18 items | `got`, `job`, `was`, `knew`, `could`, `at`, `how`, etc. |

`wrong_but_safe` is dead code (not called from any live path).
`REFUSAL_VARIANTS` and remaining `PRAISE_VARIANTS` issues are RC-A secondary scope — recommend Phase 11H.

---

## Exact Replacements

### `response-template-bank.ts`

**`hesitant_correct`:**
```
BEFORE: 'I heard you! {word}! Can you say it louder?'
AFTER:  'I heard you! {word}! Say it one more time!'

BEFORE: 'Yes! {word}! One more time, nice and clear!'
AFTER:  'Yes! {word}! Say it again, nice and loud!'
```

**`correct_answer`:**
```
BEFORE: '{word}! Yes! You said {word}! Amazing!'
AFTER:  '{word}! Yes! Say it again: {word}! Amazing!'

BEFORE: 'Yes! {word}! I love it! Great job!'
AFTER:  'Yes! {word}! I love it! Brilliant!'

BEFORE: '{word}! Wow! You got it! Brilliant!'
AFTER:  '{word}! Wow! You know it! Brilliant!'

BEFORE: 'Yes, YES! {word}! That was perfect!'
AFTER:  'Yes! {word}! Yes! That is perfect!'
```

**`close_success`:**
```
BEFORE: 'Amazing! You did it! I\'m SO proud!'
AFTER:  'Amazing! You are so good! Brilliant!'

BEFORE: 'Yes! You are amazing! Great job today!'
AFTER:  'Yes! You are amazing! Brilliant today!'
```

### `teacher-response-engine.ts` (line 147–152)

```typescript
// BEFORE — inline builder embedding PRAISE_VARIANTS in mainText
if (label === ClassificationLabel.CORRECT_CONFIDENT && route.mode !== 'fallback_safe') {
  const praiseVariants = PRAISE_VARIANTS.filter(v => !recentPhrases.includes(v));
  const pool = praiseVariants.length > 0 ? praiseVariants : [...PRAISE_VARIANTS];
  const praise = pool[Math.floor(Math.random() * pool.length)];
  return word ? `${word}! ${praise} Say it again: ${word}!` : praise;
}

// AFTER — use template bank (all variants vocabulary-safe)
if (label === ClassificationLabel.CORRECT_CONFIDENT && route.mode !== 'fallback_safe') {
  return getRenderedTemplate('correct_answer', { word }, recentPhrases);
}
```

**Why the inline builder was the root cause:** 11/18 `PRAISE_VARIANTS` contain tokens not in `CORE_TEACHER_VOCABULARY_SET`. Embedding a full PRAISE_VARIANT in `mainText` caused the vocabulary guard to fire ~61% of CORRECT_CONFIDENT turns. Routing to the template bank eliminates this entirely.

---

## Tests Added (C1–C7)

| Test | Assertion |
|---|---|
| C1 | All 4 `hesitant_correct` variants pass vocab guard with target word |
| C2 | All 4 `correct_answer` template bank variants pass vocab guard |
| C3 | CORRECT_HESITANT engine output never degrades to fallback across 20 turns |
| C4 | CORRECT_CONFIDENT engine output never degrades to fallback across 20 turns |
| C5 | Vocabulary guard still blocks out-of-vocab text (regression) |
| C6 | No `hesitant_correct` template contains "louder" or "clear" |
| C7 | No `correct_answer` template contains "said", "job", "got", or "was" |

---

## Commands Run

```
cd backend
npx tsc --noEmit    → 0 errors
npx vitest run src/kids-brain → 528/528 passing (19 test files)
```

---

## Remaining Risks

| Risk | Severity | Notes |
|---|---|---|
| `PRAISE_VARIANTS` (11/18 blocked) used in fast-track reactions | LOW | Fast-track text does NOT go through vocabulary guard — no live impact |
| `REFUSAL_VARIANTS` in `recovery-response-builder.ts` all blocked | MEDIUM | Refusal path produces "Let's try again!" on all 3 variants. Recommend Phase 11H |
| `wrong_but_safe` template bank: `energy` blocked | LOW | Dead code, not callable from any live path |
| RC-B (empty STT bypasses readiness guard) | MEDIUM | Deferred per spec — Phase 11G scope was RC-A only |

---

## Next Recommended Phase

**Phase 11H — Recovery Script Vocabulary Fix**

Fix `REFUSAL_VARIANTS` in `recovery-response-builder.ts` (all 3 variants blocked by `something`, `fun`, `problem`, `different`, `take`).
Fix `EMOTIONAL_SHUTDOWN_VARIANTS` "Milo" hardcoded character name (blocked if not in characterNames).
Then proceed to **RC-B** (empty STT bypasses readiness guard) which is the second confirmed root cause from Phase 11F.
