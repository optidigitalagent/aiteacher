-- Phase 5: Persistent Learning Tips
-- Next migration after 010_fix_billing_precision.sql

CREATE TABLE IF NOT EXISTS student_tips (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id  UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  lesson_id   UUID REFERENCES lessons(id) ON DELETE SET NULL,
  section     VARCHAR(50),
  exercise_id VARCHAR(255),
  category    VARCHAR(30) NOT NULL CHECK (category IN ('VOCAB','PHRASE','GRAMMAR','PRONUNCIATION','COMMON_MISTAKE')),
  title       VARCHAR(255) NOT NULL,
  explanation TEXT NOT NULL,
  example     TEXT,
  source      VARCHAR(50) NOT NULL CHECK (source IN ('confusion','correction','vocabulary','observation')),
  created_at  TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tips_student_id      ON student_tips(student_id);
CREATE INDEX IF NOT EXISTS idx_tips_student_section ON student_tips(student_id, section);
CREATE INDEX IF NOT EXISTS idx_tips_created         ON student_tips(student_id, created_at DESC);
