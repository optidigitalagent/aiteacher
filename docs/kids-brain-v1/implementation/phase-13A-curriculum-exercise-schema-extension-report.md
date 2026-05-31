# Phase 13A — Curriculum Exercise Schema Extension Report

## Files Modified

| File | Change |
|------|--------|
| `backend/src/kids-brain/curriculum/curriculum-types.ts` | Added 4 enums, 8 interfaces, extended `KidsCurriculumLesson` |
| `backend/src/kids-brain/curriculum/curriculum-validators.ts` | Added 4 validators, updated imports |
| `backend/src/kids-brain/curriculum/index.ts` | Exported new enums, types, and validators |
| `backend/src/kids-brain/curriculum/__tests__/exercise-schema.test.ts` | New test file (23 tests) |
| `docs/kids-brain-v1/implementation/phase-13A-curriculum-exercise-schema-extension-report.md` | This file |

## Types Added

### Enums

| Enum | Values |
|------|--------|
| `KidsTextbookActivityType` | listen_and_repeat, listen_and_point, listen_and_choose, ask_and_answer, chant, story_listen, review, phonics, values_discussion |
| `KidsStudentActionType` | repeat_word, say_choice, answer_question, join_chant, free_production, listen_only |
| `KidsCompletionRuleType` | correct_repetitions, correct_choice, all_targets_completed, teacher_controlled, time_or_turn_limit |
| `KidsRetryEscalationType` | repeat_prompt, simplify_choices, model_answer, encouragement, move_on |

### Interfaces

| Interface | Purpose |
|-----------|---------|
| `KidsExerciseVisualPayload` | Visual asset bundle for visual exercises |
| `KidsExerciseAudioPayload` | Audio asset bundle for audio exercises |
| `KidsExercisePrompt` | Teacher prompt text with optional TTS override |
| `KidsExerciseChoice` | A single answer choice (no isCorrect — backend-only) |
| `KidsExerciseStep` | A single step within a multi-step exercise |
| `KidsCompletionRule` | Defines when an exercise is complete |
| `KidsRetryPolicy` | Defines retry and escalation behaviour |
| `KidsExerciseDefinition` | Full textbook exercise authoring model |

### Extended

`KidsCurriculumLesson` extended with optional field:
```typescript
exercises?: KidsExerciseDefinition[]
```

## Validators Added

| Validator | Checks |
|-----------|--------|
| `validateExerciseCompletionRule(rule)` | type enum, allowPartialCompletion boolean, optional numeric fields |
| `validateExerciseRetryPolicy(policy)` | maxAttempts >= 1, escalationLadder values, fallbackExerciseId string/null, resetOnCorrect boolean |
| `validateKidsExerciseDefinition(exercise)` | exerciseId, lessonId, order >= 1, teacherInstruction (required, ≤ 200 chars, no illegal placeholders), studentActionType, textbookActivityType, completionRule, retryPolicy, visual consistency, expectedAnswers for answer-producing actions, no frontend-authoritative isCorrect on choices |
| `validateLessonExercises(lesson)` | per-exercise validation, duplicate exerciseId check, duplicate order check, targetItemIds → lesson items cross-ref, nextExerciseId cross-ref |

## Tests Added

23 tests in `exercise-schema.test.ts`:

1. valid exercise passes
2. missing exerciseId fails
3. missing completionRule fails
4. invalid retryPolicy fails
5. visual-required exercise without visual payload fails
6. listen_and_repeat allowed without visual UI
7. nextExerciseId must reference existing exercise
8. targetItemIds must reference lesson items
9. answer-producing action requires expectedAnswers
10. listen_only does not require expectedAnswers
11. lesson with valid ordered exercises passes
12. lesson with duplicate exercise IDs fails
13. lesson with invalid exercise order fails
14. existing prototype animals lesson still validates
15. existing Kid's Box Unit 1 still validates
16. public exports exist from index.ts
17. valid completion rule passes
18. invalid completion rule type fails
19. missing allowPartialCompletion fails
20. valid retry policy passes
21. maxAttempts < 1 fails
22. invalid escalation type fails
23. fallbackExerciseId as number fails

## Compatibility with Existing Curriculum

`exercises` is optional on `KidsCurriculumLesson`. All existing lessons (prototype animals, Kid's Box Unit 1 all three lessons) continue to pass validation without modification.

## Commands Run

```
cd backend
npx tsc --noEmit    # 0 errors
npx vitest run src/kids-brain
```

## Test Results

```
Test Files: 22 passed (22)
Tests:      594 passed (594)
```

Previous baseline: 571 passing.  
New tests added: 23.

## Remaining Risks

| Risk | Severity |
|------|----------|
| No exercise instances authored yet — schema is untested against real KB1 textbook exercises | Medium |
| `KidsExerciseStep` defined but not referenced by `KidsExerciseDefinition` — step-level sequencing will require a follow-up design pass | Low |
| `targetItemIds` cross-ref only validated at lesson level, not at course level | Low |
| Visual payload structure (assets array) not deeply validated — contents not checked | Low |

## Next Recommended Phase

**Phase 13B — KB1 Lesson 2 Exercise Authoring**

Author the actual textbook exercises for Kid's Box 1, Unit 1, Lesson 2 (colours) using the new `KidsExerciseDefinition` schema. This will:

- Validate the schema against real content
- Expose any authoring gaps before the runner is built
- Produce a reference exercise set for Phase 13C (Exercise Runner)

Scope: data authoring only in `kids-box-unit-01.ts`. No runtime changes.
