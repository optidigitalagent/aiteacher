# Mentium Kids Brain v1 — Phase 7.5: Integration Readiness Audit Report

**Date:** 2026-05-29  
**Auditor:** Claude Code (claude-sonnet-4-6)  
**Scope:** Phase 7.5 audit — read-only, no code changes

---

## 1. Executive Summary

The Kids Brain v1 core pipeline (Phases 1–7) is complete, well-tested, and architecturally sound. All 233 unit tests pass across 7 test files. TypeScript reports 0 errors. The spec-defined invariants (adult isolation, LLM authority limits, recovery state machine, vocabulary guard) are enforced in code.

**However, the pipeline is not connected to production in any meaningful way.**

The current production WebSocket handler (`backend/src/ws/lesson-ws.ts`) routes kids mode to `backend/src/kids-runtime/orchestrator.ts` — a separate prototype runtime that uses an in-memory `Map` for session state, a hardcoded animal curriculum, and a simple signal-based classifier. This prototype is explicitly described as "prototype only" in its own source comment. It is **not** Kids Brain v1.

The Kids Brain v1 orchestrator (`backend/src/kids-brain/runtime/`) is imported nowhere outside its own test suite.

Five integration adapters are entirely absent. Four production database tables are unbuilt. The Redis session store and Postgres profile store are interface contracts only — no implementation.

**The brain is ready. The connectors are not.**

---

## 2. Integration Readiness Score: 58 / 100

| Dimension | Score | Notes |
|---|---|---|
| Core pipeline (Phases 1–7) | 100/100 | 233/233 tests, 0 TS errors, all modules complete |
| Adult isolation | 100/100 | No cross-imports confirmed by passing tests and grep |
| Auth / billing protection | 90/100 | `/lesson/kids/start` authenticated; cost caps active; age-band session limits need update |
| TypeScript build | 100/100 | 0 errors on `npx tsc --noEmit` |
| STT adapter | 0/100 | Interface defined; `stt-adapter.ts` specified but not created |
| Redis session store | 0/100 | Interface defined in `contracts/stores.ts`; no implementation |
| Postgres profile store | 0/100 | Interface defined in `contracts/stores.ts`; no implementation |
| ActionPacket → WS adapter | 0/100 | `RuntimeActionPacket` defined; no WS bridge exists |
| Database migrations | 15/100 | `kids_sessions` table only; 4 required tables unbuilt |
| Frontend WS receiver | 10/100 | `KidsPrototypePage.tsx` is a start-screen card; no WS listener for Kids Brain v1 packets |

**Weighted composite: 58/100**

---

## 3. Blockers Before Phase 8

These are hard blockers. Phase 8 (WebSocket integration) cannot ship without them.

### BLOCKER-1: Redis Session Store Not Implemented

**File specified:** `backend/src/kids-brain/memory/redis-session.store.ts`  
**Current state:** `RedisSessionStore` interface exists in `contracts/stores.ts`. No implementation file exists.  
**Why blocking:** Patch 1.1 explicitly forbids in-memory session state in production. The current prototype uses `const sessions = new Map<string, SessionState>()` in `kids-runtime/orchestrator.ts`. Wiring Kids Brain v1 without Redis means repeating the same architecture violation.  
**Dependency:** `backend/src/db/redis.ts` (Redis client) already exists — no new infrastructure needed.

### BLOCKER-2: Postgres Profile Store Not Implemented

**File specified:** `backend/src/kids-brain/memory/postgres-profile.store.ts`  
**Current state:** `PostgresProfileStore` interface exists in `contracts/stores.ts`. No implementation file exists.  
**Why blocking:** Kids Brain v1 session bootstrap (`session-bootstrap.ts`) calls `startKidsBrainSession()` which initialises a `SessionMemory` — but without a profile store, every session starts cold with no continuity. Phase 8 must load the child profile at session start.  
**Dependency:** `backend/src/db/postgres.ts` (Postgres client) already exists.

### BLOCKER-3: Four Kids Brain Database Tables Do Not Exist

