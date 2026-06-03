# Phase 16J.1 — Kids Session Lookup Diagnostics — Implementation Report

## Files Modified

| File | Change |
|---|---|
| `backend/src/ws/lesson-ws.ts` | Diagnostics added to `handleFocusLessonStart` |
| `backend/src/api/lesson-routes.ts` | Diagnostic log added to `POST /lesson/kids/start` |
| `backend/src/ws/__tests__/phase-16g-kids-stt-integration.test.ts` | Mock updated to match new SQL |
| `backend/src/ws/__tests__/kids-brain-v1-real-ws-smoke.test.ts` | Mock updated to match new SQL |

No behavior changes. No billing changes. No frontend changes. No protocol changes.

## Diagnostics Added

All logs are prefixed `[kids-start-diag]` for easy `grep`.

### #1 `focus_start_received` — top of `handleFocusLessonStart`
```
[kids-start-diag] focus_start_received {"sessionId":"…","userId":"…","hasSessionId":true,"hasUserId":true,"USE_KIDS_BRAIN_V1":true,"metaLessonId":null,"metaKidsSessionId":null}
```
Tells you: what the function received and whether the flag is active.

### #2 `checking_kids_session` — before DB query
```
[kids-start-diag] checking_kids_session {"sessionId":"…","userId":"…"}
```
Confirms the kids check branch was entered (sessionId AND userId are non-null).

### #3 `kids_session_lookup_result` — after DB query
```
[kids-start-diag] kids_session_lookup_result {"rowsLength":1,"rowUserId":"u-xxx","currentUserId":"u-xxx","status":"created","mode":"mentium_kids"}
```
Key field: `rowsLength`. If `0` — the session was not found in DB. Also exposes `status` and `mode`.

SQL updated to: `SELECT user_id, status, mode FROM kids_sessions WHERE session_id = $1 AND status != 'ended'`

### #4 `owner_mismatch` — if `rowUserId !== currentUserId`
```
[kids-start-diag] owner_mismatch {"rowUserId":"u-aaa","currentUserId":"u-bbb"}
```

### #5 `routing_to_kids_brain_v1` — Kids path confirmed
```
[kids-start-diag] routing_to_kids_brain_v1 {"sessionId":"…","userId":"…"}
```
If this line appears, the function routed to Kids and never reached billing.

### #6 `no_kids_session_row` — zero rows returned
```
[kids-start-diag] no_kids_session_row {"sessionId":"…","userId":"…"}
```
The session_id was not found in kids_sessions (or all rows had status='ended').

### #7 `falling_through_to_paid_guard` — immediately before `checkAndLinkPaidSession`
```
[kids-start-diag] falling_through_to_paid_guard {"sessionId":"…","userId":"…","reason":"no_kids_row"}
```
`reason` values:
- `no_session_id` — meta.sessionId was null/empty
- `no_user_id` — meta.userId was null/empty
- `no_kids_row` — query returned 0 rows
- `kids_lookup_error` — exception in DB query
- `unknown` — should never happen

### #8 `kids_session_lookup_error` — DB exception caught
```
[kids-start-diag] kids_session_lookup_error {"sessionId":"…","userId":"…","errorName":"Error","errorMessage":"…"}
```

### #9 `kids_session_created` — in `POST /lesson/kids/start`
```
[kids-start-diag] kids_session_created {"sessionId":"…","userId":"…","mode":"mentium_kids","status":"created"}
```
Confirms the HTTP route ran and inserted the row. Compare `sessionId` here to `sessionId` in `#1` — they must match.

## Commands Run

```
cd backend
npx tsc --noEmit        # exit 0 — no type errors
npx vitest run src/ws src/kids-brain   # 889/889 passed
```

## How to Interpret Production Logs

Connect to the server log and run:
```
grep kids-start-diag <logfile>
```

### Scenario A — Bug confirmed: no DB row
```
[kids-start-diag] focus_start_received  {"hasSessionId":true,"hasUserId":true,...}
[kids-start-diag] checking_kids_session {...}
[kids-start-diag] kids_session_lookup_result {"rowsLength":0,...}
[kids-start-diag] no_kids_session_row {...}
[kids-start-diag] falling_through_to_paid_guard {"reason":"no_kids_row"}
```
Root cause: the `POST /lesson/kids/start` was not called, OR used a different session ID, OR the row has `status='ended'`.
Action: check `#9 kids_session_created` — does `sessionId` match the `#1` log?

### Scenario B — sessionId missing on WS connect
```
[kids-start-diag] focus_start_received {"hasSessionId":false,...}
[kids-start-diag] falling_through_to_paid_guard {"reason":"no_session_id"}
```
Root cause: frontend sent `focus_lesson_start` without `sessionId` in the WS message or URL.

### Scenario C — Kids path taken correctly
```
[kids-start-diag] focus_start_received {...}
[kids-start-diag] checking_kids_session {...}
[kids-start-diag] kids_session_lookup_result {"rowsLength":1,...}
[kids-start-diag] routing_to_kids_brain_v1 {...}
```
No `falling_through_to_paid_guard` line. Bug not reproduced.

### Scenario D — DB exception
```
[kids-start-diag] kids_session_lookup_error {"errorName":"…","errorMessage":"…"}
[kids-start-diag] falling_through_to_paid_guard {"reason":"kids_lookup_error"}
```
Root cause: DB unavailable or query error. Check errorMessage.

## Next Decision Tree

```
Did #9 kids_session_created fire?
├─ NO → /lesson/kids/start was never called or failed. Check HTTP layer.
└─ YES → Does sessionId in #9 match sessionId in #1?
         ├─ NO → sessionId mismatch between HTTP and WS. Frontend bug.
         └─ YES → What does #3 kids_session_lookup_result show?
                  ├─ rowsLength=0 → Row deleted or status='ended' between create and WS connect.
                  │                  Check if another code path ends the session prematurely.
                  ├─ rowsLength=1 AND #5 routing_to_kids_brain_v1 fired → Kids path taken. Not the bug.
                  └─ rowsLength=1 AND owner_mismatch → userId stored at create ≠ userId on WS auth.
                                                        JWT/auth issue.
```
