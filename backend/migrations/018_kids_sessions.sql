-- Phase: Mentium Kids Brain v1 — Experimental Authenticated Sessions
-- Stores kids prototype sessions separately from adult lesson_sessions.
-- No billing coupling. Prototype caps enforced at the WS layer.

CREATE TABLE IF NOT EXISTS kids_sessions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID        NOT NULL UNIQUE,
  user_id     UUID        NOT NULL,
  mode        VARCHAR(30) NOT NULL DEFAULT 'mentium_kids',
  status      VARCHAR(20) NOT NULL DEFAULT 'created',
  llm_calls   INTEGER     NOT NULL DEFAULT 0,
  stt_seconds FLOAT       NOT NULL DEFAULT 0,
  tts_chars   INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_kids_sessions_user_id    ON kids_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_kids_sessions_session_id ON kids_sessions(session_id);
