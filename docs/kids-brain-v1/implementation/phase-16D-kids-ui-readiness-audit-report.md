# Phase 16D — Kids UI Readiness Audit Report

**Date:** 2026-06-01  
**Auditor:** Claude Code (Phase 16D instruction execution)  
**Scope:** Audit only. No code modified.

---

## Validation Results

| Command | Result |
|---|---|
| `npx tsc --noEmit` | **0 errors** |
| `npx vitest run src/kids-brain` | **870/870 passed** |
| `npx vitest run src/ws` | **12/12 passed** |
| **Total** | **882/882 passed** |

---

## 1. Current UI Path

### Route: `/kids` → `KidsPrototypePage.tsx`

`frontend/src/pages/KidsPrototypePage.tsx` is a landing/start card. On button click it:
1. Calls `POST /lesson/kids/start` → receives `{ sessionId }`
2. Calls `navigate('/classroom/${sessionId}', { state: { mode: 'mentium_kids', sessionId } })`

### Destination: `/classroom/:sessionId` → `ClassroomLayout.tsx`

`ClassroomLayout` accepts only `mode: 'demo' | 'paid'`. The `'mentium_kids'` mode state is
stored in `location.state` but is **never read** by `ClassroomLayout`. The component renders
in full **paid lesson mode** — complete adult classroom UI.

**There is no dedicated kids classroom route, layout, or component.**  
The child enters a full adult paid lesson screen every time.

---

## 2. Adult UI Elements Visible to a Child

All of the following render when a kids session lands on `/classroom/:sessionId`:

| Component | Adult element | Why unsuitable for child |
|---|---|---|
| `ClassroomHeader` | `Section X · Topic` label | Adult section numbering; meaningless to child |
| `ClassroomHeader` | `⏱ 5m` billing timer chip | Billing UI; anxiety-inducing; adult concept |
| `ClassroomHeader` | Teacher name chip with `IcChev` dropdown | Adult navigation affordance |
| `ClassroomHeader` | "Exit" button + confirmation modal | "Leave before finishing, unsaved lesson progress may be lost" — confusing language for child |
| `SectionProgressPanel` | `Section X · English lesson` label | Adult curriculum metadata |
| `SectionProgressPanel` | Exercise step timeline with numbered items | Adult exercise progression UI |
| `SectionProgressPanel` | "Your progress" percentage bar | Adult metric |
| `SectionProgressPanel` | "Open Chat" button | Opens adult transcript panel |
| `ChatPanel` | Full message transcript | Dense text; translate button; voice replay; adult layout |
| `TeacherPanel` | Microphone state panel + "Explain" button | "Explain" triggers `student_confused` event — not in kids WS path |
| `BottomControls` | Text input bar + "Explain" button | Small text field; adult affordances |
| `PaidExerciseCard` | Grammar/reading exercise card | Adult textbook exercise card |
| `ExerciseAnchorBanner` | `Exercise N · [type]` banner | Adult label |
| `PaidLessonCompleteModal` | "Exercise score", "Vocabulary count" | Adult metrics |
| `PaidLeaveModal` | "Unsaved lesson progress may be lost" | Adult-oriented language |
| Time warning banner | "N minutes remaining in this lesson" | Anxiety-inducing for child |
| `LESSON_TAKEN_OVER` modal | "This lesson was resumed in another tab" | Technical adult message |
| `TipsDrawer` | "My Learning Notes" grammar tips | Adult study tool |
| `PaidBeginPanel` | Section number, topic, teacher metadata | Adult curriculum frame |

**Summary:** Every component in `ClassroomLayout` is adult-oriented. There is zero child-appropriate
UI currently — no large text, no visual word cards, no animated mic state, no child-safe exit message.

---

## 3. Existing Usable WS Fields (Kids Path)

The following WS messages are sent by `handleKidsBrainV1LessonStart` and `processKidsBrainV1Turn`:

| Message type | Fields sent | Usable for kids UI |
|---|---|---|
| `lesson_ready` | `{ sessionId }` | YES — trigger "Begin Lesson" button |
| `ai_text` | `{ type, phase: 'DIAGNOSTIC', text }` | YES — large teacher text display |
| `audio_chunk` | `{ data }` | YES — TTS audio playback |
| `teacher_turn_end` | `{}` | YES — mic enable signal |
| `lesson_end` | `{ summary: { lessonId, durationMin, phasesReached, exerciseScore, vocabularyCount } }` | YES — lesson complete screen |

**Reconnect:** On `reconnectSession()` match, backend sends `lesson_ready` + `ai_text` resume
message ("Hi again! Let's keep going. Listen — {target}! Now you!"). No structured reconnect
state packet exists for the kids path.

---

## 4. Missing UI State (Not in Current WS Protocol)

| Field | Why needed | Currently available? |
|---|---|---|
| `currentExerciseId` | Show which exercise is active | NO — not sent by backend |
| `targetItemId` / `targetWord` | Visual word card / flash card | NO — embedded in `ai_text` text only |
| `exerciseType` | Adapt UI (listen/point vs. repeat vs. choose) | NO — not sent |
| `exerciseNumber` / `totalExercises` | Progress bar ("Exercise 3 of 10") | NO — not sent |
| `progressPercent` | Visual progress indicator | NO — only in `lesson_end.summary` |
| `choices` | Tap-to-answer visual cards | NO — not in protocol |
| `activityType` | UI mode (listen_and_point / repeat / choose) | NO — not sent |
| Structured reconnect state | Resume display without full cold-start | NO — only `ai_text` on reconnect |
| `lessonPhase` | Know if in greeting vs. exercise vs. wrap-up | NO — always `'DIAGNOSTIC'` |

**Critical observation:** The `ai_text` message embeds all of this in the `text` string (e.g.
`"Listen — blue! Now you!"`). The frontend must NOT parse teacher text for state (per
`frontend/CLAUDE.md` authority rules). Therefore a minimal MVP using only `ai_text` for teacher
display and mic for input is valid — but visual exercise cards require backend payload changes.

---

## 5. MVP Kids UI Requirements

For an **internal child-with-engineer demo**, the minimum viable Kids UI requires:

### Required (Phase 16E: Kids UI Shell)

| Requirement | Implementation note |
|---|---|
| Dedicated `/kids/classroom/:sessionId` route | New route in `App.tsx` |
| `KidsClassroomLayout` component | New file; does NOT extend `ClassroomLayout` |
| Large teacher text bubble (≥22px) | `ai_text.text` displayed prominently |
| Big animated mic button (≥80px tap target) | Sends `mic_start` / `mic_stop` or `text_message` |
| Audio status indicator ("Teacher is speaking…" / "Your turn!") | `teacher_turn_end` signal |
| Simple progress dots or bar | Derived from `lesson_end.summary` or hardcoded 10-step placeholder |
| Child-safe "Welcome back!" reconnect screen | `lesson_ready` + first `ai_text` after reconnect |
| No billing timer | Explicitly excluded |
| No section/grammar labels | Explicitly excluded |
| No adult chat transcript | Excluded; teacher text only |
| Lesson complete screen | `lesson_end` → child-friendly "Great job!" screen |
| Safe exit message | "Want to stop the lesson?" — child language |
| `KidsPrototypePage` navigate to `/kids/classroom/:sessionId` | Fix existing navigation target |

### Not Required for Demo (Phase 16F+)

- Teacher avatar / character animation
- Visual word cards / flash cards (requires backend `targetWord` field)
- Stars / reward animations
- Tap-to-choose cards (requires backend `choices` field)
- Parent summary dashboard
- Exercise progress counter (requires backend `exerciseNumber` field)

---

## 6. Backend Payload Gaps

