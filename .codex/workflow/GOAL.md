# GOAL: Ordinary Mentium lesson mode production readiness

## Goal

Prioritize and verify the ordinary, non-Kids Mentium lesson mode for a
presentation-quality path. Kids work is paused by user request after live
production evidence showed a Kids progression loop.

## Current Evidence

- Backend TypeScript is green.
- Full backend suite is green.
- Ordinary demo/runtime targeted suite is green.
- Frontend production build is green.
- Production backend health is green.
- Production frontend `/demo/setup` is reachable.
- Production `/lesson/sections/status` is reachable and lists ready ordinary
  sections.

## Ordinary Flow Entry Points

- Demo setup UI: `frontend/src/components/demo/DemoSetup.tsx`.
- Demo start API: `POST /demo/start` in `backend/src/api/auth-routes.ts`.
- Demo classroom route: `/demo/classroom/:demoId`.
- Paid lesson start API: `POST /lesson/start` in
  `backend/src/api/lesson-routes.ts`.
- Paid classroom route: `/classroom/:sessionId`.
- Paid classroom WebSocket connects only outside demo mode in
  `frontend/src/features/classroom/components/ClassroomLayout.tsx`.

## Constraints

- Do not change Kids behavior unless the user re-prioritizes Kids.
- Do not change auth, billing, payment, STT/TTS config, or prompts unless a
  verified ordinary-flow blocker requires it and the user approves the scope.
- Do not use JWTs pasted in chat/console as credentials.
- Local npm commands must redirect cache/temp to D: while C: has no free space.

## Ready Sections

Production `/lesson/sections/status` currently returns HTTP 200 and includes
multiple ready ordinary sections. GOLD presentation candidates include:
`1.1`, `1.2`, `1.4`, `2.1`, `2.3`, `3.1`, `4.1`, `4.3`, `5.1`, `5.3`,
`6.1`, `6.3`, `7.1`, `7.3`, `8.1`, `8.3`.

## Next Implementation Direction

No product code change is justified by current evidence. The next action is
production smoke verification of ordinary mode:

1. Demo flow first, because it avoids paid lesson entitlement assumptions.
2. Paid ordinary textbook flow second, if valid auth/subscription is available.
3. Record exact blocker if auth/demo quota/subscription prevents verification.
