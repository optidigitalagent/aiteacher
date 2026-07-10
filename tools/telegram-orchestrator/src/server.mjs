import http from 'node:http'
import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import { createGoalPacket, formatGoalPacket, redactSecrets } from './orchestrator.mjs'

const PORT = Number(process.env.PORT ?? 4010)
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? ''
const INTERNAL_KEY = process.env.INTERNAL_TELEGRAM_API_KEY ?? ''
const DATA_DIR = process.env.ORCHESTRATOR_DATA_DIR ?? './data'
const BOT_DISPLAY_NAME = process.env.ORCHESTRATOR_BOT_NAME ?? 'Codex Intake Bot'
const GOALS_FILE = path.join(DATA_DIR, 'goal-packets.jsonl')
const ALLOWED_CHATS = parseCsv(process.env.ORCHESTRATOR_ALLOWED_CHAT_IDS ?? '')
const ALLOW_ALL_CHATS_FOR_DEV = process.env.ORCHESTRATOR_ALLOW_ALL_CHATS_FOR_DEV === '1'
const PLATFORM_LINK_ENABLED = process.env.ORCHESTRATOR_PLATFORM_LINK_ENABLED === '1'
const MAX_JSON_BODY_BYTES = 64 * 1024

const sessions = new Map()
const linkTokens = new Map()

await fs.mkdir(DATA_DIR, { recursive: true })
const server = http.createServer(handleHttp)
server.listen(PORT, () => {
  console.log(`[tg-orchestrator] listening on ${PORT}; telegram=${BOT_TOKEN ? 'enabled' : 'disabled'}`)
})

if (BOT_TOKEN && ALLOWED_CHATS.length === 0 && !ALLOW_ALL_CHATS_FOR_DEV) {
  console.error('[tg-orchestrator] refusing to poll Telegram without ORCHESTRATOR_ALLOWED_CHAT_IDS')
} else if (BOT_TOKEN) {
  void pollTelegram()
}

async function handleHttp(req, res) {
  try {
    if (req.method === 'GET' && req.url === '/health') return sendJson(res, 200, { ok: true })
    if (req.url?.startsWith('/internal/') && !isAuthorized(req)) return sendJson(res, 401, { ok: false, code: 'UNAUTHORIZED' })
    if (req.method === 'POST' && req.url === '/internal/telegram/consume-link-token') return await consumeLinkToken(req, res)
    if (req.method === 'POST' && req.url === '/internal/telegram/linked') return await notifyLinked(req, res)
    if (req.method === 'GET' && req.url === '/internal/orchestrator/goals') return sendJson(res, 200, { ok: true, goals: await readGoals() })
    if (req.method === 'GET' && req.url === '/internal/orchestrator/latest') return sendJson(res, 200, { ok: true, goal: (await readGoals()).at(-1) ?? null })
    if (req.method === 'POST' && req.url === '/internal/orchestrator/events') return await relayOrchestratorEvent(req, res)
    return sendJson(res, 404, { ok: false, code: 'NOT_FOUND' })
  } catch (err) {
    if (err instanceof RequestError) return sendJson(res, err.status, { ok: false, code: err.code })
    console.error('[tg-orchestrator] request failed:', err instanceof Error ? err.message : err)
    return sendJson(res, 500, { ok: false, code: 'INTERNAL_ERROR' })
  }
}

async function consumeLinkToken(req, res) {
  const body = await readJson(req)
  const token = String(body.linkToken ?? '')
  const entry = linkTokens.get(token)
  if (!entry) return sendJson(res, 400, { ok: false, code: 'INVALID_TOKEN' })
  if (Date.now() > entry.expiresAt) {
    linkTokens.delete(token)
    return sendJson(res, 400, { ok: false, code: 'TOKEN_EXPIRED' })
  }
  linkTokens.delete(token)
  return sendJson(res, 200, { ok: true, telegramChatId: entry.chatId, telegramUserId: entry.telegramUserId })
}

async function notifyLinked(req, res) {
  const body = await readJson(req)
  const chatId = String(body.telegramChatId ?? '')
  if (chatId) await sendTelegram(chatId, `Platform account linked for ${redactSecrets(body.name ?? 'your profile')}.`)
  return sendJson(res, 200, { ok: true })
}

async function relayOrchestratorEvent(req, res) {
  const body = await readJson(req)
  const goals = await readGoals()
  const goal = body.goalId ? goals.find((item) => item.goalId === body.goalId) : goals.at(-1)
  const chatId = String(body.telegramChatId ?? goal?.source?.chatId ?? '')
  if (!chatId) return sendJson(res, 400, { ok: false, code: 'MISSING_CHAT_ID' })
  if (!isChatAllowed(chatId)) return sendJson(res, 403, { ok: false, code: 'CHAT_NOT_ALLOWED' })
  const lines = [
    `Project update: ${redactSecrets(body.status ?? body.type ?? 'status')}`,
    body.goalId ? `Goal: ${body.goalId}` : '',
    redactSecrets(body.message ?? ''),
  ].filter(Boolean)
  await sendTelegram(chatId, lines.join('\n'))
  return sendJson(res, 200, { ok: true })
}

async function pollTelegram(offset = 0) {
  while (true) {
    try {
      const data = await telegram('getUpdates', { timeout: 25, offset })
      for (const update of data.result ?? []) {
        offset = Math.max(offset, update.update_id + 1)
        if (update.message) await handleMessage(update.message)
      }
    } catch (err) {
      console.error('[tg-orchestrator] polling error:', err instanceof Error ? err.message : err)
      await delay(3000)
    }
  }
}

