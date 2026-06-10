# Kids Mode Entry, Onboarding & Interest-Personalization
## Technical Design Document — Phase 0

**Version:** 1.0
**Status:** DRAFT — awaiting multi-reviewer sign-off
**Prepared:** 2026-06-10
**Goal:** Build a full Kids Mode entry, onboarding, child profile, teacher selection,
and interest-personalization flow integrated into the main authenticated platform.

**Reviewers required before implementation:**
- [ ] planner — architecture sanity
- [ ] backend-reviewer — API, schema, auth gates
- [ ] frontend-reviewer — UX flow, component design
- [ ] curriculum-reviewer — personalization rules, safety
- [ ] kids-safety-monitor — content safety, auth enforcement
- [ ] qa-tester — test plan coverage

---

## 1. UX Flow

### 1.1 New User Flow (no child profile)

```
User opens app
  └─ Not logged in?
       └─ Redirect to login (Google OAuth or email)
  └─ Logged in
       └─ Sees main platform dashboard (HomePage or LearningPage)
            └─ Clicks "Kids Mode" button/section
                 └─ GET /api/kids/child-profile → 404 (no profile)
                      └─ Redirect to /kids/onboarding
                           └─ Onboarding Wizard
                                Step 1: Child name ("What's your child's name?")
                                Step 2: Child age (slider or select, 4–12)
                                Step 3: Teacher choice (2–3 persona cards)
                                Step 4: Interests (multi-select chips, max 5)
                                Step 5: Confirm summary card
                                     └─ POST /api/kids/child-profile
                                          └─ Success → redirect to /kids
                                               └─ POST /lesson/kids/start
                                                    └─ Navigate to /kids/classroom/:sessionId
```

### 1.2 Returning User Flow (profile exists)

```
Logged-in user clicks "Kids Mode"
  └─ GET /api/kids/child-profile → 200 (profile exists)
       └─ Show Kids Mode lobby (KidsPrototypePage refactored)
            ├─ "Start Lesson" button → POST /lesson/kids/start
            └─ "Edit Profile" link → /kids/profile/edit
```

### 1.3 Unauthenticated Access Attempt

```
User visits /kids directly (no token)
  └─ Frontend AuthGate detects no token
       └─ Redirect to login page with returnUrl=/kids
  └─ Backend: POST /lesson/kids/start without token → 401
  └─ Backend: GET /api/kids/child-profile without token → 401
  └─ WebSocket: focus_lesson_start without valid token → disconnect 4401
```

### 1.4 Edit Profile Flow

```
User at /kids/profile/edit
  └─ Loads existing profile (GET /api/kids/child-profile)
  └─ Same wizard UI, pre-filled
  └─ Submit → PUT /api/kids/child-profile
  └─ Redirect back to /kids lobby
```

---

## 2. Backend Flow

### 2.1 Profile Lifecycle

```
1. Onboarding form submitted (POST /api/kids/child-profile)
   └─ requireAuth middleware validates JWT
   └─ Validate request body (name, age, teacherId, interests)
   └─ Check: does profile already exist for this user_id?
        └─ Yes → return 409 CONFLICT (use PUT to update)
        └─ No → INSERT INTO kids_brain_child_profiles
   └─ Return { childId, childName, ageBand, teacherId, interests }

2. Profile retrieved at session start (lesson-ws.ts)
   └─ Query: SELECT * FROM kids_brain_child_profiles WHERE user_id = $1
   └─ If no profile → send error frame + close WS (prevent lesson without profile)
   └─ Load interests into Redis session state
   └─ Pass to Kids Brain orchestrator

3. Session proceeds with interests available
   └─ Teacher text generator receives { targetWord, interests[] }
   └─ Applies personalization rules (see Section 11)
```

### 2.2 Session Start Sequence (updated)

