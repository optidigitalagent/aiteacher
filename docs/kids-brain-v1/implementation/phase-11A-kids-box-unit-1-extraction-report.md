# Phase 11A — Kid's Box Unit 1 Extraction Report

## Summary

Unit 1 "Hello!" from Kid's Box 1 (Cambridge University Press, 2nd Edition, 2014) has been extracted and mapped into the Kids Brain curriculum schema. All vocabulary, activity metadata, lesson structure, learning objectives, and page references have been captured. No copyrighted text passages, full story content, or scanned material is stored.

## Unit 1 Title

**"Hello!"** — Pupil's Book pp. 4–9 | Teacher's Book pp. 13–22

## Vocabulary Extracted

**Total: 21 items across 3 lessons**

### Lesson 1 — Greetings (5 items, PB pp. 4–5)

| Item ID | Type | Target Text | RU | UK |
|---|---|---|---|---|
| KB1-U01-GRT-001 | VOCABULARY | hello | привет | привіт |
| KB1-U01-GRT-002 | VOCABULARY | goodbye | до свидания | до побачення |
| KB1-U01-SFR-001 | SENTENCE_FRAME | What's your name? | Как тебя зовут? | Як тебе звати? |
| KB1-U01-SFR-002 | SENTENCE_FRAME | I'm {childName}. | Меня зовут {childName}. | Мене звуть {childName}. |
| KB1-U01-SFR-003 | SENTENCE_FRAME | I'm fine, thank you. | Я в порядке, спасибо. | Я в порядку, дякую. |

### Lesson 2 — Colours (7 items, PB pp. 6–7)

| Item ID | Type | Target Text | RU | UK |
|---|---|---|---|---|
| KB1-U01-COL-001 | VOCABULARY | blue | синий | синій |
| KB1-U01-COL-002 | VOCABULARY | green | зелёный | зелений |
| KB1-U01-COL-003 | VOCABULARY | pink | розовый | рожевий |
| KB1-U01-COL-004 | VOCABULARY | purple | фиолетовый | фіолетовий |
| KB1-U01-COL-005 | VOCABULARY | orange | оранжевый | помаранчевий |
| KB1-U01-COL-006 | VOCABULARY | red | красный | червоний |
| KB1-U01-COL-007 | VOCABULARY | yellow | жёлтый | жовтий |

### Lesson 3 — Numbers 1–10 (10 items, PB p. 5)

| Item ID | Type | Target Text | RU | UK |
|---|---|---|---|---|
| KB1-U01-NUM-001 | VOCABULARY | one | один | один |
| KB1-U01-NUM-002 | VOCABULARY | two | два | два |
| KB1-U01-NUM-003 | VOCABULARY | three | три | три |
| KB1-U01-NUM-004 | VOCABULARY | four | четыре | чотири |
| KB1-U01-NUM-005 | VOCABULARY | five | пять | п'ять |
| KB1-U01-NUM-006 | VOCABULARY | six | шесть | шість |
| KB1-U01-NUM-007 | VOCABULARY | seven | семь | сім |
| KB1-U01-NUM-008 | VOCABULARY | eight | восемь | вісім |
| KB1-U01-NUM-009 | VOCABULARY | nine | девять | дев'ять |
| KB1-U01-NUM-010 | VOCABULARY | ten | десять | десять |

## Phrases Extracted

| Phrase | Source | PB Page |
|---|---|---|
| Hello, I'm [name]. | Greeting introduction | PB4 |
| Goodbye. | Greeting farewell | PB4–5 |
| What's your name? / I'm [name]. | Q&A exchange | PB4–5 |
| How are you? / I'm fine, thank you. | Wellbeing greeting | PB13 |
| What colour's the [object]? / It's [colour]. | Colour Q&A | PB7–8 |
| How old are you? / I'm [number]. | Age Q&A | PB8 |

## Activities Extracted

All activities are **audio-safe** (no visual UI required):

| Activity ID | Type | Lessons |
|---|---|---|
| kb1-u01-listen-repeat | LISTEN_AND_REPEAT | All 3 |
| kb1-u01-forced-choice-audio | FORCED_CHOICE_AUDIO | All 3 |
| kb1-u01-chant | CHANT | All 3 |
| kb1-u01-review-production | REVIEW_PRODUCTION | All 3 |

## Page References Used