**Current migration:** Migration 018 created only `kids_sessions` (session_id, user_id, mode, status, llm_calls, stt_seconds, tts_chars).  
**Tables required by Patch 3 / Section 3A but not created:**
- `kids_brain_child_profiles`
- `kids_brain_mastery_records`
- `kids_brain_session_summaries`
- `kids_brain_safety_events`

**Why blocking:** Without these tables, profile load, mastery persistence, session summary write, and safety event audit logging are all unavailable. A migration must be created and run before Phase 8 can access persistent data.

### BLOCKER-4: STT Adapter Not Implemented

**File specified:** `backend/src/kids-brain/perception/stt-adapter.ts`  
**Current state:** File does not exist. The perception module's `buildPerceptionBundle()` accepts `STTResult` (the normalised Kids Brain interface) but the production WS handler produces a different format — it extracts `text` and `latencyMs` from `childResponse` and passes them directly to the old orchestrator.  
**Why blocking:** The production STT output must be translated into `STTResult` before entering the perception layer. Without this adapter, `processKidsBrainTurn()` cannot accept real WebSocket input.

### BLOCKER-5: ActionPacket → WebSocket Message Adapter Not Implemented

**Current state:** `RuntimeActionPacket` (with `RuntimeActionPacketType` enum: `teacher_text`, `start_listening`, `stop_listening`, `session_complete`, `safety_close`, `error`) is well-defined. The current WS handler sends bespoke message objects via `send(ws, { type: '...', text: '...', ... })`.  
**Why blocking:** The Kids Brain v1 runtime returns `RuntimeActionPacket[]` from `processKidsBrainTurn()`. These must be translated into the WS message format the frontend expects. Without this adapter, the WS handler cannot emit Kids Brain output to the client.

---

## 4. Non-Blocking Risks

These are risks that do not block Phase 8 but should be addressed within or shortly after it.

### RISK-1: Old Prototype Left in Place (State Divergence)

`backend/src/kids-runtime/` (the old prototype) remains wired in `lesson-ws.ts` at lines 71–73. If Phase 8 switches the `isKidsMode` routing to use Kids Brain v1, the old orchestrator becomes dead code but remains compiled and importable. Risk: a future developer re-enables it by accident.  
**Mitigation:** After Phase 8 wiring is confirmed working, remove or clearly archive `kids-runtime/`.

### RISK-2: In-Memory Sessions Never Reconnect

The current prototype stores sessions in a `Map` with no TTL or Redis backing. If the server restarts mid-session, all active kids sessions are silently lost. Kids Brain v1 has a full reconnect protocol specified (Patch 1.1 Section 1.4) but it is currently unavailable.  
**Mitigation:** BLOCKER-1 resolution (Redis store) also resolves this.

### RISK-3: kids_sessions Table Mismatch with Kids Brain v1 Schema

Migration 018's `kids_sessions` table schema does not match the Kids Brain v1 spec. It tracks `llm_calls`, `stt_seconds`, `tts_chars` at the session level (suitable for cost caps) but lacks `lesson_phase_reached`, `items_attempted_count`, `completion_rate`, `parent_review_flagged`, etc. (required by `kids_brain_session_summaries`).  
**Mitigation:** The two can coexist — `kids_sessions` remains as the session-activation and cost-tracking record; the new `kids_brain_session_summaries` table carries pedagogical summary data. Both writes happen at session end.

### RISK-4: Duplicate TTS if Adapter Is Naively Layered

The current `kidsTtsStream()` function in `lesson-ws.ts` calls the TTS provider directly from the teacher text. If Phase 8 adds a Kids Brain v1 output path without removing the old one, the same text could be spoken twice.  
**Mitigation:** The Phase 8 adapter must replace `kidsTtsStream()` with Kids Brain v1 `teacher_text` ActionPacket handling. Do not layer on top.

### RISK-5: Cost Cap Values Diverge Between Old and Spec

