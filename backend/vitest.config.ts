import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Unit tests only — integration tests in tests/ require Docker (real Redis + PostgreSQL).
    // Run integration tests separately: npm run test:integration
    include: ['src/**/*.test.ts'],
  },
})
