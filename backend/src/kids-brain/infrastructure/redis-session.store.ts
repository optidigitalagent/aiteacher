import type { Redis } from 'ioredis';
import type { SessionMemory } from '../contracts/session-memory.js';
import type { RedisSessionStore } from '../contracts/stores.js';
import type { ItemState } from '../state/item-state.js';

/**
 * Redis key format: kids:session:{sessionId}
 * TTL: configurable; default 30 minutes (1800 seconds).
 * Autosave uses a Lua CAS guard to prevent stale sequence overwriting newer state.
 *
 * Map serialization: SessionMemory.itemState is Map<string, ItemState>.
 * JSON.stringify drops Maps. We use a custom replacer/reviver.
 */

export const KIDS_SESSION_KEY_PREFIX = 'kids:session:';
export const DEFAULT_SESSION_TTL_SECONDS = 1800; // 30 minutes

export class RedisSessionStoreImpl implements RedisSessionStore {
  private readonly redis: Redis;
  private readonly ttlSeconds: number;

  constructor(redis: Redis, ttlSeconds = DEFAULT_SESSION_TTL_SECONDS) {
    this.redis = redis;
    this.ttlSeconds = ttlSeconds;
  }

  private key(sessionId: string): string {
    return `${KIDS_SESSION_KEY_PREFIX}${sessionId}`;
  }

  async getSession(sessionId: string): Promise<SessionMemory | null> {
    let raw: string | null;
    try {
      raw = await this.redis.get(this.key(sessionId));
    } catch (err) {
      throw new KidsRedisUnavailableError(
        `Redis unavailable on getSession(${sessionId}): ${String(err)}`,
      );
    }
    if (!raw) return null;
    return deserializeSession(raw);
  }

  async saveSession(session: SessionMemory): Promise<void> {
    try {
      await this.redis.set(
        this.key(session.sessionId),
        serializeSession(session),
        'EX',
        this.ttlSeconds,
      );
    } catch (err) {
      throw new KidsRedisUnavailableError(
        `Redis unavailable on saveSession(${session.sessionId}): ${String(err)}`,
      );
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    try {
      await this.redis.del(this.key(sessionId));
    } catch (err) {
      throw new KidsRedisUnavailableError(
        `Redis unavailable on deleteSession(${sessionId}): ${String(err)}`,
      );
    }
  }

  /**
   * Reconnect: loads session only if userId matches the stored userId.
   * Ownership enforcement: rejects sessions owned by a different user.
   */
  async reconnectSession(
    sessionId: string,
    userId: string,
  ): Promise<SessionMemory | null> {
    const session = await this.getSession(sessionId);
    if (!session) return null;
    if (session.userId !== userId) {
      return null; // ownership mismatch — caller should treat as session-not-found
    }
    return session;
  }

  /**
   * Autosave with sequence guard.
   * Uses a Lua script for atomic compare-and-set.
   * Only writes if stored autosaveSequenceNumber < incoming sequenceNumber.
   * Falls back to conservative read-compare-write if Lua is unavailable.
   *
   * Limitation note: the Lua CAS guard prevents stale overwrites within a single
   * Redis node. In a Redis Cluster setup (not used in v1 — see Patch 1 §1.5),
   * this guarantee does not extend across slot migrations.
   */
  async autosaveSession(
    session: SessionMemory,
    sequenceNumber: number,
  ): Promise<void> {
    const k = this.key(session.sessionId);
    const serialized = serializeSession(session);

    const luaScript = `
      local raw = redis.call('GET', KEYS[1])
      if not raw then
        redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[2])
        return 1
      end
      local ok, parsed = pcall(cjson.decode, raw)
      if not ok then
        redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[2])
        return 1
      end
      local stored_seq = parsed['autosaveSequenceNumber']
      if stored_seq == nil or stored_seq < tonumber(ARGV[3]) then
        redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[2])
        return 1
      end
      return 0
    `;

    try {
      await (this.redis as unknown as { eval: (...args: unknown[]) => Promise<unknown> }).eval(
        luaScript,
        1,
        k,
        serialized,
        String(this.ttlSeconds),
        String(sequenceNumber),
      );
    } catch {
      // Lua not available or eval failed: fall back to read-compare-write
      await this.autosaveFallback(session, sequenceNumber, k, serialized);
    }
  }

  private async autosaveFallback(
    session: SessionMemory,
    sequenceNumber: number,
    key: string,
    serialized: string,
  ): Promise<void> {
    try {
      const raw = await this.redis.get(key);
      if (raw) {
        const stored = deserializeSession(raw);
        if (stored.autosaveSequenceNumber >= sequenceNumber) {
          return; // Stored is newer — do not overwrite
        }
      }
      await this.redis.set(key, serialized, 'EX', this.ttlSeconds);
    } catch (err) {
      throw new KidsRedisUnavailableError(
        `Redis unavailable on autosaveFallback(${session.sessionId}): ${String(err)}`,
      );
    }
  }
}

// ── Serialization ─────────────────────────────────────────────────────────────

const MAP_TYPE_TAG = '__kidsMap__';

function serializeSession(session: SessionMemory): string {
  return JSON.stringify(session, (_key, value: unknown) => {
    if (value instanceof Map) {
      return { [MAP_TYPE_TAG]: true, entries: [...(value as Map<unknown, unknown>).entries()] };
    }
    return value;
  });
}

function deserializeSession(raw: string): SessionMemory {
  const parsed = JSON.parse(raw, (_key, value: unknown) => {
    if (
      value !== null &&
      typeof value === 'object' &&
      (value as Record<string, unknown>)[MAP_TYPE_TAG] === true
    ) {
      const typed = value as { entries: [string, ItemState][] };
      return new Map(typed.entries);
    }
    return value;
  }) as SessionMemory;
  return parsed;
}

// ── Error types ───────────────────────────────────────────────────────────────

export class KidsRedisUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'KidsRedisUnavailableError';
  }
}
