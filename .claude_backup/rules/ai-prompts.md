# AI Prompt Rules
> Applies to: docs/master-prompt.md, backend/src/ai/**

## Before Editing master-prompt.md
1. Read the full file first
2. Understand which PHASE the change affects
3. Test the change manually with 3 scenarios

## Forbidden Changes
- NEVER remove the "NEVER say Wrong" rule
- NEVER remove the Socratic method requirement
- NEVER remove the JSON output format
- NEVER increase max_tokens above 400 per turn

## Prompt Builder Rules
- Total system prompt: MAX 4000 tokens
- RAG context injection: MAX 800 tokens (top 3 Pinecone chunks)
- Conversation history: last 8 exchanges ONLY (rolling window)
- Student profile: summarise — don't dump raw JSON over 200 tokens

## When Editing Prompts
- Always test with: a correct answer, a wrong answer, a confused student
- The AI must never state a grammar rule before the student attempts it
- The AI must always end its turn with a question OR clear instruction
