# Lesson Finite State Machine (FSM)

## Overview

A lesson is a deterministic state machine with 7 phases.
The LessonOrchestrator manages transitions.
State is stored in Redis. Never in memory.

## State Diagram

```
                    ┌─────────────┐
                    │   START     │
                    └──────┬──────┘
                           │ lesson:start event
                           ▼
                    ┌─────────────┐
                    │ DIAGNOSTIC  │ 3 min max
                    │             │ 2-3 questions
                    └──────┬──────┘
                           │ after 2+ exchanges
                           ▼
                    ┌─────────────┐
                    │CONTEXT_INPUT│ 4 min
                    │             │ real-world text
                    └──────┬──────┘
                           │ student reads text
                           ▼
                    ┌──────────────┐
                    │RULE_DISCOVERY│ 5 min
                    │              │ Socratic Q&A
                    └──────┬───────┘
                           │ student states rule correctly
                           ▼
                    ┌─────────────┐
               ┌───│  EXERCISES  │ 15 min ───┐
               │   │             │           │
               │   └──────┬──────┘           │
               │          │                  │
          difficulty   6+ exercises       difficulty
            drops         done              rises
               │          │                  │
               └──────────┘──────────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │ VOCABULARY  │ 5 min
                    │             │ 6-8 words
                    └──────┬──────┘
                           │ all words covered
                           ▼
                    ┌──────────────┐
                    │DEEP_THINKING │ 5 min
                    │              │ opinion + dialogue
                    └──────┬───────┘
                           │ natural conversation end
                           ▼
                    ┌─────────────┐
                    │   WRAP_UP   │ 3 min
                    │             │ summary + homework
                    └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐
                    │     END     │ → save to DB
                    └─────────────┘
```

## Phase Transition Rules

```typescript
type TransitionCondition = {
  from: LessonPhase;
  to: LessonPhase;
  condition: (state: LessonState) => boolean;
};

const transitions: TransitionCondition[] = [
  {
    from: 'DIAGNOSTIC',
    to: 'CONTEXT_INPUT',
    condition: (s) => s.exchangeCount >= 2,
  },
  {
    from: 'CONTEXT_INPUT',
    to: 'RULE_DISCOVERY',
    condition: (s) => s.studentConfirmedReading === true,
  },
  {
    from: 'RULE_DISCOVERY',
    to: 'EXERCISES',
    condition: (s) => s.ruleStatedCorrectly === true,
  },
  {
    from: 'EXERCISES',
    to: 'VOCABULARY',
    condition: (s) => s.exerciseCount >= 6 || s.exerciseMinutes >= 15,
  },
  {
    from: 'VOCABULARY',
    to: 'DEEP_THINKING',
    condition: (s) => s.vocabularyTaught.length >= 6,
  },
  {
    from: 'DEEP_THINKING',
    to: 'WRAP_UP',
    condition: (s) => s.deepThinkingExchanges >= 3,
  },
  {
    from: 'WRAP_UP',
    to: 'END',
    condition: (s) => s.summaryDelivered === true,
  },
];
```

## LessonOrchestrator Interface

```typescript
class LessonOrchestrator {
  // Called when student sends a message or audio
  async process(lessonId: string, input: StudentInput): Promise<AIResponse> {
    const state = await this.getState(lessonId);          // Redis
    const profile = await this.getProfile(state.studentId); // PostgreSQL
    const ragContext = await this.queryRAG(state);          // Pinecone
    
    const prompt = this.promptBuilder.build(state, profile, ragContext);
    const aiResponse = await this.callClaude(prompt);      // streaming
    
    await this.updateState(lessonId, aiResponse);           // Redis
    await this.logEvent(lessonId, input, aiResponse);       // PostgreSQL
    
    if (this.shouldTransition(state, aiResponse)) {
      await this.transition(lessonId);
    }
    
    return aiResponse;
  }
  
  private shouldTransition(state: LessonState, response: AIResponse): boolean {
    // AI can also request transition via next_action field in its JSON response
    if (response.nextAction?.startsWith('transition_to:')) return true;
    // Check time-based rules
    const condition = transitions.find(t => t.from === state.phase);
    return condition?.condition(state) ?? false;
  }
}
```

## Phase Time Limits (hard caps)

If a phase exceeds these limits → force transition:
```
DIAGNOSTIC:       5 minutes max
CONTEXT_INPUT:    7 minutes max
RULE_DISCOVERY:   10 minutes max (if student can't get it → give rule, move on)
EXERCISES:        20 minutes max
VOCABULARY:       8 minutes max
DEEP_THINKING:    8 minutes max
WRAP_UP:          5 minutes max
TOTAL LESSON:     45 minutes max
```
