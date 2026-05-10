-- Phase 6: Persist lesson state snapshots to PostgreSQL for resume beyond Redis TTL.
-- Snapshots are written on every WS disconnect and restored into Redis on reconnect
-- when the 4-hour Redis TTL has expired but the lesson still has time remaining.

CREATE TABLE IF NOT EXISTS lesson_snapshots (
  id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id  VARCHAR(255) NOT NULL,
  session_id VARCHAR(255),
  student_id UUID         NOT NULL,
  snapshot   JSONB        NOT NULL,
  created_at TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_snapshots_student
  ON lesson_snapshots(student_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_snapshots_lesson
  ON lesson_snapshots(lesson_id, created_at DESC);
