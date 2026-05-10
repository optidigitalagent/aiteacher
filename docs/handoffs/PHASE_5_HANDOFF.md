# PHASE 5 COMPLETE

## 1. Summary

Phase 5 introduced **Persistent Tips & Learning Memory** — a zero-cost mechanism that captures grammar trouble spots, vocabulary, and common mistakes across sessions and resurfaces them as teacher context and a student-facing Notes drawer.

Before Phase 5: lesson state was ephemeral (Redis, 4-hour TTL). When a student returned for the next lesson, the AI had no memory of what they struggled with. The `errorsThisLesson` field existed in `LessonState` but was never populated — Phase 4's agenda context always had an empty errors section.

After Phase 5: every incorrect exercise answer, confusion signal, and vocabulary encounter is saved to PostgreSQL as a `TipRecord`. At the start of each paid lesson, the frontend receives a `tip_list` event with recent tips. As new tips are created mid-lesson, `tip_added` events push them live. The AI teacher receives up to 5 section-relevant tips injected into the system prompt as a `STUDENT_LEARNING PROFILE` block, enabling natural cross-session references. Students can open a Notes drawer to review their accumulated tips grouped by category.

## 2. Goals Completed

Completed:
- `student_tips` PostgreSQL table with deduplication (same category+title within 30 days = skip)
- `tips-service.ts`: `saveTip()`, `getTipsForContext()`, `getStudentTips()` — all with try/catch
- `errorsThisLesson` population fixed: `orchestrator.recordExerciseResult()` now accepts `ExerciseErrorData` and appends `ErrorRecord` entries — fixes the Phase 4 agenda context bug
- Confusion trigger: `handleStudentConfused()` in `lesson-ws.ts` saves a GRAMMAR tip (non-blocking, fire-and-forget)
- Exercise error trigger: `handleExerciseAnswer()` passes `ExerciseErrorData` when answer is wrong
- Lesson-end trigger: `saveLessonEndTipsAsync()` reads Redis state at lesson end, saves COMMON_MISTAKE tips from `errorsThisLesson` and VOCAB tips from `vocabularyTaught`
- `buildStudentTipsContext()` in `prompt-builder.ts`: injects up to 5 tips as `STUDENT_LEARNING_PROFILE` block into system prompt (~100-200 tokens)
- `claude-handler.ts`: loads tips in parallel with student profile, RAG, and history via `Promise.all`
- WS events: `tip_list` and `tip_added` added to both backend `OutboundMessage` union and frontend `BackendMessage` union
- Frontend `TipsDrawer` component: grouped by category, color-coded, slide-in drawer with backdrop
- Frontend `ClassroomLayout`: tips state, event handlers, floating Notes button, drawer render
- TypeScript: both backend and frontend compile clean with `tsc --noEmit`

NOT completed (never in scope):
- Phase 6 (vocabulary flashcard review mode — future phase)
- REST endpoint for tips history (frontend uses WS `tip_list` instead)

## 3. Changed Files

Backend:
- `backend/src/lesson/orchestrator.ts` — added `ErrorRecord` import; added `ExerciseErrorData` interface (exported); extended `recordExerciseResult()` to populate `errorsThisLesson`
- `backend/src/lesson/tips-service.ts` — new file: `TipInput`, `TipRecord` types; `saveTip()`, `getTipsForContext()`, `getStudentTips()` functions
- `backend/src/ai/prompt-builder.ts` — added `studentTips?: TipRecord[]` to `PromptContext`; added `buildStudentTipsContext()` function; injected tips block into system prompt
- `backend/src/ai/claude-handler.ts` — added `getTipsForContext` import; added to `Promise.all`; added `studentTips` to `PromptContext`
- `backend/src/ws/message-types.ts` — added `OutboundTipAdded`, `OutboundTipList`, `TipRecord` re-export; added both to `OutboundMessage` union
- `backend/src/ws/lesson-ws.ts` — added imports (`saveTip`, `getStudentTips`, `ExerciseErrorData`, `ErrorRecord`); added `toErrorType()` helper; added `saveLessonEndTipsAsync()`; updated `handleFocusLessonStart()` to send `tip_list`; updated `processInput()` to call tip saving on lesson end; updated `handleExerciseAnswer()` to pass error data; updated `handleStudentConfused()` to save GRAMMAR tip

