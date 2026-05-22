-- Telegram account linking: stores the platform user ↔ Telegram chat association.
-- Populated by the /api/integrations/telegram/link endpoint after bot token validation.

CREATE TABLE IF NOT EXISTS telegram_integrations (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  telegram_chat_id TEXT        NOT NULL,
  telegram_user_id TEXT,
  status           TEXT        NOT NULL DEFAULT 'linked',
  linked_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_ti_user_id  UNIQUE (user_id),
  CONSTRAINT uq_ti_chat_id  UNIQUE (telegram_chat_id),
  CONSTRAINT chk_ti_status  CHECK  (status IN ('linked', 'unlinked'))
);

CREATE INDEX IF NOT EXISTS idx_ti_user_id ON telegram_integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_ti_chat_id ON telegram_integrations(telegram_chat_id);
