-- AI English Teacher — Initial Schema
-- Run via: npm run migrate

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS students (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(100) NOT NULL,
  age           INT NOT NULL,
  level         VARCHAR(5)  NOT NULL,
  textbook      VARCHAR(100),
  current_unit  INT DEFAULT 1,
  created_at    TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS student_profiles (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id          UUID REFERENCES students(id) ON DELETE CASCADE,
  grammar_mastery     JSONB DEFAULT '{}',
  known_vocabulary    TEXT[] DEFAULT '{}',
  weak_vocabulary     TEXT[] DEFAULT '{}',
  error_patterns      TEXT[] DEFAULT '{}',
  learns_by           VARCHAR(50) DEFAULT 'examples_first',
  attention_span_min  FLOAT DEFAULT 15.0,
  updated_at          TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lessons (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id      UUID REFERENCES students(id) ON DELETE CASCADE,
  grammar_target  TEXT NOT NULL,
  lesson_topic    TEXT,
  textbook_unit   TEXT,
  status          VARCHAR(20) DEFAULT 'active',
  phase_reached   VARCHAR(50),
  started_at      TIMESTAMP DEFAULT NOW(),
  ended_at        TIMESTAMP,
  score           FLOAT
);

CREATE TABLE IF NOT EXISTS lesson_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id   UUID REFERENCES lessons(id) ON DELETE CASCADE,
  event_type  VARCHAR(50) NOT NULL,
  payload     JSONB NOT NULL,
  created_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS exercises (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id       UUID REFERENCES lessons(id) ON DELETE CASCADE,
  type            VARCHAR(30) NOT NULL,
  question        TEXT NOT NULL,
  correct_answer  TEXT NOT NULL,
  student_answer  TEXT,
  is_correct      BOOLEAN,
  attempts        INT DEFAULT 0,
  difficulty      FLOAT DEFAULT 0.5,
  created_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vocabulary_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id   UUID REFERENCES students(id) ON DELETE CASCADE,
  word         VARCHAR(100) NOT NULL,
  definition   TEXT,
  collocations TEXT[] DEFAULT '{}',
  example      TEXT,
  lesson_id    UUID REFERENCES lessons(id) ON DELETE SET NULL,
  mastery      FLOAT DEFAULT 0.0,
  next_review  TIMESTAMP,
  created_at   TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS textbook_units (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  textbook        VARCHAR(100) NOT NULL,
  unit_number     INT NOT NULL,
  unit_title      VARCHAR(200),
  grammar_points  TEXT[] DEFAULT '{}',
  vocabulary_list TEXT[] DEFAULT '{}',
  pinecone_ids    TEXT[] DEFAULT '{}',
  created_at      TIMESTAMP DEFAULT NOW(),
  UNIQUE (textbook, unit_number)
);

-- Indexes for hot query paths
CREATE INDEX IF NOT EXISTS idx_lessons_student_id     ON lessons(student_id);
CREATE INDEX IF NOT EXISTS idx_lesson_events_lesson   ON lesson_events(lesson_id);
CREATE INDEX IF NOT EXISTS idx_exercises_lesson       ON exercises(lesson_id);
CREATE INDEX IF NOT EXISTS idx_vocab_student          ON vocabulary_items(student_id);
CREATE INDEX IF NOT EXISTS idx_vocab_next_review      ON vocabulary_items(next_review);
