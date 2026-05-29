-- Kids Brain v1 — Phase 7.6: Safety Events table
-- Append-only audit log. Isolated from all AI-accessible data paths.
-- child_id is intentionally NOT a FK to prevent cascade deletes erasing the audit trail.
-- No raw utterance text is stored. No AI module reads this table at runtime.
-- Spec: Patch 3 §3A.4.
-- Idempotent: uses CREATE TABLE IF NOT EXISTS and CREATE INDEX IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS kids_brain_safety_events (
  id               BIGSERIAL    PRIMARY KEY,
  session_id       UUID         NOT NULL,
  child_id         UUID         NOT NULL,
  event_type       VARCHAR(32)  NOT NULL,
  confidence_score NUMERIC(4,3) NOT NULL,
  detection_method VARCHAR(32)  NOT NULL CHECK (detection_method IN (
                     'keyword_list', 'safety_classifier', 'pattern_rule'
                   )),
  review_status    VARCHAR(16)  NOT NULL DEFAULT 'pending' CHECK (review_status IN (
                     'pending', 'reviewed', 'dismissed'
                   )),
  occurred_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  reviewer_id      UUID,
  reviewed_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_safety_events_pending
  ON kids_brain_safety_events (review_status, occurred_at)
  WHERE review_status = 'pending';

CREATE INDEX IF NOT EXISTS idx_safety_events_session
  ON kids_brain_safety_events (session_id);
