# Code Audit QA — 2026-05-13

## Method: Static code + runtime flow analysis
## Files reviewed: lesson-ws.ts, message-types.ts, ClassroomLayout.tsx, useLessonSession.ts, useVoiceSession.ts, subscription-service.ts, classroomSocket.ts, LearningPage.tsx

---

## CRITICAL BUGS

### BUG-01: `toggle()` sends spurious interrupt when student manually stops recording

**File:** `frontend/src/features/classroom/hooks/useVoiceSession.ts:52-56`

```typescript
const toggle = useCallback(async () => {
  if (isListening) {
    if (streamRef.current) stopPCMCapture(streamRef.current)
    streamRef.current = null
    setIsListening(false)
    send({ type: 'interrupt' })  // ← ALWAYS fires, even on normal stop
    return
  }
  ...
})
```

**Impact:** When the student manually stops recording (clicks mic to stop, not to interrupt the teacher), the backend receives `interrupt`. If the AI is currently processing the student's speech (`aiProcessing=true`), this sets `interruptPending=true`. When the AI finishes, `ttsStream()` checks `interruptPending` and **skips TTS entirely** — the student hears silence. The AI processed their input, produced a response, but never spoke.

**Scenario:**
1. Student clicks mic → starts recording
2. Student speaks
3. Student clicks mic to stop → `toggle()` fires, sends `interrupt`
4. Backend sets `interruptPending=true` (AI was just starting to process)
5. AI produces response, calls `ttsStream` → skipped due to `interruptPending`
6. **Student hears nothing. Turn is lost.**

**Fix:** Remove `send({ type: 'interrupt' })` from the stop-recording path in `toggle()`. The interrupt signal is already sent from `paidToggle` only when the teacher is speaking. Natural stop-recording should never send interrupt.

---

### BUG-02: `exerciseCursor` never cleared on phase transition

**File:** `frontend/src/features/classroom/hooks/useLessonSession.ts`

`exerciseCursor` is set by `onCursorUpdated()` and never cleared. `onPhaseChange()` updates the phase steps but does not clear the cursor.

**Impact:** After the EXERCISES phase ends and the lesson moves to VOCABULARY → DEEP_THINKING → WRAP_UP, the last exercise card (`PaidExerciseCard`) remains visible in the center panel. Students see stale exercise content during vocabulary and wrap-up phases. The UI is misleading.

**Fix:** Clear `exerciseCursor` inside `onPhaseChange` when leaving the EXERCISES phase.

---

## HIGH ISSUES

### BUG-03: `handleExerciseAnswer` drops exercise result if concurrent AI call in flight

**File:** `backend/src/ws/lesson-ws.ts:966-1025`

`handleExerciseAnswer` calls `processInput()` at the end. `processInput()` has an `aiProcessing` guard that silently drops the call if AI is already processing.

**Scenario:** Student answers exercise A while the AI is still processing the previous turn (e.g., a slow API response). The exercise result context (CORRECT/INCORRECT, correction ladder) is dropped. AI advances the lesson without knowing the exercise outcome. Correction ladder never activates.

**Mitigation:** This requires an `aiProcessing` queue or flag. Currently the guard is a drop — no retry. The probability is low (requires concurrent AI turn), but non-zero during slow API responses.

---

### BUG-04: `section_card` event silently dropped — grammar overview card never shown

**File:** `frontend/src/features/classroom/components/ClassroomLayout.tsx:261`

```typescript
case 'section_card':
  break  // ← silently dropped
```

The backend sends a `section_card` for grammar sections (generated/cached async). The frontend ignores it. The grammar overview card feature is fully implemented on the backend but dead in the UI.

**Fix:** Store the card in state and render it (e.g., in the center panel during DIAGNOSTIC or CONTEXT_INPUT phase, or as a collapsible panel in chat).

---

## MEDIUM ISSUES

### BUG-05: `feedback` state not cleared on phase change (when no new exercise)

