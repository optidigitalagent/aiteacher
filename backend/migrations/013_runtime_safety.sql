-- Phase 11: Runtime safety — billing integrity and continuation accuracy

-- Add lesson_id to paid_lesson_usage so we can query all usage records for a lesson.
-- Used for per-lesson billing caps and accurate continuation-status time tracking.
ALTER TABLE paid_lesson_usage
  ADD COLUMN IF NOT EXISTS lesson_id VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_paid_usage_lesson_id
  ON paid_lesson_usage(lesson_id);

-- Composite index for the idempotent finalizeUsage check (WHERE id = $1 AND status = 'active')
CREATE INDEX IF NOT EXISTS idx_paid_usage_id_status
  ON paid_lesson_usage(id, status);

-- Index to accelerate the continuation-status JOIN: lesson_sessions active rows with a lesson_id
CREATE INDEX IF NOT EXISTS idx_lesson_sess_active_with_lesson
  ON lesson_sessions(user_id, status, lesson_id)
  WHERE status = 'active' AND lesson_id IS NOT NULL;
