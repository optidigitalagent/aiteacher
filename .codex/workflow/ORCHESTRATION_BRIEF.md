# Orchestration Brief - Autonomous Product Delivery V3

## Purpose

The user should talk to one intake-orchestrator, preferably through Telegram.
That orchestrator turns a rough product idea into a concrete goal, scenario
contract, acceptance criteria, phase plan, agent chain, and first next action.

The user is not a tester, prompt courier, or reviewer dispatcher. Codex owns
the chain until an allowed stop condition is reached.

## Required Agent Chain

Every non-trivial product goal must consider this chain. Applicability is
recorded explicitly; affected roles are blocking.

| Role | Responsibility | Blocks completion when |
|---|---|---|
| intake-orchestrator | Interview user, clarify outcome, create goal packet | Goal is ambiguous or not measurable |
| product-context-researcher | Inspect current product/code/workflow state | Plan relies on assumptions |
| goal-analyst | Convert idea into acceptance criteria and non-goals | Criteria do not match the user's outcome |
| scenario-designer | Build happy/negative/adversarial/live evidence matrix | Scenarios are missing for affected surfaces |
| architecture-planner | Split into phases and implementation tasks | Tasks are too broad or unsafe |
| backend-implementer | Backend/API/WS/data implementation | Backend scope changed without validation |
| frontend-implementer | UI/browser/client-state implementation | User workflow or browser state is unverified |
| voice-runtime-implementer | STT/TTS/mic/voice runtime work | Voice surface changed without voice evidence |
| prompt-curriculum-implementer | AI, prompt, lesson, curriculum behavior | Teacher behavior or curriculum authority is unverified |
| developer-reminder | Re-check current goal before each implementation pass | Work drifts from active goal |
| qa-tester | Focused and regression checks | Required tests fail or are missing |
| live-qa-orchestrator | Prove running-product behavior with browser/API/WS/log/voice evidence | Running-product evidence is missing |
| adversarial-product-critic | Try to break the product like the user would | Any critical scenario fails |
| failure-analyst | Root-cause failures and define repair tasks | Fix is symptom-only or unproven |
| acceptance-auditor | Audit every acceptance criterion against evidence | Any criterion is partial |
| deployment-verifier | Deploy, health-check, log-check, smoke-check | Production evidence is missing |
| handoff-scribe | Write compact next-chat handoff | State cannot be resumed safely |

## Developer Reminder Contract

Before every implementation pass, the developer-reminder must restate:

- current user outcome;
- current acceptance criterion being served;
- affected product surfaces;
- what evidence will prove the change;
- what must not be touched.

If the implementation task does not map to an acceptance criterion, stop and
run Goal Rebase Gate.
