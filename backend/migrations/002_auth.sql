-- Auth tables — Google OAuth users + lesson profile + session tracking

CREATE TABLE IF NOT EXISTS users (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  google_provider_id  VARCHAR(255) UNIQUE NOT NULL,
  email               VARCHAR(255) UNIQUE NOT NULL,
  name                VARCHAR(255) NOT NULL,
  avatar_url          TEXT,
  created_at          TIMESTAMP DEFAULT NOW(),
  updated_at          TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_lesson_profiles (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  level                    VARCHAR(50)  DEFAULT 'Beginner',
  rank                     VARCHAR(100) DEFAULT 'New Learner',
  xp                       INT          DEFAULT 0,
  lessons_completed        INT          DEFAULT 0,
  demo_lessons_completed   INT          DEFAULT 0,
  current_book             VARCHAR(100),
  current_section          VARCHAR(50),
  subscription_status      VARCHAR(50)  DEFAULT 'free',
  demo_lesson_started_at   TIMESTAMP,
  demo_lesson_completed_at TIMESTAMP,
  demo_lesson_attempts     INT          DEFAULT 0,
  created_at               TIMESTAMP    DEFAULT NOW(),
  updated_at               TIMESTAMP    DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lesson_sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  session_id  VARCHAR(255) UNIQUE NOT NULL,
  mode        VARCHAR(50),
  book_id     VARCHAR(100),
  section_id  VARCHAR(100),
  teacher_id  VARCHAR(100),
  voice_id    VARCHAR(100),
  status      VARCHAR(50) DEFAULT 'created',
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW()
);

-- Link students to OAuth users (nullable — dev seed student has no user)
ALTER TABLE students ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_users_google        ON users(google_provider_id);
CREATE INDEX IF NOT EXISTS idx_users_email         ON users(email);
CREATE INDEX IF NOT EXISTS idx_lesson_sess_user    ON lesson_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_students_user_id    ON students(user_id);
