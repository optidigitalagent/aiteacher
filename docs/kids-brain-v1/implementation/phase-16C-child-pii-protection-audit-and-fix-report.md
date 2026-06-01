# Phase 16C — Child PII Protection Audit & Fix Report

Date: 2026-06-01

## Files Modified

| File | Change |
|------|--------|
| `backend/src/kids-brain/infrastructure/postgres-profile.store.ts` | Redact firstName at save (empty buffer) and at read ('friend'); update comment |
| `backend/src/kids-brain/infrastructure/__tests__/infrastructure-contracts.test.ts` | Update save test to assert empty buffer; add read test asserting 'friend' return |
| `backend/src/kids-brain/runtime/__tests__/phase-16c-child-pii-protection.test.ts` | New — 20 PII protection tests |

## PII Fields Found

| Field | Location | Risk Level | Status |
|-------|----------|------------|--------|
| `firstName` in `ChildProfile` | postgres-profile.store.ts | **Critical** | Fixed — not written or read |
| `childFirstName` in `KidsBrainTurnInput` | runtime-types.ts | Low | Safe — optional, WS always passes 'friend' |
| `childFirstName` in `KidsBrainSilenceInput` | runtime-types.ts | Low | Safe — optional, falls back to 'friend' |
| `childFirstName` in `KidsBrainSessionStartInput` | runtime-types.ts | Low | Safe — never stored in SessionMemory or Redis |
| `childFirstName` in `TeacherResponseContext` | teacher-response-types.ts | Low | Safe — set to 'friend' via `?? 'friend'` fallback |
| `childFirstName` in `LlmTeacherContext` | shared/types.ts | Forward risk | LLM not called in v1; field documented |
| `childFirstName` in `LLMTeacherInput` | llm-teacher-contract.ts | Forward risk | Interface only; no real LLM in v1 |

## Unsafe Locations Found

### Critical (Fixed)
1. **`postgres-profile.store.ts:saveChildProfile`** — `Buffer.from(profile.firstName, 'utf-8')` wrote plaintext name bytes to `first_name_encrypted` column. Column name is misleading — no encryption was applied (just UTF-8 → bytes). This is the blocker identified in Phase 16A.

2. **`postgres-profile.store.ts:rowToProfile`** — `row.first_name_encrypted.toString('utf-8')` decoded and returned the stored bytes as a plaintext string. Any caller of `getChildProfile` received the real child name.

### Already Safe (No Change Required)
- `SessionMemory` (Redis): no `childFirstName` field — only `childId` (opaque UUID)
- `SessionSummary`: only `childId`, no name
- `MasteryRecord`: only `childId`, no name
- `lesson-ws.ts`: always passes `childFirstName: 'friend'` (hard-coded display-safe value)
- `session-bootstrap.ts` log: only logs `childId`, `ageBand`, `lessonTargetWords.length`
- `session-analytics.ts` logs: only log session IDs and counts

## Exact Fix

### `postgres-profile.store.ts`

**Comment updated** (top of file):
```
Phase 16C PII minimization: firstName is NOT persisted.
An empty buffer is written to first_name_encrypted and 'friend' is returned on reads.
Real encryption (AES-256-GCM) is deferred to a future phase.
childId is the only opaque identifier used for analytics linkage.
```

**`saveChildProfile` — line ~40** (before):
```typescript
const firstNameBytes = Buffer.from(profile.firstName, 'utf-8');
```
After:
```typescript
// Phase 16C: do not persist real name — write empty buffer.
const firstNameBytes = Buffer.alloc(0);
```

**`rowToProfile` — line ~240** (before):
```typescript
firstName: row.first_name_encrypted.toString('utf-8'),
```
After:
```typescript
firstName: 'friend', // Phase 16C: real name not decoded — display-safe fallback only
```

## What Remains Intentionally Deferred

| Item | Reason | Future Phase |
|------|--------|-------------|
| AES-256-GCM encryption for `first_name_encrypted` | Requires key management infrastructure not in v1 scope | Phase 17+ |
| `LLMTeacherInput.childFirstName` enforcement | No real LLM calls in v1; interface only | When LLM is wired |
| Parental consent flow for onboarding real names | UI/UX scope; Phase 16C is backend-only | Future UI phase |
| Audit log for who accessed child profiles | Compliance tooling; not in v1 scope | Future compliance phase |

## Tests Added

### New file: `phase-16c-child-pii-protection.test.ts` (20 tests)

| Test group | Tests |
|------------|-------|
| Postgres store: does not persist real firstName | 2 |
| Postgres store: returns 'friend' on read | 2 |
| Analytics: SessionSummary has no firstName | 2 |
| Analytics: mastery records have no firstName | 2 |
| childId preserved in analytics | 2 |
| Runtime: works without childFirstName | 2 |
| Teacher response context: 'friend' fallback | 2 |
| lesson-ws.ts: passes 'friend' not a real name | 2 |
| SessionMemory schema: no childFirstName field | 2 |
| Session start log: omits child name | 2 |

### Updated: `infrastructure-contracts.test.ts` (+1 test)
- Existing save test: updated assertion to expect empty buffer (not real name bytes)
- New test: `getChildProfile returns "friend" as firstName regardless of stored bytes`

## Commands Run

```
cd backend
npx tsc --noEmit
npx vitest run src/kids-brain
npx vitest run src/ws
```

## Test Results

```
npx tsc --noEmit: 0 errors

npx vitest run src/kids-brain:
  Test Files  31 passed (31)
  Tests       870 passed (870)

npx vitest run src/ws:
  Test Files  1 passed (1)
  Tests       12 passed (12)

Total: 882/882 passing
```

(Previous: 861/861 — added 21 new tests: 20 new + 1 updated in infrastructure-contracts)

## Remaining Risks

| Risk | Severity | Notes |
|------|----------|-------|
| Existing DB rows with real names | Medium | Rows written before Phase 16C have real names stored. `rowToProfile` now always returns 'friend', so the data is never exposed via API. Purge/migration is a future task. |
| `firstName` field in `ChildProfile` interface | Low | The TypeScript type still accepts a real name from callers. Callers are free to pass real names — they just won't be stored. Could be tightened in a future phase by changing the type to `'friend'` literal or removing the field. |
| `LLMTeacherInput.childFirstName` | Low | If LLM is wired in a future phase and a real name is passed, it would be sent to the AI provider. Must enforce 'friend' at the LLM wiring point. |

## Next Required Phase

**Phase 16D** — Kids Brain UI readiness:
- A minimal kids-facing UI (or internal test harness) to confirm end-to-end lesson flow works for a human tester
- Phase 16A rated "no kids UI" as a critical blocker (score contribution: 15/100)
- Current system is READY FOR INTERNAL ADULT QA on backend, but cannot be child-tested without a UI
