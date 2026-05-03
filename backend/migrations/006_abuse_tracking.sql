-- Migration 006: Per-session abuse and attempt tracking

ALTER TABLE demo_sessions ADD COLUMN IF NOT EXISTS abuse_flags          INTEGER NOT NULL DEFAULT 0;
ALTER TABLE demo_sessions ADD COLUMN IF NOT EXISTS answer_attempts_total INTEGER NOT NULL DEFAULT 0;
