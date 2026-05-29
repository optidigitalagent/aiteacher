# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: mentium-kids\kids-e2e.spec.ts >> A — /kids route (no auth) >> A2: Unauthenticated user sees "Sign in" prompt
- Location: tests\mentium-kids\kids-e2e.spec.ts:58:7

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:5173/kids
Call log:
  - navigating to "http://localhost:5173/kids", waiting until "load"

```

# Test source

```ts
  1   | /**
  2   |  * Mentium Kids — E2E Verification Suite
  3   |  *
  4   |  * Tests (by group):
  5   |  *
  6   |  * GROUP A  — Route & UI (no auth required)
  7   |  *   A1. /kids renders without crashing
  8   |  *   A2. Unauthenticated user sees auth prompt ("Sign in to start")
  9   |  *   A3. Auth button points to /auth/google (Google OAuth)
  10  |  *
  11  |  * GROUP B  — API auth guard (no token needed for negative tests)
  12  |  *   B1. POST /lesson/kids/start → 401 with no token
  13  |  *   B2. POST /lesson/kids/start → 401 with invalid token
  14  |  *   B3. POST /lesson/start (adult) → 401 with no token (adults unchanged)
  15  |  *
  16  |  * GROUP C  — Authenticated API & DB (requires PLAYWRIGHT_TEST_TOKEN)
  17  |  *   C1. POST /lesson/kids/start creates a sessionId
  18  |  *   C2. Second POST creates a different sessionId (idempotent creation)
  19  |  *   C3. Invalid sessionId over WS returns INVALID_SESSION error
  20  |  *   C4. /classroom/:sessionId renders for authenticated user
  21  |  *
  22  |  * GROUP D  — WS routing isolation (requires PLAYWRIGHT_TEST_TOKEN)
  23  |  *   D1. Kids sessionId routes to kids runtime (lesson_ready arrives)
  24  |  *   D2. Kids WS rejects a different user's session
  25  |  *
  26  |  * LIMITATION:
  27  |  *   Groups C & D require PLAYWRIGHT_TEST_TOKEN (valid JWT for a subscribed user).
  28  |  *   Without the token those groups are auto-skipped and documented here.
  29  |  *   DB row assertions (mode='mentium_kids', status='created') require direct
  30  |  *   Postgres access which is not available from Playwright — verified indirectly
  31  |  *   by the /lesson/kids/start endpoint returning a valid sessionId, since the
  32  |  *   endpoint only returns 200 after a successful INSERT.
  33  |  */
  34  | 
  35  | import { test, expect } from '@playwright/test'
  36  | import {
  37  |   BASE_URL,
  38  |   BACKEND_URL,
  39  |   TEST_TOKEN,
  40  |   WsMonitor,
  41  |   setAuthToken,
  42  |   checkEnvConfig,
  43  | } from '../golden-runtime/helpers'
  44  | 
  45  | // ─────────────────────────────────────────────────────────────────────────────
  46  | // GROUP A — Route & UI (unauthenticated)
  47  | // ─────────────────────────────────────────────────────────────────────────────
  48  | 
  49  | test.describe('A — /kids route (no auth)', () => {
  50  |   test('A1: /kids page renders without crashing', async ({ page }) => {
  51  |     await page.goto(`${BASE_URL}/kids`)
  52  |     // Page should not show a generic error or blank screen
  53  |     await expect(page).not.toHaveTitle(/Error/)
  54  |     // The Mentium Kids heading is present
  55  |     await expect(page.locator('h1, .kp-title')).toContainText(/kids/i, { timeout: 15_000 })
  56  |   })
  57  | 
  58  |   test('A2: Unauthenticated user sees "Sign in" prompt', async ({ page }) => {
> 59  |     await page.goto(`${BASE_URL}/kids`)
      |                ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:5173/kids
  60  |     // The button label should indicate sign-in is needed
  61  |     const btn = page.locator('.kp-btn, button').first()
  62  |     await btn.waitFor({ state: 'visible', timeout: 15_000 })
  63  |     const btnText = await btn.innerText()
  64  |     // Either shows "Sign in to start" or navigates to auth — both valid
  65  |     const isSignInPrompt =
  66  |       /sign in/i.test(btnText) ||
  67  |       /start kids/i.test(btnText) // authenticated variant
  68  |     expect(isSignInPrompt).toBe(true)
  69  |   })
  70  | 
  71  |   test('A3: "Sign in" button triggers Google OAuth redirect', async ({ page }) => {
  72  |     await page.goto(`${BASE_URL}/kids`)
  73  |     const btn = page.locator('.kp-btn, button').first()
  74  |     await btn.waitFor({ state: 'visible', timeout: 15_000 })
  75  |     const btnText = await btn.innerText()
  76  | 
  77  |     // Only test auth redirect when unauthenticated (button says "Sign in")
  78  |     if (!/sign in/i.test(btnText)) {
  79  |       test.skip() // already authenticated — skip OAuth redirect test
  80  |       return
  81  |     }
  82  | 
  83  |     // Click and intercept — we expect navigation toward /auth/google
  84  |     const navigationPromise = page.waitForRequest(
  85  |       req => req.url().includes('/auth/google') || req.url().includes('accounts.google.com'),
  86  |       { timeout: 5_000 },
  87  |     ).catch(() => null)
  88  | 
  89  |     await btn.click()
  90  |     const req = await navigationPromise
  91  | 
  92  |     // Either a request to /auth/google OR the page already navigated away (redirect happened)
  93  |     const navigated = page.url().includes('/auth/google') || page.url().includes('accounts.google.com')
  94  |     expect(req !== null || navigated).toBe(true)
  95  |   })
  96  | })
  97  | 
  98  | // ─────────────────────────────────────────────────────────────────────────────
  99  | // GROUP B — API auth guard (no DB needed — just HTTP responses)
  100 | // ─────────────────────────────────────────────────────────────────────────────
  101 | 
  102 | test.describe('B — API auth guard', () => {
  103 |   test('B1: POST /lesson/kids/start without token returns 401', async ({ request }) => {
  104 |     const res = await request.post(`${BACKEND_URL}/lesson/kids/start`, {
  105 |       data: {},
  106 |     })
  107 |     expect(res.status()).toBe(401)
  108 |   })
  109 | 
  110 |   test('B2: POST /lesson/kids/start with invalid token returns 401', async ({ request }) => {
  111 |     const res = await request.post(`${BACKEND_URL}/lesson/kids/start`, {
  112 |       headers: { Authorization: 'Bearer invalid.jwt.token' },
  113 |       data: {},
  114 |     })
  115 |     expect(res.status()).toBe(401)
  116 |   })
  117 | 
  118 |   test('B3: POST /lesson/start (adult) without token returns 401 — adult route unchanged', async ({ request }) => {
  119 |     const res = await request.post(`${BACKEND_URL}/lesson/start`, {
  120 |       data: {
  121 |         mode: 'textbook',
  122 |         bookId: 'focus2',
  123 |         sectionId: '1.1',
  124 |         sectionNumber: '1.1',
  125 |         sectionTitle: 'Test',
  126 |         sectionTopic: 'Test',
  127 |         teacherId: 'alex',
  128 |         voiceId: 'onyx',
  129 |       },
  130 |     })
  131 |     // Adult route must also require auth
  132 |     expect(res.status()).toBe(401)
  133 |   })
  134 | 
  135 |   test('B4: GET /kids route is publicly reachable (frontend, not auth-gated at HTTP level)', async ({ request }) => {
  136 |     const res = await request.get(`${BASE_URL}/kids`)
  137 |     // SPA delivers HTML for any route — status 200 expected
  138 |     expect(res.status()).toBe(200)
  139 |   })
  140 | })
  141 | 
  142 | // ─────────────────────────────────────────────────────────────────────────────
  143 | // GROUP C — Authenticated API (requires PLAYWRIGHT_TEST_TOKEN)
  144 | // ─────────────────────────────────────────────────────────────────────────────
  145 | 
  146 | test.describe('C — Authenticated API', () => {
  147 |   test.beforeEach(() => {
  148 |     const { configured, reason } = checkEnvConfig()
  149 |     if (!configured) test.skip()
  150 |   })
  151 | 
  152 |   test('C1: POST /lesson/kids/start returns a sessionId', async ({ request }) => {
  153 |     const res = await request.post(`${BACKEND_URL}/lesson/kids/start`, {
  154 |       headers: { Authorization: `Bearer ${TEST_TOKEN}` },
  155 |       data: {},
  156 |     })
  157 |     expect(res.status()).toBe(200)
  158 |     const body = await res.json() as Record<string, unknown>
  159 |     expect(typeof body['sessionId']).toBe('string')
```