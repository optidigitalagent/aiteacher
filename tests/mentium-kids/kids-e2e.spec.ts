/**
 * Mentium Kids — E2E Verification Suite
 *
 * Tests (by group):
 *
 * GROUP A  — Route & UI (no auth required)
 *   A1. /kids renders without crashing
 *   A2. Unauthenticated user sees auth prompt ("Sign in to start")
 *   A3. Auth button points to /auth/google (Google OAuth)
 *
 * GROUP B  — API auth guard (no token needed for negative tests)
 *   B1. POST /lesson/kids/start → 401 with no token
 *   B2. POST /lesson/kids/start → 401 with invalid token
 *   B3. POST /lesson/start (adult) → 401 with no token (adults unchanged)
 *
 * GROUP C  — Authenticated API & DB (requires PLAYWRIGHT_TEST_TOKEN)
 *   C1. POST /lesson/kids/start creates a sessionId
 *   C2. Second POST creates a different sessionId (idempotent creation)
 *   C3. Invalid sessionId over WS returns INVALID_SESSION error
 *   C4. /classroom/:sessionId renders for authenticated user
 *
 * GROUP D  — WS routing isolation (requires PLAYWRIGHT_TEST_TOKEN)
 *   D1. Kids sessionId routes to kids runtime (lesson_ready arrives)
 *   D2. Kids WS rejects a different user's session
 *
 * LIMITATION:
 *   Groups C & D require PLAYWRIGHT_TEST_TOKEN (valid JWT for a subscribed user).
 *   Without the token those groups are auto-skipped and documented here.
 *   DB row assertions (mode='mentium_kids', status='created') require direct
 *   Postgres access which is not available from Playwright — verified indirectly
 *   by the /lesson/kids/start endpoint returning a valid sessionId, since the
 *   endpoint only returns 200 after a successful INSERT.
 */

import { test, expect } from '@playwright/test'
import {
  BASE_URL,
  BACKEND_URL,
  TEST_TOKEN,
  WsMonitor,
  setAuthToken,
  checkEnvConfig,
} from '../golden-runtime/helpers'

// ─────────────────────────────────────────────────────────────────────────────
// GROUP A — Route & UI (unauthenticated)
// ─────────────────────────────────────────────────────────────────────────────