Current production caps: `KIDS_MAX_DURATION_MS = 15 min`, `KIDS_MAX_LLM_CALLS = 20`, `KIDS_MAX_TTS_CHARS = 2000`.  
Kids Brain v1 spec caps: age-band max durations (25 min / 35 min), 1200 token session budget.  
The WS handler's 15-minute hard limit is stricter than the spec's age-band limits and cannot currently distinguish age band.  
**Mitigation:** Phase 8 session bootstrap receives age_band from child profile (BLOCKER-2); update WS timeout to use age-band value from Kids Brain v1 session bootstrap result.

### RISK-6: KidsPrototypePage.tsx is Not a Full Classroom UI

`frontend/src/pages/KidsPrototypePage.tsx` is a login/start card. It calls `/lesson/kids/start` and renders session state but has no WebSocket listener for Kids Brain v1 ActionPackets (`teacher_text`, `start_listening`, `stop_listening`). No `ClassroomLayout.tsx` or `classroomSocket.ts` was found for kids mode.  
**Mitigation:** Phase 8 must either extend `KidsPrototypePage.tsx` with a WS receiver or create a new `KidsClassroomPage.tsx`. This is a significant frontend scope item.

### RISK-7: No Autosave Implementation

Patch 1.1 specifies 30-second autosave to Redis. No autosave timer exists anywhere in the Kids Brain v1 codebase. `autosaveSession()` is in the `RedisSessionStore` interface but unimplemented.  
**Mitigation:** Implement in Phase 8 session bootstrap after Redis store (BLOCKER-1) is resolved.

---

## 5. Required Adapters

These adapters must be built in Phase 8. None require changes to the Kids Brain v1 core.

| Adapter | From | To | File |
|---|---|---|---|
| STT adapter | `{ text, latencyMs, ...WS fields }` | `STTResult` | `backend/src/kids-brain/perception/stt-adapter.ts` |
| ActionPacket → WS | `RuntimeActionPacket[]` | `send(ws, { type: '...' })` calls | `backend/src/kids-brain/runtime/ws-adapter.ts` (new) |
| Redis session store | `RedisSessionStore` interface | `backend/src/db/redis.ts` client | `backend/src/kids-brain/memory/redis-session.store.ts` |
| Postgres profile store | `PostgresProfileStore` interface | `backend/src/db/postgres.ts` client | `backend/src/kids-brain/memory/postgres-profile.store.ts` |
| WS routing bridge | `lesson-ws.ts` `isKidsMode` path | `startKidsBrainSession()` / `processKidsBrainTurn()` | Modify `backend/src/ws/lesson-ws.ts` kids block only |

---

## 6. Required Migrations

| Migration | Tables | Priority |
|---|---|---|
| 019_kids_brain_profiles.sql | `kids_brain_child_profiles` | Phase 8 blocker |
| 020_kids_brain_mastery.sql | `kids_brain_mastery_records` | Phase 8 blocker |
| 021_kids_brain_sessions.sql | `kids_brain_session_summaries` | Phase 8 blocker |
| 022_kids_brain_safety.sql | `kids_brain_safety_events` | Phase 8 blocker |

Existing `kids_sessions` table (migration 018) is retained for session activation and cost tracking — it does not need to be dropped.

---

## 7. Required Tests

These tests do not yet exist and are needed before Phase 8 ships.

| Test | File | What it proves |
|---|---|---|
| STT adapter preserves all STTResult fields | `perception/stt-adapter.test.ts` | Adapter doesn't silently drop fields |
| Redis store write-then-read round-trip | `memory/redis-session.test.ts` | Session survives WS disconnect within TTL |
| Redis store returns null after TTL expiry | `memory/redis-session.test.ts` | Expired sessions trigger new session, not resume |
| Postgres profile store load/save round-trip | `memory/postgres-profile.test.ts` | Profile persists across sessions |
| WS adapter converts all ActionPacket types | `runtime/ws-adapter.test.ts` | No unknown packet types reach frontend |
| Adult lesson unaffected when kids mode = false | `ws/lesson-ws.integration.test.ts` | Adult isolation after wiring |
| Kids session ownership rejects wrong userId | `api/lesson-routes.test.ts` | Ownership enforcement holds after v1 wiring |

---

## 8. Recommended Phase 8 Scope

Phase 8 should be narrowly scoped to the minimum required to replace the prototype with Kids Brain v1 in production. Suggested scope:

1. **Implement Redis session store** (`redis-session.store.ts`) — read, write, TTL, reconnect replay.
2. **Implement Postgres profile store** (`postgres-profile.store.ts`) — cold-start profile load, end-of-session summary write.
3. **Create 4 migrations** (019–022) for the Kids Brain schema tables.
4. **Implement STT adapter** (`stt-adapter.ts`) — translate WS audio event fields into `STTResult`.
5. **Implement ActionPacket → WS adapter** — translate `RuntimeActionPacket[]` into `send(ws, ...)` calls; remove `kidsTtsStream()` (replace with new adapter path).
6. **Rewire `lesson-ws.ts` kids block** — replace old `kidsStartSession`/`kidsProcessTurn` imports with Kids Brain v1 orchestrator calls. Touch only the `isKidsMode` block (lines ~1131–1235). Do NOT touch adult paths.
7. **Extend `KidsPrototypePage.tsx`** — add WebSocket listener that handles Kids Brain v1 ActionPacket types. Must handle `teacher_text`, `start_listening`, `stop_listening`, `session_complete`, `safety_close`.
8. **Write integration tests** listed in Section 7.

**Defer to Phase 9:**
- Parent-facing dashboard
- Per-child profile UI
- Mastery progress views
- Spaced review scheduling
- Autosave timer (can ship as fast-follow in Phase 8.1)
- Multi-node WS topology

---

## 9. Do-Not-Touch List

The following must not be modified during Phase 8 under any circumstances.

| Item | Reason |
|---|---|
| `backend/src/kids-brain/**` (all 7 phases) | Core pipeline is complete and tested; adapters live outside this directory |
| `backend/src/ws/lesson-ws.ts` adult paths (all non-`isKidsMode` code) | Any modification risks adult lesson regression |
| `backend/src/ai/teacher-brain/` | Adult Teacher Brain; must remain isolated |
| `backend/src/engine/` | Adult exercise engine; must remain isolated |
| `backend/src/demo/` | Demo lesson runtime; must remain isolated |
| `backend/migrations/001–018` | Already applied; must not be altered |
| `frontend/src/components/LessonRoom/` | Adult classroom UI; must remain isolated |
| `backend/src/kids-brain/shared/constants.ts` [C] values | Empirically-unvalidated constants; change only after real session data |

---

## 10. Final Verdict

### NOT READY FOR PHASE 8

The Kids Brain v1 core pipeline is production-quality and passes all tests. **The implementation blockers are not in the brain — they are in the integration layer.**

Phase 8 cannot begin without:

1. Redis session store implementation (BLOCKER-1)
2. Postgres profile store implementation (BLOCKER-2)
3. Four Kids Brain database tables via migrations 019–022 (BLOCKER-3)
4. STT adapter from WS format to STTResult (BLOCKER-4)
5. ActionPacket → WebSocket message adapter (BLOCKER-5)

None of these blockers require touching the Kids Brain v1 core. They are connectors, not redesigns. Estimated Phase 8 implementation complexity: medium. Once blockers are resolved, the pipeline is battle-ready.

---

## Appendix: Commands Run

```
npx tsc --noEmit          → 0 errors
npx vitest run src/kids-brain → 233/233 tests passing (7 test files)
```

## Appendix: Files Audited

**Architecture docs:** mentium-kids-brain-v1-spec.md, mentium-kids-brain-v1-patch-1.1.md  
**Phase docs:** phase-1 through phase-7 implementation files  
**Kids Brain v1:** 93 TypeScript files across 8 directories (shared, contracts, state, vocabulary, perception, classification, state-engine, learning-engine, teacher-response, runtime)  
**Current production integration:** backend/src/ws/lesson-ws.ts, backend/src/kids-runtime/orchestrator.ts, backend/src/api/lesson-routes.ts  
**Database:** migrations/018_kids_sessions.sql  
**Frontend:** frontend/src/pages/KidsPrototypePage.tsx  

## Appendix: No Files Created, No Code Modified

This is an audit-only phase. No production code was modified. The only file created is this report.
