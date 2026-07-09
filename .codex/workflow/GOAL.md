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
- Production is not changed until a Railway deploy is explicitly approved.

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
smoke, a paid lesson runtime defect was found and repaired locally: ElevenLabs
TTS audio chunking could truncate the greeting, and Teacher Brain wording could
contradict the backend cursor after deterministic item progression. Local
TypeScript and the full backend suite pass. Deployment and production owner
smoke of this runtime repair are blocked until the user explicitly approves a
new Railway deploy.