async function handleMessage(message) {
  const chatId = String(message.chat.id)
  if (!isChatAllowed(chatId)) return sendTelegram(chatId, 'This bot is not enabled for this chat.')
  const text = String(message.text ?? '').trim()
  if (!text) return sendTelegram(chatId, 'Send a product goal or use /new_goal.')
  if (text === '/start') return sendTelegram(chatId, helpText())
  if (text === '/cancel') return cancel(chatId)
  if (text === '/new_goal') return askForGoal(chatId)
  if (text === '/status') return sendStatus(chatId)
  if (text === '/export') return exportLatest(chatId)
  if (text === '/link') return PLATFORM_LINK_ENABLED
    ? createLinkToken(chatId, message.from?.id)
    : sendTelegram(chatId, 'Platform linking is disabled for this standalone bot.')
  if (text === '/confirm') return confirmGoal(chatId, message)
  return captureGoalText(chatId, message, text)
}

async function captureGoalText(chatId, message, text) {
  const packet = createGoalPacket({
    text,
    chatId,
    telegramUserId: message.from?.id,
    username: message.from?.username,
  })
  sessions.set(chatId, packet)
  await sendTelegram(chatId, [
    'I drafted a goal packet. Reply /confirm to send it to Codex, or send more details to replace the draft.',
    '',
    `Title: ${packet.title}`,
    '',
    'The packet includes happy, negative, adversarial, live-evidence, and failure-definition scenarios.',
  ].join('\n'))
}

async function confirmGoal(chatId, message) {
  const packet = sessions.get(chatId)
  if (!packet) return sendTelegram(chatId, 'No draft exists. Send your product goal first.')
  await appendGoal(packet)
  sessions.delete(chatId)
  await sendTelegram(chatId, formatGoalPacket(packet))
}

async function createLinkToken(chatId, telegramUserId) {
  const token = crypto.randomBytes(18).toString('hex')
  linkTokens.set(token, { chatId, telegramUserId: String(telegramUserId ?? ''), expiresAt: Date.now() + 10 * 60_000 })
  await sendTelegram(chatId, `Link token valid for 10 minutes:\n${token}`)
}

async function sendStatus(chatId) {
  const goals = await readGoals()
  const latest = latestGoalForChat(goals, chatId)
  await sendTelegram(chatId, latest ? `Latest goal: ${latest.title}\nID: ${latest.goalId}\nStatus: ${latest.status}` : 'No goal packets yet.')
}

async function exportLatest(chatId) {
  const latest = latestGoalForChat(await readGoals(), chatId)
  await sendTelegram(chatId, latest ? JSON.stringify(latest, null, 2).slice(0, 3800) : 'No goal packets yet.')
}

async function askForGoal(chatId) {
  sessions.delete(chatId)
  await sendTelegram(chatId, 'Describe the product outcome. Include what should work, what must not happen, and how a critic should try to break it.')
}

async function cancel(chatId) {
  sessions.delete(chatId)
  await sendTelegram(chatId, 'Draft cancelled.')
}

function helpText() {
  const lines = [
    BOT_DISPLAY_NAME,
    '',
    '/new_goal - start a goal intake',
    '/confirm - send the current draft to Codex',
    '/status - show latest goal packet',
    '/export - show latest packet JSON',
  ]
  if (PLATFORM_LINK_ENABLED) lines.push('/link - create platform link token')
  return lines.join('\n')
}

async function appendGoal(packet) {
  await fs.appendFile(GOALS_FILE, `${JSON.stringify(packet)}\n`, 'utf8')
}

async function readGoals() {
  try {
    const text = await fs.readFile(GOALS_FILE, 'utf8')
    return text.split('\n').filter(Boolean).map((line) => JSON.parse(line))
  } catch (err) {
    if (err?.code === 'ENOENT') return []
    throw err
  }
}

async function sendTelegram(chatId, text) {
  if (!BOT_TOKEN) return
  await telegram('sendMessage', { chat_id: chatId, text: String(text).slice(0, 3900) })
}

async function telegram(method, body) {
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!data.ok) throw new Error(`Telegram ${method} failed: ${data.description ?? res.status}`)
  return data
}

async function readJson(req) {
  const chunks = []
  let totalBytes = 0
  for await (const chunk of req) {
    totalBytes += chunk.length
    if (totalBytes > MAX_JSON_BODY_BYTES) throw new RequestError(413, 'BODY_TOO_LARGE')
    chunks.push(chunk)
  }
  const text = Buffer.concat(chunks).toString('utf8')
  try {
    return text ? JSON.parse(text) : {}
  } catch {
    throw new RequestError(400, 'INVALID_JSON')
  }
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

function isAuthorized(req) {
  if (!INTERNAL_KEY) return false
  return req.headers.authorization === `Bearer ${INTERNAL_KEY}`
}

function isChatAllowed(chatId) {
  return ALLOW_ALL_CHATS_FOR_DEV || ALLOWED_CHATS.includes(String(chatId))
}

function parseCsv(value) {
  return value.split(',').map((item) => item.trim()).filter(Boolean)
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function latestGoalForChat(goals, chatId) {
  return goals.filter((goal) => String(goal?.source?.chatId ?? '') === String(chatId)).at(-1) ?? null
}

class RequestError extends Error {
  constructor(status, code) {
    super(code)
    this.status = status
    this.code = code
  }
}