```
Client sends: { type: 'focus_lesson_start' }

lesson-ws.ts:
  1. Validate JWT → get userId
  2. Load KIDS_SESSIONS row → ownership check
  3. NEW: Load kids_brain_child_profiles WHERE user_id = userId
       └─ No profile → send error { code: 'NO_CHILD_PROFILE' } + close
       └─ Profile found → extract interests, teacherId, ageBand
  4. Store { interests, teacherId, ageBand } in Redis session state
  5. Initialize Kids Brain with profile context
  6. Send lesson_ready message (includes childName for personalized greeting)
```

---

## 3. Auth Gates

| Layer | Gate | Response |
|---|---|---|
| Frontend | AuthContext.isAuthenticated check on /kids route | Redirect to /login |
| Frontend | Onboarding page: check auth before showing form | Redirect to /login |
| Backend | GET /api/kids/child-profile | requireAuth → 401 |
| Backend | POST /api/kids/child-profile | requireAuth → 401 |
| Backend | PUT /api/kids/child-profile | requireAuth → 401 |
| Backend | POST /lesson/kids/start | requireAuth (existing) → 401 |
| WebSocket | focus_lesson_start without valid session | ws.close(4401) |
| WebSocket | focus_lesson_start with no child profile | ws.close(4403) NEW |
| WebSocket | STT/TTS | Only after session established (existing) |

**Critical rule:** No STT, TTS, or AI resources may be consumed before:
1. JWT validated
2. Child profile confirmed to exist
3. Kids session created and ownership verified

---

## 4. DB Schema / Migration Plan

### 4.1 Existing Table (migration 019)

`kids_brain_child_profiles` already has:
- `child_id` UUID PK
- `user_id` UUID NOT NULL
- `first_name_encrypted` BYTEA NOT NULL — encrypted name
- `age_band` VARCHAR(3) CHECK IN ('6-7', '8-9')
- `high_engagement_topics` TEXT[] — interests
- `preferred_character_id` VARCHAR(64) — teacher choice
- `safe_preferences` BOOLEAN
- `created_at`, `updated_at`

### 4.2 Migration 023 — Extend for Onboarding

**File:** `backend/migrations/023_kids_onboarding_fields.sql`

```sql
-- Migration 023: Add onboarding fields to kids_brain_child_profiles
-- Adds child_name (plain text display name) and child_age_years (exact age).
-- Existing first_name_encrypted and age_band columns remain unchanged.
-- Safe to run multiple times (IF NOT EXISTS / IF column does not exist).

ALTER TABLE kids_brain_child_profiles
  ADD COLUMN IF NOT EXISTS child_name      TEXT            CHECK (char_length(child_name) BETWEEN 1 AND 100),
  ADD COLUMN IF NOT EXISTS child_age_years INTEGER         CHECK (child_age_years BETWEEN 4 AND 14),
  ADD COLUMN IF NOT EXISTS teacher_id      VARCHAR(50)     NOT NULL DEFAULT 'lucy';

-- Backfill age_band from child_age_years (for rows that may exist already)
-- age_band is derived: 4–7 → '6-7', 8+ → '8-9' (simplification)
-- No automatic backfill needed — new rows will set both fields on INSERT.

COMMENT ON COLUMN kids_brain_child_profiles.child_name IS
  'Plain-text display name collected in onboarding wizard (e.g. "Alex"). Not encrypted at rest in this phase.';
COMMENT ON COLUMN kids_brain_child_profiles.child_age_years IS
  'Exact age in years from onboarding (4–14). age_band is derived from this.';
COMMENT ON COLUMN kids_brain_child_profiles.teacher_id IS
  'Selected teacher persona ID from onboarding (e.g. lucy, tom, default).';
```

**Notes:**
- `high_engagement_topics TEXT[]` (existing) is repurposed as the interests array.
- `preferred_character_id VARCHAR(64)` (existing) is superseded by new `teacher_id` column (simpler naming).
- Both old columns remain; `teacher_id` is the canonical field going forward.
- Migration is additive — no data loss, safe rollback.

