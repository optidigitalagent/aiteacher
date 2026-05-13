# PHASE 7 COMPLETE

## 1. Summary

Phase 7 implemented **Curriculum Completion & Focus 2 Scaling** — expanding the AI teacher's curriculum coverage from a small prototype subset (4 OCR sections, unit 1 only) to the full Focus 2 Student Book (8 units, 25 sections).

Before Phase 7: the system had OCR exercise data for only 4 sections (1.1–1.4). Units 2–8 were completely absent from the section selector. `buildFocusStudentBookContext()` returned a hard "not found" string for any section outside unit 1, telling the AI to stop and ask the student to choose something else. There were no curriculum validation utilities, no safe fallback for missing data, and no unit grouping in the Learning flow UI.

After Phase 7: a full curriculum catalog covers all 25 Focus 2 sections across 8 units. The AI teacher receives structured grammar/vocabulary content for units 2–8 (from `focus-content.ts`) rather than a "not found" error. The Learning flow UI groups sections by unit with headers and a data-quality indicator per section. A curriculum validator prevents hallucination (missing sections log a warning and use safe fallback text). The `continuation-status` API from Phase 6 is now wired in the frontend to show a "Resume available" indicator when relevant.

## 2. Goals Completed

Completed:
- `curriculum-catalog.ts` — single source of truth for all 25 Focus 2 sections with metadata (unit, type, topic, grammarFocus, vocabularyFocus, dataQuality, enabled)
- `curriculum-validator.ts` — validation utilities for section IDs, exercise types, cursor references, and content completeness
- `focus-student-book.ts` — structured fallback for units 2–8: AI gets real grammar/vocabulary content from `focus-content.ts` instead of "not found"
- `focus_mapping.json` — expanded from 4 to 25 entries covering all units 1–8 with `dataQuality` field
- `lesson-ws.ts` — greeting and section type check now fall back to catalog when OCR data is unavailable
- `lessonStartApi.ts` — `getContinuationStatus()` function + `ContinuationStatus` type added
- `LearningPage.tsx` — sections grouped by unit with `FOCUS2_UNIT_TITLES` headers; data-quality dot per section; resume indicator wired from `continuation-status` API; removed hardcoded `focus2-0.1` stub; added section `1.4` (previously missing from the selector)

NOT completed (moved to future phases or out of scope):
- Full OCR digitisation for units 2–8 — textbook exercise text still unavailable; structured fallback is used instead
- Paragraph completion FSM state — still noted as future work from Phase 2/6
- Pronunciation tips — Phase 5 noted as future work

## 3. Changed Files

Backend:
- `backend/src/lesson/curriculum-catalog.ts` — NEW: full 25-section catalog with metadata and data quality tiers
- `backend/src/lesson/curriculum-validator.ts` — NEW: validation utilities (validateSection, validateExerciseType, validateCursorRef, validateSectionContent)
- `backend/src/lesson/focus-student-book.ts` — UPDATED: unit-level structured fallback via `focus-content.ts`; OCR path unchanged; "not found" path replaced with safe fallback text
- `backend/data/focus_mapping.json` — UPDATED: expanded from 4 to 25 entries; added `dataQuality` field per section
- `backend/src/ws/lesson-ws.ts` — UPDATED: imports `getCatalogEntry`; greeting uses `catalogEntry.topic` fallback for section title; grammar card trigger uses catalog `type` when OCR unavailable

Frontend:
- `frontend/src/services/lessonStartApi.ts` — UPDATED: `getContinuationStatus()` function + `ContinuationStatus` interface added
- `frontend/src/pages/LearningPage.tsx` — UPDATED: all 25 sections across 8 units; `SectionData` has `unit` and `dataQuality` fields; section step renders unit-grouped layout; continuation-status wired for resume indicator

Database:
- No database changes. No new migration needed. Next migration remains 013.

Docs:
- `docs/handoffs/PHASE_7_HANDOFF.md` — this document

## 4. Backend Changes

**curriculum-catalog.ts** is the new authoritative source for all curriculum metadata. It exports:
- `FOCUS2_CATALOG: SectionCatalogEntry[]` — all 25 sections
- `getCatalogEntry(sectionId)` — lookup by "1.1", "2.3", etc.
- `getSectionDataQuality(sectionId)` — 'ocr' | 'structured' | 'unavailable' | null
- `getAllUnits()` — distinct unit numbers
- `getSectionsForUnit(unit)` — sections for a given unit
- `getNextSection(sectionId)` — next available (non-unavailable) section after current
- `isValidSectionId(sectionId)` — quick validator

`SectionDataQuality`:
- `'ocr'` — real OCR exercise text exists in `focus_lessons.json` (sections 1.1–1.4)
- `'structured'` — unit-level content from `focus-content.ts` (units 2–8)
- `'unavailable'` — no usable content (speaking/listening without audio, currently 3.3)

