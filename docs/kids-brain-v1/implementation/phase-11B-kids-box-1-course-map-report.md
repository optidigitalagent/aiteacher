# Phase 11B — Kid's Box 1 Course Map Report

**Date:** 2026-05-30
**Status:** Complete

## Files Created

| File | Purpose |
|------|---------|
| `backend/src/kids-brain/curriculum/kids-box/kids-box-1-course-map.ts` | Course map — types + data for all 12 units |
| `backend/src/kids-brain/curriculum/__tests__/kids-box-1-course-map.test.ts` | 19 tests covering all spec requirements |
| `docs/kids-brain-v1/implementation/phase-11B-kids-box-1-course-map-report.md` | This report |

## Files Modified

| File | Change |
|------|--------|
| `backend/src/kids-brain/curriculum/index.ts` | Added type and value exports for course map |

## Course Map Summary

**courseId:** `cambridge-kids-box-1`
**level:** pre-A1
**source:** Cambridge University Press, 2nd Edition, 2014

### 12 Main Units

| # | Unit ID | Title | TB Pages | PB Pages | Status | Phonics |
|---|---------|-------|----------|----------|--------|---------|
| 1 | kb1-unit-01 | Hello! | 13–22 | 4–9 | **extracted** | /s/ "six" |
| 2 | kb1-unit-02 | My school | 23–34 | 10–15 | pending | /æ/ "bag" |
| 3 | kb1-unit-03 | Favourite toys | 39–50 | 18–23 | pending | /b/ "ball" |
| 4 | kb1-unit-04 | My family | 51–62 | 24–29 | pending | /d/ "dad" |
| 5 | kb1-unit-05 | Our pets | 67–78 | 32–37 | pending | /k/ "cat" |
| 6 | kb1-unit-06 | My face | 79–90 | 38–43 | pending | /h/ "hair" |
| 7 | kb1-unit-07 | Wild animals | 95–106 | 46–51 | pending | /l/ "lion" |
| 8 | kb1-unit-08 | My clothes | 107–118 | 52–57 | pending | /ʃ/ "shoes" |
| 9 | kb1-unit-09 | Fun time! | 123–134 | 60–65 | pending | /ɪ/ "swimming" |
| 10 | kb1-unit-10 | At the funfair | 135–146 | 66–71 | pending | /ɑː/ "car" |
| 11 | kb1-unit-11 | Our house | 151–162 | 74–79 | pending | /ɪ/ "kitchen" |
| 12 | kb1-unit-12 | Party time! | 163–174 | 80–85 | pending | /tʃ/ "chicken" |

### 3 Review Blocks

| Block ID | Covers | TB Pages | PB Pages |
|----------|--------|----------|----------|
| kb1-review-1-4 | Units 1–4 | 63–66 | 30–31 |
| kb1-review-5-8 | Units 5–8 | 119–122 | 58–59 |
| kb1-review-9-12 | Units 9–12 | 179–182 | 88–89 |

### 4 CLIL / Values Sections

| Section ID | Title | Subject | After Unit | TB Pages | PB Pages |
|------------|-------|---------|------------|----------|----------|
| kb1-clil-maths-trevor-values-1 | Marie's maths + Trevor's values | maths | Unit 2 | 35–38 | 16–17 |
| kb1-clil-science-trevor-values-2 | Marie's science + Trevor's values | science | Unit 6 | 91–94 | 44–45 |
| kb1-clil-sports-trevor-values-3 | Marie's sports + Trevor's values | sports | Unit 10 | 147–150 | 72–73 |
| kb1-clil-art-trevor-values-4 | Marie's art + Trevor's values | art | Unit 12 | 175–178 | 86–87 |

## Test Results

```
Test Files  18 passed (18)
     Tests  495 passed (495)
  Duration  4.54s
```

New test file: `kids-box-1-course-map.test.ts` — 19 tests, all passing.
Previous Phase 11A tests: 39 tests still passing (no regressions).

## TypeScript

0 errors (`npx tsc --noEmit`).

## Copyright Compliance

- No full page text stored
- No verbatim story passages or chant lyrics
- No scanned content
- Only: vocabulary theme labels, grammar function patterns, page number ranges, phonics sound labels

## Next Phase Recommendation

**Phase 11C — Kid's Box 1 Unit 2 "My school" extraction**

Unit 2 is the natural next extraction target:
- TB pp. 23–34, PB pp. 10–15
- Vocabulary: 6 classroom objects (ruler, book, rubber, pencil, bag, pencil case)
- Grammar: "What's this? It's a ..." + colours review
- Phonics: /æ/ "bag"
- Follows the same 3-lesson pattern established in Unit 1

After Unit 2 is extracted, Phase 11D can cover the CLIL/values section (Marie's maths) which sits between Units 2 and 3.
