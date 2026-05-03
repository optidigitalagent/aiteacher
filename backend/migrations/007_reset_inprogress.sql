-- Migration 007: Reset in-progress demo sessions for new 6-step lesson flow
-- Step indices 1–3 are remapped (two new follow-up steps inserted at index 1 and 4).
-- In-progress sessions with step_index 1-3 would show the wrong step, so reset them.
UPDATE demo_sessions
SET status        = 'reset',
    step_index    = 0,
    current_step  = 'warm_up',
    updated_at    = NOW()
WHERE status = 'in_progress';
