-- Link lesson_sessions to the active lesson for resume support after disconnect

ALTER TABLE lesson_sessions
  ADD COLUMN IF NOT EXISTS lesson_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS section_number VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_lesson_sess_lesson_id ON lesson_sessions(lesson_id);
