-- Phase 3D.1: Persistent Mastery Schema
-- Per-skill, per-exercise-type mastery tracking across sessions.
-- Aggregation logic (upsert on lesson-end) added in Phase 3D.2 — this is schema-only.

CREATE TABLE IF NOT EXISTS student_skill_mastery (
  id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skill_tag                TEXT        NOT NULL,
  exercise_type            TEXT        NOT NULL,
  total_attempts           INTEGER     NOT NULL DEFAULT 0,
  correct_count            INTEGER     NOT NULL DEFAULT 0,
  wrong_count              INTEGER     NOT NULL DEFAULT 0,
  revealed_count           INTEGER     NOT NULL DEFAULT 0,
  answer_shape_issue_count INTEGER     NOT NULL DEFAULT 0,
  avg_retry_count          NUMERIC     NOT NULL DEFAULT 0,
  recent_wrong_streak      INTEGER     NOT NULL DEFAULT 0,
  confidence_level         TEXT        NOT NULL DEFAULT 'medium',
  last_mistake_category    TEXT,
  last_practiced_at        TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_ssm_user_skill_type
    UNIQUE (user_id, skill_tag, exercise_type),

  CONSTRAINT chk_ssm_confidence_level
    CHECK (confidence_level IN ('low', 'medium', 'high')),

  CONSTRAINT chk_ssm_total_attempts
    CHECK (total_attempts >= 0),

  CONSTRAINT chk_ssm_correct_count
    CHECK (correct_count >= 0),

  CONSTRAINT chk_ssm_wrong_count
    CHECK (wrong_count >= 0),

  CONSTRAINT chk_ssm_revealed_count
    CHECK (revealed_count >= 0),

  CONSTRAINT chk_ssm_answer_shape_issue_count
    CHECK (answer_shape_issue_count >= 0),

  CONSTRAINT chk_ssm_avg_retry_count
    CHECK (avg_retry_count >= 0),

  CONSTRAINT chk_ssm_recent_wrong_streak
    CHECK (recent_wrong_streak >= 0)
);

CREATE INDEX IF NOT EXISTS idx_ssm_user_id
  ON student_skill_mastery(user_id);

CREATE INDEX IF NOT EXISTS idx_ssm_user_confidence
  ON student_skill_mastery(user_id, confidence_level);

CREATE INDEX IF NOT EXISTS idx_ssm_user_last_practiced
  ON student_skill_mastery(user_id, last_practiced_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_ssm_user_skill
  ON student_skill_mastery(user_id, skill_tag);