**File:** `frontend/src/features/classroom/components/ClassroomLayout.tsx`

`feedback` is cleared only when `question?.id` changes (line 376). If the phase changes without a new exercise (e.g., moving to VOCABULARY), the "Not quite — listen to the teacher" banner can persist on `PaidExerciseCard` for the wrong context.

---

### BUG-06: Mobile layout — fixed pixel grid overflows on small screens

**File:** `frontend/src/features/classroom/components/ClassroomLayout.tsx:534`

```typescript
gridTemplateColumns: chatOpen ? '160px 1fr 265px 148px' : '160px 1fr 148px'
```

Minimum total width (chat open): `160 + 265 + 148 + (14×3 gaps) = 615px`. Any device under 615px width causes overflow. The outer `overflow: hidden` hides panels rather than adapting. On mobile, students cannot see the chat panel or the progress panel.

**No mobile layout path exists for the classroom.** This must be addressed before mobile users can use paid lessons.

---

### BUG-07: `lessonRemainingMin = 0` shown as "0 min remaining"

**File:** `frontend/src/features/classroom/components/ClassroomLayout.tsx:317`

```typescript
setLessonRemainingMin(Math.ceil(msg.remainingMs / 60_000))
```

When `remainingMs = 0`, result is `0`. The header would show "0 min remaining" rather than something like "Lesson finishing…".

---

### BUG-08: No automatic WS reconnect — manual reload required

**File:** `frontend/src/features/classroom/components/ClassroomLayout.tsx:336-363`

WS `onClose` sets `wsDisconnected=true` and shows a banner with "Reload" button. No auto-reconnect is attempted. For a production voice lesson where a brief network glitch drops the connection, the user loses their lesson context and must reload. The backend supports resume — the frontend just doesn't try.

A 2-3 second auto-reconnect (max 3 retries) would recover most transient drops silently.

---

## LOW / INFORMATIONAL

### BUG-09: `activateSubscription` always resets `paid_minutes_used = 0` on renewal

**File:** `backend/src/billing/subscription-service.ts:76-91`

The `ON CONFLICT DO UPDATE` always sets `paid_minutes_used = 0`. If a LiqPay webhook fires twice for the same payment (duplicate callback), a user's entire usage counter is wiped on the second activation call. LiqPay should be idempotent at the payment level, but the DB should also guard: only reset usage if `plan_started_at` is actually changing.

---

### BUG-10: `beginSentRef` not reset on WS reconnect

**File:** `frontend/src/features/classroom/components/ClassroomLayout.tsx:193`

If the WS closes between `lesson_ready` and the user clicking "Begin Lesson", and the component doesn't remount (e.g., if somehow the WS closes and reconnects without a page reload), the user can't click Begin again because `beginSentRef.current = true`. Minor — in practice the component remounts on reconnect anyway.

---

## BILLING SAFETY: CONFIRMED CORRECT ✓

The idempotent `finalizeUsage` fix (Phase 11) correctly guards against double-billing:
- `WHERE id = $2 AND status = 'active'` prevents double-finalize
- `billingStartedAt` (not `lessonStartedAt`) prevents double-charging on reconnect
- `findActiveLessonOwner` evicts stale tabs before resuming

No billing correctness issues found.

---

## PRIORITY FIX ORDER

| # | Bug | Severity | Fix effort |
|---|-----|----------|------------|
| 01 | Spurious interrupt on mic-stop → silent AI turn | CRITICAL | 2 lines |
| 02 | exerciseCursor not cleared on phase change | CRITICAL | 5 lines |
| 03 | exercise result dropped if concurrent AI call | HIGH | requires queue |
| 04 | section_card silently dropped | HIGH | needs UI component |
| 05 | feedback not cleared on phase change | MEDIUM | 3 lines |
| 06 | Mobile layout broken | MEDIUM | significant CSS work |
| 07 | 0 min remaining label | LOW | 1 line |
| 08 | No auto WS reconnect | MEDIUM | ~30 lines |
