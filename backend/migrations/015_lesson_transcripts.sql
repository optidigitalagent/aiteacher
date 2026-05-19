-- Phase: Persistent Lesson Transcript Runtime
-- Stores every teacher/student/system turn so lessons are debuggable after disconnect.
-- Writes are fire-and-forget (never block the live lesson flow).

CREATE TABLE IF NOT EXISTS lesson_transcript_events (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id        TEXT        NOT NULL,
  session_id       TEXT,
  user_id          UUID        NOT NULL,
  student_id       UUID,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  speaker          TEXT        NOT NULL,   -- 'teacher' | 'student' | 'system'
  source           TEXT        NOT NULL,   -- 'ws' | 'stt' | 'ai' | 'system' | 'engine'
  message          TEXT        NOT NULL,
  phase            TEXT,
  exercise_number  INT,
  exercise_type    TEXT,
  item_index       INT,
  item_total       INT,
  retry_count      INT,
  correction_turn  TEXT,
  frontend_snapshot JSONB,
  metadata         JSONB
);

CREATE INDEX IF NOT EXISTS idx_transcript_lesson_created
  ON lesson_transcript_events(lesson_id, created_at);

CREATE INDEX IF NOT EXISTS idx_transcript_session_created
  ON lesson_transcript_events(session_id, created_at);

CREATE INDEX IF NOT EXISTS idx_transcript_user_created
  ON lesson_transcript_events(user_id, created_at);