### 4.3 Constraints

- `UNIQUE(user_id)` — **not yet enforced in existing schema** (only index exists).
  Add in migration 023: `ALTER TABLE kids_brain_child_profiles ADD CONSTRAINT uq_child_profile_user UNIQUE (user_id);`
- One child profile per parent account in this phase. Multi-child support deferred.

---

## 5. API Endpoints

All under `/api/kids/` prefix, all require `requireAuth` middleware.

### 5.1 GET /api/kids/child-profile

Returns child profile for authenticated user.

```
Request:  GET /api/kids/child-profile
Headers:  Authorization: Bearer <jwt>

Response 200:
{
  "childId": "uuid",
  "childName": "Alex",
  "childAgeYears": 7,
  "ageBand": "6-7",
  "teacherId": "lucy",
  "interests": ["roblox", "minecraft", "dinosaurs"],
  "safePreferences": true
}

Response 404: { "code": "NO_CHILD_PROFILE" }
Response 401: { "code": "UNAUTHENTICATED" }
```

### 5.2 POST /api/kids/child-profile

Creates child profile during onboarding.

```
Request:
{
  "childName": "Alex",       // string, 1–100 chars
  "childAgeYears": 7,        // integer, 4–14
  "teacherId": "lucy",       // string from TEACHER_IDS enum
  "interests": ["roblox"]    // string[], 0–5 items, from INTEREST_TAXONOMY
}

Response 201:
{
  "childId": "uuid",
  "childName": "Alex",
  ...
}

Response 409: { "code": "PROFILE_ALREADY_EXISTS" } — use PUT to update
Response 400: { "code": "VALIDATION_ERROR", "details": [...] }
Response 401: { "code": "UNAUTHENTICATED" }
```

### 5.3 PUT /api/kids/child-profile

Updates existing child profile (for editing).

```
Request: same shape as POST (all fields optional)
{
  "childName"?: "Alex",
  "childAgeYears"?: 8,
  "teacherId"?: "tom",
  "interests"?: ["minecraft", "pokemon"]
}

Response 200: updated profile
Response 404: { "code": "NO_CHILD_PROFILE" } — use POST first
Response 401: { "code": "UNAUTHENTICATED" }
```

### 5.4 Validation Rules (backend)

```typescript
const TEACHER_IDS = ['lucy', 'tom', 'default'] as const
const INTEREST_TAXONOMY = [
  'roblox', 'brawl_stars', 'minecraft', 'pokemon',
  'football', 'animals', 'cars', 'space',
  'dinosaurs', 'superheroes', 'princesses', 'drawing'
] as const
const MAX_INTERESTS = 5
const MIN_AGE = 4
const MAX_AGE = 14
```

All inputs validated and sanitized server-side. Frontend validation is UX only.

---

## 6. WebSocket / Session Integration

### 6.1 Existing Kids WS Flow (lesson-ws.ts)

Current `focus_lesson_start` handler:
1. Validates JWT
2. Loads KIDS_SESSIONS row
3. Checks ownership (user_id must match)
4. Initializes session in Redis
5. Starts Kids Brain

### 6.2 New Step: Profile Load at Session Start

Add between steps 2–3 of `focus_lesson_start`:

```typescript
// Load child profile
const profileResult = await query<{ child_name, child_age_years, teacher_id, high_engagement_topics }>(
  'SELECT child_name, child_age_years, teacher_id, high_engagement_topics FROM kids_brain_child_profiles WHERE user_id = $1',
  [meta.userId]
)
if (profileResult.rows.length === 0) {
  ws.send(JSON.stringify({ type: 'error', code: 'NO_CHILD_PROFILE' }))
  ws.close(4403, 'No child profile')
  return
}
const profile = profileResult.rows[0]
```

### 6.3 Session State Extension

Add to `KidsSessionMemory` (Redis session state):

