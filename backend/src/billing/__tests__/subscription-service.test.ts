import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { QueryResult } from 'pg'

vi.mock('../../db/postgres.js', () => ({
  query: vi.fn(),
  withTransaction: vi.fn(),
}))

import { query } from '../../db/postgres.js'
import {
  getSubscription,
  isOwnerAccessEmail,
  OWNER_ACCESS_MINUTES,
} from '../subscription-service.js'

const mockQuery = vi.mocked(query)

function queryResult<T extends Record<string, unknown>>(rows: T[]): QueryResult<T> {
  return {
    rows,
    rowCount: rows.length,
    command:  'SELECT',
    oid:      0,
    fields:   [],
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('subscription-service owner access', () => {
  it('recognizes only the configured owner email case-insensitively', () => {
    expect(isOwnerAccessEmail('artenon92@gmail.com')).toBe(true)
    expect(isOwnerAccessEmail(' Artenon92@Gmail.com ')).toBe(true)
    expect(isOwnerAccessEmail('student@example.com')).toBe(false)
  })

  it('returns virtual active access for the owner email without a paid profile', async () => {
    mockQuery.mockResolvedValueOnce(queryResult([{
      email:               'Artenon92@Gmail.com',
      subscription_status: null,
      plan_id:             null,
      plan_expires_at:     null,
      paid_minutes_limit:  null,
      paid_minutes_used:   null,
      paid_lesson_minutes: null,
    }]))

    const sub = await getSubscription('owner-user')

    expect(sub).toEqual({
      status:           'active',
      planId:           'owner_access',
      expiresAt:        null,
      minutesLimit:     OWNER_ACCESS_MINUTES,
      minutesUsed:      0,
      minutesRemaining: OWNER_ACCESS_MINUTES,
      lessonMinutes:    50,
    })
  })

  it('does not grant access to a non-owner user without a paid profile', async () => {
    mockQuery.mockResolvedValueOnce(queryResult([{
      email:               'student@example.com',
      subscription_status: null,
      plan_id:             null,
      plan_expires_at:     null,
      paid_minutes_limit:  null,
      paid_minutes_used:   null,
      paid_lesson_minutes: null,
    }]))

    await expect(getSubscription('student-user')).resolves.toBeNull()
  })

  it('preserves normal subscription data for non-owner users', async () => {
    const expiresAt = new Date('2026-08-01T00:00:00.000Z')
    mockQuery.mockResolvedValueOnce(queryResult([{
      email:               'student@example.com',
      subscription_status: 'active',
      plan_id:             'monthly_10_lessons',
      plan_expires_at:     expiresAt,
      paid_minutes_limit:  500,
      paid_minutes_used:   125,
      paid_lesson_minutes: 50,
    }]))

    await expect(getSubscription('student-user')).resolves.toEqual({
      status:           'active',
      planId:           'monthly_10_lessons',
      expiresAt,
      minutesLimit:     500,
      minutesUsed:      125,
      minutesRemaining: 375,
      lessonMinutes:    50,
    })
  })
})
