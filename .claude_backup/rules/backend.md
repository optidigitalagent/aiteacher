# Backend Coding Rules
> Applies to: backend/src/**/*.ts

## Language & Runtime
- TypeScript strict mode, no `any` types
- Node.js 20+, ESM modules
- All async functions must have try/catch

## Code Style
- Functions: camelCase, max 30 lines
- Files: kebab-case (lesson-orchestrator.ts)
- Classes: PascalCase
- Constants: UPPER_SNAKE_CASE
- DB tables: snake_case

## Critical Rules

### Redis
- ALWAYS set TTL on lesson keys: 4 hours (`EX 14400`)
- NEVER store sensitive data (passwords, tokens) in Redis
- Use `MULTI/EXEC` for atomic updates to lesson state

### PostgreSQL
- NEVER raw SQL in business logic — use parameterised queries
- ALWAYS use transactions for multi-table writes
- Index: `lessons.student_id`, `lesson_events.lesson_id`

### API Keys
- NEVER log API keys or full prompts
- NEVER hardcode keys — always from `process.env`
- Check `.env.example` for required variables

### Claude API
- Model: `claude-sonnet-4-6` (never change without team decision)
- Always stream responses — never await full completion
- Parse response JSON safely: wrap in try/catch + validate schema
- Max tokens per lesson turn: 400 (keep responses concise)

### WebSocket
- Validate all incoming messages against schema before processing
- Disconnect client after 45 min of inactivity
- Send heartbeat ping every 30 seconds

## Testing
- Run `npm test` before committing
- Unit tests for: ExerciseGenerator, PromptBuilder, FSM transitions
- Integration test: full lesson flow with mock student
