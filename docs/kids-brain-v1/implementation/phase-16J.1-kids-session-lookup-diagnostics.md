# Phase 16J.1 — Kids Session Lookup Diagnostics

Goal:
Diagnose why Kids classroom focus_lesson_start sometimes falls through to the paid lesson billing guard and closes with 4402 Payment required.

Diagnostics only.

Do NOT change behavior.
Do NOT change billing logic.
Do NOT modify frontend.
Do NOT modify curriculum.
Do NOT change WebSocket protocol.
Do NOT deploy until diagnostics are committed.

Context:
Live production shows:

Frontend:
focus_lesson_start sent
backend responds error
WS closes code=4402 reason="Payment required"

Expected:
Kids session should be detected via kids_sessions and routed to handleKidsBrainV1LessonStart, bypassing adult paid billing guard.

Audit 16J.0 found:
handleFocusLessonStart has a Kids session check before checkAndLinkPaidSession.
If that check succeeds, billing guard is not reached.
But live behavior proves the check is not succeeding or not being executed.

Task:
Add temporary structured diagnostics around the Kids session lookup in handleFocusLessonStart.

Read:
- backend/src/ws/lesson-ws.ts
- docs/kids-brain-v1/implementation/phase-16J.0-kids-start-billing-guard-audit-report.md if present
- backend/src/routes/lesson-routes.ts or relevant /lesson/kids/start route
- frontend/src/pages/KidsClassroomPage.tsx

Diagnostics to add:

1. At the start of handleFocusLessonStart log:

[kids-start-diag] focus_start_received
- sessionId
- userId
- hasSessionId
- hasUserId
- USE_KIDS_BRAIN_V1
- meta.lessonId
- meta.kidsSessionId if present

2. Before kids_sessions query log:

[kids-start-diag] checking_kids_session
- sessionId
- userId

3. After kids_sessions query log:

[kids-start-diag] kids_session_lookup_result
- rowsLength
- rowUserId
- currentUserId
- status if selected
- mode if selected

Update SELECT to include status and mode if safe:

SELECT user_id, status, mode
FROM kids_sessions
WHERE session_id = $1
AND status != 'ended'

This does not change behavior.

4. If owner mismatch log:

[kids-start-diag] owner_mismatch
- rowUserId
- currentUserId

5. If Kids route selected log:

[kids-start-diag] routing_to_kids_brain_v1
- sessionId
- userId

6. If kids lookup returns zero rows log:

[kids-start-diag] no_kids_session_row
- sessionId
- userId

7. Immediately before checkAndLinkPaidSession log:

[kids-start-diag] falling_through_to_paid_guard
- sessionId
- userId
- reason:
  - no_session_id
  - no_user_id
  - no_kids_row
  - kids_lookup_error
  - unknown

8. In catch block log:

[kids-start-diag] kids_session_lookup_error
- sessionId
- userId
- errorName
- errorMessage

Do not return early.
Do not fix behavior in this phase.

9. Optional:
In /lesson/kids/start route, log:

[kids-start-diag] kids_session_created
- sessionId
- userId
- mode
- status

Do not log tokens, email, child name, or secrets.

Safety:
- Do not log auth token.
- Do not log personal child info.
- Do not log API keys.
- Logs must be temporary and clearly prefixed [kids-start-diag].

Validation:
Run:

cd backend
npx tsc --noEmit

If tests are affected:
npx vitest run src/ws
npx vitest run src/kids-brain

Create report:

docs/kids-brain-v1/implementation/phase-16J.1-kids-session-lookup-diagnostics-report.md

Report must include:
- files modified
- diagnostics added
- exact log lines to look for
- commands run
- test/build results
- how to interpret next production logs
- next decision tree

Output:
- files modified
- diagnostics added
- build results
- next step