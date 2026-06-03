/**
 * Phase 16J.2 — Kids Lesson Start Billing Guard Fix
 *
 * Acceptance tests for the P0 fix:
 *
 *   A. Valid Kids session routes to handleKidsBrainV1LessonStart — [payment-guard-hit]
 *      must NOT be logged, WS stays open.
 *
 *   B. kids_sessions DB query throws exception (table missing / DB down) →
 *      WS closes with code 4500 SESSION_VERIFICATION_FAILED, NOT 4402.
 *      [payment-guard-hit] must NOT fire.
 *
 *   C. Adult session (no kids_sessions row) → falls through to payment guard
 *      as before — [payment-guard-hit] IS logged, 4402 still fires.
 *
 * All external services mocked.
 */

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { createServer } from 'http';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import WebSocket from 'ws';

// ── Hoisted setup ─────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => {
  process.env['USE_KIDS_BRAIN_V1'] = 'true';
  process.env['JWT_SECRET'] = 'test-secret-16j2';

  const redisStore = new Map<string, string>();
  const redisMock = {
    get:  vi.fn(async (k: string) => redisStore.get(k) ?? null),
    set:  vi.fn(async (k: string, v: string, ..._r: unknown[]) => { redisStore.set(k, v); return 'OK'; }),
    del:  vi.fn(async (k: string) => { redisStore.delete(k); return 1; }),
    eval: vi.fn(async (_s: string, _n: number, k: string, v: string, _t: string, seq: string) => {
      const raw = redisStore.get(k);
      if (!raw) { redisStore.set(k, v); return 1; }
      try {
        const p = JSON.parse(raw) as { autosaveSequenceNumber?: number };
        if ((p.autosaveSequenceNumber ?? 0) < Number(seq)) { redisStore.set(k, v); return 1; }
        return 0;
      } catch { redisStore.set(k, v); return 1; }
    }),
    _store: redisStore,
  };

  // queryMock is switched per test via mockImplementation
  const queryMock = vi.fn(async (_sql: string) => ({ rows: [], rowCount: 0 }));

  const verifyTokenMock = vi.fn(async (token: string) => {
    if (token === 'tok-16j2-kids')  return { userId: 'u-16j2-001', studentId: 's-16j2-001', email: 'kids@16j2.test', name: 'KidsJ2' };
    if (token === 'tok-16j2-adult') return { userId: 'u-16j2-002', studentId: 's-16j2-002', email: 'adult@16j2.test', name: 'AdultJ2' };
    return null;
  });

  const hashUserIdMock = vi.fn((id: string | null) => (id ? id.slice(0, 8) : null));

  return { redisMock, redisStore, queryMock, verifyTokenMock, hashUserIdMock };
});

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../../db/redis.js', () => ({
  default:            mocks.redisMock,
  LESSON_TTL:         14400,
  lessonStateKey:     (id: string) => `lesson:${id}:state`,
  lessonContextKey:   (id: string) => `lesson:${id}:context`,
  lessonExercisesKey: (id: string) => `lesson:${id}:exercises`,
  lessonErrorsKey:    (id: string) => `lesson:${id}:errors`,
  activeSessionKey:   (id: string) => `session:${id}:active`,
}));
vi.mock('../../db/postgres.js', () => ({
  query:           mocks.queryMock,
  withTransaction: vi.fn(async (fn: (c: unknown) => Promise<unknown>) => fn({})),
  default:         {},
}));
vi.mock('../../auth/jwt.js', () => ({
  verifyToken: mocks.verifyTokenMock,
  signToken:   vi.fn(async () => 'signed'),
}));
vi.mock('../../voice/tts.js', () => ({
  speakToClient: vi.fn(async () => undefined),
}));
vi.mock('../../voice/stt.js', () => ({
  DeepgramSTT: vi.fn().mockImplementation(() => ({
    connect:     vi.fn(),
    close:       vi.fn(),
    clearBuffer: vi.fn(),
    flushBuffer: vi.fn(() => ''),
    isConnected: vi.fn(() => false),
  })),
}));
vi.mock('../../billing/subscription-service.js', () => ({
  getSubscription: vi.fn(async () => null),  // no subscription → 4402 for adult path
  finalizeUsage:   vi.fn(async () => undefined),
}));
vi.mock('../../observability/index.js', () => ({
  startLessonTrace:        vi.fn(),
  endLessonTrace:          vi.fn(),
  traceSttResult:          vi.fn(),
  traceValidation:         vi.fn(),
  traceTeacherGeneration:  vi.fn(),
  traceRuntimeError:       vi.fn(),
  traceRuntimeSpan:        vi.fn(),
  traceInterpretation:     vi.fn(),
  traceProgression:        vi.fn(),
  traceFrontendSync:       vi.fn(),
  isObservabilityEnabled:  vi.fn(() => false),
  initObservability:       vi.fn(),
  flushObservability:      vi.fn(),
  hashUserId:              mocks.hashUserIdMock,
}));
vi.mock('../../observability/langfuse-client.js', () => ({
  hashUserId:              mocks.hashUserIdMock,
  isObservabilityEnabled:  vi.fn(() => false),
  initObservability:       vi.fn(),
  flushObservability:      vi.fn(),
}));
vi.mock('../../kids-brain/analytics/session-analytics.js', () => ({
  persistKidsBrainAnalytics:      vi.fn(async () => undefined),
  buildSessionSummary:            vi.fn(),
  buildMasteryRecordsFromSession:  vi.fn(() => []),
}));