| Content | Pupil's Book | Teacher's Book |
|---|---|---|
| Greetings, character names | pp. 4–5 | pp. 13–15 |
| Colours, rainbow song structure | pp. 6–7 | p. 17 |
| Numbers chant | p. 5 | p. 15 |
| Phonics /s/ (six, star) | p. 8 | pp. 19–20 |
| Story + picture dictionary | p. 9 | pp. 21–22 |
| How old are you? questions | p. 8 | pp. 19–20 |
| How are you? / I'm fine | p. 13 | p. 29 |

## Structure Created

**Lesson count:** 3 (Greetings, Colours, Numbers)

Each lesson has 5 standard phases:
1. WARM_UP (60s)
2. INTRODUCTION (180s)
3. PRACTICE (240s)
4. CONSOLIDATION (120s)
5. CLOSE (60s)

**Estimated minutes per lesson:** 10–12 min

**Review links:** Cross-lesson spaced repetition and semantic cluster links defined.

## Assumptions Made

1. **3 lessons vs 5 textbook lessons:** The textbook has 5 lessons per unit. We mapped them to 3 voice-deliverable vocabulary clusters (greetings, colours, numbers) since phonics and story lessons require visual/physical classroom components not supported by the current voice-only runtime.

2. **Character names excluded from vocabulary:** Star family character names (Stella, Simon, Suzy, Mr Star, Mrs Star, Marie, Maskman, Monty, Meera) are used as teaching context in the textbook but are not vocabulary targets for the AI teacher — they are proper nouns, not learnable vocabulary items.

3. **Rainbow song:** Referenced as a chant activity (TB p. 17 notes "red and yellow and pink and green, orange and purple and blue"). Song structure referenced for activity design; song text not stored verbatim.

4. **"How are you?" phrase:** Introduced in TB Lesson 5 / PB p. 13, included in Lesson 1 as it is thematically part of the greetings cluster.

5. **Phonics focus (six, star):** The /s/ phonics lesson (TB pp. 19–20) is represented by the `phonics-s` tag on items `six` and `one` (via the numbers lesson), not as a separate phonics lesson since phonics activities require letter-visual support.

6. **Visual assets:** All `available: false` since the image card UI is not yet built. Audio assets are `available: true` (TTS-deliverable).

## Copyright-Safe Handling

**Stored (metadata only):**
- Vocabulary words and their Russian/Ukrainian translations
- Activity type metadata and prompt templates (original teacher wording)
- Lesson structure (phases, timing, objectives)
- Page number references as metadata
- Phonics tags and distractor relationships

**Not stored:**
- Verbatim story text ("A blue monster" story from PB p. 9)
- Full song lyrics (only structure referenced)
- Scanned page content
- Exercise instructions verbatim from the textbook
- Any copyrighted illustration descriptions

## Files Created

| File | Type |
|---|---|
| `backend/src/kids-brain/curriculum/kids-box/kids-box-unit-01.ts` | Created |
| `backend/src/kids-brain/curriculum/__tests__/kids-box-unit-01.test.ts` | Created |

## Files Modified

| File | Change |
|---|---|
| `backend/src/kids-brain/curriculum/curriculum-loader.ts` | Registered `KIDS_BOX_1_COURSE` in `REGISTERED_COURSES` |
| `backend/src/kids-brain/curriculum/index.ts` | Exported KB1 unit/lesson/course symbols |

## Test Results

```
✓ src/kids-brain/curriculum/__tests__/kids-box-unit-01.test.ts  (39 tests)
✓ All 17 test files — 476/476 tests passing
0 TypeScript errors
```

## Next Phase Recommendation

**Phase 11B — Kid's Box Unit 2 "My School" extraction**

Unit 2 introduces:
- School objects: book, chair, eraser, pen, pencil, table
- Preposition: `Is this a ...? Yes/No.`
- Question: `What colour's the [object]?`
- Phonics: /p/ (pink) and /b/ (blue)
- New characters: Alex, Lenny
- Grammar: `Who's that? He's/She's ...`

Unit 2 has strong overlap with Unit 1 colours (reinforcement) and introduces classroom objects — a vocabulary set fully deliverable via audio-only activities. It is the natural next extraction target.

**Alternative: Phase 11C — Curriculum loader API extension**

Add a `getKidsBoxLesson(unitId, lessonId)` convenience function and a `listKidsBoxCourseUnits()` function to make the Kids Box content easy to query from the runtime without knowing the full courseId.
