-- Migration 004: Demo sessions table

CREATE TABLE IF NOT EXISTS demo_sessions (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  student_id           UUID REFERENCES students(id) ON DELETE SET NULL,
  lesson_mood          VARCHAR(50) NOT NULL,
  interest_area        VARCHAR(50) NOT NULL,
  teacher_style        VARCHAR(50) NOT NULL,
  speaking_confidence  VARCHAR(50) NOT NULL,
  demo_mission         VARCHAR(50) NOT NULL,
  status               VARCHAR(20) NOT NULL DEFAULT 'created',
  device_id            VARCHAR(64),
  created_at           TIMESTAMP DEFAULT NOW(),
  updated_at           TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_demo_sessions_user ON demo_sessions(user_id);
