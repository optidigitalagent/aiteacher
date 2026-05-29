-- Kids Brain v1 — Phase 7.6: Mastery Records table
-- Per-child, per-vocabulary-item mastery state. One row per (child_id, item_id).
-- Spec: Patch 3 §3A.2. Confidence on 0–100 engine scale (Patch 7).
-- Idempotent: uses CREATE TABLE IF NOT EXISTS and CREATE INDEX IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS kids_brain_mastery_records (
  id                               BIGSERIAL    PRIMARY KEY,
  child_id                         UUID         NOT NULL REFERENCES kids_brain_child_profiles(child_id) ON DELETE CASCADE,
  item_id                          VARCHAR(64)  NOT NULL,
  mastery_level                    VARCHAR(16)  NOT NULL CHECK (mastery_level IN ('emerging', 'developing', 'secure', 'automatic')),
  production_confidence            NUMERIC(5,2) NOT NULL DEFAULT 0.00,
  comprehension_confidence         NUMERIC(5,2) NOT NULL DEFAULT 0.00,
  correct_production_count         INTEGER      NOT NULL DEFAULT 0,
  correct_comprehension_count      INTEGER      NOT NULL DEFAULT 0,
  sessions_seen                    INTEGER      NOT NULL DEFAULT 0,
  sessions_with_correct_production INTEGER      NOT NULL DEFAULT 0,
  prompted_correct_count           INTEGER      NOT NULL DEFAULT 0,
  unprompted_correct_count         INTEGER      NOT NULL DEFAULT 0,
  activity_types_succeeded         TEXT[]       NOT NULL DEFAULT '{}',
  last_seen_at                     TIMESTAMPTZ,
  last_correct_at                  TIMESTAMPTZ,
  review_due_at                    TIMESTAMPTZ,
  introduced_lesson_id             VARCHAR(64),
  introduced_at                    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at                       TIMESTAMPTZ  NOT NULL DEFAULT now(),

  UNIQUE (child_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_mastery_child_review_due
  ON kids_brain_mastery_records (child_id, review_due_at)
  WHERE review_due_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mastery_child_level
  ON kids_brain_mastery_records (child_id, mastery_level);