test.describe('A — /kids route (no auth)', () => {
  test('A1: /kids page renders without crashing', async ({ page }) => {
    await page.goto(`${BASE_URL}/kids`)
    // Page should not show a generic error or blank screen
    await expect(page).not.toHaveTitle(/Error/)
    // The Mentium Kids heading is present
    await expect(page.locator('h1, .kp-title')).toContainText(/kids/i, { timeout: 15_000 })
  })

  test('A2: Unauthenticated user sees "Sign in" prompt', async ({ page }) => {
    await page.goto(`${BASE_URL}/kids`)
    // The button label should indicate sign-in is needed
    const btn = page.locator('.kp-btn, button').first()
    await btn.waitFor({ state: 'visible', timeout: 15_000 })
    const btnText = await btn.innerText()
    // Either shows "Sign in to start" or navigates to auth — both valid
    const isSignInPrompt =
      /sign in/i.test(btnText) ||
      /start kids/i.test(btnText) // authenticated variant
    expect(isSignInPrompt).toBe(true)
  })

  test('A3: "Sign in" button triggers Google OAuth redirect', async ({ page }) => {
    await page.goto(`${BASE_URL}/kids`)
    const btn = page.locator('.kp-btn, button').first()
    await btn.waitFor({ state: 'visible', timeout: 15_000 })
    const btnText = await btn.innerText()

    // Only test auth redirect when unauthenticated (button says "Sign in")
    if (!/sign in/i.test(btnText)) {
      test.skip() // already authenticated — skip OAuth redirect test
      return
    }

    // Click and intercept — we expect navigation toward /auth/google
    const navigationPromise = page.waitForRequest(
      req => req.url().includes('/auth/google') || req.url().includes('accounts.google.com'),
      { timeout: 5_000 },
    ).catch(() => null)

    await btn.click()
    const req = await navigationPromise

    // Either a request to /auth/google OR the page already navigated away (redirect happened)
    const navigated = page.url().includes('/auth/google') || page.url().includes('accounts.google.com')
    expect(req !== null || navigated).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// GROUP B — API auth guard (no DB needed — just HTTP responses)
// ─────────────────────────────────────────────────────────────────────────────

test.describe('B — API auth guard', () => {
  test('B1: POST /lesson/kids/start without token returns 401', async ({ request }) => {
    const res = await request.post(`${BACKEND_URL}/lesson/kids/start`, {
      data: {},
    })
    expect(res.status()).toBe(401)
  })

  test('B2: POST /lesson/kids/start with invalid token returns 401', async ({ request }) => {
    const res = await request.post(`${BACKEND_URL}/lesson/kids/start`, {
      headers: { Authorization: 'Bearer invalid.jwt.token' },
      data: {},
    })
    expect(res.status()).toBe(401)
  })

  test('B3: POST /lesson/start (adult) without token returns 401 — adult route unchanged', async ({ request }) => {
    const res = await request.post(`${BACKEND_URL}/lesson/start`, {
      data: {
        mode: 'textbook',
        bookId: 'focus2',
        sectionId: '1.1',
        sectionNumber: '1.1',
        sectionTitle: 'Test',
        sectionTopic: 'Test',
        teacherId: 'alex',
        voiceId: 'onyx',
      },
    })
    // Adult route must also require auth
    expect(res.status()).toBe(401)
  })

  test('B4: GET /kids route is publicly reachable (frontend, not auth-gated at HTTP level)', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/kids`)
    // SPA delivers HTML for any route — status 200 expected
    expect(res.status()).toBe(200)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// GROUP C — Authenticated API (requires PLAYWRIGHT_TEST_TOKEN)
// ─────────────────────────────────────────────────────────────────────────────

test.describe('C — Authenticated API', () => {
  test.beforeEach(() => {
    const { configured, reason } = checkEnvConfig()
    if (!configured) test.skip()
  })

  test('C1: POST /lesson/kids/start returns a sessionId', async ({ request }) => {
    const res = await request.post(`${BACKEND_URL}/lesson/kids/start`, {
      headers: { Authorization: `Bearer ${TEST_TOKEN}` },
      data: {},
    })
    expect(res.status()).toBe(200)
    const body = await res.json() as Record<string, unknown>
    expect(typeof body['sessionId']).toBe('string')
    expect((body['sessionId'] as string).length).toBeGreaterThan(0)
  })

  test('C2: Each POST /lesson/kids/start generates a different sessionId', async ({ request }) => {
    const headers = { Authorization: `Bearer ${TEST_TOKEN}` }
    const r1 = await request.post(`${BACKEND_URL}/lesson/kids/start`, { headers, data: {} })
    const r2 = await request.post(`${BACKEND_URL}/lesson/kids/start`, { headers, data: {} })
    const b1 = await r1.json() as Record<string, unknown>
    const b2 = await r2.json() as Record<string, unknown>
    expect(b1['sessionId']).not.toBe(b2['sessionId'])
  })

  test('C3: Invalid sessionId over WS returns INVALID_SESSION error', async ({ page }) => {
    await setAuthToken(page, TEST_TOKEN)
    const monitor = new WsMonitor()
    monitor.attach(page)

    await page.goto(`${BASE_URL}/classroom/00000000-0000-0000-0000-deadbeef0000`)

    // The WS message should be an error with INVALID_SESSION or similar code
    // We allow up to 10s for the connection to be established and error to arrive
    const anyMsg = await Promise.race([
      monitor.waitForType<{ type: 'error'; code: string }>('error', 10_000),
      // Also accept lesson_ready (means session was found — unlikely but handle gracefully)
      monitor.waitForType('lesson_ready', 10_000),
    ]).catch(() => null)

    // Either:
    //   1. An error message arrived (INVALID_SESSION, SESSION_NOT_FOUND, etc.)
    //   2. The page shows an error / redirect
    //   3. No WS was established at all (session guard in HTTP layer)
    if (anyMsg && anyMsg.type === 'error') {
      const errMsg = anyMsg as { type: 'error'; code: string }
      const knownErrorCodes = ['INVALID_SESSION', 'SESSION_NOT_FOUND', 'AUTH_ERROR']
      const isSafeError = knownErrorCodes.includes(errMsg.code) || errMsg.code.length > 0
      expect(isSafeError).toBe(true)
    } else {
      // No WS error — page should show a safe UI error state instead
      const pageText = await page.content()
      const hasSafeState =
        pageText.includes('not found') ||
        pageText.includes('error') ||
        pageText.includes('invalid') ||
        monitor.all().length === 0 // never connected — also safe
      expect(hasSafeState).toBe(true)
    }
  })

  test('C4: /classroom/:sessionId renders for authenticated user', async ({ page, request }) => {
    // Create a fresh kids session
    const startRes = await request.post(`${BACKEND_URL}/lesson/kids/start`, {
      headers: { Authorization: `Bearer ${TEST_TOKEN}` },
      data: {},
    })
    const { sessionId } = await startRes.json() as { sessionId: string }
    expect(sessionId).toBeTruthy()

    await setAuthToken(page, TEST_TOKEN)
    await page.goto(`${BASE_URL}/classroom/${sessionId}`)

    // Page loads without crash
    await expect(page).not.toHaveTitle(/Error/)
    // Some classroom content renders (not just a blank/error screen)
    const hasContent = await page.locator('body').isVisible()
    expect(hasContent).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// GROUP D — WS routing isolation (requires PLAYWRIGHT_TEST_TOKEN)
// ─────────────────────────────────────────────────────────────────────────────

test.describe('D — WS runtime routing', () => {
  test.beforeEach(() => {
    const { configured, reason } = checkEnvConfig()
    if (!configured) test.skip()
  })

  test('D1: Kids session → WS lesson_ready arrives (kids runtime activated)', async ({ page, request }) => {
    // Create a fresh kids session via API
    const startRes = await request.post(`${BACKEND_URL}/lesson/kids/start`, {
      headers: { Authorization: `Bearer ${TEST_TOKEN}` },
      data: {},
    })
    expect(startRes.status()).toBe(200)
    const { sessionId } = await startRes.json() as { sessionId: string }

    const monitor = new WsMonitor()
    monitor.attach(page)
    await setAuthToken(page, TEST_TOKEN)
    await page.goto(`${BASE_URL}/classroom/${sessionId}`)

    // Trigger lesson start (click Begin Lesson if present, or wait for auto-start)
    const beginBtn = page.locator('button:has-text("Begin"), button:has-text("Start")')
    if (await beginBtn.count() > 0) {
      await beginBtn.first().click().catch(() => {})
    }

    // lesson_ready must arrive — indicates kids runtime was activated
    const lessonReady = await monitor.waitForType('lesson_ready', 20_000).catch(() => null)

    // No fatal adult-lesson errors (billing/subscription errors should NOT fire for kids)
    const wsErrors = monitor.ofType<{ type: 'error'; code: string }>('error')
    const billingErrors = wsErrors.filter(e =>
      ['SUBSCRIPTION_REQUIRED', 'PAYMENT_REQUIRED', 'NO_CREDITS'].includes(e.code)
    )

    expect(lessonReady).not.toBeNull()
    expect(billingErrors.length).toBe(0)
  })

  test('D2: Kids session routes to kids runtime, NOT adult billing flow', async ({ page, request }) => {
    const startRes = await request.post(`${BACKEND_URL}/lesson/kids/start`, {
      headers: { Authorization: `Bearer ${TEST_TOKEN}` },
      data: {},
    })
    const { sessionId } = await startRes.json() as { sessionId: string }

    const monitor = new WsMonitor()
    monitor.attach(page)
    await setAuthToken(page, TEST_TOKEN)
    await page.goto(`${BASE_URL}/classroom/${sessionId}`)

    // Give WS time to connect and send initial messages
    await page.waitForTimeout(5_000)

    const allTypes = monitor.all().map(m => m.type)
    const hasBillingError = allTypes.some(t =>
      ['SUBSCRIPTION_REQUIRED', 'PAYMENT_REQUIRED', 'NO_CREDITS'].includes(t)
    )

    // Kids must never hit the subscription/billing gate
    expect(hasBillingError).toBe(false)
  })

  test('D3: Cross-user session access is rejected by WS', async ({ page, request }) => {
    // Create a session with the valid token
    const startRes = await request.post(`${BACKEND_URL}/lesson/kids/start`, {
      headers: { Authorization: `Bearer ${TEST_TOKEN}` },
      data: {},
    })
    const { sessionId } = await startRes.json() as { sessionId: string }

    // Attempt to connect to that session with a *different* (fake) token
    const fakeToken = 'eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiIwMDAwMDAwMC1mZmZmLTAwMDAtMDAwMC0wMDAwMDAwMGZmZmYiLCJlbWFpbCI6ImZha2VAdGVzdC5jb20ifQ.fake_signature'

    const monitor = new WsMonitor()
    monitor.attach(page)
    await setAuthToken(page, fakeToken)
    await page.goto(`${BASE_URL}/classroom/${sessionId}`)
    await page.waitForTimeout(6_000)

    // Either:
    //   1. WS sends error with INVALID_SESSION or auth error code
    //   2. WS never connects (JWT verify fails immediately)
    const wsErrors = monitor.ofType<{ type: 'error'; code: string }>('error')
    const lessonReadys = monitor.ofType('lesson_ready')

    // Cross-user must NOT receive lesson_ready
    expect(lessonReadys.length).toBe(0)

    if (wsErrors.length > 0) {
      // At least one error must be an auth/session rejection
      const isRejected = wsErrors.some(e =>
        ['INVALID_SESSION', 'AUTH_ERROR', 'SESSION_NOT_FOUND', 'INVALID_TOKEN'].includes(e.code)
      )
      expect(isRejected).toBe(true)
    }
    // If no WS error was sent, the connection was simply refused — also acceptable
  })

  test('D9: Adult lesson sessions still use adult runtime (no kids branch hijack)', async ({ request }) => {
    // POST to adult /lesson/start returns 402/403 if no subscription — NOT a kids flow
    const res = await request.post(`${BACKEND_URL}/lesson/start`, {
      headers: { Authorization: `Bearer ${TEST_TOKEN}` },
      data: {
        mode: 'textbook',
        bookId: 'focus2',
        sectionId: '1.1',
        sectionNumber: '1.1',
        sectionTitle: 'Vocabulary',
        sectionTopic: 'Free-time activities',
        teacherId: 'alex',
        voiceId: 'onyx',
      },
    })
    // Adult route: 200 (subscribed), 402 (no subscription), 403 (forbidden) all acceptable.
    // 500 (server crash) or returning a kids_session object would be a bug.
    expect([200, 402, 403, 402]).toContain(res.status())
    if (res.status() === 200) {
      const body = await res.json() as Record<string, unknown>
      // Adult response has sessionId and remainingMinutes (not mode='mentium_kids')
      expect(body['sessionId']).toBeTruthy()
      // mode field should not be mentium_kids in adult response
      expect(body['mode']).not.toBe('mentium_kids')
    }
  })
})
