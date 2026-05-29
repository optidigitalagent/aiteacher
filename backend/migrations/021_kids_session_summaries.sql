-- Kids Brain v1 — Phase 7.6: Session Summaries table
-- End-of-session pedagogical summary. One row per session. Raw turn data never stored.
-- Spec: Patch 3 §3A.3.
-- Idempotent: uses CREATE TABLE IF NOT EXISTS and CREATE INDEX IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS kids_brain_session_summaries (
  session_id            UUID        PRIMARY KEY,
  child_id              UUID        NOT NULL REFERENCES kids_brain_child_profiles(child_id) ON DELETE CASCADE,
  started_at            TIMESTAMPTZ NOT NULL,
  ended_at              TIMESTAMPTZ NOT NULL,
  duration_seconds      INTEGER     NOT NULL,
  stop_reason           VARCHAR(32) NOT NULL CHECK (stop_reason IN (
                          'normal', 'timeout', 'emotional', 'engagement', 'refusal', 'safety'
                        )),
  lesson_id             VARCHAR(64),
  lesson_phase_reached  VARCHAR(32),
  items_attempted_count INTEGER     NOT NULL DEFAULT 0,
  items_mastered_ids    TEXT[]      NOT NULL DEFAULT '{}',
  recovery_event_count  INTEGER     NOT NULL DEFAULT 0,
  l1_rescue_used        BOOLEAN     NOT NULL DEFAULT FALSE,
  speaking_turns_count  INTEGER     NOT NULL DEFAULT 0,
  completion_rate       NUMERIC(4,3),
  final_emotional_safety NUMERIC(4,3),
  parent_review_flagged BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_session_summaries_child_date
  ON kids_brain_session_summaries (child_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_session_summaries_parent_review
  ON kids_brain_session_summaries (child_id, parent_review_flagged)
  WHERE parent_review_flagged = TRUE;
