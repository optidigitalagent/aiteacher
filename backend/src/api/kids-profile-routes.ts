import { Router, type Request, type Response } from 'express'
import { requireAuth } from '../auth/middleware.js'
import { query } from '../db/postgres.js'

const router = Router()

const VALID_TEACHER_IDS = new Set(['lucy', 'tom', 'default'])
const VALID_INTERESTS = new Set([
  'roblox', 'brawl_stars', 'minecraft', 'pokemon',
  'football', 'animals', 'cars', 'space',
  'dinosaurs', 'superheroes', 'princesses', 'drawing',
])
const MAX_INTERESTS = 5
const MIN_AGE = 4
const MAX_AGE = 14

function deriveAgeBand(age: number): '6-7' | '8-9' {
  return age <= 7 ? '6-7' : '8-9'
}

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

// GET /api/kids/child-profile
router.get('/api/kids/child-profile', requireAuth, async (req: Request, res: Response) => {
  const userId = req.user!.userId
  try {
    const result = await query<{
      child_id: string
      child_name: string | null
      child_age_years: number | null
      age_band: string
      teacher_id: string
      high_engagement_topics: string[] | null
    }>(
      `SELECT child_id, child_name, child_age_years, age_band, teacher_id, high_engagement_topics
       FROM kids_brain_child_profiles WHERE user_id = $1`,
      [userId]
    )
    if (result.rows.length === 0) {
      res.status(404).json({ code: 'NO_CHILD_PROFILE' })
      return
    }
    const row = result.rows[0]
    res.json({
      childId:       row.child_id,
      childName:     row.child_name ?? '',
      childAgeYears: row.child_age_years ?? 7,
      ageBand:       row.age_band,
      teacherId:     row.teacher_id ?? 'lucy',
      interests:     row.high_engagement_topics ?? [],
    })
  } catch (err) {
    console.error('[kids-profile:get] error:', err instanceof Error ? err.message : err)
    res.status(500).json({ code: 'INTERNAL_ERROR' })
  }
})

// POST /api/kids/child-profile — create new profile
router.post('/api/kids/child-profile', requireAuth, async (req: Request, res: Response) => {
  const userId = req.user!.userId
  const body = req.body as Record<string, unknown>

  const validationError = validateBody(body)
  if (validationError) {
    res.status(400).json({ code: 'VALIDATION_ERROR', details: validationError })
    return
  }

  const childName     = typeof body.childName === 'string' ? body.childName.trim() : ''
  const childAgeYears = typeof body.childAgeYears === 'number' ? body.childAgeYears : 7
  const teacherId     = typeof body.teacherId === 'string' ? body.teacherId : 'lucy'
  const interests     = Array.isArray(body.interests) ? (body.interests as string[]) : []
  const ageBand       = deriveAgeBand(childAgeYears)

  try {
    const existing = await query('SELECT child_id FROM kids_brain_child_profiles WHERE user_id = $1', [userId])
    if (existing.rows.length > 0) {
      res.status(409).json({ code: 'PROFILE_ALREADY_EXISTS', hint: 'Use PUT to update' })
      return
    }

    const result = await query<{ child_id: string }>(
      `INSERT INTO kids_brain_child_profiles
         (user_id, first_name_encrypted, age_band, child_name, child_age_years, teacher_id, high_engagement_topics)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING child_id`,
      [userId, Buffer.from(childName), ageBand, childName, childAgeYears, teacherId, interests]
    )

    const childId = result.rows[0].child_id
    res.status(201).json({ childId, childName, childAgeYears, ageBand, teacherId, interests })
  } catch (err) {
    console.error('[kids-profile:post] error:', err instanceof Error ? err.message : err)
    res.status(500).json({ code: 'INTERNAL_ERROR' })
  }
})

// PUT /api/kids/child-profile — update existing profile
router.put('/api/kids/child-profile', requireAuth, async (req: Request, res: Response) => {
  const userId = req.user!.userId
  const body = req.body as Record<string, unknown>

  const validationError = validateBody(body)
  if (validationError) {
    res.status(400).json({ code: 'VALIDATION_ERROR', details: validationError })
    return
  }

  try {
    const existing = await query<{
      child_id: string; child_name: string | null; child_age_years: number | null
      teacher_id: string; high_engagement_topics: string[] | null; age_band: string
    }>(
      `SELECT child_id, child_name, child_age_years, teacher_id, high_engagement_topics, age_band
       FROM kids_brain_child_profiles WHERE user_id = $1`,
      [userId]
    )
    if (existing.rows.length === 0) {
      res.status(404).json({ code: 'NO_CHILD_PROFILE', hint: 'Use POST to create' })
      return
    }

    const row = existing.rows[0]
    const childName     = typeof body.childName === 'string' ? body.childName.trim() : (row.child_name ?? '')
    const childAgeYears = typeof body.childAgeYears === 'number' ? body.childAgeYears : (row.child_age_years ?? 7)
    const teacherId     = typeof body.teacherId === 'string' ? body.teacherId : (row.teacher_id ?? 'lucy')
    const interests     = Array.isArray(body.interests) ? (body.interests as string[]) : (row.high_engagement_topics ?? [])
    const ageBand       = deriveAgeBand(childAgeYears)

    await query(
      `UPDATE kids_brain_child_profiles
       SET child_name=$1, child_age_years=$2, teacher_id=$3, high_engagement_topics=$4, age_band=$5,
           first_name_encrypted=$6, updated_at=now()
       WHERE user_id=$7`,
      [childName, childAgeYears, teacherId, interests, ageBand, Buffer.from(childName), userId]
    )

    res.json({ childId: row.child_id, childName, childAgeYears, ageBand, teacherId, interests })
  } catch (err) {
    console.error('[kids-profile:put] error:', err instanceof Error ? err.message : err)
    res.status(500).json({ code: 'INTERNAL_ERROR' })
  }
})

export default router
