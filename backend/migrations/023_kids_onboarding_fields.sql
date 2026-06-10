-- Migration 023: Extend kids_brain_child_profiles for onboarding flow
-- Adds child_name (plain text display name), child_age_years (exact age), teacher_id.
-- Also adds UNIQUE constraint on user_id to prevent duplicate profiles.
-- Idempotent: all ALTER TABLE statements use ADD COLUMN IF NOT EXISTS.

ALTER TABLE kids_brain_child_profiles
  ADD COLUMN IF NOT EXISTS child_name      TEXT        CHECK (char_length(child_name) BETWEEN 1 AND 100),
  ADD COLUMN IF NOT EXISTS child_age_years INTEGER     CHECK (child_age_years BETWEEN 4 AND 14),
  ADD COLUMN IF NOT EXISTS teacher_id      VARCHAR(50) NOT NULL DEFAULT 'lucy';

-- UNIQUE constraint: one child profile per parent account
-- DO block to skip if constraint already exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_child_profile_user'
      AND conrelid = 'kids_brain_child_profiles'::regclass
  ) THEN
    ALTER TABLE kids_brain_child_profiles
      ADD CONSTRAINT uq_child_profile_user UNIQUE (user_id);
  END IF;
END $$;

COMMENT ON COLUMN kids_brain_child_profiles.child_name IS
  'Plain-text display name from onboarding (e.g. Alex). Encryption deferred.';
COMMENT ON COLUMN kids_brain_child_profiles.child_age_years IS
  'Exact age in years (4–14). age_band is derived: ≤7 → 6-7, ≥8 → 8-9.';
COMMENT ON COLUMN kids_brain_child_profiles.teacher_id IS
  'Selected teacher persona (lucy | tom | default).';
