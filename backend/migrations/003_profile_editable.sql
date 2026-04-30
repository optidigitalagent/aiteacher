-- Extend user_lesson_profiles with editable fields and stats tracking

ALTER TABLE user_lesson_profiles
  ADD COLUMN IF NOT EXISTS display_name            VARCHAR(100),
  ADD COLUMN IF NOT EXISTS avatar_emoji            VARCHAR(10),
  ADD COLUMN IF NOT EXISTS learning_time_minutes   INT   DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_streak_days     INT   DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tests_completed         INT   DEFAULT 0,
  ADD COLUMN IF NOT EXISTS average_accuracy        FLOAT;
