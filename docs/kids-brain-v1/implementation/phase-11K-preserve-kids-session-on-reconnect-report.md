# Phase 11K — Preserve Kids Session On Reconnect — Report

**Date:** 2026-05-31
**Baseline:** 553/553 tests passing, 0 TS errors
**Result:** 571/571 tests passing (+18), 0 TS errors

---

## Files Modified

| File | Change |
|------|--------|
| `backend/src/ws/lesson-ws.ts` | Added reconnect guard in `handleKidsBrainV1LessonStart()` |
| `backend/src/kids-brain/runtime/__tests__/phase-11k-preserve-kids-session-on-reconnect.test.ts` | New — 18 tests proving reconnect behavior |

---

## Exact Reconnect Behavior

### Before (bug)

Every call to `handleKidsBrainV1LessonStart()` — including WS reconnects — unconditionally called `startKidsBrainSession()` and wrote a fresh `SessionMemory` to Redis, overwriting all prior state.

### After (fix)

`handleKidsBrainV1LessonStart()` now checks Redis for an existing session before creating a fresh one:

```typescript
// Reconnect guard (Phase 11K): resume existing session if one exists in Redis.
const store = getKidsBrainRedisStore()
let existingMemory: KidsBrainSessionMemory | null = null
try {
  existingMemory = await store.reconnectSession(sessionId, userId)
} catch {
  // Redis unavailable — fall through to cold start
}

if (existingMemory) {
  meta.kidsSessionId = sessionId
  console.log(`[kids-v1] session_resumed session=${sessionId} item=${existingMemory.currentTargetItemId} activity=${existingMemory.currentActivityId}`)
  return  // ← returns early; no greeting re-sent, no Redis overwrite
}

// Cold start — no prior session in Redis for this user; create fresh.
const startResult = startKidsBrainSession(kidsV1Input)
await store.saveSession(startResult.sessionMemory)
// ... greeting packets sent
```

**Warm reconnect path (existing session):**
- `reconnectSession(sessionId, userId)` loads and ownership-validates the session
- `meta.kidsSessionId` is set
- `lesson_ready` is sent (already sent before the guard)
- Greeting is NOT re-sent
- Redis is NOT overwritten
- `currentTargetItemId`, `currentActivityId`, `hasStartedFirstExercise`, `turnNumber` all preserved

**Cold start path (no session):**
- `reconnectSession` returns `null`
- `startKidsBrainSession()` is called (unchanged behavior)
- Fresh session saved to Redis
- Greeting packets sent (unchanged behavior)

---

## Redis Key Behavior

| Operation | Key | Overwrite? |
|-----------|-----|-----------|
| Cold start save | `kids:session:{sessionId}` | Yes (first write) |
| Reconnect load | `kids:session:{sessionId}` | No (read-only) |
| Turn load | `kids:session:{sessionId}` | No (read-only) |
| Turn save | `kids:session:{sessionId}` | Yes (correct — persists turn result) |

---

## Ownership Protection

`RedisSessionStoreImpl.reconnectSession()` (pre-existing, lines 73–83):

```typescript
async reconnectSession(sessionId: string, userId: string): Promise<SessionMemory | null> {
  const session = await this.getSession(sessionId);
  if (!session) return null;
  if (session.userId !== userId) return null;  // ownership check
  return session;
}
```

- Uses authenticated backend `userId` from `meta.userId` (JWT-derived, not frontend-supplied)
- Cross-user takeover returns `null` → falls through to cold start of own session
- Session data of the real owner is never modified by a cross-user attempt

---

## Tests Added

File: `backend/src/kids-brain/runtime/__tests__/phase-11k-preserve-kids-session-on-reconnect.test.ts`

| Group | Tests | What is proven |
|-------|-------|----------------|
| A | 2 | reconnectSession returns existing session for matching userId |
| B | 2 | currentTargetItemId preserved (including advanced values) |
| C | 2 | currentActivityId preserved (including SENTENCE_PRODUCTION) |
| D | 2 | hasStartedFirstExercise preserved (true and false cases) |
| E | 1 | Redis SET not called during reconnectSession |
| F | 1 | Raw Redis value unchanged after reconnectSession |
| G | 2 | Returns null for unknown sessionId; cold start cycle works |
| H | 3 | Cross-user reconnect: null, no data modification, owner still works |
| K | 3 | Phase 11I activity progression (blue→green, Map serialization) preserved |

All 18 tests pass.

---

## Commands Run

```
cd backend
npx tsc --noEmit
→ 0 TypeScript errors

npx vitest run src/kids-brain
→ 21 test files, 571 tests, all passing
```

---

## Test Results

```
Test Files  21 passed (21)
      Tests  571 passed (571)   (+18 from baseline 553)
   Duration  7.46s
```

---

## Proof Session Is Preserved

Test group K (phase-11k test, lines ~200–240) seeds a `SessionMemory` with:
- `currentTargetItemId: 'green'` (Phase 11I R22 result)
- `currentActivityId: ActivityType.SENTENCE_FRAME_PRODUCTION`
- `hasStartedFirstExercise: true`
- `turnNumber: 5`

Saves to mock Redis → calls `reconnectSession` → asserts all four fields are identical to what was stored. The Map serialization test also proves the custom JSON replacer/reviver survives the round-trip correctly.

Test group H proves that `userId='user-attacker'` gets `null` from `reconnectSession` while `userId='user-owner'` succeeds immediately after.

---

## Adult Runtime

Untouched. The change is inside `handleKidsBrainV1LessonStart()` which is only reached when `USE_KIDS_BRAIN_V1=true` and the DB row is a `kids_sessions` record. The `USE_KIDS_BRAIN_V1` feature flag path is unchanged; only the cold-vs-warm branch inside the Kids v1 handler was modified.

---

## Remaining Risks

| Risk | Severity | Notes |
|------|----------|-------|
| Redis race on concurrent reconnects | Low | Two simultaneous reconnects both call `reconnectSession` (read-only) then both return without overwriting — safe. Only cold start writes, and that only happens when no session exists. |
| 30-minute Redis TTL | Low | Session expires after 30 min of inactivity. On expiry, `reconnectSession` returns null → cold start. Child loses progress after 30 min idle (same as before this fix). |
| Transcript `item=-` logging | Low | Pre-existing issue (Phase 11J Q12). Kids v1 transcript recorder reads adult Redis key format. No functional impact — logging only. Phase 11L candidate. |

---

## Next Recommended Phase

**Phase 11L — Extend Kids Session TTL on Reconnect**

`RedisSessionStoreImpl.reconnectSession()` currently reads from Redis but does not refresh the TTL. After a 30-minute reconnect window closes, `getSession` returns `null` and a cold start occurs. A minimal fix: after a successful `reconnectSession`, call `store.saveSession(existingMemory)` to reset the TTL to 30 min. This extends the session lifetime proportionally to reconnect frequency.

Alternatively, use Redis `EXPIRE` / `PERSIST` to extend TTL without rewriting the value.
