import { Router, type Request, type Response } from 'express'
import { v4 as uuid } from 'uuid'
import { requireAuth } from '../auth/middleware.js'
import { query } from '../db/postgres.js'
import { buildCheckout, verifySignature, decodeData } from './liqpay.js'
import { activateSubscription } from './subscription-service.js'

const router = Router()

const PLAN_ID    = process.env.PAID_PLAN_ID          ?? 'monthly_10_lessons'
const PLAN_NAME  = process.env.PAID_PLAN_NAME        ?? 'AI Teacher Monthly'
const PLAN_PRICE = Number(process.env.PAID_PLAN_PRICE_UAH ?? 1)
const CURRENCY   = process.env.LIQPAY_CURRENCY       ?? 'UAH'
const SANDBOX    = process.env.LIQPAY_SANDBOX        === '1'
const RESULT_URL = process.env.LIQPAY_RESULT_URL     ?? ''
const SERVER_URL = process.env.LIQPAY_SERVER_URL     ?? ''

// POST /billing/liqpay/create — authenticated; creates a pending payment + returns checkout data
router.post('/billing/liqpay/create', requireAuth, async (req: Request, res: Response) => {
  const userId = req.user!.userId

  try {
    const orderId = `order_${uuid()}`

    await query(
      `INSERT INTO payments (user_id, provider, order_id, plan_id, amount, currency, status)
       VALUES ($1, 'liqpay', $2, $3, $4, $5, 'pending')`,
      [userId, orderId, PLAN_ID, PLAN_PRICE, CURRENCY],
    )

    const checkout = buildCheckout({
      orderId,
      amount:      PLAN_PRICE,
      currency:    CURRENCY,
      description: PLAN_NAME,
      resultUrl:   RESULT_URL,
      serverUrl:   SERVER_URL,
      sandbox:     SANDBOX,
    })

    res.json(checkout)
  } catch (err) {
    console.error('[billing] create error:', err instanceof Error ? err.message : err)
    res.status(500).json({ error: 'Internal error' })
  }
})

// POST /billing/liqpay/callback — public; LiqPay server-to-server callback
router.post('/billing/liqpay/callback', async (req: Request, res: Response) => {
  const { data, signature } = req.body as { data?: unknown; signature?: unknown }

  if (typeof data !== 'string' || typeof signature !== 'string') {
    res.status(400).json({ error: 'Missing data or signature' })
    return
  }

  if (!verifySignature(data, signature)) {
    console.warn('[billing] callback: signature mismatch')
    res.status(400).json({ error: 'Invalid signature' })
    return
  }

  let payload: Record<string, unknown>
  try {
    payload = decodeData(data)
  } catch {
    res.status(400).json({ error: 'Invalid data encoding' })
    return
  }

  const orderId  = payload['order_id']  as string | undefined
  const status   = payload['status']    as string | undefined
  const amount   = Number(payload['amount'])
  const currency = payload['currency']  as string | undefined

  if (!orderId) {
    res.status(400).json({ error: 'Missing order_id' })
    return
  }

  const paymentRes = await query<{
    id:       string
    user_id:  string
    status:   string
    amount:   string
    currency: string
    plan_id:  string
  }>(
    `SELECT id, user_id, status, amount, currency, plan_id FROM payments WHERE order_id = $1`,
    [orderId],
  )

  if (!paymentRes.rows.length) {
    console.warn(`[billing] callback: unknown order ${orderId}`)
    res.status(404).json({ error: 'Order not found' })
    return
  }

  const payment = paymentRes.rows[0]!

  // Validate amount and currency
  const expectedAmount = Number(payment.amount)
  if (Math.abs(expectedAmount - amount) > 0.01) {
    console.warn(`[billing] callback: amount mismatch for ${orderId}: expected ${expectedAmount}, got ${amount}`)
    await query(
      `UPDATE payments SET status = 'failure', raw_provider_payload = $1, updated_at = NOW() WHERE order_id = $2`,
      [JSON.stringify(payload), orderId],
    )
    res.json({ ok: true })
    return
  }

  if (currency && payment.currency !== currency) {
    console.warn(`[billing] callback: currency mismatch for ${orderId}`)
    await query(
      `UPDATE payments SET status = 'failure', raw_provider_payload = $1, updated_at = NOW() WHERE order_id = $2`,
      [JSON.stringify(payload), orderId],
    )
    res.json({ ok: true })
    return
  }

  // Map provider status to internal status
  // LiqPay sandbox uses 'sandbox' as success status
  const SUCCESSFUL = new Set(['success', 'sandbox'])
  const FAILED     = new Set(['failure', 'error', 'reversed', 'expired'])

  let newStatus: string
  if (SUCCESSFUL.has(status ?? ''))      newStatus = 'success'
  else if (FAILED.has(status ?? ''))     newStatus = 'failure'
  else                                   newStatus = status ?? 'pending'

  // Idempotency: already successfully processed
  if (payment.status === 'success' && newStatus === 'success') {
    console.log(`[billing] callback: order ${orderId} already activated — skip`)
    res.json({ ok: true })
    return
  }

  await query(
    `UPDATE payments SET status = $1, raw_provider_payload = $2, updated_at = NOW() WHERE order_id = $3`,
    [newStatus, JSON.stringify(payload), orderId],
  )

  if (newStatus === 'success') {
    try {
      await activateSubscription(payment.user_id)
      console.log(`[billing] subscription activated: user=${payment.user_id} order=${orderId}`)
    } catch (err) {
      console.error('[billing] activation failed:', err instanceof Error ? err.message : err)
    }
  } else {
    console.log(`[billing] callback: order=${orderId} status=${newStatus}`)
  }

  res.json({ ok: true })
})

export default router