### Gap assessment for MVP

| MVP feature | Backend support | Gap |
|---|---|---|
| Teacher text display | `ai_text.text` | NONE |
| Audio playback | `audio_chunk` + `teacher_turn_end` | NONE |
| Lesson start | `lesson_ready` | NONE |
| Voice input | `mic_start` / `audio_chunk` / `mic_stop` | NONE |
| Text input | `text_message` | NONE |
| Reconnect message | `ai_text` on reconnect | NONE (adequate for MVP) |
| Lesson complete | `lesson_end.summary` | NONE |

**MVP is achievable with no backend changes.**

### Gap assessment for Phase 16F (visual exercise cards)

| Feature | Required backend change |
|---|---|
| Visual word/item card | Add `targetWord?: string` to `ai_text` packet |
| Exercise type indicator | Add `activityType?: string` to `ai_text` packet |
| Exercise progress counter | Add `exerciseNumber?: number, totalExercises?: number` to `ai_text` packet |
| Tap-to-choose cards | New `kids_choices` WS message: `{ type: 'kids_choices', choices: string[], correctIndex?: never }` |
| Structured reconnect state | Enrich `lesson_ready` with `{ resumeContext?: { exerciseNumber, targetWord, activityType } }` |

All of the above are additive — no existing contracts broken. They belong in **Phase 16F**.

### Authority rules preserved

- Frontend must NOT parse `ai_text.text` to extract `targetWord` or exercise state
- Backend remains authority for all exercise progression
- `lesson_end.summary` is the only score signal the frontend may display

---

## 7. Recommended Implementation Phases

### Phase 16E — Kids UI Shell (MVP for demo)

**Scope:** New route + new minimal layout. No backend changes.

Files to create:
- `frontend/src/pages/kids/KidsClassroomPage.tsx` — new kids classroom layout
- Update `frontend/src/App.tsx` — add `/kids/classroom/:sessionId` route
- Update `frontend/src/pages/KidsPrototypePage.tsx` — navigate to `/kids/classroom/:sessionId`

Components needed in `KidsClassroomPage`:
- `KidsTeacherBubble` — large text bubble, animated "typing" state
- `KidsMicButton` — 88px+ circular mic button, animated listening state
- `KidsAudioIndicator` — "Teacher is speaking" vs "Your turn!" status
- `KidsProgressDots` — 10 placeholder dots (hardcoded total; actual from `lesson_end`)
- `KidsLessonComplete` — child-friendly completion screen
- `KidsExitGuard` — "Want to stop?" with child language

WS messages consumed: `lesson_ready`, `ai_text`, `audio_chunk`, `teacher_turn_end`, `lesson_end`

**Unblocks:** child-with-engineer internal demo.

---

### Phase 16F — Kids Lesson State Payload

**Scope:** Backend adds structured state fields to kids WS messages. Frontend renders visual cards.

Backend changes (additive):
- `ai_text` extended: `+ targetWord?, activityType?, exerciseNumber?, totalExercises?`
- New `kids_choices` packet for tap-to-choose exercises
- `lesson_ready` extended: `+ resumeContext?`

Frontend changes:
- `KidsWordCard` — large visual word/image card
- `KidsChoiceCards` — tap-to-select grid (3–4 options)
- Progress counter: "Exercise 3 of 10"

---

### Phase 16G — Kids Mic UX

**Scope:** Child-appropriate voice UX polish.

- Push-to-talk mode (hold mic button to record — more reliable for 6–9 year olds than toggle)
- Visual waveform during recording
- Countdown timer (5 seconds before auto-submit)
- "I couldn't hear you — try again!" safe error message

---

### Phase 16H — Visual Word/Image Cards

**Scope:** Render colour/animal/object images alongside target word.

- Requires Phase 16F backend payload
- Image assets stored in `/curriculum-assets/`
- `KidsImageCard` component; images pre-loaded from curriculum manifest

