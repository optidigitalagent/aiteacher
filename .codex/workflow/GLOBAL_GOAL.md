# GLOBAL_GOAL.md - Mentium AI Teacher

## ACTIVE GOAL

**Owner-only paid lesson access bypass - STARTED 2026-07-09**

Allow exactly `artenon92@gmail.com` to start and enter ordinary paid lessons
without LiqPay payment, subscription activation, or paid-minute limits.

**Paused goal:** Ordinary Mentium lesson mode production smoke remains paused
behind this scoped owner-access request. Kids Personalization V2 remains paused.

---

## SCOPE

In scope:
- Backend subscription/access checks used by ordinary paid lesson start and
  paid classroom WebSocket entry.
- Tests proving the bypass is restricted to `artenon92@gmail.com`.

Out of scope:
- LiqPay checkout, callback, payment creation, public/private key config, or
  payment activation.
- Authentication changes.
- Frontend UI changes.
- Kids Brain, STT/TTS, prompt, and curriculum behavior changes.
- Railway deployment unless explicitly approved.

---

## ACCEPTANCE CRITERIA

- [x] `artenon92@gmail.com` receives active paid-lesson access from the backend
  subscription gate even when no paid profile/subscription exists.
- [x] Email matching is case-insensitive and trims surrounding whitespace.
- [x] Non-owner users without a paid profile still receive no subscription and
  remain blocked by the existing paid lesson gates.
- [x] Existing paid subscriptions for non-owner users preserve their real
  status, expiry, and remaining-minute calculation.
- [x] LiqPay checkout/callback/key handling is unchanged.
- [x] Auth remains required; no unauthenticated paid lesson access is added.
- [x] Targeted billing/auth tests pass.
- [x] Backend TypeScript compiles.
- [x] Full backend test suite passes.
- [x] Railway production deploy is completed after explicit approval.
- [ ] Production owner account smoke verifies `/lesson/start` and paid
  classroom entry without payment.

---

## PHASE SEQUENCE

| Phase | Name | Status |
|-------|------|--------|
| 0 | Intake and scope reconciliation | COMPLETE |
| 1 | Implement owner-only backend access | COMPLETE |
| 2 | Validate and review | COMPLETE |
| 3 | Deploy and production owner smoke | PARTIAL - owner bypass deployed; backend runtime repairs deployed; paid mic UX parity repair local, deploy/smoke pending |

---

## CURRENT CONSTRAINTS

- Do not touch LiqPay keys or payment flow per user instruction.
- Railway production deploy was explicitly approved and completed on
  2026-07-09.
- Local C: drive has no free space; npm commands must use
  `D:\codex-npm-cache` and `D:\codex-temp`.
- Follow-up runtime repair for paid lesson voice/state was deployed to Railway
  production on 2026-07-09 at commit
  `2d1535048b7ad49119e22f5d0ac59af3571bcacc`; automated health/log checks
  passed.
- Paid lesson microphone UX parity repair is implemented locally but not yet
  committed/deployed; a new production deploy requires explicit approval.
- Manual authenticated owner paid lesson voice verification remains required.