Frontend:
- `frontend/src/features/classroom/services/classroomSocket.ts` — added `TipRecord` interface; added `tip_added` and `tip_list` to `BackendMessage` union
- `frontend/src/features/classroom/components/TipsDrawer.tsx` — new file: drawer component with category grouping, color coding, slide-in animation
- `frontend/src/features/classroom/components/ClassroomLayout.tsx` — added `TipsDrawer` import; added `tips` and `showTips` state; added `tip_list` and `tip_added` case handlers; added floating Notes button; added TipsDrawer with backdrop

Database:
- `backend/migrations/011_student_tips.sql` — new table `student_tips` with deduplication constraint; three indexes: student_id, student_id+section, student_id+created_at DESC

## 4. Backend Changes

**New service: `tips-service.ts`**
All tip operations are DB-only (no AI calls). `saveTip()` checks for a duplicate within 30 days using `LOWER(title)` comparison before inserting — prevents tip spam from repeated confusion on the same topic. `getTipsForContext()` uses `ORDER BY CASE WHEN section = $2 THEN 0 ELSE 1 END, created_at DESC` to prioritise section-relevant tips without a UNION ALL query. `getStudentTips()` returns the 30 most recent tips ordered by recency for the frontend drawer.

**Fixed pre-existing bug: `errorsThisLesson` never populated**
`LessonState.errorsThisLesson: ErrorRecord[]` was declared in types but `recordExerciseResult()` only updated `failedItems` (item index, not structured error data). Phase 4's `buildTeacherAgendaContext()` read this field — it was always `[]`. Phase 5 extends `recordExerciseResult(lessonId, correct, errorData?)` with optional `ExerciseErrorData`. When the WS layer calls this on a wrong answer, it passes the question text, student's answer, correct answer, and error type. The orchestrator builds a full `ErrorRecord` and appends to `state.errorsThisLesson` (capped at 10).

**Three tip creation triggers in `lesson-ws.ts`**
1. **Confusion** (`handleStudentConfused`): fires an async IIFE that reads Redis state, saves a GRAMMAR tip with `grammarTarget` as title, and sends `tip_added` if WS still open. Does not block the AI response.
2. **Exercise error** (`handleExerciseAnswer`): passes `ExerciseErrorData` to `orchestrator.recordExerciseResult()`. Tip is saved at lesson end from `errorsThisLesson`, not immediately — avoids tip spam on repeated retries.
3. **Lesson end** (`saveLessonEndTipsAsync`): called fire-and-forget after lesson ends. Reads final Redis state, saves COMMON_MISTAKE tips from `errorsThisLesson` and VOCAB tips from `vocabularyTaught`. Sends `tip_added` for each new tip (deduplication already handled at DB level). `lessonId`/`studentId` are captured before `meta.lessonId = null` to avoid the race condition.

**Prompt injection**
`buildStudentTipsContext()` generates at most 5 bullet lines, each under ~40 chars for the tip line plus up to 80 chars of example. The block is injected between the teacher agenda context and the textbook section context — so the AI sees it before the section content. The header instructs the AI to reference tips naturally, not recite the list.

## 5. Frontend Changes

**`TipsDrawer` component**
Slide-in panel from the right (320px wide). Tips grouped by category in pedagogical order: GRAMMAR → COMMON_MISTAKE → VOCAB → PHRASE → PRONUNCIATION. Each category shown with a color-coded pill badge. Each tip card shows title (bold), explanation, and example (italicised, only if present). Left border color matches the category color for quick scanning. Animation: `slideInRight` 220ms ease-out.

**`ClassroomLayout` integration**
- `tips: TipRecord[]` state, initialised empty, populated by `tip_list` (replaces all) and `tip_added` (deduplicates by id before appending at head)
- Floating "Notes" button appears at bottom-right only in paid mode when `tips.length > 0` and drawer is closed. Shows tip count badge. zIndex 120 (below overlays at 200).
- Drawer renders with a semi-transparent backdrop (blur 2px, zIndex 140). Clicking backdrop closes drawer.
- Tips are only available in paid mode (not demo) — demo sessions have no studentId persistence.

