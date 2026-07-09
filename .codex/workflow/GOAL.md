# GOAL: Owner-only paid lesson access bypass

## Goal

Implement a backend-only paid lesson access exception for exactly
`artenon92@gmail.com`, so this account can start ordinary paid lessons and enter
the paid classroom without LiqPay payment or paid-minute limits.

## Implementation Context

- `/lesson/start` calls `getSubscription(userId)` before creating the lesson
  session and usage record.
- Paid classroom WebSocket entry also calls `getSubscription(userId)` in
  `checkAndLinkPaidSession`.
- Therefore the narrowest shared implementation point is
  `backend/src/billing/subscription-service.ts`.

## Scope Boundaries

- LiqPay code and Railway `LIQPAY_*` variables are intentionally untouched.
- Auth remains mandatory; the bypass is only after `requireAuth` has identified
  the user.
- The owner check uses the server-side `users.email` row, not client-provided
  frontend state.
- Production is changed only after Railway deploy approval.

## Validation Evidence

- `cd backend; npx vitest run src/billing/__tests__/subscription-service.test.ts --reporter=dot --silent`
  -> exit 0; 1 file passed; 4 tests passed.
- `cd backend; npx tsc --noEmit` -> exit 0.
- `cd backend; npx vitest run src/auth/__tests__/require-auth-guard.test.ts src/billing/__tests__/subscription-service.test.ts --reporter=dot --silent`
  -> exit 0; 2 files passed; 10 tests passed.
- `cd backend; npm test -- --reporter=dot --silent`
  -> exit 0; 65 files passed; 2131 tests passed.

## Current State

Owner-access code is deployed. During manual authenticated owner paid-lesson
smoke, a paid lesson runtime defect was found: TTS audio could truncate the
greeting, and Teacher Brain wording could contradict the backend cursor after
deterministic item progression. The runtime repair is implemented, tested,
committed as `a2c70bf1fe1e933762dd2ee38d9d4afd2db13635`, pushed to
`origin/main`, and deployed to Railway production:
backend `aiteacher` deployment `2cfe99c8-2ef2-4c8c-9dc3-4f439d41d576` and
frontend `aware-alignment` deployment `3af88065-c052-4577-831d-717841a9b69c`
are both `SUCCESS`. Automated health/log checks passed. A second authenticated
smoke run found additional production runtime defects: provider fallback could
leave turns text-only, queued turns could interleave, and lesson completion
could re-anchor to completed Exercise 1. The follow-up repair is implemented
and locally validated, committed as
`2d1535048b7ad49119e22f5d0ac59af3571bcacc`, pushed to `origin/main`, and
deployed to Railway production: backend `aiteacher` deployment
`c1d6d54d-c1d2-4558-80af-9a79a5ca8cd2` and frontend `aware-alignment`
deployment `ed41ec51-ed38-4708-8ce4-b4826ff4d8e2` are both `SUCCESS`.
Automated post-deploy health/log checks passed. Manual authenticated owner
paid lesson smoke showed improvement but found a remaining frontend microphone
UX gap versus demo: paid transcript visibility, pending-turn button behavior,
and typed-send interruption were not demo-equivalent. The mic UX parity repair
is implemented locally in `frontend/src/features/classroom/components/ClassroomLayout.tsx`
and `cd frontend; npm run build` passes, but it is not yet committed, deployed,
or production-smoked. A new Railway production deploy requires explicit
approval.