**curriculum-validator.ts** exports validation functions used in runtime guards:
- `validateSection(sectionId)` — checks catalog entry exists, data quality is not unavailable, content is present
- `validateExerciseType(type)` — checks against supported list (fill_gap, grammar_transform, word_box, reading, speaking_prompt, vocabulary_matching); returns safe fallback for unknown types
- `validateCursorRef(sectionId, exerciseIndex)` — checks exercise index is in range
- `validateSectionContent(sectionId)` — checks for minimum required fields based on section type

**focus-student-book.ts** fallback chain (in order):
1. OCR data in `focus_lessons.json` → use directly (sections 1.1–1.4)
2. Catalog entry + unit data from `focus-content.ts` → build structured AI context
3. No catalog or unit data → safe "no content available" message (do not invent)

For path 2, the AI context includes:
- Section type and topic from catalog
- Unit grammar explanation + table + example sentences + exercise ideas (grammar sections)
- Unit vocabulary with definitions + examples + collocations + phrasal verbs (vocabulary sections)
- Reading passage + discussion question (reading sections)
- Adapted listening instructions + reading passage as substitute (listening sections)
- Explicit rules: "Do NOT reference specific textbook pages or exercise numbers"

**lesson-ws.ts** changes (lines ~82–88 and ~711–717):
- `sectionTitle` falls back to `catalogEntry?.topic ?? section` when OCR missing
- `grammarFocus` falls back to `catalogEntry?.grammarFocus ?? grammarTarget` when OCR missing
- Grammar card send trigger uses `sb?.type === 'Grammar' || ce?.type === 'grammar'`

## 5. Frontend Changes

**LearningPage.tsx** section step (STEP 2) now:
- Groups all 25 sections into 8 unit groups using `FOCUS2_UNIT_TITLES`
- Renders a unit header row before each group (label "Unit N" + unit title)
- Shows a green dot (OCR) or purple dot (structured) per section as data quality indicator
- Fetches `getContinuationStatus()` on mount when authenticated
- Shows "▶ Resume available" chip in the section header when `canContinue === true`
- Shows "▶ Resume" chip inline on the specific section that matches `activeSectionId`
- Section `1.4` now appears (was previously missing from the old hardcoded list)
- Removed the incorrect `focus2-0.1` introduction stub

`SectionData` interface gained two new optional fields:
- `unit: number` — used for grouping
- `dataQuality?: 'ocr' | 'structured'` — drives the quality dot color

`lessonStartApi.ts` exports:
- `getContinuationStatus(): Promise<ContinuationStatus | null>` — calls `GET /api/lesson/continuation-status`
- `ContinuationStatus` interface matching the Phase 6 backend response shape

## 6. Database Changes

No database changes. No new migration. Next migration is still **013**.

## 7. Runtime Behavior Changes

Before:
- Student selecting section 2.1 → AI received "section not found in focus_lessons.json, ask student to choose available section"
- Student selecting section 1.4 → section did not appear in the Learning flow (missing from hardcoded list)
- Lesson start for any unit > 1 → AI defaulted to generic teaching with no curriculum context
- Section selector showed a flat unsorted list with a phantom "0.1 Introduction" entry

After:
- Student selecting section 2.1 → AI receives real vocabulary content for Unit 2 (achievements, historical figures; discover/invent/overcome/inspire vocabulary with definitions)
- Student selecting section 2.2 → AI receives full Past Simple grammar explanation, table, examples, exercise ideas — but is instructed not to invent textbook pages
- Student selecting section 1.4 → section appears, OCR data available, full reading text delivered
- Section selector groups sections under unit headers with count ("8 units · 24 available sections")
- Resume indicator appears on the correct section if a session is in progress

## 8. WebSocket/Event Changes

No websocket event changes.

The `continuation-status` REST endpoint (added in Phase 6) is now consumed by the frontend for the first time, but no WS events were added or modified.

## 9. AI/Prompt Changes

`buildFocusStudentBookContext()` now injects structured unit content for units 2–8 instead of an error message. This changes the system prompt injected per-lesson:

- For OCR sections (1.1–1.4): unchanged — real exercise text as before
- For structured sections (2.1–8.3): ~300–600 tokens of unit grammar/vocabulary content, plus explicit anti-hallucination rules
- For unavailable sections (3.3 speaking): safe "no content" message (~3 tokens) — unchanged behavior

The AI is now explicitly told for structured sections:
- Do NOT reference specific textbook pages or exercise numbers
- Say "Let's practice [topic]" not "Exercise 3 from your book"
- Follow Focus 2 guided discovery approach

No changes to `master-prompt.md`. No changes to the FSM prompt phases.

## 10. Cost Impact

Minor increase for units 2–8:
- Each lesson on a structured section adds ~300–600 extra tokens to the system prompt (unit grammar/vocabulary content)
- At Claude Sonnet pricing (~$3/M input tokens) this is ~$0.001–0.002 per lesson turn
- OCR sections: unchanged cost
- No changes to STT, TTS, or AI call frequency