import { attachLessonWS } from '../lesson-ws.js';

// ── Server ────────────────────────────────────────────────────────────────────

let server: Server;
let port: number;

beforeAll(async () => {
  server = createServer();
  attachLessonWS(server);
  await new Promise<void>(resolve => server.listen(0, resolve));
  port = (server.address() as AddressInfo).port;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close(err => (err ? reject(err) : resolve())),
  );
});

// ── Helpers ───────────────────────────────────────────────────────────────────

type Msg = Record<string, unknown>;

function kidsWsUrl(sessionId: string, token: string): string {
  return `ws://localhost:${port}/lesson?token=${token}&sessionId=${sessionId}`;
}

async function openAndWaitReady(sessionId: string, token: string): Promise<{
  ws:       WebSocket;
  messages: Msg[];
  logs:     string[];
}> {
  const messages: Msg[] = [];
  const logs:     string[] = [];

  // Intercept console.log for [payment-guard-hit] and [kids-start-diag] lines
  const origLog = console.log.bind(console);
  const logSpy = vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
    const line = args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
    if (line.includes('[payment-guard-hit]') || line.includes('[kids-start-diag]')) {
      logs.push(line);
    }
    origLog(...args);
  });

  const ws = new WebSocket(kidsWsUrl(sessionId, token));
  ws.on('message', (raw) => {
    try { messages.push(JSON.parse(raw.toString()) as Msg); } catch { /* skip */ }
  });

  await new Promise<void>((resolve, reject) => {
    ws.once('open',  resolve);
    ws.once('error', reject);
  });

  // Wait for initial lesson_ready
  await new Promise<void>((resolve, reject) => {
    const deadline = setTimeout(() => reject(new Error('lesson_ready timeout')), 3000);
    const tick = setInterval(() => {
      if (messages.some(m => m['type'] === 'lesson_ready')) {
        clearTimeout(deadline); clearInterval(tick); resolve();
      }
    }, 20);
  });

  // Clean up spy after test body
  ws.once('close', () => logSpy.mockRestore());

  return { ws, messages, logs };
}

function sendFrame(ws: WebSocket, msg: Msg): void {
  ws.send(JSON.stringify(msg));
}

async function waitForClose(ws: WebSocket, timeoutMs = 3000): Promise<{ code: number; reason: string }> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`close timeout after ${timeoutMs}ms`)), timeoutMs);
    ws.once('close', (code, reasonBuf) => {
      clearTimeout(t);
      resolve({ code, reason: reasonBuf.toString() });
    });
  });
}

async function waitUntil(
  msgs: Msg[],
  pred: (m: Msg[]) => boolean,
  ms = 3000,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (pred(msgs)) { resolve(); return; }
    const t = setTimeout(() => reject(new Error('waitUntil timeout')), ms);
    const tick = setInterval(() => {
      if (pred(msgs)) { clearTimeout(t); clearInterval(tick); resolve(); }
    }, 20);
  });
}

// ── Suite A — Valid Kids session bypasses payment guard ───────────────────────

describe('16J.2 — A: Valid Kids session bypasses adult payment guard', () => {
  const SESSION_ID = 'sess-16j2-kids';

  beforeEach(() => {
    mocks.queryMock.mockImplementation(async (sql: string) => {
      const s = sql.trim().toUpperCase();
      if (s.includes('FROM KIDS_SESSIONS')) {
        return { rows: [{ user_id: 'u-16j2-001', status: 'created', mode: 'mentium_kids' }], rowCount: 1 };
      }
      if (s.includes('SELECT LESSON_ID FROM LESSON_SESSIONS')) {
        return { rows: [], rowCount: 0 };
      }
      return { rows: [], rowCount: 0 };
    });
  });

  it('A1: focus_lesson_start routes to Kids handler — no [payment-guard-hit]', async () => {
    const { ws, messages, logs } = await openAndWaitReady(SESSION_ID, 'tok-16j2-kids');
    const prevLR = messages.filter(m => m['type'] === 'lesson_ready').length;
    const logsBefore = logs.length;

    sendFrame(ws, { type: 'focus_lesson_start', payload: { unit: 1 } });

    // handleKidsBrainV1LessonStart sends a second lesson_ready
    await waitUntil(messages, msgs => msgs.filter(m => m['type'] === 'lesson_ready').length > prevLR);

    // [payment-guard-hit] must NOT have been emitted
    const guardLogs = logs.slice(logsBefore).filter(l => l.includes('[payment-guard-hit]'));
    expect(guardLogs, '[payment-guard-hit] must not fire for a valid Kids session').toHaveLength(0);

    // routing log must confirm USE_KIDS_BRAIN_V1 = true
    const routingLog = logs.slice(logsBefore).find(l => l.includes('routing_to_kids_brain_v1'));
    expect(routingLog, 'routing_to_kids_brain_v1 log must be present').toBeDefined();
    expect(routingLog).toContain('"USE_KIDS_BRAIN_V1":true');

    if (ws.readyState === WebSocket.OPEN) ws.close(1000, 'test-done');
  });
});

