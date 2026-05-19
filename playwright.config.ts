import { defineConfig, devices } from '@playwright/test'

/**
 * Golden Runtime QA Harness — Playwright configuration.
 *
 * Required env vars:
 *   PLAYWRIGHT_BASE_URL     — frontend URL  (default: http://localhost:5173)
 *   PLAYWRIGHT_BACKEND_URL  — backend URL   (default: http://localhost:4000)
 *   PLAYWRIGHT_TEST_TOKEN   — JWT for a user with an active subscription
 *
 * Run:
 *   npx playwright test
 *   npx playwright test tests/golden-runtime/
 *   npx playwright test --project=chromium --reporter=list
 */
export default defineConfig({
  testDir: './tests',
  timeout: 120_000,
  expect:  { timeout: 25_000 },
  fullyParallel: false,   // lessons are stateful — run serially to avoid session conflicts
  retries: 0,             // no retries — regressions must be investigated, not masked

  use: {
    baseURL:    process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173',
    video:      'retain-on-failure',
    screenshot: 'only-on-failure',
    trace:      'retain-on-failure',
    // Disable audio — TTS chunks arrive but we don't need actual playback for WS checks
    launchOptions: {
      args: ['--mute-audio'],
    },
  },

  projects: [
    {
      name:  'chromium',
      use:   { ...devices['Desktop Chrome'] },
    },
  ],

  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'playwright-report/results.json' }],
  ],
})