## 11. Tests Performed

Tested:
- `npx tsc --noEmit` in `backend/` — 0 errors
- `npx tsc --noEmit` in `frontend/` — 0 errors (was 3 errors before fix)
- `npx vite build` in `frontend/` — clean production build (77 modules, 426 kB JS bundle)

Manual runtime tests were NOT performed. All testing of the actual classroom flow will happen during final manual product testing as stated in the Phase 7 prompt.

## 12. Known Remaining Issues

Remaining issues:
- OCR exercise text for units 2–8 does not exist. The structured fallback works but the AI cannot present actual textbook exercises — it invents exercises based on the grammar/vocabulary content. This is by design (anti-hallucination rules in place) but limits fidelity for units 2–8.
- Speaking section 3.3 is `disabled: true` and `dataQuality: 'unavailable'`. No audio track. This is intentional.
- `getNextSection()` in curriculum-catalog.ts is implemented but not yet called from the lesson FSM. Section-to-section progression logic uses it but the FSM's own cursor still drives lesson flow.
- The section selector uses an inline IIFE (`(() => { ... })()`) for the grouped rendering — functional but slightly unusual. Can be refactored to a named component in Phase 8 if desired.

## 13. What Was Intentionally NOT Changed

Intentionally NOT changed:
- Lesson FSM state machine — Phase 7 explicitly excludes FSM changes
- Voice runtime (STT/Deepgram, TTS/ElevenLabs) — untouched
- Billing system (LiqPay, subscriptions, subscription gate) — untouched
- WebSocket runtime (`lesson-ws.ts` beyond 3 targeted lines) — untouched
- Resume/snapshot logic (`lesson-snapshots.ts`) — Phase 6 work preserved
- `master-prompt.md` — no AI prompt changes
- Demo lesson flow — untouched
- Auth system — untouched
- `focus-content.ts` — used as a read-only data source, not modified
- `focus_lessons.json` — used as a read-only OCR data source, not modified
- Migration numbering — next migration stays at 013

## 14. Risks Introduced

New risks:
- **Structured fallback verbosity**: For some units, `buildUnitFallbackContext()` can inject 600+ tokens into the system prompt. If combined with a long conversation history near the 4000-token prompt limit defined in `ai-prompts.md`, it could push the system prompt over limit. Monitor `PromptBuilder` total token count for units 2–8. Mitigation: the prompt builder's 800-token RAG cap and 200-token student profile cap should leave sufficient headroom.
- **focus-content.ts accuracy**: The grammar and vocabulary content in `focus-content.ts` was written by hand (not OCR'd from the actual Focus 2 book). If any content is inaccurate, the AI teacher will teach wrong content for units 2–8. This is pre-existing risk from Phase 3; Phase 7 surfaces it by using this content for the first time in actual lesson prompts.

## 15. Deployment Notes

No deployment changes required. No new environment variables. No migrations. No service restarts needed.

The only file that changed at the data layer is `backend/data/focus_mapping.json` — this is bundled with the backend and will be picked up on the next Railway redeploy.

## 16. Recommended Next Phase

Recommended next phase:
Phase 8 — Exercise Renderer & Textbook Fidelity

Phase 7 created the curriculum mapping infrastructure. Phase 8 should build on it to render actual exercise cards in the classroom for sections that have data (1.1–1.4 OCR sections), and define a proper exercise cursor / paragraph advancement flow for all sections. This would make the textbook experience feel real rather than AI-improvised.

## 17. Next Claude Session Instructions

Next Claude session should:
- Read `docs/PAID_LESSON_RUNTIME_ROADMAP.md` first
- Read `docs/handoffs/PHASE_7_HANDOFF.md` (this document)
- Read `docs/RUNTIME_GUARDRAILS.md`
- Read `docs/WEBSOCKET_EVENT_CONTRACT.md`
- Read `docs/phase/PHASE_8_PROMPT.md` for Phase 8 scope
- Inspect `backend/src/lesson/curriculum-catalog.ts` — understand section catalog before any curriculum changes
- Inspect `backend/src/lesson/focus-student-book.ts` — understand the 3-tier fallback chain
- Inspect `backend/src/lesson/focus-content.ts` — understand the structured unit content before adding/modifying unit data
- Continue from Phase 8 ONLY

DO NOT:
- Remove or bypass the anti-hallucination rules in `buildUnitFallbackContext()` (the "Do NOT reference specific textbook pages" instructions)
- Modify `focus-student-book.ts` OCR path (sections 1.1–1.4 behavior must remain unchanged)
- Rewrite the curriculum catalog — extend it instead
- Touch the lesson FSM, voice runtime, billing, or resume logic (Phase 6 work)
- Re-add a `focus2-0.1` entry (it was deliberately removed — there is no Unit 0 in Focus 2)
- Change the migration numbering — next migration is 013
