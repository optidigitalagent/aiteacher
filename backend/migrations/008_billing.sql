-- Billing: payments, subscription extension, paid lesson usage tracking

-- Payments table: one row per payment attempt
CREATE TABLE IF NOT EXISTS payments (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider             VARCHAR(50)   NOT NULL DEFAULT 'liqpay',
  order_id             VARCHAR(255)  NOT NULL UNIQUE,
  plan_id              VARCHAR(100)  NOT NULL,
  amount               DECIMAL(10,2) NOT NULL,
  currency             VARCHAR(10)   NOT NULL DEFAULT 'UAH',
  status               VARCHAR(50)   NOT NULL DEFAULT 'pending',
  raw_provider_payload JSONB,
  created_at           TIMESTAMP     NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMP     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_user_id  ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_status   ON payments(status);

-- Extend user_lesson_profiles with subscription / billing fields
ALTER TABLE user_lesson_profiles
  ADD COLUMN IF NOT EXISTS plan_id             VARCHAR(100),
  ADD COLUMN IF NOT EXISTS plan_started_at     TIMESTAMP,
  ADD COLUMN IF NOT EXISTS plan_expires_at     TIMESTAMP,
  ADD COLUMN IF NOT EXISTS paid_minutes_limit  INT          NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paid_minutes_used   INT          NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paid_lessons_limit  INT          NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paid_lesson_minutes INT          NOT NULL DEFAULT 0;

-- Paid lesson usage: tracks actual time consumed per session
-- session_id references lesson_sessions.session_id (VARCHAR, no FK for flexibility)
CREATE TABLE IF NOT EXISTS paid_lesson_usage (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id   VARCHAR(255),
  started_at   TIMESTAMP    NOT NULL DEFAULT NOW(),
  ended_at     TIMESTAMP,
  minutes_used DECIMAL(8,2) NOT NULL DEFAULT 0,
  status       VARCHAR(50)  NOT NULL DEFAULT 'active'
);

CREATE INDEX IF NOT EXISTS idx_paid_usage_user_id    ON paid_lesson_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_paid_usage_session_id ON paid_lesson_usage(session_id);
CREATE INDEX IF NOT EXISTS idx_paid_usage_status     ON paid_lesson_usage(status);