// ── Suite B — kids_sessions query throws → 4500, not 4402 ────────────────────

describe('16J.2 — B: kids_sessions DB error → 4500 SESSION_VERIFICATION_FAILED', () => {
  const SESSION_ID = 'sess-16j2-db-err';

  beforeEach(() => {
    mocks.queryMock.mockImplementation(async (sql: string) => {
      const s = sql.trim().toUpperCase();
      // Simulate table missing or DB outage for kids_sessions
      if (s.includes('FROM KIDS_SESSIONS')) {
        throw new Error('relation "kids_sessions" does not exist');
      }
      if (s.includes('SELECT LESSON_ID FROM LESSON_SESSIONS')) {
        return { rows: [], rowCount: 0 };
      }
      return { rows: [], rowCount: 0 };
    });
  });

  afterEach(() => {
    mocks.queryMock.mockReset();
    mocks.queryMock.mockImplementation(async () => ({ rows: [], rowCount: 0 }));
  });

  it('B1: WS closes with code 4500, not 4402', async () => {
    const { ws } = await openAndWaitReady(SESSION_ID, 'tok-16j2-kids');

    const closeProm = waitForClose(ws, 4000);
    sendFrame(ws, { type: 'focus_lesson_start', payload: { unit: 1 } });

    const { code } = await closeProm;
    expect(code, 'Must close with 4500, not 4402 Payment Required').toBe(4500);
  });

  it('B2: error message sent before close has code SESSION_VERIFICATION_FAILED', async () => {
    const { ws, messages } = await openAndWaitReady(SESSION_ID, 'tok-16j2-kids');

    const closeProm = waitForClose(ws, 4000);
    sendFrame(ws, { type: 'focus_lesson_start', payload: { unit: 1 } });
    await closeProm;

    const errMsg = messages.find(m => m['type'] === 'error' && m['code'] === 'SESSION_VERIFICATION_FAILED');
    expect(errMsg, 'SESSION_VERIFICATION_FAILED error must be sent before close').toBeDefined();

    const paymentMsg = messages.find(m => m['type'] === 'error' && m['code'] === 'PAYMENT_REQUIRED');
    expect(paymentMsg, 'PAYMENT_REQUIRED must NOT be sent for kids DB error').toBeUndefined();
  });
});

// ── Suite C — Adult session still gets 4402 via payment guard ─────────────────

describe('16J.2 — C: Adult session (no kids row) still reaches payment guard → 4402', () => {
  const SESSION_ID = 'sess-16j2-adult';

  beforeEach(() => {
    mocks.queryMock.mockImplementation(async (sql: string) => {
      const s = sql.trim().toUpperCase();
      // No kids session row for this adult session
      if (s.includes('FROM KIDS_SESSIONS')) {
        return { rows: [], rowCount: 0 };
      }
      if (s.includes('SELECT LESSON_ID FROM LESSON_SESSIONS')) {
        return { rows: [], rowCount: 0 };
      }
      // No subscription / usage rows
      return { rows: [], rowCount: 0 };
    });
  });

  afterEach(() => {
    mocks.queryMock.mockReset();
    mocks.queryMock.mockImplementation(async () => ({ rows: [], rowCount: 0 }));
  });

  it('C1: WS closes with 4402 Payment Required for adult without subscription', async () => {
    const { ws } = await openAndWaitReady(SESSION_ID, 'tok-16j2-adult');

    const closeProm = waitForClose(ws, 4000);
    sendFrame(ws, { type: 'focus_lesson_start', payload: { unit: 1 } });

    const { code } = await closeProm;
    expect(code, 'Adult without subscription must still close with 4402').toBe(4402);
  });

  it('C2: [payment-guard-hit] IS logged for adult session', async () => {
    const logs: string[] = [];
    const spy = vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      const line = args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
      if (line.includes('[payment-guard-hit]')) logs.push(line);
    });

    const ws = new WebSocket(kidsWsUrl(SESSION_ID, 'tok-16j2-adult'));
    const messages: Msg[] = [];
    ws.on('message', (raw) => {
      try { messages.push(JSON.parse(raw.toString()) as Msg); } catch { /* skip */ }
    });

    await new Promise<void>((resolve, reject) => {
      ws.once('open',  resolve);
      ws.once('error', reject);
    });

    const closeProm = waitForClose(ws, 4000);
    // Wait for initial lesson_ready before sending focus_lesson_start
    await waitUntil(messages, msgs => msgs.some(m => m['type'] === 'lesson_ready'), 3000);
    sendFrame(ws, { type: 'focus_lesson_start', payload: { unit: 1 } });
    await closeProm;

    spy.mockRestore();

    expect(logs.some(l => l.includes('[payment-guard-hit]')),
      '[payment-guard-hit] must be logged for adult session').toBe(true);
  });
});
