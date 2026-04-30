import Anthropic from '@anthropic-ai/sdk'
import 'dotenv/config'
import redis from '../db/redis.js'
import { getFocusStudentBookSection } from './focus-student-book.js'
import type { SlideSpec, SlideBlock } from './types.js'

const MODEL       = 'claude-sonnet-4-6'
const SLIDE_TTL   = 60 * 60 * 24 * 30   // 30 days — section content rarely changes

function slideKey(sectionId: string): string {
  return `slide:focus2:${sectionId}:grammar_overview`
}

export async function getCachedCard(sectionId: string): Promise<SlideSpec | null> {
  const raw = await redis.get(slideKey(sectionId))
  if (!raw) return null
  try { return JSON.parse(raw) as SlideSpec } catch { return null }
}

export async function cacheCard(sectionId: string, spec: SlideSpec): Promise<void> {
  await redis.set(slideKey(sectionId), JSON.stringify(spec), 'EX', SLIDE_TTL)
}

/** Builds a minimal card from student-book data — no AI required. */
function buildStaticCard(sectionId: string): SlideSpec | null {
  const sb = getFocusStudentBookSection(sectionId)
  if (!sb || sb.type !== 'Grammar') return null

  // Split grammarFocus into individual topics (split on ; or — )
  const rawFocus = sb.grammarFocus ?? ''
  const segments = rawFocus.split(/[;—]/).map(s => s.trim()).filter(Boolean)

  const blocks: SlideBlock[] = segments.slice(0, 4).map(seg => ({
    label: seg,
  }))

  if (blocks.length === 0) return null

  return {
    bookId:    'focus2',
    sectionId,
    slideType: 'grammar_overview',
    title:     sb.lessonTitle ?? segments[0],
    blocks,
    createdAt: new Date().toISOString(),
  }
}

async function generateWithAI(sectionId: string): Promise<SlideSpec | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return null

  const sb = getFocusStudentBookSection(sectionId)
  if (!sb || sb.type !== 'Grammar') return null

  const client = new Anthropic({ apiKey })

  const prompt = `You are creating a grammar overview card for a Focus 2 English textbook lesson.

Section: ${sectionId}
Grammar focus: ${sb.grammarFocus ?? 'unknown'}
Section title: ${sb.lessonTitle ?? 'unknown'}
Section OCR text:
${sb.text.slice(0, 800)}

Create a JSON grammar overview card. Return ONLY valid JSON — no markdown fences, no extra text:
{
  "title": "[grammar concept name, e.g. 'Present Simple: Question Forms']",
  "blocks": [
    { "label": "[form name]", "form": "[formula]", "example": "[short example]" }
  ],
  "commonMistake": "❌ [wrong] → ✅ [correct]"
}

Rules:
- title: the specific grammar concept (derive from grammarFocus above)
- blocks: 2–4 key grammar forms only, derived from the OCR text
- commonMistake: the #1 error students make with this exact grammar point
- Do NOT invent forms not present in the OCR text`

  let text = ''
  try {
    const resp = await client.messages.create({
      model:      MODEL,
      max_tokens: 350,
      messages:   [{ role: 'user', content: prompt }],
    })
    text = resp.content[0]?.type === 'text' ? resp.content[0].text : ''
  } catch (err) {
    console.error('[slide-cache] generateWithAI error:', err)
    return null
  }

  try {
    const clean = text.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim()
    const obj   = JSON.parse(clean) as {
      title:         string
      blocks:        SlideBlock[]
      commonMistake?: string
    }
    if (typeof obj.title !== 'string' || !Array.isArray(obj.blocks)) return null

    return {
      bookId:        'focus2',
      sectionId,
      slideType:     'grammar_overview',
      title:         obj.title,
      blocks:        obj.blocks,
      commonMistake: obj.commonMistake,
      createdAt:     new Date().toISOString(),
    }
  } catch {
    console.warn('[slide-cache] failed to parse AI response for section', sectionId)
    return null
  }
}

/** Returns cached card if available, otherwise generates and caches it. Non-throwing. */
export async function getOrCreateSectionCard(sectionId: string): Promise<SlideSpec | null> {
  try {
    const cached = await getCachedCard(sectionId)
    if (cached) {
      console.log(`[slide-cache] cache hit: section ${sectionId}`)
      return cached
    }

    console.log(`[slide-cache] generating card for section ${sectionId}...`)
    const generated = await generateWithAI(sectionId)
    if (generated) {
      await cacheCard(sectionId, generated)
      console.log(`[slide-cache] cached new card for section ${sectionId}`)
      return generated
    }

    // AI unavailable — fall back to static card from student-book data
    const staticCard = buildStaticCard(sectionId)
    if (staticCard) {
      console.log(`[slide-cache] using static fallback card for section ${sectionId}`)
    }
    return staticCard
  } catch (err) {
    console.error('[slide-cache] getOrCreateSectionCard error:', err)
    return null
  }
}
