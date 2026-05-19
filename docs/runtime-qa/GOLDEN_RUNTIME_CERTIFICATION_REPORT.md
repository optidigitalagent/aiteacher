# Golden Runtime Certification Report

**Generated:** 2026-05-19  
**Harness version:** 1.0  
**Test framework:** Playwright 1.60  
**Target sections:** 1.1, 1.2, 1.4, 2.1, 2.2, 2.3

---

## How to Run

### Prerequisites

| Requirement | Detail |
|---|---|
| Backend running | `http://localhost:4000` (or set `PLAYWRIGHT_BACKEND_URL`) |
| Frontend running | `http://localhost:5173` (or set `PLAYWRIGHT_BASE_URL`) |
| Test JWT | Set `PLAYWRIGHT_TEST_TOKEN` (see Auth Setup below) |
| Active subscription | The test user must have `subscription.status = 'active'` and `minutesRemaining > 0` |

### Run All Tests

```bash
npx playwright test
```

### Run Only Golden Runtime Tests

```bash
npx playwright test tests/golden-runtime/
```

### Run Only API Health Checks (No Auth Required)

```bash
npx playwright test --grep "Backend API health"
```

### Run Specific Section

```bash
npx playwright test --grep "Section 1.2"
```

### View Full HTML Report

```bash
npx playwright show-report
```

---

## Auth Setup

### Option A — Use a Real Test User (Recommended)

1. Create a test Google account  
2. Sign in at `/auth/callback`  
3. Activate a subscription (or set one directly in PostgreSQL)  
4. Copy the JWT from `localStorage.auth_token` in DevTools  
5. Set as env var:

```bash
export PLAYWRIGHT_TEST_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
npx playwright test
```

### Option B — Generate Token Directly (CI/Staging)

Generate a signed token using the backend JWT module:

```typescript
import { signToken } from './backend/src/auth/jwt.js'

const token = await signToken({
  userId:    'test-user-uuid',
  studentId: 'test-student-uuid',
  email:     'ci-test@example.com',
  name:      'CI Test User',
})
```

Then ensure the user exists in the DB with an active subscription:

```sql
INSERT INTO users (id, email, name) VALUES ('test-user-uuid', 'ci-test@example.com', 'CI Test');
INSERT INTO subscriptions (user_id, status, minutes_remaining, expires_at)
VALUES ('test-user-uuid', 'active', 9999, NOW() + INTERVAL '365 days')
ON CONFLICT (user_id) DO UPDATE
  SET status = 'active', minutes_remaining = 9999, expires_at = NOW() + INTERVAL '365 days';
```

### Missing PLAYWRIGHT_TEST_TOKEN

If the env var is missing, all section certification tests are **skipped** (not failed).  
The API health checks run without auth and will still report backend availability.

---

## Certification Rules

A section achieves **GOLD_CERTIFIED** only when ALL of these pass:

| Check | Description |
|---|---|
| `wsConnected` | WebSocket opens successfully |
| `lessonReady` | `lesson_ready` message arrives within 20s |
| `exerciseCardLoaded` | `exercise_cursor_updated` arrives within 45s of Begin Lesson |
| `visiblePayload` | Cursor contains non-empty `exerciseType` (not `unknown`) and `instruction` |
| `inputAvailable` | Text input is visible and editable |
| `wrongAnswerStays` | Wrong answer does not advance item/exercise cursor |
| `teacherSynchronized` | No phantom exercise jumps in cursor sequence |
| `noFatalErrors` | No `AUTH_ERROR`, `SESSION_EXPIRED`, or `LESSON_TAKEN_OVER` WS errors |

A section is **SILVER** if WS connects and exercise loads but one secondary check fails.  
A section is **BLOCKED** if WS fails, `lesson_ready` never arrives, or a fatal error occurs.

---

## Test Files

| File | Purpose |
|---|---|
| `playwright.config.ts` | Playwright config — timeouts, base URLs, reporter |
| `tests/golden-runtime/helpers.ts` | Auth injection, lesson API, `WsMonitor`, answer submission |
| `tests/golden-runtime/golden-sections.spec.ts` | All certification tests |
| `docs/runtime-qa/GOLDEN_RUNTIME_CERTIFICATION_REPORT.md` | This document |

---

## Automated Check Summary

### Test Groups

#### 1. Backend API Health (no auth needed)
- `GET /lesson/sections/status` returns all units  
- `GET /lesson/sections/golden-matrix` returns GOLD/SILVER/BLOCKED  
- All target GOLD sections have `canStartPaidLesson: true`

#### 2. Per-Section Runtime Certification (auth required)
For each of 1.1, 1.2, 1.4, 2.1, 2.2, 2.3:
- Lesson session created via `POST /lesson/start`  
- Auth token injected into `localStorage`  
- Classroom page loaded  
- WS connection verified  
- `lesson_ready` awaited  
- "Begin Lesson" clicked  
- Teacher greeting captured  
- `exercise_cursor_updated` awaited and validated  
- Wrong answer submitted → cursor lock verified  
- Soft-speaking answer submitted → acceptance verified  
- Fatal errors checked  