```typescript
interface KidsSessionMemory {
  // ... existing fields ...
  childName:    string | null       // for personalized greeting
  childAge:     number | null       // for age-appropriate language
  teacherId:    string              // selected teacher persona
  interests:    string[]            // max 5 interest tags
}
```

### 6.4 Message Type: lesson_ready (updated)

Add to `lesson_ready` WS message:

```typescript
{
  type: 'lesson_ready',
  sessionId: string,
  childName: string,    // new — for greeting in UI
  teacherId: string,    // new — for avatar/persona in UI
  // ... existing fields ...
}
```

---

## 7. Child Profile Ownership Model

### 7.1 Rules

1. Every child profile has exactly one owner (`user_id` = authenticated user's ID).
2. A user can only read/write their own child profile.
3. Backend enforces: all queries include `WHERE user_id = $1` with `req.userId` from JWT.
4. No admin bypass in this phase.
5. No cross-user sharing or delegation.

### 7.2 Enforcement Points

| Location | Enforcement |
|---|---|
| GET /api/kids/child-profile | `WHERE user_id = req.userId` |
| POST /api/kids/child-profile | INSERT sets `user_id = req.userId` |
| PUT /api/kids/child-profile | `WHERE user_id = req.userId` |
| lesson-ws.ts (WS) | Query profile `WHERE user_id = meta.userId` |
| kids_sessions (existing) | `WHERE user_id = meta.userId` (owner_mismatch → 4401) |

### 7.3 Profile Deletion

Not in scope for this phase. Users cannot delete child profiles via UI.
Deletion is admin-only via DB. No API endpoint for deletion.

---

## 8. Interest Taxonomy

### 8.1 Allowed Interest Tags

| Category | Tags |
|---|---|
| Video games | `roblox`, `brawl_stars`, `minecraft`, `pokemon` |
| Sports | `football` |
| Nature | `animals`, `space`, `dinosaurs` |
| Creative | `drawing` |
| Stories/Characters | `superheroes`, `princesses` |
| Vehicles | `cars` |

**Total: 12 interest options**

### 8.2 UI Display Names

| Tag | Display label | Emoji |
|---|---|---|
| `roblox` | Roblox | 🎮 |
| `brawl_stars` | Brawl Stars | ⚔️ |
| `minecraft` | Minecraft | 🧱 |
| `pokemon` | Pokémon | ⭐ |
| `football` | Football | ⚽ |
| `animals` | Animals | 🐾 |
| `cars` | Cars | 🚗 |
| `space` | Space | 🚀 |
| `dinosaurs` | Dinosaurs | 🦕 |
| `superheroes` | Superheroes | 🦸 |
| `princesses` | Princesses | 👑 |
| `drawing` | Drawing | 🎨 |

### 8.3 Selection Rules

- Minimum: 0 (optional)
- Maximum: 5
- UI: chip multi-select, visually distinct when selected
- Interests can be updated anytime via profile edit

---

## 9. Teacher Selection Model

### 9.1 Teacher Personas (Phase 1)

| teacher_id | Display name | Description | Tone |
|---|---|---|---|
| `lucy` | Lucy | Energetic, playful | "You got it! Let's go!" |
| `tom` | Tom | Calm, encouraging | "Take your time. Well done." |
| `default` | Default | Neutral | Same as Lucy |

**Phase 1 limitation:** All personas use the same TTS voice (ElevenLabs configured
voice). Persona affects only teacher text flavor, not audio voice.
Multi-voice support deferred to future phase.

### 9.2 Teacher ID in Kids Brain

`teacherId` is stored in session state and may influence:
- Greeting text ("Hi, I'm Lucy! Let's learn English today!")
- Praise style ("You got it! That's amazing!" vs "Well done! Keep going.")
- Recovery language style

`teacherId` does NOT affect:
- targetWord
- escalation ladder content
- curriculum progression
- TTS voice configuration (same voice for all in Phase 1)

---

## 10. Kids Brain Integration Points

### 10.1 Session Context Object

Current `KidsBrainOrchestrator` receives per-turn:
- `sessionId`
- `transcript` (STT result)
- `sessionMemory` (Redis state)

After this feature, `sessionMemory` will additionally carry:
- `childName` — for personalized greetings
- `childAge` — for age-appropriate text length (existing `MAX_WORDS_BY_AGE` logic)
- `teacherId` — for text style
- `interests` — for light personalization

### 10.2 Integration in turn-processor.ts / teacher-response-router.ts

Add new function: `buildPersonalizedContext(interests: string[], targetWord: string): string | null`

This returns a short optional micro-context string OR null if interests are empty.

Example outputs:
- `"In Minecraft, you can find things that are blue!"` (interest: minecraft, target: blue)
- `null` (no interests, or target word doesn't map to any interest)

This string is injected into the teacher text ONLY at:
- Warm-up greetings
- Encouragement prompts (ENCOURAGEMENT tier)
- Recovery prompts (after SILENCE_LONG or WRONG_ANSWER)

It is NEVER injected into:
- Correctness evaluation
- Escalation ladder triggers
- Exercise completion logic
- targetWord selection

### 10.3 Lesson_ready Greeting

When session starts, Kids Brain generates a greeting using `childName` and `teacherId`:

```
"Hi [childName]! I'm [teacherDisplayName]! Are you ready to learn English today? Let's go!"
```

This is a pre-generated string, not an LLM call. Template-based.

---

## 11. How Interests Influence Teacher Text

### 11.1 Personalization Rules

The following table is authoritative. Implementation MUST follow exactly.

| Context | Personalization Allowed | Example |
|---|---|---|
| Warm-up greeting | Light mention | "Alex, I heard you like Roblox! Today we'll learn colours. Let's go!" |
| ENCOURAGEMENT tier | Optional mention | "Try again! In Roblox, can you find something blue? Say blue!" |
| Recovery (SILENCE_LONG) | Optional mention | "It's OK! Imagine a blue Minecraft block. Can you say blue?" |
| REPEAT_PROMPT tier | None | Standard prompt only |
| MODEL_ANSWER tier | None | Standard prompt only |
| MOVE_ON tier | None | Standard prompt only |
| Correctness evaluation | **FORBIDDEN** | Never use interests to decide if answer is correct |
| targetWord | **FORBIDDEN** | Interests never change the target word |
| Exercise completion | **FORBIDDEN** | Interests never complete or skip exercises |
| Escalation trigger | **FORBIDDEN** | Interests never change when escalation fires |

### 11.2 Personalization Limits

- Maximum 1 interest mention per teacher turn.
- Maximum 1 sentence (≤ 12 words) for the interest mention.
- Teacher must return to curriculum focus within same turn.
- Interest mention is always BEFORE the main instruction, not after.
- If no interests are set → no personalization, standard teacher text.

### 11.3 Implementation: buildPersonalizedContext()

```typescript
// Location: backend/src/kids-brain/teacher-response/interest-personalizer.ts

const INTEREST_CONTEXT_MAP: Record<string, (targetWord: string) => string | null> = {
  roblox:      (w) => `In Roblox, can you find something ${w}?`,
  minecraft:   (w) => `Imagine a ${w} Minecraft block!`,
  brawl_stars: (w) => `In Brawl Stars, some things are ${w}!`,
  pokemon:     (w) => `Some Pokémon are ${w}!`,
  football:    (w) => `A football pitch can be ${w}!`,
  animals:     (w) => `Some animals are ${w}!`,
  cars:        (w) => `Some cars are ${w}!`,
  space:       (w) => `Stars in space can be ${w}!`,
  dinosaurs:   (w) => `Some dinosaurs were ${w}!`,
  superheroes: (w) => `Some superheroes wear ${w}!`,
  princesses:  (w) => `Princesses love the colour ${w}!`,
  drawing:     (w) => `Can you draw something ${w}?`,
}

export function buildPersonalizedContext(
  interests: string[],
  targetWord: string,
  tier: 'encouragement' | 'recovery'
): string | null {
  if (!interests.length) return null
  // Rotate through interests to avoid repetition within a session
  // Use a simple hash of targetWord to deterministically pick one interest
  const idx = targetWord.charCodeAt(0) % interests.length
  const interest = interests[idx]
  const fn = INTEREST_CONTEXT_MAP[interest]
  return fn ? fn(targetWord.toLowerCase()) : null
}
```

**Safety constraint:** `targetWord` passed to this function is ALWAYS the
curriculum-defined `targetWord` from the exercise. It is never modified by this
function. The function returns CONTEXT ONLY — it does not modify state.

---

## 12. What Interests Are FORBIDDEN to Affect

This section lists explicit prohibitions. Any code that violates these must be rejected.

| Thing | Can interests affect it? |
|---|---|
| `targetWord` in any exercise | **NO** |
| `acceptedAnswers[]` | **NO** |
| `completionRule.type` | **NO** |
| `exerciseCorrectCount` | **NO** |
| `exerciseAttemptCount` | **NO** |
| `escalationLadder[]` items or order | **NO** |
| Whether MOVE_ON fires | **NO** |
| `currentExerciseId` or nextExerciseId | **NO** |
| Exercise type (LISTEN_AND_REPEAT vs LISTEN_AND_CHOOSE) | **NO** |
| STT evaluation (what counts as correct) | **NO** |
| Classification labels (CORRECT_CONFIDENT etc.) | **NO** |
| TTS voice or speed | **NO** |
| Lesson pacing or phase | **NO** |
| Which unit or lesson is taught | **NO** |
| Whether billing gate fires | **NO** |
| Whether auth check fires | **NO** |

Interests affect **ONLY** the optional text woven into teacher speech at
ENCOURAGEMENT and RECOVERY tiers — and even there, as an optional addition
that can be omitted without changing exercise logic.

---

## 13. Safety Rules

### 13.1 Content Safety

| Rule | Reason |
|---|---|
| Never discuss real game mechanics, levels, or online usernames | Privacy + age safety |
| Never roleplay as a copyrighted character (Mario, Pikachu, etc.) | Copyright + safety |
| Never use interest as core teaching character or replace teacher persona | Curriculum integrity |
| Interest mentions are always ≤ 1 sentence in teacher speech | Keeps focus on curriculum |
| No generated stories or narratives involving interest IPs | Copyright + safety |
| "Imagine" framing preferred over "In [game], you..." when possible | Lower IP exposure |

### 13.2 Access Safety

| Rule | Reason |
|---|---|
| No unauthenticated access to child profile API | Data protection |
| No unauthenticated access to Kids lesson | Resource protection |
| Child profile user_id always checked against JWT | Ownership protection |
| Interests stored server-side; frontend never authoritative | Backend-first |
| Child name not logged in production logs | Privacy |
| Interests not logged as PII in production logs | Privacy |

### 13.3 Interest Taxonomy Safety

The interest taxonomy is a closed list. Users cannot submit arbitrary strings.
Backend validates every interest tag against `INTEREST_TAXONOMY` enum.
Any unknown interest tag → 400 VALIDATION_ERROR.

---

## 14. Acceptance Criteria

| # | Criterion | Testable | How to verify |
|---|---|---|---|
| AC1 | Authenticated main platform has visible Kids Mode entry point | Yes | Visual inspection of HomePage/LearningPage |
| AC2 | Unauthenticated user cannot reach /kids lesson | Yes | GET /kids without token → login redirect |
| AC3 | Unauthenticated API call → 401 | Yes | curl POST /api/kids/child-profile (no token) → 401 |
| AC4 | New user entering Kids Mode is shown onboarding | Yes | GET /api/kids/child-profile → 404 → redirect to /kids/onboarding |
| AC5 | Returning user sees lobby, not onboarding | Yes | GET /api/kids/child-profile → 200 → lobby shown |
| AC6 | Onboarding collects name, age, teacher, interests | Yes | POST /api/kids/child-profile with all fields → 201 |
| AC7 | Backend validates and stores child profile | Yes | DB row exists after POST |
| AC8 | User cannot access another user's child profile | Yes | GET with userA token for userB profile → 404 |
| AC9 | Kids lesson cannot start without a child profile | Yes | WS focus_lesson_start → NO_CHILD_PROFILE → 4403 close |
| AC10 | Kids Brain receives child interests at session start | Yes | Redis session state contains interests[] after start |
| AC11 | Teacher uses interests as light personalization only | Yes | Interests appear in ENCOURAGEMENT turns but not in targetWord |
| AC12 | Kid's Box curriculum is unchanged (targetWord unaffected) | Yes | Unit test: interests[] → buildPersonalizedContext() does not modify targetWord |
| AC13 | Existing Kids Brain V1 acceptance guarantees remain intact | Yes | All 28 Run 5 criteria still pass |
| AC14 | Adult lesson flow has no regression | Yes | Adult WS path unchanged; Playwright B4 PASS |
| AC15 | TypeScript build exits 0 | Yes | npx tsc --noEmit |
| AC16 | npm test → all pass | Yes | npm test |
| AC17 | Production deploy verified | Yes | Railway deploy + health check |

---

## 15. Test Plan

### 15.1 Unit Tests (new, backend)

| Test file | What it tests |
|---|---|
| `kids-child-profile-api.test.ts` | POST creates profile, PUT updates, GET returns correct data |
| `kids-child-profile-api.test.ts` | GET without token → 401 |
| `kids-child-profile-api.test.ts` | POST wrong user_id scenario → cannot cross-access |
| `kids-child-profile-api.test.ts` | POST duplicate → 409 |
| `kids-child-profile-api.test.ts` | POST invalid interest tag → 400 |
| `kids-child-profile-api.test.ts` | POST age out of range → 400 |
| `interest-personalizer.test.ts` | buildPersonalizedContext() returns null when no interests |
| `interest-personalizer.test.ts` | buildPersonalizedContext() returns string when interests present |
| `interest-personalizer.test.ts` | buildPersonalizedContext() never modifies targetWord input |
| `interest-personalizer.test.ts` | Unknown interest tag returns null (graceful) |

### 15.2 Unit Tests (updated, backend)

| Test file | What it tests |
|---|---|
| `kids-brain-v1-real-ws-smoke.test.ts` | New: focus_lesson_start with no profile → ws.close(4403) |
| `kids-brain-v1-real-ws-smoke.test.ts` | New: focus_lesson_start with profile → session state includes interests |

### 15.3 Integration Tests

| Test | What it tests |
|---|---|
| Kids session start with profile | Profile loaded, interests in Redis state, lesson_ready message contains childName |
| Kids session start without profile | Error frame + ws close 4403 |
| Onboarding → session start full flow | POST profile → POST /lesson/kids/start → WS → lesson_ready |

### 15.4 Frontend Tests (manual / Playwright)

| Test | What it tests |
|---|---|
| Unauthenticated /kids visit | Redirect to login page |
| Authenticated / with no profile | Kids Mode button → onboarding wizard |
| Authenticated / with profile | Kids Mode button → Kids lobby |
| Onboarding form validation | Empty name → error shown |
| Profile edit | Change interests → PUT succeeds → profile updated |
| Adult flow regression | LearningPage, /classroom/:id unaffected |

### 15.5 Regression Tests

All existing 1866+ tests must continue to pass.
Kids Brain V1 Run 5 28/28 criteria must not regress.

---

## 16. Deployment Plan

### 16.1 Order of Operations

```
1. Run migration 023 on production DB
   - Additive only — no data loss
   - IF NOT EXISTS guards — safe to re-run

2. Deploy backend changes
   - New /api/kids/child-profile routes
   - Updated lesson-ws.ts (profile load at session start)
   - New interest-personalizer.ts
   - Updated KidsSessionMemory type

3. Deploy frontend changes
   - HomePage: Kids Mode entry button
   - KidsPrototypePage: check profile + lobby refactor
   - New KidsOnboardingPage
   - App.tsx: new /kids/onboarding route

4. Verify health check
   - GET /health → 200
   - GET /api/kids/child-profile (no token) → 401
   - GET /api/kids/child-profile (valid token, no profile) → 404

5. Smoke test onboarding flow
   - Login → Kids Mode button visible
   - Click → onboarding wizard loads
   - Complete wizard → profile created
   - Start lesson → Kids Brain receives profile

6. Monitor Railway logs for 10 minutes
   - No 500 errors
   - No migration failures
   - No regression in adult lesson path
```

### 16.2 Railway Environment Variables

No new env vars required in Phase 1. Teacher persona configuration is hardcoded.
Future: `KIDS_TEACHER_VOICES` env var for per-persona ElevenLabs voice IDs.

---

## 17. Rollback Risks

| Risk | Severity | Mitigation | Rollback |
|---|---|---|---|
| Migration 023 fails | P1 | IF NOT EXISTS guards; additive only | Re-run previous deploy; migration is idempotent |
| /api/kids/child-profile returns 500 | P2 | Unit tests before deploy | Remove new routes from server.ts; restart |
| lesson-ws.ts profile load blocks all Kids sessions | P1 | Feature flag: skip profile check if KIDS_REQUIRE_PROFILE=false | Set env var to false; restart |
| Frontend onboarding redirect loop | P2 | E2E test before deploy | Revert frontend deploy |
| Interest personalization breaks Kids Brain | P1 | Unit test confirms no state mutation; buildPersonalizedContext is pure | Set interests=[] in session; restart |
| Adult flow regression | P0 | Adult code paths not modified; Playwright B4 gates deploy | Immediate revert |

### 17.1 Feature Flag

Add `KIDS_REQUIRE_PROFILE=true` env var (default true in production).
When `false`: skip the NO_CHILD_PROFILE check — allows unblocked testing
with existing Kids sessions that pre-date this feature.
Remove after 1 week of stable production.

---

## 18. Implementation Phases

| Phase | What | Files changed |
|---|---|---|
| 0 | This design document | docs/ |
| 1 | Kids Mode entry point on main platform | frontend/src/pages/HomePage.tsx, LearningPage.tsx |
| 2 | Onboarding wizard frontend | frontend/src/pages/KidsOnboardingPage.tsx, KidsPrototypePage.tsx, App.tsx |
| 3 | Backend child profile API + migration | backend/migrations/023_*.sql, backend/src/api/kids-profile-routes.ts |
| 4 | Kids Brain integration (profile load + personalization) | backend/src/ws/lesson-ws.ts, backend/src/kids-brain/teacher-response/interest-personalizer.ts |
| 5 | Tests | backend/src/api/__tests__/kids-child-profile-api.test.ts, interest-personalizer.test.ts |
| 6 | QA + deploy | Railway |

---

## Review Sign-Off

This document requires approval from all reviewers below before Phase 1 implementation begins.

| Reviewer | Role | Status | Notes |
|---|---|---|---|
| planner | Architecture | PENDING | |
| backend-reviewer | API + schema | PENDING | |
| frontend-reviewer | UX flow | PENDING | |
| curriculum-reviewer | Personalization rules | PENDING | |
| kids-safety-monitor | Content safety | PENDING | |
| qa-tester | Test plan | PENDING | |