## 6. Database Changes

New table `student_tips`:
```sql
CREATE TABLE IF NOT EXISTS student_tips (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  lesson_id  UUID REFERENCES lessons(id) ON DELETE SET NULL,
  section    VARCHAR(50),
  exercise_id VARCHAR(255),
  category   VARCHAR(30) NOT NULL CHECK (category IN ('VOCAB','PHRASE','GRAMMAR','PRONUNCIATION','COMMON_MISTAKE')),
  title      VARCHAR(255) NOT NULL,
  explanation TEXT NOT NULL,
  example    TEXT,
  source     VARCHAR(50) NOT NULL CHECK (source IN ('confusion','correction','vocabulary','observation')),
  created_at TIMESTAMP DEFAULT NOW()
);
```
Indexes: `idx_tips_student_id`, `idx_tips_student_section` (student_id, section), `idx_tips_created` (student_id, created_at DESC).

Migration file: `backend/migrations/011_student_tips.sql`. Must be run before deploying Phase 5.

## 7. Runtime Behavior Changes

Before:
- Each lesson started cold — AI had no memory of student's previous difficulties
- `errorsThisLesson` in Redis was always `[]`, making Phase 4 agenda context incomplete
- No tip persistence, no student-facing learning history
- WS event set: no `tip_list`, no `tip_added`

After:
- At lesson start, frontend receives `tip_list` with up to 30 recent tips; Notes button appears if any exist
- AI receives up to 5 section-relevant tips in system prompt: can naturally reference "last time you had trouble with irregular verbs"
- When student is confused: GRAMMAR tip saved immediately, `tip_added` pushed to frontend live
- When lesson ends: COMMON_MISTAKE and VOCAB tips saved from lesson data; student's Notes drawer updates in real time
- `errorsThisLesson` is now correctly populated — Phase 4 agenda context ("student struggled with X this session") now works as designed

## 8. WebSocket/Event Changes

Added:
- `tip_list` — `{ type: 'tip_list', tips: TipRecord[] }` — sent once at lesson start with full recent tip history (max 30, ordered by recency). Frontend initialises the Notes drawer from this.
- `tip_added` — `{ type: 'tip_added', tip: TipRecord }` — sent each time a new tip is created mid-lesson (confusion trigger immediately; lesson-end tips after lesson ends). Frontend deduplicates by `tip.id`.

Modified: none.
Removed: none.

## 9. AI/Prompt Changes

New section injected into system prompt: `STUDENT_LEARNING_PROFILE — PREVIOUS LESSONS`.

Content: up to 5 bullet points in format `• [CATEGORY] title: explanation (e.g. "example")`.

Header instructs the AI: "Note these patterns when relevant — reference naturally, do NOT recite this list."

Token budget: ~100-200 tokens total (well within the 4000-token prompt cap set in ai-prompts.md rules).

The section is section-relevant-first: tips from the same textbook section as the current lesson appear before tips from other sections.

No other prompt changes. The AI response format (JSON with speech, display_text, next_action, exercise, internal_note) is unchanged.

## 10. Cost Impact

- **AI calls**: no change — zero new AI calls; tips are derived from existing structured data (exercise results, confusion signals, vocabulary lists)
- **STT / TTS**: no change
- **DB**: +1 SELECT per AI turn (`getTipsForContext` in `claude-handler.ts`, parallel with existing queries); +1-3 INSERTs per lesson end event; negligible cost
- **Prompt tokens**: +100-200 tokens per AI turn when tips exist; within the 4000-token cap; no meaningful cost increase at current token prices

## 11. Tests Performed

Tested:
- `backend: tsc --noEmit` — passes clean (0 errors)
- `frontend: tsc --noEmit` — passes clean (0 errors)
- Manual review: `ErrorRecord` import missing from orchestrator.ts — caught and fixed before final check

Not tested (requires running backend + DB):
- Actual tip deduplication in PostgreSQL (30-day window)
- `tip_list` delivery at lesson start via WS
- `tip_added` delivery on confusion trigger
- Tips drawer rendering with real data
- AI prompt injection with actual tips data

## 12. Known Remaining Issues

