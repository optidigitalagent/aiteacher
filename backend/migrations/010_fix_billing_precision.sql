-- paid_minutes_used was INT; lessons shorter than 1 min produced a decimal (e.g. 0.6)
-- which Postgres rejected.  Match the precision of paid_lesson_usage.minutes_used.
ALTER TABLE user_lesson_profiles
  ALTER COLUMN paid_minutes_used TYPE NUMERIC(8,2)
  USING paid_minutes_used::NUMERIC(8,2);
