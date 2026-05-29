-- Kids Brain v1 — Phase 7.6: Child Profiles table
-- Stores durable per-child profile. One row per child.
-- Spec: Patch 3 §3A.1. first_name stored as BYTEA (encryption in Phase 8).
-- Idempotent: uses CREATE TABLE IF NOT EXISTS and CREATE INDEX IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS kids_brain_child_profiles (
  child_id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                           UUID        NOT NULL,
  first_name_encrypted              BYTEA       NOT NULL,
  age_band                          VARCHAR(3)  NOT NULL CHECK (age_band IN ('6-7', '8-9')),
  production_confidence_baseline    NUMERIC(4,3) NOT NULL DEFAULT 0.300,
  l1_dependency_baseline            NUMERIC(4,3) NOT NULL DEFAULT 0.200,
  sessions_completed                INTEGER     NOT NULL DEFAULT 0,
  last_session_date                 DATE,
  stt_reliability_estimate          NUMERIC(4,3) NOT NULL DEFAULT 0.720,
  high_engagement_topics            TEXT[],
  preferred_activity_types          TEXT[],
  preferred_character_id            VARCHAR(64),
  safe_preferences                  BOOLEAN     NOT NULL DEFAULT TRUE,
  recent_successes                  TEXT[]      NOT NULL DEFAULT '{}',
  created_at                        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kids_profiles_user_id
  ON kids_brain_child_profiles (user_id);

CREATE INDEX IF NOT EXISTS idx_kids_profiles_last_session
  ON kids_brain_child_profiles (last_session_date);
