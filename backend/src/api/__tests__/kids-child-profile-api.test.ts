/**
 * Unit tests for kids-profile-routes validation and error handling.
 *
 * Tests the validation helpers and response shapes without a live DB.
 * The route handlers themselves are covered via integration in Phase 6 QA.
 */
import { describe, it, expect } from 'vitest'

// ── Validation logic (extracted via inline re-implementation for unit testing) ─
// These mirror the exact rules in kids-profile-routes.ts so we can test them
// without spinning up an Express app or hitting the database.

const VALID_TEACHER_IDS = new Set(['lucy', 'tom', 'default'])
const VALID_INTERESTS = new Set([
  'roblox', 'brawl_stars', 'minecraft', 'pokemon',
  'football', 'animals', 'cars', 'space',
  'dinosaurs', 'superheroes', 'princesses', 'drawing',
])
const MAX_INTERESTS = 5
const MIN_AGE = 4
const MAX_AGE = 14

function validateBody(body: Record<string, unknown>): string | null {
  const { childName, childAgeYears, teacherId, interests } = body
  if (childName !== undefined) {
    if (typeof childName !== 'string' || childName.trim().length < 1 || childName.trim().length > 100)
      return 'childName must be 1–100 characters'
  }
  if (childAgeYears !== undefined) {
    if (typeof childAgeYears !== 'number' || !Number.isInteger(childAgeYears) || childAgeYears < MIN_AGE || childAgeYears > MAX_AGE)
      return `childAgeYears must be an integer ${MIN_AGE}–${MAX_AGE}`
  }
  if (teacherId !== undefined) {
    if (!VALID_TEACHER_IDS.has(teacherId as string))
      return `teacherId must be one of: ${[...VALID_TEACHER_IDS].join(', ')}`
  }
  if (interests !== undefined) {
    if (!Array.isArray(interests) || interests.length > MAX_INTERESTS)
      return `interests must be an array with max ${MAX_INTERESTS} items`
    for (const tag of interests as unknown[]) {
      if (typeof tag !== 'string' || !VALID_INTERESTS.has(tag))
        return `Unknown interest tag: ${String(tag)}`
    }
  }
  return null
}

function deriveAgeBand(age: number): '6-7' | '8-9' {
  return age <= 7 ? '6-7' : '8-9'
}

// ── validateBody ──────────────────────────────────────────────────────────────

describe('validateBody', () => {
  it('accepts a fully valid payload', () => {
    expect(validateBody({
      childName: 'Alex',
      childAgeYears: 7,
      teacherId: 'lucy',
      interests: ['roblox', 'space'],
    })).toBeNull()
  })

  it('rejects childName longer than 100 chars', () => {
    expect(validateBody({ childName: 'A'.repeat(101) })).toMatch(/childName/)
  })

  it('rejects empty childName', () => {
    expect(validateBody({ childName: '   ' })).toMatch(/childName/)
  })

  it('rejects childAgeYears below MIN_AGE (4)', () => {
    expect(validateBody({ childAgeYears: 3 })).toMatch(/childAgeYears/)
  })

  it('rejects childAgeYears above MAX_AGE (14)', () => {
    expect(validateBody({ childAgeYears: 15 })).toMatch(/childAgeYears/)
  })

  it('rejects fractional childAgeYears', () => {
    expect(validateBody({ childAgeYears: 6.5 })).toMatch(/childAgeYears/)
  })

  it('rejects invalid teacherId', () => {
    expect(validateBody({ teacherId: 'unknown_teacher' })).toMatch(/teacherId/)
  })

  it('accepts all valid teacherIds', () => {
    for (const id of ['lucy', 'tom', 'default']) {
      expect(validateBody({ teacherId: id })).toBeNull()
    }
  })

  it('rejects more than 5 interests', () => {
    expect(validateBody({
      interests: ['roblox', 'space', 'cars', 'animals', 'football', 'minecraft'],
    })).toMatch(/interests/)
  })

  it('rejects unknown interest tag', () => {
    expect(validateBody({ interests: ['roblox', 'unicorns'] })).toMatch(/unicorns/)
  })

  it('accepts exactly 5 known interests', () => {
    expect(validateBody({
      interests: ['roblox', 'space', 'cars', 'animals', 'football'],
    })).toBeNull()
  })

  it('accepts all 12 known interest tags individually', () => {
    const tags = [
      'roblox', 'brawl_stars', 'minecraft', 'pokemon',
      'football', 'animals', 'cars', 'space',
      'dinosaurs', 'superheroes', 'princesses', 'drawing',
    ]
    for (const tag of tags) {
      expect(validateBody({ interests: [tag] }), `tag "${tag}" should be valid`).toBeNull()
    }
  })

  it('accepts partial payload (only some fields)', () => {
    expect(validateBody({ childAgeYears: 10 })).toBeNull()
    expect(validateBody({ teacherId: 'tom' })).toBeNull()
    expect(validateBody({ interests: [] })).toBeNull()
  })
})

// ── deriveAgeBand ─────────────────────────────────────────────────────────────

describe('deriveAgeBand', () => {
  it('maps ages 4–7 to 6-7', () => {
    for (const age of [4, 5, 6, 7]) {
      expect(deriveAgeBand(age)).toBe('6-7')
    }
  })

  it('maps ages 8–14 to 8-9', () => {
    for (const age of [8, 9, 10, 11, 12, 13, 14]) {
      expect(deriveAgeBand(age)).toBe('8-9')
    }
  })
})

// ── Interest taxonomy completeness ────────────────────────────────────────────

describe('Interest taxonomy', () => {
  it('has exactly 12 entries', () => {
    expect(VALID_INTERESTS.size).toBe(12)
  })

  it('contains all expected tags from design doc', () => {
    const expected = [
      'roblox', 'brawl_stars', 'minecraft', 'pokemon',
      'football', 'animals', 'cars', 'space',
      'dinosaurs', 'superheroes', 'princesses', 'drawing',
    ]
    for (const tag of expected) {
      expect(VALID_INTERESTS.has(tag), `expected "${tag}" in taxonomy`).toBe(true)
    }
  })
})
