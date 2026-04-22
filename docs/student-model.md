# Student Model & Database Schema

## PostgreSQL Tables

```sql
-- STUDENTS
CREATE TABLE students (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(100) NOT NULL,
  age           INT NOT NULL,
  level         VARCHAR(5) NOT NULL,  -- A1, A2, B1, B2, C1
  textbook      VARCHAR(100),         -- e.g. "Focus B1"
  current_unit  INT DEFAULT 1,
  created_at    TIMESTAMP DEFAULT NOW()
);

-- STUDENT PROFILE (mastery tracking — updated after every lesson)
CREATE TABLE student_profiles (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id        UUID REFERENCES students(id),
  
  -- Grammar mastery scores (0.0 to 1.0)
  grammar_mastery   JSONB DEFAULT '{}',
  -- Example: { "past_simple_regular": 0.85, "past_simple_irregular": 0.40 }

  -- Vocabulary
  known_vocabulary  TEXT[] DEFAULT '{}',   -- words mastered
  weak_vocabulary   TEXT[] DEFAULT '{}',   -- words answered wrong 2+ times
  
  -- Error patterns (detected by AI, stored as text observations)
  error_patterns    TEXT[] DEFAULT '{}',
  -- Example: ["forgets -ed in negatives", "confuses went/gone"]
  
  -- Learning style (updated after 3+ lessons)
  learns_by           VARCHAR(50) DEFAULT 'examples_first',
  -- Options: examples_first | rules_first | story_based | drill_based
  
  attention_span_min  FLOAT DEFAULT 15.0,  -- auto-calculated from sessions
  
  updated_at          TIMESTAMP DEFAULT NOW()
);

-- LESSONS (one per session)
CREATE TABLE lessons (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id      UUID REFERENCES students(id),
  grammar_target  VARCHAR(100) NOT NULL,  -- e.g. "Past Simple"
  lesson_topic    VARCHAR(200),            -- e.g. "Mount Everest 1953"
  textbook_unit   VARCHAR(100),
  status          VARCHAR(20) DEFAULT 'active',  -- active | completed | abandoned
  phase_reached   VARCHAR(50),            -- last phase completed
  started_at      TIMESTAMP DEFAULT NOW(),
  ended_at        TIMESTAMP,
  score           FLOAT                   -- 0.0-1.0 overall lesson score
);

-- LESSON EVENTS (every exchange, exercise, phase change)
CREATE TABLE lesson_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id   UUID REFERENCES lessons(id),
  event_type  VARCHAR(50) NOT NULL,
  -- Types: student_utterance | ai_response | exercise_attempt |
  --        phase_change | vocabulary_item | error_noted
  payload     JSONB NOT NULL,
  created_at  TIMESTAMP DEFAULT NOW()
);

-- EXERCISES (generated + student answers)
CREATE TABLE exercises (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id       UUID REFERENCES lessons(id),
  type            VARCHAR(30) NOT NULL,
  -- Types: form_transformation | error_correction | reconstruction | free_production
  question        TEXT NOT NULL,
  correct_answer  TEXT NOT NULL,
  student_answer  TEXT,
  is_correct      BOOLEAN,
  attempts        INT DEFAULT 0,
  difficulty      FLOAT DEFAULT 0.5,  -- 0.0 easy → 1.0 very hard
  created_at      TIMESTAMP DEFAULT NOW()
);

-- VOCABULARY ITEMS (per lesson)
CREATE TABLE vocabulary_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id   UUID REFERENCES students(id),
  word         VARCHAR(100) NOT NULL,
  definition   TEXT,
  collocations TEXT[],
  example      TEXT,
  lesson_id    UUID REFERENCES lessons(id),
  mastery      FLOAT DEFAULT 0.0,  -- increases with correct usage
  next_review  TIMESTAMP,          -- spaced repetition schedule
  created_at   TIMESTAMP DEFAULT NOW()
);

-- TEXTBOOK UNITS (loaded from Focus textbook via RAG ingestion)
CREATE TABLE textbook_units (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  textbook     VARCHAR(100) NOT NULL,   -- "Focus B1"
  unit_number  INT NOT NULL,
  unit_title   VARCHAR(200),
  grammar_points  TEXT[],              -- ["Past Simple regular", "Past Simple irregular"]
  vocabulary_list TEXT[],
  pinecone_ids    TEXT[],              -- references to embedded chunks
  created_at   TIMESTAMP DEFAULT NOW()
);
```

## Redis Keys

```
lesson:{lessonId}:state      → JSON: current LessonState object
lesson:{lessonId}:context    → JSON: rolling conversation (last 8 exchanges)
lesson:{lessonId}:exercises  → JSON array: exercises this session
lesson:{lessonId}:errors     → JSON array: errors this session
session:{studentId}:active   → lessonId (which lesson is active now)
```

## LessonState TypeScript Type

```typescript
type LessonPhase =
  | 'DIAGNOSTIC'
  | 'CONTEXT_INPUT'
  | 'RULE_DISCOVERY'
  | 'EXERCISES'
  | 'VOCABULARY'
  | 'DEEP_THINKING'
  | 'WRAP_UP';

interface LessonState {
  lessonId: string;
  studentId: string;
  phase: LessonPhase;
  grammarTarget: string;
  lessonTopic: string;
  textbookUnit: string;
  
  exerciseCount: number;
  consecutiveCorrect: number;
  consecutiveErrors: number;
  currentDifficulty: number;  // 0.0–1.0
  
  vocabularyTaught: string[];
  errorsThisLesson: ErrorRecord[];
  
  startedAt: Date;
  phaseStartedAt: Date;
}

interface ErrorRecord {
  exercise: string;
  studentAnswer: string;
  correctAnswer: string;
  errorType: 'form' | 'irregular' | 'word_order' | 'vocabulary' | 'other';
  timestamp: Date;
}
```

## StudentProfile TypeScript Type

```typescript
interface StudentProfile {
  studentId: string;
  name: string;
  age: number;
  level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1';
  textbook: string;
  currentUnit: number;
  
  grammarMastery: Record<string, number>;  // topic → 0.0-1.0
  knownVocabulary: string[];
  weakVocabulary: string[];
  errorPatterns: string[];
  
  learnsBy: 'examples_first' | 'rules_first' | 'story_based' | 'drill_based';
  attentionSpanMin: number;
  
  lessonCount: number;
  lastLessonDate: Date;
}
```
