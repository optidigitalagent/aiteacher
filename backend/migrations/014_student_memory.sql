-- Phase: Student Memory System
-- Persistent learning intelligence across lessons.
-- AI Teacher reads summaries — never writes directly.

-- Long-term student learning profile (one row per user)
CREATE TABLE IF NOT EXISTS student_memory_profiles (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  learning_level           VARCHAR(50)  DEFAULT 'Beginner',
  average_accuracy         DECIMAL(5,2) DEFAULT 0,
  learning_speed           VARCHAR(20)  DEFAULT 'normal',     -- 'slow' | 'normal' | 'fast'
  confidence_trend         VARCHAR(20)  DEFAULT 'stable',     -- 'declining' | 'stable' | 'improving'
  preferred_correction_style VARCHAR(30) DEFAULT 'ladder',    -- 'ladder' | 'direct' | 'gentle'
  weak_topics              JSONB        DEFAULT '[]',
  strong_topics            JSONB        DEFAULT '[]',
  pronunciation_issues     JSONB        DEFAULT '[]',
  vocabulary_weaknesses    JSONB        DEFAULT '[]',
  grammar_weaknesses       JSONB        DEFAULT '[]',
  revision_recommendations JSONB        DEFAULT '[]',
  total_lessons            INT          DEFAULT 0,
  total_exercises_attempted INT         DEFAULT 0,
  total_correct            INT          DEFAULT 0,
  created_at               TIMESTAMP    NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_smp_user_id ON student_memory_profiles(user_id);

-- Per-validation raw events (granular signal stream)
CREATE TABLE IF NOT EXISTS student_memory_events (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id       VARCHAR(255),
  lesson_id        VARCHAR(255),
  event_type       VARCHAR(50)  NOT NULL,  -- 'validation' | 'exercise_complete' | 'lesson_complete'
  exercise_type    VARCHAR(50),
  topic            VARCHAR(255),
  section_id       VARCHAR(100),
  correctness_score DECIMAL(5,2),          -- 0–100
  is_correct       BOOLEAN,
  retry_count      INT          DEFAULT 0,
  mistake_types    JSONB        DEFAULT '[]',  -- e.g. ["wrong_tense", "word_order"]
  metadata         JSONB        DEFAULT '{}',
  created_at       TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sme_user_id     ON student_memory_events(user_id);
CREATE INDEX IF NOT EXISTS idx_sme_session_id  ON student_memory_events(session_id);
CREATE INDEX IF NOT EXISTS idx_sme_lesson_id   ON student_memory_events(lesson_id);
CREATE INDEX IF NOT EXISTS idx_sme_event_type  ON student_memory_events(event_type);
CREATE INDEX IF NOT EXISTS idx_sme_created_at  ON student_memory_events(created_at);

-- Per-lesson memory summary (one row per completed lesson session)
CREATE TABLE IF NOT EXISTS student_lesson_memory (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id           VARCHAR(255),
  session_id          VARCHAR(255),
  book_id             VARCHAR(100),
  section_id          VARCHAR(100),
  completed_exercises JSONB        DEFAULT '[]',
  accuracy            DECIMAL(5,2) DEFAULT 0,
  mistake_summary     JSONB        DEFAULT '[]',
  hint_count          INT          DEFAULT 0,
  voice_attempt_count INT          DEFAULT 0,
  duration_seconds    INT          DEFAULT 0,
  phase_reached       VARCHAR(50),
  created_at          TIMESTAMP    NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_slm_user_id    ON student_lesson_memory(user_id);
CREATE INDEX IF NOT EXISTS idx_slm_section_id ON student_lesson_memory(section_id);
CREATE INDEX IF NOT EXISTS idx_slm_lesson_id  ON student_lesson_memory(lesson_id);
