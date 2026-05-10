# LESSON_RUNTIME_STATE_MAP.md

# PURPOSE

This document maps the current runtime state as it exists in code (Phase 0 audit),
not the target state machine (which is defined for Phase 2).

Read this to understand what state actually exists and where it is stored.

--------------------------------------------------
SECTION 1 — STATE STORAGE LOCATIONS
--------------------------------------------------

# PRIMARY LESSON STATE — Redis

Key: `lesson:state:{lessonId}`
TTL: 14400 seconds (4 hours)
Type: JSON-serialized `LessonState` object

```typescript
interface LessonState {
  lessonId:    string           // UUID
  studentId:   string           // UUID (from students table)
  phase:       LessonPhase      // current FSM phase
  mode:        'free' | 'focus' // focus = textbook-grounded
  focusUnit?:  number           // e.g. 1, 2
  focusLesson?: string          // e.g. "1.2", "2.3"
  grammarTarget: string
  lessonTopic:   string
  textbookUnit:  string
  teacherId?:    string         // 'alex' | 'emma'
  voiceId?:      string         // 'onyx' | 'echo' | 'nova' | 'shimmer'

  // Exchange counters
  exchangeCount:       number   // total AI turns this lesson
  exerciseCount:       number   // correct exercise answers
  consecutiveCorrect:  number
  consecutiveErrors:   number
  currentDifficulty:   number   // 0.0-1.0 adaptive difficulty
  deepThinkingExchanges: number

  // Exercise sequencing (Focus mode)
  currentExerciseNum: number    // 1-based; 0 = not started
  completedExercises: number[]  // exercise numbers finished

  // Content tracking
  vocabularyTaught:  string[]
  errorsThisLesson:  ErrorRecord[]

  // Phase-transition flags
  studentConfirmedReading: boolean
  ruleStatedCorrectly:     boolean
  summaryDelivered:        boolean
  overviewShown:           boolean  // grammar card shown once

  startedAt:      string  // ISO timestamp of lesson creation
  phaseStartedAt: string  // ISO timestamp of current phase start
}
```

# CONVERSATION HISTORY — Redis

Key: `lesson:context:{lessonId}`
TTL: 14400 seconds (4 hours)
Type: JSON array of `{ role: 'user' | 'assistant', content: string }[]`
Trimmed to last 8 exchanges (16 messages) before each Claude call.

# ACTIVE SESSION POINTER — Redis

Key: `student:active:{studentId}`
TTL: 14400 seconds (4 hours)
Value: lessonId string

Used to detect if student has an ongoing lesson when connecting.

# SESSION LINK — PostgreSQL

Table: `lesson_sessions`
Key columns: `session_id`, `user_id`, `lesson_id`, `status`
Added in migration 009_paid_lesson_resume.sql

- Created by `/lesson/start` REST endpoint before WS connects
- `lesson_id` is written back by `handleFocusLessonStart()` after lesson creation
- `status` becomes 'completed' when lesson ends

Used for resume detection on reconnect:
```sql
SELECT lesson_id FROM lesson_sessions
WHERE session_id = $1 AND user_id = $2 AND status = 'active'
```

# LESSON RECORD — PostgreSQL

Table: `lessons`
Key columns: `id`, `student_id`, `grammar_target`, `lesson_topic`, `textbook_unit`, `status`

Created in `handleFocusLessonStart()`.
Updated to `status = 'completed'` when phase reaches END.

# USAGE TRACKING — PostgreSQL

Table: `paid_lesson_usage`
Key columns: `id`, `user_id`, `session_id`, `started_at`, `ended_at`, `minutes_used`, `status`

- Created or linked in `checkAndLinkPaidSession()`
- Finalized in `finalizeUsage()` on WS disconnect
- Minutes capped at PLAN_LESSON_MINUTES (50)

Table: `user_lesson_profiles`
Key columns: `user_id`, `subscription_status`, `paid_minutes_used`, `paid_minutes_limit`

Updated by `finalizeUsage()`:
```sql
UPDATE user_lesson_profiles
SET paid_minutes_used = LEAST(paid_minutes_limit, paid_minutes_used + $minutes)
WHERE user_id = $userId
```

--------------------------------------------------
SECTION 2 — RUNTIME PHASE STATE MACHINE (CURRENT)
--------------------------------------------------

Current FSM phases (as of Phase 0):

```
DIAGNOSTIC
  ↓ (2 exchanges OR AI signal "transition_to:CONTEXT_INPUT")
CONTEXT_INPUT
  ↓ (studentConfirmedReading=true OR non-Grammar section)
RULE_DISCOVERY
  ↓ (ruleStatedCorrectly=true OR Vocab/Listen/Reading section)
EXERCISES
  ↓ (6+ correct exercises OR AI signal "transition_to:VOCABULARY")
VOCABULARY
  ↓ (6+ words taught OR AI signal)
DEEP_THINKING
  ↓ (3+ exchanges OR AI signal)
WRAP_UP
  ↓ (summaryDelivered=true OR AI signal "summary_delivered")
END
```

NOTE: This is the CURRENT phase model.
Phase 2 will replace this with the structured state machine from ROADMAP:
LESSON_READY → INTRO → TOPIC_INTERACTIVE → EXERCISE_INTRO → EXERCISE_ACTIVE →
READING_ACTIVE → SIDE_QUESTION → REFLECTION → PARAGRAPH_COMPLETE → LESSON_COMPLETE → PAUSED

--------------------------------------------------
SECTION 3 — IN-MEMORY STATE (ClientMeta per WS connection)
--------------------------------------------------

Each WebSocket connection holds a `ClientMeta` object in memory:

```typescript
interface ClientMeta {
  lessonId:        string | null   // links to Redis/PG lesson
  studentId:       string | null   // from JWT
  userId:          string | null   // from JWT
  sessionId:       string | null   // from WS query param
  usageId:         string | null   // paid_lesson_usage.id
  lessonStartedAt: number | null   // Date.now() at lesson begin
  voiceId:         string | null   // TTS voice
  teacherId:       string | null   // 'alex' | 'emma'
  lastSeen:        number          // for inactivity tracking
  heartbeatRef:    Interval        // 30s ping
  timeoutRef:      Timeout         // 45min inactivity kill
  maxDurationRef:  Timeout | null  // 50min hard lesson cap
  stt:             DeepgramSTT | null
  ttsController:   AbortController | null
  aiCallCount:     number          // for cost estimation on disconnect
  ttsCharCount:    number          // for cost estimation on disconnect
  aiProcessing:    boolean         // concurrent AI call guard (added Phase 0)
}
```

This state is LOST on process restart. Resume state depends on Redis + PostgreSQL.

--------------------------------------------------
SECTION 4 — KNOWN STATE GAPS (To Fix In Future Phases)
--------------------------------------------------

The following state is NOT currently tracked but is required by the ROADMAP:

Missing from LessonState (Phase 3+):
- exact exercise cursor (item_index, sub_item_index)
- reading paragraph index
- word box state (available_words, used_words)
- completed_items at sub-exercise level
- failed_items tracking
- reflection state
- lesson agenda (active objective, interrupted_context)

Missing from PostgreSQL (Phase 5+):
- persistent tips (vocabulary, grammar, pronunciation mistakes)
- lesson memory snapshots
- student correction history

Missing from runtime (Phase 2+):
- explicit PAUSED state
- time-remaining awareness in AI prompts
- structured lesson timer (elapsed_seconds in LessonState)
