import { Router, type Request, type Response } from 'express'
import { requireAuth } from '../auth/middleware.js'
import { query } from '../db/postgres.js'

const router = Router()

const BOT_SERVICE_URL = process.env.TELEGRAM_BOT_SERVICE_URL ?? ''
const BOT_API_KEY     = process.env.INTERNAL_TELEGRAM_API_KEY ?? ''

// POST /api/integrations/telegram/link
// Authenticated: validates link token via bot service, stores integration, notifies bot.
router.post('/api/integrations/telegram/link', requireAuth, async (req: Request, res: Response) => {
  const userId   = req.user!.userId
  const userName = req.user!.name

  const { linkToken } = req.body as { linkToken?: string }
  if (!linkToken || typeof linkToken !== 'string' || !linkToken.trim()) {
    res.status(400).json({ code: 'MISSING_TOKEN', message: 'linkToken is required' })
    return
  }

  if (!BOT_SERVICE_URL || !BOT_API_KEY) {
    console.error('[telegram-link] TELEGRAM_BOT_SERVICE_URL or INTERNAL_TELEGRAM_API_KEY not set')
    res.status(503).json({ code: 'SERVICE_UNAVAILABLE', message: 'Telegram сервіс недоступний.' })
    return
  }

  // Step 1: Validate and consume link token via bot service
  let telegramChatId: string
  let telegramUserId: string | null = null

  try {
    const consumeRes = await fetch(`${BOT_SERVICE_URL}/internal/telegram/consume-link-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${BOT_API_KEY}`,
      },
      body: JSON.stringify({ linkToken }),
    })

    const consumeBody = await consumeRes.json() as {
      ok:               boolean
      telegramChatId?:  string
      telegramUserId?:  string
      code?:            string
    }

    if (!consumeBody.ok || !consumeBody.telegramChatId) {
      const code = consumeBody.code ?? 'INVALID_TOKEN'
      const messages: Record<string, string> = {
        INVALID_TOKEN:      'Посилання для підключення недійсне.',
        TOKEN_EXPIRED:      'Посилання застаріло. Будь ласка, повернись у Telegram і натисни "Підключити акаунт" знову.',
        TOKEN_ALREADY_USED: 'Цей Telegram вже підключено до облікового запису.',
        MISSING_TOKEN:      'Посилання недійсне.',
      }
      console.warn('[telegram-link] consume-link-token rejected:', code, 'userId:', userId)
      res.status(400).json({ code, message: messages[code] ?? 'Помилка підключення Telegram.' })
      return
    }

    telegramChatId = consumeBody.telegramChatId
    telegramUserId = consumeBody.telegramUserId ?? null
  } catch (err) {
    console.error('[telegram-link] consume-link-token fetch failed:', err instanceof Error ? err.message : err)
    res.status(503).json({ code: 'SERVICE_UNAVAILABLE', message: 'Не вдалося зʼєднатися з Telegram сервісом. Спробуй ще раз.' })
    return
  }

  // Step 2: Fetch subscription status (non-critical — defaults to 'free')
  let subscriptionStatus = 'free'
  try {
    const profileRes = await query<{ subscription_status: string }>(
      `SELECT COALESCE(subscription_status, 'free') AS subscription_status
       FROM user_lesson_profiles WHERE user_id = $1`,
      [userId],
    )
    subscriptionStatus = profileRes.rows[0]?.subscription_status ?? 'free'
  } catch {
    // non-critical
  }

  // Step 3: Upsert platform-side telegram integration
  try {
    await query(
      `INSERT INTO telegram_integrations (user_id, telegram_chat_id, telegram_user_id, status)
       VALUES ($1, $2, $3, 'linked')
       ON CONFLICT (user_id) DO UPDATE
         SET telegram_chat_id = EXCLUDED.telegram_chat_id,
             telegram_user_id = EXCLUDED.telegram_user_id,
             status           = 'linked',
             linked_at        = NOW(),
             updated_at       = NOW()`,
      [userId, telegramChatId, telegramUserId],
    )
  } catch (err: unknown) {
    const pgErr = err as { code?: string; constraint?: string }
    // Another platform user already owns this Telegram chat
    if (pgErr?.code === '23505' && pgErr?.constraint?.includes('chat_id')) {
      console.warn('[telegram-link] telegram_chat_id already linked to another user:', telegramChatId)
      res.status(409).json({
        code: 'ALREADY_LINKED',
        message: 'Цей Telegram акаунт вже підключено до іншого облікового запису платформи.',
      })
      return
    }
    console.error('[telegram-link] DB upsert failed:', err instanceof Error ? (err as Error).message : err)
    res.status(500).json({ code: 'DB_ERROR', message: 'Не вдалося зберегти інтеграцію.' })
    return
  }

  // Step 4: Notify bot to send confirmation message (non-fatal if this fails)
  try {
    await fetch(`${BOT_SERVICE_URL}/internal/telegram/linked`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${BOT_API_KEY}`,
      },
      body: JSON.stringify({
        telegramChatId,
        platformUserId: userId,
        name:           userName,
        subscriptionStatus,
      }),
    })
  } catch (err) {
    // Token consumed + DB stored — notification failure is non-fatal
    console.warn('[telegram-link] Could not notify bot (non-fatal):', err instanceof Error ? (err as Error).message : err)
  }

  console.log(`[telegram-link] linked ok: userId=${userId} chatId=${telegramChatId}`)
  res.json({ ok: true, telegramLinked: true })
})

export default router
