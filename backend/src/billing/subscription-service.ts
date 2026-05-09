import { query, withTransaction } from '../db/postgres.js'

const PLAN_ID             = process.env.PAID_PLAN_ID              ?? 'monthly_10_lessons'
const PLAN_TOTAL_MINUTES  = Number(process.env.PAID_PLAN_TOTAL_MINUTES  ?? 500)
const PLAN_LESSONS_LIMIT  = Number(process.env.PAID_PLAN_LESSONS_LIMIT  ?? 10)
const PLAN_LESSON_MINUTES = Number(process.env.PAID_PLAN_LESSON_MINUTES ?? 50)
const PLAN_DURATION_DAYS  = Number(process.env.PAID_PLAN_DURATION_DAYS  ?? 31)

export interface SubscriptionInfo {
  status:           string
  planId:           string | null
  expiresAt:        Date | null
  minutesLimit:     number
  minutesUsed:      number
  minutesRemaining: number
  lessonMinutes:    number
}

export async function getSubscription(userId: string): Promise<SubscriptionInfo | null> {
  const r = await query<{
    subscription_status: string
    plan_id:             string | null
    plan_expires_at:     Date | null
    paid_minutes_limit:  number
    paid_minutes_used:   number
    paid_lesson_minutes: number
  }>(
    `SELECT subscription_status, plan_id, plan_expires_at,
            paid_minutes_limit, paid_minutes_used, paid_lesson_minutes
     FROM user_lesson_profiles
     WHERE user_id = $1`,
    [userId],
  )
  if (!r.rows.length) return null
  const row = r.rows[0]!
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

export async function activateSubscription(userId: string): Promise<void> {
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
      [userId, PLAN_ID, expiresAt, PLAN_TOTAL_MINUTES, PLAN_LESSONS_LIMIT, PLAN_LESSON_MINUTES],
    )

    console.log(`[billing] subscription activated user=${userId} expiresAt=${expiresAt.toISOString()} minutes=${PLAN_TOTAL_MINUTES}`)
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
      await client.query(
        `UPDATE paid_lesson_usage
         SET ended_at = NOW(), minutes_used = $1, status = 'completed'
         WHERE id = $2`,
        [minutesUsed, usageId],
      )

      await client.query(
        `UPDATE user_lesson_profiles
         SET paid_minutes_used = LEAST(paid_minutes_limit, paid_minutes_used + $1),
             updated_at = NOW()
         WHERE user_id = $2`,
        [minutesUsed, userId],
      )
    })

    console.log(`[billing] usage finalized: user=${userId} minutes=${minutesUsed}`)
  } catch (err) {
    console.error('[billing] finalizeUsage error:', err instanceof Error ? err.message : err)
  }
}