---

### Phase 16I — Lesson Completion + Parent Summary

**Scope:** Child-facing celebration screen + parent-facing progress report.

- Child screen: stars, stickers, "Well done!" animation
- Requires `childId` separation (Phase 16F prerequisite)
- Parent summary HTTP endpoint (`GET /lesson/kids/summary/:childId`) — currently commented out

---

## 8. Risks

| Risk | Severity | Detail |
|---|---|---|
| **Frontend/backend mismatch** | Medium | Kids WS path sends `phase: 'DIAGNOSTIC'` on all packets. Adult `ClassroomLayout` ignores phase for kids — not a problem in new dedicated layout, but confirms they must stay separate. |
| **Audio context not primed** | High | Kids UI must call `primeHtmlAudio()` + `warmAudioContext()` on "Begin Lesson" gesture (same as adult). Mobile iOS will block TTS without this. |
| **Reconnect UX** | Medium | On reconnect, backend sends `lesson_ready` then `ai_text` resume message. The kids UI must not show a blank screen between these two events. A loading spinner after `lesson_ready` until first `ai_text` arrives is required. |
| **mic_start not available in text-only mode** | Low | `/lesson/kids/start` does not require microphone. Text-only `text_message` path works. But Phase 16E must offer text input as fallback if no mic permission. |
| **Child safety: lesson_end navigate target** | Medium | On `lesson_end`, child must NOT be navigated to `/learning` (adult subscription page). Needs dedicated `/kids` or `/kids/done` destination. |
| **Accessibility** | Medium | Large tap targets (≥44px), high-contrast colour choices, no hover-only affordances (tablet/iPad primary device for this age group). |
| **Mobile responsiveness** | High | Ages 6–9 are almost exclusively on tablet or parent phone. Kids UI must be full-screen mobile-first layout. The adult `ClassroomLayout` grid is desktop-biased. |
| **`classroomSocket` service reuse** | Low | `createClassroomSocket` in `frontend/src/features/classroom/services/classroomSocket.ts` can be reused as-is for the kids WS connection — no changes needed. |
| **`voiceApi` reuse** | Low | `warmAudioContext`, `primeHtmlAudio`, `requestMicPreflight` can all be imported directly — no duplication. |

---

## Final Verdict

> **READY TO BUILD KIDS UI SHELL**
>
> The backend Kids Brain v1 WS protocol sends `lesson_ready`, `ai_text`, `audio_chunk`,
> `teacher_turn_end`, and `lesson_end` — sufficient for a complete minimal child-with-engineer
> demo flow with no backend changes.
>
> The routing gap (kids sessions landing on adult classroom) and the absence of a
> child-appropriate layout are implementation tasks, not blockers from missing backend
> infrastructure.
>
> **Phase 16E is unblocked.**

---

## Immediate Blockers Before Phase 16E Can Ship

| Blocker | Fix location |
|---|---|
| `KidsPrototypePage` navigates to `/classroom/:sessionId` (adult UI) | Phase 16E: change navigate target to `/kids/classroom/:sessionId` |
| No `/kids/classroom/:sessionId` route exists | Phase 16E: add route in `App.tsx` |
| No `KidsClassroomLayout` component | Phase 16E: create new file |
| `lesson_end` navigate target is `/learning` (adult page) | Phase 16E: navigate to `/kids` or `/kids/done` |
| KidsPrototypePage shows "Animals vocabulary · Ages 5–8" (stale prototype copy) | Phase 16E: update badge copy to match KB1 Unit 1 scope |

---

## Files Created

- `docs/kids-brain-v1/implementation/phase-16D-kids-ui-readiness-audit-report.md` (this file)

## Commands Run

```
cd backend
npx tsc --noEmit          → 0 errors
npx vitest run src/kids-brain → 870/870 passed
npx vitest run src/ws         → 12/12 passed
Total: 882/882 passing
```
