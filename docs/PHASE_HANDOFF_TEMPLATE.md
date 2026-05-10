# PHASE_HANDOFF_TEMPLATE.md

# PURPOSE

This is the mandatory handoff template for every completed phase.

Every phase MUST end with a full handoff using this exact structure.
Copy this template, fill it in, and save it as:
docs/phase/PHASE_N_HANDOFF.md

The next Claude session depends on this handoff for continuity.

--------------------------------------------------
TEMPLATE START
--------------------------------------------------

# PHASE N COMPLETE

## 1. Summary

[5-10 lines maximum. What changed at a high level. What the classroom feels like now vs before.]

## 2. Goals Completed

Completed:
- [goal 1 actually completed]
- [goal 2 actually completed]

NOT completed (moved to next phase or future):
- [goal that was descoped]

## 3. Changed Files

Backend:
- backend/src/[path] — [what changed]

Frontend:
- frontend/src/[path] — [what changed]

Database:
- backend/migrations/[file].sql — [what was added]

Docs:
- docs/[file].md — [what was updated]

## 4. Backend Changes

[Explain what runtime behavior changed on the backend.]
[Include: new services, modified flows, state ownership changes.]
[Be specific about architecture, not just "updated X".]

## 5. Frontend Changes

[Explain what the user experience changed on the frontend.]
[Include: UI flow changes, interaction changes, voice changes.]

## 6. Database Changes

[List new tables, columns, indexes, migrations.]
[If no DB changes: "No database changes."]

## 7. Runtime Behavior Changes

Before:
[How the classroom behaved before this phase]

After:
[How the classroom behaves now]

[Describe from the user's perspective: what they feel, hear, see.]

## 8. WebSocket/Event Changes

Added:
- [new event name and payload]

Modified:
- [changed event payload]

Removed:
- [event no longer sent]

[If no WS changes: "No websocket event changes."]

## 9. AI/Prompt Changes

[Describe what changed in the AI system prompt or orchestration.]
[How did teacher behavior change?]
[If no AI changes: "No AI/prompt changes."]

## 10. Cost Impact

Cost impact:
- [STT usage change]
- [TTS usage change]
- [AI call frequency change]

[Or: "No meaningful cost impact."]

## 11. Tests Performed

Tested:
- [test 1 performed and result]
- [test 2 performed and result]

[Only list tests actually performed. Do NOT claim tests not run.]

## 12. Known Remaining Issues

Remaining issues:
- [issue 1 — severity and which phase will address it]
- [issue 2]

[This section must be honest. "None" is acceptable only if verified.]

## 13. What Was Intentionally NOT Changed

Intentionally NOT changed:
- [system 1 — why it was preserved]
- [system 2]

[This section prevents future Claude from accidentally revisiting completed decisions.]

## 14. Risks Introduced

New risks:
- [risk 1 — what could break and how to detect it]
- [risk 2]

[If no new risks: "No new risks introduced."]

## 15. Deployment Notes

[What must be done to deploy this phase to Railway.]
[New env variables, migrations, service restarts.]

[If no deployment changes: "No deployment changes required."]

## 16. Recommended Next Phase

Recommended next phase:
Phase N+1 — [Phase Name]

[Brief reason why this is next.]

## 17. Next Claude Session Instructions

Next Claude session should:
- Read docs/PAID_LESSON_RUNTIME_ROADMAP.md first
- Read docs/phase/PHASE_N_HANDOFF.md (this document)
- Read docs/RUNTIME_GUARDRAILS.md
- Read docs/WEBSOCKET_EVENT_CONTRACT.md
- [specific file to inspect before starting]
- [specific thing to preserve]
- [dangerous area to avoid]
- Continue from Phase N+1 ONLY

DO NOT:
- [thing that would regress Phase N work]
- [system to leave untouched]

--------------------------------------------------
TEMPLATE END
--------------------------------------------------

# NOTES ON WRITING A GOOD HANDOFF

1. Be specific about file paths and line numbers when relevant.
2. Do not claim tests were run if they weren't.
3. Section 13 (Not Changed) is as important as Section 3 (Changed).
4. Section 17 (Next Session Instructions) is the most critical section.
   Write it as if briefing a colleague who has never seen this codebase.
5. Never end a phase handoff with just "done" or "all implemented".
   A phase is complete only when the handoff is complete.
