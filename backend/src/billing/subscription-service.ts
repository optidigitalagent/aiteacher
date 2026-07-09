import { query, withTransaction } from '../db/postgres.js'

const PLAN_ID             = process.env.PAID_PLAN_ID              ?? 'monthly_10_lessons'
const PLAN_TOTAL_MINUTES  = Number(process.env.PAID_PLAN_TOTAL_MINUTES  ?? 500)
const PLAN_LESSONS_LIMIT  = Number(process.env.PAID_PLAN_LESSONS_LIMIT  ?? 10)
const PLAN_LESSON_MINUTES = Number(process.env.PAID_PLAN_LESSON_MINUTES ?? 50)
const PLAN_DURATION_DAYS  = Number(process.env.PAID_PLAN_DURATION_DAYS  ?? 31)

export const OWNER_ACCESS_EMAIL = 'artenon92@gmail.com'
export const OWNER_ACCESS_MINUTES = 1_000_000

export interface SubscriptionInfo {
  status:           string
  planId:           string | null
  expiresAt:        Date | null
  minutesLimit:     number
  minutesUsed:      number
  minutesRemaining: number
  lessonMinutes:    number
}

export function isOwnerAccessEmail(email: string | null | undefined): boolean {
  return email?.trim().toLowerCase() === OWNER_ACCESS_EMAIL
}

export async function getSubscription(userId: string): Promise<SubscriptionInfo | null> {
  const r = await query<{
    email:               string
    subscription_status: string | null
    plan_id:             string | null
    plan_expires_at:     Date | null
    paid_minutes_limit:  number | null
    paid_minutes_used:   number | null
    paid_lesson_minutes: number | null
  }>(
    `SELECT u.email, ulp.subscription_status, ulp.plan_id, ulp.plan_expires_at,
            ulp.paid_minutes_limit, ulp.paid_minutes_used, ulp.paid_lesson_minutes
     FROM users u
     LEFT JOIN user_lesson_profiles ulp ON ulp.user_id = u.id
     WHERE u.id = $1`,
    [userId],
  )
  if (!r.rows.length) return null
  const row = r.rows[0]!

  if (isOwnerAccessEmail(row.email)) {
    return {
      status:           'active',
      planId:           'owner_access',
      expiresAt:        null,
      minutesLimit:     OWNER_ACCESS_MINUTES,
      minutesUsed:      0,
      minutesRemaining: OWNER_ACCESS_MINUTES,
      lessonMinutes:    PLAN_LESSON_MINUTES,
    }
  }

  if (!row.subscription_status) return null

  const limit = Number(row.paid_minutes_limit)
  const used  = Number(row.paid_minutes_used)
  return {
    status:           row.subscription_status,
    planId:           row.plan_id,
    expiresAt:        row.plan_expires_at,
    minutesLimit:     limit,
    minutesUsed:      used,
    minutesRemaining: Math.max(0, limit - used),
    lessonMinutes:    Number(row.paid_lesson_minutes),
  }
}

export async function activateSubscription(userId: string, planIdOverride?: string): Promise<void> {
  const effectivePlanId = planIdOverride ?? PLAN_ID
  await withTransaction(async (client) => {
    const current = await client.query<{
      subscription_status: string
      plan_expires_at:     Date | null
    }>(
      `SELECT subscription_status, plan_expires_at
       FROM user_lesson_profiles WHERE user_id = $1`,
      [userId],
    )

    const row = current.rows[0]
    const now = new Date()

    // If subscription is still active, extend from current expiry; otherwise start from now
    let startFrom = now
    if (
      row?.subscription_status === 'active' &&
      row.plan_expires_at &&
      row.plan_expires_at > now
    ) {
      startFrom = row.plan_expires_at
    }

    const expiresAt = new Date(startFrom)
    expiresAt.setDate(expiresAt.getDate() + PLAN_DURATION_DAYS)

    await client.query(
      `INSERT INTO user_lesson_profiles
         (user_id, subscription_status, plan_id, plan_started_at, plan_expires_at,
          paid_minutes_limit, paid_minutes_used, paid_lessons_limit, paid_lesson_minutes)
       VALUES ($1, 'active', $2, NOW(), $3, $4, 0, $5, $6)
       ON CONFLICT (user_id) DO UPDATE SET
         subscription_status = 'active',
         plan_id             = EXCLUDED.plan_id,
         plan_started_at     = NOW(),
         plan_expires_at     = EXCLUDED.plan_expires_at,
         paid_minutes_limit  = EXCLUDED.paid_minutes_limit,
         paid_minutes_used   = 0,
         paid_lessons_limit  = EXCLUDED.paid_lessons_limit,
         paid_lesson_minutes = EXCLUDED.paid_lesson_minutes,
         updated_at          = NOW()`,
      [userId, effectivePlanId, expiresAt, PLAN_TOTAL_MINUTES, PLAN_LESSONS_LIMIT, PLAN_LESSON_MINUTES],
    )

    console.log(`[billing] subscription activated user=${userId} plan=${effectivePlanId} expiresAt=${expiresAt.toISOString()} minutes=${PLAN_TOTAL_MINUTES}`)
  })
}

export async function finalizeUsage(usageId: string, userId: string, startedAt: number): Promise<void> {
  try {
    const elapsedMs      = Date.now() - startedAt
    const elapsedMinutes = elapsedMs / 60_000

    // Cap at configured max lesson duration
    const capped = Math.min(elapsedMinutes, PLAN_LESSON_MINUTES)
    const minutesUsed = Math.max(0, Math.round(capped * 10) / 10) // round to 1dp

    await withTransaction(async (client) => {
      // Guard: only charge if the usage record is still 'active'.
      // Two-tab or SIGTERM double-close would otherwise add minutes twice.
      const usageResult = await client.query<{ id: string }>(
        `UPDATE paid_lesson_usage
         SET ended_at = NOW(), minutes_used = $1, status = 'completed'
         WHERE id = $2 AND status = 'active'
         RETURNING id`,
        [minutesUsed, usageId],
      )

      // Only update the profile counter if this call actually finalized the record.
      // Subsequent calls (same usageId, already 'completed') are no-ops.
      if (usageResult.rowCount && usageResult.rowCount > 0) {
        await client.query(
          `UPDATE user_lesson_profiles
           SET paid_minutes_used = LEAST(paid_minutes_limit, paid_minutes_used + $1),
               updated_at = NOW()
           WHERE user_id = $2`,
          [minutesUsed, userId],
        )
      }
    })

    console.log(`[billing] usage finalized: user=${userId} minutes=${minutesUsed}`)
  } catch (err) {
    console.error('[billing] finalizeUsage error:', err instanceof Error ? err.message : err)
  }
}