#### 3. Cursor Integrity — Section 1.2 Deep Dive
- `cursorVersion` monotonically increases  
- `exerciseType` is never `unknown`  
- `instruction` is non-empty  
- `currentItem` is a string  

#### 4. WS Reconnect Resilience — Section 2.1
- Page reload triggers `lesson_resync` or `lesson_ready` within 30s  
- `LESSON_TAKEN_OVER` error does NOT arrive on fast reconnect  

---

## What Is NOT Automated (Manual QA Required)

| Item | Why Not Automated |
|---|---|
| **Voice answer testing** | Requires real microphone / STT. Playwright cannot inject PCM audio. |
| **TTS audio quality** | Requires listening. Playwright mutes audio in headless mode. |
| **Correct-answer progression** | Correct answers are not exposed to the frontend (by design). Requires testing with known answers per section. |
| **Multi-turn conversation coherence** | Requires semantic evaluation of AI teacher responses. |
| **Full lesson completion** | 30–50 min end-to-end run. Not suitable for automated CI. |
| **Subscription billing accuracy** | Requires real time to elapse. Test separately via billing unit tests. |
| **Mobile layout** | Playwright runs Desktop Chrome by default. Add mobile project in config to extend. |

---

## Section Certification Status

> **Note:** Status below reflects architecture analysis (2026-05-19).  
> Run `npx playwright test` against a live environment to generate real pass/fail results.

| Section | Title | Manifest | Deterministic Ex. | Expected Tier |
|---|---|---|---|---|
| **1.1** | Vocabulary: Free-time activities | auto-built | Yes (fill_gap, phrase_classification) | GOLD |
| **1.2** | Grammar: Present tenses question forms | explicit | Yes (grammar_focus_fill, grammar_drill) | GOLD |
| **1.4** | Reading: Teenage stereotypes | auto-built | Yes (gapped_text, read_and_answer) | GOLD |
| **2.1** | Vocabulary: Achievements | auto-built | Yes (collocations_fill, vocabulary_fill_gap) | GOLD |
| **2.2** | Grammar: Past Simple | auto-built | Yes (sentence_transformation, fill_gap) | GOLD |
| **2.3** | Reading: Marie Curie biography | auto-built | Yes (read_and_answer, gapped_text) | GOLD |

---

## Violations to Watch For

| Violation Pattern | Meaning | Severity |
|---|---|---|
| `PROGRESSION VIOLATION: cursor advanced after wrong answer` | Engine accepted wrong answer — validation broken | CRITICAL |
| `PROGRESSION VIOLATION: wrong answer accepted as correct` | Validation logic failure | CRITICAL |
| `TEACHER SYNC GAP: cursor jumped ex#N→ex#M` | Exercise skipped without student interaction | HIGH |
| `PHANTOM EXERCISE: exerciseNumber=0 type=unknown` | Engine returned empty cursor — stale state bug | HIGH |
| `lesson_ready never received` | Auth or session failure | CRITICAL |
| `exercise_cursor_updated never received` | Engine failed to start or manifest empty | CRITICAL |
| `LESSON_TAKEN_OVER on fast reconnect` | WS ownership logic too aggressive | MEDIUM |
| `Visible payload incomplete` | Instruction or exercise type missing from cursor | MEDIUM |

---

## Example Test Output

```
Running 13 tests using 1 worker

  ── Certifying Section 1.1 ──────────────────────────────
  [1.1] session created: d3a1b2c4-...
  [1.1] WS connected
  [1.1] lesson_ready: sessionId=d3a1b2c4-...
  [1.1] Begin Lesson clicked
  [1.1] ai_text received (148 chars)
  [1.1] cursor received: ex#1 type=phrase_classification item=0/5
  [1.1] soft-speaking exercise — skip wrong-answer stay check
  [1.1] RESULT: GOLD_CERTIFIED — violations: 0
  [1.1] WS traffic: lesson_ready×1, ai_text×1, teacher_turn_end×1, exercise_cursor_updated×1
  ✓ Section 1.1 passed Playwright assertions — GOLD_CERTIFIED

  ✓ Backend API health › GET /lesson/sections/status returns GOLD sections
  ✓ Backend API health › GET /lesson/sections/golden-matrix returns GOLD entries
  ✓ Backend API health › GOLD sections are canStartPaidLesson=true
  ...

  13 passed (87.3s)
```

---

## Product Direction

The goal is NOT maximum textbook coverage.  
The goal IS a curated, reliable AI lesson runtime.

**Prioritize:**
- Deterministic execution (engine owns progression)
- Runtime stability (WS resilience, cursor authority)
- Coherent teaching (teacher stays synchronized)
- Production-safe lesson quality

**Over:**
- Broad unsupported section coverage
- AI-improvised exercises
- Untested voice-only paths

A section should only be promoted to GOLD when this harness certifies it **without manual intervention**.

---

*Report maintained by: Golden Runtime QA Harness — `tests/golden-runtime/`*
