-- Migration 002: Users table (Google OAuth) + Demo sessions

CREATE TABLE IF NOT EXISTS users (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  google_id               VARCHAR(100) UNIQUE,
  email                   VARCHAR(200) UNIQUE NOT NULL,
  name                    VARCHAR(200) NOT NULL,
  avatar_url              TEXT,
  demo_lessons_completed  INT NOT NULL DEFAULT 0,
  created_at              TIMESTAMP DEFAULT NOW(),
  updated_at              TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS demo_sessions (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_mood          VARCHAR(50) NOT NULL,
  interest_area        VARCHAR(50) NOT NULL,
  teacher_style        VARCHAR(50) NOT NULL,
  speaking_confidence  VARCHAR(50) NOT NULL,
  demo_mission         VARCHAR(50) NOT NULL,
  status               VARCHAR(20) NOT NULL DEFAULT 'created',
  created_at           TIMESTAMP DEFAULT NOW(),
  updated_at           TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_google_id    ON users(google_id);
CREATE INDEX IF NOT EXISTS idx_demo_sessions_user ON demo_sessions(user_id);
