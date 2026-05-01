-- Migration 003: Demo safety fields + users-students bridge

ALTER TABLE users ADD COLUMN IF NOT EXISTS demo_started_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS student_id UUID REFERENCES students(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_users_student_id ON users(student_id);
