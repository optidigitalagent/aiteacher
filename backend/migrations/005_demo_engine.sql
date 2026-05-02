-- Migration 005: Demo engine step tracking

ALTER TABLE demo_sessions ADD COLUMN IF NOT EXISTS current_step      VARCHAR(50)  DEFAULT 'warm_up';
ALTER TABLE demo_sessions ADD COLUMN IF NOT EXISTS step_index        INT          DEFAULT 0;
ALTER TABLE demo_sessions ADD COLUMN IF NOT EXISTS answers           JSONB        DEFAULT '{}';
ALTER TABLE demo_sessions ADD COLUMN IF NOT EXISTS scores            JSONB        DEFAULT '{}';
ALTER TABLE demo_sessions ADD COLUMN IF NOT EXISTS final_result      JSONB;
ALTER TABLE demo_sessions ADD COLUMN IF NOT EXISTS ai_calls_used     INT          DEFAULT 0;
ALTER TABLE demo_sessions ADD COLUMN IF NOT EXISTS voice_inputs_used INT          DEFAULT 0;
ALTER TABLE demo_sessions ADD COLUMN IF NOT EXISTS started_lesson_at TIMESTAMP;
ALTER TABLE demo_sessions ADD COLUMN IF NOT EXISTS completed_at      TIMESTAMP;