Remaining issues:
- **PRONUNCIATION tips**: no trigger for pronunciation errors yet. The `source: 'observation'` category exists in the schema but no backend logic creates pronunciation tips. Low priority — requires voice analysis integration.
- **Vocabulary tips from demo lessons**: demo sessions have no `studentId` persistence. Only paid lesson students accumulate tips. Expected behavior; not a bug.
- **Tips not shown in chat panel**: tips only visible in the Notes drawer, not inline in the conversation. Acceptable for now; could be a Phase 6 enhancement.
- **Migration must be run manually**: `011_student_tips.sql` must be applied before Phase 5 code is deployed. No auto-migration system.

## 13. What Was Intentionally NOT Changed

Intentionally NOT changed:
- Voice system (STT/Deepgram, TTS/ElevenLabs) — Phase 5 touches no voice code
- Demo lesson flow (`useDemoSession`, `DemoStepCenter`) — tips are paid-mode only
- Lesson FSM (`transitions.ts`) — Phase 5 adds no new phases or transitions
- Exercise store (`exercise-store.ts`) — exercises still saved/retrieved as before
- Billing system (LiqPay, subscription gate, minute accounting) — Phase 5 adds no billing logic
- Redis lesson state TTL (4 hours) — unchanged; tips survive in PostgreSQL, not Redis
- `max_tokens: 400` per AI turn — unchanged per ai-prompts.md rules
- AI response JSON format — unchanged (speech, display_text, next_action, exercise, internal_note)

## 14. Risks Introduced

New risks:
- **`saveLessonEndTipsAsync` fire-and-forget**: if the backend process crashes after lesson end, tips from that lesson won't be saved. Redis state is cleared in `processInput()` before the async save completes. Low probability; acceptable trade-off to not block the WS close.
- **Tip spam if deduplication fails**: if the 30-day window check has an edge case (clock skew, timezone), duplicate tips could appear. Mitigation: the `LOWER(title)` check is conservative; false negatives (missing a duplicate) would just create a slightly redundant entry.
- **System prompt token overflow**: if a student accumulates many very long tips, the 5-tip slice at 80-char example truncation could still push total prompt over 4000 tokens. Monitored by the existing token logging in claude-handler.ts (`tokens~=`).

## 15. Deployment Notes

Before deploying Phase 5 to Railway:

1. **Run migration**: `psql $DATABASE_URL -f backend/migrations/011_student_tips.sql`
2. **Restart backend service** on Railway to pick up new compiled code
3. **No new environment variables** required
4. **No Redis key schema changes** — existing lesson states in Redis are compatible

## 16. Recommended Next Phase

Recommended next phase:
Phase 6 — Vocabulary Flashcard Review

The tips infrastructure is now in place. Phase 6 would build on it with a flashcard review mode: student can review accumulated VOCAB and PHRASE tips between lessons, with spaced repetition scheduling. The `student_tips` table already has the data; Phase 6 would add a `last_reviewed_at` column and a REST endpoint for flashcard retrieval.

## 17. Next Claude Session Instructions

Next Claude session should:
- Read `docs/PAID_LESSON_RUNTIME_ROADMAP.md` first
- Read `docs/handoffs/PHASE_5_HANDOFF.md` (this document)
- Read `docs/RUNTIME_GUARDRAILS.md`
- Read `docs/WEBSOCKET_EVENT_CONTRACT.md` — now includes `tip_added` and `tip_list`
- Inspect `backend/src/lesson/tips-service.ts` — understand tip categories and deduplication before adding any new tip triggers
- Inspect `backend/src/ws/lesson-ws.ts` — understand the three trigger points (confusion, exercise error, lesson end) before modifying
- Inspect `frontend/src/features/classroom/components/TipsDrawer.tsx` — understand the tip display contract before adding new tip categories

DO NOT:
- Add tip triggers that call the Claude AI — tips must be zero-cost, derived from structured data only
- Increase `max_tokens` above 400 per AI turn
- Remove the `STUDENT_LEARNING_PROFILE` block from the system prompt without replacing it
- Change the `student_tips` table schema without writing a new migration (next would be 012)
- Modify the lesson FSM or voice system as part of Phase 6

Continue from Phase 6 ONLY. Do not revisit Phase 5 unless a bug report requires it.
