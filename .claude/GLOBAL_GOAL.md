# GLOBAL_GOAL.md — Mentium AI Teacher

## ACTIVE GOAL

Build Mentium Kids into a release-ready AI English teacher based on Kid's Box,
with textbook-driven exercise flow, child-friendly teacher behavior, safe
backend-first architecture, reliable voice, visual-ready exercise rendering,
and production-grade QA.

---

## ACCEPTANCE CRITERIA

The goal is NOT complete until ALL of the following are satisfied:

### Curriculum
- [ ] Kid's Box Unit 1 exercises fully mapped and implemented
- [ ] All Unit 1 exercise types render correctly (LISTEN_AND_REPEAT, LISTEN_AND_CHOOSE, CHANT, REVIEW)
  Note: SONG and STORY_LISTEN are not used in Unit 1 (RISK-003, deferred to future units)
- [ ] Escalation ladder fires correctly on 2nd wrong answer
- [ ] Exercise completion triggers correct next exercise

### Teacher Behavior
- [ ] Teacher never says "Wrong" — uses positive redirection
- [ ] Teacher uses Socratic method — never gives answer before student tries
- [ ] Every teacher turn ends with a question or clear instruction
- [ ] Child-friendly language (simple, encouraging, short sentences)

### Voice
- [ ] STT latency < 2.5s from speech end to AI response start
- [ ] No Deepgram HTTP 400 or reconnect failures in production
- [ ] TTS streams correctly — no full-text buffering
- [ ] Silence detection fires correctly (not too fast, not too slow)

### Visual UI
- [ ] Exercise context message sent on every exercise start (exerciseType, visualAssetUrl)
- [ ] KidsClassroomPage renders exercise panel correctly
- [ ] Graceful fallback when visualAssetUrl is absent
- [ ] No UI regressions on adult lesson flow

### Backend Architecture
- [ ] No unauthenticated resource usage
- [ ] No billing/auth regressions
- [ ] Session ownership protected
- [ ] Redis TTL set on all lesson keys
- [ ] No cost-leaking loops

### QA
- [ ] TypeScript build: npx tsc --noEmit → exit 0
- [ ] Full test suite: npm test → all pass
- [ ] No pre-existing test regressions introduced
- [ ] Production logs verified after deploy

### Deployment
- [ ] Railway deploy completed
- [ ] Server listening on $PORT (8080 on Railway) confirmed in logs
- [ ] No critical errors in first 10 minutes of production logs

---

## CONSTRAINTS (do NOT touch unless goal explicitly requires it)

- docs/master-prompt.md — only via update-prompt skill
- billing / payment / auth logic
- Adult lesson flow (non-Kids WebSocket path)
- STT/TTS configuration — only if active goal requires voice work
- Railway env variables — only if deploy goal requires it
- Kids Brain architecture — only via curriculum-reviewer approval

---

## HOW TO RUN

Paste this into Claude Code:

> Read .claude/GLOBAL_GOAL.md and .claude/agents/goal-executor/AGENT.md.
> Act as autonomous Goal Executor. Work until the global goal is achieved
> or genuinely blocked. Use all internal agents, tests, reviews, logs,
> and iteration loops. Do not ask for confirmation unless secrets, paid
> accounts, destructive actions, or external credentials are required.
